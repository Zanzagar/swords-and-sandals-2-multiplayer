/**
 * THE ICON AND FACE EXTRACTOR, and the two silent drops it exists to stop.
 *
 * ► **DEFECT ONE: a nested sprite rendered at frame 1, reported as complete.**
 *   `damage_icon` declares 30 frames and every one of them is the same child
 *   clip; the SEVERITY of the hit is that child's OWN frame, and
 *   `damagecharacter` drives it with `damage_splat.gotoAndStop(1|3|5)`.
 *   `flattenFrame` descends into a nested sprite at its frame 1 unless told
 *   otherwise, so flattening the parent collapses five splat arts into one and
 *   the failure count stays at zero. `bonus_icon`'s child has eight frames and
 *   `addstats_icon`'s has seven.
 *
 * ► **DEFECT TWO: a mask over a nested sprite, dropped with nothing reported.**
 *   `combat_panel`'s six gauges are each a shape mask at one depth and a
 *   SPRITE holding the liquid at the next. `flattenFrame` rebuilds its mask
 *   table per level and never threads one into a child, and a masked sprite is
 *   skipped before `unsupported` is ever set — so the liquid comes back whole
 *   with `maskPath: null` and no failure. The bar paints outside its vial and
 *   the extraction calls it clean.
 *
 * So the load-bearing tests here are not "the geometry is right". They are
 * **"a thing this tool cannot read is COUNTED"** and **"a frame that carries a
 * meaning is not collapsed into another one"**. Both defects drew something
 * plausible; neither raised anything.
 *
 * Everything that can run on a SYNTHETIC buffer does, so a clone with no
 * licensed copy still executes it. The ones that need the real build say so by
 * name in their skip.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

import {
  BUTTON_OVERLAY,
  CROWD_BAR,
  ExtractIconsError,
  GAUGE_PANEL,
  FACE_CLIPS,
  ICON_CLIPS,
  NESTED_MEANINGS,
  ORACLE_SHA256,
  actionStatementsOf,
  bindExpressions,
  boundFieldOf,
  buildManifest,
  deriveButtonHandlers,
  deriveClipEvents,
  deriveCrowdDrive,
  deriveExpressionCalls,
  deriveGaugeAttach,
  deriveGaugeDrive,
  deriveGaugeProvenance,
  deriveOptionWiring,
  deriveTimelineActions,
  extractIcons,
  flattenIconFrame,
  ownEffectsOf,
  parseArguments,
  refusedEffectsOf,
  parseEditText,
  parseStaticText,
  readRect,
  roundColour,
  roundMatrix,
  summariseCrowdBar,
  summariseGaugePanel,
  summariseOverlayLayout,
  tallyIconEffects,
  toPlacement
} from "../tools/extract-icons.mjs";
import { IDENTITY_MATRIX, indexCharacters, resolveTimeline } from "../tools/swf-display-list.mjs";
// The READER of the buttons section, imported for the same reason
// `test/extract-props.test.js` imports the props renderer: the only way to show
// the extractor's output is drawable is to hand it to the renderer.
import { actionButtonOpsFor, actionButtonPackFrom } from "../src/render/action-buttons.js";
// And the gauges' reader, whose hand-cited drive and placements are checked
// against what the extraction derives from the bytes.
import { SS2_COMBAT_PANEL, SS2_GAUGE_DRIVE } from "../src/render/combat-panel.js";
// And the crowd bar's, likewise (D8).
import { SS2_CROWD_BAR, SS2_CROWD_BAR_DRIVE, SS2_CROWD_MOODS } from "../src/render/crowd-bar.js";

/** Two `{x, y}` points equal to 0.001 px. */
function near2(actual, expected) {
  assert.ok(Math.abs(actual.x - expected.x) < 1e-3 && Math.abs(actual.y - expected.y) < 1e-3,
    `${JSON.stringify(actual)} against ${JSON.stringify(expected)}`);
}

/* ------------------------------------------------------------------ */
/* Synthetic SWF fragments — no licensed build needed                  */
/* ------------------------------------------------------------------ */

function tagBytes(code, body) {
  const header = Buffer.alloc(2);
  header.writeUInt16LE((code << 6) | body.length, 0);
  return Buffer.concat([header, body]);
}

/** A `PlaceObject2` carrying a character, and optionally a name and a clip depth. */
function placeTag(depth, characterId, { clipDepth = null, name = null } = {}) {
  let flags = 0x02;
  if (name !== null) flags |= 0x20;
  if (clipDepth !== null) flags |= 0x40;
  const head = Buffer.alloc(5);
  head.writeUInt8(flags, 0);
  head.writeUInt16LE(depth, 1);
  head.writeUInt16LE(characterId, 3);
  const parts = [head];
  // The reader takes the NAME before the CLIP DEPTH; swapping them here would
  // make this fixture disagree with the parser and prove nothing.
  if (name !== null) parts.push(Buffer.from(`${name}\0`, "utf8"));
  if (clipDepth !== null) {
    const tail = Buffer.alloc(2);
    tail.writeUInt16LE(clipDepth, 0);
    parts.push(tail);
  }
  return tagBytes(26, Buffer.concat(parts));
}

const showFrameTag = () => tagBytes(1, Buffer.alloc(0));
const endTag = () => tagBytes(0, Buffer.alloc(0));

/**
 * A buffer holding several sprite bodies, and a `characters` map pointing into
 * it — the two arguments `flattenIconFrame` actually needs.
 */
function buildFixture(sprites) {
  const characters = new Map();
  const chunks = [];
  let offset = 0;
  for (const sprite of sprites) {
    const body = Buffer.concat([...sprite.tags, endTag()]);
    characters.set(sprite.id, {
      id: sprite.id, kind: "sprite", tagCode: 39,
      frames: sprite.frames, bodyStart: offset, bodyEnd: offset + body.length
    });
    chunks.push(body);
    offset += body.length;
  }
  return { buffer: Buffer.concat(chunks), characters };
}

/** A leaf character of any kind, at an offset nothing reads. */
function leaf(characters, id, kind, tagCode = 2) {
  characters.set(id, { id, kind, tagCode, bodyStart: 0, bodyEnd: 0 });
}

/* ------------------------------------------------------------------ */
/* 1. The CLI                                                          */
/* ------------------------------------------------------------------ */

test("an unknown flag THROWS rather than running a different job and reporting it as this one", () => {
  assert.equal(parseArguments(["--report"]).report, true);
  assert.equal(parseArguments(["/some/build.swf"]).file, "/some/build.swf");
  assert.match(parseArguments([]).out, /assets[/\\]icons$/);
  assert.equal(parseArguments(["--out", "/tmp/x"]).out, "/tmp/x");
  assert.throws(() => parseArguments(["--faces"]), (error) => {
    assert.ok(error instanceof ExtractIconsError);
    assert.match(error.message, /Unknown flag "--faces"/);
    return true;
  });
  assert.throws(() => parseArguments(["--out"]), /--out needs a directory path/);
  assert.throws(() => parseArguments(["--out", "--report"]), /--out needs a directory path/);
  assert.throws(() => parseArguments(["a.swf", "b.swf"]), /Unexpected argument: b\.swf/);
});

/* ------------------------------------------------------------------ */
/* 2. Units — the seam that has already cost this project two defects  */
/* ------------------------------------------------------------------ */

test("a matrix reaches JSON with its translation STILL IN TWIPS, and -0 normalised to 0", () => {
  // ► `shapeToPaths` emits PIXELS and a display-list matrix carries TWIPS.
  //   Converting here would put a factor of twenty between this data and every
  //   other extraction in the repository, which is exactly the defect that made
  //   three rows of the arena size table wrong by that factor.
  assert.deepEqual(roundMatrix({ a: 1, b: 0, c: 0, d: 1, tx: 6420, ty: -1330 }), [1, 0, 0, 1, 6420, -1330]);
  assert.deepEqual(roundMatrix({ a: 0.5000049, b: 0, c: 0, d: 0.5, tx: 0.04, ty: 0 }), [0.5, 0, 0, 0.5, 0, 0]);
  // -0 round-trips through JSON as -0 and compares unequal under Object.is,
  // which is how a byte-identical re-extraction reads as a changed one.
  const negativeZero = roundMatrix({ a: -0, b: -0, c: 0, d: 1, tx: -0, ty: -0.01 });
  for (const value of negativeZero) assert.ok(!Object.is(value, -0), `${value} must not be -0`);
});

test("an identity colour transform is dropped rather than written 190 times", () => {
  assert.equal(roundColour(null), null);
  assert.equal(roundColour({
    redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 1,
    redOffset: 0, greenOffset: 0, blueOffset: 0, alphaOffset: 0
  }), null);
  assert.deepEqual(roundColour({
    redMultiplier: 0.5, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 1,
    redOffset: 0, greenOffset: 0, blueOffset: 0, alphaOffset: -16
  }), [0.5, 1, 1, 1, 0, 0, 0, -16]);
});

/* ------------------------------------------------------------------ */
/* 3. The text characters, which are where the NUMBERS live            */
/* ------------------------------------------------------------------ */

test("a RECT is read in twips and leaves the cursor on the next BYTE boundary", () => {
  // 5 bits of nbits then four SIGNED fields; the next structure starts on the
  // following byte boundary. nbits = 7 because 40 does not fit in six signed
  // bits — it reads as -24, which is a rectangle that still looks like one.
  const bits = "00111" + "0000000" + "0101000" + "0000000" + "0010100";
  const padded = bits.padEnd(40, "0");
  const bytes = Buffer.alloc(6);
  for (let index = 0; index < 5; index += 1) bytes[index] = parseInt(padded.slice(index * 8, index * 8 + 8), 2);
  const read = readRect(bytes, 0);
  assert.deepEqual(read.bounds, { xMin: 0, xMax: 40, yMin: 0, yMax: 20 });
  assert.equal(read.next, 5, "33 bits of RECT must leave the cursor at byte 5, not byte 4");
  // And the sign is not optional: a negative bound is how a clip that is
  // centred on its own origin describes itself, which is most of this corpus.
  const negative = readRect(Buffer.from([0b00101111, 0b10000000, 0, 0]), 0);
  assert.equal(negative.bounds.xMin, -2, "nbits 5, first field 11110 is -2");
});

/** A `DefineEditText` body with the flags and fields this build actually uses. */
function editTextBody({ id, variable, initialText, align = 2 }) {
  const rect = Buffer.from([0b00001000, 0x00]); // nbits 1, four zero fields, padded
  // HasText | HasTextColor | HasFont | HasLayout
  const flags = Buffer.alloc(2);
  flags.writeUInt16BE((1 << 15) | (1 << 10) | (1 << 8) | (1 << 5), 0);
  const font = Buffer.alloc(4);
  font.writeUInt16LE(118, 0);
  font.writeUInt16LE(680, 2); // 34 px in twips
  const colour = Buffer.from([255, 255, 0, 255]);
  const layout = Buffer.alloc(9);
  layout[0] = align;
  const head = Buffer.alloc(2);
  head.writeUInt16LE(id, 0);
  return Buffer.concat([
    head, rect, flags, font, colour, layout,
    Buffer.from(`${variable}\0`, "utf8"),
    Buffer.from(`${initialText}\0`, "utf8")
  ]);
}

test("a DefineEditText gives up its VARIABLE, its initial text, its colour and its box", () => {
  // ► **THE SPLAT IS THE PICTURE AND THE NUMBER IS A FIELD.** `damage_icon`'s
  //   text character is bound to the variable `damage`; a renderer that drew
  //   only the shapes would show an empty splat over every hit. Recovering the
  //   binding is what makes the icon usable at all.
  const body = editTextBody({ id: 816, variable: "damage", initialText: "0" });
  const field = parseEditText(body, 0, body.length);
  assert.equal(field.id, 816);
  assert.equal(field.kind, "edit-text");
  assert.equal(field.variable, "damage");
  assert.equal(field.initialText, "0");
  assert.equal(field.fontId, 118);
  assert.equal(field.fontHeight, 34, "font height is twips in the tag and PIXELS here");
  assert.deepEqual(field.colour, { red: 255, green: 255, blue: 0, alpha: 255 });
  assert.equal(field.align, "center");
});

test("a field with no initial text reports null, not the empty string", () => {
  // `herotext` has no initial text; "" and null are different claims about the
  // build and only one of them is true.
  const rect = Buffer.from([0b00001000, 0x00]);
  const flags = Buffer.alloc(2); // no HasText, no font, no colour, no layout
  const head = Buffer.alloc(2);
  head.writeUInt16LE(734, 0);
  const body = Buffer.concat([head, rect, flags, Buffer.from("herotext\0", "utf8")]);
  const field = parseEditText(body, 0, body.length);
  assert.equal(field.variable, "herotext");
  assert.equal(field.initialText, null);
  assert.equal(field.fontId, null);
  assert.equal(field.colour, null);
});

test("a STATIC text reports the box it reserved and NULLS for what was not read", () => {
  // Its glyphs index a font table this tool does not read, so the honest answer
  // is a rectangle plus explicit nulls — never an absent key a consumer reads
  // as undefined and treats as "no font was set".
  const head = Buffer.alloc(2);
  head.writeUInt16LE(820, 0);
  const body = Buffer.concat([head, Buffer.from([0b00001000, 0x00])]);
  const field = parseStaticText(body, 0);
  assert.equal(field.id, 820);
  assert.equal(field.kind, "static-text");
  assert.equal(field.variable, null);
  assert.equal(field.fontId, null);
  assert.equal(field.colour, null);
  assert.ok(Object.hasOwn(field, "fontHeight"), "the key must exist even when nothing filled it");
});

/* ------------------------------------------------------------------ */
/* 4. THE FLATTEN — the two defects                                    */
/* ------------------------------------------------------------------ */

test("A MULTI-FRAME CHILD IS NOT DESCENDED INTO — five splats do not become one", () => {
  // ► This is `damage_icon` in miniature: a 30-frame parent whose every frame
  //   holds the same 5-frame child. Descending would take the child's frame 1
  //   thirty times, lose four arts, and report nothing at all.
  const { buffer, characters } = buildFixture([
    { id: 815, frames: 5, tags: [placeTag(1, 807), showFrameTag()] }
  ]);
  leaf(characters, 807, "shape");
  const { drawables } = flattenIconFrame(buffer, characters, [
    { depth: 1, characterId: 815, name: "damage_splat", matrix: IDENTITY_MATRIX }
  ]);
  assert.equal(drawables.length, 1);
  assert.equal(drawables[0].kind, "clip", "a 5-frame child is an ASSET, not scenery to flatten");
  assert.equal(drawables[0].characterId, 815);
  assert.equal(drawables[0].frameCount, 5, "the frame count is what says four more meanings exist");
  assert.equal(drawables[0].name, "damage_splat", "the instance name is what the build's own goto reaches for");
  assert.equal(drawables[0].unsupported, null, "it is not unreadable — it is READ SEPARATELY");
});

test("a ONE-frame child IS descended into, because it has no other meaning to lose", () => {
  const { buffer, characters } = buildFixture([
    { id: 729, frames: 1, tags: [placeTag(1, 728), showFrameTag()] }
  ]);
  leaf(characters, 728, "shape");
  const { drawables } = flattenIconFrame(buffer, characters, [
    { depth: 3, characterId: 729, matrix: IDENTITY_MATRIX }
  ]);
  assert.equal(drawables.length, 1);
  assert.equal(drawables[0].kind, "shape");
  assert.equal(drawables[0].characterId, 728);
  assert.deepEqual(drawables[0].path, [3, 1], "the path keeps the nesting the depth alone cannot express");
});

test("A MASK IS THREADED INTO A NESTED SPRITE, and the crossing is COUNTED", () => {
  // ► **THE SIX GAUGES.** Shape mask at depth 2 with clipDepth 5; depth 3 is a
  //   sprite holding the liquid. `flattenFrame` loses this with no
  //   `unsupported` and no failure, which is why the count exists rather than
  //   only the fix: a number a human reads is what makes the difference between
  //   the two visible at all.
  const { buffer, characters } = buildFixture([
    { id: 729, frames: 1, tags: [placeTag(1, 728), showFrameTag()] }
  ]);
  leaf(characters, 727, "shape");
  leaf(characters, 728, "shape");
  leaf(characters, 730, "shape");
  const result = flattenIconFrame(buffer, characters, [
    { depth: 2, characterId: 727, clipDepth: 5, matrix: IDENTITY_MATRIX },
    { depth: 3, characterId: 729, matrix: IDENTITY_MATRIX },
    { depth: 6, characterId: 730, matrix: IDENTITY_MATRIX }
  ]);
  const liquid = result.drawables.find((drawable) => drawable.characterId === 728);
  assert.ok(liquid, "the liquid inside the masked sprite must still be emitted");
  assert.ok(liquid.mask, "and it must carry the mask that crops it to the vial");
  assert.equal(liquid.mask.shape, 727);
  assert.equal(result.clipsAcrossSpriteBoundary, 1,
    "one clip was recovered across a sprite boundary, which is one flattenFrame drops");
  // Depth 6 is outside the clip range and must NOT pick the mask up.
  const outside = result.drawables.find((drawable) => drawable.characterId === 730);
  assert.equal(outside.mask, null, "a depth past clipDepth is not masked");
  // And the cutter itself is never a drawing: painting it puts the stencil on
  // the canvas instead of the picture.
  assert.equal(result.drawables.some((drawable) => drawable.characterId === 727 && drawable.kind !== "mask"), false);
});

test("KEEP-AS-CLIP: the gauges' ONE-frame liquid comes back as a named clip carrying its rest matrix and its own mask", () => {
  // ► `blood_health` has one frame, so the roster's flatten descends into it
  //   and folds its rest matrix into the leaf. The build MOVES it every frame
  //   (`this.blood_health._y = …`), so the gauges section asks for it whole:
  //   a clip placement, its own translation, and the same-level cutter that
  //   crops it — no identity coincidence left for a renderer to lean on.
  const { buffer, characters } = buildFixture([
    { id: 729, frames: 1, tags: [placeTag(1, 728), showFrameTag()] }
  ]);
  leaf(characters, 727, "shape");
  leaf(characters, 728, "shape");
  leaf(characters, 730, "shape");
  const list = [
    { depth: 2, characterId: 727, clipDepth: 5, matrix: IDENTITY_MATRIX },
    { depth: 3, characterId: 729, name: "blood_health", matrix: { ...IDENTITY_MATRIX, tx: -484, ty: -531 } },
    { depth: 6, characterId: 730, matrix: IDENTITY_MATRIX }
  ];
  const kept = flattenIconFrame(buffer, characters, list, { keepAsClip: (entry) => entry.name === "blood_health" });
  const liquid = kept.drawables.find((drawable) => drawable.characterId === 729);
  assert.ok(liquid, "the sprite itself, not its leaf");
  assert.equal(liquid.kind, "clip");
  assert.equal(liquid.name, "blood_health");
  assert.equal(liquid.frameCount, 1);
  assert.deepEqual([liquid.matrix.tx, liquid.matrix.ty], [-484, -531], "the REST matrix, on the clip and nowhere else");
  assert.equal(liquid.mask.shape, 727, "the cutter rides on the clip placement");
  assert.equal(kept.clipsAcrossSpriteBoundary, 0, "a same-level mask is not a crossing");
  assert.equal(kept.drawables.some((drawable) => drawable.characterId === 728), false, "and the leaf is NOT also emitted");
  assert.equal(toPlacement(liquid).frameCount, 1, "the JSON says one frame, so a reader knows it was kept, not refused");
  // Without the option, the roster's own walk is exactly what it was.
  const roster = flattenIconFrame(buffer, characters, list);
  assert.equal(roster.drawables.find((drawable) => drawable.characterId === 728).kind, "shape");
  assert.equal(roster.drawables.some((drawable) => drawable.characterId === 729), false);
  assert.equal(roster.clipsAcrossSpriteBoundary, 1);
});

test("a mask that is a SPRITE is REFUSED BY NAME rather than quietly ignored", () => {
  const { buffer, characters } = buildFixture([
    { id: 900, frames: 1, tags: [placeTag(1, 901), showFrameTag()] }
  ]);
  leaf(characters, 901, "shape");
  leaf(characters, 902, "shape");
  const { drawables } = flattenIconFrame(buffer, characters, [
    { depth: 1, characterId: 900, clipDepth: 4, matrix: IDENTITY_MATRIX },
    { depth: 2, characterId: 902, matrix: IDENTITY_MATRIX }
  ]);
  const refused = drawables.find((drawable) => drawable.kind === "mask");
  assert.ok(refused, "a mask this tool cannot turn into a clip path must still appear");
  assert.equal(refused.unsupported, "mask-sprite");
  const masked = drawables.find((drawable) => drawable.characterId === 902);
  assert.equal(masked.mask, null, "and nothing may claim to be clipped by a mask that was refused");
});

test("every drawable this tool cannot turn into geometry names its KIND", () => {
  // An approximation that is not counted is indistinguishable from a correct
  // read. Each of these has to arrive with a name a manifest can tally.
  const { buffer, characters } = buildFixture([
    { id: 1, frames: 1, tags: [showFrameTag()] }
  ]);
  leaf(characters, 10, "shape");
  leaf(characters, 11, "text", 37);
  leaf(characters, 12, "morph", 46);
  leaf(characters, 13, "bitmap", 21);
  leaf(characters, 14, "button", 34);
  const { drawables } = flattenIconFrame(buffer, characters, [
    { depth: 1, characterId: 10, matrix: IDENTITY_MATRIX },
    { depth: 2, characterId: 11, matrix: IDENTITY_MATRIX },
    { depth: 3, characterId: 12, matrix: IDENTITY_MATRIX },
    { depth: 4, characterId: 13, matrix: IDENTITY_MATRIX },
    { depth: 5, characterId: 14, matrix: IDENTITY_MATRIX },
    { depth: 6, characterId: 9999, matrix: IDENTITY_MATRIX }
  ]);
  const named = Object.fromEntries(drawables.map((drawable) => [drawable.characterId, drawable.unsupported]));
  assert.deepEqual(named, {
    10: null, 11: "text-placement", 12: "morph-placement",
    13: "bitmap-placement", 14: "button-placement", 9999: "missing"
  });
  assert.equal(drawables.length, 6, "nothing was dropped on the way through");
});

/* ------------------------------------------------------------------ */
/* 4b. THE EFFECTS — the third silent drop, and the one that was the    */
/*     easiest to miss because NOTHING upstream was broken              */
/* ------------------------------------------------------------------ */

/**
 * ► **THE DEFECT THESE TESTS PIN.** `flattenIconFrame` is this tool's own walk
 *   — written because `flattenFrame` drops six masks in `combat_panel` — and
 *   `flattenFrame`'s effect threading did not come with it. It read `matrix`,
 *   `colourTransform`, `name`, `ratio` and `clipDepth` off an entry and never
 *   `filters`, `hasFilters` or `blendMode`. All 176 filters the icon roster
 *   reaches died HERE, on the way out of a walk that reported no failure and no
 *   approximation, because a field nobody reads is indistinguishable from a
 *   field nobody sent.
 *
 *   **Nothing upstream needed changing**, which is the uncomfortable part and
 *   the reason the first test below asserts the premise rather than assuming
 *   it: `parsePlaceObject` has decoded filter lists into typed records, and
 *   `resolveTimeline` has merged them field-by-field across a move, for as long
 *   as this walk has existed.
 */

/**
 * One GLOW record on the wire: the filter id 2, then RGBA, two 16.16 blurs, an
 * 8.8 strength and a flag byte.
 */
function glowFilter({ colour = [0, 0, 255, 255], blurX = 4, blurY = 4, strength = 2, inner = false } = {}) {
  const body = Buffer.alloc(16);
  body.writeUInt8(2, 0);
  for (let index = 0; index < 4; index += 1) body.writeUInt8(colour[index], index + 1);
  body.writeInt32LE(Math.round(blurX * 65536), 5);
  body.writeInt32LE(Math.round(blurY * 65536), 9);
  body.writeInt16LE(Math.round(strength * 256), 13);
  // Inner, Knockout, CompositeSource, then Passes UB[5]. 0x21 is what 881 of
  // the build's 884 glows and shadows carry: composite source set, one pass.
  body.writeUInt8((inner ? 0x80 : 0) | 0x21, 15);
  return body;
}

/**
 * A FILTERLIST: a COUNT byte and then that many records.
 *
 * ► The count is a separate byte from the first record's id, and conflating the
 *   two is not a subtle bug — the first draft of this helper emitted the glow's
 *   id 2 AS the count, so the parser read two filters where there was one and
 *   threw reading past the tag. It failed loudly, which is the only reason this
 *   note is a note and not a wrong fixture agreeing with a wrong walk.
 */
const filterList = (...records) => Buffer.concat([Buffer.from([records.length]), ...records]);

/** A filter list of COUNT ZERO — the wire's way of saying "cleared", not "none". */
const clearedFilterList = () => filterList();

