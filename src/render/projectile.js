/**
 * THE ARROW — the build's own ballistic, in this engine's coordinates.
 *
 * Derived 2026-09-13 from `sprite:862[overlay]/frame:52/DoAction@0x240c7f`, the
 * `phase_decision` state machine, which holds all 125 `bullet` references in
 * the build. Written up in full at `docs/integration/ss2-battle-map.md`,
 * §"The arrow itself"; every constant below cites its own offset.
 *
 * ## The one structural difference, and everything else follows from it
 *
 * **The build has TWO coordinates and this engine has THREE.** Vanilla's
 * `bullet._y` is screen y, and it carries the arc — which it can, because both
 * gladiators stand at `_y = 200` and there is no depth for it to mean instead.
 * Here, arena `y` is DEPTH (which rank you stand in) and height is the
 * renderer's own `lift`. So the build's single `_y` integration splits:
 *
 * ```text
 *   build                    here
 *   bullet._x                x        along the line of fight, xVelocity a frame
 *   bullet._y  (the arc)     lift     the ballistic, bombard only
 *                            y        DEPTH, shooter's rank -> target's rank
 * ```
 *
 * That third axis is the one vanilla cannot have, and it is where the owner's
 * question lands: an arrow crossing from one lane to another **is at a
 * different depth every frame**, so it draws at the scale of the rank it is
 * passing through. `figureScaleFor` already does exactly this for figures and
 * takes a FRACTIONAL rank for precisely this reason, so the arrow rides the
 * same function the gladiators do rather than a second one that could disagree.
 *
 * ## What is the build's, and what is ours
 *
 * **The build's, verbatim**: `gravity` 2; `Yvelocity = ceil(distance /
 * Xvelocity)`; the arc on bombard ONLY; a flat 60 for snipe; the trail every
 * third frame; the `± 30` launch offset; and snipe being loosed LOWER than
 * bombard.
 *
 * **Ours, and each says why below**: the bombard velocity's SOURCE (the build
 * draws it; a renderer here may not), and the launch heights in arena units
 * rather than the build's screen pixels.
 *
 * ► **THE SCALE TABLE IS DELIBERATELY NOT PORTED, and that is a finding rather
 *   than an omission.** The build bands `Xvelocity` and the arrow's own
 *   `_xscale`/`_yscale` on `arena.maxscale` — 100 / 130 / 160 as `maxscale`
 *   falls. That is backwards for perspective and correct for a CAMERA: SS2
 *   zooms the arena out as the fighters separate, so the arrow is drawn larger
 *   to stay visible and moves faster to cross the wider gap in a watchable
 *   time. **This engine's camera is fixed per roster** (`viewportFor`), so
 *   there is nothing to compensate for, and copying the table would be
 *   answering a question nobody asked. The nominal band — `maxscale == 80`,
 *   where the build leaves the scale at 100 — is the one taken.
 */

export class ProjectileError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/** The two shots. `bombard` arcs; `snipe` does not. */
export const ProjectileKind = Object.freeze({
  BOMBARD: "bombard",
  SNIPE: "snipe"
});

export const SS2_PROJECTILE = Object.freeze({
  /**
   * `bullet.gravity = 2` (`+0x6efd`), subtracted from `Yvelocity` once per
   * frame (`+0x727f`). A per-frame constant, so it is in FRAMES and not in
   * seconds — the build runs at 30 fps and the renderer's schedules are in
   * beats, which is why `flightFrames` below is the quantity that travels.
   */
  gravity: 2,
  /**
   * `Xvelocity = randomBetween(60, 60)` for a snipe (`+0x7112`) — the else of
   * the bombard test, a range of one value, so it is a constant wearing a
   * draw's clothes and no sample is needed to reproduce it.
   */
  snipeVelocity: 60,
  /**
   * `randomBetween(8, 18)` at `maxscale == 80` (`+0x6fd7`), the band where the
   * build leaves the arrow's scale alone. See the header for why the other
   * three bands are not ported.
   */
  bombardVelocityMin: 8,
  bombardVelocityMax: 18,
  /** `bulletcounter >= 3` spawns a trail puff and resets (`+0x71aa`). */
  trailEveryFrames: 3,
  /** `bullet._x = attacker._x ± 30` (`+0x6dff` / `+0x6e23`). */
  launchOffsetX: 30,
  /**
   * HOW HIGH THE ARROW STARTS, as a fraction of the figure's own height.
   *
   * ► **THE BUILD'S NUMBERS ARE SCREEN PIXELS AND ARE NOT PORTED AS NUMBERS —
   *   the RATIO between them is what survives, and this project has already
   *   paid once for the other choice.** The shield attach offset was added to
   *   twips when it was in ActionScript pixels, and the shield drew twenty
   *   times too close (2026-09-13). The build's launch heights are
   *   `_yscale * 2 + 30` for a bombard (`+0x6e42`) and `_yscale * 1.5 + 5` for
   *   a snipe (`+0x6e9e`), which at the nominal `_yscale` of 100 are 230 and
   *   155 screen pixels above the clip's registration point.
   *
   *   What is DERIVED and unit-free is that **a snipe is loosed lower**, by
   *   `155 / 230`. So the bombard is anchored at the figure's own head height
   *   here and the snipe at that fraction of it, which reproduces the
   *   relationship the build actually expresses — a lobbed shot leaves high, a
   *   flat one leaves from the shoulder — without pretending two coordinate
   *   systems share a unit.
   */
  bombardLaunchHeight: 1,
  snipeLaunchHeightRatio: 155 / 230
});

