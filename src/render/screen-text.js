/**
 * THE JOIN — the 26 screens' 187 text placements, drawn in the build's own
 * letterforms, with the invoice for the ones that still are not.
 *
 * ## The two halves this file marries
 *
 * `screen.js` turns a root screen into draw operations for its SHAPES and then
 * stops at the type: it returns a `text` array of placements it cannot show —
 * each with its words, its box, its font, its colour and its matrix — and
 * counts every one of them under `approximations.textNotDrawn`. Its header says
 * outright that `text.js` is the other half and that *"the join is a caller's
 * two lines"*, and deliberately does not import it, so that a clone with no
 * `assets/text/` does not trip over a pack `screen.js` cannot see.
 *
 * ► **IT IS NOT TWO LINES, AND THE FIVE THINGS THAT MAKE IT MORE ARE WHY THIS
 *   IS A FILE RATHER THAN A CALLER'S FOR-LOOP.** *(FOUR when this was written.
 *   The fifth was found by an adversarial verifier reading the committed file,
 *   and it is the same defect as the other four one level down: an
 *   approximation that reached no tally. Corrected here rather than in a note
 *   above, because the count is the claim.)* Each was measured against the two
 *   real packs, each is silent when got wrong, and each is pinned in
 *   `test/render-screen-text.test.js`:
 *
 *   1. **`staticTextOpsFor`'s `matrix` option REPLACES the character's own
 *      matrix; it does not compose with it.** A `DefineText` carries its own
 *      text matrix beside its glyph records, 33 of the build's 180 statics have
 *      a non-identity one, and 22 of the 70 static placements on these screens
 *      land on one. Hand it the screen placement's matrix raw and those 22 runs
 *      draw up to **94.42 px** from where the build puts them — 68.9 px among
 *      the ones that put ink down, the widest being a scaled placement that
 *      multiplies its character's own 62.95 px offset by 1.49997. Inside the
 *      screen, wrong, and perfectly legible. `composeTextMatrix` below is the
 *      two-matrix product, and `placementTextFor` applies it.
 *   2. **The two packs disagree about what an HTML field SAYS, and the screens
 *      pack is the one you must not draw.** Five fields carry real markup;
 *      `screens.json` keeps `initialText` verbatim (`<p align="left">…`) while
 *      `text.json` carries the stripped plain text. Feeding a placement's own
 *      `text` to `fieldTextFor` paints the tags. So the VALUE drawn here comes
 *      from the text pack or from the caller, never from the screen placement.
 *   3. **Four of those five fields are BLANK once stripped**, so their
 *      `approximated: "html-markup-stripped"` mark reaches no operation at all
 *      and would vanish from an ops-only tally. `htmlMarkupStripped` counts
 *      PLACEMENTS and `htmlMarkupStrippedOps` counts operations; on this pack
 *      they are 5 and 65. A tally that only saw the 65 would report four
 *      approximations as zero. *(BOTH numbers are now taken from the
 *      placement. The 65 used to be a filter over the operations, which
 *      undercounts where two marks collide — see ONE MARK PER OPERATION
 *      below.)*
 *   4. **108 of the 187 placements sit under a FILTERLIST nothing applies** —
 *      58%, the same defect `screen.js` reports for 69% of its path operations,
 *      and invisible in exactly the same way. `screen.js` marks its own ops
 *      `filtered: true`; the text placements it hands over carry no such mark,
 *      so this file re-reads `filteredPlacements` from the pack and marks and
 *      counts them itself.
 *   5. **AN APPROXIMATION THIS FILE HAS NO NAME FOR IS STILL COUNTED, UNDER
 *      THE NAME `text.js` GAVE IT.** The tally used to be five `if`s and an
 *      unconditional add, filling eight keys, and every one of them was keyed
 *      on a literal: four camelCase strings this module invented and ONE
 *      borrowed from the other vocabulary, `"html-markup-stripped"`. Every
 *      other mark `text.js` stamps — `advance-from-outline` and
 *      `advance-from-sibling-font` on a glyph, `glyph-missing` on an operation,
 *      and whatever a re-extraction adds next — reached the placement record
 *      and then no number at all. **A tally keyed on a literal is a tally that
 *      stops counting when the data grows**, which is the bitmap note that died
 *      at the next seam and left the arena walls invisible, wearing a different
 *      hat. `approximatedByKind` and `approximatedOpsByKind` now count EVERY
 *      mark under its own name, `approximations` is a PROJECTION of those two,
 *      and `unrosteredApproximations` names, by name, every kind the projection
 *      has no key for.
 *
 * ## TWO VOCABULARIES, ONE TABLE, AND THE ROSTER AS A PROJECTION
 *
 * `text.js` writes kebab-case marks that describe what the EXTRACTOR could not
 * do (`html-markup-stripped`, `glyph-missing`, `advance-from-outline`); this
 * module's roster is camelCase and describes what the SCREEN is missing
 * (`filtersNotApplied`, `placeholderDrawn`). `APPROXIMATION_MARKS` below is the
 * only place in this file where a string from either vocabulary appears, and
 * the counting loop names none of them.
 *
 * Two rules do the counting, and they are stated here because they are the
 * whole of the arithmetic:
 *
 * - A mark on a PLACEMENT counts one placement, and — unless the table says
 *   otherwise — counts every operation that placement emitted. A field whose
 *   markup was stripped stripped it from the whole field.
 * - A mark on an OPERATION counts that operation, and counts its placement
 *   ONCE however many of its operations carry it.
 *
 * ## ONE MARK PER OPERATION — WHY THE `…Ops` COUNTS ARE NOT READ OFF THE OPS
 *
 * ► ~~**AN OPERATION CAN CARRY ONLY ONE `approximated` STRING.** `fieldOpsFor`
 *   stamps `op.approximated ?? field.approximated` (`text.js:713`), so an
 *   operation already marked `glyph-missing` never receives its field's
 *   `html-markup-stripped`.~~ **FIXED AT THE CAUSE 2026-09-14: `approximated`
 *   ON AN OPERATION IS NOW A LIST**, the field's reasons are merged into each
 *   operation's own in `opsFromLayout`, and a `.notdef` box in an HTML field
 *   carries `["glyph-missing", "html-markup-stripped"]`. The paragraph is kept
 *   rather than deleted because the RULES below were written against it and
 *   still stand. An earlier version of this file counted `htmlMarkupStrippedOps`
 *   with an ops-only filter, which undercounted for exactly this reason.
 *
 * ► **BUT "NOW A LIST" IS TRUE OF THIS FILE'S OPERATIONS AND OF NO OTHERS, AND
 *   READING IT AS SETTLED IS THE TRAP.** `emitDrawable` in
 *   `src/render/screen.js` and `emitPropOps` in `src/render/props.js` still put
 *   the extractor's STRING under the same key, and `screenWithTextFor` puts
 *   both in one array — 209 strings to 65
 *   lists over the 26 screens, measured 2026-09-14. So the fix for a
 *   producer/reader seam mismatch made a producer/producer one. There is exactly
 *   one reader of that key in `src/` — `approximationMarksOf`, in `text.js` —
 *   and everything here goes through it; see the note on `screenWithTextFor`
 *   for the census and for what the proper repair is.
 *
 * **This file still DERIVES the `…Ops` counts from the placement rather than
 * reading them off the operations, and that is now a choice rather than a
 * workaround.** Two of the marks `finish` pushes — `filtersNotApplied` and
 * `placeholderDrawn` — are facts about the PLACEMENT that reach no operation at
 * all, so the placement rule has to exist whatever the operations carry; having
 * one rule for both is what keeps the arithmetic to the two lines above. The
 * two readings agreed before the fix by luck — re-measured 2026-09-14: 65 of
 * the 2236 glyph operations these 26 screens draw carry a mark at all, none
 * carries two, and none is a notdef box — and now agree by construction
 * wherever a mark reaches an operation at all, because `fieldTextFor` puts the
 * field's reasons on every operation it emits.
 * `test/render-screen-text.test.js` asserts that on the colliding case rather
 * than trusting this paragraph. **The real pack cannot tell the two readings
 * apart, so that synthetic case is the only thing standing behind this
 * paragraph: a mutation that makes this loop read the list as a string moves
 * no number on any of the 26 screens.**
 *
 * ## THE PACKS ARE ARGUMENTS, BOTH OF THEM, AND EITHER MAY BE ABSENT
 *
 * Same arrangement as `props.js`, `sound.js`, `extracted-figure.js` and
 * `screen.js`, for the same reason: this repository ships no SS2 asset, so a
 * clone with no licensed copy gets `null` from every function here and the
 * caller falls back to its own authored art. **That fallback is the supported
 * path, not an error path.** Every reader is TOTAL — a missing, truncated or
 * hand-edited pack returns null or an empty list and never throws — and a
 * player who has extracted the screens but not the text gets `null` too,
 * because half a join is a screen with no words on it and a caller that thinks
 * it has drawn one.
 *
 * ## UNITS: THE SEAM THAT HAS COST THIS PROJECT THREE DEFECTS, AND IT HOLDS
 *
 * ```text
 *   screen placement `matrix`   [a,b,c,d,tx,ty], tx/ty in TWIPS   (screen.js)
 *   screen placement `box`      PIXELS                            (screen.js)
 *   static's own `matrix`       [a,b,c,d,tx,ty], tx/ty in TWIPS   (text.js)
 *   emitted op `d`              PIXELS
 *   emitted op `matrix`         [a,b,c,d,tx,ty], tx/ty in TWIPS
 * ```
 *
 * The two modules agree, which is the finding and not the assumption:
 * `opsFromLayout` and `staticTextOpsFor` both convert their own pen from pixels
 * (or twips) into twips BEFORE composing the outer translation, so an outer
 * matrix whose `tx`/`ty` are twips and whose linear part is dimensionless is
 * exactly what they want, and that is exactly what `screen.js` hands over.
 * Measured rather than argued: pushing all 187 boxes through their matrices,
 * **186 land on the 640 x 420 stage under the twips reading and 2 under the
 * pixel reading** — the one that misses is `error_message` on
 * `load_saved_gladiators`, parked at y 427.1, which the build puts below the
 * stage on purpose.
 *
 * Composition is therefore unit-clean: the linear parts multiply, and a
 * translation in twips times a dimensionless linear part is still twips.
 *
 * ## PAINT ORDER, DERIVED RATHER THAN ASSUMED
 *
 * A placement carries `path` — its chain of depths from the root down — and
 * `depth`, which is just `path[0]`. **Depth alone is not paint order**: on
 * `levelup`, twenty of the twenty-two text placements share root depth 357 and
 * are ordered only by the second element of their paths. Paint order is the
 * lexicographic order of the whole path, which is what `screen.js` already
 * sorts its `text` array by.
 *
 * Two measurements make the merge sound, both re-derived in the test:
 *
 * - **`screenFor`'s `ops` already arrive in that order** — 0 of 13612 adjacent
 *   pairs across the 26 screens are out of it.
 * - **No text placement's path is also an operation's path** — 0 collisions, so
 *   nothing has to decide which of a shape and a word goes first at one depth.
 *
 * `screenWithTextFor` still does a STABLE SORT of the concatenation rather than
 * a two-pointer merge, because the first of those is a property of this pack
 * and not of the format: a hand-edited pack whose drawables are out of order
 * must come out painted in the right order rather than silently interleaved
 * wrong. On sorted input the sort is a no-op, and the test asserts that the
 * shape operations come back in exactly the order `screenFor` emitted them.
 *
 * ## A FIELD'S VALUE IS A VARIABLE, NOT A STRING IN THE FILE
 *
 * A `DefineEditText`'s `text` is a PLACEHOLDER the author left in the `.fla`;
 * `variableName` is what the build's ActionScript actually writes to
 * (`_root.strength`, `finalscore`, `about_fight_text`). 57 of the 117 edit
 * placements carry one. So `options.values` binds on the variable name, and a
 * placement resolves its value in this order — **which is deliberately not
 * "whatever is in the file"**:
 *
 * ```text
 *   values(placement)           a function, full control, wins outright
 *   values[variableName]        the build's own name for the slot
 *   values[String(character)]   the character id, for the 60 with no name
 *   the text pack's own text    the author's placeholder      -> approximated
 *   nothing                     a hole where a live number goes -> value-unknown
 * ```
 *
 * `undefined` from a lookup means NOT SUPPLIED and falls through; `""` means
 * supplied-and-empty and stops the search, so a caller can blank a field
 * without it being reported as a value it failed to provide. **On this pack no
 * variable name is all digits**, so the two keyed lookups cannot collide here;
 * that is a measurement of one build and not a guarantee, and a caller worried
 * about it passes a function.
 *
 * ## THE INVOICE, AND WHY IT IS IN THE SAME RECORD AS THE PICTURE
 *
 * An approximation that is not counted is indistinguishable from a correct
 * read, and this project has lost six defects to exactly that. So
 * `screenTextFor` is the primary entry point and returns both;
 * `screenTextOpsFor` is the picture without the invoice and says so.
 *
 * `counts.drawn + counts.undrawn === counts.placements`, and that total is the
 * same 187 `screen.js` counts as `textNotDrawn`. **On this pack, with no values
 * bound, 159 of the 187 draw and 28 do not** — 23 of them fields waiting on a
 * live value, 5 with nothing inked to show. So `screen.js`'s `textNotDrawn: 187`
 * becomes 28 here, which is the number its header asked whoever made this join
 * to state.
 *
 * ## WHAT IT COSTS
 *
 * Measured on this machine, three runs after a warm-up: **all 26 screens
 * through `screenTextFor` in 336 ms**, of which 113 ms is `screenFor`'s shape
 * work and **223 ms is this file's 2236 glyph operations**. The widest single
 * screen's text half is `help`, at 34 ms — one static run drawing 630 letters
 * of tooltip prose. Nearly all of that is `scaleGlyphPath` rebuilding path
 * strings, which is `text.js`'s own finding and not a new one.
 *
 * Each field is laid out ONCE, inside ~~`fieldOpsFor`~~ **`fieldTextFor`**. An
 * earlier draft laid it out twice — the second pass purely to read
 * `layoutText`'s `approximated` block — and a mutation run showed why that was
 * wrong beyond the cost: the second call took a `gutter` argument that no
 * assertion could reach, because neither approximation it reports depends on
 * the gutter. Both are read from the field's own tag instead, which is one line
 * each and cannot drift from the operations beside them.
 *
 * ► **AND THE THIRD NUMBER, `overflowing`, COULD NOT BE READ THAT WAY — WHICH
 *   IS WHY THE CALL CHANGED RATHER THAN THE PASS COUNT.** It depends on the
 *   VALUE and on the gutter, not on the tag, so there was nowhere to read it
 *   from; and `fieldOpsFor` returns a bare array, so the one route that draws a
 *   screen could not see it. `text.js` now offers `fieldTextFor`, the deep call
 *   that hands over the operations and the layout's own counts together. Still
 *   one layout pass per field, and the `fieldOverflows` tally below is no longer
 *   a number nothing on this route could reach.
 *
 * As in `text.js` there is no cache in here — this module is pure — so a
 * surface redrawing a screen every frame holds onto the frozen array it gets
 * back.
 */

