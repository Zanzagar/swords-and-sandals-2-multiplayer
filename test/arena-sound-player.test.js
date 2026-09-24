/**
 * The arena's speaker (`tools/arena/sound-player.js`), driven with FAKE
 * browser objects — an `AudioContext`, `fetch` and `Audio` — because it is
 * handed every one of them rather than reaching for a global.
 *
 * What a fake cannot tell is how LATE a real browser is: the Web Audio path
 * removes the per-play element set-up and decode, and the arena logs the
 * context's own `baseLatency` and `outputLatency` once it runs, but nothing
 * here measures a speaker. What these pin is the POLICY: one decode per file,
 * a fresh source per play, the voice cap, nothing queued on a suspended
 * context, nothing played late, the toggle, the master gain and the fallback.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { SOUND_VOICES, createSoundPlayer } from "../tools/arena/sound-player.js";

/** A decoded buffer: `silentFrames` of silence, then sound, at 1000 Hz. */
function fakeBuffer({ silentFrames = 0, length = 1000, sampleRate = 1000 } = {}) {
  const data = new Float32Array(length);
  data.fill(0.5, silentFrames);
  return { numberOfChannels: 1, sampleRate, length, duration: length / sampleRate, getChannelData: () => data };
}

class FakeContext {
  constructor(options) {
    this.options = options;
    this.state = "suspended";
    this.destination = { kind: "destination" };
    this.sources = [];
    this.decoded = [];
    this.baseLatency = 0.005;
    this.outputLatency = 0.021;
    this.gains = [];
  }

  createGain() {
    const node = { gain: { value: 1 }, connect(target) { node.target = target; } };
    this.gains.push(node);
    return node;
  }

  createBufferSource() {
    const source = {
      buffer: null,
      onended: null,
      stopped: false,
      connect(target) { source.target = target; },
      start(when, offset) { source.started = { when, offset }; },
      stop() { source.stopped = true; }
    };
    this.sources.push(source);
    return source;
  }

  decodeAudioData(bytes) {
    this.decoded.push(bytes.url);
    return Promise.resolve(fakeBuffer(bytes.shape));
  }

  resume() {
    this.state = "running";
    return Promise.resolve();
  }
}

/** A `fetch` that serves every URL, counting, with a buffer shape per file. */
function fakeFetch(shapes = {}) {
  const calls = [];
  const fetchImpl = (url) => {
    calls.push(url);
    const file = decodeURIComponent(url.split("/").pop());
    return Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve({ url, shape: shapes[file] }) });
  };
  return { fetchImpl, calls };
}

function webAudioPlayer(options = {}) {
  let context = null;
  const blocked = [];
  const notReady = [];
  const { fetchImpl, calls } = fakeFetch(options.shapes);
  const player = createSoundPlayer({
    AudioContextCtor: class extends FakeContext {
      constructor(init) { super(init); context = this; }
    },
    fetchImpl,
    createAudio: () => { throw new Error("the element path must not be taken while Web Audio is there"); },
    onBlocked: () => blocked.push(true),
    onNotReady: (file) => notReady.push(file),
    ...options.player
  });
  return { player, context, blocked, notReady, fetchCalls: calls };
}

const cue = (file, extra = {}) => ({ file, poseIndex: 0, stop: false, noMultiple: false, ...extra });

test("the route is Web Audio when there is a context, the element when there is not, else silence", () => {
  assert.equal(webAudioPlayer().player.route, "webaudio");
  assert.equal(webAudioPlayer().context.options.latencyHint, "interactive");
  assert.equal(createSoundPlayer({ createAudio: () => ({}) }).route, "htmlaudio");
  assert.equal(createSoundPlayer({ AudioContextCtor: FakeContext, createAudio: () => ({}) }).route, "htmlaudio",
    "Web Audio needs `fetch` to load its buffers");
  assert.equal(createSoundPlayer({}).route, "silent");
  const refusing = createSoundPlayer({
    AudioContextCtor: class { constructor() { throw new Error("no audio device"); } },
    fetchImpl: () => null,
    createAudio: () => ({})
  });
  assert.equal(refusing.route, "htmlaudio", "a context that refuses to exist falls back rather than going silent");
  assert.equal(SOUND_VOICES, 16, "the cap the element path had");
});

test("each file is fetched and DECODED ONCE, at preload — never at the moment of the hit", async () => {
  const { player, context, fetchCalls } = webAudioPlayer();
  const report = await player.preload(["a.mp3", "b c.mp3", "a.mp3", "", null]);
  assert.deepEqual(report, { requested: 2, ready: 2, trimmed: 0 });
  assert.deepEqual(fetchCalls, ["/assets/sound/a.mp3", "/assets/sound/b%20c.mp3"]);
  await player.preload(["a.mp3"]);
  assert.equal(fetchCalls.length, 2, "a second preload decodes nothing again");
  await player.unlock();
  for (let index = 0; index < 5; index += 1) player.play(cue("a.mp3"));
  assert.equal(fetchCalls.length, 2, "and neither does any play");
  assert.equal(context.decoded.length, 2);
});

