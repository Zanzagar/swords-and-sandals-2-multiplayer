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
  let leadIn = {};
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
  function preload(files, { leadInSeconds = {} } = {}) {
    leadIn = { ...leadIn, ...leadInSeconds };
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

  /** The master gain, 0-1: a `GainNode` on Web Audio, each voice's volume otherwise. */
  function setVolume(value) {
    const next = Number(value);
    gain = Number.isFinite(next) ? Math.min(1, Math.max(0, next)) : 1;
    if (master) master.gain.value = gain;
    for (const voice of voices) if (voice.element) voice.element.volume = gain;
    return gain;
  }

  /** The sound toggle. Off also SILENCES what is sounding, not only what is next. */
  function setEnabled(on) {
    enabled = Boolean(on);
    if (!enabled) for (const voice of voices) voice.stop();
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
    setVolume,
    setEnabled,
    unlock,
    latency,
    isPlaying,
    get blocked() { return route === "webaudio" && context.state !== "running"; },
    get liveVoices() { return voices.filter(live).length; }
  });
}
