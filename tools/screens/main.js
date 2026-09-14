/**
 * THE TWENTY-SIX SCREENS, ON A SCREEN — and the invoice for every one of them.
 *
 * `assets/screens/` and `assets/text/` have been written, parsed, tallied and
 * tested, and until this file existed **nothing had ever drawn one of them**.
 * A pack no renderer consumes is indistinguishable from a pack that is wrong;
 * that is `src/render/screen.js`'s own argument for existing, and this page is
 * the other half of it.
 *
 * ---
 *
 * ## THIS IS A MEASURING INSTRUMENT, NOT A DEMO
 *
 * `screenFor` and `screenTextFor` return their counts BESIDE their operations
 * precisely so a caller cannot take the picture without the invoice, and the
 * whole design of this page follows from that: the right-hand panel is not
 * decoration around the canvas, it is the half of the output that says what the
 * canvas is NOT showing. A screen that looks finished and is missing twelve
 * drop shadows has to say so, out loud, in the same view as the picture.
 *
 * So there are **two invoices side by side and they are counted by different
 * rules on purpose**:
 *
 * - **the modules'**, from `screenWithTextFor` — what the pack knows it could
 *   not resolve, by kind;
 * - **this painter's own**, tallied inside `paintOps` from what it actually
 *   issued to the 2D context — what reached the glass.
 *
 * Two tallies that agree are evidence. One tally printed twice is not, which is
 * why this file counts its own rather than echoing the module's. Where they
 * disagree the log says so in as many words, and a disagreement is a FINDING
 * about one of the two, never something to reconcile by adjusting a number
 * here.
 *
 * ## THE SHELL HOLDS NO DECISIONS
 *
 * Same split `tools/arena/main.js` is built on and for the same reason: this
 * file cannot be imported by `node --test`, so anything decided here is
 * unreachable by the suite, and the arena's shell gave up five live defects in
 * a day — every one a decision rather than a drawing. What is in here is a 2D
 * context, DOM nodes, the keyboard and the clock. Which operations exist, what
 * they are worth and what is missing from them is `src/render/screen.js`,
 * `src/render/screen-text.js` and `src/render/text.js`, all under the suite.
 * `stageFitFor` letterboxes; this file does not compute a scale.
 *
 * ## UNITS, AND THIS SEAM HAS COST THIS PROJECT THREE DEFECTS
 *
 * An operation's `d` is in PIXELS and its `matrix[4]`/`matrix[5]` are in TWIPS,
 * for every operation both packs emit — shape paths out of `screen.js` and
 * glyph outlines out of `text.js` alike, which is exactly why they can be
 * merged into one paint order and walked by one loop. `TWIPS_PER_PIXEL` is
 * IMPORTED from `src/render/text.js` rather than restated; `tools/arena/main.js`
 * declares its own copy of the same 20, and one copy of a constant per file is
 * how a units seam drifts.
 *
 * ## WHAT THIS PAGE DRAWS THAT THE ARENA DOES NOT
 *
 * Nothing, structurally — the operation shapes are identical, which was the
 * claim `screen.js`'s header made ("they need no new painter code") and this
 * page is the first thing that could test it. **Measured: true.** The bitmap,
 * gradient, clip, fill-rule and colour-transform handling below is the arena's
 * handling, transplanted, and every one of the 26 screens draws through it.
 *
 * ## MEASURED ON THIS PACK, 2026-09-14, BY THIS FILE'S OWN COUNTERS
 *
 * 26 screens, 13638 shape operations, 2236 glyph operations, 187 text
 * placements. **9423 of the 13638 shape operations — 69% — sit under a
 * FILTERLIST that nothing applies**, which is drop shadows and glows missing
 * everywhere while the picture otherwise looks right. 29 operations carry a
 * bitmap fill and all six bitmap characters they name are in
 * `assets/bitmaps/`; a clone without that directory loses them and the invoice
 * says how many. 182 operations put no pixel down by construction, 26 of which
 * are the depth-1 backdrop the build itself places at `alphaMultiplier` 0 on
 * all 26 screens.
 *
 * ## WHAT LOOKING AT IT FOUND, IN THE FIRST THREE SCREENSHOTS
 *
 * The page is worth less than these are, and that is the argument for building
 * it. All three were invisible to the suite, which is green on all of them.
 *
 * ► **1. FIVE SCREENS ARE BLACKED OUT BY A TRANSITION CURTAIN DRAWN AT ITS
 *   FRAME 1.** `townsquare` rendered 1698 operations and showed nothing but the
 *   UI bar, because operation 1679 of 1704 is an opaque black rectangle
 *   648 x 440 at root depth 428 — character 1525, a 168-frame nested sprite
 *   taken at frame 1. Same shape at depth 185 on `splash` and `new_or_continue`
 *   and at depth 408 on `daybreak` and `dungeon`; the other 21 screens are
 *   clean. The extractor counts it (`nestedSpriteFrame1`) and `screenFor`
 *   carries the count only inside `approximations.fromPack`, never in its own
 *   block — **so the invoice was right and said nothing, which is the exact
 *   failure mode this project keeps finding.** `fromPack` is on the panel now.
 *   Not worked around here: a renderer that special-cases a black rectangle is
 *   a renderer that lies about the pack.
 *
 * ► **2. 108 OF THE BUILD'S 256 EDIT FIELDS ARE LAID OUT LEFT-ALIGNED WHEN THE
 *   TAG SAYS CENTRE OR RIGHT.** Visible on `createchar` as the stat column:
 *   every number is drawn ON TOP of its own label. Measured — field 1619 is
 *   `align: "center"`, `wordWrap: false`, `multiline: false`, box x 62.3..109.2
 *   in stage pixels, and its digit draws at 64.6, the box's left edge plus the
 *   gutter. `fieldLayoutOptionsFor` in `src/render/text.js` passes
 *   `maxWidth: field.wordWrap && field.multiline ? inner : Infinity`, and
 *   `layoutText` then computes `box = Number.isFinite(maxWidth) ? maxWidth :
 *   widest`, so the slack is zero and alignment is a no-op. Centred, that digit
 *   would sit at 82.2 — clear of the label, which ends at 72. One parameter is
 *   carrying two jobs: WRAPPING genuinely needs `wordWrap && multiline`,
 *   ALIGNING only needs a box, and every field has one. **Not fixed here —
 *   `src/render/text.js` is not this file's to edit.**
 *
 * ► **3. OPERATIONS SPILL OFF THE STAGE AND THIS PAGE USED TO DRAW THEM.** The
 *   weapon shop's first render put the shopkeeper's head in the page's own
 *   margin, below the letterbox. Flash clips to the stage; this now does too,
 *   in stage space, behind `?clip=0` for anyone who wants to see what is parked
 *   off the edge.
 *
 * ## WHAT WAS CHECKED AND WAS RIGHT
 *
 * Every screen's geometry lands on the 640 x 420 stage once `matrix[4]`/`[5]`
 * are divided by 20, and lands at roughly 12000 x 8000 if they are not — the
 * twips seam, measured rather than reasoned about. The painter's own
 * "drew nothing" count and `screen.js`'s independently-derived `invisibleOps`
 * agree on **all 26 screens** (182 operations: 159 transparent fills and 23
 * with neither a fill nor a stroke), which is the cross-check this page logs on
 * every selection. All 29 bitmap operations across the 26 screens resolve to
 * one of the six bitmap characters in `assets/bitmaps/`, so none is lost here.
 * Sampled off the weapon shop at 1800 x 1300: floor `#fef541`, sky through the
 * doorway `#3d5cfd`, grass `#b2ff0d`, a blade `#949393`, wall timber `#563d2e`.
 *
 * ## NO ASSETS, NO STACK TRACE
 *
 * A clone with no licensed copy gets `null` from `screenPackFrom` and
 * `textPackFrom`, and this page then says so on the canvas and in the panel.
 * That is the SUPPORTED path, not an error path — the repository ships no SS2
 * asset and never will, so the commonest way to open this page is without one.
 *
 *   node tools/arena-server.mjs        # then open /tools/screens/index.html
 *   ?screen=<name>                     # one of the 26; `screenNames` order
 *   ?chrome=0 ?text=0 ?bitmaps=0       # take a half away and watch the invoice
 *   ?holes=1                           # outline the text boxes nothing filled
 *   ?v.<variableName>=<value>          # bind a live value into an edit field
 */

