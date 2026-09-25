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
 *   **And a flattened liquid cannot be DRIVEN**: its rest pose is folded into
 *   the leaf, and the build overwrites that pose every frame. The `gauges`
 *   section (`GAUGE_PANEL`, added 2026-09-24) keeps each `blood_health` whole
 *   as a clip placement under its cutter, with the drive read off the bytes,
 *   for `src/render/combat-panel.js`. The roster's flatten is unchanged.
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
  resolveTimeline,
  tagStreamStart
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
 *     +0x1603  damage_icon.damage_splat.gotoAndStop(1)   always, first
 *     +0x163b  damage_icon.damage_splat.gotoAndStop(3)   under "critical"
 *     +0x1698  damage_icon.damage_splat.gotoAndStop(5)   under "grievous"
 *     +0x1824  damage_icon.damage_splat.gotoAndStop(2)   armour broken (< 0)
 *     +0x18c2  damage_icon.damage_splat.gotoAndStop(2)   hit points reached,
 *                                                       splat still on 1
 *   ```
 *
 *   ~~Frames 2 and 4 are never asked for by name. They are still extracted —
 *   **a frame nothing indexes is a finding, not a reason to drop it** — and the
 *   three that ARE indexed are named here so a renderer does not have to guess
 *   which of five splats a critical hit wants.~~
 *
 *   ► **CORRECTED 2026-09-23 (the fight pop-ups; re-derived from the overlay
 *     frame-52 body 0x240c85 disassembly): FRAME 2 IS ASKED FOR, TWICE, AND
 *     FRAME 1 DOES NOT MEAN "normal".** The two `gotoAndStop(2)` rows above
 *     were missed. `+0x1603` is unconditional, and the armour block after it
 *     turns it 2 whenever the blow reaches the hit points — broken armour
 *     (`+0x1824`, which also OVERWRITES a grievous 5), or `armourclass <= 0`
 *     (`+0x1864`, then `+0x18a1`/`+0x18c2`). So frame 1 survives ONLY for a
 *     normal or taunt blow the armour absorbed whole, and an ordinary hit that
 *     hurts shows 2. **Frame 4 (TAUNT) is the one never selected**: a taunt's
 *     method is rewritten to "normal" at `+0x1673` before any frame is chosen,
 *     and the five rows above are every `gotoAndStop` on 815 in the file.
 *     The whole rule is `damageSplatFrame` in `src/render/popups.js`. Packs
 *     extracted before this correction carry the old `meaning`; nothing reads
 *     it to decide a frame.
 *
 *   ~~`bonus_icon`'s child has eight frames and `addstats_icon`'s has seven, and
 *   this session found no `gotoAndStop` selecting either. That gap is recorded
 *   as `null` rather than filled in with a plausible order.~~
 *
 *   ► **ALSO CORRECTED 2026-09-23: `bonus_icon`'s child IS selected**, by
 *     `magic_damage_character`'s own `damage_splat.gotoAndStop(bonus_frame)`
 *     (`+0x1381`) and by the eight potion arms (`+0x5888`..`+0x5d20`), and its
 *     frames are named by their own static texts 124..150. The callers pass 8
 *     for the bolts (`+0x858f`), 4 for the fireballs and molten death
 *     (`+0x91a2`, `+0x88c1`), 5/6/7/4 for the frozen/lifesteal/poisoned/
 *     burning ticks (`+0x5335`, `+0x5469`, `+0x559d`, `+0x56d1`) and 1/2/3 for
 *     the potions. `addstats_icon`'s child stays `null`: its parent is never
 *     attached.
 */
export const NESTED_MEANINGS = Object.freeze({
  815: Object.freeze({
    instance: "damage_splat",
    parent: 817,
    // ~~{ 1: "normal", 3: "critical", 5: "grievous" }~~ — corrected 2026-09-23, see above.
    frames: Object.freeze({
      1: "absorbed: a normal or taunt blow the armour took whole",
      2: "hurt: a normal or taunt blow reached the hit points, or a grievous one broke the armour",
      3: "critical",
      5: "grievous, armour not broken: absorbed, exactly spent, or none"
    }),
    unreachable: Object.freeze([4]),
    source: "damagecharacter, sprite 862 frame 52, +0x1603 / +0x163b / +0x1698 / +0x1824 / +0x18c2; " +
      "taunt rewritten to normal at +0x1673"
  }),
  151: Object.freeze({
    instance: "damage_splat",
    parent: 153,
    // ~~null, "no gotoAndStop on this child was found"~~ — corrected 2026-09-23, see above.
    frames: Object.freeze({
      1: "HEALTH", 2: "STAMINA", 3: "ARMOUR", 4: "BURNING",
      5: "FROZEN", 6: "WRAITH", 7: "POISONED", 8: "LIGHTNING"
    }),
    source: "magic_damage_character +0x1381 (bonus_frame) and the potion arms +0x5888..+0x5d20; " +
      "names from static texts 124..150"
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
  }),
  // ► **ADDED 2026-09-24 WITH THE ACTION BUTTONS, and it lives in the
  //   `buttons` section, never in the roster's `nested`** (see
  //   `BUTTON_OVERLAY`). Up and over, the same two states as 58 above, chosen
  //   by the overlay's own rollover handlers: every option slot's `onRollOver`
  //   is `this.battlebutton.gotoAndStop(2)` and its `onRollOut`
  //   `this.battlebutton.gotoAndStop(1)` (overlay frame 1, DoAction body
  //   0x236947, `+0x0b08` and `+0x0c2e`), and 826 holds on each with a bare
  //   `stop()` (826 frame 1 body 0x233935, frame 2 body 0x233947).
  //   `deriveButtonHandlers` re-derives the two frames from the bytes on every
  //   extraction and writes them to the pack beside this declaration.
  826: Object.freeze({
    instance: "battlebutton",
    parent: 860,
    frames: Object.freeze({ 1: "up", 2: "over" }),
    source: "overlay frame 1 body 0x236947: onRollOver battlebutton.gotoAndStop(2) +0x0b08, " +
      "onRollOut battlebutton.gotoAndStop(1) +0x0c2e"
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
    // ~~"the SEVERITY is damage_splat's own frame 1/3/5"~~ — frames 1, 2, 3 and 5; 4 is never
    // selected (corrected 2026-09-23, see NESTED_MEANINGS).
    indexedBy: "frame, as a 30-frame pop; the SEVERITY is damage_splat's own frame 1/2/3/5",
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
     *   gauges sit at y ~~18..115~~ **10.55..115.35** and `crowd_text` sits
     *   at y −258.8, three hundred pixels above them. A renderer that treats
     *   the 640.5 x 373.5 bounds as a solid bar puts a 300px transparent gap
     *   on screen. *(Corrected 2026-09-24, the gauges slice: the highest
     *   unmasked ink is the vial glass, shapes 730/739 at -36.1 under the
     *   gauges' 46.65 — re-derived from the pack by
     *   `test/render-combat-panel.test.js`. The 18 had no source.)*
     */
    indexedBy: "frame 1; it has only one",
    attachedBy: "sprite 2249 frame 1 @0x6e421b, name combat_panel, depth 200000",
    reader: "the hit-point, stamina and armour gauges and the crowd line"
  })
]);

/**
 * THE ACTION BUTTONS AROUND THE FIGHTER — added 2026-09-24.
 *
 * ► **THE BUTTON HAS NO EXPORT NAME, SO IT IS REACHED THROUGH THE ONE THAT
 *   DOES.** The eight option slots `optionA`..`optionH` are instances of one
 *   UNEXPORTED sprite (860 in the oracle), placed by the exported `overlay`
 *   (862) on its frame 1 at depths 37..93 — the named-instance table has all
 *   eight, `sprite:862/frame:1`. `ICON_CLIPS` keys on an export name and would
 *   have to invent one, so the button is found the way the build finds it: as
 *   whatever character sits at the overlay's option slots. All eight must be
 *   ONE character or the extraction fails by name.
 *
 * ► **THE ICON IS THE BUTTON'S OWN FRAME, NOT ITS CHILD'S.** Every controller
 *   frame selects a verb's art with `optionX.gotoAndStop(N)` straight on the
 *   slot (overlay frame 5, body 0x238de8, `+0x09b6` `optionA.gotoAndStop(7)`,
 *   one of 84 across the four controllers). The child `battlebutton` (826) is the round
 *   background, and ITS two frames are up and over (`NESTED_MEANINGS[826]`).
 *   So, as with `damage_icon`, a frame of the parent must not be flattened
 *   with the child frozen: the child is a `clip` placement and its own entry.
 *
 * ► **A SECTION OF ITS OWN, AND THAT IS DELIBERATE.** The roster's invoice —
 *   176 filters, 15 entries, 190 undescended placements, six clips across a
 *   sprite boundary — is pinned by tests against the oracle, and every one of
 *   those numbers was MEASURED. Adding the button to `clips`/`nested` would
 *   move them by amounts nobody has measured. The button and its child are
 *   written under `buttons`, invoiced on their own (`buttons.effects`), and
 *   the roster's numbers mean exactly what they meant before.
 *
 * ► **THE LAYOUT AND THE WIRING ARE WRITTEN FROM THE BYTES, NOT COPIED FROM A
 *   TABLE.** `summariseOverlayLayout` records where each slot sits on every
 *   frame of the overlay, and `deriveOptionWiring` records which frame each
 *   controller sends each slot to and which verb its `onRelease` names. The
 *   hand-cited table in `src/render/action-buttons.js` is checked against
 *   both by `test/render-action-buttons.test.js` once a pack exists — two
 *   independent paths to one answer.
 */
export const BUTTON_OVERLAY = Object.freeze({
  character: 862,
  linkage: "overlay",
  /** What the eight slots are expected to hold; the extraction DERIVES it and fails by name on a mismatch. */
  expectedButton: 860,
  slots: Object.freeze(["optionA", "optionB", "optionC", "optionD", "optionE", "optionF", "optionG", "optionH"]),
  /** The ninth button: an instance of `inventory_buttons` (116), which the roster already extracts. */
  swapSlot: "swap_inventory",
  /** The overlay's own copy of the hero, shown only when the fighters stand far apart. */
  heroInstance: "hero",
  /** The four frame LABELS the selector at overlay frame 4 (body 0x238bc5) `gotoAndPlay`s. */
  controllers: Object.freeze(["longrange_warrior", "closerange_warrior", "longrange_archer", "closerange_archer"]),
  /**
   * ► **THE ITEMS AND SPELLS HAVE A ROW OF THEIR OWN, AND IT IS ATTACHED TO
   *   THE OVERLAY.** Overlay frame 1 (body 0x2378d2) does
   *   `this.attachMovie("inventory_overlay", "inventory_overlay", 199999,
   *   {_x: 0, _y: -80})` (`+0x02fe`/`+0x0319`) and scales it 60 (`+0x0349`):
   *   six `inventory_buttons` (116) instances, each sent to the item or spell
   *   id in its slot (sprite 492 frame 1 body 0x50e55, `+0x0132` for slot 1),
   *   with the same up/over rollover as the option slots (`+0x03bd`,
   *   `+0x04e3`). Where the six sit inside 492 is recorded from its display
   *   list, like the option slots.
   */
  inventory: Object.freeze({
    character: 492,
    linkage: "inventory_overlay",
    instances: Object.freeze(["inventory_button1", "inventory_button2", "inventory_button3",
      "inventory_button4", "inventory_button5", "inventory_button6"]),
    attachedBy: "overlay frame 1 body 0x2378d2: this.attachMovie(\"inventory_overlay\", \"inventory_overlay\", 199999, " +
      "{_x: 0, _y: -80}) +0x02fe/+0x0319; _xscale = _yscale = 60 +0x0349"
  }),
  attachedBy: "root frame 221 body 0x671ad3 +0x04cf: gladiators.attachMovie(\"overlay\", \"overlay\", 40000)",
  placedBy: "sprite 2249 frame 1 body 0x6e4221: gladiators.onEnterFrame +0x0e68 (x, y and scale every frame)"
});

/**
 * THE FIGHT'S GAUGES, AS THEIR OWN SECTION — added 2026-09-24 for the in-frame
 * team HUD (the owner: "the team health, energy, and armour should be in the
 * game frame as UI elements, using the same ui elements that are used in 1v1
 * in the original game. Pull these assets.").
 *
 * ► **THE ROSTER ALREADY FLATTENS `combat_panel`, AND THAT IS WHY IT CANNOT
 *   BE DRAWN LIVE FROM THE ROSTER.** Each gauge sprite (733 health, 742
 *   energy, 749 armour) holds a ONE-frame child named `blood_health` — the
 *   liquid — under a same-level cutter, and the roster's walk descends into it
 *   and folds its REST matrix (-484, -531 twips in 733/742; -494, -561 in 749)
 *   into the leaf. The build overwrites that pose every frame with a whole
 *   pixel (`this.blood_health._y = Math.round(-30 + (101 - pct) * 0.7)`), so a
 *   renderer needs the child whole: here it is a `clip` placement (the
 *   `keepAsClip` option of `flattenIconFrame`), carrying its own matrix and the
 *   cutter, with the liquid's own sprite (729/738/745) as a nested entry. And
 *   the panel's own frame keeps no instance names on its leaves, so the six
 *   gauge placements, the two banners (sprite 52, with their inner bevels) and
 *   the two name fields are recorded here by depth, name and matrix.
 *
 * ► **A SECTION OF ITS OWN, AS THE BUTTONS ARE, for the same reason**: the
 *   roster's invoice (176 filters, 172 on text, 190 undescended placements,
 *   six clips across a sprite boundary, fifteen entries) is pinned against the
 *   oracle, and every one of those numbers was measured. None of it moves.
 *
 * ► **THE DRIVE IS DERIVED, AND CHECKED AGAINST THIS EXPECTATION BY NAME.**
 *   `deriveGaugeDrive` reads every gauge's own `onClipEvent(enterFrame)`
 *   handler — the number, the percent, the liquid, armour's `_visible` test —
 *   and the constants it writes to the pack are the ones all six agree on.
 *   `expectedDrive` is what they are expected to be; a mismatch is a failure
 *   that names it, and the pack still carries what the bytes say. **The
 *   panel's two provenance lines are the same**: `deriveGaugeProvenance` reads
 *   them, `expectedAttachedBy`/`expectedNamesSetBy` are checked against them.
 */
export const GAUGE_PANEL = Object.freeze({
  character: 751,
  linkage: "combat_panel",
  /** The one child each gauge sprite's handler moves. */
  liquidInstance: "blood_health",
  /** The name banner, placed twice in 751 (depths 1 and 7), with an inner bevel on each placement. */
  banner: 52,
  gauges: Object.freeze([
    Object.freeze({ instance: "hero_potion", side: "hero", reading: "health", character: 733, value: "hitpoints", max: "hitpointsmax" }),
    Object.freeze({ instance: "villain_potion", side: "villain", reading: "health", character: 733, value: "hitpoints", max: "hitpointsmax" }),
    Object.freeze({ instance: "hero_stamina_potion", side: "hero", reading: "energy", character: 742, value: "staminaleft", max: "staminamax" }),
    Object.freeze({ instance: "villain_stamina_potion", side: "villain", reading: "energy", character: 742, value: "staminaleft", max: "staminamax" }),
    Object.freeze({ instance: "hero_armour", side: "hero", reading: "armour", character: 749, value: "armourclass", max: "armourclass_max" }),
    Object.freeze({ instance: "villain_armour", side: "villain", reading: "armour", character: 749, value: "armourclass", max: "armourclass_max" })
  ]),
  /** The name fields, known by the variable their `DefineEditText` is bound to. */
  names: Object.freeze([
    Object.freeze({ side: "hero", variable: "herotext" }),
    Object.freeze({ side: "villain", variable: "villaintext" })
  ]),
  expectedDrive: Object.freeze({ base: -30, full: 101, step: 0.7, percentScale: 100, rounding: "round", separator: " / " }),
  /**
   * What `deriveGaugeProvenance` is expected to read off the bytes — checked
   * by name, never written to the pack (the pack carries what it reads).
   * ~~These were `attachedBy`/`namesSetBy`, copied into the pack verbatim
   * (verify:gauges-r2).~~
   */
  expectedAttachedBy: "sprite 2249 frame 1 body 0x6e4221 +0x0bf2..+0x0c28: " +
    "_root.arena.attachMovie(\"combat_panel\", \"combat_panel\", 200000, {_x: -320, _y: 122})",
  expectedNamesSetBy: "sprite 2249 frame 1 body 0x6e4221 +0x0c4a / +0x0c6b: combat_panel.herotext|villaintext = _root.game.hero|villain.character_name"
});

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
function crossReferenceChildEffects(result, entries = iconEntries(result), lookup = entries) {
  const byCharacter = new Map();
  for (const entry of lookup) byCharacter.set(entry.character, entry);
  for (const entry of entries) {
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
  // `keepAsClip(entry, character)`: a ONE-frame child this caller wants whole,
  // as a `clip` placement carrying its own matrix and same-level mask, rather
  // than flattened into its leaves. Only the gauges section asks, for the
  // liquid the build MOVES (`blood_health`); the roster never passes it, so
  // every roster number stays what it was measured to be.
  const { cache = new Map(), spriteFrame = () => 1, keepAsClip = () => false } = options;
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
        if (character.frames > 1 || keepAsClip(entry, character)) {
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
function extractClipFrames(buffer, characters, character, cache, sink, { keepAsClip } = {}) {
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
      flattened = flattenIconFrame(buffer, characters, list, { cache, ...(keepAsClip ? { keepAsClip } : {}) });
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
 *   So the liquid sprite `blood_health` SLIDES — `_y` ~~−29.3 at full, 40.7
 *   at empty~~ **−29 at full, 41 at empty: `round` makes it a whole pixel,
 *   and those two were the values before it (corrected 2026-09-24; the
 *   gauges section's `deriveGaugeDrive` reads the whole expression)** — and
 *   shape 727's `clipDepth` 5 is the vial that crops it. Drop
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
/* The action buttons: wiring, handlers and layout, from the bytes     */
/* ------------------------------------------------------------------ */

/** An offset relative to its block's BODY, as the action dumps print it. */
function relativeTo(base, offset) {
  return `+0x${(offset - base).toString(16).padStart(4, "0")}`;
}

function isNumberOperand(operand) {
  return Boolean(operand) && (operand.type === "integer" || operand.type === "double" || operand.type === "float") &&
    Number.isFinite(operand.value);
}

function lastOperand(instruction) {
  const operands = pushOperands(instruction);
  return operands && operands.length > 0 ? operands[operands.length - 1] : null;
}

/**
 * `Push …, N, 1, "<name>"` · `GetVariable` · `Push "gotoAndStop"` · `CallMethod`
 * starting at `list[index]` — the one spelling every controller frame uses to
 * pick a slot's art — or null.
 */
function namedGotoAt(list, index) {
  const operands = pushOperands(list[index]);
  if (!operands || operands.length < 3) return null;
  const name = operands[operands.length - 1];
  const argc = operands[operands.length - 2];
  const frame = operands[operands.length - 3];
  if (typeof name.value !== "string" || !isNumberOperand(argc) || argc.value !== 1 || !isNumberOperand(frame)) return null;
  if (list[index + 1]?.name !== "GetVariable") return null;
  if (lastOperand(list[index + 2])?.value !== "gotoAndStop") return null;
  if (list[index + 3]?.name !== "CallMethod") return null;
  return { target: name.value, frame: frame.value };
}

/**
 * `Push "<name>"` · `GetVariable` · `Push "_visible"|"visible", <bool>` ·
 * `SetMember`, or null.
 *
 * ► **`visible` IS RECORDED BESIDE `_visible` ON PURPOSE.** The ranged
 *   controller's zero-ammo arm writes `visible`, which is not a MovieClip
 *   property and hides nothing (battle map, "The ammunition-visibility
 *   defect"). Folding the two together would record a hide the build never
 *   performs; dropping `visible` would lose the defect. The property is named.
 */
function namedVisibilityAt(list, index) {
  const name = lastOperand(list[index]);
  if (typeof name?.value !== "string") return null;
  if (list[index + 1]?.name !== "GetVariable") return null;
  const write = pushOperands(list[index + 2]);
  if (!write || write.length < 2) return null;
  const property = write[write.length - 2];
  const value = write[write.length - 1];
  if (property?.value !== "_visible" && property?.value !== "visible") return null;
  if (value?.type !== "boolean") return null;
  if (list[index + 3]?.name !== "SetMember") return null;
  return { target: name.value, property: property.value, value: value.value };
}

/** The `getphase("<label>")` a handler body calls, or null. */
function getphaseLabelIn(body) {
  for (const { instruction } of walkInstructions(Array.isArray(body) ? body : [], "")) {
    const operands = pushOperands(instruction);
    if (!operands || operands.length < 3) continue;
    const callee = operands[operands.length - 1];
    const argc = operands[operands.length - 2];
    const label = operands[operands.length - 3];
    if (callee.value === "getphase" && isNumberOperand(argc) && argc.value === 1 && typeof label.value === "string") {
      return label.value;
    }
  }
  return null;
}

/** `Push "<name>"` · `GetVariable` · `Push "onRelease"` · `DefineFunction…`, or null. */
function namedReleaseAt(list, index) {
  const name = lastOperand(list[index]);
  if (typeof name?.value !== "string") return null;
  if (list[index + 1]?.name !== "GetVariable") return null;
  if (lastOperand(list[index + 2])?.value !== "onRelease") return null;
  const handler = list[index + 3];
  if (!handler || (handler.name !== "DefineFunction" && handler.name !== "DefineFunction2")) return null;
  return { target: name.value, verb: getphaseLabelIn(handler.operand?.body) };
}

/**
 * The one test that splits a controller frame by FACING:
 * `…"gladiator_dir"` · `GetMember` · `Push "right"` · `Equals2` · `Not` · `If`.
 * What falls through is the facing-right arm; the jump target starts the left.
 */
function facingSplitOf(list) {
  for (let index = 3; index < list.length; index += 1) {
    if (list[index].name !== "If" || list[index - 1]?.name !== "Not" || list[index - 2]?.name !== "Equals2") continue;
    if (lastOperand(list[index - 3])?.value !== "right") continue;
    const readsFacing = list.slice(Math.max(0, index - 8), index - 3)
      .some((instruction) => (pushOperands(instruction) ?? []).some((operand) => operand.value === "gladiator_dir"));
    if (!readsFacing || !Number.isFinite(list[index].operand?.target)) continue;
    return { index, offset: list[index].offset, target: list[index].operand.target };
  }
  return null;
}

/**
 * WHICH ART AND WHICH VERB EACH CONTROLLER GIVES EACH SLOT, per facing, read
 * straight off the overlay's controller frames.
 *
 * ► **NO CONDITION IS DECOMPILED HERE, AND THAT IS WHY IT CAN BE TRUSTED.** A
 *   controller's arm is a flat run of `optionX.gotoAndStop(N)`,
 *   `optionX._visible = false` and `optionX.onRelease = function () {
 *   getphase("<verb>") }`, some of them under a test (the stamina test that
 *   swaps taunt for rest, the psyche counter's three frames, the ammo test, the
 *   level gates). Rather than decide which test guards which line, this pairs
 *   each `onRelease` with EVERY frame its slot was sent to since that slot's
 *   previous `onRelease` in the same arm. So `psyche_up` comes back with
 *   frames `[26, 27, 28]`, the stamina slot comes back TWICE (`taunt` then
 *   `rest`), and the tests themselves stay in the hand-cited table in
 *   `src/render/action-buttons.js`, which cites their offsets.
 *
 * ► **A `gotoAndStop` ON A NAME THAT IS NOT A SLOT IS KEPT, AS A STRAY.**
 *   `closerange_warrior` facing right sends frame 28 to `optionHG` (overlay
 *   frame 13, body 0x23a11c, `+0x0923`), which is no instance at all; the
 *   psyche button there keeps whatever frame it last had. Dropping unknown
 *   targets would delete the finding.
 *
 * @param {object} analysis  `analyseSwfBuffer(buffer).analysis`
 * @param {object} options
 * @param {number} options.character   the overlay's character id
 * @param {object[]} options.labels    the overlay's `{frame, name}` FrameLabels
 * @param {string[]} options.controllers  the labels to read
 * @param {string[]} options.slots     the instance names that ARE slots
 */
export function deriveOptionWiring(analysis, { character, labels, controllers, slots }) {
  const frameOf = new Map((labels ?? []).map((label) => [label.name, label.frame]));
  const isSlot = new Set(slots);
  const wiring = {};
  for (const label of controllers) {
    const frame = frameOf.get(label);
    const record = {
      label, frame: frame ?? null, blocks: [], facingSplit: null,
      common: newArm(), right: newArm(), left: newArm()
    };
    wiring[label] = record;
    if (frame === undefined) {
      record.problem = "no FrameLabel of this name on the overlay";
      continue;
    }
    const pattern = new RegExp(`^sprite:${character}/frame:${frame}/DoAction@`);
    const blocks = (analysis?.actionBlocks ?? []).filter((block) => pattern.test(block.context));
    if (blocks.length === 0) record.problem = "no DoAction on the label's frame";
    blocks.forEach((block, blockIndex) => {
      record.blocks.push({ context: block.context, body: `0x${block.offset.toString(16)}` });
      const list = block.instructions;
      const at = (instruction) => relativeTo(block.offset, instruction.offset);
      const split = facingSplitOf(list);
      if (split && record.facingSplit === null) {
        record.facingSplit = { test: relativeTo(block.offset, split.offset), leftFrom: relativeTo(block.offset, split.target) };
      }
      const sideOf = (index) => (!split || index <= split.index)
        ? "common"
        : (list[index].offset < split.target ? "right" : "left");
      const tag = (event) => (blocks.length > 1 ? { ...event, block: blockIndex } : event);
      for (let index = 0; index < list.length; index += 1) {
        const arm = record[sideOf(index)];
        const goto = namedGotoAt(list, index);
        if (goto) {
          if (isSlot.has(goto.target)) arm.events.push(tag({ kind: "goto", slot: goto.target, frame: goto.frame, at: at(list[index]) }));
          else arm.strays.push(tag({ target: goto.target, frame: goto.frame, at: at(list[index]) }));
          continue;
        }
        const visibility = namedVisibilityAt(list, index);
        if (visibility && visibility.value === false) {
          if (isSlot.has(visibility.target)) {
            arm.hides.push(tag({ slot: visibility.target, property: visibility.property, at: at(list[index]) }));
          } else if (/^option/.test(visibility.target)) {
            arm.strays.push(tag({ target: visibility.target, property: visibility.property, at: at(list[index]) }));
          }
          continue;
        }
        const release = namedReleaseAt(list, index);
        if (release) {
          if (isSlot.has(release.target)) arm.events.push(tag({ kind: "release", slot: release.target, verb: release.verb, at: at(list[index]) }));
          else arm.strays.push(tag({ target: release.target, verb: release.verb, at: at(list[index]) }));
        }
      }
    });
    for (const side of ["common", "right", "left"]) pairArm(record[side]);
  }
  return wiring;
}

function newArm() {
  return { events: [], hides: [], strays: [], slots: {}, unpaired: [] };
}

/** Each `onRelease` takes every frame its slot was sent to since that slot's last `onRelease`. */
function pairArm(arm) {
  const pending = new Map();
  for (const event of arm.events) {
    if (event.kind === "goto") {
      if (!pending.has(event.slot)) pending.set(event.slot, []);
      pending.get(event.slot).push(event);
      continue;
    }
    const frames = pending.get(event.slot) ?? [];
    pending.set(event.slot, []);
    if (!arm.slots[event.slot]) arm.slots[event.slot] = [];
    arm.slots[event.slot].push({
      verb: event.verb,
      frames: frames.map((goto) => goto.frame),
      gotoAt: frames.map((goto) => goto.at),
      releaseAt: event.at,
      ...(event.block === undefined ? {} : { block: event.block })
    });
  }
  for (const [slot, left] of pending) {
    for (const goto of left) arm.unpaired.push({ slot, frame: goto.frame, at: goto.at });
  }
  // The raw event list is what the pairing was computed FROM; the pairing is
  // what a reader wants. Keeping both doubles the pack for no new fact.
  delete arm.events;
}

/**
 * THE HANDLERS THE OVERLAY HANGS ON ITS SLOTS ONCE, ON FRAME 1 — the rollover
 * art and the ninth button.
 *
 * - Every `onRollOver`/`onRollOut`/`onRelease` function assigned at top level,
 *   with the slots it is assigned to, the `battlebutton.gotoAndStop(N)` it
 *   performs and the `getphase` verb it calls. The eight option slots share
 *   one rollover (`battlebutton` 2) and one rollout (`battlebutton` 1); the
 *   swap slot has its own three, and its `onRelease` is `swap_weapons`; the
 *   six `inventory_buttonN` of the items row (`others`) have their own three,
 *   whose `onRelease` sets `inventory_action` rather than calling `getphase`.
 * - The swap slot's own art: `swap_inventory.gotoAndStop(10|11)` and its hide.
 *
 * Same spirit as `deriveOptionWiring`: the guards are NOT decompiled. The hand
 * table cites them (`src/render/action-buttons.js`).
 */
export function deriveButtonHandlers(analysis, { character, slots, swapSlot, others = [] }) {
  const targets = new Set([...slots, swapSlot, ...others]);
  const handlers = [];
  const swap = { gotos: [], hides: [] };
  const pattern = new RegExp(`^sprite:${character}/frame:1/DoAction@`);
  for (const block of (analysis?.actionBlocks ?? []).filter((candidate) => pattern.test(candidate.context))) {
    const list = block.instructions;
    const at = (instruction) => relativeTo(block.offset, instruction.offset);
    let since = 0;
    for (let index = 0; index < list.length; index += 1) {
      const instruction = list[index];
      if (instruction.name === "SetMember" || instruction.name === "Pop") {
        // A chained `a.onRollOver = b.onRollOver = … = function` compiles to
        // the function, then `StoreRegister 0` · `SetMember` · `Push register:0`
        // pairs back up the chain. A statement boundary is a SetMember or Pop
        // that is NOT followed by one of those register pushes.
        const next = pushOperands(list[index + 1]);
        if (!next || !next.some((operand) => operand.type === "register")) since = index + 1;
      }
      const goto = namedGotoAt(list, index);
      if (goto && goto.target === swapSlot) swap.gotos.push({ frame: goto.frame, at: at(instruction) });
      const visibility = namedVisibilityAt(list, index);
      if (visibility && visibility.target === swapSlot && visibility.value === false) {
        swap.hides.push({ property: visibility.property, at: at(instruction) });
      }
      if (instruction.name !== "DefineFunction" && instruction.name !== "DefineFunction2") continue;
      const event = lastOperand(list[index - 1])?.value;
      if (event !== "onRollOver" && event !== "onRollOut" && event !== "onRelease") continue;
      const assignedTo = [];
      for (const earlier of list.slice(since, index)) {
        for (const operand of pushOperands(earlier) ?? []) {
          if (typeof operand.value === "string" && targets.has(operand.value) && !assignedTo.includes(operand.value)) {
            assignedTo.push(operand.value);
          }
        }
      }
      handlers.push({
        event,
        slots: assignedTo,
        battlebutton: battlebuttonFrameIn(instruction.operand?.body),
        verb: getphaseLabelIn(instruction.operand?.body),
        at: at(instruction)
      });
      since = index + 1;
    }
  }
  return { handlers, swap };
}

/** The frame a handler sends `<this>.battlebutton` to, or null. */
function battlebuttonFrameIn(body) {
  const list = [...walkInstructions(Array.isArray(body) ? body : [], "")].map((entry) => entry.instruction);
  for (let index = 0; index < list.length; index += 1) {
    const operands = pushOperands(list[index]);
    if (!operands || operands[operands.length - 1]?.value !== "battlebutton") continue;
    if (list[index + 1]?.name !== "GetMember" || lastOperand(list[index + 2])?.value !== "gotoAndStop") continue;
    // The argument is the operand before the argument count `1`, whatever sits
    // between that and the member name (a register holding `this`, here).
    for (let slot = operands.length - 2; slot >= 1; slot -= 1) {
      if (isNumberOperand(operands[slot]) && operands[slot].value === 1 && isNumberOperand(operands[slot - 1])) {
        return operands[slot - 1].value;
      }
    }
  }
  return null;
}

/**
 * WHERE EVERY SLOT SITS ON EVERY FRAME OF THE OVERLAY, compressed to runs.
 *
 * ► **THE RESTING FRAME IS WHAT A PLAYER SEES, NOT THE LABEL FRAME.** Each
 *   controller label plays through a span and holds on a `stop()` (battle map,
 *   "Selection and spans": 5–12, 13–19, 20–27, 28–37). A slot that tweened
 *   inside a span would be drawn at its resting matrix, so each controller
 *   gets `restsAt` — the first bare `stop()` at or after its label — and the
 *   slots' matrices THERE. Where the slots do not move, the runs say so.
 *
 * Pure over `resolveTimeline`'s output, so a test can hand it display lists.
 * Matrices are `roundMatrix`'s: translations in TWIPS.
 */
export function summariseOverlayLayout(resolved, { instances, labels = [], stops = [], controllers = [] }) {
  const wanted = new Set(instances);
  const tracks = {};
  const frames = Array.isArray(resolved?.frames) ? resolved.frames : [];
  for (let index = 0; index < frames.length; index += 1) {
    const list = frames[index];
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (!entry.name || !wanted.has(entry.name)) continue;
      const matrix = roundMatrix(entry.matrix ?? IDENTITY_MATRIX);
      const key = JSON.stringify([entry.depth, entry.characterId, matrix]);
      if (!tracks[entry.name]) tracks[entry.name] = [];
      const runs = tracks[entry.name];
      const last = runs[runs.length - 1];
      if (last && last.key === key && last.to === index) last.to = index + 1;
      else runs.push({ key, from: index + 1, to: index + 1, depth: entry.depth, character: entry.characterId, matrix });
    }
  }
  for (const runs of Object.values(tracks)) for (const run of runs) delete run.key;

  const at = (frame) => {
    const out = {};
    for (const [name, runs] of Object.entries(tracks)) {
      const run = runs.find((candidate) => candidate.from <= frame && frame <= candidate.to);
      if (run) out[name] = { depth: run.depth, character: run.character, matrix: run.matrix };
    }
    return out;
  };
  const sortedStops = [...stops].sort((left, right) => left - right);
  const frameOf = new Map(labels.map((label) => [label.name, label.frame]));
  const byController = {};
  for (const label of controllers) {
    const frame = frameOf.get(label) ?? null;
    const restsAt = frame === null ? null : (sortedStops.find((stop) => stop >= frame) ?? null);
    byController[label] = { frame, restsAt, slots: restsAt === null ? null : at(restsAt) };
  }
  return {
    declaredFrames: frames.length,
    labels: labels.map((label) => ({ frame: label.frame, name: label.name })),
    stops: sortedStops,
    tracks,
    frameOne: at(1),
    controllers: byController
  };
}

/**
 * THE BUTTON, ITS CHILDREN, AND WHAT THE OVERLAY DOES WITH THEM — the
 * `buttons` section of the pack. See `BUTTON_OVERLAY` for why it is a section.
 *
 * `take(id, name, into)` is `extractIcons`'s own, handed a sink whose
 * `clipIds`/`clipNames` are private to this section — so the roster's nested
 * worklist never sees the button's children — and whose shapes, texts,
 * failures and approximations are the pack's, because the geometry and the
 * honesty counts belong to the one file a renderer opens.
 */
function extractButtons({ buffer, characters, names, analysis, timelineActions, actionsFor, eventsFor, take, sink, roster }) {
  const declared = BUTTON_OVERLAY;
  const section = {
    overlay: null, button: null, clips: {}, nested: {}, sharedWithRoster: [],
    layout: null, wiring: null, handlers: null, inventory: null, clipsAcrossSpriteBoundary: 0, effects: null
  };
  const overlay = characters.get(declared.character);
  const actual = names.get(declared.character);
  if (!overlay || overlay.kind !== "sprite" || actual !== declared.linkage) {
    sink.failures.push({
      character: declared.character,
      message: `expected export ${declared.linkage}, build calls character ${declared.character} ${actual ?? "nothing"}`
    });
    section.effects = tallyIconEffects({});
    return section;
  }

  const labels = readFrameLabels(buffer, overlay);
  const resolved = resolveTimeline(buffer, overlay);
  // Read off the table, never through `actionsFor`: the overlay is not DRAWN
  // from this pack, so its dozens of script blocks are not unrecognised
  // actions on anything the pack holds, and tallying them would say otherwise.
  const stops = timelineActions.get(declared.character)?.stops ?? [];
  section.overlay = {
    character: declared.character, linkage: declared.linkage,
    declaredFrames: overlay.frames, attachedBy: declared.attachedBy, placedBy: declared.placedBy
  };
  section.layout = summariseOverlayLayout(resolved, {
    instances: [...declared.slots, declared.swapSlot, declared.heroInstance],
    labels, stops, controllers: declared.controllers
  });

  const frameOne = resolved.frames[0] ?? [];
  const slotCharacters = declared.slots.map((slot) => frameOne.find((entry) => entry.name === slot)?.characterId ?? null);
  const distinct = [...new Set(slotCharacters)];
  if (distinct.length !== 1 || distinct[0] === null) {
    sink.failures.push({
      character: declared.character,
      message: `the overlay's eight option slots on frame 1 hold ${JSON.stringify(slotCharacters)}, not one character`
    });
  } else {
    const id = distinct[0];
    section.button = id;
    if (id !== declared.expectedButton) {
      sink.failures.push({ character: id, message: `the option slots hold character ${id}, expected ${declared.expectedButton}` });
    }
    const own = { ...sink, clipIds: new Set(), clipNames: new Map() };
    const taken = take(id, names.get(id) ?? `character ${id}`, own);
    if (taken) {
      section.clips[id] = {
        character: id,
        linkage: names.get(id) ?? null,
        reachedAs: `${declared.linkage}.${declared.slots[0]}..${declared.slots[declared.slots.length - 1]}`,
        indexedBy: "frame, chosen per verb and facing by the overlay's controller frames (see wiring)",
        attachedBy: `PlaceObject in ${declared.linkage} (${declared.character}) frame 1, depths ` +
          declared.slots.map((slot) => frameOne.find((entry) => entry.name === slot)?.depth).join("/"),
        reader: "the action buttons around the acting fighter",
        timeline: actionsFor(id),
        clipEvents: eventsFor(id),
        ...taken
      };
      // The button's own multi-frame children, as entries of THIS section —
      // unless the roster already holds them, in which case they are named and
      // not extracted twice.
      const pending = [...own.clipIds];
      const seen = new Set([id]);
      while (pending.length > 0) {
        const child = pending.shift();
        if (seen.has(child)) continue;
        seen.add(child);
        if (roster.has(child)) {
          section.sharedWithRoster.push(child);
          continue;
        }
        const childTaken = take(child, names.get(child) ?? `character ${child}`, own);
        if (!childTaken) continue;
        section.nested[child] = {
          character: child,
          linkage: names.get(child) ?? null,
          instances: [...(own.clipNames.get(child) ?? [])].sort(),
          meaning: NESTED_MEANINGS[child] ?? null,
          timeline: actionsFor(child),
          clipEvents: eventsFor(child),
          ...childTaken
        };
        for (const next of own.clipIds) if (!seen.has(next)) pending.push(next);
      }
    }
  }

  section.wiring = deriveOptionWiring(analysis, {
    character: declared.character, labels, controllers: declared.controllers, slots: declared.slots
  });
  section.handlers = deriveButtonHandlers(analysis, {
    character: declared.character, slots: declared.slots, swapSlot: declared.swapSlot,
    others: declared.inventory.instances
  });
  // The items-and-spells row: where its six buttons sit inside 492, frame 1.
  const inventory = characters.get(declared.inventory.character);
  if (!inventory || inventory.kind !== "sprite" || names.get(declared.inventory.character) !== declared.inventory.linkage) {
    sink.failures.push({
      character: declared.inventory.character,
      message: `expected export ${declared.inventory.linkage}, build calls character ${declared.inventory.character} ` +
        `${names.get(declared.inventory.character) ?? "nothing"}`
    });
  } else {
    section.inventory = {
      character: declared.inventory.character, linkage: declared.inventory.linkage,
      attachedBy: declared.inventory.attachedBy,
      layout: summariseOverlayLayout(resolveTimeline(buffer, inventory), { instances: declared.inventory.instances })
    };
  }
  section.clipsAcrossSpriteBoundary = [...Object.values(section.clips), ...Object.values(section.nested)]
    .reduce((total, entry) => total + entry.clipsAcrossSpriteBoundary, 0);
  return section;
}

