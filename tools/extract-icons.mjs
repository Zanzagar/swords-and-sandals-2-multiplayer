/**
 * THE FACES AND THE FEEDBACK ICONS — the clips that stop a gladiator being a
 * blank head, and the splats, gauges and strips the fight talks through.
 *
 * Writes the gitignored `assets/icons/` tree. Node builtins only, READ-ONLY on
 * the build, like every tool in this directory.
 *
 * ## Why this is a fourth extractor and not a flag on one of the three
 *
 * `extract-figure.mjs` cuts a clip at its `FrameLabel`s. `extract-wardrobe.mjs`
 * takes frame 1 of each numbered export. `extract-props.mjs` takes every frame
 * of a named export by NUMBER. **The face is the first thing that is cut by
 * label AND is not the fighter**, and the icons are the first things whose
 * meaning lives one level DOWN from the frame the build indexes.
 *
 * ## WHAT WAS MEASURED HERE, AND WHAT IT OVERTURNS
 *
 * ► **THE COMBAT ICONS ARE TWO AXES AND THE OUTER ONE IS THE ANIMATION.**
 *   `damage_icon` (817) declares 30 frames — a scale-in over frames 1..5, a
 *   hold, and the number dropping off at frame 25. Those 30 frames are the
 *   POP. The MEANING is its child sprite `damage_splat` (815), which has
 *   **five** frames, and `damagecharacter` drives it directly:
 *
 *   ```text
 *     damage_icon.damage_splat.gotoAndStop(1)   normal      +0x1603
 *     damage_icon.damage_splat.gotoAndStop(3)   critical    +0x163b
 *     damage_icon.damage_splat.gotoAndStop(5)   grievous    +0x1698
 *   ```
 *
 *   `flattenFrame` renders a nested sprite AT ITS FRAME 1 unless told
 *   otherwise. So flattening `damage_icon`'s 30 frames yields splat 1 thirty
 *   times, five arts collapse to one, **and nothing reports a thing** — the
 *   drawable list is complete and the failure count is zero. That is this
 *   project's signature defect in a new place, so this tool **refuses to
 *   descend into a sprite with more than one frame**: such a child is emitted
 *   as a `clip` placement and extracted as its own entry. `bonus_icon`'s splat
 *   has EIGHT frames and `addstats_icon`'s has SEVEN; both would have collapsed
 *   the same way.
 *
 * ► **SIX MASKS IN `combat_panel` MASK A SPRITE, AND `flattenFrame` DROPS
 *   EVERY ONE OF THEM SILENTLY.** Inside `hero_potion`/`villain_potion` (733),
 *   shape 727 sits at depth 2 with `clipDepth` 5, and depth 3 is the sprite
 *   `blood_health` (729) holding the liquid. `flattenFrame` rebuilds its mask
 *   table per level and never threads an outer mask into a nested sprite, and
 *   a masked SPRITE is skipped before `unsupported` is ever set — so the liquid
 *   comes back whole, unclipped, with `maskPath: null` and no failure logged.
 *   The health bar would paint outside its vial and the extractor would call it
 *   a clean read. The same shape holds for the two stamina potions (742/736)
 *   and the two armour gauges (749/743).
 *
 *   **This tool therefore flattens with its own walk**, threading a mask down
 *   through nested sprites, and COUNTS the clips it assigns across a sprite
 *   boundary as `clipsAcrossSpriteBoundary` — the exact number `flattenFrame`
 *   loses. `tools/swf-display-list.mjs` is not this file's to change; the count
 *   is the report.
 *
 * ► **TWO OF THE FIVE FEEDBACK ICONS ARE DEAD IN THIS BUILD.** `miss_icon`
 *   (823) and `addstats_icon` (162) are exported and never used: each of those
 *   two strings occurs **once** in the whole 7,586,504-byte file, and that one
 *   occurrence is its own `ExportAssets` entry. `damage_icon`, `defend_icon`
 *   and `bonus_icon` each occur twice — the export, plus the constant pool of
 *   the block that attaches them. They are extracted anyway and carry
 *   `attachedBy: null`: **deleting a dead symbol from the list would delete the
 *   finding with it.**
 *
 * ► **THE FACE IS DRIVEN BY LABEL, AND SIX OF 228 CALLS NAME A LABEL THAT DOES
 *   NOT EXIST.** Clip 1241 makes 120 `head.eyes.goto*` and 108
 *   `head.mouth.goto*` calls. `mouth1` has no `Smile` frame and no `Pain`
 *   frame, yet the build asks for `Smile` five times and `pain` once. A further
 *   run of calls differ from the label only in CASE (`Blink` for `blink`,
 *   `angry` for `Angry`). Both are counted rather than normalised away: the
 *   case question is a runtime one this tool may not settle, and a renderer
 *   that lower-cases everything would be asserting an answer nobody measured.
 *
 * ## What a renderer needs from this, and what it must still decide
 *
 * The dressing code is at root frame 35, `updatecharacter` (`0x40bf76`):
 *
 * ```text
 *   head.attachMovie("eyes1",  "eyes",  1)     +0x40cc5f
 *   head.attachMovie("mouth1", "mouth", 2)     +0x40cc7c
 *   head.eyes._y = -14                         +0x40cca7
 *   head.eyes._x = -3                          +0x40ccc0
 * ```
 *
 * **The eyes are offset in the head's space and the mouth is not.** Those two
 * numbers are pixels, not twips — they are AS2 properties, not matrix fields —
 * and they are carried here as `offset` so nobody has to divide them by 20.
 *
 * `src/render/extracted-figure.js` owns the ATTACHMENTS table and the dressing
 * loop; this file writes DATA and names what the loop will need. It does not
 * touch that renderer.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { parseShape, shapeToPaths } from "./swf-shapes.mjs";
import {
  IDENTITY_COLOUR_TRANSFORM,
  IDENTITY_MATRIX,
  TAG,
  composeColourTransform,
  composeMatrix,
  deriveAnimations,
  indexCharacters,
  readFrameLabels,
  resolveTimeline
} from "./swf-display-list.mjs";
import { assertReplaceableFile, assertWritableOutput, labelKey } from "./extract-figure.mjs";
import { analyseSwfBuffer } from "./inspect-swf.mjs";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The same default every other tool that reads the build uses. */
const DEFAULT_SWF =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";

/** The oracle's sha256. Recorded and REPORTED — never enforced. */
export const ORACLE_SHA256 = "77cb545c2061ab41246251467a4edf5926ab6fd1ddd95dc9527d7ba9c45bb8ca";

const TWIPS_PER_PIXEL = 20;

/** Guards `visit` against a sprite that reaches itself; the same cap the display list uses. */
const MAX_NESTING = 8;

export class ExtractIconsError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/* ------------------------------------------------------------------ */
/* WHAT IS TAKEN, and who reads it                                     */
/* ------------------------------------------------------------------ */

/**
 * The two face clips.
 *
 * ► **THERE IS NO `eyes2` AND NO `mouth2`.** The build exports 502 symbols;
 *   `eyes1` and `mouth1` are the only members of their families, so the FACE
 *   does not vary between gladiators — the `features`, `hair` and `facehair`
 *   families do that, and `extract-wardrobe.mjs` already takes them. What
 *   varies here is the EXPRESSION, and that is what the labels are.
 */
export const FACE_CLIPS = Object.freeze([
  Object.freeze({
    key: "eyes",
    linkage: "eyes1",
    attachedTo: "head",
    instance: "eyes",
    depth: 1,
    /** `head.eyes._x = -3`, `head.eyes._y = -14` at `+0x40ccc0`/`+0x40cca7`. PIXELS. */
    offset: Object.freeze({ x: -3, y: -14 }),
    attachedBy: "root frame 35, updatecharacter +0x40cc5f",
    reader: "src/render/extracted-figure.js — the head's depth 1"
  }),
  Object.freeze({
    key: "mouth",
    linkage: "mouth1",
    attachedTo: "head",
    instance: "mouth",
    depth: 2,
    /** The mouth gets NO `_x`/`_y` — measured, not assumed. */
    offset: null,
    attachedBy: "root frame 35, updatecharacter +0x40cc7c",
    reader: "src/render/extracted-figure.js — the head's depth 2"
  })
]);

