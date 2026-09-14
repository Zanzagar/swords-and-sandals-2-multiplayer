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
  ExtractIconsError,
  FACE_CLIPS,
  ICON_CLIPS,
  NESTED_MEANINGS,
  ORACLE_SHA256,
  bindExpressions,
  buildManifest,
  deriveClipEvents,
  deriveExpressionCalls,
  deriveTimelineActions,
  extractIcons,
  flattenIconFrame,
  parseArguments,
  parseEditText,
  parseStaticText,
  readRect,
  roundColour,
  roundMatrix
} from "../tools/extract-icons.mjs";
import { IDENTITY_MATRIX } from "../tools/swf-display-list.mjs";

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
  // Frames 2 and 4 of `damage_splat` are never asked for by name. They are
  // still extracted; what is refused is inventing a meaning for them.
  assert.deepEqual(NESTED_MEANINGS[815].frames, { 1: "normal", 3: "critical", 5: "grievous" });
  assert.equal(NESTED_MEANINGS[815].parent, 817);
  assert.equal(NESTED_MEANINGS[151].frames, null,
    "eight frames whose selector was not found is a GAP, not an order to guess at");
  assert.equal(NESTED_MEANINGS[161].frames, null);
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
