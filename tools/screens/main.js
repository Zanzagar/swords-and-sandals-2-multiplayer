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
 * placements. ~~**9423 of the 13638 shape operations — 69% — sit under a
 * FILTERLIST that nothing applies**, which is drop shadows and glows missing
 * everywhere while the picture otherwise looks right.~~ **APPLIED SINCE
 * 2026-09-15 — see finding 4 below.** 9423 is still the count of shape
 * operations inside a filtered subtree and the sentence about them was true
 * for a day; what is left unapplied is now named rather than lumped: 8850
 * operations await a colour matrix, 2 sit under a refused filter, and 24 are
 * under a measured no-op. 29 operations carry a
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
 * ► **2. ~~108 OF THE BUILD'S 256 EDIT FIELDS ARE LAID OUT LEFT-ALIGNED WHEN
 *   THE TAG SAYS CENTRE OR RIGHT.~~ FIXED 2026-09-15 IN `src/render/text.js`.**
 *   ~~Visible on `createchar` as the stat column: every number is drawn ON TOP
 *   of its own label.~~ The diagnosis below was right and is kept because it is
 *   how the defect was found; **every present-tense sentence in it is now
 *   false**, and the quoted line no longer reads that way:
 *
 *   ~~*Field 1619 is `align: "center"`, `wordWrap: false`, `multiline: false`,
 *   box x 62.3..109.2 in stage pixels, and its digit draws at 64.6, the box's
 *   left edge plus the gutter. `fieldLayoutOptionsFor` passes
 *   `maxWidth: field.wordWrap && field.multiline ? inner : Infinity`, and
 *   `layoutText` then computes `box = Number.isFinite(maxWidth) ? maxWidth :
 *   widest`, so the slack is zero and alignment is a no-op.*~~
 *
 *   One parameter was carrying two jobs: WRAPPING genuinely needs
 *   `wordWrap && multiline`, ALIGNING only needs a box, and every field has
 *   one. `fieldLayoutOptionsFor` now carries a separate `alignWidth`, so that
 *   digit is centred — clear of the label, which ends at 72. **The prediction
 *   above was 82.2 px and the digit's ink measures 82.33 px**; both are kept,
 *   because the first is a hand-computed box centre and the second is the
 *   glyph's actual left edge, and collapsing them to one number would hide
 *   that they are different quantities.
 *
 * ► **AND THIS BLOCK IS WHY A POINTER MUST BE CORRECTED AT THE POINTEE.**
 *   `src/render/text.js` struck its own copy of this claim when it made the
 *   fix, and named THIS block as stale — but naming it did not change it, so
 *   the text a reader of this file actually reached still said the bug was
 *   live. A verifier found it. **Correcting the pointer is not correcting the
 *   pointee**, which is the same shape as the eight other explaining-away
 *   failures recorded in `HANDOFF.md`.
 *
 * ► **4. THE 113 FILTER GROUPS `screen.js` HAS TO CALL UNREACHABLE ARE MOSTLY
 *   REACHABLE FROM HERE, AND NOBODY HAD LOOKED BECAUSE NOBODY WAS COMPOSITING.**
 *   `screen.js` emits no text, so a glow on a text field reaches no drawable it
 *   knows about, and its roster records 113 of its 248 groups reaching nothing.
 *   **This page draws the MERGED order, and the glyph operations
 *   `screen-text.js` emits carry the SAME `path` array**, so matching a group's
 *   path against the merged list finds them: measured 2026-09-15 across all 26
 *   screens, **98 of those 113 groups reach a glyph operation and only 15 reach
 *   nothing at all**. 1689 glyph operations sit inside a filter group, 650 of
 *   them on `help` under a single drop shadow — which is precisely the
 *   `filtersNotAppliedOps 650` the words panel beside them has been reporting
 *   since this page was built. **Two counts on one panel described the same
 *   650 operations for a day and nothing joined them**, which is the failure
 *   mode this page exists to catch, committed by this page.
 *
 *   The compositing itself is in "The filtered groups, composited offscreen"
 *   below; what belongs here is why the discovery needed a picture. The
 *   module-side number was not wrong — `screen.js` genuinely emits no text and
 *   genuinely cannot reach those groups. It took a caller holding BOTH halves
 *   to notice that the halves fit together.
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
 *   ?filters=0                         # stop compositing the filtered groups
 *   ?probe=1                           # read the canvas back and log what is on it
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
  stageClipRectFor,
  TWIPS_PER_PIXEL,
  canvasFilterFor
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
  edge: params.get("edge") === "1",
  // ► **AND THIS ONE MAKES A PRESENCE VISIBLE, WHICH IS THE OTHER HALF.**
  //   `?filters=0` draws every operation straight onto the canvas, exactly as
  //   this page did before 2026-09-15, so the filtered picture and the
  //   unfiltered one can be put side by side at the same window size. Without
  //   it a soft edge is unfalsifiable: nothing on the page says what it would
  //   have looked like without the offscreen pass.
  filters: params.get("filters") !== "0"
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
  edge: "stage edge",
  filters: "filter groups"
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
function paintGradientFill(ctx, operation, path) {
  const g = operation.gradient;
  if (!g || !Array.isArray(g.stops) || g.stops.length === 0) return false;
  const m = g.matrix;
  if (!m) return false;
  const apply = () => ctx.transform(
    m.a / TWIPS_PER_PIXEL, m.b / TWIPS_PER_PIXEL,
    m.c / TWIPS_PER_PIXEL, m.d / TWIPS_PER_PIXEL,
    m.tx / TWIPS_PER_PIXEL, m.ty / TWIPS_PER_PIXEL
  );
  ctx.save();
  apply();
  const ramp = g.type === "radial"
    ? ctx.createRadialGradient(0, 0, 0, 0, 0, GRADIENT_SQUARE)
    : ctx.createLinearGradient(-GRADIENT_SQUARE, 0, GRADIENT_SQUARE, 0);
  for (const stop of g.stops) {
    // `addColorStop` throws on a non-finite offset, which would take the whole
    // frame down; a clamp is cheaper than a try/catch per stop.
    const offset = Math.min(1, Math.max(0, Number.isFinite(stop.offset) ? stop.offset : 0));
    ramp.addColorStop(offset, rgbaOf(stop.fill, stop.opacity ?? 1));
  }
  ctx.restore();
  // The path is in SHAPE space and the ramp is in GRADIENT space, so the path
  // cannot simply be filled: it is the CLIP, and the ramp covers it.
  ctx.save();
  ctx.clip(path, operation.fillRule ?? "evenodd");
  apply();
  ctx.fillStyle = ramp;
  ctx.fillRect(-GRADIENT_SQUARE, -GRADIENT_SQUARE, GRADIENT_SQUARE * 2, GRADIENT_SQUARE * 2);
  ctx.restore();
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
function paintBitmapFill(ctx, operation, path) {
  const image = bitmaps.get(operation.bitmap?.id);
  if (!image || (image.naturalWidth === 0 && image.width === 0)) return false;
  const m = operation.bitmap.matrix;
  ctx.save();
  ctx.clip(path, operation.fillRule ?? "evenodd");
  if (m) {
    ctx.transform(
      m.a / TWIPS_PER_PIXEL, m.b / TWIPS_PER_PIXEL,
      m.c / TWIPS_PER_PIXEL, m.d / TWIPS_PER_PIXEL,
      m.tx / TWIPS_PER_PIXEL, m.ty / TWIPS_PER_PIXEL
    );
  }
  if (operation.bitmap.repeat) {
    const pattern = ctx.createPattern(image, "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      // In the bitmap's own space now, so a generous rectangle is cheaper than
      // an exact one and the clip above is what actually bounds it.
      ctx.fillRect(-4000, -4000, 8000, 8000);
    }
  } else {
    ctx.drawImage(image, 0, 0);
  }
  ctx.restore();
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
    // ~~Carried on the operation by the pack, applied by nothing here.~~
    // **`filteredOps` IS STILL "an operation inside something filtered" AND IS
    // STILL NOT THE NUMBER APPLIED** — the applied count is `filters` below,
    // which this page tallies from what it actually composited. The two are
    // different questions and the panel shows both.
    filteredOps: 0,
    blendOps: 0,
    notdefOps: 0,
    hiddenByToggle: 0,
    // THIS PAGE'S OWN FILTER INVOICE. Not one field here is copied from
    // `screen.approximations`; two of them are the same question the module
    // answers by a different route, and `crossCheck` compares those two.
    filters: emptyFilterCounts()
  };
}