/* ------------------------------------------------------------------ */
/* The gauges: the drive, the attach and the placements, from the bytes */
/* ------------------------------------------------------------------ */

/**
 * STRAIGHT-LINE AVM1 AS STATEMENTS — a stack evaluator for the few opcodes a
 * gauge's handler and the panel's attach are made of, turning each
 * `SetMember`, `SetVariable`, `Pop`, `If` and `Jump` into one statement whose
 * operands are expression trees:
 *
 * ```text
 *   literal  {kind, value}          var     {kind, name}
 *   member   {kind, object, name}   binary  {kind, op, left, right}
 *   not      {kind, operand}        call    {kind, object, method, args}
 *   object   {kind, props}          unknown {kind}
 * ```
 *
 * ► **IT FOLLOWS NO BRANCH.** An `If` is a statement carrying its condition
 *   and target; what each arm does is read by a caller that knows the shape it
 *   expects (`visibilityOf`). An opcode outside the list is an `unread`
 *   statement naming it, and the stack is cleared after it — never guessed
 *   across. `AVM1 Greater` pops A then B and pushes B > A, so `left` is the
 *   first operand pushed, as in the source.
 */
export function actionStatementsOf(instructions) {
  return evaluateActions(instructions).statements;
}

/**
 * The evaluator itself: the statements, and EVERY method call it evaluated —
 * collected where `CallMethod` runs, whatever then becomes of its value
 * (discarded, assigned, passed on, or lost to an opcode this does not model).
 * A caller counting calls counts these, never only the ones a statement
 * happens to hold (Codex review, pass 3).
 */
