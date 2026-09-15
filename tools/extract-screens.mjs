/**
 * THE TWENTY-SIX SCREENS — every root frame the build labels, out of the
 * player's own install and into gitignored `assets/screens/`.
 *
 * ## Why this is a fourth extractor rather than an option on `extract-props`
 *
 * `extract-props.mjs` takes a CLOSED LIST of clips it can name a reader for,
 * and that decision is right for props. It is the wrong shape for screens,
 * because a screen is not a clip at all: **it is a moment on the ROOT
 * timeline**, and the root timeline is the one thing in the file that is not a
 * `DefineSprite`. There is no character id to declare and nothing in
 * `ExportAssets` to look up.
 *
 * Measured on the oracle: **136 distinct characters are placed across the 26
 * screens and exactly FOUR carry an export name** — 486 `helmet14`, 566
 * `weapon49`, 945 `shield12`, 492 `inventory_overlay`, all three of the first
 * being the wardrobe pieces the help screen shows off. So the shops, the town,
 * the dungeon and the church are unreachable by linkage and must be taken BY
 * CHARACTER ID off the root display list.
 *
 * ## The root timeline as a pseudo-sprite
 *
 * `resolveTimeline` wants a `{bodyStart, bodyEnd, frames}` from
 * `indexCharacters`. The root has no such record because nothing defines it, so
 * `rootTimeline()` below builds one: the tag stream from `tagStreamStart` to
 * the end of the file. It is given `id: -1` so that a caller who passes it back
 * into a character map cannot collide with a real character, and `frames: 0` so
 * `resolveTimeline`'s trailing-frame guard never fires — the root's frame count
 * is whatever its `ShowFrame` tags say, which is 270.
 *
 * ## A SCREEN IS CUMULATIVE, and that is the whole reason this works
 *
 * The root never clears its display list between screens. Depth 1 (character
 * 643) and depth 1193 (character 646) are live on all 270 frames; depth 438
 * (`fiz_info_panel`, character 1531) on 261 of them. So every screen inherits
 * the same chrome from frame 1, and taking a snapshot AT the label — rather
 * than the tags between two labels — is what gets the whole picture.
 *
 * ## WHAT THIS FOUND, and it contradicts the committed record
 *
 * ► **CHARACTER 643 IS PLACED WITH `alphaMultiplier = 0` AND IS THEREFORE
 *   DRAWN ON NO SCREEN AT ALL.** One `PlaceObject2` at root frame 1 (tag body
 *   `0x5b753`, flags `0x0e`, depth 1, character 643, identity matrix) carries a
 *   CXFORMWITHALPHA at `0x5b759` whose first byte is `0x69`: `hasAdd = 0`,
 *   `hasMultiply = 1`, `nbits = 10`, and the four multiply terms decode
 *   `1, 1, 1, 0`. Nothing on any of the 270 frames moves or replaces depth 1,
 *   and the placement carries no instance name, so no ActionScript can address
 *   it. **`extract-props.mjs` declares 643 as the arena's `backdrop` — "EXACTLY
 *   THE STAGE... the sky and ground the whole fight happens against" — and the
 *   build never draws it.** That entry extracts the CLIP, which is real and 640
 *   x 420; what it cannot see is the root PLACEMENT, which is transparent.
 *
 *   This is the same defect class as the invisible walls, mirrored: there, a
 *   thing the build draws was dropped; here, a thing the build does not draw
 *   was added. Both are silent, and both are invisible to an extractor that
 *   never reads the root.
 *
 * ► **TWO SCREENS ARE NOT STILL ACROSS THEIR OWN FRAME RANGE**, and 24 are.
 *   `splash` (10..34) moves `fiz_info_panel` by 10 twips at frame 11 and is
 *   otherwise identical; `church` (195..202) REMOVES the church itself at 202.
 *   Counted per screen as `rangeVariance` rather than assumed away.
 *
 * ## What is approximated here, and every one of them is COUNTED
 *
 * An approximation that is not counted is indistinguishable from a correct
 * read. So each screen's record carries an `approximations` block and the
 * manifest recomputes it:
 *
 *   `nestedSpriteFrame1`  a nested clip with N > 1 frames, rendered at frame 1.
 *                         The sky is 200 frames of `time_of_day`; the sand and
 *                         the crowd are 6 of `current_arena`. Frame 1 is ONE of
 *                         those, not the screen.
 *   `buttonUpState`       a `DefineButton2` expanded to its UP records only.
 *                         Over, down and hit are not drawn.
 *   `buttonNoUpState`     a button with NO up record — 32 of the build's 158
 *                         are hit areas and expand to nothing LEGITIMATELY.
 *                         Counted so an empty expansion is never mistaken for
 *                         a failed one.
 *   `filters`             a placement carrying a FILTERLIST that is not
 *                         applied. 51 of the 320 top-level placements on these
 *                         screens have one; 243 counting every nesting level.
 *                         ► **THE NAME IS WRONG AND IS KEPT ANYWAY.** It counts
 *                         filtered PLACEMENTS, not filters: the same 243
 *                         placements carry **271** typed filter records, so
 *                         reading this as "filters not applied" under-reports
 *                         by 28. `filterRecords` beside it is the filter count.
 *                         Renaming it would break `approximations.fromPack`
 *                         readers in files this one does not own, so the
 *                         correction lives here, at the instruction.
 *   `filterRecords`       the TYPED FILTERS those placements carry — 271 across
 *                         the 26 screens: 140 glow, 57 colourMatrix, 56 blur,
 *                         16 dropShadow, 2 bevel. Every one is now written out
 *                         beside its placement, so `src/render/filters.js` can
 *                         read them; the approximation is that this tool still
 *                         applies none of them itself.
 *   `filterListEmpty`     a placement whose FILTERLIST is present and CARRIES
 *                         NOTHING — 5 in the build, 1 reached by a screen. It
 *                         is counted inside `filters` above because the flag is
 *                         set, and there is nothing there to apply, so a reader
 *                         that subtracts this gets the honest denominator.
 *   `filtersInButtonRecords`
 *                         FILTERS (not records) on a BUTTONRECORD, which
 *                         `filteredPlacements` does not reach at all:
 *                         `nestedSprites` walks sprites and the button's
 *                         records are expanded somewhere else entirely.
 *                         Measured on the oracle: the build's 158 buttons hold
 *                         704 records, 34 of them filtered, 13 of those UP —
 *                         and the 26 screens reach 5 UP records carrying 5
 *                         filters. They are listed in `filteredButtonRecords`
 *                         with their own paths rather than merged into
 *                         `filteredPlacements`, because two producers writing
 *                         one list with different path conventions is how a
 *                         seam rots.
 *   `buttonRecordsFiltered`
 *                         the same roster counted in RECORDS — 5 here, equal to
 *                         the filter count only by coincidence. Both are
 *                         printed because the whole point of `filterRecords`
 *                         beside `filters` is that placements and filters are
 *                         not the same number, and the button pair had the same
 *                         ambiguity until 2026-09-14.
 *   `buttonRecordsFilteredOverText`
 *                         ► **OF THOSE 5 RECORDS, 5 PLACE A `DefineText`, SO
 *                         THE ROSTER REACHES NO DRAWABLE ON THIS BUILD AT
 *                         ALL.** Not 5 of the screens' — ALL THIRTEEN filtered
 *                         UP records in the file place a text character
 *                         (measured by kind: `{ text: 13 }`). The five are the
 *                         town square's menu glows, on "Armoury |
 *                         Weaponsmith | Enter the Arena | Magic Shop |
 *                         Church"; each entry's path is EXACTLY the path of one
 *                         `staticText` entry, and a prefix match against
 *                         `drawables` finds zero. Counted rather than left to
 *                         be discovered, because a roster described as though
 *                         it reaches operations, which reaches none, is the
 *                         same defect as a count that cannot vary.
 *   `filterListEmptyInButtonRecords`
 *                         a BUTTONRECORD declaring a FILTERLIST that carries
 *                         nothing — the button-side twin of `filterListEmpty`.
 *                         ~~Dropped by a bare `continue` before any counter.~~
 *                         Corrected 2026-09-14: the placement path treats this
 *                         case as evidence and the button path threw it away
 *                         silently, which is two treatments of one fact. It is
 *                         now rostered with `filters: []` exactly as a
 *                         placement is. 0 on this build, so the correction
 *                         moves no number and is latent, not live.
 *   `filterListUnreadInButtonRecords`
 *                         `hasFilters` set with no array behind it. Structurally
 *                         unreachable — `parseButtonRecords` sets both off one
 *                         flag bit — and counted for the same reason
 *                         `filterListUnread` is. 0, always.
 *   `filtersInButtonSubtrees`
 *                         ► **A FILTERED `PlaceObject3` INSIDE A SPRITE THAT AN
 *                         UP RECORD PLACES.** `nestedSprites` walks the ROOT
 *                         display list, so until 2026-09-14 these were in
 *                         neither roster and in no count: 49 UP records across
 *                         the build place a sprite, and anything filtered
 *                         inside one was invisible to `filteredPlacements`, to
 *                         `filterRecords`, and to the 9,423-operation prize,
 *                         with nothing saying so. The walk now runs, and its
 *                         finds go into `filteredPlacements` — the same roster,
 *                         because they are the same TAG under the same path
 *                         convention `flattenFrame` gives their leaves, and
 *                         only a BUTTONRECORD's own list needs a second
 *                         roster. **Measured 0 on this build**, so the number
 *                         in `filters` did not move; what changed is that a
 *                         future one would be counted instead of dropped.
 *   `buttonSubtreesUnreadable`
 *                         an UP record's sprite whose timeline would not
 *                         resolve, so its subtree could not be searched for
 *                         filters. A `catch` with a name on it. 0 here.
 *   `blendModes`          a placement carrying a non-normal blend mode.
 *   `gradientPaths`       `shapeToPaths` hands the real gradient on beside a
 *   `bitmapPaths`         flat first-stop fallback; a bitmap fill comes back
 *                         `fill: "none"` with the bitmap id, for
 *                         `extract-bitmaps.mjs` to supply.
 *   `invisibleDrawables`  composed `alphaMultiplier` of 0. Drawn by the data,
 *                         drawn by nothing else.
 *   `staticTextGlyphs`    `DefineText` glyph indices are NOT resolved to
 *                         characters: that needs the font's code table, which
 *                         this tool does not read. Its box and matrix are
 *                         exported so the words can be set over it.
 *
 * ## THREE PARSERS IN THIS FILE ARE DUPLICATES, AND THAT IS A COLLISION TO FOLD
 *
 * ► **`indexFonts`, `parseStaticText` and `parseEditText` below were written
 *   here, and a SIBLING AGENT shipped the same three in the same session** as
 *   `tools/swf-fonts.mjs` (`indexFonts`, `parseGlyphShape`, `parseFont3`,
 *   `kerningBetween`) and `tools/swf-text.mjs` (`parseText`, `parseEditText`,
 *   `textToString`, `indexText`), plus `parseButton`/`buttonStateDisplayList`
 *   in `tools/swf-display-list.mjs`. This file does not import them because
 *   they were being authored while this one was measured, and importing a
 *   module mid-authorship is how a deliverable breaks under its own test run.
 *
 * ► **THE TWO READINGS WERE CROSS-CHECKED AND AGREE EVERYWHERE**, measured on
 *   the oracle: all **9** font code tables identical, all **256**
 *   `DefineEditText` characters identical in `variableName` and `initialText`,
 *   all **180** `DefineText` characters decoding to the same string. The two
 *   were written to DIFFERENT briefs — screens here, fonts and icons there —
 *   so this is corroboration rather than the correlated agreement AGENTS.md
 *   warns about; it is still two readers of one specification, not a runtime
 *   measurement.
 *
 * ► **SO THE RIGHT FOLD IS THEIRS, and it buys something this file does not
 *   have**: `swf-fonts.mjs` carries `parseGlyphShape`, which is the GLYPH
 *   OUTLINES — the one thing `staticTextGlyphs` below counts as still missing.
 *   Whoever folds these should delete the three parsers here, import the two
 *   modules, and the `staticTextGlyphs` approximation stops being an
 *   approximation.
 *
 * ## The rule every extractor here obeys
 *
 * **Assets come out of the player's own install and never into the
 * repository.** `assets/` is gitignored AND `test/asset-attestation.test.js`
 * fails if anything under it is tracked. Doom/WAD model: clone this repo and
 * you still need your own licensed copy.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { parseShape, shapeToPaths } from "./swf-shapes.mjs";
import { parseMorphShape, morphShapeAt, morphToPaths, ratioOf } from "./swf-morph-shapes.mjs";
import {
  TAG,
  indexCharacters,
  resolveTimeline,
  walkTags,
  flattenFrame,
  tagStreamStart,
  readMatrix,
  readColourTransform,
  // ► **`parseFilterList`, NOT `skipFilterList`, and the two return the SAME
  //   cursor.** This file stepped over every BUTTONRECORD's filter list for as
  //   long as it has existed, which cost nothing while nothing downstream could
  //   apply a filter and costs 10 records the moment something can. The stepper
  //   and the decoder are pinned against each other by a test in
  //   `test/swf-display-list.test.js`, so `read.next` here is byte-for-byte
  //   where `skipFilterList` used to leave the cursor.
  parseFilterList,
  IDENTITY_COLOUR_TRANSFORM
} from "./swf-display-list.mjs";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The same default every other tool that reads the build uses. */
const DEFAULT_SWF =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";

