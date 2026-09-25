/**
 * The arena's SPEAKER: Web Audio when the browser has it, the old
 * `HTMLAudioElement` path when it does not, and silence when it has neither.
 *
 * A sibling of `main.js` rather than a part of it for the reason `roster.js`
 * is: `main.js` touches the DOM at load and cannot be imported by `node --test`,
 * and this file touches nothing it is not HANDED. Every browser object — the
 * `AudioContext` constructor, `fetch`, `new Audio` — arrives as an argument, so
 * the suite drives it with fakes (`test/arena-sound-player.test.js`).
 *
 * WHEN a sound fires is `src/render/sound-timing.js`'s decision, and which
 * voices survive a full house is `retireVoices`'s. This file plays.
 *
 * ## Why Web Audio, and what it fixes
 *
 * ► **EACH PLAY WAS A CLONED `<audio>` ELEMENT**, and an element is a whole
 *   media pipeline: `play()` is a promise that resolves when the element has
 *   set up its decoder and started, which is late by an amount this repository
 *   has never measured and the owner has heard ("playing at the appropriate
 *   time (no delays)"). Web Audio decodes each file ONCE, at preload, into a
 *   buffer; a play is a fresh `AudioBufferSourceNode` on that buffer, started
 *   on the next render quantum. Overlap is free — every play is its own node —
 *   and nothing is fetched or decoded at the moment of the hit.
 *
 * ► **A SOUND THAT IS NOT DECODED YET IS DROPPED, NOT PLAYED LATE.** A late
 *   footstep is the defect this replaces. It is loaded for next time and the
 *   shell is told (`onNotReady`), so a drop is counted rather than silent.
 *
 * ► **AND SO IS A SOUND FIRED WHILE THE CONTEXT IS SUSPENDED.** A browser
 *   holds a new context suspended until the page is touched. A node started on
 *   a suspended context is QUEUED, and every queued sound would play at once
 *   the moment it resumed — a burst of every hit the spectator missed. So a
 *   suspended context refuses the play and reports it (`onBlocked`), which is
 *   the banner the old path showed on a rejected `play()`.
 *
 * ## Channels: the build's `Sound(target)` clips (2026-09-24)
 *
 * The fighter's sounds are timeline `StartSound`s and go through `play`. The
 * crowd and the stings are AS2 `Sound` objects on a TARGET CLIP, and in AS2 the
 * sounds on one target share its volume and its no-argument `stop()` — which
 * is why the build's cheer plays at the crowd's live volume. `channel(name)`
 * is that clip: its own gain under the master, `start`, an idempotent `loop`,
 * `stop` for everything on it, and `setVolume`. Its voices are kept apart from
 * the clip voices, so sixteen footsteps can never evict the crowd's loop.
 * `perform` runs one of `src/render/crowd-sound.js`'s actions on them.
 */

import { retireVoices } from "../../src/render/arena-shell.js";
import { leadInFramesFor, voiceActionFor } from "../../src/render/sound-timing.js";

/** How many voices may sound at once — the cap the old path had. */
export const SOUND_VOICES = 16;

/** Timed retries of a TRANSIENT load failure, and the first backoff (doubling). */
export const LOAD_RETRIES = 3;
export const LOAD_BACKOFF_MS = 500;

/**
 * @param {object} options
 * @param {Function|null} options.AudioContextCtor  `window.AudioContext`, or null
 * @param {Function|null} options.fetchImpl         `fetch`, needed by Web Audio
 * @param {Function|null} options.createAudio       `(url) => new Audio(url)`,
 *   the fallback when there is no `AudioContext`
 * @param {Function} [options.onBlocked]   the browser is holding sound back
 * @param {Function} [options.onNotReady]  a sound fired before it was decoded
 * @param {Function} [options.schedule]    `(callback, ms)`, a timer for load retries
 */
