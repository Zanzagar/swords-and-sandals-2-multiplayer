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
  4: null, // GradientGlow: NumColors, then 5 bytes each, then 19
  5: null, // Convolution: MatrixX * MatrixY floats
  6: 80,   // ColorMatrix: twenty 32-bit floats
  7: null  // GradientBevel: shaped like GradientGlow
});

/**
 * Step a cursor past a FILTERLIST, decoding nothing.
 *
 * ► **This exists because FILTERLIST sits BETWEEN `ClipDepth` and `BlendMode`,
 *   and the first version of this parser read the blend mode straight out of
 *   the filter list's count byte.** Measured on the shipped build: **1,507 of
 *   its 1,522 `PlaceObject3` tags carry a filter list, and 3 carry a filter
 *   list AND a blend mode** — so the bug was live, in three places, in a field
 *   nothing downstream reads yet. A parser that skips a variable-length record
 *   by guessing is a parser that will be wrong later, somewhere else.
 *
 * It stays beside `parseFilterList` as the CURSOR STEPPER: a caller that only
 * needs the byte after a filter list pays nothing to decode it, and the two are
 * pinned against each other by a test, so the size table above cannot drift
 * away from the decoder below it.
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
      // GradientGlow (4) and GradientBevel (7): NumColors, then an RGBA for
      // each, then a RATIO BYTE for each, then blurX/blurY/angle/distance
      // (4 each), strength (2) and one flag byte — NINETEEN, not 23.
      //
      // ► **THIS LINE SAID 23 AND WAS FOUR BYTES WRONG, and the test that
      //   covered it wrote 23 zero bytes, so fixture and parser agreed and the
      //   suite was green.** That is this project's standing failure arriving
      //   in a new place, and the oracle could never have caught it: the
      //   shipped build contains ZERO gradient filters, so nothing but the
      //   test ever exercised this arm. The derivation is a DropShadow (23)
      //   with its RGBA replaced by the gradient: 23 - 4 + 1 + 5n = 5n + 20,
      //   which is the 1 + 5n + 19 below. Ruffle's `read_gradient_filter`
      //   reads the same nineteen trailing bytes.
      const colours = buffer[cursor];
      cursor += 1 + colours * 5 + 19;
    }
  }
  if (cursor > end) throw new DisplayListError("PlaceObject3 filter list ran past the end of its tag.");
  return cursor;
}

/** A filter's own numeric types: FIXED is 16.16, FIXED8 is 8.8, FLOAT is IEEE. */
function readFixed(buffer, offset) {
  return buffer.readInt32LE(offset) / 65536;
}

function readFixed8(buffer, offset) {
  return buffer.readInt16LE(offset) / 256;
}

function readRGBA(buffer, offset) {
  return {
    red: buffer[offset], green: buffer[offset + 1],
    blue: buffer[offset + 2], alpha: buffer[offset + 3]
  };
}

/** The `FilterID` -> record `type` mapping, so a caller can switch on a name. */
export const FILTER_TYPES = Object.freeze({
  0: "dropShadow", 1: "blur", 2: "glow", 3: "bevel",
  4: "gradientGlow", 5: "convolution", 6: "colourMatrix", 7: "gradientBevel"
});

/**
 * A FILTERLIST, DECODED — `{filters, next}`, one typed record per filter.
 *
 * ► **The module used to claim in this very file that it "reports that filters
 *   are present". It did not.** `parsePlaceObject` set `hasFilters`, and
 *   `flattenFrame`'s drawable literal had no such key at all, so **1,507
 *   filtered placements reached no caller in any form** — not applied, not
 *   approximated, not counted. An approximation that is not counted is
 *   indistinguishable from a correct read, and a dropped field is worse: it
 *   reads as "there was nothing there".
 *
 *   Measured on the shipped build, which is why this is not cosmetic: **1,894
 *   filters, of which 636 are ColorMatrix — 208 of those on the sprite the root
 *   timeline places under the instance name `sky`**, whose day/night colouring
 *   IS a colour matrix that changes across its 200 frames. 853 glows, 320
 *   blurs, 54 bevels, 31 drop shadows.
 *
 * Type names are the specification's structures in this module's spelling, so
 * COLORMATRIXFILTER is `colourMatrix` beside `colourTransform`.
 *
 * ► **THE TWO BEVEL COLOURS ARE IN THE OPPOSITE ORDER TO THE SPECIFICATION'S
 *   FIELD TABLE, and this is measured rather than taken on trust.** The table
 *   in the SWF file format specification lists `ShadowColor` then
 *   `HighlightColor`; the shipped build writes the HIGHLIGHT first. In all 54
 *   of its bevels the first RGBA is `255,255,255,255` and the second is dark
 *   (`160,96,1`, `0,0,0`, `102,0,0`) — which is Flash's own default pairing of
 *   a white highlight against a dark shadow, 54 times out of 54 and never once
 *   the other way round. Ruffle reads the same order. A reader that trusts the
 *   table swaps every bevel's two colours and still produces a plausible bevel,
 *   which is why the order is named here instead of being left implicit.
 *
 * ► **GradientGlow (4), Convolution (5) and GradientBevel (7) DO NOT OCCUR in
 *   the shipped build** — the census above is all five kinds it has. Their
 *   arithmetic here is the specification's and is checked by this module's own
 *   tests, but it has never been run against the oracle, so a caller that meets
 *   one is meeting an UNMEASURED path.
 */