/**
 * The arena height of a gladiator at scale 1, so a height in FIGURE HEIGHTS can
 * be compared with an x in ARENA UNITS.
 *
 * Duplicated as a named constant rather than imported, exactly as
 * `src/render/extracted-figure.js` duplicates `painter.js`'s own `UNIT` and for
 * the stated reason: the three answer to the same authored figure, and a silent
 * divergence shows up as the arrow pitching at an angle the gladiator it was
 * loosed from does not agree with.
 *
 * **It exists because mixing the two units is a real defect and the first
 * version of `rotationAt` had it** — normalising the horizontal by `distance`
 * while the vertical was in figure heights put the launch pitch at 76 degrees,
 * near vertical, for a shot that is plainly a lob.
 */
const ARENA_UNITS_PER_FIGURE_HEIGHT = 150;

/**
 * The bombard's launch velocity, WITHOUT taking a sample.
 *
 * ► **THE BUILD DRAWS THIS AND A RENDERER HERE MAY NOT.** `randomBetween(8,
 *   18)` is a real draw in vanilla, but the only RNG this engine has is the
 *   resolver's ordered channel, and that channel IS the wire format: a
 *   presentation surface that took a sample from it would move every peer's
 *   `rngCursor` and desync two clients watching the same bout. Taking one from
 *   a second, unhashed generator would be worse — two replays of one bout would
 *   not look alike, which is the same small lie as a renderer drawing a
 *   separation the model does not have.
 *
 *   So the spread is kept and its SOURCE is the presentation stream's own
 *   sequence number, exactly as `chooseSound` spreads across a family. Same
 *   bout, same seed, same arrows, every time.
 */
/**
 * How long one of the build's frames lasts.
 *
 * **The SWF header says 30 fps** — `tools/inspect-swf.mjs` prints it on every
 * run ("Movie: 30 fps, 270 root frames") — and every per-frame constant in this
 * module is in the build's frames, so this is the one place they become time.
 */
export const PROJECTILE_FRAME_MS = 1000 / 30;

/**
 * How long the arrow is in the air, in milliseconds.
 *
 * ► **THIS IS WHAT HOLDS THE ACTION OPEN, and it is the build's own rule.**
 *   Vanilla will not complete a ranged phase while the arrow is still flying:
 *   `bullet_in_air != true` is one of the conditions on the phase-completion
 *   guard (`+0x3829`), alongside `attacker.struck` and `grounded`. So a long
 *   bombard genuinely takes a long turn there, and the animation gate here is
 *   given the same fact rather than a timeline that has already finished.
 *
 *   Before this, the arrow was drawn only while the SHOOTER's animation ran and
 *   vanished when it ended — which for a bombard across the arena is most of
 *   the flight, because `ranged` is 9 beats (1,080ms) and a 58-frame bombard is
 *   over 1,900.
 */
export function flightDurationMs(flight) {
  if (!flight || !Number.isFinite(flight.flightFrames)) {
    throw new ProjectileError("flightDurationMs needs a flight from projectileFlight().");
  }
  return flight.flightFrames * PROJECTILE_FRAME_MS;
}

export function bombardVelocityFor(sequence) {
  const span = SS2_PROJECTILE.bombardVelocityMax - SS2_PROJECTILE.bombardVelocityMin + 1;
  const index = Number.isFinite(sequence) ? Math.abs(Math.trunc(sequence)) % span : 0;
  return SS2_PROJECTILE.bombardVelocityMin + index;
}