export function createSoundPlayer({
  AudioContextCtor = null,
  fetchImpl = null,
  createAudio = null,
  baseUrl = "/assets/sound/",
  voiceLimit = SOUND_VOICES,
  onBlocked = () => {},
  onNotReady = () => {},
  // Injected for the same reason `fetchImpl` is: the suite fires it by hand.
  schedule = (callback, ms) => globalThis.setTimeout(callback, ms)
} = {}) {
  let context = null;
  let master = null;
  if (typeof AudioContextCtor === "function" && typeof fetchImpl === "function") {
    try {
      context = new AudioContextCtor({ latencyHint: "interactive" });
      master = context.createGain();
      master.connect(context.destination);
    } catch {
      // A browser that refuses the constructor (or a sandbox with no audio
      // device) takes the element path rather than no sound at all.
      context = null;
      master = null;
    }
  }
  const route = context ? "webaudio" : (typeof createAudio === "function" ? "htmlaudio" : "silent");

  const buffers = new Map();   // file -> { buffer, offset }
  const loading = new Map();   // file -> Promise
  const failed = new Map();    // file -> { attempts }, until it loads or a preload clears it
  const spent = new Map();     // file -> failed attempts against the current retry budget
  const elements = new Map();  // file -> the preloaded element the fallback clones
  const channels = new Map();  // name -> { name, node, gain, voices, handle }
  let leadIn = {};
  let lengths = {};            // file -> seconds of audio, so a loop ends on the sound
  let voices = [];
  let gain = 1;
  let enabled = true;

  const urlFor = (file) => `${baseUrl}${encodeURIComponent(file)}`;

  /**
   * ► **A FAILED LOAD USED TO BE FAILED FOR THE WHOLE SESSION** — found by a
   *   Codex review (gpt-6-astra) of this file's first version: one dropped
   *   connection during preload silenced those effects until a reload.
   *
   *   The rule now: a TRANSIENT failure — the fetch rejecting, an HTTP 5xx,
   *   408 or 429, or the body failing to arrive — is retried on its own, up to
   *   `LOAD_RETRIES` times, `LOAD_BACKOFF_MS` doubling. A PERMANENT one — any
   *   other HTTP error (a 404 is a file that is not there) or a file that
   *   arrived and would not decode — is not retried on a timer, and a play
   *   does not restart any failed load. An explicit `preload` clears every
   *   failure and starts afresh. A cue fired while its file is missing is
   *   still DROPPED, never played when the file arrives.
   */
  function transient(error) {
    return Boolean(error?.transient);
  }

  function decode(file, { fresh = false, retry = null } = {}) {
    if (buffers.has(file)) return Promise.resolve(true);
    // ► **AN EXPLICIT PRELOAD RESETS THE BUDGET BEFORE IT JOINS A FETCH IN
    //   FLIGHT** — found by Codex pass 2 (gpt-6-astra). The guard below used
    //   to return first, and the running job kept the attempt count it had
    //   captured, so a preload during the LAST retry changed nothing and the
    //   file stayed silent. The count now lives in `spent`, which the job
    //   reads when it FINISHES, so a reset here reaches it.
    if (fresh) {
      failed.delete(file);
      spent.delete(file);
    }
    // One fetch per file at a time, whoever asks.
    if (loading.has(file)) return loading.get(file);
    if (!fresh && failed.has(file) && failed.get(file) !== retry) return Promise.resolve(false);
    const job = Promise.resolve()
      .then(() => fetchImpl(urlFor(file)))
      .then(
        (response) => {
          if (!response?.ok) {
            const status = response?.status;
            const error = new Error(`HTTP ${status}`);
            error.transient = status >= 500 || status === 408 || status === 429;
            throw error;
          }
          return response.arrayBuffer().catch((error) => {
            // The body was cut off in transit: the network, not the file.
            throw Object.assign(new Error(String(error?.message ?? error)), { transient: true });
          });
        },
        (error) => {
          // `fetch` itself rejected: no response at all, which is the network.
          throw Object.assign(new Error(String(error?.message ?? error)), { transient: true });
        }
      )
      .then((bytes) => context.decodeAudioData(bytes))
      .then((buffer) => {
        // Skip the MP3 lead-in the build skips — but only where it is silent.
        // See `leadInFramesFor` for why both halves of that matter.
        const channels = [];
        for (let index = 0; index < (buffer.numberOfChannels ?? 0); index += 1) channels.push(buffer.getChannelData(index));
        const frames = leadInFramesFor(channels, buffer.sampleRate, leadIn[file] ?? 0);
        buffers.set(file, { buffer, offset: frames > 0 ? frames / buffer.sampleRate : 0 });
        failed.delete(file);
        spent.delete(file);
        return true;
      })
      .catch((error) => {
        // Read NOW, not when the job started: a preload in between reset it.
        const attempts = (spent.get(file) ?? 0) + 1;
        spent.set(file, attempts);
        const record = { attempts };
        // Kept failed until the timer fires: a play in the meantime is
        // dropped and does not jump the backoff.
        failed.set(file, record);
        if (transient(error) && attempts <= LOAD_RETRIES) {
          // The record's identity is the guard: an explicit preload in the
          // meantime replaces it, and this timer then does nothing.
          schedule(() => {
            if (failed.get(file) === record) decode(file, { retry: record });
          }, LOAD_BACKOFF_MS * 2 ** (attempts - 1));
        }
        return false;
      })
      .finally(() => { if (loading.get(file) === job) loading.delete(file); });
    loading.set(file, job);
    return job;
  }

  function element(file) {
    let source = elements.get(file);
    if (!source) {
      source = createAudio(urlFor(file));
      source.preload = "auto";
      // `load()` is what actually starts it; `preload` alone is a hint the
      // browser may ignore for an element that is not in the document.
      try { source.load(); } catch { /* a browser that refuses still plays later */ }
      elements.set(file, source);
    }
    return source;
  }

  /**
   * Fetch and decode every file before it is needed. Resolves to how many are
   * ready, so the shell can say so.
   */
  function preload(files, { leadInSeconds = {}, lengthSeconds = {} } = {}) {
    leadIn = { ...leadIn, ...leadInSeconds };
    lengths = { ...lengths, ...lengthSeconds };
    const unique = [...new Set([...(files ?? [])].filter((file) => typeof file === "string" && file.length > 0))];
    if (route === "webaudio") {
      // EXPLICIT, so every earlier failure is cleared and tried afresh.
      return Promise.all(unique.map((file) => decode(file, { fresh: true }))).then((results) => ({
        requested: unique.length,
        ready: results.filter(Boolean).length,
        trimmed: unique.filter((file) => (buffers.get(file)?.offset ?? 0) > 0).length
      }));
    }
    if (route === "htmlaudio") for (const file of unique) element(file);
    return Promise.resolve({ requested: unique.length, ready: route === "htmlaudio" ? unique.length : 0, trimmed: 0 });
  }

  const live = (voice) => voice && !voice.ended && !voice.paused;

  function isPlaying(file) {
    return voices.some((voice) => voice.file === file && live(voice));
  }

  /** WHICH voices survive is `retireVoices`'s decision; stopping them is here. */
  function makeRoom() {
    const { keep, evict } = retireVoices(voices, voiceLimit);
    for (const spent of evict) spent.stop();
    voices = keep;
  }

  function playBuffer(file) {
    if (context.state !== "running") {
      onBlocked();
      return "blocked";
    }
    const decoded = buffers.get(file);
    if (!decoded) {
      decode(file);
      onNotReady(file);
      return "not-ready";
    }
    makeRoom();
    const source = context.createBufferSource();
    source.buffer = decoded.buffer;
    source.connect(master);
    const voice = {
      file,
      ended: false,
      paused: false,
      stop() {
        if (this.ended || this.paused) return;
        this.paused = true;
        try { source.stop(); } catch { /* already stopped */ }
      }
    };
    source.onended = () => { voice.ended = true; };
    source.start(0, decoded.offset);
    voices.push(voice);
    return "played";
  }

  function playElement(file) {
    const clone = element(file).cloneNode();
    clone.volume = gain;
    makeRoom();
    const voice = {
      file,
      element: clone,
      get ended() { return clone.ended; },
      get paused() { return clone.paused; },
      stop() { try { clone.pause(); } catch { /* already gone */ } }
    };
    voices.push(voice);
    let played;
    try {
      played = clone.play();
    } catch {
      onBlocked();
      return "blocked";
    }
    // NotAllowedError until the page is interacted with.
    if (played && typeof played.catch === "function") played.catch(() => onBlocked());
    return "played";
  }

  /**
   * Sound one cue: play it, skip it, or stop its file, by the build's own
   * `SOUNDINFO` flags. Returns what happened, as a word the shell may log.
   */
  function play(cue) {
    if (!enabled) return "off";
    const action = voiceActionFor(cue, isPlaying);
    if (action === "stop") {
      for (const voice of voices) if (voice.file === cue.file) voice.stop();
      return "stopped";
    }
    if (action === "skip") return "skipped";
    if (route === "webaudio") return playBuffer(cue.file);
    if (route === "htmlaudio") return playElement(cue.file);
    return "silent";
  }

  /* ---------------------------------------------------------------- */
  /* Channels: the build's `Sound(target)` clips                       */
  /* ---------------------------------------------------------------- */

  /**
   * Where a loop ends, in buffer seconds: the sound's own length after the
   * lead-in the decode skipped, so the MP3's trailing padding is not looped as
   * a gap every pass. The buffer's end when the pack does not say.
   *
   * ► **`loopEnd` IS NEVER LEFT AT 0 WITH A LEAD-IN.** Web Audio loops the
   *   WHOLE buffer, from 0, when `loopEnd` is not past `loopStart` — which would
   *   loop the very silence the start skipped.
   */
  function loopEndFor(decoded, seconds) {
    const duration = Number(decoded.buffer?.duration);
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    if (!(seconds > 0)) return duration;
    const end = decoded.offset + seconds;
    return end > decoded.offset && end < duration ? end : duration;
  }

  /** A channel's voices over the cap are retired; its LOOPS never are. */
  function makeRoomOn(entry) {
    const loops = entry.voices.filter((voice) => voice.loop && live(voice));
    const { keep, evict } = retireVoices(entry.voices.filter((voice) => !voice.loop), voiceLimit);
    for (const spent of evict) spent.stop();
    entry.voices = [...loops, ...keep];
  }

  function startBufferOn(entry, file, loop) {
    if (context.state !== "running") {
      onBlocked();
      return "blocked";
    }
    const decoded = buffers.get(file);
    if (!decoded) {
      decode(file);
      // A loop is asked for again on every draw and starts once it is ready;
      // only a one-shot is a drop worth saying.
      if (!loop) onNotReady(file);
      return "not-ready";
    }
    makeRoomOn(entry);
    const source = context.createBufferSource();
    source.buffer = decoded.buffer;
    if (loop) {
      source.loop = true;
      source.loopStart = decoded.offset;
      source.loopEnd = loopEndFor(decoded, lengths[file]);
    }
    source.connect(entry.node ?? master);
    const voice = {
      file,
      loop,
      ended: false,
      paused: false,
      stop() {
        if (this.ended || this.paused) return;
        this.paused = true;
        try { source.stop(); } catch { /* already stopped */ }
      }
    };
    source.onended = () => { voice.ended = true; };
    source.start(0, decoded.offset);
    entry.voices.push(voice);
    return "played";
  }

  /**
   * ► **AN ELEMENT'S PLAY IS NOT PLAYED UNTIL ITS PROMISE SAYS SO** — found by
   *   a Codex review (gpt-6-astra). This returned `"played"` at once and an
   *   autoplay rejection only raised the banner, so a caller that settles on
   *   the answer (the intro) counted a sound nobody heard. It is `"pending"`
   *   now, and `onSettle` gets the promise's answer: `"played"`, or
   *   `"blocked"` on a rejection. A play with no promise is played.
   */
  function startElementOn(entry, file, loop, onSettle) {
    const clone = element(file).cloneNode();
    clone.loop = loop;
    clone.volume = gain * entry.gain;
    makeRoomOn(entry);
    const voice = {
      file,
      loop,
      element: clone,
      get ended() { return clone.ended; },
      get paused() { return clone.paused; },
      stop() { try { clone.pause(); } catch { /* already gone */ } }
    };
    entry.voices.push(voice);
    let played;
    try {
      played = clone.play();
    } catch {
      onBlocked();
      return "blocked";
    }
    if (!played || typeof played.then !== "function") return "played";
    const settle = typeof onSettle === "function" ? onSettle : () => {};
    played.then(() => settle("played"), () => {
      onBlocked();
      settle("blocked");
    });
    return "pending";
  }

  function startOn(entry, file, { loop = false, onSettle = null } = {}) {
    if (!enabled) return "off";
    if (typeof file !== "string" || file.length === 0) return "skipped";
    if (route === "webaudio") return startBufferOn(entry, file, Boolean(loop));
    if (route === "htmlaudio") return startElementOn(entry, file, Boolean(loop), onSettle);
    return "silent";
  }

  /** Start `file` looping unless it already is: asked every draw, so it comes back after the toggle. */
  function loopOn(entry, file) {
    if (typeof file !== "string" || file.length === 0) return "skipped";
    if (entry.voices.some((voice) => voice.loop && voice.file === file && live(voice))) return "looping";
    return startOn(entry, file, { loop: true });
  }

  /** AS2's no-argument `stop()` on a targeted `Sound`: everything on the clip. */
  function stopOn(entry) {
    let stopped = 0;
    for (const voice of entry.voices) {
      if (live(voice)) stopped += 1;
      voice.stop();
    }
    entry.voices = [];
    return stopped;
  }

  /** The clip's volume, 0-1, under the master: every voice on it, sounding and to come. */
  function volumeOn(entry, value) {
    const next = Number(value);
    entry.gain = Number.isFinite(next) ? Math.min(1, Math.max(0, next)) : 1;
    if (entry.node) entry.node.gain.value = entry.gain;
    for (const voice of entry.voices) if (voice.element) voice.element.volume = gain * entry.gain;
    return entry.gain;
  }

  /** The named channel, made on first use and kept. */
  function channel(name) {
    const key = String(name);
    const existing = channels.get(key);
    if (existing) return existing.handle;
    const entry = { name: key, node: null, gain: 1, voices: [], handle: null };
    if (context) {
      try {
        entry.node = context.createGain();
        entry.node.connect(master);
      } catch {
        entry.node = null;
      }
    }
    entry.handle = Object.freeze({
      name: key,
      start: (file, options) => startOn(entry, file, options),
      loop: (file) => loopOn(entry, file),
      stop: () => stopOn(entry),
      setVolume: (value) => volumeOn(entry, value),
      isLooping: (file) => entry.voices.some((voice) => voice.loop && voice.file === file && live(voice)),
      get volume() { return entry.gain; },
      get liveVoices() { return entry.voices.filter(live).length; }
    });
    channels.set(key, entry);
    return entry.handle;
  }

  /**
   * Run one of `arenaSoundStep`'s actions (`src/render/crowd-sound.js`) and
   * say what happened, as a word the shell may log or settle on. A `"pending"`
   * start (the element fallback) calls `onSettle` later with its real answer.
   */
  function perform(action, onSettle = null) {
    if (!action || typeof action !== "object") return "skipped";
    const target = channel(action.channel ?? "default");
    switch (action.kind) {
      case "volume":
        target.setVolume(action.gain);
        return "set";
      case "loop":
        return target.loop(action.file);
      case "start":
        return target.start(action.file, { onSettle });
      case "stop":
        target.stop();
        return "stopped";
      default:
        return "skipped";
    }
  }

  /** The master gain, 0-1: a `GainNode` on Web Audio, each voice's volume otherwise. */
  function setVolume(value) {
    const next = Number(value);
    gain = Number.isFinite(next) ? Math.min(1, Math.max(0, next)) : 1;
    if (master) master.gain.value = gain;
    for (const voice of voices) if (voice.element) voice.element.volume = gain;
    for (const entry of channels.values()) {
      for (const voice of entry.voices) if (voice.element) voice.element.volume = gain * entry.gain;
    }
    return gain;
  }

  /**
   * The sound toggle. Off also SILENCES what is sounding, not only what is
   * next — the channels' voices and loops too. A loop comes back on the next
   * draw after the toggle is on again, because the shell asks for it on every
   * draw (`loop` is idempotent).
   */
  function setEnabled(on) {
    enabled = Boolean(on);
    if (!enabled) {
      for (const voice of voices) voice.stop();
      for (const entry of channels.values()) stopOn(entry);
    }
    return enabled;
  }

  /**
   * Resume a suspended context — call from a user gesture, which is the only
   * place a browser allows it. Resolves true when sound can play.
   */
  function unlock() {
    if (!context) return Promise.resolve(true);
    if (context.state === "running") return Promise.resolve(true);
    try {
      return Promise.resolve(context.resume()).then(() => context.state === "running", () => false);
    } catch {
      return Promise.resolve(false);
    }
  }

  /** The context's own latency figures in seconds, or null on the fallback. */
  function latency() {
    if (!context) return null;
    return {
      base: Number.isFinite(context.baseLatency) ? context.baseLatency : null,
      output: Number.isFinite(context.outputLatency) ? context.outputLatency : null
    };
  }

  return Object.freeze({
    route,
    preload,
    play,
    channel,
    perform,
    setVolume,
    setEnabled,
    unlock,
    latency,
    isPlaying,
    get blocked() { return route === "webaudio" && context.state !== "running"; },
    get liveVoices() { return voices.filter(live).length; }
  });
}