export function parseFilterList(buffer, offset, end) {
  if (offset >= end) throw new DisplayListError("Filter list ran past the end of its tag.");
  const count = buffer[offset];
  let cursor = offset + 1;
  const filters = [];

  // Every read below is bounds-checked BEFORE it happens: a truncated filter
  // would otherwise come back as `undefined` bytes read as zeroes, which is a
  // filter record that looks parsed and is not.
  const need = (bytes, what) => {
    if (cursor + bytes > end) throw new DisplayListError(`Filter list ran past the end of its tag reading ${what}.`);
  };

  for (let index = 0; index < count; index += 1) {
    need(1, "a filter id");
    const id = buffer[cursor];
    cursor += 1;
    const type = FILTER_TYPES[id];
    if (type === undefined) throw new DisplayListError(`Unknown SWF filter id ${id}.`);

    if (id === 0 || id === 2) {
      // DropShadow and Glow share a shape: a colour, two blurs, a strength and
      // one flag byte, with DropShadow carrying an angle and distance between.
      const isShadow = id === 0;
      need(isShadow ? 23 : 15, type);
      const colour = readRGBA(buffer, cursor);
      const blurX = readFixed(buffer, cursor + 4);
      const blurY = readFixed(buffer, cursor + 8);
      const tail = isShadow ? cursor + 20 : cursor + 12;
      const flags = buffer[tail + 2];
      const record = {
        type, filterId: id, colour, blurX, blurY,
        strength: readFixed8(buffer, tail),
        // Inner, Knockout, CompositeSource, then Passes UB[5]. Measured: 881 of
        // the build's 884 shadows and glows carry 0x21 — composite source set,
        // one pass — and the three at 0xa1 are INNER glows.
        inner: (flags & 0x80) !== 0,
        knockout: (flags & 0x40) !== 0,
        compositeSource: (flags & 0x20) !== 0,
        passes: flags & 0x1f
      };
      if (isShadow) {
        record.angle = readFixed(buffer, cursor + 12);
        record.distance = readFixed(buffer, cursor + 16);
      }
      filters.push(record);
      cursor += isShadow ? 23 : 15;
      continue;
    }

    if (id === 1) {
      need(9, type);
      filters.push({
        type, filterId: id,
        blurX: readFixed(buffer, cursor),
        blurY: readFixed(buffer, cursor + 4),
        // Passes UB[5] then Reserved UB[3] — so the count is the TOP five bits,
        // not the byte. Measured: 314 blurs at 0x08 (one pass) and 6 at 0x10
        // (two), with the reserved low bits zero in every one of the 320.
        passes: buffer[cursor + 8] >>> 3
      });
      cursor += 9;
      continue;
    }

    if (id === 3) {
      need(27, type);
      const flags = buffer[cursor + 26];
      filters.push({
        type, filterId: id,
        // See the docstring: the wire's first RGBA is the HIGHLIGHT, measured
        // 54 times out of 54, which is the opposite of the spec's field table.
        highlightColour: readRGBA(buffer, cursor),
        shadowColour: readRGBA(buffer, cursor + 4),
        blurX: readFixed(buffer, cursor + 8),
        blurY: readFixed(buffer, cursor + 12),
        angle: readFixed(buffer, cursor + 16),
        distance: readFixed(buffer, cursor + 20),
        strength: readFixed8(buffer, cursor + 24),
        inner: (flags & 0x80) !== 0,
        knockout: (flags & 0x40) !== 0,
        compositeSource: (flags & 0x20) !== 0,
        onTop: (flags & 0x10) !== 0,
        passes: flags & 0x0f
      });
      cursor += 27;
      continue;
    }

    if (id === 4 || id === 7) {
      // UNMEASURED: neither gradient filter occurs in the shipped build.
      need(1, type);
      const colours = buffer[cursor];
      need(1 + colours * 5 + 19, type);
      const gradient = [];
      // The RGBAs come first as a block and the ratios follow as their own
      // block — they are NOT interleaved, which is the easy way to read this.
      for (let stop = 0; stop < colours; stop += 1) {
        gradient.push({
          colour: readRGBA(buffer, cursor + 1 + stop * 4),
          ratio: buffer[cursor + 1 + colours * 4 + stop]
        });
      }
      const tail = cursor + 1 + colours * 5;
      // 0..3 blurX, 4..7 blurY, 8..11 angle, 12..15 distance, 16..17 strength,
      // 18 flags. NINETEEN bytes — see skipFilterList for the four this file
      // used to add here and for why no capture could ever have caught it.
      const flags = buffer[tail + 18];
      filters.push({
        type, filterId: id, gradient,
        blurX: readFixed(buffer, tail),
        blurY: readFixed(buffer, tail + 4),
        angle: readFixed(buffer, tail + 8),
        distance: readFixed(buffer, tail + 12),
        strength: readFixed8(buffer, tail + 16),
        inner: (flags & 0x80) !== 0,
        knockout: (flags & 0x40) !== 0,
        compositeSource: (flags & 0x20) !== 0,
        onTop: (flags & 0x10) !== 0,
        passes: flags & 0x0f,
        measured: false
      });
      cursor = tail + 19;
      continue;
    }

    if (id === 5) {
      // UNMEASURED: no convolution filter occurs in the shipped build.
      need(2, type);
      const matrixX = buffer[cursor];
      const matrixY = buffer[cursor + 1];
      const cells = matrixX * matrixY;
      need(2 + 4 + 4 + cells * 4 + 4 + 1, type);
      const matrix = [];
      for (let cell = 0; cell < cells; cell += 1) matrix.push(buffer.readFloatLE(cursor + 10 + cell * 4));
      const flags = buffer[cursor + 14 + cells * 4];
      filters.push({
        type, filterId: id, matrixX, matrixY,
        divisor: buffer.readFloatLE(cursor + 2),
        bias: buffer.readFloatLE(cursor + 6),
        matrix,
        defaultColour: readRGBA(buffer, cursor + 10 + cells * 4),
        clamp: (flags & 0x02) !== 0,
        preserveAlpha: (flags & 0x01) !== 0,
        measured: false
      });
      cursor += 2 + 4 + 4 + cells * 4 + 4 + 1;
      continue;
    }

    // ColorMatrix (6): twenty 32-bit floats, four rows of five, the fifth
    // column being the offsets in 0..255 colour space.
    need(80, type);
    const matrix = [];
    for (let cell = 0; cell < 20; cell += 1) matrix.push(buffer.readFloatLE(cursor + cell * 4));
    filters.push({ type, filterId: id, matrix });
    cursor += 80;
  }

  if (cursor > end) throw new DisplayListError("Filter list ran past the end of its tag.");
  return { filters, next: cursor };
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
 * starts); the filter list is DECODED into typed records and the blend mode is
 * carried as its raw id. This module does not render, so neither is applied —
 * but both reach the caller, which is the difference between an unsupported
 * effect and a dropped one.
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
      // DECODED, not stepped over. `hasFilters` on its own was the whole of
      // this module's filter reporting for 1,507 placements, and a boolean that
      // never reaches a drawable is not a report.
      const read = parseFilterList(buffer, cursor, bodyEnd);
      placement.hasFilters = true;
      placement.filters = read.filters;
      cursor = read.next;
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
 * The four button states, in the order their bits sit in a BUTTONRECORD.
 *
 * `hitTest` is the mouse target and is NEVER DRAWN — a flattener that painted
 * it would put an invisible hit area on the canvas, so it is a legal argument
 * to `buttonStateDisplayList` only because a caller auditing coverage may want
 * to see it, never because it is art.
 */
