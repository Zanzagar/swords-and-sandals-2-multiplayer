#!/usr/bin/env node

/**
 * WRITES A MINIMAL SWF, SO RUFFLE CAN BE ASKED A QUESTION WITH A KNOWN ANSWER.
 *
 * ## Why a synthetic SWF rather than the game
 *
 * Two questions this repository has carried for days both need a RUNTIME
 * ARBITER, and both were stalled on the cost of reaching the frame that shows
 * them:
 *
 * ► **DOES A FLASH PLAYER PAINT OUTSIDE ITS STAGE RECT?** `src/render/` letter-
 *   boxes the 640x420 stage into the canvas (`stageFitFor`) and then paints
 *   through the letterbox, because nothing clips. Whether that is a defect
 *   depends on the player, and the only frame of the real game that shows it is
 *   deep inside a fight.
 *
 * ► **WHAT DOES `strength` DO TO A GLOW?** `canvasFilterFor` folds it into the
 *   shadow colour's alpha, which CLAMPS — so all 24 enchantment filters emit
 *   alpha 1 and two different strengths draw byte-identically. The handoff of
 *   2026-09-15 ranked "render `weapon0` frame 5 under Ruffle and compare" and
 *   called it a session's work, because reaching that frame means playing to an
 *   arena with an enchanted weapon.
 *
 * **Neither question is about Swords & Sandals II.** Both are about what a
 * player does with a display list, and a forty-byte shape answers them with the
 * variable isolated — which one frame of the real game could not do, because it
 * offers ONE strength and no control.
 *
 * ► **AND IT KEEPS THE ORACLE CLEAN.** AGENTS.md's first operational fact is
 *   that the installed SWF stays byte-identical because it is the measurement
 *   oracle, and that running the game mutates the save. A probe written here
 *   touches neither: it is this file's own bytes, rendered in a player started
 *   with `--storage memory`.
 *
 * ## What it emits
 *
 * An uncompressed `FWS` version-8 movie: `SetBackgroundColor`, one or more
 * `DefineShape3` solid rectangles, a `PlaceObject3` per placement carrying an
 * optional `SurfaceFilterList`, `ShowFrame`, `End`. That is the whole subset,
 * and it is deliberately the whole subset — every tag here is one this project
 * already reads in `tools/swf-display-list.mjs`, so a probe is a round trip
 * through the same format the extractors parse rather than a second dialect.
 *
 * **Version 8 rather than 11**: `PlaceObject3` and the filter list arrived in
 * SWF 8, and asking for the lowest version that carries the feature means a
 * player cannot satisfy the file by way of some later behaviour.
 *
 * ## Usage
 *
 *   node tools/swf-probe.mjs clip   --out <dir>     # the stage-clipping probe
 *   node tools/swf-probe.mjs glow   --out <dir>     # the glow-strength ladder
 *   node tools/swf-probe.mjs --self-test            # encoder round-trip only
 *
 * The emitted files are gitignored build products, not assets: they contain no
 * SS2 bytes, and `--self-test` reads them back with this repository's own SWF
 * reader rather than trusting the writer.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import zlib from "node:zlib";

const TWIPS = 20;

/* ------------------------------------------------------------------ *
 * Bit and byte writers.
 *
 * SWF interleaves byte-aligned fields with bit-packed ones, and the bit
 * fields are BIG-ENDIAN within the stream while the byte fields are
 * LITTLE-endian. Conflating the two is the classic way to write a file
 * that a player rejects with no diagnosis, so the two are separate types
 * here and `align()` is the only bridge.
 * ------------------------------------------------------------------ */

class ByteWriter {
  constructor() {
    this.bytes = [];
    this.bitBuffer = 0;
    this.bitCount = 0;
  }

  /** Flush any partial byte. Every byte-aligned write goes through this. */
  align() {
    if (this.bitCount > 0) {
      this.bytes.push(this.bitBuffer & 0xff);
      this.bitBuffer = 0;
      this.bitCount = 0;
    }
    return this;
  }