/**
 * The clip whose frame labels DRIVE the face, and the members it drives.
 *
 * The fighter rig's 101 labels are the vocabulary `extract-figure.mjs` and
 * `extract-sounds.mjs` already join on, so binding the expression calls to the
 * same labels makes three extractions share one index rather than three.
 */
export const EXPRESSION_DRIVER = Object.freeze({ character: 1241, linkage: "hero_battle" });

/** The members a `goto` call has to reach through for this tool to count it. */
export const FACE_MEMBERS = Object.freeze(["eyes", "mouth"]);

/**
 * What a NESTED clip's own frame means, where the build says so out loud.
 *
 * ► **THIS IS THE SECOND AXIS AND IT IS THE ONE THAT CARRIES THE MEANING.**
 *   `damagecharacter` never touches `damage_icon`'s 30 frames; it reaches
 *   straight past them into the child:
 *
 *   ```text
 *     +0x1603  damage_icon.damage_splat.gotoAndStop(1)   after "normal"
 *     +0x163b  damage_icon.damage_splat.gotoAndStop(3)   under "critical"
 *     +0x1698  damage_icon.damage_splat.gotoAndStop(5)   under "grievous"
 *   ```
 *
 *   Frames 2 and 4 are never asked for by name. They are still extracted —
 *   **a frame nothing indexes is a finding, not a reason to drop it** — and the
 *   three that ARE indexed are named here so a renderer does not have to guess
 *   which of five splats a critical hit wants.
 *
 *   `bonus_icon`'s child has eight frames and `addstats_icon`'s has seven, and
 *   this session found no `gotoAndStop` selecting either. That gap is recorded
 *   as `null` rather than filled in with a plausible order.
 */
export const NESTED_MEANINGS = Object.freeze({
  815: Object.freeze({
    instance: "damage_splat",
    parent: 817,
    frames: Object.freeze({ 1: "normal", 3: "critical", 5: "grievous" }),
    source: "damagecharacter, sprite 862 frame 52, +0x1603 / +0x163b / +0x1698"
  }),
  151: Object.freeze({
    instance: "damage_splat",
    parent: 153,
    frames: null,
    source: "no gotoAndStop on this child was found; eight frames, meanings unknown"
  }),
  161: Object.freeze({
    instance: "damage_splat",
    parent: 162,
    frames: null,
    source: "its parent addstats_icon is itself unreferenced in this build"
  }),
  58: Object.freeze({
    instance: "battlebutton",
    parent: 116,
    frames: Object.freeze({ 1: "up", 2: "over" }),
    source: "the strip's own button background; hidden outright on the spell path, +0x239a"
  })
});

/**
 * The icon strips and the panel, by character id.
 *
 * ► **BY ID RATHER THAN BY LINKAGE, deliberately.** Every entry here is also an
 *   `ExportAssets` name, but the id is what `indexCharacters` keys on and what
 *   the census, the manifest and every offset in this docstring cite. An entry
 *   whose `linkage` no longer matches the name in the build is a LOUD failure
 *   rather than a silent substitution.
 */
export const ICON_CLIPS = Object.freeze([
  Object.freeze({
    character: 116,
    linkage: "inventory_buttons",
    /**
     * ► **ONE STRIP, TWO INDEXES, AND A HOLE IN THE MIDDLE.**
     *   `inventory_buttonN.gotoAndStop(_root.game.hero.inventoryN)` (sprite 492
     *   frame 1, `+0x0132`..`+0x0204`) indexes it by the ITEM in that slot, and
     *   `cast_spell.inventory_icons.gotoAndStop(spell_number)` (`+0x2376`)
     *   indexes it by the SPELL. Both read `_root.inventory[]`.
     *
     * ► **FRAME 1 IS THE EMPTY SLOT AND THE BUILD HIDES THE CLIP RATHER THAN
     *   SHOWING IT**: `if (hero.inventoryN == 1) inventory_buttonN._visible =
     *   false` (`+0x02c4`). And frames 12..29 are the SAME bare background as
     *   frame 1 — eighteen indexes with no art. 49 slots, 30 drawings.
     *
     * ► **DEPTH 1 IS `battlebutton` AND IT IS NOT PART OF THE ICON.** The
     *   spell path hides it explicitly (`cast_spell.inventory_icons
     *   .battlebutton._visible = false`, `+0x239a`) while the inventory path
     *   keeps it, because there it IS the button. A renderer must be able to
     *   drop it, so it is emitted as its own `clip` placement rather than
     *   flattened into the icon.
     */
    indexedBy: "item id (hero.inventoryN) or spell id (cast_spell_icon's spell_number)",
    attachedBy: "PlaceObject: inventory_button1..6 in sprite 492, inventory_icons in sprite 120",
    reader: "the inventory bar and the cast-spell burst"
  }),
  Object.freeze({
    character: 120,
    linkage: "cast_spell_image",
    /**
     * ► **IT CONTAINS THE STRIP.** Depth 1 of this clip IS character 116, named
     *   `inventory_icons`, so the spell art is chosen by advancing a nested
     *   clip the build sets separately. Flattening it here would freeze that
     *   child at frame 1 and ship a burst with an empty icon in it; instead the
     *   child is a `clip` placement and the renderer composites the strip frame
     *   it wants into the matrix given.
     */
    indexedBy: "frame, as a 40-frame zoom burst; the SPELL is chosen on the nested strip",
    attachedBy: "arena.combat_panel.attachMovie('cast_spell_image','cast_spell',…) +0x22da/+0x2350",
    reader: "the cast-spell flourish, at stage (60, 50) for the hero and (580, 50) for the villain"
  }),
  Object.freeze({
    character: 817,
    linkage: "damage_icon",
    indexedBy: "frame, as a 30-frame pop; the SEVERITY is damage_splat's own frame 1/3/5",
    attachedBy: "damagecharacter, sprite 862 frame 52 +0x15ea, depth 25000",
    reader: "the damage splat over a struck gladiator"
  }),
  Object.freeze({
    character: 821,
    linkage: "defend_icon",
    indexedBy: "frame, as a 30-frame pop",
    attachedBy: "defender_blocked, sprite 862 frame 52 +0x21ce, depth 25005",
    reader: "the block/parry callout"
  }),
  Object.freeze({
    character: 823,
    linkage: "miss_icon",
    /**
     * ► **DEAD IN THIS BUILD.** `miss_icon` occurs ONCE in the file and that
     *   occurrence is its own export entry: nothing attaches it, nothing names
     *   it. It shares its art (sprite 819 → shape 818) with `defend_icon` and
     *   differs only in its text character (822 against 820) and in having ten
     *   more frames, which are a fade-out `defend_icon` does not have.
     */
    indexedBy: "frame, as a 40-frame pop with a fade-out on 36..40",
    attachedBy: null,
    reader: null
  }),
  Object.freeze({
    character: 153,
    linkage: "bonus_icon",
    indexedBy: "frame, as a 40-frame pop; the BONUS is damage_splat's own 8 frames",
    attachedBy: "magic_damage_character +0x1313 at depth 25005, and eight sites at depth 25001",
    reader: "the magic/bonus callout"
  }),
  Object.freeze({
    character: 162,
    linkage: "addstats_icon",
    /** ► **DEAD IN THIS BUILD**, on the same one-occurrence evidence as `miss_icon`. */
    indexedBy: "frame, as a 30-frame rise; its damage_splat has 7 frames",
    attachedBy: null,
    reader: null
  }),
  Object.freeze({
    character: 751,
    linkage: "combat_panel",
    /**
     * ► **ATTACHED TO THE ARENA CLIP, NOT PLACED ON A SCREEN.**
     *   `attachMovie("combat_panel", "combat_panel", 200000)` in sprite 2249
     *   frame 1 (`0x6e421b`). Its ONE `PlaceObject2` in the whole build is in
     *   sprite 1497 — a single-frame, 250-placement symbol holder with one
     *   named instance — which is a compiler's export bin and not a screen.
     *
     * ► **IT IS NOT ONE BAND.** Composed bounds run y −258.20..115.35: the
     *   gauges sit at y 18..115 and `crowd_text` sits at y −258.8, three
     *   hundred pixels above them. A renderer that treats the 640.5 x 373.5
     *   bounds as a solid bar puts a 300px transparent gap on screen.
     */
    indexedBy: "frame 1; it has only one",
    attachedBy: "sprite 2249 frame 1 @0x6e421b, name combat_panel, depth 200000",
    reader: "the hit-point, stamina and armour gauges and the crowd line"
  })
]);

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