/**
 * ► **EVERY ONE OF THESE IS COUNTED BY NAME AND HAS A DENOMINATOR ON THE
 *   PANEL**, because a bare zero cannot be told from a dead counter. `groups`
 *   is the denominator for the group counts, the screen's operation count for
 *   the operation counts, and `filterTokens` for `filterTokensUnparsed`.
 */
function emptyFilterCounts() {
  return {
    // What was available to composite.
    available: 0,
    groupsWithNoPath: 0,
    groupsReachingNothingHere: 0,
    groupsReachingSomething: 0,
    groupsReachingOnlyGlyphs: 0,
    groupsWithNoFilterString: 0,
    groupsStringVanishedAtScale: 0,
    groupsNotContiguousHere: 0,
    // What was composited.
    groupsComposited: 0,
    composites: 0,
    offscreenPasses: 0,
    offscreenPixels: 0,
    runsReopened: 0,
    padMax: 0,
    padLimit: 0,
    padClamped: 0,
    // Operations, shape and glyph kept apart because the module's own counts
    // are shape-only and a merged number could not be compared with them.
    opsUnderAnyGroup: 0,
    glyphOpsUnderAnyGroup: 0,
    opsUnderFilterString: 0,
    glyphOpsUnderFilterString: 0,
    glyphOpsComposited: 0,
    // Still NOT applied, and the panel must keep saying so.
    groupsWithColourMatrix: 0,
    // A matrix-only group that has a STRICT DESCENDANT group carrying a
    // canvas filter string: the descendant composites and this one does not,
    // which is the innermost-wins picture screen.js argues against.
    groupsMatrixOnlyWithFilteredDescendant: 0,
    opsUnderColourMatrix: 0,
    groupsRefused: 0,
    opsUnderRefusedFilter: 0,
    groupsNoOpOnly: 0,
    // The parser's own honesty, and the guard against a module stamping a
    // filter onto an operation behind this page's back.
    filterTokens: 0,
    filterTokensUnparsed: 0,
    opsArrivingPreMarked: 0,
    // Conditions, and the clock.
    scale: 0,
    widestBleed: 0,
    widestFilterAtOne: null,
    widestFilterAsSet: null,
    canvasFilterWorks: false,
    compositeMs: 0,
    walkMs: 0
  };
}

/* ------------------------------------------------------------------ */
/* The filtered groups, composited offscreen                           */
/* ------------------------------------------------------------------ */

/**
 * ► **FLASH RASTERISES A FILTERED GROUP AND FILTERS THE COMPOSITE**, so the
 *   one-line implementation — `ctx.filter = group.filter` before each of the
 *   group's own operations — is NOT a rough version of the right picture, it
 *   is a different picture that looks plausible. `src/render/screen.js` states
 *   the case that settles it and this page can now show it: `townsquare`'s
 *   placement at path `[59,1]` covers 1523 operations, and blurring those one
 *   at a time blurs 1523 internal seams the build's own rasterisation does not
 *   have. So a group's operations are drawn to an OFFSCREEN canvas,
 *   `ctx.filter` is set ONCE, and the offscreen is drawn back.
 *
 * ## WHY THE GROUP'S `[opFirst, opEnd)` RANGE IS NOT USED HERE, AT ALL
 *
 * `screen.js` derives that range against its OWN shape-only `ops` array, and
 * says in its header that a caller which re-sorts or filters `ops` must
 * re-match on `path` instead. **This page is exactly that caller, twice over:**
 * it draws `screenWithTextFor`'s MERGED order (shapes and glyph outlines
 * interleaved by depth) and then `visibleOps` filters it by the toggles. Using
 * the range here would index the wrong array with numbers that look right.
 *
 * ► **AND RE-MATCHING ON `path` IS NOT MERELY THE SAFE ROUTE — IT IS THE ONE
 *   THAT FINDS 98 GROUPS `screen.js` HAS TO CALL UNREACHABLE.** Measured
 *   2026-09-15 on this pack, by matching every group's path against the merged
 *   order of all 26 screens: `screen.js` counts **113 of its 248 groups
 *   reaching no operation**, because it emits no text — but the glyph
 *   operations `screen-text.js` emits **carry the same `path` array**, and
 *   **98 of those 113 groups reach a glyph operation.** Only 15 reach nothing
 *   here. **1689 glyph operations across the 26 screens sit inside a filter
 *   group**, and on `help` that is **650 of them under one drop shadow** —
 *   which is the `filtersNotAppliedOps 650` this page's own words panel has
 *   been reporting since it was built. They are composited now.
 *
 * ## THE OFFSCREEN IS CANVAS-SIZED PLUS A PAD, AND THE PAD IS THE FILTER'S OWN
 *
 * A blur or a glow draws OUTSIDE the geometry that produced it, so an
 * offscreen cut to a group's tight bounding box clips the effect into a hard
 * edge. This one is not cut to the bounds at all: it is the whole canvas, so
 * every destination pixel's source is present — except at the canvas edge,
 * where source geometry up to one bleed-radius OUTSIDE the canvas can still
 * reach a pixel INSIDE it. That is what the pad is for and it is the only
 * thing it is for.
 *
 * ► **THE BLEED RADIUS IS READ OFF THE FILTER STRING THAT IS ABOUT TO BE SET**,
 *   not off the filter records, because the string is what the browser will
 *   actually apply and it is already at this frame's scale. Two constants, both
 *   derived rather than picked:
 *
 *   - `blur(Rpx)` — R is a standard deviation (`filters.js` says so and says
 *     why the two CSS radii are not the same quantity). A Gaussian is truncated
 *     at **3 sigma**, which holds 99.73% of its mass; SVG's own three-box-blur
 *     approximation of it has a HARD support of 3 x 1.5 x (3*sqrt(2*pi)/4)
 *     sigma = 2.82 sigma, so 3 sigma covers the exact kernel to 0.3% and the
 *     approximate one completely.
 *   - `drop-shadow(dx dy R c)` — R is a BOX-SHADOW blur radius, which is TWICE
 *     the standard deviation, so its support is 3 x R/2 = **1.5 R**, offset by
 *     `dx`/`dy`.
 *
 *   Measured on this pack at scale 1: median bleed 1.97 stage px, p90 9.49,
 *   max 67.54 (one glow on `createchar`, `createboss`, `load_saved_gladiators`,
 *   `delete_gladiator` and `church`). **Every one of the 214 function tokens in
 *   the 213 filter strings parses** — 158 `drop-shadow`, 56 `blur` — and
 *   `filterTokensUnparsed` is the denominator'd counter that says so, because a
 *   token this parser does not know reads as bleed 0 and clips silently.
 *
 * ## THE SCALE IS DEVICE PIXELS PER STAGE PIXEL, AND PASSING 1 WOULD UNDER-BLUR
 *
 * `ctx.filter` lengths are NOT scaled by `ctx.setTransform` — `filters.js`
 * states this and states that it is an unmeasured hypothesis about browsers —
 * so `canvasFilterFor` takes a `scale` and the group's `filter` field, built at
 * scale 1, is the wrong string for every window this page has ever been opened
 * in. The right factor is `fit.scale * placement.scale`, and `fit.scale`
 * ALREADY carries the `devicePixelRatio`: `draw()` sizes the canvas in DEVICE
 * pixels and hands those dimensions to `stageFitFor`, so its scale is device
 * pixels per stage pixel and multiplying by the ratio again would double every
 * blur. The probe prints the factor so a screenshot says which one was used.
 *
 * ► **WHAT IS NOT SETTLED: whether Flash's `blurX` is in the FILTERED CLIP's
 *   own space or in stage space.** If it is the clip's own, a group whose
 *   geometry is scaled by its placement wants that factor as well. 70 of the
 *   213 string-bearing groups have geometry whose average `sqrt(|det|)` is more
 *   than 2% off 1, so the question is reachable rather than academic; there is
 *   no browser and no capture on this route to settle it, so the count is on
 *   the panel as `groups with scaled geometry` and the stage factor is used.
 */