export const BUTTON_STATES = Object.freeze(["up", "over", "down", "hitTest"]);

const BUTTON_STATE_BITS = Object.freeze({ up: 0x01, over: 0x02, down: 0x04, hitTest: 0x08 });

/**
 * A `DefineButton` (7) or `DefineButton2` (34) character, as `{id, records, …}`.
 *
 * ► **WHY THIS EXISTS: 158 button characters were a wall.** `flattenFrame`
 *   reported a button placement as `unsupported: "button"` and said nothing
 *   about what was behind it, so everything inside one was invisible to every
 *   census this repository can run. Measured on the shipped build: the 158
 *   `DefineButton2` characters hold **704 BUTTONRECORDs — 425 shapes, 146 texts
 *   and 133 sprites across 60 distinct characters** — and **27 of the file's
 *   436 text characters appear ONLY here**, placed on no timeline anywhere.
 *
 * A BUTTONRECORD is a `PlaceObject` in all but name: a character, a depth, a
 * matrix and (in a `DefineButton2`) a colour transform, plus the set of states
 * it is drawn in. So `buttonStateDisplayList` can hand one straight to
 * `flattenFrame` and the existing machinery does the rest.
 *
 * ► **A `DefineButton` (tag 7) record has NO colour transform**, and its two
 *   SWF 8 flag bits do not exist, so a reader that assumes one shape for both
 *   tags desynchronises on the older one. The shipped build has **zero** tag-7
 *   buttons — all 158 are tag 34 — so that arm is format correctness checked by
 *   this module's tests and NOT a measured path.
 */
