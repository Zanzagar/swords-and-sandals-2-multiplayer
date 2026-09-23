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
 *   table per level ~~and never threads an outer mask into a nested sprite, and
 *   a masked SPRITE is skipped before `unsupported` is ever set — so the liquid
 *   comes back whole, unclipped, with `maskPath: null` and no failure logged.~~
 *   **Corrected 2026-09-22: since commit 3ba74bc it DOES thread the nearest
 *   enclosing mask down, and stamps it on the leaf as `ancestorMaskPath`.**
 *   What has not changed is the rest of that sentence: the liquid still comes
 *   back `unsupported: null` with `maskPath: null` and no failure logged, so a
 *   caller reading those two draws it whole, and only a caller that reads the
 *   new stamp can cut it. The health bar would paint outside its vial and the
 *   extractor would call it a clean read. The same shape holds for the two
 *   stamina potions (742/736) and the two armour gauges (749/743).
 *
 *   **This tool therefore flattens with its own walk**, threading a mask down
 *   through nested sprites, and COUNTS the clips it assigns across a sprite
 *   boundary as `clipsAcrossSpriteBoundary` — the exact number `flattenFrame`
 *   ~~loses~~ reports only as that stamp (verified on 733 frame 1 after the
 *   correction: leaf `3/1`, shape 728, `ancestorMaskPath [2]`, `maskPath`
 *   null, `unsupported` null). `tools/swf-display-list.mjs` is not this file's
 *   to change; the count is the report.
 *
 * ► **THE ICONS ARE WHERE THIS BUILD KEEPS ITS GLOWS, AND THIS PACK DROPPED
 *   ALL 176 OF THEM.** Every number on the fight is a text field with its own
 *   glow, and until today not one reached the pack: `flattenIconFrame` never
 *   read `filters`, `blendMode` or `hasFilters` off an entry, so the arena drew
 *   flat numerals on a flat panel. `combat_panel`'s fifteen glows sit on nine
 *   distinct fields, and their `variable` names say what a renderer loses
 *   without them: `hitpoints` (twice, once per fighter), `armourpoints`,
 *   `herotext`, `villaintext`, `crowd_text`, and three static labels.
 *   Measured on the oracle, by clip:
 *
 *   ```text
 *     clip                    own  group    what
 *     cast_spell_image  120    40      0    glow on text 119, one per frame
 *     bonus_icon        153    35      0    glow on text 152
 *     miss_icon         823    34      0    glow on text 822
 *     damage_icon       817    24      0    glow on text 816
 *     defend_icon       821    24      0    glow on text 820
 *     combat_panel      751    15      2    glow on 15 text placements, 9 fields; 2 BEVELS
 *     inventory_buttons 116     2      0    a grey-out on the battlebutton (frames 10-11)
 *     addstats_icon 162, eyes1 898, mouth1 909, and every nested child: 0
 *                            ---    ---
 *                            174      2     = 176
 *   ```
 *
 * ► **AND NOT ONE OF THE 176 IS ON A SHAPE.** 172 of the 174 own filters are on
 *   `text-placement` drawables — the kind this tool emits, points at a field in
 *   `texts`, and does not turn into geometry — and the other 2 are on a `clip`
 *   placement it deliberately refuses to descend into. The 2 group filters
 *   enclose shapes but are not on them. **So a fix that carried filters on the
 *   ordinary shape path alone would have moved 0 of 176 and reported success**,
 *   which is why `own.filtersOnUnsupportedPlacements` is a field and not a
 *   remark. (An earlier draft of this block said 159 and called
 *   `combat_panel`'s 15 "the ordinary path". Both were wrong: those 15 are text
 *   too, and the real number is 172 — measured with `--report`, which prints
 *   it.)
 *
 * ► **THE STRIP'S TWO ARE A GREY-OUT, AND 38 MORE FRAMES CANCEL IT.**
 *   `inventory_buttons` places `battlebutton` under a colour matrix on frames
 *   **10 and 11** — and it is Flash's GREYSCALE matrix, the
 *   `0.3086/0.6094/0.0820` triple `src/render/filters.js` says matches no CSS
 *   shorthand at all, so `canvasFilterFor` defers both to `applyColourMatrix`
 *   rather than approximating them. On 38 OTHER frames the same depth carries
 *   a filter list of COUNT ZERO: a `PlaceObject3` saying "this instance's
 *   filters are cleared", which is not the same claim as "nobody asked".
 *   Writing that as `filters: []` and writing it as `filters: null` are both
 *   lies in one direction or the other, so it is refused by name and counted:
 *   `notCarried.emptyFilterList: 38`.
 *
 * ► **THE ONLY TWO BEVELS ANY PACK IN THIS REPOSITORY CAN REACH** are
 *   `combat_panel`'s, on the two placements of sprite 52 at depths 1 and 7.
 *   Both are INNER, both have `blurX`/`blurY` of ZERO and strength 1, and
 *   `canvasFilterFor` refuses both as `filterHasNoCanvasEquivalent`. They get
 *   their own named line in the invoice (`effects.bevels`) rather than a row in
 *   a `filtersByType` bag nobody sums, because the build-wide "54 bevels" in
 *   `src/render/filters.js`'s docstring has no reachable denominator and these
 *   two are the whole of what a renderer here will ever be handed.
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
// THE READER, IMPORTED SO THE INVOICE IS THE READER'S OWN VERDICT — the same
// arrangement `tools/extract-props.mjs` uses and for the same reason. What this
// pack can say about a filter is exactly what `canvasFilterFor` does with it:
// applied, deferred to `applyColourMatrix`, measured no-op, or refused by name.
// A table of verdicts kept here would be a second thing to drift, and "the pack
// carries it" and "the renderer can draw it" could then disagree while both
// stayed green. It costs this tool nothing: `src/render/` has no DOM.
import { blendModeFor, canvasFilterFor, summariseFilterUse } from "../src/render/filters.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The same default every other tool that reads the build uses. */
const DEFAULT_SWF =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";

