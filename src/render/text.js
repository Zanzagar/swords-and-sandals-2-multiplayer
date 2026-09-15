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
 * - **A field ALIGNS in its own box and WRAPS only if it says it does**, and
 *   those are two different widths. One `maxWidth` used to carry both, which
 *   left 108 of the 256 fields centred or right-aligned in a box exactly as
 *   wide as their own text — i.e. left-aligned. See `alignWidth` in
 *   `layoutText` and the note beside it in `fieldLayoutOptionsFor`.
 * - **An operation's `approximated` is a LIST of reasons, or absent.** It was
 *   one string, and one string cannot hold two reasons: see `marksOf`.
 *   ► **AND THE REST OF THE TREE STILL EMITS A STRING**, so the two shapes sit
 *     in one array the moment `screen-text.js` merges shapes with words — 209
 *     strings to 65 lists over the 26 screens today. Read the key with
 *     `approximationMarksOf` and never with a `typeof`; the count is there.
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
 * @param {string} [options.align]    left | center | right, within the box
 * @param {number} [options.maxWidth] pixels; wraps when finite
 * @param {number} [options.alignWidth] pixels; the box alignment measures
 *        against, when that is not the wrap width. See the note at `box` below.
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
  // ► **WRAPPING AND ALIGNING ARE TWO JOBS AND `maxWidth` USED TO DO BOTH**,
  //   which made alignment a no-op for every field that does not wrap. See the
  //   note at `box` below for the 108 fields it cost. `alignWidth` is the box
  //   alignment measures against; `null` means "use the wrap width, or the
  //   widest line when there is none", which is what this always did.
  const alignWidth = Number.isFinite(options.alignWidth) && options.alignWidth > 0 ? options.alignWidth : null;
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

  // ► **THE ALIGNMENT BOX, WHICH IS NOT ALWAYS THE WRAP WIDTH — AND WAS, FOR
  //   108 OF THE BUILD'S 256 EDIT FIELDS.** This line used to read
  //   `Number.isFinite(maxWidth) ? maxWidth : widest`, and `fieldLayoutOptionsFor`
  //   passes `maxWidth: Infinity` for a field that does not wrap. `widest` is
  //   then the longest line's OWN width, the slack is zero, and `center` and
  //   `right` both land exactly where `left` does.
  //
  //   ► **THE CENSUS IN FULL, BECAUSE THE SHORT FORM OF IT IS ALREADY WRONG IN
  //     A HANDOFF.** Re-derived from `assets/text/text.json` on 2026-09-14:
  //
  // ```text
  //     256 fields      125 left       101 center       30 right
  //     centre or right                     131
  //     of those 131, NOT (wordWrap && multiline)   108   (81 centre, 27 right)
  // ```
  //
  //     The 108 is a subset of the 131, and the 131 is the number the summary
  //     this fix was briefed from dropped — it read "108 of 256 — 101 centre,
  //     30 right", which invites the reader to check 101 + 30 against 108 and
  //     conclude the whole census is garbled. It is not; the intermediate went
  //     missing. Stated here in full so the wrong form cannot be copied back in
  //     from a handoff, and pinned by `EVERY CENTRED AND RIGHT-ALIGNED FIELD IN
  //     THE BUILD NOW SPENDS ITS SLACK` in `test/render-text.test.js`, which
  //     asserts all six of these numbers against the pack rather than quoting
  //     them.
  //   Visible on `createchar`, where each stat number drew on top of its label.
  //   Wrapping genuinely needs `wordWrap && multiline`; aligning only needs a
  //   box, and every field has one.
  const box = alignWidth ?? (Number.isFinite(maxWidth) ? maxWidth : widest);
  let overflowing = 0;
  for (const line of placed) {
    // An indented line has that much less box to be aligned within, so a
    // centred first line stays centred in what is left of it.
    const inset = line.indented ? indent : 0;
    const slack = box - inset - line.width;
    // ► **A LINE WIDER THAN ITS BOX GETS NEGATIVE SLACK AND IS ALLOWED TO KEEP
    //   IT — AN ASSUMPTION, STATED HERE RATHER THAN IN A HANDOFF.** Once the
    //   alignment box is the field's box rather than the line's own width, a
    //   non-wrapping line CAN be wider than it, and nothing in the SWF says
    //   what the player then does: `DefineEditText` carries an align field and
    //   no overflow rule, and the oracle is read-only on this route so nothing
    //   here has watched it happen. Taken as: centre means centre, so an
    //   over-long line spills equally at both ends and a right-aligned one
    //   spills to the left with its right edge flush. The alternative reading
    //   — clamp the slack at zero, so an overflowing line falls back to
    //   left-aligned — is one `Math.max(0, …)` away, and `overflowing` below is
    //   how many lines the choice is worth, so a caller that does compare
    //   against a screenshot can see the stake before changing it.
    //   ► **AND ON THIS BUILD IT IS WORTH NOTHING YET, WHICH IS THE PART TO SAY
    //     OUT LOUD.** Measured 2026-09-14 over all 256 fields with the pack's
    //     own placeholder text: 0 of 272 lines overflow. So nothing on the real
    //     pack chooses between the two readings, and the arm is exercised by
    //     `test/render-text.test.js` alone. It is a live choice all the same —
    //     a BOUND value is a live number or a fighter's name, and it is longer
    //     than the placeholder whenever the placeholder is "6".
    if (slack < 0) overflowing += 1;
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
    // The box alignment was measured against, which is `width` only when the
    // caller gave neither an `alignWidth` nor a finite `maxWidth`. A caller
    // checking "is this centred where I think it is" needs the box, and
    // deriving it a second time at the call site is how two copies drift.
    box,
    // How many lines came out wider than that box — the size of the assumption
    // documented at the `slack` line above, not an approximation of the
    // extraction, so it is deliberately NOT in the `approximated` tally below.
    overflowing,
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
 * EVERY REASON ONE OPERATION IS NOT EXACT, AS A FROZEN LIST — the shape every
 * `approximated` this module stamps on an operation now has.
 *
 * ► **IT WAS A SINGLE STRING AND THAT MADE IT A LOSSY SLOT.** `fieldOpsFor`
 *   stamped `op.approximated ?? field.approximated`, so a hollow `.notdef` box
 *   inside one of the build's five HTML fields carried `glyph-missing` and
 *   silently dropped `html-markup-stripped` — an approximation overwriting
 *   another approximation, which is the same defect as one that is never
 *   counted. `src/render/screen-text.js` met it from the outside, could not fix
 *   it (it does not own this file), and worked around it by counting the FIELD's
 *   mark from the placement instead; its header names this line as the cause
 *   and says that if this module ever grows a list, that seam should stop
 *   deriving and start reading. This is the list.
 *
 * ► **ORDER IS PRECEDENCE, MOST SPECIFIC FIRST**, so `marks[0]` is exactly what
 *   the old single slot held: the operation's own reason, then the field's.
 *   Duplicates collapse — a field and its glyph naming the same kind is one
 *   reason, not two — because the consumer that counts these
 *   (`screenTextFor`'s tally) counts an operation once per kind.
 *
 * Takes strings and lists in any mix, and drops everything that is neither, so
 * a hand-edited pack cannot put a number or an object on an operation.
 */
function marksOf(...sources) {
  const out = [];
  for (const source of sources) {
    for (const mark of Array.isArray(source) ? source : [source]) {
      if (typeof mark !== "string" || mark.length === 0) continue;
      if (!out.includes(mark)) out.push(mark);
    }
  }
  return Object.freeze(out);
}

/**
 * THE ONE READER FOR AN OPERATION'S `approximated`, WHICHEVER SHAPE IT IS IN —
 * and the shape is NOT uniform across this tree, which is the point of putting
 * the reader here instead of a `typeof` at each call site.
 *
 * ► **ONE KEY, TWO TYPES, IN ONE ARRAY.** `screen-text.js`'s `screenWithTextFor`
 *   concatenates the shape operations from `src/render/screen.js` with the glyph
 *   operations from this file, and the two halves do not agree on the shape of
 *   this key:
 *
 * ```text
 *   src/render/text.js    an operation carries a frozen LIST of reasons
 *   src/render/screen.js  line 647: `...(entry.approximated ? { approximated: entry.approximated } : {})`
 *   src/render/props.js   line 366: the same line, copying the extractor's STRING
 * ```
 *
 *   Measured over all 26 screens on 2026-09-14, after this module grew the list:
 *   **274 merged operations carry a mark — 209 as strings (`gradient` x180,
 *   `bitmap` x29) and 65 as arrays (`html-markup-stripped` x65).** So a reader
 *   that assumes EITHER shape is wrong about the other half of the same array,
 *   and the `typeof op.approximated === "string"` guard this file's change made
 *   obsolete for glyph operations is still the CORRECT guard for 209 of the 274.
 *
 * ► **THE RIGHT FIX IS NOT HERE.** It is for the two producers above to emit a
 *   list too, at which point this reader keeps working unchanged and the census
 *   becomes 0 strings / 274 arrays. Until then every consumer goes through this
 *   function, so the seam has exactly one reader rather than one per caller —
 *   the mismatch that created this finding was a reader written against one
 *   producer.
 *
 * Total, like every other reader in this module: a number, an object or a
 * hand-edited pack's `null` reads as no marks rather than throwing.
 */
export function approximationMarksOf(value) {
  return marksOf(value);
}

/**
 * Turn a finished layout into draw operations.
 *
 * `matrix`, when given, is composed on the OUTSIDE — it is the placement that
 * puts the field or the run into its parent's space, with its own translation
 * in twips, exactly as the pack stores it.
 *
 * `marks` is every approximation that applies to the WHOLE run — the field's
 * `html-markup-stripped`, say. It is merged into each operation's own list
 * here, at the one point an operation is built, rather than stamped over the
 * finished array afterwards: the stamping version could only write one mark per
 * operation and quietly dropped whichever reason it met second.
 */
function opsFromLayout(layout, font, { colour, alpha, matrix, marks }) {
  const ops = [];
  const runMarks = marksOf(marks);
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
          // `layoutText` still cannot draw an approximation without one — and
          // it is a LIST, so the run's own reasons travel with it instead of
          // being pushed out by this one. See `marksOf`.
          approximated: marksOf("glyph-missing", runMarks),
          notdef: true
        }));
        continue;
      }

      // Absent rather than empty when nothing is approximate, the same
      // convention the packs use: a key here is a thing that happened.
      const approximated = marksOf(source.approximated, runMarks);
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
        ...(approximated.length > 0 ? { approximated } : {})
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

  // ► **A RUN'S OWN APPROXIMATION USED TO REACH NO OPERATION AT ALL**, which is
  //   the same hole `fieldOpsFor` had one level up and is fixed the same way:
  //   the mark joins each operation's list instead of having nowhere to go.
  //   `tools/extract-text.mjs` tallies `item.approximated` on a static, so the
  //   shape is the extractor's, but **0 of this build's 180 statics carry one**
  //   — so nothing on the real pack exercises this and `test/render-text.test.js`
  //   builds a synthetic static that does, rather than leaving an arm that only
  //   looks tested.
  const itemMarks = marksOf(item.approximated);

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
          approximated: marksOf("glyph-missing", itemMarks),
          notdef: true
        }));
      } else if (!glyph.empty && glyph.path) {
        // Absent rather than empty when nothing is approximate — the same
        // convention `opsFromLayout` keeps, and the packs' own.
        const approximated = marksOf(glyph.approximated, itemMarks);
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
          ...(approximated.length > 0 ? { approximated } : {})
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
    // ► **WRAPPING NEEDS BOTH FLAGS; ALIGNING NEEDS ONLY A BOX, AND EVERY FIELD
    //   HAS ONE.** `maxWidth` decides where a line BREAKS, so a field that is
    //   not `wordWrap && multiline` must be allowed to run on and gets
    //   `Infinity`. `alignWidth` decides what `center` and `right` are measured
    //   AGAINST, and that is the field's own inner box whether it wraps or not.
    //   One parameter used to carry both jobs and the second one lost: 108 of
    //   the build's 256 fields — 81 of the 101 centred and 27 of the 30 right
    //   — drew left-aligned, and on `createchar` every stat number drew on top
    //   of its own label.
    //
    //   ► ~~`tools/screens/main.js` reported this from the outside and could
    //     not fix it, because it does not own this file.~~ ~~**IT DID, AND ITS
    //     REPORT IS NOW STALE — DO NOT GO THERE TO READ ABOUT THIS.**~~
    //     **BOTH ENDS ARE CORRECT NOW, 2026-09-15.** That file's header item 2
    //     is struck at the claim, keeps its measurement as history, and no
    //     longer states the defect in the present tense.
    //
    //     ► **AND THE TWO ROUNDS OF THIS COMMENT ARE THE LESSON.** Fixing the
    //       code and NAMING the stale pointee was not enough: a reader of
    //       `tools/screens/main.js` still met a live bug report for a bug that
    //       was gone, because a note in THIS file does not change THAT one. A
    //       verifier found it a day later. **Correcting the pointer is not
    //       correcting the pointee.** Ninth instance of the signature failure
    //       here, and the first where the previous fix's own note is what
    //       created it.
    //
    //     The predicted position in that header was 82.2 px; the fix puts the
    //     digit's ink at 82.33 px. Both are recorded rather than reconciled —
    //     the prediction was a hand-computed box centre and the measurement is
    //     the glyph's actual left edge, so they are two different quantities
    //     and making them one number would hide that.
    maxWidth: field.wordWrap && field.multiline ? inner : Infinity,
    // ► **`inner` TAKES THE MARGINS OFF TOO, AND NOTHING IN THE BUILD CAN TELL
    //   YOU WHETHER THAT IS RIGHT.** All 256 fields declare `leftMargin: 0` and
    //   `rightMargin: 0` (re-derived 2026-09-14), so on this pack
    //   `alignWidth: inner` and `alignWidth: width - gutter * 2` are
    //   indistinguishable — an adversarial verifier replaced one with the other
    //   and the whole 1712-test suite stayed green. It is the player's
    //   documented behaviour (a margin indents the text box, and alignment
    //   happens inside what is left) and it is an ASSUMPTION here, the same
    //   standing as `FIELD_GUTTER_PX`. It is no longer unpinned: `A CENTRED
    //   FIELD'S MARGINS COME OFF THE ALIGNMENT BOX` in
    //   `test/render-text.test.js` builds a field with margins and asserts both
    //   this number and the glyph position it produces, so changing it is now a
    //   decision someone has to make rather than a line that can be deleted.
    alignWidth: inner,
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
 *
 * ► ~~`approximated: op.approximated ?? field.approximated`~~ **THAT `??` WAS A
 *   DEFECT AND IS GONE.** It meant an operation could hold ONE reason, so a
 *   hollow `.notdef` box inside an HTML field kept `glyph-missing` and dropped
 *   the field's `html-markup-stripped` on the floor — an approximation
 *   overwriting another approximation. `src/render/screen-text.js` found it,
 *   named this line as the cause and could only work around it. The field's
 *   marks now go into `opsFromLayout` with the run and join each operation's
 *   own list; see `marksOf` for the shape and the ordering.
 */
export function fieldOpsFor(pack, id, options = {}) {
  const drawn = fieldTextFor(pack, id, options);
  return drawn && drawn.ops.length > 0 ? drawn.ops : null;
}

/**
 * THE SAME FIELD, WITH ITS INVOICE — the ops AND what laying them out cost.
 *
 * ► **IT EXISTS BECAUSE `fieldOpsFor` RETURNS AN ARRAY, AND AN ARRAY CANNOT
 *   CARRY A COUNT.** `layoutText` reports `overflowing`, the number of lines
 *   that came out wider than the box they were aligned in — the size of the
 *   assumption documented at the `slack` line in `layoutText`. Every caller on
 *   the screen route went through `fieldOpsFor`, which dropped it on the floor,
 *   so the one condition this module's alignment fix newly made possible was
 *   the one condition nothing downstream could count. `src/render/screen-text.js`
 *   reads this instead, and its tally counts `fieldOverflows` by name.
 *
 * ► **AND IT IS ONE LAYOUT PASS, NOT TWO.** The obvious alternative — have the
 *   caller run `fieldLayoutOptionsFor` + `layoutText` a second time purely to
 *   reach the counts — is the arrangement `screen-text.js` deliberately deleted
 *   once already, for costing a pass over every field on every screen. So the
 *   deep call is the one that does the work and `fieldOpsFor` is the shallow
 *   view of it, rather than the other way round.
 *
 * Returns null on the same inputs `fieldOpsFor` returns null for EXCEPT one: a
 * field that lays out and inks nothing gives `{ ops: [], ... }` here and `null`
 * there, because "this field drew nothing" is an answer and not an absence.
 */
export function fieldTextFor(pack, id, options = {}) {
  const field = pack?.fields?.[id] ?? pack?.fields?.[String(id)];
  const resolved = fieldLayoutOptionsFor(pack, id, options);
  if (!resolved) return null;
  const font = fontFor(pack, resolved.font);
  const layout = layoutText(pack, resolved);
  if (!font || !layout) return null;

  const ops = opsFromLayout(layout, font, {
    colour: typeof options.colour === "string" ? options.colour : resolved.colour,
    alpha: Number.isFinite(options.alpha) ? options.alpha : resolved.alpha,
    matrix: options.matrix,
    marks: field?.approximated
  });
  return Object.freeze({
    ops: Object.freeze(ops),
    // The layout's own numbers, not a second opinion derived from the ops: the
    // ops have been through a matrix and no longer know what box they were
    // measured against.
    box: layout.box,
    width: layout.width,
    lines: layout.lines.length,
    // ► **THE NUMBER THAT HAD NOWHERE TO GO.** Lines wider than `box`. Zero on
    //   every one of the build's 256 fields with the pack's own placeholder
    //   text (272 lines, re-derived 2026-09-14) — and NOT vacuous, because a
    //   field's value comes from outside the pack: binding `"888888888888"` to
    //   `createchar`'s field 1619, whose box is 42.95 px, lays out a 91.05 px
    //   line and makes this 1. `test/render-screen-text.test.js` binds exactly
    //   that, so the counter is exercised by an input the game can produce
    //   rather than only by a synthetic field.
    overflowing: layout.overflowing
  });
}
