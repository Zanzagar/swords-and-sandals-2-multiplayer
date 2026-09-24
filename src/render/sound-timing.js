/**
 * WHEN a running animation's sounds fire — at the DRAWN pose the build starts
 * each one on — and which the shell should play, skip or stop when it does.
 *
 * `sound.js` decides WHICH file a family's animation plays when all a pack
 * carries is `bindings`. This module is the step past it: with the frame
 * timing `tools/extract-sounds.mjs` now writes beside the bindings (`cues`),
 * the build's own timeline decides, and there is nothing left to choose.
 *
 * ## The rule
 *
 * ```text
 *   run       = clipSequenceFor(label)            hurt8 -> [hurt8, hurt9]
 *   poseIndex = sum(frames of the run's earlier members) + the cue's offset
 *   poseCount = sum(frames of every member), cut to a SHORT_RUNS stop
 *   fires     when poseIndexAt(poseCount, at) >= poseIndex
 * ```
 *
 * `poseIndexAt` is the DRAWING's own function — `extracted-figure.js` picks the
 * pose it paints with exactly this arithmetic — so a sound starts on the frame
 * the figure is showing when it starts, not a frame computed beside it. The
 * blood the clip throws fires by the same comparison (`effectsForAnimation`,
 * `renderStage`), and that is deliberate: the build fires both off the frame.
 *
 * Everything that delays the DRAWING therefore delays the sound with it: a
 * fireball's or an arrow's victim reacts at impact (`reactionDelaysFor`), and
 * its hurt is heard where its hurt is seen. A clip cut short before its frame
 * never reaches the pose, and the sound never fires — which is the build too:
 * a `gotoAndPlay` elsewhere leaves the old run's later tags unplayed.
 *
 * ## What the build does that `chooseSound` could not
 *
 * ► **EVERY `StartSound` IN THE RUN FIRES, NOT ONE OF THEM.** 19 of the
 *   shipped build's 80 bound labels carry two tags — `stepforward` both `706`
 *   and `1088`, `death1` both `1103` and `1104` — and `chooseSound` played one,
 *   by sequence number, because a list of files read like a list of
 *   alternatives. With timing there is no choice: each tag is its own cue at
 *   its own frame.
 *
 * ## The fallback, and why it is not an error
 *
 * A pack extracted before the timing existed has `bindings` and no `cues`.
 * `soundTimingFrom` returns null for it and `soundCuesFor` falls back to
 * `chooseSound`'s one file at pose 0 — the old behaviour exactly, played
 * through the same clock — so an old pack is quieter and earlier than the
 * build, never broken. The shell says ONCE that the pack is old.
 */

import { chooseSound, soundLabelsFor } from "./sound.js";
import { clipSequenceFor, shortRunFramesFor } from "./clip-sequences.js";
import { directionalLabel } from "./clip-labels.js";
import { poseIndexAt } from "./extracted-figure.js";

/**
 * HOW LATE A CUE MAY BE AND STILL PLAY, in milliseconds.
 *
 * A cue is due when its pose is drawn, and a draw loop at 60 fps reaches it
 * within ~17 ms. Past this bound the cue is DROPPED rather than played: a tab
 * that returns from the background finds every running clip long finished, and
 * sounding all of their cues at once would be a burst of noise for things that
 * happened out of sight. 200 ms is six of the build's 30 fps frames — later
 * than that, a footstep is audibly not the foot's.
 */
export const SOUND_STALE_MS = 200;

const SILENT = Object.freeze({ label: null, timed: false, poseCount: 1, cues: Object.freeze([]) });

/**
 * The timing table out of a manifest, or null for a pack that has none.
 *
 * Total rather than throwing, for `bindingsFrom`'s reason: a missing,
 * truncated or hand-edited manifest must leave the arena playing, never broken.
 * An entry that cannot be used is dropped; a table with no usable entry at all
 * is null, which is "an old pack" to every caller.
 */
export function soundTimingFrom(manifest) {
  const labels = manifest?.cues?.labels;
  if (!labels || typeof labels !== "object") return null;
  const clean = {};
  for (const [key, entry] of Object.entries(labels)) {
    const frames = entry?.frames;
    if (!Number.isInteger(frames) || frames < 1) continue;
    const sounds = [];
    for (const sound of Array.isArray(entry.sounds) ? entry.sounds : []) {
      if (typeof sound?.file !== "string" || sound.file.length === 0) continue;
      if (!Number.isInteger(sound.offset) || sound.offset < 0) continue;
      // A record the extractor could not read to its end is not a plain play.
      if (sound.truncated) continue;
      sounds.push(Object.freeze({
        file: sound.file,
        offset: sound.offset,
        stop: sound.stop === true,
        noMultiple: sound.noMultiple === true,
        // Carried, not honoured: see `unhonouredCuesIn`.
        loops: Number.isInteger(sound.loops) ? sound.loops : null,
        inPoint: Number.isInteger(sound.inPoint) ? sound.inPoint : null,
        outPoint: Number.isInteger(sound.outPoint) ? sound.outPoint : null,
        envelope: Array.isArray(sound.envelope) && sound.envelope.length > 0
      }));
    }
    sounds.sort((left, right) => left.offset - right.offset);
    clean[key.toLowerCase()] = Object.freeze({ frames, sounds: Object.freeze(sounds) });
  }
  if (Object.keys(clean).length === 0) return null;
  const frameRate = Number(manifest.cues.frameRate);
  return Object.freeze({
    labels: Object.freeze(clean),
    frameRate: Number.isFinite(frameRate) && frameRate > 0 ? frameRate : null
  });
}