import { screenFor, screenNames } from "./screen.js";
import {
  TWIPS_PER_PIXEL,
  approximationMarksOf,
  fieldTextFor,
  fontFor,
  hasExtractedText,
  lineMetricsFor,
  staticTextOpsFor
} from "./text.js";

/** Never thrown by a reader. Exported so a caller can name the type it isn't getting. */
export class ScreenTextError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

const IDENTITY = Object.freeze([1, 0, 0, 1, 0, 0]);

/**
 * Every reason a placement produced NO operation at all.
 *
 * Exported as a roster rather than left implicit in the keys of a tally, so a
 * caller can render the invoice without hardcoding four strings, and so the
 * test can assert the tally has exactly these keys and no silent extra.
 */
export const SCREEN_TEXT_UNDRAWN_KINDS = Object.freeze([
  // The screen places a character the text pack has never heard of.
  "character-missing",
  // The character is there and its font is not — or is there with no glyphs.
  "font-missing",
  // An edit field with a variable name, no bound value and a blank placeholder:
  // a hole in the picture exactly where a live number goes.
  "value-unknown",
  // Resolved to a string with nothing inked in it — a lone space, or a value
  // the caller deliberately blanked.
  "nothing-to-draw"
]);

/**
 * Every way a placement that DID draw is still not what the build shows.
 *
 * ► **THIS ROSTER IS A PROJECTION OF THE OPEN TALLY, NOT THE TALLY ITSELF.**
 *   `screenTextFor` counts every mark it meets under the mark's OWN name in
 *   `approximatedByKind` and `approximatedOpsByKind`, then copies across the
 *   ones named here. A kind this roster has no key for — a glyph whose advance
 *   the extractor approximated, a sixth field kind a re-extraction introduces
 *   — is still counted, and `unrosteredApproximations` names it. The roster
 *   itself stays FIXED so a caller rendering the invoice from these eight keys
 *   does not have its layout move under it; `tools/screens/main.js` does
 *   exactly that.
 *
 * ~~The `…Ops` members count operations and the others count placements.~~
 * **HALF WRONG, AND CORRECTED AT THE CLAIM: `glyphsNotdef` COUNTS OPERATIONS
 * TOO.** It is the number of hollow `.notdef` boxes drawn, not the number of
 * placements that drew one, and it has no `Ops` suffix to say so. The key is
 * left alone rather than renamed because the operation count is the useful one
 * and it is what the screen viewer already shows; the placement-level count of
 * the same thing is `approximatedByKind.glyphsNotdef`. Every OTHER `…Ops`
 * member counts operations and every other member counts placements.
 *
 * Both kinds are here because they answer different questions and because, on
 * this pack, one of them is zero exactly where the other is not: four of the
 * five HTML fields emit no operation, so an ops-only count reports 1 where the
 * truth is 5.
 */
