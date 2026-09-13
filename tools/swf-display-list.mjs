/**
 * SWF timelines -> WHICH shape is drawn WHERE. Structure only; no art here.
 *
 * `tools/swf-shapes.mjs` turns a `DefineShape` body into path data. It answers
 * "what does character 675 look like" and cannot answer "where is character 675
 * on frame 50", because that lives in a different place entirely: the
 * `PlaceObject` tags of whichever timeline placed it. This module is that half.
 *
 * Like the shape parser it takes BYTES and returns DATA — it opens no file,
 * writes none, and knows nothing about an install — so the whole of it runs
 * under `node --test` with no licensed build anywhere near it.
 *
 * ## What the shipped build actually looks like, measured before this was built
 *
 * Export 1241 (`hero_battle`) is the fighter clip: **2,222 frames, 101
 * `FrameLabel` tags, and 22,783 `PlaceObject2` tags of which 22,683 are
 * MOVE-ONLY.** So the gladiator is not redrawn per frame and is not a sprite
 * sheet. It is a RIG: a hundred placements set up a handful of named limbs
 * once, and every frame after that is new matrices on the same depths.
 *
 * ```text
 *   depth  name              resolves to
 *    9/11  L/Rupperleg       677 -> 676 -> shape 675
 *   13/15  R/Llowerleg       680 -> 679 -> shape 678
 *   17/19  L/Rfoot           682 -------> shape 681
 *   21/37  R/Lupperarm       685 -> 684 -> shape 683
 *      23  torso             688 -> 687 -> shape 686
 *      25  head              697 -> 690/692/694/696 -> shapes 689,691,693,695
 *   33/41  R/Llowerarm       700 -> 699 -> shape 698
 *      39  weapon            703 -> 702 -> shape 701
 *      35  shield            704 ------->  (empty: attached at runtime)
 * ```
 *
 * **The whole body is ELEVEN shapes and thirteen matrices a frame.** That is
 * why this module scopes by DEPTH rather than by frame: once the rig's depths
 * are named, all 2,222 frames are cheap, and picking "a few labelled frames
 * that matter" — the obvious plan — would have thrown away the animation for
 * no saving at all.
 *
 * ## THE TRAP, and it is not on the rig
 *
 * The transitive closure from 1241 is **148 characters: 44 sprites, 70 shapes
 * and 34 MORPH SHAPES** (`DefineMorphShape`/`DefineMorphShape2`, tags 46/84).
 * `tools/swf-shapes.mjs` cannot read a morph — it is a different record with
 * two shapes and an interpolation ratio — so a flattener that treated every
 * placed character as a shape would silently lose 34 of them.
 *
 * Measured: **every morph sits on an EFFECT depth (1, 2, 43, 45, 47) — blood,
 * the charge guard, potions, the heart — and not one is on the rig.** The
 * closure of the rig alone is 30 characters, 19 sprites and 11 shapes, zero
 * morphs. So the body is unaffected, and this module REPORTS an unsupported
 * character by kind rather than dropping it, the same way the shape parser
 * reports a gradient it approximated.
 *
 * ## Nested sprites hold at frame 1, and that is measured rather than assumed
 *
 * A sprite placed on a timeline has its own playhead, which in a real player
 * advances with the parent's. Every sprite in the rig has exactly ONE frame
 * except `weapon` (703, 13 frames) — and 703's own frame-1 `DoAction` body is
 * `07 00`, which is `stop()`. So frame 1 is where the build itself leaves them.
 *
 * 703's later frames are labelled `flame` (2), `frost` (5), `poison` (8) and
 * `wraith` (11): the weapon's ENCHANTMENT, chosen by ActionScript this module
 * does not run. `spriteFrames` is the caller's way to say which — an explicit
 * choice at the call site beats a playhead simulation that would be wrong for
 * every clip the build has stopped.
 */

export class DisplayListError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/** Tag codes this module acts on. Everything else is walked past. */
export const TAG = Object.freeze({
  END: 0,
  SHOW_FRAME: 1,
  DEFINE_SHAPE: 2,
  PLACE_OBJECT: 4,
  REMOVE_OBJECT: 5,
  DEFINE_BITS: 6,
  DEFINE_BUTTON: 7,
  DEFINE_TEXT: 11,
  DO_ACTION: 12,
  DEFINE_BITS_LOSSLESS: 20,
  DEFINE_BITS_JPEG2: 21,
  DEFINE_SHAPE2: 22,
  PLACE_OBJECT2: 26,
  REMOVE_OBJECT2: 28,
  DEFINE_SHAPE3: 32,
  DEFINE_TEXT2: 33,
  DEFINE_BUTTON2: 34,
  DEFINE_BITS_JPEG3: 35,
  DEFINE_BITS_LOSSLESS2: 36,
  DEFINE_EDIT_TEXT: 37,
  DEFINE_SPRITE: 39,
  FRAME_LABEL: 43,
  DEFINE_MORPH_SHAPE: 46,
  EXPORT_ASSETS: 56,
  PLACE_OBJECT3: 70,
  DEFINE_SHAPE4: 83,
  DEFINE_MORPH_SHAPE2: 84,
  DEFINE_BITS_JPEG4: 90
});

