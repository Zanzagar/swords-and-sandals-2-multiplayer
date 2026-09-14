/**
 * THE BUILD'S OWN BITMAPS — the arena walls, the crowds, and every other
 * raster asset — out of the player's install and into gitignored `assets/`.
 *
 * ## Why this exists, and it is the least comfortable entry in this directory
 *
 * ► **THE ARENA'S WALLS AND CROWDS ARE JPEGs, AND THIS REPOSITORY DREW NONE OF
 *   THEM.** `swf-shapes.mjs` recognised a bitmap fill and emitted
 *   `fill: "none"` with an `approximated: "bitmap"` note — and nothing
 *   downstream carried that note, so a shape filled with the arena wall came
 *   out as an invisible rectangle and the extractor's report said zero
 *   failures. **The owner asked "where are the backgrounds that are actually in
 *   game? Did you make these?"**, which is exactly the right question to ask of
 *   a renderer that was drawing flat colour where a photograph of a stone wall
 *   belongs.
 *
 *   Nothing was invented — every colour and coordinate came from the build —
 *   but "extracted the arena" was a far stronger claim than "extracted the
 *   vector underlay of the arena", and the difference was invisible precisely
 *   because the drop was silent. **An approximation that is not COUNTED is
 *   indistinguishable from a correct read.**
 *
 * ## What the build actually holds
 *
 * Fourteen bitmap characters, and they are most of what an arena looks like:
 *
 * ```text
 *   arena  sand (solid)   wall/crowd bitmap
 *     1    #602d18        1773   stone wall, pillar, barred gate
 *     2    #9f7c3a        2099
 *     3    #e6c267        2101   packed stands, awnings, lion crests
 *     4    #faac5d        2103
 *     5    #fad57c        2105
 *     6    #f9f3f1        717 + 2107, plus a VECTOR crowd of ~80 colours
 * ```
 *
 * **The sand really is one solid colour per arena** — that part the vector
 * pipeline had right. The wall behind it never was.
 *
 * ## The four encodings, and which ones are honest here
 *
 * - **`DefineBitsJPEG2` (21)** — id then a JPEG stream. Written straight out.
 * - **`DefineBitsJPEG3` (35)** / **`DefineBitsJPEG4` (90)** — id, an offset, a
 *   JPEG stream, then a ZLIB-DEFLATED ALPHA CHANNEL. The colour is written as
 *   JPEG and the alpha as a separate 8-bit PNG, because compositing them here
 *   would need a JPEG DECODER that node does not ship and this file will not
 *   pretend to have. The surface composites them; `assets/props/manifest.json`
 *   says which have an alpha companion.
 * - **`DefineBits` (6)** — a JPEG missing its tables, which live in a separate
 *   `JPEGTables` tag. Spliced back together here.
 * - **`DefineBitsLossless` (20)** / **`DefineBitsLossless2` (36)** — zlib'd raw
 *   pixels, palette or direct. Re-encoded as PNG.
 *
 * ► **AN ENCODING THIS FILE CANNOT READ IS REPORTED AND COUNTED, NEVER
 *   SKIPPED.** That is the whole lesson above, written as a rule.
 *
 * ## The rule every extractor here obeys
 *
 * **Assets come out of the player's own install and never into the repository.**
 * `assets/` is gitignored AND `test/asset-attestation.test.js` fails if anything
 * under it is tracked. Doom/WAD model: clone this repo and you still need your
 * own licensed copy.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import process from "node:process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { indexCharacters, walkTags, tagStreamStart, TAG } from "./swf-display-list.mjs";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

const DEFAULT_SWF =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";

const ORACLE_SHA256 = "77cb545c2061ab41246251467a4edf5926ab6fd1ddd95dc9527d7ba9c45bb8ca";

/** The tag codes this file understands, by name, so a report can say which. */
const ENCODINGS = Object.freeze({
  6: "DefineBits",
  20: "DefineBitsLossless",
  21: "DefineBitsJPEG2",
  35: "DefineBitsJPEG3",
  36: "DefineBitsLossless2",
  90: "DefineBitsJPEG4"
});