export const SCREEN_TEXT_APPROXIMATION_KINDS = Object.freeze([
  "filtersNotApplied",
  "filtersNotAppliedOps",
  "htmlMarkupStripped",
  "htmlMarkupStrippedOps",
  "placeholderDrawn",
  "glyphsNotdef",
  "lineHeightFromSize",
  "newlineCollapsed",
  // ► **THE NINTH KEY, ADDED 2026-09-14 FOR A CONDITION THE ALIGNMENT FIX
  //   CREATED.** A non-wrapping field used to be aligned in a box exactly as
  //   wide as its own longest line, so its slack could not go negative and it
  //   could not draw outside itself; aligning it in its own box made that
  //   possible, and for a while nothing on this route counted it. It counts
  //   PLACEMENTS with at least one overflowing line; the line count is on each
  //   placement as `overflowing`. There is deliberately no `…Ops` twin: a
  //   multiline field can overflow one line of three, so "operations affected"
  //   is not the placement's whole operation list and a spread count here would
  //   be a number that looks measured and is not.
  "fieldOverflows"
]);

/**
 * THE ONE TABLE WHERE THE TWO VOCABULARIES MEET, and the reason the counting
 * loop in `screenTextFor` contains no string literal at all.
 *
 * Keyed by the mark as it appears — camelCase for the ones `finish` pushes onto
 * a placement, kebab-case for the ones `text.js` stamps on a field or an
 * operation. Each entry says which roster key the mark projects onto:
 *
 * ```text
 *   placements  roster key counting PLACEMENTS carrying the mark, or null
 *   ops         roster key counting OPERATIONS affected by it,    or null
 *   spreads     whether a mark on a PLACEMENT is taken to affect every
 *               operation that placement emitted
 * ```
 *
 * `null` means "the roster has no name for this number", NOT "do not count it":
 * it is still in `approximatedByKind`/`approximatedOpsByKind` under its own
 * name. A mark absent from this table entirely is counted the same way AND
 * listed in `unrosteredApproximations`, which is the difference between a kind
 * this module has thought about and a kind it has never seen.
 *
 * ► **`glyphsNotdef` APPEARS TWICE AND MUST NOT BE COUNTED TWICE.** `finish`
 *   pushes the camelCase `glyphsNotdef` onto a placement that drew at least one
 *   hollow box, and `text.js` stamps the kebab-case `glyph-missing` on each of
 *   those boxes. They are the same finding at two scales, so the placement mark
 *   does NOT spread (its operations are already counted by the operation mark)
 *   and the roster's `glyphsNotdef` is projected from the OPERATION mark. On
 *   this build the two are exactly redundant — every `notdef: true` operation
 *   `text.js` emits also carries `approximated: "glyph-missing"`, both notdef
 *   branches set both fields — and the test asserts that they still agree.
 *
 * A Map rather than an object literal because the keys are pack data: a mark
 * called `constructor` or `__proto__` would find a prototype member on an
 * object and be silently mis-rostered.
 */