test("A SUSPENDED CONTEXT REFUSES THE PLAY rather than queueing it for a burst on resume", async () => {
  const { player, context, blocked } = webAudioPlayer();
  await player.preload(["a.mp3"]);
  assert.equal(player.blocked, true);
  assert.equal(player.play(cue("a.mp3")), "blocked");
  assert.equal(context.sources.length, 0, "no node was started to be released later");
  assert.equal(blocked.length, 1);
  assert.equal(await player.unlock(), true, "the gesture's resume");
  assert.equal(player.blocked, false);
  assert.equal(player.play(cue("a.mp3")), "played");
});

test("every play is its OWN source node on the shared buffer, through the master gain — overlap is free", async () => {
  const { player, context } = webAudioPlayer();
  await player.preload(["a.mp3"]);
  await player.unlock();
  player.play(cue("a.mp3"));
  player.play(cue("a.mp3"));
  assert.equal(context.sources.length, 2);
  const [first, second] = context.sources;
  assert.notEqual(first, second);
  assert.equal(first.buffer, second.buffer, "one decode, shared");
  assert.equal(first.stopped, false, "the second did not cut the first off");
  assert.equal(first.target, context.gains[0], "into the master gain");
  assert.equal(context.gains[0].target, context.destination);
  assert.equal(player.liveVoices, 2);
});

test("a sound not decoded yet is DROPPED and loaded, never played late", async () => {
  const { player, context, notReady, fetchCalls } = webAudioPlayer();
  await player.unlock();
  assert.equal(player.play(cue("late.mp3")), "not-ready");
  assert.deepEqual(notReady, ["late.mp3"]);
  assert.equal(context.sources.length, 0);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fetchCalls, ["/assets/sound/late.mp3"], "it is loaded for next time");
  assert.equal(player.play(cue("late.mp3")), "played");
});

test("the voice cap retires FINISHED voices first, then the oldest live one", async () => {
  const { player, context } = webAudioPlayer({ player: { voiceLimit: 2 } });
  await player.preload(["a.mp3"]);
  await player.unlock();
  player.play(cue("a.mp3"));
  player.play(cue("a.mp3"));
  context.sources[0].onended();
  player.play(cue("a.mp3"));
  assert.equal(context.sources[1].stopped, false, "the finished voice made room; the live one was left alone");
  player.play(cue("a.mp3"));
  assert.equal(context.sources[1].stopped, true, "full of live voices: the oldest goes");
  assert.equal(context.sources[2].stopped, false);
});

test("the build's SOUNDINFO: SyncStop stops the file, SyncNoMultiple will not double it", async () => {
  const { player, context } = webAudioPlayer();
  await player.preload(["a.mp3", "b.mp3"]);
  await player.unlock();
  player.play(cue("a.mp3"));
  player.play(cue("b.mp3"));
  assert.equal(player.play(cue("a.mp3", { noMultiple: true })), "skipped");
  assert.equal(player.play(cue("a.mp3", { stop: true })), "stopped");
  assert.equal(context.sources[0].stopped, true);
  assert.equal(context.sources[1].stopped, false, "only that file");
  assert.equal(player.play(cue("a.mp3", { noMultiple: true })), "played", "no longer playing, so it starts");
});

test("the MP3 lead-in is skipped where it is silent, and capped at the build's own SeekSamples", async () => {
  const { player, context } = webAudioPlayer({
    shapes: { "quiet.mp3": { silentFrames: 30 }, "short.mp3": { silentFrames: 30 }, "loud.mp3": { silentFrames: 0 } }
  });
  const report = await player.preload(["quiet.mp3", "short.mp3", "loud.mp3", "plain.mp3"], {
    leadInSeconds: { "quiet.mp3": 0.05, "short.mp3": 0.01, "loud.mp3": 0.05 }
  });
  assert.equal(report.trimmed, 2);
  await player.unlock();
  for (const file of ["quiet.mp3", "short.mp3", "loud.mp3", "plain.mp3"]) player.play(cue(file));
  assert.deepEqual(context.sources.map((source) => source.started.offset), [0.03, 0.01, 0, 0],
    "30 silent frames of 50 allowed; 10 allowed of 30 silent; none where the sound starts at once");
  assert.deepEqual(context.sources.map((source) => source.started.when), [0, 0, 0, 0], "and all of them NOW");
});