  u8(value) {
    this.align();
    this.bytes.push(value & 0xff);
    return this;
  }

  u16(value) {
    this.align();
    this.bytes.push(value & 0xff, (value >>> 8) & 0xff);
    return this;
  }

  u32(value) {
    this.align();
    this.bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
    return this;
  }

  raw(buffer) {
    this.align();
    for (const byte of buffer) this.bytes.push(byte & 0xff);
    return this;
  }

  /**
   * `count` bits of `value`, most significant first.
   *
   * `value` is coerced through `>>> 0` per bit rather than masked as a whole,
   * because a signed field (every SWF coordinate is one) must be written in
   * two's complement at ITS width, not at 32 bits.
   */
  bits(value, count) {
    for (let i = count - 1; i >= 0; i -= 1) {
      const bit = (value >> i) & 1;
      this.bitBuffer = (this.bitBuffer << 1) | bit;
      this.bitCount += 1;
      if (this.bitCount === 8) {
        this.bytes.push(this.bitBuffer & 0xff);
        this.bitBuffer = 0;
        this.bitCount = 0;
      }
    }
    return this;
  }

  toBuffer() {
    this.align();
    return Buffer.from(this.bytes);
  }
}

/** Bits needed for `value` as a SIGNED two's-complement field, minimum 1. */
function signedBitsFor(value) {
  const n = Math.trunc(value);
  if (n === 0) return 1;
  // A negative value needs one more bit than its magnitude when it is an exact
  // power of two (-8 fits in 4 bits, +8 does not), which is why this counts on
  // the value itself rather than on Math.abs.
  let width = 1;
  while (n < -(2 ** (width - 1)) || n > 2 ** (width - 1) - 1) width += 1;
  return width;
}

/** A SWF RECT, in TWIPS. */
function writeRect(writer, { xMin, xMax, yMin, yMax }) {
  const values = [xMin, xMax, yMin, yMax].map((v) => Math.round(v));
  const nBits = Math.max(...values.map(signedBitsFor));
  writer.bits(nBits, 5);
  for (const value of values) writer.bits(value, nBits);
  writer.align();
  return writer;
}

/** RGBA, as `DefineShape3` and every filter colour take it. */
function writeRgba(writer, { red, green, blue, alpha = 255 }) {
  return writer.u8(red).u8(green).u8(blue).u8(alpha);
}

/** A SWF tag header: short form under 63 bytes, long form otherwise. */
function writeTag(writer, code, body) {
  if (body.length < 0x3f) {
    writer.u16((code << 6) | body.length);
  } else {
    writer.u16((code << 6) | 0x3f);
    writer.u32(body.length);
  }
  return writer.raw(body);
}

/* ------------------------------------------------------------------ *
 * Shapes.
 * ------------------------------------------------------------------ */

/**
 * `DefineShape3` — ONE axis-aligned rectangle in ONE solid RGBA fill.
 *
 * Everything this file needs to ask is answerable with a rectangle, and a
 * rectangle is the shape whose rendered extent can be checked against its
 * declared bounds by reading two rows of pixels. A probe whose own geometry
 * needs interpreting is not a probe.
 */
