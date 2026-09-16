/**
 * THE PIXEL SAMPLER, and why a renderer needs one.
 *
 * ► **LOOKING AT THE ARENA FOUND THREE DEFECTS THE SUITE COULD NOT, AND
 *   PRODUCED TWO WRONG CONCLUSIONS IN ONE EVENING.** *"The sky layer is not
 *   drawing"* — it was; an unmasked crowd bitmap sat on top of it. *"The weapon
 *   does not appear"* — it did; at 1000px the gladiator is 45 pixels tall and
 *   the sword is twenty. Both were failures of EYESIGHT, and both cost more
 *   than this decoder did.
 *
 *   So the loop is now: `tools/shot-live.sh` renders it, and this reads the pixels
 *   back. "Is stage (320, 10) the sky or the placeholder green" has an exact
 *   answer, and asking it exactly is cheaper than arguing about a thumbnail.
 *
 * These run on buffers this file builds, so they execute on a clone with no
 * licensed copy and no browser. The one test that wants a real screenshot skips
 * itself by name.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import zlib from "node:zlib";

import { PngError, decodePng, parseArguments, rowCensus, sampleAt } from "../tools/sample-png.mjs";
import { encodePng } from "../tools/extract-bitmaps.mjs";

/**
 * A PNG with one filter type applied to every row, built by hand.
 *
 * A `function` declaration, not an arrow: `ss2-assertion-quality.test.js` finds
 * a helper's body by looking for the next brace before the next newline, so a
 * multi-line arrow reads as bodyless and its callers report as asserting
 * nothing.
 */
