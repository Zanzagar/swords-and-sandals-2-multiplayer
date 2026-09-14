/**
 * READ PIXELS OUT OF A SCREENSHOT, so a render can be checked by measurement
 * rather than by squinting.
 *
 * ## Why this exists
 *
 * `tools/shot.sh` made it possible to LOOK at the arena, and looking
 * immediately found three defects the suite could not. It also produced two
 * wrong conclusions in one evening:
 *
 * - *"the sky layer is not drawing"* — it was drawing; an unmasked crowd
 *   bitmap was sitting on top of it.
 * - *"the weapon does not appear"* — it appeared; at 1000px the whole gladiator
 *   is 45 pixels tall and a 73-unit sword is twenty.
 *
 * **Both were failures of EYESIGHT, not of reasoning, and both cost more than
 * this file did.** A question like "is stage (320, 10) blue or is it the
 * placeholder green" has an exact answer, and asking it exactly is cheaper than
 * arguing about a thumbnail.
 *
 * ## What it is deliberately not
 *
 * Not an image library. It reads the one PNG shape Chrome's `--screenshot`
 * emits — 8-bit, non-interlaced, colour type 2 or 6 — and REFUSES anything else
 * BY NAME. `package.json` declares no dependencies and every tool here keeps
 * that promise, so the alternative to forty lines of decoder is no measurement
 * at all.
 *
 * ► **AN UNSUPPORTED PNG THROWS RATHER THAN RETURNING GREY.** A sampler that
 *   quietly returns a wrong colour is the same defect class this whole
 *   programme exists to stamp out: an approximation nobody counts.
 *
 * Usage:
 *   node tools/sample-png.mjs <file.png> <x>,<y> [<x>,<y> …]
 *   node tools/sample-png.mjs <file.png> --row <y>        (a colour census of one row)
 */

import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export class PngError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * A PNG to `{width, height, channels, pixels}` with 8 bits per channel.
 *
 * Filters are per ROW and every one refers to the row above, so they cannot be
 * skipped or reordered — which is the one part of this that is easy to get
 * subtly wrong and still produce a plausible picture.
 */
export function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) throw new PngError("not a PNG");
  let cursor = 8;
  let header = null;
  const idat = [];
  while (cursor < buffer.length) {
    const length = buffer.readUInt32BE(cursor);
    const type = buffer.toString("latin1", cursor + 4, cursor + 8);
    const body = buffer.subarray(cursor + 8, cursor + 8 + length);
    if (type === "IHDR") {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        depth: body[8],
        colourType: body[9],
        interlace: body[12]
      };
    } else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    cursor += 12 + length;
  }
  if (!header) throw new PngError("no IHDR");
  if (header.depth !== 8) throw new PngError(`bit depth ${header.depth} is not supported; only 8`);
  if (header.interlace !== 0) throw new PngError("interlaced PNGs are not supported");
  const channels = header.colourType === 2 ? 3 : header.colourType === 6 ? 4 : 0;
  if (channels === 0) throw new PngError(`colour type ${header.colourType} is not supported; only 2 (RGB) and 6 (RGBA)`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = header.width * channels;
  const pixels = Buffer.alloc(stride * header.height);
  let at = 0;
  for (let y = 0; y < header.height; y += 1) {
    const filter = raw[at];
    at += 1;
    const row = raw.subarray(at, at + stride);
    at += stride;
    const out = pixels.subarray(y * stride, y * stride + stride);
    const prior = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let index = 0; index < stride; index += 1) {
      const a = index >= channels ? out[index - channels] : 0;
      const b = prior ? prior[index] : 0;
      const c = prior && index >= channels ? prior[index - channels] : 0;
      let value = row[index];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        // Paeth: the predictor closest to a + b - c. Written out rather than
        // borrowed, because an off-by-one here still decodes to a picture.
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new PngError(`unknown row filter ${filter} at row ${y}`);
      out[index] = value & 0xff;
    }
  }
  return { width: header.width, height: header.height, channels, pixels };
}

/** `#rrggbb` at a pixel, or null when the point is outside the image. */
export function sampleAt(image, x, y) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= image.width || py >= image.height) return null;
  const at = (py * image.width + px) * image.channels;
  const hex = (value) => value.toString(16).padStart(2, "0");
  return `#${hex(image.pixels[at])}${hex(image.pixels[at + 1])}${hex(image.pixels[at + 2])}`;
}

/**
 * The distinct colours across one row, most common first.
 *
 * Written for the question that produced it: *"there is a green line across the
 * top of the arena — what is it and exactly how tall?"* A census answers that
 * in one run where sampling single points guesses at it.
 */
export function rowCensus(image, y) {
  const tally = new Map();
  for (let x = 0; x < image.width; x += 1) {
    const colour = sampleAt(image, x, y);
    tally.set(colour, (tally.get(colour) ?? 0) + 1);
  }
  return [...tally.entries()].sort((left, right) => right[1] - left[1]);
}

export function parseArguments(argv) {
  const options = { file: null, points: [], row: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--row") {
      const next = Number(argv[index + 1]);
      if (!Number.isFinite(next)) throw new PngError("--row needs a y coordinate.");
      options.row = next;
      index += 1;
    } else if (value.includes(",")) {
      const [x, y] = value.split(",").map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new PngError(`bad point ${value}`);
      options.points.push({ x, y });
    } else if (value.startsWith("--")) throw new PngError(`Unknown option ${value}.`);
    else options.file = value;
  }
  if (!options.file) throw new PngError("Usage: node tools/sample-png.mjs <file.png> <x>,<y> … | --row <y>");
  return options;
}

function main(argv) {
  const options = parseArguments(argv);
  const image = decodePng(fs.readFileSync(options.file));
  process.stdout.write(`${options.file}  ${image.width}x${image.height}  ${image.channels} channels\n`);
  if (options.row !== null) {
    for (const [colour, count] of rowCensus(image, options.row).slice(0, 12)) {
      process.stdout.write(`  row ${options.row}: ${colour}  x${count}\n`);
    }
  }
  for (const point of options.points) {
    process.stdout.write(`  (${point.x}, ${point.y}) = ${sampleAt(image, point.x, point.y) ?? "outside"}\n`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
