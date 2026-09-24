/**
 * THE ASSET GATE — the arena draws its stage, and anyone acts, only once the
 * player's extracted art has SETTLED (2026-09-24).
 *
 * ► **THE OWNER'S REPORT: "the 'old skins' flash for a second before being
 *   populated by the real swords and sandals 2 skins."** `tools/arena/main.js`
 *   started its `requestAnimationFrame` loop at once while every pack arrived
 *   on its own fetch and filled a module variable when it landed, so the first
 *   frames drew the AUTHORED fallback — the vector gladiators, the authored
 *   bowl — and then swapped. Under `?spectate=1` or a `?play=` AI seat the AI
 *   could even act before the art was in.
 *
 * **Settled** is loaded, or DEFINITIVELY absent: a 404 (the loader answers
 * `null`) or a network or parse error (the loader rejects). A fresh clone has
 * no `assets/` at all — the repository ships no SS2 asset — so every pack 404s
 * at once and the gate opens on those answers, with no wait: the fallback is
 * the SUPPORTED case, never an error and never a delay.
 *
 * ► **A TIMEOUT, BECAUSE A REQUEST THAT NEVER ANSWERS MUST NOT HOLD THE ARENA
 *   FOREVER.** `ARENA_ASSET_TIMEOUT_MS` below says why 8 s.
 *
 * ► **A PACK THAT ARRIVES AFTER THE GATE OPENED IS NOT USED FOR THAT BOUT.**
 *   Swapping art mid-bout is exactly the flash the owner reported, only later
 *   and worse — a gladiator changing skin in the middle of a swing. So the set
 *   of packs in use is fixed at the moment the gate opens (`inUse`), a late
 *   arrival is recorded (`lateArrivals`) so the page can say so, and a reload
 *   picks it up.
 *
 * ► **SOUND IS NOT A VISUAL PACK AND DOES NOT HOLD THE STAGE.** Its manifest
 *   and its decodes keep loading in the background, as they always have; a
 *   sound that is not decoded yet is dropped rather than played late
 *   (`tools/arena/sound-player.js`).
 *
 * ► **THE CHAMPION PACK IS NOT IN THE GATE, AND DOES NOT NEED TO BE.** A
 *   `?red=`/`?blue=` bout fetches `assets/champions/` inside `arenaTeams()`,
 *   which `main.js` AWAITS AT THE TOP LEVEL before the host is built — before
 *   this gate exists, before any pack fetch starts and before the first frame
 *   is scheduled — and a missing pack REFUSES to start the arena rather than
 *   falling back (there is no authored stand-in for the build's own bosses).
 *   So it has always settled by the time anything could draw.
 *
 * Pure: no DOM, no `fetch`, no timers. The caller hands in the loaders'
 * promises and a clock and asks, each frame, whether the stage may draw. This
 * is the part of the startup path the suite can reach; `main.js` is the fetches
 * and the painting (`test/arena-asset-gate.test.js`).
 */

/**
 * HOW LONG THE ARENA WAITS FOR A VISUAL PACK BEFORE IT DRAWS WITHOUT IT: 8 s.
 *
 * - **Long enough never to trip on a pack that IS coming.** The eight visual
 *   packs are 15.15 MB of JSON and images on the extracting machine (measured
 *   2026-09-24; the rig's two files are 6.61 MB of it), served by
 *   `tools/arena-server.mjs` on LOOPBACK ONLY — and node reads and parses the
 *   seven JSON packs in about 65 ms there. So a normal load should be a small
 *   fraction of a second, and 8 s leaves two orders of magnitude for a cold
 *   disk and a busy parser on a machine that is memory-starved and runs many
 *   agents.
 * - **Short enough that a request that never answers costs a person seconds,
 *   not the bout.** A hung request is the only thing the timeout exists for;
 *   a 404 or a network error settles the pack at once and never waits for it.
 *
 * Authored, not measured in a browser (no agent on this project may launch
 * one). If a real load ever trips it, the log line names which pack was late
 * and by how much, and that is the number to set this from.
 */