/**
 * A `PlaceObject3` carrying a character and, optionally, a filter list and a
 * blend mode. The field ORDER here is the wire's — name, then clipDepth, then
 * FILTERS, then blend mode — and getting it wrong would make this fixture
 * disagree with `parsePlaceObject` and prove nothing.
 */
function place3Tag(depth, characterId, { filters = null, blendMode = null, clipDepth = null, name = null } = {}) {
  let flags = 0x02;
  let flags2 = 0;
  if (name !== null) flags |= 0x20;
  if (clipDepth !== null) flags |= 0x40;
  if (filters !== null) flags2 |= 0x01;
  if (blendMode !== null) flags2 |= 0x02;
  const head = Buffer.alloc(6);
  head.writeUInt8(flags, 0);
  head.writeUInt8(flags2, 1);
  head.writeUInt16LE(depth, 2);
  head.writeUInt16LE(characterId, 4);
  const parts = [head];
  if (name !== null) parts.push(Buffer.from(`${name}\0`, "utf8"));
  if (clipDepth !== null) {
    const tail = Buffer.alloc(2);
    tail.writeUInt16LE(clipDepth, 0);
    parts.push(tail);
  }
  if (filters !== null) parts.push(filters);
  if (blendMode !== null) parts.push(Buffer.from([blendMode]));
  return tagBytes(70, Buffer.concat(parts));
}

test("THE ENTRIES WERE CARRYING THE FILTERS ALL ALONG — this walk simply never read them", () => {
  // ► **THE PREMISE, ASSERTED RATHER THAN ASSUMED.** This fixture is a real
  //   `PlaceObject3` with a real filter list, resolved by the real
  //   `resolveTimeline` inside `flattenIconFrame`'s own `innerFrame`. If the
  //   filter reaches the drawable, the fix was threading and nothing else; if
  //   it does not, the job was somewhere upstream and this test says so before
  //   any number in the invoice can be believed.
  const { buffer, characters } = buildFixture([
    // Three levels, because the glow has to be on the placement of a SPRITE to
    // be a group at all: on the placement of a shape it is that shape's own,
    // which is a different claim and the next test's.
    { id: 700, frames: 1, tags: [place3Tag(1, 710, { filters: filterList(glowFilter({ blurX: 6, blurY: 6 })) }), showFrameTag()] },
    { id: 710, frames: 1, tags: [placeTag(1, 701), showFrameTag()] }
  ]);
  leaf(characters, 701, "shape");
  const { drawables } = flattenIconFrame(buffer, characters, [
    { depth: 3, characterId: 700, matrix: IDENTITY_MATRIX }
  ]);
  assert.equal(drawables.length, 1);
  const leafShape = drawables[0];
  assert.equal(leafShape.characterId, 701);
  // The glow is on the placement of sprite 710 INSIDE sprite 700, so for the
  // shape below it, it is an ancestor effect and not its own.
  assert.equal(leafShape.filters, null, "the enclosing placement's glow is not this leaf's own");
  assert.equal(leafShape.hasFilters, false);
  assert.equal(leafShape.ancestorEffects.length, 1);
  const [group] = leafShape.ancestorEffects;
  assert.deepEqual(group.path, [3, 1], "the group names the path that reaches it, not just its depth");
  assert.equal(group.characterId, 710);
  assert.equal(group.hasFilters, true);
  assert.equal(group.filters.length, 1);
  assert.equal(group.filters[0].type, "glow");
  assert.equal(group.filters[0].blurX, 6, "the 16.16 fixed point is decoded, not carried as an integer");
  assert.equal(group.filters[0].colour.blue, 255);
});

test("a placement's OWN filter and blend mode reach its own drawable, and its ancestors' do not", () => {
  const { buffer, characters } = buildFixture([
    { id: 1, frames: 1, tags: [showFrameTag()] }
  ]);
  leaf(characters, 10, "shape");
  const { drawables } = flattenIconFrame(buffer, characters, [
    { depth: 1, characterId: 10, matrix: IDENTITY_MATRIX, hasFilters: true, filters: [{ type: "glow" }], blendMode: 3 },
    { depth: 2, characterId: 10, matrix: IDENTITY_MATRIX }
  ]);
  const [own, bare] = drawables;
  assert.deepEqual(own.filters, [{ type: "glow" }]);
  assert.equal(own.hasFilters, true);
  assert.equal(own.blendMode, 3);
  assert.equal(own.ancestorEffects, null, "an empty chain is NULL and never [] — see `flattenFrame`'s own note");
  // ► **PAIRED, because a one-sided negative is not a test.** The same run has
  //   to show a drawable that carries all three, or "absent here" and "nobody
  //   writes them" have the same answer and a full revert stays green.
  assert.equal(bare.filters, null);
  assert.equal(bare.hasFilters, false);
  assert.equal(bare.blendMode, undefined,
    "undefined and NOT null, matching flattenFrame's literal: a reader moving between the two walks " +
    "must not meet the same absence in two spellings");
  assert.equal(bare.ancestorEffects, null);
});

test("A MULTI-FRAME CHILD CARRIES THE CHAIN THAT ENCLOSES IT — and its OWN effects are not in that chain", () => {
  // ► **THE DOUBLE-COUNT TRAP.** A `clip` placement is the one drawable that is
  //   both a leaf here and a group elsewhere. Handing it the chain it hands its
  //   own children would invoice its filters twice — once as own, once as
  //   inherited — and the pack total would read 178 for a build holding 176.
  //   `inventory_buttons`' greyed-out `battlebutton` is exactly this shape.
  const { buffer, characters } = buildFixture([
    { id: 800, frames: 1, tags: [place3Tag(1, 815, { filters: filterList(glowFilter()) }), showFrameTag()] },
    { id: 815, frames: 5, tags: [placeTag(1, 807), showFrameTag()] }
  ]);
  leaf(characters, 807, "shape");
  const { drawables } = flattenIconFrame(buffer, characters, [
    // The outer sprite 800 carries no effect of its own; the glow is on ITS
    // placement of the five-frame child, so the child's own list holds it.
    { depth: 2, characterId: 800, matrix: IDENTITY_MATRIX, hasFilters: true, filters: [{ type: "blur" }] }
  ]);
  assert.equal(drawables.length, 1);
  const [child] = drawables;
  assert.equal(child.kind, "clip", "five frames are five meanings and are not flattened away");
  assert.equal(child.characterId, 815);
  assert.equal(child.filters.length, 1);
  assert.equal(child.filters[0].type, "glow", "the child placement's OWN filter");
  assert.equal(child.ancestorEffects.length, 1, "exactly the chain that ENCLOSES it");
  assert.equal(child.ancestorEffects[0].characterId, 800);
  assert.deepEqual(child.ancestorEffects[0].filters, [{ type: "blur" }]);
  assert.equal(
    child.ancestorEffects.some((group) => group.characterId === 815), false,
    "a clip must not appear in its own ancestor chain, or its filters are invoiced twice");
});

test("A FILTER LIST OF COUNT ZERO IS 'CLEARED', NOT 'NOBODY ASKED' — and it is refused BY NAME", () => {
  // ► **38 OF THESE ARE IN THE SHIPPED BUILD**, all on `inventory_buttons`'
  //   battlebutton. Writing one as `filters: []` claims a list the renderer
  //   should apply; writing it as `filters: null` claims nobody ever set one.
  //   Both are wrong, so the list is dropped and the DROP is counted.
  const { buffer, characters } = buildFixture([
    { id: 1, frames: 1, tags: [showFrameTag()] },
    { id: 900, frames: 1, tags: [place3Tag(1, 901, { filters: clearedFilterList() }), showFrameTag()] }
  ]);
  leaf(characters, 901, "shape");
  const { drawables } = flattenIconFrame(buffer, characters, [
    { depth: 1, characterId: 900, matrix: IDENTITY_MATRIX }
  ]);
  const [shape] = drawables;
  assert.equal(shape.ancestorEffects, null,
    "a CLEARED list encloses nothing: there is no group to point at, only a fact to count");

  // And the fact, counted, on the placement that carries it.
  const notCarried = {};
  const own = ownEffectsOf({ hasFilters: true, filters: [] }, notCarried);
  assert.equal(Object.hasOwn(own, "filters"), false, "an empty list must never be written as `filters: []`");
  assert.equal(notCarried.emptyFilterList, 1, "the distinction survives as a NUMBER with a name");
  // Paired with the other two cases, or "1" above could be any of them.
  const nobodyAsked = {};
  ownEffectsOf({ hasFilters: false, filters: null }, nobodyAsked);
  assert.deepEqual(nobodyAsked, {}, "a placement with no filter flag at all owes nothing");
  const real = {};
  const carried = ownEffectsOf({ hasFilters: true, filters: [{ type: "glow" }] }, real);
  assert.deepEqual(carried.filters, [{ type: "glow" }]);
  assert.deepEqual(real, {}, "a list with something in it is carried, not refused");
});

test("THE TWO REFUSAL BRANCHES THAT MEASURE ZERO ON THE BUILD ARE STILL EXERCISED HERE", () => {
  // ► **A COUNTED ZERO WHOSE COUNTER IS NEVER RUN IS NOT A COUNTED ZERO.** Two
  //   branches in the extractor's invoice report nothing against the oracle:
  //   own effects on a drawable this tool DROPS (a refused mask, a missing
  //   character), and a filter record `parseFilterList` flags as UNMEASURED —
  //   the three filter kinds that occur zero times in the shipped build. Both
  //   would be dead code proving its own absence, so both are driven here with
  //   inputs the build does not contain.
  const refusedOwn = { filterLists: [], blendModes: [] };
  const notCarried = {};
  const suffix = refusedEffectsOf(
    { kind: "mask", characterId: 900, hasFilters: true, filters: [{ type: "blur" }, { type: "glow" }], blendMode: 3 },
    refusedOwn, notCarried);
  assert.equal(notCarried.droppedDrawableFilters, 2, "counted per FILTER, not per drawable");
  assert.equal(notCarried.droppedDrawableBlendMode, 1);
  assert.equal(refusedOwn.filterLists.length, 1);
  assert.deepEqual(refusedOwn.blendModes, [3]);
  // The failures list a human reads has to name the loss too: it used to say
  // only what KIND of drawable went, which reads as "and it carried nothing".
  assert.match(suffix, /dropping 2 own blur\+glow and own blend mode 3/);

  const cleared = { filterLists: [], blendModes: [] };
  const clearedTally = {};
  assert.equal(refusedEffectsOf({ hasFilters: true, filters: [] }, cleared, clearedTally),
    ", dropping an own filter list of COUNT ZERO",
    "the failures line names it in words too, or a reader sees only the kind of drawable that went");
  assert.equal(clearedTally.droppedDrawableEmptyFilterList, 1,
    "a CLEARED list leaving with its drawable is still a fact about the instance");
  assert.equal(cleared.filterLists.length, 0, "and it is not a filter list, so it joins none");

  const unmeasured = {};
  const carried = ownEffectsOf(
    { hasFilters: true, filters: [{ type: "gradientGlow", measured: false }] }, unmeasured);
  assert.equal(carried.filters.length, 1, "it is CARRIED — refusing it would lose the only record of it");
  assert.equal(unmeasured.unmeasuredFilterRecord, 1,
    "and flagged: this record reached a code path no capture has ever exercised");
});

test("A CUTTER'S OWN EFFECTS ARE COUNTED WHERE THEY ARE DROPPED, and the zero is the measurement", () => {
  // ► **A BLURRED STENCIL IS NOT A REGION.** A mask reaches a placement as a
  //   shape and a matrix; a path clip has no way to express a soft edge, so a
  //   cutter's own filters are refused. Measured on the oracle: 6 shape cutters
  //   in this roster and ZERO carrying anything — which is only worth saying
  //   because this counter exists to say it. Without it, "no cutter has
  //   filters" and "nobody looked" are the same output.
  const { buffer, characters } = buildFixture([{ id: 1, frames: 1, tags: [showFrameTag()] }]);
  leaf(characters, 727, "shape");
  leaf(characters, 728, "shape");
  const clean = flattenIconFrame(buffer, characters, [
    { depth: 2, characterId: 727, clipDepth: 5, matrix: IDENTITY_MATRIX },
    { depth: 3, characterId: 728, matrix: IDENTITY_MATRIX }
  ]);
  assert.deepEqual(clean.cutterEffects, { cutters: 1, filters: 0, emptyFilterLists: 0, blendModes: 0 });

  const dirty = flattenIconFrame(buffer, characters, [
    {
      depth: 2, characterId: 727, clipDepth: 5, matrix: IDENTITY_MATRIX,
      hasFilters: true, filters: [{ type: "blur" }], blendMode: 3
    },
    { depth: 3, characterId: 728, matrix: IDENTITY_MATRIX }
  ]);
  assert.deepEqual(dirty.cutterEffects, { cutters: 1, filters: 1, emptyFilterLists: 0, blendModes: 1 },
    "and the counter moves for an input the shipped build does not contain, which is what makes the zero evidence");
  const masked = dirty.drawables.find((drawable) => drawable.characterId === 728);
  assert.equal(masked.filters, null, "the cutter's blur is NOT spread onto what it cuts");
});

test("a placement with no effects carries NEITHER key, the way `colour` and `mask` are spread", () => {
  // ► **A ONE-SIDED NEGATIVE IS NOT A TEST** — `tools/extract-props.mjs`'s own
  //   version of this assertion stayed green through a full revert of the file
  //   it was testing, because deletion produces exactly the absence it wanted.
  //   So the same run must show a placement carrying all three.
  const bare = toPlacement({ kind: "shape", characterId: 10, matrix: IDENTITY_MATRIX });
  assert.equal(Object.hasOwn(bare, "filters"), false,
    "an absent list must be ABSENT, not `null` — a reader spreading it would write `filters: null`");
  assert.equal(Object.hasOwn(bare, "blendMode"), false);
  assert.equal(Object.hasOwn(bare, "inheritedEffects"), false);
  assert.deepEqual(bare.matrix, [1, 0, 0, 1, 0, 0], "and what was always there is untouched");

  const dressed = toPlacement(
    { kind: "text", characterId: 11, matrix: IDENTITY_MATRIX },
    { filters: [{ type: "glow" }], blendMode: 3 },
    [0]
  );
  assert.equal(Object.hasOwn(dressed, "filters"), true, "or the absence above means only that nothing is written");
  assert.equal(dressed.blendMode, 3);
  assert.deepEqual(dressed.inheritedEffects, [0]);
  assert.equal(Array.isArray(dressed.inheritedEffects) && typeof dressed.inheritedEffects[0] === "number", true,
    "INDICES and never records: no reader may take an enclosing sprite's bevel for this leaf's glow");
});

test("a blend mode on an enclosing sprite reaches the leaf as a GROUP, not as its own", () => {
  // Zero of the icon roster's placements carries a blend mode, so this path is
  // unexercised by the oracle and is here for the reason the cutter counter is:
  // an untested threading is one that will be found broken by a mod, not by a
  // test. 12 placements elsewhere in the build carry one.
  const { buffer, characters } = buildFixture([
    // Two levels, because a blend mode on the placement of a SHAPE is that
    // shape's own and would prove the opposite of what this test is about.
    { id: 950, frames: 1, tags: [place3Tag(1, 960, { blendMode: 14 }), showFrameTag()] },
    { id: 960, frames: 1, tags: [placeTag(1, 951), showFrameTag()] }
  ]);
  leaf(characters, 951, "shape");
  const { drawables } = flattenIconFrame(buffer, characters, [
    { depth: 1, characterId: 950, matrix: IDENTITY_MATRIX }
  ]);
  const [shape] = drawables;
  assert.equal(shape.characterId, 951);
  assert.equal(shape.blendMode, undefined, "the leaf has none of its own");
  assert.equal(shape.ancestorEffects.length, 1);
  assert.equal(shape.ancestorEffects[0].characterId, 960);
  assert.equal(shape.ancestorEffects[0].blendMode, 14, "hardlight, carried as the raw SWF id this repo never renames");
  assert.equal(shape.ancestorEffects[0].hasFilters, false,
    "a group may carry a blend mode and no filters — and must still be a group");
});

/* ------------------------------------------------------------------ */
/* 5. What a timeline DOES                                             */
/* ------------------------------------------------------------------ */

const stopBlock = (context) => ({ context, instructions: [{ name: "Stop" }, { name: "End" }] });

test("a bare stop() is a stop, and an onClipEvent handler is NOT a timeline action", () => {
  // ► **THIS MISATTRIBUTION ALREADY HAPPENED.** `combat_panel`'s eight
  //   `onClipEvent` handlers come back with contexts under `sprite:751/frame:1`
  //   and were counted as unrecognised actions on its timeline. They are
  //   handlers on PLACEMENTS; the panel's own tag stream carries no DoAction at
  //   all. The `/DoAction@` in the match is what tells them apart.
  const actions = deriveTimelineActions({
    actionBlocks: [
      stopBlock("sprite:898/frame:9/DoAction@0x1"),
      stopBlock("sprite:898/frame:19/DoAction@0x2"),
      { context: "sprite:751/frame:1/instance:crowd_bar/clip-action:0", instructions: [{ name: "Push" }] },
      {
        context: "sprite:817/frame:30/DoAction@0x3",
        instructions: [
          { name: "Push", operand: [{ type: "integer", value: 0 }, { type: "string", value: "this" }] },
          { name: "GetVariable" },
          { name: "Push", operand: [{ type: "string", value: "removeMovieClip" }] },
          { name: "CallMethod" }
        ]
      }
    ]
  });
  assert.deepEqual(actions.get(898).stops, [9, 19]);
  assert.deepEqual(actions.get(898).other, [], "a stop is recognised, not left in the unrecognised bucket");
  assert.equal(actions.get(817).removesSelfAt, 30, "a feedback icon deletes itself on its last frame");
  assert.equal(actions.has(751), false, "a clip-action context must not reach the timeline table at all");
});

test("an action this recogniser cannot NAME is still reported, with its opcodes", () => {
  // The alternative is an invisible behaviour, which is the shape of every
  // defect this file is about.
  const actions = deriveTimelineActions({
    actionBlocks: [{
      context: "sprite:153/frame:1/DoAction@0x9",
      instructions: [{ name: "Push" }, { name: "RandomNumber" }, { name: "SetMember" }, { name: "End" }]
    }]
  });
  assert.equal(actions.get(153).other.length, 1);
  assert.equal(actions.get(153).other[0].frame, 1);
  assert.deepEqual(actions.get(153).other[0].opcodes, ["Push", "RandomNumber", "SetMember"]);
});

test("a clip event is read off the PLACEMENT and names the game fields it touches", () => {
  const events = deriveClipEvents({
    actionBlocks: [{
      context: "sprite:751/frame:1/instance:villain_potion/clip-action:0",
      instructions: [
        { name: "Push", operand: [{ type: "string", value: "this" }] },
        { name: "Push", operand: [{ type: "constant", value: "hitpoints" }, { type: "constant", value: "blood_health" }] },
        { name: "Push", operand: [{ type: "string", value: "" }, { type: "integer", value: 101 }] }
      ]
    }]
  });
  const [event] = events.get(751);
  assert.equal(event.instance, "villain_potion");
  assert.equal(event.handler, 0);
  assert.deepEqual(event.touches, ["blood_health", "hitpoints", "this"],
    "an empty string is not a field name and a number is not one either");
});

/* ------------------------------------------------------------------ */
/* 6. The expression script — the join with the fighter rig            */
/* ------------------------------------------------------------------ */

