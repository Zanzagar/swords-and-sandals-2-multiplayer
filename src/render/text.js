/**
 * THE BUILD'S OWN TYPE, DRAWN — glyph outlines from `tools/extract-text.mjs`
 * laid out into the same draw operations a gladiator is made of.
 *
 * ## Why this module exists at all
 *
 * Nothing in this renderer drew text. `src/render/arena-backdrop.js` says of the
 * bottom UI bar that *"it carries live text this renderer draws itself"*, and
 * that sentence was false when it was written: the only `fillText` in
 * `tools/arena/main.js` is the fighter's name, in a system sans-serif. The bar's
 * own text — measured, two `DefineEditText` children of sprite 1531, ids 1527
 * (`soundvar`, "sound:ON") and 1528 ("tooltips:off"), both font 1526 at 10px
 * white — was dropped by `extract-props.mjs` as an unsupported character and
 * reported honestly as a failure. This module is the other half of that report.
 *
 * ## Same shape as `props.js` and `extracted-figure.js`, deliberately
 *
 * A pack is an ARGUMENT, never a table in this file. This repository ships no
 * SS2 asset, so a clone with no extraction gets `null` from every function here
 * and the caller falls back to its own authored art or its own `fillText`. Every
 * reader is TOTAL: a missing, truncated or hand-edited pack returns null or an
 * empty list and the arena stays playable.
 *
 * ## ⚠ UNITS. THREE OF THEM, AND THIS SEAM HAS COST THIS PROJECT THREE DEFECTS
 *
 * ```text
 *   pack glyph `path`   GLYPH UNITS, 20480 per em   (DefineFont3's own space)
 *   pack advances,      GLYPH UNITS
 *     ascent, descent,
 *     leading, kerning
 *   pack bounds,        TWIPS, 20 per pixel
 *     fontHeight,
 *     margins, static
 *     offsets/advances
 *   THIS MODULE'S API   PIXELS in, PIXELS out  (size, x, y, width, height)
 *   emitted op `d`      PIXELS
 *   emitted op `matrix` [a, b, c, d, tx, ty] with tx/ty in TWIPS
 * ```
 *
 * ► **THE EMITTED MATRIX TRANSLATION IS IN TWIPS AND THE PATH IS IN PIXELS**,
 *   which is exactly the convention `extract-props.mjs` writes and
 *   `paintArenaLayer` in `tools/arena/main.js` already consumes —
 *   `context.transform(m[0], m[1], m[2], m[3], m[4] / 20, m[5] / 20)`. So these
 *   ops can be fed to the arena's existing layer painter with no new code. A
 *   consumer that forgets the divide draws the text twenty times too far out,
 *   which is loud rather than silent, and that is the reason the convention is
 *   worth keeping rather than quietly switching to pixels here.
 *
 * ## Facts about this build's glyphs that the layout below depends on
 *
 * - **y is DOWN and the baseline is 0.** Arial's 'A' spans y -14660..0.
 * - **Contours wind opposite to their counters**, so a glyph fills correctly
 *   under `nonzero`: Mini 7's 'o' measures -36481600 and +90230400 in signed
 *   area. Every op from this module therefore sets `fillRule: "nonzero"`, unlike
 *   the shape packs, which use `evenodd`.
 * - **The build's own per-glyph bounds table is all zeros** — 913 of 913 — so
 *   the pack carries an `ink` box computed from the outline instead, and
 *   measurement here uses advances rather than bounds.
 * - **A static run's advances are BAKED and are not the font's.** Over the 4060
 *   resolvable entries, `fontAdvance * height / 20480` matches the baked advance
 *   within a twip on only 78% of them. `staticTextOpsFor` uses the baked ones.
 *
 * ## What it costs, measured on this machine rather than guessed
 *
 * ```text
 *   textOpsFor, a 30-character line at a 10px em   119 us   (25 operations)
 *   layoutText alone, same line                      7 us
 *   all 180 of the build's static runs redrawn     209 ms   (3554 operations)
 * ```
 *
 * ► **SO NINETY-FOUR PERCENT OF A DRAW IS `scaleGlyphPath` REBUILDING PATH
 *   STRINGS**, and about 134 such lines fit in a 16ms frame. That is ample for a
 *   UI bar and nowhere near enough to redraw a screen of body text every frame.
 *   There is deliberately no cache in here — this module is pure, and a
 *   module-level memo is a global that grows — so **a caller that redraws the
 *   same string every frame should hold onto the frozen array it gets back**.
 */

