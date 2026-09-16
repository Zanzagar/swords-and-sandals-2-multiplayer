/**
 * A screenshot of a served page taken in REAL TIME, over the Chrome DevTools
 * Protocol — and frozen at a DETERMINISTIC FRAME so two shots can be compared.
 *
 * ## Why this exists beside `tools/shot.sh`, which already takes screenshots
 *
 * ► **`tools/shot.sh` CANNOT SHOOT A PAGE THAT COMPOSITES A FILTER, AND THE
 *   FAILURE LOOKS LIKE A PAGE DEFECT.** It drives Chrome with
 *   `--screenshot --virtual-time-budget=30000`, which asks Chrome to simulate
 *   thirty seconds of page time as fast as it can and shoot the result. On the
 *   arena with an enchanted gladiator that never finishes — measured
 *   2026-09-15 at budgets 1200, 2500, 3000 and 6000, killed at 100s, 150s,
 *   240s and 280s alike, while the SAME page without the glow shoots in two
 *   seconds.
 *
 * ► **AND THE PAGE IS FINE. That was the expensive half to learn.** A CPU
 *   profile over CDP puts **95.8% of samples in `(program)`** — native
 *   rasterisation, not script — with `drawImage`, `fill` and the page's own
 *   `frame`/`render` all ticking. Measured in real time the page runs at
 *   **15.51 fps against 60.16 without the glow** (64.5ms against 16.6ms a
 *   frame, two enchanted gladiators, headless software rendering). That is a
 *   real cost and it is worth knowing, but it is NOT a hang: the stall belongs
 *   to virtual time, which does not advance while a filtered composite is
 *   outstanding.
 *
 *   **So a `FAILED` from `tools/shot.sh` is evidence about the SCREENSHOT MODE,
 *   not about the page.** I published "it hangs, cause not found" on the
 *   strength of one before writing this file.
 *
 * ## The second reason: a moving scene cannot be differenced
 *
 * This project's rule is that the difference between two shots is the
 * measurement and one shot proves nothing. **That silently assumes the two
 * shots are otherwise identical, and on an animating page they are not.**
 * Differencing two arena shots taken seconds apart reported 10,419 changed
 * pixels whose biggest movers were black-to-white — the weapon had MOVED. The
 * filter's own contribution was underneath it and unreadable.
 *
 * So this freezes the page at a frame COUNT rather than a wall-clock moment:
 * `requestAnimationFrame` is wrapped before any page script runs, and the loop
 * stops scheduling once the requested frame is reached. Two runs at the same
 * frame land on the same animation state, and what is left between them is the
 * thing being toggled. Frozen at frame 120, the same pair differenced to a
 * clean cyan-over-navy signature — `#0072b7`, `#006baa`, `#0565ab` on
 * near-black, mean channel shift R −7.8 G +2.7 B **+22.2** — which is the frost
 * enchantment and nothing else.
 *
 * ## It also does not leak the browser, which `tools/shot.sh` does
 *
 * ► **MEASURED: 73 Chrome processes were alive on this machine**, one per
 *   earlier `shot.sh` invocation. They accumulate until new ones cannot start,
 *   and the symptom is screenshots failing for URLs that worked minutes
 *   earlier — which reads as a page defect and is not. It masked the finding
 *   above for half an hour. This script starts its own browser and kills it in
 *   a `finally`.
 *
 * ## Running it — and it needs the WINDOWS node, not this one
 *
 * Chrome binds its debugging port to the Windows loopback and ignores
 * `--remote-debugging-address`, so a WSL process cannot reach it. `AGENTS.md`
 * already records where a Windows node lives; this resolves it rather than
 * pinning it, because the directory moves on update.
 *
 * ```
 *   tools/shot-live.sh <name> "<query>" [width] [height] [freezeAtFrame] [page-path] [cpu|gpu]
 *
 * (The `.mjs` takes the WSL address as its FIRST argument; the wrapper supplies
 * it. Call the wrapper.)
 * ```
 *
 * Writes `C:\\ss2-shots\\<name>.png` (that is `/mnt/c/ss2-shots/<name>.png` from
 * WSL) and prints the WSL spelling, the frame it froze
 * at, and the byte count — the same contract `tools/shot.sh` has, so the two
 * are interchangeable at the call site.
 *
 * Node builtins only. Reads the repository and writes one PNG.
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

/**
 * ► **WINDOWS PATHS, BECAUSE THIS PROCESS IS THE WINDOWS NODE.** The first
 *   version used `/mnt/c/...`, which is how WSL sees the same files — under the
 *   Windows node that resolves against a `\\wsl.localhost\...` cwd and
 *   `mkdir` answers `EPERM`. The `/mnt/c` spelling is correct in the WRAPPER
 *   and wrong here, which is the same one-register-apart trap this repository
 *   already records for the arena's rocks and blood.
 */
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SHOT_DIR = "C:\\ss2-shots";
/** The same directory as WSL sees it, for the line a human copies. */
const SHOT_DIR_WSL = "/mnt/c/ss2-shots";
const PORT = 9222;