import {
  screenPackFrom,
  screenNames,
  screenFor,
  splitScreenChrome,
  hasExtractedScreens,
  SCREEN_CHROME,
  SCREEN_STAGE_PLACEMENT,
  textPackFrom,
  hasExtractedText,
  screenWithTextFor,
  SCREEN_TEXT_UNDRAWN_KINDS,
  SCREEN_TEXT_APPROXIMATION_KINDS,
  SS2_STAGE,
  stageFitFor,
  TWIPS_PER_PIXEL
} from "/src/render/index.js";

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

const el = (id) => document.getElementById(id);
const canvas = el("screen");
const context = canvas.getContext("2d");

const params = new URLSearchParams(location.search);

/**
 * The toggles, and every one of them exists to make an ABSENCE visible.
 *
 * Turning the chrome off is how you see that depth 1 draws nothing; turning
 * the bitmaps off is how you see which 29 operations the raster pack is
 * carrying; `holes` outlines the boxes of text placements that resolved to no
 * operation at all, which is the one class of missing thing a picture cannot
 * show by itself — a word that is not drawn leaves no mark saying so.
 */
const show = {
  chrome: params.get("chrome") !== "0",
  text: params.get("text") !== "0",
  bitmaps: params.get("bitmaps") !== "0",
  // ► **THE STAGE CLIP IS ON BY DEFAULT BECAUSE THE PLAYER CLIPS, and it was
  //   off for exactly one screenshot.** The weapon shop's first render drew the
  //   shopkeeper's head BELOW the letterbox, in the page's own margin, because
  //   nothing bounded the operations to the 640 x 420 stage. Measured across
  //   the 26: the operations of `magicshop` reach stage y 929, `dungeon` 926,
  //   `weaponshop` 771 and `arena_intro` x -1383..1026 — every one of them a
  //   thing the build never shows, drawn here for want of the one rectangle
  //   Flash puts around its own stage. `?clip=0` turns it off, which is worth
  //   having: what spills over the edge says where a screen's off-stage
  //   staging is, and that is a fact about the pack.
  clip: params.get("clip") !== "0",
  holes: params.get("holes") === "1",
  edge: params.get("edge") === "1"
};

/** Live values for edit fields, from `?v.<variableName>=<value>`. */
const boundValues = (() => {
  const out = {};
  for (const [key, value] of params) {
    if (key.startsWith("v.") && key.length > 2) out[key.slice(2)] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
})();

const logLines = [];

function log(message, { warn = false, bad = false } = {}) {
  logLines.push({ message, warn, bad });
  if (logLines.length > 60) logLines.shift();
  el("log").replaceChildren(
    ...logLines.slice().reverse().map((line) => {
      const node = document.createElement("div");
      node.textContent = line.message;
      if (line.bad) node.className = "bad";
      else if (line.warn) node.className = "warn";
      return node;
    })
  );
}

/* ------------------------------------------------------------------ */
/* The packs — the player's own extraction, or an honest empty page     */
/* ------------------------------------------------------------------ */

let screenPack = null;
let textPack = null;
let screenManifest = null;
let textManifest = null;
let packsSettled = false;

/** One screen's joined record, rebuilt only when the selection changes. */
let current = null;
let currentName = params.get("screen");

/**
 * The build's own raster art, composited once.
 *
 * ► **A JPEG WITH AN ALPHA CHANNEL IS TWO FILES AND ONE CANVAS**, the same
 *   arrangement `tools/arena/main.js` documents: SWF stores the colour as JPEG
 *   and the alpha as a separate zlib'd plane, and `tools/extract-bitmaps.mjs`
 *   writes them as `<id>.jpg` and `<id>-alpha.png` because compositing them in
 *   node would need a JPEG decoder it does not ship. Whichever image lands
 *   second does the compositing.
 *
 * ► **AND AN IMAGE THAT HAS NOT ARRIVED YET IS NOT A MISSING IMAGE.** Every
 *   arrival asks for a redraw, so an operation counted `bitmap-image-missing`
 *   on the first frame is counted `bitmapDrawn` on the next one. Without that
 *   redraw the invoice would be a screenshot of the loading order.
 */
const bitmaps = new Map();

function loadBitmaps(manifest) {
  for (const [id, entry] of Object.entries(manifest?.bitmaps ?? {})) {
    const colour = new Image();
    colour.src = `/assets/bitmaps/${entry.file}`;
    if (!entry.alpha) {
      colour.addEventListener("load", () => { bitmaps.set(Number(id), colour); requestRedraw(); });
      continue;
    }
    const alpha = new Image();
    alpha.src = `/assets/bitmaps/${entry.alpha}`;
    const combine = () => {
      if (!colour.complete || !alpha.complete || !colour.naturalWidth || !alpha.naturalWidth) return;
      const off = document.createElement("canvas");
      off.width = entry.width;
      off.height = entry.height;
      const ctx = off.getContext("2d");
      ctx.drawImage(colour, 0, 0, entry.width, entry.height);
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(alpha, 0, 0, entry.width, entry.height);
      bitmaps.set(Number(id), off);
      requestRedraw();
    };
    colour.addEventListener("load", combine);
    alpha.addEventListener("load", combine);
  }
}

/** A JSON fetch that answers `null` for absent, never an exception. */
function json(url) {
  return fetch(url)
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null);
}