export class ExtractBitmapsError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * A SWF JPEG often carries a bogus `FFD9 FFD8` (end-then-start) pair at the
 * front — a quirk of the format that every player strips and that a decoder
 * will otherwise refuse. Stripped here rather than in the browser, because a
 * file on disk should be openable by anything.
 */
export function stripJpegPrefix(bytes) {
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd9 && bytes[2] === 0xff && bytes[3] === 0xd8) {
    return bytes.subarray(4);
  }
  return bytes;
}

/**
 * A JPEG's pixel dimensions, from its own SOF marker.
 *
 * Read rather than taken on trust: the shape's bounds say how big the fill is
 * DRAWN, not how big the image IS, and the two differ by the fill matrix.
 */
export function jpegSize(bytes) {
  let cursor = 2;
  while (cursor < bytes.length - 9) {
    if (bytes[cursor] !== 0xff) { cursor += 1; continue; }
    const marker = bytes[cursor + 1];
    // Every SOFn except DHT (C4), DNL (C8) and DAC (CC) carries the size.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: bytes.readUInt16BE(cursor + 7), height: bytes.readUInt16BE(cursor + 5) };
    }
    const length = bytes.readUInt16BE(cursor + 2);
    if (!length) break;
    cursor += 2 + length;
  }
  return { width: 0, height: 0 };
}

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * A SWF alpha PLANE as an RGBA PNG whose alpha channel IS the plane.
 *
 * ► **THE OBVIOUS ENCODING IS THE WRONG ONE, AND IT COST A BLACK BOX ROUND THE
 *   EMPEROR'S THRONE.** The first version wrote the plane as an 8-bit
 *   GREYSCALE png — white where opaque, black where clear — which looks exactly
 *   like a mask and reads exactly like a mask to a human. **Canvas compositing
 *   does not read luminance.** `destination-in` keeps the destination wherever
 *   the SOURCE'S ALPHA is non-zero, and a greyscale PNG has no alpha channel at
 *   all, so every pixel was fully opaque and the mask did nothing.
 *
 *   The symptom was a JPEG's black backing square drawn over the arena — and it
 *   had a second, sneakier face: the crowd's awning gaps came out black, which
 *   I first diagnosed as "the sky layer is not drawing". One bug, two
 *   explanations, and the wrong one was the plausible one.
 *
 * So the plane goes into the ALPHA channel, with the colour channels left white
 * so that the file is also legible to a human opening it.
 */
export function encodeAlphaPng(width, height, plane) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const at = index * 4;
    pixels[at] = 255;
    pixels[at + 1] = 255;
    pixels[at + 2] = 255;
    pixels[at + 3] = plane[index];
  }
  return encodePng(width, height, 6, pixels);
}

/**
 * A minimal PNG encoder — enough for a greyscale alpha mask and for RGBA.
 *
 * Written here rather than taken as a dependency because `package.json`
 * declares none and every tool in this directory keeps that promise. It is the
 * spec's simplest legal file: one IHDR, one zlib'd IDAT with a zero filter byte
 * per row, one IEND.
 *
 * @param {number} colourType 0 = greyscale (1 byte/px), 6 = RGBA (4 bytes/px)
 */