/** `DefineFont3`'s em square. Exported so a caller need not re-derive it. */
export const TEXT_UNITS_PER_EM = 20480;

/** The one conversion every consumer of an emitted matrix has to do. */
export const TWIPS_PER_PIXEL = 20;

/**
 * The two-pixel inset a Flash text field puts between its bounds and its text.
 *
 * ► **STATED AS AN ASSUMPTION RATHER THAN A MEASUREMENT.** It is the player's
 *   documented behaviour, it is not in any tag in the file, and nothing in this
 *   session ran the player to check it — the oracle is read-only here. It is an
 *   exported constant and an overridable option precisely so that whoever DOES
 *   compare against a screenshot can change one number instead of hunting for a
 *   2 buried in the arithmetic.
 */
export const FIELD_GUTTER_PX = 2;

/** A pack from `assets/text/text.json`, or null. Total, never throwing. */
export function textPackFrom(data) {
  if (!data || typeof data !== "object") return null;
  const { fonts, statics, fields, placements } = data;
  if (!fonts || typeof fonts !== "object") return null;
  return Object.freeze({
    unitsPerEm: Number.isFinite(data.unitsPerEm) ? data.unitsPerEm : TEXT_UNITS_PER_EM,
    fonts: Object.freeze(fonts),
    statics: Object.freeze(statics && typeof statics === "object" ? statics : {}),
    fields: Object.freeze(fields && typeof fields === "object" ? fields : {}),
    placements: Object.freeze(placements && typeof placements === "object" ? placements : {})
  });
}

/** Whether a pack holds a font with at least one glyph. */
export function hasExtractedText(pack) {
  if (!pack || !pack.fonts) return false;
  for (const font of Object.values(pack.fonts)) {
    if (Array.isArray(font?.glyphs) && font.glyphs.length > 0) return true;
  }
  return false;
}

/** Every font id in the pack, ascending, so a caller can pick without guessing. */
export function fontIdsIn(pack) {
  if (!pack || !pack.fonts) return [];
  return Object.keys(pack.fonts).map(Number).filter(Number.isFinite).sort((left, right) => left - right);
}

/**
 * One font, or null. The id may be a number or the string JSON gave it.
 *
 * ► **A FONT WITH AN EMPTY GLYPH TABLE ANSWERS NOTHING, so it is null here.**
 *   A truncated pack would otherwise lay out a whole sentence of `.notdef`
 *   boxes — every character honestly marked missing, and the caller robbed of
 *   the null that sends it back to its own authored art. One box among real
 *   letters is information; a line of them is a broken pack pretending to draw.
 */
export function fontFor(pack, fontId) {
  if (!pack || !pack.fonts || fontId === null || fontId === undefined) return null;
  const font = pack.fonts[fontId] ?? pack.fonts[String(fontId)];
  return font && Array.isArray(font.glyphs) && font.glyphs.length > 0 ? font : null;
}

/**
 * Every text character a given sprite PLACES, with the placement that puts it
 * there — which is how a caller finds the UI bar's own fields without this file
 * carrying a table of ids that would rot.
 *
 * Sprite 1531 is the arena's bottom bar; measured, it places exactly two.
 */
export function fieldsPlacedIn(pack, characterId) {
  if (!pack || !pack.placements) return [];
  const out = [];
  for (const [id, list] of Object.entries(pack.placements)) {
    for (const placement of Array.isArray(list) ? list : []) {
      if (placement?.owner !== characterId) continue;
      const numeric = Number(id);
      out.push(Object.freeze({
        id: numeric,
        kind: pack.fields?.[id] ? "field" : "static",
        depth: placement.depth,
        name: placement.name ?? null,
        frame: placement.frame,
        matrix: placement.matrix ?? null
      }));
    }
  }
  return Object.freeze(out.sort((left, right) => left.depth - right.depth));
}