Promise.all([
  json("/assets/screens/screens.json"),
  json("/assets/text/text.json"),
  json("/assets/screens/manifest.json"),
  json("/assets/text/manifest.json"),
  json("/assets/bitmaps/manifest.json")
]).then(([screens, text, screensManifest, textsManifest, bitmapManifest]) => {
  screenPack = screenPackFrom(screens);
  textPack = textPackFrom(text);
  screenManifest = screensManifest;
  textManifest = textsManifest;
  packsSettled = true;

  if (!hasExtractedScreens(screenPack)) {
    log("no extracted screens — there is nothing to draw and that is the supported path.", { warn: true });
    log("`node tools/extract-screens.mjs <your swf>` writes assets/screens/.");
  } else {
    const names = screenNames(screenPack);
    log(`screens: ${names.length} from ${sourceOf(screenManifest)}`);
    if (!hasExtractedText(textPack)) {
      log("no extracted text — shapes only, every word on every screen missing.", { warn: true });
      log("`node tools/extract-text.mjs <your swf>` writes assets/text/.");
    } else {
      const fonts = Object.keys(textPack.fonts ?? {}).length;
      log(`text: ${fonts} font(s) from ${sourceOf(textManifest)}`);
    }
  }
  if (bitmapManifest) {
    loadBitmaps(bitmapManifest);
    log(`bitmaps: ${Object.keys(bitmapManifest.bitmaps ?? {}).length} from your own install`);
  } else {
    log("no extracted bitmaps — every bitmap-filled operation will be counted undrawn.", { warn: true });
  }
  buildPicker();
  select(currentName, { replace: true });
});

/** A manifest's own provenance, short enough for a log line. */
function sourceOf(manifest) {
  const sha = typeof manifest?.sha256 === "string" ? manifest.sha256.slice(0, 12) : null;
  return sha ? `${manifest.source ?? "an install"} ${sha}` : "an unknown build";
}

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

function names() {
  return hasExtractedScreens(screenPack) ? screenNames(screenPack) : [];
}

/**
 * Choose a screen, or the default.
 *
 * ► **THE DEFAULT IS `weaponshop`, AND THE SCREEN IT IS NOT IS THE FINDING.**
 *   The first name in root-timeline order is `splash`, which is a logo on a
 *   dark field — the worst possible first impression of whether this renderer
 *   works, because there is almost nothing on it to be wrong. `townsquare` was
 *   the obvious replacement and was the default for exactly one screenshot,
 *   which came back **completely black except the UI bar**.
 *
 *   Measured, on the first render this page ever produced: **1698 operations
 *   painted and nothing visible**, because operation 1679 of 1704 is a
 *   SINGLE-SUBPATH OPAQUE BLACK RECTANGLE 648 x 440 at root depth 428 —
 *   character 1525, a 168-frame nested sprite, drawn at ITS FRAME 1, which is
 *   the transition curtain fully closed. The extractor counts that
 *   approximation as `nestedSpriteFrame1` and `screenFor` carries it only
 *   inside `approximations.fromPack`, never in its own block, which is why the
 *   invoice showed nothing wrong while the picture showed nothing at all.
 *
 *   **Five of the twenty-six are blanketed this way** — `splash` and
 *   `new_or_continue` at depth 185, `daybreak` and `dungeon` at depth 408,
 *   `townsquare` at depth 428 — and the other twenty-one are not. This is NOT
 *   worked around here and must not be: a renderer that special-cases a black
 *   rectangle is a renderer that lies about the pack. The default simply lands
 *   on a screen that draws, `fromPack` is now on the invoice so the count that
 *   explains it is visible, and the fix belongs in `tools/extract-screens.mjs`
 *   or `src/render/screen.js`, neither of which this file owns.
 *
 * Falls back to the first name when the pack has no weapon shop.
 */
function defaultName() {
  const all = names();
  if (all.length === 0) return null;
  return all.includes("weaponshop") ? "weaponshop" : all[0];
}

function select(name, { replace = false } = {}) {
  const all = names();
  if (all.length === 0) {
    current = null;
    requestRedraw();
    return;
  }
  let chosen = typeof name === "string" && all.includes(name) ? name : null;
  if (!chosen) {
    if (typeof name === "string" && name.length > 0) {
      log(`no screen named ${JSON.stringify(name)} in this pack — showing ${defaultName()}.`, { warn: true });
    }
    chosen = defaultName();
  }
  currentName = chosen;
  current = screenWithTextFor(screenPack, textPack, chosen, boundValues ? { values: boundValues } : {});
  if (!current) {
    log(`screenWithTextFor returned null for ${JSON.stringify(chosen)} — the pack holds no such screen.`, { bad: true });
  }
  const url = new URL(location.href);
  url.searchParams.set("screen", chosen);
  history[replace ? "replaceState" : "pushState"]({}, "", url);
  el("picker").value = chosen;
  requestRedraw();
}

function step(delta) {
  const all = names();
  if (all.length === 0) return;
  const at = all.indexOf(currentName);
  const next = all[(at + delta + all.length) % all.length];
  select(next);
}

function buildPicker() {
  const picker = el("picker");
  picker.replaceChildren(...names().map((name, index) => {
    const option = document.createElement("option");
    option.value = name;
    const record = screenFor(screenPack, name);
    option.textContent = `${String(index + 1).padStart(2, " ")}. ${name}  (frame ${record?.labelFrame ?? "?"})`;
    return option;
  }));
  picker.addEventListener("change", () => select(picker.value));
  el("prev").addEventListener("click", () => step(-1));
  el("next").addEventListener("click", () => step(1));
  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLSelectElement) return;
    if (event.key === "ArrowLeft") { step(-1); event.preventDefault(); }
    if (event.key === "ArrowRight") { step(1); event.preventDefault(); }
  });
  window.addEventListener("popstate", () => select(new URLSearchParams(location.search).get("screen"), { replace: true }));
  buildToggles();
}

const TOGGLE_LABELS = Object.freeze({
  chrome: "chrome",
  text: "words",
  bitmaps: "bitmaps",
  clip: "clip to stage",
  holes: "outline holes",
  edge: "stage edge"
});

function buildToggles() {
  el("toggles").replaceChildren(...Object.keys(TOGGLE_LABELS).map((key) => {
    const button = document.createElement("button");
    button.textContent = TOGGLE_LABELS[key];
    button.className = show[key] ? "on" : "";
    button.addEventListener("click", () => {
      show[key] = !show[key];
      button.className = show[key] ? "on" : "";
      const url = new URL(location.href);
      url.searchParams.set(key, show[key] ? "1" : "0");
      history.replaceState({}, "", url);
      requestRedraw();
    });
    return button;
  }));
}

/* ------------------------------------------------------------------ */
/* Painting                                                            */
/* ------------------------------------------------------------------ */

/**
 * Path objects are cached on their own geometry, which is immutable and is the
 * key, so the cache can never go stale. Rebuilding 1646 `Path2D`s from strings
 * on every frame is the one place this shell can be accidentally slow, and
 * `levelup` is 1646 of them.
 */
const pathCache = new Map();
function path2dFor(d) {
  let path = pathCache.get(d);
  if (!path) {
    path = new Path2D(d);
    pathCache.set(d, path);
  }
  return path;
}

/** The SWF's canonical gradient square: -16384..16384 in the gradient's OWN space. */
const GRADIENT_SQUARE = 16384;

