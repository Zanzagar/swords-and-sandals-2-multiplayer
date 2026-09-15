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
 *   4. ~~**108 of the 187 placements sit under a FILTERLIST nothing applies** —
 *      58%, the same defect `screen.js` reports for 69% of its path operations,
 *      and invisible in exactly the same way. `screen.js` marks its own ops
 *      `filtered: true`; the text placements it hands over carry no such mark,
 *      so this file re-reads `filteredPlacements` from the pack and marks and
 *      counts them itself.~~ **113, NOT 108, AND THEY ARE NOW DRAWN RATHER
 *      THAN COUNTED — see FILTERS ON WORDS below.** Both halves of the struck
 *      sentence were wrong in the same way: re-reading `filteredPlacements`
 *      here was a SECOND reader of the pack, and it saw neither the pack's
 *      second filter list (`filteredButtonRecords`, five entries, which is the
 *      whole of the 108/113 gap) nor `entry.filters`, so the glows could not
 *      have been drawn from here even in principle.
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
 * ## FILTERS ON WORDS — THE GLOW IS ON THE FIELD, NEVER ON THE LETTER
 *
 * 112 of this build's 113 filtered text placements carry a GLOW and nothing
 * else, and until 2026-09-15 not one of them reached anything at all. They were
 * counted — `filtersNotApplied`, 108 of them under the old reader — and a count
 * is what you write down when you cannot draw the thing.
 *
 * ► **`screen.js` NOW HANDS OVER THE FILTER RECORDS, SO THIS FILE READS ITS
 *   `filterGroups` ROSTER AND STOPPED READING THE PACK ITSELF.** That roster is
 *   built from BOTH of the pack's filter lists and carries `entry.filters`
 *   verbatim; the reader it replaces did neither. The whole of the 108-to-113
 *   difference is `filteredButtonRecords` — five `leaf: "text"` entries on
 *   `townsquare` (characters 1789, 1793, 1797, 1801, 1805 at paths
 *   `[59,353,1]` … `[59,361,1]`) carrying a dark red
 *   `drop-shadow(0px 0px 2.2361px rgba(102, 0, 0, 1))` that nothing in either
 *   module had ever seen.
 *
 * ### THE ONE RULE, AND THE LEVEL AT WHICH IT BITES
 *
 * ► **FLASH RASTERISES A FILTERED GROUP AND FILTERS THE COMPOSITE**, which is
 *   the rule `screen.js` states for shapes and which costs it a 1523-operation
 *   group. Here it looks at first as though it costs nothing: measured on this
 *   build, **all 113 groups that reach a word sit EXACTLY on the field they
 *   filter** — the group's path IS the placement's path, all 187 text paths are
 *   distinct, and not one is shared with a shape operation. A `DefineEditText`
 *   or `DefineText` is a LEAF of the display list, so the filtered subtree and
 *   the field are the same thing and per-group and per-leaf genuinely coincide.
 *   **That is the case `screen.js`'s header invites someone to find, and this
 *   is it.**
 *
 * ► **AND IT IS A TRAP, BECAUSE THE LEAF IS THE FIELD AND NOT THE GLYPH.** A
 *   field is not one drawable here: it is between 1 and 630 glyph operations.
 *   Across the 26 screens, **1689 glyph operations sit under those 113 fields**
 *   — a median of 8 per field, and `help`'s character 1542 is a single static
 *   run of 630 letters of tooltip prose. Setting `ctx.filter` per operation
 *   would draw **630 separate haloes, one around each letter**, where the build
 *   draws one soft edge around the paragraph. It is not a rough version of the
 *   right picture; it is a different picture, and it looks deliberate. So the
 *   filter is emitted ONCE PER PLACEMENT — `placement.filter` and
 *   `placement.filterStages` — and **nothing is stamped on a glyph operation**,
 *   which `test/render-screen-text.test.js` asserts rather than leaving to
 *   habit.
 *
 * ### WHAT A PAINTER DOES WITH THEM
 *
 * For each placement with a non-null `filter`: rasterise that placement's own
 * `ops` to an offscreen, set the offscreen's `ctx.filter`, composite it. For
 * the general case walk `record.filterGroups`, which gives each filtered
 * subtree the half-open range `[opFirst, opEnd)` into `record.ops` that it
 * covers, the placements under it, and `shapeOpCount` — the SHAPE operations
 * the same subtree covers, which is 0 on every one of this build's 113 and
 * which a per-field routine cannot rasterise. Three hazards, all of them
 * `screen.js`'s too:
 *
 * - **`filter` is the SCALE-1 string.** `ctx.filter` lengths are not scaled by
 *   `ctx.setTransform` (`filters.js` says so and says it is unmeasured), and
 *   `stageFitFor` letterboxes the stage, so a painter calls
 *   `canvasFilterFor(stage.filters, { scale })` itself. The records travel on
 *   every stage for exactly that.
 * - **`colourMatrices` is NOT in `filter`.** 0 on this build's text and 31
 *   string-less groups on its shapes; `filtersDeferredToColourMatrix` counts it
 *   here so a painter reading `filter` alone can be told it dropped one.
 * - **`record.ops` is re-sorted by `screenWithTextFor`**, so a painter working
 *   on the MERGED array re-matches on `path` rather than reusing the range.
 *   That is exact and cheap for text: every operation of a placement carries
 *   the PLACEMENT's path.
 *
 * ### THE FIVE GLOWS, BY NAME
 *
 * ```text
 *   52  drop-shadow(0px 0px 0.6455px rgba(0, 0, 0, 1))    1527, 1528
 *   52  drop-shadow(0px 0px 1px rgba(0, 0, 0, 1))         43 characters
 *    5  drop-shadow(0px 0px 2.2361px rgba(102, 0, 0, 1))  1789…1805 (buttons)
 *    2  drop-shadow(0px 0px 1.3165px rgba(0, 0, 51, 1))   1520, "emperor's
 *                                                       reign" on splash and
 *                                                       new_or_continue
 *    1  drop-shadow(0px 0px 4.5826px rgba(0, 0, 0, 1))    2123, the word "vs"
 *                                                       on arena_intro
 *    1  (no filter record at all)                         2292 (gameover_demo)
 * ```
 *
 * The first row is the arena's UI bar: **characters 1527 and 1528, `soundvar`
 * and `tooltips_text`, the two `DefineEditText` children of sprite 1531 that
 * `props.js` records under `effects.own.dropped` because it has no shape to put
 * them on.** They are on all 26 screens, they are 52 of the 113, and their
 * words — `sound:ON` and `tooltips:off` — have been drawing flat since the join
 * was written. Three modules met the same two characters from three directions;
 * this is the one that can finally draw them.
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
 * The invoice has four names for what became of a filter, and they are four
 * different questions about the same 113 placements rather than a partition:
 * `filtersCarried` (112) is a canvas filter string handed over,
 * `filtersDeferredToColourMatrix` (0) is a matrix `filter` cannot express,
 * `filtersRefused` (0) is a record canvas cannot express at all, and
 * `filtersNotApplied` (1) is a placement under a filter that got none of the
 * three. `counts.underAFilter` (113) is the denominator for all four, and
 * `counts.underANoOpFilterOnly` (0) is the part of the last one that is not a
 * loss.
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
 * ~~Measured on this machine, three runs after a warm-up: **all 26 screens
 * through `screenTextFor` in 336 ms**, of which 113 ms is `screenFor`'s shape
 * work and **223 ms is this file's 2236 glyph operations**.~~ **RE-MEASURED
 * 2026-09-15, AFTER THE FILTER WORK: 106-124 ms for all 26 screens, of which
 * 35 ms is `screenFor`.** The struck numbers are not what the filter groups
 * cost — they are three times too high across the board, so they were measured
 * on a busier machine, and today's were taken with several agents running, so
 * treat the RATIO rather than either absolute. What matters for this seam is
 * that matching 248 filter groups against 187 placements is 26 screens x
 * (groups x text) prefix tests and does not show up at all. The widest single
 * screen's text half is `help`, one static run drawing 630 letters of tooltip
 * prose. Nearly all of the time is `scaleGlyphPath` rebuilding path strings,
 * which is `text.js`'s own finding and not a new one.
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

