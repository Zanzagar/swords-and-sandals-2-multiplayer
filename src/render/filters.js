/**
 * WHAT THE BUILD DOES TO COLOUR — its colour transforms, its colour matrices,
 * its blend modes and its filters, as draw-time values a surface can use.
 *
 * `tools/swf-display-list.mjs` decodes all four and, until this file, **no
 * renderer read any of them.** That is not a cosmetic gap: the arena's
 * day/night sky IS a colour matrix that changes across the sprite's frames, so
 * a renderer that ignores filters draws one daytime sky and calls it the game.
 *
 * ## WHAT THIS BUILD ACTUALLY CONTAINS — measured, not assumed
 *
 * Every number below was counted on 2026-09-14 by walking EVERY tag in the
 * oracle (sha256 `77cb545c…`, 7,586,504 bytes, FWS), recursing into every
 * `DefineSprite`, and decoding every `PlaceObject3` with this repository's own
 * `parsePlaceObject`. 29,966 placement tags; 1,522 of them `PlaceObject3`.
 *
 * ```text
 *   FILTERS                1,894 on 1,507 placements (5 empty filter lists)
 *     glow           853   strength 10 x277, strength 0 x208, rest ~1.9-2.8
 *     colourMatrix   636   467 distinct, 12 of them the identity
 *     blur           320   126 of them Blur(0,0) — no-ops
 *     bevel           54   ALL 54 inner; canvas cannot express a bevel
 *     dropShadow      31   every one at angle pi/4; distance 4, 5, 8 or 32
 *     gradientGlow     0   }
 *     convolution      0   }  DO NOT OCCUR. No mapper is written for them.
 *     gradientBevel    0   }
 *
 *   BLEND MODES               12 placements carry one, and FOUR ids occur
 *     3  multiply      3     canvas "multiply"
 *     5  lighten       1     canvas "lighten"
 *     13 overlay       5     canvas "overlay"
 *     14 hardlight     3     canvas "hard-light"
 *
 *   COLOUR TRANSFORMS      3,413 placement TAGS carry a non-identity one
 * ```
 *
 * ► **EVERY BLEND MODE THIS BUILD USES IS EXACTLY EXPRESSIBLE IN CANVAS.** The
 *   refusal arms below for `layer`, `subtract`, `invert`, `alpha` and `erase`
 *   are therefore DEAD against this oracle and have never been exercised by it.
 *   They are kept because the mapper must be TOTAL — an unknown id silently
 *   becoming `source-over` is the silent-approximation defect — but they are a
 *   named refusal and a branch, never a nearest-match implementation.
 *
 * ► **NOT ONE of the 624 non-identity colour matrices is expressible as a CSS
 *   shorthand filter.** Checked against `brightness`, `invert`, `saturate` and
 *   `grayscale` with their Rec.709 coefficients: zero matches, because the
 *   build's own greyscale matrix uses Flash's `0.3086/0.6094/0.0820` and CSS
 *   uses `0.2126/0.7152/0.0722`. So `colourMatrixFilterString` detects the
 *   IDENTITY (12 occurrences, real) and refuses everything else BY NAME. A
 *   `saturate()` detector here would be budgeting for nothing, which is how
 *   the asset census found there were zero focal gradients.
 *
 * ## UNITS AT THIS SEAM, because this repository has lost three defects to them
 *
 * - Colour transform MULTIPLIERS are dimensionless; its OFFSETS are in 0..255
 *   colour space. `fillOpacity` in this renderer is 0..1, so the ALPHA OFFSET
 *   IS DIVIDED BY 255 and the three colour offsets are NOT.
 * - Colour matrix: four rows of five, row-major, `[r g b a offset]`. Channels
 *   are 0..255 and the fifth column is an offset in 0..255.
 * - Filter lengths — `blurX`, `blurY`, `distance` — are PIXELS, not twips.
 *   `parseFilterList` has already divided the 16.16 fixed point. Corroborated
 *   by magnitude rather than taken on trust: the sky's `cloud_patterns` blur is
 *   11 and its moon sweeps to 48, which are visible effects on a 550x400 stage
 *   and would be 0.55 and 2.4 pixels if they were twips.
 * - `scale` on `canvasFilterFor` exists because **`ctx.filter` lengths are NOT
 *   scaled by `ctx.setTransform`**, while everything else this renderer emits
 *   is. A caller drawing the stage at 2x must pass 2 or every blur is half the
 *   size it should be. ► **THIS IS A HYPOTHESIS about the browsers this runs
 *   in and it has NOT been measured here** — there is no browser on this route.
 *   It is a parameter rather than a constant precisely so that measuring it
 *   later changes a call site and not this file.
 *
 * ## The two CSS blur radii are NOT the same quantity
 *
 * ► **`blur(R)` takes R as a STANDARD DEVIATION; `drop-shadow(dx dy R c)`
 *   takes R as a BOX-SHADOW BLUR RADIUS, which is TWICE the standard
 *   deviation.** Passing sigma to both — the obvious move — draws every glow
 *   and shadow at half its width. The doubling is applied in one place below
 *   and pinned by a test.
 */