/** `#rrggbb` plus an opacity, as `addColorStop` wants it. */
function rgbaOf(fill, opacity) {
  if (typeof fill !== "string" || fill[0] !== "#" || fill.length !== 7) return `rgba(0,0,0,${opacity})`;
  const value = Number.parseInt(fill.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${opacity})`;
}

/**
 * One path's GRADIENT fill, built as a transform rather than as two mapped
 * endpoints — `tools/arena/main.js` states why at length and the reason is the
 * build's own geometry: a linear ramp under a skewed matrix stays perpendicular
 * to its own axis when the build's does not, and a radial at 26:1 cannot be
 * expressed by `createRadialGradient` with one radius at all.
 *
 * ► **±16384 IS NOT TWIPS.** It is the gradient's own space; the MATRIX is what
 *   turns it into shape twips, and the path is in shape PIXELS, so every term
 *   of the matrix is divided by 20 exactly as a bitmap fill's is.
 *
 * ► **AND THE OPACITY IS IN THE STOPS, NEVER IN `fillOpacity`.**
 *   `src/render/screen.js` folds the placement's colour transform into each
 *   stop AND carries the same factor on the operation's `fillOpacity` for the
 *   flat fallback beside it. **A consumer that applies both darkens twice**,
 *   which is why `globalAlpha` is set to 1 here and not to the operation's.
 */
function paintGradientFill(operation, path) {
  const g = operation.gradient;
  if (!g || !Array.isArray(g.stops) || g.stops.length === 0) return false;
  const m = g.matrix;
  if (!m) return false;
  const apply = () => context.transform(
    m.a / TWIPS_PER_PIXEL, m.b / TWIPS_PER_PIXEL,
    m.c / TWIPS_PER_PIXEL, m.d / TWIPS_PER_PIXEL,
    m.tx / TWIPS_PER_PIXEL, m.ty / TWIPS_PER_PIXEL
  );
  context.save();
  apply();
  const ramp = g.type === "radial"
    ? context.createRadialGradient(0, 0, 0, 0, 0, GRADIENT_SQUARE)
    : context.createLinearGradient(-GRADIENT_SQUARE, 0, GRADIENT_SQUARE, 0);
  for (const stop of g.stops) {
    // `addColorStop` throws on a non-finite offset, which would take the whole
    // frame down; a clamp is cheaper than a try/catch per stop.
    const offset = Math.min(1, Math.max(0, Number.isFinite(stop.offset) ? stop.offset : 0));
    ramp.addColorStop(offset, rgbaOf(stop.fill, stop.opacity ?? 1));
  }
  context.restore();
  // The path is in SHAPE space and the ramp is in GRADIENT space, so the path
  // cannot simply be filled: it is the CLIP, and the ramp covers it.
  context.save();
  context.clip(path, operation.fillRule ?? "evenodd");
  apply();
  context.fillStyle = ramp;
  context.fillRect(-GRADIENT_SQUARE, -GRADIENT_SQUARE, GRADIENT_SQUARE * 2, GRADIENT_SQUARE * 2);
  context.restore();
  return true;
}

/**
 * One path's BITMAP fill, clipped to the path.
 *
 * ► **THE MATRIX MAPS BITMAP PIXELS TO SHAPE TWIPS AND THE PATH IS IN SHAPE
 *   PIXELS**, so every term is divided by 20. Getting this wrong by the factor
 *   of twenty draws one corner of the image across the whole screen, which
 *   reads as a texture bug rather than as a units bug.
 */
function paintBitmapFill(operation, path) {
  const image = bitmaps.get(operation.bitmap?.id);
  if (!image || (image.naturalWidth === 0 && image.width === 0)) return false;
  const m = operation.bitmap.matrix;
  context.save();
  context.clip(path, operation.fillRule ?? "evenodd");
  if (m) {
    context.transform(
      m.a / TWIPS_PER_PIXEL, m.b / TWIPS_PER_PIXEL,
      m.c / TWIPS_PER_PIXEL, m.d / TWIPS_PER_PIXEL,
      m.tx / TWIPS_PER_PIXEL, m.ty / TWIPS_PER_PIXEL
    );
  }
  if (operation.bitmap.repeat) {
    const pattern = context.createPattern(image, "repeat");
    if (pattern) {
      context.fillStyle = pattern;
      // In the bitmap's own space now, so a generous rectangle is cheaper than
      // an exact one and the clip above is what actually bounds it.
      context.fillRect(-4000, -4000, 8000, 8000);
    }
  } else {
    context.drawImage(image, 0, 0);
  }
  context.restore();
  return true;
}

/** A fresh tally. Every field is a count of OPERATIONS unless it says otherwise. */
function emptyTally() {
  return {
    seen: 0,
    shapeOps: 0,
    glyphOps: 0,
    painted: 0,
    drewNothing: 0,
    // Why each one drew nothing, so "missing" is never one undifferentiated
    // number. An approximation that is not counted is indistinguishable from a
    // correct read, and so is an absence that is not attributed.
    reasons: {
      "not-a-path": 0,
      "no-geometry": 0,
      "transparent-fill": 0,
      "no-fill-and-no-stroke": 0,
      "bitmap-image-missing": 0,
      "bitmap-turned-off": 0,
      "gradient-unusable": 0
    },
    bitmapOps: 0,
    bitmapDrawn: 0,
    gradientOps: 0,
    gradientDrawn: 0,
    clipsApplied: 0,
    strokesDrawn: 0,
    // Carried on the operation by the pack, applied by nothing here.
    filteredOps: 0,
    blendOps: 0,
    notdefOps: 0,
    hiddenByToggle: 0
  };
}

/**
 * Walk a merged paint order and draw it, tallying what actually happened.
 *
 * The shape is `paintArenaLayer`'s in `tools/arena/main.js`, deliberately —
 * a screen's operations and an arena layer's are the same objects, which was a
 * claim in `screen.js`'s header and is a measurement now that something draws
 * both. The difference is the tally, and the tally is the point of this page.
 *
 * ► **NO Y-FLIP, unlike the figure painters.** A figure's local space has its
 *   origin at the soles of its feet and its head at NEGATIVE y, so drawing one
 *   needs arena y (which is up). A screen has no such local space: the
 *   extractor flattens the root display list, so these coordinates are already
 *   stage coordinates and stage y is down. Flipping would draw the sky under
 *   the ground.
 */
function paintOps(ops, fit, placement, tally) {
  context.save();
  context.translate(fit.offsetX, fit.offsetY);
  context.scale(fit.scale, fit.scale);
  // ► **THE STAGE IS A CLIP, NOT A HINT.** Set in STAGE space, before the
  //   placement, so it bounds the screen the way the player's own stage does
  //   and not the way this page's canvas happens to be shaped.
  if (show.clip) {
    context.beginPath();
    context.rect(0, 0, SS2_STAGE.width, SS2_STAGE.height);
    context.clip();
  }
  context.translate(placement.x, placement.y);
  if (placement.scale !== 1) context.scale(placement.scale, placement.scale);

  for (const operation of ops) {
    tally.seen += 1;
    if (operation.source === "text") tally.glyphOps += 1;
    else tally.shapeOps += 1;
    if (operation.filtered) tally.filteredOps += 1;
    if (operation.blendMode !== undefined && operation.blendMode !== null) tally.blendOps += 1;
    if (operation.notdef) tally.notdefOps += 1;

    if (operation.kind !== "path") {
      tally.reasons["not-a-path"] += 1;
      tally.drewNothing += 1;
      continue;
    }
    if (typeof operation.d !== "string" || operation.d.length === 0) {
      tally.reasons["no-geometry"] += 1;
      tally.drewNothing += 1;
      continue;
    }

    const matrix = Array.isArray(operation.matrix) && operation.matrix.length === 6
      ? operation.matrix
      : [1, 0, 0, 1, 0, 0];

    context.save();
    // ► **THE CLIP GOES ON BEFORE THE SHAPE'S OWN TRANSFORM**, because the
    //   cutter's matrix is composed in the SAME space as the shape's and not
    //   inside it. Setting it afterwards clips a glow by a mask already moved
    //   by the glow's own placement — a plausible picture, and the wrong one.
    if (operation.clip && typeof operation.clip.d === "string") {
      const c = Array.isArray(operation.clip.matrix) && operation.clip.matrix.length === 6
        ? operation.clip.matrix
        : [1, 0, 0, 1, 0, 0];
      context.save();
      context.transform(c[0], c[1], c[2], c[3], c[4] / TWIPS_PER_PIXEL, c[5] / TWIPS_PER_PIXEL);
      context.clip(path2dFor(operation.clip.d), "evenodd");
      context.restore();
      tally.clipsApplied += 1;
    }
    context.transform(
      matrix[0], matrix[1], matrix[2], matrix[3],
      matrix[4] / TWIPS_PER_PIXEL, matrix[5] / TWIPS_PER_PIXEL
    );
    const path = path2dFor(operation.d);

    let painted = false;
    let reason = "no-fill-and-no-stroke";
    if (operation.bitmap) {
      tally.bitmapOps += 1;
      const alpha = operation.fillOpacity ?? 1;
      if (!show.bitmaps) {
        reason = "bitmap-turned-off";
      } else if (!(alpha > 0)) {
        // ► **A FULLY TRANSPARENT PAINT CALL IS NOT A PAINT, and counting it as
        //   one is how this page's own tally would stop meaning "pixels".** The
        //   cross-check against `screen.js`'s `invisibleOps` is only worth
        //   anything while both sides are answering the same question, and
        //   `drawsAnything` there reads a bitmap's alpha off `fillOpacity`
        //   exactly like this.
        reason = "transparent-fill";
      } else {
        context.globalAlpha = alpha;
        if (paintBitmapFill(operation, path)) {
          painted = true;
          tally.bitmapDrawn += 1;
        } else {
          reason = "bitmap-image-missing";
        }
      }
    } else if (operation.gradient) {
      tally.gradientOps += 1;
      // ► **A GRADIENT'S ALPHA IS IN ITS STOPS AND NOWHERE ELSE**, which is
      //   also why `globalAlpha` stays at 1 below: the operation's
      //   `fillOpacity` carries the same colour-transform factor for the flat
      //   fallback beside it, and applying both darkens twice.
      const inks = (operation.gradient.stops ?? []).some((stop) => (stop?.opacity ?? 1) > 0);
      if (!inks) {
        reason = "transparent-fill";
      } else {
        context.globalAlpha = 1;
        if (paintGradientFill(operation, path)) {
          painted = true;
          tally.gradientDrawn += 1;
        } else {
          reason = "gradient-unusable";
        }
      }
    } else if (typeof operation.fill === "string" && operation.fill !== "none") {
      const alpha = operation.fillOpacity ?? 1;
      if (alpha > 0) {
        context.globalAlpha = alpha;
        context.fillStyle = operation.fill;
        context.fill(path, operation.fillRule ?? "evenodd");
        painted = true;
      } else {
        reason = "transparent-fill";
      }
    }

    if (typeof operation.stroke === "string" && operation.stroke !== "none"
      && operation.strokeWidth > 0 && (operation.strokeOpacity ?? 1) > 0) {
      context.globalAlpha = operation.strokeOpacity ?? 1;
      context.strokeStyle = operation.stroke;
      // In the CURRENT transform's units, which the stage fit then scales.
      context.lineWidth = operation.strokeWidth;
      context.lineJoin = "round";
      context.stroke(path);
      painted = true;
      tally.strokesDrawn += 1;
    }

    context.globalAlpha = 1;
    context.restore();
    if (painted) tally.painted += 1;
    else {
      tally.drewNothing += 1;
      tally.reasons[reason] += 1;
    }
  }
  context.restore();
  context.globalAlpha = 1;
}

/**
 * The boxes of text placements that resolved to NO operation, outlined.
 *
 * ► **THE ONE ABSENCE A PICTURE CANNOT SHOW BY ITSELF.** A missing shadow
 *   leaves a shape that is merely flat; a missing word leaves nothing at all,
 *   and a screen with a hole where a number goes looks exactly like a screen
 *   that has no number on it. The box and the matrix are both on the placement
 *   — `screen.js` converts the box to PIXELS and leaves the matrix translation
 *   in twips, so this is the same divide-by-twenty as every other site here.
 */
function outlineHoles(record, fit) {
  const placements = record.text ? record.text.placements : null;
  const undrawnBoxes = placements
    ? placements.filter((entry) => !entry.drawn)
    : record.screen.text;
  if (undrawnBoxes.length === 0) return 0;
  context.save();
  context.translate(fit.offsetX, fit.offsetY);
  context.scale(fit.scale, fit.scale);
  let drawn = 0;
  for (const entry of undrawnBoxes) {
    const box = entry.box;
    const matrix = Array.isArray(entry.matrix) && entry.matrix.length === 6 ? entry.matrix : null;
    if (!box || !matrix) continue;
    context.save();
    context.transform(matrix[0], matrix[1], matrix[2], matrix[3],
      matrix[4] / TWIPS_PER_PIXEL, matrix[5] / TWIPS_PER_PIXEL);
    context.strokeStyle = "#d2644e";
    context.lineWidth = 1 / fit.scale;
    context.setLineDash([4 / fit.scale, 3 / fit.scale]);
    context.strokeRect(box.x, box.y, box.width, box.height);
    context.restore();
    drawn += 1;
  }
  context.setLineDash([]);
  context.restore();
  return drawn;
}

/** The 640 x 420 stage's own edge, so the letterbox is visible when wanted. */
function outlineStage(fit) {
  context.save();
  context.strokeStyle = "rgba(216,161,58,0.55)";
  context.lineWidth = 1;
  context.strokeRect(fit.offsetX + 0.5, fit.offsetY + 0.5,
    SS2_STAGE.width * fit.scale - 1, SS2_STAGE.height * fit.scale - 1);
  context.restore();
}

/** The honest empty page: no pack, no picture, and a sentence saying why. */
function drawNothingToDraw() {
  const width = canvas.width;
  const height = canvas.height;
  context.fillStyle = "#17151a";
  context.fillRect(0, 0, width, height);
  const ratio = window.devicePixelRatio || 1;
  context.save();
  context.scale(ratio, ratio);
  const lines = packsSettled
    ? [
      "No extracted screens on this machine.",
      "",
      "This repository ships no SS2 asset and never will, so this is the",
      "ordinary state of a fresh clone rather than a failure.",
      "",
      "node tools/extract-screens.mjs <your own swf>",
      "node tools/extract-text.mjs <your own swf>"
    ]
    : ["Reading assets/screens/ and assets/text/…"];
  context.fillStyle = "#9a9287";
  context.font = "14px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textAlign = "center";
  const top = height / ratio / 2 - (lines.length * 21) / 2;
  lines.forEach((line, index) => {
    context.fillStyle = index === 0 ? "#d8a13a" : "#9a9287";
    context.fillText(line, width / ratio / 2, top + index * 21);
  });
  context.restore();
}

let lastTally = emptyTally();
let lastHoles = 0;
let lastFit = null;
let lastPaintMs = 0;

function draw() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (!current) {
    drawNothingToDraw();
    lastTally = emptyTally();
    lastHoles = 0;
    return;
  }

  const fit = stageFitFor({ width: canvas.width, height: canvas.height });
  lastFit = fit;

  // The stage's own ground, so the letterbox and the screen are distinguishable
  // from each other and from a page that drew nothing at all.
  context.fillStyle = "#000000";
  context.fillRect(fit.offsetX, fit.offsetY, SS2_STAGE.width * fit.scale, SS2_STAGE.height * fit.scale);

  const tally = emptyTally();
  const ops = visibleOps(current, tally);
  const started = performance.now();
  paintOps(ops, fit, current.placement ?? SCREEN_STAGE_PLACEMENT, tally);
  lastPaintMs = performance.now() - started;
  lastTally = tally;
  lastHoles = show.holes ? outlineHoles(current, fit) : 0;
  if (show.edge) outlineStage(fit);

  // ► **`?probe=1` READS THIS PAGE'S OWN CANVAS BACK.** A tally that says 1698
  //   operations painted and a canvas that is uniformly black cannot both be
  //   describing the same frame, and no amount of reading the painter settles
  //   which one is lying. This samples the pixels the browser actually holds,
  //   inside the browser, and prints them where a screenshot captures them.
  if (params.has("probe")) {
    try {
      const w = canvas.width, h = canvas.height;
      const data = context.getImageData(0, 0, w, h).data;
      const seen = new Map();
      let opaque = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        opaque += 1;
        const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      const top = [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([k, n]) => `#${k.toString(16).padStart(6, "0")} x${n}`).join("  ");
      const lines = [
        `canvas ${w}x${h}, ${seen.size} colours, ${opaque} opaque px`,
        top,
        `fit scale=${fit.scale.toFixed(4)} off=${fit.offsetX.toFixed(1)},${fit.offsetY.toFixed(1)}`,
        `placement=${JSON.stringify(current.placement ?? SCREEN_STAGE_PLACEMENT)}`,
        `ops=${ops.length} painted=${tally.painted} paintMs=${lastPaintMs.toFixed(2)}`
      ];
      for (const line of lines) log(`probe: ${line}`);
    } catch (error) {
      log(`probe failed: ${String(error && error.message).slice(0, 120)}`, { bad: true });
    }
  }
}

