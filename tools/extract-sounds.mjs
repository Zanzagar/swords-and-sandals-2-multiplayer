/**
 * Extract the sound effects from YOUR OWN Swords & Sandals II install.
 *
 * ## Why this is allowed, stated here because it is the first tool that touches
 * ## licensed content rather than reading it
 *
 * `AGENTS.md` carries the project's distribution rule:
 *
 * > **Ship no SS2 asset.** The project is intended to be shared, so the repo is
 * > a distribution channel: someone who clones it must still need their own
 * > licensed copy to play. Same model as a Doom source port shipping no WAD.
 * > **This is about what leaves the repo, never about what you may build in it.**
 *
 * So this writes into `assets/`, which is gitignored, and
 * `test/asset-attestation.test.js` FAILS if anything it writes is ever tracked.
 * That test is the first line of defence and the ignore rule is the second —
 * the same pair the raw capture traces have, and for the same reason: a
 * subagent once committed 67 of those because only one of the two existed.
 *
 * ## READ-ONLY on the SWF, and that is not politeness
 *
 * The installed build is this project's MEASUREMENT ORACLE. All 23 promoted
 * goldens, 69 observation records and every capture manifest cite its sha256;
 * change it by one byte and the corpus stops describing anything. This opens
 * the file for reading and never writes to it.
 *
 * The manifest records the sha256 it read, so extracted audio is always
 * traceable to the build it came out of. If that hash is not the oracle's, the
 * assets are from a different build and anything concluded from them is about
 * that build instead.
 *
 * ## Why there is no decoder in here
 *
 * Measured first, on the shipped build: **all 82 `DefineSound` tags are format
 * 2, which is MP3** — 4.79 MB of a 7.24 MB file. An MP3 `DefineSound` body is a
 * 7-byte header, a 2-byte `SeekSamples`, and then raw MP3 frames, so extraction
 * is a REPACK rather than a decode and a browser can play the result directly.
 *
 * Every other SWF sound format is refused by name rather than written as
 * garbage a player would have to diagnose by ear. ADPCM and Nellymoser would
 * each need a real decoder, and neither is present here; if a different build
 * carries one, this says so instead of pretending.
 *
 * Usage:
 *   node tools/extract-sounds.mjs "<path to swords_sandals2_download.swf>"
 *   node tools/extract-sounds.mjs "<path>" --out assets/sound
 *
 * Node builtins only.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** SWF sound formats, by the code in the tag's flag nibble. */
const SOUND_FORMATS = Object.freeze({
  0: "uncompressed (native endian)",
  1: "ADPCM",
  2: "MP3",
  3: "uncompressed (little endian)",
  4: "Nellymoser 16kHz",
  5: "Nellymoser 8kHz",
  6: "Nellymoser",
  11: "Speex"
});

/** `SoundRate` is two bits naming one of four sample rates. */
const SOUND_RATES = Object.freeze({ 0: 5512, 1: 11025, 2: 22050, 3: 44100 });

export class ExtractError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

export function parseArguments(argv) {
  const options = { file: null, out: path.join(REPO_ROOT, "assets", "sound") };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") {
      const next = argv[index + 1];
      if (typeof next !== "string" || next.startsWith("--")) {
        throw new ExtractError("--out needs a directory path.");
      }
      options.out = path.resolve(next);
      index += 1;
    } else if (value.startsWith("--")) {
      // An unknown flag THROWS rather than being ignored, the same rule
      // `tools/engagement-census.mjs` learned the hard way: a silently ignored
      // flag runs a different job and reports it as the one you asked for.
      throw new ExtractError(`Unknown flag ${JSON.stringify(value)}. Known: --out.`);
    } else if (options.file === null) {
      options.file = value;
    } else {
      throw new ExtractError(`Unexpected argument ${JSON.stringify(value)}.`);
    }
  }
  return options;
}

function readCString(buffer, start, end) {
  let cursor = start;
  while (cursor < end && buffer[cursor] !== 0) cursor += 1;
  return { value: buffer.toString("utf8", start, cursor), next: cursor + 1 };
}

/**
 * Where the tag stream begins: signature, version, length, the frame RECT
 * (whose width is a variable bit field), then frame rate and count.
 */