export function encodePng(width, height, colourType, pixels) {
  const channels = colourType === 0 ? 1 : 4;
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colourType;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

/**
 * `DefineBitsLossless` / `DefineBitsLossless2` to RGBA.
 *
 * ► **THE COLOUR ORDER IS THE TRAP.** Format 5's direct pixels are stored
 *   **ARGB**, not RGBA, and its alpha is PREMULTIPLIED in the `2` variant. A
 *   reader that assumes RGBA gets a red/blue swap that still looks like a
 *   picture, which is the worst kind of wrong.
 */
export function losslessToRgba(body, withAlpha) {
  const format = body[2];
  const width = body.readUInt16LE(3);
  const height = body.readUInt16LE(5);
  let cursor = 7;
  let tableSize = 0;
  if (format === 3) { tableSize = body[cursor] + 1; cursor += 1; }
  const data = zlib.inflateSync(body.subarray(cursor));
  const out = Buffer.alloc(width * height * 4);

  if (format === 3) {
    const entry = withAlpha ? 4 : 3;
    const palette = data.subarray(0, tableSize * entry);
    // Rows are padded to a 4-byte boundary.
    const stride = (width + 3) & ~3;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = data[tableSize * entry + y * stride + x] * entry;
        const at = (y * width + x) * 4;
        out[at] = palette[index];
        out[at + 1] = palette[index + 1];
        out[at + 2] = palette[index + 2];
        out[at + 3] = withAlpha ? palette[index + 3] : 255;
      }
    }
    return { width, height, pixels: out };
  }

  if (format === 4) {
    const stride = ((width * 2) + 3) & ~3;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = data.readUInt16BE(y * stride + x * 2);
        const at = (y * width + x) * 4;
        out[at] = ((value >> 10) & 0x1f) * 8;
        out[at + 1] = ((value >> 5) & 0x1f) * 8;
        out[at + 2] = (value & 0x1f) * 8;
        out[at + 3] = 255;
      }
    }
    return { width, height, pixels: out };
  }

  if (format === 5) {
    const stride = width * 4;
    for (let index = 0; index < width * height; index += 1) {
      const at = index * 4;
      const alpha = data[at];
      // PREMULTIPLIED in the `2` variant: undo it, or every semi-transparent
      // pixel comes out too dark.
      const scale = withAlpha && alpha > 0 ? 255 / alpha : 1;
      out[at] = Math.min(255, Math.round(data[at + 1] * scale));
      out[at + 1] = Math.min(255, Math.round(data[at + 2] * scale));
      out[at + 2] = Math.min(255, Math.round(data[at + 3] * scale));
      out[at + 3] = withAlpha ? alpha : 255;
    }
    void stride;
    return { width, height, pixels: out };
  }

  throw new ExtractBitmapsError(`unsupported lossless format ${format}`);
}

/** The `JPEGTables` tag's payload, or null — `DefineBits` is useless without it. */
export function findJpegTables(buffer) {
  for (const { code, bodyStart, bodyEnd } of walkTags(buffer, tagStreamStart(buffer), buffer.length)) {
    if (code === TAG.JPEG_TABLES ?? 8) {
      if (bodyEnd - bodyStart > 2) return buffer.subarray(bodyStart, bodyEnd);
    }
    if (code === 8 && bodyEnd - bodyStart > 2) return buffer.subarray(bodyStart, bodyEnd);
  }
  return null;
}

/**
 * Every bitmap in the build, decoded as far as this file honestly can.
 *
 * Returns `{ bitmaps, failures }`. A bitmap that could not be decoded appears
 * ONLY in `failures` — never as a zero-byte file that a renderer would draw as
 * nothing, which is the exact shape of the defect this tool exists to close.
 */