const APPROXIMATION_MARKS = new Map([
  ["filtersNotApplied", { placements: "filtersNotApplied", ops: "filtersNotAppliedOps", spreads: true }],
  ["html-markup-stripped", { placements: "htmlMarkupStripped", ops: "htmlMarkupStrippedOps", spreads: true }],
  ["placeholderDrawn", { placements: "placeholderDrawn", ops: null, spreads: true }],
  ["lineHeightFromSize", { placements: "lineHeightFromSize", ops: null, spreads: true }],
  ["newlineCollapsed", { placements: "newlineCollapsed", ops: null, spreads: true }],
  ["glyphsNotdef", { placements: null, ops: null, spreads: false }],
  ["fieldOverflows", { placements: "fieldOverflows", ops: null, spreads: false }],
  ["glyph-missing", { placements: null, ops: "glyphsNotdef", spreads: false }]
]);

/**
 * What an unfamiliar mark gets: counted under its own name, projected onto no
 * roster key, and — being a field- or placement-level mark until something
 * says otherwise — taken to affect every operation the placement emitted.
 */
const UNROSTERED_MARK = Object.freeze({ placements: null, ops: null, spreads: true });

/**
 * TWO PLACEMENT MATRICES, COMPOSED — outer over inner, the Flash way.
 *
 * ► **THIS IS THE FUNCTION `staticTextOpsFor` DOES NOT CALL**, and the reason
 *   this file exists. Its `matrix` option replaces the character's own matrix
 *   instead of composing with it, which is right for a caller drawing a static
 *   run somewhere of its own choosing and wrong for one drawing it where the
 *   build does.
 *
 * Both translations are in TWIPS and both linear parts are dimensionless, so
 * the product is in twips and needs no conversion. Returns a frozen array;
 * anything that is not a 6-element array is treated as the identity, because a
 * reader here is total.
 */
export function composeTextMatrix(outer, inner) {
  const [a1, b1, c1, d1, e1, f1] = matrixOr(outer);
  const [a2, b2, c2, d2, e2, f2] = matrixOr(inner);
  return Object.freeze([
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1
  ]);
}

/**
 * A 6-element matrix of finite numbers, or the identity.
 *
 * A function declaration rather than an arrow because
 * `ss2-assertion-quality.test.js` finds a helper's body by looking for the next
 * brace before the next newline; the convention is kept in src/ too so the two
 * halves of the project read the same way.
 */
function matrixOr(matrix) {
  if (!Array.isArray(matrix) || matrix.length !== 6) return IDENTITY;
  for (const value of matrix) {
    if (!Number.isFinite(value)) return IDENTITY;
  }
  return matrix;
}

/** Whether both halves are present, which is what makes any of this drawable. */
export function hasJoinableText(screenPack, textPack) {
  if (!screenPack || !screenPack.screens) return false;
  if (Object.keys(screenPack.screens).length === 0) return false;
  return hasExtractedText(textPack);
}

/**
 * ONE PLACEMENT, drawn — the atom, and the only place the two packs actually
 * touch.
 *
 * `placement` is an entry from `screenFor(...).text`. Returns a record even
 * when nothing could be drawn, because "nothing, and here is why" is the whole
 * point; returns null only when there is no text pack to ask.
 *
 * Exported because this is the unit worth testing: everything below is a loop
 * over it and a sum.
 */
export function placementTextFor(textPack, placement, options = {}) {
  // `hasExtractedText` rather than a truthiness check: a pack with no font that
  // has a glyph in it can draw nothing at all, and handing back a record full
  // of `character-missing` for it would read as a broken extraction when what
  // has actually happened is that there is no extraction.
  if (!hasExtractedText(textPack)) return null;
  if (!placement || typeof placement !== "object") return null;
  const character = placement.character;
  const path = Object.freeze([...(Array.isArray(placement.path) ? placement.path : [])]);
  const base = {
    kind: placement.kind === "text-edit" ? "text-edit" : "text-static",
    character: character ?? null,
    path,
    depth: path.length > 0 ? path[0] : null,
    variableName: typeof placement.variableName === "string" && placement.variableName.length > 0
      ? placement.variableName
      : null
  };
  return base.kind === "text-edit"
    ? fieldPlacement(textPack, base, placement, options)
    : staticPlacement(textPack, base, placement, options);
}

/**
 * A baked `DefineText`: the exporter's own glyph indices and advances, put
 * where the screen puts it.
 *
 * ► **A STATIC RUN TAKES NO VALUE.** Its advances were baked by the exporter
 *   with kerning and letter-spacing already in them — `text.js` measures that
 *   deriving them from the font reproduces the baked ones only 78% of the time
 *   — so there is no honest way to retype one. A caller that wants different
 *   words wants `textOpsFor` and its own layout, not this.
 */
