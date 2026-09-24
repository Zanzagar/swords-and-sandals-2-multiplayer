/**
 * THE PROPS EXTRACTOR, AND IN PARTICULAR THE EFFECTS IT USED TO THROW AWAY.
 *
 * ► **WHY THIS FILE EXISTS AT ALL.** `flattenFrame` returns `filters`,
 *   `blendMode` and `ancestorEffects` on every drawable, and until today
 *   `tools/extract-props.mjs` read the matrix, the colour transform and the
 *   mask and dropped all three. The arena page said so in its own words —
 *   *"props: NO filter data in the pack"* — and it was right, because there was
 *   none. Nothing had been fabricated to make the picture prettier, which was
 *   the correct call; the fix is to carry what the display list actually
 *   returns and to COUNT what cannot be carried.
 *
 * ► **AND THE FIRST THING MEASURING IT BROKE WAS THE BRIEF THAT ASKED FOR IT.**
 *   Re-measured on the installed build: **ZERO of the ~~3,345~~ 3,574
 *   placements this tool EMITS carries a filter or a blend mode of its OWN.**
 *   Every effect the pack can draw is on an ENCLOSING SPRITE — ~~363~~ 366
 *   groups, ~~570~~ 573 filters, 1 blend mode (**corrected 2026-09-24**: the
 *   struck numbers are the 12-prop pack's; see the list at the end of this
 *   note) — so "carry `drawable.filters` onto the placement" writes nothing at
 *   all and reports success. The tests below are built around that split,
 *   because it is the whole difficulty: **an ancestor's blur on a leaf is worse
 *   than a dropped one**, and the two live one property apart on the same
 *   object.
 *
 * ► **AND THE SECOND THING IT BROKE WAS THAT ZERO.** ~~*So every own filter in
 *   the build is absent.*~~ The flatten returns **3,436 drawables (the 12-prop
 *   pack's; dated in `tools/extract-props.mjs`'s header), 2 of them refused as
 *   `unsupported`, and BOTH of those carry their own glow** — `panel` frame 1's
 *   edit-text children 1527 and 1528. They were skipped above `ownEffectsOf`
 *   and counted nowhere, so the zero was a measurement of the extractor's skip
 *   list and could not have come back non-zero for any input in this build.
 *   Three tests below exist only because of that, and the rule they encode is
 *   this project's own: **a zero meaning "none exist" and a zero meaning "I
 *   dropped them before looking" must not look the same.**
 *
 * ► **NOTHING HERE COMES FROM THE LICENSED BUILD.** `Swf` below assembles the
 *   specification's own encoding, for the reason `test/extract-figure.test.js`,
 *   `test/swf-shapes.test.js` and `test/swf-display-list.test.js` all give: a
 *   fixture of real bytes would put extracted art in the repository, which is
 *   the one thing `assets/` exists to prevent. It is deliberately a SEPARATE
 *   writer from the three in those files — importing one test's fixture
 *   builder into another makes a shared wrong assumption look like agreement.
 *
 *   It also means these tests have teeth on a FRESH CLONE. The trap they are
 *   built to avoid is the one that cost `test/extraction-honesty.test.js` its
 *   cover: a test whose only guard reads the gitignored on-disk pack runs
 *   `assert.equal(null, null)` where there is no licensed copy, and passes
 *   while asserting nothing. The one check here that does read the pack says
 *   which half of itself ran, and is anchored on a TRACKED file so that a
 *   broken path derivation fails by name instead of reading as "no extraction".
 *
 *   **AND IT WALKED INTO THE SAME TRAP ONE BRANCH FURTHER DOWN.** That check
 *   used to return early on `if (!manifest.effects)` — the state of every pack
 *   written before the invoice existed — so on the only machine that can run
 *   it, the sole assertion it executed was `fs.existsSync(extract-props.mjs)`,
 *   and it passed with the whole extractor reverted to HEAD. Avoiding the
 *   fresh-clone form of a trap is not avoiding the trap. It now asserts on BOTH
 *   branches: an old pack is checked against what an old pack has, and says so.
 *
 * What the real build contributes is numbers, quoted and not stored: ~~12~~ 15
 * props, ~~302~~ 312 frames, ~~3,345~~ 3,574 placements, ~~56~~ 87 shapes,
 * ~~258~~ 604 paths, 11 approximated, ~~363~~ 366 effect groups over ~~3,209~~
 * 3,258 placements, ~~570~~ 573 filters (~~150~~ 151 colourMatrix, 208 blur,
 * ~~212~~ 214 glow) and one blend mode — `lighten`, on the arrow trail.
 * Reproduce with
 * `node tools/extract-props.mjs --out <somewhere outside the repo> --report`,
 * never by committing a fixture.
 *
 * **CORRECTED 2026-09-24: THE STRUCK NUMBERS ARE THE 12-PROP PACK'S**, before
 * `lightning_bolt_combat`, `fireball_combat` (2026-09-22) and `boulder_combat`
 * (2026-09-23). Re-derived from the player's own pack, read-only and without
 * running the extractor: the placements are 3,356 in `frames` and 218 in the
 * three clocks' `framesByParent`, and the grouped ones 3,212 and 46, because
 * this tool emits both (the manifest's `placementsUnderAGroup` is the 3,258);
 * the 87 shapes are 69 characters and 18 baked morphs, every one reached. The
 * same counts with the three spell props left out give every struck number
 * exactly, the 56 shapes and 258 paths included.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PROP_EXPORTS, extractProps, tallyEffects, manifestFor } from "../tools/extract-props.mjs";
// The OWNER of the filter verdicts, imported so this file compares the pack's
// invoice against the renderer itself rather than against a second copy of its
// opinions — which is the arrangement that makes the invoice worth reading.
import { canvasFilterFor } from "../src/render/filters.js";
// The READER of the pack, imported for one reason: a baked morph is only worth
// carrying if the renderer draws it with no second code path, and the only way
// to show that is to hand the extractor's own output to the renderer.
import { fireballOpsFor, propOpsFor, propPackFrom } from "../src/render/props.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/* ────────────────────────────  the synthetic build  ──────────────────────── */

class Swf {
  constructor() { this.bytes = []; this.current = 0; this.bitCount = 0; }
  bit(value) {
    this.current = (this.current << 1) | (value ? 1 : 0);
    this.bitCount += 1;
    if (this.bitCount === 8) { this.bytes.push(this.current & 0xff); this.current = 0; this.bitCount = 0; }
    return this;
  }
  ub(value, bits) { for (let index = bits - 1; index >= 0; index -= 1) this.bit((value >>> index) & 1); return this; }
  sb(value, bits) { return this.ub(value < 0 ? (1 << bits) + value : value, bits); }
  align() { while (this.bitCount !== 0) this.bit(0); return this; }
  u8(value) { this.align(); this.bytes.push(value & 0xff); return this; }
  u16(value) { this.align(); this.bytes.push(value & 0xff, (value >>> 8) & 0xff); return this; }
  u32(value) {
    this.align();
    this.bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
    return this;
  }
  /** FIXED is 16.16 and FIXED8 is 8.8 — the two a filter's fields are written in. */
  fixed(value) { this.align(); const buffer = Buffer.alloc(4); buffer.writeInt32LE(Math.round(value * 65536)); return this.raw(buffer); }
  fixed8(value) { this.align(); const buffer = Buffer.alloc(2); buffer.writeInt16LE(Math.round(value * 256)); return this.raw(buffer); }
  float(value) { this.align(); const buffer = Buffer.alloc(4); buffer.writeFloatLE(value); return this.raw(buffer); }
  string(value) {
    this.align();
    for (const byte of Buffer.from(value, "utf8")) this.bytes.push(byte);
    this.bytes.push(0);
    return this;
  }
  raw(bytes) { this.align(); for (const byte of bytes) this.bytes.push(byte); return this; }
  rgba({ red = 0, green = 0, blue = 0, alpha = 255 } = {}) { return this.u8(red).u8(green).u8(blue).u8(alpha); }

  /** A RECT is as wide as its widest field says it is, which is why this measures. */
  rect(xMin = 0, xMax = 0, yMin = 0, yMax = 0) {
    this.align();
    const needed = Math.max(1, ...[xMin, xMax, yMin, yMax].map((value) => {
      let bits = 1;
      while (value < -(2 ** (bits - 1)) || value > 2 ** (bits - 1) - 1) bits += 1;
      return bits;
    }));
    this.ub(needed, 5);
    this.sb(xMin, needed).sb(xMax, needed).sb(yMin, needed).sb(yMax, needed);
    return this.align();
  }

  /** A MATRIX. `b` is RotateSkew0 and `c` is RotateSkew1 — the wire's order. */
  matrix({ a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0 } = {}) {
    this.align();
    const fixed = (value) => Math.round(value * 65536);
    const width = (...values) => Math.max(1, ...values.map((value) => {
      let bits = 1;
      while (value < -(2 ** (bits - 1)) || value > 2 ** (bits - 1) - 1) bits += 1;
      return bits;
    }));
    const hasScale = a !== 1 || d !== 1;
    this.bit(hasScale ? 1 : 0);
    if (hasScale) { const bits = width(fixed(a), fixed(d)); this.ub(bits, 5).sb(fixed(a), bits).sb(fixed(d), bits); }
    const hasRotate = b !== 0 || c !== 0;
    this.bit(hasRotate ? 1 : 0);
    if (hasRotate) { const bits = width(fixed(b), fixed(c)); this.ub(bits, 5).sb(fixed(b), bits).sb(fixed(c), bits); }
    const translate = width(tx, ty);
    this.ub(translate, 5).sb(tx, translate).sb(ty, translate);
    return this.align();
  }

  /**
   * ONE filter, field for field, with EVERY field distinct and none zero unless
   * the caller asks for a zero — so a decoder reading the right number of bytes
   * from the wrong offsets fails here rather than looking plausible.
   */
  filter({
    id,
    colour = { red: 10, green: 20, blue: 30, alpha: 200 },
    highlight = { red: 255, green: 255, blue: 255, alpha: 255 },
    shadow = { red: 160, green: 96, blue: 1, alpha: 255 },
    blurX = 5.5, blurY = 6.25, angle = 0.75, distance = -6, strength = 1.5,
    flags = 0x21, matrix = null
  }) {
    this.u8(id);
    if (id === 0) this.rgba(colour).fixed(blurX).fixed(blurY).fixed(angle).fixed(distance).fixed8(strength).u8(flags);
    else if (id === 1) this.fixed(blurX).fixed(blurY).u8(flags);
    else if (id === 2) this.rgba(colour).fixed(blurX).fixed(blurY).fixed8(strength).u8(flags);
    // Highlight FIRST — see `parseFilterList`'s own note and the 54 bevels in
    // the shipped build that measure it against the specification's table.
    else if (id === 3) {
      this.rgba(highlight).rgba(shadow)
        .fixed(blurX).fixed(blurY).fixed(angle).fixed(distance).fixed8(strength).u8(flags);
    } else if (id === 6) {
      const cells = matrix ?? Array.from({ length: 20 }, (value, index) => (index + 1) / 8);
      for (const cell of cells) this.float(cell);
    } else throw new Error(`this test writer has no filter ${id}`);
    return this;
  }

  filterList(filters) {
    this.align();
    this.u8(filters.length);
    for (const filter of filters) this.filter(filter);
    return this;
  }