function tagStreamStart(buffer) {
  const signature = buffer.toString("latin1", 0, 3);
  if (signature === "CWS" || signature === "ZWS") {
    throw new ExtractError(
      `This SWF is compressed (${signature}). Only an uncompressed FWS is supported; ` +
      "the shipped Swords & Sandals II build is FWS."
    );
  }
  if (signature !== "FWS") throw new ExtractError("Not a SWF: expected an FWS/CWS/ZWS signature.");
  let cursor = 8;
  const nbits = buffer[cursor] >>> 3;
  cursor += Math.ceil((5 + nbits * 4) / 8);
  return cursor + 4;
}

/**
 * Every `DefineSound` in the file, and every exported symbol NAME.
 *
 * Sprites are walked too: a sound defined inside one is still a sound, and the
 * build nests most of its content.
 */
export function readSoundTags(buffer) {
  const sounds = [];
  const names = new Map();

  const walk = (start, end, depth) => {
    let cursor = start;
    while (cursor + 2 <= end) {
      const header = buffer.readUInt16LE(cursor);
      cursor += 2;
      const code = header >>> 6;
      let length = header & 0x3f;
      if (length === 0x3f) {
        if (cursor + 4 > end) break;
        length = buffer.readUInt32LE(cursor);
        cursor += 4;
      }
      const bodyStart = cursor;
      const bodyEnd = Math.min(bodyStart + length, end);
      if (code === 0) break;

      if (code === 14 && bodyEnd - bodyStart >= 7) {
        const id = buffer.readUInt16LE(bodyStart);
        const flags = buffer[bodyStart + 2];
        sounds.push({
          id,
          format: flags >>> 4,
          rate: SOUND_RATES[(flags >>> 2) & 0x3],
          bits: ((flags >>> 1) & 0x1) ? 16 : 8,
          channels: (flags & 0x1) ? 2 : 1,
          sampleCount: buffer.readUInt32LE(bodyStart + 3),
          bodyStart,
          bodyEnd
        });
      } else if (code === 56) {
        // ExportAssets: a count, then id/name pairs. Names make the output
        // usable — `hit_sword.mp3` beats `sound-651.mp3` — and the build
        // exports 502 symbols, so many sounds have one.
        let inner = bodyStart;
        const count = buffer.readUInt16LE(inner);
        inner += 2;
        for (let index = 0; index < count && inner < bodyEnd; index += 1) {
          const id = buffer.readUInt16LE(inner);
          inner += 2;
          const read = readCString(buffer, inner, bodyEnd);
          inner = read.next;
          if (read.value) names.set(id, read.value);
        }
      } else if (code === 39 && depth < 4) {
        // DefineSprite: id (2) + frame count (2), then a nested tag stream.
        walk(bodyStart + 4, bodyEnd, depth + 1);
      }
      cursor = bodyEnd;
    }
  };

  walk(tagStreamStart(buffer), buffer.length, 0);
  return { sounds, names };
}

/**
 * WHICH ANIMATION EACH SOUND BELONGS TO, from the build's own FRAME LABELS.
 *
 * ► **THE FIRST VERSION BUCKETED BY THE BATTLE MAP'S PROSE RANGES AND THE
 *   OWNER HEARD IT IMMEDIATELY: "I am hearing a block sound and jump sound for
 *   walking."** He was right, and the prose is why.
 *
 *   The map summarises export 1241 as `Standing` (2), "movement and charge
 *   (33-104)", `Block` (118/179), "attack directions 1-12 (190-360)" and so
 *   on. Those are RANGES OVER SEVERAL ANIMATIONS, and bucketing by them put
 *   four different clips in one bag:
 *
 *   ```text
 *     33 StepBack   50 StepForward   68 Charge   104 Chargeattack
 *    118 BlockForward   136 Jump   148 Superjump   173 Roll   179 Block
 *   ```
 *
 *   So "movement" held `Chargeattack` — a leaping attack — and the "block"
 *   range held `Jump` and `Superjump`. A walk drew from four clips and sounded
 *   like whichever it got. **`Block` and `BlockForward` carry no sound at all**,
 *   which the prose bucket hid completely.
 *
 *   **Fifth instance of this project's standing lesson, arriving from a new
 *   direction: a gap or a summary in a TRANSCRIPTION says nothing about the
 *   build.** The map's own text warns that these labels are UI effects; it
 *   never claimed to enumerate them. The SWF does, in `FrameLabel` tags, and
 *   reading those gives 80 labels where the prose gave 17 ranges.
 *
 * So: a sound is bound to the label it fires UNDER — the nearest preceding
 * `FrameLabel` on the same clip — and nothing is bucketed by arithmetic on
 * frame numbers.
 */