function evaluateActions(instructions) {
  const statements = [];
  const calls = [];
  let stack = [];
  const registers = new Map();
  // Where the statement being built STARTED: the first instruction after the
  // previous statement. A branch can then be checked to land on a whole
  // statement rather than inside one (Codex review, pass 4).
  let start = null;
  const emit = (statement) => {
    statements.push({ ...statement, start: start ?? statement.offset });
    start = null;
  };
  const pop = () => (stack.length > 0 ? stack.pop() : { kind: "unknown" });
  const countOf = (expression) =>
    (expression.kind === "literal" && Number.isInteger(expression.value) && expression.value >= 0 ? expression.value : 0);
  for (const instruction of Array.isArray(instructions) ? instructions : []) {
    const offset = instruction.offset;
    if (instruction.name !== "ConstantPool" && start === null) start = offset;
    switch (instruction.name) {
      case "ConstantPool":
      case "End":
        break;
      case "Push":
        for (const operand of instruction.operand ?? []) {
          if (operand?.type === "register") stack.push(registers.get(operand.value) ?? { kind: "unknown" });
          else stack.push({ kind: "literal", value: operand?.value ?? null });
        }
        break;
      case "GetVariable":
        stack.push({ kind: "var", name: literalOf(pop()) });
        break;
      case "GetMember": {
        const name = literalOf(pop());
        stack.push({ kind: "member", object: pop(), name });
        break;
      }
      case "SetMember": {
        const value = pop();
        const name = literalOf(pop());
        emit({ kind: "set", object: pop(), name, value, offset });
        break;
      }
      case "SetVariable": {
        const value = pop();
        emit({ kind: "setVariable", name: literalOf(pop()), value, offset });
        break;
      }
      case "Add2":
      case "Subtract":
      case "Multiply":
      case "Divide":
      case "Greater":
      case "Less2":
      case "Equals2": {
        const right = pop();
        stack.push({ kind: "binary", op: instruction.name, left: pop(), right });
        break;
      }
      case "Not":
        stack.push({ kind: "not", operand: pop() });
        break;
      case "CallMethod": {
        const method = literalOf(pop());
        const object = pop();
        const count = countOf(pop());
        const args = [];
        for (let index = 0; index < count; index += 1) args.push(pop());
        const call = { kind: "call", object, method, args, offset };
        calls.push(call);
        stack.push(call);
        break;
      }
      case "InitObject": {
        const count = countOf(pop());
        const props = {};
        for (let index = 0; index < count; index += 1) {
          const value = pop();
          props[literalOf(pop())] = value;
        }
        stack.push({ kind: "object", props });
        break;
      }
      case "StoreRegister":
        registers.set(instruction.operand?.register, stack.length > 0 ? stack[stack.length - 1] : { kind: "unknown" });
        break;
      case "Pop":
        emit({ kind: "expression", value: pop(), offset });
        break;
      case "If":
        emit({ kind: "if", condition: pop(), target: instruction.operand?.target ?? null, offset });
        break;
      case "Jump":
        emit({ kind: "jump", target: instruction.operand?.target ?? null, offset });
        break;
      default:
        emit({ kind: "unread", name: instruction.name, offset });
        stack = [];
    }
  }
  // `tail`: where a statement after the last one would start (the End).
  return { statements, calls, tail: start };
}