/** A glyph's position in its font's table by character code, or -1. */
function glyphIndexFor(font, code) {
  const glyphs = font.glyphs;
  for (let index = 0; index < glyphs.length; index += 1) {
    if (glyphs[index].code === code) return index;
  }
  return -1;
}

/** The kerning between two character codes in glyph units; 0 when none. */
function kerningFor(font, leftCode, rightCode) {
  if (!Array.isArray(font.kerning)) return 0;
  for (const pair of font.kerning) {
    if (pair[0] === leftCode && pair[1] === rightCode) return pair[2];
  }
  return 0;
}

/**
 * ONE GLYPH OUTLINE, SCALED FROM GLYPH UNITS TO PIXELS.
 *
 * ► **A REGEXP OVER THE NUMBERS IS SAFE HERE AND WOULD NOT BE ON A GENERAL SVG
 *   PATH.** `parseGlyphShape` emits only `M`, `L`, `Q` and `Z`, and every number
 *   in that grammar is a coordinate — there are no arc flags, no exponents and
 *   no repeat counts, so there is nothing a blind numeric substitution could
 *   corrupt. `test/render-text.test.js` re-derives that over all 1027 glyphs in
 *   the real pack rather than trusting this paragraph.
 *
 * The separators are left exactly as they were, so a `-` that was acting as one
 * still is.
 */
export function scaleGlyphPath(path, scale) {
  if (typeof path !== "string" || path.length === 0) return "";
  return path.replace(/-?\d+(?:\.\d+)?/g, (number) => {
    const value = Number(number) * scale;
    if (!Number.isFinite(value)) return "0";
    const rounded = Math.round(value * 1000) / 1000;
    return String(rounded);
  });
}

/** The advance this font would give an unknown character, in glyph units. */
function fallbackAdvance(font) {
  const space = font.glyphs.find((glyph) => glyph.code === 32);
  if (space && Number.isFinite(space.advance)) return space.advance;
  return Math.round(TEXT_UNITS_PER_EM / 4);
}

/**
 * The line box for a font at a size, in pixels, and where the baseline sits.
 *
 * ► **A FONT WITH NO LAYOUT BLOCK CANNOT ANSWER THIS**, and font 1510 is one.
 *   Rather than substitute a zero — which would stack every line on the one
 *   before it — the size itself is used as the line height and the result says
 *   `approximated: "line-height-from-size"`. The caller is told; the arena still
 *   draws.
 */
export function lineMetricsFor(font, size) {
  const scale = size / TEXT_UNITS_PER_EM;
  if (!font || !font.hasLayout || !Number.isFinite(font.ascent) || !Number.isFinite(font.descent)) {
    return {
      ascent: size * 0.8,
      descent: size * 0.2,
      leading: 0,
      lineHeight: size,
      approximated: "line-height-from-size"
    };
  }
  const ascent = font.ascent * scale;
  const descent = font.descent * scale;
  const leading = (Number.isFinite(font.leading) ? font.leading : 0) * scale;
  return { ascent, descent, leading, lineHeight: ascent + descent + leading, approximated: null };
}

/** Split on the three line terminators a Flash field can carry. */
function splitLines(text, multiline) {
  const parts = String(text).split(/\r\n|\r|\n/);
  if (multiline || parts.length === 1) return { parts, collapsed: 0 };
  // A single-line field shows one line; the breaks become spaces rather than
  // vanishing, so the words do not run together where a break used to be.
  return { parts: [parts.join(" ")], collapsed: parts.length - 1 };
}