function defineShape3(shapeId, { x, y, width, height, fill }) {
  const body = new ByteWriter();
  body.u16(shapeId);

  const xMin = Math.round(x * TWIPS);
  const yMin = Math.round(y * TWIPS);
  const xMax = Math.round((x + width) * TWIPS);
  const yMax = Math.round((y + height) * TWIPS);
  writeRect(body, { xMin, xMax, yMin, yMax });

  // SHAPEWITHSTYLE: one fill style, no line styles.
  body.u8(1);
  body.u8(0x00); // solid fill
  writeRgba(body, fill);
  body.u8(0); // LineStyleCount

  const fillBits = 1;
  const lineBits = 0;
  body.u8((fillBits << 4) | lineBits);

  // StyleChangeRecord: MoveTo the top-left corner and select fill style 1.
  const moveBits = Math.max(signedBitsFor(xMin), signedBitsFor(yMin));
  body.bits(0, 1); // not an edge record
  body.bits(0, 1); // StateNewStyles
  body.bits(0, 1); // StateLineStyle
  body.bits(1, 1); // StateFillStyle1
  body.bits(0, 1); // StateFillStyle0
  body.bits(1, 1); // StateMoveTo
  body.bits(moveBits, 5);
  body.bits(xMin, moveBits);
  body.bits(yMin, moveBits);
  body.bits(1, fillBits); // fill style index 1

  // Four StraightEdgeRecords around the rectangle. Each is written as a
  // GENERAL line (both deltas present) rather than the horizontal/vertical
  // special case, because the special case is one more branch for no bytes
  // that matter at this size.
  const edges = [
    [xMax - xMin, 0],
    [0, yMax - yMin],
    [xMin - xMax, 0],
    [0, yMin - yMax]
  ];
  for (const [dx, dy] of edges) {
    const need = Math.max(signedBitsFor(dx), signedBitsFor(dy), 2);
    body.bits(1, 1); // edge record
    body.bits(1, 1); // straight
    body.bits(need - 2, 4);
    // ► **1 IS "GENERAL LINE", AND WRITING 0 HERE COST A RENDER.** The first
    //   version of this wrote 0 under a comment reading "both deltas follow",
    //   which is what 1 means. A reader then takes the vertical/horizontal
    //   branch, consumes ONE delta, and every subsequent bit is shifted:
    //   `tools/swf-shapes.mjs` read this rectangle's first 800-twip edge back
    //   as -448 and then hit what it took for an EndShapeRecord. Ruffle drew a
    //   bare background, which reads as "the player ignored my shape".
    body.bits(1, 1); // GeneralLineFlag: both deltas follow
    body.bits(dx, need);
    body.bits(dy, need);
  }

  body.bits(0, 6); // EndShapeRecord
  body.align();

  return { code: 32, body: body.toBuffer() };
}

/* ------------------------------------------------------------------ *
 * Filters.
 * ------------------------------------------------------------------ */

/**
 * A `GLOWFILTER` record, SWF filter id 2.
 *
 * `blurX`/`blurY` are FIXED (16.16) PIXELS and `strength` is FIXED8 (8.8) —
 * the same two encodings `src/render/filters.js` decodes on the way in, which
 * is the point: a probe that used a different encoding would be measuring this
 * file against itself.
 */
function glowFilter({ colour, blurX, blurY, strength, inner = false, knockout = false, passes = 1 }) {
  const writer = new ByteWriter();
  writer.u8(2);
  writeRgba(writer, colour);
  writer.u32(Math.round(blurX * 65536));
  writer.u32(Math.round(blurY * 65536));
  writer.u16(Math.round(strength * 256));
  writer.bits(inner ? 1 : 0, 1);
  writer.bits(knockout ? 1 : 0, 1);
  writer.bits(1, 1); // CompositeSource, always 1 in a well-formed file
  writer.bits(passes, 5);
  writer.align();
  return writer.toBuffer();
}

/**
 * A `BLURFILTER` record, SWF filter id 1.
 *
 * The sibling of the glow, and it exists here for the same reason the glow
 * ladder does: `canvasFilterFor` maps this one to CSS `blur()`, whose argument
 * IS a standard deviation, where `drop-shadow`'s third length is twice one. The
 * two branches therefore need separate measurements, and deriving the second
 * from the first would be authoring rather than measuring.
 */