/** A colour transform that changes nothing, in this module's array spelling. */
export const IDENTITY_COLOUR_TRANSFORM = Object.freeze([1, 1, 1, 1, 0, 0, 0, 0]);

/**
 * The SWF `BlendMode` ids.
 *
 * ► **THIS TABLE IS THE SPECIFICATION'S, NOT A MEASUREMENT.** What was measured
 *   on the oracle is only WHICH IDS OCCUR — 3, 5, 13 and 14 — and nothing in
 *   the file states their names. A capture that shows the arena at a known
 *   frame would settle it; none has been taken, so the four names this build
 *   actually uses are as unverified as the eight it does not.
 */
export const SWF_BLEND_MODES = Object.freeze({
  0: "normal", 1: "normal", 2: "layer", 3: "multiply", 4: "screen",
  5: "lighten", 6: "darken", 7: "difference", 8: "add", 9: "subtract",
  10: "invert", 11: "alpha", 12: "erase", 13: "overlay", 14: "hardlight"
});

/**
 * A colour transform in the ONE shape the rest of this module uses:
 * `[redMul, greenMul, blueMul, alphaMul, redOff, greenOff, blueOff, alphaOff]`,
 * or `null` when there is nothing to apply.
 *
 * ► **TWO SHAPES ALREADY EXIST IN THIS TREE AND THIS ACCEPTS BOTH.**
 *   `tools/extract-figure.mjs` `packColour` writes the eight-number ARRAY and
 *   omits it entirely when identity; `tools/extract-props.mjs` writes
 *   `tools/swf-display-list.mjs`'s named OBJECT (`redMultiplier` …
 *   `alphaOffset`) and writes it ALWAYS, because `composeColourTransform`
 *   always returns one. A reader that took only one of those would silently
 *   drop every tint on the other pack, which is this project's standing defect
 *   wearing a new hat.
 */
export function colourTransformFrom(value) {
  if (!value) return null;
  if (Array.isArray(value)) {
    if (value.length !== 8) return null;
    const eight = value.map((part) => (Number.isFinite(part) ? part : 0));
    return isIdentityColourTransform(eight) ? null : Object.freeze(eight);
  }
  if (typeof value !== "object") return null;
  const number = (key, fallback) => (Number.isFinite(value[key]) ? value[key] : fallback);
  const eight = [
    number("redMultiplier", 1), number("greenMultiplier", 1),
    number("blueMultiplier", 1), number("alphaMultiplier", 1),
    number("redOffset", 0), number("greenOffset", 0),
    number("blueOffset", 0), number("alphaOffset", 0)
  ];
  // Identity collapses to `null` so a caller can branch on presence alone. The
  // props pack stamps an identity transform on EVERY placement, so without this
  // the "does this placement carry a tint" question answers yes 100% of the
  // time and stops meaning anything.
  return isIdentityColourTransform(eight) ? null : Object.freeze(eight);
}

/** Whether eight normalised numbers would change nothing. */
export function isIdentityColourTransform(eight) {
  if (!Array.isArray(eight) || eight.length !== 8) return false;
  for (let index = 0; index < 4; index += 1) if (eight[index] !== 1) return false;
  for (let index = 4; index < 8; index += 1) if (eight[index] !== 0) return false;
  return true;
}

/** `channel * multiplier + offset`, clamped to 0..255 and rounded. */
function channelOf(raw, multiplier, offset) {
  return Math.max(0, Math.min(255, Math.floor(raw * multiplier) + offset));
}