/** The oracle's sha256. Recorded and REPORTED — never enforced. */
export const ORACLE_SHA256 = "77cb545c2061ab41246251467a4edf5926ab6fd1ddd95dc9527d7ba9c45bb8ca";

const TWIPS_PER_PIXEL = 20;

/** Guards `visit` against a sprite that reaches itself; the same cap the display list uses. */
const MAX_NESTING = 8;

/** The shared empty ancestor chain — frozen, so no visit can append to it. */
const EMPTY_EFFECT_CHAIN = Object.freeze([]);

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
/* EFFECTS — the invoice vocabulary, the same one extract-props uses    */
/* ------------------------------------------------------------------ */

/**
 * ONE NAMED REASON SOMETHING WAS NOT CARRIED, counted.
 *
 * `notCarried` is a tally of named reasons and never a boolean, because
 * "something was lost" and "seven things were lost" are different facts and
 * only the second one can be checked against the build later.
 *
 * Every effect this file drops goes through here. If you add a drop that does
 * not, that sentence becomes a lie — which is exactly what happened to
 * `tools/extract-props.mjs`, whose own version of this note was false for as
 * long as two skips went round it.
 */
function refuse(notCarried, kind, howMany = 1) {
  notCarried[kind] = (notCarried[kind] ?? 0) + howMany;
}

/**
 * ONE PLACEMENT'S OWN EFFECTS — its own, and on no account its ancestors'.
 *
 * ► **UNLIKE THE PROPS PACK, THIS ZERO IS NOT ZERO: 174 of this roster's 176
 *   filters are a placement's own.** The props extractor found every effect it
 *   could reach on an ENCLOSING sprite and said so; here it is the other way
 *   round, and the reason is what the icons ARE. A damage splat is a number,
 *   the number is a `DefineEditText`, and the glow that makes it legible over
 *   a gladiator is on the text's own placement.
 *
 * ► **SO THE INTERESTING NUMBER IS NOT `filters` BUT WHERE THEY LAND.** 172 of
 *   the 174 are on drawables this tool emits with `unsupported:
 *   "text-placement"` — carried, pointing at a field in `texts`, but not
 *   geometry — and the other 2 are on a `clip` placement whose child is
 *   extracted separately. **NOT ONE is on a shape.** A reader who checks
 *   `own.filters` and not `own.filtersOnUnsupportedPlacements` will think the
 *   shapes are glowing, and every one of them is a numeral instead.
 *
 * `hasFilters` with an EMPTY list is refused by name rather than written as
 * `filters: []`: a `PlaceObject3` can carry a filter list of count zero, which
 * means "this instance has had its filters CLEARED", not "nobody asked".
 * Measured here: 38 of them, all on `inventory_buttons`' battlebutton.
 */
export function ownEffectsOf(drawable, notCarried) {
  const effects = {};
  const filters = Array.isArray(drawable.filters) && drawable.filters.length > 0 ? drawable.filters : null;
  if (filters) {
    effects.filters = filters;
    // `parseFilterList` marks the three filter kinds that occur ZERO times in
    // the shipped build. A record carrying this flag reached a code path no
    // capture has ever exercised, so it is carried AND counted.
    for (const filter of filters) if (filter.measured === false) refuse(notCarried, "unmeasuredFilterRecord");
  } else if (drawable.hasFilters) {
    refuse(notCarried, "emptyFilterList");
  }
  if (drawable.blendMode !== undefined && drawable.blendMode !== null) effects.blendMode = drawable.blendMode;
  return effects;
}

/**
 * THE OWN EFFECTS ON A DRAWABLE THIS TOOL IS ABOUT TO THROW AWAY, INVOICED
 * WHERE THE THROWING AWAY HAPPENS.
 *
 * `extractClipFrames` drops exactly two kinds: a `mask` it cannot turn into a
 * clip path, and a `missing` character. Both are already reported into
 * `failures` by KIND; this adds what went out with them.
 *
 * ► **MEASURED ON THE ORACLE: ZERO, on both kinds, across the whole roster.**
 *   That is a COUNTED zero and not an absent one, which is the entire
 *   difference between this function existing and not. The props extractor
 *   published `0 own filters` for weeks because its equivalent skip invoiced
 *   nothing and the build's only two own-filtered placements were exactly the
 *   two it skipped. Here the same sweep can come back non-zero the moment a
 *   mod puts a glow on a stencil, and the number will say so.
 *
 * Returns a reason suffix for the `failures` message, so the human-readable
 * list names the loss too.
 */
export function refusedEffectsOf(drawable, refusedOwn, notCarried) {
  const filters = Array.isArray(drawable.filters) && drawable.filters.length > 0 ? drawable.filters : null;
  const blend = drawable.blendMode !== undefined && drawable.blendMode !== null ? drawable.blendMode : null;
  if (filters) {
    refusedOwn.filterLists.push(filters);
    refuse(notCarried, "droppedDrawableFilters", filters.length);
  } else if (drawable.hasFilters) {
    refuse(notCarried, "droppedDrawableEmptyFilterList");
  }
  if (blend !== null) {
    refusedOwn.blendModes.push(blend);
    refuse(notCarried, "droppedDrawableBlendMode");
  }
  const parts = [];
  if (filters) parts.push(`${filters.length} own ${filters.map((filter) => filter.type).join("+")}`);
  else if (drawable.hasFilters) parts.push("an own filter list of COUNT ZERO");
  if (blend !== null) parts.push(`own blend mode ${blend}`);
  return parts.length ? `, dropping ${parts.join(" and ")}` : "";
}