test("an expression call is found in BOTH of the build's spellings, argument and all", () => {
  // ► AS2 pushes `arg…, argc, object…, method` and the compiler splits that
  //   across one or several Push records depending on how the object was
  //   written. Scanning for the ARGUMENT COUNT rather than for a position is
  //   what reads `head.eyes` in clip 1241 and `villain.head.eyes` in 721.
  const calls = deriveExpressionCalls({
    actionBlocks: [
      {
        context: "sprite:1241/frame:33/DoAction@0x1",
        instructions: [
          { name: "Push", operand: [
            { type: "string", value: "Left" }, { type: "integer", value: 1 }, { type: "string", value: "head" }] },
          { name: "GetVariable" },
          { name: "Push", operand: [{ type: "string", value: "eyes" }] },
          { name: "GetMember" },
          { name: "Push", operand: [{ type: "string", value: "gotoAndPlay" }] },
          { name: "CallMethod" }
        ]
      },
      {
        context: "sprite:721/frame:50/DoAction@0x2",
        instructions: [
          { name: "Push", operand: [
            { type: "constant", value: "Angry" }, { type: "integer", value: 1 }, { type: "constant", value: "villain" }] },
          { name: "GetVariable" },
          { name: "Push", operand: [{ type: "constant", value: "head" }] },
          { name: "GetMember" },
          { name: "Push", operand: [{ type: "constant", value: "mouth" }] },
          { name: "GetMember" },
          { name: "Push", operand: [{ type: "constant", value: "gotoAndStop" }] },
          { name: "CallMethod" }
        ]
      }
    ]
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(
    calls.map((call) => [call.timeline, call.frame, call.part, call.method, call.label]),
    [[1241, 33, "eyes", "gotoAndPlay", "Left"], [721, 50, "mouth", "gotoAndStop", "Angry"]]
  );
});

test("a gotoAndStop on something that is NOT the face is not an expression call", () => {
  const calls = deriveExpressionCalls({
    actionBlocks: [{
      context: "sprite:1241/frame:2/DoAction@0x3",
      instructions: [
        { name: "Push", operand: [{ type: "integer", value: 3 }, { type: "integer", value: 1 }, { type: "string", value: "bullet" }] },
        { name: "GetVariable" },
        { name: "Push", operand: [{ type: "string", value: "head" }] },
        { name: "GetMember" },
        { name: "Push", operand: [{ type: "string", value: "gotoAndStop" }] },
        { name: "CallMethod" }
      ]
    }]
  });
  assert.deepEqual(calls, [], "only `eyes` and `mouth` are the face");
});

const expressionLabels = {
  eyes: [{ frame: 1, name: "Normal" }, { frame: 111, name: "blink" }],
  mouth: [{ frame: 1, name: "Normal" }, { frame: 81, name: "Smirk" }]
};

test("A LABEL THAT DOES NOT EXIST IS COUNTED, NOT NORMALISED AWAY", () => {
  // ► **`mouth1` HAS NO `Smile` AND NO `Pain`, AND THE BUILD ASKS FOR BOTH.**
  //   Six of its 228 calls name a frame that is not there under any casing, and
  //   a further run differ only in case. Lower-casing them here would be
  //   asserting an answer about AVM1 that nobody in this repository has
  //   measured — the honest output is three separate tallies.
  const animations = [{ name: "Standing", firstFrame: 2, lastFrame: 32, frameCount: 31 }];
  const calls = [
    { part: "eyes", method: "gotoAndPlay", label: "Normal", timeline: 1241, frame: 4, context: "x" },
    { part: "eyes", method: "gotoAndPlay", label: "Blink", timeline: 1241, frame: 5, context: "x" },
    { part: "mouth", method: "gotoAndPlay", label: "Smile", timeline: 1241, frame: 6, context: "x" },
    { part: "mouth", method: "gotoAndPlay", label: null, timeline: 1241, frame: 7, context: "x" }
  ];
  const bound = bindExpressions(calls, animations, expressionLabels);
  assert.deepEqual(bound.resolution, { exact: 1, case: 1, missing: 1, unreadable: 1 });
  assert.deepEqual(
    bound.unresolved.map((row) => [row.part, row.asked, row.status]),
    [["eyes", "Blink", "case"], ["mouth", "Smile", "missing"], ["mouth", null, "unreadable"]]
  );
  const standing = bound.bindings.standing;
  assert.equal(standing.animation, "Standing");
  assert.equal(standing.eyes.length, 2);
  assert.equal(standing.eyes[0].expression, "normal", "an exact hit resolves to the label's own key");
  assert.equal(standing.eyes[1].resolved, "blink", "a case-only hit still says WHICH label it would reach");
  assert.equal(standing.eyes[1].status, "case", "and never pretends it was exact");
  assert.equal(standing.mouth[0].expression, null, "a label that is not there resolves to nothing");
});

test("a call lands in the animation whose run CONTAINS its frame", () => {
  const animations = [
    { name: "Standing", firstFrame: 2, lastFrame: 32, frameCount: 31 },
    { name: "StepBack", firstFrame: 33, lastFrame: 49, frameCount: 17 }
  ];
  const bound = bindExpressions([
    { part: "eyes", method: "gotoAndPlay", label: "Normal", timeline: 1241, frame: 32, context: "x" },
    { part: "eyes", method: "gotoAndPlay", label: "Normal", timeline: 1241, frame: 33, context: "x" }
  ], animations, expressionLabels);
  assert.deepEqual(Object.keys(bound.bindings).sort(), ["standing", "stepback"]);
  assert.equal(bound.bindings.standing.eyes[0].frame, 32);
  assert.equal(bound.bindings.stepback.eyes[0].frame, 33, "the boundary frame belongs to the label that OWNS it");
});

/* ------------------------------------------------------------------ */
/* 7. The declared tables                                              */
/* ------------------------------------------------------------------ */

test("the two dead icons are DECLARED dead rather than deleted from the list", () => {
  // ► `miss_icon` and `addstats_icon` each occur ONCE in the 7,586,504-byte
  //   build, and that occurrence is their own ExportAssets entry. Removing them
  //   from this table would remove the finding with them.
  const dead = ICON_CLIPS.filter((clip) => clip.attachedBy === null).map((clip) => clip.linkage);
  assert.deepEqual(dead.sort(), ["addstats_icon", "miss_icon"]);
  for (const clip of ICON_CLIPS) {
    assert.ok(typeof clip.indexedBy === "string" && clip.indexedBy.length > 0,
      `${clip.linkage} must say what its frame index MEANS`);
    assert.equal(typeof clip.character, "number");
  }
  assert.equal(new Set(ICON_CLIPS.map((clip) => clip.character)).size, ICON_CLIPS.length,
    "a character declared twice would be extracted twice and tallied twice");
});

test("the eyes carry an offset in the head's space and the mouth does not", () => {
  // Measured at `updatecharacter` +0x40cca7 / +0x40ccc0: `head.eyes._y = -14`,
  // `head.eyes._x = -3`, and nothing for the mouth. These are AS2 properties,
  // so they are PIXELS — a renderer that treated them as twips would move the
  // eyes by a twentieth of a pixel and see nothing wrong.
  const eyes = FACE_CLIPS.find((face) => face.key === "eyes");
  const mouth = FACE_CLIPS.find((face) => face.key === "mouth");
  assert.deepEqual(eyes.offset, { x: -3, y: -14 });
  assert.equal(mouth.offset, null, "the mouth gets no offset, and null is the measurement");
  assert.equal(eyes.depth, 1, "head.attachMovie('eyes1','eyes',1)");
  assert.equal(mouth.depth, 2, "head.attachMovie('mouth1','mouth',2)");
});

test("a nested clip's declared meaning names the frames the BUILD indexes, and no others", () => {
  // ~~Frames 2 and 4 of `damage_splat` are never asked for by name.~~
  // CORRECTED 2026-09-23: frame 2 IS asked for (+0x1824, +0x18c2) and frame 1
  // survives only for a blow the armour took whole; frame 4 (TAUNT) is the one
  // never selected (taunt is rewritten to normal at +0x1673). This test pinned
  // the wrong table for as long as the table was wrong.
  assert.deepEqual(Object.keys(NESTED_MEANINGS[815].frames), ["1", "2", "3", "5"]);
  assert.match(NESTED_MEANINGS[815].frames[1], /absorbed/);
  assert.equal(NESTED_MEANINGS[815].frames[3], "critical");
  assert.deepEqual(NESTED_MEANINGS[815].unreachable, [4]);
  assert.equal(NESTED_MEANINGS[815].parent, 817);
  // ~~151: null, "no gotoAndStop found"~~ — `magic_damage_character` +0x1381
  // selects it by `bonus_frame`, and the potion arms by 1/2/3.
  assert.deepEqual(Object.values(NESTED_MEANINGS[151].frames),
    ["HEALTH", "STAMINA", "ARMOUR", "BURNING", "FROZEN", "WRAITH", "POISONED", "LIGHTNING"]);
  assert.equal(NESTED_MEANINGS[161].frames, null, "addstats_icon is never attached, so its child has no reader");
});

/* ------------------------------------------------------------------ */
/* 7b. The action buttons — wiring, handlers and layout, synthetically */
/* ------------------------------------------------------------------ */

/**
 * A tiny assembler for synthetic action blocks. Each step gets the next
 * absolute offset (five bytes apart, which is all the derivations care about:
 * order, and where the facing test's jump lands).
 */
function assembleBlock(context, base, steps) {
  const instructions = [];
  let offset = base;
  for (const step of steps.flat(Infinity)) {
    instructions.push({ offset, ...step });
    offset += 5;
  }
  return { context, kind: "DoAction", offset: base, instructions };
}
const constant = (value) => ({ type: "constant", value });
const integer = (value) => ({ type: "integer", value });
const push = (...operands) => ({ name: "Push", operand: operands });
const bare = (name) => ({ name });
const slotGoto = (slot, frame) => [push(integer(frame), integer(1), constant(slot)), bare("GetVariable"),
  push(constant("gotoAndStop")), bare("CallMethod"), bare("Pop")];
const slotHide = (slot, property = "_visible") => [push(constant(slot)), bare("GetVariable"),
  push(constant(property), { type: "boolean", value: false }), bare("SetMember")];
const handler = (body) => ({ name: "DefineFunction2", operand: { name: "", parameters: [], body } });
const slotRelease = (slot, verb) => [push(constant(slot)), bare("GetVariable"), push(constant("onRelease")),
  handler([push(constant(verb), integer(1), constant("getphase")), bare("CallFunction"), bare("Pop")]), bare("SetMember")];
const relative = (block, instruction) => `+0x${(instruction.offset - block.offset).toString(16).padStart(4, "0")}`;

/** A controller frame: a prelude, the facing test, a right arm, a jump, a left arm — with the If's target patched. */
function controllerBlock(frame, right, left) {
  const test = [push(constant("gladiator_dir")), bare("GetMember"), push(constant("right")), bare("Equals2"), bare("Not"),
    { name: "If", operand: { delta: 0, target: -1 } }];
  const block = assembleBlock(`sprite:862/frame:${frame}/DoAction@0x100`, 0x1000,
    [push(constant("hero")), bare("GetVariable"), test, right, { name: "Jump", operand: { delta: 0, target: -1 } }, left]);
  const split = block.instructions.findIndex((instruction) => instruction.name === "If");
  const jump = block.instructions.findIndex((instruction) => instruction.name === "Jump");
  const end = block.instructions[block.instructions.length - 1].offset + 5;
  block.instructions[split].operand.target = block.instructions[jump + 1]?.offset ?? end;
  block.instructions[jump].operand.target = end;
  return block;
}

const CONTROLLER_LABELS = [
  { frame: 1, name: "initialise" }, { frame: 5, name: "longrange_warrior" }, { frame: 13, name: "closerange_warrior" }
];

test("THE WIRING IS READ PER FACING, and each onRelease takes every frame its slot was sent to", () => {
  // ► Shaped on overlay frame 5 (body 0x238de8): the stamina test puts TWO
  //   verbs on one slot, the psyche counter sends one slot to three frames
  //   before its single handler, and a level test hides a slot. The pairing
  //   decides none of the guards; it only groups what the bytes say in order.
  const block = controllerBlock(5,
    [slotHide("optionG"), slotGoto("optionA", 7), slotGoto("optionH", 26), slotGoto("optionH", 27), slotGoto("optionH", 28),
      slotGoto("optionC", 18), slotRelease("optionC", "taunt"), slotGoto("optionC", 11), slotRelease("optionC", "rest"),
      slotRelease("optionA", "jumpleft"), slotRelease("optionH", "psyche_up")],
    [slotGoto("optionA", 7), slotGoto("optionF", 19), slotRelease("optionF", "taunt"), slotRelease("optionA", "jumpleft")]);
  const wiring = deriveOptionWiring({ actionBlocks: [block] }, {
    character: 862, labels: CONTROLLER_LABELS, controllers: ["longrange_warrior"], slots: BUTTON_OVERLAY.slots
  });
  const record = wiring.longrange_warrior;
  assert.equal(record.frame, 5);
  assert.equal(record.problem, undefined);
  assert.deepEqual(Object.keys(record.right.slots).sort(), ["optionA", "optionC", "optionH"]);
  assert.deepEqual(record.right.slots.optionC.map((wire) => [wire.verb, wire.frames]), [["taunt", [18]], ["rest", [11]]],
    "one slot, two verbs, each with ONLY the frame sent since the slot's previous handler");
  assert.deepEqual(record.right.slots.optionH[0].frames, [26, 27, 28]);
  assert.equal(record.right.slots.optionH[0].gotoAt.length, 3);
  assert.deepEqual(record.left.slots.optionF.map((wire) => [wire.verb, wire.frames]), [["taunt", [19]]],
    "the left arm is its own: the same verb, a different frame");
  assert.deepEqual(record.right.hides.map((row) => [row.slot, row.property]), [["optionG", "_visible"]]);
  assert.deepEqual(record.left.hides, []);
  // The offsets are relative to the block BODY, as the dumps print them.
  const facing = block.instructions.find((instruction) => instruction.name === "If");
  assert.equal(record.facingSplit.test, relative(block, facing));
  assert.equal(record.facingSplit.leftFrom, `+0x${(facing.operand.target - block.offset).toString(16).padStart(4, "0")}`);
  assert.equal(record.right.slots.optionA[0].gotoAt[0],
    relative(block, block.instructions.find((instruction) => instruction.name === "Push" &&
      instruction.operand[2]?.value === "optionA")));
});

test("a gotoAndStop on a name that is NOT a slot is kept as a STRAY, and `visible` is recorded as `visible`", () => {
  // ► `optionHG` is real: overlay frame 13 +0x0923, closerange_warrior facing
  //   right, the psyche button's third frame. And the ranged controller's
  //   zero-ammo arm writes `visible`, which hides nothing — folding it into
  //   `_visible` would record a hide the build never performs.
  const block = controllerBlock(13,
    [slotGoto("optionH", 26), slotGoto("optionHG", 28), slotRelease("optionH", "psyche_up"), slotHide("optionD", "visible"), slotGoto("optionB", 6)],
    []);
  const record = deriveOptionWiring({ actionBlocks: [block] }, {
    character: 862, labels: CONTROLLER_LABELS, controllers: ["closerange_warrior"], slots: BUTTON_OVERLAY.slots
  }).closerange_warrior;
  assert.deepEqual(record.right.slots.optionH[0].frames, [26], "the stray frame is NOT paired with the real slot");
  assert.deepEqual(record.right.strays.map((stray) => [stray.target, stray.frame]), [["optionHG", 28]]);
  assert.deepEqual(record.right.hides.map((row) => [row.slot, row.property]), [["optionD", "visible"]]);
  assert.deepEqual(record.right.unpaired.map((row) => [row.slot, row.frame]), [["optionB", 6]],
    "a frame with no handler after it is reported, not dropped");
});

test("a controller label the overlay does not carry is a PROBLEM on the record, not a missing key", () => {
  const wiring = deriveOptionWiring({ actionBlocks: [] }, {
    character: 862, labels: CONTROLLER_LABELS, controllers: ["longrange_archer", "longrange_warrior"], slots: BUTTON_OVERLAY.slots
  });
  assert.deepEqual(Object.keys(wiring), ["longrange_archer", "longrange_warrior"]);
  assert.match(wiring.longrange_archer.problem, /no FrameLabel/);
  assert.match(wiring.longrange_warrior.problem, /no DoAction/);
});

test("THE ROLLOVER IS ONE HANDLER SHARED BY EVERY SLOT IT IS CHAINED ONTO, and it names battlebutton's frame", () => {
  // Shaped on overlay frame 1 (body 0x236947 +0x0aba..+0x0c23): `A.onRollOver
  // = B.onRollOver = … = function () { this.battlebutton.gotoAndStop(2) }`,
  // compiled as the pushes, the function, then StoreRegister/SetMember pairs.
  const rollover = handler([push(integer(2), integer(1), { type: "register", value: 1 }, constant("battlebutton")),
    bare("GetMember"), push(constant("gotoAndStop")), bare("CallMethod"), bare("Pop")]);
  const swapRelease = handler([push(integer(1), integer(1), { type: "register", value: 1 }, constant("battlebutton")),
    bare("GetMember"), push(constant("gotoAndStop")), bare("CallMethod"), bare("Pop"),
    push(constant("swap_weapons"), integer(1), constant("getphase")), bare("CallFunction"), bare("Pop")]);
  const block = assembleBlock("sprite:862/frame:1/DoAction@0x200", 0x2000, [
    push(constant("optiontext"), constant("")), bare("SetMember"),
    push(constant("optionA")), bare("GetVariable"),
    push(constant("onRollOver"), constant("optionB")), bare("GetVariable"),
    push(constant("onRollOver")), rollover,
    { name: "StoreRegister", operand: { register: 0 } }, bare("SetMember"), push({ type: "register", value: 0 }), bare("SetMember"),
    slotGoto("swap_inventory", 10), slotHide("swap_inventory"),
    push(constant("swap_inventory")), bare("GetVariable"), push(constant("onRelease")), swapRelease, bare("SetMember")
  ]);
  const found = deriveButtonHandlers({ actionBlocks: [block] }, {
    character: 862, slots: BUTTON_OVERLAY.slots, swapSlot: BUTTON_OVERLAY.swapSlot
  });
  assert.equal(found.handlers.length, 2);
  assert.deepEqual(found.handlers[0], {
    event: "onRollOver", slots: ["optionA", "optionB"], battlebutton: 2, verb: null,
    at: relative(block, block.instructions.find((instruction) => instruction.operand?.body === rollover.operand.body))
  });
  assert.deepEqual(found.handlers[1].slots, ["swap_inventory"], "the chain before it is closed; it does not leak in");
  assert.equal(found.handlers[1].verb, "swap_weapons");
  assert.equal(found.handlers[1].battlebutton, 1);
  assert.deepEqual(found.swap.gotos.map((goto) => goto.frame), [10]);
  assert.deepEqual(found.swap.hides.map((row) => row.property), ["_visible"]);
});

test("THE LAYOUT IS RUNS PER SLOT, and each controller is read at the frame it RESTS on", () => {
  // ► A slot that moves after its label's frame would be drawn where it
  //   stops, not where it starts; the battle map's spans (5–12, 13–19 …) end
  //   on a bare stop(), which is what `restsAt` finds.
  const at = (tx, ty, scale = 0.8) => ({ a: scale, b: 0, c: 0, d: scale, tx, ty });
  const frameOf = (optionA, optionD) => [
    { depth: 37, characterId: 860, name: "optionD", matrix: optionD },
    { depth: 77, characterId: 860, name: "optionA", matrix: optionA },
    { depth: 3, characterId: 12, name: null, matrix: IDENTITY_MATRIX }
  ];
  const frames = [];
  for (let frame = 1; frame <= 12; frame += 1) {
    frames.push(frame < 4 ? frameOf(IDENTITY_MATRIX, IDENTITY_MATRIX)
      : frame < 8 ? frameOf(at(-1070, -760), at(1100, -760))
        : frameOf(at(-1070, -760), at(1200, -760)));
  }
  const layout = summariseOverlayLayout({ frames }, {
    instances: ["optionA", "optionD", "swap_inventory"],
    labels: [{ frame: 5, name: "longrange_warrior" }], stops: [12, 51], controllers: ["longrange_warrior", "closerange_warrior"]
  });
  assert.deepEqual(layout.tracks.optionA.map((run) => [run.from, run.to]), [[1, 3], [4, 12]]);
  assert.deepEqual(layout.tracks.optionD.map((run) => [run.from, run.to]), [[1, 3], [4, 7], [8, 12]]);
  assert.equal(layout.tracks.swap_inventory, undefined, "an instance never placed has no track rather than an empty one");
  assert.equal(layout.controllers.longrange_warrior.restsAt, 12);
  assert.deepEqual(layout.controllers.longrange_warrior.slots.optionD.matrix, [0.8, 0, 0, 0.8, 1200, -760],
    "the resting matrix, translations still in TWIPS");
  assert.deepEqual(layout.controllers.closerange_warrior, { frame: null, restsAt: null, slots: null });
  assert.deepEqual(Object.keys(layout.frameOne).sort(), ["optionA", "optionD"]);
});

test("the button declaration names the overlay's eight slots, its four controllers and the items row", () => {
  assert.equal(BUTTON_OVERLAY.character, 862);
  assert.equal(BUTTON_OVERLAY.linkage, "overlay");
  assert.equal(BUTTON_OVERLAY.expectedButton, 860);
  assert.deepEqual(BUTTON_OVERLAY.slots, ["optionA", "optionB", "optionC", "optionD", "optionE", "optionF", "optionG", "optionH"]);
  assert.deepEqual(BUTTON_OVERLAY.controllers,
    ["longrange_warrior", "closerange_warrior", "longrange_archer", "closerange_archer"]);
  assert.equal(BUTTON_OVERLAY.inventory.character, 492);
  assert.equal(BUTTON_OVERLAY.inventory.instances.length, 6);
  // The background's two states, beside 58's, and from the overlay's rollover.
  assert.deepEqual(NESTED_MEANINGS[826].frames, { 1: "up", 2: "over" });
  assert.equal(NESTED_MEANINGS[826].parent, 860);
  assert.equal(ICON_CLIPS.some((clip) => clip.character === 860 || clip.character === 862), false,
    "the button is NOT a roster clip: adding it there would move the roster's measured totals");
});

test("the manifest carries the buttons as their OWN block, and a pack without them says null", () => {
  const empty = { own: { filteredPlacements: 0, filters: 0, filtersByType: {}, blendModePlacements: 0,
    filtersOnUnsupportedPlacements: 0, unsupportedFilteredPlacements: 0,
    dropped: { placements: 0, filters: 0, filtersByType: {}, blendModePlacements: 0 } },
  inherited: { groups: 0, placements: 0, filters: 0, filtersByType: {}, blendModes: 0 },
  undescended: { clipPlacements: 1, children: [826], filtersInChildEntries: 0, childrenNotExtracted: [] },
  bevels: { total: 0, inner: 0, onTop: 0, knockout: 0, zeroBlur: 0, own: 0, inherited: 0 },
  use: { filters: { total: 0, applied: 0, deferred: 0, noOp: 0, refused: 0, approximated: 0, refusedByReason: {}, approximatedByKind: {} },
    blendModes: { exact: {}, refused: {} } },
  notCarried: {} };
  const entry = (character, frames) => ({ character, frames: [], declaredFrames: frames, distinctFrames: frames, emptyFrames: 0,
    duplicateOf: {}, timeline: { stops: [1], removesSelfAt: null, other: [] }, clipEvents: [], effects: empty,
    effectGroups: [], clipsAcrossSpriteBoundary: 0 });
  const arm = (slots) => ({ slots, hides: [], strays: [], unpaired: [] });
  const buttons = {
    overlay: { character: 862, linkage: "overlay" }, button: 860,
    clips: { 860: entry(860, 41) },
    nested: { 826: { ...entry(826, 2), linkage: null, instances: ["battlebutton"], meaning: NESTED_MEANINGS[826] } },
    sharedWithRoster: [],
    layout: { controllers: { closerange_warrior: { frame: 13, restsAt: 19, slots: {} } } },
    wiring: { closerange_warrior: { frame: 13, facingSplit: { test: "+0x076e", leftFrom: "+0x0b9f" },
      common: arm({}), right: arm({ optionD: [{ verb: "power_attack", frames: [2], gotoAt: ["+0x0822"], releaseAt: "+0x0af0" }] }),
      left: arm({ optionA: [{ verb: "power_attack", frames: [13], gotoAt: ["+0x0c09"], releaseAt: "+0x0eb6" }] }) } },
    handlers: { handlers: [], swap: { gotos: [], hides: [] } }, inventory: null,
    effects: tallyIconEffects({ clips: { 860: entry(860, 41) } }), clipsAcrossSpriteBoundary: 0
  };
  const base = { faces: {}, clips: {}, nested: {}, expressionScript: null, shapes: {}, texts: {},
    approximations: {}, failures: [], clipsAcrossSpriteBoundary: 0 };
  const manifest = buildManifest({ ...base, buttons }, { file: "x.swf", sha256: "0" });
  assert.equal(manifest.buttons.button, 860);
  assert.equal(manifest.buttons.clips[860].declaredFrames, 41);
  assert.deepEqual(manifest.buttons.nested[826].instances, ["battlebutton"]);
  assert.deepEqual(manifest.buttons.controllers.closerange_warrior.right, ["optionD: power_attack@2"]);
  assert.deepEqual(manifest.buttons.controllers.closerange_warrior.left, ["optionA: power_attack@13"]);
  assert.equal(manifest.buttons.controllers.closerange_warrior.restsAt, 19);
  assert.equal(manifest.effects.undescendedClipPlacements, 0, "the roster's invoice does not count the buttons");
  assert.equal(buildManifest({ ...base, buttons: null }, { file: "x.swf", sha256: "0" }).buttons, null);
});

/* ------------------------------------------------------------------ */
/* 7c. The buttons END TO END, on a synthetic build                    */
/* ------------------------------------------------------------------ */

/** A bit/byte writer for whole synthetic files — the same fields `test/extract-props.test.js` writes. */
class SwfBytes {
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
  u32(value) { this.align(); for (let shift = 0; shift < 32; shift += 8) this.bytes.push((value >>> shift) & 0xff); return this; }
  string(value) { this.align(); for (const byte of Buffer.from(value, "utf8")) this.bytes.push(byte); this.bytes.push(0); return this; }
  raw(bytes) { this.align(); for (const byte of bytes) this.bytes.push(byte); return this; }
  rect(xMin, xMax, yMin, yMax) {
    this.align().ub(16, 5).sb(xMin, 16).sb(xMax, 16).sb(yMin, 16).sb(yMax, 16);
    return this.align();
  }
  matrix({ a = 1, d = 1, tx = 0, ty = 0 } = {}) {
    this.align();
    const hasScale = a !== 1 || d !== 1;
    this.bit(hasScale ? 1 : 0);
    if (hasScale) this.ub(20, 5).sb(Math.round(a * 65536), 20).sb(Math.round(d * 65536), 20);
    this.bit(0);
    this.ub(16, 5).sb(tx, 16).sb(ty, 16);
    return this.align();
  }
  buffer() { this.align(); return Buffer.from(this.bytes); }
}
function swfTag(code, body) {
  const bytes = Buffer.isBuffer(body) ? body : body.buffer();
  const writer = new SwfBytes();
  if (bytes.length >= 0x3f) writer.u16((code << 6) | 0x3f).u32(bytes.length);
  else writer.u16((code << 6) | bytes.length);
  return writer.raw(bytes).buffer();
}
function swfFile(tags) {
  const body = Buffer.concat([...tags, swfTag(0, Buffer.alloc(0))]);
  const header = new SwfBytes().raw(Buffer.from("FWS", "latin1")).u8(8).u32(0).rect(0, 11000, 0, 8000).u16(24 << 8).u16(1).buffer();
  const file = Buffer.concat([header, body]);
  file.writeUInt32LE(file.length, 4);
  return file;
}
/** DefineShape3: one solid square, `size` twips, at the origin. */
function squareShape(id, [red, green, blue], size = 200) {
  const writer = new SwfBytes();
  writer.u16(id).rect(0, size, 0, size);
  writer.u8(1).u8(0x00).u8(red).u8(green).u8(blue).u8(255);
  writer.u8(0);
  writer.ub(1, 4).ub(0, 4);
  writer.bit(0).ub(0b00101, 5).ub(12, 5).sb(0, 12).sb(0, 12).ub(1, 1);
  const edge = (dx, dy) => writer.bit(1).bit(1).ub(12 - 2, 4).bit(1).sb(dx, 12).sb(dy, 12);
  edge(size, 0); edge(0, size); edge(-size, 0); edge(0, -size);
  writer.bit(0).ub(0, 5);
  return swfTag(32, writer);
}
function placeTag2({ depth, characterId, matrix, name, move = false }) {
  const writer = new SwfBytes();
  let flags = 0;
  if (move) flags |= 0x01;
  if (characterId !== undefined) flags |= 0x02;
  if (matrix) flags |= 0x04;
  if (name !== undefined) flags |= 0x20;
  writer.u8(flags).u16(depth);
  if (characterId !== undefined) writer.u16(characterId);
  if (matrix) writer.matrix(matrix);
  if (name !== undefined) writer.string(name);
  return swfTag(26, writer);
}
const showFrame2 = () => swfTag(1, Buffer.alloc(0));
const removeDepth = (depth) => swfTag(28, new SwfBytes().u16(depth));
const frameLabelTag = (name) => swfTag(43, new SwfBytes().string(name));
const doActionTag = (bytes) => swfTag(12, Buffer.concat([bytes, Buffer.from([0])]));
const spriteTag = (id, frames, inner) =>
  swfTag(39, new SwfBytes().u16(id).u16(frames).raw(Buffer.concat([...inner, swfTag(0, Buffer.alloc(0))])));
const exportTag = (pairs) => {
  const writer = new SwfBytes().u16(pairs.length);
  for (const [id, name] of pairs) writer.u16(id).string(name);
  return swfTag(56, writer);
};

/** AVM1, as bytes: just the records the overlay's controllers are made of. */
const AVM1 = {
  push(...values) {
    const body = Buffer.concat(values.map((value) => {
      if (typeof value === "string") return Buffer.concat([Buffer.from([0]), Buffer.from(`${value}\0`, "utf8")]);
      if (value && typeof value === "object" && "register" in value) return Buffer.from([4, value.register]);
      const integer = Buffer.alloc(5);
      integer[0] = 7;
      integer.writeInt32LE(value, 1);
      return integer;
    }));
    const head = Buffer.alloc(3);
    head[0] = 0x96;
    head.writeUInt16LE(body.length, 1);
    return Buffer.concat([head, body]);
  },
  op: (code) => Buffer.from([code]),
  branch(code, delta) {
    const record = Buffer.alloc(5);
    record[0] = code;
    record.writeUInt16LE(2, 1);
    record.writeInt16LE(delta, 3);
    return record;
  },
  /** DefineFunction2, anonymous, no parameters, the body following the record. */
  function2(body) {
    const header = new SwfBytes().string("").u16(0).u8(4).u16(0).u16(body.length).buffer();
    const head = Buffer.alloc(3);
    head[0] = 0x8e;
    head.writeUInt16LE(header.length, 1);
    return Buffer.concat([head, header, body]);
  }
};
const GET_VARIABLE = 0x1c;
const GET_MEMBER = 0x4e;
const SET_MEMBER = 0x4f;
const CALL_METHOD = 0x52;
const CALL_FUNCTION = 0x3d;
const POP = 0x17;
const gotoBytes = (slot, frame) => Buffer.concat([AVM1.push(frame, 1, slot), AVM1.op(GET_VARIABLE),
  AVM1.push("gotoAndStop"), AVM1.op(CALL_METHOD), AVM1.op(POP)]);
const releaseBytes = (slot, verb) => Buffer.concat([AVM1.push(slot), AVM1.op(GET_VARIABLE), AVM1.push("onRelease"),
  AVM1.function2(Buffer.concat([AVM1.push(verb, 1, "getphase"), AVM1.op(CALL_FUNCTION), AVM1.op(POP)])), AVM1.op(SET_MEMBER)]);

/**
 * THE OVERLAY IN MINIATURE: a two-state background (826), a button (860) whose
 * frames 2 and 3 carry the art the build's `power_attack` and `normal_attack`
 * facing right select, and an exported `overlay` (862) that places it at all
 * eight slots, moves two of them on frame 4, and wires one verb per facing on
 * a `closerange_warrior` label that rests on frame 6.
 */
function buttonBuild() {
  const right = Buffer.concat([gotoBytes("optionD", 2), releaseBytes("optionD", "power_attack")]);
  const left = Buffer.concat([gotoBytes("optionA", 3), releaseBytes("optionA", "normal_attack")]);
  const jump = AVM1.branch(0x99, left.length);
  const controller = Buffer.concat([
    AVM1.push("hero"), AVM1.op(GET_VARIABLE),
    AVM1.push("gladiator_dir"), AVM1.op(GET_MEMBER), AVM1.push("right"), AVM1.op(0x49), AVM1.op(0x12),
    AVM1.branch(0x9d, right.length + jump.length), right, jump, left
  ]);
  const rollover = Buffer.concat([
    AVM1.push("optionA"), AVM1.op(GET_VARIABLE), AVM1.push("onRollOver"),
    AVM1.function2(Buffer.concat([AVM1.push(2, 1, { register: 1 }, "battlebutton"), AVM1.op(GET_MEMBER),
      AVM1.push("gotoAndStop"), AVM1.op(CALL_METHOD), AVM1.op(POP)])),
    AVM1.op(SET_MEMBER)
  ]);
  const slots = [["optionD", 37], ["optionE", 45], ["optionF", 53], ["optionH", 61],
    ["optionG", 69], ["optionA", 77], ["optionB", 85], ["optionC", 93]];
  return swfFile([
    squareShape(900, [0x40, 0x30, 0x20]),
    squareShape(901, [0xf0, 0xc0, 0x40]),
    squareShape(902, [0xcc, 0x00, 0x00], 100),
    squareShape(903, [0x00, 0x00, 0xcc], 100),
    spriteTag(826, 2, [
      placeTag2({ depth: 1, characterId: 900 }), doActionTag(Buffer.from([0x07])), showFrame2(),
      removeDepth(1), placeTag2({ depth: 1, characterId: 901 }), doActionTag(Buffer.from([0x07])), showFrame2()
    ]),
    spriteTag(860, 3, [
      placeTag2({ depth: 1, characterId: 826, name: "battlebutton" }), doActionTag(Buffer.from([0x07])), showFrame2(),
      placeTag2({ depth: 2, characterId: 902 }), showFrame2(),
      removeDepth(2), placeTag2({ depth: 2, characterId: 903 }), showFrame2()
    ]),
    spriteTag(862, 6, [
      frameLabelTag("initialise"),
      ...slots.map(([name, depth]) => placeTag2({ depth, characterId: 860, name })),
      doActionTag(rollover), showFrame2(),
      showFrame2(), showFrame2(),
      placeTag2({ depth: 77, move: true, matrix: { a: 0.8, d: 0.8, tx: -1070, ty: -760 } }),
      placeTag2({ depth: 37, move: true, matrix: { a: 0.8, d: 0.8, tx: 1100, ty: -760 } }),
      showFrame2(),
      frameLabelTag("closerange_warrior"), doActionTag(controller), showFrame2(),
      doActionTag(Buffer.from([0x07])), showFrame2()
    ]),
    exportTag([[862, "overlay"]])
  ]);
}

test("THE BUTTONS SECTION, END TO END: the button found through the overlay, its child kept out of the roster", () => {
  const result = extractIcons(buttonBuild());
  const buttons = result.buttons;
  assert.equal(buttons.button, 860, "derived from the eight slots, not typed");
  assert.equal(buttons.clips[860].declaredFrames, 3);
  assert.equal(buttons.clips[860].distinctFrames, 3);
  assert.equal(buttons.clips[860].linkage, null, "860 has no export name, and none is invented");
  const background = buttons.clips[860].frames[0].filter((placement) => placement.kind === "clip");
  assert.deepEqual(background.map((placement) => [placement.character, placement.name]), [[826, "battlebutton"]],
    "the background is a clip placement: flattening it would freeze it on up");
  assert.deepEqual(buttons.nested[826].instances, ["battlebutton"]);
  assert.equal(buttons.nested[826].declaredFrames, 2);
  assert.deepEqual(buttons.nested[826].meaning.frames, { 1: "up", 2: "over" });
  // ► THE ROSTER NEVER SAW EITHER. Its measured totals stay what they were.
  assert.deepEqual(Object.keys(result.clips), []);
  assert.equal(result.nested[826], undefined);
  assert.equal(tallyIconEffects(result).undescendedClipPlacements, 0);
  assert.equal(buttons.effects.undescendedClipPlacements, 3, "860's three frames each place its background");
  assert.deepEqual(buttons.effects.undescendedChildren, [826]);
  assert.equal(buttons.effects.undescendedChildrenNotExtracted, 0);
  // …but the geometry is in the ONE shape table a renderer opens.
  for (const id of [900, 901, 902, 903]) assert.ok(result.shapes[id], `shape ${id}`);

  // The wiring and the layout, from the bytes.
  const wiring = buttons.wiring.closerange_warrior;
  assert.equal(wiring.frame, 5);
  assert.deepEqual(wiring.right.slots.optionD.map((wire) => [wire.verb, wire.frames]), [["power_attack", [2]]]);
  assert.deepEqual(wiring.left.slots.optionA.map((wire) => [wire.verb, wire.frames]), [["normal_attack", [3]]]);
  assert.match(buttons.wiring.longrange_warrior.problem, /no FrameLabel/);
  const rest = buttons.layout.controllers.closerange_warrior;
  assert.equal(rest.restsAt, 6);
  assert.deepEqual(rest.slots.optionA.matrix, [0.8, 0, 0, 0.8, -1070, -760]);
  assert.deepEqual(rest.slots.optionD.matrix, [0.8, 0, 0, 0.8, 1100, -760]);
  assert.deepEqual(buttons.layout.frameOne.optionA.matrix, [1, 0, 0, 1, 0, 0], "and where it started");
  assert.deepEqual(buttons.handlers.handlers.map((row) => [row.event, row.slots, row.battlebutton]),
    [["onRollOver", ["optionA"], 2]]);
  // Named failures for what the miniature does not carry — never silence.
  assert.ok(result.failures.some((row) => /inventory_overlay/.test(row.message)));

  // The manifest's own block, and the RENDERER drawing the extractor's output.
  const manifest = buildManifest(result, { file: "x.swf", sha256: "0" });
  assert.deepEqual(manifest.buttons.controllers.closerange_warrior.right, ["optionD: power_attack@2"]);
  const pack = actionButtonPackFrom({ icons: result.clips, nested: result.nested, shapes: result.shapes, texts: result.texts, buttons });
  const fills = (ops) => ops.map((op) => op.fill);
  assert.deepEqual(fills(actionButtonOpsFor(pack, "power_attack", { facing: "right" })), ["#403020", "#cc0000"],
    "up background, then the icon of 860 frame 2");
  assert.deepEqual(fills(actionButtonOpsFor(pack, "power_attack", { facing: "right", state: "hover" })), ["#f0c040", "#cc0000"],
    "over background on hover — 826 frame 2");
  assert.deepEqual(fills(actionButtonOpsFor(pack, "normal_attack", { facing: "right" })), ["#403020", "#0000cc"]);
  assert.equal(actionButtonOpsFor(pack, "power_attack", { facing: "left" }), null,
    "frame 13 is past this miniature's three: no art, so the caller draws the fallback");
});

/* ------------------------------------------------------------------ */
/* 7d. THE GAUGES: the drive, read off the bytes                       */
/* ------------------------------------------------------------------ */

const double = (value) => ({ type: "double", value });
const bool = (value) => ({ type: "boolean", value });
/** `_root.game.<side>.<field>`, as the build pushes it. */
const gameRead = (side, field) => [push(constant("_root")), bare("GetVariable"), push(constant("game")), bare("GetMember"),
  push(constant(side)), bare("GetMember"), push(constant(field)), bare("GetMember")];
const mathRound = () => [push(integer(1), constant("Math")), bare("GetVariable"), push(constant("round")), bare("CallMethod")];

/**
 * One gauge's `onClipEvent(enterFrame)` as the build compiles it — hero_potion
 * (body 0x2264d1) statement for statement: the number, the percent, the liquid.
 * `armour` adds hero_armour's visibility test in front (body 0x22695d
 * `+0x0082`..`+0x00ce`). `numbers` lets a test mutate one constant.
 */
function gaugeBlock(instance, { side = "hero", value = "hitpoints", max = "hitpointsmax", textVariable = "hitpoints",
  percentVariable = "hitpointpercentage", armour = false, numbers = {} } = {}) {
  const { base = -30, full = 101, step = 0.7, scale = 100 } = numbers;
  const steps = [];
  let visibility = null;
  if (armour) {
    visibility = { test: null, falseSet: null, jump: null, trueFrom: null };
    steps.push(gameRead(side, value), push(integer(0)), bare("Greater"), bare("Not"), bare("Not"),
      { name: "If", operand: { delta: 0, target: -1 }, mark: "if" },
      push(constant("this")), bare("GetVariable"), push(constant("_visible"), bool(false)), { name: "SetMember", mark: "falseSet" },
      { name: "Jump", operand: { delta: 0, target: -1 }, mark: "jump" },
      { ...push(constant("this")), mark: "trueFrom" }, bare("GetVariable"), push(constant("_visible"), bool(true)), { name: "SetMember", mark: "trueSet" });
  }
  steps.push(
    push(constant("this")), bare("GetVariable"), push(constant(textVariable)),
    gameRead(side, value), push(constant(" / ")), bare("Add2"), gameRead(side, max), bare("Add2"), { name: "SetMember", mark: "text" },
    push(constant("this")), bare("GetVariable"), push(constant(percentVariable)),
    gameRead(side, value), gameRead(side, max), bare("Divide"), push(integer(scale)), bare("Multiply"), mathRound(),
    { name: "SetMember", mark: "percent" },
    push(constant("this")), bare("GetVariable"), push(constant("blood_health")), bare("GetMember"),
    push(constant("_y"), integer(base), integer(full), constant("this")), bare("GetVariable"), push(constant(percentVariable)), bare("GetMember"),
    bare("Subtract"), push(double(step)), bare("Multiply"), bare("Add2"), mathRound(), { name: "SetMember", mark: "liquid" },
    bare("End"));
  const block = assembleBlock(`sprite:751/frame:1/instance:${instance}/clip-action:0`, 0x10000, steps);
  const at = (mark) => block.instructions.find((instruction) => instruction.mark === mark);
  if (armour) {
    at("if").operand.target = at("trueFrom").offset;
    at("jump").operand.target = block.instructions[block.instructions.indexOf(at("trueSet")) + 1].offset;
  }
  block.eventFlags = 2;
  return { block, at: (mark) => relative(block, at(mark)) };
}

test("THE DRIVE IS READ OFF EACH GAUGE'S OWN HANDLER: the number, the percent, the liquid's _y, and armour's visibility", () => {
  const potion = gaugeBlock("hero_potion");
  const armour = gaugeBlock("hero_armour", { value: "armourclass", max: "armourclass_max", textVariable: "armourpoints",
    percentVariable: "armourclass_percentage", armour: true });
  const derived = deriveGaugeDrive({ actionBlocks: [potion.block, armour.block] }, { character: 751, instances: ["hero_potion", "hero_armour", "villain_potion"] });
  const hp = derived.gauges.hero_potion;
  assert.equal(hp.problem, undefined);
  assert.deepEqual({ side: hp.side, value: hp.value, max: hp.max }, { side: "hero", value: "hitpoints", max: "hitpointsmax" });
  assert.deepEqual(hp.text, { variable: "hitpoints", separator: " / ", at: potion.at("text") });
  assert.deepEqual(hp.percent, { variable: "hitpointpercentage", scale: 100, rounding: "round", at: potion.at("percent") });
  assert.deepEqual(hp.liquid, { target: "blood_health", property: "_y", base: -30, full: 101, step: 0.7, rounding: "round", at: potion.at("liquid") });
  assert.equal(hp.visible, null, "health is never hidden");
  assert.equal(hp.block, "0x10000");
  const ac = derived.gauges.hero_armour;
  assert.deepEqual(ac.visible, { property: "_visible", side: "hero", field: "armourclass", comparison: ">", than: 0, whenTrue: true, whenFalse: false,
    at: armour.at("if") }, "_visible = armourclass > 0, both branches read");
  assert.equal(ac.percent.variable, "armourclass_percentage");
  assert.match(derived.gauges.villain_potion.problem, /no clip-action/);
  // All that were read agree, so the section's constants are theirs.
  assert.deepEqual(derived.drive, { base: -30, full: 101, step: 0.7, percentScale: 100, rounding: "round", separator: " / " });
  assert.deepEqual(derived.disagreements, []);
});

test("A GAUGE WHOSE CONSTANT DIFFERS IS NAMED, and the section's drive is not written from a minority", () => {
  const blocks = [
    gaugeBlock("hero_potion").block,
    gaugeBlock("villain_potion", { side: "villain" }).block,
    gaugeBlock("hero_stamina_potion", { value: "staminaleft", max: "staminamax", numbers: { step: 0.8 } }).block
  ];
  const derived = deriveGaugeDrive({ actionBlocks: blocks }, { character: 751, instances: ["hero_potion", "villain_potion", "hero_stamina_potion"] });
  assert.equal(derived.gauges.hero_stamina_potion.liquid.step, 0.8, "read as it is, never corrected");
  assert.equal(derived.gauges.villain_potion.side, "villain");
  assert.equal(derived.drive, null, "no single answer, so none");
  assert.deepEqual(derived.disagreements, ["step: hero_potion=0.7 villain_potion=0.7 hero_stamina_potion=0.8"]);
});

test("CODEX PASS 1: an armour test whose arms do not both run is a PROBLEM — the skip jump is checked, not assumed", () => {
  const armourOf = (edit) => {
    const built = gaugeBlock("hero_armour", { value: "armourclass", max: "armourclass_max", textVariable: "armourpoints",
      percentVariable: "armourclass_percentage", armour: true });
    edit(built.block);
    return deriveGaugeDrive({ actionBlocks: [built.block] }, { character: 751, instances: ["hero_armour"] }).gauges.hero_armour;
  };
  assert.equal(armourOf(() => {}).problem, undefined, "the build's shape reads clean");
  // No Jump: the fall-through arm writes false and then runs straight into `_visible = true`.
  const noJump = armourOf((block) => { block.instructions = block.instructions.filter((instruction) => instruction.name !== "Jump"); });
  assert.match(noJump.problem ?? "", /_visible/);
  // A Jump that lands INSIDE the true arm, before its write: the false path still writes true.
  const short = armourOf((block) => {
    const jump = block.instructions.find((instruction) => instruction.name === "Jump");
    jump.operand.target = block.instructions.find((instruction) => instruction.mark === "trueFrom").offset;
  });
  assert.match(short.problem ?? "", /_visible/);
  // A third `_visible` write after the join overrides both arms.
  const third = armourOf((block) => {
    const end = block.instructions.pop();
    const at = end.offset;
    block.instructions.push({ name: "Push", operand: [constant("this")], offset: at }, { name: "GetVariable", offset: at + 5 },
      { name: "Push", operand: [constant("_visible"), bool(true)], offset: at + 10 }, { name: "SetMember", offset: at + 15 },
      { ...end, offset: at + 20 });
  });
  assert.match(third.problem ?? "", /3 _visible writes/, "named as the rule it breaks: one if/else, two writes");
});

test("CODEX PASS 3: EVERY STATEMENT IN A GAUGE'S HANDLER IS ACCOUNTED FOR — a later write, a stray one or a late percent is a PROBLEM", () => {
  const potionWith = (edit, options = {}) => {
    const built = gaugeBlock("hero_potion", options);
    edit(built.block);
    return deriveGaugeDrive({ actionBlocks: [built.block] }, { character: 751, instances: ["hero_potion"] });
  };
  /** Insert statements just before the handler's End. */
  const append = (block, steps) => {
    const end = block.instructions.pop();
    let at = end.offset;
    for (const step of steps.flat(Infinity)) { block.instructions.push({ ...step, offset: at }); at += 5; }
    block.instructions.push({ ...end, offset: at });
  };
  assert.equal(potionWith(() => {}).gauges.hero_potion.problem, undefined, "the build's shape reads clean");
  // `this.blood_health._y = 999` after the drive: the build draws 999, whatever the formula said.
  const overwritten = potionWith((block) => append(block, [push(constant("this")), bare("GetVariable"), push(constant("blood_health")),
    bare("GetMember"), push(constant("_y"), integer(999)), bare("SetMember")]));
  assert.match(overwritten.gauges.hero_potion.problem ?? "", /blood_health\._y/);
  assert.equal(overwritten.drive, null, "and no drive is certified from it");
  // Any other write to the liquid moves what is drawn too.
  const nudged = potionWith((block) => append(block, [push(constant("this")), bare("GetVariable"), push(constant("blood_health")),
    bare("GetMember"), push(constant("_x"), integer(5)), bare("SetMember")]));
  assert.match(nudged.gauges.hero_potion.problem ?? "", /blood_health\._x/);
  // A second write to the number, or anything this reader does not recognise, is a problem, not noise.
  const renumbered = potionWith((block) => append(block, [push(constant("this")), bare("GetVariable"), push(constant("hitpoints"), constant("?")), bare("SetMember")]));
  assert.match(renumbered.gauges.hero_potion.problem ?? "", /this\.hitpoints/);
  const unread = potionWith((block) => append(block, [bare("Trace")]));
  assert.match(unread.gauges.hero_potion.problem ?? "", /Trace/);
  // The percent written AFTER the liquid reads it: the liquid would show last frame's value.
  const late = potionWith((block) => {
    const list = block.instructions;
    const percentEnd = list.findIndex((instruction) => instruction.mark === "percent");
    const liquidEnd = list.findIndex((instruction) => instruction.mark === "liquid");
    const textEnd = list.findIndex((instruction) => instruction.mark === "text");
    const percent = list.slice(textEnd + 1, percentEnd + 1);
    const liquid = list.slice(percentEnd + 1, liquidEnd + 1);
    const offsets = list.slice(textEnd + 1, liquidEnd + 1).map((instruction) => instruction.offset);
    [...liquid, ...percent].forEach((instruction, index) => { instruction.offset = offsets[index]; });
    list.splice(textEnd + 1, liquidEnd - textEnd, ...liquid, ...percent);
  });
  assert.match(late.gauges.hero_potion.problem ?? "", /before/);
  // A drive that runs once, on load, is not the build's every-frame drive.
  const onLoad = potionWith((block) => { block.eventFlags = 1; });
  assert.match(onLoad.gauges.hero_potion.problem ?? "", /enterFrame/);
});

test("CODEX PASS 3: EVERY attachMovie CALL IS COUNTED WHERE IT IS EVALUATED — assigned, discarded or nested — and _x/_y must be literal", () => {
  const call = (depth) => [push(constant("_x"), integer(-320), constant("_y"), integer(122), integer(2)), bare("InitObject"),
    push(integer(depth), constant("combat_panel"), constant("combat_panel"), integer(4), constant("_root")), bare("GetVariable"),
    push(constant("arena")), bare("GetMember"), push(constant("attachMovie")), bare("CallMethod")];
  const assigned = assembleBlock("sprite:2249/frame:1/DoAction@0x6e421b", 0x6e4221, [
    call(200000), bare("Pop"),
    push(constant("secondPanel")), call(200001), bare("SetVariable")
  ]);
  assert.match(deriveGaugeAttach({ actionBlocks: [assigned] }, { linkage: "combat_panel" }).problem, /2 attachMovie/);
  // `_x` computed rather than written: the origin cannot be read off the bytes, so it is not guessed as 0.
  const computed = assembleBlock("sprite:2249/frame:1/DoAction@0x6e421b", 0x6e4221, [
    push(constant("_x"), constant("offset")), bare("GetVariable"), push(constant("_y"), integer(122), integer(2)), bare("InitObject"),
    push(integer(200000), constant("combat_panel"), constant("combat_panel"), integer(4), constant("_root")), bare("GetVariable"),
    push(constant("arena")), bare("GetMember"), push(constant("attachMovie")), bare("CallMethod"), bare("Pop")
  ]);
  assert.match(deriveGaugeAttach({ actionBlocks: [computed] }, { linkage: "combat_panel" }).problem, /_x/);
});

test("A GAUGE'S NUMBER MUST LAND IN A FIELD ITS OWN SPRITE BINDS: exactly one, or a problem", () => {
  const placements = [{ kind: "shape", character: 726 }, { kind: "text", character: 731 }, { kind: "text", character: 732 }];
  const fieldOf = (id) => ({ 731: { variable: "hitpoints", align: "center" } })[id] ?? null;
  assert.deepEqual(boundFieldOf(placements, fieldOf, "hitpoints"), { field: { character: 731, variable: "hitpoints" } });
  assert.match(boundFieldOf(placements, fieldOf, "armourpoints").problem, /0 fields bound to armourpoints/);
  assert.match(boundFieldOf([...placements, { kind: "text", character: 731 }], fieldOf, "hitpoints").problem, /2 fields/);
});

test("a panel that places one gauge instance twice is a PROBLEM, not two gauges", () => {
  const fields = { 734: { variable: "herotext", align: "left" }, 735: { variable: "villaintext", align: "right" } };
  const frameOne = [
    entryAt(1, 52, { a: -1.99998, d: 1.99998, tx: 7019, ty: 1925 }), entryAt(7, 52, { a: -1.99998, d: 1.99998, tx: -1439, ty: 1925 }),
    entryAt(9, 733, { name: "villain_potion", tx: 10700, ty: 933 }), entryAt(18, 734, { tx: -1199, ty: 1704 }),
    entryAt(19, 733, { name: "hero_potion", tx: 2035, ty: 933 }), entryAt(20, 733, { name: "hero_potion", tx: 4000, ty: 933 }),
    entryAt(28, 735, { tx: 5652, ty: 1704 }), entryAt(29, 742, { name: "villain_stamina_potion", tx: 12054, ty: 933 }),
    entryAt(38, 742, { name: "hero_stamina_potion", tx: 704, ty: 933 }), entryAt(47, 749, { name: "hero_armour", tx: 3410, ty: 934 }),
    entryAt(55, 749, { name: "villain_armour", tx: 9478, ty: 923 })
  ];
  const bannerSpan = (entry) => {
    const xs = [-143.5, -36].map((x) => entry.matrix.a * x + entry.matrix.tx / 20);
    return { xMin: Math.min(...xs), xMax: Math.max(...xs) };
  };
  const summary = summariseGaugePanel(frameOne, { declared: GAUGE_PANEL, fieldOf: (id) => fields[id] ?? null, bannerSpanOf: bannerSpan });
  assert.ok(summary.problems.some((problem) => /hero_potion/.test(problem) && /2/.test(problem)), JSON.stringify(summary.problems));
});

test("CODEX PASS 4: ONE HANDLER, THE BUILD'S OWN SIDE, AND BRANCHES THAT LAND ON WHOLE STATEMENTS", () => {
  const armour = (options = {}) => gaugeBlock("hero_armour", { value: "armourclass", max: "armourclass_max", textVariable: "armourpoints",
    percentVariable: "armourclass_percentage", armour: true, ...options });
  const read = (blocks, instance = "hero_armour") => deriveGaugeDrive({ actionBlocks: blocks }, { character: 751, instances: [instance] }).gauges[instance];
  assert.equal(read([armour().block]).problem, undefined, "the build's shape reads clean");
  // 1. The number and the percent in a LOAD handler, the liquid in enterFrame: the number would freeze at its first value.
  const whole = gaugeBlock("hero_potion");
  const list = whole.block.instructions;
  const cut = list.findIndex((instruction) => instruction.mark === "percent") + 1;
  const load = { ...whole.block, context: "sprite:751/frame:1/instance:hero_potion/clip-action:0", eventFlags: 1,
    instructions: [...list.slice(0, cut), { name: "End", offset: list[cut].offset }] };
  const frame = { ...whole.block, context: "sprite:751/frame:1/instance:hero_potion/clip-action:1", eventFlags: 2,
    instructions: list.slice(cut) };
  assert.match(read([load, frame], "hero_potion").problem ?? "", /handler/);
  // 2. hero_armour hidden by the VILLAIN's armour: the rule reads the wrong fighter.
  const crossed = armour();
  crossed.block.instructions.find((instruction) => instruction.name === "Push" && instruction.operand.some((operand) => operand.value === "hero")).operand =
    [constant("villain")];
  assert.match(read([crossed.block]).problem ?? "", /villain/);
  // 3. The If landing on the true arm's SetMember, skipping the pushes that feed it.
  const mid = armour();
  mid.block.instructions.find((instruction) => instruction.name === "If").operand.target =
    mid.block.instructions.find((instruction) => instruction.mark === "trueSet").offset;
  assert.match(read([mid.block]).problem ?? "", /_visible/);
  // ...and the skip landing mid-statement, inside the next write's pushes.
  const skip = armour();
  const after = skip.block.instructions.indexOf(skip.block.instructions.find((instruction) => instruction.mark === "trueSet")) + 2;
  skip.block.instructions.find((instruction) => instruction.name === "Jump").operand.target = skip.block.instructions[after].offset;
  assert.match(read([skip.block]).problem ?? "", /_visible/);
  // 4. The visibility in a different handler from the drive: it would run once, not every frame.
  const drive = armour();
  const vis = drive.block.instructions;
  const textStart = vis.indexOf(vis.find((instruction) => instruction.mark === "trueSet")) + 1;
  const visibilityOnly = { ...drive.block, context: "sprite:751/frame:1/instance:hero_armour/clip-action:0", eventFlags: 1,
    instructions: [...vis.slice(0, textStart), { name: "End", offset: vis[textStart].offset }] };
  visibilityOnly.instructions.find((instruction) => instruction.name === "Jump").operand.target = vis[textStart].offset;
  const driveOnly = { ...drive.block, context: "sprite:751/frame:1/instance:hero_armour/clip-action:1", eventFlags: 2, instructions: vis.slice(textStart) };
  assert.match(read([visibilityOnly, driveOnly]).problem ?? "", /handler/);
  // 5. A statement wedged between the test and its first arm: named as the wrong SHAPE, the rule that failed.
  const wedged = armour();
  const ifAt = wedged.block.instructions.findIndex((instruction) => instruction.name === "If");
  const base = wedged.block.instructions[ifAt].offset;
  wedged.block.instructions.splice(ifAt + 1, 0, { name: "Push", operand: [constant("this")], offset: base + 1 },
    { name: "GetVariable", offset: base + 2 }, { name: "Push", operand: [constant("seen"), bool(true)], offset: base + 3 },
    { name: "SetMember", offset: base + 4 });
  assert.match(read([wedged.block]).problem ?? "", /not shaped if \/ write \/ jump \/ write/);
});

test("a handler this reader cannot follow is a PROBLEM on its record, never a silently-missing drive", () => {
  const broken = gaugeBlock("hero_potion");
  // Drop the liquid's `Subtract`: the expression no longer has the build's shape.
  broken.block.instructions = broken.block.instructions.filter((instruction) => instruction.name !== "Subtract");
  const derived = deriveGaugeDrive({ actionBlocks: [broken.block] }, { character: 751, instances: ["hero_potion"] });
  assert.match(derived.gauges.hero_potion.problem, /liquid/);
  assert.equal(derived.drive, null);
});

test("THE ATTACH IS READ OFF THE CALL: which clip, into what, at which depth, with which _x and _y", () => {
  // Shaped on sprite 2249 frame 1 (body 0x6e4221 +0x0bf2..+0x0c29).
  const steps = [
    push(constant("hero")), bare("GetVariable"), push(constant("psyche_up"), integer(1)), bare("SetMember"),
    push(constant("_x"), integer(-320), constant("_y"), integer(122), integer(2)), bare("InitObject"),
    push(integer(200000), constant("combat_panel"), constant("combat_panel"), integer(4), constant("_root")), bare("GetVariable"),
    push(constant("arena")), bare("GetMember"), push(constant("attachMovie")), { name: "CallMethod", mark: "call" }, bare("Pop"),
    push(integer(40000), constant("overlay"), constant("overlay"), integer(3), constant("gladiators")), bare("GetVariable"),
    push(constant("attachMovie")), bare("CallMethod"), bare("Pop")
  ];
  const block = assembleBlock("sprite:2249/frame:1/DoAction@0x6e421b", 0x6e4221, steps);
  const attach = deriveGaugeAttach({ actionBlocks: [block] }, { linkage: "combat_panel" });
  assert.deepEqual(attach, {
    timeline: "sprite:2249/frame:1", character: 2249, frame: 1, block: "0x6e4221", within: null,
    at: relative(block, block.instructions.find((instruction) => instruction.mark === "call")),
    target: "_root.arena", parent: "arena", linkage: "combat_panel", name: "combat_panel", depth: 200000,
    init: { _x: -320, _y: 122 }
  });
  assert.match(deriveGaugeAttach({ actionBlocks: [] }, { linkage: "combat_panel" }).problem, /no attachMovie/);
  const twice = deriveGaugeAttach({ actionBlocks: [block, { ...block, context: "sprite:9/frame:1/DoAction@0x1" }] }, { linkage: "combat_panel" });
  assert.match(twice.problem, /2 attachMovie/, "two attaches is two answers, and neither is picked");
  // One inside a FUNCTION BODY counts too: "exactly one" is over every statement list in the file.
  const inside = assembleBlock("sprite:9/frame:1/DoAction@0x1", 0x2000, [
    { name: "DefineFunction2", operand: { name: "later", parameters: [], body: block.instructions.map((instruction) => ({ ...instruction })) } }
  ]);
  assert.match(deriveGaugeAttach({ actionBlocks: [block, inside] }, { linkage: "combat_panel" }).problem, /2 attachMovie/);
  const onlyInside = deriveGaugeAttach({ actionBlocks: [inside] }, { linkage: "combat_panel" });
  assert.equal(onlyInside.depth, 200000, "and a lone one inside a function is still found");
  assert.equal(onlyInside.within, "later");
});

/**
 * Sprite 2249 frame 1's panel lines, as the build compiles them (body
 * 0x6e4221 +0x0bec..+0x0c6b): a statement before, the attach, then the two
 * names. `depth`, `x` and the name writes are the knobs a test turns.
 */
function panelBlock({ depth = 200000, x = -320, names = [["herotext", "hero"], ["villaintext", "villain"]], object = "combat_panel", namesFirst = false,
  afterCall = "Pop", between = [], before = [] } = {}) {
  const nameSet = ([variable, side], index) => [push(constant(object)), bare("GetVariable"), push(constant(variable)),
    gameRead(side, "character_name"), { name: "SetMember", mark: `name${index}` }];
  const attach = [
    { ...push(constant("_x"), integer(x), constant("_y"), integer(122), integer(2)), mark: "from" }, bare("InitObject"),
    push(integer(depth), constant("combat_panel"), constant("combat_panel"), integer(4), constant("_root")), bare("GetVariable"),
    push(constant("arena")), bare("GetMember"), push(constant("attachMovie")), { name: "CallMethod", mark: "call" }, bare(afterCall)
  ];
  return assembleBlock("sprite:2249/frame:1/DoAction@0x6e421b", 0x6e4221, [
    push(constant("hero")), bare("GetVariable"), push(constant("psyche_up"), integer(1)), bare("SetMember"),
    before,
    namesFirst ? [names.map(nameSet), attach] : [attach, between, names.map(nameSet)],
    { name: "End", mark: "end" }
  ]);
}

test("THE PANEL'S PROVENANCE IS READ OFF THE BYTES, NOT TYPED: the attach and the two name writes, each at its own offset (verify:gauges-r2)", () => {
  const block = panelBlock();
  const at = (mark) => relative(block, block.instructions.find((instruction) => instruction.mark === mark));
  const provenanceOf = (built) => {
    const attach = deriveGaugeAttach({ actionBlocks: [built] }, { linkage: "combat_panel" });
    return deriveGaugeProvenance({ actionBlocks: [built] }, { attach, names: GAUGE_PANEL.names });
  };
  // The typed lines' own form, every figure in it read off this block.
  assert.deepEqual(provenanceOf(block), {
    attachedBy: `sprite 2249 frame 1 body 0x6e4221 ${at("from")}..${at("call")}: ` +
      "_root.arena.attachMovie(\"combat_panel\", \"combat_panel\", 200000, {_x: -320, _y: 122})",
    namesSetBy: `sprite 2249 frame 1 body 0x6e4221 ${at("name0")} / ${at("name1")}: ` +
      "combat_panel.herotext|villaintext = _root.game.hero|villain.character_name",
    problems: []
  });
  // The figures the typed line carried and nothing checked (verify:gauges-r2): each moves the line now.
  assert.match(provenanceOf(panelBlock({ x: -321 })).attachedBy, /\{_x: -321, _y: 122\}/, "the _x the build passes");
  assert.match(provenanceOf(panelBlock({ depth: 200001 })).attachedBy, /, 200001, \{/, "the depth the build passes");
  // The names: each written once, after the attach, on the attached clip, from its own side.
  const villainless = provenanceOf(panelBlock({ names: [["herotext", "hero"]] }));
  assert.equal(villainless.namesSetBy, null);
  assert.match(villainless.problems.join("; "), /villaintext/, "a name the build never writes is a problem by name");
  assert.match(provenanceOf(panelBlock({ names: [["herotext", "hero"], ["villaintext", "hero"]] })).problems.join("; "),
    /villaintext.*_root\.game\.hero\.character_name/, "the villain's banner written with the hero's name");
  assert.match(provenanceOf(panelBlock({ object: "overlay" })).problems.join("; "), /herotext/,
    "a write to another clip is not the panel's name");
  assert.match(provenanceOf(panelBlock({ namesFirst: true })).problems.join("; "), /0 writes .*herotext/,
    "names written BEFORE the attach land on no clip");
  // CODEX REVIEW (fix round, pass 1): the writes must be REACHED from the
  // attach — a Return, a branch or an opcode this reader cannot follow
  // between them, and the names may never be set at all.
  const returned = provenanceOf(panelBlock({ afterCall: "Return" }));
  assert.equal(returned.namesSetBy, null);
  assert.match(returned.problems.join("; "), /not reached in a straight line.*Return/, "a Return where the attach's Pop was");
  const branched = provenanceOf(panelBlock({ between: [push(constant("ready")), bare("GetVariable"), { name: "If", operand: { delta: 0, target: 0x6e4221 } }] }));
  assert.equal(branched.namesSetBy, null);
  assert.match(branched.problems.join("; "), /not reached in a straight line.*if/, "a branch between the attach and the names");
  // CODEX REVIEW (fix round, pass 2): and the ATTACH must run on every path
  // from the start of its list — a Return before it, or a branch past it,
  // and the panel may never be attached at all.
  const skipping = (landing, { branch = "If", then = [push(constant("hero")), bare("GetVariable"), push(constant("skipped"), integer(1)), bare("SetMember")] } = {}) => {
    const built = panelBlock({ before: [
      ...(branch === "If" ? [push(constant("ready")), bare("GetVariable")] : []), { name: branch, operand: { delta: 0, target: -1 }, mark: "skip" }, ...then] });
    built.instructions.find((instruction) => instruction.mark === "skip").operand.target =
      built.instructions.find((instruction) => instruction.mark === landing).offset;
    return provenanceOf(built);
  };
  const early = provenanceOf(panelBlock({ before: [bare("Return")] }));
  assert.equal(early.namesSetBy, null);
  assert.match(early.problems.join("; "), /attach .* does not run on every path.*Return/, "a Return before the attach");
  assert.match(skipping("end").problems.join("; "), /attach .* does not run on every path.*end/, "a branch past the attach to the list's end");
  assert.match(provenanceOf(panelBlock({ before: [{ name: "With", operand: { body: [] } }] })).problems.join("; "),
    /attach .* does not run on every path.*With/, "a With this reader does not follow");
  // The build's own shape stands: a branch that lands BEFORE the attach (sprite 2249's If at
  // +0x0b0c lands at +0x0b8a, ahead of the attach at +0x0bf2), and functions declared on the way.
  assert.deepEqual(skipping("from").problems, [], "a branch that lands on the attach itself");
  assert.match(skipping("from", { then: [bare("Return")] }).problems.join("; "), /does not run on every path.*Return/,
    "an If goes BOTH ways: its target reaches the attach, its fall-through a Return");
  assert.match(skipping("end", { branch: "Jump" }).problems.join("; "), /does not run on every path.*end/, "a Jump past the attach");
  assert.match(skipping("call").problems.join("; "), /does not run on every path.*inside a statement/,
    "a branch that lands INSIDE the attach statement, where no statement starts");
  assert.deepEqual(provenanceOf(panelBlock({ before: [{ name: "DefineFunction2", operand: { name: "helper", parameters: [], body: [bare("Return")] } }] })).problems, [],
    "a function declared before the attach, whose own Return is its own");
  // An attach inside a FUNCTION BODY is read there, and its names with it.
  const inside = assembleBlock("sprite:2249/frame:1/DoAction@0x6e421b", 0x6e4221, [
    { name: "DefineFunction2", operand: { name: "later", parameters: [], body: panelBlock().instructions.map((instruction) => ({ ...instruction })) } }
  ]);
  const within = provenanceOf(inside);
  assert.deepEqual(within.problems, []);
  assert.match(within.attachedBy, /^sprite 2249 frame 1 body 0x6e4221 function later \+0x/, "the function the attach runs in");
  assert.match(within.namesSetBy, /^sprite 2249 frame 1 body 0x6e4221 function later \+0x/);
  assert.match(provenanceOf(panelBlock({ names: [["herotext", "hero"], ["herotext", "hero"], ["villaintext", "villain"]] })).problems.join("; "),
    /2 .*herotext/, "two writes of one name: which one shows?");
});

/** One display-list entry as `resolveTimeline` hands it over. */
const entryAt = (depth, characterId, { name, tx = 0, ty = 0, a = 1, d = 1, filters } = {}) =>
  ({ depth, characterId, ...(name ? { name } : {}), matrix: { a, b: 0, c: 0, d, tx, ty }, ...(filters ? { filters } : {}) });

test("THE PANEL'S PLACEMENTS ARE NAMED FROM THE BYTES: gauges by instance, names by their field's variable, banners by the gauges they sit under", () => {
  const frameOne = [
    entryAt(1, 52, { a: -1.99998, d: 1.99998, tx: 7019, ty: 1925, filters: [{ type: "bevel" }] }),
    entryAt(3, 723, { name: "crowd_bar_bg" }),
    entryAt(7, 52, { a: -1.99998, d: 1.99998, tx: -1439, ty: 1925, filters: [{ type: "bevel" }] }),
    entryAt(9, 733, { name: "villain_potion", tx: 10700, ty: 933 }),
    entryAt(18, 734, { tx: -1199, ty: 1704, filters: [{ type: "glow" }] }),
    entryAt(19, 733, { name: "hero_potion", tx: 2035, ty: 933 }),
    entryAt(28, 735, { tx: 5652, ty: 1704, filters: [{ type: "glow" }] }),
    entryAt(29, 742, { name: "villain_stamina_potion", tx: 12054, ty: 933 }),
    entryAt(38, 742, { name: "hero_stamina_potion", tx: 704, ty: 933 }),
    entryAt(47, 749, { name: "hero_armour", tx: 3410, ty: 934 }),
    entryAt(55, 749, { name: "villain_armour", tx: 9478, ty: 923 }),
    entryAt(63, 750, { tx: 9669, ty: -5175 })
  ];
  const fields = { 734: { variable: "herotext", align: "left" }, 735: { variable: "villaintext", align: "right" }, 750: { variable: "crowd_text", align: "center" } };
  // Shape 51's bounds, -143.5..-36, under each banner's matrix.
  const bannerSpan = (entry) => {
    const xs = [-143.5, -36].map((x) => entry.matrix.a * x + entry.matrix.tx / 20);
    return { xMin: Math.min(...xs), xMax: Math.max(...xs) };
  };
  const summary = summariseGaugePanel(frameOne, { declared: GAUGE_PANEL, fieldOf: (id) => fields[id] ?? null, bannerSpanOf: bannerSpan });
  assert.deepEqual(summary.problems, []);
  assert.deepEqual(summary.placements.map((row) => [row.depth, row.kind, row.side, row.reading ?? row.variable ?? null]), [
    [1, "banner", "villain", null], [7, "banner", "hero", null], [9, "gauge", "villain", "health"], [18, "name", "hero", "herotext"],
    [19, "gauge", "hero", "health"], [28, "name", "villain", "villaintext"], [29, "gauge", "villain", "energy"],
    [38, "gauge", "hero", "energy"], [47, "gauge", "hero", "armour"], [55, "gauge", "villain", "armour"]
  ]);
  const heroBanner = summary.placements.find((row) => row.kind === "banner" && row.side === "hero");
  assert.deepEqual(heroBanner.matrix, [-1.99998, 0, 0, 1.99998, -1439, 1925], "roundMatrix's form: translations in twips");
  assert.deepEqual(heroBanner.filters, [{ type: "bevel" }], "the bevel, carried as data on the placement that has it");
  assert.equal(summary.placements.find((row) => row.variable === "villaintext").align, "right");
  assert.deepEqual(summary.notTaken.map((row) => [row.depth, row.character, row.name]),
    [[3, 723, "crowd_bar_bg"], [63, 750, null]], "the crowd bar is in 751 too, and named as not taken");
  // A gauge the build no longer places, and a banner that sits under neither side, are problems by name.
  const broken = summariseGaugePanel(frameOne.filter((entry) => entry.name !== "hero_armour").map((entry) =>
    (entry.depth === 1 ? entryAt(1, 52, { a: -1.99998, d: 1.99998, tx: 99999, ty: 1925 }) : entry)),
  { declared: GAUGE_PANEL, fieldOf: (id) => fields[id] ?? null, bannerSpanOf: bannerSpan });
  assert.ok(broken.problems.some((problem) => /hero_armour/.test(problem)));
  assert.ok(broken.problems.some((problem) => /banner at depth 1/.test(problem)));
});

test("the gauges declaration names the six instances, what each reads, and the drive it EXPECTS — which the extraction checks, never writes", () => {
  assert.equal(GAUGE_PANEL.character, 751);
  assert.equal(GAUGE_PANEL.linkage, "combat_panel");
  assert.equal(GAUGE_PANEL.liquidInstance, "blood_health");
  assert.deepEqual(GAUGE_PANEL.gauges.map((gauge) => [gauge.instance, gauge.side, gauge.reading, gauge.character, gauge.value, gauge.max]), [
    ["hero_potion", "hero", "health", 733, "hitpoints", "hitpointsmax"],
    ["villain_potion", "villain", "health", 733, "hitpoints", "hitpointsmax"],
    ["hero_stamina_potion", "hero", "energy", 742, "staminaleft", "staminamax"],
    ["villain_stamina_potion", "villain", "energy", 742, "staminaleft", "staminamax"],
    ["hero_armour", "hero", "armour", 749, "armourclass", "armourclass_max"],
    ["villain_armour", "villain", "armour", 749, "armourclass", "armourclass_max"]
  ]);
  assert.deepEqual(GAUGE_PANEL.names, [{ side: "hero", variable: "herotext" }, { side: "villain", variable: "villaintext" }]);
  assert.deepEqual(GAUGE_PANEL.expectedDrive, { base: -30, full: 101, step: 0.7, percentScale: 100, rounding: "round", separator: " / " });
  assert.equal(ICON_CLIPS.some((clip) => [733, 742, 749, 52].includes(clip.character)), false,
    "the gauge sprites are NOT roster clips: adding them there would move the roster's measured totals");
});

test("A BUILD WITHOUT THE PANEL: the gauges section says so BY NAME, stays empty, and the manifest still has its block", () => {
  // The buttons' miniature has no `combat_panel`: nothing to take, and that is a failure a reader sees.
  const result = extractIcons(buttonBuild());
  const gauges = result.gauges;
  assert.ok(gauges.problems.some((problem) => /combat_panel/.test(problem)));
  // In the pack's failures under the section's own name — the roster reports its own missing
  // `combat_panel` in the same words, and one must not stand in for the other.
  assert.ok(result.failures.some((row) => row.character === 751 && row.message === `gauges: ${gauges.problems[0]}`), "and in the pack's failures");
  assert.deepEqual([Object.keys(gauges.clips), Object.keys(gauges.nested), gauges.placements, gauges.drive, gauges.attach],
    [[], [], [], null, null]);
  assert.equal(gauges.effects.ownFilters, 0, "a counted zero, not an absent invoice");
  const manifest = buildManifest(result, { file: "x.swf", sha256: "0" });
  assert.deepEqual(manifest.gauges.problems, gauges.problems);
  assert.equal(tallyIconEffects(result).undescendedClipPlacements, 0, "the roster's invoice never sees the gauges");
});

/* ------------------------------------------------------------------ */
/* 7e. THE CROWD BAR: its drive, read off the bytes (D8, 2026-09-25)   */
/* ------------------------------------------------------------------ */

const literal = (value) => ({ kind: "literal", value });

test("THE STATEMENT READER MODELS new, random() AND A COMPUTED MEMBER — the three shapes the crowd bar's handlers are written in", () => {
  // Each as the build compiles it (crowd_bar clip-action 0 +0x01c7..+0x01ea; clip-action 1 +0x0159..+0x016a
  // and +0x01fa..+0x0232): `new` pops its name, its count, then its arguments FIRST-ARGUMENT-FIRST (pushed
  // last-first); `random` pops its bound; a member whose name is computed keeps the computation.
  const statements = actionStatementsOf(assembleBlock("synthetic", 0, [
    push(constant("list"), constant("b"), constant("a"), constant(""), integer(3), constant("Array")), bare("NewObject"), bare("SetVariable"),
    push(constant("chance"), integer(1), integer(1000)), bare("RandomNumber"), bare("Add2"), bare("SetVariable"),
    push(constant("_parent")), bare("GetVariable"), push(constant("label"), constant("x: "), constant("list")), bare("GetVariable"),
    push(constant("_global")), bare("GetVariable"), push(constant("n")), bare("GetMember"), push(integer(10)), bare("Divide"),
    push(integer(1), constant("Math")), bare("GetVariable"), push(constant("ceil")), bare("CallMethod"), bare("GetMember"), bare("Add2"),
    bare("SetMember"),
    bare("End")
  ]).instructions);
  assert.deepEqual(statements.map((statement) => [statement.kind, statement.name]), [["setVariable", "list"], ["setVariable", "chance"], ["set", "label"]],
    "three statements, none unread");
  assert.deepEqual(statements[0].value, { kind: "new", name: "Array", args: [literal(""), literal("a"), literal("b")] }, "index 0 is the one pushed last");
  assert.deepEqual(statements[1].value, { kind: "binary", op: "Add2", left: literal(1), right: { kind: "random", max: literal(1000) } });
  const element = statements[2].value.right;
  assert.deepEqual([element.kind, element.name, element.object], ["member", null, { kind: "var", name: "list" }]);
  assert.deepEqual([element.key.kind, element.key.method, element.key.args[0].op], ["call", "ceil", "Divide"], "list[Math.ceil(_global.n / 10)]");
  // A literal member name is unchanged: no `key` rides along with it.
  assert.equal(Object.hasOwn(statements[2].value.right.key.args[0].left, "key"), false);
});

/** The build's ten moods and its empty index 0, as `crowd_bar` clip-action 0 builds them (+0x01c7). */
const BUILD_MOODS = ["", "bored to tears", "bored silly", "restless", "indifferent", "interested", "entertained", "enthusiastic",
  "wildly entertained", "Tranfixed", "Fanatical"];
/** `_global.crowd_interest`, as the build reads it. */
const crowdRead = () => [push(constant("_global")), bare("GetVariable"), push(constant("crowd_interest")), bare("GetMember")];
const branch = (name, mark) => ({ name, operand: { delta: 0, target: -1 }, mark });
const marked = (step, mark) => (Array.isArray(step) ? [{ ...step[0], mark }, ...step.slice(1)] : { ...step, mark });
/** `_root.<clip>.<method>(<args>)` as a discarded call. */
const soundCall = (clip, method, args) => [push(...[...args].reverse(), integer(args.length), constant("_root")), bare("GetVariable"),
  push(constant(clip)), bare("GetMember"), push(constant(method)), bare("CallMethod"), bare("Pop")];
/** `if (<chance> = 1 + random(1000)) == 1000) _root.<clip>.start()` under `if (crowd <cmp> <n>)`: one of the two sound gates. */
const soundGate = (comparison, than, chance, clip, from, to) => [
  marked(crowdRead(), from), push(integer(than)), bare(comparison), bare("Not"), branch("If", `${from}:out`),
  push(constant(chance), integer(1), integer(1000)), bare("RandomNumber"), bare("Add2"), bare("SetVariable"),
  push(constant(chance)), bare("GetVariable"), push(integer(1000)), bare("Equals2"), bare("Not"), branch("If", `${from}:in`),
  push(double(0), constant("_root")), bare("GetVariable"), push(constant(clip)), bare("GetMember"), push(constant("start")), bare("CallMethod"), bare("Pop")
].map((step) => ({ step, to }));

/**
 * `crowd_bar`'s two `onClipEvent` handlers as the build compiles them, statement
 * for statement (the oracle's dump: clip-action 0, `load`, body 0x225e5d;
 * clip-action 1, `enterFrame`, body 0x226086). `edit` may rewrite either step
 * list before it is assembled; the branches are patched after, by mark.
 */
function crowdBlocks({ moods = BUILD_MOODS, level = 1, guard = 1, divisor = 10, prefix = "crowd: ", edit = null } = {}) {
  const load = [
    push(constant("_global")), bare("GetVariable"), push(constant("crowd_interest")), gameRead("hero", "herolevel"),
    gameRead("villain", "herolevel"), bare("Add2"), { name: "SetMember", mark: "opening" },
    gameRead("hero", "herolevel"), push(integer(level)), bare("Greater"), bare("Not"), branch("If", "test"),
    soundCall("crowd_noise", "start", [integer(0), integer(99999)]),
    soundCall("crowd_noise", "setVolume", [integer(0)]),
    marked(push(constant("crowd_interest_array"), ...[...moods].reverse().map(constant), integer(moods.length), constant("Array")), "moodsFrom"), bare("NewObject"),
    { name: "SetVariable", mark: "moods" },
    branch("Jump", "skip"),
    marked(push(constant("this")), "hidden"), bare("GetVariable"), push(constant("_visible"), bool(false)), { name: "SetMember", mark: "hideBar" },
    push(constant("_parent")), bare("GetVariable"), push(constant("crowd_text"), constant("")), { name: "SetMember", mark: "emptyText" },
    marked(push(constant("_parent")), "hideBackgroundFrom"), bare("GetVariable"), push(constant("crowd_bar_bg")), bare("GetMember"), push(constant("_visible"), bool(false)),
    { name: "SetMember", mark: "hideBackground" },
    marked(bare("End"), "end")
  ];
  const cheer = soundGate("Greater", 70, "rockyouchance", "rockyou", "cheer", "boo");
  const boo = soundGate("Less2", 20, "crowd_boo_chance", "crowd_boo", "boo", "label");
  const frame = [
    gameRead("hero", "herolevel"), push(integer(guard)), bare("Greater"), bare("Not"), branch("If", "guard"),
    crowdRead(), push(integer(2)), bare("Divide"), mathRound(), push(integer(4)), bare("Add2"),
    push(integer(1), constant("_root")), bare("GetVariable"), push(constant("crowd_noise")), bare("GetMember"), push(constant("setVolume")),
    bare("CallMethod"), bare("Pop"),
    cheer.map((entry) => entry.step), boo.map((entry) => entry.step),
    marked(push(constant("_parent")), "labelFrom"), bare("GetVariable"), push(constant("crowd_text"), constant(prefix), constant("crowd_interest_array")),
    bare("GetVariable"), crowdRead(), push(integer(divisor)), bare("Divide"), push(integer(1), constant("Math")), bare("GetVariable"),
    push(constant("ceil")), bare("CallMethod"), bare("GetMember"), bare("Add2"), { name: "SetMember", mark: "label" },
    push(constant("this")), bare("GetVariable"), push(constant("_xscale")), crowdRead(), mathRound(), { name: "SetMember", mark: "scale" },
    marked(bare("End"), "end")
  ];
  const steps = { load, frame };
  if (edit) edit(steps);
  const loadBlock = assembleBlock("sprite:751/frame:1/instance:crowd_bar/clip-action:0", 0x20000, steps.load);
  const frameBlock = assembleBlock("sprite:751/frame:1/instance:crowd_bar/clip-action:1", 0x30000, steps.frame);
  loadBlock.eventFlags = 1;
  frameBlock.eventFlags = 2;
  const find = (block, mark) => block.instructions.find((instruction) => instruction.mark === mark);
  const patch = (block, mark, to) => { const found = find(block, mark); if (found) found.operand.target = find(block, to)?.offset ?? -1; };
  patch(loadBlock, "test", "hidden");
  patch(loadBlock, "skip", "end");
  patch(frameBlock, "guard", "end");
  for (const [from, to] of [["cheer", "boo"], ["boo", "labelFrom"]]) {
    patch(frameBlock, `${from}:out`, to);
    patch(frameBlock, `${from}:in`, to);
  }
  return {
    blocks: [loadBlock, frameBlock], load: loadBlock, frame: frameBlock,
    at: (block, mark) => relative(block, find(block, mark))
  };
}

test("THE CROWD BAR'S DRIVE IS READ OFF ITS OWN TWO HANDLERS: the opening, the level test, the moods, what it hides, the label and the _xscale", () => {
  const built = crowdBlocks();
  const derived = deriveCrowdDrive({ actionBlocks: built.blocks }, { character: 751, instance: "crowd_bar" });
  assert.deepEqual(derived.problems, []);
  assert.deepEqual(derived.drive, {
    source: "_global.crowd_interest",
    opening: "_root.game.hero.herolevel + _root.game.villain.herolevel",
    shownWhile: { side: "hero", field: "herolevel", comparison: ">", than: 1 },
    hides: ["this._visible = false", "_parent.crowd_text = \"\"", "_parent.crowd_bar_bg._visible = false"],
    scale: { target: "this", property: "_xscale", rounding: "round" },
    label: { target: "_parent", variable: "crowd_text", prefix: "crowd: ", array: "crowd_interest_array", rounding: "ceil", divisor: 10 },
    moods: BUILD_MOODS
  });
  assert.deepEqual(derived.handlers, {
    load: { block: "0x20000", eventFlags: 1, opening: built.at(built.load, "opening"), test: built.at(built.load, "test"),
      moods: built.at(built.load, "moods"),
      hides: [built.at(built.load, "hideBar"), built.at(built.load, "emptyText"), built.at(built.load, "hideBackground")] },
    enterFrame: { block: "0x30000", eventFlags: 2, guard: built.at(built.frame, "guard"), label: built.at(built.frame, "label"),
      scale: built.at(built.frame, "scale") }
  });
  // The sounds share the handlers and draw nothing: each is NAMED, never silently skipped — the two
  // on load, and the volume and the two 1-in-1000 gates every frame.
  assert.deepEqual(derived.notDrawn.map((row) => row.handler), ["load", "load", ...Array(9).fill("enterFrame")]);
  assert.deepEqual(derived.notDrawn.filter((row) => /a call to start/.test(row.what)).length, 3, "the ambience, the cheer and the boo");
  assert.ok(derived.notDrawn.every((row) => /^\+0x[0-9a-f]{4}$/.test(row.at)));
});

test("A CROWD HANDLER THIS READER CANNOT FOLLOW IS A PROBLEM BY NAME — a stray drawn write, no guard, a skipped label, a lost arm, a third handler", () => {
  const read = (built) => deriveCrowdDrive({ actionBlocks: built.blocks }, { character: 751, instance: "crowd_bar" });
  const problemsOf = (options) => read(crowdBlocks(options)).problems;
  const insertBefore = (list, mark, steps) => {
    const index = list.findIndex((step) => (Array.isArray(step) ? step[0]?.mark === mark : step.mark === mark));
    assert.ok(index >= 0, `mark ${mark}`);
    list.splice(index, 0, ...steps);
  };
  // A write that moves what is drawn and is not the drive: named, with its offset.
  const stray = problemsOf({ edit: (steps) => insertBefore(steps.frame, "labelFrom",
    [push(constant("this")), bare("GetVariable"), push(constant("_alpha"), integer(50)), bare("SetMember")]) });
  assert.ok(stray.some((problem) => /a write to this\._alpha at \+0x[0-9a-f]{4} on enterFrame is not part of the crowd bar's drive/.test(problem)), JSON.stringify(stray));
  // A second write to the crowd itself: the bar would not show the engine's crowd.
  const rewritten = problemsOf({ edit: (steps) => insertBefore(steps.frame, "labelFrom",
    [push(constant("_global")), bare("GetVariable"), push(constant("crowd_interest"), integer(5)), bare("SetMember")]) });
  assert.ok(rewritten.some((problem) => /a write to _global\.crowd_interest .* on enterFrame/.test(problem)), JSON.stringify(rewritten));
  // An opcode this reader does not model: never guessed across.
  const unread = problemsOf({ edit: (steps) => insertBefore(steps.frame, "labelFrom", [bare("Trace")]) });
  assert.ok(unread.some((problem) => /an opcode this reader does not model \(Trace\)/.test(problem)), JSON.stringify(unread));
  // No guard: the label would be written every frame while the bar is hidden.
  const unguarded = problemsOf({ edit: (steps) => { steps.frame.splice(0, 5); } });
  assert.ok(unguarded.some((problem) => /does not open with a level test/.test(problem)), JSON.stringify(unguarded));
  // A guard that tests another level than the load hides by.
  assert.ok(problemsOf({ guard: 2 }).some((problem) => /the enterFrame guard tests hero\.herolevel > 2; the load shows the bar while hero\.herolevel > 1/.test(problem)));
  // A branch that can skip the label.
  const dodging = crowdBlocks({ edit: (steps) => insertBefore(steps.frame, "labelFrom",
    [gameRead("hero", "herolevel"), push(integer(5)), bare("Greater"), branch("If", "dodge")]) });
  const dodge = dodging.frame.instructions.find((instruction) => instruction.mark === "dodge");
  dodge.operand.target = dodging.frame.instructions[dodging.frame.instructions.findIndex((instruction) => instruction.mark === "label") + 1].offset;
  const skipped = read(dodging).problems;
  assert.ok(skipped.some((problem) => /the label at \+0x[0-9a-f]{4} does not run on every path under the guard: the list's end/.test(problem)), JSON.stringify(skipped));
  // The skip jump gone: the shown arm runs on into the hiding one.
  const fallThrough = problemsOf({ edit: (steps) => { steps.load = steps.load.filter((step) => step.mark !== "skip"); } });
  assert.ok(fallThrough.some((problem) => /not shaped if \/ arm \/ jump to the end \/ arm/.test(problem)), JSON.stringify(fallThrough));
  // No mood array: no drive, and the reason.
  const moodless = read(crowdBlocks({ edit: (steps) => {
    steps.load = steps.load.filter((step) => !(step.name === "NewObject" || step.mark === "moods" ||
      (step.name === "Push" && step.operand?.[0]?.value === "crowd_interest_array")));
  } }));
  assert.equal(moodless.drive, null);
  assert.ok(moodless.problems.some((problem) => /0 mood arrays/.test(problem)), JSON.stringify(moodless.problems));
  // The label reads another array than the one built.
  const other = problemsOf({ edit: (steps) => {
    const at = steps.frame.findIndex((step) => step.name === "Push" && step.operand?.[2]?.value === "crowd_interest_array");
    steps.frame[at] = push(constant("crowd_text"), constant("crowd: "), constant("another_array"));
  } });
  assert.ok(other.some((problem) => /the label reads another_array, the moods are crowd_interest_array/.test(problem)), JSON.stringify(other));
  // A third handler, on another event: not silently ignored.
  const third = crowdBlocks();
  third.blocks.push({ ...assembleBlock("sprite:751/frame:1/instance:crowd_bar/clip-action:2", 0x40000, [bare("End")]), eventFlags: 4 });
  assert.ok(read(third).problems.some((problem) => /on events 4/.test(problem)));
  // A guard that jumps somewhere other than the end (here: onto the label, skipping only the sounds).
  const short = crowdBlocks();
  const guardOf = short.frame.instructions.find((instruction) => instruction.mark === "guard");
  guardOf.operand.target = short.frame.instructions.find((instruction) => instruction.mark === "labelFrom").offset;
  assert.ok(read(short).problems.some((problem) => /does not open with a level test that skips all of it/.test(problem)));
  // The load's test the other way round (one `Not` fewer): the bar would be built while the hero is level 1.
  const inverted = problemsOf({ edit: (steps) => {
    const at = steps.load.findIndex((step) => step.mark === "test");
    steps.load.splice(at - 1, 1);
  } });
  assert.ok(inverted.some((problem) => /the bar is shown while hero\.herolevel > 1 is FALSE/.test(problem)), JSON.stringify(inverted));
  // A write in the hidden arm that hides nothing is not a hide: a display write, and a problem.
  const extra = problemsOf({ edit: (steps) => insertBefore(steps.load, "end",
    [push(constant("this")), bare("GetVariable"), push(constant("_alpha"), integer(50)), bare("SetMember")]) });
  assert.ok(extra.some((problem) => /a write to this\._alpha at \+0x[0-9a-f]{4} on load is not part of the crowd bar's drive/.test(problem)), JSON.stringify(extra));
  // CODEX PASS 1 (the crowd slice): a call that changes what a clip shows is a problem however its value is
  // used — assigned, passed as an argument, or left on the stack — not only as a statement of its own.
  const removal = [push(integer(0), constant("_parent")), bare("GetVariable"), push(constant("removeMovieClip")), bare("CallMethod")];
  const assigned = problemsOf({ edit: (steps) => insertBefore(steps.frame, "labelFrom", [push(constant("ignored")), removal, bare("SetVariable")]) });
  assert.ok(assigned.some((problem) => /a call to removeMovieClip at \+0x[0-9a-f]{4} on enterFrame is not part of the crowd bar's drive/.test(problem)),
    JSON.stringify(assigned));
  const nested = problemsOf({ edit: (steps) => insertBefore(steps.frame, "labelFrom", [
    push(integer(2), integer(1), constant("this")), bare("GetVariable"), push(constant("gotoAndStop")), bare("CallMethod"),
    push(integer(1), constant("_root")), bare("GetVariable"), push(constant("crowd_noise")), bare("GetMember"), push(constant("setVolume")),
    bare("CallMethod"), bare("Pop")]) });
  assert.ok(nested.some((problem) => /a call to gotoAndStop at \+0x[0-9a-f]{4} on enterFrame/.test(problem)), JSON.stringify(nested));
  const dangling = problemsOf({ edit: (steps) => insertBefore(steps.load, "end", removal) });
  assert.ok(dangling.some((problem) => /a call to removeMovieClip at \+0x[0-9a-f]{4} on load/.test(problem)), JSON.stringify(dangling));
  // CODEX PASS 2 (the crowd slice): what the load does must RUN. A jump at its start straight to its end skips
  // the opening and the test; a jump over the moods leaves the bar shown with no moods; a branch over a hide
  // leaves the background up while the bar is hidden. Each is a problem naming the piece and the way round it.
  const jumpTo = (block, from, to) => {
    const at = block.instructions.find((instruction) => instruction.mark === from);
    at.operand.target = block.instructions.find((instruction) => instruction.mark === to).offset;
  };
  const bypassed = crowdBlocks({ edit: (steps) => { steps.load.unshift(branch("Jump", "bypass")); } });
  jumpTo(bypassed.load, "bypass", "end");
  const bypass = read(bypassed).problems;
  assert.ok(bypass.some((problem) => /the opening at \+0x[0-9a-f]{4} does not run on every path of the load handler: the list's end/.test(problem)), JSON.stringify(bypass));
  assert.ok(bypass.some((problem) => /the level test at \+0x[0-9a-f]{4} does not run on every path of the load handler/.test(problem)), JSON.stringify(bypass));
  const moodSkip = crowdBlocks({ edit: (steps) => insertBefore(steps.load, "moodsFrom", [branch("Jump", "hop")]) });
  jumpTo(moodSkip.load, "hop", "skip");
  const unbuilt = read(moodSkip).problems;
  assert.ok(unbuilt.some((problem) => /the moods at \+0x[0-9a-f]{4} do not run on every path while the bar is shown/.test(problem)), JSON.stringify(unbuilt));
  const hideSkip = crowdBlocks({ edit: (steps) => insertBefore(steps.load, "hideBackgroundFrom",
    [push(constant("whim")), bare("GetVariable"), push(integer(1)), bare("Equals2"), branch("If", "dodgeHide")]) });
  jumpTo(hideSkip.load, "dodgeHide", "end");
  const shown = read(hideSkip).problems;
  assert.ok(shown.some((problem) => /the hide _parent\.crowd_bar_bg\._visible = false at \+0x[0-9a-f]{4} does not run on every path while the bar is hidden/.test(problem)),
    JSON.stringify(shown));
  // And none of these is a drive the section would carry as the build's… except that each still names what it read.
  assert.deepEqual(read(crowdBlocks()).problems, [], "the build's own shape is clean");
});

test("THE CROWD BAR'S PLACEMENTS ARE NAMED FROM THE BYTES — the bar and its background by instance, the label by its field's variable — and the gauges leave them to it", () => {
  const frameOne = [
    entryAt(3, 723, { name: "crowd_bar_bg", tx: 9661, ty: -5144 }),
    entryAt(5, 725, { name: "crowd_bar", tx: 9657, ty: -5132 }),
    entryAt(9, 733, { name: "villain_potion", tx: 10700, ty: 933 }),
    entryAt(63, 750, { tx: 9669, ty: -5175, filters: [{ type: "glow" }] }),
    entryAt(64, 999, { name: "something_else" })
  ];
  const fields = { 750: { variable: "crowd_text", align: "center" } };
  const fieldOf = (id) => fields[id] ?? null;
  const crowd = summariseCrowdBar(frameOne, { declared: CROWD_BAR, fieldOf });
  assert.deepEqual(crowd.problems, []);
  assert.deepEqual(crowd.placements.map((row) => [row.depth, row.kind, row.character, row.instance ?? row.variable, row.matrix]), [
    [3, "background", 723, "crowd_bar_bg", [1, 0, 0, 1, 9661, -5144]],
    [5, "bar", 725, "crowd_bar", [1, 0, 0, 1, 9657, -5132]],
    [63, "label", 750, "crowd_text", [1, 0, 0, 1, 9669, -5175]]
  ]);
  const label = crowd.placements.find((row) => row.kind === "label");
  assert.deepEqual([label.align, label.filters], ["center", [{ type: "glow" }]], "the label's glow, carried as data on the placement that has it");
  // THE GAUGES LEAVE THEM TO IT: what neither section takes is still named, and only that.
  const gauges = summariseGaugePanel(frameOne, { declared: GAUGE_PANEL, fieldOf, bannerSpanOf: () => null,
    takenElsewhere: new Set(crowd.placements.map((row) => row.depth)) });
  assert.deepEqual(gauges.notTaken.map((row) => [row.depth, row.character, row.name]), [[64, 999, "something_else"]]);
  // Each part exactly once, as the character the build uses — or a problem by name.
  const doubled = summariseCrowdBar([...frameOne, entryAt(70, 725, { name: "crowd_bar" })], { declared: CROWD_BAR, fieldOf });
  assert.ok(doubled.problems.some((problem) => /crowd_bar is placed 2 times/.test(problem)), JSON.stringify(doubled.problems));
  const swapped = summariseCrowdBar(frameOne.map((entry) => (entry.depth === 3 ? entryAt(3, 724, { name: "crowd_bar_bg" }) : entry)),
    { declared: CROWD_BAR, fieldOf });
  assert.ok(swapped.problems.some((problem) => /crowd_bar_bg is character 724, expected 723/.test(problem)), JSON.stringify(swapped.problems));
  const unlabelled = summariseCrowdBar(frameOne.filter((entry) => entry.depth !== 63), { declared: CROWD_BAR, fieldOf });
  assert.ok(unlabelled.problems.some((problem) => /0 fields bound to crowd_text/.test(problem)), JSON.stringify(unlabelled.problems));
});

test("the crowd bar's declaration names its three parts and the drive it EXPECTS — checked by the extraction, never written", () => {
  assert.deepEqual([CROWD_BAR.character, CROWD_BAR.linkage], [751, "combat_panel"]);
  assert.deepEqual([CROWD_BAR.background, CROWD_BAR.bar, CROWD_BAR.text],
    [{ instance: "crowd_bar_bg", character: 723 }, { instance: "crowd_bar", character: 725 }, { variable: "crowd_text", character: 750 }]);
  // Read off the oracle's dump (crowd_bar clip-actions 0 and 1) — and re-derived from the bytes by the gated tests below.
  assert.deepEqual(CROWD_BAR.expectedDrive, {
    source: "_global.crowd_interest",
    opening: "_root.game.hero.herolevel + _root.game.villain.herolevel",
    shownWhile: { side: "hero", field: "herolevel", comparison: ">", than: 1 },
    hides: ["this._visible = false", "_parent.crowd_text = \"\"", "_parent.crowd_bar_bg._visible = false"],
    scale: { target: "this", property: "_xscale", rounding: "round" },
    label: { target: "_parent", variable: "crowd_text", prefix: "crowd: ", array: "crowd_interest_array", rounding: "ceil", divisor: 10 },
    moods: BUILD_MOODS
  });
  assert.equal(ICON_CLIPS.some((clip) => [723, 725].includes(clip.character)), false,
    "the crowd's sprites are NOT roster clips: adding them there would move the roster's measured totals");
});

test("A BUILD WITHOUT THE PANEL: the crowd section says so BY NAME, stays empty, and the manifest still has its block", () => {
  const result = extractIcons(buttonBuild());
  const crowd = result.crowd;
  assert.ok(crowd, "the section is always written");
  assert.ok(crowd.problems.some((problem) => /combat_panel/.test(problem)));
  assert.ok(result.failures.some((row) => row.character === 751 && row.message === `crowd: ${crowd.problems[0]}`),
    "in the pack's failures under the section's own name");
  assert.deepEqual([Object.keys(crowd.clips), crowd.placements, crowd.drive, crowd.origin], [[], [], null, null]);
  assert.equal(crowd.effects.ownFilters, 0, "a counted zero, not an absent invoice");
  const manifest = buildManifest(result, { file: "x.swf", sha256: "0" });
  assert.deepEqual(manifest.crowd.problems, crowd.problems);
  assert.equal(tallyIconEffects(result).undescendedClipPlacements, 0, "the roster's invoice never sees the crowd");
});

/* ------------------------------------------------------------------ */
/* 8. Against the real build                                           */
/* ------------------------------------------------------------------ */

const ORACLE =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";
const haveOracle = fs.existsSync(ORACLE);
let extracted = null;

function oracleExtraction() {
  if (extracted === null) extracted = extractIcons(fs.readFileSync(ORACLE));
  return extracted;
}

test("EVERY declared clip comes back with frames, or is COUNTED as a failure",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    const result = oracleExtraction();
    assert.equal(Object.keys(result.faces).length, FACE_CLIPS.length);
    assert.equal(Object.keys(result.clips).length + result.failures.filter((row) => row.frame === undefined).length
      >= ICON_CLIPS.length, true, "a clip is extracted or it is a failure, never quietly neither");
    for (const clip of Object.values(result.clips)) {
      assert.equal(clip.frames.length, clip.declaredFrames, `${clip.linkage} lost frames on the way out`);
      assert.ok(clip.distinctFrames > 0, `${clip.linkage} produced no distinct frame at all`);
    }
    for (const face of Object.values(result.faces)) {
      assert.ok(face.expressionCount > 0, `${face.linkage} must have expressions to be indexed by`);
      for (const expression of Object.values(face.expressions)) {
        assert.ok(expression.poses.length > 0, `${face.linkage}/${expression.label} is an EMPTY animation`);
        assert.ok(expression.distinctPoses > 0, `${face.linkage}/${expression.label} draws nothing`);
      }
    }
  });

test("THE FACE IS STILLS: every expression holds ONE pose to a stop()",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    // ► 121 frames and 12 pictures; 100 frames and 10. Each labelled run ends
    //   in a bare `stop()` and every frame inside it carries the identical
    //   placement set. A renderer picks a pose and holds it — and if this ever
    //   stops being true, the face animates and this test is how anyone finds
    //   out rather than by looking at it.
    const result = oracleExtraction();
    for (const face of Object.values(result.faces)) {
      assert.equal(face.everyExpressionIsOnePose, true, `${face.linkage} is no longer a set of stills`);
      for (const expression of Object.values(face.expressions)) {
        assert.equal(expression.distinctPoses, 1, `${face.linkage}/${expression.label}`);
        assert.equal(expression.stopsAtEnd, true,
          `${face.linkage}/${expression.label} runs on past its last frame into the next expression`);
      }
    }
    assert.deepEqual(result.faces.eyes.timeline.stops, [9, 19, 29, 39, 49, 59, 69, 79, 89, 100, 110, 121]);
    assert.deepEqual(result.faces.mouth.timeline.stops, [9, 19, 29, 39, 49, 60, 70, 80, 90, 100]);
  });

test("the SEVERITY of a hit survives: damage_splat keeps all five of its frames",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    // The defect this whole file is about, checked against the build itself.
    const result = oracleExtraction();
    const splat = result.nested[815];
    assert.ok(splat, "damage_icon's child must be extracted as an asset of its own");
    assert.equal(splat.declaredFrames, 5);
    assert.equal(splat.distinctFrames, 5, "five frames that collapse to one is the defect, not a tidy-up");
    assert.deepEqual(splat.instances, ["damage_splat"]);
    // And the parent must reference it rather than contain it.
    const inside = result.clips.damage_icon.frames[0].filter((placement) => placement.kind === "clip");
    assert.equal(inside.length, 1);
    assert.equal(inside[0].character, 815);
    assert.equal(inside[0].frameCount, 5);
    assert.equal(result.nested[151].declaredFrames, 8, "bonus_icon's child would have collapsed the same way");
    assert.equal(result.nested[161].declaredFrames, 7);
  });

test("the combat panel's six gauges keep the mask that crops them",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    const result = oracleExtraction();
    const panel = result.clips.combat_panel;
    const masked = panel.frames[0].filter((placement) => placement.mask);
    assert.equal(masked.length, 6, "two hit-point, two stamina and two armour gauges");
    for (const placement of masked) {
      assert.equal(placement.kind, "shape");
      assert.ok(result.shapes[placement.mask.shape], "a clip path must point at geometry that exists");
      assert.equal(placement.mask.matrix.length, 6);
    }
    assert.equal(result.clipsAcrossSpriteBoundary, 6,
      "exactly the clips flattenFrame loses — if this drops to 0 the gauges are unclipped again");
    // And the handlers that MOVE the liquid are recorded, because no drawable
    // list can carry them and a renderer without them paints a full bar.
    const gauges = panel.clipEvents.filter((event) => event.touches.includes("blood_health"));
    assert.equal(gauges.length, 6);
    for (const gauge of gauges) {
      assert.ok(gauge.touches.includes("_y"), `${gauge.instance} drives the liquid by _y`);
    }
  });

test("every placement points at geometry or at a text field that was READ",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    // Never a silently-empty path and never a dangling reference: those are the
    // two ways an extraction reports success and renders nothing.
    const result = oracleExtraction();
    const everyFrame = [
      ...Object.values(result.clips).flatMap((clip) => clip.frames),
      ...Object.values(result.nested).flatMap((clip) => clip.frames),
      ...Object.values(result.faces).flatMap((face) =>
        Object.values(face.expressions).flatMap((expression) => expression.poses))
    ];
    assert.ok(everyFrame.length > 100, `only ${everyFrame.length} frames were walked — the check would be vacuous`);
    let placements = 0;
    for (const frame of everyFrame) {
      for (const placement of frame) {
        placements += 1;
        if (placement.kind === "shape") {
          const shape = result.shapes[placement.character];
          assert.ok(shape, `shape ${placement.character} is placed and was never extracted`);
          assert.ok(shape.paths.length > 0, `shape ${placement.character} produced NO paths`);
        } else if (placement.kind === "text") {
          assert.ok(result.texts[placement.character], `text ${placement.character} is placed and was never read`);
        } else if (placement.kind === "clip") {
          assert.ok(result.nested[placement.character] || result.clips[
            Object.keys(result.clips).find((key) => result.clips[key].character === placement.character)],
          `clip ${placement.character} is placed and was never extracted`);
        }
      }
    }
    assert.ok(placements > 500, `only ${placements} placements — the loop would be nearly vacuous`);
  });

test("the manifest COUNTS every approximation and every dead symbol a human must see",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    // ► **AN APPROXIMATION THAT IS NOT COUNTED IS INDISTINGUISHABLE FROM A
    //   CORRECT READ.** The arena's walls were invisible for months because a
    //   dropped field made one look like the other, and the extractor reported
    //   zero failures throughout.
    const result = oracleExtraction();
    const manifest = buildManifest(result, { file: "x.swf", sha256: ORACLE_SHA256 });
    assert.equal(manifest.oracle, true);
    assert.ok(manifest.approximations["text-placement"] > 0, "190 text placements carry no glyphs");
    assert.equal(
      manifest.approximations["edit-text-characters"] + manifest.approximations["static-text-characters"],
      manifest.textCount,
      "the two text tallies must add up to the fields actually read");
    assert.ok(manifest.approximations["label-not-found"] > 0,
      "the build asks for labels that are not there and the count is how anyone learns that");
    assert.equal(manifest.clipsAcrossSpriteBoundary, 6);
    for (const name of ["miss_icon", "addstats_icon"]) {
      assert.equal(manifest.icons[name].attachedBy, null, `${name} is dead and the manifest must say so`);
      assert.ok(manifest.icons[name].declaredFrames > 0, `${name} is still extracted`);
    }
    assert.ok(manifest.expressionScript.callCount > 200);
    assert.deepEqual(
      Object.keys(manifest.expressionScript.resolution).sort(),
      ["case", "exact", "missing", "unreadable"]);
    assert.equal(
      manifest.expressionScript.resolution.exact + manifest.expressionScript.resolution.case +
      manifest.expressionScript.resolution.missing + manifest.expressionScript.resolution.unreadable,
      manifest.expressionScript.callCount,
      "every call is in exactly one bucket, or a call went missing between them");
  });

test("the six calls that name a missing label are the ones this session found",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    // Named rather than counted, because "six" is a number and "mouth1 has no
    // Smile" is the finding. If the build ever changes, this says which.
    const result = oracleExtraction();
    const missing = result.expressionScript.unresolved.filter((row) => row.status === "missing");
    assert.equal(missing.length, 6);
    for (const row of missing) {
      assert.equal(row.part, "mouth", "every unreachable expression is on the mouth");
    }
    assert.deepEqual([...new Set(missing.map((row) => row.asked))].sort(), ["Smile", "pain"]);
  });

/* ------------------------------------------------------------------ */
/* 9. THE EFFECTS INVOICE, against the real build                      */
/* ------------------------------------------------------------------ */

/** Every extracted entry that carries an invoice, in one sequence. */
function everyEntry(result) {
  return [
    ...Object.values(result.faces),
    ...Object.values(result.clips),
    ...Object.values(result.nested)
  ];
}

/**
 * One entry's placement lists.
 *
 * ► **A FACE IS NOT SHAPED LIKE A CLIP, and this is where that shows.** An icon
 *   clip keeps `frames`; a face keeps its placements inside
 *   `expressions[label].poses`, because the face is indexed by LABEL and a
 *   second copy of the same 121 frames would be a second thing to drift. The
 *   runs are slices of one frame list, so a label the extractor did not cover
 *   would go uncounted here — which is only safe because every face measures
 *   ZERO effects, and the tests below assert that separately rather than
 *   assuming it.
 */
function framesOf(entry) {
  if (Array.isArray(entry.frames)) return entry.frames;
  return Object.values(entry.expressions ?? {}).flatMap((expression) => expression.poses);
}

test("THE ROSTER'S 176 FILTERS, CLIP BY CLIP — the table in the extractor's own header",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    // ► **THE NUMBERS THIS WHOLE JOB EXISTS FOR.** Before today `extract-icons`
    //   matched ZERO of `hasFilters|ancestorEffects|\.filters|blendMode`, so
    //   every one of these was 0 and the pack said nothing about it — no
    //   failure, no approximation, no empty key. This test goes red if a filter
    //   stops arriving AND if one arrives on the wrong clip.
    const result = oracleExtraction();
    const own = (key) => result.clips[key].effects.own.filters;
    const group = (key) => result.clips[key].effects.inherited.filters;
    assert.deepEqual(
      Object.fromEntries(Object.keys(result.clips).map((key) => [key, [own(key), group(key)]])),
      {
        inventory_buttons: [2, 0],
        cast_spell_image: [40, 0],
        damage_icon: [24, 0],
        defend_icon: [24, 0],
        miss_icon: [34, 0],
        bonus_icon: [35, 0],
        addstats_icon: [0, 0],
        combat_panel: [15, 2]
      });
    // The faces and the nested children carry NONE, and that zero is a
    // measurement too — it is the reason the face is cheap to draw.
    for (const face of Object.values(result.faces)) {
      assert.equal(face.effects.own.filters, 0, `${face.linkage} gained a filter`);
      assert.equal(face.effects.inherited.filters, 0);
      assert.ok(face.effects.notCarried, "and a face still carries the invoice, empty or not");
    }
    for (const [id, clip] of Object.entries(result.nested)) {
      assert.equal(clip.effects.own.filters + clip.effects.inherited.filters, 0, `nested ${id} gained a filter`);
    }
    const total = everyEntry(result)
      .reduce((sum, entry) => sum + entry.effects.own.filters + entry.effects.inherited.filters, 0);
    assert.equal(total, 176, "174 own and 2 on enclosing groups");
  });

test("NOT ONE OF THE 176 IS ON A SHAPE — which is why carrying them on the geometry path would have moved nothing",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    // ► **THE TRAP THIS TEST IS ABOUT.** Every icon filter is on a numeral —
    //   `DefineEditText` and `DefineText` placements, which this tool emits with
    //   `unsupported: "text-placement"` and does not turn into geometry — or on
    //   a `clip` placement it refuses to descend into. A fix that spread
    //   `filters` onto shapes and stopped would have written nothing, 176 times,
    //   and every test above would still have been green.
    const result = oracleExtraction();
    const kinds = {};
    let filtered = 0;
    for (const entry of everyEntry(result)) {
      for (const frame of framesOf(entry)) {
        for (const placement of frame) {
          if (!placement.filters) continue;
          filtered += placement.filters.length;
          kinds[placement.kind] = (kinds[placement.kind] ?? 0) + placement.filters.length;
        }
      }
    }
    assert.equal(filtered, 174, "recounted from the pack's own placements, not read off the invoice");
    assert.deepEqual(kinds, { text: 172, clip: 2 });
    assert.equal(kinds.shape ?? 0, 0);
    // And the invoice says so in a field, rather than leaving a reader to do
    // the count above by hand.
    const onUnsupported = everyEntry(result)
      .reduce((sum, entry) => sum + entry.effects.own.filtersOnUnsupportedPlacements, 0);
    assert.equal(onUnsupported, 172, "the text placements; the 2 on a `clip` placement are not unsupported");
  });

test("THE TWO BEVELS get their own line, because they are the only ones any pack here reaches",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    // ► `src/render/filters.js` records 54 bevels build-wide, and `HANDOFF.md`'s
    //   ranked item 4 records that that figure has no reachable denominator —
    //   no pack in this repository can reach any of them except these two. A row
    //   inside a `filtersByType` bag would never be summed by anybody.
    const result = oracleExtraction();
    const panel = result.clips.combat_panel;
    assert.deepEqual(panel.effects.bevels,
      { total: 2, inner: 2, onTop: 0, knockout: 0, zeroBlur: 2, own: 0, inherited: 2 });
    assert.equal(panel.effectGroups.length, 2, "two placements of sprite 52, at depths 1 and 7");
    for (const group of panel.effectGroups) {
      assert.equal(group.character, 52);
      assert.deepEqual(group.filters.map((filter) => filter.type), ["bevel"]);
      // ► **BOTH ARE INNER WITH ZERO BLUR**, so even a renderer that grew a
      //   bevel mapper would be drawing a hard one-pixel edge, not a soft one.
      //   The flags are the finding; the count is just how many carry them.
      assert.equal(group.filters[0].inner, true);
      assert.equal(group.filters[0].blurX, 0);
      assert.equal(group.filters[0].blurY, 0);
    }
    assert.deepEqual(panel.effects.use.filters.refusedByReason, { "bevel:filterHasNoCanvasEquivalent": 2 },
      "the verdict comes from src/render/filters.js and not from a table in the extractor");
    const packBevels = everyEntry(result).reduce((sum, entry) => sum + entry.effects.bevels.total, 0);
    assert.equal(packBevels, 2, "and no other entry has one");
  });

test("EVERY FILTER GETS EXACTLY ONE VERDICT, and the verdicts come from the renderer",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    // An invoice whose buckets do not add up to its total is an invoice that
    // has lost something between the counting and the printing.
    const result = oracleExtraction();
    const manifest = buildManifest(result, { file: "x.swf", sha256: ORACLE_SHA256 });
    const use = manifest.effects.use;
    assert.equal(use.total, manifest.effects.ownFilters + manifest.effects.inheritedFilters,
      "every carried filter is offered to canvasFilterFor exactly once");
    assert.equal(use.applied + use.deferred + use.noOp + use.refused, use.total,
      "and lands in exactly one bucket");
    // ► **THE SHAPE OF THE ANSWER, not just its arithmetic.** 172 glows the
    //   renderer draws as `drop-shadow` with the strength folded into the
    //   alpha; 2 greyscale colour matrices it will NOT approximate with a CSS
    //   `saturate()` (the build uses Flash's 0.3086/0.6094/0.0820, not CSS's
    //   Rec.709) and defers to `applyColourMatrix`; 2 bevels refused by name.
    assert.deepEqual(
      { applied: use.applied, deferred: use.deferred, noOp: use.noOp, refused: use.refused },
      { applied: 172, deferred: 2, noOp: 0, refused: 2 });
    // ► **`shadowStrengthSaturated`, NOT `shadowStrengthAsAlpha` — and the split
    //   is a finding, not a rename.** CSS `drop-shadow` has no strength, so
    //   `canvasFilterFor` folds it into the shadow colour's alpha; when that
    //   alpha clamps at 1 the strength contributes NOTHING and two different
    //   strengths draw byte-identically. **All 172 of this pack's glows are in
    //   that state**, so the pack carries 172 strength values the renderer
    //   cannot express at all — which the old single name could not say.
    assert.deepEqual(use.approximatedByKind, { shadowStrengthSaturated: 172 });
    assert.equal(use.approximated, use.applied,
      "on this mapper every applied filter is inexact; a divergence here means one stopped being counted");
    // ZERO blend modes on this roster — carried as a counted zero, and the
    // threading that would report one is exercised synthetically above.
    assert.equal(manifest.effects.ownBlendModePlacements + manifest.effects.inheritedBlendModes, 0);
    assert.deepEqual(manifest.effects.blendModes, { exact: {}, refused: {} });
  });

test("THE 38 CLEARED FILTER LISTS ARE REFUSED BY NAME, and no placement carries an empty one",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    // ► **`inventory_buttons` PLACES ITS BATTLEBUTTON UNDER A GREY-OUT ON TWO
    //   FRAMES AND EXPLICITLY CLEARS THE FILTER ON 38 OTHERS.** "Cleared" and
    //   "never set" are different facts about the same instance, and writing
    //   the first as `filters: []` would hand a renderer a list to apply.
    const result = oracleExtraction();
    assert.equal(result.clips.inventory_buttons.effects.notCarried.emptyFilterList, 38);
    const packEmpty = everyEntry(result)
      .reduce((sum, entry) => sum + (entry.effects.notCarried.emptyFilterList ?? 0), 0);
    assert.equal(packEmpty, 38, "all of them on the one strip");
    for (const entry of everyEntry(result)) {
      for (const frame of framesOf(entry)) {
        for (const placement of frame) {
          if (!Object.hasOwn(placement, "filters")) continue;
          assert.ok(Array.isArray(placement.filters) && placement.filters.length > 0,
            `${entry.character} wrote an empty filter list, which claims a list a renderer should apply`);
        }
      }
    }
    // And the two that ARE carried are the grey-out, on frames 10 and 11.
    const greyed = result.clips.inventory_buttons.frames
      .map((frame, index) => [index + 1, frame.find((placement) => placement.filters)])
      .filter(([, placement]) => placement);
    assert.deepEqual(greyed.map(([frame]) => frame), [10, 11]);
    for (const [, placement] of greyed) {
      assert.equal(placement.kind, "clip", "the battlebutton is a two-frame child, not scenery");
      assert.equal(placement.character, 58);
      assert.equal(placement.filters[0].type, "colourMatrix");
      assert.equal(Math.round(placement.filters[0].matrix[0] * 10000) / 10000, 0.3086,
        "Flash's greyscale coefficient, which is why canvasFilterFor refuses to call it saturate()");
    }
  });