import { canvasFilterFor,
  glowAmplificationFor,
} from "./filters.js";
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
  // ► **THE TENTH THROUGH FIFTEENTH KEYS, ADDED 2026-09-15, AND THE FIRST TWO
  //   CHANGED MEANING UNDER THEM.** Until then this module knew only that a
  //   placement sat under a FILTERLIST — `screen.js` handed over a path and
  //   nothing else — so `filtersNotApplied` counted all 108 of them and there
  //   was no second number to compare it with. `screen.js` now hands over the
  //   filter RECORDS on each group, `canvasFilterFor` turns 112 of the 113 into
  //   a real `drop-shadow(...)`, and "under a filterlist" and "under a
  //   filterlist this module can do nothing with" stopped being the same
  //   question. They are split here rather than renamed, because
  //   `tools/screens/main.js` prints this roster key by key and a key that
  //   vanishes takes its row with it.
  //
  // ~~A placement under a FILTERLIST nothing applies.~~ **NARROWED: a placement
  // under a filter group this module hands the painter NOTHING for — no canvas
  // filter string and no colour matrix.** On the real packs that is 1 placement
  // and 0 operations (`gameover_demo`'s character 2292, whose `filters` list is
  // empty), where it used to be 108 and 1643.
  "filtersNotApplied",
  "filtersNotAppliedOps",
  // The other side of that split, and the one that is now the big number: the
  // placement's glow reached the painter. 112 placements and 1680 operations.
  // It is in THIS roster and not a "drawn correctly" one because a CSS
  // `drop-shadow` is not a Flash glow — `canvasFilterFor` marks every one of
  // the 112 `exact: false`, `shadowStrengthAsAlpha`, because all 112 are
  // strength 10 and CSS can only scale the shadow colour's alpha.
  "filtersCarried",
  "filtersCarriedOps",
  // ► **THE HAZARD `screen.js` NAMES FOR ITS OWN PAINTER, ONE LEVEL DOWN.** A
  //   colour matrix is NOT in `filter` — `canvasFilterFor` defers it to
  //   `applyColourMatrix` — so a painter that reads `filter` and nothing else
  //   drops it while reporting that it applied the filters. ZERO on this
  //   build's text (`screen.js` counts 57 such groups among the SHAPES, 31 of
  //   them producing no string at all); the synthetic pack puts one on a field
  //   so the counter has an input that reaches it.
  "filtersDeferredToColourMatrix",
  "filtersDeferredToColourMatrixOps",
  // A filter record canvas cannot express at all — an inner glow, a knockout,
  // a bevel. ZERO on this build's text, and the zero is not vacuous: the
  // synthetic pack in `test/render-screen-text.test.js` puts an inner glow on a
  // field and watches both numbers move.
  "filtersRefused",
  "filtersRefusedOps",
  // ► **THE ONE THAT SAYS A PER-FIELD RASTERISE WOULD BE WRONG.** A glow on a
  //   text field is a glow on the field's rendered result, so the painter
  //   rasterises the field's glyphs once and filters the composite — but that
  //   is only the whole story when the filtered SUBTREE is the field and
  //   nothing else. When the group is an ancestor covering other fields or
  //   shapes as well, the field is a part of a bigger picture and the painter
  //   must composite the GROUP. Measured on this build: 0 — all 113 groups sit
  //   exactly on the field they filter — and the synthetic pack's `[55]` over
  //   the field at `[55, 2]` is the case that makes the counter move.
  "filtersOnAWiderGroup",
  "filtersOnAWiderGroupOps",
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
  // ► **THE FOUR FILTER MARKS ARE NOT MUTUALLY EXCLUSIVE, AND THAT IS THE
  //   POINT.** They answer four different questions about one placement, so a
  //   field under a group carrying one glow and one bevel is BOTH
  //   `filtersCarried` and `filtersRefused`, and their sum is not the number of
  //   filtered placements. The denominator for all four is
  //   `counts.underAFilter`, which is counted once per placement and is the
  //   only number any of them may be read as a fraction of.
  ["filtersNotApplied", { placements: "filtersNotApplied", ops: "filtersNotAppliedOps", spreads: true }],
  ["filtersCarried", { placements: "filtersCarried", ops: "filtersCarriedOps", spreads: true }],
  ["filtersDeferredToColourMatrix", { placements: "filtersDeferredToColourMatrix", ops: "filtersDeferredToColourMatrixOps", spreads: true }],
  ["filtersRefused", { placements: "filtersRefused", ops: "filtersRefusedOps", spreads: true }],
  ["filtersOnAWiderGroup", { placements: "filtersOnAWiderGroup", ops: "filtersOnAWiderGroupOps", spreads: true }],
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
 *
 * ► **`options.filterGroups` REPLACED `options.filtered` ON 2026-09-15, AND THE
 *   OLD OPTION IS NOW IGNORED RATHER THAN HONOURED.** It was a boolean meaning
 *   "there is a filterlist somewhere above this", which is all `screen.js` could
 *   say at the time; a caller still passing it gets a placement with no stages,
 *   which is the honest answer — a boolean cannot say what the filter WAS, and
 *   inventing an empty stage from one would report a dropped filter that may
 *   never have existed. Nothing outside this module ever set it (grepped), and
 *   `screenTextFor` is the only caller in the tree.
 *
 * @param {object} textPack from `textPackFrom`
 * @param {object} placement an entry from `screenFor(...).text`
 * @param {object} [options]
 * @param {object[]} [options.filterGroups] the filtered subtrees this placement
 *   sits under, OUTERMOST FIRST — `screenFor(...).filterGroups`, filtered by
 *   path prefix. Each needs a `path` and a `filters` list; `coversTextPlacements`
 *   and `coversShapeOps` beside them let `filterStagesFor` use a measurement
 *   instead of its local path-equality fallback.
 * @param {object|Map|Function} [options.values] live values, by variable name
 * @param {number} [options.gutter] the field inset, in pixels
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
  const stages = filterStagesFor(base, options);
  const filtered = stages.length > 0;
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
  // ► **FOUR QUESTIONS WHERE THERE USED TO BE ONE `if (filtered)`.** The old
  //   line read `if (filtered) approximated.push("filtersNotApplied")`, which
  //   was the only honest thing to say when the only thing this module knew
  //   about a filter was that there was one. Now that the records travel, a
  //   glow that reached the painter must not be reported as a glow that did
  //   not; and a glow that could not be expressed, and a group wider than the
  //   field, are two more facts that the single boolean could not carry.
  if (stages.some((stage) => stage.filter !== null)) approximated.push("filtersCarried");
  if (stages.some((stage) => stage.colourMatrices.length > 0)) approximated.push("filtersDeferredToColourMatrix");
  if (filtered && !stages.some((stage) => stage.carries)) approximated.push("filtersNotApplied");
  if (stages.some((stage) => stage.refused.length > 0)) approximated.push("filtersRefused");
  if (stages.some((stage) => !stage.ownsThisFieldAlone)) approximated.push("filtersOnAWiderGroup");
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
    // ► **THE FILTER, ONCE PER FIELD — see FILTERS ON WORDS in this file's
    //   header.** `filter` is the scale-1 `ctx.filter` string for an offscreen
    //   holding exactly THIS placement's `ops`, and it is null whenever that is
    //   not the whole story: no filter, more than one nested stage, or a group
    //   wider than the field. `filterStages` is always the authority and is
    //   always present; `filter` is the shortcut for the case that is 112 of
    //   the build's 113.
    filter: filtered && stages.length === 1 && stages[0].ownsThisFieldAlone ? stages[0].filter : null,
    filterStages: Object.freeze(stages),
    approximated: Object.freeze(approximated)
  });
}