/**
 * THE ENCLOSING SPRITES THAT CARRY AN EFFECT OVER THIS LEAF, as indices into
 * one deduplicated table per clip.
 *
 * ► **THE KEY IS THE WHOLE RECORD, `JSON.stringify` and all.** A tidier key —
 *   path, or path plus character — collapses two groups that differ only in
 *   their filters' NUMBERS, and the numbers are the effect. `combat_panel`'s
 *   two bevel groups survive a path key because their paths differ (1 and 7),
 *   which is luck, not design: the sky in `tools/extract-props.mjs` disagreed
 *   with the build by fifty times under exactly that key.
 *
 * ► **A GROUP HAS NO MATRIX HERE.** The chain records `{path, characterId,
 *   blendMode, hasFilters, filters}` and nothing else, so a renderer scaling a
 *   blur radius by the group's own transform cannot, and must fall back to the
 *   stage scale `canvasFilterFor` already takes. Composing it would mean a
 *   second copy of this walk's recursion inside itself. Counted instead, once
 *   per group: `notCarried.effectGroupMatrix`.
 */
function inheritedEffectsFor(drawable, groups, groupIndex, notCarried) {
  const chain = drawable.ancestorEffects;
  if (!Array.isArray(chain) || chain.length === 0) return null;
  const indices = [];
  for (const group of chain) {
    const filters = Array.isArray(group.filters) && group.filters.length > 0 ? group.filters : null;
    const record = {
      // The chain of depths that reaches the group, so a reader can find it in
      // the same frame's placements without re-deriving which level it was on.
      path: [...(group.path ?? [])],
      character: group.characterId,
      ...(group.blendMode !== undefined && group.blendMode !== null ? { blendMode: group.blendMode } : {}),
      ...(filters ? { filters } : {})
    };
    const key = JSON.stringify(record);
    let at = groupIndex.get(key);
    if (at === undefined) {
      at = groups.length;
      groups.push(record);
      groupIndex.set(key, at);
      if (!filters && group.hasFilters) refuse(notCarried, "emptyFilterList");
      for (const filter of filters ?? []) if (filter.measured === false) refuse(notCarried, "unmeasuredFilterRecord");
      refuse(notCarried, "effectGroupMatrix");
    }
    indices.push(at);
  }
  return indices;
}

/**
 * THE BEVELS, ON THEIR OWN LINE.
 *
 * ► **BECAUSE THESE TWO ARE THE WHOLE REACHABLE POPULATION.** `HANDOFF.md`'s
 *   ranked item 4 records that the build-wide "54 bevels" in
 *   `src/render/filters.js` is a docstring figure with no reachable
 *   denominator — no pack in this repository reaches any of them except
 *   `combat_panel`'s two. A `filtersByType` bag would list `bevel: 2` next to
 *   `glow: 15` and nobody would ever sum it; a named line cannot be missed.
 *
 * ► **AND THE FLAGS ARE THE POINT, not the count.** Both are INNER with
 *   `blurX`/`blurY` of ZERO, so even a renderer that grew a bevel mapper would
 *   draw nothing blurred: this is a hard one-pixel edge, and CSS has no inset
 *   filter to put it in. `canvasFilterFor` refuses them by name and this line
 *   says WHICH KIND of bevel was refused, which is what a future mapper needs.
 */
function bevelCensus(lists) {
  const census = { total: 0, inner: 0, onTop: 0, knockout: 0, zeroBlur: 0 };
  for (const list of lists) {
    for (const filter of list) {
      if (filter.type !== "bevel") continue;
      census.total += 1;
      if (filter.inner) census.inner += 1;
      if (filter.onTop) census.onTop += 1;
      if (filter.knockout) census.knockout += 1;
      if (!(filter.blurX > 0) && !(filter.blurY > 0)) census.zeroBlur += 1;
    }
  }
  return census;
}

/** Filters counted by their `type`, over a list of filter LISTS. */
function filtersByType(lists) {
  const counts = {};
  for (const list of lists) for (const filter of list) counts[filter.type] = (counts[filter.type] ?? 0) + 1;
  return counts;
}

/**
 * ONE CLIP'S EFFECT INVOICE: what its placements carry, what encloses them,
 * WHAT A RENDERER WOULD ACTUALLY DO WITH EACH — applied, deferred to the
 * colour-matrix path, measured no-op, or refused by name — and what could not
 * be carried at all.
 *
 * ► **OWN AND INHERITED ARE COUNTED ON DIFFERENT UNITS, ON PURPOSE.** A
 *   group's filters are counted ONCE however many leaves sit under it, because
 *   the build applies them once to the group; a placement's own are counted per
 *   placement, because each placement really does get its own. Adding the two
 *   on one unit would either inflate `combat_panel`'s two bevels by the leaves
 *   beneath them or deflate 40 glowing frames to one.
 *
 * ► **`scale` IS DELIBERATELY LEFT AT 1** in the `use` verdicts. The invoice is
 *   about which filters can be expressed at all; the stage-to-canvas scale is
 *   the renderer's and changes the NUMBERS in the string, never the buckets.
 */