function staticPlacement(textPack, base, placement, options) {
  const item = textPack.statics?.[base.character] ?? textPack.statics?.[String(base.character)];
  if (!item || !Array.isArray(item.records)) {
    return finish(base, { ops: [], undrawn: "character-missing", value: null, source: "none", matrix: matrixOr(placement.matrix) }, options, placement);
  }
  // ► The composition `staticTextOpsFor` does NOT do: its own `matrix` option
  //   replaces `item.matrix` rather than composing with it. See this module's
  //   header, item 1, and the 94.42 px it is worth on the real pack.
  const matrix = composeTextMatrix(placement.matrix, item.matrix);
  const ops = staticTextOpsFor(textPack, base.character, { matrix }) ?? [];
  const undrawn = ops.length > 0 ? null : "nothing-to-draw";
  // The words are known from the SCREENS pack only: `text.json`'s static
  // records carry glyph indices and no decoded string at all.
  const value = typeof placement.text === "string" ? placement.text : "";
  return finish(base, { ops, undrawn, value, source: "baked", matrix }, options, placement);
}

/** A `DefineEditText`: a box, a font, and a value that comes from outside it. */
function fieldPlacement(textPack, base, placement, options) {
  const field = textPack.fields?.[base.character] ?? textPack.fields?.[String(base.character)];
  const matrix = matrixOr(placement.matrix);
  if (!field) {
    return finish(base, { ops: [], undrawn: "character-missing", value: null, source: "none", matrix }, options, placement);
  }
  // `fontFor` is null for a font with an EMPTY glyph table as well as for an
  // absent one, which `text.js` explains: a whole line of `.notdef` boxes is a
  // broken pack pretending to draw. Either way this field cannot be set, and
  // that is a different finding from a character the pack has never heard of.
  const font = fontFor(textPack, field.font);
  if (!font) {
    return finish(base, { ops: [], undrawn: "font-missing", value: null, source: "none", matrix }, options, placement);
  }

  const bound = boundValue(base, options.values);
  // ► The placeholder comes from the TEXT pack, never from `placement.text`.
  //   See this module's header, item 2: the screens pack keeps the raw markup.
  const placeholder = typeof field.text === "string" ? field.text : "";
  const source = bound === undefined ? "placeholder" : "bound";
  const value = bound === undefined ? placeholder : String(bound);

  const drawn = fieldTextFor(textPack, base.character, { matrix, text: value, gutter: options.gutter });
  const ops = drawn ? drawn.ops : [];
  // ► **THE LINES THAT CAME OUT WIDER THAN THE BOX THEY WERE ALIGNED IN.**
  //   Before `text.js` learned to align a non-wrapping field in its own box,
  //   that box WAS the line's own width, the slack could not be negative, and a
  //   field could not spill out of itself. It can now, and an overflowing
  //   centred field draws over whatever is beside it — which is the defect the
  //   alignment fix was made to cure, reappearing from the other end. `text.js`
  //   counts it; nothing on this route read the count, because `fieldOpsFor`
  //   returns an array and an array cannot carry one. `fieldTextFor` is the
  //   deep call that hands over both, at the cost of no extra layout pass.
  //
  //   ► **ZERO ON THIS PACK, AND NOT VACUOUSLY SO.** With the pack's own
  //     placeholder text all 272 laid-out lines fit (re-derived 2026-09-14), so
  //     the number below is 0 on every one of the 26 screens as they stand.
  //     What makes it non-zero is the thing a screen is FOR: a bound value.
  //     `createchar`'s field 1619 is a 42.95 px box holding the placeholder
  //     "6"; bind a twelve-digit value to it and the line is 91.05 px, this is
  //     1, and the first glyph lands 22 px left of the box, on the "strength"
  //     label. `test/render-screen-text.test.js` binds exactly that and asserts
  //     the count moves — so it is a counter with an input that reaches it, not
  //     a zero nothing could disturb.
  const overflowing = drawn ? drawn.overflowing : 0;
  // ► **THE TWO APPROXIMATIONS `layoutText` WOULD REPORT ARE READ DIRECTLY
  //   INSTEAD OF LAYING THE FIELD OUT A SECOND TIME.** An earlier draft called
  //   `fieldLayoutOptionsFor` and `layoutText` here purely to reach
  //   `approximated.byKind`, which cost a second pass over every field and,
  //   worse, took a `gutter` argument that no assertion could reach: neither
  //   kind it reports depends on the gutter, so deleting the argument left the
  //   whole suite green. Both conditions are one line of the field's own tag.
  //   (`overflowing` above is the case that argument DOES reach — the gutter
  //   sets the box width — and it comes off the same single pass rather than a
  //   second one.)
  // `lineMetricsFor` says so itself when a font carries no layout block.
  const lineHeightFromSize = lineMetricsFor(font, field.fontHeight / TWIPS_PER_PIXEL).approximated === "line-height-from-size";
  // `splitLines` joins a single-line field's breaks into one line with spaces.
  const newlineCollapsed = field.multiline !== true && /\r|\n/.test(value);

  let undrawn = null;
  if (ops.length === 0) {
    // A field whose placeholder is blank and whose variable nobody bound is not
    // "empty"; it is a value this renderer does not have. Calling those two the
    // same thing is how a screen full of missing numbers reads as finished.
    undrawn = source === "placeholder" && base.variableName !== null && /^\s*$/.test(placeholder)
      ? "value-unknown"
      : "nothing-to-draw";
  }
  return finish(base, {
    ops,
    undrawn,
    value,
    source,
    matrix,
    // ► **THE FIELD'S OWN MARKS, THROUGH THE SAME ONE READER.** `tools/extract-text.mjs`
    //   writes a STRING here (`html-markup-stripped` on five of the 256 fields),
    //   and this line used to be the last `typeof … approximated` in `src/` — a
    //   second reader of the same key, which is how the shapes diverged in the
    //   first place. It costs nothing to read both, and "there is one reader" is
    //   only true if there is.
    marks: approximationMarksOf(field.approximated),
    lineHeightFromSize,
    newlineCollapsed,
    overflowing
  }, options, placement);
}

/**
 * The value a caller bound to this placement, or `undefined` for "not supplied".
 *
 * ► **`undefined` AND `""` ARE DIFFERENT ANSWERS HERE.** `undefined` falls
 *   through to the placeholder and, failing that, is counted as
 *   `value-unknown`; `""` is a caller saying this field is empty right now, and
 *   stops the search. Collapsing the two would make "I blanked it" and "nobody
 *   told me" the same number.
 */