/**
 * THE FILTERED SUBTREES THIS PLACEMENT SITS IN, INNERMOST FIRST — the order a
 * painter applies them.
 *
 * `options.filterGroups` is what `screenTextFor` reads off `screenFor`'s own
 * `filterGroups` roster, OUTERMOST FIRST; a caller driving `placementTextFor`
 * on its own may hand over anything with a `path` and a `filters` list.
 *
 * ► **THE STRING IS BUILT HERE, FROM `group.filters`, RATHER THAN COPIED OFF
 *   `group.filter`.** `screen.js` has already computed the same string for the
 *   same records, so copying would be one call cheaper and would make this
 *   module's output depend on which producer filled the group in. Building it
 *   means a hand-made group `{ path, filters }` and one of `screen.js`'s behave
 *   identically, and it keeps `canvasFilterFor` the ONE translator the brief
 *   asks for rather than making `screen.js` a second one. The two derivations
 *   are asserted to agree on all 113 of the build's text groups.
 *
 * ► **AND IT IS THE SCALE-1 STRING**, for the reason `screen.js` states at its
 *   own decision 3: `ctx.filter` lengths are not scaled by `ctx.setTransform`
 *   (`filters.js` says so and says it is unmeasured), and `stageFitFor`
 *   letterboxes the stage, so a painter drawing at any other scale calls
 *   `canvasFilterFor(stage.filters, { scale })` itself. `filters` travels on
 *   every stage for exactly that.
 *
 * ► **AN EMPTY PATH IS SKIPPED AND COUNTED, NOT HONOURED.** `[]` is vacuously a
 *   prefix of every path, so a truncated pack whose one filter entry lost its
 *   path would put a glow on every word on the screen — an approximation
 *   INVENTED rather than dropped, which is the same defect from the other end.
 *   `screenTextFor` counts those under `filterGroupsWithNoPath`.
 */