const SHAPE_TAGS = new Set([TAG.DEFINE_SHAPE, TAG.DEFINE_SHAPE2, TAG.DEFINE_SHAPE3, TAG.DEFINE_SHAPE4]);
const MORPH_TAGS = new Set([TAG.DEFINE_MORPH_SHAPE, TAG.DEFINE_MORPH_SHAPE2]);
const BITMAP_TAGS = new Set([
  TAG.DEFINE_BITS, TAG.DEFINE_BITS_JPEG2, TAG.DEFINE_BITS_JPEG3, TAG.DEFINE_BITS_JPEG4,
  TAG.DEFINE_BITS_LOSSLESS, TAG.DEFINE_BITS_LOSSLESS2
]);
const BUTTON_TAGS = new Set([TAG.DEFINE_BUTTON, TAG.DEFINE_BUTTON2]);
const TEXT_TAGS = new Set([TAG.DEFINE_TEXT, TAG.DEFINE_TEXT2, TAG.DEFINE_EDIT_TEXT]);

/**
 * Where the tag stream begins: signature, version, file length, the frame RECT
 * (whose width is a variable BIT field, so it cannot be skipped by a constant),
 * then frame rate and frame count.
 *
 * ► **Exported because both existing asset tools reimplement this in ~20 lines
 *   each**, and a header walked three slightly different ways is three chances
 *   to be subtly wrong about where every subsequent byte lives.
 */
export function tagStreamStart(buffer) {
  const signature = buffer.toString("latin1", 0, 3);
  if (signature === "CWS" || signature === "ZWS") {
    throw new DisplayListError(
      `This SWF is compressed (${signature}). Only an uncompressed FWS is supported; ` +
      "the shipped Swords & Sandals II build is FWS."
    );
  }
  if (signature !== "FWS") throw new DisplayListError("Not a SWF: expected an FWS/CWS/ZWS signature.");
  let cursor = 8;
  const nbits = buffer[cursor] >>> 3;
  cursor += Math.ceil((5 + nbits * 4) / 8);
  return cursor + 4;
}

/**
 * Every tag between `start` and `end`, as `{code, bodyStart, bodyEnd}`.
 *
 * A tag is a 16-bit header carrying a 10-bit code and a 6-bit length, with
 * `0x3f` meaning "the real length is the next 32 bits". Stops at `End` (0) or
 * at `end`, whichever comes first.
 */
export function* walkTags(buffer, start, end) {
  let cursor = start;
  while (cursor + 2 <= end) {
    const header = buffer.readUInt16LE(cursor);
    cursor += 2;
    const code = header >>> 6;
    let length = header & 0x3f;
    if (length === 0x3f) {
      if (cursor + 4 > end) return;
      length = buffer.readUInt32LE(cursor);
      cursor += 4;
    }
    if (code === TAG.END) return;
    const bodyStart = cursor;
    const bodyEnd = Math.min(bodyStart + length, end);
    yield { code, bodyStart, bodyEnd };
    cursor = bodyEnd;
  }
}

function readCString(buffer, start, end) {
  let cursor = start;
  while (cursor < end && buffer[cursor] !== 0) cursor += 1;
  return { value: buffer.toString("utf8", start, cursor), next: cursor + 1 };
}

/**
 * Every defined character in the file, by id, with the kind that decides how
 * the flattener may treat it.
 *
 * Sprites are recursed into, because the build nests almost everything — the
 * fighter's own limbs are defined inside other sprites, not at the top level.
 * `ExportAssets` names come through too, which is what makes `1241` legible as
 * `hero_battle` at a call site.
 */