/**
 * The Windows node, RESOLVED rather than pinned.
 *
 * `AGENTS.md` names `codex-primary-runtime` and warns in the same breath that
 * the directory moves on update, so a hard-coded path here would be a
 * scheduled failure. Every candidate is reported when none works, because "no
 * Windows node" and "I looked in one place" are different findings.
 */
export function windowsNodeCandidates(home = "/mnt/c/Users/corey") {
  const root = path.join(home, ".cache", "codex-runtimes");
  const out = [];
  let runtimes = [];
  try {
    runtimes = fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch { return out; }
  for (const runtime of runtimes) {
    out.push(path.join(root, runtime, "dependencies", "node", "bin", "node.exe"));
  }
  return out;
}

export function resolveWindowsNode(home) {
  const candidates = windowsNodeCandidates(home);
  for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
  return null;
}

/**
 * The page-side freeze, installed BEFORE any page script runs.
 *
 * ► **AND IT PINS THE CLOCK TO THE FRAME NUMBER.** A frame count alone is not
 *   determinism: the page animates on elapsed time, so two browsers reaching
 *   frame 120 at different moments show different scenes. `performance.now` and
 *   `Date.now` are driven from the counter, which makes the scene a pure
 *   function of the frame number.
 *
 * ► **IT WRAPS `requestAnimationFrame` RATHER THAN CANCELLING A HANDLE**, so it
 *   does not need to know how the page schedules. The page's loop calls the
 *   global; the wrapper counts, and past the requested frame it simply stops
 *   invoking the callback, which ends the chain without throwing inside it.
 *
 * ► **`__frozen` IS A SEPARATE FLAG FROM `__frames`** because a caller polling
 *   the count cannot tell "stopped at 120" from "still running and currently at
 *   120", and shooting the second one would put an animating page in a file
 *   labelled as frozen.
 */
export function freezeScript(at, step = 1000 / 60) {
  return `(() => {
    const real = window.requestAnimationFrame.bind(window);
    const epoch = Date.now();
    let n = 0; window.__frames = 0; window.__frozen = false;
    // ► **A VIRTUAL CLOCK, AND WITHOUT IT THE FREEZE IS NOT DETERMINISTIC.**
    //   Freezing at frame 120 alone still let two runs land on DIFFERENT scenes,
    //   because the page animates on elapsed time and two browsers do not reach
    //   their 120th frame at the same moment. Measured: the same pair
    //   differenced to a mean blue shift of +22.2 when both were frozen inside
    //   one browser and +5.1 across two, with the rest of the delta being the
    //   weapon having MOVED. Pinning the clock to the frame NUMBER makes the
    //   scene a pure function of that number, so what is left between two shots
    //   is the thing under test.
    const now = () => n * ${step};
    performance.now = now;
    Date.now = () => epoch + now();
    window.requestAnimationFrame = (callback) => real(() => {
      window.__frames = n += 1;
      if (n >= ${Number(at)}) { window.__frozen = true; return; }
      callback(now());
    });
  })();`;
}

export function parseArguments(argv) {
  if (argv.length < 2) return null;
  // ► **HOST FIRST, AND IT IS AN ARGUMENT RATHER THAN AN ENVIRONMENT VARIABLE.**
  //   The first version passed it as `SS2_HOST`; a WSL process does not hand its
  //   environment to a Windows one unless the name is listed in `WSLENV`, so the
  //   variable arrived undefined and the script refused with a message about
  //   itself. An argument crosses the boundary unconditionally.
  const [host, name, query = "", width = "1200", height = "800", freeze = "120",
    page = "/tools/arena/index.html", rasteriser = "cpu"] = argv;
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new Error(`Refusing the name "${name}": it becomes a filename, so keep it to letters, digits, dot, dash, underscore.`);
  }
  // ► **`cpu` IS THE DEFAULT BECAUSE IT IS WHAT EVERY EXISTING NUMBER WAS
  //   MEASURED UNDER, NOT BECAUSE IT IS RIGHT.** Changing the default would
  //   silently re-base every pixel count in this repository against a rasteriser
  //   none of them were taken on. A value this refuses by name is better than a
  //   typo quietly selecting the other one.
  if (rasteriser !== "cpu" && rasteriser !== "gpu") {
    throw new Error(`Refusing the rasteriser "${rasteriser}": it is "cpu" (adds --disable-gpu) or "gpu" (omits it).`);
  }
  return {
    host, name, query,
    width: Number(width), height: Number(height), freeze: Number(freeze),
    page: page.startsWith("/") ? page : `/${page}`,
    rasteriser
  };
}