/**
 * Everything about one shot that does not change while it is in the air.
 *
 * @param {object} shot
 * @param {string} shot.kind          `bombard` or `snipe`
 * @param {object} shot.from          `{ x, y, height }` — the shooter
 * @param {object} shot.to            `{ x, y }` — the target
 * @param {number} [shot.sequence]    the presentation stream's counter
 * @returns {object} frozen flight, or throws if the two ends are not placed
 */
export function projectileFlight({ kind, from, to, sequence = 0 } = {}) {
  if (kind !== ProjectileKind.BOMBARD && kind !== ProjectileKind.SNIPE) {
    throw new ProjectileError(
      `A projectile is a ${ProjectileKind.BOMBARD} or a ${ProjectileKind.SNIPE}; got ${String(kind)}.`
    );
  }
  if (!Number.isFinite(from?.x) || !Number.isFinite(to?.x)) {
    throw new ProjectileError("A projectile needs a finite x on both ends; an unplaced shooter has no arrow to draw.");
  }
  const arc = kind === ProjectileKind.BOMBARD;
  // `distance_to_enemy = abs(attacker._x - defender._x)` (`+0x6f28`/`+0x6f63`),
  // and it is the X separation alone even here: the build computes it from
  // `_x` only, and the arrow travels along x while the depth interpolates
  // underneath it. Using the Euclidean distance would be inventing a longer
  // flight than the build flies.
  const distance = Math.abs(to.x - from.x);
  const direction = to.x >= from.x ? 1 : -1;
  const xVelocity = arc ? bombardVelocityFor(sequence) : SS2_PROJECTILE.snipeVelocity;
  // The launch sits `± 30` toward the target, which is the bow arm rather than
  // the gladiator's centre.
  const launchX = from.x + direction * SS2_PROJECTILE.launchOffsetX;
  // ► **`Yvelocity = ceil(distance / Xvelocity)` IS ALSO THE FLIGHT'S LENGTH IN
  //   FRAMES, and the build gets a well-formed arc out of that coincidence
  //   rather than out of any aiming.** With `y(t) = y0 + t*Yv - t^2 - t` the
  //   peak is at `t = (Yv - 1) / 2` — the midpoint — and the arrow is back
  //   within `Yv` of its launch height when it arrives. **The arc is aimed by
  //   the RANGE**, which is why a bombard can fall short onto the ground
  //   (`bullet._y > 160`) and a snipe never can.
  const flightFrames = Math.max(1, Math.ceil(distance / xVelocity));
  const yVelocity = flightFrames;
  const launchHeight = arc
    ? SS2_PROJECTILE.bombardLaunchHeight
    : SS2_PROJECTILE.bombardLaunchHeight * SS2_PROJECTILE.snipeLaunchHeightRatio;
  return Object.freeze({
    kind,
    arc,
    distance,
    direction,
    xVelocity,
    yVelocity,
    gravity: SS2_PROJECTILE.gravity,
    flightFrames,
    launch: Object.freeze({
      x: launchX,
      // Depth is the SHOOTER's at frame 0 and the target's at the end; see
      // `projectileAt`. Carried as a pair rather than interpolated here so the
      // flight is a description and the position is a function of time.
      y: Number.isFinite(from?.y) ? from.y : null,
      height: launchHeight
    }),
    impact: Object.freeze({
      x: to.x,
      y: Number.isFinite(to?.y) ? to.y : null
    })
  });
}

/**
 * Where the arrow is at `frame`, and which way it is pointing.
 *
 * `frame` is clamped to the flight, so a surface that overruns draws the arrow
 * at the target rather than sailing it off the end of the arena — the same rule
 * `poseIndexAt` applies to an animation's last frame, and for the same reason:
 * `at` of exactly 1 is the END of an action, not a wrap.
 *
 * @returns {object} `{ x, y, height, rotation, progress }`. `y` is arena DEPTH
 *   and is null when neither end models any; `height` is in figure heights.
 */