function blurFilter({ blurX, blurY, passes = 1 }) {
  const writer = new ByteWriter();
  writer.u8(1);
  writer.u32(Math.round(blurX * 65536));
  writer.u32(Math.round(blurY * 65536));
  writer.bits(passes, 5);
  writer.bits(0, 3); // Reserved
  writer.align();
  return writer.toBuffer();
}

/* ------------------------------------------------------------------ *
 * Placement.
 * ------------------------------------------------------------------ */

/** A MATRIX with translation only — the probes never scale or rotate. */
function writeTranslateMatrix(writer, { x, y }) {
  writer.bits(0, 1); // HasScale
  writer.bits(0, 1); // HasRotate
  const tx = Math.round(x * TWIPS);
  const ty = Math.round(y * TWIPS);
  const nBits = Math.max(signedBitsFor(tx), signedBitsFor(ty));
  writer.bits(nBits, 5);
  writer.bits(tx, nBits);
  writer.bits(ty, nBits);
  writer.align();
  return writer;
}

/**
 * `PlaceObject3` — the tag, because it is the only one that carries a filter
 * list. The two flag bytes are written bit by bit in spec order rather than as
 * two magic constants, so a reader of this file can check them against the
 * table in the SWF specification without decoding hex.
 */
function placeObject3(depth, characterId, { x = 0, y = 0, filters = null } = {}) {
  const body = new ByteWriter();

  body.bits(0, 1); // PlaceFlagHasClipActions
  body.bits(0, 1); // PlaceFlagHasClipDepth
  body.bits(0, 1); // PlaceFlagHasName
  body.bits(0, 1); // PlaceFlagHasRatio
  body.bits(0, 1); // PlaceFlagHasColorTransform
  body.bits(1, 1); // PlaceFlagHasMatrix
  body.bits(1, 1); // PlaceFlagHasCharacter
  body.bits(0, 1); // PlaceFlagMove

  body.bits(0, 1); // Reserved
  body.bits(0, 1); // PlaceFlagOpaqueBackground
  body.bits(0, 1); // PlaceFlagHasVisible
  body.bits(0, 1); // PlaceFlagHasImage
  body.bits(0, 1); // PlaceFlagHasClassName
  body.bits(0, 1); // PlaceFlagHasCacheAsBitmap
  body.bits(0, 1); // PlaceFlagHasBlendMode
  body.bits(filters && filters.length > 0 ? 1 : 0, 1); // PlaceFlagHasFilterList
  body.align();

  body.u16(depth);
  body.u16(characterId);
  writeTranslateMatrix(body, { x, y });

  if (filters && filters.length > 0) {
    body.u8(filters.length);
    for (const filter of filters) body.raw(filter);
  }

  return { code: 70, body: body.toBuffer() };
}

/* ------------------------------------------------------------------ *
 * The movie.
 * ------------------------------------------------------------------ */

/**
 * Assemble an uncompressed SWF.
 *
 * ► **UNCOMPRESSED ON PURPOSE.** A `CWS` body would be one `zlib.deflateSync`
 *   away, and then a probe that a player rejected would have two candidate
 *   causes instead of one. These files are a few hundred bytes.
 */
function buildSwf({ stage, background, tags, frameRate = 30 }) {
  const tagWriter = new ByteWriter();
  for (const tag of tags) writeTag(tagWriter, tag.code, tag.body);
  writeTag(tagWriter, 1, Buffer.alloc(0)); // ShowFrame
  writeTag(tagWriter, 0, Buffer.alloc(0)); // End
  const tagBytes = tagWriter.toBuffer();

  const header = new ByteWriter();
  writeRect(header, {
    xMin: 0,
    xMax: Math.round(stage.width * TWIPS),
    yMin: 0,
    yMax: Math.round(stage.height * TWIPS)
  });
  header.u16(Math.round(frameRate * 256));
  header.u16(1); // FrameCount
  const headerBytes = header.toBuffer();

  const backgroundTag = new ByteWriter();
  writeRgba(backgroundTag, { ...background, alpha: 255 });
  // SetBackgroundColor takes RGB, not RGBA; drop the alpha byte.
  const backgroundBody = backgroundTag.toBuffer().subarray(0, 3);
  const withBackground = new ByteWriter();
  writeTag(withBackground, 9, backgroundBody);
  const backgroundBytes = withBackground.toBuffer();

  const bodyLength = headerBytes.length + backgroundBytes.length + tagBytes.length;
  const fileLength = 8 + bodyLength;

  const out = new ByteWriter();
  out.u8(0x46).u8(0x57).u8(0x53); // "FWS"
  out.u8(8); // SWF 8 — the version that introduced PlaceObject3 and filters
  out.u32(fileLength);
  out.raw(headerBytes);
  out.raw(backgroundBytes);
  out.raw(tagBytes);
  return out.toBuffer();
}