function effectInvoiceFor({
  groups, ownFilterLists, ownBlendModes, underGroup, unsupportedOwnFilterLists,
  undescended, notCarried, refusedOwn
}) {
  const groupFilterLists = groups.map((group) => group.filters ?? []);
  const groupBlendModes = groups.map((group) => group.blendMode).filter((id) => id !== undefined && id !== null);

  const blend = { exact: {}, refused: {} };
  for (const id of [...groupBlendModes, ...ownBlendModes]) {
    const verdict = blendModeFor(id);
    const key = verdict.composite && verdict.exact ? "exact" : "refused";
    const label = key === "exact" ? verdict.name : `${verdict.name ?? id}:${verdict.refused}`;
    blend[key][label] = (blend[key][label] ?? 0) + 1;
  }

  return {
    own: {
      filteredPlacements: ownFilterLists.length,
      filters: ownFilterLists.reduce((sum, list) => sum + list.length, 0),
      filtersByType: filtersByType(ownFilterLists),
      blendModePlacements: ownBlendModes.length,
      // ► **THE NUMBER ABOVE IS ONLY HONEST NEXT TO THIS ONE.** These are own
      //   filters on placements this tool EMITS but cannot turn into geometry —
      //   `text-placement` in every case measured, 172 of the roster's 174. The
      //   placement is carried and points at a field in `texts`, so nothing is
      //   lost; but a reader who takes `filters` for "glowing shapes" has been
      //   told the opposite of the truth.
      filtersOnUnsupportedPlacements: unsupportedOwnFilterLists.reduce((sum, list) => sum + list.length, 0),
      unsupportedFilteredPlacements: unsupportedOwnFilterLists.length,
      // Own effects on drawables this tool DROPPED — a refused mask, a missing
      // character. Always present, zero on this build, and a counted zero is
      // the only kind that can become non-zero visibly.
      dropped: {
        placements: refusedOwn.filterLists.length,
        filters: refusedOwn.filterLists.reduce((sum, list) => sum + list.length, 0),
        filtersByType: filtersByType(refusedOwn.filterLists),
        blendModePlacements: refusedOwn.blendModes.length
      }
    },
    // What ENCLOSES them. `groups` counts the sprites, `placements` the leaves
    // inside them; reporting only the second would call two bevels two hundred.
    inherited: {
      groups: groups.length,
      placements: underGroup,
      filters: groupFilterLists.reduce((sum, list) => sum + list.length, 0),
      filtersByType: filtersByType(groupFilterLists),
      blendModes: groupBlendModes.length
    },
    // ► **THE BOUNDARY THIS TOOL REFUSES TO CROSS, AS A NUMBER RATHER THAN A
    //   SENTENCE.** A multi-frame child is emitted as a `clip` placement and
    //   never descended into, so no filter INSIDE one is counted in this
    //   invoice. `filtersInChildEntries` is filled in afterwards by
    //   `crossReferenceChildEffects`, from the child's OWN entry in this same
    //   pack — one level, because the child's entry names its own children in
    //   turn. `childrenNotExtracted` is the failure mode that must never be
    //   silent: a child nothing extracted is a whole subtree of effects nobody
    //   counted anywhere.
    undescended,
    bevels: {
      ...bevelCensus([...groupFilterLists, ...ownFilterLists]),
      own: bevelCensus(ownFilterLists).total,
      inherited: bevelCensus(groupFilterLists).total
    },
    use: {
      filters: summariseFilterUse([...groupFilterLists, ...ownFilterLists].map((list) => canvasFilterFor(list))),
      blendModes: blend
    },
    notCarried
  };
}

/**
 * THE WHOLE PACK'S EFFECTS, added up from the entries' OWN invoices.
 *
 * ► **RECOMPUTED FROM WHAT WAS WRITTEN, never counted alongside it.** The
 *   figure extractor's manifest once summed a per-entry field that 83% of its
 *   pack did not have and reported zero against data holding two. Every number
 *   below comes from `faces`/`icons`/`nested`, which is the pack a reader can
 *   open.
 *
 * ► **`undescendedChildFilters` IS NOT ADDED TO ANYTHING.** It counts filters
 *   that are already in the total under the CHILD's own entry, so folding it in
 *   would count them twice. It is here to answer one question — "how much sits
 *   behind a boundary this tool refuses to cross?" — and that is 2, both on
 *   `cast_spell_image`'s nested copy of the inventory strip.
 */
export function tallyIconEffects(result) {
  const add = (into, from) => {
    for (const [key, count] of Object.entries(from ?? {})) into[key] = (into[key] ?? 0) + count;
    return into;
  };
  const totals = {
    groups: 0, placementsUnderAGroup: 0, inheritedFilters: 0, inheritedBlendModes: 0,
    ownFilteredPlacements: 0, ownFilters: 0, ownBlendModePlacements: 0,
    ownFiltersOnUnsupportedPlacements: 0,
    // Never folded into the three above. The pack does not hold these; it knows
    // they exist and says so, which is a different claim.
    droppedOwnFilteredPlacements: 0, droppedOwnFilters: 0, droppedOwnBlendModePlacements: 0,
    undescendedClipPlacements: 0, undescendedChildFilters: 0, undescendedChildrenNotExtracted: 0
  };
  const inheritedByType = {};
  const ownByType = {};
  const droppedOwnByType = {};
  const notCarried = {};
  const bevels = { total: 0, inner: 0, onTop: 0, knockout: 0, zeroBlur: 0, own: 0, inherited: 0 };
  const use = { total: 0, applied: 0, deferred: 0, noOp: 0, refused: 0, approximated: 0 };
  const refusedByReason = {};
  const approximatedByKind = {};
  const blend = { exact: {}, refused: {} };
  // DISTINCT children, not placements: 190 clip placements in this roster reach
  // five children between them, and a reader told "190 children" would go
  // looking for 185 entries that do not exist.
  const undescendedChildren = new Set();

  for (const entry of iconEntries(result)) {
    const effects = entry.effects;
    if (!effects) continue;
    for (const child of effects.undescended.children) undescendedChildren.add(child);
    totals.groups += effects.inherited.groups;
    totals.placementsUnderAGroup += effects.inherited.placements;
    totals.inheritedFilters += effects.inherited.filters;
    totals.inheritedBlendModes += effects.inherited.blendModes;
    totals.ownFilteredPlacements += effects.own.filteredPlacements;
    totals.ownFilters += effects.own.filters;
    totals.ownBlendModePlacements += effects.own.blendModePlacements;
    totals.ownFiltersOnUnsupportedPlacements += effects.own.filtersOnUnsupportedPlacements;
    totals.droppedOwnFilteredPlacements += effects.own.dropped.placements;
    totals.droppedOwnFilters += effects.own.dropped.filters;
    totals.droppedOwnBlendModePlacements += effects.own.dropped.blendModePlacements;
    totals.undescendedClipPlacements += effects.undescended.clipPlacements;
    totals.undescendedChildFilters += effects.undescended.filtersInChildEntries;
    totals.undescendedChildrenNotExtracted += effects.undescended.childrenNotExtracted.length;
    add(inheritedByType, effects.inherited.filtersByType);
    add(ownByType, effects.own.filtersByType);
    add(droppedOwnByType, effects.own.dropped.filtersByType);
    add(notCarried, effects.notCarried);
    add(bevels, effects.bevels);
    for (const key of Object.keys(use)) use[key] += effects.use.filters[key] ?? 0;
    add(refusedByReason, effects.use.filters.refusedByReason);
    add(approximatedByKind, effects.use.filters.approximatedByKind);
    add(blend.exact, effects.use.blendModes.exact);
    add(blend.refused, effects.use.blendModes.refused);
  }

  return {
    ...totals, inheritedByType, ownByType, droppedOwnByType,
    undescendedChildren: [...undescendedChildren].sort((left, right) => left - right),
    bevels,
    use: { ...use, refusedByReason, approximatedByKind },
    blendModes: blend,
    notCarried,
    // ► **WHAT THIS PACK CANNOT SEE AT ALL, said in words because it is a SCOPE
    //   and not a measurement.** Every clip here is flattened in isolation, and
    //   all eight of the declared ones are ATTACHED by ActionScript at a depth
    //   (`attachMovie`), not placed on a root frame — so there is no outer
    //   placement to carry an effect, and nothing is being lost. `eyes1` and
    //   `mouth1` ARE placed, inside `head` inside the fighter rig, and an
    //   effect on that placement belongs to `tools/extract-figure.mjs`.
    scope: "each clip is flattened in isolation; an effect on an outer placement of it belongs to the pack that holds that placement",
    // ► **AND THE OTHER SCOPE, WHICH IS THIS TOOL'S WHOLE POINT.** A nested
    //   sprite with more than one frame is NOT descended into — it is its own
    //   entry — so its effects are counted THERE and not in its parent's
    //   invoice. `undescendedClipPlacements` is how many such boundaries exist
    //   and `undescendedChildFilters` is what sits immediately behind them.
    nestedScope: "a multi-frame child is its own entry; its effects are invoiced there, never in its parent"
  };
}

