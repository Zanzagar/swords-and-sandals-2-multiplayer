/**
 * The sound extractor against a SYNTHETIC build assembled below: which label a
 * sound fires under (`bindings`, unchanged), and now WHEN it fires (`cues`).
 *
 * ► **UNTIL 2026-09-23 NOTHING IN `test/` IMPORTED THIS TOOL AT ALL.** The
 *   bindings the arena has played from since 2026-09-12 were checked only by
 *   ear. `buildSoundManifest` takes a buffer, so it needs bytes in the SWF
 *   format and not a licensed build — the lesson `test/extract-figure.test.js`
 *   records in its own header, arriving here late.
 *
 * What still needs the real build is the MEASUREMENT: which frame each of the
 * build's 99 `StartSound` tags sits on. The main session re-runs
 * `node tools/extract-sounds.mjs <swf>` for that.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSoundManifest,
  deriveSoundBindings,
  deriveSoundCues,
  readSoundInfo
} from "../tools/extract-sounds.mjs";
import { deriveAnimations, indexCharacters } from "../tools/swf-display-list.mjs";

/* ------------------------------------------------------------------ */
/* A byte writer — byte-aligned only, because nothing here needs bits   */
/* ------------------------------------------------------------------ */

const u8 = (value) => Buffer.from([value & 0xff]);
const u16 = (value) => { const bytes = Buffer.alloc(2); bytes.writeUInt16LE(value); return bytes; };
const s16 = (value) => { const bytes = Buffer.alloc(2); bytes.writeInt16LE(value); return bytes; };
const u32 = (value) => { const bytes = Buffer.alloc(4); bytes.writeUInt32LE(value); return bytes; };
const cstring = (value) => Buffer.concat([Buffer.from(value, "utf8"), u8(0)]);

/** One tag: a 10-bit code and a length that grows to 32 bits past 62 bytes. */
function tag(code, body = Buffer.alloc(0)) {
  const header = body.length >= 0x3f
    ? Buffer.concat([u16((code << 6) | 0x3f), u32(body.length)])
    : u16((code << 6) | body.length);
  return Buffer.concat([header, body]);
}

/**
 * A whole uncompressed FWS file. The RECT is the one-byte empty rectangle
 * (`nbits` 0), and the frame rate is 30.0 in 8.8 fixed point — the build's own.
 */
function swf(tags) {
  const header = Buffer.concat([
    Buffer.from("FWS", "latin1"), u8(8), u32(0),
    u8(0), // RECT: nbits = 0, so the whole rectangle is five bits of zero
    u16(30 << 8), u16(1)
  ]);
  return Buffer.concat([header, ...tags, tag(0)]);
}

const showFrame = () => tag(1);
const frameLabel = (name) => tag(43, cstring(name));
const defineSprite = (id, frames, inner) => tag(39, Buffer.concat([u16(id), u16(frames), ...inner, tag(0)]));
const exportAssets = (pairs) => tag(56, Buffer.concat([u16(pairs.length), ...pairs.flatMap(([id, name]) => [u16(id), cstring(name)])]));

/**
 * A `DefineSound`. `format` 2 is MP3, whose body opens with `SeekSamples`
 * before the frames; the frames here are four marker bytes, which is all a
 * repack needs to prove it cut in the right place.
 */
function defineSound(id, { format = 2, seekSamples = 0, marker = id & 0xff } = {}) {
  // flags: format(4) rate(2)=3 (44 kHz) size(1)=1 (16-bit) type(1)=0 (mono)
  const flags = (format << 4) | (3 << 2) | (1 << 1);
  const frames = Buffer.from([0xff, 0xfb, marker, marker]);
  const body = format === 2
    ? Buffer.concat([u16(id), u8(flags), u32(4410), s16(seekSamples), frames])
    : Buffer.concat([u16(id), u8(flags), u32(4410), frames]);
  return tag(14, body);
}