/**
 * The oracle's sha256. Recorded and REPORTED — never enforced.
 *
 * Exported so the test file can ANCHOR its `fs.existsSync(ORACLE)` guard on it:
 * a path that exists is not the same fact as the build every number in this
 * file was measured against, and a guard that cannot tell them apart skips
 * silently on the wrong install.
 */
export const ORACLE_SHA256 = "77cb545c2061ab41246251467a4edf5926ab6fd1ddd95dc9527d7ba9c45bb8ca";

const TWIPS_PER_PIXEL = 20;

/**
 * The three font tags, which `swf-display-list.mjs`'s `TAG` table does not
 * carry because nothing there needs them — a font defines no character the
 * display list can place. Named here rather than added there: this file is the
 * only reader, and widening a shared table for one caller is how a module stops
 * being about one thing.
 */
const TAG_DEFINE_FONT = 10;
const TAG_DEFINE_FONT2 = 48;
const TAG_DEFINE_FONT3 = 75;

export class ExtractScreensError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * The root timeline dressed as a sprite, so `resolveTimeline` can play it.
 *
 * ► **`frames: 0` IS DELIBERATE.** `resolveTimeline` ends with
 *   `if (frames.length < sprite.frames) snapshot()`, which exists so a clip
 *   whose last frame has no trailing `ShowFrame` still has that frame. The root
 *   has no declared frame count to compare against — the file header's
 *   `FrameCount` describes the main timeline but is not what the tag stream
 *   necessarily contains — so 0 makes that guard a no-op and lets the
 *   `ShowFrame` tags decide. Measured on the oracle: 270 frames, 26 labels.
 *
 * ► **`id: -1` IS ALSO DELIBERATE.** Character ids are unsigned on the wire, so
 *   -1 cannot collide with a real one if this record is ever put in a map
 *   beside them.
 */
/**
 * The stage, in pixels, straight off the file header's FrameSize RECT.
 *
 * Every screen's matrices are relative to this box, so a renderer that does not
 * know it has no frame to put the picture in. Measured on the oracle: 640 x 420
 * at the origin, which is also exactly the size of character 643's art — the
 * clip the root then places with `alphaMultiplier` 0 and never draws.
 */
export function stageRect(buffer) {
  const { rect } = readRect(buffer, 8);
  return {
    xMin: px(rect.xMin), xMax: px(rect.xMax),
    yMin: px(rect.yMin), yMax: px(rect.yMax),
    width: px(rect.xMax - rect.xMin), height: px(rect.yMax - rect.yMin)
  };
}

export function rootTimeline(buffer) {
  return {
    id: -1,
    kind: "sprite",
    tagCode: TAG.DEFINE_SPRITE,
    frames: 0,
    bodyStart: tagStreamStart(buffer),
    bodyEnd: buffer.length
  };
}

/** A bit cursor. RECTs and MATRIXes inside a tag body are not byte-aligned. */
class BitCursor {
  constructor(buffer, start) {
    this.buffer = buffer;
    this.byte = start;
    this.bit = 0;
  }

  align() {
    if (this.bit !== 0) {
      this.bit = 0;
      this.byte += 1;
    }
  }

  ub(bits) {
    let value = 0;
    for (let index = 0; index < bits; index += 1) {
      value = (value << 1) | ((this.buffer[this.byte] >>> (7 - this.bit)) & 1);
      this.bit += 1;
      if (this.bit === 8) {
        this.bit = 0;
        this.byte += 1;
      }
    }
    return value >>> 0;
  }

  sb(bits) {
    if (bits === 0) return 0;
    const raw = this.ub(bits);
    const sign = 1 << (bits - 1);
    return (raw & sign) ? raw - (1 << bits) : raw;
  }
}

/**
 * A RECT, in TWIPS, and the byte after it.
 *
 * Its field width is a 5-bit count at the front, so a RECT cannot be skipped by
 * a constant — which is the same trap `tagStreamStart` documents for the file
 * header.
 */
export function readRect(buffer, offset) {
  const cursor = new BitCursor(buffer, offset);
  const bits = cursor.ub(5);
  const rect = {
    xMin: cursor.sb(bits), xMax: cursor.sb(bits),
    yMin: cursor.sb(bits), yMax: cursor.sb(bits)
  };
  cursor.align();
  return { rect, next: cursor.byte };
}

function readCString(buffer, start, end) {
  let cursor = start;
  while (cursor < end && buffer[cursor] !== 0) cursor += 1;
  return { value: buffer.toString("utf8", start, cursor), next: cursor + 1 };
}

/** BUTTONRECORD state bits. Only `UP` is drawn; the rest are interaction. */
const BUTTON_STATE_UP = 0x01;

/**
 * A `DefineButton`/`DefineButton2`'s BUTTONRECORD list.
 *
 * ► **BUTTONS ARE EXPANDED HERE RATHER THAN COUNTED AS UNREADABLE, and that is
 *   a deliberate departure from what a screen extractor could get away with.**
 *   Measured on the oracle: the build holds **158 button characters carrying
 *   704 records — 425 shapes, 133 sprites and 146 text fields, and NO nested
 *   buttons.** Thirty-eight of those buttons are placed directly on a screen.
 *   Counting them as "unresolved: button" would have been honest and would have
 *   left the menus, the shops and the character creator with no visible UI at
 *   all — a screen pack whose screens are mostly missing.
 *
 * ► **THE APPROXIMATION IS THE STATE, AND IT IS COUNTED.** Only the UP records
 *   are returned as drawables. Over, down and hit-test are read and reported in
 *   `states` but never painted, because a static export has no hover.
 *
 * ► **32 OF THE 158 HAVE NO UP RECORD AT ALL.** Those are invisible hit areas,
 *   and they expand to nothing CORRECTLY. That is exactly the shape of a silent
 *   drop, so it is counted separately as `buttonNoUpState` rather than being
 *   allowed to look like an empty list.
 *
 * The parse is validated by its own terminator: the record list ends at a zero
 * flags byte, and a walk that instead runs off the end of the tag throws.
 */
export function parseButtonRecords(buffer, character) {
  const isButton2 = character.tagCode === TAG.DEFINE_BUTTON2;
  let cursor = character.bodyStart + 2;
  // DefineButton2 inserts ReservedFlags/TrackAsMenu (1 byte) and
  // ActionOffset (2 bytes) between the id and the records; DefineButton has
  // neither. Reading the first as the second misaligns every record after it.
  if (isButton2) cursor += 3;
  const records = [];
  let terminated = false;
  while (cursor < character.bodyEnd) {
    const flags = buffer[cursor];
    cursor += 1;
    if (flags === 0) { terminated = true; break; }
    if (cursor + 4 > character.bodyEnd) {
      throw new ExtractScreensError(`button ${character.id}: record ran past the end of its tag`);
    }
    const characterId = buffer.readUInt16LE(cursor);
    cursor += 2;
    const depth = buffer.readUInt16LE(cursor);
    cursor += 2;
    const matrix = readMatrix(buffer, cursor);
    cursor = matrix.next;
    let colourTransform = IDENTITY_COLOUR_TRANSFORM;
    if (isButton2) {
      const read = readColourTransform(buffer, cursor, true);
      colourTransform = read.colourTransform;
      cursor = read.next;
    }
    // FILTERLIST then BlendMode, in that order — the same wire order
    // `parsePlaceObject` documents, and the same trap.
    let filters = null;
    if (isButton2 && (flags & 0x10) !== 0) {
      const read = parseFilterList(buffer, cursor, character.bodyEnd);
      filters = read.filters;
      cursor = read.next;
    }
    if (isButton2 && (flags & 0x20) !== 0) cursor += 1;
    records.push({
      states: flags & 0x0f,
      characterId,
      depth,
      matrix: matrix.matrix,
      colourTransform,
      hasFilters: isButton2 && (flags & 0x10) !== 0,
      // The typed records, or `null` when the flag is clear — the same
      // "absent is not empty" distinction `flattenFrame` makes, because a
      // button record declaring a list that carries nothing is a real thing on
      // the wire and is not the same fact as a record with no list at all.
      filters
    });
  }
  if (!terminated) {
    throw new ExtractScreensError(`button ${character.id}: record list is not terminated`);
  }
  return records;
}