/** Every extracted entry that carries an invoice, in one sequence. */
function iconEntries(result) {
  return [
    ...Object.values(result.faces ?? {}),
    ...Object.values(result.clips ?? {}),
    ...Object.values(result.nested ?? {})
  ];
}

/**
 * FILL IN WHAT SITS BEHIND EACH REFUSED-DESCENT BOUNDARY, from the pack itself.
 *
 * ► **THIS IS A JOIN, NOT A SECOND WALK.** Every `clip` placement's child is
 *   extracted as its own entry by the worklist in `extractIcons`, so the
 *   filters inside it have already been counted — once, in the right place.
 *   What a reader cannot do without this is get from a parent's invoice to
 *   that number, and "see the child's entry" is the sentence this function
 *   exists to replace with a figure.
 *
 * ► **ONE LEVEL, AND IT SAYS SO.** A child's own `undescended` names its own
 *   children, so the chain is walkable; summing it recursively here would
 *   double-count the moment two parents share a child, which `inventory_buttons`
 *   and `cast_spell_image` nearly do already.
 */
function crossReferenceChildEffects(result) {
  const byCharacter = new Map();
  for (const entry of iconEntries(result)) byCharacter.set(entry.character, entry);
  for (const entry of iconEntries(result)) {
    const undescended = entry.effects?.undescended;
    if (!undescended) continue;
    let filters = 0;
    const missing = [];
    for (const child of undescended.children) {
      const found = byCharacter.get(child);
      if (!found || !found.effects) { missing.push(child); continue; }
      filters += found.effects.own.filters + found.effects.inherited.filters;
    }
    undescended.filtersInChildEntries = filters;
    undescended.childrenNotExtracted = missing;
  }
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
 * ► **AND EFFECTS ARE THREADED THE SAME WAY, WHICH THEY WERE NOT.** Because
 *   this walk is its own, `flattenFrame`'s effect threading did not come with
 *   it: this function read `matrix`, `colourTransform`, `name`, `ratio` and
 *   `clipDepth` off an entry and never `filters`, `hasFilters` or `blendMode`,
 *   so all 176 filters the roster reaches died HERE — not in `toPlacement`,
 *   not in the manifest. The entries were carrying them the whole time;
 *   `resolveTimeline` has decoded filter lists into typed records since the day
 *   `parsePlaceObject` learned to, and merges them field-by-field across a
 *   move. Nothing upstream needed changing, which is the uncomfortable part.
 *
 *   Every drawable now carries `blendMode`, `hasFilters`, `filters` and
 *   `ancestorEffects` — the chain of ENCLOSING placements that carried either,
 *   because a filter on a sprite applies to the whole group and not to
 *   whichever leaf happens to be inside it. An empty chain is `null` and never
 *   `[]`, so a caller cannot read "no enclosing effect" as "an array I forgot
 *   to fill"; `blendMode` is `undefined` when absent, matching
 *   `flattenFrame`'s literal so a reader moving between the two is not caught
 *   by a `null` that means the same thing in a different spelling.
 *
 *   **A `clip` placement carries the chain that ENCLOSES it and not its own
 *   contribution to that chain** — its own effects are on the placement, and
 *   appending them to its own ancestor list would count them twice. What is
 *   inside it is not counted here at all: that child is its own entry.
 *
 * Every drawable this cannot turn into geometry carries `unsupported` naming
 * the kind, and the caller counts it. Nothing is dropped.
 */
export function flattenIconFrame(buffer, characters, entries, options = {}) {
  const { cache = new Map(), spriteFrame = () => 1 } = options;
  const drawables = [];
  let clipsAcrossSpriteBoundary = 0;
  // A CUTTER'S OWN EFFECTS ARE NOT CARRIED, and this is where that is decided,
  // so this is where it is counted. `mask` reaches a placement as a shape and a
  // matrix — a REGION — and a blurred stencil is a soft-edged region no path
  // clip can express. Measured on the oracle: 6 shape cutters in this roster,
  // ZERO of them carrying anything, so these are counted zeroes. They stop
  // being zero the moment somebody mods a mask, and then they say so.
  const cutterEffects = { cutters: 0, filters: 0, emptyFilterLists: 0, blendModes: 0 };

  const innerFrame = (sprite, wanted) => {
    const key = `${sprite.id}@${wanted}`;
    if (!cache.has(key)) {
      const resolved = resolveTimeline(buffer, sprite, { frames: [wanted] });
      cache.set(key, resolved.frames[wanted - 1] ?? null);
    }
    return cache.get(key);
  };

  const visit = (list, parentMatrix, parentColour, parentPath, inheritedMask, depth, visiting, parentEffects) => {
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

    // An empty chain is reported as `null` rather than `[]`, so a caller cannot
    // mistake "no enclosing effect" for "an array I forgot to fill". Computed
    // once per LEVEL, because every entry on one level shares one ancestry.
    const carried = parentEffects.length > 0 ? parentEffects : null;

    for (const entry of list) {
      const isMask = typeof entry.clipDepth === "number" && entry.clipDepth > 0;
      const matrix = composeMatrix(parentMatrix, entry.matrix ?? IDENTITY_MATRIX);
      const colour = composeColourTransform(parentColour, entry.colourTransform ?? IDENTITY_COLOUR_TRANSFORM);
      const here = [...parentPath, entry.depth];

      // THIS PLACEMENT'S OWN EFFECTS. `hasFilters` is derived from the list as
      // well as from the flag, so a hand-built entry cannot claim one without
      // the other; `filters` is `null` rather than `[]` when there are none,
      // which is the distinction `carried` makes above and NOT the same thing
      // as a filter list of count zero — that one keeps `hasFilters` true and
      // is refused by name in `ownEffectsOf`.
      const filters = entry.filters ?? null;
      const hasFilters = entry.hasFilters === true || (filters !== null && filters.length > 0);
      const effects = { blendMode: entry.blendMode, hasFilters, filters, ancestorEffects: carried };
      // What a nested sprite hands its children: this placement's effects
      // appended, because a filter on a GROUP applies to the group and not to
      // whichever leaf is inside it. Frozen, so no descendant can append to a
      // chain a sibling is also holding.
      const descend = (entry.blendMode !== undefined || hasFilters)
        ? Object.freeze([...parentEffects, Object.freeze({
          path: here, characterId: entry.characterId, blendMode: entry.blendMode, hasFilters, filters
        })])
        : parentEffects;

      // A mask is a CUTTER. Painting it puts the stencil on the canvas instead
      // of the picture, so it is never emitted as a drawable of its own — it
      // travels on the things it clips, which is where a renderer needs it.
      if (isMask) {
        const mask = characters.get(entry.characterId);
        if (!mask || mask.kind !== "shape") {
          drawables.push({
            kind: "mask", characterId: entry.characterId, matrix, colour: null,
            path: here, name: entry.name ?? null, mask: null,
            unsupported: mask ? `mask-${mask.kind}` : "mask-missing",
            ...effects
          });
          continue;
        }
        // A USABLE cutter, which never becomes a drawable: its own effects end
        // here and are counted here. See `cutterEffects` above.
        cutterEffects.cutters += 1;
        if (filters !== null && filters.length > 0) cutterEffects.filters += filters.length;
        else if (hasFilters) cutterEffects.emptyFilterLists += 1;
        if (entry.blendMode !== undefined && entry.blendMode !== null) cutterEffects.blendModes += 1;
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
          path: here, name: entry.name ?? null, mask, unsupported: "missing",
          ...effects
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
            unsupported: null,
            // ► **`effects` AND NOT `descend`.** This placement's own filters
            //   belong to the placement — `inventory_buttons` tints its
            //   battlebutton exactly here — and appending them to its own
            //   ancestor chain would invoice them twice, once as own and once
            //   as inherited. What is INSIDE the child is not counted on this
            //   drawable at all; the child is its own entry and carries its own
            //   invoice, and the boundary is counted in `undescended`.
            ...effects
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
        visit(inner, matrix, colour, here, mask, depth + 1, visiting, descend);
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
        unsupported: character.kind === "shape" ? null : `${character.kind}-placement`,
        ...effects
      });
    }
  };

  visit(entries, IDENTITY_MATRIX, IDENTITY_COLOUR_TRANSFORM, [], null, 0, new Set(), EMPTY_EFFECT_CHAIN);
  return { drawables, clipsAcrossSpriteBoundary, cutterEffects };
}

