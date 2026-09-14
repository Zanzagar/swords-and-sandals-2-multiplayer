/**
 * THE BUILD'S OWN TYPE — nine embedded fonts, 180 baked static runs and 256
 * runtime fields, out of the player's own install and into gitignored
 * `assets/text/`.
 *
 * ## ⚠ THE LICENCE BOUNDARY, STATED BEFORE ANYTHING ELSE
 *
 * The outlines this tool copies are **commercially licensed type**. The build's
 * own `DefineFontName` tags name FOUR rights holders, and this is what is on
 * the wire (re-derived by `test/extract-text.test.js`, not copied from a brief):
 *
 * ```text
 *   53, 118, 2120, 2132  "Goudy Handtooled BT"  Bitstream Inc.
 *   754                  "Arial"                The Monotype Corporation
 *   1510, 1519           "Avalon Quest"         SWFTE International
 *   1523, 1526           "Mini 7"               Joe Gillespie
 * ```
 *
 * ► **WHAT THIS TOOL MAY DO:** read the player's own installed SWF and write
 *   glyph geometry into `assets/`, which is GITIGNORED (`assets/*`, with only
 *   `assets/README.md` allowed) and which `test/asset-attestation.test.js`
 *   fails on if anything under it is ever tracked. Extracting from the copy you
 *   own, onto your own disk, to draw on your own screen, distributes nothing.
 *   It is the same Doom/WAD model every other extractor here uses.
 *
 * ► **WHAT IT MUST NEVER DO:** put a font file — `.ttf`, `.otf`, `.woff`, a
 *   glyph dump, anything — into the REPOSITORY, or weaken `.gitignore` so that
 *   one could arrive. The repo is a distribution channel; a clone must still
 *   need its owner's licensed copy. Reconstituting an installed typeface from
 *   these outlines and installing it as a system font would also be outside
 *   this boundary: the pack exists to draw the game's own screens, not to
 *   re-issue somebody's typeface.
 *
 * ► **AND `tools/swf-fonts.mjs` DELIBERATELY LEFT THIS DECISION OPEN.** Its
 *   header says, of writing glyph outlines to disk: *"whether this project ever
 *   takes that step is the main session's call, not a parser's."* This file is
 *   that call being taken, under the boundary above. `swf-fonts.mjs` itself
 *   still writes nothing, and its CLI still reports only — nothing in it
 *   changed. **If the owner's answer is no, delete this file and the pack; the
 *   parser is unaffected.**
 *
 * ## What is in the pack, and why the two halves are stored differently
 *
 * A `DefineText` holds GLYPH INDICES with an advance BAKED IN per entry; a
 * `DefineEditText` holds a rectangle, a font reference and a variable name, and
 * the player fills it at runtime. So a static run needs no font metrics to lay
 * out and a field needs nothing else.
 *
 * ► **AND THE BAKED ADVANCES ARE NOT DERIVABLE FROM THE FONT.** Measured here
 *   over all 4060 resolvable glyph entries: `fontAdvance * textHeight / 20480`
 *   agrees with the baked advance to within one twip on 3182 of them (78%),
 *   mean absolute error 2.7 twips, worst 141 twips. The exporter baked kerning
 *   and letter-spacing in. **So a static run must be drawn with its OWN
 *   advances**, which is why they are stored per entry rather than recomputed.
 *
 * ## Units, and there are three of them in one file
 *
 * - glyph outlines: **GLYPH UNITS**, 20480 per em (`DefineFont3`).
 * - a static's bounds/matrix/offsets and a field's bounds/height/margins:
 *   **TWIPS**, 20 per pixel.
 * - a static glyph entry's advance: **TWIPS**, already scaled to that record's
 *   `textHeight`. Scaling it again by `textHeight / 20480` is the mistake this
 *   line exists to stop.
 *
 * `src/render/text.js` is the only consumer and states the same seam.
 *
 * ## Two things the build's own tables do NOT contain, both found here
 *
 * ► **EVERY PER-GLYPH BOUNDS RECT IN THE FILE IS `{0,0,0,0}`.** All 913 of them,
 *   across the eight fonts that have a layout block. A consumer measuring text
 *   from `DefineFont3`'s own bounds table gets zero width and zero height and
 *   nothing says so. This tool therefore computes each glyph's ink box from its
 *   outline — EXACTLY, including the extrema of the quadratics rather than the
 *   control-point hull, so it is a measurement and not an approximation — and
 *   the manifest records that the build's table was empty.
 *
 * ► **FONT 1510 ("Avalon Quest") HAS NO LAYOUT BLOCK AT ALL** — no ascent, no
 *   descent, no advances, no kerning. Its advances are therefore APPROXIMATED
 *   and every one is counted by kind; see `tallyApproximations`.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { TAG, tagStreamStart, walkTags, parsePlaceObject } from "./swf-display-list.mjs";
import { indexFonts, FONT3_UNITS_PER_EM } from "./swf-fonts.mjs";
import { indexText, textToString } from "./swf-text.mjs";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The same default every other tool that reads the build uses. */
const DEFAULT_SWF =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";