  buffer() { this.align(); return Buffer.from(this.bytes); }
}

/** One tag: a 10-bit code and a length that grows to 32 bits past 62 bytes. */
function swfTag(code, body) {
  const writer = new Swf();
  const bytes = Buffer.isBuffer(body) ? body : body.buffer();
  if (bytes.length >= 0x3f) writer.u16((code << 6) | 0x3f).u32(bytes.length);
  else writer.u16((code << 6) | bytes.length);
  return writer.raw(bytes).buffer();
}

/** A whole uncompressed FWS file around a tag stream. */
function swfFile(tags) {
  const header = new Swf();
  header.raw(Buffer.from("FWS", "latin1")).u8(6).u32(0).rect(0, 11000, 0, 8000).u16(24 << 8).u16(1);
  return Buffer.concat([header.buffer(), ...tags, swfTag(0, Buffer.alloc(0))]);
}

/** A closed square, written as an edge stream with fill style 1 on its left. */
function squareEdges(writer, size) {
  writer.ub(1, 4).ub(0, 4);
  writer.bit(0).ub(0b00101, 5);
  writer.ub(10, 5).sb(0, 10).sb(0, 10);
  writer.ub(1, 1);
  const edge = (dx, dy) => writer.bit(1).bit(1).ub(10 - 2, 4).bit(1).sb(dx, 10).sb(dy, 10);
  edge(size, 0); edge(0, size); edge(-size, 0); edge(0, -size);
  writer.bit(0).ub(0, 5);
}

/** DefineShape3 with ONE solid RGBA fill. */
function solidShape(id, [red, green, blue, alpha]) {
  const writer = new Swf();
  writer.u16(id).rect(0, 200, 0, 200);
  writer.u8(1).u8(0x00).rgba({ red, green, blue, alpha });
  writer.u8(0);
  squareEdges(writer, 200);
  return swfTag(32, writer);
}

/** DefineShape3 with ONE LINEAR GRADIENT fill, which `shapeToPaths` approximates. */
function gradientShape(id) {
  const writer = new Swf();
  writer.u16(id).rect(0, 200, 0, 200);
  writer.u8(1).u8(0x10);
  writer.align().bit(0).bit(0).ub(0, 5).align();
  writer.u8(2);
  writer.u8(0).rgba({ red: 0x10, green: 0x20, blue: 0x30 });
  writer.u8(255).rgba({ red: 0x90, green: 0xa0, blue: 0xb0 });
  writer.u8(0);
  squareEdges(writer, 200);
  return swfTag(32, writer);
}

/**
 * A `PlaceObject2` body, field by field in the specification's order.
 *
 * `move` sets `PlaceFlagMove` and `ratio` sets `PlaceFlagHasRatio`, whose UI16
 * sits AFTER the colour transform and BEFORE the name — the order a morph's
 * interpolation reaches the wire in. Both absent writes exactly the bytes this
 * helper wrote before they existed, so every older fixture is unchanged.
 */
function place2({ depth, characterId, matrix, name, move = false, ratio }) {
  const writer = new Swf();
  let flags = 0;
  if (move) flags |= 0x01;
  if (characterId !== undefined) flags |= 0x02;
  if (matrix) flags |= 0x04;
  if (ratio !== undefined) flags |= 0x10;
  if (name !== undefined) flags |= 0x20;
  writer.u8(flags).u16(depth);
  if (characterId !== undefined) writer.u16(characterId);
  if (matrix) writer.matrix(matrix);
  if (ratio !== undefined) writer.u16(ratio);
  if (name !== undefined) writer.string(name);
  return swfTag(26, writer);
}

/**
 * ONE MORPH EDGE STREAM: a move to `(x, y)`, fill style 1 on the left, then one
 * straight edge per delta. 12-bit fields, so a 1,000-twip square fits.
 *
 * Its own writer rather than `squareEdges` above, because that one is 10-bit
 * and starts at the origin, and a morph whose two ends start at the same point
 * could not tell a translated end from an untranslated one.
 */
function morphEdges(x, y, deltas) {
  const writer = new Swf();
  writer.ub(1, 4).ub(0, 4);
  writer.bit(0).ub(0b00101, 5);
  writer.ub(12, 5).sb(x, 12).sb(y, 12);
  writer.ub(1, 1);
  for (const [dx, dy] of deltas) writer.bit(1).bit(1).ub(12 - 2, 4).bit(1).sb(dx, 12).sb(dy, 12);
  writer.bit(0).ub(0, 5);
  return writer.buffer();
}
const squareDeltas = (size) => [[size, 0], [0, size], [-size, 0], [0, -size]];

/**
 * A `DefineMorphShape` (tag 46 — per `tools/swf-morph-shapes.mjs`'s own census,
 * the only morph tag the shipped build has) of a SQUARE THAT GROWS AND MOVES
 * AND CHANGES COLOUR:
 *
 * ```text
 *   start  a 200-twip square at (0, 0)      solid #cc0000
 *   end    a 1000-twip square at (100, 100) solid #0000cc
 * ```
 *
 * Every expected coordinate in the tests below is lerped BY HAND from those
 * numbers, never read back from `morphShapeAt`. The header's offset to
 * `EndEdges` is MEASURED from the bytes written, so a wrong style array fails
 * the parser's own offset check instead of drawing something plausible.
 * `endDeltas` lets a test write an end stream that does not pair.
 */
function defineMorph(id, { endDeltas = squareDeltas(1000) } = {}) {
  const startStream = morphEdges(0, 0, squareDeltas(200));
  const endStream = morphEdges(100, 100, endDeltas);
  const styles = new Swf();
  styles.u8(1).u8(0x00)
    .rgba({ red: 0xcc, green: 0, blue: 0, alpha: 0xff })
    .rgba({ red: 0, green: 0, blue: 0xcc, alpha: 0xff });
  styles.u8(0);
  const styleBytes = styles.buffer();
  const writer = new Swf();
  writer.u16(id).rect(0, 200, 0, 200).rect(100, 1100, 100, 1100);
  writer.u32(styleBytes.length + startStream.length);
  writer.raw(styleBytes).raw(startStream).raw(endStream);
  return swfTag(46, writer);
}

/**
 * THE SAME SQUARE AT THREE RATIOS, derived by hand: a corner at ratio `t` is
 * `start + t * (end - start)` in twips, then divided by 20.
 *
 * ```text
 *   ratio      t     top-left (twips)   bottom-right (twips)   colour
 *   0          0     (0, 0)             (200, 200)              #cc0000
 *   13107      0.2   (20, 20)           (380, 380)              #a30029  (204*0.8=163.2, 204*0.2=40.8)
 *   65535      1     (100, 100)         (1100, 1100)            #0000cc
 * ```
 *
 * 13107 is 65535 / 5 EXACTLY, which is why it is the intermediate ratio: `t`
 * comes out a round 0.2 and every corner a whole number of twips.
 */
const MORPH_AT = Object.freeze({
  0: { d: "M0 0L10 0L10 10L0 10L0 0Z", fill: "#cc0000", bounds: { xMin: 0, xMax: 10, yMin: 0, yMax: 10 } },
  13107: { d: "M1 1L19 1L19 19L1 19L1 1Z", fill: "#a30029", bounds: { xMin: 1, xMax: 19, yMin: 1, yMax: 19 } },
  65535: { d: "M5 5L55 5L55 55L5 55L5 5Z", fill: "#0000cc", bounds: { xMin: 5, xMax: 55, yMin: 5, yMax: 55 } }
});

/**
 * A `PlaceObject3` body, in the SPECIFICATION's order and not the flag order:
 * FILTERLIST sits between ClipDepth and BlendMode, which is the seam a parser
 * that guesses a filter list's length desynchronises on.
 */
function place3({ depth, characterId, matrix, name, clipDepth, filters, blendMode }) {
  const writer = new Swf();
  let flags = 0;
  let flags2 = 0;
  if (characterId !== undefined) flags |= 0x02;
  if (matrix) flags |= 0x04;
  if (name !== undefined) flags |= 0x20;
  if (clipDepth !== undefined) flags |= 0x40;
  if (filters) flags2 |= 0x01;
  if (blendMode !== undefined) flags2 |= 0x02;
  writer.u8(flags).u8(flags2).u16(depth);
  if (characterId !== undefined) writer.u16(characterId);
  if (matrix) writer.matrix(matrix);
  if (name !== undefined) writer.string(name);
  if (clipDepth !== undefined) writer.u16(clipDepth);
  if (filters) writer.filterList(filters);
  if (blendMode !== undefined) writer.u8(blendMode);
  return swfTag(70, writer);
}

/**
 * A `DefineEditText`, which is the ONLY reason this helper exists: it is the
 * cheapest character whose `kind` makes `flattenFrame` return
 * `unsupported: "text"`, and `panel`'s two of them are the build's only
 * own-filtered placements. `indexCharacters` reads the id and nothing else off
 * this tag, and the props extractor never parses the body, so two bytes is a
 * faithful fixture rather than a stub — it exercises the same branch the
 * installed build does.
 */
const defineEditText = (id) => swfTag(37, new Swf().u16(id).rect(0, 200, 0, 40));

const showFrame = () => swfTag(1, Buffer.alloc(0));
const removeObject2 = (depth) => swfTag(28, new Swf().u16(depth));
const defineSprite = (id, frames, inner) =>
  swfTag(39, new Swf().u16(id).u16(frames).raw(Buffer.concat([...inner, swfTag(0, Buffer.alloc(0))])));
const exportAssets = (pairs) => {
  const writer = new Swf();
  writer.u16(pairs.length);
  for (const [id, name] of pairs) writer.u16(id).string(name);
  return swfTag(56, writer);
};

/** The blur, glow, bevel and colour matrix this build is built out of. */
const BLUR = { id: 1, blurX: 5.5, blurY: 6.25 };
const GLOW = { id: 2, strength: 1.5 };
const DEAD_GLOW = { id: 2, strength: 0 };
const BEVEL = { id: 3 };
const COLOUR_MATRIX = { id: 6 };

/**
 * A build carrying one of every case the extractor has to tell apart.
 *
 * The characters are the ones `PROP_EXPORTS` names — by linkage where the
 * build exports one and by character id where it does not — so `extractProps`
 * finds ~~twelve~~ fifteen props here exactly as it finds ~~twelve~~ fifteen in
 * the installed copy (corrected 2026-09-24: the first test below asserts the
 * fifteen here, and the player's own pack holds fifteen).
 */