test("EVERY inheritedEffects INDEX POINTS INTO ITS OWN ENTRY'S effectGroups",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    // ► An index into a table one entry away is a join a reader makes wrong
    //   once and never checks again. The tables are per entry on purpose, so
    //   the only thing that can break is the range — and an out-of-range index
    //   reads as `undefined` at the far end, which draws nothing and says
    //   nothing.
    const result = oracleExtraction();
    let pointed = 0;
    for (const entry of everyEntry(result)) {
      for (const frame of framesOf(entry)) {
        for (const placement of frame) {
          if (!placement.inheritedEffects) continue;
          pointed += 1;
          for (const index of placement.inheritedEffects) {
            assert.ok(Number.isInteger(index) && index >= 0 && index < entry.effectGroups.length,
              `character ${entry.character} points at group ${index} of ${entry.effectGroups.length}`);
          }
        }
      }
    }
    assert.equal(pointed, 2, "two shapes under the panel's two bevel groups — and a zero here would be vacuous");
    assert.equal(
      everyEntry(result).reduce((sum, entry) => sum + entry.effects.inherited.placements, 0), pointed,
      "the invoice's leaf count, recounted from the placements themselves");
  });

test("THE BOUNDARY THIS TOOL REFUSES TO CROSS IS A NUMBER, not a sentence",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    // ► **A multi-frame child is NOT descended into** — that is this whole
    //   tool's reason to exist — so no filter inside one is counted in its
    //   parent's invoice. Saying that in prose would leave a reader unable to
    //   tell "nothing is behind that boundary" from "nobody looked". The child
    //   is extracted as its own entry, so the number is a join away, and the
    //   join is done here rather than left to them.
    const result = oracleExtraction();
    const manifest = buildManifest(result, { file: "x.swf", sha256: ORACLE_SHA256 });
    assert.equal(manifest.effects.undescendedClipPlacements, 190);
    assert.deepEqual(manifest.effects.undescendedChildren, [58, 78, 116, 151, 161, 815]);
    assert.equal(manifest.effects.undescendedChildFilters, 2,
      "the strip's two colour matrices, sitting behind cast_spell_image's boundary");
    // ► **THE ONE THAT MUST NEVER BE SILENT.** A child nothing extracted is a
    //   whole subtree of effects counted nowhere at all.
    assert.equal(manifest.effects.undescendedChildrenNotExtracted, 0);
    for (const entry of everyEntry(result)) {
      assert.deepEqual(entry.effects.undescended.childrenNotExtracted, [],
        `character ${entry.character} points at a child that was never extracted`);
    }
    // And the join is real: the 2 are the strip's OWN, counted once in the pack
    // total and never added to it a second time.
    assert.equal(result.clips.cast_spell_image.effects.undescended.filtersInChildEntries, 2);
    assert.deepEqual(result.clips.cast_spell_image.effects.undescended.children, [116]);
    assert.equal(result.clips.inventory_buttons.effects.own.filters, 2, "the same two, where they are actually counted");
  });