function literalOf(expression) {
  return expression?.kind === "literal" ? expression.value : null;
}

const isVariable = (expression, name) => expression?.kind === "var" && expression.name === name;
const isNumberLiteral = (expression) => expression?.kind === "literal" && typeof expression.value === "number";

/** `_root.game.<side>.<field>` as `{side, field}`, or null. */
function gameFieldOf(expression) {
  if (expression?.kind !== "member") return null;
  const side = expression.object;
  if (side?.kind !== "member") return null;
  const game = side.object;
  if (game?.kind !== "member" || game.name !== "game" || !isVariable(game.object, "_root")) return null;
  return { side: side.name, field: expression.name };
}

/** `Math.<method>(x)` as `{rounding, argument}`, or null. */
function mathCallOf(expression) {
  if (expression?.kind !== "call" || !isVariable(expression.object, "Math") || expression.args.length !== 1) return null;
  return { rounding: expression.method, argument: expression.args[0] };
}

/** `this.<variable> = <v> + "<sep>" + <max>`: the number the gauge's field is bound to. */
function gaugeTextOf(statement) {
  if (statement.kind !== "set" || !isVariable(statement.object, "this")) return null;
  const outer = statement.value;
  if (outer?.kind !== "binary" || outer.op !== "Add2" || outer.left?.kind !== "binary" || outer.left.op !== "Add2") return null;
  const value = gameFieldOf(outer.left.left);
  const separator = literalOf(outer.left.right);
  const max = gameFieldOf(outer.right);
  if (!value || !max || typeof separator !== "string" || value.side !== max.side) return null;
  return { variable: statement.name, side: value.side, value: value.field, max: max.field, separator };
}

/** `this.<variable> = Math.round(<v> / <max> * <scale>)`: the percent. */
function gaugePercentOf(statement) {
  if (statement.kind !== "set" || !isVariable(statement.object, "this")) return null;
  const call = mathCallOf(statement.value);
  const product = call?.argument;
  if (product?.kind !== "binary" || product.op !== "Multiply" || !isNumberLiteral(product.right)) return null;
  const quotient = product.left;
  if (quotient?.kind !== "binary" || quotient.op !== "Divide") return null;
  const value = gameFieldOf(quotient.left);
  const max = gameFieldOf(quotient.right);
  if (!value || !max || value.side !== max.side) return null;
  return { variable: statement.name, side: value.side, value: value.field, max: max.field, scale: product.right.value, rounding: call.rounding };
}

/** `this.<target>.<property> = Math.round(<base> + (<full> - this.<percent>) * <step>)`: the liquid. */
function gaugeLiquidOf(statement) {
  if (statement.kind !== "set" || statement.object?.kind !== "member" || !isVariable(statement.object.object, "this")) return null;
  const call = mathCallOf(statement.value);
  const sum = call?.argument;
  if (sum?.kind !== "binary" || sum.op !== "Add2" || !isNumberLiteral(sum.left)) return null;
  const product = sum.right;
  if (product?.kind !== "binary" || product.op !== "Multiply" || !isNumberLiteral(product.right)) return null;
  const difference = product.left;
  if (difference?.kind !== "binary" || difference.op !== "Subtract" || !isNumberLiteral(difference.left)) return null;
  const percent = difference.right;
  if (percent?.kind !== "member" || !isVariable(percent.object, "this")) return null;
  return {
    target: statement.object.name, property: statement.name, percent: percent.name,
    base: sum.left.value, full: difference.left.value, step: product.right.value, rounding: call.rounding
  };
}

const COMPARISONS = Object.freeze({ Greater: ">", Less2: "<", Equals2: "==" });