/**
 * The operations the toggles leave, in the merged paint order.
 *
 * ► **THE CHROME SPLIT IS `splitScreenChrome`'S AND NOT THIS FILE'S.** It reads
 *   `record.ops`, so handing it the MERGED list splits the words by the same
 *   root depths as the shapes — a glyph on the UI bar is chrome for the same
 *   reason the bar is. Writing the depth test here instead would be a second
 *   copy of `SCREEN_CHROME_DEPTHS` that nothing keeps in step.
 */
function visibleOps(record, tally) {
  let ops = record.ops;
  if (!show.text) {
    const before = ops.length;
    ops = ops.filter((op) => op.source !== "text");
    tally.hiddenByToggle += before - ops.length;
  }
  if (!show.chrome) {
    const before = ops.length;
    ops = splitScreenChrome({ ops }).body;
    tally.hiddenByToggle += before - ops.length;
  }
  return ops;
}

let dirty = true;
let frameQueued = false;

function requestRedraw() {
  dirty = true;
  if (frameQueued) return;
  frameQueued = true;
  requestAnimationFrame(() => {
    frameQueued = false;
    if (!dirty) return;
    dirty = false;
    try {
      draw();
      // ► **EVERY PANEL IS RENDERED FROM THE TALLY THIS FRAME PRODUCED, and
      //   nothing renders the invoice off a previous one.** An earlier draft
      //   had `select` paint the panel immediately and the frame repaint it a
      //   moment later, which meant the cross-check below compared a fresh
      //   screen's module counts against the PREVIOUS screen's painter counts
      //   and logged a disagreement that did not exist. A number on this page
      //   is worthless if it can be one screen behind the picture.
      renderAll();
    } catch (error) {
      // A page that throws mid-frame leaves a half-drawn canvas and no
      // explanation, which is the one outcome worse than an empty one.
      log(`draw failed: ${String(error && error.message).slice(0, 140)}`, { bad: true });
    }
  });
}