test("the master volume is the gain node's value, clamped", () => {
  const { player, context } = webAudioPlayer();
  assert.equal(player.setVolume(0.25), 0.25);
  assert.equal(context.gains[0].gain.value, 0.25);
  assert.equal(player.setVolume(4), 1);
  assert.equal(player.setVolume(-1), 0);
  assert.equal(player.setVolume("nonsense"), 1);
});

test("the toggle: off plays nothing AND silences what is sounding", async () => {
  const { player, context } = webAudioPlayer();
  await player.preload(["a.mp3"]);
  await player.unlock();
  player.play(cue("a.mp3"));
  player.setEnabled(false);
  assert.equal(context.sources[0].stopped, true);
  assert.equal(player.play(cue("a.mp3")), "off");
  assert.equal(context.sources.length, 1);
  player.setEnabled(true);
  assert.equal(player.play(cue("a.mp3")), "played");
});

test("the latency the context reports is handed back, the number the old path never had", () => {
  assert.deepEqual(webAudioPlayer().player.latency(), { base: 0.005, output: 0.021 });
  assert.equal(createSoundPlayer({ createAudio: () => ({}) }).latency(), null);
});

test("THE FALLBACK: no AudioContext means a cloned element per play, at the master volume", async () => {
  const made = [];
  const blocked = [];
  const element = (url) => {
    const node = {
      url, volume: 1, ended: false, paused: false, loads: 0, plays: 0,
      load() { node.loads += 1; },
      cloneNode() { const copy = element(url); made.push(copy); return copy; },
      play() { node.plays += 1; node.paused = false; return node.reject ? Promise.reject(new Error("NotAllowedError")) : Promise.resolve(); },
      pause() { node.paused = true; }
    };
    return node;
  };
  const player = createSoundPlayer({ createAudio: element, voiceLimit: 2, onBlocked: () => blocked.push(true) });
  assert.deepEqual(await player.preload(["a.mp3"]), { requested: 1, ready: 1, trimmed: 0 });
  player.setVolume(0.5);
  player.play(cue("a.mp3"));
  player.play(cue("a.mp3"));
  assert.equal(made.length, 2, "one clone per play, so they overlap");
  assert.ok(made.every((clone) => clone.volume === 0.5));
  player.play(cue("a.mp3"));
  assert.equal(made[0].paused, true, "the cap retires the oldest");
  player.setVolume(0.2);
  assert.equal(made[2].volume, 0.2, "a live voice follows the slider");

  // A rejected play() is the browser blocking autoplay, reported as before.
  const refusing = createSoundPlayer({
    createAudio: (url) => { const node = element(url); node.cloneNode = () => { const copy = element(url); copy.reject = true; return copy; }; return node; },
    onBlocked: () => blocked.push(true)
  });
  refusing.play(cue("a.mp3"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(blocked.length, 1);
});

/* ------------------------------------------------------------------ */
/* Load failures: retried when transient, cleared by an explicit preload */
/* ------------------------------------------------------------------ */

/**
 * A fetch whose answers are scripted per call: "network" rejects the way a
 * dropped connection does, a number is that HTTP status, "ok" serves the file.
 * The last answer repeats.
 */
function scriptedFetch(script) {
  const calls = [];
  const fetchImpl = (url) => {
    const answer = script[Math.min(calls.length, script.length - 1)];
    calls.push(url);
    if (answer === "network") return Promise.reject(new TypeError("Failed to fetch"));
    if (typeof answer === "number") {
      return Promise.resolve({ ok: false, status: answer, arrayBuffer: () => Promise.resolve(null) });
    }
    return Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve({ url }) });
  };
  return { fetchImpl, calls };
}