/* ------------------------------------------------------------------ *
 * The two probes.
 * ------------------------------------------------------------------ */

/**
 * THE STAGE-CLIPPING PROBE.
 *
 * A 200x200 stage. One marker rectangle fully INSIDE it, so a render that shows
 * nothing at all is distinguishable from one that clips — the null control this
 * repository's rules require, in the same file as the measurement. Four more
 * rectangles sit wholly OUTSIDE the stage rect, one past each edge, each in its
 * own colour so a render says WHICH edge leaked rather than just "something
 * did".
 *
 * ► **THE OUTSIDE FOUR ARE WHOLLY OUTSIDE, NOT STRADDLING.** A rectangle that
 *   crossed the stage edge would render partly either way and turn a yes/no
 *   question into a measurement of where the cut falls.
 */
export function clipProbe() {
  const stage = { width: 200, height: 200 };
  const shapes = [
    { id: 1, x: 80, y: 80, width: 40, height: 40, fill: { red: 255, green: 255, blue: 255 }, place: null, name: "inside-control" },
    { id: 2, x: 0, y: 0, width: 40, height: 40, fill: { red: 255, green: 0, blue: 0 }, place: { x: 80, y: -80 }, name: "above" },
    { id: 3, x: 0, y: 0, width: 40, height: 40, fill: { red: 0, green: 255, blue: 0 }, place: { x: 80, y: 240 }, name: "below" },
    { id: 4, x: 0, y: 0, width: 40, height: 40, fill: { red: 0, green: 0, blue: 255 }, place: { x: -80, y: 80 }, name: "left" },
    { id: 5, x: 0, y: 0, width: 40, height: 40, fill: { red: 255, green: 255, blue: 0 }, place: { x: 240, y: 80 }, name: "right" }
  ];

  const tags = [];
  let depth = 1;
  for (const shape of shapes) {
    tags.push(defineShape3(shape.id, shape));
    tags.push(placeObject3(depth, shape.id, shape.place ?? { x: 0, y: 0 }));
    depth += 1;
  }

  return {
    swf: buildSwf({ stage, background: { red: 24, green: 24, blue: 24 }, tags }),
    stage,
    legend: shapes.map(({ id, name, fill, place }) => ({ id, name, fill, place }))
  };
}

/**
 * THE GLOW-STRENGTH LADDER.
 *
 * Six identical white squares in a row, each under a GlowFilter identical in
 * colour and blur and differing ONLY in `strength`. The whole question is what
 * `strength` does once the alpha it would scale has already reached 1, so the
 * ladder deliberately spans both sides of that clamp: 0.5 is below it, 1 is at
 * it, and 2/4/10/16 are above — 10 being the value 277 of the build's own glows
 * carry and 16 being where `psyche_up2` tops out.
 *
 * ► **WHAT THIS ISOLATES, AND WHY ONE FRAME OF THE REAL GAME COULD NOT.**
 *   `weapon0` frame 5 offers ONE strength on ONE shape under ONE blur. The
 *   difference `canvasFilterFor` is suspected of losing is a difference BETWEEN
 *   strengths, so a single sample cannot show it however carefully it is read.
 *   Six samples in one frame, sharing a rasteriser, a scale and a background,
 *   differ in exactly one input.
 */