/**
 * A `DefineEditText`'s geometry and content.
 *
 * These are the build's DYNAMIC fields — the gladiator's name, every price in
 * every shop, the combat log — and they are the 57 characters this tool cannot
 * draw. It does not follow that nothing about them is knowable: the box, the
 * colour, the point size, the alignment, the `VariableName` the build writes
 * through and the `InitialText` the author left in are all in the tag, and a
 * renderer setting its own text needs every one of them.
 *
 * ► **THE FLAG ORDER IS THE TRAP.** `HasFont` selects a FontID at the front and
 *   a FontHeight AFTER the optional FontClass — two fields, one flag, separated
 *   by a third field's. Reading the height where the class belongs shifts every
 *   later field, and the first thing that goes wrong is the variable name,
 *   which then reads as plausible garbage rather than as an error.
 */
export function parseEditText(buffer, character) {
  let cursor = character.bodyStart;
  const id = buffer.readUInt16LE(cursor);
  cursor += 2;
  const bounds = readRect(buffer, cursor);
  cursor = bounds.next;
  const first = buffer[cursor];
  const second = buffer[cursor + 1];
  cursor += 2;
  const flags = {
    hasText: (first & 0x80) !== 0,
    wordWrap: (first & 0x40) !== 0,
    multiline: (first & 0x20) !== 0,
    password: (first & 0x10) !== 0,
    readOnly: (first & 0x08) !== 0,
    hasTextColour: (first & 0x04) !== 0,
    hasMaxLength: (first & 0x02) !== 0,
    hasFont: (first & 0x01) !== 0,
    hasFontClass: (second & 0x80) !== 0,
    autoSize: (second & 0x40) !== 0,
    hasLayout: (second & 0x20) !== 0,
    noSelect: (second & 0x10) !== 0,
    border: (second & 0x08) !== 0,
    html: (second & 0x02) !== 0
  };
  const field = { id, bounds: bounds.rect, ...flags };
  if (flags.hasFont) {
    field.fontId = buffer.readUInt16LE(cursor);
    cursor += 2;
  }
  if (flags.hasFontClass) {
    const read = readCString(buffer, cursor, character.bodyEnd);
    field.fontClass = read.value;
    cursor = read.next;
  }
  if (flags.hasFont) {
    field.fontHeight = buffer.readUInt16LE(cursor);
    cursor += 2;
  }
  if (flags.hasTextColour) {
    field.colour = {
      red: buffer[cursor], green: buffer[cursor + 1],
      blue: buffer[cursor + 2], alpha: buffer[cursor + 3]
    };
    cursor += 4;
  }
  if (flags.hasMaxLength) {
    field.maxLength = buffer.readUInt16LE(cursor);
    cursor += 2;
  }
  if (flags.hasLayout) {
    field.align = buffer[cursor];
    field.leftMargin = buffer.readUInt16LE(cursor + 1);
    field.rightMargin = buffer.readUInt16LE(cursor + 3);
    field.indent = buffer.readUInt16LE(cursor + 5);
    field.leading = buffer.readInt16LE(cursor + 7);
    cursor += 9;
  }
  const variable = readCString(buffer, cursor, character.bodyEnd);
  field.variableName = variable.value;
  cursor = variable.next;
  if (flags.hasText) {
    const text = readCString(buffer, cursor, character.bodyEnd);
    field.initialText = text.value;
    cursor = text.next;
  }
  // The walk must land on the tag's own end. A field list that stops short or
  // overruns means a flag was read in the wrong place, and every value above it
  // is then fiction that looks like data.
  if (cursor > character.bodyEnd) {
    throw new ExtractScreensError(`edit text ${id}: fields ran ${cursor - character.bodyEnd} bytes past its tag`);
  }
  return field;
}

/**
 * Every font's CODE TABLE, by character id — the map from a glyph index to the
 * character it stands for.
 *
 * ► **THIS IS WHAT TURNS 70 UNREADABLE TEXT PLACEMENTS INTO THE WORDS ON THE
 *   SCREEN.** A `DefineText` carries glyph INDICES, not letters, so without
 *   this the splash menu is three boxes of "4 glyphs", "6 glyphs", "9 glyphs".
 *   With it they are `play`, `how to` and `quit game`, and the credits read
 *   `Game design by Oliver Joyce. Additional background art by Tony Lowe.`
 *
 * ► **THE OFFSET TABLE IS RELATIVE TO ITS OWN START, and that is the trap.**
 *   `CodeTableOffset` counts from the first byte of the OffsetTable, not from
 *   the tag body and not from the glyph data. Measuring it from the wrong
 *   origin lands inside the glyph shape table, where every byte is a valid
 *   character code and nothing looks wrong until the words are nonsense.
 *
 * ► **`DefineFont` (tag 10) HAS NO CODE TABLE AT ALL** — its codes live in a
 *   separate `DefineFontInfo`. Such a font is reported in the returned
 *   `undecodable` set rather than silently yielding `?` for every glyph.
 *   Measured on the oracle: all 9 fonts the screens reach are `DefineFont2`,
 *   so this arm is format correctness rather than a fix to this extraction.
 *
 * The glyph OUTLINES are deliberately not read. That is the remaining gap and
 * it is counted as `staticTextGlyphs`: this pack knows what the words are, at
 * what size, in what colour and where each glyph sits, but not the shape of
 * the letterforms — so a renderer sets its own type at the build's own metrics.
 */
export function indexFonts(buffer) {
  const fonts = new Map();
  const undecodable = new Map();
  const walk = (start, end, depth) => {
    for (const { code, bodyStart, bodyEnd } of walkTags(buffer, start, end)) {
      if (code === TAG.DEFINE_SPRITE) {
        if (depth < 8) walk(bodyStart + 4, bodyEnd, depth + 1);
        continue;
      }
      if (code === TAG_DEFINE_FONT) {
        undecodable.set(buffer.readUInt16LE(bodyStart), "DefineFont carries no code table");
        continue;
      }
      if (code !== TAG_DEFINE_FONT2 && code !== TAG_DEFINE_FONT3) continue;
      let cursor = bodyStart;
      const id = buffer.readUInt16LE(cursor);
      cursor += 2;
      const flags = buffer[cursor];
      cursor += 2; // flags, then LanguageCode
      const nameLength = buffer[cursor];
      cursor += 1;
      // Some publishers count the terminator in FontNameLen and some do not, so
      // the name arrives with or without a trailing NUL. Trimmed here rather
      // than at every reader, because a family name that ends in "\u0000" does
      // not match a CSS font stack and fails as a missing font, not as an error.
      const name = buffer.toString("utf8", cursor, cursor + nameLength).replace(/\0+$/, "");
      cursor += nameLength;
      const glyphCount = buffer.readUInt16LE(cursor);
      cursor += 2;
      const wideOffsets = (flags & 0x08) !== 0;
      const wideCodes = (flags & 0x04) !== 0;
      const offsetTable = cursor;
      const codeTableOffset = wideOffsets
        ? buffer.readUInt32LE(offsetTable + glyphCount * 4)
        : buffer.readUInt16LE(offsetTable + glyphCount * 2);
      const codeTable = offsetTable + codeTableOffset;
      if (codeTable + glyphCount * (wideCodes ? 2 : 1) > bodyEnd) {
        undecodable.set(id, `code table would run ${codeTable - bodyEnd} bytes past the tag`);
        continue;
      }
      const codes = new Array(glyphCount);
      for (let index = 0; index < glyphCount; index += 1) {
        codes[index] = wideCodes
          ? buffer.readUInt16LE(codeTable + index * 2)
          : buffer[codeTable + index];
      }
      fonts.set(id, {
        id, name, glyphCount, codes,
        bold: (flags & 0x01) !== 0,
        italic: (flags & 0x02) !== 0
      });
    }
  };
  walk(tagStreamStart(buffer), buffer.length, 0);
  return { fonts, undecodable };
}

/**
 * A `DefineText`/`DefineText2`'s box, matrix and glyph runs.
 *
 * ► **THE GLYPHS ARE NOT RESOLVED TO CHARACTERS AND THIS TOOL SAYS SO.** A
 *   `GLYPHENTRY` carries an index into the font's glyph table, and turning that
 *   into a letter needs `DefineFont2`'s CodeTable and turning it into a picture
 *   needs the font's own shape table — neither of which this tool reads. What
 *   it CAN do exactly is say where the run sits, how many glyphs are in it, at
 *   what size and in what colour, so a renderer can set its own type in the
 *   same box. The count is reported as `staticTextGlyphs` and is the honest
 *   size of what is missing.
 *
 * The record walk is self-checking: `GlyphBits`/`AdvanceBits` are read from the
 * header and every entry is that exact width, so a wrong read overruns the tag
 * and throws rather than returning a plausible glyph count.
 */