export function parseArguments(argv) {
  const options = { file: null, out: path.join(REPO_ROOT, "assets", "icons"), report: false };
  const rest = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") {
      const next = argv[index + 1];
      if (typeof next !== "string" || next.startsWith("--")) {
        throw new ExtractIconsError("--out needs a directory path.");
      }
      options.out = next;
      index += 1;
    } else if (value === "--report") {
      options.report = true;
    } else if (value.startsWith("--")) {
      throw new ExtractIconsError(`Unknown flag "${value}".`);
    } else {
      rest.push(value);
    }
  }
  if (rest.length > 1) throw new ExtractIconsError(`Unexpected argument: ${rest[1]}`);
  options.file = rest[0] ?? DEFAULT_SWF;
  return options;
}

/* ------------------------------------------------------------------ */
/* Rounding — the same numbers extract-props and extract-wardrobe emit  */
/* ------------------------------------------------------------------ */

const px = (twips) => Math.round((twips / TWIPS_PER_PIXEL) * 100) / 100;

/**
 * `{a,b,c,d,tx,ty}` to a six-element array, scales to 5 places and translations
 * to 1.
 *
 * ► **THE TRANSLATIONS STAY IN TWIPS**, because `composeMatrix` composes in
 *   twips and rounding to pixels mid-compose loses exactness. Path data from
 *   `shapeToPaths` is in PIXELS. Mixing the two has cost this project two
 *   defects already, so a consumer divides `tx`/`ty` by 20 and nothing else.
 *
 * ► **`-0` is normalised to `0`**, or a byte-identical re-extraction compares
 *   unequal under `Object.is` and reads as a change.
 */
export function roundMatrix(matrix) {
  const r = (value, places) => {
    const factor = 10 ** places;
    const rounded = Math.round(value * factor) / factor;
    return Object.is(rounded, -0) ? 0 : rounded;
  };
  return [r(matrix.a, 5), r(matrix.b, 5), r(matrix.c, 5), r(matrix.d, 5), r(matrix.tx, 1), r(matrix.ty, 1)];
}

/** A colour transform as eight numbers, or null when it is the identity. */
export function roundColour(transform) {
  if (!transform) return null;
  const r = (value) => Math.round(value * 1000) / 1000;
  const out = [
    r(transform.redMultiplier), r(transform.greenMultiplier),
    r(transform.blueMultiplier), r(transform.alphaMultiplier),
    Math.round(transform.redOffset), Math.round(transform.greenOffset),
    Math.round(transform.blueOffset), Math.round(transform.alphaOffset)
  ];
  const isIdentity = out[0] === 1 && out[1] === 1 && out[2] === 1 && out[3] === 1
    && out[4] === 0 && out[5] === 0 && out[6] === 0 && out[7] === 0;
  return isIdentity ? null : out;
}

/* ------------------------------------------------------------------ */
/* Text characters — RECOVERED metadata, never glyphs                  */
/* ------------------------------------------------------------------ */

/** A bit cursor, for the RECT that opens every text tag. Matrices are not byte-aligned. */
class BitCursor {
  constructor(buffer, byteOffset) {
    this.buffer = buffer;
    this.byte = byteOffset;
    this.bit = 0;
  }

  readUB(bits) {
    let value = 0;
    for (let index = 0; index < bits; index += 1) {
      value = (value << 1) | ((this.buffer[this.byte] >>> (7 - this.bit)) & 1);
      this.bit += 1;
      if (this.bit === 8) { this.bit = 0; this.byte += 1; }
    }
    return value >>> 0;
  }

  readSB(bits) {
    if (bits === 0) return 0;
    const raw = this.readUB(bits);
    const sign = 1 << (bits - 1);
    return (raw & sign) ? raw - (1 << bits) : raw;
  }

  /** The next byte boundary, which is where the SWF spec starts the next structure. */
  aligned() {
    return this.bit === 0 ? this.byte : this.byte + 1;
  }
}

/** A SWF RECT in twips, and the byte offset the next structure starts at. */
export function readRect(buffer, offset) {
  const cursor = new BitCursor(buffer, offset);
  const bits = cursor.readUB(5);
  const xMin = cursor.readSB(bits);
  const xMax = cursor.readSB(bits);
  const yMin = cursor.readSB(bits);
  const yMax = cursor.readSB(bits);
  return { bounds: { xMin, xMax, yMin, yMax }, next: cursor.aligned() };
}

function readCString(buffer, start, end) {
  let cursor = start;
  while (cursor < end && buffer[cursor] !== 0) cursor += 1;
  return { value: buffer.toString("utf8", start, cursor), next: Math.min(cursor + 1, end) };
}

/**
 * A `DefineEditText`'s box, font, colour and BINDING — everything but the glyphs.
 *
 * ► **THIS IS WHY THE ICONS ARE NOT JUST PICTURES.** `damage_icon`'s text
 *   character 816 is bound to the variable `damage`; the splat is the frame and
 *   the NUMBER is a field the build writes into. A renderer that drew only the
 *   shapes would show an empty splat over every hit. The glyph outlines still
 *   are not extracted — that needs the font tags — so this is reported as an
 *   approximation of kind `edit-text` even though the box is exact.
 */
export function parseEditText(buffer, bodyStart, bodyEnd) {
  const id = buffer.readUInt16LE(bodyStart);
  const rect = readRect(buffer, bodyStart + 2);
  let cursor = rect.next;
  const flags = buffer.readUInt16BE(cursor);
  cursor += 2;
  const bit = (index) => (flags & (1 << index)) !== 0;
  const hasText = bit(15);
  const hasTextColour = bit(10);
  const hasMaxLength = bit(9);
  const hasFont = bit(8);
  const hasFontClass = bit(7);
  const hasLayout = bit(5);

  const field = {
    id,
    kind: "edit-text",
    bounds: {
      xMin: px(rect.bounds.xMin), xMax: px(rect.bounds.xMax),
      yMin: px(rect.bounds.yMin), yMax: px(rect.bounds.yMax)
    },
    multiline: bit(13),
    readOnly: bit(11),
    html: bit(1),
    fontId: null, fontHeight: null, colour: null, maxLength: null,
    align: null, variable: null, initialText: null
  };
  if (hasFont) { field.fontId = buffer.readUInt16LE(cursor); cursor += 2; }
  if (hasFontClass) { cursor = readCString(buffer, cursor, bodyEnd).next; }
  if (hasFont) { field.fontHeight = px(buffer.readUInt16LE(cursor)); cursor += 2; }
  if (hasTextColour) {
    field.colour = {
      red: buffer[cursor], green: buffer[cursor + 1],
      blue: buffer[cursor + 2], alpha: buffer[cursor + 3]
    };
    cursor += 4;
  }
  if (hasMaxLength) { field.maxLength = buffer.readUInt16LE(cursor); cursor += 2; }
  if (hasLayout) {
    field.align = ["left", "right", "center", "justify"][buffer[cursor]] ?? String(buffer[cursor]);
    cursor += 9;
  }
  const variable = readCString(buffer, cursor, bodyEnd);
  field.variable = variable.value || null;
  cursor = variable.next;
  if (hasText) field.initialText = readCString(buffer, cursor, bodyEnd).value;
  return field;
}

/**
 * A `DefineText`/`DefineText2`'s box, and nothing else.
 *
 * The glyph run indexes a font's shape table, which this tool does not read, so
 * what comes back is the RECTANGLE the build reserved. It is counted as an
 * approximation of kind `static-text`: a renderer knows where the words go and
 * has to supply its own.
 */
