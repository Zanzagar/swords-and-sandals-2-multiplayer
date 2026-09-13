/**
 * The decisions `tools/arena/main.js` was making where no test could see them.
 *
 * ## Why this file exists
 *
 * `tools/arena/main.js` is a BROWSER module: it imports from absolute URLs
 * (`/src/render/index.js`), touches `document`, `Audio` and
 * `requestAnimationFrame`, and node cannot load it at all. That is a deliberate
 * split — the shell is meant to be thin — but "thin" drifted, and the file has
 * given up **five live defects in a single day**, every one of them a decision
 * rather than a drawing:
 *
 * 1. `?rank=0` silently selected the SHIPPED rule set instead of the
 *    one-dimensional one, so the arena could not be put into the 1-D game at
 *    all while its docstring promised it could.
 * 2. One `Audio` element per file meant every sound cut the previous one off —
 *    which the owner heard as *"sounds get cut off and dont play out"*.
 * 3. Autoplay rejections were caught and discarded, so a spectated bout ran
 *    silent with no explanation anywhere.
 * 4. A throw inside `render()` stopped the animation loop permanently.
 * 5. The provenance panel claimed the figures were authored while the
 *    extracted rig was drawn over the sentence saying so.
 *
 * **Only the first two are logic this file can hold**; the others are genuinely
 * shell-shaped and are fixed in place. That is the honest boundary, and the rest
 * of `main.js` remains unreachable by the suite.
 *
 * Nothing here touches a DOM node, a canvas, a timer or an `Audio`. It takes
 * values and returns values, which is the only reason the suite can reach it.
 */

export class ArenaShellError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Which rank stride the arena should run at, from the query string.
 *
 * ► **A MISSING `?rank` IS NOT `?rank=0`, and conflating them was the defect.**
 *   The shell read `Number(params.get("rank")) || 0`, so both absent and zero
 *   became 0 — and then selected the module singleton on 0, which IS the
 *   shipped 97 rule set. Asking explicitly for the flat game handed back the
 *   second axis.
 *
 *   Absent means "the shipped default"; `0` means "the one-dimensional game",
 *   and they are different answers.
 *
 * A non-numeric value is 0 rather than an error: `?rank=banana` asking for the
 * flat game is a harmless reading of a typo, where throwing would take the
 * arena down over a URL.
 */
export function rankStrideFrom(params, shippedStride) {
  if (!params || typeof params.has !== "function" || !params.has("rank")) return shippedStride;
  const raw = Number(params.get("rank"));
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return raw;
}

/**
 * The rule set for a stride — the module SINGLETON when the request is the
 * shipped default, a fresh one otherwise.
 *
 * ► **COMPARE AGAINST THE SHIPPED VALUE, NEVER AGAINST ZERO.** The singleton is
 *   `createSs2TeamRules()` and therefore carries whatever the default stride is.
 *   `rankStride === 0 ? singleton : …` was correct only while the default WAS
 *   zero; the moment 97 shipped it started returning the second axis to anybody
 *   who asked for the flat game. **The same line was fixed in
 *   `tools/engagement-census.mjs` on 2026-09-12 and survived here until
 *   2026-09-13**, because nothing could test this file.
 *
 * The singleton matters because it is the object the goldens and the test suite
 * run against: using it when the request IS the default means the shipped arena
 * is the shipped rule set rather than a lookalike built from the same defaults.
 */
export function selectRules(rankStride, { shippedStride, singleton, create }) {
  if (typeof create !== "function") throw new ArenaShellError("selectRules needs a `create` factory.");
  if (rankStride === shippedStride) return singleton;
  return create({ rankStride });
}

/**
 * How many sound voices may be in flight, and which to retire.
 *
 * ► **ONE `Audio` ELEMENT PER FILE MEANT ONE SOUND AT A TIME.** The shell
 *   cached a single element per file and restarted it with `currentTime = 0` on
 *   every play, under a comment calling that "restart rather than overlap". With
 *   six gladiators it is not a restart — it is the previous sound TRUNCATED
 *   mid-note, which is exactly what the owner reported.
 *
 *   **And the collisions are far commoner than a guess would have them, because
 *   the build SHARES sound files across labels.** Measured on the extracted
 *   manifest: `706.mp3` is bound to FIVE — `stepback`, `stepforward`, `runback`,
 *   `runforward` and `attack12`. So a walk and an attack in the same step cut
 *   each other off through a file neither looks related to.
 *
 * This decides the POLICY — retire what has finished, drop the oldest when full
 * — and the shell owns the elements. `voices` is an array of anything with
 * `ended` and `paused`; nothing here plays or pauses.
 *
 * Returns `{keep, evict}`: the voices that survive, and the ones the caller
 * should stop.
 */
export function retireVoices(voices, limit) {
  if (!Array.isArray(voices)) return { keep: [], evict: [] };
  const cap = Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : 1;
  const evict = [];
  // Finished voices first: they cost nothing to reclaim and stopping a live one
  // to make room for a new one is audible where reclaiming a dead one is not.
  const live = [];
  for (const voice of voices) {
    // A null entry is not a live voice. Reading it as one was the first version
    // of this line, and it would have let holes in the array crowd out real
    // sounds — the same truncation this function exists to stop.
    if (!voice || voice.ended || voice.paused) continue;
    live.push(voice);
  }
  // `>= cap` rather than `> cap`: the caller is about to add one.
  while (live.length >= cap) evict.push(live.shift());
  return { keep: live, evict };
}

/**
 * The provenance line for the figures, derived from what is actually loaded.
 *
 * ► **This panel LIED for one commit.** It said the figures were original
 *   vector art while the extracted rig was being drawn over that sentence. A
 *   surface whose entire purpose is saying where its numbers came from cannot be
 *   wrong about where its ART came from, so the line is computed rather than
 *   written once — and computed HERE, where a test can read it.
 */
export function figureProvenance({ hasExtractedArt = false, wardrobePieces = 0 } = {}) {
  if (!hasExtractedArt) {
    return "are original vector art drawn from code in `src/render/painter.js`. No SS2 asset ships in "
      + "this repository. Run `node tools/extract-figure.mjs` to draw the build's own instead.";
  }
  const dressed = wardrobePieces > 0
    ? `, wearing ${wardrobePieces} extracted wardrobe piece(s)`
    : " — undressed, because no wardrobe has been extracted (`node tools/extract-wardrobe.mjs`)";
  return `are the BUILD'S OWN, extracted from your install into the gitignored \`assets/\`${dressed}. `
    + "No SS2 asset ships in this repository — a clone draws the authored art in `src/render/figure.js` "
    + "until its owner extracts their own.";
}