function filteredPng(width, height, channels, pixels, filter) {
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = filter;
    for (let index = 0; index < stride; index += 1) {
      const value = pixels[y * stride + index];
      const a = index >= channels ? pixels[y * stride + index - channels] : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + index] : 0;
      const c = y > 0 && index >= channels ? pixels[(y - 1) * stride + index - channels] : 0;
      let encoded = value;
      if (filter === 1) encoded = value - a;
      else if (filter === 2) encoded = value - b;
      else if (filter === 3) encoded = value - ((a + b) >> 1);
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        encoded = value - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      raw[y * (stride + 1) + 1 + index] = encoded & 0xff;
    }
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    // The CRC is not checked by the decoder, so a zero is honest here rather
    // than a second implementation of the polynomial to keep in step.
    return Buffer.concat([length, body, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

test("EVERY row filter round-trips, because a wrong one still decodes to a picture", () => {
  // ► **THIS IS THE WHOLE RISK.** Filters are per row and each refers to the row
  //   above, so an off-by-one in Paeth or an averaged filter produces a
  //   plausible image with wrong colours — which is exactly the class of error
  //   a sampler exists to rule out. All five are exercised against the same
  //   known pixels.
  const width = 5;
  const height = 4;
  const pixels = Buffer.alloc(width * height * 3);
  for (let index = 0; index < pixels.length; index += 1) pixels[index] = (index * 37) & 0xff;

  for (const filter of [0, 1, 2, 3, 4]) {
    const image = decodePng(filteredPng(width, height, 3, pixels, filter));
    assert.deepEqual({ w: image.width, h: image.height, c: image.channels },
      { w: width, h: height, c: 3 }, `filter ${filter} header`);
    assert.deepEqual([...image.pixels], [...pixels], `filter ${filter} must reproduce the pixels exactly`);
  }
});

test("the sampler reads the colour that is actually there, and says so in hex", () => {
  const pixels = Buffer.from([
    0xff, 0x00, 0x00, 0x00, 0xff, 0x00,
    0x00, 0x00, 0xff, 0x66, 0xff, 0x99
  ]);
  const image = decodePng(filteredPng(2, 2, 3, pixels, 0));
  assert.equal(sampleAt(image, 0, 0), "#ff0000");
  assert.equal(sampleAt(image, 1, 0), "#00ff00");
  assert.equal(sampleAt(image, 0, 1), "#0000ff");
  // ► `#66ff99` is the SS2 backdrop's own placeholder green — the colour that
  //   showed as a band across the top of the arena and that this tool measured
  //   at 3.4 stage pixels tall instead of being argued about.
  assert.equal(sampleAt(image, 1, 1), "#66ff99");
});

test("a point outside the image is null, not a fabricated colour", () => {
  const image = decodePng(filteredPng(2, 2, 3, Buffer.alloc(12), 0));
  for (const [x, y] of [[-1, 0], [0, -1], [2, 0], [0, 2], [99, 99]]) {
    assert.equal(sampleAt(image, x, y), null, `(${x}, ${y}) is outside`);
  }
});

test("a row census counts colours, most common first", () => {
  // Written for the question that produced it: "there is a green line across
  // the top — what is it and how wide". A census answers that; sampling single
  // points guesses at it.
  const pixels = Buffer.alloc(4 * 1 * 3);
  for (let x = 0; x < 3; x += 1) { pixels[x * 3] = 0x66; pixels[x * 3 + 1] = 0xff; pixels[x * 3 + 2] = 0x99; }
  pixels[9] = 0x00; pixels[10] = 0x00; pixels[11] = 0x00;
  const census = rowCensus(decodePng(filteredPng(4, 1, 3, pixels, 0)), 0);
  assert.deepEqual(census[0], ["#66ff99", 3]);
  assert.deepEqual(census[1], ["#000000", 1]);
});

test("RGBA decodes too, because Chrome emits either", () => {
  const pixels = Buffer.from([1, 2, 3, 255, 4, 5, 6, 128]);
  const image = decodePng(filteredPng(2, 1, 4, pixels, 0));
  assert.equal(image.channels, 4);
  assert.equal(sampleAt(image, 1, 0), "#040506");
});

test("AN UNSUPPORTED PNG THROWS BY NAME rather than returning grey", () => {
  // ► A sampler that quietly returns a wrong colour is the same defect class
  //   this whole programme exists to stamp out: an approximation nobody counts.
  //   Refusing loudly is the only honest answer for a format this cannot read.
  assert.throws(() => decodePng(Buffer.from("not a png at all")), PngError);

  const sixteenBit = filteredPng(1, 1, 3, Buffer.from([0, 0, 0]), 0);
  sixteenBit[24] = 16; // IHDR bit depth
  assert.throws(() => decodePng(sixteenBit), /bit depth 16/);

  const interlaced = filteredPng(1, 1, 3, Buffer.from([0, 0, 0]), 0);
  interlaced[28] = 1; // IHDR interlace method
  assert.throws(() => decodePng(interlaced), /interlaced/);

  const palette = filteredPng(1, 1, 3, Buffer.from([0, 0, 0]), 0);
  palette[25] = 3; // IHDR colour type: indexed
  assert.throws(() => decodePng(palette), /colour type 3/);
});

test("this decoder reads what tools/extract-bitmaps.mjs writes", () => {
  // The two halves of the same seam: one encodes the build's alpha planes, the
  // other reads screenshots. They share a format and nothing else, so a change
  // to either that breaks the pair should fail here.
  const pixels = Buffer.from([10, 20, 30, 255, 40, 50, 60, 0, 70, 80, 90, 128, 1, 2, 3, 4]);
  const image = decodePng(encodePng(2, 2, 6, pixels));
  assert.deepEqual({ w: image.width, h: image.height, c: image.channels }, { w: 2, h: 2, c: 4 });
  assert.deepEqual([...image.pixels], [...pixels]);
});

test("the CLI refuses a bad point instead of sampling the origin", () => {
  assert.deepEqual(parseArguments(["a.png", "3,4"]).points, [{ x: 3, y: 4 }]);
  assert.equal(parseArguments(["a.png", "--row", "7"]).row, 7);
  assert.throws(() => parseArguments([]), PngError);
  assert.throws(() => parseArguments(["a.png", "--row"]), PngError);
  assert.throws(() => parseArguments(["a.png", "x,4"]), PngError);
  assert.throws(() => parseArguments(["a.png", "--nonsense"]), PngError);
});

test("a real arena screenshot decodes, if one has been taken on this machine",
  { skip: fs.existsSync("/mnt/c/ss2-shots/big.png") ? false : "no screenshot on this machine" }, () => {
    const image = decodePng(fs.readFileSync("/mnt/c/ss2-shots/big.png"));
    assert.ok(image.width > 100 && image.height > 100, "a real screenshot has real dimensions");
    assert.ok(image.channels === 3 || image.channels === 4);
    // Every pixel must be a legal hex colour — a decoder that desynchronises
    // produces NaN channels rather than wrong ones.
    for (const [x, y] of [[0, 0], [image.width - 1, image.height - 1], [image.width >> 1, image.height >> 1]]) {
      assert.match(sampleAt(image, x, y), /^#[0-9a-f]{6}$/);
    }
  });