function boundValue(base, values) {
  if (values === null || values === undefined) return undefined;
  if (typeof values === "function") return values(base);
  const get = values instanceof Map
    ? (key) => (values.has(key) ? values.get(key) : undefined)
    : (key) => (Object.prototype.hasOwnProperty.call(values, key) ? values[key] : undefined);
  if (base.variableName !== null) {
    const byName = get(base.variableName);
    if (byName !== undefined) return byName;
  }
  if (base.character === null || base.character === undefined) return undefined;
  return get(String(base.character));
}

/**
 * Stamp the path onto every operation and work out what is still approximate.
 *
 * The path travels ON each operation for two reasons: `screenWithTextFor` sorts
 * by it, and a person looking at one wrong glyph on a screen needs the chain of
 * depths that put it there without having to find which placement it came from.
 */
function finish(base, resolved, options, placement) {
  const filtered = options.filtered === true;
  const stamped = resolved.ops.map((op) => Object.freeze({
    ...op,
    source: "text",
    character: base.character,
    textKind: base.kind,
    path: base.path,
    depth: base.depth,
    ...(filtered ? { filtered: true } : {})
  }));

  const approximated = [];
  if (filtered) approximated.push("filtersNotApplied");
  // Whatever the field itself declares, under the extractor's own name for it —
  // never folded into a count of `html-markup-stripped`, which is hazard 5.
  for (const mark of resolved.marks ?? []) {
    if (!approximated.includes(mark)) approximated.push(mark);
  }
  if (base.kind === "text-edit" && resolved.source === "placeholder" && stamped.length > 0) {
    approximated.push("placeholderDrawn");
  }
  const notdef = stamped.reduce((sum, op) => sum + (op.notdef === true ? 1 : 0), 0);
  if (notdef > 0) approximated.push("glyphsNotdef");
  if (resolved.lineHeightFromSize) approximated.push("lineHeightFromSize");
  if (resolved.newlineCollapsed) approximated.push("newlineCollapsed");
  // A static run has no box to overflow — its advances ARE its width — so only
  // `fieldPlacement` ever supplies this, and `?? 0` is the static's answer
  // rather than a defensive default.
  const overflowing = Number.isFinite(resolved.overflowing) ? resolved.overflowing : 0;
  if (overflowing > 0) approximated.push("fieldOverflows");

  return Object.freeze({
    ...base,
    matrix: Object.freeze([...resolved.matrix]),
    // What was actually laid out. For a static this is the screens pack's
    // decoding of the baked indices; for a field it is the bound value or the
    // text pack's placeholder, and `valueSource` says which.
    value: resolved.value,
    valueSource: resolved.source,
    box: placement?.box ?? null,
    ops: Object.freeze(stamped),
    drawn: stamped.length > 0,
    undrawn: resolved.undrawn,
    notdef,
    // LINES wider than their box, where `approximations.fieldOverflows` counts
    // PLACEMENTS that have at least one. Both are wanted: a three-line field
    // with one long line is one placement and one line, and a tally that only
    // knew the placement count could not tell that from all three spilling.
    overflowing,
    approximated: Object.freeze(approximated)
  });
}

/**
 * ONE SCREEN'S TEXT: the glyph operations and the tally of what is still
 * missing, in one record, because a caller must not be able to take the picture
 * without the invoice.
 *
 * Returns null when either pack is absent or when this pack holds no such
 * screen — a caller reads `screenNames` rather than guessing.
 *
 * @param {object} screenPack from `screenPackFrom`
 * @param {object} textPack   from `textPackFrom`
 * @param {string} name       a screen name
 * @param {object} [options]
 * @param {object|Map|Function} [options.values] live values, by variable name
 * @param {number} [options.gutter] the field inset, in pixels; see `FIELD_GUTTER_PX`
 */