/**
 * `if (<game field> <cmp> <n>) this._visible = …; else this._visible = …;` —
 * both arms read, by where each `_visible` write sits relative to the `If`'s
 * target: the fall-through arm runs when the jump is NOT taken.
 *
 * ► **AND THE SKIP IS CHECKED, NOT ASSUMED** (Codex review, pass 1). The
 *   fall-through arm is only an arm if it then JUMPS past the other one; with
 *   no jump, or one that lands before the other arm's write, the false path
 *   runs on into `_visible = true` and both arms write the same thing. And
 *   exactly two writes: a third, after the join, overrides both. Anything
 *   else is a problem, never a rule.
 */
function visibilityOf(statements, relative, used = [], tail = null) {
  const writes = statements.filter((statement) => statement.kind === "set" && isVariable(statement.object, "this") &&
    statement.name === "_visible");
  if (writes.length === 0) return null;
  if (writes.length !== 2 || !writes.every((write) => typeof literalOf(write.value) === "boolean")) {
    return { problem: `${writes.length} _visible writes; this reader follows exactly one if/else of two literal ones` };
  }
  const test = statements.find((statement) => statement.kind === "if" && statement.offset < writes[0].offset);
  if (!test) return { problem: "a _visible write with no test before it" };
  let condition = test.condition;
  let negations = 0;
  while (condition?.kind === "not") { negations += 1; condition = condition.operand; }
  const field = condition?.kind === "binary" ? gameFieldOf(condition.left) : null;
  if (!field || !COMPARISONS[condition.op] || !isNumberLiteral(condition.right)) {
    return { problem: "a _visible test this reader cannot follow" };
  }
  // With an EVEN number of `Not`s the jump is taken when the comparison holds.
  const jumpsWhenTrue = negations % 2 === 0;
  // ► **THE EXACT SHAPE, OR A PROBLEM** (Codex review, pass 4): `if`, the
  //   fall-through write, a `jump`, the other write — consecutive — with the
  //   `if` landing on the FIRST instruction of the other write and the `jump`
  //   on the first instruction after it. A branch into the middle of a
  //   statement skips the pushes that feed it, and this linear reader would
  //   still hand the write operands it never gets.
  const at = statements.indexOf(test);
  const [fallThrough, skip, jumpedTo] = [statements[at + 1], statements[at + 2], statements[at + 3]];
  if (fallThrough !== writes[0] || skip?.kind !== "jump" || jumpedTo !== writes[1]) {
    return { problem: "a _visible test not shaped if / write / jump / write" };
  }
  const join = statements[at + 4]?.start ?? tail;
  if (test.target !== jumpedTo.start || skip.target !== join) {
    return { problem: "a _visible test whose branches do not land on the starts of its arms and its join" };
  }
  used.push(test, fallThrough, jumpedTo, skip);
  const whenTrue = literalOf((jumpsWhenTrue ? jumpedTo : fallThrough).value);
  const whenFalse = literalOf((jumpsWhenTrue ? fallThrough : jumpedTo).value);
  return {
    property: "_visible", side: field.side, field: field.field, comparison: COMPARISONS[condition.op], than: condition.right.value,
    whenTrue, whenFalse, at: relative(test.offset)
  };
}

/** `onClipEvent(enterFrame)`: bit 1 of a SWF 6+ clip-event mask (`load` is bit 0). */
const CLIP_EVENT_ENTER_FRAME = 0x2;

/** A statement a reader did not expect, in words a problem line can carry. */
function describeStatement(statement) {
  switch (statement.kind) {
    case "set": return `a write to ${pathOf(statement.object) ?? "<something>"}.${statement.name}`;
    case "setVariable": return `a write to the variable ${statement.name}`;
    case "expression": return statement.value?.kind === "call" ? `a call to ${statement.value.method}` : "an expression statement";
    case "if": return "a branch";
    case "jump": return "a jump";
    case "unread": return `an opcode this reader does not model (${statement.name})`;
    default: return `a ${statement.kind}`;
  }
}

/** The drive constants every gauge must agree on, and the key each is read from. */
const DRIVE_KEYS = Object.freeze([
  ["base", (gauge) => gauge.liquid.base],
  ["full", (gauge) => gauge.liquid.full],
  ["step", (gauge) => gauge.liquid.step],
  ["percentScale", (gauge) => gauge.percent.scale],
  ["rounding", (gauge) => (gauge.percent.rounding === gauge.liquid.rounding ? gauge.liquid.rounding : `${gauge.percent.rounding}/${gauge.liquid.rounding}`)],
  ["separator", (gauge) => gauge.text.separator]
]);

/**
 * EACH GAUGE'S DRIVE, READ OFF ITS OWN `onClipEvent` HANDLER in the panel's
 * frame 1 — the number its field is bound to, the percent, the liquid's `_y`
 * and, for armour, the visibility test — with the offset of every write,
 * relative to the handler's body as the dumps print it.
 *
 * `drive` is the one set of constants EVERY gauge that was read agrees on;
 * where they do not, it is null and `disagreements` names each constant and
 * what each gauge says. Nothing is corrected towards a majority.
 *
 * @param {object} analysis  `analyseSwfBuffer(buffer).analysis`
 * @param {object} options
 * @param {number} options.character  the panel (751)
 * @param {string[]} options.instances  the gauge instances to read
 */
export function deriveGaugeDrive(analysis, { character, instances }) {
  const gauges = {};
  for (const instance of instances) {
    const pattern = new RegExp(`^sprite:${character}/frame:1/instance:${instance}/clip-action:(\\d+)`);
    const blocks = (analysis?.actionBlocks ?? []).filter((block) => pattern.test(block.context));
    if (blocks.length === 0) {
      gauges[instance] = { instance, problem: `no clip-action on ${instance} in sprite ${character} frame 1` };
      continue;
    }
    const found = { instance, block: null, eventFlags: null, side: null, value: null, max: null, text: null, percent: null, liquid: null, visible: null,
      handlers: {} };
    const problems = [];
    for (const block of blocks) {
      const relative = (offset) => relativeTo(block.offset, offset);
      const { statements, tail } = evaluateActions(block.instructions);
      // EVERY STATEMENT IS ACCOUNTED FOR (Codex review, pass 3): the three
      // writes the drive is made of, and armour's if/else, and nothing else.
      // A later write to the liquid, a second write to the number, a stray
      // opcode — each is a problem naming it, because the build EXECUTES it
      // and a drive read from the first match alone would describe a gauge
      // the build does not draw.
      const used = new Set();
      for (const statement of statements) {
        const text = gaugeTextOf(statement);
        if (text && !found.text) {
          used.add(statement);
          found.handlers.text = block;
          found.block = `0x${block.offset.toString(16)}`;
          found.eventFlags = block.eventFlags ?? null;
          found.text = { variable: text.variable, separator: text.separator, at: relative(statement.offset) };
          found.side = text.side;
          found.value = text.value;
          found.max = text.max;
          continue;
        }
        const percent = gaugePercentOf(statement);
        if (percent && !found.percent) {
          used.add(statement);
          found.handlers.percent = block;
          found.percentOffset = statement.offset;
          found.percent = { variable: percent.variable, scale: percent.scale, rounding: percent.rounding, at: relative(statement.offset) };
          found.percentReads = percent;
          continue;
        }
        const liquid = gaugeLiquidOf(statement);
        if (liquid && !found.liquid) {
          used.add(statement);
          found.handlers.liquid = block;
          found.liquidOffset = statement.offset;
          found.liquidEventFlags = block.eventFlags ?? null;
          found.liquid = {
            target: liquid.target, property: liquid.property, base: liquid.base, full: liquid.full, step: liquid.step,
            rounding: liquid.rounding, at: relative(statement.offset)
          };
          found.liquidReads = liquid.percent;
        }
      }
      const visibleUsed = [];
      const visible = visibilityOf(statements, relative, visibleUsed, tail);
      if (visible) {
        found.visible = visible;
        found.handlers.visible = block;
      }
      for (const statement of visibleUsed) used.add(statement);
      for (const statement of statements) {
        if (used.has(statement)) continue;
        problems.push(`${describeStatement(statement)} at ${relative(statement.offset)} is not part of the drive`);
      }
    }
    // Every piece, or the record says which is missing — and the pieces must
    // be ONE gauge: the percent the liquid reads is the one computed, from the
    // fields the number shows, computed BEFORE the liquid reads it, every frame.
    if (!found.text) problems.push("no number (this.<field> = v + sep + max)");
    if (!found.percent) problems.push("no percent (Math.round(v / max * n))");
    if (!found.liquid) problems.push("no liquid (this.<clip>._y = Math.round(a + (b - pct) * c))");
    if (found.percent && found.liquid && found.liquidReads !== found.percent.variable) {
      problems.push(`the liquid reads ${found.liquidReads}, the percent is ${found.percent.variable}`);
    }
    if (found.text && found.percentReads && (found.percentReads.value !== found.value || found.percentReads.max !== found.max ||
      found.percentReads.side !== found.side)) {
      problems.push("the percent and the number read different fields");
    }
    if (found.visible?.problem) problems.push(found.visible.problem);
    // ONE HANDLER (Codex review, pass 4): offsets order statements in the
    // file, not across clip events — a number written on load and a liquid
    // written every frame is not the build's gauge.
    if (new Set(Object.values(found.handlers)).size > 1) {
      problems.push(`the ${Object.keys(found.handlers).join(", ")} are not all in one handler`);
    }
    if (found.visible && !found.visible.problem && found.side && found.visible.side !== found.side) {
      problems.push(`the visibility reads _root.game.${found.visible.side}.${found.visible.field}; the gauge is the ${found.side}'s`);
    }
    if (found.percent && found.liquid && !(found.percentOffset < found.liquidOffset)) {
      problems.push("the percent is written after the liquid reads it; the build computes it before");
    }
    if (found.liquid && !((found.liquidEventFlags ?? 0) & CLIP_EVENT_ENTER_FRAME)) {
      problems.push(`the liquid is driven on clip events ${found.liquidEventFlags}, not enterFrame (every frame)`);
    }
    delete found.percentReads;
    delete found.liquidReads;
    delete found.percentOffset;
    delete found.liquidOffset;
    delete found.liquidEventFlags;
    delete found.handlers;
    if (problems.length > 0) found.problem = problems.join("; ");
    gauges[instance] = found;
  }

  const read = Object.values(gauges).filter((gauge) => !gauge.problem);
  const disagreements = [];
  const drive = {};
  for (const [key, of] of DRIVE_KEYS) {
    const values = read.map((gauge) => of(gauge));
    if (new Set(values.map((value) => JSON.stringify(value))).size > 1) {
      disagreements.push(`${key}: ${read.map((gauge, index) => `${gauge.instance}=${values[index]}`).join(" ")}`);
    }
    drive[key] = values[0];
  }
  // A gauge that could not be read is its own named problem; the constants
  // are the ones every gauge that WAS read agrees on, or none.
  return { gauges, drive: read.length > 0 && disagreements.length === 0 ? drive : null, disagreements };
}

/** `_root.arena` from a var/member chain, or null. */
function pathOf(expression) {
  if (expression?.kind === "var" && typeof expression.name === "string") return expression.name;
  if (expression?.kind === "member" && typeof expression.name === "string") {
    const parent = pathOf(expression.object);
    return parent === null ? null : `${parent}.${expression.name}`;
  }
  return null;
}

/** A block's statement lists: its own, and every function body inside it, each with the function's name. */
function* statementListsOf(instructions, within = null) {
  yield { within, list: instructions };
  for (const instruction of instructions ?? []) {
    const body = instruction.operand?.body;
    if (Array.isArray(body)) yield* statementListsOf(body, instruction.operand.name || "<anonymous>");
  }
}

/**
 * WHERE THE BUILD ATTACHES A CLIP: the one `<target>.attachMovie("<linkage>",
 * <name>, <depth>, {<init>})` anywhere in the file's action blocks — their
 * own statements and every function body inside them (`within` names the
 * function, null at the top) — read off the call: the timeline that runs it,
 * the target path, the depth and the init object's literal properties. None,
 * or more than one, is a `problem` naming the count; neither is picked.
 */