/**
 * How many timed cues ask for something the arena does not do — a loop count
 * above one, an in or out point, a volume envelope — so the shell can say so
 * once instead of a player hearing it. Zero on a pack that carries none.
 */
export function unhonouredCuesIn(timing) {
  let count = 0;
  for (const entry of Object.values(timing?.labels ?? {})) {
    for (const sound of entry.sounds) {
      if ((sound.loops ?? 0) > 1 || sound.inPoint !== null || sound.outPoint !== null || sound.envelope) count += 1;
    }
  }
  return count;
}

/**
 * The seconds of MP3 lead-in to skip per file: `SeekSamples` over the sound's
 * own rate. The build skips them; a browser decoding the repacked frames plays
 * them as silence before the sound. Files with none, or a pack that predates
 * the field, are simply absent.
 */
export function leadInSecondsFrom(manifest) {
  const out = {};
  for (const sound of Array.isArray(manifest?.sounds) ? manifest.sounds : []) {
    const { file, seekSamples, rate } = sound ?? {};
    if (typeof file !== "string" || !(seekSamples > 0) || !(rate > 0)) continue;
    out[file] = seekSamples / rate;
  }
  return Object.freeze(out);
}

/**
 * How many decoded frames to skip at the start of a buffer: its leading
 * SILENCE, and never more than the build's own `SeekSamples` lead-in.
 *
 * ► **THE CAP AND THE SILENCE TEST ARE BOTH LOAD-BEARING.** The build skips
 *   `SeekSamples` of its own decoder's output. A browser's MP3 decoder may
 *   already trim some of that delay itself, and whether it does is not
 *   something this repository has measured — so skipping the full count
 *   blindly could cut the ATTACK off a hit, which is worse than the delay it
 *   removes. Skipping only what is silent, up to the build's count, takes the
 *   lead-in away where it is there and cuts nothing where it is not.
 *
 * @param {ArrayLike<number>[]} channels  the decoded channel data
 * @param {number} sampleRate              the DECODED rate, which is the
 *                                         context's, not the file's
 * @param {number} capSeconds              `leadInSecondsFrom`'s value
 */
export function leadInFramesFor(channels, sampleRate, capSeconds, { threshold = 1 / 1024 } = {}) {
  if (!Array.isArray(channels) || channels.length === 0) return 0;
  if (!(sampleRate > 0) || !(capSeconds > 0)) return 0;
  const length = Math.min(...channels.map((channel) => channel?.length ?? 0));
  const cap = Math.min(length, Math.floor(capSeconds * sampleRate));
  for (let frame = 0; frame < cap; frame += 1) {
    for (const channel of channels) {
      if (Math.abs(channel[frame]) > threshold) return frame;
    }
  }
  return cap;
}

/**
 * The build label whose run is SOUNDED for this timeline — the one the figure
 * is drawing.
 *
 * Mirrors `animationFor`'s candidate order in `extracted-figure.js` so sound
 * and art resolve the same label: the engine's own label when it belongs to the
 * family, else the facing's clip for a directional gait (a walk has no
 * `walkleft` clip; it steps FORWARD or BACK), else the family's first. The
 * drawing's own answer, when the shell has one, wins over all three.
 *
 * Membership is through `soundLabelsFor`, not `clipLabelsFor`, so the idle and
 * a held stance stay silent for the reason `sound.js` gives.
 */
export function soundLabelFor(family, { label = null, facing = "right", drawnLabel = null } = {}) {
  if (typeof family !== "string") return null;
  const labels = soundLabelsFor(family);
  if (labels.length === 0) return null;
  const drawn = typeof drawnLabel === "string" ? drawnLabel.toLowerCase() : null;
  if (drawn && labels.includes(drawn)) return drawn;
  const own = typeof label === "string" ? label.toLowerCase() : null;
  if (own && labels.includes(own)) return own;
  const preferred = directionalLabel(family, label, facing);
  if (preferred && labels.includes(preferred)) return preferred;
  return labels[0];
}