export function screenTextFor(screenPack, textPack, name, options = {}) {
  if (!hasJoinableText(screenPack, textPack)) return null;
  const record = screenFor(screenPack, name);
  if (!record) return null;

  // `screen.js` does not carry the filter prefixes onto a text placement the
  // way it does onto an operation, so they are re-read here. Same rule it
  // states: by PATH PREFIX, because a filter on a nested clip affects
  // everything inside it and nothing beside it.
  // Keyed on the NAME asked for, not on the record's own `name`: `screenFor`
  // looks the screen up by the key, and a pack whose entry carries a different
  // `name` field would otherwise have its filters read off a different screen.
  const prefixes = filterPrefixesOf(screenPack.screens[name] ?? screenPack.screens[record.name]);

  const placements = [];
  const ops = [];
  const undrawnByKind = {};
  for (const kind of SCREEN_TEXT_UNDRAWN_KINDS) undrawnByKind[kind] = 0;
  // ► **THE OPEN TALLY IS THE ONE THAT COUNTS AND THE ROSTER IS COPIED OUT OF
  //   IT BELOW.** Maps, not objects, for the reason `APPROXIMATION_MARKS` is
  //   one: these keys come from the packs, and a mark called `__proto__` would
  //   hit a setter on an object literal and vanish — an uncounted
  //   approximation produced by the code that exists to stop them.
  const approximatedByKind = new Map();
  const approximatedOpsByKind = new Map();
  const unrostered = new Set();

  for (const placement of record.text) {
    const filtered = underAnyPrefix(placement.path, prefixes);
    const resolved = placementTextFor(textPack, placement, { ...options, filtered });
    // ► **UNREACHABLE, AND SAID OUT LOUD BECAUSE A SILENT `continue` IS HOW A
    //   COUNT DRIFTS.** `hasJoinableText` above has already established the
    //   text pack, and `screen.js` only ever puts frozen objects in `text`, so
    //   the only way here is a caller reaching past both. What catches it if it
    //   ever happens is `counts.placements`, which the test compares against
    //   `screenFor(...).text.length` on every one of the 26 screens.
    if (!resolved) continue;
    placements.push(resolved);
    if (resolved.undrawn) undrawnByKind[resolved.undrawn] += 1;

    // The marks the OPERATIONS carry, gathered on the pass that collects them.
    //
    // ► **AN OPERATION CARRIES A LIST *OR* A STRING, AND EITHER GUESS ALONE IS
    //   WRONG ABOUT HALF THE TREE.** `text.js` used to put one string in that
    //   slot; it now puts every reason in a frozen array (see ONE MARK PER
    //   OPERATION in this file's header) — but `emitDrawable` in
    //   `src/render/screen.js` and `emitPropOps` in `src/render/props.js` still
    //   copy the extractor's STRING through untouched, and `screenWithTextFor`
    //   below puts both kinds in one array.
    //   So a `typeof op.approximated === "string"` guard would silently count
    //   nothing here, and an `Array.isArray` guard would silently count nothing
    //   on the merged list. Neither guess is written down twice: the ONE reader
    //   is `approximationMarksOf`, in `text.js` beside the producer that
    //   changed shape, and it takes both. Anything that is neither reads as no
    //   marks, the way every other reader here treats pack data.
    const opMarks = new Map();
    for (const op of resolved.ops) {
      ops.push(op);
      for (const mark of new Set(approximationMarksOf(op.approximated))) {
        opMarks.set(mark, (opMarks.get(mark) ?? 0) + 1);
      }
    }

    // Rule one: a mark on the PLACEMENT counts one placement and, unless the
    // table says it does not spread, every operation the placement emitted.
    const placementMarks = new Set(resolved.approximated);
    for (const mark of placementMarks) {
      const entry = markEntry(mark, unrostered);
      bump(approximatedByKind, mark, 1);
      if (entry.spreads) bump(approximatedOpsByKind, mark, resolved.ops.length);
    }
    // Rule two: a mark on an OPERATION counts that operation, and counts its
    // placement ONCE — skipped entirely when the placement already carries the
    // same mark, which is how `html-markup-stripped` avoids being counted from
    // both ends.
    for (const [mark, count] of opMarks) {
      if (placementMarks.has(mark)) continue;
      // Called for its side effect and not its answer: `spreads` is a rule about
      // placement marks, and an operation mark counts only its own operations.
      // What is wanted here is the question being ASKED, so an unfamiliar mark
      // on an operation is named rather than silently counted.
      markEntry(mark, unrostered);
      bump(approximatedByKind, mark, 1);
      bump(approximatedOpsByKind, mark, count);
    }
  }

  // THE PROJECTION. Every roster key is copied out of the open tally, so the
  // two cannot drift; a key no mark projects onto stays at the zero it was
  // initialised with.
  const approximations = {};
  for (const kind of SCREEN_TEXT_APPROXIMATION_KINDS) approximations[kind] = 0;
  for (const [mark, entry] of APPROXIMATION_MARKS) {
    if (entry.placements !== null) approximations[entry.placements] = approximatedByKind.get(mark) ?? 0;
    if (entry.ops !== null) approximations[entry.ops] = approximatedOpsByKind.get(mark) ?? 0;
  }

  const drawn = placements.filter((entry) => entry.drawn).length;
  return Object.freeze({
    name: record.name,
    labelFrame: record.labelFrame,
    stage: record.stage,
    placement: record.placement,
    ops: Object.freeze(ops),
    placements: Object.freeze(placements),
    undrawnByKind: Object.freeze(undrawnByKind),
    approximations: Object.freeze(approximations),
    // ► **THE OPEN TALLY, BY THE MARK'S OWN NAME.** Kinds that did not occur
    //   are ABSENT rather than zero: a key here is a thing that happened. The
    //   two vocabularies are deliberately mixed — `filtersNotApplied` beside
    //   `advance-from-outline` — because renaming one into the other is what
    //   loses the kinds this module has no name for.
    approximatedByKind: frozenCounts(approximatedByKind),
    approximatedOpsByKind: frozenCounts(approximatedOpsByKind),
    // ► **EVERY KIND THE ROSTER HAS NO KEY FOR, BY NAME.** Empty on this
    //   extraction, which is a measurement of one pack and not a guarantee: the
    //   text pack's own manifest counts 112 `advance-from-outline` and 2
    //   `advance-from-sibling-font` glyphs in font 1510, and the only static on
    //   these 26 screens that names that font draws a single EMPTY glyph, so
    //   not one of the 114 reaches an operation here. A re-extraction, or one
    //   more placement, and it does — and then this array says so instead of
    //   the count being 187 approximations reported as 0.
    unrosteredApproximations: Object.freeze([...unrostered].sort()),
    counts: Object.freeze({
      // The same number `screen.js` reports as `approximations.textNotDrawn`.
      placements: placements.length,
      drawn,
      undrawn: placements.length - drawn,
      ops: ops.length,
      statics: placements.filter((entry) => entry.kind === "text-static").length,
      fields: placements.filter((entry) => entry.kind === "text-edit").length,
      bound: placements.filter((entry) => entry.valueSource === "bound").length
    })
  });
}

/**
 * The glyph operations alone, in paint order, or null.
 *
 * ► **THIS THROWS THE COUNTS AWAY AND THAT IS THE WHOLE RISK OF USING IT** —
 *   the same warning `screenOpsFor` carries, for the same reason. On this pack
 *   it silently drops 28 placements this renderer could not draw and 108 it
 *   drew without their filters. Use `screenTextFor`.
 */
export function screenTextOpsFor(screenPack, textPack, name, options = {}) {
  const record = screenTextFor(screenPack, textPack, name, options);
  return record && record.ops.length > 0 ? record.ops : null;
}