window.addEventListener("resize", requestRedraw);

/* ------------------------------------------------------------------ */
/* The invoice                                                         */
/* ------------------------------------------------------------------ */

function row(label, value, { tone = null, why = null } = {}) {
  const node = document.createElement("div");
  const numeric = typeof value === "number";
  node.className = "row" + (numeric && value === 0 && tone !== "ok" ? " zero" : tone ? ` ${tone}` : "");
  const key = document.createElement("span");
  key.className = "k";
  key.textContent = label;
  const val = document.createElement("span");
  val.className = "v";
  val.textContent = String(value);
  node.append(key, val);
  if (!why) return [node];
  const note = document.createElement("div");
  note.className = "why";
  note.textContent = why;
  return [node, note];
}

function heading(text) {
  const node = document.createElement("h2");
  node.textContent = text;
  node.style.marginTop = "8px";
  return node;
}

/**
 * ► **THE TONE IS DECIDED BY WHAT THE NUMBER MEANS, NOT BY WHETHER IT IS BIG.**
 *   A count of things this renderer could not draw is `bad` at one and `zero`
 *   at nought; a count of things it drew is `ok`. A page that paints every
 *   number the same colour is a page nobody reads the important half of.
 */
function missing(value) {
  return value > 0 ? "bad" : null;
}

function approximate(value) {
  return value > 0 ? "hot" : null;
}