export function deriveGaugeAttach(analysis, { linkage }) {
  const found = [];
  for (const block of analysis?.actionBlocks ?? []) {
    for (const { within, list } of statementListsOf(block.instructions)) {
      for (const call of evaluateActions(list).calls) {
        if (call.method !== "attachMovie" || literalOf(call.args[0]) !== linkage) continue;
        found.push({ block, call, within });
      }
    }
  }
  if (found.length !== 1) {
    return { problem: found.length === 0 ? `no attachMovie("${linkage}", …) anywhere in the build` : `${found.length} attachMovie("${linkage}", …) calls` };
  }
  const { block, call, within } = found[0];
  const where = /^sprite:(\d+)\/frame:(\d+)\//.exec(block.context);
  const init = {};
  for (const [key, value] of Object.entries(call.args[3]?.kind === "object" ? call.args[3].props : {})) init[key] = literalOf(value);
  // The origin is read off `_x`/`_y`, so they must be written as numbers: a
  // computed one, or an init object that is not a literal, is a problem —
  // never a 0 that looks measured. (An absent one is the clip's own 0.)
  if (call.args.length >= 4 && call.args[3]?.kind !== "object") {
    return { problem: `the attachMovie("${linkage}", …) init object is not a literal` };
  }
  for (const key of ["_x", "_y"]) {
    if (key in init && !(typeof init[key] === "number" && Number.isFinite(init[key]))) {
      return { problem: `the attachMovie("${linkage}", …) init ${key} is not a literal number` };
    }
  }
  const target = pathOf(call.object);
  return {
    timeline: where ? `sprite:${where[1]}/frame:${where[2]}` : block.context,
    character: where ? Number(where[1]) : null,
    frame: where ? Number(where[2]) : null,
    block: `0x${block.offset.toString(16)}`,
    within,
    at: relativeTo(block.offset, call.offset),
    target,
    parent: call.object?.kind === "member" ? call.object.name : null,
    linkage,
    name: literalOf(call.args[1]),
    depth: literalOf(call.args[2]),
    init
  };
}

/** The statements after which the next one always runs: a discarded value, a member write, a variable write. */
const STRAIGHT_LINE = new Set(["expression", "set", "setVariable"]);

/** AVM1 opcodes that end their statement list — nothing after them runs. */
const LIST_EXITS = new Set(["Return", "Throw"]);
/** AVM1 opcodes whose way on this reader does not follow: a guarded body, a frame-loaded skip. */
const UNFOLLOWED = new Set(["Try", "With", "WaitForFrame", "WaitForFrame2"]);

/**
 * Why statement `index` might NOT run whenever its list runs, or null when it
 * runs on every path from the list's first statement: a search from the start
 * that never passes through it, looking for a way out without it — the list's
 * end (`tail`), a `Return`/`Throw`, an opcode it cannot follow, or a branch
 * that lands inside a statement. Any other statement falls through to the
 * next; an `If` goes both ways and a `Jump` goes where it says; a function
 * declared on the way is declared, and its body is its own.
 */
function skippedBy(statements, index, tail) {
  const startOf = new Map(statements.map((statement, position) => [statement.start, position]));
  const seen = new Set([index]);
  const queue = [0];
  while (queue.length > 0) {
    const position = queue.shift();
    if (seen.has(position)) continue;
    seen.add(position);
    if (position >= statements.length) return "the list's end";
    const statement = statements[position];
    const where = `at +0x${statement.offset.toString(16)}`;
    if (statement.kind === "unread" && LIST_EXITS.has(statement.name)) return `${statement.name} ${where}`;
    if (statement.kind === "unread" && UNFOLLOWED.has(statement.name)) return `${statement.name} ${where}, which this reader does not follow`;
    if (statement.kind === "if" || statement.kind === "jump") {
      const landing = statement.target === tail ? statements.length : startOf.get(statement.target);
      if (landing === undefined) return `${statement.kind} ${where} to 0x${Number(statement.target).toString(16)}, inside a statement`;
      queue.push(landing);
      if (statement.kind === "if") queue.push(position + 1);
      continue;
    }
    queue.push(position + 1);
  }
  return null;
}

/**
 * THE PANEL'S PROVENANCE, READ OFF THE BYTES — the two lines the section's
 * `panel` carries, built from the derived attach (`deriveGaugeAttach`) and the
 * statements around its call, never typed:
 *
 * - `attachedBy`: where the attach statement runs (its timeline, body, and
 *   first..call offsets) and the call as the build makes it — target,
 *   linkage, name, depth and the init object's literal properties;
 * - `namesSetBy`: the two name writes that follow it in the SAME statement
 *   list — `<clip>.<variable> = _root.game.<side>.<field>` for each declared
 *   name (`GAUGE_PANEL.names`), on the clip the attach created, from that
 *   name's own side, each written exactly once — and REACHED: from the
 *   statement holding the call to the last write, nothing but straight-line
 *   statements (a `Pop`, a `SetMember`, a `SetVariable`). A `Return`, a
 *   branch or an opcode this reader cannot follow in between is a problem
 *   (Codex review, fix round pass 1: the attach's `Pop` made a `Return` left
 *   both lines unchanged and no problem, though the frame returned before
 *   either name was set).
 * - and the attach itself runs on EVERY path from the start of its list
 *   (`skippedBy`) — the build's does: sprite 2249's one earlier branch
 *   (`If` at +0x0b0c) lands at +0x0b8a, ahead of it (Codex review, fix round
 *   pass 2: a `Return` just before it was certified all the same).
 *
 * ► ~~`attachedBy` and `namesSetBy` were copied verbatim from `GAUGE_PANEL`:
 *   typed strings carrying -320, 122, 200000 and five offsets that no code
 *   read or checked.~~ A one-byte change to the attach's `_x` moved the
 *   derived attach and left the typed line saying `_x: -320`; a change to the
 *   depth moved nothing at all and recorded no problem (verifier
 *   `verify:gauges-r2`, 2026-09-24). The typed lines are now EXPECTATIONS
 *   (`GAUGE_PANEL.expectedAttachedBy`/`expectedNamesSetBy`), checked by
 *   `extractGauges` the way `expectedDrive` is.
 *
 * Returns `{ attachedBy, namesSetBy, problems }`; a line that cannot be read
 * is null and its problem says why.
 */
export function deriveGaugeProvenance(analysis, { attach, names }) {
  const problems = [];
  const block = (analysis?.actionBlocks ?? []).find((candidate) => `0x${candidate.offset.toString(16)}` === attach?.block);
  const call = block ? block.offset + Number.parseInt(String(attach.at).replace("+", ""), 16) : null;
  // The one statement list the attach call is evaluated in — the block's own, or a function body's.
  const lists = block ? [...statementListsOf(block.instructions)]
    .filter(({ list }) => evaluateActions(list).calls.some((candidate) => candidate.offset === call)) : [];
  if (lists.length !== 1) {
    return { attachedBy: null, namesSetBy: null, problems: [`the attach call ${attach?.block ?? "?"} ${attach?.at ?? "?"} is in ${lists.length} statement lists`] };
  }
  const { statements, tail } = evaluateActions(lists[0].list);
  const where = `${attach.character === null ? attach.timeline : `sprite ${attach.character} frame ${attach.frame}`} body ${attach.block}` +
    (attach.within === null ? "" : ` function ${attach.within}`);
  const holding = statements.find((statement) => statement.start <= call && call <= statement.offset);
  const span = holding && holding.start !== call ? `${relativeTo(block.offset, holding.start)}..${attach.at}` : attach.at;
  const literal = (value) => (typeof value === "string" ? JSON.stringify(value) : String(value));
  const init = Object.keys(attach.init).sort().map((key) => `${key}: ${literal(attach.init[key])}`).join(", ");
  const attachedBy = `${where} ${span}: ${attach.target}.attachMovie(${literal(attach.linkage)}, ${literal(attach.name)}, ` +
    `${literal(attach.depth)}, {${init}})`;
  // The attach itself runs whenever its list does (Codex review, fix round
  // pass 2: a Return made of the statement before it left both lines standing
  // and no problem, though the frame returned before attaching anything).
  const skipped = holding ? skippedBy(statements, statements.indexOf(holding), tail) : "no statement holds the call";
  if (skipped) problems.push(`the attach at ${attach.at} does not run on every path from the start of its list: ${skipped}`);

  // The names: written AFTER the attach, on the clip it created — by its
  // instance name, or by its full path — each exactly once.
  const clip = new Set([attach.name, `${attach.target}.${attach.name}`]);
  const writes = [];
  for (const name of names ?? []) {
    const found = statements.filter((statement) => statement.kind === "set" && statement.offset > call &&
      statement.name === name.variable && clip.has(pathOf(statement.object)));
    if (found.length !== 1) {
      problems.push(`${found.length} writes of ${attach.name}.${name.variable} after the attach, expected one`);
      continue;
    }
    const read = gameFieldOf(found[0].value);
    if (!read || read.side !== name.side) {
      problems.push(`${attach.name}.${name.variable} is written from ${pathOf(found[0].value) ?? "an expression this reader does not follow"}, ` +
        `expected _root.game.${name.side}.<field>`);
      continue;
    }
    writes.push({ ...name, at: relativeTo(block.offset, found[0].offset), object: pathOf(found[0].object), field: read.field, statement: found[0] });
  }
  if (problems.length === 0 && writes.length > 0) {
    const first = holding ? statements.indexOf(holding) : statements.findIndex((statement) => statement.offset > call);
    const last = Math.max(...writes.map((write) => statements.indexOf(write.statement)));
    const breaks = statements.slice(first, last + 1).filter((statement) => !STRAIGHT_LINE.has(statement.kind));
    if (breaks.length > 0) {
      problems.push(`the name writes are not reached in a straight line from the attach: ` +
        breaks.map((statement) => `${statement.kind === "unread" ? statement.name : statement.kind} at ${relativeTo(block.offset, statement.offset)}`).join(", "));
    }
  }
  let namesSetBy = null;
  if (problems.length === 0 && writes.length > 0) {
    const objects = new Set(writes.map((write) => write.object));
    const fields = new Set(writes.map((write) => write.field));
    if (objects.size !== 1 || fields.size !== 1) {
      problems.push(`the names are written on ${[...objects].join(", ")} from ${[...fields].join(", ")}: not one clip and one field`);
    } else {
      namesSetBy = `${where} ${writes.map((write) => write.at).join(" / ")}: ${writes[0].object}.${writes.map((write) => write.variable).join("|")} = ` +
        `_root.game.${writes.map((write) => write.side).join("|")}.${writes[0].field}`;
    }
  }
  return { attachedBy, namesSetBy, problems };
}

/**
 * THE PANEL'S OWN PLACEMENTS, NAMED — the six gauges by their instance names,
 * the two name fields by the variable their `DefineEditText` is bound to, and
 * the two banners by which side's HEALTH gauge each sits under (the banners
 * are unnamed in the build). Everything else on the frame is `notTaken`, by
 * name, so the crowd bar is said to be there rather than silently absent.
 *
 * Pure over `resolveTimeline`'s entries: `fieldOf(id)` is `{variable, align}`
 * for an edit text or null; `bannerSpanOf(entry)` is the banner's x span in
 * px. Matrices are `roundMatrix`'s (translations in TWIPS); filters are
 * carried as the entry has them, bevel and all.
 */