/** A timer the test fires by hand, so a backoff is observable without waiting. */
function manualTimers() {
  const pending = [];
  return {
    schedule: (callback, ms) => { pending.push({ callback, ms }); },
    pending,
    fire() {
      const due = pending.splice(0);
      for (const { callback } of due) callback();
      return due.map(({ ms }) => ms);
    }
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

function failingPlayer(script) {
  const { fetchImpl, calls } = scriptedFetch(script);
  const timers = manualTimers();
  let context = null;
  const player = createSoundPlayer({
    AudioContextCtor: class extends FakeContext { constructor(init) { super(init); context = this; } },
    fetchImpl,
    schedule: timers.schedule
  });
  return { player, calls, timers, context: () => context };
}

test("A LOAD THAT FAILS ONCE IS RETRIED, and the sound plays once it arrives — never the cue it missed", async () => {
  // Codex's reproduction (gpt-6-astra review of this diff): a fetch that fails
  // once and would then succeed. The first version marked the file failed for
  // the whole session, so the effect was silent until a reload.
  const { player, calls, timers, context } = failingPlayer(["network", "ok"]);
  assert.equal((await player.preload(["a.mp3"])).ready, 0);
  await player.unlock();
  assert.equal(player.play(cue("a.mp3")), "not-ready", "the cue fired during the outage is dropped");
  assert.deepEqual(timers.fire(), [500], "one retry, after the first backoff");
  await settle();
  assert.equal(calls.length, 2, "the load was tried again");
  assert.equal(context().sources.length, 0, "the dropped cue is NOT played late when the file arrives");
  assert.equal(player.play(cue("a.mp3")), "played");
  assert.equal(context().sources.length, 1);
});

test("transient failures back off and STOP: three retries at 500, 1000 and 2000 ms, then no more", async () => {
  const { player, calls, timers } = failingPlayer(["network"]);
  await player.preload(["a.mp3"]);
  const delays = [];
  for (let round = 0; round < 6; round += 1) {
    delays.push(...timers.fire());
    await settle();
  }
  assert.deepEqual(delays, [500, 1000, 2000]);
  assert.equal(calls.length, 4, "the first attempt and three retries");
  await player.unlock();
  assert.equal(player.play(cue("a.mp3")), "not-ready");
  await settle();
  assert.equal(calls.length, 4, "a play does not restart the loading once the retries are spent");
});

test("a 5xx is transient; a 404 is not retried — but an EXPLICIT preload clears either and tries again", async () => {
  const busy = failingPlayer([503, "ok"]);
  await busy.player.preload(["a.mp3"]);
  assert.deepEqual(busy.timers.fire(), [500]);
  await settle();
  await busy.player.unlock();
  assert.equal(busy.player.play(cue("a.mp3")), "played");

  const missing = failingPlayer([404, "ok"]);
  await missing.player.preload(["a.mp3"]);
  assert.deepEqual(missing.timers.pending, [], "a missing file is not retried on a timer");
  await missing.player.unlock();
  assert.equal(missing.player.play(cue("a.mp3")), "not-ready");
  await settle();
  assert.equal(missing.calls.length, 1, "nor by a play");
  assert.equal((await missing.player.preload(["a.mp3"])).ready, 1, "an explicit preload starts it afresh");
  assert.equal(missing.calls.length, 2);
  assert.equal(missing.player.play(cue("a.mp3")), "played");
});

test("A PRELOAD DURING THE LAST RETRY renews the budget — one fetch in flight, one decode on success", async () => {
  // Codex pass 2 (gpt-6-astra): the loading guard returned the in-flight job
  // before the explicit preload cleared anything, and that job kept the count
  // it had captured. The 4th attempt then failed as the LAST one, and the file
  // stayed silent although the preload had asked for a fresh start.
  const calls = [];
  let hold = null;
  const fetchImpl = (url) => {
    calls.push(url);
    if (calls.length <= 3) return Promise.reject(new TypeError("Failed to fetch"));
    if (calls.length === 4) return new Promise((resolve, reject) => { hold = { resolve, reject }; });
    return Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve({ url }) });
  };
  const timers = manualTimers();
  let context = null;
  const player = createSoundPlayer({
    AudioContextCtor: class extends FakeContext { constructor(init) { super(init); context = this; } },
    fetchImpl,
    schedule: timers.schedule
  });

  await player.preload(["a.mp3"]);
  for (let round = 0; round < 3; round += 1) { timers.fire(); await settle(); }
  assert.equal(calls.length, 4, "the first attempt and three retries, the last still in flight");
  assert.ok(hold, "the 4th fetch is being held");

  const again = player.preload(["a.mp3"]);
  await settle();
  assert.equal(calls.length, 4, "the preload joins the fetch in flight rather than starting a second");
  hold.reject(new TypeError("Failed to fetch"));
  assert.deepEqual(await again, { requested: 1, ready: 0, trimmed: 0 });
  assert.deepEqual(timers.fire(), [500], "a RENEWED budget: the first backoff again, not silence");
  await settle();
  assert.equal(calls.length, 5);
  assert.equal(context.decoded.length, 1, "one decode on success");
  await player.unlock();
  assert.equal(player.play(cue("a.mp3")), "played");
});

test("a file that ARRIVES and will not decode is not retried on a timer either", async () => {
  const { fetchImpl, calls } = scriptedFetch(["ok"]);
  const timers = manualTimers();
  const player = createSoundPlayer({
    AudioContextCtor: class extends FakeContext {
      decodeAudioData() { return Promise.reject(new Error("EncodingError")); }
    },
    fetchImpl,
    schedule: timers.schedule
  });
  assert.equal((await player.preload(["bad.mp3"])).ready, 0);
  assert.deepEqual(timers.pending, [], "the same bytes will not decode next time");
  assert.equal(calls.length, 1);
});