/**
 * LAY A STRING OUT — the measuring half, with every approximation counted.
 *
 * This is the honest primitive: `textOpsFor` is a thin drawing wrapper over it,
 * and a caller that needs to know what could not be drawn exactly asks here.
 *
 * `y` is the BASELINE of the first line, not its top — the same convention
 * `canvas`'s own `fillText` uses. `metrics.ascent` converts from a top edge.
 *
 * @param {object} pack   from `textPackFrom`
 * @param {object} options
 * @param {number} options.font       font id
 * @param {number} options.size       em size in PIXELS
 * @param {string} options.text
 * @param {number} [options.x]        pen origin, pixels
 * @param {number} [options.y]        first baseline, pixels
 * @param {string} [options.align]    left | center | right, within `maxWidth`
 * @param {number} [options.maxWidth] pixels; wraps when finite
 * @param {number} [options.lineHeight] pixels, overriding the font's own
 * @param {number} [options.tracking] extra pixels between glyphs
 * @param {boolean} [options.kerning] default true
 * @param {boolean} [options.multiline] default true
 * @param {boolean} [options.mask]    render every character as a bullet
 */
export function layoutText(pack, options = {}) {
  const font = fontFor(pack, options.font);
  if (!font) return null;

  const size = Number.isFinite(options.size) && options.size > 0 ? options.size : 12;
  const scale = size / TEXT_UNITS_PER_EM;
  const metrics = lineMetricsFor(font, size);
  const lineHeight = Number.isFinite(options.lineHeight) ? options.lineHeight : metrics.lineHeight;
  const tracking = Number.isFinite(options.tracking) ? options.tracking : 0;
  const useKerning = options.kerning !== false;
  const multiline = options.multiline !== false;
  const maxWidth = Number.isFinite(options.maxWidth) && options.maxWidth > 0 ? options.maxWidth : Infinity;
  // A FIRST-LINE indent, the way a `DefineEditText`'s layout block means it.
  // Every one of this build's 256 fields sets it to zero, so this arm is
  // exercised by `test/render-text.test.js` and by nothing else — said out loud
  // because untested code that looks tested is this project's house defect. It
  // is here rather than dropped because the pack CARRIES the number, and a
  // field whose indent quietly did nothing would be an uncounted approximation.
  const indent = Number.isFinite(options.indent) ? options.indent : 0;
  const originX = Number.isFinite(options.x) ? options.x : 0;
  const originY = Number.isFinite(options.y) ? options.y : 0;

  const byKind = {};
  const bump = (kind) => { byKind[kind] = (byKind[kind] ?? 0) + 1; };
  if (metrics.approximated) bump(metrics.approximated);

  const source = options.mask ? "•".repeat(String(options.text ?? "").length) : String(options.text ?? "");
  const split = splitLines(source, multiline);
  for (let index = 0; index < split.collapsed; index += 1) bump("newline-in-single-line-field");

  // Build every glyph of a paragraph first, then break it: wrapping needs the
  // advances, and computing them twice is how the two copies drift apart.
  const laidOut = [];
  for (const paragraph of split.parts) {
    const glyphs = [];
    let pen = 0;
    let previousCode = null;
    for (const character of paragraph) {
      const code = character.codePointAt(0);
      const index = glyphIndexFor(font, code);
      const glyph = index >= 0 ? font.glyphs[index] : null;
      let kern = 0;
      if (useKerning && previousCode !== null && glyph) kern = kerningFor(font, previousCode, code) * scale;
      pen += kern;
      const advanceUnits = glyph && Number.isFinite(glyph.advance) ? glyph.advance : fallbackAdvance(font);
      const advance = advanceUnits * scale + tracking;
      if (!glyph) {
        // ► **A MISSING GLYPH IS DRAWN AS A BOX AND COUNTED.** Emitting nothing
        //   would make "this character is not in the font" look identical to a
        //   space, which is the defect this whole programme is built around.
        bump("glyph-missing");
      } else if (glyph.approximated) {
        bump(glyph.approximated);
      }
      glyphs.push({
        code,
        char: character,
        index,
        x: pen,
        advance,
        kerning: kern,
        missing: !glyph,
        empty: Boolean(glyph?.empty)
      });
      pen += advance;
      previousCode = code;
    }
    laidOut.push({ glyphs, width: pen });
  }

  // Wrap. A word too long for the line is broken at the character rather than
  // allowed to run past the edge, because a field that overflows its own box is
  // how a UI bar starts drawing over the border.
  const lines = [];
  const firstOfParagraph = new Set();
  for (const paragraph of laidOut) {
    firstOfParagraph.add(lines.length);
    const firstLimit = maxWidth - indent;
    if (!Number.isFinite(maxWidth) || paragraph.width <= firstLimit || paragraph.glyphs.length === 0) {
      lines.push(paragraph.glyphs);
      continue;
    }
    let current = [];
    let lineStart = 0;
    let lastBreak = -1;
    const startedAt = lines.length;
    for (const glyph of paragraph.glyphs) {
      // ► **A LINE NEVER STARTS WITH THE SPACE THAT BROKE IT.** The first
      //   version of this loop carried the breaking space onto the next line,
      //   which produced a line holding one space, which the trim below then
      //   emptied — a blank line in the middle of a wrapped paragraph, from
      //   text that has none.
      if (current.length === 0) {
        if (glyph.char === " ") continue;
        lineStart = glyph.x;
      }
      const limit = lines.length === startedAt ? firstLimit : maxWidth;
      const wouldEnd = glyph.x - lineStart + glyph.advance;
      if (current.length > 0 && wouldEnd > limit) {
        // Break at the last space when there is one; otherwise mid-word, because
        // a word wider than the box has to go somewhere and running past the
        // edge is how a field starts drawing over the border beside it.
        const breakAt = lastBreak >= 0 ? lastBreak : current.length - 1;
        const carried = current.slice(breakAt + 1);
        lines.push(current.slice(0, breakAt + 1));
        current = carried;
        lastBreak = -1;
        if (current.length === 0) {
          if (glyph.char === " ") continue;
          lineStart = glyph.x;
        } else {
          lineStart = current[0].x;
        }
      }
      if (glyph.char === " ") lastBreak = current.length;
      current.push(glyph);
    }
    if (current.length > 0) lines.push(current);
  }

  // Trim a trailing space from a wrapped line so alignment does not count it,
  // and re-origin each line so `x` is measured from the line's own start.
  const placed = [];
  let widest = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const glyphs = [...lines[index]];
    while (glyphs.length > 0 && glyphs[glyphs.length - 1].char === " ") glyphs.pop();
    const start = glyphs.length > 0 ? glyphs[0].x : 0;
    const width = glyphs.length > 0
      ? glyphs[glyphs.length - 1].x + glyphs[glyphs.length - 1].advance - start
      : 0;
    widest = Math.max(widest, width);
    placed.push({
      glyphs: glyphs.map((glyph) => ({ ...glyph, x: glyph.x - start })),
      width,
      text: glyphs.map((glyph) => glyph.char).join(""),
      y: originY + index * lineHeight,
      indented: firstOfParagraph.has(index) && indent !== 0
    });
  }

  const box = Number.isFinite(maxWidth) ? maxWidth : widest;
  for (const line of placed) {
    // An indented line has that much less box to be aligned within, so a
    // centred first line stays centred in what is left of it.
    const inset = line.indented ? indent : 0;
    const slack = box - inset - line.width;
    if (options.align === "center") line.x = originX + inset + slack / 2;
    else if (options.align === "right") line.x = originX + inset + slack;
    else line.x = originX + inset;
  }

  return Object.freeze({
    font: font.id,
    size,
    scale,
    metrics: Object.freeze(metrics),
    lineHeight,
    lines: Object.freeze(placed.map((line) => Object.freeze({ ...line, glyphs: Object.freeze(line.glyphs) }))),
    width: widest,
    height: placed.length === 0 ? 0 : (placed.length - 1) * lineHeight + metrics.ascent + metrics.descent,
    missing: placed.reduce((sum, line) => sum + line.glyphs.filter((glyph) => glyph.missing).length, 0),
    approximated: Object.freeze({
      total: Object.values(byKind).reduce((sum, count) => sum + count, 0),
      byKind: Object.freeze(byKind)
    })
  });
}

