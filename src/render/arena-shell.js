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

/**
 * How many gladiators a side, from the query string.
 *
 * Clamped to 1..3 because the arena's own rosters and the rank geometry are
 * built for at most three, and a `?teams=99` should give you a 3v3 rather than
 * an exception or a field of gladiators standing on each other.
 */
export function perSideFrom(params, { max = 3, fallback = 2 } = {}) {
  // ► **THE SHELL'S `|| 2` DOES MORE THAN CATCH `NaN`, and extracting it
  //   carelessly changed behaviour.** `Number(null)` is 0, not `NaN`, so an
  //   ABSENT `?teams` arrives here as a perfectly finite zero — and a first
  //   version that only guarded `Number.isFinite` clamped it to 1, turning the
  //   default arena from a 2v2 into a 1v1. An extraction has to preserve what
  //   the line did, including the parts that were accidental.
  //   **ONE DELIBERATE DIFFERENCE, stated rather than hidden:** the original
  //   `Math.min(3, Math.max(1, Number(v) || 2))` returns 2.7 for `?teams=2.7`
  //   and hands a fractional team size to the roster builder. This truncates.
  //   That is a fix, not a faithful reproduction, and it is the only input on
  //   which the two disagree — checked across null, "", 0, 1, 2, 3, 99, -4,
  //   "banana" and "2.7".
  const raw = params && typeof params.get === "function" ? Number(params.get("teams")) : Number.NaN;
  const requested = Number.isFinite(raw) && raw !== 0 ? raw : fallback;
  return Math.min(max, Math.max(1, Math.trunc(requested)));
}

/**
 * How many ranks back a drawn depth is, FRACTIONALLY, for the perspective
 * falloff.
 *
 * ► **FRACTIONAL AND FROM THE DRAWN y, NOT THE SLOT INDEX.** A figure part-way
 *   through a lane change is between ranks, and taking its `slotIndex` instead
 *   keeps it at its starting size for the whole slide — which leaves a pure
 *   vertical translation, and in this game that is what a JUMP looks like.
 *   The slot index is the fallback for a figure with no depth at all.
 */
export function rankOfDepth(drawnY, slotIndex, { frontY, rankStride }) {
  if (!Number.isFinite(drawnY) || !(rankStride > 0)) return slotIndex;
  return Math.max(0, (frontY - drawnY) / rankStride);
}

/**
 * The viewport's SCALE and HORIZON for a roster, which is the arithmetic two
 * live defects lived in.
 *
 * ► **THE BACK RANK WAS DRAWN STANDING IN THE CROWD.** The extent scan read
 *   `Math.abs(actor.x)` and nothing else, which was complete while every
 *   gladiator stood on one line and wrong the moment they did not.
 * ► **AND FITTING ONLY THE WIDTH DROVE THE HORIZON OFF THE TOP OF THE CANVAS.**
 *   At stride 150 the solved horizon came out at -191 on an 800px canvas: no
 *   crowd, no barrier, the whole view sand. `depthScaleCap` is the same
 *   inequality solved the other way.
 *
 * Both were found by SCREENSHOTTING, because nothing could test this file.
 *
 * With the second axis off `depthUnits` is ~20 and the depth terms are hundreds
 * of times looser than the width term, so they never bind and the
 * one-dimensional arena is pixel-identical. That is asserted, not assumed.
 */
export function viewportFor({ width, height, actors = [], frontY, minExtent = 250 }) {
  let extent = minExtent;
  let rearY = frontY;
  for (const actor of actors) {
    if (!actor || actor.placed === false) continue;
    if (Number.isFinite(actor.x)) extent = Math.max(extent, Math.abs(actor.x));
    if (Number.isFinite(actor.y)) rearY = Math.min(rearY, actor.y);
  }
  // A gladiator is about 150 arena units tall and swings about half that wide.
  const halfWidth = extent + 105;
  const depthUnits = frontY - rearY;
  const MIN_HORIZON_FRACTION = 0.18;
  const depthScaleCap = (height * (1 - MIN_HORIZON_FRACTION)) * 0.62 / (depthUnits * 1.7 + 30);
  const scale = Math.min(width / (halfWidth * 2), height / 250, depthScaleCap);
  const depthSpan = depthUnits * scale * 1.7;
  const FLOOR_MARGIN = scale * 30;
  const horizon = Math.max(
    height * MIN_HORIZON_FRACTION,
    Math.min(height * 0.58, height - (FLOOR_MARGIN + depthSpan) / 0.62)
  );
  return { scale, horizon, extent, depthUnits };
}

/**
 * The roster panel's order: heroes first, then by slot.
 *
 * ► **THE PANEL WENT BACK-TO-FRONT WITH THE TEAMS INTERLEAVED** because it
 *   borrowed the scene's `drawOrder`, which is PAINT order — back rank first,
 *   both sides mixed. A reader's list and a painter's list are different
 *   questions and sharing one answer was the defect. Caught by screenshotting.
 *
 * `placementOf` is passed in so this needs no host: it maps an id to
 * `{side, slotIndex}`.
 */