export function projectileAt(flight, frame) {
  if (!flight || !Number.isFinite(flight.flightFrames)) {
    throw new ProjectileError("projectileAt needs a flight from projectileFlight().");
  }
  const t = Math.min(flight.flightFrames, Math.max(0, Number.isFinite(frame) ? frame : 0));
  const progress = flight.flightFrames === 0 ? 1 : t / flight.flightFrames;
  // x is the build's own integration — `_x += Xvelocity` once a frame
  // (`+0x7314`/`+0x7379`) — clamped to the impact point so the last frame lands
  // ON the target rather than one velocity past it.
  const travelled = flight.launch.x + flight.direction * flight.xVelocity * t;
  const x = flight.direction > 0
    ? Math.min(flight.impact.x, travelled)
    : Math.max(flight.impact.x, travelled);
  // ► **DEPTH IS LINEAR AND THE ARC IS NOT, which is the whole of the
  //   three-axis split.** An arrow crossing lanes changes rank at a steady rate
  //   — there is no ballistic reason for it to do anything else — while its
  //   HEIGHT follows the build's integration. Drawing them from one curve
  //   would make a cross-lane shot rise and fall in depth, which is not a thing
  //   that happens.
  const y = flight.launch.y === null || flight.impact.y === null
    ? null
    : flight.launch.y + (flight.impact.y - flight.launch.y) * progress;
  // `Yvelocity -= gravity` then `_y -= Yvelocity`, summed: the closed form of
  // the build's per-frame loop, with the sign flipped because arena height is
  // up-positive and screen y is down-positive.
  //
  // Written in FIGURE HEIGHTS rather than the build's pixels (see
  // `bombardLaunchHeight`), so the ballistic term is normalised by the same
  // `yVelocity` that generated it: the peak is one launch-height above the
  // launch, whatever the range, which is what keeps a long shot readable
  // instead of leaving the arena.
  let height = flight.launch.height;
  if (flight.arc && flight.flightFrames > 0) {
    const rise = t * flight.yVelocity - t * t - t;
    const peak = Math.max(1, (flight.yVelocity * flight.yVelocity) / 4);
    height = flight.launch.height + rise / peak;
  }
  return Object.freeze({ x, y, height, rotation: rotationAt(flight, t), progress });
}

/**
 * The arrow's pitch, in radians, positive nose-up.
 *
 * The build carries `bullet._rotation` and hands it to every trail puff
 * (`+0x7205`) but never assigns it in the action code — it is a property of the
 * clip's own tween there. Here it is DERIVED from the velocity, which is the
 * only honest source: an arrow points where it is going.
 *
 * A snipe never pitches, because its height never changes.
 */
function rotationAt(flight, t) {
  if (!flight.arc) return 0;
  // d(height)/dt of the rise term, converted OUT of figure heights and into
  // arena units so it can be compared with a horizontal speed that is already
  // in them. See `ARENA_UNITS_PER_FIGURE_HEIGHT`.
  //
  // ► **THE VELOCITY VECTOR'S OWN ANGLE, IN THE ARENA'S FRAME — not a pitch
  //   with the direction folded into its sign, which is what the first version
  //   returned and which sent every LEFT-flying arrow off the bow nose-DOWN.**
  //   A renderer draws the shaft along +x and rotates by this, so the head
  //   leads in both directions only if the horizontal component keeps its sign:
  //   near 0 flying right, near pi flying left.
  //
  //   Caught by a test rather than by watching the blue side shoot, which is
  //   the only other way it was ever going to be found.
  //
  // `atan2` rather than a ratio so a vertical component at zero horizontal
  // speed is still a well-defined angle.
  const peak = Math.max(1, (flight.yVelocity * flight.yVelocity) / 4);
  const dHeight = ((flight.yVelocity - 2 * t - 1) / peak) * ARENA_UNITS_PER_FIGURE_HEIGHT;
  return Math.atan2(dHeight, flight.xVelocity * flight.direction);
}

/**
 * The trail puffs still showing at `frame`.
 *
 * `bulletcounter` counts to 3 and drops a puff at the arrow's own position and
 * rotation (`+0x71aa`-`+0x7205`), so at 30 fps that is ten a second. The build
 * never removes them individually — they are their own clips and play out — so
 * `keep` is this engine's own bound on how many stay on screen, which the build
 * did not need because a bout is short and a trail puff is small.
 */
export function projectileTrail(flight, frame, { keep = 6 } = {}) {
  const puffs = [];
  const t = Math.min(flight.flightFrames, Math.max(0, Number.isFinite(frame) ? frame : 0));
  for (let at = SS2_PROJECTILE.trailEveryFrames; at <= t; at += SS2_PROJECTILE.trailEveryFrames) {
    puffs.push(projectileAt(flight, at));
  }
  return puffs.slice(-keep);
}