export const ARENA_ASSET_TIMEOUT_MS = 8000;

/**
 * THE VISUAL PACKS THE STAGE WAITS FOR, in the order the log names them.
 * `label` is what a log line calls the pack; `files` is what it is, so a
 * person reading "late: bitmaps" knows which directory to look at.
 */
export const ARENA_VISUAL_PACKS = Object.freeze([
  Object.freeze({ name: "figure", label: "the figure rig", files: "assets/figure/shapes.json + animations.json" }),
  Object.freeze({ name: "wardrobe", label: "the wardrobe", files: "assets/figure/wardrobe.json" }),
  Object.freeze({ name: "enchantments", label: "the enchantment ladder", files: "assets/figure/enchantments.json" }),
  Object.freeze({ name: "props", label: "the props and the arena screen", files: "assets/props/props.json" }),
  Object.freeze({ name: "clipEffects", label: "the blood-and-sparks table", files: "assets/props/clip-effects.json" }),
  Object.freeze({ name: "text", label: "the UI bar's glyphs", files: "assets/text/text.json" }),
  Object.freeze({ name: "icons", label: "the face and the pop-ups", files: "assets/icons/icons.json" }),
  Object.freeze({ name: "bitmaps", label: "the arena's raster walls and crowds", files: "assets/bitmaps/" })
]);

/** How each pack ended up for the bout. */
export const PackOutcome = Object.freeze({
  /** Its loader answered data, in time: the build's own art is drawn. */
  LOADED: "loaded",
  /** Its loader answered `null` — a 404: the authored fallback is drawn. */
  MISSING: "missing",
  /** Its loader rejected — a network or parse error: the authored fallback is drawn. */
  FAILED: "failed",
  /** Still unanswered when the timeout opened the gate: the fallback is drawn, and a later answer is ignored. */
  LATE: "late"
});

const namesOf = (packs) => packs.map((pack) => (typeof pack === "string" ? pack : pack.name));

/**
 * THE RULE, as one pure function of what has settled and what time it is.
 *
 * Open when every pack has settled (`reason: "settled"`), or when the clock
 * has reached the timeout (`reason: "timeout"`), whichever comes first; a pack
 * that settled before the gate was ASKED counts, whatever the clock says,
 * because nothing has been drawn from its absence yet. A clock that is not a
 * number never opens it on time — it cannot time out, and it cannot be early.
 *
 * @param {object} input
 * @param {string[]} input.names        the packs waited for
 * @param {Map<string, object>} input.settled  name -> its settlement, for each that has
 * @param {number} input.startedAtMs    when the loaders started
 * @param {number} input.nowMs          the clock now
 * @param {number} [input.timeoutMs]
 * @returns {{open: boolean, reason: "settled"|"timeout"|null, settledCount: number, total: number,
 *   waiting: string[], elapsedMs: number}}
 */
export function assetGateVerdict({ names, settled, startedAtMs, nowMs, timeoutMs = ARENA_ASSET_TIMEOUT_MS }) {
  const waiting = names.filter((name) => !settled.has(name));
  const elapsedMs = Number(nowMs) - Number(startedAtMs);
  const timedOut = Number.isFinite(elapsedMs) && elapsedMs >= timeoutMs;
  const open = waiting.length === 0 || timedOut;
  return {
    open,
    reason: !open ? null : waiting.length === 0 ? "settled" : "timeout",
    settledCount: names.length - waiting.length,
    total: names.length,
    waiting,
    elapsedMs
  };
}