test("THE MANIFEST'S EFFECT TOTALS ARE RECOMPUTED FROM THE PACK'S OWN ENTRIES",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    // ► **THE DEFECT THIS PATTERN EXISTS TO STOP.** The figure extractor's
    //   manifest once summed a per-entry field that 83% of its pack did not
    //   have and published zero against data holding two. So every number below
    //   is counted here, from `frames` and `effectGroups`, and compared with
    //   what `tallyIconEffects` published — two independent paths to one number.
    const result = oracleExtraction();
    const manifest = buildManifest(result, { file: "x.swf", sha256: ORACLE_SHA256 });
    let groups = 0;
    let ownFilters = 0;
    let ownPlacements = 0;
    let under = 0;
    let inheritedFilters = 0;
    for (const entry of everyEntry(result)) {
      groups += entry.effectGroups.length;
      for (const group of entry.effectGroups) inheritedFilters += (group.filters ?? []).length;
      for (const frame of framesOf(entry)) {
        for (const placement of frame) {
          if (placement.filters) { ownPlacements += 1; ownFilters += placement.filters.length; }
          if (placement.inheritedEffects) under += 1;
        }
      }
    }
    assert.deepEqual(
      {
        groups: manifest.effects.groups,
        ownFilters: manifest.effects.ownFilters,
        ownFilteredPlacements: manifest.effects.ownFilteredPlacements,
        placementsUnderAGroup: manifest.effects.placementsUnderAGroup,
        inheritedFilters: manifest.effects.inheritedFilters
      },
      { groups, ownFilters, ownFilteredPlacements: ownPlacements, placementsUnderAGroup: under, inheritedFilters });
    assert.equal(ownFilters, 174, "or the two paths agree on a number that is not the build's");
    assert.deepEqual(tallyIconEffects(result), manifest.effects, "the manifest publishes the tally, not a copy of it");

    // ► **A ROW PER ENTRY, INCLUDING THE NINE THAT ARE ALL ZEROES.** A manifest
    //   that invoices only the entries with something to say tells a reader who
    //   checks one row that everything is invoiced.
    const rows = [
      ...Object.values(manifest.faces), ...Object.values(manifest.icons), ...Object.values(manifest.nested)
    ];
    assert.equal(rows.length, everyEntry(result).length);
    assert.equal(rows.length, 15, "two faces, eight icon clips and five nested children");
    for (const row of rows) {
      assert.ok(row.effects, "every row carries an effects row");
      assert.equal(typeof row.effects.ownFilters, "number");
      assert.equal(typeof row.effects.bevels, "number");
      assert.ok(row.effects.use && typeof row.effects.use.total === "number");
    }
    assert.equal(rows.filter((row) => row.effects.ownFilters === 0).length, 8,
      "eight entries measure zero, and they are invoiced exactly as loudly as the seven that do not");
  });