function propsBuild() {
  return swfFile([
    solidShape(900, [0xff, 0x00, 0x00, 0xff]),
    gradientShape(901),
    solidShape(902, [0x00, 0xff, 0x00, 0xff]),
    solidShape(903, [0x00, 0x00, 0xff, 0xff]),

    // Three leaves inside one sprite, so a group can be measured against the
    // number of leaves it encloses rather than against one.
    defineSprite(911, 1, [
      place2({ depth: 1, characterId: 900 }),
      place2({ depth: 2, characterId: 900, matrix: { tx: 40 } }),
      place2({ depth: 3, characterId: 900, matrix: { tx: 80 } }),
      showFrame()
    ]),
    defineSprite(913, 1, [place2({ depth: 1, characterId: 900 }), showFrame()]),
    defineSprite(914, 1, [place2({ depth: 1, characterId: 903 }), showFrame()]),
    defineSprite(917, 1, [place2({ depth: 1, characterId: 900 }), showFrame()]),

    // `bullet`: the placement's OWN filters and blend mode.
    defineSprite(910, 1, [
      place3({ depth: 1, characterId: 900, filters: [BLUR, COLOUR_MATRIX], blendMode: 3 }),
      showFrame()
    ]),
    // `bullet_trail`: an ENCLOSING sprite carries the glow; the three leaves
    // inside it carry nothing of their own.
    defineSprite(912, 1, [place3({ depth: 1, characterId: 911, filters: [GLOW] }), showFrame()]),
    // `blood`: the SAME depth on two frames holding two DIFFERENT filtered
    // sprites — the case a path-keyed dedupe merges and loses.
    defineSprite(915, 2, [
      place3({ depth: 3, characterId: 913, filters: [GLOW] }),
      showFrame(),
      removeObject2(3),
      place3({ depth: 3, characterId: 914, filters: [BLUR] }),
      showFrame()
    ]),
    // `sparks`: a filter list of COUNT ZERO — "this instance's filters were
    // cleared", which is not the same fact as "nobody asked".
    defineSprite(916, 1, [place3({ depth: 1, characterId: 900, filters: [] }), showFrame()]),
    // `rockMC`: a filtered MASK over an ordinary shape.
    defineSprite(35, 1, [
      place3({ depth: 1, characterId: 902, clipDepth: 2, filters: [BLUR] }),
      place2({ depth: 2, characterId: 900 }),
      showFrame()
    ]),
    // `sky`: a group whose three filters get three DIFFERENT verdicts out of
    // `canvasFilterFor` — deferred, refused, and a measured no-op.
    defineSprite(1729, 1, [
      place3({ depth: 1, characterId: 917, filters: [COLOUR_MATRIX, BEVEL, DEAD_GLOW] }),
      showFrame()
    ]),
    defineSprite(643, 1, [place2({ depth: 1, characterId: 900 }), showFrame()]),
    // `sand` reaches the gradient, so the pack holds an approximated path.
    defineSprite(673, 1, [place2({ depth: 1, characterId: 901 }), showFrame()]),
    defineSprite(2112, 1, [place2({ depth: 1, characterId: 900 }), showFrame()]),
    defineSprite(1816, 1, [place2({ depth: 1, characterId: 900 }), showFrame()]),
    defineSprite(1531, 1, [place2({ depth: 1, characterId: 900 }), showFrame()]),
    defineSprite(646, 1, [place2({ depth: 1, characterId: 900 }), showFrame()]),
    // `lightning_bolt_combat`: a two-frame bolt over a looping child, under the
    // oracle's own character ids (12 and 10) because the entry declares them.
    defineSprite(10, 2, [
      place2({ depth: 1, characterId: 900 }), showFrame(),
      removeObject2(1), place2({ depth: 1, characterId: 902 }), showFrame()
    ]),
    defineSprite(12, 2, [
      place2({ depth: 1, characterId: 10 }), showFrame(),
      place2({ depth: 4, characterId: 903 }), showFrame()
    ]),
    // `fireball_combat` (added 2026-09-22): four frames, the explosion child on
    // frame 4 under the oracle's own ids (28 and 27), because the entry
    // declares 27 as its clock.
    defineSprite(27, 2, [
      place2({ depth: 1, characterId: 902 }), showFrame(),
      removeObject2(1), place2({ depth: 1, characterId: 903 }), showFrame()
    ]),
    defineSprite(28, 4, [
      place2({ depth: 1, characterId: 900 }), showFrame(),
      showFrame(),
      showFrame(),
      removeObject2(1), place2({ depth: 1, characterId: 27 }), showFrame()
    ]),
    // `boulder_combat` (added 2026-09-23): four frames under the oracle's own
    // id, 33, with an animated child on frame 4 whose id the entry does NOT
    // declare — it is discovered, because nobody writing the entry read it.
    defineSprite(930, 2, [
      place2({ depth: 1, characterId: 902 }), showFrame(),
      removeObject2(1), place2({ depth: 1, characterId: 903 }), showFrame()
    ]),
    defineSprite(33, 4, [
      place2({ depth: 1, characterId: 900 }), showFrame(),
      showFrame(),
      showFrame(),
      removeObject2(1), place2({ depth: 1, characterId: 930 }), showFrame()
    ]),

    exportAssets([
      [910, "bullet"], [912, "bullet_trail"], [915, "blood"], [916, "sparks"], [35, "rockMC"],
      [12, "lightning_bolt_combat"], [28, "fireball_combat"], [33, "boulder_combat"]
    ])
  ]);
}

/** The pack every test below reads, built once. */
const PACK = extractProps(propsBuild());

/* ──────────────────────────────  the tests  ──────────────────────────────── */

test("the synthetic build resolves every declared prop, or the rest of this file is measuring nothing", () => {
  // ► An anchor, not a formality. Every assertion below indexes `PACK.props`
  //   by name, and a missing prop would make each of them throw on `undefined`
  //   with a message about a property rather than about a build that did not
  //   parse. ~~Thirteen~~ ~~Fourteen~~ Fifteen entries in `PROP_EXPORTS`,
  //   fifteen props, no failures. **12 -> 13 on 2026-09-22**, when
  //   `lightning_bolt_combat` joined, **13 -> 14 the same day**, when
  //   `fireball_combat` did, **and 14 -> 15 on 2026-09-23**, when
  //   `boulder_combat` did.
  assert.equal(PROP_EXPORTS.length, 15);
  assert.deepEqual(PACK.failures, [], "the synthetic build must parse clean");
  assert.equal(Object.keys(PACK.props).length, PROP_EXPORTS.length);
});

test("a placement carries its OWN filters and blend mode, as the typed records the parser returns", () => {
  const [placement] = PACK.props.bullet.frames[0];
  assert.ok(placement.filters, "the arrow's own filter list is the thing that used to be dropped");
  assert.deepEqual(placement.filters.map((filter) => filter.type), ["blur", "colourMatrix"]);
  // Field VALUES, not just the kinds: a decoder reading the right number of
  // bytes from the wrong offsets produces the right types and wrong numbers.
  assert.equal(placement.filters[0].blurX, 5.5);
  assert.equal(placement.filters[0].blurY, 6.25);
  assert.equal(placement.filters[1].matrix.length, 20);
  assert.equal(placement.filters[1].matrix[0], 0.125);
  // The RAW SWF id, which is what `blendModeFor` takes — 3 is multiply.
  assert.equal(placement.blendMode, 3);
});

test("a placement with no effects of its own carries NEITHER key, the way `colour` and `clip` are spread", () => {
  // ► **THIS TEST USED TO BE ONE-SIDED, AND A ONE-SIDED NEGATIVE IS NOT A
  //   TEST.** It asserted only that three keys were ABSENT — which is exactly
  //   what the extractor produced at HEAD, where it wrote none of them. A
  //   verifier ran a full revert of `tools/extract-props.mjs` and this stayed
  //   green. Deletion produces the absence the assertion wants.
  //
  //   So it is paired now: the SAME run must show a placement that carries all
  //   three. "Absent because this one has none" and "absent because nobody
  //   writes them" then have different answers, and only the first passes.
  const [bare] = PACK.props.backdrop.frames[0];
  assert.equal(Object.hasOwn(bare, "filters"), false,
    "an absent filter list must be absent, not `null` — a reader spreading it would write `filters: null`");
  assert.equal(Object.hasOwn(bare, "blendMode"), false);
  assert.equal(Object.hasOwn(bare, "inheritedEffects"), false);
  // And the fields that were always there are untouched.
  assert.ok(Array.isArray(bare.matrix) && bare.matrix.length === 6);
  assert.ok(bare.colour);

  const [own] = PACK.props.bullet.frames[0];
  assert.equal(Object.hasOwn(own, "filters"), true, "or the absence above means only that nothing is written");
  assert.equal(Object.hasOwn(own, "blendMode"), true);
  const [inside] = PACK.props.bullet_trail.frames[0];
  assert.equal(Object.hasOwn(inside, "inheritedEffects"), true);
  assert.equal(Object.hasOwn(inside, "filters"), false, "and the two keys stay independent of each other");
});

test("AN ANCESTOR'S FILTER NEVER LANDS ON THE LEAF — it is a group, and the leaves point at it", () => {
  // ► **THE ONE THAT MATTERS.** `bullet_trail`'s glow is on the sprite that
  //   encloses three shapes. Writing it onto each of the three would blur each
  //   one separately where the build blurs the group once, and would read to
  //   every downstream caller as three glows. This test goes red both ways: if
  //   the leaf gains a `filters` key, and if the group is dropped.
  const prop = PACK.props.bullet_trail;
  const placements = prop.frames[0];
  assert.equal(placements.length, 3, "three leaves inside one filtered sprite");
  for (const placement of placements) {
    assert.equal(Object.hasOwn(placement, "filters"), false,
      "the enclosing sprite's glow is NOT this leaf's own filter");
    assert.deepEqual(placement.inheritedEffects, [0], "outermost first, as indices into `effectGroups`");
  }
  assert.equal(prop.effectGroups.length, 1, "ONE group, however many leaves are under it");
  assert.equal(prop.effectGroups[0].character, 911, "the group names the sprite that carries the effect");
  assert.deepEqual(prop.effectGroups[0].filters.map((filter) => filter.type), ["glow"]);
  assert.equal(prop.effects.inherited.groups, 1);
  assert.equal(prop.effects.inherited.placements, 3, "three leaves under one group, counted separately from it");
  assert.equal(prop.effects.own.filteredPlacements, 0);
});

test("TWO GROUPS AT THE SAME DEPTH ON DIFFERENT FRAMES ARE TWO GROUPS, not one", () => {
  // ► **THIS IS THE MOON.** `summariseDrawables` in `tools/swf-display-list.mjs`
  //   dedupes ancestor groups by `path.join("/")` alone, which is right within
  //   one frame and wrong the moment a caller accumulates across frames — and
  //   this extractor does. Measured on the installed build: `sky` has two
  //   different groups at depth 3, character 1692 on frames 25-110 and
  //   character 1728 on frames 112-200, and a path-keyed dedupe silently merges
  //   them and drops the second one's glow and blur. Frames 112-200 are the
  //   night; character 1728 is the moon.
  const prop = PACK.props.blood;
  assert.equal(prop.frameCount, 2);
  assert.equal(prop.effectGroups.length, 2,
    "both frames place a DIFFERENT filtered sprite at depth 3; keying on the path alone gives 1");
  assert.deepEqual(prop.effectGroups.map((group) => group.path), [[3], [3]], "the same path, deliberately");
  assert.deepEqual(prop.effectGroups.map((group) => group.character), [913, 914]);
  assert.deepEqual(prop.effectGroups.map((group) => group.filters[0].type), ["glow", "blur"]);
  assert.deepEqual(prop.frames[0][0].inheritedEffects, [0]);
  assert.deepEqual(prop.frames[1][0].inheritedEffects, [1], "frame 2's leaf points at frame 2's group");
});

