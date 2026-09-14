/**
 * BLOOD AND SPARKS — the build's own `bounceitem`, and it is a real particle
 * system rather than a puff of art.
 *
 * Derived 2026-09-13 from the fighter clip's own frame 1,
 * `sprite:1241/frame:1/DoAction@0x34951a`. Every constant below cites its
 * offset, and `tools/extract-clip-effects.mjs` reads the CALL SITES — which
 * frame spawns how much — out of the same clip.
 *
 * ## The rule that matters most, and this engine already has its input
 *
 * ► **ARMOUR STRIKES SPARKS AND FLESH BLEEDS.** `bounceitem` branches on
 *   `game_<side>.armourclass > 0` (`+0x018e` hero, `+0x021d` villain) and
 *   attaches `sparks` when there is armour left and `blood` when there is not.
 *   That is the build telling the player, in art, which of the two damage paths
 *   the blow took — and it is the same `armourclass` this engine's own ingress
 *   decrements before hitpoints. Nothing needed deriving to support it.
 *
 * ## The name is literal: a drop BOUNCES
 *
 * ```text
 *   spawn   bloodframe    = 1 + RandomNumber(totalFrames)   +0x0281
 *           _y            = -220 + RandomNumber(150)        +0x02ab
 *           xspeed        =  -30 + RandomNumber(60)         +0x02bf
 *           dy            =  -40 + RandomNumber(20)         +0x02d3
 *           rotationspeed =  -40 + RandomNumber(80)         +0x02e7
 *           counter       = 1                               +0x02fb
 *
 *   frame   counter += 1
 *           if (_y > 0) dy *= -0.4         the BOUNCE        +0x035f
 *           _y += dy                                         +0x0379
 *           _x += xspeed                                     +0x038f
 *           if (xspeed > 0) xspeed -= 0.1  friction           +0x03c0
 *           if (xspeed < 0) xspeed += 0.1                     +0x03f5
 *           dy += 2                        gravity            +0x040f
 *           if (counter <= 25) _rotation += rotationspeed     +0x043d
 *           if (counter >  25) removeMovieClip()              +0x046a
 * ```
 *
 * ► **THE GRAVITY IS 2 — THE SAME 2 THE ARROW FALLS UNDER** (`+0x6efd`). Two
 *   unrelated-looking systems written by the same hand, and worth noticing
 *   before anybody "tunes" one of them.
 *
 * ► **A DROP LIVES EXACTLY 25 FRAMES**, which at the build's 30 fps is 0.83
 *   seconds, and it is removed rather than fading.
 *
 * ## The units are ARENA UNITS already, and that is not a coincidence
 *
 * A drop is attached to `arena.gladiators` (`+0x01de`), which is the same
 * display object the two fighters are attached to — so its `_x`/`_y` are in the
 * space the gladiators' own `_x` lives in. **That space is this engine's arena
 * units**: `SS2_ARENA.frontX` is 250 because the build constructs its fighters
 * at `_x = ±250`, out of the same coordinates. So a spawn band of `-220..-71`
 * is 220-odd arena units above the gladiators' line, against a figure 150 units
 * tall — a spray that leaves above head height and rises about two more figure
 * heights before gravity wins.
 *
 * **Nothing is converted, and nothing should be.** The shield attach offset was
 * added to twips when it was in pixels and drew twenty times too close
 * (2026-09-13); this is the opposite case, where the two spaces genuinely are
 * one and a conversion would be the error.
 *
 * ## Screen y is DOWN here, and it is not converted
 *
 * Every number above is in the build's own screen space: `_y` is
 * down-positive, the drop starts at `-220..-70` (above the clip's origin, on
 * the body) and falls toward 0 (the ground). **This module keeps that
 * convention** rather than flipping into arena units, because the whole system
 * — the bounce at 0, the gravity, the spawn band — is stated in it and a
 * half-converted physics is how a sign error hides. A surface flips once, at
 * the point it draws, exactly as it already does for the figure's own limbs.
 */

export class ClipEffectsError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