export function parseStaticText(buffer, bodyStart) {
  const id = buffer.readUInt16LE(bodyStart);
  const rect = readRect(buffer, bodyStart + 2);
  return {
    id,
    kind: "static-text",
    bounds: {
      xMin: px(rect.bounds.xMin), xMax: px(rect.bounds.xMax),
      yMin: px(rect.bounds.yMin), yMax: px(rect.bounds.yMax)
    },
    // Explicit nulls rather than absent keys: a consumer that reads
    // `field.fontHeight` must get null for a static field, not undefined, or
    // the two kinds cannot be handled by one branchless path.
    fontId: null, fontHeight: null, colour: null, maxLength: null,
    align: null, variable: null, initialText: null,
    multiline: false, readOnly: true, html: false
  };
}

/* ------------------------------------------------------------------ */
/* The flatten this tool does itself                                   */
/* ------------------------------------------------------------------ */

/**
 * One frame's display list, flattened — with two differences from
 * `flattenFrame`, each of which exists because of a defect measured above.
 *
 * 1. **A sprite with more than one frame is NOT descended into.** It comes back
 *    as `{kind: "clip"}` and the caller extracts it separately. Descending
 *    would pin it at frame 1 and lose every other meaning it has, reporting
 *    nothing.
 * 2. **A mask is threaded DOWN through nested sprites.** `flattenFrame`
 *    rebuilds its mask table per level, so an outer mask over a nested sprite
 *    is lost with no `unsupported` set and no failure raised. The six gauges in
 *    `combat_panel` are all of that shape.
 *
 * Every drawable this cannot turn into geometry carries `unsupported` naming
 * the kind, and the caller counts it. Nothing is dropped.
 */
export function flattenIconFrame(buffer, characters, entries, options = {}) {
  const { cache = new Map(), spriteFrame = () => 1 } = options;
  const drawables = [];
  let clipsAcrossSpriteBoundary = 0;

  const innerFrame = (sprite, wanted) => {
    const key = `${sprite.id}@${wanted}`;
    if (!cache.has(key)) {
      const resolved = resolveTimeline(buffer, sprite, { frames: [wanted] });
      cache.set(key, resolved.frames[wanted - 1] ?? null);
    }
    return cache.get(key);
  };

  const visit = (list, parentMatrix, parentColour, parentPath, inheritedMask, depth, visiting) => {
    if (depth > MAX_NESTING) {
      throw new ExtractIconsError(`Sprite nesting exceeded ${MAX_NESTING} at path ${parentPath.join("/")}.`);
    }
    // Which depths on THIS level a mask covers, and which masks are shapes and
    // so can become a clip path at all. A sprite mask would need its own
    // flatten and a multi-shape clip; the build has none on anything declared
    // here, and refusing what has not been measured is this repository's rule.
    const maskAt = new Map();
    for (const entry of list) {
      if (typeof entry.clipDepth !== "number" || entry.clipDepth <= 0) continue;
      const mask = characters.get(entry.characterId);
      const usable = mask && mask.kind === "shape";
      for (const other of list) {
        if (other.depth > entry.depth && other.depth <= entry.clipDepth && !maskAt.has(other.depth)) {
          maskAt.set(other.depth, { entry, usable });
        }
      }
    }

    for (const entry of list) {
      const isMask = typeof entry.clipDepth === "number" && entry.clipDepth > 0;
      const matrix = composeMatrix(parentMatrix, entry.matrix ?? IDENTITY_MATRIX);
      const colour = composeColourTransform(parentColour, entry.colourTransform ?? IDENTITY_COLOUR_TRANSFORM);
      const here = [...parentPath, entry.depth];

      // A mask is a CUTTER. Painting it puts the stencil on the canvas instead
      // of the picture, so it is never emitted as a drawable of its own — it
      // travels on the things it clips, which is where a renderer needs it.
      if (isMask) {
        const mask = characters.get(entry.characterId);
        if (!mask || mask.kind !== "shape") {
          drawables.push({
            kind: "mask", characterId: entry.characterId, matrix, colour: null,
            path: here, name: entry.name ?? null, mask: null,
            unsupported: mask ? `mask-${mask.kind}` : "mask-missing"
          });
        }
        continue;
      }

      const own = maskAt.get(entry.depth);
      let mask = inheritedMask;
      if (own) {
        mask = own.usable
          ? { shape: own.entry.characterId, matrix: composeMatrix(parentMatrix, own.entry.matrix ?? IDENTITY_MATRIX) }
          : mask;
      }
      // A mask that came from an ancestor LEVEL is one `flattenFrame` drops,
      // because it rebuilds its table per level and never threads one down.
      const inherited = mask !== null && mask === inheritedMask && inheritedMask !== null;

      const character = characters.get(entry.characterId);
      if (!character) {
        drawables.push({
          kind: "missing", characterId: entry.characterId, matrix, colour: roundColour(colour),
          path: here, name: entry.name ?? null, mask, unsupported: "missing"
        });
        continue;
      }

      if (character.kind === "sprite") {
        // ► A MULTI-FRAME CHILD IS ITS OWN ASSET. See this file's header: the
        //   five damage splats, the eight bonus splats and the 49-frame icon
        //   strip all live one level down from the clip the build indexes.
        if (character.frames > 1) {
          drawables.push({
            kind: "clip", characterId: character.id, matrix, colour: roundColour(colour),
            path: here, name: entry.name ?? null, mask, frameCount: character.frames,
            unsupported: null
          });
          if (inherited) clipsAcrossSpriteBoundary += 1;
          continue;
        }
        if (visiting.has(character.id)) {
          throw new ExtractIconsError(`Sprite ${character.id} contains itself at ${here.join("/")}.`);
        }
        const inner = innerFrame(character, spriteFrame(character.id));
        if (!inner) continue;
        visiting.add(character.id);
        visit(inner, matrix, colour, here, mask, depth + 1, visiting);
        visiting.delete(character.id);
        continue;
      }

      if (inherited) clipsAcrossSpriteBoundary += 1;
      drawables.push({
        kind: character.kind,
        characterId: character.id,
        matrix,
        colour: roundColour(colour),
        path: here,
        name: entry.name ?? null,
        mask,
        ratio: entry.ratio ?? null,
        // A shape is geometry; everything else names what it is and is counted.
        // `text-placement` rather than `text`, because the MANIFEST also counts
        // the text CHARACTERS behind them and two tallies called the same thing
        // read as one number that contradicts itself.
        unsupported: character.kind === "shape" ? null : `${character.kind}-placement`
      });
    }
  };

  visit(entries, IDENTITY_MATRIX, IDENTITY_COLOUR_TRANSFORM, [], null, 0, new Set());
  return { drawables, clipsAcrossSpriteBoundary };
}

/** One placement, as it reaches JSON. */
function toPlacement(drawable) {
  return {
    kind: drawable.kind === "shape" ? "shape" : drawable.kind,
    character: drawable.characterId,
    matrix: roundMatrix(drawable.matrix),
    ...(drawable.colour ? { colour: drawable.colour } : {}),
    ...(drawable.name ? { name: drawable.name } : {}),
    ...(drawable.frameCount ? { frameCount: drawable.frameCount } : {}),
    // The clip travels WITH the thing it clips: a renderer has to set it before
    // the fill and clear it after, and a list of cutters somewhere else is an
    // invitation to forget one.
    ...(drawable.mask ? { mask: { shape: drawable.mask.shape, matrix: roundMatrix(drawable.mask.matrix) } } : {})
  };
}

/**
 * Every frame of one clip, plus the tallies that make the frame count mean
 * something.
 *
 * `duplicateOf` is the load-bearing one: it says which frames are byte-identical
 * to an earlier frame, INCLUDING THEIR MATRICES. A tally that compared only
 * character ids would call `eyes1` eight distinct frames when Up, Down, Left
 * and Right differ from Normal only by where the pupils sit — the shapes are
 * the same three every time. `bullet`'s fifty frames and five arrows taught this
 * in one direction; the pupils teach it in the other.
 */