/** A Gaussian's practical support: 3 sigma holds 99.73% of it. */
const GAUSSIAN_SUPPORT_SIGMAS = 3;

/** `drop-shadow`'s third length is a box-shadow radius — twice the sigma. */
const SHADOW_RADIUS_PER_SIGMA = 2;

/**
 * One CSS filter function and its arguments, nested parens and all, so that
 * `rgba(…)` INSIDE a `drop-shadow(…)` is consumed as part of it and never
 * counted as a token of its own.
 */
const FILTER_FUNCTION = /([a-z-]+)\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;

/** Every `<number>px` in a filter function's arguments, in order. */
const FILTER_LENGTH = /-?\d*\.?\d+(?=px)/g;

/**
 * How far outside its own geometry a filter string draws, in the units of the
 * string itself — so a string built at this frame's scale answers in device
 * pixels. Unknown functions are COUNTED, never assumed harmless.
 */
function filterBleedFor(filter, counts) {
  if (typeof filter !== "string" || filter.length === 0) return 0;
  let bleed = 0;
  FILTER_FUNCTION.lastIndex = 0;
  let match;
  while ((match = FILTER_FUNCTION.exec(filter)) !== null) {
    counts.filterTokens += 1;
    const name = match[1];
    const args = match[2];
    if (name === "blur") {
      const sigma = Number.parseFloat(args);
      if (Number.isFinite(sigma)) bleed = Math.max(bleed, GAUSSIAN_SUPPORT_SIGMAS * Math.abs(sigma));
      else counts.filterTokensUnparsed += 1;
      continue;
    }
    if (name === "drop-shadow") {
      const lengths = args.match(FILTER_LENGTH);
      if (lengths && lengths.length >= 3) {
        const dx = Math.abs(Number.parseFloat(lengths[0]));
        const dy = Math.abs(Number.parseFloat(lengths[1]));
        const radius = Math.abs(Number.parseFloat(lengths[2]));
        bleed = Math.max(bleed, Math.max(dx, dy) + (GAUSSIAN_SUPPORT_SIGMAS / SHADOW_RADIUS_PER_SIGMA) * radius);
      } else counts.filterTokensUnparsed += 1;
      continue;
    }
    // Not a length-bearing filter this parser knows. It may still bleed, so it
    // is counted rather than treated as zero — a silent zero here is a clipped
    // effect that reads as a hard edge and blames the pack.
    counts.filterTokensUnparsed += 1;
  }
  return bleed;
}

/**
 * ► **DOES THIS BROWSER HONOUR `ctx.filter` AT ALL?** Safari shipped it in 17;
 *   before that the assignment is a silent no-op and every group would be
 *   rasterised to an offscreen, composited back UNFILTERED, and counted as
 *   composited — a page confidently reporting an effect it did not draw. The
 *   round-trip is the only way to tell from inside.
 */
const CANVAS_FILTER_WORKS = (() => {
  try {
    const probe = document.createElement("canvas").getContext("2d");
    probe.filter = "blur(2px)";
    return probe.filter === "blur(2px)";
  } catch { return false; }
})();

/**
 * The offscreens, pooled by DEPTH in the group tree and never shrunk.
 *
 * Depth, not group: a group is finished and composited before its next sibling
 * opens, so only the open ancestors need buffers at once. Measured on this
 * pack, `screen.js`'s own figure: no operation sits under three filtered
 * ancestors, so this pool is two or three canvases and not 198.
 */
const offscreens = [];
function offscreenAt(depth, width, height) {
  let layer = offscreens[depth];
  if (!layer) {
    const element = document.createElement("canvas");
    layer = { canvas: element, context: element.getContext("2d") };
    offscreens[depth] = layer;
  }
  if (layer.canvas.width < width || layer.canvas.height < height) {
    // Assigning either dimension resets the canvas, which is exactly what is
    // wanted — the caller clears the sub-rectangle it uses in any case.
    layer.canvas.width = Math.max(layer.canvas.width, width);
    layer.canvas.height = Math.max(layer.canvas.height, height);
  }
  return layer;
}

/** `screenFor`'s prefix test, as the group roster's own paths are matched. */
function pathHasPrefix(path, prefix) {
  if (!Array.isArray(path) || !Array.isArray(prefix)) return false;
  if (prefix.length > path.length) return false;
  for (let index = 0; index < prefix.length; index += 1) {
    if (path[index] !== prefix[index]) return false;
  }
  return true;
}

/**
 * WHICH GROUPS COVER WHICH OF THE OPERATIONS THIS FRAME WILL ACTUALLY DRAW.
 *
 * Every count here is this page's own, taken over the merged, toggled list it
 * is about to paint — never copied from `screen.approximations`. Two of them
 * are deliberately the SAME QUESTION the module answers by a different route
 * (`opsUnderAnyGroup` against `opsUnderFilterGroup`, `opsUnderFilterString`
 * against `opsWithCanvasFilter`, both restricted to shape operations so the
 * populations match), and `crossCheck` below compares them and calls a
 * difference a finding.
 */