export function parseButton(buffer, character) {
  if (!character || typeof character.bodyStart !== "number") {
    throw new DisplayListError("parseButton needs a character from indexCharacters().");
  }
  const { tagCode, bodyStart, bodyEnd } = character;
  if (tagCode !== TAG.DEFINE_BUTTON && tagCode !== TAG.DEFINE_BUTTON2) {
    throw new DisplayListError(`Character ${character.id} is tag ${tagCode}, not a DefineButton or DefineButton2.`);
  }
  const isButton2 = tagCode === TAG.DEFINE_BUTTON2;

  let cursor = bodyStart;
  if (cursor + 2 > bodyEnd) throw new DisplayListError(`Button ${character.id} is too short for its id.`);
  const id = buffer.readUInt16LE(cursor);
  cursor += 2;
  let trackAsMenu = false;
  let actionOffset = 0;
  if (isButton2) {
    if (cursor + 3 > bodyEnd) throw new DisplayListError(`Button ${id} is too short for its flags and action offset.`);
    // ReservedFlags UB[7] then TrackAsMenu UB[1], so the flag is the LOW bit.
    trackAsMenu = (buffer[cursor] & 0x01) !== 0;
    cursor += 1;
    actionOffset = buffer.readUInt16LE(cursor);
    cursor += 2;
  }

  const records = [];
  const stateCounts = { up: 0, over: 0, down: 0, hitTest: 0 };
  for (;;) {
    if (cursor >= bodyEnd) {
      throw new DisplayListError(`Button ${id} ran past the end of its tag before the record terminator.`);
    }
    const flags = buffer[cursor];
    cursor += 1;
    // A zero byte is CharacterEndFlag. It is not a record with no states set:
    // the two are the same byte, and the format says zero ends the list.
    if (flags === 0) break;
    if (cursor + 4 > bodyEnd) throw new DisplayListError(`Button ${id} record ran past the end of its tag.`);
    const characterId = buffer.readUInt16LE(cursor);
    const depth = buffer.readUInt16LE(cursor + 2);
    cursor += 4;
    const readPlacement = readMatrix(buffer, cursor);
    cursor = readPlacement.next;
    // A MATRIX is a bit field with no length of its own, so a malformed record
    // walks straight into the next tag's bytes and comes back looking parsed.
    if (cursor > bodyEnd) throw new DisplayListError(`Button ${id} record's matrix ran past the end of its tag.`);
    const record = {
      characterId,
      depth,
      matrix: readPlacement.matrix,
      colourTransform: IDENTITY_COLOUR_TRANSFORM,
      up: (flags & BUTTON_STATE_BITS.up) !== 0,
      over: (flags & BUTTON_STATE_BITS.over) !== 0,
      down: (flags & BUTTON_STATE_BITS.down) !== 0,
      hitTest: (flags & BUTTON_STATE_BITS.hitTest) !== 0,
      blendMode: null,
      hasFilters: false,
      filters: null
    };
    if (isButton2) {
      const readColour = readColourTransform(buffer, cursor, true);
      record.colourTransform = readColour.colourTransform;
      cursor = readColour.next;
      if (cursor > bodyEnd) {
        throw new DisplayListError(`Button ${id} record's colour transform ran past the end of its tag.`);
      }
      if ((flags & 0x10) !== 0) {
        // Measured: 34 of the build's 704 records carry a filter list and NONE
        // carries a blend mode, so the blend arm below is unexercised by the
        // oracle while this one is not.
        const readFilters = parseFilterList(buffer, cursor, bodyEnd);
        record.hasFilters = true;
        record.filters = readFilters.filters;
        cursor = readFilters.next;
      }
      if ((flags & 0x20) !== 0) {
        if (cursor >= bodyEnd) throw new DisplayListError(`Button ${id} record ran past the end of its tag.`);
        record.blendMode = buffer[cursor];
        cursor += 1;
      }
    }
    for (const state of BUTTON_STATES) if (record[state]) stateCounts[state] += 1;
    records.push(record);
  }

  return { id, tagCode, trackAsMenu, actionOffset, records, stateCounts };
}

/**
 * One button state's records as a DISPLAY LIST — the same shape `resolveTimeline`
 * returns, so `flattenFrame` needs no button-specific path through its recursion.
 *
 * Sorted by depth, which is paint order, exactly as a timeline's snapshot is.
 */
export function buttonStateDisplayList(button, state = "up") {
  if (!button || !Array.isArray(button.records)) {
    throw new DisplayListError("buttonStateDisplayList needs a button from parseButton().");
  }
  // `Object.hasOwn`, not a truth test: `BUTTON_STATE_BITS["constructor"]` is a
  // FUNCTION, so a lookup would accept "constructor" as a state and then find
  // `record.constructor` truthy on every record — every one of them drawn.
  if (!Object.hasOwn(BUTTON_STATE_BITS, state)) {
    throw new DisplayListError(`Unknown button state "${state}"; expected one of ${BUTTON_STATES.join(", ")}.`);
  }
  return button.records
    .filter((record) => record[state])
    .map((record) => ({
      depth: record.depth,
      characterId: record.characterId,
      matrix: record.matrix,
      colourTransform: record.colourTransform,
      blendMode: record.blendMode ?? undefined,
      hasFilters: record.hasFilters,
      filters: record.filters
    }))
    .sort((left, right) => left.depth - right.depth);
}