function extractClipFrames(buffer, characters, character, cache, sink) {
  const wanted = Array.from({ length: character.frames }, (unused, index) => index + 1);
  const resolved = resolveTimeline(buffer, character, { frames: wanted });
  const frames = [];
  const signatures = [];
  let clipsAcrossSpriteBoundary = 0;

  for (let index = 0; index < character.frames; index += 1) {
    const list = resolved.frames[index];
    if (!list) { frames.push([]); signatures.push(""); continue; }
    let flattened;
    try {
      flattened = flattenIconFrame(buffer, characters, list, { cache });
    } catch (error) {
      sink.failures.push({ character: character.id, frame: index + 1, message: String(error.message).slice(0, 140) });
      frames.push([]);
      signatures.push("");
      continue;
    }
    clipsAcrossSpriteBoundary += flattened.clipsAcrossSpriteBoundary;
    const placements = [];
    for (const drawable of flattened.drawables) {
      if (drawable.unsupported) {
        sink.approximations[drawable.unsupported] = (sink.approximations[drawable.unsupported] ?? 0) + 1;
      }
      if (drawable.kind === "shape") sink.shapeIds.add(drawable.characterId);
      if (drawable.kind === "text") sink.textIds.add(drawable.characterId);
      if (drawable.kind === "clip") {
        sink.clipIds.add(drawable.characterId);
        if (drawable.name) {
          if (!sink.clipNames.has(drawable.characterId)) sink.clipNames.set(drawable.characterId, new Set());
          sink.clipNames.get(drawable.characterId).add(drawable.name);
        }
      }
      if (drawable.mask) sink.shapeIds.add(drawable.mask.shape);
      if (drawable.kind === "mask" || drawable.kind === "missing") {
        sink.failures.push({
          character: character.id, frame: index + 1,
          message: `${drawable.unsupported} at path ${drawable.path.join("/")} (character ${drawable.characterId})`
        });
        continue;
      }
      placements.push(toPlacement(drawable));
    }
    frames.push(placements);
    signatures.push(JSON.stringify(placements));
  }

  const seen = new Map();
  const duplicateOf = {};
  for (let index = 0; index < signatures.length; index += 1) {
    const signature = signatures[index];
    if (signature === "") continue;
    if (seen.has(signature)) duplicateOf[index + 1] = seen.get(signature);
    else seen.set(signature, index + 1);
  }
  return {
    frames,
    declaredFrames: character.frames,
    distinctFrames: seen.size,
    emptyFrames: signatures.reduce((count, signature) => count + (signature === "" ? 1 : 0), 0),
    duplicateOf,
    clipsAcrossSpriteBoundary
  };
}

/* ------------------------------------------------------------------ */
/* What each timeline DOES, which decides how long a pose lasts         */
/* ------------------------------------------------------------------ */

/** A `Push`'s operand list, or null when the instruction is not one. */
function pushOperands(instruction) {
  return (instruction && instruction.name === "Push" && Array.isArray(instruction.operand))
    ? instruction.operand
    : null;
}

/**
 * The `stop()`s and the self-deletes on every timeline in the build.
 *
 * ► **EVERY LABELLED RUN ON `eyes1` AND `mouth1` ENDS IN A `stop()`**, twelve
 *   and ten of them, on frames 9, 19, 29 … So `head.eyes.gotoAndPlay("Angry")`
 *   runs frames 80..89 and halts — and because all ten of those frames hold the
 *   identical placement (measured: `distinctPoses` is 1 for every one of the 22
 *   expressions), **the face is 22 STILLS, not 22 animations.** A renderer
 *   picks one pose per label and holds it. Without the stops that conclusion
 *   would be wrong in the opposite direction: a clip with no stop runs on into
 *   the NEXT expression and wraps at the end, which is a face that cycles
 *   through every mood on its own.
 *
 * ► **EVERY FEEDBACK ICON DELETES ITSELF ON ITS LAST FRAME** —
 *   `this.removeMovieClip()` on frame 30 of `damage_icon`, `defend_icon` and
 *   `addstats_icon`, frame 40 of `miss_icon`, `bonus_icon` and
 *   `cast_spell_image`. They are one-shot: attached at a depth in the 25000s,
 *   played once, gone. A renderer that leaves one on screen has invented a
 *   behaviour the build does not have.
 *
 * ► **AND `bonus_icon` JITTERS ON SPAWN**: frame 1 is
 *   `this._x = this._x + (-40 + random(80))`, so two bonuses in one blow do not
 *   land on top of each other.
 *
 * A DoAction that is none of these is REPORTED with its opcode names rather
 * than ignored: an action this recogniser cannot name is exactly the thing that
 * would otherwise become an invisible behaviour.
 */
export function deriveTimelineActions(analysis) {
  const byCharacter = new Map();
  for (const block of analysis.actionBlocks) {
    // ► **`/DoAction@` IS LOAD-BEARING IN THIS MATCH.** A `combat_panel`
    //   context also comes back as `sprite:751/frame:1/instance:crowd_bar/
    //   clip-action:0`, which is an `onClipEvent` handler hung on a PLACEMENT,
    //   not an action on this timeline. Attributing one to the other put eight
    //   handlers on `combat_panel`'s frame 1 and called them unrecognised
    //   timeline actions. They are neither unrecognised nor on the timeline —
    //   `deriveClipEvents` below reads them properly.
    const match = /^sprite:(\d+)\/frame:(\d+)\/DoAction@/.exec(block.context);
    if (!match) continue;
    const id = Number(match[1]);
    const frame = Number(match[2]);
    if (!byCharacter.has(id)) byCharacter.set(id, { stops: [], removesSelfAt: null, other: [] });
    const record = byCharacter.get(id);
    const names = block.instructions.map((instruction) => instruction.name);
    const removes = block.instructions.some((instruction) => {
      const operands = pushOperands(instruction);
      return operands !== null && operands.some((operand) => operand.value === "removeMovieClip");
    });
    if (names.includes("Stop") && names.every((name) => name === "Stop" || name === "End")) {
      record.stops.push(frame);
    } else if (removes) {
      record.removesSelfAt = frame;
    } else {
      record.other.push({ frame, opcodes: names.filter((name) => name !== "End").slice(0, 12) });
    }
  }
  for (const record of byCharacter.values()) record.stops.sort((left, right) => left - right);
  return byCharacter;
}

/**
 * The `onClipEvent` handlers hung on a clip's own PLACEMENTS.
 *
 * ► **THE COMBAT PANEL IS NOT STATIC ART, AND ITS GAUGES ARE NOT SHAPES — THEY
 *   ARE A MASK OVER A SLIDING SPRITE DRIVEN BY ONE OF THESE.** Disassembled
 *   from `sprite:751/frame:1/instance:villain_potion/clip-action:0`:
 *
 *   ```text
 *     this.hitpoints          = game.villain.hitpoints + " / " + game.villain.hitpointsmax
 *     this.hitpointpercentage = round(game.villain.hitpoints / game.villain.hitpointsmax * 100)
 *     this.blood_health._y    = round(-30 + (101 - this.hitpointpercentage) * 0.7)
 *   ```
 *
 *   So the liquid sprite `blood_health` SLIDES — `_y` −29.3 at full, 40.7 at
 *   empty — and shape 727's `clipDepth` 5 is the vial that crops it. Drop
 *   either half and the bar is wrong in a way that still draws something:
 *   without the mask the liquid spills over the glass at every level, and
 *   without the slide it is always full.
 *
 * ► **`resolveTimeline` AND `flattenFrame` DO NOT READ THESE AT ALL.**
 *   `parsePlaceObject` sets `hasClipActions: true` and stops, so a handler is
 *   invisible to every extraction in this repository. A raw walk of
 *   `combat_panel`'s own tag stream finds ZERO `DoAction` tags and would
 *   conclude the panel does nothing.
 *
 * What is recorded is the instance, the handler index, and the distinct STRING
 * constants it pushes — which names the game fields it reads without this tool
 * pretending to decompile it. A renderer wires those fields itself.
 */
export function deriveClipEvents(analysis) {
  const byCharacter = new Map();
  for (const block of analysis.actionBlocks) {
    const match = /^sprite:(\d+)\/frame:(\d+)\/instance:([^/]*)\/clip-action:(\d+)/.exec(block.context);
    if (!match) continue;
    const id = Number(match[1]);
    if (!byCharacter.has(id)) byCharacter.set(id, []);
    const touches = new Set();
    for (const { instruction } of walkInstructions(block.instructions, block.context)) {
      const operands = pushOperands(instruction);
      if (!operands) continue;
      for (const operand of operands) {
        if (typeof operand.value === "string" && operand.value.length > 0) touches.add(operand.value);
      }
    }
    byCharacter.get(id).push({
      frame: Number(match[2]),
      instance: match[3],
      handler: Number(match[4]),
      instructions: block.instructions.length,
      touches: [...touches].sort()
    });
  }
  return byCharacter;
}