/** A hollow box the size of a missing glyph, in pixels, at the pen origin. */
function notdefPath(width, ascent) {
  const inset = Math.max(0.5, width * 0.1);
  const left = inset;
  const right = Math.max(inset + 0.5, width - inset);
  const top = -ascent * 0.78;
  const bottom = 0;
  return `M${round3(left)} ${round3(top)}L${round3(right)} ${round3(top)}` +
    `L${round3(right)} ${round3(bottom)}L${round3(left)} ${round3(bottom)}Z`;
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

/**
 * Turn a finished layout into draw operations.
 *
 * `matrix`, when given, is composed on the OUTSIDE — it is the placement that
 * puts the field or the run into its parent's space, with its own translation
 * in twips, exactly as the pack stores it.
 */
function opsFromLayout(layout, font, { colour, alpha, matrix }) {
  const ops = [];
  const outer = Array.isArray(matrix) && matrix.length === 6 ? matrix : [1, 0, 0, 1, 0, 0];
  const [a, b, c, d, tx, ty] = outer;

  for (const line of layout.lines) {
    for (const glyph of line.glyphs) {
      const source = glyph.index >= 0 ? font.glyphs[glyph.index] : null;
      // A space has no outline and is not a defect: it advances and draws
      // nothing, which `empty` on the pack states outright.
      if (source && (source.empty || !source.path)) continue;

      const penX = line.x + glyph.x;
      const penY = line.y;
      // The pen is in PIXELS and an emitted matrix translation is in TWIPS.
      const localX = penX * TWIPS_PER_PIXEL;
      const localY = penY * TWIPS_PER_PIXEL;
      const composed = [
        a, b, c, d,
        round3(a * localX + c * localY + tx),
        round3(b * localX + d * localY + ty)
      ];

      if (!source) {
        ops.push(Object.freeze({
          kind: "path",
          d: notdefPath(glyph.advance, layout.metrics.ascent),
          matrix: Object.freeze(composed),
          fill: null,
          // `nonzero` everywhere in this module, for the reason in the header.
          fillRule: "nonzero",
          fillOpacity: 1,
          stroke: colour,
          strokeWidth: Math.max(0.4, layout.size / 16),
          strokeOpacity: alpha,
          glyph: Object.freeze({ font: font.id, index: -1, code: glyph.code, char: glyph.char }),
          // The tally travels ON the operation, so a surface that never calls
          // `layoutText` still cannot draw an approximation without one.
          approximated: "glyph-missing",
          notdef: true
        }));
        continue;
      }

      ops.push(Object.freeze({
        kind: "path",
        d: scaleGlyphPath(source.path, layout.scale),
        matrix: Object.freeze(composed),
        fill: colour,
        fillRule: "nonzero",
        fillOpacity: alpha,
        stroke: null,
        strokeWidth: 0,
        strokeOpacity: 1,
        glyph: Object.freeze({ font: font.id, index: glyph.index, code: glyph.code, char: glyph.char }),
        ...(source.approximated ? { approximated: source.approximated } : {})
      }));
    }
  }
  return ops;
}

/**
 * DRAW OPERATIONS FOR A STRING, or null when there is nothing to draw.
 *
 * The operation shape is the one `propOpsFor` and `paintExtractedFigure`
 * already emit, so a surface that can draw an arrow can draw a word with no new
 * code. See the header for the units; `d` is pixels and `matrix[4]`/`[5]` are
 * twips.
 *
 * Options are `layoutText`'s, plus `colour` (`#rrggbb`), `alpha` and an outer
 * `matrix`.
 */
export function textOpsFor(pack, options = {}) {
  const font = fontFor(pack, options.font);
  if (!font) return null;
  const layout = layoutText(pack, options);
  if (!layout) return null;
  const ops = opsFromLayout(layout, font, {
    colour: typeof options.colour === "string" ? options.colour : "#ffffff",
    alpha: Number.isFinite(options.alpha) ? options.alpha : 1,
    matrix: options.matrix
  });
  return ops.length > 0 ? Object.freeze(ops) : null;
}

/**
 * ONE OF THE BUILD'S 180 BAKED STATIC RUNS, drawn as the exporter laid it out.
 *
 * ► **THIS USES THE RUN'S OWN ADVANCES AND NEVER THE FONT'S.** Measured over
 *   the whole build, deriving an advance from the font reproduces the baked one
 *   within a twip only 78% of the time — the exporter baked kerning and
 *   letter-spacing in. A run redrawn from font metrics is subtly, unfixably
 *   wrong, and looks close enough to pass a glance.
 *
 * ► **A RECORD WITH NO `x` CONTINUES THE PREVIOUS PEN, and 26 of the build's
 *   206 records inherit their font the same way.** Treating a null offset as
 *   zero restarts every continuation run at the left edge.
 */
export function staticTextOpsFor(pack, id, options = {}) {
  if (!pack || !pack.statics) return null;
  const item = pack.statics[id] ?? pack.statics[String(id)];
  if (!item || !Array.isArray(item.records)) return null;

  const outer = Array.isArray(options.matrix) && options.matrix.length === 6
    ? options.matrix
    : (Array.isArray(item.matrix) && item.matrix.length === 6 ? item.matrix : [1, 0, 0, 1, 0, 0]);
  const [a, b, c, d, tx, ty] = outer;

  const ops = [];
  let penX = 0;
  let penY = 0;
  for (const record of item.records) {
    const font = fontFor(pack, record.font);
    // TWIPS: a record's offsets are in the static's own space, and null means
    // "carry on", not "go to zero".
    if (Number.isFinite(record.x)) penX = record.x;
    if (Number.isFinite(record.y)) penY = record.y;
    // Glyph units -> PIXELS. `height` is twips, so the 20 is the twips-per-pixel
    // conversion and the 20480 is the em. Doing only one of the two is the
    // mistake this line is spelled out to prevent.
    const scale = record.height / (TEXT_UNITS_PER_EM * TWIPS_PER_PIXEL);
    const colour = typeof options.colour === "string" ? options.colour : (record.colour ?? "#ffffff");
    const alpha = Number.isFinite(options.alpha) ? options.alpha : (Number.isFinite(record.alpha) ? record.alpha : 1);

    for (const entry of Array.isArray(record.glyphs) ? record.glyphs : []) {
      const [index, advance] = entry;
      const glyph = font && index >= 0 && index < font.glyphs.length ? font.glyphs[index] : null;
      const composed = [
        a, b, c, d,
        round3(a * penX + c * penY + tx),
        round3(b * penX + d * penY + ty)
      ];
      if (!glyph) {
        // An index the font cannot answer for. Drawn as a box and marked, for
        // the reason every other absence here is.
        ops.push(Object.freeze({
          kind: "path",
          d: notdefPath(advance / TWIPS_PER_PIXEL, record.height / TWIPS_PER_PIXEL * 0.8),
          matrix: Object.freeze(composed),
          fill: null,
          fillRule: "nonzero",
          fillOpacity: 1,
          stroke: colour,
          strokeWidth: Math.max(0.4, record.height / TWIPS_PER_PIXEL / 16),
          strokeOpacity: alpha,
          glyph: Object.freeze({ font: record.font, index, code: null, char: null }),
          approximated: "glyph-missing",
          notdef: true
        }));
      } else if (!glyph.empty && glyph.path) {
        ops.push(Object.freeze({
          kind: "path",
          d: scaleGlyphPath(glyph.path, scale),
          matrix: Object.freeze(composed),
          fill: colour,
          fillRule: "nonzero",
          fillOpacity: alpha,
          stroke: null,
          strokeWidth: 0,
          strokeOpacity: 1,
          glyph: Object.freeze({ font: record.font, index, code: glyph.code, char: glyph.char }),
          ...(glyph.approximated ? { approximated: glyph.approximated } : {})
        }));
      }
      // TWIPS, baked, already scaled to this record's height.
      penX += advance;
    }
  }
  return ops.length > 0 ? Object.freeze(ops) : null;
}

/**
 * THE LAYOUT OF ONE `DefineEditText`, resolved into `layoutText`'s own options.
 *
 * Separate from `fieldOpsFor` because it is the part worth reading in a test:
 * every number here comes out of the field's own tag and the arithmetic that
 * turns twips into pixels is in one place.
 */
export function fieldLayoutOptionsFor(pack, id, { text, gutter = FIELD_GUTTER_PX } = {}) {
  if (!pack || !pack.fields) return null;
  const field = pack.fields[id] ?? pack.fields[String(id)];
  if (!field || !field.bounds) return null;
  const font = fontFor(pack, field.font);
  if (!font) return null;

  const left = field.bounds.xMin / TWIPS_PER_PIXEL;
  const top = field.bounds.yMin / TWIPS_PER_PIXEL;
  const width = (field.bounds.xMax - field.bounds.xMin) / TWIPS_PER_PIXEL;
  const size = field.fontHeight / TWIPS_PER_PIXEL;
  const metrics = lineMetricsFor(font, size);
  const leftMargin = (field.leftMargin ?? 0) / TWIPS_PER_PIXEL;
  const rightMargin = (field.rightMargin ?? 0) / TWIPS_PER_PIXEL;
  const inner = Math.max(0, width - gutter * 2 - leftMargin - rightMargin);
  const value = text === undefined || text === null ? (field.text ?? "") : String(text);

  return {
    font: field.font,
    size,
    text: value,
    x: left + gutter + leftMargin,
    // The first baseline: the top of the box, in past the gutter, then down by
    // the font's ascent. Glyph y is negative above the baseline, so this is the
    // one place the sign matters.
    y: top + gutter + metrics.ascent,
    align: field.align ?? "left",
    maxWidth: field.wordWrap && field.multiline ? inner : Infinity,
    indent: (field.indent ?? 0) / TWIPS_PER_PIXEL,
    // The field's own leading is TWIPS and adds to the font's line box.
    lineHeight: metrics.lineHeight + (field.leading ?? 0) / TWIPS_PER_PIXEL,
    multiline: Boolean(field.multiline),
    mask: Boolean(field.password),
    colour: field.colour ?? "#ffffff",
    alpha: Number.isFinite(field.alpha) ? field.alpha : 1
  };
}

/**
 * ONE `DefineEditText`, drawn with a value — the arena's UI bar, cashed out.
 *
 * ► **THE OPS ARE IN THE FIELD'S OWN SPACE.** A field's bounds are stated in the
 *   coordinates of whatever places it, so the caller composes the placement —
 *   `fieldsPlacedIn(pack, 1531)` hands back exactly that matrix for the two the
 *   arena's bar carries. Pass it as `matrix` and the ops land where the build
 *   puts them.
 *
 * ► **AND AN HTML FIELD IS DRAWN AS PLAIN TEXT.** Five of the 256 carry real
 *   markup — `<font face size color letterSpacing>` — and none of it is applied
 *   here. The pack marks those fields `approximated: "html-markup-stripped"`,
 *   the tally counts them, and this call carries the same mark onto every
 *   operation so a surface cannot draw one without the note attached.
 */
export function fieldOpsFor(pack, id, options = {}) {
  const field = pack?.fields?.[id] ?? pack?.fields?.[String(id)];
  const resolved = fieldLayoutOptionsFor(pack, id, options);
  if (!resolved) return null;
  const font = fontFor(pack, resolved.font);
  const layout = layoutText(pack, resolved);
  if (!font || !layout) return null;

  const ops = opsFromLayout(layout, font, {
    colour: typeof options.colour === "string" ? options.colour : resolved.colour,
    alpha: Number.isFinite(options.alpha) ? options.alpha : resolved.alpha,
    matrix: options.matrix
  });
  if (ops.length === 0) return null;
  if (!field?.approximated) return Object.freeze(ops);
  return Object.freeze(ops.map((op) => Object.freeze({ ...op, approximated: op.approximated ?? field.approximated })));
}