export function glowProbe() {
  const strengths = [0.5, 1, 2, 4, 10, 16];
  const cell = 100;
  const box = 24;
  const stage = { width: cell * strengths.length, height: cell };

  const tags = [];
  // One shape definition, placed six times: the SOURCE is then provably
  // identical across the ladder, which a per-cell DefineShape could not be.
  tags.push(defineShape3(1, { x: 0, y: 0, width: box, height: box, fill: { red: 255, green: 255, blue: 255 } }));

  strengths.forEach((strength, index) => {
    tags.push(placeObject3(index + 1, 1, {
      x: index * cell + (cell - box) / 2,
      y: (cell - box) / 2,
      filters: [glowFilter({
        colour: { red: 0, green: 204, blue: 255, alpha: 255 },
        blurX: 8,
        blurY: 8,
        strength,
        passes: 1
      })]
    }));
  });

  return {
    swf: buildSwf({ stage, background: { red: 0, green: 0, blue: 0 }, tags }),
    stage,
    strengths,
    cell,
    box
  };
}

/**
 * THE BLUR-WIDTH LADDER — the control on the strength ladder's conclusion.
 *
 * The glow probe varies `strength` at a fixed `blurX` of 8. Fitting anything to
 * it alone would produce a constant that happens to be right at one width, and
 * "a table that is correct wherever it cannot be wrong reads as a table that
 * was checked" is a sentence this repository has already had to write.
 *
 * So this varies `blurX` = `blurY` at a FIXED strength of 1, over the widths
 * the build actually uses — its 859 blur-bearing filter records cluster on 2,
 * 4, 5, 11 and 56, with 0 and 48 at the ends — and lets the question "is the
 * right radius proportional to the width, or is it a number that fitted once"
 * be answered by measurement.
 *
 * Cell width scales with the blur so the widest glow still has room: at
 * `blurX` 56 a glow reaching half the blur width would otherwise run into its
 * neighbour and the two would be measured as one.
 */
export function blurProbe() {
  const widths = [2, 4, 8, 16, 32, 48];
  const cell = 160;
  const box = 24;
  const stage = { width: cell * widths.length, height: cell };

  const tags = [];
  tags.push(defineShape3(1, { x: 0, y: 0, width: box, height: box, fill: { red: 255, green: 255, blue: 255 } }));
  widths.forEach((width, index) => {
    tags.push(placeObject3(index + 1, 1, {
      x: index * cell + (cell - box) / 2,
      y: (cell - box) / 2,
      filters: [glowFilter({
        colour: { red: 0, green: 204, blue: 255, alpha: 255 },
        blurX: width,
        blurY: width,
        strength: 1,
        passes: 1
      })]
    }));
  });

  return {
    swf: buildSwf({ stage, background: { red: 0, green: 0, blue: 0 }, tags }),
    stage,
    widths,
    strengths: widths,
    cell,
    box
  };
}

/**
 * THE PLAIN-BLUR LADDER — the `blur()` branch, which the glow ladder does not
 * cover.
 *
 * `canvasFilterFor` sends `glow`/`dropShadow` to `drop-shadow()` and `blur` to
 * `blur()`, and the two CSS functions take their length in DIFFERENT units: a
 * standard deviation for `blur()`, twice one for `drop-shadow()`. So a
 * correction measured on one says nothing about the other, and this ladder is
 * what stops the second from being derived from the first.
 *
 * The source is CYAN rather than white: a blur has no colour of its own, so the
 * only thing that reads outward from the edge is the source's own colour spread
 * over the background, and a white source on black would be measured on all
 * three channels at once.
 */
