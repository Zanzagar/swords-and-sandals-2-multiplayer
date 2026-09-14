/**
 * THE RASTER DECODERS, and the reason they exist.
 *
 * ► **THE ARENA'S WALLS WERE JPEGs AND THE RENDERER DREW NOTHING.**
 *   `shapeToPaths` reported `approximated: "bitmap"` with `fill: "none"`, the
 *   note was dropped at the next seam, and the extractor's report said ZERO
 *   failures while the entire stand was missing. The owner asked *"where are
 *   the backgrounds that are actually in game? Did you make these?"* — which is
 *   the only question that finds a defect shaped like this one.
 *
 * ► **SO THE LOAD-BEARING TEST IN THIS FILE IS NOT A DECODER TEST.** It is
 *   "every bitmap is either decoded or COUNTED as a failure", because the
 *   defect was never a wrong pixel — it was a missing thing that nothing
 *   counted. Decoding correctly and reporting honestly are two different
 *   properties and only the second one was absent.
 *
 * These run against SYNTHETIC buffers wherever they can, so a clone with no
 * licensed copy still executes them. The two that need the real build skip
 * themselves by name.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import zlib from "node:zlib";

import {
  ExtractBitmapsError,
  encodePng,
  extractBitmaps,
  jpegSize,
  losslessToRgba,
  parseArguments,
  stripJpegPrefix
} from "../tools/extract-bitmaps.mjs";

/* ---------------------------------------------------------------- */
/* The JPEG quirks                                                   */
/* ---------------------------------------------------------------- */

test("the bogus EOI/SOI pair SWF puts in front of a JPEG is stripped", () => {
  // ► A SWF JPEG often opens `FFD9 FFD8` — end-of-image then start-of-image —
  //   which every player drops and every decoder refuses. Stripping it here
  //   rather than in the browser is what makes the file on disk openable by
  //   anything, which is how these were checked by eye in the first place.
  const real = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const prefixed = Buffer.concat([Buffer.from([0xff, 0xd9, 0xff, 0xd8]), real]);
  assert.deepEqual([...stripJpegPrefix(prefixed)], [...real]);
  // And a clean JPEG is untouched — the pair only counts at the very front.
  assert.deepEqual([...stripJpegPrefix(real)], [...real]);
  const innocent = Buffer.from([0xff, 0xd8, 0xff, 0xd9, 0xff, 0xd8]);
  assert.deepEqual([...stripJpegPrefix(innocent)], [...innocent],
    "a JPEG that merely CONTAINS the pair is not a JPEG with the pair in front");
});

test("a JPEG's size comes from its SOF marker, and width/height are not swapped", () => {
  // ► **THE SPEC PUTS HEIGHT BEFORE WIDTH** and a reader that fills them in
  //   reading order transposes every image — which still looks like a picture
  //   and is the worst kind of wrong. 595x327 is the real crowd bitmap 2101.
  const sof = Buffer.alloc(20);
  sof[0] = 0xff; sof[1] = 0xd8;          // SOI
  sof[2] = 0xff; sof[3] = 0xc0;          // SOF0
  sof.writeUInt16BE(11, 4);              // segment length
  sof[6] = 8;                            // precision
  sof.writeUInt16BE(327, 7);             // HEIGHT first
  sof.writeUInt16BE(595, 9);             // then width
  assert.deepEqual(jpegSize(sof), { width: 595, height: 327 });
});

test("a buffer with no SOF reports zero rather than guessing", () => {
  assert.deepEqual(jpegSize(Buffer.from([0xff, 0xd8, 0x00, 0x00])), { width: 0, height: 0 });
  assert.deepEqual(jpegSize(Buffer.alloc(0)), { width: 0, height: 0 });
});

test("the size scan steps over DHT, which carries no dimensions", () => {
  // 0xC4 sits inside the SOFn range and is NOT a start-of-frame. A scanner that
  // takes the range at face value reads a Huffman table as an image size.
  const bytes = Buffer.alloc(48);
  bytes[0] = 0xff; bytes[1] = 0xd8;
  bytes[2] = 0xff; bytes[3] = 0xc4;      // DHT — must be skipped
  bytes.writeUInt16BE(8, 4);             // its length: cursor moves 2 + 8 -> 12
  bytes[12] = 0xff; bytes[13] = 0xc2;    // progressive SOF2 — the real one
  bytes.writeUInt16BE(11, 14);
  bytes[16] = 8;
  bytes.writeUInt16BE(120, 17);          // HEIGHT
  bytes.writeUInt16BE(160, 19);          // then width
  assert.deepEqual(jpegSize(bytes), { width: 160, height: 120 });
});