/**
 * A gate over the arena's pack loaders.
 *
 * `track(name, promise)` hands it one loader: a promise of the pack's data,
 * `null` for a 404, or a rejection for a network or parse error. `status(now)`
 * is asked once a frame; the FIRST answer that is open is LATCHED — `inUse`
 * and `outcomes` never change after it, whatever arrives later — and every
 * later call returns that same object.
 *
 * A pack that is declared but never tracked counts as waiting, so a loader
 * someone forgot to wire costs the timeout and is NAMED as late, rather than
 * quietly shrinking the count. A pack tracked twice, or one not declared,
 * throws: both are wiring mistakes in the page, not states of the network.
 *
 * @param {object} options
 * @param {() => number} options.clock   milliseconds; the page's `performance.now`
 * @param {Array<string|{name: string}>} [options.packs]   default `ARENA_VISUAL_PACKS`
 * @param {number} [options.timeoutMs]   default `ARENA_ASSET_TIMEOUT_MS`
 * @param {(arrival: object) => void} [options.onLateArrival]  told of each pack that settles after the gate opened
 */
export function createAssetGate({ clock, packs = ARENA_VISUAL_PACKS, timeoutMs = ARENA_ASSET_TIMEOUT_MS, onLateArrival = null } = {}) {
  if (typeof clock !== "function") throw new TypeError("createAssetGate needs a clock: () => milliseconds");
  const names = Object.freeze(namesOf(packs));
  const known = new Set(names);
  if (known.size !== names.length) throw new RangeError(`the asset gate's packs repeat a name: ${names.join(", ")}`);
  const tracked = new Set();
  const settled = new Map();
  const lateArrivals = [];
  const startedAtMs = clock();
  let opened = null;

  function settle(name, outcome, data, error) {
    const atMs = clock();
    const record = Object.freeze({
      outcome,
      data: outcome === PackOutcome.LOADED ? data : null,
      atMs,
      error: error === undefined ? null : String(error?.message ?? error)
    });
    if (opened) {
      // After the gate: recorded so the page can say so, and NOT used.
      const arrival = Object.freeze({ name, outcome, atMs, afterOpenMs: atMs - opened.openedAtMs, error: record.error });
      lateArrivals.push(arrival);
      if (typeof onLateArrival === "function") onLateArrival(arrival);
      return;
    }
    settled.set(name, record);
  }

  function latch(verdict, nowMs) {
    const inUse = {};
    const outcomes = {};
    const errors = {};
    for (const name of names) {
      const record = settled.get(name);
      inUse[name] = record ? record.data : null;
      outcomes[name] = record ? record.outcome : PackOutcome.LATE;
      if (record?.error) errors[name] = record.error;
    }
    return Object.freeze({
      ...verdict,
      waiting: Object.freeze([...verdict.waiting]),
      openedAtMs: nowMs,
      inUse: Object.freeze(inUse),
      outcomes: Object.freeze(outcomes),
      errors: Object.freeze(errors),
      late: Object.freeze([...verdict.waiting])
    });
  }

  return Object.freeze({
    names,
    startedAtMs,
    timeoutMs,

    track(name, promise) {
      if (!known.has(name)) throw new RangeError(`the asset gate waits for no pack called "${name}" (it knows ${names.join(", ")})`);
      if (tracked.has(name)) throw new Error(`the asset gate is already tracking "${name}"`);
      tracked.add(name);
      Promise.resolve(promise).then(
        (data) => settle(name, data === null || data === undefined ? PackOutcome.MISSING : PackOutcome.LOADED, data),
        (error) => settle(name, PackOutcome.FAILED, null, error ?? "rejected")
      );
    },

    /** How far along it is, WITHOUT opening it: what the loading frame counts. */
    progress() {
      const waiting = names.filter((name) => !settled.has(name));
      return Object.freeze({ settledCount: names.length - waiting.length, total: names.length, waiting: Object.freeze(waiting) });
    },

    /**
     * Whether the stage may draw and the bout may start, at `nowMs`. Closed:
     * the verdict. Open: the latched verdict, with `inUse` (name -> the pack's
     * data, or null for its fallback), `outcomes`, `errors`, `late` and
     * `openedAtMs` — the same object on every later call.
     */
    status(nowMs = clock()) {
      if (opened) return opened;
      const verdict = assetGateVerdict({ names, settled, startedAtMs, nowMs, timeoutMs });
      if (!verdict.open) return verdict;
      opened = latch(verdict, nowMs);
      return opened;
    },

    /** The packs that settled after the gate opened, in arrival order: said, never used. */
    lateArrivals() {
      return Object.freeze([...lateArrivals]);
    }
  });
}