export const SS2_DROP = Object.freeze({
  /** `dy += 2` (`+0x040f`) — the same constant the arrow falls under. */
  gravity: 2,
  /** `dy *= -0.4` when the drop is at or below the ground (`+0x035f`). */
  bounce: -0.4,
  /** `xspeed` bleeds 0.1 a frame toward zero (`+0x03c0`, `+0x03f5`). */
  friction: 0.1,
  /** `counter > 25` removes the clip (`+0x046a`). */
  lifeFrames: 25,
  /** The spawn bands, each `base + RandomNumber(span)`. */
  spawn: Object.freeze({
    y: Object.freeze({ base: -220, span: 150 }),
    xspeed: Object.freeze({ base: -30, span: 60 }),
    dy: Object.freeze({ base: -40, span: 20 }),
    rotationSpeed: Object.freeze({ base: -40, span: 80 })
  })
});

/**
 * A drawable table from the JSON `tools/extract-clip-effects.mjs` writes, or
 * null. Total rather than throwing, for the reason `propPackFrom` is: a missing
 * or hand-edited file must leave the arena playable and bloodless.
 */
export function clipEffectTableFrom(data) {
  if (!data || typeof data !== "object") return null;
  const frames = data.frames;
  if (!frames || typeof frames !== "object") return null;
  return Object.freeze({ clip: data.clip ?? null, frames: Object.freeze(frames) });
}

/**
 * Which POSE of one animation spawns what.
 *
 * The table is keyed by the CLIP's own frame numbers and a renderer holds a
 * pose index, so this converts once: `poseIndex = clipFrame - firstFrame`. The
 * extracted animations carry `firstFrame`/`lastFrame`, so nothing here has to
 * know how the clip was cut.
 *
 * Returns an empty array for an animation that spawns nothing, which is most
 * of them — 27 of the clip's 101 labels have an entry.
 */
export function effectsForAnimation(table, animation) {
  if (!table || !animation || !Number.isFinite(animation.firstFrame)) return [];
  // ► **`animation.poses` IS THE ARRAY OF POSES, NOT A COUNT**, and reading it
  //   as one is how the first shell integration fired nothing at all:
  //   `at * [object Array]` is NaN, every comparison against it is false, and a
  //   silent no-blood looks exactly like a correct bout. Reported here so a
  //   caller converting a pose index has the number rather than the array.
  const poseCount = Array.isArray(animation.poses) ? animation.poses.length : null;
  const out = [];
  for (const [frame, spawns] of Object.entries(table.frames)) {
    const clipFrame = Number(frame);
    if (clipFrame < animation.firstFrame || clipFrame > animation.lastFrame) continue;
    for (const spawn of spawns ?? []) {
      out.push(Object.freeze({
        poseIndex: clipFrame - animation.firstFrame,
        prop: spawn.prop,
        count: Number(spawn.count) || 0
      }));
    }
  }
  return Object.freeze(
    out
      .sort((left, right) => left.poseIndex - right.poseIndex)
      .map((entry) => Object.freeze({ ...entry, poseCount }))
  );
}

/**
 * `RandomNumber(n)` WITHOUT a random number.
 *
 * ► **SAME RULE AS THE ARROW'S VELOCITY, and the same reason.** The build draws
 *   four samples per drop; the only RNG this engine has is the resolver's
 *   ordered channel, and that channel IS the wire format — a renderer taking a
 *   sample would move every peer's `rngCursor` and desync two clients watching
 *   one bout. A second, unhashed generator would be worse: two replays of a
 *   bout would not look alike.
 *
 *   So the SPREAD is the build's and the SOURCE is a seed the caller already
 *   has. A small integer hash rather than a modulo, because the callers differ
 *   by 1 (drop index) and a bare modulo would march the four bands in lockstep
 *   and spray every drop identically.
 */
export function dropRandom(seed, span) {
  if (!(span > 0)) return 0;
  let hash = Math.abs(Math.trunc(seed)) + 0x9e3779b9;
  hash = Math.imul(hash ^ (hash >>> 16), 0x21f0aaad);
  hash = Math.imul(hash ^ (hash >>> 15), 0x735a2d97);
  hash = (hash ^ (hash >>> 15)) >>> 0;
  return hash % span;
}