/** Two lower-case hex digits, so `#0a0b0c` never comes back as `#a b c`. */
function hex2(value) {
  return value.toString(16).padStart(2, "0");
}

/**
 * `#rrggbb` as three 0..255 channels, or `null` when it is not that.
 *
 * ► **STRICTLY SEVEN CHARACTERS, and the version this replaces was not.**
 *   `extracted-figure.js`'s private `tint` tests only `hex[0] === "#"` and then
 *   `parseInt(hex.slice(1), 16)`, so `#abc` parses as 0x000abc and comes back a
 *   completely different colour with no trace that anything happened.
 *   `tools/swf-shapes.mjs` zero-pads every channel and so never emits a short
 *   form — which is why nobody has been bitten — but "the producer happens not
 *   to do that" is not a reason for a reader to be wrong if it ever does.
 */
function parseHexColour(hex) {
  if (typeof hex !== "string" || hex.length !== 7 || hex[0] !== "#") return null;
  let value = 0;
  for (let index = 1; index < 7; index += 1) {
    const code = hex.charCodeAt(index);
    const digit = code >= 48 && code <= 57 ? code - 48
      : code >= 97 && code <= 102 ? code - 87
      : code >= 65 && code <= 70 ? code - 55
      : -1;
    if (digit < 0) return null;
    value = value * 16 + digit;
  }
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/**
 * A SWF colour transform applied to ONE FILL — the shared version of the
 * `tint` that `src/render/extracted-figure.js` keeps privately.
 *
 * Returns the input unchanged for `"none"`, for a gradient or bitmap sentinel,
 * and for anything that is not `#rrggbb`. Use `colourTransformApplies` when you
 * need to KNOW whether it landed rather than assume it did.
 */
/**
 * ► **FLOOR, NOT ROUND, AND THE BYTES SETTLE IT.** Three modules grew their own
 *   copy of this arithmetic tonight and two of them rounded. Measured on the
 *   real pack, **69 of the 1023 hex fills that sit under a colour transform
 *   come out one unit apart** — `#ffffff` at multiplier 0.30078125 is `#4c4c70`
 *   floored and `#4d4d71` rounded.
 *
 *   It is not a matter of taste. `readColourTransform` reads the multiply term
 *   as `readSB(bits) / 256`, so it is SIGNED 8.8 FIXED POINT, and the player
 *   computes `(channel * multTerm) >> 8` — an ARITHMETIC SHIFT, which is
 *   `floor`. Rounding is a plus-or-minus one error on every pixel it touches,
 *   and `Math.trunc` differs from `floor` the moment a multiplier is negative,
 *   which the signed field permits.
 *
 *   Found by the screens agent noticing its own result disagreed with this
 *   file's; the incumbent in `extracted-figure.js` had rounded since tinting
 *   landed and now delegates here.
 *
 * ► **ONE CAVEAT, NAMED RATHER THAN CHASED.** `composeColourTransform`
 *   MULTIPLIES two 8.8 multipliers into one float; the player applies each
 *   transform in turn, shifting each time. Flooring once at the end is not
 *   bit-identical to flooring twice. The difference is sub-unit and no case in
 *   this build nests two non-identity transforms on one fill, so it is recorded
 *   here rather than modelled.
 */
export function applyColourTransform(fill, transform) {
  const eight = Array.isArray(transform) ? transform : colourTransformFrom(transform);
  if (!eight) return fill;
  const rgb = parseHexColour(fill);
  if (!rgb) return fill;
  return `#${hex2(channelOf(rgb[0], eight[0], eight[4]))}` +
    `${hex2(channelOf(rgb[1], eight[1], eight[5]))}` +
    `${hex2(channelOf(rgb[2], eight[2], eight[6]))}`;
}

/**
 * Whether `applyColourTransform` would actually change this fill — so a caller
 * counting approximations can tell "no tint" from "a tint I could not apply".
 *
 * A tint on a `none`, gradient or bitmap fill is the SECOND kind, and it is the
 * exact shape of the defect that left the arena walls invisible: the data was
 * there, nobody could use it, and nothing said so.
 */
export function colourTransformApplies(fill, transform) {
  const eight = Array.isArray(transform) ? transform : colourTransformFrom(transform);
  if (!eight) return false;
  return parseHexColour(fill) !== null;
}

/**
 * The alpha half of the same transform: `alpha * alphaMultiplier + alphaOffset`.
 *
 * ► **THE OFFSET IS DIVIDED BY 255 AND THE MULTIPLIER IS NOT.** `alpha` here is
 *   this renderer's 0..1 opacity; the wire's offset is in 0..255 colour space.
 *   Mixing the two is the same class of error as mixing twips and pixels, and
 *   this file's header names both.
 */
export function applyColourTransformAlpha(alpha, transform) {
  const eight = Array.isArray(transform) ? transform : colourTransformFrom(transform);
  const base = Number.isFinite(alpha) ? alpha : 1;
  if (!eight) return base;
  return Math.max(0, Math.min(1, base * eight[3] + eight[7] / 255));
}

/** Twenty finite numbers, or `null`. The wire's own row-major 4x5 order. */
export function colourMatrixFrom(value) {
  const matrix = Array.isArray(value) ? value : value?.matrix;
  if (!Array.isArray(matrix) || matrix.length !== 20) return null;
  for (const cell of matrix) if (!Number.isFinite(cell)) return null;
  return Object.freeze([...matrix]);
}

const IDENTITY_MATRIX_CELLS = Object.freeze([
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0
]);

/** Whether a 20-cell matrix is the identity, within float tolerance. */
export function isIdentityColourMatrix(matrix, tolerance = 1e-6) {
  const cells = colourMatrixFrom(matrix);
  if (!cells) return false;
  return cells.every((cell, index) => Math.abs(cell - IDENTITY_MATRIX_CELLS[index]) <= tolerance);
}

/**
 * Whether applying this matrix PER FILL is the same picture as applying it to
 * the rasterised group, which is where the filter really lives.
 *
 * The algebra: a colour matrix is affine, `M(c) = A·c + o`, and alpha-over is a
 * CONVEX combination — its two weights sum to 1 — so `M(blend(c1, c2))` equals
 * `blend(M(c1), M(c2))` exactly. Per-fill application is therefore EXACT for
 * overlapping content as well, with ONE exception that this predicate is
 * entirely about:
 *
 * ► **THE EMPTY AREA OF THE CLIP IS ALSO A PIXEL.** A real filter runs over
 *   `(0,0,0,0)` too, and if the matrix's alpha row is anything but
 *   `(0, 0, 0, 1, 0)` the transparent region acquires alpha — the filter paints
 *   the clip's whole bounding box. Nothing that draws per-fill can express
 *   that, so such a matrix is an APPROXIMATION and must be counted as one.
 *
 * Measured on the oracle: **all 636 of its colour matrices have the plain alpha
 * row, and in none of them does the alpha COLUMN feed the three colour rows**,
 * so per-fill application is exact for every one of them. That is a fact about
 * this build, not about the format, which is why it is a predicate and not an
 * assumption baked into the applier.
 */
export function colourMatrixIsFillExact(matrix, tolerance = 1e-6) {
  const cells = colourMatrixFrom(matrix);
  if (!cells) return false;
  const near = (cell, want) => Math.abs(cell - want) <= tolerance;
  return near(cells[15], 0) && near(cells[16], 0) && near(cells[17], 0) &&
    near(cells[18], 1) && near(cells[19], 0);
}

/**
 * A colour matrix applied to one fill and its opacity.
 *
 * Returns `{ fill, fillOpacity, applied, approximated }`. `applied` is false
 * when the fill is not a solid colour — a gradient, a bitmap, `"none"` — in
 * which case the fill and opacity come back untouched and the caller has been
 * TOLD, rather than handed a silently unfiltered shape.
 *
 * @param {string} fill      `#rrggbb`, or any sentinel this cannot transform
 * @param {number[]} matrix  twenty cells, row-major
 * @param {number} alpha     0..1 opacity going in
 */
export function applyColourMatrix(fill, matrix, alpha = 1) {
  const cells = colourMatrixFrom(matrix);
  const base = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
  if (!cells) return Object.freeze({ fill, fillOpacity: base, applied: false, approximated: null });
  const rgb = parseHexColour(fill);
  if (!rgb) {
    return Object.freeze({
      fill, fillOpacity: base, applied: false,
      // NAMED, because "a colour matrix on a bitmap fill" and "no colour
      // matrix" are different facts and a tally that merges them is the lie
      // this whole programme is built to refuse.
      approximated: "colourMatrixOnNonSolidFill"
    });
  }
  const [red, green, blue] = rgb;
  const alpha255 = base * 255;
  const row = (offset) => Math.max(0, Math.min(255,
    cells[offset] * red + cells[offset + 1] * green +
    cells[offset + 2] * blue + cells[offset + 3] * alpha255 + cells[offset + 4]));
  const out = [Math.round(row(0)), Math.round(row(5)), Math.round(row(10))];
  return Object.freeze({
    fill: `#${hex2(out[0])}${hex2(out[1])}${hex2(out[2])}`,
    fillOpacity: row(15) / 255,
    applied: true,
    approximated: colourMatrixIsFillExact(cells) ? null : "colourMatrixAlphaRow"
  });
}

/**
 * The canvas filter string for a colour matrix — and for this build there is
 * never one.
 *
 * CSS filters offer no arbitrary colour matrix at all; `filter: url(#id)`
 * reaching an SVG `feColorMatrix` is the only route and it needs a DOM, which
 * this layer does not have and must not acquire. See the header for the census
 * that says a `saturate`/`grayscale` detector here would match nothing.
 */
export function colourMatrixFilterString(matrix) {
  const cells = colourMatrixFrom(matrix);
  if (!cells) return Object.freeze({ filter: null, refused: "notAColourMatrix" });
  if (isIdentityColourMatrix(cells)) return Object.freeze({ filter: null, refused: null });
  return Object.freeze({ filter: null, refused: "colourMatrixHasNoCanvasFilter" });
}

/**
 * One SWF blend mode as a canvas `globalCompositeOperation`.
 *
 * Returns `{ id, name, composite, exact, refused, nearest }`. A refusal carries
 * `composite: null` AND, where one exists, the `nearest` operation it declined
 * to substitute — so a caller that decides to take the near miss does it
 * KNOWINGLY and can count it, which is the whole difference between this and a
 * silent nearest-match.
 */
export function blendModeFor(id) {
  if (id === null || id === undefined) {
    return Object.freeze({ id: null, name: "normal", composite: "source-over", exact: true, refused: null, nearest: null });
  }
  const name = SWF_BLEND_MODES[id];
  if (name === undefined) {
    return Object.freeze({ id, name: null, composite: null, exact: false, refused: "unknownBlendMode", nearest: null });
  }
  const exact = (composite) => Object.freeze({ id, name, composite, exact: true, refused: null, nearest: null });
  const refuse = (reason, nearest = null) =>
    Object.freeze({ id, name, composite: null, exact: false, refused: reason, nearest });
  switch (name) {
    case "normal": return exact("source-over");
    case "multiply": return exact("multiply");
    case "screen": return exact("screen");
    case "lighten": return exact("lighten");
    case "darken": return exact("darken");
    case "difference": return exact("difference");
    case "overlay": return exact("overlay");
    case "hardlight": return exact("hard-light");
    // Canvas `lighter` is plus-lighter, which is what Flash ADD does; the two
    // agree and only the NAME differs.
    case "add": return exact("lighter");
    // `layer` is not a blend at all — it is an instruction to composite the
    // clip as a group first. Canvas has no such mode; the equivalent is drawing
    // the clip to its own surface, which is a CALLER's decision about buffers,
    // not something a string can carry.
    case "layer": return refuse("blendModeNeedsAGroupBuffer");
    case "alpha": return refuse("blendModeNeedsAGroupBuffer", "destination-in");
    case "erase": return refuse("blendModeNeedsAGroupBuffer", "destination-out");
    case "subtract": return refuse("blendModeHasNoCanvasEquivalent");
    case "invert": return refuse("blendModeHasNoCanvasEquivalent");
    default: return refuse("blendModeHasNoCanvasEquivalent");
  }
}

/**
 * The Gaussian standard deviation equivalent to `passes` box blurs of width
 * `width`, which is what a SWF blur actually is.
 *
 * `n` box blurs of width `d` have variance `n * (d^2 - 1) / 12`, and a Gaussian
 * of equal variance has that square root as its sigma. This is the standard
 * box/Gaussian bridge and it is an APPROXIMATION — the two kernels have the
 * same second moment and different shapes — so every caller below marks it.
 */
export function blurSigma(width, passes = 1) {
  const d = Number.isFinite(width) ? Math.max(0, width) : 0;
  const n = Number.isFinite(passes) && passes >= 1 ? Math.trunc(passes) : 1;
  return Math.sqrt(n * Math.max(0, d * d - 1) / 12);
}

/** At most four decimals, with no trailing zeros, so `11` is not `11.0000`. */
function length(value) {
  const rounded = Math.round(value * 10000) / 10000;
  return `${rounded}`;
}

function rgbaOf(colour, alpha) {
  const clamped = Math.max(0, Math.min(1, alpha));
  return `rgba(${colour.red | 0}, ${colour.green | 0}, ${colour.blue | 0}, ${Math.round(clamped * 10000) / 10000})`;
}

/**
 * A FILTERLIST as a canvas `ctx.filter` string, with everything it could not
 * express reported by name.
 *
 * ```text
 *   { filter, applied, deferred, noOps, refused, colourMatrices, counts }
 * ```
 *
 * The four buckets are deliberately NOT one list, because they are four
 * different facts and a manifest that merges them cannot be read:
 *
 * - `applied`  went into the string. `exact: false` means it went in as an
 *              approximation and `approximated` names which one.
 * - `deferred` this module CAN apply it, just not as a filter string — only
 *              colour matrices, which go to `applyColourMatrix` instead. They
 *              are also handed back whole in `colourMatrices`.
 * - `noOps`    MEASURED to draw nothing: `Blur(0,0)` (126 in the build) and a
 *              glow or shadow at `strength: 0` (208 glows). Emitting
 *              `blur(0px)` for these would be honest and wasteful — it forces a
 *              filtered compositing path for no pixels — so they are dropped
 *              AND counted, which is the only version of dropping allowed here.
 * - `refused`  cannot be expressed. `bevel` is the only one that occurs in this
 *              build and it occurs 54 times.
 *
 * @param {object[]} filters  records from `parseFilterList`
 * @param {object} options
 * @param {number} options.scale  stage-to-canvas scale; see the header for why
 *                                this is not 1 and not measured.
 */
export function canvasFilterFor(filters, { scale = 1 } = {}) {
  const applied = [];
  const deferred = [];
  const noOps = [];
  const refused = [];
  const colourMatrices = [];
  const parts = [];
  const factor = Number.isFinite(scale) && scale > 0 ? scale : 1;

  for (const filter of Array.isArray(filters) ? filters : []) {
    const type = filter?.type;
    if (type === "blur") {
      const sigma = (blurSigma(filter.blurX, filter.passes) + blurSigma(filter.blurY, filter.passes)) / 2;
      if (sigma <= 0) {
        noOps.push(Object.freeze({ type, reason: "zeroRadius" }));
        continue;
      }
      parts.push(`blur(${length(sigma * factor)}px)`);
      applied.push(Object.freeze({
        type,
        exact: false,
        // CSS blur is ISOTROPIC, so a blur whose two radii differ loses the
        // difference. Measured: 2 of the build's filters are anisotropic, so
        // this is rare and real rather than theoretical.
        approximated: filter.blurX === filter.blurY ? "boxBlurAsGaussian" : "anisotropicBlur"
      }));
      continue;
    }
    if (type === "glow" || type === "dropShadow") {
      if (filter.inner) {
        // CSS `drop-shadow()` has no inset form. 3 inner glows and, counted
        // separately below, 54 inner bevels — the build really does use them.
        refused.push(Object.freeze({ type, reason: "innerShadowHasNoCanvasFilter", nearest: null }));
        continue;
      }
      if (filter.knockout || filter.compositeSource === false) {
        refused.push(Object.freeze({ type, reason: "knockoutHidesTheSource", nearest: null }));
        continue;
      }
      const strength = Number.isFinite(filter.strength) ? filter.strength : 1;
      const sigma = (blurSigma(filter.blurX, filter.passes) + blurSigma(filter.blurY, filter.passes)) / 2;
      const colour = filter.colour ?? { red: 0, green: 0, blue: 0, alpha: 255 };
      const alpha = (Number.isFinite(colour.alpha) ? colour.alpha : 255) / 255 * strength;
      if (alpha <= 0) {
        noOps.push(Object.freeze({ type, reason: "zeroStrength" }));
        continue;
      }
      const angle = Number.isFinite(filter.angle) ? filter.angle : 0;
      const distance = Number.isFinite(filter.distance) ? filter.distance : 0;
      parts.push(
        `drop-shadow(${length(Math.cos(angle) * distance * factor)}px ` +
        `${length(Math.sin(angle) * distance * factor)}px ` +
        // ► **TWICE SIGMA.** `drop-shadow`'s third length is a box-shadow blur
        //   radius, which the filter spec defines as 2x the standard deviation
        //   `blur()` takes. Handing sigma to both draws this at half width.
        `${length(2 * sigma * factor)}px ${rgbaOf(colour, alpha)})`
      );
      applied.push(Object.freeze({
        type,
        exact: false,
        // Flash's `strength` re-multiplies the filtered alpha and clamps; here
        // it can only scale the shadow colour's alpha. Measured: 277 glows at
        // strength 10, which saturate to opaque, and every one of the 31
        // shadows is below 1.
        approximated: strength === 1 ? "boxBlurAsGaussian" : "shadowStrengthAsAlpha"
      }));
      continue;
    }
    if (type === "colourMatrix") {
      const cells = colourMatrixFrom(filter);
      if (!cells) {
        refused.push(Object.freeze({ type, reason: "malformedColourMatrix", nearest: null }));
        continue;
      }
      if (isIdentityColourMatrix(cells)) {
        noOps.push(Object.freeze({ type, reason: "identityMatrix" }));
        continue;
      }
      colourMatrices.push(cells);
      deferred.push(Object.freeze({ type, reason: "applyColourMatrixToTheFill" }));
      continue;
    }
    if (type === undefined || type === null) {
      refused.push(Object.freeze({ type: null, reason: "notAFilterRecord", nearest: null }));
      continue;
    }
    // bevel, gradientGlow, convolution, gradientBevel. Only `bevel` occurs in
    // this build (54, all inner). NO MAPPER IS WRITTEN for the other three:
    // they occur ZERO times, and a mapper for a case the build does not contain
    // is the "zero focal gradients" mistake with different nouns.
    refused.push(Object.freeze({ type, reason: "filterHasNoCanvasEquivalent", nearest: null }));
  }

  const approximated = applied.filter((entry) => entry.exact === false).length;
  return Object.freeze({
    filter: parts.length > 0 ? parts.join(" ") : null,
    applied: Object.freeze(applied),
    deferred: Object.freeze(deferred),
    noOps: Object.freeze(noOps),
    refused: Object.freeze(refused),
    colourMatrices: Object.freeze(colourMatrices),
    counts: Object.freeze({
      total: applied.length + deferred.length + noOps.length + refused.length,
      applied: applied.length,
      deferred: deferred.length,
      noOp: noOps.length,
      refused: refused.length,
      approximated
    })
  });
}

/**
 * Many `canvasFilterFor` results added up, for the line a HUMAN reads.
 *
 * `test/extraction-honesty.test.js` recomputes a manifest's tallies from that
 * pack's own data, so the totals a manifest prints have to come from the same
 * records the renderer used — not from a second, hand-kept counter that can
 * drift away from it while both stay green.
 */
export function summariseFilterUse(results) {
  const totals = { total: 0, applied: 0, deferred: 0, noOp: 0, refused: 0, approximated: 0 };
  const refusedByReason = {};
  const approximatedByKind = {};
  for (const result of Array.isArray(results) ? results : []) {
    if (!result || !result.counts) continue;
    for (const key of Object.keys(totals)) totals[key] += result.counts[key] ?? 0;
    for (const entry of result.refused ?? []) {
      const key = `${entry.type ?? "unknown"}:${entry.reason}`;
      refusedByReason[key] = (refusedByReason[key] ?? 0) + 1;
    }
    for (const entry of result.applied ?? []) {
      if (!entry.approximated) continue;
      approximatedByKind[entry.approximated] = (approximatedByKind[entry.approximated] ?? 0) + 1;
    }
  }
  return Object.freeze({ ...totals, refusedByReason, approximatedByKind });
}