const FIGHTER_CLIP_ID = 1241;

/** Every `FrameLabel` and `StartSound` on the fighter clip, in frame order. */
export function deriveSoundBindings(buffer) {
  const labels = [];
  const fired = [];

  const walk = (start, end, spriteId, depth) => {
    let cursor = start;
    let frame = 1;
    while (cursor + 2 <= end) {
      const header = buffer.readUInt16LE(cursor);
      cursor += 2;
      const code = header >>> 6;
      let length = header & 0x3f;
      if (length === 0x3f) {
        if (cursor + 4 > end) break;
        length = buffer.readUInt32LE(cursor);
        cursor += 4;
      }
      const bodyStart = cursor;
      const bodyEnd = Math.min(bodyStart + length, end);
      if (code === 0) break;
      if (code === 1) frame += 1;
      else if (code === 43 && spriteId === FIGHTER_CLIP_ID) {
        // FrameLabel: a null-terminated name.
        const read = readCString(buffer, bodyStart, bodyEnd);
        if (read.value) labels.push({ frame, name: read.value });
      } else if (code === 15 && spriteId === FIGHTER_CLIP_ID && bodyEnd - bodyStart >= 2) {
        fired.push({ frame, soundId: buffer.readUInt16LE(bodyStart) });
      } else if (code === 39 && depth < 4) {
        walk(bodyStart + 4, bodyEnd, buffer.readUInt16LE(bodyStart), depth + 1);
      }
      cursor = bodyEnd;
    }
  };
  walk(tagStreamStart(buffer), buffer.length, 0, 0);

  labels.sort((left, right) => left.frame - right.frame);
  const labelAt = (frame) => {
    let best = null;
    for (const label of labels) {
      if (label.frame <= frame && (!best || label.frame > best.frame)) best = label;
    }
    return best ? best.name : null;
  };

  const bindings = {};
  let unlabelled = 0;
  for (const hit of fired) {
    const name = labelAt(hit.frame);
    if (!name) { unlabelled += 1; continue; }
    // Lower-cased because the clip labels are capitalised (`Attack1`) and the
    // engine's own tokens are not (`attack1`). One spelling on both sides of
    // the lookup, decided here rather than at every call site.
    const key = name.toLowerCase();
    if (!bindings[key]) bindings[key] = [];
    if (!bindings[key].includes(hit.soundId)) bindings[key].push(hit.soundId);
  }
  for (const list of Object.values(bindings)) list.sort((left, right) => left - right);
  return { bindings, startSoundCount: fired.length, labelCount: labels.length, unlabelled };
}

/** A filename that is safe, stable and says which symbol it came from. */
function fileNameFor(sound, names) {
  const exported = names.get(sound.id);
  const safe = typeof exported === "string"
    ? exported.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")
    : "";
  // The id stays in the name even when a symbol name exists: two symbols can
  // share a name across timelines, and an overwritten file is a silent loss.
  return safe ? `${sound.id}-${safe}.mp3` : `${sound.id}.mp3`;
}