function renderInvoice() {
  const panel = el("invoice");
  if (!current) {
    panel.replaceChildren(
      ...row("screens in pack", names().length, {
        tone: names().length === 0 ? "bad" : null,
        why: packsSettled
          ? "there is no invoice because there is no picture — run the extractors against your own copy"
          : "reading assets/screens/ and assets/text/…"
      })
    );
    return;
  }
  const screen = current.screen;
  const text = current.text;
  const a = screen.approximations;
  const nodes = [];

  nodes.push(heading("drawn"));
  nodes.push(...row("shape operations", current.counts.shapeOps, { tone: "ok" }));
  nodes.push(...row("glyph operations", current.counts.glyphOps, { tone: current.counts.glyphOps > 0 ? "ok" : "bad" }));
  nodes.push(...row("— painted by this page", lastTally.painted, { tone: "ok" }));
  nodes.push(...row("— drew nothing", lastTally.drewNothing, { tone: approximate(lastTally.drewNothing) }));
  for (const [reason, count] of Object.entries(lastTally.reasons)) {
    if (count > 0) nodes.push(...row(`    ${reason}`, count, { tone: reason === "transparent-fill" ? "hot" : "bad" }));
  }
  nodes.push(...row("— hidden by a toggle", lastTally.hiddenByToggle, { tone: approximate(lastTally.hiddenByToggle) }));
  nodes.push(...row("bitmap fills drawn", `${lastTally.bitmapDrawn} / ${lastTally.bitmapOps}`,
    { tone: lastTally.bitmapDrawn < lastTally.bitmapOps ? "bad" : null }));
  nodes.push(...row("gradient fills drawn", `${lastTally.gradientDrawn} / ${lastTally.gradientOps}`,
    { tone: lastTally.gradientDrawn < lastTally.gradientOps ? "bad" : null }));
  nodes.push(...row("clips applied", lastTally.clipsApplied));
  nodes.push(...row("paint time", `${lastPaintMs.toFixed(1)} ms`));

  nodes.push(heading("words"));
  nodes.push(...row("text placements", current.counts.textPlacements));
  nodes.push(...row("drawn", current.counts.textDrawn, { tone: current.counts.textDrawn > 0 ? "ok" : null }));
  nodes.push(...row("STILL NOT DRAWN", current.counts.textStillNotDrawn, {
    tone: missing(current.counts.textStillNotDrawn),
    why: current.counts.textStillNotDrawn > 0
      ? "each one is a word or a number missing from this screen"
      : null
  }));
  if (!current.textPresent) {
    nodes.push(...row("text pack", "ABSENT", {
      tone: "bad",
      why: "no assets/text/ — every word on every screen is missing. `node tools/extract-text.mjs`"
    }));
  } else {
    for (const kind of SCREEN_TEXT_UNDRAWN_KINDS) {
      nodes.push(...row(`  ${kind}`, text.undrawnByKind[kind] ?? 0, { tone: missing(text.undrawnByKind[kind] ?? 0) }));
    }
    nodes.push(...row("bound to a live value", text.counts.bound, { tone: text.counts.bound > 0 ? "ok" : null }));
  }

  nodes.push(heading("drawn, and not what the build shows"));
  nodes.push(...row("filters not applied (ops)", a.filtersNotApplied, {
    tone: approximate(a.filtersNotApplied),
    why: a.filtersNotApplied > 0
      ? `${Math.round((a.filtersNotApplied / Math.max(1, screen.ops.length)) * 100)}% of this screen's shapes sit under a FILTERLIST nothing applies — drop shadows and glows`
      : null
  }));
  nodes.push(...row("blend modes not applied", a.blendModesNotApplied, { tone: approximate(a.blendModesNotApplied) }));
  nodes.push(...row("bitmap operations", a.bitmapOps, {
    tone: approximate(a.bitmapOps),
    why: a.bitmapOps > 0 ? "needs assets/bitmaps/; the count above says how many actually drew" : null
  }));
  nodes.push(...row("gradient operations", a.gradientOps, { tone: approximate(a.gradientOps) }));
  nodes.push(...row("baked morph operations", a.bakedMorphOps, {
    tone: approximate(a.bakedMorphOps),
    why: a.bakedMorphOps > 0 ? "a morph frozen at one ratio rather than interpolated" : null
  }));
  nodes.push(...row("button UP-state only", a.buttonUpStateOps, {
    tone: approximate(a.buttonUpStateOps),
    why: a.buttonUpStateOps > 0 ? "no over, down or hit state is in the pack" : null
  }));
  nodes.push(...row("invisible by construction", a.invisibleOps, {
    tone: approximate(a.invisibleOps),
    why: a.invisibleOps > 0 ? "emitted and putting no pixel down — the build's own transparency" : null
  }));
  if (current.textPresent) {
    // The FIXED roster first, zeros included: a counter that exists and fired
    // zero is evidence, and a panel that only ever shows what went wrong cannot
    // be distinguished from a panel that forgot to look.
    for (const kind of SCREEN_TEXT_APPROXIMATION_KINDS) {
      nodes.push(...row(`  ${kind}`, text.approximations[kind] ?? 0, { tone: approximate(text.approximations[kind] ?? 0) }));
    }
    // ► **AND THEN EVERY KIND THE ROSTER HAS NO KEY FOR, because the roster is
    //   a PROJECTION of an open tally and not the tally itself.**
    //   `screen-text.js` counts each mark under its own name in
    //   `approximatedByKind` and copies across only the eight it rosters — it
    //   says so in its own header, and it names this file while saying it. A
    //   panel that walks the roster alone would silently drop the ninth kind
    //   the moment a re-extraction introduced one, which is this project's
    //   standing defect wearing the newest hat available. Measured on this
    //   pack today: the open tally holds nothing the roster misses, and
    //   `unrosteredApproximations` is empty on all 26 — both of which are
    //   measurements, not guarantees, which is exactly why they are rendered
    //   from the data rather than from a list written here.
    const rostered = new Set(SCREEN_TEXT_APPROXIMATION_KINDS);
    for (const [kind, count] of Object.entries(text.approximatedByKind ?? {})) {
      if (rostered.has(kind)) continue;
      const ops = (text.approximatedOpsByKind ?? {})[kind];
      nodes.push(...row(`  ${kind} (unrostered)`, ops === undefined ? count : `${count} / ${ops} ops`, {
        tone: "hot",
        why: "counted by screen-text.js under a name its fixed roster has no key for"
      }));
    }
    const unrostered = text.unrosteredApproximations ?? [];
    if (unrostered.length > 0) {
      nodes.push(...row("  UNROSTERED KINDS", unrostered.join(", "), {
        tone: "bad",
        why: "screen-text.js met a mark it has no roster key for — read it before trusting any count above"
      }));
    }
  }

  nodes.push(heading("not drawn at all"));
  nodes.push(...row("button hit-area only", a.buttonHitAreaOnly, { tone: missing(a.buttonHitAreaOnly) }));
  nodes.push(...row("shapes missing from pack", a.shapesMissing, { tone: missing(a.shapesMissing) }));
  nodes.push(...row("shapes with no paths", a.shapesWithNoPaths, { tone: missing(a.shapesWithNoPaths) }));
  nodes.push(...row("paths without geometry", a.pathsWithoutGeometry, { tone: missing(a.pathsWithoutGeometry) }));
  nodes.push(...row("clips unresolved", a.clipsUnresolved, {
    tone: missing(a.clipsUnresolved),
    why: a.clipsUnresolved > 0 ? "drawn UNCLIPPED — bigger than it should be, over things it should not cover" : null
  }));
  nodes.push(...row("bitmap colour transform dropped", a.bitmapColourTransformDropped, { tone: missing(a.bitmapColourTransformDropped) }));
  nodes.push(...row("gradient alpha offset approximated", a.gradientAlphaOffsetApproximated, { tone: missing(a.gradientAlphaOffsetApproximated) }));

  nodes.push(heading("the extractor's own roster"));
  const kinds = Object.entries(screen.unresolvedByKind);
  if (kinds.length === 0) nodes.push(...row("unresolved", 0));
  for (const [kind, count] of kinds) nodes.push(...row(kind, count, { tone: approximate(count) }));

  // ► **`fromPack` IS `tools/extract-screens.mjs`'S OWN BLOCK, VERBATIM, AND
  //   LEAVING IT OFF THIS PANEL COST THIS PAGE ITS FIRST SCREENSHOT.**
  //   `screenFor` keeps it deliberately separate from its own tally — two
  //   tallies that agree are evidence and one tally copied twice is not — and
  //   it carries counts that have NO counterpart above. `nestedSpriteFrame1`
  //   is the one that matters: a nested sprite drawn at its frame 1, which on
  //   five screens is a closed transition curtain that blacks out everything
  //   under it. The picture was wrong, the invoice above was right, and the
  //   number that reconciled them was the one not on screen.
  nodes.push(heading("the extractor's own block"));
  const fromPack = Object.entries(a.fromPack ?? {});
  if (fromPack.length === 0) nodes.push(...row("(the pack carries none)", 0));
  for (const [kind, count] of fromPack) {
    nodes.push(...row(kind, count, {
      tone: approximate(count),
      why: kind === "nestedSpriteFrame1" && count > 0
        ? "a nested sprite drawn at ITS frame 1 — on five screens that is a closed black curtain over everything"
        : null
    }));
  }

  nodes.push(heading("this frame of twenty-six"));
  nodes.push(...row("label frame", screen.labelFrame ?? "?"));
  nodes.push(...row("frames in range", screen.firstFrame !== null && screen.lastFrame !== null
    ? `${screen.firstFrame}–${screen.lastFrame}` : "?"));
  nodes.push(...row("frames that differ", screen.stillness.differingFrames, {
    tone: approximate(screen.stillness.differingFrames),
    why: screen.stillness.differingFrames > 0
      ? `this screen MOVES: first difference at frame ${screen.stillness.firstDifferingFrame}` +
        (screen.stillness.depthsRemoved.length > 0 ? `, depth ${screen.stillness.depthsRemoved.join(", ")} removed` : "") +
        (screen.stillness.depthsAdded.length > 0 ? `, depth ${screen.stillness.depthsAdded.join(", ")} added` : "")
      : null
  }));
  nodes.push(...row("objects on the root", screen.counts.objects));
  nodes.push(...row("drawables", screen.counts.drawables));
  nodes.push(...row("distinct shapes", screen.counts.distinctShapes));

  nodes.push(heading("chrome every screen inherits"));
  const chromeOps = splitScreenChrome(screen);
  for (const piece of SCREEN_CHROME) {
    const count = chromeOps.chrome.filter((op) => op.depth === piece.depth).length;
    nodes.push(...row(`depth ${piece.depth} ${piece.what}`, count, {
      tone: piece.drawnByTheBuild ? null : "hot",
      why: piece.drawnByTheBuild ? null : piece.note
    }));
  }
  if (lastHoles > 0) {
    nodes.push(...row("holes outlined", lastHoles, { tone: "bad", why: "dashed red boxes on the canvas" }));
  }

  panel.replaceChildren(...nodes);
  crossCheck();
}