export function plainBlurProbe() {
  const widths = [2, 4, 8, 16, 32, 48];
  const cell = 160;
  const box = 24;
  const stage = { width: cell * widths.length, height: cell };

  const tags = [];
  tags.push(defineShape3(1, { x: 0, y: 0, width: box, height: box, fill: { red: 0, green: 204, blue: 255 } }));
  widths.forEach((width, index) => {
    tags.push(placeObject3(index + 1, 1, {
      x: index * cell + (cell - box) / 2,
      y: (cell - box) / 2,
      filters: [blurFilter({ blurX: width, blurY: width, passes: 1 })]
    }));
  });

  return {
    swf: buildSwf({ stage, background: { red: 0, green: 0, blue: 0 }, tags }),
    stage,
    widths,
    strengths: widths,
    cell,
    box
  };
}

/* ------------------------------------------------------------------ *
 * Self-test — the writer read back by this repository's own reader.
 * ------------------------------------------------------------------ */

/**
 * Round-trip both probes through `tools/swf-display-list.mjs`.
 *
 * ► **THIS IS THE CHECK THAT MATTERS BEFORE RUFFLE IS BLAMED.** If a probe
 *   renders as an empty stage, the first question is whether the file is well
 *   formed, and "Ruffle drew nothing" is not evidence about the player until
 *   something else has read the file successfully. The reader used here is the
 *   one the extractors already trust on 7.5MB of the real build.
 */
export async function selfTest() {
  const { tagStreamStart, walkTags, indexCharacters, parsePlaceObject, TAG } =
    await import("./swf-display-list.mjs");
  const { parseShape, shapeToPaths } = await import("./swf-shapes.mjs");
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };

  const clip = clipProbe();
  const glow = glowProbe();

  for (const [name, probe, wantShapes, wantPlacements] of [
    ["clip", clip, 5, 5],
    ["glow", glow, 1, glow.strengths.length]
  ]) {
    const buffer = probe.swf;

    // The header, decoded by the reader's own cursor arithmetic rather than by
    // this file's — the writer must not be the only thing that agrees with it.
    const start = tagStreamStart(buffer);
    check(start > 8, `${name}: tagStreamStart returned ${start}`);

    const characters = indexCharacters(buffer);
    check(characters.characters.size === wantShapes,
      `${name}: reader found ${characters.characters.size} character(s), wrote ${wantShapes}`);

    // ► **THE GEOMETRY, NOT JUST THE COUNT — this is the check that was
    //   missing when Ruffle drew a bare background.** A malformed shape record
    //   still declares a correct RECT and a correct fill, so a self-test that
    //   read only those passed while the edges were desynchronised. Walking
    //   the decoded path back to a bounding box and comparing it against the
    //   DECLARED bounds is the one assertion the defect could not survive:
    //   the two are written from the same numbers by different code paths.
    for (const [id, character] of characters.characters) {
      let paths;
      try {
        paths = shapeToPaths(parseShape(buffer, character.bodyStart, character.bodyEnd, character.tagCode));
      } catch (error) {
        failures.push(`${name}: shape ${id} failed to parse: ${error.message}`);
        continue;
      }
      if (paths.length !== 1) {
        failures.push(`${name}: shape ${id} decoded to ${paths.length} path(s), wrote 1`);
        continue;
      }
      const numbers = (paths[0].d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
      const xs = numbers.filter((_, i) => i % 2 === 0);
      const ys = numbers.filter((_, i) => i % 2 === 1);
      const got = { xMin: Math.min(...xs) * TWIPS, xMax: Math.max(...xs) * TWIPS, yMin: Math.min(...ys) * TWIPS, yMax: Math.max(...ys) * TWIPS };
      const declared = parseShape(buffer, character.bodyStart, character.bodyEnd, character.tagCode).bounds;
      for (const edge of ["xMin", "xMax", "yMin", "yMax"]) {
        if (Math.abs(got[edge] - declared[edge]) > 1) {
          failures.push(`${name}: shape ${id} path ${edge} decoded to ${got[edge]} twips, declared ${declared[edge]}`);
        }
      }
    }

    let placements = 0;
    let filtersSeen = 0;
    const strengthsRead = [];
    for (const tag of walkTags(buffer, start, buffer.length)) {
      if (tag.code !== TAG.PLACE_OBJECT3 && tag.code !== 70) continue;
      const placed = parsePlaceObject(buffer, tag.bodyStart, tag.bodyEnd, tag.code);
      placements += 1;
      for (const filter of placed.filters ?? []) {
        filtersSeen += 1;
        if (filter.type === "glow") strengthsRead.push(filter.strength);
      }
    }
    check(placements === wantPlacements,
      `${name}: reader found ${placements} placement(s), wrote ${wantPlacements}`);

    if (name === "glow") {
      check(filtersSeen === glow.strengths.length,
        `glow: reader found ${filtersSeen} filter(s), wrote ${glow.strengths.length}`);
      // ► THE ONE THAT MATTERS: `strength` is FIXED8, so the ladder must come
      //   back EXACTLY. If it does not, every number this probe later produces
      //   is a measurement of the writer.
      const wanted = glow.strengths.join(",");
      const got = strengthsRead.join(",");
      check(wanted === got, `glow: strengths read back as [${got}], wrote [${wanted}]`);
    }
  }

  // The stage rect, read back by hand from the header, because `tagStreamStart`
  // deliberately skips it rather than returning it.
  for (const [name, probe] of [["clip", clip], ["glow", glow]]) {
    const nbits = probe.swf[8] >>> 3;
    const bits = [];
    for (let byte = 8; byte < 8 + Math.ceil((5 + nbits * 4) / 8); byte += 1) {
      for (let bit = 7; bit >= 0; bit -= 1) bits.push((probe.swf[byte] >> bit) & 1);
    }
    const field = (index) => bits.slice(5 + index * nbits, 5 + (index + 1) * nbits)
      .reduce((acc, bit) => acc * 2 + bit, 0);
    check(field(1) === probe.stage.width * TWIPS,
      `${name}: stage width read back as ${field(1) / TWIPS}, wrote ${probe.stage.width}`);
    check(field(3) === probe.stage.height * TWIPS,
      `${name}: stage height read back as ${field(3) / TWIPS}, wrote ${probe.stage.height}`);
  }

  return failures;
}