export function indexCharacters(buffer, { maxDepth = 8 } = {}) {
  const characters = new Map();
  const names = new Map();

  const walk = (start, end, depth) => {
    for (const { code, bodyStart, bodyEnd } of walkTags(buffer, start, end)) {
      if (code === TAG.DEFINE_SPRITE) {
        const id = buffer.readUInt16LE(bodyStart);
        characters.set(id, {
          id,
          kind: "sprite",
          tagCode: code,
          frames: buffer.readUInt16LE(bodyStart + 2),
          bodyStart: bodyStart + 4,
          bodyEnd
        });
        if (depth < maxDepth) walk(bodyStart + 4, bodyEnd, depth + 1);
      } else if (code === TAG.EXPORT_ASSETS) {
        let cursor = bodyStart;
        const count = buffer.readUInt16LE(cursor);
        cursor += 2;
        for (let index = 0; index < count && cursor < bodyEnd; index += 1) {
          const id = buffer.readUInt16LE(cursor);
          cursor += 2;
          const read = readCString(buffer, cursor, bodyEnd);
          cursor = read.next;
          if (read.value) names.set(id, read.value);
        }
      } else {
        let kind = null;
        if (SHAPE_TAGS.has(code)) kind = "shape";
        else if (MORPH_TAGS.has(code)) kind = "morph";
        else if (BITMAP_TAGS.has(code)) kind = "bitmap";
        else if (BUTTON_TAGS.has(code)) kind = "button";
        else if (TEXT_TAGS.has(code)) kind = "text";
        if (kind && bodyEnd - bodyStart >= 2) {
          const id = buffer.readUInt16LE(bodyStart);
          characters.set(id, { id, kind, tagCode: code, bodyStart, bodyEnd });
        }
      }
    }
  };

  walk(tagStreamStart(buffer), buffer.length, 0);
  for (const [id, name] of names) {
    const character = characters.get(id);
    if (character) character.exportName = name;
  }
  return { characters, names };
}

/** A bit cursor. Matrices and colour transforms are not byte-aligned. */
class BitReader {
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