/**
 * EVERY sound one timeline will fire, each at the pose it fires on.
 *
 * Returns `{label, timed, poseCount, cues}`, where each cue is
 * `{file, poseIndex, stop, noMultiple}` and `cues` is in pose order. `timed`
 * is false on the fallback, whose single cue sits at pose 0.
 *
 * @param {{bindings?: object, timing?: object|null}} sound  the two tables
 * @param {object} options  `family` and `label` from the timeline, the
 *   `facing` the figure is DRAWN with, the `sequence` `chooseSound` spreads
 *   by, and the drawing's own resolved label when there is one
 */
export function soundCuesFor({ bindings = null, timing = null } = {}, {
  family, label = null, facing = "right", sequence = 0, drawnLabel = null
} = {}) {
  if (timing?.labels) {
    const entry = soundLabelFor(family, { label, facing, drawnLabel });
    if (!entry) return SILENT;
    const cues = [];
    let base = 0;
    let complete = true;
    for (const member of clipSequenceFor(entry)) {
      const timed = timing.labels[member];
      // A member the table does not know means a table from some other build:
      // its offsets would be offsets into nothing. Fall back rather than guess.
      if (!timed) { complete = false; break; }
      for (const sound of timed.sounds) {
        cues.push(Object.freeze({
          file: sound.file,
          poseIndex: base + sound.offset,
          stop: sound.stop,
          noMultiple: sound.noMultiple
        }));
      }
      base += timed.frames;
    }
    if (complete) {
      // A run the build STOPS early plays fewer frames than its span, and a
      // tag past the stop is never reached: it is not a cue at all.
      const short = shortRunFramesFor(entry);
      const poseCount = short === null ? base : Math.min(base, short);
      return Object.freeze({
        label: entry,
        timed: true,
        poseCount,
        cues: Object.freeze(cues.filter((cue) => cue.poseIndex < poseCount).sort((left, right) => left.poseIndex - right.poseIndex))
      });
    }
  }
  const file = chooseSound(bindings, family, sequence, label);
  if (!file) return SILENT;
  return Object.freeze({
    label: null,
    timed: false,
    poseCount: 1,
    cues: Object.freeze([Object.freeze({ file, poseIndex: 0, stop: false, noMultiple: false })])
  });
}

/**
 * The cues that fire NOW, given how far through its schedule the timeline is.
 *
 * `fired` is how many of the plan's cues have already been handled — the
 * shell's one piece of state per timeline, because cues fire in pose order and
 * a draw loop only moves forward. A cue whose pose is drawn and whose moment
 * is more than `staleMs` gone is DROPPED, not played (see `SOUND_STALE_MS`),
 * and still counted as handled so it can never fire later.
 *
 * `elapsedMs` below zero is a clip that has not begun — a victim waiting for
 * its impact — and nothing is due.
 *
 * @returns {{due: object[], dropped: object[], fired: number}}
 */
export function dueSoundCues(plan, { elapsedMs, durationMs, fired = 0, staleMs = SOUND_STALE_MS } = {}) {
  const cues = Array.isArray(plan?.cues) ? plan.cues : [];
  const start = Number.isInteger(fired) && fired > 0 ? fired : 0;
  if (start >= cues.length || !Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return { due: [], dropped: [], fired: Math.min(start, cues.length) };
  }
  const duration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
  const poseCount = Number.isInteger(plan.poseCount) && plan.poseCount > 0 ? plan.poseCount : 1;
  // The SAME `at` the draw loop computes, and the same pose it paints.
  const at = duration > 0 ? Math.min(1, elapsedMs / duration) : 1;
  const drawn = poseIndexAt(poseCount, at);
  const due = [];
  const dropped = [];
  let next = start;
  while (next < cues.length && cues[next].poseIndex <= drawn) {
    const cue = cues[next];
    // When the build would have started it, on this schedule.
    const cueMs = duration * (cue.poseIndex / poseCount);
    if (elapsedMs - cueMs > staleMs) dropped.push(cue);
    else due.push(cue);
    next += 1;
  }
  return { due, dropped, fired: next };
}

/**
 * What the shell does with one cue: `play` it, `skip` it, or `stop` its file.
 *
 * Two `SOUNDINFO` flags decide WHETHER a sound is heard, so both are honoured:
 * `SyncStop` makes the tag a stop, and `SyncNoMultiple` does not start a sound
 * that is already playing. `isPlaying(file)` is the shell's answer, because
 * only it holds the voices.
 */
export function voiceActionFor(cue, isPlaying = () => false) {
  if (!cue || typeof cue.file !== "string") return "skip";
  if (cue.stop) return "stop";
  if (cue.noMultiple && isPlaying(cue.file)) return "skip";
  return "play";
}