export function parseStaticText(buffer, character, fonts = null) {
  let cursor = character.bodyStart;
  const id = buffer.readUInt16LE(cursor);
  cursor += 2;
  const bounds = readRect(buffer, cursor);
  cursor = bounds.next;
  const matrix = readMatrix(buffer, cursor);
  cursor = matrix.next;
  const glyphBits = buffer[cursor];
  const advanceBits = buffer[cursor + 1];
  cursor += 2;
  const withAlpha = character.tagCode === TAG.DEFINE_TEXT2;
  const runs = [];
  let glyphs = 0;
  // Glyphs whose code this call could NOT resolve, because no font table was
  // handed in or the run named a font that has none. Returned, never assumed
  // to be zero.
  let undecoded = 0;
  // A run inherits the font of the run before it when its own flags omit one,
  // which is how the format avoids repeating the font on every line.
  const current = {};
  while (cursor < character.bodyEnd) {
    const flags = buffer[cursor];
    cursor += 1;
    if (flags === 0) break;
    if ((flags & 0x80) !== 0) {
      const run = {};
      if ((flags & 0x08) !== 0) {
        run.fontId = buffer.readUInt16LE(cursor);
        current.fontId = run.fontId;
        cursor += 2;
      } else if (current.fontId !== undefined) {
        run.fontId = current.fontId;
      }
      if ((flags & 0x04) !== 0) {
        run.colour = {
          red: buffer[cursor], green: buffer[cursor + 1], blue: buffer[cursor + 2],
          alpha: withAlpha ? buffer[cursor + 3] : 255
        };
        cursor += withAlpha ? 4 : 3;
      }
      if ((flags & 0x01) !== 0) { run.xOffset = buffer.readInt16LE(cursor); cursor += 2; }
      if ((flags & 0x02) !== 0) { run.yOffset = buffer.readInt16LE(cursor); cursor += 2; }
      if ((flags & 0x08) !== 0) { run.height = buffer.readUInt16LE(cursor); cursor += 2; }
      runs.push(run);
      continue;
    }
    const count = flags & 0x7f;
    const bitCursor = new BitCursor(buffer, cursor);
    // The format says a glyph run follows a style record, so `runs` is normally
    // non-empty here. An implicit run is opened rather than trusting that,
    // because the alternative is dropping real glyphs into a variable nothing
    // reads — the same silent loss this whole file is arranged against.
    if (runs.length === 0) runs.push({ implicit: true });
    const run = runs[runs.length - 1];
    const font = fonts ? fonts.get(run.fontId ?? current.fontId) : null;
    const indices = new Array(count);
    const advances = new Array(count);
    for (let index = 0; index < count; index += 1) {
      indices[index] = bitCursor.ub(glyphBits);
      // ► **THE ADVANCE IS SIGNED.** Reading it unsigned turns every kerned
      //   pair into a glyph flung thousands of twips to the right, which still
      //   lays out as "a line of text" and is wrong everywhere.
      advances[index] = bitCursor.sb(advanceBits);
    }
    bitCursor.align();
    cursor = bitCursor.byte;
    glyphs += count;
    if (cursor > character.bodyEnd) {
      throw new ExtractScreensError(`static text ${id}: a glyph run ran past the end of its tag`);
    }
    {
      run.glyphs = (run.glyphs ?? 0) + count;
      run.advances = [...(run.advances ?? []), ...advances];
      // A glyph whose index is outside the font's code table becomes U+FFFD
      // rather than silently nothing, so a short word is visibly short.
      if (font) {
        run.text = (run.text ?? "") +
          indices.map((index) => {
            const code = font.codes[index];
            return code === undefined ? "\uFFFD" : String.fromCharCode(code);
          }).join("");
      } else {
        run.indices = [...(run.indices ?? []), ...indices];
        undecoded += count;
      }
    }
  }
  // ► **A NEW `yOffset` IS A NEW LINE, and joining the runs without one turns
  //   the character sheet's own label column into
  //   "hairstylestubbleshoulderguard".** The format has no newline glyph: it
  //   restarts the pen with a fresh offset, so the line break is in the
  //   geometry and nowhere else. `runs[].text` always carries the lines
  //   separately; this is the flattened reading, and it is flattened honestly.
  const text = runs
    .map((run, index) => (index > 0 && run.yOffset !== undefined ? "\n" : "") + (run.text ?? ""))
    .join("");
  return {
    id, bounds: bounds.rect, matrix: matrix.matrix, glyphs, undecoded, runs,
    ...(text ? { text } : {})
  };
}

const px = (twips) => Math.round((twips / TWIPS_PER_PIXEL) * 100) / 100;

/**
 * The same rounding every other pack here uses: a matrix reaches JSON as a
 * six-element array, scale/skew to 5 places and translations to 1.
 *
 * ► **THE TRANSLATIONS STAY IN TWIPS**, because `readMatrix` leaves them there
 *   and `composeMatrix` composes them there. Path data from `shapeToPaths` is
 *   in PIXELS. Mixing the two inflated three rows of the committed arena size
 *   table by a factor of twenty; a consumer of this file divides `tx`/`ty` by
 *   20 and nothing else.
 *
 * ► **`-0` IS NORMALISED TO `0`**, which round-trips through JSON as `-0` and
 *   compares unequal under `Object.is` — how a byte-identical re-extraction can
 *   look like a changed one.
 */
export function roundMatrix(matrix) {
  const r = (value, places) => {
    const factor = 10 ** places;
    const rounded = Math.round(value * factor) / factor;
    return Object.is(rounded, -0) ? 0 : rounded;
  };
  return [r(matrix.a, 5), r(matrix.b, 5), r(matrix.c, 5), r(matrix.d, 5), r(matrix.tx, 1), r(matrix.ty, 1)];
}

function isIdentityColour(transform) {
  if (!transform) return true;
  for (const key of Object.keys(IDENTITY_COLOUR_TRANSFORM)) {
    if (transform[key] !== IDENTITY_COLOUR_TRANSFORM[key]) return false;
  }
  return true;
}

/**
 * Every nested sprite a screen reaches, with the frame count it declares.
 *
 * ► **THIS IS THE COUNT THAT KEEPS A SNAPSHOT HONEST.** `flattenFrame` stops
 *   every nested clip on frame 1, which is where the build's own `stop()`
 *   leaves most of them — but the sky is 200 frames of `time_of_day`, the sand
 *   and the crowd are 6 of `current_arena`, and the town is 200 of the same
 *   clock. Frame 1 of those is ONE reading, not the screen. Without this walk
 *   the screen pack would silently be "arena 1 at dawn" and call itself
 *   "arena".
 *
 * Recursion is bounded by `maxDepth` and by a visiting set, matching
 * `flattenFrame`'s own guards, so a self-containing sprite cannot spin here.
 */
function nestedSprites(buffer, characters, entries, { maxDepth = 8, cache, trail = [] }) {
  const found = new Map();
  const filters = [];
  const blends = [];
  // Counted here rather than recomputed by a caller, so the list and its own
  // tallies are written by one walk and cannot drift apart — the rule the
  // unresolved roster below already follows.
  let filterRecords = 0;
  let emptyLists = 0;
  let unreadLists = 0;
  const visit = (list, depth, visiting, trail) => {
    if (depth > maxDepth) return;
    for (const entry of list) {
      const at = [...trail, entry.depth];
      if (entry.hasFilters) {
        // ► **THE LIST, NOT A BOOLEAN.** This pushed `{character, path}` and
        //   threw `entry.filters` away, so `screen.filteredPlacements` told
        //   `src/render/screen.js` only THAT a prefix was filtered — which is
        //   why that file counts `filtersNotApplied` and applies nothing. The
        //   records go out VERBATIM in `parseFilterList`'s own spelling
        //   (`{type, filterId, blurX, blurY, passes, colour, strength, angle,
        //   distance, inner, knockout, compositeSource, matrix}`), because
        //   `src/render/filters.js`'s `canvasFilterFor` already reads exactly
        //   that shape and a producer inventing a second spelling at a seam is
        //   this project's most repeated defect.
        const typed = Array.isArray(entry.filters) ? entry.filters : null;
        if (typed === null) {
          // STRUCTURALLY UNREACHABLE against this build and counted anyway:
          // `parsePlaceObject` sets `hasFilters` and `filters` off the same
          // flag bit and `resolveTimeline` carries both, so a placement cannot
          // claim one without the other. If that ever stops being true this is
          // a number in the manifest rather than a list that is silently one
          // entry short. It has never been anything but 0 here.
          unreadLists += 1;
        } else {
          filterRecords += typed.length;
          if (typed.length === 0) emptyLists += 1;
        }
        filters.push({
          character: entry.characterId,
          path: at,
          ...(typed === null ? { filtersUnread: true } : { filters: typed })
        });
      }
      if (entry.blendMode !== undefined && entry.blendMode > 1) {
        blends.push({ character: entry.characterId, path: at, blendMode: entry.blendMode });
      }
      const character = characters.get(entry.characterId);
      if (!character || character.kind !== "sprite") continue;
      if (character.frames > 1 && !found.has(character.id)) {
        found.set(character.id, { character: character.id, frames: character.frames });
      }
      if (visiting.has(character.id)) continue;
      const key = `${character.id}@1`;
      if (!cache.has(key)) {
        cache.set(key, resolveTimeline(buffer, character, { frames: [1] }).frames[0] ?? null);
      }
      const inner = cache.get(key);
      if (!inner) continue;
      visiting.add(character.id);
      visit(inner, depth + 1, visiting, at);
      visiting.delete(character.id);
    }
  };
  // `trail` is the path the CALLER has already walked, and it is not a
  // convenience: the button arm below searches a sprite that an UP record
  // placed, and the paths it must produce are `[...button, record.depth, ...]`
  // — exactly what `flattenFrame` gives that sprite's leaves. Defaulting it to
  // `[]` keeps the root walk spelled the way it always was.
  visit(entries, 0, new Set(), trail);
  return { multiFrame: [...found.values()], filters, blends, filterRecords, emptyLists, unreadLists };
}

/**
 * Every typed filter in one or more rosters, tallied by its own `type`.
 *
 * ► **A RECORD WITH NO `type` IS COUNTED AS `unknown`, NOT SKIPPED.** The five
 *   filter kinds this build uses all decode to a name, and the three it does
 *   not use (`gradientGlow`, `convolution`, `gradientBevel`) decode to one too
 *   — `parseFilterList` throws on an id it cannot name, so `unknown` should be
 *   unreachable. It is here because a bucket that silently drops what it cannot
 *   classify is the same defect as a `catch { continue; }`.
 *
 * A function declaration, not an arrow: `ss2-assertion-quality.test.js` reads a
 * helper body by looking for the next brace before the next newline, so a
 * multi-line arrow reads as bodyless.
 */
function filtersByType(...rosters) {
  const byType = {};
  for (const roster of rosters) {
    for (const entry of Array.isArray(roster) ? roster : []) {
      for (const filter of Array.isArray(entry?.filters) ? entry.filters : []) {
        const type = typeof filter?.type === "string" ? filter.type : "unknown";
        byType[type] = (byType[type] ?? 0) + 1;
      }
    }
  }
  return byType;
}