  readUB(bits) {
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

  readSB(bits) {
    if (bits === 0) return 0;
    const raw = this.readUB(bits);
    const sign = 1 << (bits - 1);
    return (raw & sign) ? raw - (1 << bits) : raw;
  }
}

/** The identity transform, as a frozen value so a caller cannot mutate a shared one. */
export const IDENTITY_MATRIX = Object.freeze({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });

/**
 * A SWF MATRIX, as `{a, b, c, d, tx, ty}`.
 *
 * Scale and rotate/skew are 16.16 fixed point and are converted here; the
 * translation stays in TWIPS, which is what every other coordinate in a
 * `PlaceObject` is. The shape parser converts to pixels on the way out and this
 * one does not, deliberately: composing two matrices is exact in twips and
 * accumulates error in pixels.
 *
 * ► **The `b`/`c` order is the specification's and it reads backwards.** The
 *   field order on the wire is RotateSkew0 then RotateSkew1, which are `b` then
 *   `c` in the matrix
 *
 *   ```text
 *     | a  c  tx |
 *     | b  d  ty |
 *   ```
 *
 *   so a reader that fills them left-to-right as they appear in the picture
 *   transposes every rotation in the file — and a transposed rotation still
 *   looks like a plausible pose, which is why this note is here.
 */
export function readMatrix(buffer, offset) {
  const reader = new BitReader(buffer, offset);
  let a = 1;
  let d = 1;
  let b = 0;
  let c = 0;
  if (reader.readUB(1)) {
    const bits = reader.readUB(5);
    a = reader.readSB(bits) / 65536;
    d = reader.readSB(bits) / 65536;
  }
  if (reader.readUB(1)) {
    const bits = reader.readUB(5);
    b = reader.readSB(bits) / 65536;
    c = reader.readSB(bits) / 65536;
  }
  const translateBits = reader.readUB(5);
  const tx = reader.readSB(translateBits);
  const ty = reader.readSB(translateBits);
  reader.align();
  return { matrix: { a, b, c, d, tx, ty }, next: reader.byte };
}

/**
 * `parent` applied AFTER `child` — the order a nested sprite needs, where the
 * child's own placement is relative to the parent's coordinate space.
 */
export function composeMatrix(parent, child) {
  return {
    a: parent.a * child.a + parent.c * child.b,
    b: parent.b * child.a + parent.d * child.b,
    c: parent.a * child.c + parent.c * child.d,
    d: parent.b * child.c + parent.d * child.d,
    tx: parent.a * child.tx + parent.c * child.ty + parent.tx,
    ty: parent.b * child.tx + parent.d * child.ty + parent.ty
  };
}

/** `{x, y}` in twips through a matrix. Exported because bounds need it. */
export function applyMatrix(matrix, x, y) {
  return {
    x: matrix.a * x + matrix.c * y + matrix.tx,
    y: matrix.b * x + matrix.d * y + matrix.ty
  };
}

export const IDENTITY_COLOUR_TRANSFORM = Object.freeze({
  redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 1,
  redOffset: 0, greenOffset: 0, blueOffset: 0, alphaOffset: 0
});

/**
 * A CXFORM or CXFORMWITHALPHA.
 *
 * The multiply terms are 8.8 fixed point and are divided here; the offsets are
 * plain signed integers in 0..255 colour space. **The add flag is read FIRST
 * and the multiply terms are stored FIRST** — the specification orders the two
 * flag bits opposite to the two blocks that follow them, which is the single
 * easiest thing to get wrong in this record.
 */
export function readColourTransform(buffer, offset, withAlpha) {
  const reader = new BitReader(buffer, offset);
  const hasAdd = reader.readUB(1) === 1;
  const hasMultiply = reader.readUB(1) === 1;
  const bits = reader.readUB(4);
  const transform = { ...IDENTITY_COLOUR_TRANSFORM };
  if (hasMultiply) {
    transform.redMultiplier = reader.readSB(bits) / 256;
    transform.greenMultiplier = reader.readSB(bits) / 256;
    transform.blueMultiplier = reader.readSB(bits) / 256;
    if (withAlpha) transform.alphaMultiplier = reader.readSB(bits) / 256;
  }
  if (hasAdd) {
    transform.redOffset = reader.readSB(bits);
    transform.greenOffset = reader.readSB(bits);
    transform.blueOffset = reader.readSB(bits);
    if (withAlpha) transform.alphaOffset = reader.readSB(bits);
  }
  reader.align();
  return { colourTransform: transform, next: reader.byte };
}

/** `parent` applied AFTER `child`, matching `composeMatrix`. */
export function composeColourTransform(parent, child) {
  const channel = (name) => ({
    multiplier: parent[`${name}Multiplier`] * child[`${name}Multiplier`],
    offset: parent[`${name}Multiplier`] * child[`${name}Offset`] + parent[`${name}Offset`]
  });
  const red = channel("red");
  const green = channel("green");
  const blue = channel("blue");
  const alpha = channel("alpha");
  return {
    redMultiplier: red.multiplier, greenMultiplier: green.multiplier,
    blueMultiplier: blue.multiplier, alphaMultiplier: alpha.multiplier,
    redOffset: red.offset, greenOffset: green.offset,
    blueOffset: blue.offset, alphaOffset: alpha.offset
  };
}

/**
 * Fixed byte sizes of the SWF's eight filters, by `FilterID`.
 *
 * `null` means the size depends on a count inside the filter itself, and those
 * are measured rather than tabulated below.
 */
const FILTER_SIZES = Object.freeze({
  0: 23,   // DropShadow: RGBA, blurX/Y, angle, distance, strength, flags
  1: 9,    // Blur: blurX/Y, passes
  2: 15,   // Glow: RGBA, blurX/Y, strength, flags
  3: 27,   // Bevel: two RGBA, blurX/Y, angle, distance, strength, flags
  4: null, // GradientGlow: NumColors, then 5 bytes each, then 23
  5: null, // Convolution: MatrixX * MatrixY floats
  6: 80,   // ColorMatrix: twenty 32-bit floats
  7: null  // GradientBevel: shaped like GradientGlow
});

/**
 * Step a cursor past a FILTERLIST.
 *
 * ► **This exists because FILTERLIST sits BETWEEN `ClipDepth` and `BlendMode`,
 *   and the first version of this parser read the blend mode straight out of
 *   the filter list's count byte.** Measured on the shipped build: **1,507 of
 *   its 1,522 `PlaceObject3` tags carry a filter list, and 3 carry a filter
 *   list AND a blend mode** — so the bug was live, in three places, in a field
 *   nothing downstream reads yet. A parser that skips a variable-length record
 *   by guessing is a parser that will be wrong later, somewhere else.
 *
 * Filters are not interpreted: this module does not render, and a drop shadow
 * it cannot apply is not something to pretend about. It reports that filters
 * are present and steps over them exactly.
 */
export function skipFilterList(buffer, offset, end) {
  if (offset >= end) throw new DisplayListError("PlaceObject3 filter list ran past the end of its tag.");
  const count = buffer[offset];
  let cursor = offset + 1;
  for (let index = 0; index < count; index += 1) {
    if (cursor >= end) throw new DisplayListError("PlaceObject3 filter list ran past the end of its tag.");
    const id = buffer[cursor];
    cursor += 1;
    const fixed = FILTER_SIZES[id];
    if (fixed === undefined) throw new DisplayListError(`Unknown SWF filter id ${id}.`);
    if (fixed !== null) {
      cursor += fixed;
      continue;
    }
    if (id === 5) {
      // Convolution: an x-by-y matrix of 32-bit floats between the header and
      // the trailing colour, so its length is not knowable from the id alone.
      const matrixX = buffer[cursor];
      const matrixY = buffer[cursor + 1];
      cursor += 2 + 4 + 4 + matrixX * matrixY * 4 + 4 + 1;
    } else {
      // GradientGlow (4) and GradientBevel (7): NumColors, then an RGBA and a
      // ratio byte for each, then the same trailing block a Glow has.
      const colours = buffer[cursor];
      cursor += 1 + colours * 5 + 23;
    }
  }
  if (cursor > end) throw new DisplayListError("PlaceObject3 filter list ran past the end of its tag.");
  return cursor;
}

/**
 * A `PlaceObject` (4), `PlaceObject2` (26) or `PlaceObject3` (70).
 *
 * ► **Tag 4 is not tag 26 with fewer flags.** `PlaceObject` has NO flag byte at
 *   all: character id and depth are mandatory, the matrix is mandatory, and a
 *   colour transform is present if and only if bytes remain in the tag. Reading
 *   its first byte as flags — the reflex, because 26 is everywhere and 4 is
 *   rare — desynchronises the whole tag.
 *
 * `PlaceObject3`'s second flag byte carries a class name, filters, a blend mode
 * and a bitmap cache. The name is read (it changes where every later field
 * starts), filters and blend are RECORDED as present and not interpreted, which
 * is the honest report: this module does not render, so a blend mode it cannot
 * apply is a fact for the caller rather than something to silently drop.
 */
export function parsePlaceObject(buffer, bodyStart, bodyEnd, tagCode) {
  if (tagCode === TAG.PLACE_OBJECT) {
    if (bodyEnd - bodyStart < 4) throw new DisplayListError("PlaceObject body is too short for id and depth.");
    const characterId = buffer.readUInt16LE(bodyStart);
    const depth = buffer.readUInt16LE(bodyStart + 2);
    const read = readMatrix(buffer, bodyStart + 4);
    const placement = { depth, characterId, matrix: read.matrix, move: false, replace: false };
    if (read.next < bodyEnd) {
      placement.colourTransform = readColourTransform(buffer, read.next, false).colourTransform;
    }
    return placement;
  }

  const isPlace3 = tagCode === TAG.PLACE_OBJECT3;
  if (!isPlace3 && tagCode !== TAG.PLACE_OBJECT2) {
    throw new DisplayListError(`Tag ${tagCode} is not a PlaceObject.`);
  }

  let cursor = bodyStart;
  const flags = buffer[cursor];
  cursor += 1;
  const flags2 = isPlace3 ? buffer[cursor++] : 0;
  const depth = buffer.readUInt16LE(cursor);
  cursor += 2;

  const move = (flags & 0x01) !== 0;
  const hasCharacter = (flags & 0x02) !== 0;
  const placement = { depth, move, replace: move && hasCharacter };

  // ► **ClassName is present on `HasClassName` OR on `HasImage AND
  //   HasCharacter`**, which the specification states and which is easy to read
  //   as one condition. Getting it wrong does not fail — it reads the first two
  //   bytes of a class name AS the character id and misaligns every later field,
  //   which surfaces as a wrong-looking figure rather than as an error. The
  //   shipped build sets `HasImage` on none of its 1,522 `PlaceObject3` tags, so
  //   this arm is format correctness rather than a fix to this extraction.
  if (isPlace3 && ((flags2 & 0x08) !== 0 || ((flags2 & 0x10) !== 0 && hasCharacter))) {
    const read = readCString(buffer, cursor, bodyEnd);
    placement.className = read.value;
    cursor = read.next;
  }
  if (hasCharacter) {
    placement.characterId = buffer.readUInt16LE(cursor);
    cursor += 2;
  }
  if ((flags & 0x04) !== 0) {
    const read = readMatrix(buffer, cursor);
    placement.matrix = read.matrix;
    cursor = read.next;
  }
  if ((flags & 0x08) !== 0) {
    const read = readColourTransform(buffer, cursor, true);
    placement.colourTransform = read.colourTransform;
    cursor = read.next;
  }
  if ((flags & 0x10) !== 0) {
    placement.ratio = buffer.readUInt16LE(cursor);
    cursor += 2;
  }
  if ((flags & 0x20) !== 0) {
    const read = readCString(buffer, cursor, bodyEnd);
    placement.name = read.value;
    cursor = read.next;
  }
  if ((flags & 0x40) !== 0) {
    placement.clipDepth = buffer.readUInt16LE(cursor);
    cursor += 2;
  }
  if (isPlace3) {
    // The order here is the wire's and it is not the flag order: FILTERLIST,
    // then BlendMode, then BitmapCache, then Visible, then BackgroundColor.
    if ((flags2 & 0x01) !== 0) {
      placement.hasFilters = true;
      cursor = skipFilterList(buffer, cursor, bodyEnd);
    }
    if ((flags2 & 0x02) !== 0) {
      placement.blendMode = buffer[cursor];
      cursor += 1;
    }
    if ((flags2 & 0x04) !== 0) {
      placement.bitmapCache = buffer[cursor] !== 0;
      cursor += 1;
    }
    if ((flags2 & 0x20) !== 0) {
      placement.visible = buffer[cursor] !== 0;
      cursor += 1;
    }
    if ((flags2 & 0x40) !== 0) {
      placement.backgroundColour = {
        red: buffer[cursor], green: buffer[cursor + 1],
        blue: buffer[cursor + 2], alpha: buffer[cursor + 3]
      };
      cursor += 4;
    }
  }
  if ((flags & 0x80) !== 0) placement.hasClipActions = true;
  return placement;
}

/**
 * A timeline's `FrameLabel` tags, as `{frame, name}` in frame order.
 *
 * Frames are ONE-BASED, matching every label the build's own ActionScript
 * passes to `gotoAndPlay`.
 */
export function readFrameLabels(buffer, sprite) {
  const labels = [];
  let frame = 1;
  for (const { code, bodyStart, bodyEnd } of walkTags(buffer, sprite.bodyStart, sprite.bodyEnd)) {
    if (code === TAG.SHOW_FRAME) frame += 1;
    else if (code === TAG.FRAME_LABEL) {
      const read = readCString(buffer, bodyStart, bodyEnd);
      if (read.value) labels.push({ frame, name: read.value });
    }
  }
  return labels;
}

/**
 * The ANIMATIONS a labelled timeline holds: each label, and the frames it owns.
 *
 * A label owns from its own frame up to the frame before the next label, and
 * the last one owns the rest of the clip. That is the build's own convention —
 * its ActionScript does `gotoAndPlay("StepForward")` and lets the playhead run
 * — and it is what makes 101 labels into 101 animations rather than 101
 * instants.
 */
export function deriveAnimations(buffer, sprite) {
  const labels = readFrameLabels(buffer, sprite);
  const total = sprite.frames;
  return labels.map((label, index) => {
    const next = labels[index + 1];
    const lastFrame = next ? next.frame - 1 : total;
    return {
      name: label.name,
      firstFrame: label.frame,
      lastFrame: Math.max(label.frame, lastFrame),
      frameCount: Math.max(1, lastFrame - label.frame + 1)
    };
  });
}

/**
 * Play a timeline and snapshot its display list.
 *
 * Returns `{frames, labels}` where `frames[i]` is the display list AT frame
 * `i + 1`: an array of placements sorted by depth, which is paint order.
 *
 * `wanted` limits which frames are materialised — the tags are still walked in
 * full, because a display list at frame 900 is the accumulation of every place
 * and remove before it and cannot be reached by starting there. What it saves
 * is the snapshot, which for the fighter clip is 2,222 arrays.
 *
 * ► **A `PlaceObject2` with the move flag and a character id REPLACES the
 *   character but KEEPS the instance**, so a matrix the tag omits is the one
 *   the old occupant had — not identity.
 *
 *   **The first version of this module had that backwards, and its own test
 *   asserted the backwards version, so the two agreed and the suite was
 *   green.** That is this project's standing failure arriving in a new place:
 *   two things that share an error confirm each other. Codex's adversarial
 *   review raised it; the primary sources settle it. Ruffle's `movie_clip.rs`
 *   does `prev_child.replace_with(context, id)` and THEN
 *   `prev_child.apply_place_object(context, &params.place_object)`, and
 *   `apply_place_object` sets only the fields the tag carries — so an omitted
 *   matrix survives the swap. **Measured on the shipped build: 144 of its 201
 *   replaces carry no matrix**, so this was never hypothetical.
 *
 *   A replace against an EMPTY depth has nothing to inherit and is a fresh
 *   placement, which is what Ruffle does with `(Replace(id), None, _)`.
 */
export function resolveTimeline(buffer, sprite, { frames: wanted = null } = {}) {
  if (!sprite || typeof sprite.bodyStart !== "number") {
    throw new DisplayListError("resolveTimeline needs a sprite from indexCharacters().");
  }
  const want = wanted === null ? null : new Set(wanted);
  const active = new Map();
  const frames = [];
  const labels = [];
  let frame = 1;

  const snapshot = () => {
    if (want !== null && !want.has(frame)) {
      frames.push(null);
      return;
    }
    frames.push([...active.values()].sort((left, right) => left.depth - right.depth));
  };

  for (const { code, bodyStart, bodyEnd } of walkTags(buffer, sprite.bodyStart, sprite.bodyEnd)) {
    if (code === TAG.SHOW_FRAME) {
      snapshot();
      frame += 1;
      continue;
    }
    if (code === TAG.FRAME_LABEL) {
      const read = readCString(buffer, bodyStart, bodyEnd);
      if (read.value) labels.push({ frame, name: read.value });
      continue;
    }
    if (code === TAG.PLACE_OBJECT || code === TAG.PLACE_OBJECT2 || code === TAG.PLACE_OBJECT3) {
      const placement = parsePlaceObject(buffer, bodyStart, bodyEnd, code);
      const existing = active.get(placement.depth);

      // A plain place — or any place against an empty depth — is a NEW
      // instance, and anything the tag omits takes its default. A move against
      // an empty depth is a no-op rather than an error: the build emits those
      // against depths a preceding `gotoAndPlay` would have populated.
      if (!placement.move || !existing) {
        if (placement.characterId === undefined) continue;
        active.set(placement.depth, {
          depth: placement.depth,
          characterId: placement.characterId,
          matrix: placement.matrix ?? IDENTITY_MATRIX,
          colourTransform: placement.colourTransform ?? IDENTITY_COLOUR_TRANSFORM,
          ratio: placement.ratio,
          name: placement.name,
          clipDepth: placement.clipDepth,
          className: placement.className,
          blendMode: placement.blendMode,
          hasFilters: placement.hasFilters
        });
        continue;
      }

      // A MOVE or a REPLACE against a live instance. Both start from what is
      // already at the depth and apply only the fields the tag carries; a
      // replace additionally swaps the character.
      const updated = { ...existing };
      if (placement.characterId !== undefined) updated.characterId = placement.characterId;
      if (placement.matrix !== undefined) updated.matrix = placement.matrix;
      if (placement.colourTransform !== undefined) updated.colourTransform = placement.colourTransform;
      if (placement.ratio !== undefined) updated.ratio = placement.ratio;
      if (placement.name !== undefined) updated.name = placement.name;
      if (placement.clipDepth !== undefined) updated.clipDepth = placement.clipDepth;
      if (placement.className !== undefined) updated.className = placement.className;
      if (placement.blendMode !== undefined) updated.blendMode = placement.blendMode;
      if (placement.hasFilters !== undefined) updated.hasFilters = placement.hasFilters;
      active.set(placement.depth, updated);
      continue;
    }
    if (code === TAG.REMOVE_OBJECT) {
      if (bodyEnd - bodyStart >= 4) active.delete(buffer.readUInt16LE(bodyStart + 2));
      continue;
    }
    if (code === TAG.REMOVE_OBJECT2) {
      if (bodyEnd - bodyStart >= 2) active.delete(buffer.readUInt16LE(bodyStart));
      continue;
    }
  }

  // A timeline whose last frame has no trailing ShowFrame still HAS that frame.
  if (frames.length < sprite.frames) snapshot();
  return { frames, labels };
}

/**
 * Flatten one frame's display list to LEAF DRAWABLES, with matrices composed.
 *
 * Returns an array in paint order, each entry
 * `{characterId, kind, matrix, colourTransform, path, ratio, unsupported}`
 * where `path` is the chain of depths that reached it — so a caller can say
 * which limb a shape belongs to without guessing from geometry.
 *
 * `spriteFrames` chooses which frame a nested sprite is stopped on, by
 * character id. The default is frame 1, which is where the build's own `stop()`
 * leaves them; see this file's header for the one clip where the choice is a
 * game decision rather than a formality.
 *
 * ► **A character this module cannot turn into paths is REPORTED, never
 *   dropped.** A morph shape comes back with `unsupported: "morph"` and its
 *   composed matrix intact, so the caller sees 34 of them on the fighter's
 *   effect depths instead of a picture that is quietly missing its blood.
 *
 * ► **MASKS, and the two ways to get them wrong.** A placement with a
 *   `clipDepth` is a mask over depths `depth + 1 .. clipDepth` on the SAME
 *   timeline — **but only when `clipDepth > 0`**. Ruffle's own test is
 *   `child.clip_depth() > 0 && child.allow_as_mask()`, so a `clipDepth` of 0 is
 *   an ORDINARY DRAWABLE, and the first version of this module dropped those
 *   too. The second mistake is quieter: dropping the mask and returning what it
 *   covers UNCLIPPED, which exports more geometry than the build ever draws and
 *   reports it as correctly resolved. So the mask itself comes back as
 *   `unsupported: "mask"`, and everything it covers is stamped `maskedBy` —
 *   the caller can clip, or refuse, but cannot be unaware.
 *
 *   Measured on the shipped build: the fighter clip uses NO masks at all, so
 *   neither case changes this extraction. Thirty placements elsewhere in the
 *   file do.
 */
export function flattenFrame(buffer, characters, displayList, options = {}) {
  const { spriteFrames = {}, maxDepth = 8, cache = new Map() } = options;
  const drawables = [];

  /**
   * A nested sprite's display list at one frame, memoised.
   *
   * Without this, flattening the fighter's 2,222 frames re-walks every limb's
   * tag stream once per frame — tens of thousands of walks for a rig whose
   * sprites are one frame each and never change.
   */
  const innerFrame = (sprite, wantedFrame) => {
    const key = `${sprite.id}@${wantedFrame}`;
    if (!cache.has(key)) {
      const resolved = resolveTimeline(buffer, sprite, { frames: [wantedFrame] });
      cache.set(key, resolved.frames[wantedFrame - 1] ?? null);
    }
    return cache.get(key);
  };

  const visit = (entries, parentMatrix, parentColour, parentPath, depth, visiting) => {
    if (depth > maxDepth) {
      throw new DisplayListError(`Sprite nesting exceeded ${maxDepth} levels at path ${parentPath.join("/")}.`);
    }
    // Which depths on THIS timeline are covered by a mask, and by which one.
    // Masking does not cross into a nested sprite's own depth numbering, so
    // this is rebuilt per level rather than threaded through the recursion.
    const maskedBy = new Map();
    for (const entry of entries) {
      if (typeof entry.clipDepth === "number" && entry.clipDepth > 0) {
        for (const other of entries) {
          if (other.depth > entry.depth && other.depth <= entry.clipDepth) {
            if (!maskedBy.has(other.depth)) maskedBy.set(other.depth, entry.depth);
          }
        }
      }
    }

    for (const entry of entries) {
      const isMask = typeof entry.clipDepth === "number" && entry.clipDepth > 0;
      const matrix = composeMatrix(parentMatrix, entry.matrix ?? IDENTITY_MATRIX);
      const colourTransform = composeColourTransform(
        parentColour,
        entry.colourTransform ?? IDENTITY_COLOUR_TRANSFORM
      );
      const path = [...parentPath, entry.depth];
      const mask = maskedBy.get(entry.depth);

      // A mask is not a drawing: painting it would put the cutter on the canvas
      // instead of the thing it cuts. It is REPORTED rather than dropped,
      // because a caller that exports what it covers needs to know it is there.
      if (isMask) {
        drawables.push({
          characterId: entry.characterId, kind: "mask", matrix, colourTransform, path,
          name: entry.name, clipDepth: entry.clipDepth, unsupported: "mask",
          maskedBy: mask ?? null
        });
        continue;
      }

      const character = characters.get(entry.characterId);
      if (!character) {
        drawables.push({
          characterId: entry.characterId, kind: "missing", matrix, colourTransform,
          path, name: entry.name, ratio: entry.ratio, unsupported: "missing",
          maskedBy: mask ?? null
        });
        continue;
      }
      if (character.kind === "sprite") {
        if (visiting.has(character.id)) {
          throw new DisplayListError(`Sprite ${character.id} contains itself at path ${path.join("/")}.`);
        }
        const inner = innerFrame(character, spriteFrames[character.id] ?? 1);
        if (!inner) continue;
        visiting.add(character.id);
        visit(inner, matrix, colourTransform, path, depth + 1, visiting);
        visiting.delete(character.id);
        continue;
      }
      drawables.push({
        characterId: character.id,
        kind: character.kind,
        matrix,
        colourTransform,
        path,
        name: entry.name,
        ratio: entry.ratio,
        blendMode: entry.blendMode,
        maskedBy: mask ?? null,
        // A shape under a mask is not "correctly resolved geometry": this module
        // composes no clip path, so exporting it whole would draw more than the
        // build does. It is reported as unsupported for that reason alone.
        unsupported: character.kind === "shape" ? (mask === undefined ? null : "masked") : character.kind
      });
    }
  };

  visit(
    displayList,
    options.matrix ?? IDENTITY_MATRIX,
    options.colourTransform ?? IDENTITY_COLOUR_TRANSFORM,
    [],
    0,
    new Set()
  );
  return drawables;
}