function filterStagesFor(base, options) {
  const groups = Array.isArray(options.filterGroups) ? options.filterGroups : [];
  const stages = [];
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    const path = Array.isArray(group?.path) ? group.path : null;
    if (path === null || path.length === 0) continue;
    if (!isPrefixOf(base.path, path)) continue;
    const built = canvasFilterFor(group.filters);
    stages.push(Object.freeze({
      path: Object.freeze([...path]),
      source: typeof group.source === "string" ? group.source : null,
      character: Number.isFinite(group.character) ? group.character : null,
      // The records verbatim, so a painter rebuilds the string at its own scale.
      filters: Object.freeze([...(Array.isArray(group.filters) ? group.filters : [])]),
      filter: built.filter,
      // ► **THE AMPLIFIED PLAN TRAVELS BESIDE THE STRING, NEVER INSTEAD OF IT.**
      //   `null` for all but a saturating glow list, and a painter that does not
      //   know the field keeps drawing exactly what it drew before. See
      //   `glowAmplificationFor` for what it describes and why it declines.
      amplify: glowAmplificationFor(group.filters, { scale: 1 }),
      applied: built.applied,
      deferred: built.deferred,
      noOps: built.noOps,
      refused: built.refused,
      colourMatrices: built.colourMatrices,
      counts: built.counts,
      // ► **WHAT "CARRIED" MEANS, IN ONE PLACE.** A stage carries something
      //   when the painter is handed a filter string OR a colour matrix to
      //   apply to the rasterised field. A `noOp` carries nothing and needs
      //   nothing — `canvasFilterFor` has already MEASURED that it draws no
      //   pixels — and a refusal carries nothing and needs something, which is
      //   why they are two counters rather than one.
      carries: built.filter !== null || built.colourMatrices.length > 0,
      // ► **THE GROUP IS THIS FIELD AND NOTHING ELSE — TWO TESTS, AND THE
      //   MEASURED ONE WINS WHEN IT IS THERE.** `screenTextFor` counts, for
      //   each group, how many text placements and how many SHAPE operations
      //   sit under it, and hands both down; one text placement and no shapes
      //   is the case where rasterising this field alone and filtering it is
      //   exactly the build's own picture.
      //
      //   A caller driving this function on its own has measured nothing, and
      //   falls back to path EQUALITY: a `DefineEditText` or `DefineText` is a
      //   LEAF of the display list — it has no children — so a filtered subtree
      //   whose path IS the placement's path can contain nothing but the
      //   placement. That is exact for a text leaf and it is the reason the two
      //   tests agree on all 113 of this build's text groups, which
      //   `test/render-screen-text.test.js` asserts rather than this paragraph.
      ownsThisFieldAlone: Number.isFinite(group.coversTextPlacements) && Number.isFinite(group.coversShapeOps)
        ? group.coversTextPlacements === 1 && group.coversShapeOps === 0
        : path.length === base.path.length
    }));
  }
  return stages;
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

  // ► ~~`screen.js` does not carry the filter prefixes onto a text placement the
  //   way it does onto an operation, so they are re-read here.~~ **REPLACED
  //   2026-09-15, AND THE DELETED VERSION HAD TWO DEFECTS THAT ONLY A SECOND
  //   READER CAN HAVE.** `filterPrefixesOf` read `screen.filteredPlacements`
  //   out of the raw pack itself, which meant (a) it never saw
  //   `filteredButtonRecords`, the pack's SECOND filter list — five entries,
  //   all on `townsquare`, all `leaf: "text"`, so this module counted 108
  //   filtered placements where the truth is 113 — and (b) it read `path` and
  //   dropped `filters`, so nothing here could have drawn a glow even in
  //   principle. `screenFor`'s own `filterGroups` roster is built from BOTH
  //   lists and carries the records; reading it is one derivation instead of
  //   two, and `test/render-screen-text.test.js` pins the 113 against the raw
  //   pack's own two arrays so the two modules cannot drift.
  //
  // ► **AND IT IS READ TOTALLY.** An older or hand-stubbed `screen.js` with no
  //   `filterGroups` must not throw and must not silently report a build with
  //   no filters on its words: `filterGroupsPresent` on the record says which
  //   of those two worlds this is.
  const filterGroupsPresent = Array.isArray(record.filterGroups);
  const groups = filterGroupsPresent ? record.filterGroups : [];
  let filterGroupsWithNoPath = 0;
  // How much of the screen each filtered subtree actually covers, measured
  // BEFORE any placement is resolved, because "is this group just this one
  // field?" is a question about the whole screen and a placement cannot answer
  // it about itself.
  const coverageAt = new Map();
  for (const group of groups) {
    if (!Array.isArray(group?.path)) continue;
    if (group.path.length === 0) { filterGroupsWithNoPath += 1; continue; }
    let coversTextPlacements = 0;
    for (const placement of record.text) {
      if (isPrefixOf(placement.path, group.path)) coversTextPlacements += 1;
    }
    coverageAt.set(group.path.join(","), {
      coversTextPlacements,
      // `screen.js` counts the SHAPE operations under the group. `-1` rather
      // than 0 when it did not say, so "unknown" cannot read as "none": -1 is
      // finite, so `filterStagesFor` still takes the MEASURED branch and it
      // answers no — a group whose shape coverage is unknown is not claimed to
      // own one field alone. Optimism here is what puts a per-field glow on a
      // composite that was never rasterised as one.
      coversShapeOps: Number.isFinite(group.opCount) ? group.opCount : -1
    });
  }

  const placements = [];
  const ops = [];
  // Where each placement's operations start and end in `ops`. Filled while the
  // operations are pushed, so the group ranges below index the array they were
  // derived from — the same reasoning `screen.js` gives for its own ranges.
  const opSpans = [];
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
    // OUTERMOST FIRST, which is the order `filterStagesFor` reverses into the
    // order a painter applies them. `screen.js` sorts its drafts ancestor-first
    // by `comparePath`, so the roster is already in that order and this filter
    // preserves it; sorting again here would be a second opinion about nesting.
    const covering = groups
      .filter((group) => Array.isArray(group?.path)
        && group.path.length > 0
        && isPrefixOf(placement.path, group.path))
      // The coverage this module measured, carried on a shallow copy so that
      // `filterStagesFor` uses the measurement rather than its own local
      // fallback. `screen.js`'s `opCount` is the SHAPE operations under the
      // group; the text count is this file's, because `screen.js` emits no text.
      .map((group) => ({ ...group, ...(coverageAt.get(group.path.join(",")) ?? {}) }));
    const resolved = placementTextFor(textPack, placement, { ...options, filterGroups: covering });
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
    opSpans.push({ first: ops.length, end: ops.length + resolved.ops.length });
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

  // ► **THE GROUP ROSTER — THE THING A PAINTER ACTUALLY WALKS.** The invoice
  //   above says how many fields carry a glow; this says WHICH, with the
  //   operations each one covers. Built out of the placements' own stages
  //   rather than recomputed from `groups`, so the roster and the placements
  //   cannot give two answers about the same filter.
  //
  //   ► **THE RANGE IS INTO THIS RECORD'S `ops` AND NOWHERE ELSE.** Same cost
  //     and same caveat `screen.js` states for its own: it is derived in this
  //     call from the array it indexes, and `ops` is frozen before it leaves —
  //     but `screenWithTextFor` re-sorts the concatenation of two arrays, so a
  //     painter working on the MERGED list re-matches on `path`. That is exact
  //     and cheap for text: every operation of a placement carries the
  //     PLACEMENT's path, so one comparison finds the whole field.
  const filterGroups = [];
  const groupAt = new Map();
  for (let index = 0; index < placements.length; index += 1) {
    const span = opSpans[index];
    for (const stage of placements[index].filterStages) {
      const key = stage.path.join(",");
      let entry = groupAt.get(key);
      if (entry === undefined) {
        const from = groups.find((group) => Array.isArray(group?.path) && group.path.join(",") === key);
        entry = {
          path: stage.path,
          source: stage.source,
          character: stage.character,
          filters: stage.filters,
          filter: stage.filter,
          applied: stage.applied,
          deferred: stage.deferred,
          noOps: stage.noOps,
          refused: stage.refused,
          colourMatrices: stage.colourMatrices,
          counts: stage.counts,
          carries: stage.carries,
          // The stage's own answer, not a second rule: `filterStagesFor`
          // already decided this from the coverage measured above, and two
          // spellings of one question is how the counts in this file drift.
          ownsOneFieldAlone: stage.ownsThisFieldAlone,
          // ► **THE SHAPE OPERATIONS THE SAME GROUP COVERS, FROM `screen.js`.**
          //   Zero on every one of this build's 113 text groups — they sit on
          //   leaf text fields — and non-zero would mean the painter must
          //   rasterise shapes and words TOGETHER before filtering, which no
          //   per-field routine can do. Carried rather than assumed, and
          //   `-1` when `screen.js` did not say.
          shapeOpCount: Number.isFinite(from?.opCount) ? from.opCount : -1,
          placements: [],
          opFirst: span.first,
          opEnd: span.first,
          opCount: 0
        };
        groupAt.set(key, entry);
        filterGroups.push(entry);
      }
      entry.placements.push(index);
      if (span.end > span.first) {
        if (entry.opCount === 0) entry.opFirst = span.first;
        entry.opEnd = Math.max(entry.opEnd, span.end);
        entry.opCount += span.end - span.first;
      }
    }
  }
  let filterGroupsCarrying = 0;
  let filterGroupsWiderThanOneField = 0;
  for (const group of filterGroups) {
    group.contiguous = group.opEnd - group.opFirst === group.opCount;
    if (group.carries) filterGroupsCarrying += 1;
    if (!group.ownsOneFieldAlone) filterGroupsWiderThanOneField += 1;
    group.placements = Object.freeze(group.placements);
    Object.freeze(group);
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
    // ► **THE FILTERED SUBTREES THAT REACH A WORD, WITH THE OPERATIONS EACH
    //   ONE COVERS.** This is the list a painter walks: for each entry,
    //   rasterise `ops[opFirst .. opEnd)` to an offscreen, set the offscreen's
    //   `ctx.filter` to `filter` (rebuilt at the painter's own scale from
    //   `filters`), and composite it. See FILTERS ON WORDS in this file's
    //   header for why that is once per FIELD and not once per glyph.
    filterGroups: Object.freeze(filterGroups),
    // Whether `screenFor` gave us a roster at all. FALSE means every filter
    // count below is a zero this module could not have measured, which is a
    // different thing from a build with no filters on its words.
    filterGroupsPresent,
    counts: Object.freeze({
      // The same number `screen.js` reports as `approximations.textNotDrawn`.
      placements: placements.length,
      drawn,
      undrawn: placements.length - drawn,
      ops: ops.length,
      statics: placements.filter((entry) => entry.kind === "text-static").length,
      fields: placements.filter((entry) => entry.kind === "text-edit").length,
      bound: placements.filter((entry) => entry.valueSource === "bound").length,
      // ► **THE DENOMINATOR FOR ALL SIX FILTER ROSTER KEYS, AND THE ONLY
      //   NUMBER ANY OF THEM MAY BE READ AS A FRACTION OF.** The four marks
      //   overlap by design (a group carrying one glow and one bevel is both
      //   carried and refused), so their sum is not this and never was.
      //   Measured across the 26 screens: 113 of the 187 placements and 1689 of
      //   the 2236 glyph operations.
      underAFilter: placements.filter((entry) => entry.filterStages.length > 0).length,
      underAFilterOps: placements.reduce((sum, entry) => sum + (entry.filterStages.length > 0 ? entry.ops.length : 0), 0),
      // ► **THE PART OF `filtersNotApplied` THAT IS NOT A LOSS, so the
      //   difference between the two names the silent one.** A filter
      //   `canvasFilterFor` has MEASURED to draw nothing — `Blur(0, 0)`, a
      //   zero-strength glow — is dropped on purpose and costs the picture
      //   nothing; a filter list that is empty, or one every record of which
      //   was refused, is a real hole. `screen.js` reports the same pair for
      //   its operations and for the same reason. On this build:
      //   `filtersNotApplied` 1, this 0, so the one hole is real — it is
      //   `gameover_demo`'s character 2292, whose `filters` list is empty.
      underANoOpFilterOnly: placements.filter((entry) => entry.filterStages.length > 0
        && !entry.filterStages.some((stage) => stage.carries)
        && entry.filterStages.every((stage) => stage.counts.total === stage.counts.noOp && stage.counts.noOp > 0)).length,
      // The groups themselves, as their own denominator: 113 reach a word, 112
      // of them carry something a painter can use, 0 cover anything but the one
      // field they sit on.
      filterGroups: filterGroups.length,
      filterGroupsCarrying,
      filterGroupsWiderThanOneField,
      // ► **AN ENTRY WHOSE `path` IS `[]` IS SKIPPED, AND SKIPPING IT SILENTLY
      //   IS THE DEFECT THIS COUNTS AWAY.** An empty path is vacuously a prefix
      //   of every path on the screen, so honouring one would put a glow on
      //   every word — an approximation INVENTED rather than dropped. 0 on this
      //   build; a truncated pack is what makes it move.
      filterGroupsWithNoPath
    })
  });
}