/**
 * Where a screen's snapshot sits in its own frame range, and what moves.
 *
 * A label owns from its own frame to the frame before the next label, exactly
 * as `deriveAnimations` defines it for a clip. Measured on the oracle: 24 of
 * the 26 ranges are IDENTICAL to their label frame throughout, so taking the
 * label frame is right — but `splash` and `church` are not, and a tool that
 * assumed stillness would have been silently wrong twice.
 */
function rangeVariance(frames, firstFrame, lastFrame) {
  const signatureOf = (list) => list
    .map((entry) => `${entry.depth}:${entry.characterId}:${entry.matrix.tx},${entry.matrix.ty},` +
      `${entry.matrix.a},${entry.matrix.d}:${entry.name ?? ""}`)
    .join("|");
  const base = frames[firstFrame - 1];
  const baseSignature = signatureOf(base);
  const baseDepths = new Set(base.map((entry) => entry.depth));
  const differing = [];
  const added = new Set();
  const removed = new Set();
  for (let frame = firstFrame + 1; frame <= lastFrame; frame += 1) {
    const list = frames[frame - 1];
    if (!list || signatureOf(list) === baseSignature) continue;
    differing.push(frame);
    const depths = new Set(list.map((entry) => entry.depth));
    for (const depth of depths) if (!baseDepths.has(depth)) added.add(depth);
    for (const depth of baseDepths) if (!depths.has(depth)) removed.add(depth);
  }
  return {
    frames: differing.length,
    firstDifferingFrame: differing[0] ?? null,
    depthsAdded: [...added].sort((left, right) => left - right),
    depthsRemoved: [...removed].sort((left, right) => left - right)
  };
}

/**
 * Every labelled root frame, as a screen.
 *
 * Returns `{screens, shapes, failures, totals}`. `shapes` is shared across all
 * 26 — the chrome alone is on every one of them, so a per-screen shape table
 * would carry the same border twenty-six times.
 *
 * A shape key is the character id; a BAKED MORPH's key is `"<id>@<ratio>"`,
 * which is the convention `extract-figure.mjs` already established so that a
 * renderer needs no second code path for morphs.
 */