/** The oracle's sha256. Recorded and REPORTED — never enforced. */
const ORACLE_SHA256 = "77cb545c2061ab41246251467a4edf5926ab6fd1ddd95dc9527d7ba9c45bb8ca";

export class ExtractTextError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

export function parseArguments(argv) {
  const options = { file: null, out: path.join(REPO_ROOT, "assets", "text"), report: false };
  const rest = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") {
      const next = argv[index + 1];
      if (typeof next !== "string" || next.startsWith("--")) {
        throw new ExtractTextError("--out needs a directory path.");
      }
      options.out = next;
      index += 1;
    } else if (value === "--report") {
      options.report = true;
    } else if (value.startsWith("--")) {
      throw new ExtractTextError(`Unknown option ${value}.`);
    } else {
      rest.push(value);
    }
  }
  options.file = rest[0] ?? DEFAULT_SWF;
  return options;
}

/** `{red,green,blue,alpha}` -> the `#rrggbb` every other pack's `fill` uses. */
export function toHexColour(colour) {
  if (!colour) return null;
  const hex = (value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${hex(colour.red)}${hex(colour.green)}${hex(colour.blue)}`;
}

/**
 * THE EXACT INK BOX OF ONE GLYPH, quadratic extrema included.
 *
 * ► **THE CONTROL-POINT HULL IS NOT THE CURVE.** A quadratic lies inside the
 *   hull of `{start, control, end}` and touches it only at the endpoints, so
 *   taking the hull overstates every round letter — by a few percent, silently,
 *   in a number a caller would use to centre text. The extremum of
 *   `B(t) = (1-t)^2 P0 + 2t(1-t) C + t^2 P1` is at
 *   `t = (P0 - C) / (P0 - 2C + P1)`, and it is only a real point of the curve
 *   when `0 < t < 1`. Six lines, and the result is a measurement rather than an
 *   approximation — which is the whole reason it is not in the tally below.
 *
 * Returns null for a glyph with no edges (a space), because an empty box and a
 * zero-sized box are different claims.
 */
export function inkBoundsOf(contours) {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  let seen = 0;

  const note = (x, y) => {
    xMin = Math.min(xMin, x);
    xMax = Math.max(xMax, x);
    yMin = Math.min(yMin, y);
    yMax = Math.max(yMax, y);
    seen += 1;
  };
  const axisExtremum = (p0, c, p1) => {
    const denominator = p0 - 2 * c + p1;
    if (denominator === 0) return null;
    const t = (p0 - c) / denominator;
    if (!(t > 0 && t < 1)) return null;
    const inverse = 1 - t;
    return inverse * inverse * p0 + 2 * t * inverse * c + t * t * p1;
  };

  for (const contour of contours ?? []) {
    if (!contour.edges || contour.edges.length === 0) continue;
    let x = contour.start[0];
    let y = contour.start[1];
    note(x, y);
    for (const edge of contour.edges) {
      if (edge.kind === "quadratic") {
        const ex = axisExtremum(x, edge.control[0], edge.to[0]);
        const ey = axisExtremum(y, edge.control[1], edge.to[1]);
        if (ex !== null) note(ex, y);
        if (ey !== null) note(x, ey);
      }
      x = edge.to[0];
      y = edge.to[1];
      note(x, y);
    }
  }
  if (seen === 0) return null;
  const round = (value) => Math.round(value * 10) / 10;
  return { xMin: round(xMin), xMax: round(xMax), yMin: round(yMin), yMax: round(yMax) };
}

/**
 * HTML markup out, plain text in — and the caller is told it happened.
 *
 * Five of the 256 fields set the HTML flag and their initial text is real
 * markup: `<p align="center"><font face="..." size="14" color="#000000"
 * letterSpacing="-1"><b>…`. **This renderer draws none of that** — it draws the
 * field's own font, size and colour — so stripping is an APPROXIMATION and is
 * counted as one. Dropping the markup silently would leave a field that looks
 * like plain text and renders in the wrong face.
 */
export function htmlToPlainText(markup) {
  if (typeof markup !== "string") return null;
  const entities = new Map([
    ["&lt;", "<"], ["&gt;", ">"], ["&quot;", '"'], ["&apos;", "'"],
    ["&nbsp;", " "], ["&amp;", "&"]
  ]);
  return markup
    .replace(/<br\s*\/?>/gi, "\r")
    .replace(/<\/p\s*>/gi, "\r")
    .replace(/<[^>]*>/g, "")
    // `&amp;` last, so `&amp;lt;` does not become a tag on the second pass.
    .replace(/&(?:lt|gt|quot|apos|nbsp|amp);/gi, (match) => entities.get(match.toLowerCase()) ?? match)
    .replace(/\r+$/, "");
}

/**
 * WHERE EVERY TEXT CHARACTER IS PLACED — the join a renderer actually needs.
 *
 * ► **ALL 436 TEXT CHARACTERS ARE DEFINED AT THE ROOT, and `swf-text.mjs`'s
 *   header says the opposite.** That file states *"the build defines text
 *   inside them [sprites], and the 436 that `indexCharacters` reports is only
 *   reachable by descending."* Measured here: walking the root tag stream
 *   WITHOUT descending finds 180 `DefineText` and 256 `DefineEditText`, which is
 *   all of them. The recursion in `indexText` is harmless and finds nothing
 *   extra; the sentence describing it is wrong. Definition is at the root and
 *   only the PLACEMENT is nested — which is why this walk exists.
 *
 *   It is the difference between "what text does the build own" and "what text
 *   does the UI bar carry", and only the second one lets a renderer draw a
 *   screen. Sprite 1531 (`fiz_info_panel`, the arena's bottom bar) DEFINES no
 *   text at all and PLACES exactly two fields: 1527 and 1528.
 *
 * `frame` is 1-based and counts `ShowFrame` tags within the owner, the same
 * convention `resolveTimeline` uses — cross-checked against a known landmark:
 * `rain` (character 1816) at depth 80 lands on root frame 221, which is where
 * `arena-backdrop.js` says the arena screen is.
 */
export function indexTextPlacements(buffer, wanted, { maxDepth = 8 } = {}) {
  const placements = new Map();
  const failures = [];

  const walk = (start, end, owner, depth) => {
    let frame = 1;
    for (const { code, bodyStart, bodyEnd } of walkTags(buffer, start, end)) {
      if (code === TAG.DEFINE_SPRITE) {
        if (depth < maxDepth) walk(bodyStart + 4, bodyEnd, buffer.readUInt16LE(bodyStart), depth + 1);
        continue;
      }
      if (code === TAG.SHOW_FRAME) {
        frame += 1;
        continue;
      }
      if (code !== TAG.PLACE_OBJECT && code !== TAG.PLACE_OBJECT2 && code !== TAG.PLACE_OBJECT3) continue;
      let placement;
      try {
        placement = parsePlaceObject(buffer, bodyStart, bodyEnd, code);
      } catch (error) {
        // A PlaceObject this module cannot read is COUNTED, not skipped in
        // silence: an unreadable placement is a text field that would simply
        // never appear, which looks exactly like a field that is not there.
        failures.push({ id: null, message: `PlaceObject in ${owner ?? "root"}: ${String(error.message).slice(0, 90)}` });
        continue;
      }
      if (placement.characterId === undefined || !wanted.has(placement.characterId)) continue;
      const list = placements.get(placement.characterId) ?? [];
      const matrix = placement.matrix ?? null;
      list.push({
        owner: owner ?? null,
        frame,
        depth: placement.depth,
        name: placement.name ?? null,
        matrix: matrix ? roundMatrix(matrix) : null
      });
      placements.set(placement.characterId, list);
    }
  };

  walk(tagStreamStart(buffer), buffer.length, null, 0);
  return { placements, failures };
}

/**
 * The same rounding every other pack uses: `{a,b,c,d,tx,ty}` reaches JSON as a
 * six-element array, scale terms to 5 places and translations to 1.
 *
 * **`tx`/`ty` STAY IN TWIPS**, exactly as `extract-props.mjs` leaves them, so a
 * consumer divides by 20 once and the two packs cannot disagree. `-0` is
 * normalised to `0`, which is how a byte-identical re-extraction can otherwise
 * look like a changed one.
 */
function roundMatrix(matrix) {
  const r = (value, places) => {
    const factor = 10 ** places;
    const rounded = Math.round(value * factor) / factor;
    return Object.is(rounded, -0) ? 0 : rounded;
  };
  return [r(matrix.a, 5), r(matrix.b, 5), r(matrix.c, 5), r(matrix.d, 5), r(matrix.tx, 1), r(matrix.ty, 1)];
}

/**
 * HOW MANY THINGS THIS EXTRACTION COULD NOT READ EXACTLY, BY KIND.
 *
 * ► **RECOMPUTED FROM THE PACK, NEVER ACCUMULATED WHILE WRITING IT.** That is
 *   the whole lesson of the arena walls: the extractor counted its own
 *   intentions and the data disagreed. This function takes the finished pack
 *   and counts what is actually in it, and `test/extract-text.test.js` runs the
 *   same recount against the file on disk — so a tally that lies fails by name.
 *
 * The kinds, all of them measured on the oracle:
 *
 * ```text
 *   advance-from-outline      112   font 1510 has no advance table; a glyph's
 *                                   advance is derived from its own ink box
 *   advance-from-sibling-font   2   1510's two EMPTY glyphs (space, nbsp) have
 *                                   no ink to derive from, so the advance comes
 *                                   from font 1519, the other "Avalon Quest"
 *   font-layout-absent          1   font 1510: no ascent/descent/leading, so a
 *                                   line height must be derived from the size
 *   html-markup-stripped        5   fields whose initial text is real HTML and
 *                                   which this renderer draws as plain text
 * ```
 */
export function tallyApproximations(pack) {
  const byKind = {};
  const bump = (kind) => { byKind[kind] = (byKind[kind] ?? 0) + 1; };

  let glyphs = 0;
  for (const font of Object.values(pack.fonts ?? {})) {
    if (font.approximated) bump(font.approximated);
    for (const glyph of font.glyphs ?? []) {
      glyphs += 1;
      if (glyph.approximated) bump(glyph.approximated);
    }
  }
  const statics = Object.values(pack.statics ?? {});
  for (const item of statics) if (item.approximated) bump(item.approximated);
  const fields = Object.values(pack.fields ?? {});
  for (const field of fields) if (field.approximated) bump(field.approximated);

  return {
    glyphs,
    statics: statics.length,
    fields: fields.length,
    total: Object.values(byKind).reduce((sum, count) => sum + count, 0),
    byKind
  };
}

/**
 * The advance table for a font, in glyph units, with every derived entry named.
 *
 * ► **NULL IS NOT ZERO, AND THAT IS THE WHOLE POINT OF THIS FUNCTION.**
 *   `swf-fonts.mjs` returns `advances: null` for font 1510 rather than a table
 *   of zeros, because a zero advance would stack 114 glyphs on one another and
 *   nothing would say why. Here the absence is turned into a stated derivation:
 *   the glyph's own ink box, mirrored at the left side bearing.
 *
 * ► **AND THE HEURISTIC WAS CHECKED AGAINST A SECOND FONT BEFORE BEING USED.**
 *   Font 1519 is the other "Avalon Quest" in the build, shares 1510's code
 *   table exactly, and DOES have advances. Over the 112 non-empty glyphs, the
 *   derived advance divided by 1519's real one has mean 1.005 and worst-case
 *   relative error 0.184 (on `)`). That is corroboration, not proof: 1519 is
 *   the bold cut, so the two are not required to agree.
 */
function advancesFor(font, siblings) {
  if (font.advances) return font.glyphs.map((glyph) => ({ advance: font.advances[glyph.index], approximated: null }));

  const sibling = siblings.find((other) => other.id !== font.id && other.name === font.name && other.advances);
  return font.glyphs.map((glyph) => {
    const ink = inkBoundsOf(glyph.contours);
    if (ink) {
      // The right side bearing is unknowable, so the LEFT one is mirrored: a
      // glyph that starts 840 units in ends 840 units before its advance.
      return { advance: Math.round(ink.xMax + Math.max(0, ink.xMin)), approximated: "advance-from-outline" };
    }
    const borrowed = sibling?.advances?.[glyph.index];
    if (Number.isFinite(borrowed)) {
      return { advance: borrowed, approximated: "advance-from-sibling-font" };
    }
    // No outline and no sibling: a quarter em, which is the only number left
    // and is therefore named as the guess it is.
    return { advance: Math.round(FONT3_UNITS_PER_EM / 4), approximated: "advance-from-em-fraction" };
  });
}

/**
 * THE PACK: nine fonts, 180 static runs, 256 fields and every placement of them.
 *
 * Everything that could not be read exactly carries an `approximated` string on
 * the item itself, so the tally above can be recomputed from the pack alone and
 * a reader of one entry can see it without consulting a manifest.
 */
export function extractText(buffer) {
  const fontIndex = indexFonts(buffer);
  const textIndex = indexText(buffer);
  const failures = [];
  for (const failure of fontIndex.failures) failures.push({ id: failure.font, message: failure.message });
  for (const failure of textIndex.failures) failures.push({ id: failure.id, message: failure.message });

  const siblings = [...fontIndex.fonts.values()];
  const fonts = {};
  for (const font of siblings.sort((left, right) => left.id - right.id)) {
    const advances = advancesFor(font, siblings);
    let emptyLayoutBounds = 0;
    const glyphs = font.glyphs.map((glyph) => {
      const own = font.bounds?.[glyph.index];
      if (own && !own.xMin && !own.xMax && !own.yMin && !own.yMax) emptyLayoutBounds += 1;
      if (glyph.failed) {
        failures.push({ id: font.id, message: `glyph ${glyph.index} (U+${glyph.code.toString(16)}) failed to parse` });
      }
      return {
        code: glyph.code,
        char: glyph.char,
        // GLYPH UNITS, 20480 per em. Empty for a space — which is stated by
        // `empty` rather than left to look like a failed read — and null when
        // the glyph could not be parsed at all.
        path: glyph.failed ? null : glyph.path,
        empty: Boolean(glyph.empty),
        failed: Boolean(glyph.failed),
        advance: advances[glyph.index].advance,
        ink: inkBoundsOf(glyph.contours),
        ...(advances[glyph.index].approximated ? { approximated: advances[glyph.index].approximated } : {})
      };
    });

    fonts[font.id] = {
      id: font.id,
      name: font.name,
      displayName: font.displayName,
      // The rights holder travels WITH the outlines. A pipeline that copies
      // glyph geometry and drops the licence line is choosing not to know.
      copyright: font.copyright,
      bold: font.flags.bold,
      italic: font.flags.italic,
      hasLayout: font.flags.hasLayout,
      unitsPerEm: FONT3_UNITS_PER_EM,
      ascent: font.ascent,
      descent: font.descent,
      leading: font.leading,
      // The build's own per-glyph bounds table is all zeros — see the header.
      // Recorded so a future build that fills it in is visibly different.
      emptyLayoutBounds,
      glyphCount: font.glyphCount,
      glyphs,
      // `[leftCode, rightCode, adjustment]`, adjustment in glyph units. Null —
      // not `[]` — when the font has no layout block, because "no pairs kern"
      // and "this font cannot answer" are different facts.
      kerning: font.kerning ? font.kerning.map((pair) => [pair.left, pair.right, pair.adjustment]) : null,
      ...(font.flags.hasLayout ? {} : { approximated: "font-layout-absent" })
    };
  }

  const statics = {};
  for (const item of [...textIndex.statics.values()].sort((left, right) => left.id - right.id)) {
    const read = textToString(item, fontIndex.fonts);
    if (read.unresolved > 0) {
      failures.push({ id: item.id, message: `${read.unresolved} glyph entries resolve to no glyph` });
    }
    statics[item.id] = {
      id: item.id,
      bounds: item.bounds,
      matrix: roundMatrix(item.matrix),
      // The plain string, for a human and for a test. The DRAWING comes from
      // the glyph indices below; this is the readable cross-check on them.
      text: read.text,
      unresolved: read.unresolved,
      records: item.records.map((record) => ({
        font: record.font,
        fontInherited: record.fontInherited,
        // TWIPS, and it is the em size of this record.
        height: record.textHeight,
        colour: toHexColour(record.colour),
        alpha: record.colour ? record.colour.alpha / 255 : 1,
        // TWIPS, and null means "carry on from where the last record left off".
        x: record.xOffset,
        y: record.yOffset,
        // `[glyphIndex, advanceTwips]` — the advance is BAKED and already
        // scaled to `height`. Scaling it again by height/20480 is the defect
        // this shape is written down to prevent.
        glyphs: record.glyphs.map((entry) => [entry.index, entry.advance])
      }))
    };
  }

  const fields = {};
  for (const field of [...textIndex.fields.values()].sort((left, right) => left.id - right.id)) {
    const html = field.flags.html && field.initialText !== null;
    fields[field.id] = {
      id: field.id,
      bounds: field.bounds,
      font: field.font,
      // TWIPS. Divide by 20 for the em size in pixels.
      fontHeight: field.fontHeight,
      colour: toHexColour(field.colour),
      alpha: field.colour ? field.colour.alpha / 255 : 1,
      align: field.layout ? field.layout.align : null,
      leftMargin: field.layout ? field.layout.leftMargin : 0,
      rightMargin: field.layout ? field.layout.rightMargin : 0,
      indent: field.layout ? field.layout.indent : 0,
      // SIGNED twips. A negative leading read as unsigned is 65000 twips of
      // line spacing, which is why `swf-text.mjs` reads it as SI16.
      leading: field.layout ? field.layout.leading : 0,
      multiline: field.flags.multiline,
      wordWrap: field.flags.wordWrap,
      password: field.flags.password,
      border: field.flags.border,
      readOnly: field.flags.readOnly,
      html: field.flags.html,
      maxLength: field.maxLength,
      // "" means "bound to no variable", which is different from a name this
      // tool failed to read; `swf-text.mjs` keeps that distinction and so does
      // this.
      variable: field.variableName,
      text: html ? htmlToPlainText(field.initialText) : field.initialText,
      ...(html ? { markup: field.initialText, approximated: "html-markup-stripped" } : {})
    };
  }

  const wanted = new Set([...textIndex.statics.keys(), ...textIndex.fields.keys()]);
  const placed = indexTextPlacements(buffer, wanted);
  for (const failure of placed.failures) failures.push(failure);
  const placements = {};
  for (const [id, list] of [...placed.placements].sort((left, right) => left[0] - right[0])) {
    placements[id] = list;
  }

  const pack = {
    unitsPerEm: FONT3_UNITS_PER_EM,
    twipsPerPixel: 20,
    fonts,
    statics,
    fields,
    placements
  };
  return { pack, failures, approximated: tallyApproximations(pack) };
}

/** The counts a human reads, recomputed from the pack rather than tracked. */
export function summarise(pack) {
  const fonts = Object.values(pack.fonts);
  const statics = Object.values(pack.statics);
  const fields = Object.values(pack.fields);
  const byAlign = {};
  for (const field of fields) byAlign[field.align ?? "none"] = (byAlign[field.align ?? "none"] ?? 0) + 1;
  let glyphEntries = 0;
  let records = 0;
  let unresolved = 0;
  for (const item of statics) {
    records += item.records.length;
    unresolved += item.unresolved;
    for (const record of item.records) glyphEntries += record.glyphs.length;
  }
  const neverPlaced = [...statics, ...fields].filter((item) => !pack.placements[item.id]).length;
  return {
    fonts: fonts.length,
    glyphs: fonts.reduce((sum, font) => sum + font.glyphs.length, 0),
    emptyGlyphs: fonts.reduce((sum, font) => sum + font.glyphs.filter((glyph) => glyph.empty).length, 0),
    fontsWithoutLayout: fonts.filter((font) => !font.hasLayout).length,
    emptyLayoutBounds: fonts.reduce((sum, font) => sum + font.emptyLayoutBounds, 0),
    kerningPairs: fonts.reduce((sum, font) => sum + (font.kerning ? font.kerning.length : 0), 0),
    statics: statics.length,
    records,
    glyphEntries,
    unresolvedGlyphEntries: unresolved,
    fields: fields.length,
    fieldsWithVariable: fields.filter((field) => field.variable).length,
    fieldsWithText: fields.filter((field) => field.text !== null).length,
    htmlFields: fields.filter((field) => field.html).length,
    multilineFields: fields.filter((field) => field.multiline).length,
    byAlign,
    placedCharacters: Object.keys(pack.placements).length,
    placementRecords: Object.values(pack.placements).reduce((sum, list) => sum + list.length, 0),
    neverPlaced
  };
}

function main(argv) {
  const options = parseArguments(argv);
  if (!fs.existsSync(options.file)) {
    throw new ExtractTextError(
      `No SWF at ${options.file}. Pass the path to YOUR OWN installed copy; this repository ships none.`
    );
  }
  const buffer = fs.readFileSync(options.file);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  if (sha256 !== ORACLE_SHA256) {
    process.stdout.write(
      `NOTE: this build is ${sha256.slice(0, 16)}…, not the oracle ${ORACLE_SHA256.slice(0, 16)}…\n` +
      "      That is legitimate; what is not is treating the output as evidence about the oracle.\n"
    );
  }

  const { pack, failures, approximated } = extractText(buffer);
  const totals = summarise(pack);

  fs.mkdirSync(options.out, { recursive: true });
  fs.writeFileSync(path.join(options.out, "text.json"), JSON.stringify(pack, null, 1));
  fs.writeFileSync(path.join(options.out, "manifest.json"), JSON.stringify({
    source: path.basename(options.file),
    sha256,
    extractedFrom: "DefineFont3 (75), DefineText (11) and DefineEditText (37), all defined at the root",
    licence:
      "COMMERCIALLY LICENSED TYPE. Bitstream, Monotype, SWFTE International and Joe Gillespie all " +
      "appear in this build's DefineFontName tags. This pack lives under gitignored assets/ and is " +
      "never committed; see tools/extract-text.mjs for the boundary.",
    fonts: Object.values(pack.fonts).map((font) => ({
      id: font.id,
      name: font.name,
      displayName: font.displayName,
      copyright: font.copyright,
      glyphs: font.glyphs.length,
      hasLayout: font.hasLayout,
      ascent: font.ascent,
      descent: font.descent,
      leading: font.leading,
      kerningPairs: font.kerning ? font.kerning.length : null,
      emptyLayoutBounds: font.emptyLayoutBounds
    })),
    totals,
    // Printed AND stored, because a count that only exists in memory is the
    // same silence the `failures` list was built to break.
    approximated,
    failures
  }, null, 1));

  const approxParts = Object.entries(approximated.byKind).map(([kind, count]) => `${count} ${kind}`);
  const lines = [`text -> ${options.out}`];
  for (const font of Object.values(pack.fonts)) {
    lines.push(
      `  ${String(font.id).padStart(4)} ${String(font.name).padEnd(20)} ${String(font.glyphs.length).padStart(4)} glyphs  ` +
      `${font.hasLayout ? `asc ${font.ascent} desc ${font.descent} kern ${font.kerning.length}` : "NO LAYOUT BLOCK"}`
    );
    lines.push(`       ${font.copyright ?? "NO DefineFontName — rights holder unrecorded"}`);
  }
  lines.push(
    `  ${totals.statics} static runs (${totals.records} records, ${totals.glyphEntries} glyph entries, ` +
    `${totals.unresolvedGlyphEntries} unresolved), ${totals.fields} fields ` +
    `(${totals.fieldsWithVariable} bound to a variable, ${totals.htmlFields} HTML)`
  );
  lines.push(
    `  ${totals.placementRecords} placements of ${totals.placedCharacters} characters, ` +
    `${totals.neverPlaced} text characters are never placed anywhere`
  );
  lines.push(
    `  ${approximated.glyphs} glyphs, ${failures.length} failures, ` +
    `${approximated.total} approximated${approxParts.length ? ` (${approxParts.join(", ")})` : ""}`
  );
  if (options.report) for (const failure of failures.slice(0, 20)) lines.push(`    ! ${failure.id}: ${failure.message}`);
  process.stdout.write(`${lines.join("\n")}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