export function extractBitmaps(buffer) {
  const { characters } = indexCharacters(buffer);
  const tables = findJpegTables(buffer);
  const bitmaps = {};
  const failures = [];

  for (const character of [...characters.values()].filter((c) => c.kind === "bitmap").sort((a, b) => a.id - b.id)) {
    const { id, tagCode, bodyStart, bodyEnd } = character;
    const encoding = ENCODINGS[tagCode] ?? `tag${tagCode}`;
    try {
      if (tagCode === 21 || tagCode === 35 || tagCode === 90 || tagCode === 6) {
        let colour;
        let alpha = null;
        if (tagCode === 35 || tagCode === 90) {
          const alphaOffset = buffer.readUInt32LE(bodyStart + 2);
          const start = bodyStart + 6 + (tagCode === 90 ? 1 : 0);
          colour = stripJpegPrefix(buffer.subarray(start, start + alphaOffset));
          const alphaZlib = buffer.subarray(start + alphaOffset, bodyEnd);
          if (alphaZlib.length > 0) alpha = zlib.inflateSync(alphaZlib);
        } else if (tagCode === 6) {
          if (!tables) throw new ExtractBitmapsError("DefineBits with no JPEGTables tag in the file");
          // The tables end with EOI and the data begins with SOI; drop both.
          const head = tables.subarray(0, Math.max(0, tables.length - 2));
          colour = Buffer.concat([head, stripJpegPrefix(buffer.subarray(bodyStart + 2, bodyEnd)).subarray(2)]);
        } else {
          colour = stripJpegPrefix(buffer.subarray(bodyStart + 2, bodyEnd));
        }
        const size = jpegSize(colour);
        if (!size.width || !size.height) throw new ExtractBitmapsError("no SOF marker — not a JPEG this reader knows");
        bitmaps[id] = {
          id, encoding, format: "jpeg", width: size.width, height: size.height,
          bytes: colour,
          // ► The alpha travels as its OWN greyscale PNG. Compositing it here
          //   would need a JPEG decoder node does not ship, and a tool that
          //   guesses at that would be inventing pixels.
          alphaPng: alpha && alpha.length >= size.width * size.height
            ? encodeAlphaPng(size.width, size.height, alpha.subarray(0, size.width * size.height))
            : null
        };
        if (alpha && !bitmaps[id].alphaPng) {
          failures.push({ id, encoding, message: `alpha channel is ${alpha.length} bytes for a ${size.width}x${size.height} image — not used` });
        }
      } else if (tagCode === 20 || tagCode === 36) {
        const { width, height, pixels } = losslessToRgba(buffer.subarray(bodyStart, bodyEnd), tagCode === 36);
        bitmaps[id] = { id, encoding, format: "png", width, height, bytes: encodePng(width, height, 6, pixels), alphaPng: null };
      } else {
        throw new ExtractBitmapsError(`no reader for ${encoding}`);
      }
    } catch (error) {
      failures.push({ id, encoding, message: String(error.message).slice(0, 160) });
    }
  }
  return { bitmaps, failures };
}

export function parseArguments(argv) {
  const options = { file: null, out: path.join(REPO_ROOT, "assets", "bitmaps"), report: false };
  const rest = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") {
      const next = argv[index + 1];
      if (typeof next !== "string" || next.startsWith("--")) throw new ExtractBitmapsError("--out needs a directory path.");
      options.out = next;
      index += 1;
    } else if (value === "--report") options.report = true;
    else if (value.startsWith("--")) throw new ExtractBitmapsError(`Unknown option ${value}.`);
    else rest.push(value);
  }
  options.file = rest[0] ?? DEFAULT_SWF;
  return options;
}

function main(argv) {
  const options = parseArguments(argv);
  if (!fs.existsSync(options.file)) {
    throw new ExtractBitmapsError(
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

  const { bitmaps, failures } = extractBitmaps(buffer);
  fs.mkdirSync(options.out, { recursive: true });

  const manifest = {};
  const lines = [`bitmaps -> ${options.out}`];
  for (const bitmap of Object.values(bitmaps)) {
    const name = `${bitmap.id}.${bitmap.format === "jpeg" ? "jpg" : "png"}`;
    fs.writeFileSync(path.join(options.out, name), bitmap.bytes);
    let alphaName = null;
    if (bitmap.alphaPng) {
      alphaName = `${bitmap.id}-alpha.png`;
      fs.writeFileSync(path.join(options.out, alphaName), bitmap.alphaPng);
    }
    manifest[bitmap.id] = {
      file: name, alpha: alphaName, encoding: bitmap.encoding,
      width: bitmap.width, height: bitmap.height, bytes: bitmap.bytes.length
    };
    lines.push(
      `  ${String(bitmap.id).padStart(5)}  ${bitmap.encoding.padEnd(20)}` +
      ` ${String(bitmap.width).padStart(5)}x${String(bitmap.height).padEnd(5)}` +
      ` ${String((bitmap.bytes.length / 1024).toFixed(0)).padStart(5)}KB${alphaName ? "  + alpha" : ""}`
    );
  }
  fs.writeFileSync(path.join(options.out, "manifest.json"), JSON.stringify({
    source: path.basename(options.file), sha256, bitmaps: manifest, failures
  }, null, 1));

  lines.push(`  ${Object.keys(bitmaps).length} decoded, ${failures.length} failures`);
  if (options.report) for (const failure of failures) lines.push(`    ! ${failure.id} (${failure.encoding}): ${failure.message}`);
  process.stdout.write(`${lines.join("\n")}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