function filterLayersFor(ops, groups, scale, counts) {
  const chains = new Array(ops.length).fill(null);
  if (!Array.isArray(groups) || groups.length === 0) return chains;

  for (const group of groups) {
    if (!group || !Array.isArray(group.path)) { counts.groupsWithNoPath += 1; continue; }
    const indices = [];
    let glyphs = 0;
    for (let index = 0; index < ops.length; index += 1) {
      if (!pathHasPrefix(ops[index].path, group.path)) continue;
      indices.push(index);
      if (ops[index].source === "text") glyphs += 1;
    }
    // ► **NOTHING MAY ARRIVE PRE-MARKED.** `screen.js` asserts that no operation
    //   carries `filter`, `filters`, `filterGroup`, `colourMatrices`, `refused`
    //   or `deferred`, precisely so the per-operation `ctx.filter` loop cannot
    //   be written by habit. If a module starts stamping one, this page would
    //   apply the group's filter a second time on top of it — so it is counted
    //   here and shouted in the log rather than discovered in a screenshot.
    for (const index of indices) {
      const op = ops[index];
      if (op.filter !== undefined || op.filters !== undefined || op.filterGroup !== undefined) {
        counts.opsArrivingPreMarked += 1;
      }
    }

    const shapes = indices.length - glyphs;
    const hasString = typeof group.filter === "string" && group.filter.length > 0;
    const matrices = Array.isArray(group.colourMatrices) ? group.colourMatrices.length : 0;
    const refusals = Array.isArray(group.refused) ? group.refused.length : 0;
    const noOps = Array.isArray(group.noOps) ? group.noOps.length : 0;

    if (indices.length === 0) { counts.groupsReachingNothingHere += 1; continue; }
    counts.groupsReachingSomething += 1;
    if (shapes === 0) counts.groupsReachingOnlyGlyphs += 1;
    if (matrices > 0) { counts.groupsWithColourMatrix += 1; }
    if (refusals > 0) { counts.groupsRefused += 1; }
    if (noOps > 0 && !hasString && matrices === 0) counts.groupsNoOpOnly += 1;
    if (!hasString) {
      counts.groupsWithNoFilterString += 1;
      // Counted BEFORE the `continue`, because after it there is no group
      // left to ask about — which is how "composited ungraded" got written
      // in the panel for a step that never runs.
      if (matrices > 0 && groups.some((other) => other !== group
        && other.filter && Array.isArray(other.path)
        && other.path.length > group.path.length
        && group.path.every((seg, at) => other.path[at] === seg))) {
        counts.groupsMatrixOnlyWithFilteredDescendant += 1;
      }
      continue;
    }

    const contiguous = indices[indices.length - 1] - indices[0] + 1 === indices.length;
    if (!contiguous) counts.groupsNotContiguousHere += 1;

    // The string at THIS frame's scale, and the bleed read back off it. The
    // group's own `filter` field is the scale-1 string and is never used to
    // paint — only to say, on the panel, what the pack asked for.
    const built = canvasFilterFor(group.filters, { scale });
    if (typeof built.filter !== "string" || built.filter.length === 0) {
      // Scale cannot turn a string into nothing (every classification in
      // `canvasFilterFor` happens before the factor is applied), so this is a
      // contradiction rather than a case — counted, never swallowed.
      counts.groupsStringVanishedAtScale += 1;
      continue;
    }
    const bleed = filterBleedFor(built.filter, counts);
    // The widest bleed is the one whose scaling is most visible, so it is the
    // one the panel prints twice — see the note at that row.
    if (bleed > counts.widestBleed || counts.widestFilterAsSet === null) {
      counts.widestBleed = bleed;
      counts.widestFilterAsSet = built.filter;
      counts.widestFilterAtOne = typeof group.filter === "string" ? group.filter : null;
    }

    const layer = {
      group,
      path: group.path,
      filter: built.filter,
      bleed,
      matched: indices.length,
      glyphs,
      shapes,
      contiguous,
      depth: 0,
      pad: 0
    };
    counts.groupsComposited += 1;
    counts.glyphOpsComposited += glyphs;
    for (const index of indices) (chains[index] ??= []).push(layer);
  }

  // OUTERMOST FIRST. A longer path is deeper, and two groups never share a path
  // on this pack (`screen.js` counts `filterGroupsSharingAPath`, measured 0);
  // if they ever do, the order between them is arbitrary but both still apply.
  for (const chain of chains) {
    if (chain && chain.length > 1) chain.sort((a, b) => a.path.length - b.path.length);
  }

  // The five op-level facts, counted PER OPERATION in their own pass. An
  // operation under two groups is ONE operation in each of these; incrementing
  // inside the loop above would inflate every one of them, and 40% of this
  // pack's operations sit under exactly two filtered ancestors.
  for (let index = 0; index < ops.length; index += 1) {
    const op = ops[index];
    const glyph = op.source === "text";
    let underAny = false;
    let underString = false;
    let underMatrix = false;
    let underRefused = false;
    for (const group of groups) {
      if (!group || !pathHasPrefix(op.path, group.path)) continue;
      underAny = true;
      if (typeof group.filter === "string" && group.filter.length > 0) underString = true;
      if (Array.isArray(group.colourMatrices) && group.colourMatrices.length > 0) underMatrix = true;
      if (Array.isArray(group.refused) && group.refused.length > 0) underRefused = true;
    }
    if (underAny) { if (glyph) counts.glyphOpsUnderAnyGroup += 1; else counts.opsUnderAnyGroup += 1; }
    if (underString) { if (glyph) counts.glyphOpsUnderFilterString += 1; else counts.opsUnderFilterString += 1; }
    if (underMatrix) counts.opsUnderColourMatrix += 1;
    if (underRefused) counts.opsUnderRefusedFilter += 1;
  }

  return chains;
}

/** Shared empty chain, so the hot loop allocates nothing per operation. */
const EMPTY_CHAIN = Object.freeze([]);

/**
 * The transform chain from a device pixel to a stage pixel, on ANY context —
 * the main one and every offscreen, from one place, because two copies of a
 * transform chain is how an offscreen ends up half a pixel out and the seam
 * shows as a dark line.
 *
 * ► **THE STAGE CLIP IS ONLY EVER SET ON THE MAIN CONTEXT.** Flash rasterises
 *   a filtered clip whole and the STAGE clips the composite afterwards, so
 *   clipping inside an offscreen would cut the geometry before its own blur
 *   and manufacture a hard edge at the stage border out of nothing. The clip on
 *   the main context survives `save()`/`setTransform(identity)` — a clip is a
 *   device-space region once set — so every composite lands inside it.
 */
function applyStageChain(ctx, fit, placement, { pad = 0, clip = false } = {}) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (pad !== 0) ctx.translate(pad, pad);
  ctx.translate(fit.offsetX, fit.offsetY);
  ctx.scale(fit.scale, fit.scale);
  if (clip) {
    ctx.beginPath();
    ctx.rect(0, 0, SS2_STAGE.width, SS2_STAGE.height);
    ctx.clip();
  }
  ctx.translate(placement.x, placement.y);
  if (placement.scale !== 1) ctx.scale(placement.scale, placement.scale);
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
 *
 * ► **AND THE LOOP IS A STACK NOW, NOT A LOOP.** Each operation names the
 *   filtered groups it is inside; when that chain deepens an offscreen opens,
 *   when it shallows the offscreen is filtered ONCE and drawn back into
 *   whatever is under it. An operation in no group goes straight to the main
 *   context exactly as it always did, so the 5518 operations across the 26
 *   screens that are in no group take the identical path they took before.
 */