/* ------------------------------------------------------------------ */

function main(argv) {
  const which = argv[0];
  const outIndex = argv.indexOf("--out");
  const outDir = outIndex >= 0 ? argv[outIndex + 1] : null;

  if (which === "--self-test") {
    return selfTest().then((failures) => {
      for (const failure of failures) console.error(`FAIL ${failure}`);
      console.log(failures.length === 0 ? "swf-probe self-test: OK" : `swf-probe self-test: ${failures.length} failure(s)`);
      process.exitCode = failures.length === 0 ? 0 : 1;
    });
  }

  if (!outDir) {
    console.error("usage: node tools/swf-probe.mjs <clip|glow|both> --out <dir>");
    process.exitCode = 2;
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const wanted = which === "both" || which === undefined ? ["clip", "glow", "blur", "plainblur"] : [which];

  for (const name of wanted) {
    const probe = name === "clip" ? clipProbe()
      : name === "blur" ? blurProbe()
      : name === "plainblur" ? plainBlurProbe()
      : glowProbe();
    const file = path.join(outDir, `probe-${name}.swf`);
    fs.writeFileSync(file, probe.swf);
    const { swf, ...meta } = probe;
    fs.writeFileSync(path.join(outDir, `probe-${name}.json`), `${JSON.stringify(meta, null, 2)}\n`);
    console.log(`${file}  ${probe.swf.length} bytes  stage ${probe.stage.width}x${probe.stage.height}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main(process.argv.slice(2));
}