test("a colour matrix that CHANGES between frames is two records, because the numbers are the point", () => {
  // ► The same key, exercised on the field that actually varies in the build:
  //   `sky`'s day/night colouring is a colour matrix TWEENED across its 200
  //   frames — 79 distinct matrices on character 1680 alone. A dedupe that
  //   compared only the filter's TYPE would store the first and label the other
  //   199 frames with it, which is a day-lit sky at midnight. (That is not a
  //   hypothetical: keying on type is how this session's first census reported
  //   7 groups and 10 filters where there are ~~363 and 570~~ 362 and 570 on
  //   the sky, which is all that census covered — **corrected 2026-09-24**:
  //   363 and 570 were the 12-prop WHOLE pack, which is 366 and 573 now.)
  const one = { id: 6, matrix: Array.from({ length: 20 }, (value, index) => index / 8) };
  const other = { id: 6, matrix: Array.from({ length: 20 }, (value, index) => (index + 1) / 8) };
  const pack = extractProps(swfFile([
    solidShape(900, [0xff, 0, 0, 0xff]),
    defineSprite(913, 1, [place2({ depth: 1, characterId: 900 }), showFrame()]),
    defineSprite(174, 2, [
      place3({ depth: 3, characterId: 913, filters: [one] }),
      showFrame(),
      place3({ depth: 3, characterId: 913, filters: [other] }),
      showFrame()
    ]),
    exportAssets([[174, "blood"]])
  ]));
  const groups = pack.props.blood.effectGroups;
  assert.equal(groups.length, 2, "same path, same character, same filter TYPE — different numbers");
  assert.notDeepEqual(groups[0].filters[0].matrix, groups[1].filters[0].matrix);
  assert.equal(groups[0].filters[0].matrix[1], 0.125);
  assert.equal(groups[1].filters[0].matrix[1], 0.25);
});

test("THE INVOICE IS THE RENDERER'S OWN VERDICT — deferred, refused and no-op, each by name", () => {
  // ► A count this file computed itself would agree with itself forever. These
  //   three come out of `src/render/filters.js`, so the pack's report and the
  //   renderer's behaviour cannot drift apart while both stay green.
  const use = PACK.props.sky.effects.use.filters;
  assert.equal(use.total, 3);
  assert.equal(use.deferred, 1, "a non-identity colour matrix goes to `applyColourMatrix`, not to a string");
  assert.equal(use.refused, 1, "CSS has no bevel");
  assert.equal(use.noOp, 1, "a glow at strength 0 draws nothing and is DROPPED AND COUNTED");
  assert.equal(use.applied, 0);
  assert.deepEqual(use.refusedByReason, { "bevel:filterHasNoCanvasEquivalent": 1 });

  // And it is literally what the reader says about the very same records.
  const direct = canvasFilterFor(PACK.props.sky.effectGroups[0].filters);
  assert.equal(direct.counts.refused, use.refused);
  assert.equal(direct.counts.deferred, use.deferred);
  assert.equal(direct.counts.noOp, use.noOp);
});

test("a blend mode is reported by NAME and by whether canvas can do it exactly", () => {
  const blend = PACK.props.bullet.effects.use.blendModes;
  assert.deepEqual(blend.exact, { multiply: 1 }, "SWF id 3 is multiply, and canvas has it");
  assert.deepEqual(blend.refused, {});
});

test("A FILTER LIST OF COUNT ZERO IS REFUSED BY NAME, never written as an empty list", () => {
  // ► `PlaceObject3` can carry a filter list holding nothing, which means this
  //   instance's filters were CLEARED. Writing `filters: []` would make that
  //   indistinguishable from a placement that was never asked; dropping it
  //   uncounted would make it indistinguishable from a correct read.
  const [placement] = PACK.props.sparks.frames[0];
  assert.equal(Object.hasOwn(placement, "filters"), false);
  assert.equal(PACK.props.sparks.effects.notCarried.emptyFilterList, 1);
});

test("A FILTER ON A MASK IS COUNTED, because a clip is a region and a blurred stencil is not", () => {
  const prop = PACK.props.rockMC;
  const [placement] = prop.frames[0];
  assert.ok(placement.clip, "the masked shape still carries its cutter");
  assert.equal(prop.effects.notCarried.clipFilters, 1,
    "the cutter's blur cannot be expressed by a clip path, and a silent drop is the defect this repo is built around");
});

test("every prop carries an effects invoice, INCLUDING the ones with nothing in it", () => {
  // ► "A pack that invoices some of its entries is worse than one that invoices
  //   none", because a reader who checks one entry concludes the pack has
  //   invoices. ~~Eight of the twelve~~ Eleven of the fifteen real props have
  //   no effect groups at all (**corrected 2026-09-24**, and the eight did not
  //   reproduce even before the spell props: the old twelve count ten; see
  //   `effectGroups` in `tools/extract-props.mjs`).
  const props = Object.values(PACK.props);
  const silent = props.filter((prop) => !prop.effects || !prop.effectGroups).map((prop) => prop.linkage);
  assert.deepEqual(silent, [], "an absent invoice and an empty one are different facts and must look different");
  const empty = props.filter((prop) => prop.effectGroups.length === 0);
  assert.ok(empty.length > 0, "the synthetic build has props with no effects; they must still carry the shape");
  // The refusal invoice obeys the same rule: present on all ~~twelve~~
  // fifteen, including the ~~eleven~~ fourteen that refused nothing — every
  // real prop but `panel` (corrected 2026-09-24; the synthetic build here
  // refuses nothing at all, its `failures` being empty). An absent `dropped` and a zeroed one are
  // different facts, and telling them apart is the whole point of the block.
  const unrefused = props.filter((prop) => !prop.effects.own.dropped).map((prop) => prop.linkage);
  assert.deepEqual(unrefused, [], "every prop states what its skipped drawables cost, even when that is nothing");
  for (const prop of empty) {
    assert.equal(prop.effects.inherited.groups, 0);
    assert.equal(prop.effects.inherited.placements, 0);
    // A prop with no groups loses no group matrix. `sparks` still has a
    // `notCarried` entry here — its cleared filter list — which is why this
    // asserts the one key rather than an empty object: "nothing enclosed it"
    // and "nothing was refused" are different claims.
    assert.equal(prop.effects.notCarried.effectGroupMatrix, undefined, prop.linkage);
  }
});

test("A DROPPED DRAWABLE'S OWN FILTERS ARE INVOICED WHERE THEY ARE DROPPED", () => {
  // ► **THIS IS THE FATAL ONE, AND IT IS THE REASON THIS TEST FILE'S HEADLINE
  //   WAS FALSE.** The placement loop skips an `unsupported` drawable above
  //   `ownEffectsOf`, so for as long as that skip invoiced nothing, an own
  //   filter on such a drawable left no trace anywhere: not in the placement,
  //   not in `notCarried`, not in the invoice, not even in the `failures` line
  //   that named the drawable. On the installed build that is not a corner —
  //   it is 100% of the own filters in it: 3,436 drawables (the 12-prop pack's
  //   flatten), 2 refused as unsupported, and
  //   the SAME 2 own-filtered (`panel` frame 1, edit-text 1527 and 1528, one
  //   glow each). `0 own filters` measured the skip list, not the game.
  //
  //   The fixture is a `DefineEditText` because that is what the build uses.
  const pack = extractProps(swfFile([
    solidShape(900, [0xff, 0, 0, 0xff]),
    defineEditText(950),
    defineEditText(951),
    defineSprite(174, 1, [
      place2({ depth: 1, characterId: 900 }),
      place3({ depth: 2, characterId: 950, filters: [GLOW, BLUR], blendMode: 3 }),
      // And the other distinction, on a drawable that is also leaving: a filter
      // list of COUNT ZERO means "cleared", not "nobody asked", and losing it
      // with the drawable would erase the difference.
      place3({ depth: 3, characterId: 951, filters: [] }),
      showFrame()
    ]),
    exportAssets([[174, "blood"]])
  ]));
  const prop = pack.props.blood;

  // The placement itself is still NOT emitted — there is no geometry to hang
  // the glow on, and inventing one would be the other half of this defect.
  assert.equal(prop.frames[0].length, 1, "only the real shape is drawn");
  assert.equal(prop.effects.own.filteredPlacements, 0, "nothing own was CARRIED");

  // What is owed is a number with a name, and it is here three times over.
  assert.deepEqual(prop.effects.own.dropped, {
    placements: 1, filters: 2, filtersByType: { glow: 1, blur: 1 }, blendModePlacements: 1
  });
  assert.equal(prop.effects.notCarried.unsupportedDrawableFilters, 2);
  assert.equal(prop.effects.notCarried.unsupportedDrawableBlendMode, 1);
  assert.equal(prop.effects.notCarried.unsupportedDrawableEmptyFilterList, 1);

  // And the human-readable list names the loss, which is where a reader looks
  // first. It used to read `frame 1 carries text (character 950)` full stop.
  const named = pack.failures.map((failure) => failure.message);
  assert.ok(named.some((message) => /character 950.*dropping 2 own glow\+blur and own blend mode 3/.test(message)),
    `the failure line must name what went with the drawable, got ${JSON.stringify(named)}`);
  assert.ok(named.some((message) => /character 951.*own filter list of COUNT ZERO/.test(message)));
});

test("THE PACK TALLY KEEPS REFUSED OWN FILTERS APART FROM CARRIED ONES, and from the inherited ones", () => {
  // ► **THREE BUCKETS, AND FOLDING ANY TWO OF THEM IS A DIFFERENT LIE.** Adding
  //   `dropped` into `own` would claim the pack holds a glow it does not draw;
  //   leaving it out entirely is what made `0` unfalsifiable; and putting an
  //   ancestor's filters into `ownByType` is the error the whole own/inherited
  //   split exists to prevent — a mutation that swapped those two `add()` calls
  //   used to leave every test in this file green.
  const pack = extractProps(swfFile([
    solidShape(900, [0xff, 0, 0, 0xff]),
    defineEditText(950),
    defineSprite(913, 1, [place2({ depth: 1, characterId: 900 }), showFrame()]),
    defineSprite(174, 1, [
      // An ENCLOSING sprite with a blur, and a dropped drawable with a glow, so
      // the two byTypes hold DIFFERENT names and a swap is visible.
      place3({ depth: 1, characterId: 913, filters: [BLUR] }),
      place3({ depth: 2, characterId: 950, filters: [GLOW] }),
      showFrame()
    ]),
    // And a placement with its OWN colour matrix, so `ownByType` is non-empty
    // and the swap has something to swap.
    defineSprite(910, 1, [place3({ depth: 1, characterId: 900, filters: [COLOUR_MATRIX] }), showFrame()]),
    exportAssets([[174, "blood"], [910, "bullet"]])
  ]));
  const rolled = tallyEffects(pack.props);
  assert.deepEqual(rolled.ownByType, { colourMatrix: 1 }, "the leaf's OWN filter, and only it");
  assert.deepEqual(rolled.inheritedByType, { blur: 1 }, "the enclosing sprite's, and only it");
  assert.deepEqual(rolled.droppedOwnByType, { glow: 1 }, "and the one that was refused, under its own name");
  assert.equal(rolled.ownFilters, 1);
  assert.equal(rolled.droppedOwnFilters, 1);
  assert.equal(rolled.droppedOwnFilteredPlacements, 1);
  // Three distinct type names across three buckets: any pairwise swap of the
  // `add()` calls in `tallyEffects` moves a name into the wrong one and fails.
  assert.equal(new Set([
    ...Object.keys(rolled.ownByType), ...Object.keys(rolled.inheritedByType), ...Object.keys(rolled.droppedOwnByType)
  ]).size, 3, "or this comparison could not tell the buckets apart");
});