/**
 * THE FLAGS THIS STARTS CHROME WITH — a pure function, so the suite reaches the
 * one decision on this route that has ever changed a measurement.
 *
 * ► **`--disable-gpu` IS SOFTWARE RASTERISATION, AND IT HAS ALREADY BEEN
 *   REPORTED AS A PROPERTY OF THE PAGE ONCE.** The "3.9x frame cost" of the
 *   weapon glow was this flag: with GPU rasterisation the same feature is about
 *   a millisecond a frame per fighter and free at two. **Every pixel count in
 *   this repository was taken with the flag on**, including the fractional-clip
 *   residual that `stageClipRectFor` now snaps away, and nothing had ever varied
 *   it — which is why it is an argument now rather than a constant.
 *
 * ► **AND THE OTHER FLAGS ARE NOT NEUTRAL EITHER, SO THEY ARE LISTED HERE
 *   RATHER THAN BURIED IN THE SPAWN.** `--hide-scrollbars` changes the layout
 *   width; `--window-size` is what `Emulation.setDeviceMetricsOverride` then
 *   re-asserts. A reader comparing two numbers taken months apart needs to see
 *   what was held fixed.
 */
export function chromeFlagsFor({ width, height, profile, port, rasteriser = "cpu" }) {
  return [
    "--headless=new",
    ...(rasteriser === "cpu" ? ["--disable-gpu"] : []),
    "--no-sandbox", "--hide-scrollbars",
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    `--remote-debugging-port=${port}`, "--remote-allow-origins=*",
    "about:blank"
  ];
}

/**
 * The address the WSL server is reachable at, FROM WINDOWS.
 *
 * ► **IT IS PASSED IN, NOT DISCOVERED, BECAUSE THIS PROCESS IS THE WINDOWS
 *   ONE.** The first version called `hostname -I`, which is a WSL idiom; run
 *   under the Windows node it resolves to `hostname.exe` and answers
 *   *"sethostname: Use the Network Control Panel Applet"*. `tools/shot-live.sh`
 *   computes it on the WSL side, where `hostname -I` means what it says, and
 *   hands it over. **`127.0.0.1` is NOT a substitute** — this repository has
 *   three sessions on record that called the server healthy by curling it from
 *   the one place it was always going to work.
 */
function serverAddress(given) {
  if (given && given.length > 0) return given;
  throw new Error(
    "No server address given. Run this through tools/shot-live.sh, which computes it with "
    + "`hostname -I` on the Linux side — this process is the WINDOWS node and cannot."
  );
}

/** One CDP request/response channel over the browser's page target. */
async function connect(port) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = list.find((entry) => entry.type === "page");
  if (!target) throw new Error("Chrome is up but has no page target to drive.");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const waiter = message.id && pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    message.error ? waiter.reject(new Error(JSON.stringify(message.error))) : waiter.resolve(message.result);
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve);
    socket.addEventListener("error", () => reject(new Error(`No CDP at 127.0.0.1:${port}.`)));
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const messageId = id += 1;
    pending.set(messageId, { resolve, reject });
    socket.send(JSON.stringify({ id: messageId, method, params }));
  });
  return { send, close: () => socket.close() };
}