/** A `StartSound` with a SOUNDINFO built from exactly the fields asked for. */
function startSound(id, { stop = false, noMultiple = false, inPoint, outPoint, loops, envelope } = {}) {
  let flags = 0;
  if (stop) flags |= 0x20;
  if (noMultiple) flags |= 0x10;
  if (envelope) flags |= 0x08;
  if (loops !== undefined) flags |= 0x04;
  if (outPoint !== undefined) flags |= 0x02;
  if (inPoint !== undefined) flags |= 0x01;
  const parts = [u16(id), u8(flags)];
  if (inPoint !== undefined) parts.push(u32(inPoint));
  if (outPoint !== undefined) parts.push(u32(outPoint));
  if (loops !== undefined) parts.push(u16(loops));
  if (envelope) {
    parts.push(u8(envelope.length));
    for (const [pos44, left, right] of envelope) parts.push(u32(pos44), u16(left), u16(right));
  }
  return tag(15, Buffer.concat(parts));
}

const FIGHTER = 1241;

/**
 * Ten frames on the fighter clip, laid out to mirror the build's own shapes:
 *
 * ```text
 *   frame  label         StartSound
 *     1    Standing      —
 *     2    StepForward   900              two tags on one label, like the
 *     3                                   build's 706 and 1088 on StepForward
 *     4                  901
 *     5    Hurt8         —                a silent ENTRY whose run carries
 *     6                                   the sound, like the build's hurt8
 *     7    Hurt9         902
 *     8                  900 SyncStop     a stop is not a play
 *     9    Death1        902 noMultiple, loops 2, in 441, out 4410, envelope
 *    10                  903 (ADPCM)      unrepackable, so it drops out
 * ```
 *
 * And one `StartSound` on ANOTHER sprite, which must be ignored.
 */
function build() {
  return swf([
    defineSound(900, { seekSamples: 1105 }),
    defineSound(901),
    defineSound(902, { seekSamples: 576 }),
    defineSound(903, { format: 1 }),
    exportAssets([[900, "step.wav"]]),
    defineSprite(50, 1, [startSound(901), showFrame()]),
    defineSprite(FIGHTER, 10, [
      frameLabel("Standing"), showFrame(),
      frameLabel("StepForward"), startSound(900), showFrame(),
      showFrame(),
      startSound(901), showFrame(),
      frameLabel("Hurt8"), showFrame(),
      showFrame(),
      frameLabel("Hurt9"), startSound(902), showFrame(),
      startSound(900, { stop: true }), showFrame(),
      frameLabel("Death1"),
      startSound(902, { noMultiple: true, loops: 2, inPoint: 441, outPoint: 4410, envelope: [[0, 32768, 32768]] }),
      showFrame(),
      startSound(903), showFrame()
    ])
  ]);
}

test("SOUNDINFO comes back with only the fields that are set, and a plain play is empty", () => {
  const plain = Buffer.from([0x00]);
  assert.deepEqual(readSoundInfo(plain, 0, 1), {});
  const full = Buffer.concat([
    u8(0x3f), u32(441), u32(4410), u16(3), u8(1), u32(10), u16(100), u16(200)
  ]);
  assert.deepEqual(readSoundInfo(full, 0, full.length), {
    stop: true, noMultiple: true, inPoint: 441, outPoint: 4410, loops: 3, envelope: [[10, 100, 200]]
  });
  // A record that runs past its tag SAYS so rather than inventing the rest.
  assert.equal(readSoundInfo(Buffer.from([0x01, 0x00]), 0, 2).truncated, true);
});

test("the bindings are what they were — except that a SyncStop is not bound as a play", () => {
  const { bindings, startSoundCount, stopSoundCount, labelCount, unlabelled } = deriveSoundBindings(build());
  assert.deepEqual(bindings, {
    stepforward: [900, 901],
    hurt9: [902],
    death1: [902, 903]
  });
  assert.equal(startSoundCount, 5, "five plays on the fighter clip; the other sprite's is not counted");
  assert.equal(stopSoundCount, 1);
  assert.equal(labelCount, 5);
  assert.equal(unlabelled, 0);
});