test("A TWO-DEEP CHAIN IS OUTERMOST FIRST, which NOTHING in the shipped build can check", () => {
  // ► **AN ORDERING GUARANTEE WHOSE EVIDENCE COULD NOT VARY.** `outermost
  //   first` is stated three times in `tools/extract-props.mjs` and was
  //   asserted against a chain of length ONE — and every one of the installed
  //   build's ~~3,209~~ 3,258 chains has length 1, as does every group path
  //   (all 366; corrected 2026-09-24, clocks included). So reversing
  //   the loop in `inheritedEffectsFor` left the whole suite green: no input in
  //   the game or in this file could distinguish the order from its reverse.
  //
  //   A renderer that nests buffers composites the outermost group first, so
  //   this is a real promise to a real caller; it just has no witness in the
  //   build. This fixture is the witness: a glow on the outer sprite and a blur
  //   on the inner one, two levels apart.
  const pack = extractProps(swfFile([
    solidShape(900, [0xff, 0, 0, 0xff]),
    defineSprite(970, 1, [place2({ depth: 1, characterId: 900 }), showFrame()]),
    defineSprite(971, 1, [place3({ depth: 4, characterId: 970, filters: [BLUR] }), showFrame()]),
    defineSprite(174, 1, [place3({ depth: 2, characterId: 971, filters: [GLOW] }), showFrame()]),
    exportAssets([[174, "blood"]])
  ]));
  const prop = pack.props.blood;
  const [placement] = prop.frames[0];
  assert.equal(placement.inheritedEffects.length, 2, "two enclosing sprites, two entries — not one");
  // ► **RESOLVED THROUGH `effectGroups`, never asserted as raw indices.**
  //   Reversing the loop produces the SAME index array `[0, 1]` and a different
  //   `effectGroups` order, so pinning the indices alone is exactly the check
  //   that could not fail. This reads the chain the way a renderer would.
  assert.deepEqual(
    placement.inheritedEffects.map((at) => prop.effectGroups[at].filters.map((filter) => filter.type)),
    [["glow"], ["blur"]],
    "the OUTER sprite's glow first; reversed, this is blur-then-glow"
  );
  assert.deepEqual(placement.inheritedEffects.map((at) => prop.effectGroups[at].character), [971, 970]);
  assert.equal(prop.effects.inherited.groups, 2);
});

test("EVERY SHAPE carries its own approximation invoice, and it matches its own paths", () => {
  const entries = Object.entries(PACK.shapes);
  assert.ok(entries.length > 0);
  const silent = entries.filter(([, shape]) => shape.approximated === undefined).map(([id]) => id);
  assert.deepEqual(silent, [], "all of them or none; a partial invoice reads as a complete one");
  let approximated = 0;
  for (const [id, shape] of entries) {
    const byKind = {};
    for (const entry of shape.paths) if (entry.approximated) byKind[entry.approximated] = (byKind[entry.approximated] ?? 0) + 1;
    const total = Object.values(byKind).reduce((sum, count) => sum + count, 0);
    assert.deepEqual(shape.approximatedByKind, byKind, `shape ${id}: its invoice disagrees with its own paths`);
    assert.equal(shape.approximated, total, `shape ${id}: the total and the kinds must agree too`);
    approximated += total;
  }
  assert.equal(approximated, PACK.approximated.total, "and the manifest's tally is the sum of them");
  assert.ok(approximated > 0,
    "the synthetic build contains a gradient on purpose: an invoice checked only against zeroes checks nothing");
});

test("the pack tally is summed from the props' OWN invoices, so it cannot report a number the data lacks", () => {
  const rolled = tallyEffects(PACK.props);
  const groups = Object.values(PACK.props).reduce((sum, prop) => sum + prop.effectGroups.length, 0);
  assert.equal(rolled.groups, groups);
  // Counted straight off the placements, which is the thing the tally is ABOUT
  // — not off the same field the tally was built from.
  let under = 0;
  let own = 0;
  for (const prop of Object.values(PACK.props)) {
    for (const frame of prop.frames) {
      for (const placement of frame) {
        if (placement.inheritedEffects) under += 1;
        if (placement.filters) own += 1;
      }
    }
  }
  assert.equal(rolled.placementsUnderAGroup, under);
  assert.equal(rolled.ownFilteredPlacements, own);
  assert.ok(under > 0 && own > 0, "both arms must be non-zero here or this comparison is two zeroes agreeing");
});

test("`notCarried.effectGroupMatrix` is ONE PER GROUP, and says so rather than being read as a ratio", () => {
  // ► **A NUMBER THAT CAN ONLY TAKE ONE VALUE IS NOT EVIDENCE**, and this one
  //   is identically the group count: `flattenFrame`'s ancestor record carries
  //   no matrix, so every group loses one. It is pinned here for the reason
  //   `src/render/filters.js` pins `approximated === applied.length` — so that
  //   the day a group DOES carry its matrix, this goes red and the comment
  //   claiming the identity has to be rewritten rather than quietly outliving
  //   its truth.
  //
  //   It is not vacuous today: the two sides come from different code paths —
  //   one `refuse()` inside the new-group branch against `groups.length` — so
  //   counting once per LEAF instead of once per group fails here. On the
  //   installed build that mutation reads ~~3,209 against 363~~ 3,258 against
  //   366 (corrected 2026-09-24: every grouped placement, the clocks' 46
  //   included, since they are walked by the same code, against every group).
  const rolled = tallyEffects(PACK.props);
  assert.equal(rolled.notCarried.effectGroupMatrix, rolled.groups);
  assert.ok(rolled.groups > 0);
  for (const prop of Object.values(PACK.props)) {
    const expected = prop.effectGroups.length;
    assert.equal(prop.effects.notCarried.effectGroupMatrix ?? 0, expected, `${prop.linkage}`);
  }
});

test("A NESTED CLIP'S LOOKUP IS MEASURED BY RE-FLATTENING, or refused by name", () => {
  // ► **`bullet_trail`'s `indexedBy` WAS WRONG, AND IT COST THE ARENA ITS
  //   TRAIL ON 14 OF 20 BOWS.** It read `secondary_weapon - 60` under a
  //   docstring quoting `trail.bullet.gotoAndStop(secondary_weapon - 60)` —
  //   and `trail.bullet` is a CHILD of the trail. Re-derived from the display
  //   list on the oracle: sprite 48 has seven frames, every one places
  //   character 47 at depth 1 under the instance name `bullet`, and the
  //   alphaMultiplier runs 0.699 → 0. The frame is the puff's AGE. Seven slots
  //   could never have addressed twenty bows; the renderer clamped to frame 7,
  //   whose alpha is 0, and drew nothing.
  //
  //   `flattenFrame` stops a nested sprite on frame 1, so the pack said "seven
  //   alphas of ONE shape" — bow 61's, for all twenty bows. This is the
  //   measurement that recovers the other index, and it is a MEASUREMENT: the
  //   extractor re-flattens every frame of the prop against every frame of the
  //   child and refuses if anything but one shape id moved.
  const build = (secondArrowMatrix) => swfFile([
    solidShape(900, [0xff, 0, 0, 0xff]),
    solidShape(902, [0, 0xff, 0, 0xff]),
    solidShape(903, [0, 0, 0xff, 0xff]),
    // The child: three drawings on three frames, exactly as `bullet`'s fifty
    // frames hold five arrows.
    defineSprite(47, 3, [
      place2({ depth: 1, characterId: 900 }), showFrame(),
      removeObject2(1), place2({ depth: 1, characterId: 902, matrix: secondArrowMatrix }), showFrame(),
      removeObject2(1), place2({ depth: 1, characterId: 903 }), showFrame()
    ]),
    // The trail: two frames of the SAME child, which is the age.
    defineSprite(912, 2, [place2({ depth: 1, characterId: 47 }), showFrame(), showFrame()]),
    exportAssets([[912, "bullet_trail"]])
  ]);

  const prop = extractProps(build(undefined)).props.bullet_trail;
  assert.deepEqual(prop.nestedLookup, {
    instance: "bullet",
    character: 47,
    indexedBy: "secondary_weapon - 60",
    reader: "src/render/projectile.js — the arrow carried inside the puff",
    frameCount: 3,
    replaces: 900,
    distinctShapes: 3,
    shapeByFrame: [900, 902, 903]
  });
  // And the prop's own frames are untouched — the age, with the frame-1 art.
  assert.equal(prop.frameCount, 2);
  for (const frame of prop.frames) assert.deepEqual(frame.map((p) => p.shape), [900]);

  // ► **IT REFUSES RATHER THAN GUESSES.** Move the second arrow sideways and
  //   the substitution is no longer one-dimensional: a shape table would then
  //   be silently wrong about the matrix. A table right for most bows is worse
  //   than no table.
  const moved = extractProps(build({ tx: 40 })).props.bullet_trail;
  assert.equal(Object.hasOwn(moved, "nestedLookup"), false, "refused, and therefore absent");
  assert.equal(moved.effects.notCarried.nestedLookupMovesMoreThanAShape, 1, "and counted by name");

  // ► **AND A DECLARED CHILD THAT IS NOT IN THE BUILD IS ALSO COUNTED.** The
  //   main fixture at the top of this file has no character 47, so its
  //   `bullet_trail` exercises the other refusal on every run.
  assert.equal(Object.hasOwn(PACK.props.bullet_trail, "nestedLookup"), false);
  assert.equal(PACK.props.bullet_trail.effects.notCarried.nestedLookupCharacterMissing, 1);

  // ► **AND THE DECLARED FACT THAT WAS WRONG IS PINNED SO IT CANNOT COME BACK.**
  //   `bullet` and `bullet_trail` must NOT share an `indexedBy`: the arrow's
  //   frame is the weapon and the trail's is the puff's age, and the whole
  //   defect was one sentence asserting they were the same lookup.
  const trail = PROP_EXPORTS.find((entry) => entry.linkage === "bullet_trail");
  const arrow = PROP_EXPORTS.find((entry) => entry.linkage === "bullet");
  assert.equal(arrow.indexedBy, "secondary_weapon - 60");
  assert.notEqual(trail.indexedBy, arrow.indexedBy,
    "seven frames cannot address twenty bows; the trail's frame is the puff's AGE");
  assert.match(trail.indexedBy, /AGE/, "and it must say so, not merely differ");
  assert.equal(trail.nested.character, 47, "the arrow lives on the nested `bullet` child");
  assert.equal(trail.nested.indexedBy, "secondary_weapon - 60", "and THAT is where the weapon index belongs");
});