/* ------------------------------------------------------------------ */
/* The expression script                                               */
/* ------------------------------------------------------------------ */

/** Walks a DoAction's instruction tree, including every DefineFunction body. */
function* walkInstructions(instructions, context) {
  for (const instruction of instructions) {
    yield { instruction, context };
    const body = instruction.operand?.body;
    if (Array.isArray(body)) {
      yield* walkInstructions(body, `${context}/${instruction.operand.name || "<anonymous>"}`);
    }
  }
}

/**
 * Every `<something>.eyes|mouth.gotoAndPlay|gotoAndStop("<label>")` in the build.
 *
 * ► **THE ARGUMENT IS FOUND BY THE ARGUMENT COUNT, not by position.** AS2
 *   pushes a method call as `arg…, argc, object…, methodName` and the compiler
 *   splits that across one or several `Push` records depending on how the
 *   object expression is written. So the scan walks back for the `1` that is
 *   the argument count and takes the operand before it — which reads all four
 *   spellings the build actually uses, from `head.eyes` in clip 1241 to
 *   `_root.arena_intro.gladiators.arena_champ.villain.head.eyes` in 721.
 *
 * A call whose argument cannot be recovered is returned with `label: null` and
 * COUNTED, never skipped: an expression the renderer cannot resolve is exactly
 * what this file exists to make visible.
 */
export function deriveExpressionCalls(analysis) {
  const calls = [];
  for (const block of analysis.actionBlocks) {
    const list = [...walkInstructions(block.instructions, block.context)];
    for (let index = 0; index < list.length; index += 1) {
      if (list[index].instruction.name !== "CallMethod") continue;
      const methodPush = pushOperands(list[index - 1]?.instruction);
      if (!methodPush) continue;
      const method = methodPush[methodPush.length - 1]?.value;
      if (method !== "gotoAndPlay" && method !== "gotoAndStop") continue;
      if (list[index - 2]?.instruction?.name !== "GetMember") continue;
      const memberPush = pushOperands(list[index - 3]?.instruction);
      if (!memberPush) continue;
      const member = memberPush[memberPush.length - 1]?.value;
      if (!FACE_MEMBERS.includes(member)) continue;

      let label = null;
      for (let back = index - 1; back >= Math.max(0, index - 12) && label === null; back -= 1) {
        const operands = pushOperands(list[back].instruction);
        if (!operands) continue;
        for (let slot = operands.length - 1; slot >= 1; slot -= 1) {
          const candidate = operands[slot];
          if (candidate.value === 1 && (candidate.type === "integer" || candidate.type === "double")) {
            const argument = operands[slot - 1];
            if (typeof argument?.value === "string") label = argument.value;
            break;
          }
        }
      }
      const context = list[index].context;
      const timeline = /^sprite:(\d+)/.exec(context);
      const frame = /\/frame:(\d+)/.exec(context);
      calls.push({
        part: member,
        method,
        label,
        timeline: timeline ? Number(timeline[1]) : null,
        frame: frame ? Number(frame[1]) : null,
        context
      });
    }
  }
  return calls;
}

/**
 * The join: which expression each of the fighter's named animations asks for.
 *
 * ► **A LABEL IS RESOLVED AGAINST THE TARGET CLIP'S OWN LABELS, and a mismatch
 *   is COUNTED rather than repaired.** Three outcomes, and the renderer has to
 *   be told which it got:
 *
 *   - `exact`              the spelling matches a `FrameLabel` byte for byte.
 *   - `case`               it matches only ignoring case. Whether AVM1 resolves
 *                          that depends on the player and the SWF version, and
 *                          launching the build to find out is not this tool's
 *                          to do. Lower-casing it here would be ASSERTING an
 *                          answer nobody measured.
 *   - `missing`            no label of any casing. `mouth1` has no `Smile` and
 *                          no `Pain`, and the build asks for both.
 */
export function bindExpressions(calls, animations, labelsByPart) {
  const byFrame = [...animations].sort((left, right) => left.firstFrame - right.firstFrame);
  const animationAt = (frame) => {
    let best = null;
    for (const animation of byFrame) {
      if (animation.firstFrame <= frame && (!best || animation.firstFrame > best.firstFrame)) best = animation;
    }
    return best;
  };

  const bindings = {};
  const resolution = { exact: 0, case: 0, missing: 0, unreadable: 0 };
  const unresolved = [];

  for (const call of calls) {
    const animation = call.frame === null ? null : animationAt(call.frame);
    const labels = labelsByPart[call.part] ?? [];
    let status = "unreadable";
    let resolved = null;
    if (typeof call.label === "string") {
      const exact = labels.find((label) => label.name === call.label);
      if (exact) { status = "exact"; resolved = exact.name; }
      else {
        const folded = labels.find((label) => label.name.toLowerCase() === call.label.toLowerCase());
        if (folded) { status = "case"; resolved = folded.name; }
        else status = "missing";
      }
    }
    resolution[status] += 1;
    if (status !== "exact") {
      unresolved.push({ part: call.part, asked: call.label, status, frame: call.frame, animation: animation?.name ?? null });
    }
    if (!animation) continue;
    const key = labelKey(animation.name);
    if (!bindings[key]) bindings[key] = { animation: animation.name, eyes: [], mouth: [] };
    const entry = {
      frame: call.frame, method: call.method, asked: call.label,
      resolved, status, expression: resolved === null ? null : labelKey(resolved)
    };
    bindings[key][call.part].push(entry);
  }
  return { bindings, resolution, unresolved };
}

/* ------------------------------------------------------------------ */
/* The extraction                                                      */
/* ------------------------------------------------------------------ */

/**
 * Everything, without writing a byte — so the report path and the write path
 * cannot disagree about what was measured.
 */