export function extractScreens(buffer) {
  const { characters, names } = indexCharacters(buffer);
  const { fonts, undecodable } = indexFonts(buffer);
  const root = rootTimeline(buffer);
  const resolved = resolveTimeline(buffer, root);
  if (resolved.labels.length === 0) {
    throw new ExtractScreensError(
      "The root timeline carries no FrameLabel tags, so this build has no named screens to take. " +
      "That is not an empty result to write out; it is a different file from the one this tool reads."
    );
  }

  const screens = {};
  const shapes = {};
  const failures = [];
  for (const [id, why] of undecodable) {
    failures.push({ screen: null, kind: "font-no-code-table", character: id, message: why });
  }
  const cache = new Map();
  const shapeCache = new Map();
  const morphDefinitions = new Map();
  const buttonCache = new Map();

  /** A shape parsed once and shared by every screen that reaches it. */
  const wantShape = (id) => {
    if (shapes[id] !== undefined || shapeCache.has(id)) return shapeCache.get(id) ?? null;
    const character = characters.get(id);
    if (!character) {
      shapeCache.set(id, null);
      failures.push({ screen: null, kind: "missing", character: id, message: "no such character" });
      return null;
    }
    try {
      const shape = parseShape(buffer, character.bodyStart, character.bodyEnd, character.tagCode);
      const paths = shapeToPaths(shape);
      shapes[id] = {
        character: id,
        bounds: {
          xMin: px(shape.bounds.xMin), xMax: px(shape.bounds.xMax),
          yMin: px(shape.bounds.yMin), yMax: px(shape.bounds.yMax)
        },
        paths
      };
      shapeCache.set(id, shapes[id]);
      return shapes[id];
    } catch (error) {
      shapeCache.set(id, null);
      failures.push({
        screen: null, kind: "shape-parse", character: id,
        message: String(error.message).slice(0, 160)
      });
      return null;
    }
  };

  /**
   * A morph baked at the ratio its placement carries, keyed `"<id>@<ratio>"`.
   *
   * The build's screens reach three morph characters (1733, 1734, 1735) — the
   * clouds' own soft edges. Baking them here means a morph is an ordinary entry
   * in `shapes` and the renderer needs no morph parser at all.
   */
  const wantMorph = (id, rawRatio) => {
    // ► **A PLACEMENT THAT OMITS THE RATIO IS RATIO 0, NOT "UNKNOWN"** — the
    //   morph's START shape, which is what a player sees. Measured on the
    //   oracle: all three morph placements the screens reach (1733, 1734, 1735,
    //   the clouds' soft edges) carry NO ratio flag at all, so all three bake at
    //   0. `declaredRatio` records which it was, because a baked 0 that came
    //   from an absent field and one that came from a measured field are the
    //   same number and not the same fact — and the ratio DOES move on later
    //   frames of the parent clip, which a frame-1 snapshot never reaches and
    //   `nestedSpriteFrame1` is what counts.
    const declaredRatio = Number.isFinite(rawRatio);
    const ratio = ratioOf(rawRatio);
    const key = `${id}@${Math.round(ratio * 1000) / 1000}`;
    if (shapes[key] !== undefined) return key;
    let definition = morphDefinitions.get(id);
    if (definition === undefined) {
      const character = characters.get(id);
      try {
        definition = parseMorphShape(buffer, character.bodyStart, character.bodyEnd, character.tagCode);
      } catch (error) {
        definition = null;
        failures.push({
          screen: null, kind: "morph-parse", character: id,
          message: String(error.message).slice(0, 160)
        });
      }
      morphDefinitions.set(id, definition);
    }
    if (!definition) return null;
    const frame = morphShapeAt(definition, ratio);
    shapes[key] = {
      character: id,
      morphRatio: ratio,
      declaredRatio,
      bounds: {
        xMin: px(frame.bounds.xMin), xMax: px(frame.bounds.xMax),
        yMin: px(frame.bounds.yMin), yMax: px(frame.bounds.yMax)
      },
      paths: morphToPaths(frame)
    };
    return key;
  };

  const buttonRecordsFor = (character) => {
    if (buttonCache.has(character.id)) return buttonCache.get(character.id);
    let records = null;
    try {
      records = parseButtonRecords(buffer, character);
    } catch (error) {
      failures.push({
        screen: null, kind: "button-parse", character: character.id,
        message: String(error.message).slice(0, 160)
      });
    }
    buttonCache.set(character.id, records);
    return records;
  };

  for (let index = 0; index < resolved.labels.length; index += 1) {
    const label = resolved.labels[index];
    const next = resolved.labels[index + 1];
    const lastFrame = (next ? next.frame : resolved.frames.length + 1) - 1;
    const displayList = resolved.frames[label.frame - 1];
    const screen = {
      name: label.name,
      labelFrame: label.frame,
      firstFrame: label.frame,
      lastFrame: Math.max(label.frame, lastFrame),
      objects: [],
      drawables: [],
      unresolved: [],
      textFields: [],
      staticText: [],
      counts: {},
      approximations: {},
      // Set below, and named rather than inferred: a screen with no drawables
      // is a finding, not an empty entry a reader will scroll past.
      resolvedNothing: false
    };

    if (!displayList || displayList.length === 0) {
      screen.resolvedNothing = true;
      screen.note = "the root display list is EMPTY at this label — nothing is placed, not even the chrome";
      screens[label.name] = screen;
      failures.push({
        screen: label.name, kind: "empty-display-list", character: null,
        message: `frame ${label.frame} carries no placements at all`
      });
      continue;
    }

    // THE CUMULATIVE DISPLAY LIST, in depth order, which is paint order.
    for (const entry of displayList) {
      const character = characters.get(entry.characterId);
      screen.objects.push({
        depth: entry.depth,
        character: entry.characterId,
        kind: character?.kind ?? "missing",
        ...(names.has(entry.characterId) ? { exportName: names.get(entry.characterId) } : {}),
        ...(entry.name ? { instanceName: entry.name } : {}),
        matrix: roundMatrix(entry.matrix),
        ...(isIdentityColour(entry.colourTransform) ? {} : { colour: entry.colourTransform }),
        ...(entry.ratio !== undefined ? { ratio: entry.ratio } : {}),
        ...(entry.clipDepth !== undefined ? { clipDepth: entry.clipDepth } : {}),
        ...(entry.blendMode !== undefined ? { blendMode: entry.blendMode } : {}),
        // ► **THIS SAID `filters: true`.** The key and its truthiness are
        //   unchanged — an array is truthy and so was the boolean, so a reader
        //   testing `if (object.filters)` reads the same answer — but the value
        //   is now the typed records, which is the only form anything can use.
        //   An EMPTY array is the build's own "a filter list is declared and
        //   carries nothing", 5 of those on the wire, and it stays truthy here
        //   exactly as `hasFilters` did, so this is not a silent reclassification
        //   of those five. A placement that somehow claims filters without
        //   carrying them keeps the bare `true` — which is all that word ever
        //   meant — rather than being written out as an empty list it is not.
        ...(entry.hasFilters
          ? { filters: Array.isArray(entry.filters) ? entry.filters : true }
          : {}),
        ...(character?.kind === "sprite" ? { declaredFrames: character.frames } : {}),
        // Filled in after flattening: how much of the picture this object is
        // actually responsible for. Zero here is the loud case.
        drawables: 0
      });
    }

    let flattened;
    try {
      flattened = flattenFrame(buffer, characters, displayList, { cache, resolveMasks: true });
    } catch (error) {
      screen.resolvedNothing = true;
      screen.note = `flattening threw: ${String(error.message).slice(0, 160)}`;
      failures.push({
        screen: label.name, kind: "flatten", character: null,
        message: String(error.message).slice(0, 160)
      });
      screens[label.name] = screen;
      continue;
    }

    // THE MASKS ON THIS SCREEN, by their own path, so a masked placement can
    // name its cutter without depth alone having to be unique across nesting.
    const masks = new Map();
    for (const drawable of flattened) {
      if (drawable.isMask && !drawable.unsupported) masks.set(drawable.path.join("/"), drawable);
    }

    const approximations = {
      nestedSpriteFrame1: 0, buttonUpState: 0, buttonNoUpState: 0,
      filters: 0, filterRecords: 0, filterListEmpty: 0, filterListUnread: 0,
      filtersInButtonRecords: 0, buttonRecordsFiltered: 0,
      buttonRecordsFilteredOverText: 0,
      filterListEmptyInButtonRecords: 0, filterListUnreadInButtonRecords: 0,
      filtersInButtonSubtrees: 0, buttonSubtreesUnreadable: 0,
      blendModes: 0, gradientPaths: 0, bitmapPaths: 0,
      invisibleDrawables: 0, staticTextGlyphs: 0, staticTextGlyphsUndecoded: 0,
      bakedMorphs: 0
    };
    // The filters this screen's BUTTONS carry, which `nestedSprites` cannot
    // see: it walks sprites, and a button's records are expanded in the button
    // arm below. Kept as its own roster rather than merged into
    // `filteredPlacements` — see the header for why.
    const filteredButtonRecords = [];
    // ► And the filtered PLACEMENTS found INSIDE those buttons, which do belong
    //   in `filteredPlacements`: they are ordinary `PlaceObject3`s under the
    //   path `flattenFrame` gives their leaves, not BUTTONRECORDs. Collected
    //   here and merged below, because `approximations.filters` is set after
    //   this loop from the root walk's length.
    const buttonSubtreeFilters = [];
    // Its own tallies, accumulated by the same walk that builds the list, the
    // rule `nestedSprites` already follows: a count recomputed by a caller can
    // drift from the roster it claims to describe.
    const buttonSubtreeTally = { records: 0, empty: 0, unread: 0 };
    const unresolvedByKind = {};
    const byTopDepth = new Map();

    /**
     * ► **ONE ROSTER AND ONE TALLY, WRITTEN BY THE SAME CALL.** The first
     *   version of this file kept text in `textFields`/`staticText` and
     *   everything else in `unresolved`, so `counts.unresolved` said 0 for a
     *   screen carrying 26 unreadable text characters while
     *   `unresolvedByKind` said 26. A count that disagrees with its own list by
     *   design is the defect `test/extraction-honesty.test.js` exists for, one
     *   file earlier. Now `unresolved.length` EQUALS the sum of
     *   `unresolvedByKind` on every screen, and the test asserts it.
     */
    const note = (kind, drawable, detail) => {
      unresolvedByKind[kind] = (unresolvedByKind[kind] ?? 0) + 1;
      screen.unresolved.push({
        kind,
        character: drawable.characterId,
        path: drawable.path,
        ...(drawable.name ? { instanceName: drawable.name } : {}),
        matrix: roundMatrix(drawable.matrix),
        ...(detail ? { detail } : {})
      });
    };

    /** One resolved leaf, with its cutter travelling beside it. */
    const pushDrawable = (drawable, shapeKey, via) => {
      const cutter = drawable.maskPath ? masks.get(drawable.maskPath.join("/")) : null;
      let clip = null;
      if (cutter && wantShape(cutter.characterId)) {
        clip = { shape: cutter.characterId, matrix: roundMatrix(cutter.matrix) };
      }
      if (drawable.colourTransform.alphaMultiplier === 0) approximations.invisibleDrawables += 1;
      const shape = shapes[shapeKey];
      if (shape) {
        for (const entry of shape.paths) {
          if (entry.approximated === "gradient") approximations.gradientPaths += 1;
          if (entry.approximated === "bitmap") approximations.bitmapPaths += 1;
        }
      }
      screen.drawables.push({
        shape: shapeKey,
        path: drawable.path,
        matrix: roundMatrix(drawable.matrix),
        ...(isIdentityColour(drawable.colourTransform) ? {} : { colour: drawable.colourTransform }),
        ...(drawable.blendMode !== undefined ? { blendMode: drawable.blendMode } : {}),
        ...(clip ? { clip } : {}),
        ...(via ? { via } : {})
      });
      const top = drawable.path[0];
      byTopDepth.set(top, (byTopDepth.get(top) ?? 0) + 1);
    };

    /** Everything this tool cannot draw, with enough to go and look at it. */
    const pushUnresolved = (drawable, kind, detail) => note(kind, drawable, detail);

    for (const drawable of flattened) {
      // A MASK IS A CUTTER, NOT A DRAWING. Painting it would put the stencil on
      // the canvas instead of the thing it cuts, so a resolvable one travels on
      // the placements it clips and is never emitted as one of its own. An
      // UNRESOLVABLE one — a sprite mask — is reported, because everything
      // under it is then being exported unclipped.
      if (drawable.isMask) {
        if (drawable.unsupported) pushUnresolved(drawable, "mask-sprite", "a sprite mask is not one clip path");
        continue;
      }
      if (!drawable.unsupported) {
        if (wantShape(drawable.characterId)) pushDrawable(drawable, drawable.characterId, null);
        else pushUnresolved(drawable, "shape-parse", "the shape parser refused it; see failures");
        continue;
      }
      if (drawable.unsupported === "morph") {
        const key = wantMorph(drawable.characterId, drawable.ratio);
        if (key) {
          approximations.bakedMorphs += 1;
          pushDrawable(drawable, key, `morph ${drawable.characterId}`);
        } else {
          pushUnresolved(drawable, "morph-parse", "the morph parser refused it; see failures");
        }
        continue;
      }
      if (drawable.unsupported === "button") {
        const character = characters.get(drawable.characterId);
        const records = buttonRecordsFor(character);
        if (!records) {
          pushUnresolved(drawable, "button-parse", "the button record list would not parse; see failures");
          continue;
        }
        approximations.buttonUpState += 1;
        const up = records
          .filter((record) => (record.states & BUTTON_STATE_UP) !== 0)
          .sort((left, right) => left.depth - right.depth);
        if (up.length === 0) {
          // NOT A FAILURE AND NOT A SILENT EMPTY: 32 of the build's 158 buttons
          // are hit areas with no visible state, and the only wrong move is to
          // let that look like a read that went nowhere.
          approximations.buttonNoUpState += 1;
          note("button-hit-area-only", drawable,
            `${records.length} records, none of them UP — this button draws nothing by design`);
          continue;
        }
        // ► **A BUTTONRECORD'S OWN FILTERLIST, WHICH NOTHING HAS EVER
        //   REPORTED.** `parseButtonRecords` stepped over it; now it decodes
        //   it, and the UP records — the only ones this tool draws — carry
        //   theirs out here. The path is the button's own path with the
        //   record's depth appended, which is EXACTLY the path `pushDrawable`
        //   builds for the leaves underneath it.
        //
        // ► ~~"so a reader matching by prefix reaches the same operations with
        //   no second convention."~~ **THAT HALF WAS WRONG AND IS CORRECTED
        //   HERE, 2026-09-14.** The path convention is right; what sits under
        //   it on this build is not an operation. All 13 filtered UP records in
        //   the file place a `DefineText` — measured by kind, `{ text: 13 }` —
        //   and text goes to `screen.staticText`, never to `screen.drawables`.
        //   So a reader matching `drawables` by prefix reaches ZERO of the five
        //   this screen pack carries, and a reader matching `staticText` by
        //   EXACT path reaches all five: they are the town square's menu glows.
        //   `leaf` below says which table to look in rather than leaving the
        //   next reader to find that out the way this one did, and
        //   `buttonRecordsFilteredOverText` counts it so the roster can never
        //   again be described as reaching operations it does not reach.
        for (const record of up) {
          // `hasFilters`, not `filters.length` — the FLAG is the fact. A record
          // with no list at all is not a drop; a record declaring a list that
          // carries nothing is, and it used to leave here through a bare
          // `continue` that no counter saw. The placement path has always
          // treated that case as evidence (`filterListEmpty`); two paths
          // treating one fact oppositely is how this repository loses things.
          if (!record.hasFilters) continue;
          const typed = Array.isArray(record.filters) ? record.filters : null;
          if (typed === null) {
            // The button twin of `filterListUnread`, and unreachable for the
            // same reason: `parseButtonRecords` sets `hasFilters` and `filters`
            // off one flag bit. Counted anyway, so a future parser that breaks
            // that pairing shows up as a number rather than as a short list.
            approximations.filterListUnreadInButtonRecords += 1;
          } else {
            approximations.filtersInButtonRecords += typed.length;
            if (typed.length === 0) approximations.filterListEmptyInButtonRecords += 1;
          }
          approximations.buttonRecordsFiltered += 1;
          const leaf = characters.get(record.characterId)?.kind ?? "missing";
          if (leaf === "text") approximations.buttonRecordsFilteredOverText += 1;
          filteredButtonRecords.push({
            character: record.characterId,
            path: [...drawable.path, record.depth],
            button: drawable.characterId,
            // The kind of character the record places, so a consumer knows
            // whether to prefix-match `drawables` or exact-match `staticText`.
            // On this build it is "text" every time.
            leaf,
            ...(typed === null ? { filtersUnread: true } : { filters: typed })
          });
        }
        // ► **AND THE SUBTREE UNDERNEATH IT, WHICH WAS IN NEITHER ROSTER.**
        //   `nestedSprites` walks the ROOT display list; a button's records are
        //   expanded here, so a filtered `PlaceObject3` inside a sprite that an
        //   UP record places reached `filteredPlacements` in no form — 49 UP
        //   records across the build place a sprite. **Measured 0 filtered
        //   placements inside them on this build**, which is why nothing has
        //   ever noticed. 0 that a walk produced is a reading; 0 that no walk
        //   produced is an absence of evidence, and the two are the defect this
        //   file exists to keep apart.
        for (const record of up) {
          const inner = characters.get(record.characterId);
          if (!inner || inner.kind !== "sprite") continue;
          const key = `${inner.id}@1`;
          if (!cache.has(key)) {
            try {
              cache.set(key, resolveTimeline(buffer, inner, { frames: [1] }).frames[0] ?? null);
            } catch (error) {
              // Named, not swallowed. A sprite whose timeline will not resolve
              // is a subtree this walk could not search, and a reader is owed
              // the difference between "searched, found none" and "not searched".
              approximations.buttonSubtreesUnreadable += 1;
              note("button-subtree-unreadable", drawable,
                `record depth ${record.depth} places sprite ${inner.id}: ${String(error.message).slice(0, 80)}`);
              continue;
            }
          }
          const list = cache.get(key);
          if (!list) continue;
          const under = nestedSprites(buffer, characters, list, {
            cache, trail: [...drawable.path, record.depth]
          });
          for (const entry of under.filters) buttonSubtreeFilters.push(entry);
          approximations.filtersInButtonSubtrees += under.filters.length;
          buttonSubtreeTally.records += under.filterRecords;
          buttonSubtreeTally.empty += under.emptyLists;
          buttonSubtreeTally.unread += under.unreadLists;
        }
        let inner;
        try {
          inner = flattenFrame(buffer, characters, up, {
            cache, resolveMasks: true,
            matrix: drawable.matrix, colourTransform: drawable.colourTransform
          });
        } catch (error) {
          pushUnresolved(drawable, "button-flatten", String(error.message).slice(0, 120));
          continue;
        }
        for (const leaf of inner) {
          // The button's own path is prefixed so a leaf can still be traced to
          // the depth on the screen that put it there.
          const traced = { ...leaf, path: [...drawable.path, ...leaf.path] };
          if (traced.isMask) {
            if (traced.unsupported) pushUnresolved(traced, "mask-sprite", "inside a button");
            continue;
          }
          if (!traced.unsupported) {
            if (wantShape(traced.characterId)) pushDrawable(traced, traced.characterId, `button ${drawable.characterId}`);
            else pushUnresolved(traced, "shape-parse", "inside a button");
            continue;
          }
          if (traced.unsupported === "text") {
            recordText(buffer, traced, screen, characters, fonts, failures, label.name, approximations, note);
            continue;
          }
          pushUnresolved(traced, traced.unsupported, `inside button ${drawable.characterId}`);
        }
        continue;
      }
      if (drawable.unsupported === "text") {
        recordText(buffer, drawable, screen, characters, fonts, failures, label.name, approximations, note);
        continue;
      }
      pushUnresolved(drawable, drawable.unsupported, null);
    }

    const nested = nestedSprites(buffer, characters, displayList, { cache });
    approximations.nestedSpriteFrame1 = nested.multiFrame.length;
    // ► `filters` COUNTS PLACEMENTS AND `filterRecords` COUNTS FILTERS, and on
    //   this build they are 243 and 271. The first name is wrong and is kept
    //   because `approximations.fromPack` is read by files this one does not
    //   own; see the header, where the correction sits at the instruction.
    // ► THE BUTTON SUBTREES JOIN THE ROOT WALK'S FIND HERE, not beside it. They
    //   are the same tag under the same path convention, so a second roster
    //   would be a second convention for one fact — and `filtersInButtonSubtrees`
    //   is how many of the merged total came from under a button. 0 on this
    //   build, so every number below is unchanged by the merge and can still be
    //   compared with the pack committed before it.
    //   APPENDED, not merged in path order: the root walk's entries keep the
    //   order they have always had, so on a build where `buttonSubtreeFilters`
    //   is empty — this one — the roster is byte-identical to the one the
    //   committed pack carries, and a diff against it means something.
    const filteredPlacements = [...nested.filters, ...buttonSubtreeFilters];
    approximations.filters = filteredPlacements.length;
    approximations.filterRecords = nested.filterRecords + buttonSubtreeTally.records;
    approximations.filterListEmpty = nested.emptyLists + buttonSubtreeTally.empty;
    approximations.filterListUnread = nested.unreadLists + buttonSubtreeTally.unread;
    approximations.blendModes = nested.blends.length;
    screen.multiFrameSprites = nested.multiFrame.sort((left, right) => left.character - right.character);
    screen.filteredPlacements = filteredPlacements;
    screen.filteredButtonRecords = filteredButtonRecords;
    screen.blendedPlacements = nested.blends;
    screen.rangeVariance = rangeVariance(resolved.frames, screen.firstFrame, screen.lastFrame);

    for (const object of screen.objects) object.drawables = byTopDepth.get(object.depth) ?? 0;
    const silent = screen.objects.filter((object) => object.drawables === 0);

    screen.approximations = approximations;
    screen.counts = {
      objects: screen.objects.length,
      drawables: screen.drawables.length,
      distinctShapes: new Set(screen.drawables.map((drawable) => drawable.shape)).size,
      unresolved: screen.unresolved.length,
      unresolvedByKind,
      textFields: screen.textFields.length,
      staticText: screen.staticText.length,
      // RECOUNTED off the two rosters, never accumulated beside them, so a
      // filter that reaches the pack without reaching this tally is impossible
      // rather than merely unlikely. Both rosters are counted because a reader
      // asking "what effects does this screen use" does not care which of the
      // two producers wrote the record down.
      filtersByType: filtersByType(screen.filteredPlacements, screen.filteredButtonRecords),
      // ► The loud one. An object that contributed no leaf is either an empty
      //   clip (the rain's frames 1-9 place nothing) or a read that went
      //   nowhere, and the two are indistinguishable unless both are named.
      objectsDrawingNothing: silent.length,
      objectsDrawingNothingUnexplained: 0
    };
    screen.objectsDrawingNothing = silent.map((object) => ({
      depth: object.depth, character: object.character, kind: object.kind,
      ...(object.instanceName ? { instanceName: object.instanceName } : {}),
      ...(object.kind === "sprite" ? { declaredFrames: object.declaredFrames } : {}),
      because: whyNothing(buffer, characters, object, cache, buttonCache)
    }));
    // ► **THIS IS THE NUMBER THAT SHOULD NEVER BE NON-ZERO WITHOUT SOMEBODY
    //   LOOKING.** A text field draws nothing because this tool draws no text;
    //   the rain draws nothing because its own frame 1 places nothing. Both are
    //   correct, and both look EXACTLY like a read that went nowhere — which is
    //   what the arena's invisible walls looked like for months. So the ones
    //   that can say why are separated from the ones that cannot, and only the
    //   second group is a failure.
    const unexplained = screen.objectsDrawingNothing.filter((object) => object.because === null);
    screen.counts.objectsDrawingNothingUnexplained = unexplained.length;
    for (const object of unexplained) {
      failures.push({
        screen: label.name, kind: "object-drew-nothing", character: object.character,
        message: `depth ${object.depth} is a ${object.kind} and produced no drawable, ` +
          "for no reason this tool can name"
      });
    }
    screen.resolvedNothing = screen.drawables.length === 0;
    if (screen.resolvedNothing) {
      screen.note =
        `${screen.objects.length} objects are placed and NONE of them resolved to a drawable — ` +
        "this screen is empty in the data and must not be read as empty in the build";
      failures.push({
        screen: label.name, kind: "screen-resolved-nothing", character: null,
        message: `${screen.objects.length} objects, 0 drawables`
      });
    }
    screens[label.name] = screen;
  }

  const fontTable = {};
  for (const [id, font] of fonts) {
    fontTable[id] = { id, name: font.name, glyphCount: font.glyphCount, bold: font.bold, italic: font.italic };
  }

  const totals = {
    stage: stageRect(buffer),
    screens: Object.keys(screens).length,
    objects: Object.values(screens).reduce((sum, screen) => sum + screen.objects.length, 0),
    drawables: Object.values(screens).reduce((sum, screen) => sum + screen.drawables.length, 0),
    unresolved: Object.values(screens).reduce((sum, screen) => sum + screen.unresolved.length, 0),
    shapes: Object.keys(shapes).length,
    distinctCharacters: new Set(
      Object.values(screens).flatMap((screen) => screen.objects.map((object) => object.character))
    ).size,
    rootFrames: resolved.frames.length,
    failures: failures.length
  };
  return { screens, shapes, fonts: fontTable, failures, totals };
}