/* ---------------------------------------------------------------- */
/* The PNG encoder                                                   */
/* ---------------------------------------------------------------- */

test("the PNG encoder emits a file a decoder would accept", () => {
  // Written here because `package.json` declares no dependencies and every tool
  // in `tools/` keeps that promise. It only has to be the spec's simplest legal
  // file, so this checks that it IS that rather than that it is clever.
  const png = encodePng(2, 2, 0, Buffer.from([0, 64, 128, 255]));
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    "the 8-byte signature");
  assert.equal(png.toString("latin1", 12, 16), "IHDR");
  assert.equal(png.readUInt32BE(16), 2, "width");
  assert.equal(png.readUInt32BE(20), 2, "height");
  assert.equal(png[24], 8, "bit depth");
  assert.equal(png[25], 0, "colour type greyscale");
  assert.equal(png.toString("latin1", png.length - 8, png.length - 4), "IEND");

  // And the pixels survive the round trip, filter bytes and all.
  const start = png.indexOf(Buffer.from("IDAT", "latin1")) + 4;
  const length = png.readUInt32BE(start - 8);
  const raw = zlib.inflateSync(png.subarray(start, start + length));
  assert.deepEqual([...raw], [0, 0, 64, 0, 128, 255], "one zero filter byte per row");
});

test("an RGBA png carries four channels a row, with the same filter convention", () => {
  const pixels = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
  const png = encodePng(2, 1, 6, pixels);
  assert.equal(png[25], 6, "colour type RGBA");
  const start = png.indexOf(Buffer.from("IDAT", "latin1")) + 4;
  const raw = zlib.inflateSync(png.subarray(start, start + png.readUInt32BE(start - 8)));
  assert.deepEqual([...raw], [0, 1, 2, 3, 4, 5, 6, 7, 8]);
});

/* ---------------------------------------------------------------- */
/* DefineBitsLossless                                                */
/* ---------------------------------------------------------------- */

const lossless = (format, width, height, tail, tableSize = null) => {
  const head = [0, 0, format, width & 0xff, width >> 8, height & 0xff, height >> 8];
  if (tableSize !== null) head.push(tableSize);
  return Buffer.concat([Buffer.from(head), zlib.deflateSync(Buffer.from(tail))]);
};

test("FORMAT 5 IS ARGB, NOT RGBA — the swap still looks like a picture", () => {
  // ► This is the trap the module's own docstring names, and it is worth a test
  //   rather than a comment: a red/blue swap produces a perfectly plausible
  //   image, so nothing downstream would ever flag it.
  const body = lossless(5, 1, 1, [0xff, 0x11, 0x22, 0x33]); // A R G B
  const { width, height, pixels } = losslessToRgba(body, false);
  assert.deepEqual({ width, height }, { width: 1, height: 1 });
  assert.deepEqual([...pixels], [0x11, 0x22, 0x33, 255], "R G B then an opaque alpha");
});

test("FORMAT 5 WITH ALPHA IS PREMULTIPLIED, and un-multiplying it is not optional", () => {
  // Half-alpha white is stored as (128, 128, 128, 128). Left premultiplied it
  // decodes to mid-grey, so every semi-transparent pixel comes out too dark.
  const body = lossless(5, 1, 1, [128, 128, 128, 128]);
  const { pixels } = losslessToRgba(body, true);
  assert.deepEqual([...pixels], [255, 255, 255, 128], "white at half alpha, not grey");
});