test("A NESTED CLIP THAT IS A CLOCK IS EMITTED FRAME BY FRAME, or refused by name", () => {
  // ► **THE BOLT, AND THE SHAPE OF IT IS NOT `bullet_trail`'S.** Measured on
  //   the oracle 2026-09-22: `lightning_bolt_combat` (character 12) has TWO
  //   frames — `bolt.gotoAndStop(lightning_frame)` picks 1 for a lightning bolt
  //   and 2 for a frightning one (`+0x85c2`) — and frame 2 ADDS a shape at
  //   depth 4 over the same child. The child, sprite 10, is twelve frames of
  //   flicker with no `Stop`, so it LOOPS for as long as the bolt is attached.
  //
  //   `nestedLookup` cannot hold that and is right to refuse it: it needs one
  //   shape that moves, and the frightning bolt has two. And freezing the child
  //   on frame 1, which `flattenFrame` does, draws a bolt that never flickers.
  //   So a CLOCK child is emitted as every parent frame at every child frame,
  //   by re-flattening with `spriteFrames` — the same option `nestedLookup`
  //   measures with — and nothing is inferred.
  const build = ({ withChild = true } = {}) => swfFile([
    solidShape(900, [0xff, 0, 0, 0xff]),
    solidShape(902, [0, 0xff, 0, 0xff]),
    solidShape(903, [0, 0, 0xff, 0xff]),
    solidShape(904, [0xff, 0xff, 0, 0xff]),
    // The child: three drawings on three frames, the way sprite 10 flickers
    // through shapes 6, 7 and 8. No Stop anywhere, so it is a clock.
    ...(withChild ? [defineSprite(10, 3, [
      place2({ depth: 1, characterId: 900 }), showFrame(),
      removeObject2(1), place2({ depth: 1, characterId: 902 }), showFrame(),
      removeObject2(1), place2({ depth: 1, characterId: 903 }), showFrame()
    ])] : [solidShape(10, [0, 0, 0, 0xff])]),
    // The bolt: frame 1 is the child alone, frame 2 adds a shape over it.
    defineSprite(12, 2, [
      place2({ depth: 1, characterId: 10 }), showFrame(),
      place2({ depth: 4, characterId: 904 }), showFrame()
    ]),
    exportAssets([[12, "lightning_bolt_combat"]])
  ]);

  const prop = extractProps(build()).props.lightning_bolt_combat;
  const shapesOf = (placements) => placements.map((placement) => placement.shape);

  // The prop's own frames are UNCHANGED — child on frame 1 — so every reader
  // that already indexes `frames` keeps working.
  assert.equal(prop.frameCount, 2);
  assert.deepEqual(prop.frames.map(shapesOf), [[900], [900, 904]]);

  // And the clock is its own key, frame by age, for BOTH parent frames.
  assert.equal(prop.clock.character, 10);
  assert.equal(prop.clock.frameCount, 3);
  assert.deepEqual(prop.clock.framesByParent.map((ages) => ages.map(shapesOf)), [
    [[900], [902], [903]],
    [[900, 904], [902, 904], [903, 904]]
  ], "every parent frame at every child frame, re-flattened rather than assembled");

  // ► **IT REFUSES RATHER THAN GUESSES.** A declared clock whose character is
  //   not a sprite has no frames to walk.
  const missing = extractProps(build({ withChild: false })).props.lightning_bolt_combat;
  assert.equal(Object.hasOwn(missing, "clock"), false, "refused, and therefore absent");
  assert.equal(missing.effects.notCarried.clockCharacterMissing, 1, "and counted by name");

  // ► **AND THE DECLARATION NAMES THE BUILD'S OWN CHILD.** Sprite 10 is what
  //   character 12 places at depth 1 on the oracle; a clock pointed anywhere
  //   else would walk the wrong timeline and report success.
  const entry = PROP_EXPORTS.find((candidate) => candidate.linkage === "lightning_bolt_combat");
  assert.equal(entry.clock.character, 10);
});

/* ─────────────────────────────  morph shapes  ────────────────────────────── */

/** A frame's shape keys, which is how a morph's ratio reaches a reader. */
const shapeKeysOf = (placements) => placements.map((placement) => placement.shape);
/** One prop's own failure lines, out of a focused build's whole list. */
const failuresOf = (pack, linkage) => pack.failures.filter((failure) => failure.linkage === linkage);
/**
 * Every failure a focused build should NOT have: anything but the declared
 * exports it deliberately leaves out. A shape parser handed a morph key, or a
 * morph that would not parse, lands here under a linkage no prop has.
 */
const unexpectedFailures = (pack) => pack.failures.filter((failure) =>
  !/^(no export of that name in this build|is a nothing, not a sprite)$/.test(failure.message));

test("A MORPH IS CARRIED AT EACH PLACEMENT'S OWN RATIO — placed once, then MOVED", () => {
  // ► **THE FIREBALL'S EXPLOSION IS THIS SHAPE, AND THIS TOOL USED TO DROP
  //   IT.** Reported by the main session 2026-09-22 from its extraction of the
  //   oracle (not re-derived here — nothing in this file reads the install):
  //   sprite 27's frames 1-18 place a morph (characters 19-22) and then MOVE
  //   it — a `PlaceObject2` with no character — carrying the RATIO that picks
  //   the in-between. Every one of those was `unsupported: "morph"`, skipped,
  //   and listed in `failures`, so `fireballOpsFor` had nothing to draw.
  //
  //   The fixture has the same shape: frame 1 places the morph with NO ratio
  //   flag (which is ratio 0, the start shape), frames 2 and 3 move it with a
  //   ratio — the END first, then the in-between, so the order the pack meets
  //   them in is not the order it writes them in — and frame 4 moves it with a
  //   MATRIX and no ratio, which must KEEP 13107, because a move sets only the
  //   fields it carries.
  const pack = extractProps(swfFile([
    defineMorph(960),
    defineSprite(174, 4, [
      place2({ depth: 1, characterId: 960 }), showFrame(),
      place2({ depth: 1, move: true, ratio: 65535 }), showFrame(),
      place2({ depth: 1, move: true, ratio: 13107 }), showFrame(),
      place2({ depth: 1, move: true, matrix: { tx: 40 } }), showFrame()
    ]),
    exportAssets([[174, "blood"]])
  ]));
  const prop = pack.props.blood;

  // Scoped to this prop: a focused build lacks the other declared exports, and
  // each of those is its own "no export of that name" line by design.
  assert.deepEqual(failuresOf(pack, "blood"), [], "a morph is carried, so nothing is refused");
  assert.deepEqual(unexpectedFailures(pack), [], "and nothing else in the build failed on its account");
  assert.deepEqual(prop.frames.map(shapeKeysOf), [["960@0"], ["960@65535"], ["960@13107"], ["960@13107"]],
    "keyed `<id>@<raw ratio>`, the convention `tools/extract-figure.mjs` bakes its morphs under");
  assert.deepEqual(prop.frames[3][0].matrix, [1, 0, 0, 1, 40, 0], "and the move's own matrix is carried");

  // ► **THE GEOMETRY AT EACH RATIO, AGAINST NUMBERS LERPED BY HAND** — see
  //   `MORPH_AT` for the arithmetic. A ratio read off the wrong placement, or
  //   one normalised twice, lands on a different corner.
  for (const ratio of [0, 13107, 65535]) {
    const shape = pack.shapes[`960@${ratio}`];
    assert.ok(shape, `ratio ${ratio} is baked`);
    assert.equal(shape.paths.length, 1, "one fill, one path");
    assert.equal(shape.paths[0].d, MORPH_AT[ratio].d, `ratio ${ratio}: the corners`);
    assert.equal(shape.paths[0].fill, MORPH_AT[ratio].fill, `ratio ${ratio}: the colour lerps with the edges`);
    assert.deepEqual(shape.bounds, MORPH_AT[ratio].bounds, `ratio ${ratio}: the bounds`);
    // The fields `extract-figure.mjs` writes on a baked morph, and the
    // per-entry invoice every shape in THIS pack carries — all or none.
    assert.equal(shape.morph, 960);
    assert.equal(shape.ratio, ratio, "the RAW 0..65535 ratio, as the placement carried it");
    assert.equal(shape.approximated, 0);
    assert.deepEqual(shape.approximatedByKind, {});
  }
  assert.deepEqual(Object.keys(pack.shapes), ["960@0", "960@13107", "960@65535"],
    "three ratios, three entries — the fourth frame reuses the third's — in RATIO order, not the order met");

  // ► **AND THE RENDERER DRAWS IT WITH NO SECOND CODE PATH.** `propOpsFor`
  //   looks a placement's shape up by key, and a string key is a key.
  const ops = propOpsFor(propPackFrom(pack), { linkage: "blood", frame: 3 });
  assert.equal(ops.length, 1);
  assert.equal(ops[0].d, MORPH_AT[13107].d);
  assert.equal(ops[0].fill, MORPH_AT[13107].fill);

  // And the published manifest counts them, from the shapes it was handed.
  const manifest = manifestFor({
    source: "synthetic.swf", sha256: "0".repeat(64), props: pack.props, shapes: pack.shapes,
    failures: pack.failures, approximated: pack.approximated, effects: pack.effects
  });
  assert.equal(manifest.morphCount, 3);
  assert.equal(manifest.shapeCount, 3);
});

test("A CLOCK CHILD THAT MOVES A MORPH is carried at every age, which is the fireball's explosion", () => {
  // ► **THE REAL CASE, UNDER THE ORACLE'S OWN IDS.** `fireball_combat` is
  //   character 28; frame 4 places the explosion, sprite 27, which the entry
  //   declares as its `clock`. Here sprite 27 places a morph and moves it
  //   through two ratios, as the main session reports the build's does
  //   through eighteen frames.
  const pack = extractProps(swfFile([
    solidShape(900, [0xff, 0, 0, 0xff]),
    defineMorph(961),
    defineSprite(27, 3, [
      place2({ depth: 1, characterId: 961 }), showFrame(),
      place2({ depth: 1, move: true, ratio: 13107 }), showFrame(),
      place2({ depth: 1, move: true, ratio: 65535 }), showFrame()
    ]),
    defineSprite(28, 4, [
      place2({ depth: 1, characterId: 900 }), showFrame(),
      showFrame(),
      showFrame(),
      removeObject2(1), place2({ depth: 1, characterId: 27 }), showFrame()
    ]),
    exportAssets([[28, "fireball_combat"]])
  ]));
  const prop = pack.props.fireball_combat;

  assert.deepEqual(failuresOf(pack, "fireball_combat"), [], "not one clock frame refuses its morph");
  assert.deepEqual(unexpectedFailures(pack), []);
  // The prop's OWN frame 4 is the child frozen on its frame 1 — ratio 0.
  assert.deepEqual(prop.frames.map(shapeKeysOf), [[900], [900], [900], ["961@0"]]);
  // And the clock walks the child's ratios, age by age.
  assert.deepEqual(prop.clock.framesByParent[3].map(shapeKeysOf), [["961@0"], ["961@13107"], ["961@65535"]],
    "each age at the ratio the child's own timeline has reached by then");
  assert.deepEqual(prop.clock.framesByParent[0].map(shapeKeysOf), [[900], [900], [900]],
    "the flight does not place the child, so its ages are the flight");
  assert.equal(pack.shapes["961@13107"].paths[0].d, MORPH_AT[13107].d);
  assert.equal(pack.shapes["961@65535"].paths[0].d, MORPH_AT[65535].d);
  assert.equal(prop.effects.own.dropped.placements, 0);

  // ► **AND `fireballOpsFor` DRAWS EVERY AGE**, where on the oracle it
  //   returned null for ages 0-17 and the painter fell back to an authored ring.
  const view = propPackFrom(pack);
  assert.deepEqual([0, 1, 2].map((age) => fireballOpsFor(view, 4, age)?.[0]?.d),
    [MORPH_AT[0].d, MORPH_AT[13107].d, MORPH_AT[65535].d]);
});