/* ------------------------------------------------------------------ */
/* 10. THE GAUGES SECTION, against the real build                      */
/* ------------------------------------------------------------------ */

test("THE GAUGES SECTION, FROM THE BUILD: six gauges, two bevelled banners, two names — each by depth, name and matrix",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    const result = oracleExtraction();
    const gauges = result.gauges;
    assert.ok(gauges, "the section exists");
    assert.deepEqual(gauges.problems, []);
    assert.deepEqual(result.failures, [], "and nothing about it failed");
    // Measured with resolveTimeline on 751 frame 1 (see the section's declaration).
    assert.deepEqual(gauges.placements.map((row) => [row.depth, row.kind, row.side, row.character, row.instance ?? row.variable ?? null, row.matrix]), [
      [1, "banner", "villain", 52, null, [-1.99998, 0, 0, 1.99998, 7019, 1925]],
      [7, "banner", "hero", 52, null, [-1.99998, 0, 0, 1.99998, -1439, 1925]],
      [9, "gauge", "villain", 733, "villain_potion", [1, 0, 0, 1, 10700, 933]],
      [18, "name", "hero", 734, "herotext", [1, 0, 0, 1, -1199, 1704]],
      [19, "gauge", "hero", 733, "hero_potion", [1, 0, 0, 1, 2035, 933]],
      [28, "name", "villain", 735, "villaintext", [1, 0, 0, 1, 5652, 1704]],
      [29, "gauge", "villain", 742, "villain_stamina_potion", [1, 0, 0, 1, 12054, 933]],
      [38, "gauge", "hero", 742, "hero_stamina_potion", [1, 0, 0, 1, 704, 933]],
      [47, "gauge", "hero", 749, "hero_armour", [1, 0, 0, 1, 3410, 934]],
      [55, "gauge", "villain", 749, "villain_armour", [1, 0, 0, 1, 9478, 923]]
    ]);
    for (const banner of gauges.placements.filter((row) => row.kind === "banner")) {
      assert.deepEqual(banner.filters.map((filter) => [filter.type, filter.inner, filter.blurX, filter.distance]), [["bevel", true, 0, -6]]);
    }
    for (const name of gauges.placements.filter((row) => row.kind === "name")) {
      assert.deepEqual(name.filters.map((filter) => [filter.type, filter.strength]), [["glow", 10]]);
      assert.equal(name.align, name.side === "hero" ? "left" : "right");
    }
    // ► RE-PINNED FOR D8 (2026-09-25): ~~[[3, 723, "crowd_bar_bg"], [5, 725, "crowd_bar"], [63, 750, null]]~~ —
    //   the crowd bar was 751's only placements this section did not take, named here so it was "said to be
    //   there rather than silently absent". The crowd section takes them now (`CROWD_BAR`), and the test
    //   "THE CROWD'S DRIVE, FROM THE BYTES" holds every one of 751's placements to exactly one section.
    assert.deepEqual(gauges.notTaken.map((row) => [row.depth, row.character, row.name]), []);
  });