/**
 * WHY a placed object produced no drawable, or `null` when nothing explains it.
 *
 * ► **`null` IS THE POINT OF THIS FUNCTION.** Every other return value is a
 *   legitimate empty: a text character this tool never draws, a button with no
 *   UP record, a clip whose own frame 1 places nothing. Those are indis-
 *   tinguishable from a silent drop unless something says which they are, and
 *   `extract-props.mjs` learned that from the rain: a `framesWanted: 1` entry
 *   on character 1816 emits an empty prop, because frames 1-9 of the weather
 *   place nothing at all and frames 10-17 carry it.
 *
 * A function declaration, not an arrow: `ss2-assertion-quality.test.js` reads a
 * helper body by looking for the next brace before the next newline, so a
 * multi-line arrow reads as bodyless.
 */
function whyNothing(buffer, characters, object, cache, buttonCache) {
  if (object.kind === "text") {
    return "a text character is never drawn by this tool; its box is in textFields/staticText";
  }
  if (object.kind === "missing") return "no character with this id is defined in the file";
  if (object.kind === "button") {
    const records = buttonCache.get(object.character);
    if (records === null) return "its BUTTONRECORD list would not parse; see failures";
    if (records && records.every((record) => (record.states & BUTTON_STATE_UP) === 0)) {
      return `${records.length} BUTTONRECORDs and none is UP — a hit area, which draws nothing by design`;
    }
    return "its UP records reached only characters this tool cannot draw";
  }
  if (object.kind === "sprite") {
    const character = characters.get(object.character);
    const key = `${object.character}@1`;
    let inner = cache.get(key);
    if (inner === undefined) {
      inner = resolveTimeline(buffer, character, { frames: [1] }).frames[0] ?? null;
      cache.set(key, inner);
    }
    if (!inner || inner.length === 0) {
      return `frame 1 of this ${character.frames}-frame clip places nothing; the content is on a later frame`;
    }
    return null;
  }
  return null;
}

/**
 * A text character, kept as geometry rather than as a drawable.
 *
 * A function declaration rather than a closure so the two call sites — a text
 * field on the screen and one inside a button — cannot drift apart, which is
 * exactly how the button's 146 text records would have ended up counted
 * differently from the screen's own.
 */