/**
 * THE WHOLE SCREEN — shapes and words in one paint order, with both invoices.
 *
 * The two tallies are kept SEPARATE rather than summed: `screen.approximations`
 * is `screen.js`'s, `text.approximations` is this file's, and a number that
 * appears in both would otherwise be counted twice by whoever adds them up.
 * `counts.textStillNotDrawn` is the one number that changes meaning — it is
 * what is left of `screen.approximations.textNotDrawn` after this join.
 *
 * ► **THE SHAPE INVOICE IS NESTED, NOT ABSENT.** `screen.approximations`,
 *   `screen.blankets` and the rest of `screenFor`'s record are reachable here as
 *   `record.screen.…`, and `tools/screens/main.js` already binds them that way
 *   (`const screen = current.screen; const a = screen.approximations;`). They
 *   are deliberately NOT copied up: two tallies summed into one top-level block
 *   would double-count every number that appears in both, and a second copy of
 *   `blankets` is a second thing to drift. A verifier reading this join on
 *   2026-09-14 concluded that a count on `screen` "still cannot be read" by the
 *   viewer; it can, and is — what the viewer does not do is RENDER the blanket
 *   roster, which is a gap in that file and not in this record's shape.
 *
 * Returns null when there is no screen to draw; when the TEXT pack alone is
 * missing this still returns the screen, with an empty text half and
 * `textPresent: false`, because a caller that has screens and no fonts should
 * draw the screens.
 *
 * ► **`ops` CARRIES TWO SHAPES OF `approximated` AND A CONSUMER MUST BE TOLD
 *   SO.** This is one array built out of two producers that disagree about the
 *   type under that key, and the disagreement was created by the fix for a
 *   producer/reader mismatch of exactly this kind:
 *
 * ```text
 *   src/render/text.js    glyph ops   a frozen LIST of reasons
 *   src/render/screen.js  shape ops   the extractor's STRING, copied (line 647)
 *   src/render/props.js               the same line (line 366) — not in this
 *                                     array, but the same key and the same shape
 * ```
 *
 *   Measured over all 26 screens on 2026-09-14: **274 of the merged operations
 *   carry a mark — 209 strings (`gradient` x180, `bitmap` x29) and 65 lists
 *   (`html-markup-stripped` x65).** Nothing in this tree walks the MERGED array
 *   for marks today, so it is a trap rather than a live defect; it is written
 *   down here because the next person to walk it will otherwise write one
 *   `typeof` and lose 65 or 209 marks with no error.
 *
 *   **Read the key with `approximationMarksOf` from `text.js` — the one reader
 *   both shapes go through.** The tally in `screenTextFor` above already does.
 *   The proper repair is for `screen.js` and `props.js` to emit lists too, at
 *   which point the census becomes 0 / 274 and every reader here is unchanged;
 *   `test/render-screen-text.test.js` asserts the INVARIANT (every mark on
 *   every merged operation is readable, and no operation carries a shape that
 *   is neither) rather than the 209/65 split, so converting them turns nothing
 *   red.
 */
export function screenWithTextFor(screenPack, textPack, name, options = {}) {
  const screen = screenFor(screenPack, name);
  if (!screen) return null;
  const text = screenTextFor(screenPack, textPack, name, options);

  const merged = [...screen.ops, ...(text ? text.ops : [])];
  // A stable sort, not a merge: see the header. Array.prototype.sort has been
  // stable since ES2019, so operations sharing a path keep the order the two
  // halves emitted them in and a shape at a path draws under a word at the same
  // one — which no placement on this pack actually does.
  merged.sort((left, right) => comparePath(left.path, right.path));

  return Object.freeze({
    name: screen.name,
    labelFrame: screen.labelFrame,
    stage: screen.stage,
    placement: screen.placement,
    ops: Object.freeze(merged),
    screen,
    text,
    textPresent: text !== null,
    counts: Object.freeze({
      shapeOps: screen.ops.length,
      glyphOps: text ? text.ops.length : 0,
      ops: merged.length,
      textPlacements: text ? text.counts.placements : screen.text.length,
      textDrawn: text ? text.counts.drawn : 0,
      // What `screen.approximations.textNotDrawn` has been reduced TO. Its
      // header asked whoever made this join to say what the new number is.
      textStillNotDrawn: text ? text.counts.undrawn : screen.text.length
    })
  });
}

/** Every screen name both packs can answer for, in the root timeline's order. */
export function joinableScreenNames(screenPack, textPack) {
  if (!hasJoinableText(screenPack, textPack)) return Object.freeze([]);
  return screenNames(screenPack);
}

/* ------------------------------------------------------------------ */
/* The tally                                                           */
/* ------------------------------------------------------------------ */

/**
 * What `APPROXIMATION_MARKS` says about a mark, and a note in `unrostered` when
 * it says nothing at all.
 *
 * The side effect is the point: the ONLY way a kind reaches
 * `unrosteredApproximations` is by being looked up here, so a mark cannot be
 * counted without the question "is this one we have a name for?" being asked
 * about it.
 */
function markEntry(mark, unrostered) {
  const entry = APPROXIMATION_MARKS.get(mark);
  if (entry !== undefined) return entry;
  unrostered.add(mark);
  return UNROSTERED_MARK;
}

/** Add to a counter in a Map, creating it at zero first. */
function bump(counts, key, by) {
  if (by <= 0) return;
  counts.set(key, (counts.get(key) ?? 0) + by);
}

/**
 * A counting Map as a frozen plain object, sorted by kind so two runs of the
 * same screen read the same.
 *
 * `Object.fromEntries` defines own data properties, so a kind called
 * `__proto__` lands as a key here rather than reassigning the prototype — the
 * hazard that made the accumulator a Map in the first place.
 */
function frozenCounts(counts) {
  return Object.freeze(Object.fromEntries([...counts].sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0))));
}

/* ------------------------------------------------------------------ */
/* Paths                                                               */
/* ------------------------------------------------------------------ */

/** The `filteredPlacements` paths of one raw screen entry, defensively. */
function filterPrefixesOf(screen) {
  const out = [];
  for (const entry of Array.isArray(screen?.filteredPlacements) ? screen.filteredPlacements : []) {
    if (Array.isArray(entry?.path)) out.push(entry.path);
  }
  return out;
}

/**
 * Whether a leaf sits under any of them. Same rule as `screen.js`'s.
 *
 * ► **THE ONLY GUARD HERE THAT DOES ANYTHING IS THE EMPTY ONE.** A prefix
 *   LONGER than the path needs no test — the comparison below reaches an index
 *   past the end of `path`, gets `undefined`, and fails — and an earlier
 *   version of this function carried that redundant length check, which a
 *   mutation run deleted with the whole suite still green. An EMPTY prefix is
 *   different: it is vacuously a prefix of everything, so a hand-edited pack
 *   with one `filteredPlacements` entry missing its path would mark every word
 *   on the screen filtered and quietly inflate the tally.
 */
function underAnyPrefix(path, prefixes) {
  if (!Array.isArray(path)) return false;
  for (const prefix of prefixes) {
    if (prefix.length === 0) continue;
    let matches = true;
    for (let index = 0; index < prefix.length; index += 1) {
      if (path[index] !== prefix[index]) { matches = false; break; }
    }
    if (matches) return true;
  }
  return false;
}

/** Lexicographic on the chain of depths, shorter first. `screen.js`'s own. */
function comparePath(left, right) {
  const a = Array.isArray(left) ? left : [];
  const b = Array.isArray(right) ? right : [];
  const shortest = Math.min(a.length, b.length);
  for (let index = 0; index < shortest; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return a.length - b.length;
}