function paintOps(ops, fit, placement, tally, groups) {
  const counts = tally.filters;
  // DEVICE PIXELS PER STAGE PIXEL. `fit.scale` already carries
  // `devicePixelRatio` because `draw()` sizes the canvas in device pixels
  // before calling `stageFitFor`; multiplying by the ratio again here would
  // ship every blur at twice its width, and passing 1 would ship it at a third.
  const scale = fit.scale * (placement.scale ?? 1);
  counts.scale = scale;
  counts.available = Array.isArray(groups) ? groups.length : 0;
  // ► **THE ONE BOUND ON THE PAD, AND IT IS DERIVED RATHER THAN PICKED.** A
  //   bleed wider than the canvas itself can only be fed by geometry further
  //   from the stage than the stage is wide, so padding past that buys nothing
  //   and costs an offscreen more than three times the canvas in each
  //   direction. Measured on this pack: the widest bleed is 67.54 stage pixels
  //   (one glow, on five screens), so at every window this page has been opened
  //   in the limit is an order of magnitude clear and `padClamped` stays 0 —
  //   which is why `padMax / padLimit` is on the panel as a RATIO. A bare
  //   `padClamped: 0` could not be told from a counter that never fires.
  counts.padLimit = Math.max(1, Math.min(canvas.width, canvas.height));
  counts.canvasFilterWorks = CANVAS_FILTER_WORKS;

  const chains = show.filters && CANVAS_FILTER_WORKS
    ? filterLayersFor(ops, groups, scale, counts)
    : new Array(ops.length).fill(null);

  context.save();
  applyStageChain(context, fit, placement, { clip: show.clip });

  /** The open offscreens, outermost first. Empty means the main context. */
  const stack = [];
  const targetOf = () => (stack.length > 0 ? stack[stack.length - 1].context : context);

  const compositeStarted = performance.now();
  let compositeMs = 0;

  function openLayer(layer) {
    const parent = stack.length > 0 ? stack[stack.length - 1] : null;
    // CUMULATIVE. A child's bleed has to survive its parent's own pad, or the
    // outer band of the child is thrown away before the parent ever blurs it.
    const wanted = Math.ceil(layer.bleed) + (parent ? parent.pad : 0);
    const pad = Math.min(wanted, counts.padLimit);
    if (pad < wanted) counts.padClamped += 1;
    if (pad > counts.padMax) counts.padMax = pad;
    const width = canvas.width + pad * 2;
    const height = canvas.height + pad * 2;
    const off = offscreenAt(stack.length, width, height);
    const ctx = off.context;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, width, height);
    applyStageChain(ctx, fit, placement, { pad });
    counts.offscreenPasses += 1;
    counts.offscreenPixels += width * height;
    stack.push({ layer, pad, width, height, canvas: off.canvas, context: ctx });
  }

  function closeLayer() {
    const entry = stack.pop();
    const parent = stack.length > 0 ? stack[stack.length - 1] : null;
    const dest = parent ? parent.context : context;
    const destPad = parent ? parent.pad : 0;
    const started = performance.now();
    dest.save();
    dest.setTransform(1, 0, 0, 1, 0, 0);
    dest.filter = entry.layer.filter;
    dest.globalAlpha = 1;
    dest.globalCompositeOperation = "source-over";
    // The pooled canvas may be LARGER than this pass needs — it grows and is
    // never shrunk — so the sub-rectangle is named explicitly rather than
    // trusting `canvas.width`, which would drag a previous screen's stale band
    // in along the right and bottom edges.
    dest.drawImage(
      entry.canvas, 0, 0, entry.width, entry.height,
      destPad - entry.pad, destPad - entry.pad, entry.width, entry.height
    );
    dest.restore();
    compositeMs += performance.now() - started;
    counts.composites += 1;
  }

  for (let index = 0; index < ops.length; index += 1) {
    const chain = chains[index];
    const wanted = chain ?? EMPTY_CHAIN;
    // How much of the open stack this operation still belongs to.
    let shared = 0;
    while (shared < stack.length && shared < wanted.length && stack[shared].layer === wanted[shared]) shared += 1;
    while (stack.length > shared) closeLayer();
    for (let depth = shared; depth < wanted.length; depth += 1) {
      // Re-opening a group that was already closed means its operations were
      // NOT a contiguous run here, so its filter is applied once per run
      // instead of once. `groupsNotContiguousHere` already counted the group;
      // this counts the extra passes, which is the cost.
      if (wanted[depth].opened) counts.runsReopened += 1;
      wanted[depth].opened = true;
      openLayer(wanted[depth]);
    }
    paintOne(targetOf(), ops[index], tally);
  }
  // ► **THIS LINE IS UNREACHABLE AGAINST THIS PACK AND IS SAID SO RATHER THAN
  //   ASSUMED TESTED.** It composites a group whose operations run to the very
  //   end of the list. Measured 2026-09-15 over all 26 screens: **0 of them end
  //   inside a composited group** — every one ends with the SAME three
  //   operations, the depth-1193 chrome piece, which is outside every group,
  //   and `?chrome=0` does not change that either. So a mutation that replaced
  //   this with a bare `stack.pop()` survived every check this page can make.
  //   It stays because the format permits the case and dropping a rasterised
  //   group is invisible in a picture; what would catch it is the panel's
  //   `composited back N / M` row, which a mutation dropping one composite
  //   MID-walk does turn red (9 / 13 on `townsquare`).
  while (stack.length > 0) closeLayer();

  context.restore();
  context.filter = "none";
  context.globalAlpha = 1;
  counts.compositeMs = compositeMs;
  counts.walkMs = performance.now() - compositeStarted;
}