export function rosterOrderOf(ids, placementOf) {
  return [...(ids ?? [])].sort((left, right) => {
    const leftAt = placementOf(left);
    const rightAt = placementOf(right);
    if (leftAt.side !== rightAt.side) return leftAt.side === "hero" ? -1 : 1;
    return leftAt.slotIndex - rightAt.slotIndex;
  });
}

/**
 * The backing-store size a canvas should carry, in DEVICE PIXELS.
 *
 * ## Why this is here and not in the shell
 *
 * ► **THIS ARITHMETIC RAN FOR THE WHOLE LIFE OF THE PROJECT WITH NOTHING
 *   BEHIND IT, AND THE DEFECT IT HID COST EVERY PUBLISHED PIXEL NUMBER.**
 *   `<canvas id="arena">` with no `width` or `height` attribute is **300x150**,
 *   and `tools/arena/main.js` only ever READ those fields — no resize handler,
 *   no `devicePixelRatio`, in four thousand lines. Every measurement this
 *   repository published before 2026-09-18 was taken through an unrecorded
 *   bilinear upscale from a 300x150 buffer.
 *
 *   The sizing was added that day and lived in `sizeCanvasToStage`, which reads
 *   `window.devicePixelRatio` and `canvas.getBoundingClientRect()` and WRITES
 *   `canvas.width`. **So it is in the set of shell functions the suite cannot
 *   reach**, next to the set that carried the defect in the first place. The
 *   DECISION is pure; only the two reads and the two writes are not.
 *
 * ► **AND THE CLAIM THAT MOTIVATED THIS WAS WRONG, WHICH IS WORTH MORE THAN
 *   THE FIX.** The handoffs of 2026-09-18 and 2026-09-19 both say the shell is
 *   *"4,110 lines and not one is executed by a test"*. Measured 2026-09-19:
 *   **13 of its 70 top-level functions ARE executed**, by
 *   `liftFromShell` in `test/render-arena-shell.test.js`, which cuts a function
 *   out of the source and `new Function`s it — real calls, real assertions. And
 *   this module has existed since 2026-09-12 for exactly this purpose. What is
 *   genuinely unreachable is the ~28 functions that touch `document`, `window`,
 *   a canvas context or `Audio` — `sizeCanvasToStage` among them. **"No test
 *   executes it" was the wrong diagnosis of a real problem**, and it was
 *   repeated for two days because nobody grepped the test file.
 *
 * ## What it decides
 *
 * `rect` is the canvas's CSS box. A stage that has not been laid out yet
 * reports 0, and the answer then is the size it already has rather than
 * collapsing the arena to nothing for a frame — so the CURRENT backing store is
 * an input, not just a comparison.
 *
 * `changed` is the caller's cue to assign. **Assigning either dimension CLEARS
 * the canvas and resets the whole 2d state**, so a caller that assigned every
 * frame would wipe the arena every frame; that is why this reports a change
 * rather than the caller diffing it afterwards.
 *
 * ► **THE AREA IS NOT CAPPED, AND THAT IS STATED RATHER THAN FIXED.** Browsers
 *   refuse a canvas past a maximum area and the failure is a BLANK canvas, not
 *   an exception. At the sizes this arena runs (a ~1280x720 stage at ratio 1-2
 *   gives at most 2560x1440, 3.7M device pixels) nothing is near any published
 *   limit, so a cap would be a guard against a hazard this machine cannot
 *   demonstrate. **Do not add one without measuring a stage that needs it** —
 *   the rule this repository keeps relearning is not to defer work for an
 *   unmeasured cost, and inventing work for an unmeasured hazard is the same
 *   error facing the other way.
 */
export function canvasBackingFor({
  rectWidth,
  rectHeight,
  devicePixelRatio,
  currentWidth,
  currentHeight
} = {}) {
  // `window.devicePixelRatio` is 0 in some headless contexts and `undefined`
  // wherever there is no window; both mean "one device pixel per CSS pixel"
  // rather than "zero-sized canvas", which is what the shell's own `|| 1` said
  // and is preserved exactly.
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const backingWidth = Number.isFinite(currentWidth) ? currentWidth : 0;
  const backingHeight = Number.isFinite(currentHeight) ? currentHeight : 0;
  const cssWidth = Number.isFinite(rectWidth) && rectWidth > 0 ? rectWidth : backingWidth / ratio;
  const cssHeight = Number.isFinite(rectHeight) && rectHeight > 0 ? rectHeight : backingHeight / ratio;
  const width = Math.max(1, Math.round(cssWidth * ratio));
  const height = Math.max(1, Math.round(cssHeight * ratio));
  return { width, height, ratio, changed: width !== backingWidth || height !== backingHeight };
}