function main(argv) {
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    console.error(String(error.message));
    return 2;
  }
  if (!options.file) {
    console.error("Usage: node tools/extract-sounds.mjs <file.swf> [--out <dir>]");
    return 2;
  }
  if (!fs.existsSync(options.file)) {
    console.error(`No such file: ${options.file}`);
    return 2;
  }

  // Opened for READING. The installed build is the measurement oracle.
  const buffer = fs.readFileSync(options.file);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const { sounds, names } = readSoundTags(buffer);

  console.log(`SWF:    ${options.file}`);
  console.log(`sha256: ${sha256}`);
  console.log(`sounds: ${sounds.length}\n`);

  if (sounds.length === 0) {
    console.log("No DefineSound tags. Nothing to extract.");
    return 0;
  }

  const unsupported = sounds.filter((sound) => sound.format !== 2);
  if (unsupported.length > 0) {
    const kinds = new Set(unsupported.map((sound) => SOUND_FORMATS[sound.format] ?? `format ${sound.format}`));
    console.log(
      `SKIPPING ${unsupported.length} sound(s) this tool cannot repack: ${[...kinds].join(", ")}.\n` +
      "Only MP3 (format 2) is a repack; the others need a real decoder, and writing them\n" +
      "raw would produce files that are wrong in a way you would have to diagnose by ear.\n"
    );
  }

  fs.mkdirSync(options.out, { recursive: true });
  const written = [];
  for (const sound of sounds) {
    if (sound.format !== 2) continue;
    // An MP3 DefineSound body is: id(2) flags(1) sampleCount(4) seekSamples(2)
    // then raw MP3 frames. Nine bytes off the front and it is a playable file.
    const frames = buffer.subarray(sound.bodyStart + 9, sound.bodyEnd);
    if (frames.length === 0) continue;
    const name = fileNameFor(sound, names);
    fs.writeFileSync(path.join(options.out, name), frames);
    written.push({
      file: name,
      id: sound.id,
      exportName: names.get(sound.id) ?? null,
      rate: sound.rate,
      bits: sound.bits,
      channels: sound.channels,
      sampleCount: sound.sampleCount,
      bytes: frames.length,
      approxSeconds: Number((sound.sampleCount / sound.rate).toFixed(2))
    });
  }

  written.sort((left, right) => right.bytes - left.bytes);
  const { bindings, startSoundCount, labelCount, unlabelled } = deriveSoundBindings(buffer);
  const byId = new Map(written.map((entry) => [entry.id, entry.file]));
  // Bindings are emitted as FILENAMES, so a player never has to re-derive the
  // id-to-file mapping, and a sound whose format could not be repacked simply
  // drops out of its bucket rather than becoming a broken reference.
  const boundFiles = {};
  for (const [label, ids] of Object.entries(bindings)) {
    const files = ids.map((id) => byId.get(id)).filter(Boolean);
    if (files.length > 0) boundFiles[label] = files;
  }

  const manifest = {
    // The provenance that makes the extracted audio traceable. Without it,
    // assets from a modded second install are indistinguishable from the
    // oracle's — and this project keeps a second install lane precisely so
    // that modding does not touch the measured one.
    source: { file: path.basename(options.file), sha256, bytes: buffer.length },
    extractedBy: "tools/extract-sounds.mjs",
    format: "mp3 (SWF DefineSound format 2, repacked — no transcoding)",
    count: written.length,
    skipped: unsupported.length,
    /**
     * Which animation each sound fires in, derived from the build's own
     * `StartSound` placement on the fighter clip. See `deriveSoundBindings`.
     * `unlabelled` is a real bucket, not a leftover: those sounds fire on
     * frames the battle map names no label for.
     */
    bindings: boundFiles,
    startSoundCount,
    frameLabelCount: labelCount,
    unlabelledSounds: unlabelled,
    sounds: written
  };
  fs.writeFileSync(path.join(options.out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  const totalBytes = written.reduce((sum, entry) => sum + entry.bytes, 0);
  console.log(`wrote ${written.length} file(s) to ${options.out}`);
  console.log(`      ${(totalBytes / 1024 / 1024).toFixed(2)} MB, plus manifest.json\n`);
  console.log(`bound to ${Object.keys(boundFiles).length} animation labels, from the clip's own FrameLabel tags`);
  console.log(`  (${labelCount} labels on the fighter clip; ${unlabelled} sound(s) fired before any label)\n`);
  console.log("largest, which are usually music rather than effects:");
  for (const entry of written.slice(0, 5)) {
    console.log(`  ${entry.file.padEnd(34)} ${String(entry.approxSeconds).padStart(7)}s  ${entry.channels === 2 ? "stereo" : "mono  "}  ${(entry.bytes / 1024).toFixed(0).padStart(6)} KB`);
  }
  console.log("\nThese are YOUR extracted assets. `assets/` is gitignored and a test fails");
  console.log("if any of it is ever tracked — the repo must stay playable-only-with-your-own-copy.");
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