/**
 * WHAT IS INSIDE A BUTTON, counted by kind — the report that turns
 * `unsupported: "button"` from a dead end into a number a manifest can carry.
 *
 * `contents` counts RECORDS, not distinct characters, because one character
 * placed twice is two things drawn; `characterIds` carries the distinct set
 * beside it so neither number has to be inferred from the other.
 */
export function summariseButton(button, characters) {
  const contents = {};
  const characterIds = new Set();
  for (const record of button.records) {
    const character = characters.get(record.characterId);
    const kind = character ? character.kind : "missing";
    contents[kind] = (contents[kind] ?? 0) + 1;
    characterIds.add(record.characterId);
  }
  return {
    records: button.records.length,
    states: { ...button.stateCounts },
    trackAsMenu: button.trackAsMenu,
    contents,
    characterIds: [...characterIds].sort((left, right) => left - right)
  };
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
          hasFilters: placement.hasFilters,
          filters: placement.filters
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
      // A move that carries a filter list REPLACES the instance's filters, and
      // one that omits the flag keeps them — the same field-by-field rule the
      // matrix follows. Measured: 1,212 of the build's 1,507 filtered
      // placements are moves, so this is the common case and not the corner.
      if (placement.filters !== undefined) updated.filters = placement.filters;
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

/** The shared empty ancestor chain — frozen, so no visit can append to it. */
const EMPTY_EFFECT_CHAIN = Object.freeze([]);

/**
 * Flatten one frame's display list to LEAF DRAWABLES, with matrices composed.
 *
 * Returns an array in paint order, each entry
 * `{characterId, kind, matrix, colourTransform, path, ratio, unsupported,
 *   blendMode, hasFilters, filters, ancestorEffects}`
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
 * ► **EFFECTS SURVIVE THE RECURSION NOW, AND THEY DID NOT BEFORE.** Every
 *   drawable carries its own `blendMode` (the raw SWF id, `undefined` when the
 *   placement has none — see the literal for why that one is not `null`),
 *   `hasFilters`, `filters` (typed records from `parseFilterList`), and
 *   `ancestorEffects` — the chain of enclosing placements that carried either,
 *   because a filter on a SPRITE applies to the whole group and not to the leaf
 *   that happens to be inside it.
 *
 *   **What was there before: `hasFilters` reached this function and then
 *   stopped — the drawable literal had no such key — and the sprite recursion
 *   passed neither field down.** Measured on the shipped build: **1,507
 *   placements carry a filter list (1,894 filters) and 12 carry a blend mode,
 *   ELEVEN of those twelve on sprites** — so almost every blend mode in the
 *   file died at the recursion, and every filter in the file died at the
 *   drawable. Neither was unsupported; both were absent, which reads to a
 *   caller as "there was nothing there".
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
 *
 * ► **`resolveMasks` TURNS "REFUSE" INTO "CLIP", AND IT IS OPT-IN FOR A
 *   REASON.** With it set, a mask whose character is a SHAPE stops being
 *   `unsupported`: the mask comes back as `isMask: true` carrying its own
 *   character and composed matrix, and everything it covers comes back
 *   drawable with `maskPath` naming which mask cuts it. A caller that can
 *   compose a clip path then draws exactly what the build draws.
 *
 *   **It is off by default because turning it on CHANGES WHAT COMES BACK.**
 *   `extract-figure.mjs` and `extract-wardrobe.mjs` both skip anything carrying
 *   an `unsupported`, so flipping this globally would silently add geometry to
 *   two extractions that are already pinned by tests and by a preview the owner
 *   has looked at. A new capability that rewrites an old answer is not a
 *   capability, it is a regression with a feature's name.
 *
 *   **A mask that is a SPRITE stays unsupported even when this is set.** It
 *   would need its own flatten and a multi-shape clip path, the shipped build
 *   has none on any declared prop, and refusing what has not been measured is
 *   the rule this module already follows for morphs.
 *
 * ► **`resolveButtons` IS OPT-IN FOR EXACTLY THE SAME REASON**, and it is the
 *   only way a button's contents reach a caller as geometry. With it off — the
 *   default — a button placement still comes back `unsupported: "button"`, but
 *   it now carries `button`: the record count, the per-state counts, and what
 *   is inside COUNTED BY KIND. Adding a key to a drawable the extractions
 *   already skip changes nothing they emit; resolving the button's records into
 *   geometry would change both, so that half is behind the flag.
 *
 *   With it on, the records of `buttonState` (default `"up"`) are flattened as
 *   an ordinary display list. **A state with no records is REPORTED, not
 *   returned as an empty array**: 32 of the build's 158 buttons are hit-test
 *   only — one shape, no up, over or down — and a flatten that silently drew
 *   nothing for them would be a zero that means "unread" wearing the costume of
 *   a zero that means "empty". Those come back `unsupported: "buttonState"`.
 *
 *   `"hitTest"` is a legal `buttonState` for a caller auditing coverage. It is
 *   NEVER art: it is the mouse target, and the build does not draw it.
 */
export function flattenFrame(buffer, characters, displayList, options = {}) {
  const {
    spriteFrames = {}, maxDepth = 8, cache = new Map(),
    resolveMasks = false, resolveButtons = false, buttonState = "up"
  } = options;
  // See `buttonStateDisplayList`: an inherited key is not a state.
  if (!Object.hasOwn(BUTTON_STATE_BITS, buttonState)) {
    throw new DisplayListError(`Unknown button state "${buttonState}"; expected one of ${BUTTON_STATES.join(", ")}.`);
  }
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

  /**
   * A button's parsed records, memoised beside the sprite frames.
   *
   * A parse FAILURE is cached as a message rather than thrown, because one
   * unreadable button must not take a whole frame's flatten with it — but it is
   * carried onto the drawable, so it is counted rather than skipped.
   */
  const buttonFor = (character) => {
    const key = `button:${character.id}`;
    if (!cache.has(key)) {
      try {
        cache.set(key, { button: parseButton(buffer, character), error: null });
      } catch (error) {
        cache.set(key, { button: null, error: String(error.message) });
      }
    }
    return cache.get(key);
  };

  const visit = (entries, parentMatrix, parentColour, parentPath, depth, visiting, parentEffects, ancestorMask = null) => {
    if (depth > maxDepth) {
      throw new DisplayListError(`Sprite nesting exceeded ${maxDepth} levels at path ${parentPath.join("/")}.`);
    }
    // Which depths on THIS timeline are covered by a mask, and by which one.
    // Masking does not cross into a nested sprite's own depth numbering, so
    // this is rebuilt per level rather than threaded through the recursion.
    const maskedBy = new Map();
    // And which of those masks this module can actually turn into a clip path:
    // a SHAPE mask is one path, a sprite mask is a whole display list and is
    // refused. Computed here so a masked entry can be told which kind cuts it
    // BEFORE it is pushed.
    const clippable = new Set();
    for (const entry of entries) {
      if (typeof entry.clipDepth === "number" && entry.clipDepth > 0) {
        const mask = characters.get(entry.characterId);
        if (resolveMasks && mask && mask.kind === "shape") clippable.add(entry.depth);
        for (const other of entries) {
          if (other.depth > entry.depth && other.depth <= entry.clipDepth) {
            if (!maskedBy.has(other.depth)) maskedBy.set(other.depth, entry.depth);
          }
        }
      }
    }
    // An empty chain is reported as `null` rather than as `[]`, so a caller
    // cannot mistake "no enclosing effect" for "an array I forgot to fill".
    const carried = parentEffects.length > 0 ? parentEffects : null;

    for (const entry of entries) {
      const isMask = typeof entry.clipDepth === "number" && entry.clipDepth > 0;
      const matrix = composeMatrix(parentMatrix, entry.matrix ?? IDENTITY_MATRIX);
      const colourTransform = composeColourTransform(
        parentColour,
        entry.colourTransform ?? IDENTITY_COLOUR_TRANSFORM
      );
      const path = [...parentPath, entry.depth];
      const mask = maskedBy.get(entry.depth);

      // THE PLACEMENT'S OWN EFFECTS. `hasFilters` is derived from the list as
      // well as from the flag so a hand-built entry cannot claim one without
      // the other, and `filters` is `null` rather than `[]` when there are
      // none — the same distinction `carried` makes above.
      const filters = entry.filters ?? null;
      const hasFilters = entry.hasFilters === true || (filters !== null && filters.length > 0);
      const effects = {
        // ► **`undefined` AND NOT `null` WHEN THERE IS NO BLEND MODE, which is
        //   the one place this literal is deliberately inconsistent with
        //   `filters` and `ancestorEffects` beside it.** The key is now on
        //   every drawable, which is the fix; its ABSENT VALUE is left exactly
        //   as it was, because `tools/extract-screens.mjs` spreads a blend mode
        //   into its output on `drawable.blendMode !== undefined` and a `null`
        //   here would put `blendMode: null` on every drawable it emits. A new
        //   capability that rewrites an old answer is not a capability.
        blendMode: entry.blendMode,
        hasFilters,
        filters,
        ancestorEffects: carried
      };
      // What a nested sprite or button hands to its children: this placement's
      // effects appended, because a filter on a GROUP applies to the group and
      // not to whichever leaf is inside it.
      const descend = (effects.blendMode !== undefined || hasFilters)
        ? Object.freeze([...parentEffects, Object.freeze({
          path, characterId: entry.characterId, blendMode: effects.blendMode, hasFilters, filters
        })])
        : parentEffects;

      // A mask is not a drawing: painting it would put the cutter on the canvas
      // instead of the thing it cuts. It is REPORTED rather than dropped,
      // because a caller that exports what it covers needs to know it is there.
      if (isMask) {
        const resolvable = clippable.has(entry.depth);
        drawables.push({
          characterId: entry.characterId,
          // The kind stays "mask" either way: it is a CUTTER, and a caller that
          // paints it has put the stencil on the canvas instead of the picture.
          kind: "mask", matrix, colourTransform, path,
          name: entry.name, clipDepth: entry.clipDepth,
          isMask: true,
          unsupported: resolvable ? null : "mask",
          maskedBy: mask ?? null,
          ...effects
        });
        continue;
      }

      const character = characters.get(entry.characterId);
      if (!character) {
        drawables.push({
          characterId: entry.characterId, kind: "missing", matrix, colourTransform,
          path, name: entry.name, ratio: entry.ratio, unsupported: "missing",
          maskedBy: mask ?? null,
          ...effects
        });
        continue;
      }
      if (character.kind === "sprite") {
        if (visiting.has(character.id)) {
          throw new DisplayListError(`Sprite ${character.id} contains itself at path ${path.join("/")}.`);
        }
        const inner = innerFrame(character, spriteFrames[character.id] ?? 1);
        if (!inner) {
          // ► **THIS USED TO BE `continue` — a silent drop.** A sprite with no
          //   such frame (the build has five with ZERO frames, 2303-2307) or a
          //   `spriteFrames` entry past the end vanished from the flatten with
          //   nothing said. None of the five is placed anywhere in the shipped
          //   build, so this path is unexercised by the oracle and is here
          //   because an uncounted absence is the defect this module exists to
          //   refuse.
          drawables.push({
            characterId: character.id, kind: "sprite", matrix, colourTransform, path,
            name: entry.name, ratio: entry.ratio, unsupported: "spriteFrame",
            spriteFrame: spriteFrames[character.id] ?? 1,
            maskedBy: mask ?? null,
            ...effects
          });
          continue;
        }
        visiting.add(character.id);
        // ► **A MASK ON THIS SPRITE CUTS EVERYTHING INSIDE IT, and this
        //   recursion used to forget it** (found 2026-09-22 by a Codex
        //   adversarial review of extract-props' morph support): `maskedBy` is
        //   computed per display list, so a child of a masked sprite came back
        //   with `mask === undefined` and no word of the cut. The nearest
        //   enclosing mask is now handed down and stamped on the leaf as
        //   `ancestorMaskPath` — present ONLY when there is one, so no existing
        //   caller's output changes. Callers that cannot clip across a sprite
        //   boundary must refuse what it covers; `tools/extract-props.mjs` does
        //   for morphs. SHAPES under an ancestor mask are still returned drawable
        //   (the pre-existing behaviour, recorded in that day's handoff).
        const enclosing = mask === undefined ? ancestorMask : [...parentPath, mask];
        visit(inner, matrix, colourTransform, path, depth + 1, visiting, descend, enclosing);
        visiting.delete(character.id);
        continue;
      }
      if (character.kind === "button") {
        const parsed = buttonFor(character);
        const summary = parsed.button ? summariseButton(parsed.button, characters) : null;
        if (resolveButtons && parsed.button) {
          const inner = buttonStateDisplayList(parsed.button, buttonState);
          if (inner.length > 0) {
            if (visiting.has(character.id)) {
              throw new DisplayListError(`Button ${character.id} contains itself at path ${path.join("/")}.`);
            }
            visiting.add(character.id);
            // The same hand-down as the sprite branch's, for the same reason: a
            // mask on the button, or above it, cuts what its state draws
            // (found by the Codex re-review of the 2026-09-22 fix, which had
            // covered sprites and not buttons).
            const enclosingButton = mask === undefined ? ancestorMask : [...parentPath, mask];
            visit(inner, matrix, colourTransform, path, depth + 1, visiting, descend, enclosingButton);
            visiting.delete(character.id);
            continue;
          }
          // An empty state falls THROUGH to the report below rather than
          // drawing nothing: see this function's docstring for the 32
          // hit-test-only buttons that make this the common case, not a corner.
        }
        drawables.push({
          characterId: character.id, kind: "button", matrix, colourTransform, path,
          name: entry.name, ratio: entry.ratio,
          unsupported: (resolveButtons && !parsed.error) ? "buttonState" : "button",
          button: summary,
          buttonError: parsed.error,
          buttonState: resolveButtons ? buttonState : null,
          maskedBy: mask ?? null,
          maskPath: mask === undefined ? null : [...parentPath, mask],
          ...effects
        });
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
        maskedBy: mask ?? null,
        // ► A shape under a mask is not "correctly resolved geometry" UNLESS
        //   the caller asked for clip paths: without one, exporting it whole
        //   draws more than the build does, which is why it is reported rather
        //   than returned. With `resolveMasks` and a SHAPE mask, it is exact
        //   and comes back drawable with `maskPath` naming the cutter.
        unsupported: character.kind === "shape"
          ? (mask === undefined || clippable.has(mask) ? null : "masked")
          : character.kind,
        // The mask's OWN path, so a caller can find it in this same array
        // without re-deriving which level it was on. Depth alone is ambiguous
        // across nesting; this is not.
        maskPath: mask === undefined ? null : [...parentPath, mask],
        ...(ancestorMask ? { ancestorMaskPath: ancestorMask } : {}),
        ...effects
      });
    }
  };

  visit(
    displayList,
    options.matrix ?? IDENTITY_MATRIX,
    options.colourTransform ?? IDENTITY_COLOUR_TRANSFORM,
    [],
    0,
    new Set(),
    EMPTY_EFFECT_CHAIN
  );
  return drawables;
}