/**
 * The drops one `bounceitem` call spawns, in the build's own screen space.
 *
 * ► **FIVE PER CALL, WHATEVER THE COUNT ARGUMENT, and that is the build's own
 *   loop rather than a simplification.** `bounceitem(whichitem, blood_drops)`
 *   runs `i` from 1 to 5 unconditionally (`+0x0116`-`+0x0132`); the second
 *   argument is clamped to at least 1 (`+0x00f8`) and used only as a DEPTH
 *   offset, `blooddepth = 45300 + blood_drops` (`+0x0155`). So the 3 / 6 / 9 /
 *   15 in the extracted table are not drop counts — they are depths, and they
 *   happen to rise with the severity of the hurt.
 *
 *   **That correction matters**: read as counts they say a power hit bleeds
 *   three times a quick one, which is a nice story and is not what the bytes
 *   do. Every hit sprays five.
 *
 * @param {object} options
 * @param {number} options.seed      anything stable per spawn — the caller's
 *   own sequence number does
 * @param {boolean} options.armoured `armourclass > 0`: sparks rather than blood
 * @param {number} [options.frames]  the prop clip's frame count, for the
 *   random art frame
 */
export function spawnDrops({ seed = 0, armoured = false, frames = 1 } = {}) {
  const { spawn } = SS2_DROP;
  const drops = [];
  for (let index = 0; index < 5; index += 1) {
    const at = (Math.abs(Math.trunc(seed)) * 5 + index) * 4;
    drops.push(Object.freeze({
      prop: armoured ? "sparks" : "blood",
      // `1 + RandomNumber(_totalframes)`, 1-based like every other frame here.
      artFrame: 1 + dropRandom(at, Math.max(1, frames)),
      y: spawn.y.base + dropRandom(at + 1, spawn.y.span),
      xspeed: spawn.xspeed.base + dropRandom(at + 2, spawn.xspeed.span),
      dy: spawn.dy.base + dropRandom(at + 3, spawn.dy.span),
      rotationSpeed: spawn.rotationSpeed.base + dropRandom(at + 4, spawn.rotationSpeed.span)
    }));
  }
  return Object.freeze(drops);
}

/**
 * Where one drop is after `frame` frames, or null once it has been removed.
 *
 * The build's loop, integrated step by step rather than in closed form — it has
 * a CONDITIONAL bounce in it, so there is no closed form, and stepping is the
 * honest reproduction. Twenty-five steps is the whole life of a drop.
 *
 * `x` and `y` are OFFSETS from wherever the caller anchors the spray, in the
 * build's screen space: y is down-positive and 0 is the ground.
 */
export function dropAt(drop, frame) {
  if (!drop) throw new ClipEffectsError("dropAt needs a drop from spawnDrops().");
  const steps = Math.max(0, Math.trunc(Number.isFinite(frame) ? frame : 0));
  if (steps > SS2_DROP.lifeFrames) return null;

  let { y, xspeed, dy } = drop;
  let x = 0;
  let rotation = 0;
  for (let step = 1; step <= steps; step += 1) {
    // The bounce is tested BEFORE the move, exactly as the build tests it: a
    // drop already at or below the ground reverses, then travels.
    if (y > 0) dy *= SS2_DROP.bounce;
    y += dy;
    x += xspeed;
    if (xspeed > 0) xspeed -= SS2_DROP.friction;
    else if (xspeed < 0) xspeed += SS2_DROP.friction;
    dy += SS2_DROP.gravity;
    // `counter` starts at 1 and is incremented before the test, so the
    // rotation stops on the same step the clip is removed.
    if (step <= SS2_DROP.lifeFrames) rotation += drop.rotationSpeed;
  }
  return Object.freeze({ x, y, rotation: (rotation * Math.PI) / 180, artFrame: drop.artFrame, prop: drop.prop });
}