/**
 * The glyph operations alone, in paint order, or null.
 *
 * ► **THIS THROWS THE COUNTS AWAY AND THAT IS THE WHOLE RISK OF USING IT** —
 *   the same warning `screenOpsFor` carries, for the same reason. On this pack
 *   it silently drops 28 placements this renderer could not draw and — worse
 *   now than when this sentence was written — **the 113 filter groups that go
 *   with the words**: a bare operation array carries no `filterGroups` and no
 *   placement, so ~~108 it drew without their filters~~ every one of the 1689
 *   glyph operations under a glow comes back flat, with nothing to say so. Use
 *   `screenTextFor`.
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
 * ► **AND SO IS THE TEXT'S FILTER ROSTER: `record.text.filterGroups`.** It is
 *   deliberately not copied up beside `screen.filterGroups`, for the same
 *   reason the invoices are not summed — two rosters at one level invite a
 *   painter to concatenate them, and they index DIFFERENT arrays
 *   (`screen.ops` and `text.ops`), neither of which is the merged `ops` this
 *   record returns. A painter working on the merged array re-matches on `path`;
 *   `tools/screens/main.js` already does exactly that, and it finds the glyph
 *   operations under the text groups because `screen.filterGroups` carries all
 *   248 group PATHS including the 113 that reach no shape.
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

/**
 * ~~The `filteredPlacements` paths of one raw screen entry, defensively.~~
 * ~~Whether a leaf sits under any of them. Same rule as `screen.js`'s.~~
 * **BOTH DELETED 2026-09-15, AND THEY WERE A SECOND READER OF THE PACK.**
 * `filterPrefixesOf` read `screen.filteredPlacements` out of the raw entry and
 * `underAnyPrefix` matched against it; between them they saw neither the pack's
 * second filter list (`filteredButtonRecords` — five entries, and this module
 * therefore reported 108 filtered placements where the truth is 113) nor
 * `entry.filters` (so no glow could have been drawn from here even in
 * principle). `screenFor`'s `filterGroups` roster answers both, is built from
 * both lists, and is the one derivation. What survives of them is the single
 * prefix test below and the EMPTY-PATH guard, which is the half that was load-
 * bearing: a length guard was redundant — the comparison runs off the end of
 * the shorter array and gets `undefined` — and a mutation run deleted it with
 * the suite still green, while an empty path is vacuously a prefix of
 * everything and would put a glow on every word on the screen.
 *
 * Whether `path` sits inside the subtree rooted at `prefix`.
 */
function isPrefixOf(path, prefix) {
  if (!Array.isArray(path) || !Array.isArray(prefix)) return false;
  for (let index = 0; index < prefix.length; index += 1) {
    if (path[index] !== prefix[index]) return false;
  }
  return true;
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