test("MOLTEN DEATH'S BOULDER: the landing clock is DISCOVERED on frame 4, since nobody declaring it has read it", () => {
  // ► **ADDED 2026-09-23, after a Codex review found the arena drawing a
  //   landing it had invented.** `boulder_combat` is sprite 33: four frames, a
  //   `Stop` on frames 1 and 4 and nothing else in its frame scripts (read by
  //   the main session). The arm shows frame 1 while the rock falls and
  //   `gotoAndStop(4)` on the landing (`+0x88c0`). WHAT frame 4 places was not
  //   read by whoever wrote the entry — the install is off limits to that
  //   agent — so the entry cannot name a clock character the way the bolt and
  //   the fireball do. It names the FRAME, and the extractor finds the one
  //   animated sprite placed there, or refuses by name when there is more than
  //   one, and says what it found either way.
  const build = ({ landing = "one" } = {}) => swfFile([
    solidShape(900, [0xff, 0, 0, 0xff]),
    solidShape(902, [0, 0xff, 0, 0xff]),
    solidShape(903, [0, 0, 0xff, 0xff]),
    solidShape(904, [0xff, 0xff, 0, 0xff]),
    // Three drawings over three frames: the landing, whatever it turns out to be.
    defineSprite(931, 3, [
      place2({ depth: 1, characterId: 902 }), showFrame(),
      removeObject2(1), place2({ depth: 1, characterId: 903 }), showFrame(),
      removeObject2(1), place2({ depth: 1, characterId: 904 }), showFrame()
    ]),
    // A second animated sprite, reached only THROUGH a one-frame wrapper, so
    // the search has to look inside what frame 4 places, not just at it.
    defineSprite(932, 2, [
      place2({ depth: 1, characterId: 904 }), showFrame(),
      removeObject2(1), place2({ depth: 1, characterId: 902 }), showFrame()
    ]),
    defineSprite(933, 1, [place2({ depth: 1, characterId: 932 }), showFrame()]),
    defineSprite(33, 4, [
      place2({ depth: 1, characterId: 900 }), showFrame(),
      showFrame(),
      showFrame(),
      removeObject2(1),
      ...(landing === "one" ? [place2({ depth: 1, characterId: 931 })] : []),
      ...(landing === "static" ? [place2({ depth: 1, characterId: 902 })] : []),
      ...(landing === "two" ? [place2({ depth: 1, characterId: 931 }), place2({ depth: 2, characterId: 933 })] : []),
      showFrame()
    ]),
    exportAssets([[33, "boulder_combat"]])
  ]);
  const shapesOf = (placements) => placements.map((placement) => placement.shape);

  // ONE animated child on frame 4: it is the clock, walked age by age.
  const one = extractProps(build());
  const prop = one.props.boulder_combat;
  assert.deepEqual(failuresOf(one, "boulder_combat"), []);
  assert.equal(prop.frameCount, 4);
  assert.deepEqual(prop.frames.map(shapesOf), [[900], [900], [900], [902]],
    "frame 1 is the falling rock; frame 4 is the landing child frozen on ITS frame 1");
  assert.equal(prop.clock.character, 931, "found, not declared");
  assert.equal(prop.clock.discoveredOn, 4);
  assert.equal(prop.clock.frameCount, 3);
  assert.deepEqual(prop.clock.framesByParent[3].map(shapesOf), [[902], [903], [904]],
    "the landing, age by age");
  assert.deepEqual(prop.clockDiscovery, { onFrame: 4, byFrame: [[], [], [], [931]] },
    "and the pack says what it looked at: no animated sprite while the rock falls, one where it lands");
  // The manifest — the file a person re-extracting actually reads — names it too.
  const manifest = manifestFor({
    source: "synthetic.swf", sha256: "0".repeat(64), props: one.props, shapes: one.shapes,
    failures: one.failures, approximated: one.approximated, effects: one.effects
  });
  assert.deepEqual(manifest.props.boulder_combat.clockDiscovery,
    { onFrame: 4, byFrame: [[], [], [], [931]], character: 931 });
  assert.equal(Object.hasOwn(manifest.props.lightning_bolt_combat ?? {}, "clockDiscovery"), false);

  // NONE: frame 4 is a still drawing, so there is no clock and nothing refused.
  const still = extractProps(build({ landing: "static" }));
  assert.deepEqual(failuresOf(still, "boulder_combat"), []);
  assert.equal(Object.hasOwn(still.props.boulder_combat, "clock"), false);
  assert.deepEqual(still.props.boulder_combat.clockDiscovery, { onFrame: 4, byFrame: [[], [], [], []] });

  // TWO: the tool will not pick one. Refused by name, and both ids reported.
  const two = extractProps(build({ landing: "two" }));
  assert.equal(Object.hasOwn(two.props.boulder_combat, "clock"), false, "refused, and therefore absent");
  assert.equal(two.props.boulder_combat.effects.notCarried.clockAmbiguous, 1);
  assert.deepEqual(two.props.boulder_combat.clockDiscovery.byFrame[3], [931, 932],
    "including the one inside the wrapper");
  assert.ok(failuresOf(two, "boulder_combat").some((failure) => /931.*932/.test(failure.message)),
    "and the failure names both, so whoever reads the build can declare the right one");

  // The entry itself declares the FRAME and no character, and says why.
  const entry = PROP_EXPORTS.find((candidate) => candidate.linkage === "boulder_combat");
  assert.equal(entry.clock.discoverOnFrame, 4);
  assert.equal(Object.hasOwn(entry.clock, "character"), false);
});

test("A MORPH UNDER A MASK is clipped when the mask is a shape and REFUSED BY NAME when it is not", () => {
  // ► **A MORPH DRAWN UNCLIPPED UNDER A MASK DRAWS MORE THAN THE BUILD DOES.**
  //   `flattenFrame` marks a masked SHAPE `unsupported: "masked"` when its
  //   cutter cannot be turned into a clip path; a morph comes back
  //   `unsupported: "morph"` either way, so carrying every morph would have
  //   quietly lifted that refusal. A shape mask is a clip this pack can carry;
  //   a SPRITE mask is not, and the morph under it stays out.
  const pack = extractProps(swfFile([
    solidShape(900, [0xff, 0, 0, 0xff]),
    solidShape(902, [0, 0xff, 0, 0xff]),
    defineMorph(960),
    defineSprite(918, 1, [place2({ depth: 1, characterId: 900 }), showFrame()]),
    defineSprite(174, 1, [
      place3({ depth: 1, characterId: 902, clipDepth: 2 }),
      place2({ depth: 2, characterId: 960 }),
      place3({ depth: 3, characterId: 918, clipDepth: 4 }),
      place2({ depth: 4, characterId: 960, ratio: 65535 }),
      showFrame()
    ]),
    exportAssets([[174, "blood"]])
  ]));
  const [placement, ...rest] = pack.props.blood.frames[0];
  assert.equal(rest.length, 0, "only the shape-masked morph is emitted");
  assert.equal(placement.shape, "960@0");
  assert.equal(placement.clip?.shape, 902, "and it carries its cutter");
  assert.equal(pack.shapes["960@65535"], undefined, "the refused one is not baked either");
  const named = pack.failures.map((failure) => failure.message);
  assert.ok(named.some((message) => /carries morph under a mask this tool cannot resolve \(character 960\)/.test(message)),
    `the refusal names the morph and why, got ${JSON.stringify(named)}`);
});

test("A MORPH INSIDE A MASKED SPRITE is refused, because this tool never clips across a sprite boundary", () => {
  // ► **FOUND BY A CODEX ADVERSARIAL REVIEW, 2026-09-22, and reproduced here
  //   first.** `flattenFrame` computed `maskedBy` per display list, so a morph
  //   one sprite BELOW a mask came back with no `maskPath` at all and was baked
  //   whole — drawn larger than the build draws it. The old blanket refusal of
  //   every morph had hidden this; lifting it for morphs must not lift it here.
  //   `flattenFrame` now stamps `ancestorMaskPath` on such a leaf, and the
  //   extractor refuses the morph by name.
  const pack = extractProps(swfFile([
    solidShape(900, [0xff, 0, 0, 0xff]),
    solidShape(902, [0, 0xff, 0, 0xff]),
    defineMorph(960),
    defineSprite(919, 1, [place2({ depth: 1, characterId: 960 }), showFrame()]),
    defineSprite(174, 1, [
      place3({ depth: 1, characterId: 902, clipDepth: 2 }),
      place2({ depth: 2, characterId: 919 }),
      place2({ depth: 3, characterId: 900 }),
      showFrame()
    ]),
    exportAssets([[174, "blood"]])
  ]));
  assert.equal(pack.shapes["960@0"], undefined, "the morph under the enclosing mask is not baked");
  const shapes = pack.props.blood.frames[0].map((placement) => placement.shape);
  assert.ok(!shapes.includes("960@0"), `and not placed, got ${JSON.stringify(shapes)}`);
  assert.ok(shapes.includes(900), "while the unmasked shape beside it still is");
  const named = pack.failures.map((failure) => failure.message);
  assert.ok(named.some((message) => /morph inside a masked sprite this tool cannot clip \(character 960\)/.test(message)),
    `the refusal names the morph and why, got ${JSON.stringify(named)}`);
});

test("A MORPH WHOSE DEFINITION WILL NOT PARSE is refused by name, once as a parse and once as a drop", () => {
  // Four start edges against three end edges: the specification pairs them
  // one for one, so `parseMorphShape` refuses it, and this tool must say so
  // rather than emit a placement pointing at a shape the pack does not hold.
  const pack = extractProps(swfFile([
    defineMorph(962, { endDeltas: [[1000, 0], [0, 1000], [-1000, -1000]] }),
    defineSprite(174, 1, [place2({ depth: 1, characterId: 962 }), showFrame()]),
    exportAssets([[174, "blood"]])
  ]));
  assert.deepEqual(pack.props.blood.frames, [[]], "nothing is emitted for it");
  assert.equal(Object.keys(pack.shapes).length, 0);
  assert.ok(pack.failures.some((failure) => failure.linkage === "morph 962" && /3 end edges/.test(failure.message)),
    `the parse failure, by character, got ${JSON.stringify(pack.failures)}`);
  assert.ok(pack.failures.some((failure) => /frame 1 carries morph whose definition would not parse \(character 962\)/
    .test(failure.message)), "and the placement it cost, by frame");
});