export function extractIcons(buffer) {
  const { characters, names } = indexCharacters(buffer);
  const byName = new Map([...names].map(([id, name]) => [name, id]));
  const cache = new Map();
  const sink = {
    shapeIds: new Set(), textIds: new Set(), clipIds: new Set(),
    clipNames: new Map(), failures: [], approximations: {}
  };

  // ONE pass over the whole action stream, shared by the two things that need
  // it. Disassembling 7.5 MB twice would be the same measurement made twice,
  // which is how two numbers that must agree stop agreeing.
  const { analysis } = analyseSwfBuffer(buffer);
  const timelineActions = deriveTimelineActions(analysis);
  const clipEvents = deriveClipEvents(analysis);
  // Counted ONCE per character: a clip asked about twice would tally its
  // unrecognised actions twice, and a count that moves when nothing was
  // measured twice is worse than no count.
  const tallied = new Set();
  const actionsFor = (id) => {
    const record = timelineActions.get(id) ?? { stops: [], removesSelfAt: null, other: [] };
    if (!tallied.has(id)) {
      tallied.add(id);
      // Never silently ignored: an action this recogniser cannot name would
      // otherwise be a behaviour the extraction claims does not exist.
      if (record.other.length > 0) {
        sink.approximations["timeline-action-unrecognised"] =
          (sink.approximations["timeline-action-unrecognised"] ?? 0) + record.other.length;
      }
    }
    return record;
  };
  const eventsFor = (id) => clipEvents.get(id) ?? [];

  const take = (id, linkage) => {
    const character = characters.get(id);
    if (!character) {
      sink.failures.push({ character: id, message: `no character ${id} in this build (${linkage})` });
      return null;
    }
    if (character.kind !== "sprite") {
      sink.failures.push({ character: id, message: `character ${id} is a ${character.kind}, not a sprite` });
      return null;
    }
    return extractClipFrames(buffer, characters, character, cache, sink);
  };

  /* --- the faces, cut at their own labels ------------------------- */
  const faces = {};
  const labelsByPart = {};
  for (const declared of FACE_CLIPS) {
    const id = byName.get(declared.linkage);
    if (id === undefined) {
      sink.failures.push({ character: null, message: `no export named ${declared.linkage} in this build` });
      continue;
    }
    const character = characters.get(id);
    const labels = readFrameLabels(buffer, character);
    labelsByPart[declared.key] = labels;
    if (labels.length === 0) {
      // ► A face clip with no labels is not a face this tool can index. Saying
      //   so beats indexing it by number and calling the numbers expressions.
      sink.failures.push({ character: id, message: `${declared.linkage} carries no FrameLabel tags` });
      continue;
    }
    const taken = take(id, declared.linkage);
    if (!taken) continue;

    const actions = actionsFor(id);
    const expressions = {};
    for (const animation of deriveAnimations(buffer, character)) {
      const poses = taken.frames.slice(animation.firstFrame - 1, animation.lastFrame);
      const signatures = poses.map((pose) => JSON.stringify(pose));
      expressions[labelKey(animation.name)] = {
        label: animation.name,
        firstFrame: animation.firstFrame,
        lastFrame: animation.lastFrame,
        frameCount: animation.frameCount,
        distinctPoses: new Set(signatures.filter((signature) => signature !== "[]")).size,
        // ► WHETHER THE RUN HALTS. A labelled run that ends in a `stop()` is a
        //   pose a renderer holds; one that does not runs on into the next
        //   expression and wraps at the end of the clip, which is a different
        //   picture entirely. Measured per run, never assumed for the clip.
        stopsAtEnd: actions.stops.includes(animation.lastFrame),
        poses
      };
    }
    faces[declared.key] = {
      linkage: declared.linkage,
      character: id,
      attachedTo: declared.attachedTo,
      instance: declared.instance,
      depth: declared.depth,
      // PIXELS, not twips — these are AS2 properties, not matrix fields.
      offset: declared.offset,
      attachedBy: declared.attachedBy,
      reader: declared.reader,
      declaredFrames: taken.declaredFrames,
      distinctFrames: taken.distinctFrames,
      duplicateOf: taken.duplicateOf,
      timeline: actions,
      clipEvents: eventsFor(id),
      expressionCount: Object.keys(expressions).length,
      // ► **STILLS, NOT ANIMATIONS, when this is true.** Every expression holds
      //   exactly one placement set across its whole run, so the "play" the
      //   build asks for advances through identical frames to a `stop()`.
      everyExpressionIsOnePose: Object.values(expressions).every((one) => one.distinctPoses === 1),
      expressions
    };
  }

  /* --- the strips and the panel ----------------------------------- */
  const clips = {};
  for (const declared of ICON_CLIPS) {
    const actual = names.get(declared.character);
    if (actual !== declared.linkage) {
      // A loud failure, not a silent substitution: the ids in this file's
      // docstring and in every offset it cites are only worth anything if the
      // build still calls them the same thing.
      sink.failures.push({
        character: declared.character,
        message: `expected export ${declared.linkage}, build calls character ${declared.character} ${actual ?? "nothing"}`
      });
      continue;
    }
    const taken = take(declared.character, declared.linkage);
    if (!taken) continue;
    clips[declared.linkage] = {
      linkage: declared.linkage,
      character: declared.character,
      indexedBy: declared.indexedBy,
      attachedBy: declared.attachedBy,
      reader: declared.reader,
      timeline: actionsFor(declared.character),
      clipEvents: eventsFor(declared.character),
      ...taken
    };
  }

  /* --- the nested multi-frame children, as their own assets -------- */
  // A worklist rather than a loop: a nested clip can itself hold one, and
  // `cast_spell_image` holds the 49-frame strip which holds `battlebutton`.
  const nested = {};
  const pending = [...sink.clipIds];
  const done = new Set(Object.values(clips).map((clip) => clip.character));
  // `seen` and not `nested[id]`: a clip whose extraction FAILS is never added
  // to `nested`, so testing the result would re-queue it for ever. A worklist
  // that loops on its own failures is the one bug this pattern reliably has.
  const seen = new Set();
  while (pending.length > 0) {
    const id = pending.shift();
    if (done.has(id) || seen.has(id)) continue;
    seen.add(id);
    const taken = take(id, names.get(id) ?? `character ${id}`);
    if (!taken) continue;
    nested[id] = {
      character: id,
      linkage: names.get(id) ?? null,
      // The build's own instance name for it, from the PlaceObject that holds
      // it — `damage_splat` is what `damagecharacter` reaches for, and no
      // export table carries that.
      instances: [...(sink.clipNames.get(id) ?? [])].sort(),
      meaning: NESTED_MEANINGS[id] ?? null,
      timeline: actionsFor(id),
      clipEvents: eventsFor(id),
      ...taken
    };
    for (const child of sink.clipIds) if (!done.has(child) && !seen.has(child)) pending.push(child);
  }

  /* --- the expression script -------------------------------------- */
  const driver = characters.get(EXPRESSION_DRIVER.character);
  let expressionScript = null;
  if (!driver || driver.kind !== "sprite") {
    sink.failures.push({
      character: EXPRESSION_DRIVER.character,
      message: `no sprite ${EXPRESSION_DRIVER.character} (${EXPRESSION_DRIVER.linkage}) to read expressions from`
    });
  } else {
    const everyCall = deriveExpressionCalls(analysis);
    const driverCalls = everyCall.filter((call) => call.timeline === EXPRESSION_DRIVER.character);
    const bound = bindExpressions(driverCalls, deriveAnimations(buffer, driver), labelsByPart);
    const elsewhere = {};
    for (const call of everyCall) {
      if (call.timeline === EXPRESSION_DRIVER.character) continue;
      const key = String(call.timeline ?? call.context);
      if (!elsewhere[key]) elsewhere[key] = [];
      elsewhere[key].push({ frame: call.frame, part: call.part, method: call.method, asked: call.label });
    }
    expressionScript = {
      driver: EXPRESSION_DRIVER,
      callCount: driverCalls.length,
      eyesCalls: driverCalls.filter((call) => call.part === "eyes").length,
      mouthCalls: driverCalls.filter((call) => call.part === "mouth").length,
      resolution: bound.resolution,
      unresolved: bound.unresolved,
      bindings: bound.bindings,
      // The other timelines drive the SAME two clips on other screens. They are
      // carried so nobody has to rediscover that the face is not the arena's
      // alone; they are not bound to labels because those clips are not the rig.
      elsewhere
    };
    sink.approximations["label-case-mismatch"] = bound.resolution.case;
    sink.approximations["label-not-found"] = bound.resolution.missing;
    if (bound.resolution.unreadable > 0) {
      sink.approximations["label-unreadable"] = bound.resolution.unreadable;
    }
  }

  /* --- the geometry every placement points at ---------------------- */
  const shapes = {};
  for (const id of [...sink.shapeIds].sort((left, right) => left - right)) {
    const character = characters.get(id);
    try {
      const shape = parseShape(buffer, character.bodyStart, character.bodyEnd, character.tagCode);
      const paths = shapeToPaths(shape);
      for (const drawn of paths) {
        if (drawn.approximated) {
          sink.approximations[drawn.approximated] = (sink.approximations[drawn.approximated] ?? 0) + 1;
        }
      }
      if (paths.length === 0) {
        // Never a silently-empty path: a shape that stitches to nothing is a
        // failure, not an asset with no edges.
        sink.failures.push({ character: id, message: "shape parsed but produced no paths" });
      }
      shapes[id] = {
        bounds: {
          xMin: px(shape.bounds.xMin), xMax: px(shape.bounds.xMax),
          yMin: px(shape.bounds.yMin), yMax: px(shape.bounds.yMax)
        },
        paths
      };
    } catch (error) {
      sink.failures.push({ character: id, message: `shape: ${String(error.message).slice(0, 140)}` });
    }
  }

  const texts = {};
  for (const id of [...sink.textIds].sort((left, right) => left - right)) {
    const character = characters.get(id);
    try {
      texts[id] = character.tagCode === TAG.DEFINE_EDIT_TEXT
        ? parseEditText(buffer, character.bodyStart, character.bodyEnd)
        : parseStaticText(buffer, character.bodyStart);
    } catch (error) {
      sink.failures.push({ character: id, message: `text: ${String(error.message).slice(0, 140)}` });
    }
  }
  // The `text` tally from the flatten counts PLACEMENTS; these count the
  // characters behind them, split by what was actually recoverable.
  sink.approximations["edit-text-characters"] =
    Object.values(texts).filter((field) => field.kind === "edit-text").length;
  sink.approximations["static-text-characters"] =
    Object.values(texts).filter((field) => field.kind === "static-text").length;

  const clipsAcrossSpriteBoundary =
    Object.values(clips).reduce((total, clip) => total + clip.clipsAcrossSpriteBoundary, 0) +
    Object.values(nested).reduce((total, clip) => total + clip.clipsAcrossSpriteBoundary, 0);

  return {
    faces, clips, nested, expressionScript, shapes, texts,
    failures: sink.failures,
    approximations: sink.approximations,
    clipsAcrossSpriteBoundary
  };
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

export function buildManifest(result, { file, sha256 }) {
  const clipRow = (clip) => ({
    character: clip.character,
    declaredFrames: clip.declaredFrames,
    distinctFrames: clip.distinctFrames,
    emptyFrames: clip.emptyFrames,
    repeatedFrames: Object.keys(clip.duplicateOf).length,
    ...(clip.indexedBy ? { indexedBy: clip.indexedBy } : {}),
    ...(clip.attachedBy === undefined ? {} : { attachedBy: clip.attachedBy }),
    ...(clip.reader === undefined ? {} : { reader: clip.reader }),
    stops: clip.timeline?.stops ?? [],
    removesSelfAt: clip.timeline?.removesSelfAt ?? null,
    unrecognisedActions: clip.timeline?.other ?? [],
    // Named, not counted: a gauge driven by an onClipEvent is behaviour no
    // drawable list can carry, and a renderer that does not know it is there
    // paints a full health bar over a dying gladiator.
    clipEvents: (clip.clipEvents ?? []).map((event) =>
      `${event.instance}[${event.handler}] ${event.instructions} instructions, touches ${event.touches.join(" ")}`)
  });
  return {
    source: path.basename(file),
    sha256,
    oracle: sha256 === ORACLE_SHA256,
    extractedFrom:
      "face clips cut at their own FrameLabels; icon clips by frame number, 1-based as gotoAndStop indexes them",
    faces: Object.fromEntries(Object.entries(result.faces).map(([key, face]) => [key, {
      linkage: face.linkage, character: face.character,
      attachedTo: face.attachedTo, instance: face.instance, depth: face.depth,
      offsetPixels: face.offset,
      declaredFrames: face.declaredFrames, distinctFrames: face.distinctFrames,
      everyExpressionIsOnePose: face.everyExpressionIsOnePose,
      stops: face.timeline.stops,
      unrecognisedActions: face.timeline.other,
      clipEvents: face.clipEvents.length,
      expressions: Object.values(face.expressions).map((expression) =>
        `${expression.label}[${expression.firstFrame}-${expression.lastFrame}] ${expression.distinctPoses} distinct`)
    }])),
    icons: Object.fromEntries(Object.entries(result.clips).map(([key, clip]) => [key, clipRow(clip)])),
    nested: Object.fromEntries(Object.entries(result.nested).map(([key, clip]) => [key, {
      ...clipRow(clip), linkage: clip.linkage, instances: clip.instances, meaning: clip.meaning
    }])),
    expressionScript: result.expressionScript === null ? null : {
      driver: result.expressionScript.driver,
      callCount: result.expressionScript.callCount,
      eyesCalls: result.expressionScript.eyesCalls,
      mouthCalls: result.expressionScript.mouthCalls,
      boundAnimations: Object.keys(result.expressionScript.bindings).length,
      resolution: result.expressionScript.resolution,
      // Named, not just counted: "six calls ask for a label that is not there"
      // is a number, and "mouth1 has no Smile" is the finding.
      unresolved: result.expressionScript.unresolved
    },
    shapeCount: Object.keys(result.shapes).length,
    textCount: Object.keys(result.texts).length,
    /**
     * EVERY APPROXIMATION, BY KIND. An approximation that is not counted is
     * indistinguishable from a correct read — the arena's walls were invisible
     * for months because a dropped field made one look like the other.
     */
    approximations: result.approximations,
    /**
     * The clips this tool assigned across a nested-sprite boundary, which is the
     * number `tools/swf-display-list.mjs`'s `flattenFrame` loses with no
     * `unsupported` and no failure. Six of them are `combat_panel`'s gauges.
     */
    clipsAcrossSpriteBoundary: result.clipsAcrossSpriteBoundary,
    failures: result.failures
  };
}

function main(argv) {
  const options = parseArguments(argv);
  if (!fs.existsSync(options.file)) {
    throw new ExtractIconsError(
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

  const result = extractIcons(buffer);
  const manifest = buildManifest(result, { file: options.file, sha256 });

  const lines = [];
  for (const face of Object.values(result.faces)) {
    lines.push(
      `  ${face.linkage.padEnd(18)} char ${String(face.character).padStart(4)}  ` +
      `${String(face.declaredFrames).padStart(3)} frames, ${face.expressionCount} expressions, ` +
      `${face.distinctFrames} distinct`
    );
  }
  for (const clip of Object.values(result.clips)) {
    lines.push(
      `  ${clip.linkage.padEnd(18)} char ${String(clip.character).padStart(4)}  ` +
      `${String(clip.declaredFrames).padStart(3)} frames, ${clip.distinctFrames} distinct` +
      `${clip.attachedBy === null ? "   DEAD: nothing attaches it" : ""}`
    );
  }
  for (const [id, clip] of Object.entries(result.nested)) {
    const named = clip.instances[0] ?? clip.linkage ?? `char ${id}`;
    const meanings = clip.meaning?.frames
      ? Object.entries(clip.meaning.frames).map(([frame, what]) => `${frame}=${what}`).join(" ")
      : "meanings NOT FOUND in the build";
    lines.push(
      `    └ ${String(named).padEnd(16)} char ${String(id).padStart(4)}  ` +
      `${String(clip.declaredFrames).padStart(3)} frames, ${clip.distinctFrames} distinct  (${meanings})`
    );
  }
  if (result.expressionScript) {
    const script = result.expressionScript;
    lines.push(
      `  expression script  ${script.callCount} calls on clip ${script.driver.character} ` +
      `(${script.eyesCalls} eyes, ${script.mouthCalls} mouth) over ` +
      `${Object.keys(script.bindings).length} animations`
    );
    lines.push(
      `    resolution: ${script.resolution.exact} exact, ${script.resolution.case} case-only, ` +
      `${script.resolution.missing} NO SUCH LABEL, ${script.resolution.unreadable} unreadable`
    );
  }
  lines.push(
    `  ${Object.keys(result.shapes).length} shapes, ${Object.keys(result.texts).length} text fields, ` +
    `${result.failures.length} failures`
  );
  const approximated = Object.entries(result.approximations).filter(([, count]) => count > 0);
  lines.push(`  approximations: ${approximated.length === 0 ? "none" : approximated.map(([kind, count]) => `${kind}=${count}`).join(" ")}`);
  lines.push(`  clips recovered across a nested-sprite boundary: ${result.clipsAcrossSpriteBoundary}`);

  if (options.report) {
    process.stdout.write(`icons (measured, nothing written)\n${lines.join("\n")}\n`);
    for (const failure of result.failures.slice(0, 25)) {
      process.stdout.write(`    ! char ${failure.character}${failure.frame ? ` frame ${failure.frame}` : ""}: ${failure.message}\n`);
    }
    return;
  }

  assertWritableOutput(options.out, options.file);
  fs.mkdirSync(options.out, { recursive: true });
  const iconsPath = path.join(options.out, "icons.json");
  const manifestPath = path.join(options.out, "manifest.json");
  assertReplaceableFile(iconsPath, options.file);
  assertReplaceableFile(manifestPath, options.file);

  const payload = JSON.stringify({
    faces: result.faces,
    icons: result.clips,
    nested: result.nested,
    expressionScript: result.expressionScript,
    shapes: result.shapes,
    texts: result.texts
  }, null, 1);
  // Never a zero-byte file: an empty asset a renderer draws as nothing is the
  // exact failure mode this tool's manifest exists to make impossible.
  if (payload.length < 2) throw new ExtractIconsError("refusing to write an empty icons.json");
  fs.writeFileSync(iconsPath, payload);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));

  process.stdout.write(`icons -> ${options.out}\n${lines.join("\n")}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