function recordText(buffer, drawable, screen, characters, fonts, failures, screenName, approximations, note) {
  const character = characters.get(drawable.characterId);
  const placement = { path: drawable.path, matrix: roundMatrix(drawable.matrix) };
  if (character?.tagCode === TAG.DEFINE_EDIT_TEXT) {
    try {
      const field = parseEditText(buffer, character);
      screen.textFields.push({ ...field, ...placement });
      note("text-edit", drawable,
        `variable ${field.variableName || "(none)"}${field.initialText ? `, initially ${JSON.stringify(field.initialText).slice(0, 40)}` : ""}`);
    } catch (error) {
      failures.push({
        screen: screenName, kind: "edit-text-parse", character: drawable.characterId,
        message: String(error.message).slice(0, 160)
      });
      note("text-edit-unparsed", drawable, "the edit-text fields would not parse; see failures");
    }
    return;
  }
  try {
    const text = parseStaticText(buffer, character, fonts);
    // ► THE GLYPHS ARE THE SIZE OF WHAT IS MISSING. A static text run whose
    //   indices are never turned into letters is a word this pack cannot show,
    //   and the count is the only thing standing between that and a screen
    //   which merely looks as though it had no caption.
    approximations.staticTextGlyphs += text.glyphs;
    approximations.staticTextGlyphsUndecoded += text.undecoded;
    screen.staticText.push({ ...text, ...placement });
    note("text-static", drawable, text.text
      ? `${text.glyphs} glyphs reading ${JSON.stringify(text.text.slice(0, 48))} — the WORDS are known, the letterforms are not`
      : `${text.glyphs} glyphs and NO code table reached them; not even the words are known`);
  } catch (error) {
    failures.push({
      screen: screenName, kind: "static-text-parse", character: drawable.characterId,
      message: String(error.message).slice(0, 160)
    });
    note("text-static-unparsed", drawable, "the static-text records would not parse; see failures");
  }
}

export function parseArguments(argv) {
  const options = { file: null, out: path.join(REPO_ROOT, "assets", "screens"), report: false };
  const rest = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") {
      const next = argv[index + 1];
      if (typeof next !== "string" || next.startsWith("--")) {
        throw new ExtractScreensError("--out needs a directory path.");
      }
      options.out = next;
      index += 1;
    } else if (value === "--report") {
      options.report = true;
    } else if (value.startsWith("--")) {
      throw new ExtractScreensError(`Unknown option ${value}.`);
    } else {
      rest.push(value);
    }
  }
  options.file = rest[0] ?? DEFAULT_SWF;
  return options;
}

/**
 * The manifest a human reads, recomputed from the data every run.
 *
 * ► **RECOMPUTED, NEVER COPIED.** `assets/props/manifest.json` once said
 *   `failures: 0` while its own `props.json` carried eleven approximated
 *   regions, because the tally was written beside the data instead of out of
 *   it. `test/extraction-honesty.test.js` exists for that defect. Every number
 *   below is derived here from `screens` and `shapes`, so the only way for the
 *   manifest to disagree with the data is for this function to be wrong about
 *   both at once.
 */
export function buildManifest({ screens, shapes, fonts, failures, totals }, { source, sha256 }) {
  const approximationTotals = {};
  const unresolvedTotals = {};
  // ► **RECOUNTED FROM THE ROSTERS, NOT SUMMED FROM `counts.filtersByType`.**
  //   Summing the per-screen tally would make this agree with that tally by
  //   construction, which is the `assert.equal(X, X)` this project keeps
  //   finding; going back to the lists means a screen whose own tally has
  //   drifted shows up as a disagreement instead of being laundered.
  const filterTotals = filtersByType(
    ...Object.values(screens).map((screen) => screen.filteredPlacements ?? []),
    ...Object.values(screens).map((screen) => screen.filteredButtonRecords ?? [])
  );
  for (const screen of Object.values(screens)) {
    for (const [kind, count] of Object.entries(screen.approximations ?? {})) {
      approximationTotals[kind] = (approximationTotals[kind] ?? 0) + count;
    }
    for (const [kind, count] of Object.entries(screen.counts?.unresolvedByKind ?? {})) {
      unresolvedTotals[kind] = (unresolvedTotals[kind] ?? 0) + count;
    }
  }
  // Recounted off the shape table itself rather than trusted from the per-screen
  // tallies, which count a shape once per USE. The two answer different
  // questions and a reader needs to be told which is which.
  let paths = 0;
  const pathApproximations = {};
  for (const shape of Object.values(shapes)) {
    for (const entry of shape.paths ?? []) {
      paths += 1;
      if (entry.approximated) {
        pathApproximations[entry.approximated] = (pathApproximations[entry.approximated] ?? 0) + 1;
      }
    }
  }
  return {
    source,
    sha256,
    extractedFrom:
      "the ROOT timeline's FrameLabel tags; each screen is the CUMULATIVE display list at its label frame",
    totals: { ...totals, shapePaths: paths, fonts: Object.keys(fonts ?? {}).length },
    // The families the build sets its static text in. The code tables are read
    // and the words are known; the GLYPH OUTLINES are not extracted, which is
    // what `staticTextGlyphs` counts.
    fonts: fonts ?? {},
    // Per USE across the 26 screens — a shape on the chrome is counted 26 times.
    approximationsByUse: approximationTotals,
    // ► **WHAT THE BUILD ASKS FOR ON THESE SCREENS, BY KIND.** Also per USE, so
    //   a glow on the chrome is counted 26 times; the point is the SHAPE of the
    //   demand, which decides what a renderer has to be able to express.
    //   `src/render/filters.js` can emit a CSS string for glow, blur and
    //   dropShadow, defers colourMatrix to `applyColourMatrix`, and refuses
    //   bevel by name — so this table is the list of what it will be asked.
    filtersByType: filterTotals,
    // Per PATH in the shared shape table — each distinct shape counted once.
    approximationsByPath: pathApproximations,
    unresolvedByKind: unresolvedTotals,
    screens: Object.fromEntries(Object.entries(screens).map(([name, screen]) => [name, {
      labelFrame: screen.labelFrame,
      frames: `${screen.firstFrame}..${screen.lastFrame}`,
      objects: screen.counts?.objects ?? 0,
      drawables: screen.counts?.drawables ?? 0,
      distinctShapes: screen.counts?.distinctShapes ?? 0,
      unresolved: screen.counts?.unresolvedByKind ?? {},
      objectsDrawingNothing: screen.objectsDrawingNothing ?? [],
      approximations: screen.approximations ?? {},
      rangeVariance: screen.rangeVariance ?? null,
      resolvedNothing: screen.resolvedNothing === true,
      ...(screen.note ? { note: screen.note } : {})
    }])),
    failures
  };
}

function main(argv) {
  const options = parseArguments(argv);
  if (!fs.existsSync(options.file)) {
    throw new ExtractScreensError(
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

  const extraction = extractScreens(buffer);
  const manifest = buildManifest(extraction, { source: path.basename(options.file), sha256 });

  fs.mkdirSync(options.out, { recursive: true });
  fs.writeFileSync(
    path.join(options.out, "screens.json"),
    JSON.stringify({ screens: extraction.screens, shapes: extraction.shapes, fonts: extraction.fonts }, null, 1)
  );
  fs.writeFileSync(path.join(options.out, "manifest.json"), JSON.stringify(manifest, null, 1));

  process.stdout.write(`${summaryLines(extraction, manifest, options).join("\n")}\n`);
}

/**
 * The lines a human reads after a run.
 *
 * ► **EXPORTED SO THE UNITS CAN BE TESTED.** This was inline in `main` and so
 *   could only be checked by eye, which is how it came to print
 *   "(on 243 placements + 5 in button records)" — the left number in
 *   PLACEMENTS, the right in FILTERS, and on this build the button roster holds
 *   5 records carrying 5 filters, so the two readings coincided and nothing
 *   could tell them apart. A summary whose only reader is a person is a summary
 *   whose mistakes survive.
 */
export function summaryLines(extraction, manifest, options = {}) {
  const lines = [`screens -> ${options.out ?? "(nowhere)"}`];
  for (const screen of Object.values(extraction.screens)) {
    const approximated = Object.entries(screen.approximations ?? {})
      .filter(([, count]) => count > 0)
      .map(([kind, count]) => `${kind} ${count}`)
      .join(", ");
    lines.push(
      `  ${screen.name.padEnd(22)} f${String(screen.labelFrame).padStart(3)}  ` +
      `${String(screen.counts.objects).padStart(3)} obj  ` +
      `${String(screen.counts.drawables).padStart(4)} draw  ` +
      `${String(screen.counts.unresolved).padStart(3)} unresolved` +
      (screen.resolvedNothing ? "   *** RESOLVED NOTHING ***" : "") +
      (screen.counts.objectsDrawingNothing > 0
        ? `   (${screen.counts.objectsDrawingNothing} object(s) drew nothing)` : "")
    );
    if (options.report && approximated) lines.push(`      ~ ${approximated}`);
  }
  lines.push(
    `  ${extraction.totals.screens} screens, ${extraction.totals.distinctCharacters} distinct characters, ` +
    `${extraction.totals.shapes} shapes, ${manifest.totals.shapePaths} paths, ` +
    `${extraction.totals.failures} failures`
  );
  lines.push(
    "  approximated by path: " +
    (Object.entries(manifest.approximationsByPath).map(([kind, count]) => `${kind} ${count}`).join(", ") || "none")
  );
  lines.push(
    "  unresolved by kind:   " +
    (Object.entries(manifest.unresolvedByKind).map(([kind, count]) => `${kind} ${count}`).join(", ") || "none")
  );
  // ► **EVERY NUMBER ON THE FILTER LINES NAMES ITS UNIT.** ~~"(on 243
  //   placements + 5 in button records)"~~ — corrected 2026-09-14. That is
  //   exactly the confusion `filterRecords` exists beside `filters` to prevent,
  //   printed one line away from it. The type tally spans BOTH rosters, which
  //   the old line also did not say; it is on its own line now so that nothing
  //   reads as "these filters sit on those placements".
  const byUse = manifest.approximationsByUse ?? {};
  const typedFilters = Object.values(manifest.filtersByType ?? {}).reduce((sum, count) => sum + count, 0);
  lines.push(
    "  filters by type:      " +
    (Object.entries(manifest.filtersByType ?? {}).map(([kind, count]) => `${kind} ${count}`).join(", ") || "none")
  );
  lines.push(
    `  ${typedFilters} filters in all: ${byUse.filterRecords ?? 0} on ${byUse.filters ?? 0} filtered placements, ` +
    `${byUse.filtersInButtonRecords ?? 0} on ${byUse.buttonRecordsFiltered ?? 0} filtered button records ` +
    `(${byUse.buttonRecordsFilteredOverText ?? 0} of those over TEXT, reaching no drawable)`
  );
  if (options.report) for (const failure of extraction.failures.slice(0, 30)) {
    lines.push(`    ! ${failure.screen ?? "-"} ${failure.kind} ${failure.character ?? ""}: ${failure.message}`);
  }
  return lines;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