test("EACH GAUGE SPRITE KEEPS ITS LIQUID WHOLE: one blood_health, at its REST matrix, under its own cutter, the liquid its own entry",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    const gauges = oracleExtraction().gauges;
    assert.deepEqual(Object.keys(gauges.clips).map(Number).sort((left, right) => left - right), [52, 733, 742, 749]);
    assert.deepEqual(Object.keys(gauges.nested).map(Number).sort((left, right) => left - right), [729, 738, 745]);
    assert.deepEqual(gauges.sharedWithRoster, [], "the section's children are its own: none is also a roster child");
    for (const [sprite, liquid, rest, cutter, shape] of [[733, 729, [-484, -531], 727, 728], [742, 738, [-484, -531], 736, 737], [749, 745, [-494, -561], 743, 744]]) {
      const placements = gauges.clips[sprite].frames[0];
      const kept = placements.filter((placement) => placement.kind === "clip");
      assert.equal(kept.length, 1, `${sprite}: one clip`);
      assert.deepEqual([kept[0].character, kept[0].name, kept[0].frameCount, kept[0].matrix], [liquid, "blood_health", 1, [1, 0, 0, 1, ...rest]]);
      assert.deepEqual(kept[0].mask, { shape: cutter, matrix: [1, 0, 0, 1, 0, 0] }, `${sprite}: the cutter at the gauge's own origin`);
      assert.equal(placements.some((placement) => placement.character === shape), false, `${sprite}: the liquid is NOT also flattened in`);
      assert.deepEqual(gauges.nested[liquid].frames[0].map((placement) => [placement.kind, placement.character, placement.matrix]),
        [["shape", shape, [1, 0, 0, 1, 0, 0]]]);
      assert.deepEqual(gauges.nested[liquid].instances, ["blood_health"]);
      assert.equal(gauges.clips[sprite].declaredFrames, 1);
      assert.deepEqual(gauges.clips[sprite].timeline.stops, [1], "733/742/749 each stop() on frame 1");
    }
    assert.deepEqual(gauges.clips[52].frames[0].map((placement) => [placement.kind, placement.character, placement.matrix]),
      [["shape", 51, [1, 0, 0, 1, 0, 0]]]);
    // Every placement points at geometry or a text that was read.
    const result = oracleExtraction();
    for (const entry of [...Object.values(gauges.clips), ...Object.values(gauges.nested)]) {
      for (const placement of entry.frames.flat()) {
        if (placement.kind === "shape") assert.ok(result.shapes[placement.character]?.paths.length > 0, `shape ${placement.character}`);
        else if (placement.kind === "text") assert.ok(result.texts[placement.character], `text ${placement.character}`);
        else assert.ok(gauges.nested[placement.character], `clip ${placement.character}`);
        if (placement.mask) assert.ok(result.shapes[placement.mask.shape], `cutter ${placement.mask.shape}`);
      }
    }
    // The section's own invoice: the six glows on the gauges' own numbers and labels, no bevel inside
    // any entry (the two are on 751's placements of 52, below), three boundaries, all extracted.
    assert.equal(gauges.effects.ownFilters, 6);
    assert.equal(gauges.effects.bevels.total, 0);
    assert.equal(gauges.effects.undescendedClipPlacements, 3);
    assert.deepEqual(gauges.effects.undescendedChildren, [729, 738, 745]);
    assert.equal(gauges.effects.undescendedChildrenNotExtracted, 0);
    assert.equal(gauges.clipsAcrossSpriteBoundary, 0, "each cutter is on the clip's own level");
    assert.deepEqual(gauges.placementEffects, {
      filters: 4, byType: { bevel: 2, glow: 2 },
      use: gauges.placementEffects.use
    });
    assert.deepEqual(gauges.placementEffects.use.refusedByReason, { "bevel:filterHasNoCanvasEquivalent": 2 },
      "the two banner bevels, refused by the renderer's own reader");
  });