async function main(argv) {
  const options = parseArguments(argv);
  if (!options) {
    console.error("Usage: node tools/shot-live.mjs <host> <name> \"<query>\" [width] [height] [freezeAtFrame] [page-path] [cpu|gpu]");
    console.error("  Run it with the WINDOWS node — Chrome's debug port is not reachable from WSL.");
    process.exitCode = 1;
    return;
  }
  const url = `http://${serverAddress(options.host)}:8123${options.page}?${options.query}`;
  const out = path.win32.join(SHOT_DIR, `${options.name}.png`);
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  fs.rmSync(out, { force: true });
  const profile = path.win32.join(SHOT_DIR, `profile-live-${options.name}`);
  fs.rmSync(profile, { recursive: true, force: true });

  const chrome = spawn(CHROME, chromeFlagsFor({
    width: options.width, height: options.height, profile, port: PORT,
    rasteriser: options.rasteriser
  }), { stdio: "ignore", detached: false });

  let session = null;
  try {
    // Poll for the port rather than sleeping a guessed interval: a fixed sleep
    // is either slower than it needs to be or shorter than a cold start.
    const ready = Date.now() + 30000;
    while (Date.now() < ready) {
      try { await fetch(`http://127.0.0.1:${PORT}/json/version`); break; } catch { /* not up yet */ }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    session = await connect(PORT);
    await session.send("Page.enable");
    await session.send("Runtime.enable");
    await session.send("Emulation.setDeviceMetricsOverride", {
      width: options.width, height: options.height, deviceScaleFactor: 1, mobile: false
    });
    await session.send("Page.addScriptToEvaluateOnNewDocument", { source: freezeScript(options.freeze) });
    await session.send("Page.navigate", { url });

    const deadline = Date.now() + 120000;
    let state = { f: 0, z: false };
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const result = await session.send("Runtime.evaluate", {
        expression: "JSON.stringify({f: window.__frames|0, z: !!window.__frozen})", returnByValue: true
      });
      state = JSON.parse(result.result.value);
      if (state.z) break;
    }
    if (!state.z) {
      // ► A SHOT OF A PAGE THAT NEVER REACHED THE FRAME IS NOT THE SHOT THAT
      //   WAS ASKED FOR, and writing it anyway is how a moving scene ends up in
      //   a file a reader differences.
      throw new Error(`Never reached frame ${options.freeze} — stopped at ${state.f}. The page may not animate, or may be far slower than expected.`);
    }
    // One settle, so the frame the loop stopped on is the one on the surface.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    // ► **THE PAGE'S OWN STAGE RECTANGLE, READ BACK BESIDE THE PICTURE.** A
    //   screenshot coordinate cannot be turned into a stage coordinate without
    //   it, and every "inside the stage" number this project has published so
    //   far was computed from a rectangle the READER derived off the page
    //   layout — once wrongly, by ten thousand pixels of area. The arena sets
    //   `window.__stageFit` from `stageFitReportFor` every frame; a page that
    //   does not is silent rather than an error, because this tool shoots
    //   several pages and only one of them has a stage.
    const reported = await session.send("Runtime.evaluate", {
      expression: "window.__stageFit ? JSON.stringify(window.__stageFit) : null",
      returnByValue: true
    });
    const stageFit = reported?.result?.value ?? null;

    const { data } = await session.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(out, Buffer.from(data, "base64"));
    // The WSL spelling, because the caller reads it from Linux.
    // ► **THE RASTERISER IS ON THE OUTPUT LINE BECAUSE IT IS NOT RECOVERABLE
    //   FROM THE PNG.** Two shots that differ only in this flag are a
    //   measurement; two shots whose flag nobody wrote down are a puzzle, and
    //   this repository has already spent a session on one of those.
    console.log(`${SHOT_DIR_WSL}/${options.name}.png  frame ${state.f}  ` +
      `${fs.statSync(out).size} bytes  rasteriser ${options.rasteriser}`);
    if (stageFit) console.log(`  stage: ${stageFit}`);
  } finally {
    session?.close();
    // ► **THE BROWSER IS KILLED HERE, WHICH IS THE WHOLE OF THE LEAK FIX.**
    chrome.kill("SIGKILL");
    try { execFileSync("taskkill.exe", ["/F", "/IM", "chrome.exe"], { stdio: "ignore" }); } catch { /* none left */ }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith("shot-live.mjs")) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(String(error.message));
    process.exitCode = 1;
  });
}