/** One operation, onto whichever surface is currently open. */
function paintOne(ctx, operation, tally) {
  tally.seen += 1;
  if (operation.source === "text") tally.glyphOps += 1;
  else tally.shapeOps += 1;
  if (operation.filtered) tally.filteredOps += 1;
  if (operation.blendMode !== undefined && operation.blendMode !== null) tally.blendOps += 1;
  if (operation.notdef) tally.notdefOps += 1;

  if (operation.kind !== "path") {
    tally.reasons["not-a-path"] += 1;
    tally.drewNothing += 1;
    return;
  }
  if (typeof operation.d !== "string" || operation.d.length === 0) {
    tally.reasons["no-geometry"] += 1;
    tally.drewNothing += 1;
    return;
  }

  const matrix = Array.isArray(operation.matrix) && operation.matrix.length === 6
    ? operation.matrix
    : [1, 0, 0, 1, 0, 0];

  ctx.save();
  // ► **THE CLIP GOES ON BEFORE THE SHAPE'S OWN TRANSFORM**, because the
  //   cutter's matrix is composed in the SAME space as the shape's and not
  //   inside it. Setting it afterwards clips a glow by a mask already moved
  //   by the glow's own placement — a plausible picture, and the wrong one.
  if (operation.clip && typeof operation.clip.d === "string") {
    const c = Array.isArray(operation.clip.matrix) && operation.clip.matrix.length === 6
      ? operation.clip.matrix
      : [1, 0, 0, 1, 0, 0];
    ctx.save();
    ctx.transform(c[0], c[1], c[2], c[3], c[4] / TWIPS_PER_PIXEL, c[5] / TWIPS_PER_PIXEL);
    ctx.clip(path2dFor(operation.clip.d), "evenodd");
    ctx.restore();
    tally.clipsApplied += 1;
  }
  ctx.transform(
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
      ctx.globalAlpha = alpha;
      if (paintBitmapFill(ctx, operation, path)) {
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
      ctx.globalAlpha = 1;
      if (paintGradientFill(ctx, operation, path)) {
        painted = true;
        tally.gradientDrawn += 1;
      } else {
        reason = "gradient-unusable";
      }
    }
  } else if (typeof operation.fill === "string" && operation.fill !== "none") {
    const alpha = operation.fillOpacity ?? 1;
    if (alpha > 0) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = operation.fill;
      ctx.fill(path, operation.fillRule ?? "evenodd");
      painted = true;
    } else {
      reason = "transparent-fill";
    }
  }

  if (typeof operation.stroke === "string" && operation.stroke !== "none"
    && operation.strokeWidth > 0 && (operation.strokeOpacity ?? 1) > 0) {
    ctx.globalAlpha = operation.strokeOpacity ?? 1;
    ctx.strokeStyle = operation.stroke;
    // In the CURRENT transform's units, which the stage fit then scales.
    ctx.lineWidth = operation.strokeWidth;
    ctx.lineJoin = "round";
    ctx.stroke(path);
    painted = true;
    tally.strokesDrawn += 1;
  }

  ctx.globalAlpha = 1;
  ctx.restore();
  if (painted) tally.painted += 1;
  else {
    tally.drewNothing += 1;
    tally.reasons[reason] += 1;
  }
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
  //
  // ► **THE RECTANGLE IS `stageClipRectFor(fit)` NOW RATHER THAN A SECOND COPY
  //   OF THE ARITHMETIC.** This file had `fit.offsetX, fit.offsetY,
  //   SS2_STAGE.width * fit.scale, SS2_STAGE.height * fit.scale` written out,
  //   which is exactly what that function returns — and "three copies of the
  //   arithmetic appeared in one evening" is a sentence this repository has
  //   already had to write about the colour transform.
  const stageRect = stageClipRectFor(fit);
  context.fillStyle = "#000000";
  context.fillRect(stageRect.x, stageRect.y, stageRect.width, stageRect.height);

  const tally = emptyTally();
  const ops = visibleOps(current, tally);
  // ► **THIS TIMES THE ENQUEUE, NOT THE PAINT, AND THE PANEL USED TO CLAIM
  //   OTHERWISE.** It read `paint time 0.0 ms` beside `1698 operations
  //   painted`, which the 2026-09-14 handoff flagged as "not a credible number"
  //   — and it was right that the READOUT was wrong, though not about where.
  //   The arithmetic here is fine. What it measures is the wall time of the JS
  //   loop that hands commands to the 2-D context; the browser batches and
  //   defers the actual rasterisation, and `performance.now()` is deliberately
  //   coarsened, so a sub-tick answer is the EXPECTED result rather than a
  //   broken one. **A measurement that cannot be what its label says is worse
  //   than no measurement**, so the label is what changed: the panel now says
  //   what this stopwatch actually spans. Timing the real paint needs
  //   `requestAnimationFrame` around a composite, which is a different
  //   instrument and is not installed here.
  const started = performance.now();
  // ► **CLIPPED TO THE STAGE, for the reason recorded at `stageClipRectFor`:**
  //   a player rasterises out-of-stage content and MASKS it, measured four
  //   edges at a time against Ruffle, and this renderer was doing the first
  //   half only.
  //
  //   The clip closes before `outlineStage` and before `?probe=1`: the stage
  //   OUTLINE is a debug overlay drawn ON the boundary, and clipping it would
  //   shave half its stroke and make the instrument disagree with the picture
  //   it is there to explain.
  context.save();
  context.beginPath();
  context.rect(stageRect.x, stageRect.y, stageRect.width, stageRect.height);
  context.clip();
  // ► **THE GROUP ROSTER COMES OFF `current.screen`, NOT `current`.**
  //   `screenWithTextFor` returns the merged record and keeps `screenFor`'s
  //   own record whole underneath it; `filterGroups` lives there. If a future
  //   `screen.js` stops emitting it, `counts.available` reads 0 and the panel
  //   and the log both say so rather than showing a page with no filters on it.
  paintOps(ops, fit, current.placement ?? SCREEN_STAGE_PLACEMENT, tally,
    current.screen?.filterGroups ?? null);
  context.restore();
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
        `ops=${ops.length} painted=${tally.painted} paintMs=${lastPaintMs.toFixed(2)}`,
        // ► **THE PROBE IS THE ONLY WAY ANYONE VERIFIES THE COMPOSITING FROM A
        //   SCREENSHOT.** A blur is a soft edge and a soft edge is exactly what
        //   a JPEG artefact looks like, so the picture alone cannot say whether
        //   the offscreen pass ran. These lines say how many groups were
        //   composited, at what scale, with what pad, and how many operations
        //   went through them — and the colour histogram above moves with them:
        //   a blurred screen has strictly MORE distinct colours than a flat one.
        `filters: ${tally.filters.groupsComposited}/${tally.filters.available} group(s) composited, ` +
          `${tally.filters.composites} composite(s), ${tally.filters.offscreenPasses} offscreen pass(es)`,
        `filters: scale=${tally.filters.scale.toFixed(4)} padMax=${tally.filters.padMax}px ` +
          `limit=${tally.filters.padLimit}px clamped=${tally.filters.padClamped} ` +
          `ctx.filter=${tally.filters.canvasFilterWorks ? "honoured" : "IGNORED BY THIS BROWSER"}`,
        `filters: ops under a string ${tally.filters.opsUnderFilterString} shape + ` +
          `${tally.filters.glyphOpsUnderFilterString} glyph; still deferred ` +
          `${tally.filters.opsUnderColourMatrix} (colour matrix) and ` +
          `${tally.filters.opsUnderRefusedFilter} (refused)`,
        `filters: ${tally.filters.compositeMs.toFixed(2)} ms compositing of ` +
          `${tally.filters.walkMs.toFixed(2)} ms walking; tokens ` +
          `${tally.filters.filterTokens - tally.filters.filterTokensUnparsed}/${tally.filters.filterTokens} parsed`
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
  // Named for what the stopwatch in `draw()` actually spans — see the note
  // there. It is NOT the rasterisation, and calling it "paint time" is how
  // a credible-looking 0.0 ms got onto the panel beside 1698 operations.
  nodes.push(...row("ops enqueued in", `${lastPaintMs.toFixed(2)} ms`));

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

  // ► **THIS BLOCK USED TO BE ONE ROW, `filters not applied (ops)`, AND IT
  //   READ 9423 ACROSS THE 26 SCREENS WHILE MEANING FIVE DIFFERENT THINGS.**
  //   `screen.js` narrowed that key on 2026-09-15 and replaced the population
  //   with six honest numbers; this page then started COMPOSITING the groups,
  //   so there are now two invoices for the same question and they are printed
  //   side by side on purpose. The module's are labelled `screen.js`, this
  //   page's are labelled `this page`, and `crossCheck` compares the two that
  //   are genuinely the same question.
  nodes.push(heading("filters — what screen.js says"));
  if (a.opsUnderFilterGroup === undefined) {
    nodes.push(...row("THE GROUP ROSTER IS ABSENT", "screen.js", {
      tone: "bad",
      why: "this build of src/render/screen.js emits no opsUnderFilterGroup — nothing below can be cross-checked"
    }));
  }
  nodes.push(...row("filter groups", a.filterGroups ?? "?", { tone: (a.filterGroups ?? 0) > 0 ? "ok" : null }));
  nodes.push(...row("  reaching a SHAPE op", a.filterGroupsReachingOps ?? "?"));
  nodes.push(...row("  reaching nothing it emits", a.filterGroupsReachingNothing ?? "?", {
    tone: approximate(a.filterGroupsReachingNothing ?? 0),
    why: (a.filterGroupsReachingNothing ?? 0) > 0
      ? "screen.js emits no text, so a glow on a text field reaches no shape — see what THIS page found below"
      : null
  }));
  nodes.push(...row("shape ops under a filter group", a.opsUnderFilterGroup ?? "?", {
    tone: (a.opsUnderFilterGroup ?? 0) > 0 ? "ok" : null,
    why: (a.opsUnderFilterGroup ?? 0) > 0
      ? `${Math.round(((a.opsUnderFilterGroup ?? 0) / Math.max(1, screen.ops.length)) * 100)}% of this screen's shapes sit inside a filtered subtree`
      : null
  }));
  nodes.push(...row("  with a canvas filter", a.opsWithCanvasFilter ?? "?", { tone: (a.opsWithCanvasFilter ?? 0) > 0 ? "ok" : null }));
  nodes.push(...row("  awaiting a colour matrix", a.opsWithDeferredColourMatrix ?? "?", { tone: approximate(a.opsWithDeferredColourMatrix ?? 0) }));
  nodes.push(...row("  under a REFUSED filter", a.opsUnderRefusedFilter ?? "?", { tone: approximate(a.opsUnderRefusedFilter ?? 0) }));
  nodes.push(...row("filters not applied (ops)", a.filtersNotApplied, {
    tone: approximate(a.filtersNotApplied - (a.opsUnderNoOpFilterOnly ?? 0)),
    why: a.filtersNotApplied > 0
      ? `${a.opsUnderNoOpFilterOnly ?? "?"} of them are no-op filters the build draws nothing for either; the rest are a silent loss`
      : null
  }));

  nodes.push(heading("filters — what this page composited"));
  const f = lastTally.filters;
  if (!f.canvasFilterWorks) {
    nodes.push(...row("ctx.filter", "IGNORED", {
      tone: "bad",
      why: "this browser does not honour canvas filters — nothing below was drawn, whatever it counts"
    }));
  }
  if (!show.filters) {
    nodes.push(...row("compositing", "OFF", {
      tone: "hot",
      why: "?filters=0 — every operation drawn straight, exactly as this page did before 2026-09-15"
    }));
  }
  nodes.push(...row("groups composited offscreen", `${f.groupsComposited} / ${f.available}`, {
    tone: f.groupsComposited > 0 ? "ok" : "bad",
    why: f.groupsComposited > 0
      ? "one ctx.filter per GROUP, never per operation — see the header for the 1523-path reason"
      : "no group on this screen carries a filter string this renderer can build"
  }));
  nodes.push(...row("  reaching only GLYPH ops", f.groupsReachingOnlyGlyphs, {
    tone: f.groupsReachingOnlyGlyphs > 0 ? "ok" : null,
    why: f.groupsReachingOnlyGlyphs > 0
      ? "screen.js has to call these unreachable; they are glows on words and they are drawn here"
      : null
  }));
  nodes.push(...row("  no canvas filter string", f.groupsWithNoFilterString, {
    tone: approximate(f.groupsWithNoFilterString),
    why: f.groupsWithNoFilterString > 0
      ? "a colour matrix, a refusal or a measured no-op — nothing to set ctx.filter to"
      : null
  }));
  nodes.push(...row("  reaching nothing even here", f.groupsReachingNothingHere, { tone: approximate(f.groupsReachingNothingHere) }));
  nodes.push(...row("  NOT a contiguous run here", f.groupsNotContiguousHere, {
    tone: missing(f.groupsNotContiguousHere),
    why: f.groupsNotContiguousHere > 0
      ? `filtered once per run instead of once — ${f.runsReopened} extra pass(es)`
      : null
  }));
  nodes.push(...row("shape ops inside a group here", f.opsUnderAnyGroup, { tone: f.opsUnderAnyGroup > 0 ? "ok" : null }));
  nodes.push(...row("  shape ops with a canvas filter", f.opsUnderFilterString, { tone: f.opsUnderFilterString > 0 ? "ok" : null }));
  nodes.push(...row("GLYPH ops inside a group here", f.glyphOpsUnderAnyGroup, {
    tone: f.glyphOpsUnderAnyGroup > 0 ? "ok" : null,
    why: f.glyphOpsUnderAnyGroup > 0
      ? "screen.js counts none of these: it emits no text. They carry the same path and they composite."
      : null
  }));
  nodes.push(...row("  GLYPH ops with a canvas filter", f.glyphOpsUnderFilterString, { tone: f.glyphOpsUnderFilterString > 0 ? "ok" : null }));
  nodes.push(...row("filter scale (device px / stage px)", f.scale.toFixed(4), {
    why: "ctx.filter lengths are NOT scaled by setTransform, so the string is rebuilt at this factor every frame"
  }));
  // ► **THE ONE ROW A SCREENSHOT CAN FALSIFY THE SCALE WITH.** Every other
  //   number here would read exactly the same if `canvasFilterFor` were handed
  //   `scale: 1` — the buckets are scale-invariant by design, the counts are of
  //   operations, and a blur at a third of its width still looks like a blur.
  //   So the pack's scale-1 string and the string this frame actually set are
  //   printed together: their lengths must differ by the factor above, and if
  //   the two rows are identical at any scale but 1 the scale is not applied.
  if (f.widestFilterAtOne !== null) {
    nodes.push(...row("widest filter, as the pack states it", f.widestFilterAtOne, { tone: null }));
    nodes.push(...row("widest filter, as SET this frame", f.widestFilterAsSet, {
      tone: f.scale !== 1 && f.widestFilterAsSet === f.widestFilterAtOne ? "bad" : "ok",
      why: f.scale !== 1 && f.widestFilterAsSet === f.widestFilterAtOne
        ? "IDENTICAL at a scale that is not 1 — the scale is not reaching canvasFilterFor"
        : `every length above is ${f.scale.toFixed(4)}x the row before it`
    }));
  }
  nodes.push(...row("offscreen pad, max / limit", `${f.padMax} / ${f.padLimit} px`, {
    tone: f.padClamped > 0 ? "bad" : null,
    why: f.padClamped > 0
      ? `${f.padClamped} group(s) CLAMPED — their bleed is cut and will show as a hard edge`
      : "3 sigma for blur(), 1.5 x radius + offset for drop-shadow() — read off the scaled string"
  }));
  nodes.push(...row("offscreen passes", `${f.offscreenPasses} (${(f.offscreenPixels / 1e6).toFixed(1)} Mpx)`));
  nodes.push(...row("composited back", `${f.composites} / ${f.offscreenPasses}`, {
    tone: f.composites < f.offscreenPasses ? "bad" : null,
    why: f.composites < f.offscreenPasses
      ? "a group was rasterised to an offscreen and never drawn back — those operations are MISSING from the picture"
      : null
  }));
  nodes.push(...row("compositing time", `${f.compositeMs.toFixed(2)} of ${f.walkMs.toFixed(2)} ms`));
  nodes.push(...row("filter tokens parsed", `${f.filterTokens - f.filterTokensUnparsed} / ${f.filterTokens}`, {
    tone: f.filterTokensUnparsed > 0 ? "bad" : null,
    why: f.filterTokensUnparsed > 0
      ? "a filter function this page's bleed parser does not know — its bleed read as 0 and was CLIPPED"
      : null
  }));
  if (f.groupsStringVanishedAtScale > 0) {
    nodes.push(...row("STRING VANISHED AT SCALE", f.groupsStringVanishedAtScale, {
      tone: "bad",
      why: "canvasFilterFor built a string at scale 1 and none at this scale — its classification is meant to be scale-invariant"
    }));
  }
  if (f.opsArrivingPreMarked > 0) {
    nodes.push(...row("OPS ARRIVING PRE-MARKED", f.opsArrivingPreMarked, {
      tone: "bad",
      why: "an operation carries its own filter field — something upstream is stamping, and this page would apply it TWICE"
    }));
  }

  nodes.push(heading("filters still NOT applied, by name"));
  nodes.push(...row("groups awaiting a colour matrix", f.groupsWithColourMatrix, {
    tone: approximate(f.groupsWithColourMatrix),
    // ► **THIS ROW SAID "composited UNGRADED" AND THAT WAS FALSE.** A group
    //   with no canvas filter string is `continue`d past in `filterLayersFor`
    //   before any offscreen is opened, so it is NOT composited at all —
    //   "composited ungraded" describes a step that never runs. Corrected
    //   2026-09-15 after a verifier caught it and the main session re-derived
    //   the numbers. **A wrong description of a known gap is worse than no
    //   description: it tells the next reader the gap is smaller than it is.**
    why: f.groupsWithColourMatrix > 0
      ? "applyColourMatrix is not a ctx.filter, so these groups open NO offscreen and are not composited at all — see the row below for what that costs"
      : null
  }));
  // ► **THE COST, STATED WHERE THE GAP IS, because the group count alone reads
  //   as small.** 31 of the 248 groups carry only a colour matrix, and 8210 of
  //   the 13638 operations across the 26 screens — 60% — sit under one.
  //   **FIVE of those 31 have a DESCENDANT group that DOES composite**, so the
  //   picture they produce is exactly the "innermost wins" answer
  //   `src/render/screen.js`'s header argues is the wrong one: `townsquare`'s
  //   [59,1] colour grade over 1523 operations is dropped while its four nested
  //   blurs are drawn. Canvas has no arbitrary colour-matrix filter
  //   (`colourMatrixFilterString` refuses every one), so closing this needs
  //   either per-pixel `getImageData` over each group's offscreen or an inline
  //   SVG `filter` referenced by `url(#id)` — neither is installed here.
  nodes.push(...row("  groups whose DESCENDANT composites anyway", f.groupsMatrixOnlyWithFilteredDescendant, {
    tone: missing(f.groupsMatrixOnlyWithFilteredDescendant),
    why: f.groupsMatrixOnlyWithFilteredDescendant > 0
      ? "the inner filter lands and the outer grade does not — the innermost-wins picture screen.js argues against"
      : null
  }));
  nodes.push(...row("  ops awaiting a colour matrix", f.opsUnderColourMatrix, { tone: approximate(f.opsUnderColourMatrix) }));
  nodes.push(...row("groups with a REFUSED filter", f.groupsRefused, {
    tone: missing(f.groupsRefused),
    why: f.groupsRefused > 0 ? "an inner bevel or an inner glow — canvas has no inset filter at all" : null
  }));
  nodes.push(...row("  ops under a refused filter", f.opsUnderRefusedFilter, { tone: missing(f.opsUnderRefusedFilter) }));
  nodes.push(...row("groups that are ONLY no-ops", f.groupsNoOpOnly, {
    tone: null,
    why: f.groupsNoOpOnly > 0 ? "Blur(0,0) or a zero-strength glow — the build draws nothing for these either" : null
  }));

  nodes.push(heading("drawn, and not what the build shows"));
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
  crossCheckFilters(hidden);
}