/**
 * COUNT what a flatten actually produced, so a manifest can say it.
 *
 * ► **This exists because "zero failures" was reported by an extractor whose
 *   fill data had died at a seam**, and the arena's walls were invisible for
 *   months behind that zero. A count that a human reads is the only thing
 *   standing between an approximation and a silently wrong picture, so the
 *   counting is part of this module rather than something each caller
 *   reimplements — and every unsupported kind appears in `unsupported` with its
 *   distinct character ids, not merely a total.
 */
export function summariseDrawables(drawables) {
  const byKind = {};
  // Per unsupported kind: how many PLACEMENTS and which distinct CHARACTERS.
  // "12 placements of 3 morphs" and "12 placements of 12 morphs" are different
  // problems, and one total cannot tell a reader which one they have.
  const unsupported = new Map();
  const filtersByType = {};
  const blendModes = {};
  const buttons = { placements: 0, records: 0, contents: {}, failures: 0, emptyStates: 0 };
  // An enclosing filtered GROUP is counted ONCE, by the path that identifies
  // it, and separately from the number of drawables it encloses. Counting a
  // group once per leaf would report the sky's single day/night colour matrix
  // as hundreds of colour matrices, which is a number that reads as evidence
  // and is an artefact of the traversal.
  const ancestorGroups = new Set();
  const ancestorFiltersByType = {};
  const ancestorBlendModes = {};
  let withFilters = 0;
  let insideEffects = 0;

  for (const drawable of drawables) {
    byKind[drawable.kind] = (byKind[drawable.kind] ?? 0) + 1;
    if (drawable.unsupported) {
      const tally = unsupported.get(drawable.unsupported) ?? { placements: 0, characters: new Set() };
      tally.placements += 1;
      tally.characters.add(drawable.characterId);
      unsupported.set(drawable.unsupported, tally);
    }
    if (drawable.hasFilters) withFilters += 1;
    for (const filter of drawable.filters ?? []) {
      filtersByType[filter.type] = (filtersByType[filter.type] ?? 0) + 1;
    }
    if (drawable.blendMode !== null && drawable.blendMode !== undefined) {
      blendModes[drawable.blendMode] = (blendModes[drawable.blendMode] ?? 0) + 1;
    }
    if (drawable.ancestorEffects) {
      insideEffects += 1;
      for (const group of drawable.ancestorEffects) {
        const key = group.path.join("/");
        if (ancestorGroups.has(key)) continue;
        ancestorGroups.add(key);
        for (const filter of group.filters ?? []) {
          ancestorFiltersByType[filter.type] = (ancestorFiltersByType[filter.type] ?? 0) + 1;
        }
        if (group.blendMode !== null && group.blendMode !== undefined) {
          ancestorBlendModes[group.blendMode] = (ancestorBlendModes[group.blendMode] ?? 0) + 1;
        }
      }
    }
    if (drawable.kind === "button") {
      buttons.placements += 1;
      if (drawable.buttonError) buttons.failures += 1;
      if (drawable.unsupported === "buttonState") buttons.emptyStates += 1;
      if (drawable.button) {
        buttons.records += drawable.button.records;
        for (const [kind, count] of Object.entries(drawable.button.contents)) {
          buttons.contents[kind] = (buttons.contents[kind] ?? 0) + count;
        }
      }
    }
  }

  return {
    drawables: drawables.length,
    byKind,
    unsupported: Object.fromEntries(
      [...unsupported].map(([kind, tally]) => [kind, {
        placements: tally.placements,
        characters: [...tally.characters].sort((left, right) => left - right)
      }])
    ),
    withFilters,
    filtersByType,
    blendModes,
    // `insideEffects` counts DRAWABLES under an effect group; `ancestorGroups`
    // counts the groups themselves. Reporting only the first would inflate one
    // filter into one per leaf.
    insideEffects,
    ancestorGroups: ancestorGroups.size,
    ancestorFiltersByType,
    ancestorBlendModes,
    buttons
  };
}