test("a pack with NO morph is untouched: every key is a character id and every shape is a number", () => {
  // ► **THE PACK EVERY OTHER TEST IN THIS FILE READS HAS NO MORPH, so the
  //   morph branch must not have run over it.** Checked by what the branch
  //   would leave behind: a `<id>@<ratio>` key in `shapes`, a string `shape` on
  //   a placement, a `morphCount` above zero. Byte-identity against the
  //   extractor BEFORE this branch existed was measured once, outside the
  //   suite, 2026-09-22: HEAD `0ec8102`'s `extractProps` and this one over
  //   `propsBuild()` write a byte-identical `{props, shapes}`, and manifests
  //   that differ by exactly one line, the new `"morphCount": 0`.
  assert.deepEqual(Object.keys(PACK.shapes).filter((key) => !/^\d+$/.test(key)), []);
  for (const prop of Object.values(PACK.props)) {
    const all = [...prop.frames, ...(prop.clock?.framesByParent ?? []).flat()];
    for (const frame of all) {
      for (const placement of frame) assert.equal(typeof placement.shape, "number", prop.linkage);
    }
  }
  const manifest = manifestFor({
    source: "synthetic.swf", sha256: "0".repeat(64), props: PACK.props, shapes: PACK.shapes,
    failures: PACK.failures, approximated: PACK.approximated, effects: PACK.effects
  });
  assert.equal(manifest.morphCount, 0, "stated as a zero, not absent");

  // ► **AND A MORPH BESIDE A PROP DOES NOT MOVE THAT PROP.** The same arrow,
  //   extracted from a build with a morph-bearing `blood` and from one without.
  const arrow = [solidShape(900, [0xff, 0, 0, 0xff]),
    defineSprite(910, 2, [place2({ depth: 1, characterId: 900 }), showFrame(),
      place2({ depth: 1, move: true, matrix: { tx: 40 } }), showFrame()])];
  const alone = extractProps(swfFile([...arrow, exportAssets([[910, "bullet"]])]));
  const beside = extractProps(swfFile([
    ...arrow, defineMorph(960),
    defineSprite(174, 1, [place2({ depth: 1, characterId: 960, ratio: 13107 }), showFrame()]),
    exportAssets([[910, "bullet"], [174, "blood"]])
  ]));
  assert.deepEqual(beside.props.bullet, alone.props.bullet);
  assert.deepEqual(beside.shapes[900], alone.shapes[900]);
  assert.deepEqual(Object.keys(beside.shapes), ["900", "960@13107"], "the morph joins AFTER the character ids");
});

test("THE MANIFEST'S PER-ENTRY INVOICE IS THE ONLY ONE A HUMAN READS, and it was deletable", () => {
  // ► **MEASURED BY A VERIFIER: removing `effects: prop.effects` from the
  //   written manifest left all fifteen tests in this file green.** `main()`
  //   was exercised by nothing, `assets/props/manifest.json` is gitignored, and
  //   no other test file reads its `effects` at all — `extraction-honesty`
  //   contains the string zero times. So the per-entry invoice, the one place a
  //   reader learns what ONE prop lost, was published by nothing and guarded by
  //   nothing.
  //
  //   The evidence here is a manifest built from the SYNTHETIC build in this
  //   file, never the on-disk pack: `assets/` is regenerated out of band and a
  //   test that reads it is asserting against whatever was written last.
  const manifest = JSON.parse(JSON.stringify(manifestFor({
    source: "synthetic.swf",
    sha256: "0".repeat(64),
    props: PACK.props, shapes: PACK.shapes, failures: PACK.failures,
    approximated: PACK.approximated, effects: PACK.effects
  })));

  assert.deepEqual(Object.keys(manifest.props), Object.keys(PACK.props), "every prop, or none");
  for (const [name, entry] of Object.entries(manifest.props)) {
    assert.ok(entry.effects, `${name} carries no invoice; a pack that invoices some of its entries reads as complete`);
    assert.deepEqual(entry.effects, PACK.props[name].effects,
      `${name}'s published invoice must be the one the pack holds, not a second copy that can drift`);
  }
  // The invoice has to be non-trivial somewhere, or "every entry has one" is
  // ~~twelve~~ fifteen empty objects agreeing.
  const withFilters = Object.values(manifest.props).filter((entry) => entry.effects.own.filters > 0);
  assert.ok(withFilters.length > 0, "the fixture carries own filters on purpose");
  assert.ok(Object.values(manifest.props).some((entry) => entry.effects.inherited.groups > 0));

  // And the pack-level roll-up is the same object the extractor computed, so a
  // manifest that quietly recomputed it could not agree by accident.
  assert.deepEqual(manifest.effects, PACK.effects);
  assert.equal(manifest.shapeCount, Object.keys(PACK.shapes).length);
  assert.deepEqual(manifest.approximated, PACK.approximated);
  assert.equal(manifest.sha256.length, 64, "the oracle's fingerprint travels with the pack");
});

test("THE INSTALLED PACK holds every prop `PROP_EXPORTS` declares, or it predates the extractor", (t) => {
  // ► **WHY THIS EXISTS: A STALE PACK FAILS THIRTEEN OTHER TESTS WITH BARE
  //   NUMBERS.** `test/render-props.test.js` and `test/render-arena-shell.test.js`
  //   pin measured counts over the REAL pack — 3,348 placements, 747 group
  //   instances, 297 paths as they stood with the bolt (3,356, 748 and 604
  //   since the fireball and the boulder; re-derived 2026-09-24 from the
  //   player's pack, where the 13 props of that date still give 3,348, 747
  //   and 297) — and on 2026-09-22 every one of them moved because
  //   `lightning_bolt_combat` joined. A machine that extracted before that date
  //   reads `3345 !== 3348` thirteen times and nothing says why. This test says
  //   why, by name, beside them.
  const tool = path.join(REPO_ROOT, "tools", "extract-props.mjs");
  assert.ok(fs.existsSync(tool), `${tool} is not there, so REPO_ROOT is wrong`);
  const dataAt = path.join(REPO_ROOT, "assets", "props", "props.json");
  if (!fs.existsSync(dataAt)) {
    t.diagnostic("no extracted props pack on this machine — nothing to be stale");
    return;
  }
  const held = new Set(Object.keys(JSON.parse(fs.readFileSync(dataAt, "utf8")).props));
  const missing = PROP_EXPORTS.map((entry) => entry.linkage ?? entry.name).filter((key) => !held.has(key));
  assert.deepEqual(missing, [],
    "the extracted pack predates `PROP_EXPORTS`, so every count test over the real pack is measuring an " +
    "older extraction. Re-run `node tools/extract-props.mjs <your swords_sandals2_download.swf>`.");
});

test("THE INSTALLED PACK, when there is one: its manifest agrees with its own data, on BOTH branches", (t) => {
  // ► **ANCHORED ON A TRACKED FILE.** The trap this avoids is the one that cost
  //   `test/extraction-honesty.test.js` its cover: a check whose only guard
  //   reads the gitignored pack runs `assert.equal(null, null)` on a fresh
  //   clone and passes while asserting nothing. So the ANCHOR is the extractor
  //   itself, which is committed: if that is missing, the path derivation is
  //   broken and this fails by name instead of reading as "no extraction here".
  //
  // ► **AND THIS TEST WALKED INTO THE SAME TRAP ONE BRANCH FURTHER DOWN.** It
  //   used to `return` on `if (!manifest.effects)` — which is the state of
  //   every pack written before the invoice existed, and was the state of the
  //   pack on the only machine that can run this. So the sole assertion it
  //   executed was `fs.existsSync(...)`, and it passed with the entire
  //   extractor reverted to HEAD. A verifier found it and was right.
  //
  //   ~~*`if (!manifest.effects) { t.diagnostic(...); return; }`*~~ is gone.
  //   An OLD pack is now checked against what an old pack has — and the
  //   approximation census, recomputed from the pack's own paths, is in every
  //   version of this manifest there has ever been. The only branch that still
  //   asserts nothing is "there is no pack at all", which is a fresh clone and
  //   says so.
  const tool = path.join(REPO_ROOT, "tools", "extract-props.mjs");
  assert.ok(fs.existsSync(tool),
    `${tool} is not there, so REPO_ROOT is wrong and the absence below would mean nothing`);

  const at = path.join(REPO_ROOT, "assets", "props");
  const dataAt = path.join(at, "props.json");
  const manifestAt = path.join(at, "manifest.json");
  if (!fs.existsSync(dataAt) || !fs.existsSync(manifestAt)) {
    t.diagnostic("no extracted props pack on this machine — this test compared NOTHING; " +
      "every other test in this file ran against the synthetic build above");
    return;
  }

  const data = JSON.parse(fs.readFileSync(dataAt, "utf8"));
  const manifest = JSON.parse(fs.readFileSync(manifestAt, "utf8"));

  // ── What EVERY version of this pack has, so this half never goes vacuous ──
  assert.deepEqual(Object.keys(manifest.props), Object.keys(data.props),
    "the manifest and the data must name the same props");
  assert.equal(manifest.shapeCount, Object.keys(data.shapes).length);
  // Recomputed from the pack's own PATHS, which is the field
  // `test/extraction-honesty.test.js` exists to keep honest — never from the
  // manifest's own copy of the answer.
  const byKind = {};
  let paths = 0;
  for (const shape of Object.values(data.shapes)) {
    for (const entry of shape.paths ?? []) {
      paths += 1;
      if (entry.approximated) byKind[entry.approximated] = (byKind[entry.approximated] ?? 0) + 1;
    }
  }
  const total = Object.values(byKind).reduce((sum, count) => sum + count, 0);
  assert.equal(manifest.approximated.paths, paths, "the manifest's path count against the pack's own paths");
  assert.deepEqual(manifest.approximated.byKind, byKind);
  assert.equal(manifest.approximated.total, total);
  assert.ok(total > 0, "the installed build contains gradients and bitmaps; a zero here means the census died");

  if (!manifest.effects) {
    // NOT a free pass: the checks above ran against this pack. This branch says
    // only that the EFFECT invoice is not in it yet.
    t.diagnostic(`installed pack predates the effect invoice (${paths} paths, ${total} approximated checked); ` +
      "re-run `node tools/extract-props.mjs` to exercise the other half");
    return;
  }

  // ── And the effect invoice, recomputed from the pack's own placements ──
  let under = 0;
  let groups = 0;
  let droppedFilters = 0;
  for (const prop of Object.values(data.props)) {
    groups += (prop.effectGroups ?? []).length;
    droppedFilters += prop.effects?.own?.dropped?.filters ?? 0;
    for (const frame of prop.frames) for (const placement of frame) if (placement.inheritedEffects) under += 1;
    // ► **AND EVERY CLOCK FRAME, because those are placements the pack holds
    //   too.** Added 2026-09-22 with `lightning_bolt_combat`: its 24 clock
    //   frames sit under the bolt's own group and the invoice counts them
    //   (3235), while a walk over `frames` alone found 3211. The invoice was
    //   right and this walk was the one that had stopped visiting all of the
    //   data. "Recomputed from the pack's own placements" has to mean ALL of
    //   them, or it is a second copy of the invoice's scope and not a check.
    for (const ages of prop.clock?.framesByParent ?? []) {
      for (const frame of ages) for (const placement of frame) if (placement.inheritedEffects) under += 1;
    }
  }
  assert.equal(manifest.effects.groups, groups, "manifest group count against the pack's own groups");
  assert.equal(manifest.effects.placementsUnderAGroup, under);
  // ► **THE ZERO AND THE REFUSAL, TOGETHER.** `ownFilters` is 0 across this
  //   build and always was; what makes that honest is `droppedOwnFilters`
  //   beside it, and the two must be summed from the same per-prop invoices
  //   they are published from.
  assert.equal(manifest.effects.droppedOwnFilters, droppedFilters,
    "the refused own filters in the manifest must be the sum of the per-prop ones");
  t.diagnostic(`installed pack: ${groups} groups over ${under} placements, ` +
    `${manifest.effects.ownFilters} own filters carried and ${droppedFilters} refused`);
});