/**
 * One placement, as it reaches JSON.
 *
 * `own` is this placement's own effects from `ownEffectsOf` and `inherited` is
 * a list of indices into the clip's `effectGroups`; both are spread the same
 * conditional way `colour` and `mask` are, so a placement with no effects is
 * byte-identical to what this tool wrote before today.
 *
 * ► **OWN AND INHERITED ARE DIFFERENT KEYS WITH DIFFERENT TYPES, on purpose.**
 *   `filters` holds filter RECORDS and means this placement's own and nothing
 *   else; `inheritedEffects` holds INDICES and never records, so no reader can
 *   take an enclosing sprite's bevel for this leaf's glow. Outermost first,
 *   which is the order a renderer nests its buffers in — unmeasurable on this
 *   roster, where every chain is length 1, and pinned by fixture instead.
 */
export function toPlacement(drawable, own = {}, inherited = null) {
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
    ...(drawable.mask ? { mask: { shape: drawable.mask.shape, matrix: roundMatrix(drawable.mask.matrix) } } : {}),
    ...own,
    ...(inherited ? { inheritedEffects: inherited } : {})
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

  // THIS CLIP'S EFFECT GROUPS, ONCE EACH, with the placements pointing at them
  // by index. Per clip rather than per pack because an index into a table one
  // entry away is a join a reader has to make by hand, and `frames` is already
  // per clip.
  const groups = [];
  const groupIndex = new Map();
  // Everything this clip's effects could not carry, by NAME. Per clip AND summed
  // for the manifest: "38 somewhere" and "38 on inventory_buttons" are different
  // problems and one total cannot tell a reader which one they have.
  const notCarried = {};
  const ownFilterLists = [];
  const ownBlendModes = [];
  // The same list again, restricted to placements this tool emits but cannot
  // turn into geometry. 172 of the roster's 174 own filters are here.
  const unsupportedOwnFilterLists = [];
  // And the same two for drawables this tool DROPS — kept apart from the
  // carried ones, because adding them would make `own.filters` count things the
  // pack does not hold, which is the opposite mistake.
  const refusedOwn = { filterLists: [], blendModes: [] };
  const undescended = { clipPlacements: 0, children: [], filtersInChildEntries: 0, childrenNotExtracted: [] };
  const childIds = new Set();
  let underGroup = 0;

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
    // A CUTTER'S OWN EFFECTS, counted where `flattenIconFrame` decided not to
    // carry them. Zero on this build; see that function for why the zero is
    // written down rather than assumed.
    if (flattened.cutterEffects.filters > 0) refuse(notCarried, "clipFilters", flattened.cutterEffects.filters);
    if (flattened.cutterEffects.emptyFilterLists > 0) {
      refuse(notCarried, "clipEmptyFilterList", flattened.cutterEffects.emptyFilterLists);
    }
    if (flattened.cutterEffects.blendModes > 0) {
      refuse(notCarried, "clipBlendMode", flattened.cutterEffects.blendModes);
    }
    const placements = [];
    for (const drawable of flattened.drawables) {
      if (drawable.unsupported) {
        sink.approximations[drawable.unsupported] = (sink.approximations[drawable.unsupported] ?? 0) + 1;
      }
      if (drawable.kind === "shape") sink.shapeIds.add(drawable.characterId);
      if (drawable.kind === "text") sink.textIds.add(drawable.characterId);
      if (drawable.kind === "clip") {
        sink.clipIds.add(drawable.characterId);
        // THE BOUNDARY THIS TOOL REFUSES TO CROSS, counted per placement and
        // the child named once. The effects INSIDE it are invoiced on the
        // child's own entry, never here.
        undescended.clipPlacements += 1;
        childIds.add(drawable.characterId);
        if (drawable.name) {
          if (!sink.clipNames.has(drawable.characterId)) sink.clipNames.set(drawable.characterId, new Set());
          sink.clipNames.get(drawable.characterId).add(drawable.name);
        }
      }
      if (drawable.mask) sink.shapeIds.add(drawable.mask.shape);
      if (drawable.kind === "mask" || drawable.kind === "missing") {
        // ► **AND ITS OWN EFFECTS GO OUT WITH IT, INVOICED.** For as long as
        //   this `continue` sat above any effect accounting, an own filter on a
        //   refused mask left no trace anywhere — not in `notCarried`, not in
        //   the invoice, not in this message — and a pack-wide zero would have
        //   been a measurement of this line rather than of the build.
        const lost = refusedEffectsOf(drawable, refusedOwn, notCarried);
        sink.failures.push({
          character: character.id, frame: index + 1,
          message: `${drawable.unsupported} at path ${drawable.path.join("/")} (character ${drawable.characterId})${lost}`
        });
        continue;
      }
      const own = ownEffectsOf(drawable, notCarried);
      if (own.filters) {
        ownFilterLists.push(own.filters);
        if (drawable.unsupported) unsupportedOwnFilterLists.push(own.filters);
      }
      if (own.blendMode !== undefined) ownBlendModes.push(own.blendMode);
      const inherited = inheritedEffectsFor(drawable, groups, groupIndex, notCarried);
      if (inherited) underGroup += 1;
      placements.push(toPlacement(drawable, own, inherited));
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
  undescended.children = [...childIds].sort((left, right) => left - right);
  return {
    frames,
    declaredFrames: character.frames,
    distinctFrames: seen.size,
    emptyFrames: signatures.reduce((count, signature) => count + (signature === "" ? 1 : 0), 0),
    duplicateOf,
    clipsAcrossSpriteBoundary,
    // ► **ALWAYS PRESENT, EMPTY WHERE THERE ARE NONE.** Eight of the fifteen
    //   entries have no effects at all; an absent key would make "this clip has
    //   no groups" and "this pack predates groups" the same shape, and telling
    //   those two apart is the whole reason a count gets written down.
    effectGroups: groups,
    effects: effectInvoiceFor({
      groups, ownFilterLists, ownBlendModes, underGroup,
      unsupportedOwnFilterLists, undescended, notCarried, refusedOwn
    })
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
      // The same two keys the icon clips get, spelled out because this literal
      // is explicit where theirs spreads `taken`. A face with no effects still
      // carries an empty table and a zeroed invoice: **`eyes1` and `mouth1`
      // carry NOTHING, and that zero is the measurement.** Leaving the keys off
      // the two entries that measure zero is how a pack ends up invoicing only
      // the entries that had something to say.
      effectGroups: taken.effectGroups,
      effects: taken.effects,
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

  const result = {
    faces, clips, nested, expressionScript, shapes, texts,
    failures: sink.failures,
    approximations: sink.approximations,
    clipsAcrossSpriteBoundary
  };
  // AFTER the worklist, because it needs every child's entry to exist. This
  // turns "the filters inside an undescended child are counted elsewhere" from
  // a sentence into a number a reader can check against the child's own row.
  crossReferenceChildEffects(result);
  return result;
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

/**
 * ONE ENTRY'S EFFECTS, compressed to the numbers a human scanning the manifest
 * has to see — and NOT a re-measurement. Every field is read straight off the
 * invoice in `icons.json`, so the manifest cannot disagree with the pack.
 *
 * `bevels` gets a line of its own here because a row inside `filtersByType` is
 * a row nobody sums, and bevel is the one kind canvas refuses outright.
 *
 * ► ~~*these two are the only bevels any pack in this repository reaches*~~
 *   **WRONG, AND CORRECTED 2026-09-15 BY A VERIFIER WHO WENT AND LOOKED.**
 *   `assets/screens/screens.json` ALREADY carries two bevel records, at
 *   `.screens.splash.filteredPlacements[1].filters[1]` and
 *   `.screens.new_or_continue.filteredPlacements[1].filters[1]`. They are a
 *   DIFFERENT two: character 1509, shadow `#000000`, distance 4, 2 passes —
 *   ONE distinct value recorded on two cumulative screens — against these,
 *   which are character 52, shadow `#a06001`, distance -6, 1 pass, on two
 *   distinct placements of `combat_panel`. **Four records, three distinct
 *   values, two packs.**
 *
 * ► **AND THE BUILD-WIDE 54 SITS AT FOUR SITES, NOT TWO.** Measured over the
 *   oracle by recursive `PlaceObject3` census: sprite 751 depth 1 and depth 7
 *   (1 each, character 52), sprite 1521 depth 1 (**51 records with 51 DISTINCT
 *   VALUES** — a tween of `distance` from 4 to 5), and sprite 2136 depth 1,
 *   instance `villainname`, character 2134 (1 record, shadow `#660000`).
 *   1 + 1 + 51 + 1 = 54.
 *
 * ► **THE REACHABLE DENOMINATOR FOR SPRITE 1521'S FIFTY-ONE IS ONE**, because
 *   `flattenFrame` freezes it on frame 1 — the same frame-1 freeze that hid the
 *   weapon enchantment from the figure pack, in a second place. And the
 *   `villainname` bevel is reachable by NO pack at all: its target is a
 *   `DefineEditText`, which the screens tool refuses by kind. So of 54 bevels
 *   in the build, a reader can reach 4 records carrying 3 values.
 */
function effectRow(effects) {
  if (!effects) return null;
  return {
    ownFilters: effects.own.filters,
    ownFiltersOnUnsupportedPlacements: effects.own.filtersOnUnsupportedPlacements,
    ownBlendModes: effects.own.blendModePlacements,
    droppedOwnFilters: effects.own.dropped.filters,
    groups: effects.inherited.groups,
    inheritedFilters: effects.inherited.filters,
    placementsUnderAGroup: effects.inherited.placements,
    bevels: effects.bevels.total,
    // The boundary, as a number: how many multi-frame children were refused
    // descent, and how many filters sit immediately behind them in THEIR
    // entries rather than in this one.
    undescendedClipPlacements: effects.undescended.clipPlacements,
    undescendedChildren: effects.undescended.children,
    filtersInChildEntries: effects.undescended.filtersInChildEntries,
    childrenNotExtracted: effects.undescended.childrenNotExtracted,
    use: effects.use.filters,
    notCarried: effects.notCarried
  };
}

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
      `${event.instance}[${event.handler}] ${event.instructions} instructions, touches ${event.touches.join(" ")}`),
    // ► **ONE ROW PER ENTRY, ALWAYS, INCLUDING THE NINE THAT ARE ALL ZEROES.**
    //   A manifest that carries an effects row only for the entries that have
    //   effects tells a reader who checks one row that the pack invoices
    //   everything, and tells a reader who checks a different row nothing at
    //   all. `test/extraction-honesty.test.js` exists because this pack once
    //   invoiced 0 of 56 shapes and that was at least uniform.
    effects: effectRow(clip.effects)
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
        `${expression.label}[${expression.firstFrame}-${expression.lastFrame}] ${expression.distinctPoses} distinct`),
      effects: effectRow(face.effects)
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
     * EVERY EFFECT THE PACK CARRIES, RECOMPUTED FROM THE PACK'S OWN ENTRIES.
     *
     * ► **Summed from what was written, never counted alongside it.** The
     *   figure extractor's manifest once summed a per-entry field that 83% of
     *   its pack did not have and reported zero against data holding two. Every
     *   number here comes from `faces`/`icons`/`nested` in `icons.json`, so a
     *   reader can check any of them by hand.
     */
    effects: tallyIconEffects(result),
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

  // ► **THE EFFECTS INVOICE, PRINTED. A COUNT THAT IS NEVER PRINTED IS NOT A
  //   COUNT** — the arena's walls were invisible for months while the data held
  //   eleven approximations and the report a human read said zero.
  const effects = tallyIconEffects(result);
  const tally = (counts) => Object.entries(counts).map(([kind, count]) => `${kind}=${count}`).join(" ") || "none";
  lines.push(
    `  effects: ${effects.ownFilters} own filters on ${effects.ownFilteredPlacements} placements ` +
    `(${effects.ownFiltersOnUnsupportedPlacements} of them on placements with no geometry), ` +
    `${effects.inheritedFilters} on ${effects.groups} enclosing groups over ${effects.placementsUnderAGroup} leaves, ` +
    `${effects.ownBlendModePlacements + effects.inheritedBlendModes} blend modes, ` +
    `${effects.droppedOwnFilters} DROPPED with a refused drawable`
  );
  lines.push(`    by type: own ${tally(effects.ownByType)} | group ${tally(effects.inheritedByType)}`);
  lines.push(
    `    bevels: ${effects.bevels.total} (${effects.bevels.inner} inner, ${effects.bevels.zeroBlur} with zero blur) ` +
    "— canvas refuses every one; assets/screens/screens.json reaches 2 more, and " +
    "the build's other 50 are behind a frame-1 freeze (see effectRow)"
  );
  lines.push(
    `    a renderer would: ${effects.use.applied} applied, ${effects.use.deferred} deferred to the colour matrix, ` +
    `${effects.use.noOp} measured no-ops, ${effects.use.refused} refused (${tally(effects.use.refusedByReason)})`
  );
  lines.push(
    `    NOT counted here: ${effects.undescendedChildFilters} filters inside ${effects.undescendedChildren.length} ` +
    `undescended children (${effects.undescendedClipPlacements} placements) — invoiced on those children's own entries` +
    `${effects.undescendedChildrenNotExtracted > 0 ? `, ${effects.undescendedChildrenNotExtracted} CHILD ENTRIES MISSING` : ""}`
  );
  lines.push(`    notCarried: ${tally(effects.notCarried)}`);

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