export function summariseGaugePanel(frameOne, { declared, fieldOf, bannerSpanOf }) {
  const placements = [];
  const notTaken = [];
  const problems = [];
  const gaugeByInstance = new Map(declared.gauges.map((gauge) => [gauge.instance, gauge]));
  const nameByVariable = new Map(declared.names.map((name) => [name.variable, name]));
  const banners = [];
  const withFilters = (entry) => (Array.isArray(entry.filters) && entry.filters.length > 0 ? { filters: entry.filters } : {});
  for (const entry of [...(frameOne ?? [])].sort((left, right) => left.depth - right.depth)) {
    const matrix = roundMatrix(entry.matrix ?? IDENTITY_MATRIX);
    const gauge = entry.name ? gaugeByInstance.get(entry.name) : undefined;
    if (gauge) {
      if (entry.characterId !== gauge.character) {
        problems.push(`${gauge.instance} is character ${entry.characterId}, expected ${gauge.character}`);
      }
      placements.push({ kind: "gauge", side: gauge.side, reading: gauge.reading, instance: gauge.instance,
        depth: entry.depth, character: entry.characterId, matrix, ...withFilters(entry) });
      continue;
    }
    if (entry.characterId === declared.banner) {
      banners.push(entry);
      placements.push({ kind: "banner", side: null, depth: entry.depth, character: entry.characterId, matrix, ...withFilters(entry) });
      continue;
    }
    const field = fieldOf(entry.characterId);
    const name = field ? nameByVariable.get(field.variable) : undefined;
    if (name) {
      placements.push({ kind: "name", side: name.side, variable: field.variable, align: field.align ?? null,
        depth: entry.depth, character: entry.characterId, matrix, ...withFilters(entry) });
      continue;
    }
    notTaken.push({ depth: entry.depth, character: entry.characterId, name: entry.name ?? null });
  }
  for (const gauge of declared.gauges) {
    const count = placements.filter((row) => row.instance === gauge.instance).length;
    if (count !== 1) problems.push(`${gauge.instance} is placed ${count} times in ${declared.linkage} frame 1, expected once`);
  }
  for (const name of declared.names) {
    const count = placements.filter((row) => row.kind === "name" && row.variable === name.variable).length;
    if (count !== 1) problems.push(`${count} fields bound to ${name.variable} in ${declared.linkage} frame 1, expected one`);
  }
  // A banner belongs to the side whose health gauge it sits under.
  const healthX = new Map(placements.filter((row) => row.kind === "gauge" && row.reading === "health")
    .map((row) => [row.side, row.matrix[4] / TWIPS_PER_PIXEL]));
  for (const entry of banners) {
    const span = bannerSpanOf(entry);
    const sides = [...healthX].filter(([, x]) => span && x >= span.xMin && x <= span.xMax).map(([side]) => side);
    const row = placements.find((candidate) => candidate.kind === "banner" && candidate.depth === entry.depth);
    if (sides.length === 1) row.side = sides[0];
    else problems.push(`the banner at depth ${entry.depth} sits under ${sides.length === 0 ? "neither side's" : "both sides'"} health gauge`);
  }
  for (const side of ["hero", "villain"]) {
    const count = placements.filter((row) => row.kind === "banner" && row.side === side).length;
    if (count !== 1) problems.push(`${count} banners for the ${side}`);
  }
  return { placements, notTaken, problems };
}

/**
 * THE FIELD A GAUGE'S NUMBER LANDS IN: the one text placement on the gauge
 * sprite's frame 1 whose `DefineEditText` is bound to the variable the
 * handler writes (`fieldOf(id)` is `{variable, align}` or null). None, or
 * more than one, is a problem — a handler writing a variable no field is
 * bound to shows no number at all.
 */
export function boundFieldOf(placements, fieldOf, variable) {
  const bound = (Array.isArray(placements) ? placements : [])
    .filter((placement) => placement?.kind === "text")
    .map((placement) => ({ character: placement.character, variable: fieldOf(placement.character)?.variable ?? null }))
    .filter((field) => field.variable === variable);
  return bound.length === 1 ? { field: bound[0] } : { problem: `${bound.length} fields bound to ${variable}` };
}

/** A sprite's frame-1 shapes' x span in px, under `matrix` (twips translations). */
function spriteSpanOf(buffer, characters, spriteId, matrix) {
  const sprite = characters.get(spriteId);
  if (!sprite || sprite.kind !== "sprite") return null;
  const list = resolveTimeline(buffer, sprite, { frames: [1] }).frames[0] ?? [];
  const xs = [];
  for (const entry of list) {
    const shape = characters.get(entry.characterId);
    if (!shape || shape.kind !== "shape") continue;
    const { bounds } = parseShape(buffer, shape.bodyStart, shape.bodyEnd, shape.tagCode);
    const m = composeMatrix(matrix, entry.matrix ?? IDENTITY_MATRIX);
    for (const x of [bounds.xMin, bounds.xMax]) for (const y of [bounds.yMin, bounds.yMax]) xs.push((m.a * x + m.c * y + m.tx) / TWIPS_PER_PIXEL);
  }
  return xs.length > 0 ? { xMin: Math.min(...xs), xMax: Math.max(...xs) } : null;
}

/**
 * EVERY WAY A CHARACTER IS PLACED ON THE ROOT TIMELINE: one row per distinct
 * (depth, name, matrix), with the first and last frame it holds.
 */
export function rootPlacementsOf(buffer, characterId) {
  const start = tagStreamStart(buffer);
  const frames = buffer.readUInt16LE(start - 2);
  const resolved = resolveTimeline(buffer, { bodyStart: start, bodyEnd: buffer.length, frames });
  const rows = new Map();
  resolved.frames.forEach((list, index) => {
    for (const entry of list ?? []) {
      if (entry.characterId !== characterId) continue;
      const matrix = roundMatrix(entry.matrix ?? IDENTITY_MATRIX);
      const key = JSON.stringify([entry.depth, entry.name ?? null, matrix]);
      if (!rows.has(key)) rows.set(key, { depth: entry.depth, name: entry.name ?? null, matrix, frames: [index + 1, index + 1] });
      rows.get(key).frames[1] = index + 1;
    }
  });
  return [...rows.values()];
}

/** The panel's placements' own filters — the banners' bevels and the names' glows — with the renderer's verdict on each. */
function placementEffectsOf(placements) {
  const lists = placements.filter((row) => Array.isArray(row.filters) && row.filters.length > 0).map((row) => row.filters);
  return {
    filters: lists.reduce((sum, list) => sum + list.length, 0),
    byType: filtersByType(lists),
    use: summariseFilterUse(lists.map((list) => canvasFilterFor(list)))
  };
}

const round3 = (value) => {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
};

/**
 * THE GAUGES SECTION — see `GAUGE_PANEL` for why it is a section. Every
 * problem is kept on the section AND pushed to the pack's `failures` with a
 * `gauges: ` prefix, so a reader of either finds it and can tell it from the
 * roster's own report of the same character.
 */
function extractGauges({ buffer, characters, names, analysis, actionsFor, eventsFor, take, sink, roster }) {
  const declared = GAUGE_PANEL;
  const section = {
    panel: null, attach: null, placements: [], notTaken: [], drive: null, disagreements: [], problems: [],
    clips: {}, nested: {}, sharedWithRoster: [], placementEffects: placementEffectsOf([]),
    clipsAcrossSpriteBoundary: 0, effects: null
  };
  const fail = (character, message) => {
    section.problems.push(message);
    sink.failures.push({ character, message: `gauges: ${message}` });
  };
  const panel = characters.get(declared.character);
  if (!panel || panel.kind !== "sprite" || names.get(declared.character) !== declared.linkage) {
    fail(declared.character, `expected export ${declared.linkage}, build calls character ${declared.character} ` +
      `${names.get(declared.character) ?? "nothing"}`);
    // Its invoice, a counted zero, is filled in by `extractIcons` like any other.
    return section;
  }
  // The provenance lines are READ below, with the attach (`deriveGaugeProvenance`); null until then.
  section.panel = { character: declared.character, linkage: declared.linkage, attachedBy: null, namesSetBy: null };

  // THE PLACEMENTS, named from the bytes.
  const frameOne = resolveTimeline(buffer, panel, { frames: [1] }).frames[0] ?? [];
  const fieldOf = (id) => {
    const character = characters.get(id);
    if (!character || character.tagCode !== TAG.DEFINE_EDIT_TEXT) return null;
    try {
      const field = parseEditText(buffer, character.bodyStart, character.bodyEnd);
      return { variable: field.variable, align: field.align };
    } catch {
      return null;
    }
  };
  const summary = summariseGaugePanel(frameOne, {
    declared, fieldOf, bannerSpanOf: (entry) => spriteSpanOf(buffer, characters, entry.characterId, entry.matrix ?? IDENTITY_MATRIX)
  });
  section.placements = summary.placements;
  section.notTaken = summary.notTaken;
  for (const problem of summary.problems) fail(declared.character, problem);

  // THE DRIVE, read off each gauge's own handler and checked against what it is expected to be.
  const derived = deriveGaugeDrive(analysis, { character: declared.character, instances: declared.gauges.map((gauge) => gauge.instance) });
  for (const row of section.placements.filter((candidate) => candidate.kind === "gauge")) {
    const drive = derived.gauges[row.instance];
    const expected = declared.gauges.find((gauge) => gauge.instance === row.instance);
    row.drive = drive;
    if (drive.problem) {
      fail(declared.character, `${row.instance}: ${drive.problem}`);
      continue;
    }
    if (drive.side !== expected.side || drive.value !== expected.value || drive.max !== expected.max) {
      fail(declared.character, `${row.instance} reads _root.game.${drive.side}.${drive.value} / ${drive.max}, ` +
        `expected _root.game.${expected.side}.${expected.value} / ${expected.max}`);
    }
    if (drive.liquid.target !== declared.liquidInstance || drive.liquid.property !== "_y") {
      fail(declared.character, `${row.instance} drives ${drive.liquid.target}.${drive.liquid.property}, expected ${declared.liquidInstance}._y`);
    }
    // Only the armour gauge hides itself, and only on `armourclass > 0`.
    const hides = expected.reading === "armour";
    const visible = drive.visible;
    if (hides !== Boolean(visible) || (visible && (visible.field !== expected.value || visible.comparison !== ">" ||
      visible.than !== 0 || visible.whenTrue !== true || visible.whenFalse !== false))) {
      fail(declared.character, `${row.instance}'s visibility is ${JSON.stringify(visible)}, expected ` +
        `${hides ? `_visible = ${expected.value} > 0` : "none"}`);
    }
  }
  section.drive = derived.drive;
  section.disagreements = derived.disagreements;
  for (const disagreement of derived.disagreements) fail(declared.character, `the gauges disagree on ${disagreement}`);
  if (derived.drive) {
    for (const [key, value] of Object.entries(declared.expectedDrive)) {
      if (derived.drive[key] !== value) fail(declared.character, `the drive's ${key} is ${derived.drive[key]}, expected ${value}`);
    }
  }

  // THE ATTACH: where the build puts the panel, and where that is on the stage.
  const attach = deriveGaugeAttach(analysis, { linkage: declared.linkage });
  if (attach.problem) {
    fail(declared.character, attach.problem);
  } else {
    const placed = rootPlacementsOf(buffer, attach.character);
    if (placed.length !== 1 || placed[0].name !== attach.parent) {
      fail(attach.character, `the attach's parent ${attach.target} is character ${attach.character}, placed on the root ` +
        `${placed.length} way(s): ${JSON.stringify(placed.map((row) => [row.depth, row.name]))}`);
    } else {
      const [a, b, c, d, tx, ty] = placed[0].matrix;
      const x = Number.isFinite(attach.init._x) ? attach.init._x : 0;
      const y = Number.isFinite(attach.init._y) ? attach.init._y : 0;
      attach.parentPlacement = placed[0];
      attach.origin = { x: round3(a * x + c * y + tx / TWIPS_PER_PIXEL), y: round3(b * x + d * y + ty / TWIPS_PER_PIXEL) };
    }
    // THE PROVENANCE: the attach and the name writes, read off the bytes and
    // checked against what they are expected to be, as the drive is.
    const provenance = deriveGaugeProvenance(analysis, { attach, names: declared.names });
    section.panel.attachedBy = provenance.attachedBy;
    section.panel.namesSetBy = provenance.namesSetBy;
    for (const problem of provenance.problems) fail(declared.character, problem);
    for (const [key, expected] of [["attachedBy", declared.expectedAttachedBy], ["namesSetBy", declared.expectedNamesSetBy]]) {
      if (provenance[key] !== null && provenance[key] !== expected) {
        fail(declared.character, `the panel's ${key} is ${JSON.stringify(provenance[key])}, expected ${JSON.stringify(expected)}`);
      }
    }
  }
  section.attach = attach;

  // THE ART: each gauge sprite with its liquid KEPT WHOLE, the banner, and the liquids.
  const own = { ...sink, clipIds: new Set(), clipNames: new Map() };
  const keepAsClip = (entry) => entry.name === declared.liquidInstance;
  const sprites = [...new Set([declared.banner, ...declared.gauges.map((gauge) => gauge.character)])].sort((left, right) => left - right);
  for (const id of sprites) {
    const taken = take(id, names.get(id) ?? `character ${id}`, own, { keepAsClip });
    if (!taken) continue;
    const instances = section.placements.filter((row) => row.character === id).map((row) => row.instance ?? `depth ${row.depth}`);
    section.clips[id] = {
      character: id,
      linkage: names.get(id) ?? null,
      reachedAs: `${declared.linkage}.${instances.join(", ")}`,
      timeline: actionsFor(id),
      clipEvents: eventsFor(id),
      ...taken
    };
    if (id !== declared.banner) {
      const liquids = (taken.frames[0] ?? []).filter((placement) => placement.kind === "clip" && placement.name === declared.liquidInstance);
      if (liquids.length !== 1) fail(id, `character ${id} holds ${liquids.length} ${declared.liquidInstance} on frame 1, expected 1`);
    }
  }
  const pending = [...own.clipIds];
  const seen = new Set(sprites);
  while (pending.length > 0) {
    const child = pending.shift();
    if (seen.has(child)) continue;
    seen.add(child);
    if (roster.has(child)) {
      section.sharedWithRoster.push(child);
      continue;
    }
    const taken = take(child, names.get(child) ?? `character ${child}`, own, { keepAsClip });
    if (!taken) continue;
    section.nested[child] = {
      character: child,
      linkage: names.get(child) ?? null,
      instances: [...(own.clipNames.get(child) ?? [])].sort(),
      timeline: actionsFor(child),
      clipEvents: eventsFor(child),
      ...taken
    };
    for (const next of own.clipIds) if (!seen.has(next)) pending.push(next);
  }
  // Each gauge's number must land in a field its own sprite binds to the variable its handler writes.
  for (const row of section.placements.filter((candidate) => candidate.kind === "gauge" && candidate.drive?.text)) {
    const bound = boundFieldOf(section.clips[row.character]?.frames?.[0], fieldOf, row.drive.text.variable);
    if (bound.problem) fail(row.character, `${row.instance}: ${bound.problem} in character ${row.character}, so its number is never shown`);
    else row.field = bound.field;
  }
  section.placementEffects = placementEffectsOf(section.placements);
  section.clipsAcrossSpriteBoundary = [...Object.values(section.clips), ...Object.values(section.nested)]
    .reduce((total, entry) => total + entry.clipsAcrossSpriteBoundary, 0);
  return section;
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

  // `into` is the sink the clip's shapes, texts and children land in — the
  // pack's own unless the buttons or gauges section hands in one with private
  // children. `options` reaches the flatten (`keepAsClip`, the gauges' only).
  const take = (id, linkage, into = sink, options = {}) => {
    const character = characters.get(id);
    if (!character) {
      into.failures.push({ character: id, message: `no character ${id} in this build (${linkage})` });
      return null;
    }
    if (character.kind !== "sprite") {
      into.failures.push({ character: id, message: `character ${id} is a ${character.kind}, not a sprite` });
      return null;
    }
    return extractClipFrames(buffer, characters, character, cache, into, options);
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

  /* --- the action buttons, reached through the overlay -------------- */
  // AFTER the roster's worklist, so nothing here can join it, and BEFORE the
  // shape and text tables are built, so the button's geometry lands in them.
  const buttons = extractButtons({
    buffer, characters, names, analysis, timelineActions, actionsFor, eventsFor, take, sink,
    roster: new Set([...Object.values(clips), ...Object.values(nested)].map((entry) => entry.character))
  });

  /* --- the gauges, their liquids whole ------------------------------ */
  // Also after the roster's worklist, and with a private child set, so
  // nothing here reaches the roster's `nested` or its invoice.
  const gauges = extractGauges({
    buffer, characters, names, analysis, actionsFor, eventsFor, take, sink,
    roster: new Set([...Object.values(clips), ...Object.values(nested)].map((entry) => entry.character))
  });

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
    clipsAcrossSpriteBoundary,
    buttons,
    gauges
  };
  // AFTER the worklist, because it needs every child's entry to exist. This
  // turns "the filters inside an undescended child are counted elsewhere" from
  // a sentence into a number a reader can check against the child's own row.
  crossReferenceChildEffects(result);
  // The buttons' own join, against their own entries AND the roster's: a child
  // the roster already holds (`sharedWithRoster`) is found there rather than
  // reported missing. Then their own invoice, which the roster's totals do not
  // include — see `BUTTON_OVERLAY`.
  const buttonEntries = iconEntries(buttons);
  crossReferenceChildEffects(result, buttonEntries, [...iconEntries(result), ...buttonEntries]);
  buttons.effects = tallyIconEffects(buttons);
  // And the gauges', the same way, against their own entries and the roster's.
  const gaugeEntries = iconEntries(gauges);
  crossReferenceChildEffects(result, gaugeEntries, [...iconEntries(result), ...gaugeEntries]);
  gauges.effects = tallyIconEffects(gauges);
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
    /**
     * THE ACTION BUTTONS, as their own block with their own invoice. None of
     * `icons`, `nested` or `effects` above counts them — see `BUTTON_OVERLAY`
     * — so a reader summing the roster gets the roster, and a reader looking
     * for the buttons finds every number here, zeroes included.
     */
    buttons: buttonsManifest(result.buttons, clipRow),
    /**
     * THE GAUGES, as their own block with their own invoice — see
     * `GAUGE_PANEL`. The attach, the drive and every placement, derived; the
     * roster's totals above do not count them.
     */
    gauges: gaugesManifest(result.gauges, clipRow),
    failures: result.failures
  };
}