test("every StartSound keeps its FRAME, as an offset into the label it fires under", () => {
  const cues = deriveSoundCues(build());
  assert.equal(cues.clip, FIGHTER);
  assert.equal(cues.clipFrames, 10);
  assert.equal(cues.frameRate, 30);
  assert.equal(cues.startSounds, 6, "every tag on the fighter clip, the stop included");
  assert.equal(cues.unlabelled, 0);
  assert.deepEqual(cues.labels.standing, { firstFrame: 1, frames: 1, sounds: [] });
  assert.deepEqual(cues.labels.stepforward, {
    firstFrame: 2,
    frames: 3,
    sounds: [
      { id: 900, frame: 2, offset: 0 },
      { id: 901, frame: 4, offset: 2 }
    ]
  });
  assert.deepEqual(cues.labels.hurt8, { firstFrame: 5, frames: 2, sounds: [] },
    "a silent entry is LISTED, because its run needs its length");
  assert.deepEqual(cues.labels.hurt9.sounds, [
    { id: 902, frame: 7, offset: 0 },
    { id: 900, stop: true, frame: 8, offset: 1 }
  ]);
  assert.deepEqual(cues.labels.death1.sounds[0], {
    id: 902, noMultiple: true, inPoint: 441, outPoint: 4410, loops: 2, envelope: [[0, 32768, 32768]], frame: 9, offset: 0
  });
});

test("the spans are the FIGURE's spans, because both come from one function", () => {
  // `extract-figure` cuts its poses with `deriveAnimations`; if the sound spans
  // were computed any other way, offset k would stop meaning pose k.
  const buffer = build();
  const cues = deriveSoundCues(buffer);
  const { characters } = indexCharacters(buffer);
  for (const animation of deriveAnimations(buffer, characters.get(FIGHTER))) {
    const entry = cues.labels[animation.name.toLowerCase()];
    assert.equal(entry.firstFrame, animation.firstFrame, animation.name);
    assert.equal(entry.frames, animation.frameCount, animation.name);
  }
});

test("the manifest carries `cues` BESIDE `bindings`, in filenames, and keeps the MP3 lead-in", () => {
  const { manifest, outputs, census, soundCount } = buildSoundManifest(build(), { fileName: "synthetic.swf" });
  assert.equal(soundCount, 4);
  assert.equal(manifest.count, 3, "the ADPCM sound is not repacked");
  assert.equal(manifest.skipped, 1);
  // The readers of `bindings` see the shape they always have.
  assert.deepEqual(manifest.bindings, {
    stepforward: ["900-step.wav.mp3", "901.mp3"],
    hurt9: ["902.mp3"],
    death1: ["902.mp3"]
  });
  assert.equal(manifest.startSoundCount, 5);
  assert.equal(manifest.stopSoundCount, 1);

  const { cues } = manifest;
  assert.equal(cues.version, 1);
  assert.equal(cues.frameRate, 30);
  assert.deepEqual(cues.labels.stepforward.sounds.map(({ file, offset }) => [file, offset]),
    [["900-step.wav.mp3", 0], ["901.mp3", 2]]);
  assert.deepEqual(cues.labels.hurt9.sounds.map(({ file, offset, stop }) => [file, offset, stop ?? false]),
    [["902.mp3", 0, false], ["900-step.wav.mp3", 1, true]]);
  assert.deepEqual(cues.labels.death1.sounds.map(({ file }) => file), ["902.mp3"],
    "the unrepackable 903 drops out of the cues exactly as it drops out of the bindings");
  assert.deepEqual(census, {
    timed: 5, stops: 1, noMultiple: 1, loops: 1, inOut: 1, envelopes: 1, truncated: 0, unfiled: 1
  });

  // `SeekSamples` survives the repack as a number, and the repack still cuts
  // exactly nine bytes: the file is the four marker bytes and nothing else.
  const byFile = new Map(manifest.sounds.map((entry) => [entry.file, entry]));
  assert.equal(byFile.get("900-step.wav.mp3").seekSamples, 1105);
  assert.equal(byFile.get("902.mp3").seekSamples, 576);
  const step = outputs.find((output) => output.name === "900-step.wav.mp3");
  assert.deepEqual([...step.bytes], [0xff, 0xfb, 900 & 0xff, 900 & 0xff]);

  // And it survives JSON, which is the form the arena reads.
  assert.deepEqual(JSON.parse(JSON.stringify(manifest)).cues, cues);
});

test("a build with no fighter clip writes no timing, and says so by a null", () => {
  const buffer = swf([defineSound(900), defineSprite(12, 1, [startSound(900), showFrame()])]);
  assert.equal(deriveSoundCues(buffer), null);
  assert.equal(buildSoundManifest(buffer).manifest.cues, null);
});