test("a PALETTED image resolves through its table, and rows are padded to four bytes", () => {
  // Format 3: a colour table then one index per pixel, each ROW padded out to a
  // 4-byte boundary. A reader that ignores the padding shears the image.
  const palette = [0xff, 0x00, 0x00, 0x00, 0xff, 0x00]; // red, green
  const rows = [0, 1, 0, 0, /* pad */ 1, 0, 0, 0];      // 3px wide -> stride 4
  const body = lossless(3, 3, 2, [...palette, ...rows], 1); // tableSize byte 1 -> 2 entries
  const { width, height, pixels } = losslessToRgba(body, false);
  assert.deepEqual({ width, height }, { width: 3, height: 2 });
  assert.deepEqual([...pixels.subarray(0, 4)], [0xff, 0, 0, 255], "row 0 px 0 is red");
  assert.deepEqual([...pixels.subarray(4, 8)], [0, 0xff, 0, 255], "row 0 px 1 is green");
  assert.deepEqual([...pixels.subarray(12, 16)], [0, 0xff, 0, 255],
    "row 1 px 0 is green — which only holds if the row padding was honoured");
});

test("an unknown lossless format is REFUSED BY NAME, not decoded into noise", () => {
  assert.throws(() => losslessToRgba(lossless(9, 1, 1, [0, 0, 0, 0]), false), ExtractBitmapsError);
});

/* ---------------------------------------------------------------- */
/* The contract that actually caught the defect                      */
/* ---------------------------------------------------------------- */

test("--out is required to name a directory, and an unknown flag is refused", () => {
  assert.equal(parseArguments([]).out.endsWith("assets/bitmaps"), true);
  assert.equal(parseArguments(["--out", "/tmp/x"]).out, "/tmp/x");
  assert.equal(parseArguments(["--report"]).report, true);
  assert.throws(() => parseArguments(["--out"]), ExtractBitmapsError);
  assert.throws(() => parseArguments(["--out", "--report"]), ExtractBitmapsError);
  assert.throws(() => parseArguments(["--nonsense"]), ExtractBitmapsError);
});

const ORACLE =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";
const haveOracle = fs.existsSync(ORACLE);

test("EVERY bitmap in the build is decoded or COUNTED — never silently absent",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    // ► **THIS IS THE TEST THE DEFECT NEEDED.** Not "the pixels are right" —
    //   the pixels were never wrong, they were never fetched. A bitmap that
    //   this tool cannot read must appear in `failures` and must NOT appear as
    //   a zero-byte file a renderer would draw as nothing.
    const { bitmaps, failures } = extractBitmaps(fs.readFileSync(ORACLE));
    const decoded = Object.keys(bitmaps).length;
    assert.equal(decoded + failures.length >= 14, true,
      `the build holds 14 bitmap characters; saw ${decoded} decoded + ${failures.length} counted`);
    for (const bitmap of Object.values(bitmaps)) {
      assert.ok(bitmap.bytes.length > 0, `bitmap ${bitmap.id} decoded to zero bytes`);
      assert.ok(bitmap.width > 0 && bitmap.height > 0,
        `bitmap ${bitmap.id} has no dimensions — a renderer would draw nothing and say nothing`);
    }
    for (const failure of failures) {
      assert.ok(typeof failure.message === "string" && failure.message.length > 0,
        `failure for ${failure.id} must say WHY, or it is the same silent drop in a new place`);
      assert.equal(bitmaps[failure.id] === undefined || failure.message.includes("alpha"), true,
        "a character is decoded or it is a failure, never quietly both");
    }
  });

test("the arena's own wall and crowd bitmaps decode to real images",
  { skip: haveOracle ? false : "no installed build on this machine" }, () => {
    // The six arenas' walls, by character id, measured off the oracle. These
    // are the images that were missing, so they are pinned by name.
    const { bitmaps } = extractBitmaps(fs.readFileSync(ORACLE));
    for (const [id, width, height] of [[1773, 342, 500], [2099, 229, 307], [2101, 595, 327],
      [2103, 360, 387], [2105, 360, 467], [2107, 235, 164]]) {
      const bitmap = bitmaps[id];
      assert.ok(bitmap, `arena wall bitmap ${id} must decode`);
      assert.deepEqual({ width: bitmap.width, height: bitmap.height }, { width, height },
        `bitmap ${id} size`);
      assert.equal(bitmap.format, "jpeg");
    }
    // ► And the ones with an alpha plane must carry it, because the awnings'
    //   scalloped gaps are where the sky shows through. A crowd drawn without
    //   its alpha is an opaque block across the top of the arena.
    assert.ok(bitmaps[2101].alphaPng, "2101 is a JPEG3 and its alpha is what lets the sky through");
    assert.ok(bitmaps[2101].alphaPng.length > 0);
  });