/** The manifest's `buttons` block: rows, the wiring in one line per slot, and the invoice. */
function buttonsManifest(buttons, clipRow) {
  if (!buttons) return null;
  const armLine = (arm) => Object.entries(arm?.slots ?? {})
    .map(([slot, wires]) => `${slot}: ${wires.map((wire) => `${wire.verb}@${wire.frames.join("/") || "none"}`).join(" | ")}`);
  return {
    overlay: buttons.overlay,
    button: buttons.button,
    clips: Object.fromEntries(Object.entries(buttons.clips).map(([key, clip]) => [key, clipRow(clip)])),
    nested: Object.fromEntries(Object.entries(buttons.nested).map(([key, clip]) => [key, {
      ...clipRow(clip), linkage: clip.linkage, instances: clip.instances, meaning: clip.meaning
    }])),
    sharedWithRoster: buttons.sharedWithRoster,
    controllers: Object.fromEntries(Object.entries(buttons.wiring ?? {}).map(([label, record]) => [label, {
      frame: record.frame,
      restsAt: buttons.layout?.controllers?.[label]?.restsAt ?? null,
      facingSplit: record.facingSplit,
      ...(record.problem ? { problem: record.problem } : {}),
      right: armLine(record.right),
      left: armLine(record.left),
      hides: { right: record.right.hides, left: record.left.hides },
      // Named, not counted: a `gotoAndStop` on something that is not a slot is
      // a defect in the build, and the name is the finding.
      strays: [...record.common.strays, ...record.right.strays, ...record.left.strays],
      unpaired: [...record.right.unpaired, ...record.left.unpaired]
    }])),
    handlers: buttons.handlers,
    inventory: buttons.inventory,
    effects: buttons.effects,
    clipsAcrossSpriteBoundary: buttons.clipsAcrossSpriteBoundary
  };
}

/** The manifest's `gauges` block: where the panel goes, what drives it, and the invoice. */
function gaugesManifest(gauges, clipRow) {
  if (!gauges) return null;
  const rows = (table) => Object.fromEntries(Object.entries(table ?? {}).map(([key, clip]) => [key, {
    ...clipRow(clip), linkage: clip.linkage, ...(clip.instances ? { instances: clip.instances } : {})
  }]));
  return {
    panel: gauges.panel,
    attach: gauges.attach,
    placements: gauges.placements.map((row) => [row.depth, row.kind, row.side, row.character,
      row.instance ?? row.variable ?? null, (row.filters ?? []).map((filter) => filter.type).join("+") || null]),
    notTaken: gauges.notTaken,
    drive: gauges.drive,
    disagreements: gauges.disagreements,
    problems: gauges.problems,
    clips: rows(gauges.clips),
    nested: rows(gauges.nested),
    placementEffects: gauges.placementEffects,
    effects: gauges.effects,
    clipsAcrossSpriteBoundary: gauges.clipsAcrossSpriteBoundary
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

  // ► **THE BUTTONS, PRINTED APART**, because their invoice is apart. Every
  //   line a human needs to check the extraction against the hand table in
  //   `src/render/action-buttons.js` without opening the JSON.
  const buttons = result.buttons;
  if (buttons) {
    lines.push(`  action buttons (their own section; NOT in the totals above)`);
    for (const clip of [...Object.values(buttons.clips), ...Object.values(buttons.nested)]) {
      lines.push(
        `    char ${String(clip.character).padStart(4)}  ${String(clip.declaredFrames).padStart(3)} frames, ` +
        `${clip.distinctFrames} distinct${clip.instances ? `  (${clip.instances.join(", ") || "unnamed"})` : ""}`
      );
    }
    if (buttons.sharedWithRoster.length > 0) lines.push(`    children already in the roster: ${buttons.sharedWithRoster.join(", ")}`);
    for (const [label, record] of Object.entries(buttons.wiring ?? {})) {
      const rest = buttons.layout?.controllers?.[label]?.restsAt ?? "?";
      lines.push(`    ${label} (frame ${record.frame ?? "?"}, rests at ${rest})${record.problem ? `  PROBLEM: ${record.problem}` : ""}`);
      for (const side of ["right", "left"]) {
        const wires = Object.entries(record[side].slots)
          .map(([slot, list]) => `${slot.slice(-1)}=${list.map((wire) => `${wire.verb}@${wire.frames.join("/") || "-"}`).join("|")}`);
        lines.push(`      ${side.padEnd(5)} ${wires.join(" ")}`);
      }
      const strays = [...record.common.strays, ...record.right.strays, ...record.left.strays];
      if (strays.length > 0) lines.push(`      STRAY: ${strays.map((stray) => `${stray.target}${stray.frame !== undefined ? `.gotoAndStop(${stray.frame})` : ""} ${stray.at}`).join(", ")}`);
    }
    const hover = (buttons.handlers?.handlers ?? []).map((handler) =>
      `${handler.event}[${handler.slots.length} slots]${handler.battlebutton === null ? "" : `->battlebutton ${handler.battlebutton}`}${handler.verb ? ` verb ${handler.verb}` : ""}`);
    lines.push(`    handlers: ${hover.join(", ") || "none found"}`);
    lines.push(`    swap slot frames: ${(buttons.handlers?.swap.gotos ?? []).map((goto) => `${goto.frame} ${goto.at}`).join(", ") || "none"}`);
    lines.push(
      `    effects: ${buttons.effects.ownFilters} own filters, ${buttons.effects.inheritedFilters} on groups, ` +
      `${buttons.effects.undescendedClipPlacements} undescended clip placements, ` +
      `${buttons.clipsAcrossSpriteBoundary} clips across a sprite boundary`
    );
  }

  // ► **THE GAUGES, PRINTED APART**, with the attach and the drive the
  //   renderer's hand-cited copy is checked against.
  const gauges = result.gauges;
  if (gauges) {
    lines.push("  gauges (their own section; NOT in the totals above)");
    const origin = gauges.attach?.origin;
    lines.push(`    attach: ${gauges.attach?.problem ?? `${gauges.attach.target}.attachMovie("${gauges.attach.linkage}", depth ${gauges.attach.depth}) ` +
      `${gauges.attach.timeline} ${gauges.attach.at}; panel (0,0) on stage ${origin ? `(${origin.x}, ${origin.y})` : "UNKNOWN"}`}`);
    lines.push(`    drive: ${gauges.drive ? `_y = ${gauges.drive.rounding}(${gauges.drive.base} + (${gauges.drive.full} - pct) * ${gauges.drive.step}), ` +
      `pct = ${gauges.drive.rounding}(v / max * ${gauges.drive.percentScale}), number v + "${gauges.drive.separator}" + max` : "NOT AGREED"}`);
    for (const row of gauges.placements) {
      lines.push(`    d${String(row.depth).padEnd(3)} ${row.kind.padEnd(6)} ${String(row.side).padEnd(7)} char ${row.character}` +
        `${row.instance ? ` ${row.instance}` : ""}${row.variable ? ` ${row.variable}` : ""}` +
        `${row.drive?.visible ? ` (shown while ${row.drive.visible.field} ${row.drive.visible.comparison} ${row.drive.visible.than})` : ""}`);
    }
    lines.push(`    effects: ${gauges.effects.ownFilters} own filters in the entries; on the panel's placements ` +
      `${gauges.placementEffects.filters} (${tally(gauges.placementEffects.byType)}), ` +
      `${gauges.placementEffects.use.refused} refused (${tally(gauges.placementEffects.use.refusedByReason)})`);
    for (const problem of gauges.problems) lines.push(`    PROBLEM: ${problem}`);
  }

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
    texts: result.texts,
    buttons: result.buttons,
    gauges: result.gauges
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
