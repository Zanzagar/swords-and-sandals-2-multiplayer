/**
 * THE BUILD'S FRAME CLOCK — how long one of its frames lasts.
 *
 * `docs/integration/ss2-build-fingerprint.json` records the oracle's SWF header
 * (`collection.ss2.frameRate`, beside its sha256), and
 * `test/render-build-timing.test.js` holds this constant to it. A clip the
 * extracted rig draws from the build's own frames plays at this rate; see
 * `buildSchedule` in `timeline.js`.
 *
 * ► **FOUR OTHER COPIES OF `1000 / 30` PREDATE THIS ONE** — `PROJECTILE_FRAME_MS`
 *   (`projectile.js`), `CROWD_FRAME_MS` (`crowd-sound.js`), `POPUP_FRAME_MS`
 *   (`popups.js`) and, until 2026-09-24, `timeline.js`'s own `SCALE_TICK_MS`.
 *   The last now reads this one; the other three are the same fact stated
 *   again, and are left to the files that own them.
 */

/** The oracle's frame rate, in frames per second. */
export const BUILD_FRAME_RATE = 30;

/** One of the build's frames, in milliseconds. */
export const BUILD_FRAME_MS = 1000 / BUILD_FRAME_RATE;

export class BuildTimingError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * How long `frames` of the build's frames last, in milliseconds.
 *
 * ► **ONE ROUNDING, NOT TWO.** `frames * BUILD_FRAME_MS` multiplies an already
 *   rounded 33.33...: 27 frames came out 900.0000000000001, and a loop that
 *   wraps at that length lands a hair short of its own boundary. Dividing last
 *   keeps every whole-millisecond length whole.
 *
 * Throws on anything that is not a positive whole number of frames, because a
 * schedule built from one would be a duration nobody chose.
 */
export function buildFramesMs(frames) {
  if (!Number.isInteger(frames) || frames <= 0) {
    throw new BuildTimingError(`${String(frames)} is not a frame count: a build-frame length needs a positive whole number of frames.`);
  }
  return (frames * 1000) / BUILD_FRAME_RATE;
}