test("THE ATTACH AND THE DRIVE, FROM THE BYTES: panel (0,0) lands on stage (-0.05, 288.75), and all six gauges agree on one drive",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    const gauges = oracleExtraction().gauges;
    const { attach } = gauges;
    assert.deepEqual({ ...attach, parentPlacement: undefined, origin: undefined }, {
      timeline: "sprite:2249/frame:1", character: 2249, frame: 1, block: "0x6e4221", within: null, at: "+0x0c28",
      target: "_root.arena", parent: "arena", linkage: "combat_panel", name: "combat_panel", depth: 200000,
      init: { _x: -320, _y: 122 }, parentPlacement: undefined, origin: undefined
    });
    assert.deepEqual(attach.parentPlacement, { depth: 59, name: "arena", matrix: [1, 0, 0, 1, 6399, 3335], frames: [221, 226] });
    assert.deepEqual(attach.origin, { x: -0.05, y: 288.75 });
    assert.deepEqual(gauges.drive, { base: -30, full: 101, step: 0.7, percentScale: 100, rounding: "round", separator: " / " });
    assert.deepEqual(gauges.disagreements, []);
    const read = Object.fromEntries(gauges.placements.filter((row) => row.kind === "gauge").map((row) => [row.instance, row.drive]));
    assert.deepEqual(read.hero_potion.block, "0x2264d1");
    assert.deepEqual([read.hero_potion.text.at, read.hero_potion.percent.at, read.hero_potion.liquid.at], ["+0x00a2", "+0x00f6", "+0x013b"]);
    assert.equal(read.hero_stamina_potion.text.variable, "hitpoints", "the energy number is bound to `hitpoints` too");
    assert.deepEqual([read.hero_stamina_potion.value, read.hero_stamina_potion.max], ["staminaleft", "staminamax"]);
    for (const instance of ["hero_armour", "villain_armour"]) {
      assert.deepEqual([read[instance].visible.field, read[instance].visible.comparison, read[instance].visible.than,
        read[instance].visible.whenTrue, read[instance].visible.whenFalse], ["armourclass", ">", 0, true, false]);
    }
    for (const instance of ["hero_potion", "villain_potion", "hero_stamina_potion", "villain_stamina_potion"]) {
      assert.equal(read[instance].visible, null, `${instance} is never hidden`);
    }
    // The number each handler writes is the variable its OWN sprite's field is bound to — or the field would never show it.
    const bound = Object.fromEntries(gauges.placements.filter((row) => row.kind === "gauge").map((row) => [row.instance, row.field]));
    assert.deepEqual(bound, {
      villain_potion: { character: 731, variable: "hitpoints" }, hero_potion: { character: 731, variable: "hitpoints" },
      villain_stamina_potion: { character: 740, variable: "hitpoints" }, hero_stamina_potion: { character: 740, variable: "hitpoints" },
      hero_armour: { character: 747, variable: "armourpoints" }, villain_armour: { character: 747, variable: "armourpoints" }
    });
    // THE RENDERER'S HAND-CITED COPY AGREES — two independent paths to one answer.
    assert.deepEqual({ ...SS2_GAUGE_DRIVE }, gauges.drive);
    near2(SS2_COMBAT_PANEL.origin, attach.origin);
    for (const [side, def] of Object.entries(SS2_COMBAT_PANEL.clusters)) {
      const rows = gauges.placements.filter((row) => row.side === side);
      assert.deepEqual([...def.banner.matrix], rows.find((row) => row.kind === "banner").matrix, `${side} banner`);
      assert.equal(def.banner.depth, rows.find((row) => row.kind === "banner").depth);
      const name = rows.find((row) => row.kind === "name");
      assert.deepEqual([def.name.depth, def.name.character, def.name.variable, def.name.align, [...def.name.matrix]],
        [name.depth, name.character, name.variable, name.align, name.matrix], `${side} name`);
      for (const [reading, gauge] of Object.entries(def.gauges)) {
        const row = rows.find((candidate) => candidate.reading === reading);
        assert.deepEqual([gauge.depth, gauge.character, gauge.instance, [...gauge.matrix]], [row.depth, row.character, row.instance, row.matrix], `${side} ${reading}`);
      }
    }
  });

test("THE PANEL'S PROVENANCE, FROM THE BYTES: the attach and the two name writes, each where the build has it (verify:gauges-r2)",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    const gauges = oracleExtraction().gauges;
    assert.deepEqual(gauges.problems, []);
    // Read by hand off `node tools/inspect-swf.mjs <swf> --references combat_panel`: the attach
    // statement runs +0x0bf2..+0x0c28 in sprite 2249 frame 1's body 0x6e4221, and the two name
    // SetMembers are at +0x0c4a and +0x0c6b (the verifier's dump agrees).
    assert.deepEqual(gauges.panel, {
      character: 751, linkage: "combat_panel",
      attachedBy: "sprite 2249 frame 1 body 0x6e4221 +0x0bf2..+0x0c28: " +
        "_root.arena.attachMovie(\"combat_panel\", \"combat_panel\", 200000, {_x: -320, _y: 122})",
      namesSetBy: "sprite 2249 frame 1 body 0x6e4221 +0x0c4a / +0x0c6b: combat_panel.herotext|villaintext = _root.game.hero|villain.character_name"
    });
    // And the line is the derived attach's, figure for figure.
    const { attach } = gauges;
    for (const figure of [attach.block, attach.at, attach.target, String(attach.depth), `_x: ${attach.init._x}`, `_y: ${attach.init._y}`]) {
      assert.ok(gauges.panel.attachedBy.includes(figure), `${figure} is in ${gauges.panel.attachedBy}`);
    }
  });

test("A ONE-BYTE CHANGE TO THE ATTACH MOVES THE PROVENANCE AND IS A PROBLEM BY NAME — in an in-memory copy of the build (verify:gauges-r2)",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    const original = fs.readFileSync(ORACLE);
    // The attach statement's own operands, found by their bytes (a Push integer is type 7 then an
    // int32 LE) inside the statement the extraction reports — never an offset typed here.
    const { attach } = oracleExtraction().gauges;
    const body = Number(attach.block);
    const [from, call] = oracleExtraction().gauges.panel.attachedBy.match(/\+0x[0-9a-f]+/g).map((offset) => body + Number(offset.slice(1)));
    const operandOf = (value) => {
      const found = [];
      for (let index = from; index < call; index += 1) {
        if (original[index] === 7 && original.readInt32LE(index + 1) === value) found.push(index + 1);
      }
      assert.equal(found.length, 1, `one int32 ${value} in the attach statement`);
      return found[0];
    };
    for (const [value, changed, figure] of [[-320, -321, /\{_x: -321, _y: 122\}/], [200000, 200001, /, 200001, \{/]]) {
      const copy = Buffer.from(original);
      copy.writeInt32LE(changed, operandOf(value));
      const gauges = extractIcons(copy).gauges;
      assert.match(gauges.panel.attachedBy, figure, `${value} -> ${changed}: the line says what the bytes say`);
      assert.ok(gauges.problems.some((problem) => /attachedBy/.test(problem)),
        `${value} -> ${changed}: a problem names the line: ${JSON.stringify(gauges.problems)}`);
    }
    // The villain's name write, renamed by one byte in the block's own constant pool
    // ("villaintext" -> "villaintexu", found by its bytes between the body's start
    // and the write): the build no longer writes villaintext, and the section says so.
    const needle = Buffer.from("villaintext\0", "latin1");
    const [, villainWrite] = oracleExtraction().gauges.panel.namesSetBy.match(/\+0x[0-9a-f]+/g).map((offset) => body + Number(offset.slice(1)));
    const pooled = [];
    for (let index = body; index < villainWrite; index += 1) if (original.subarray(index, index + needle.length).equals(needle)) pooled.push(index);
    assert.equal(pooled.length, 1, "one villaintext in the body's pool");
    const renamed = Buffer.from(original);
    renamed[pooled[0] + needle.length - 2] = "u".charCodeAt(0);
    const unnamed = extractIcons(renamed).gauges;
    assert.equal(unnamed.panel.namesSetBy, null, "no line the bytes do not carry");
    assert.ok(unnamed.problems.some((problem) => /0 writes of combat_panel\.villaintext/.test(problem)), JSON.stringify(unnamed.problems));
    // CODEX REVIEW (fix round, pass 1), its own reproduction: the Pop right after the attach's
    // CallMethod (a one-byte action, so at the call + 1) made a Return — the frame returns before
    // either name is written, and the section must say so rather than print the same line.
    assert.deepEqual([original[call], original[call + 1]], [0x52, 0x17], "CallMethod, then Pop");
    const returning = Buffer.from(original);
    returning[call + 1] = 0x3e;
    const cut = extractIcons(returning).gauges;
    assert.equal(cut.panel.namesSetBy, null, "names the frame never reaches are not the panel's names");
    assert.ok(cut.problems.some((problem) => /not reached in a straight line.*Return/.test(problem)), JSON.stringify(cut.problems));
    // CODEX REVIEW (fix round, pass 2), its own reproduction: the statement just before the attach
    // ends in a SetMember (the byte before the attach statement's first); made a Return, the frame
    // returns before the panel is attached at all.
    assert.equal(original[from - 1], 0x4f, "a SetMember ends the statement before the attach");
    const unattached = Buffer.from(original);
    unattached[from - 1] = 0x3e;
    const gone = extractIcons(unattached).gauges;
    assert.ok(gone.problems.some((problem) => /attach .* does not run on every path.*Return/.test(problem)), JSON.stringify(gone.problems));
    assert.equal(original.equals(fs.readFileSync(ORACLE)), true, "the build itself is untouched");
  });

test("THE MANIFEST CARRIES THE GAUGES AS THEIR OWN BLOCK, and the roster's totals do not count them",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    const result = oracleExtraction();
    const manifest = buildManifest(result, { file: "x.swf", sha256: ORACLE_SHA256 });
    assert.equal(manifest.gauges.attach.origin.y, 288.75);
    assert.deepEqual(manifest.gauges.drive, result.gauges.drive);
    assert.deepEqual(Object.keys(manifest.gauges.clips).map(Number).sort((left, right) => left - right), [52, 733, 742, 749]);
    assert.equal(manifest.gauges.effects.ownFilters, 6);
    assert.equal(manifest.gauges.placements.length, 10);
    assert.equal(manifest.effects.ownFilters + manifest.effects.inheritedFilters, 176, "the roster's own, unmoved");
    assert.equal(manifest.effects.undescendedClipPlacements, 190);
  });

/* ------------------------------------------------------------------ */
/* 11. THE CROWD SECTION, against the real build (D8, 2026-09-25)       */
/* ------------------------------------------------------------------ */

test("THE CROWD SECTION, FROM THE BUILD: the bar, its background and its label by depth, name and matrix, their sprites whole, and the panel's own place",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    const result = oracleExtraction();
    const crowd = result.crowd;
    assert.deepEqual(crowd.problems, []);
    assert.deepEqual(result.failures, [], "and nothing about it failed");
    // Measured with resolveTimeline on 751 frame 1 (read-only, 2026-09-25): depths 3, 5 and 63.
    assert.deepEqual(crowd.placements.map((row) => [row.depth, row.kind, row.character, row.instance ?? row.variable, row.matrix]), [
      [3, "background", 723, "crowd_bar_bg", [1, 0, 0, 1, 9661, -5144]],
      [5, "bar", 725, "crowd_bar", [1, 0, 0, 1, 9657, -5132]],
      [63, "label", 750, "crowd_text", [1, 0, 0, 1, 9669, -5175]]
    ]);
    const label = crowd.placements.find((row) => row.kind === "label");
    assert.equal(label.align, "center");
    assert.deepEqual(label.filters.map((filter) => [filter.type, filter.blurX, filter.strength, filter.colour]),
      [["glow", 2, 10, { red: 0, green: 0, blue: 0, alpha: 255 }]], "the label's black glow");
    // Each sprite is ONE frame holding its one shape at identity: the bar's registration point is its own
    // left edge (shape 724 starts at x 0), which is what `_xscale` scales about.
    assert.deepEqual(Object.keys(crowd.clips).map(Number), [723, 725]);
    for (const [sprite, shape] of [[723, 722], [725, 724]]) {
      assert.equal(crowd.clips[sprite].declaredFrames, 1);
      assert.deepEqual(crowd.clips[sprite].frames[0].map((placement) => [placement.kind, placement.character, placement.matrix]),
        [["shape", shape, [1, 0, 0, 1, 0, 0]]]);
      assert.ok(result.shapes[shape]?.paths.length > 0, `shape ${shape} is in the one shape table`);
    }
    assert.equal(result.shapes[724].bounds.xMin, 0, "the bar's left edge is its registration point");
    assert.ok(result.texts[750], "the label's field was read");
    assert.deepEqual(crowd.origin, { x: -0.05, y: 288.75 }, "the panel's own place — the gauges section's derived attach");
    assert.deepEqual(crowd.origin, result.gauges.attach.origin);
    // Its own invoice: the label's one glow on the panel's placement, nothing inside the two sprites.
    assert.deepEqual({ ...crowd.placementEffects, use: undefined }, { filters: 1, byType: { glow: 1 }, use: undefined });
    assert.equal(crowd.effects.ownFilters, 0);
    assert.equal(crowd.clipsAcrossSpriteBoundary, 0);
  });

test("THE CROWD'S DRIVE, FROM THE BYTES: crowd_bar's own two handlers, the build's constants, every sound named — and the gauges leave 751 to it",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    const result = oracleExtraction();
    const crowd = result.crowd;
    assert.deepEqual(crowd.drive, { ...CROWD_BAR.expectedDrive, shownWhile: { ...CROWD_BAR.expectedDrive.shownWhile },
      hides: [...CROWD_BAR.expectedDrive.hides], scale: { ...CROWD_BAR.expectedDrive.scale }, label: { ...CROWD_BAR.expectedDrive.label },
      moods: [...CROWD_BAR.expectedDrive.moods] });
    // Read by hand off the oracle's dump (`crowd_bar` clip-action 0 body 0x225e5d, clip-action 1 body 0x226086).
    assert.deepEqual(crowd.handlers, {
      load: { block: "0x225e5d", eventFlags: 1, opening: "+0x0158", test: "+0x017b", moods: "+0x01ea", hides: ["+0x01fd", "+0x020b", "+0x021f"] },
      enterFrame: { block: "0x226086", eventFlags: 2, guard: "+0x00f2", label: "+0x0232", scale: "+0x0258" }
    });
    assert.deepEqual(crowd.notDrawn.map((row) => `${row.handler} ${row.at} ${row.what}`), [
      "load +0x01a5 a call to start", "load +0x01c6 a call to setVolume",
      "enterFrame +0x013d a call to setVolume", "enterFrame +0x0154 a branch", "enterFrame +0x016a a write to the variable rockyouchance",
      "enterFrame +0x017b a branch", "enterFrame +0x019b a call to start", "enterFrame +0x01b2 a branch",
      "enterFrame +0x01c8 a write to the variable crowd_boo_chance", "enterFrame +0x01d9 a branch", "enterFrame +0x01f9 a call to start"
    ], "the ambience, its volume and the cheer and boo gates: sounds, each named");
    // EVERY placement on 751's frame 1 is taken by exactly one section, and the gauges' `notTaken` is empty.
    // ~~[[3, 723, "crowd_bar_bg"], [5, 725, "crowd_bar"], [63, 750, null]]~~ was the gauges' notTaken until
    // this section took them (D8, 2026-09-25).
    assert.deepEqual(result.gauges.notTaken, []);
    const buffer = fs.readFileSync(ORACLE);
    const { characters } = indexCharacters(buffer);
    const depths = resolveTimeline(buffer, characters.get(751), { frames: [1] }).frames[0].map((entry) => entry.depth).sort((a, b) => a - b);
    const taken = [...result.gauges.placements, ...crowd.placements].map((row) => row.depth).sort((a, b) => a - b);
    assert.deepEqual(taken, depths, "each of 751's placements, once");
    // The roster's measured totals do not move.
    const manifest = buildManifest(result, { file: "x.swf", sha256: ORACLE_SHA256 });
    assert.equal(manifest.effects.ownFilters + manifest.effects.inheritedFilters, 176);
    assert.equal(manifest.effects.undescendedClipPlacements, 190);
    assert.deepEqual(manifest.crowd.drive, crowd.drive, "and the manifest carries the crowd as its own block");
    assert.deepEqual(manifest.crowd.placements, [[3, "background", 723, "crowd_bar_bg", null], [5, "bar", 725, "crowd_bar", null],
      [63, "label", 750, "crowd_text", "glow"]]);
    // THE RENDERER'S HAND-CITED COPY AGREES — two independent paths to one answer.
    for (const key of Object.keys(SS2_CROWD_BAR_DRIVE)) assert.deepEqual(crowd.drive[key], JSON.parse(JSON.stringify(SS2_CROWD_BAR_DRIVE[key])), key);
    assert.deepEqual(crowd.drive.moods, [...SS2_CROWD_MOODS]);
    near2(SS2_CROWD_BAR.origin, crowd.origin);
    for (const part of [SS2_CROWD_BAR.background, SS2_CROWD_BAR.bar, SS2_CROWD_BAR.label]) {
      const row = crowd.placements.find((one) => one.kind === part.kind);
      assert.deepEqual([row.depth, row.character, [...row.matrix]], [part.depth, part.character, [...part.matrix]], part.kind);
    }
  });

test("A ONE-BYTE CHANGE TO THE CROWD'S HANDLERS MOVES ITS DRIVE AND IS A PROBLEM BY NAME — in an in-memory copy of the build",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    const original = fs.readFileSync(ORACLE);
    const { handlers } = oracleExtraction().crowd;
    const frameBody = Number(handlers.enterFrame.block);
    const loadBody = Number(handlers.load.block);
    const offset = (body, relativeOffset) => body + Number.parseInt(relativeOffset.slice(1), 16);
    /** Where an int32 Push operand (type 7, then the value) sits in [from, to), found by its bytes, exactly once. */
    const integerAt = (from, to, value) => {
      const found = [];
      for (let index = from; index < to; index += 1) if (original[index] === 7 && original.readInt32LE(index + 1) === value) found.push(index + 1);
      assert.equal(found.length, 1, `one int32 ${value} in 0x${from.toString(16)}..0x${to.toString(16)}`);
      return found[0];
    };
    const stringAt = (from, to, text) => {
      const needle = Buffer.from(`${text}\0`, "latin1");
      const found = [];
      for (let index = from; index < to; index += 1) if (original.subarray(index, index + needle.length).equals(needle)) found.push(index);
      assert.equal(found.length, 1, `one "${text}" in 0x${from.toString(16)}..0x${to.toString(16)}`);
      return found[0];
    };
    const mutant = (edit) => { const copy = Buffer.from(original); edit(copy); return extractIcons(copy).crowd; };
    // The label's divisor, 10 -> 11: the label reads what the bytes say, and the section names the key.
    const divided = mutant((copy) => copy.writeInt32LE(11, integerAt(offset(frameBody, handlers.enterFrame.guard), offset(frameBody, handlers.enterFrame.label), 10)));
    assert.equal(divided.drive.label.divisor, 11);
    assert.ok(divided.problems.some((problem) => /the crowd's label is .*"divisor":11.*, expected .*"divisor":10/.test(problem)), JSON.stringify(divided.problems));
    // The top mood's spelling, in the load's constant pool.
    const renamed = mutant((copy) => { copy[stringAt(loadBody, offset(loadBody, handlers.load.moods), "Fanatical") + 8] = "m".charCodeAt(0); });
    assert.equal(renamed.drive.moods[10], "Fanaticam");
    assert.ok(renamed.problems.some((problem) => /the crowd's moods is/.test(problem)), JSON.stringify(renamed.problems));
    // The property the bar scales, `_xscale` -> `_yscale`, in the enterFrame's pool.
    const turned = mutant((copy) => { copy[stringAt(frameBody, offset(frameBody, handlers.enterFrame.guard), "_xscale") + 1] = "y".charCodeAt(0); });
    assert.equal(turned.drive.scale.property, "_yscale");
    assert.ok(turned.problems.some((problem) => /the crowd's scale is/.test(problem)), JSON.stringify(turned.problems));
    // The enterFrame guard's level, 1 -> 2: no longer the test the load hides by.
    const guarded = mutant((copy) => copy.writeInt32LE(2, integerAt(frameBody, offset(frameBody, handlers.enterFrame.guard), 1)));
    assert.ok(guarded.problems.some((problem) => /the enterFrame guard tests hero\.herolevel > 2/.test(problem)), JSON.stringify(guarded.problems));
    assert.equal(original.equals(fs.readFileSync(ORACLE)), true, "the build itself is untouched");
  });