/**
 * ► **THE TWO TALLIES ARE COMPARED, AND A DISAGREEMENT IS A FINDING.**
 *   `screen.approximations.invisibleOps` is counted in `src/render/screen.js`
 *   from the operation's own fields; `reasons["transparent-fill"]` is counted
 *   here from whether this painter issued a paint call. They answer the same
 *   question by different routes and there is no reason for them to differ —
 *   so when they do, it is one of the two that is wrong and the log says so
 *   rather than quietly showing the larger number.
 *
 *   **They are NOT expected to be equal when a toggle is off**, because a
 *   hidden operation is never examined, so the check is skipped then and says
 *   it was skipped. A check that silently stops checking is the thing this
 *   whole programme is about.
 */
let lastCrossCheck = null;
function crossCheck() {
  if (!current) return;
  const hidden = lastTally.hiddenByToggle > 0 || !show.bitmaps;
  const mine = lastTally.reasons["transparent-fill"] + lastTally.reasons["no-fill-and-no-stroke"];
  const theirs = current.screen.approximations.invisibleOps;
  const key = `${currentName}|${hidden}|${mine}|${theirs}`;
  if (key === lastCrossCheck) return;
  lastCrossCheck = key;
  if (hidden) {
    log(`invisible-op cross-check skipped: a toggle is hiding ${lastTally.hiddenByToggle} operation(s).`);
    return;
  }
  if (mine === theirs) {
    log(`${currentName}: ${lastTally.painted} op(s) painted, ${mine} invisible — and screen.js agrees on the ${theirs}.`);
  } else {
    log(`${currentName}: DISAGREEMENT — this painter drew nothing for ${mine} op(s), screen.js counts ${theirs} invisible.`, { bad: true });
  }
}

/* ------------------------------------------------------------------ */
/* Provenance                                                          */
/* ------------------------------------------------------------------ */

function renderProvenance() {
  const node = el("provenance");
  if (!hasExtractedScreens(screenPack)) {
    node.replaceChildren(document.createTextNode(
      packsSettled
        ? "Nothing is extracted on this machine. The repository ships no SS2 asset, so this page has nothing to draw until you run the extractors against your own licensed copy."
        : "Reading the packs…"
    ));
    return;
  }
  const lines = [
    `<b>${names().length}</b> root screens, from <b>${screenManifest?.source ?? "an install"}</b> ` +
      `sha <b>${(screenManifest?.sha256 ?? "").slice(0, 12) || "unknown"}</b>.`,
    hasExtractedText(textPack)
      ? `Words from <b>${textManifest?.totals?.glyphs ?? "?"}</b> glyph outlines across <b>${textManifest?.totals?.fonts ?? "?"}</b> fonts.`
      : "<b>No text pack.</b> Every word on every screen is missing.",
    `Stage <b>${SS2_STAGE.width} x ${SS2_STAGE.height}</b>, letterboxed by <b>stageFitFor</b>` +
      (lastFit ? ` at <b>${lastFit.scale.toFixed(2)}x</b>.` : "."),
    "Shapes and words are merged into ONE paint order by <b>screenWithTextFor</b>; both invoices are kept separate above.",
    "Nothing on this page is authored art — every operation comes out of your own extraction."
  ];
  node.innerHTML = lines.join("<br>");
}

function renderHeader() {
  el("screen-name").textContent = current ? current.name : (packsSettled ? "nothing extracted" : "loading…");
  const all = names();
  const at = all.indexOf(currentName);
  el("frame-note").textContent = current
    ? `frame ${current.labelFrame} · ${at + 1} of ${all.length} · ← → to walk`
    : "";
  el("prev").disabled = all.length === 0;
  el("next").disabled = all.length === 0;
  el("footer").textContent = current
    ? `${current.counts.ops} operation(s) in one paint order: ${current.counts.shapeOps} shape, ${current.counts.glyphOps} glyph. ` +
      `${current.counts.textStillNotDrawn} text placement(s) still not drawn. ` +
      "The panel on the right is the half of this page that says what the picture is not showing."
    : "tools/screens — the twenty-six root screens, drawn out of your own extraction.";
}

function renderAll() {
  renderHeader();
  renderProvenance();
  renderInvoice();
}

requestRedraw();