/**
 * WHAT THE LOG SAYS WHEN THE GATE OPENS, as `{message, warn}` lines.
 *
 * On `settled` it is one quiet line: how long, and how many of the packs are
 * the build's own. On `timeout` it WARNS, and names every late pack by what it
 * is, because "the arena looks authored" with no reason given is the exact
 * question that started this module. A failed pack says its error.
 */
export function assetGateReport(opened, packs = ARENA_VISUAL_PACKS) {
  if (!opened?.open) return [];
  const labelOf = new Map(packs.map((pack) => (typeof pack === "string" ? [pack, pack] : [pack.name, pack.label ?? pack.name])));
  const seconds = (ms) => `${(Math.max(0, ms) / 1000).toFixed(2)} s`;
  const counted = (outcome) => Object.values(opened.outcomes).filter((value) => value === outcome).length;
  const lines = [];
  const tally = `${counted(PackOutcome.LOADED)} loaded, ${counted(PackOutcome.MISSING)} missing, ${counted(PackOutcome.FAILED)} failed`;
  if (opened.reason === "settled") {
    lines.push({
      message: `asset gate: all ${opened.total} visual pack(s) settled in ${seconds(opened.elapsedMs)} (${tally}); the stage draws now.`,
      warn: false
    });
  } else {
    const late = opened.late.map((name) => `${name} (${labelOf.get(name) ?? name})`).join(", ");
    lines.push({
      message: `asset gate: ${seconds(opened.elapsedMs)} timeout — the stage draws with ${opened.settledCount} of ${opened.total} ` +
        `(${tally}). LATE, and not used this bout: ${late}. Reload to use it.`,
      warn: true
    });
  }
  for (const [name, error] of Object.entries(opened.errors ?? {})) {
    lines.push({ message: `asset gate: ${name} failed (${String(error).slice(0, 120)}) — its fallback is drawn.`, warn: true });
  }
  return lines;
}

/** The log line for one pack that arrived after the gate opened. */
export function lateArrivalReport(arrival) {
  const seconds = (Math.max(0, arrival.afterOpenMs) / 1000).toFixed(2);
  return {
    message: `asset gate: ${arrival.name} ${arrival.outcome === PackOutcome.LOADED ? "arrived" : `settled (${arrival.outcome})`} ` +
      `${seconds} s after the gate opened — not used this bout, so nothing swaps mid-fight. Reload to use it.`,
    warn: true
  };
}

/** One breath of the loading bar's empty track, in ms. Slow on purpose: it says "alive", not "busy". */
export const LOADING_BREATH_MS = 1600;

/**
 * THE LOADING FRAME, as data: what to write and how full the bar is.
 *
 * `trackAlpha` is the one thing that moves — a slow breath on the bar's empty
 * track, so a pack that takes seconds does not read as a hung page — and
 * under `prefers-reduced-motion` it is CONSTANT: nothing on the frame moves
 * except the count, which changes in whole steps as packs settle. No spinner.
 *
 * @param {{settledCount: number, total: number}} progress   `gate.progress()`
 * @param {{elapsedMs?: number, reducedMotion?: boolean}} [options]
 */
export function loadingFrameFor(progress, { elapsedMs = 0, reducedMotion = false } = {}) {
  const total = Math.max(0, Number(progress?.total) || 0);
  const settledCount = Math.min(total, Math.max(0, Number(progress?.settledCount) || 0));
  const phase = Number.isFinite(elapsedMs) ? (elapsedMs % LOADING_BREATH_MS) / LOADING_BREATH_MS : 0;
  return Object.freeze({
    title: "Loading your arena…",
    count: `${settledCount} of ${total}`,
    progress: total === 0 ? 1 : settledCount / total,
    trackAlpha: reducedMotion ? 0.35 : 0.25 + 0.2 * (0.5 - 0.5 * Math.cos(phase * 2 * Math.PI))
  });
}