/**
 * ► **THE SECOND PAIR OF TALLIES, AND THE ONLY TWO FIELDS OF THEM THAT ARE THE
 *   SAME QUESTION.** `screen.js` counts operations under a filter group by
 *   walking its own shape-only `ops` against `[opFirst, opEnd)` ranges; this
 *   page counts them by re-matching every group's `path` against the MERGED,
 *   toggled order it is about to paint. Two routes, two arrays, two matching
 *   rules — so restricting this page's count to SHAPE operations makes the
 *   populations identical and any difference a finding about one of the two.
 *
 *   Measured 2026-09-15 across all 26 screens with no toggle hiding anything:
 *   **0 disagreements on either field**, over values from 0 to 1527. The
 *   glyph operations are deliberately NOT in this comparison — there is no
 *   module number to compare them against, which is the whole finding — so
 *   they are logged beside it as their own sentence.
 */
let lastFilterCrossCheck = null;
function crossCheckFilters(hidden) {
  const f = lastTally.filters;
  const a = current.screen.approximations;
  if (!show.filters || !f.canvasFilterWorks) {
    const why = !show.filters ? "?filters=0" : "this browser ignores ctx.filter";
    const key = `${currentName}|off|${why}`;
    if (key === lastFilterCrossCheck) return;
    lastFilterCrossCheck = key;
    log(`filter cross-check skipped: compositing is off (${why}).`, { warn: true });
    return;
  }
  if (a.opsUnderFilterGroup === undefined) {
    log(`${currentName}: screen.js emits no filter-group counts — nothing to cross-check against.`, { bad: true });
    return;
  }
  const key = `${currentName}|${hidden}|${f.opsUnderAnyGroup}|${f.opsUnderFilterString}|${f.glyphOpsUnderFilterString}|${f.groupsComposited}`;
  if (key === lastFilterCrossCheck) return;
  lastFilterCrossCheck = key;
  if (hidden) {
    log(`filter cross-check skipped: a toggle is hiding ${lastTally.hiddenByToggle} operation(s).`);
  } else {
    const under = f.opsUnderAnyGroup === a.opsUnderFilterGroup;
    const string = f.opsUnderFilterString === a.opsWithCanvasFilter;
    if (under && string) {
      log(`${currentName}: ${f.opsUnderAnyGroup} shape op(s) under a group, ${f.opsUnderFilterString} with a string — screen.js agrees on both.`);
    } else {
      log(`${currentName}: DISAGREEMENT — this page matched ${f.opsUnderAnyGroup}/${f.opsUnderFilterString} shape op(s) by path, `
        + `screen.js counts ${a.opsUnderFilterGroup}/${a.opsWithCanvasFilter} by range. One of the two is wrong.`, { bad: true });
    }
  }
  if (f.glyphOpsUnderFilterString > 0) {
    log(`${currentName}: ${f.groupsComposited} group(s) composited offscreen, `
      + `${f.glyphOpsUnderFilterString} of the operations under them are GLYPHS — `
      + `screen.js counts those as reaching nothing, because it emits no text.`);
  }
  if (f.groupsWithColourMatrix > 0 || f.groupsRefused > 0) {
    log(`${currentName}: still not applied — ${f.opsUnderColourMatrix} op(s) awaiting a colour matrix, `
      + `${f.opsUnderRefusedFilter} under a refused filter.`, { warn: true });
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
