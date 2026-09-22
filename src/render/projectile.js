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
  /**
   * `if (bulletrotus > 170) bulletrotus = 170` (`+0x74c3`-`+0x74e0`). A lobbed
   * projectile stops just short of a half turn rather than spinning for ever.
   */
  tumbleClamp: 170,
  /**
   * A snipe's constant `_rotation` (`+0x7498` / `+0x74b0`), which is what lays
   * the VERTICAL art flat. See `rotationAt`.
   */
  flatRotation: 90,
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
 *   guard (`+0x3829`), alongside ~~`attacker.struck` and~~ `grounded`
 *   **— and `attacker.struck` is NOT one of them** *(corrected 2026-09-22 by a
 *   write-nothing verifier sweeping every `"struck"` reference in
 *   `DoAction@0x240c7f`: the lowest is `+0x3871`, and it is a WRITE,
 *   `attacker.struck = null`, so nothing in the block reads `struck` before
 *   `+0x3829`. The `bullet_in_air` and `grounded` terms are NOT re-verified by
 *   that correction — its dumps start at `+0x3842` — and `HANDOFF.md`'s living
 *   head calls this guard the `demand_move` stall watchdog rather than the
 *   completion test)*. So a long bombard genuinely takes a long turn there,
 *   and the animation gate here is given the same fact rather than a timeline
 *   that has already finished.
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
 * @param {number} [shot.targetSize]  the target's `physical_size`, so the
 *   flight ends at its body rather than inside it
 * @returns {object} frozen flight, or throws if the two ends are not placed
 */
export function projectileFlight({ kind, from, to, sequence = 0, targetSize = 0 } = {}) {
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
  // ► **THE FLIGHT ENDS AT THE TARGET'S BODY, NOT ITS CENTRE — owner's report,
  //   2026-09-13: the projectile "kinda clipped to the model at the end".**
  //
  //   The build's impact test is `bullet._x > defender._x` (`+0x6cb4`), so its
  //   arrow crosses the centre and is removed the same tick. That reads fine at
  //   vanilla's scale and badly here: a gladiator's `physical_size` is ~86 arena
  //   units against a flight of a few hundred, so an arrow travelling the last
  //   `Xvelocity` units a frame ends up drawn INSIDE the figure — and it is
  //   drawn over everything, because the build attaches it at depth 45000.
  //
  //   Stopping at the body's own surface is the same geometry
  //   `ss2WalkDestination` already uses for the walk clamp — `defender._x ∓
  //   physical_size` — so it is the engine's existing answer to "where does a
  //   thing stop against a body", not a new one. `targetSize` of 0 restores the
  //   build's literal behaviour for any caller that does not model bodies.
  const bodyStop = Number.isFinite(targetSize) ? Math.max(0, targetSize) : 0;
  const direction = to.x >= from.x ? 1 : -1;
  const surfaceX = to.x - direction * bodyStop;
  const distance = Math.abs(surfaceX - from.x);
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
      // The SURFACE, not the centre. See `bodyStop` above.
      x: surfaceX,
      centreX: to.x,
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
 * THE PROJECTILE'S ROTATION — the build's own, and mine was an invention.
 *
 * ► **I REPORTED THAT "the build carries `bullet._rotation` but never assigns
 *   it in the action code" AND THAT WAS WRONG.** It assigns it at three sites
 *   — `+0x7498`, `+0x74b0`, `+0x74f3` — all inside the bullet's own
 *   `onEnterFrame`, past the point I had stopped reading. What stood here
 *   instead was an angle derived from the velocity vector, on the reasoning
 *   that "an arrow points where it is going". **The build does something
 *   completely different, and the owner saw it: the projectile looked wrong in
 *   flight.**
 *
 * ## The art is VERTICAL, and that is why ±90 exists
 *
 * Measured off the extracted pack: the arrow (shape 46) is **11.4 x 58.4 px** —
 * tall and thin. It is drawn pointing UP, not along the direction of travel. So
 * a projectile at rotation 0 points at the sky, and the build's `±90` is what
 * lays it flat.
 *
 * ## A snipe is FLAT and a bombard TUMBLES
 *
 * ```text
 *   sniperight   _rotation =  90                        +0x7498
 *   snipeleft    _rotation = -90                        +0x74b0
 *   bombard      bulletrotus = round(bulletlife * gravity * 2 / Xvelocity)
 *                _rotation   = ±bulletrotus, clamped at 170
 *                                                       +0x742f, +0x74e0, +0x74f3
 * ```
 *
 * **`bulletlife` accumulates DISTANCE, not frames** — `bulletlife += Xvelocity`
 * once a frame from a start of 1 (`+0x73d9`, `+0x6ede`) — so the `Xvelocity`
 * divides straight back out and the tumble is **~4 degrees per frame whatever
 * the velocity**, stopping at 170. A lobbed stone turns almost half a circle
 * over its flight; a fast snipe never turns at all.
 *
 * The sign is the SHOOTER'S FACING, not the velocity: `+bulletrotus` facing
 * right and `-bulletrotus` facing left (`+0x7511`-`+0x753f`).
 *
 * @returns {number} radians, CLOCKWISE-POSITIVE in screen space — the same
 *   convention Flash's `_rotation` uses, so a surface applies it before any
 *   y-flip rather than negating it.
 */
function rotationAt(flight, t) {
  const degrees = flight.arc
    ? Math.min(
      SS2_PROJECTILE.tumbleClamp,
      Math.round((1 + t * flight.xVelocity) * SS2_PROJECTILE.gravity * 2 / flight.xVelocity)
    )
    : SS2_PROJECTILE.flatRotation;
  return (degrees * flight.direction * Math.PI) / 180;
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
/**
 * EVERYTHING A SURFACE NEEDS TO DRAW ONE ARROW THIS FRAME, so the surface makes
 * no decisions of its own.
 *
 * ► **IT EXISTS BECAUSE `tools/arena/main.js` HAS GIVEN UP SIX LIVE DEFECTS IN
 *   THREE DAYS AND NOTHING CAN TEST IT.** That file's own history is a list of
 *   decisions moved out of it — `viewportFor`, `figureScaleFor`, `figureXAt`,
 *   `rankOfDepth`, `perSideFrom`, `rosterOrderOf` — every one of which had a
 *   live defect in it, and every one of which was found by screenshotting
 *   rather than by the suite. The projectile drawing arrived with four more
 *   decisions in it, and this is where they go.
 *
 *   **The most load-bearing of them is the SIZE**, which is the owner's own
 *   question about an arrow crossing lanes: it rides `figureScaleFor` on the
 *   arrow's INTERPOLATED depth, so it shrinks and grows exactly as the
 *   gladiators it is flying between do. A shell computing that inline is a
 *   number the suite cannot reach.
 *
 * @param {object} flight   from `projectileFlight`
 * @param {number} at       progress through the flight, 0..1
 * @param {object} view     `{ frontY, rankStride, figureScaleFor }`
 * @returns {object} `{ x, y, lift, rotation, size, trail }` — `lift` is already
 *   in ARENA UNITS, so a surface hands it straight to its own `toY`.
 */
export function projectileDrawAt(flight, at, { frontY, rankStride, figureScaleFor, rankOfDepth, keep } = {}) {
  if (typeof figureScaleFor !== "function" || typeof rankOfDepth !== "function") {
    throw new ProjectileError(
      "projectileDrawAt needs figureScaleFor and rankOfDepth injected; this module does not import the painter."
    );
  }
  const progress = Math.min(1, Math.max(0, Number.isFinite(at) ? at : 0));
  const frame = progress * flight.flightFrames;
  const point = projectileAt(flight, frame);
  // ► **A NULL DEPTH DRAWS AT THE FRONT RANK, and the decision belongs here
  //   rather than in the shell.** A rule set with the second axis off gives
  //   every gladiator `y: null` and `projectileAt` faithfully reports null —
  //   "this model has no depth" — but a canvas has to put the arrow somewhere.
  //   The front rank is where every figure in such a game already stands, so
  //   the arrow flies level with them.
  const depth = Number.isFinite(point.y) ? point.y : frontY;
  const size = figureScaleFor({
    yscale: 100,
    rank: rankOfDepth(depth, 0, { frontY, rankStride }),
    slotIndex: 0
  });
  const lift = (shotPoint) => shotPoint.height * ARENA_UNITS_PER_FIGURE_HEIGHT;
  return Object.freeze({
    x: point.x,
    y: depth,
    lift: lift(point),
    rotation: point.rotation,
    size,
    trail: Object.freeze(projectileTrail(flight, frame, keep === undefined ? {} : { keep }).map((puff) => {
      const puffDepth = Number.isFinite(puff.y) ? puff.y : frontY;
      return Object.freeze({
        x: puff.x,
        y: puffDepth,
        lift: lift(puff),
        // ► **THE PUFF'S OWN ROTATION, AND THIS MAPPER DROPPED IT UNTIL
        //   2026-09-15.** `projectileTrail`'s docstring three functions up has
        //   always said a puff is dropped "at the arrow's own position AND
        //   ROTATION (`+0x71aa`-`+0x7205`)" — and `projectileAt` has always
        //   returned it — but this object copied x, y, lift and size and walked
        //   past `rotation`, so `tools/arena/main.js` had nothing to pass and
        //   hardcoded `rotation: 0`. A bombard's puffs therefore lay flat along
        //   an arc whose arrow was pitching, which reads as a deliberate look.
        //   **It is the same defect as the colour transform this file's sibling
        //   carried for a month: the value was computed, documented, and
        //   dropped one seam short of the painter.** Each puff keeps the
        //   rotation the arrow HAD when it was dropped, not the arrow's current
        //   one, which is why it is read off `puff` and not off `point`.
        rotation: puff.rotation,
        // Each puff at ITS OWN depth's scale, not the arrow's: a trail across
        // lanes tapers, which is the whole reason the depth is interpolated
        // rather than fixed at the launch.
        size: figureScaleFor({
          yscale: 100,
          rank: rankOfDepth(puffDepth, 0, { frontY, rankStride }),
          slotIndex: 0
        })
      });
    }))
  });
}

export function projectileTrail(flight, frame, { keep = 6 } = {}) {
  const puffs = [];
  const t = Math.min(flight.flightFrames, Math.max(0, Number.isFinite(frame) ? frame : 0));
  for (let at = SS2_PROJECTILE.trailEveryFrames; at <= t; at += SS2_PROJECTILE.trailEveryFrames) {
    puffs.push(projectileAt(flight, at));
  }
  return puffs.slice(-keep);
}

/* ------------------------------------------------------------------ */
/* The fireball: the arrow's clip depth, the snipe's height, no arc     */
/* ------------------------------------------------------------------ */

/**
 * THE FIREBALL'S FLIGHT — read 2026-09-22 from the fireball arm of the same
 * block, `+0x8f59`-`+0x94ff` (see `SS2_FIREBALL_SPELLS` in
 * `src/team/ss2-rules.js` for the arm statement by statement).
 *
 * ► **A SEPARATE FAMILY FROM `projectileFlight`, NOT A THIRD KIND OF IT**,
 *   because the two answer different questions. The arrow's flight ends where
 *   `ceil(distance / Xvelocity)` says, stopped short of the body; the
 *   fireball's ends at the first frame the build's OWN impact test passes, and
 *   that test — past the target's `_x` along the CASTER's facing — is the
 *   whole of the arithmetic. `projectileFlight` still refuses `"fireball"`.
 *
 * ► **FLAT.** The `onEnterFrame` (`+0x947b`-`+0x94fe`) reads `flying`,
 *   `gladiator_dir`, `_x` and `Xvelocity`. `gravity` 2, `bulletlife` 1 and
 *   `bulletcounter` 1 are written (`+0x9333`-`+0x936b`) and never read — the
 *   arrow arm's setup, copied — so there is no arc, no tumble and no trail.
 */
export const SS2_FIREBALL = Object.freeze({
  /** `bullet._x = attacker._x + 30` facing right (`+0x92ab`), `- 30` otherwise (`+0x92cf`). */
  launchOffsetX: 30,
  /**
   * `bullet._y = attacker._y - (attacker._yscale * 1.5 + 5)` (`+0x9301`-`+0x9332`)
   * — the SNIPE's formula term for term (`+0x6ea5`-`+0x6ed6`), so it is the
   * snipe's height here, in the snipe's figure-height units. See
   * `SS2_PROJECTILE.snipeLaunchHeightRatio` for why pixels are not ported.
   */
  launchHeight: SS2_PROJECTILE.bombardLaunchHeight * SS2_PROJECTILE.snipeLaunchHeightRatio,
  /**
   * In flight: frame 1, for ALL THREE spells. `bullet.gotondStop(fireball_frame)`
   * (`+0x9276`) is a typo naming a method that does not exist.
   */
  flightFrame: 1,
  /** `bullet.gotoAndStop(4)` at impact (`+0x91cd`-`+0x91e3`). */
  explosionFrame: 4,
  /**
   * The explosion child's frame count: `fireball_combat` frame 4 runs `stop()`
   * and places sprite 27, whose last frame runs `_parent.removeMovieClip()`.
   * ► **THE MAIN SESSION'S READING OF THE SPRITE, NOT RE-DERIVED HERE** — no
   *   dump this was built from covers sprites 27 or 28. A frame script runs
   *   before its frame is drawn, so the removal on the last frame means
   *   `explosionFrames - 1` frames are SEEN.
   */
  explosionFrames: 23
});

/**
 * WHEN THE FIREBALL LANDS — the build's impact test, solved.
 *
 * The bullet starts `launchOffsetX` ahead of the caster along its facing and
 * moves `xVelocity` a frame; the test is strict (`Greater` `+0x9122`, `Less2`
 * `+0x915d`), so it needs `30 + m * V > s`, where `s` is the target's
 * distance ALONG THE CASTER'S FACING (negative when the target is behind):
 *
 * ```text
 *   k = 0                         if s < 30
 *   k = floor((s - 30) / V) + 1   otherwise
 * ```
 *
 * ► **THE ±1 FRAME OF POLL ORDER, AND WHICH SIDE THIS TAKES.** The test lives
 *   in the ATTACKER's per-frame handler and the move in the BULLET's. On the
 *   cast's own frame the test runs before the launch (so it never sees this
 *   bullet), and on every later frame the two handlers race:
 *
 *   - **bullet first** (TAKEN): on frame t it has moved t times when tested,
 *     so it lands on frame `max(1, k)` having moved `max(1, k)` times — for
 *     `k = 0` it takes one step before the first test can see it;
 *   - attacker first: it lands on frame `k + 1` having moved `k` times.
 *
 *   **Bullet first, because it is the NEWEST clip** — on the recollection
 *   (NOT checked against Ruffle's source in this change) that Ruffle's AVM1
 *   execution list links a newly attached clip in at its head and walks it
 *   from the head, so the fireball's `onEnterFrame` would run before the
 *   fighters' on every frame after the one that attached it. **That is a
 *   statement about the runtime, not about these bytes, and no capture here
 *   has measured it; a capture of `bullet._x` at the impact frame settles it.**
 *   Flipping it is `moves = k`, `impactFrame = k + 1`.
 *
 * `moves` and `impactFrame` are equal on the side taken; both are returned so
 * the two readings stay distinguishable at every call site.
 */
export function fireballImpact({ casterX, targetX, gladiatorDir, xVelocity } = {}) {
  if (!Number.isFinite(casterX) || !Number.isFinite(targetX)) {
    throw new ProjectileError("A fireball needs a finite x for its caster and its target.");
  }
  if (!Number.isFinite(xVelocity) || xVelocity <= 0) {
    throw new ProjectileError(`A fireball needs a positive Xvelocity; got ${String(xVelocity)}.`);
  }
  // This engine's facing is two-valued — `facing-left` or its absence — so the
  // build's "anything but right" and its left arm coincide, as for the gale.
  const direction = gladiatorDir === "left" ? -1 : 1;
  // `+ 0` folds the `-0` a left-facing caster level with its target produces,
  // which `Object.is` and a strict deep-equal both tell apart from 0.
  const separation = (targetX - casterX) * direction + 0;
  const offset = SS2_FIREBALL.launchOffsetX;
  const k = separation < offset ? 0 : Math.floor((separation - offset) / xVelocity) + 1;
  const impactFrame = Math.max(1, k);
  return Object.freeze({ direction, separation, k, moves: impactFrame, impactFrame });
}

/**
 * Everything about one fireball that does not change while it flies.
 *
 * @param {object} shot
 * @param {object} shot.from          `{ x, y }` — the caster
 * @param {object} shot.to            `{ x, y }` — the target
 * @param {string} shot.gladiatorDir  the CASTER's facing, "left" or "right"
 * @param {number} shot.xVelocity     `Xvelocity`, 50 / 70 / 90
 */
export function fireballFlight({ from, to, gladiatorDir, xVelocity } = {}) {
  if (!Number.isFinite(from?.x) || !Number.isFinite(to?.x)) {
    throw new ProjectileError("A fireball needs a finite x on both ends; an unplaced caster has nothing to loose.");
  }
  const impact = fireballImpact({ casterX: from.x, targetX: to.x, gladiatorDir, xVelocity });
  const launchX = from.x + impact.direction * SS2_FIREBALL.launchOffsetX;
  return Object.freeze({
    kind: "fireball",
    direction: impact.direction,
    xVelocity,
    separation: impact.separation,
    k: impact.k,
    moves: impact.moves,
    /** The frame it lands on — what holds the action open, via `flightDurationMs`. */
    flightFrames: impact.impactFrame,
    explosionVisibleFrames: SS2_FIREBALL.explosionFrames - 1,
    launch: Object.freeze({
      x: launchX,
      // Depth is INVENTED, as for the arrow: the build has none. The caster's
      // rank at launch, the target's at impact, linear between.
      y: Number.isFinite(from.y) ? from.y : null,
      height: SS2_FIREBALL.launchHeight
    }),
    impact: Object.freeze({
      // Where the bullet STOPS — `flying = false` — which is past the victim's
      // centre by up to one `Xvelocity`, and is where the explosion plays.
      x: launchX + impact.direction * xVelocity * impact.moves,
      centreX: to.x,
      y: Number.isFinite(to.y) ? to.y : null
    })
  });
}

/**
 * Where the fireball is `frame` build frames after the cast, and what it shows.
 *
 * @returns {object} `{ stage, x, y, height, clipFrame, ageFrames }` — `stage` is
 *   `flight`, `explosion` or `gone`; `clipFrame` is the 1-based frame of
 *   `fireball_combat`; `ageFrames` the explosion's zero-based age.
 */
export function fireballAt(flight, frame) {
  if (!flight || flight.kind !== "fireball") {
    throw new ProjectileError("fireballAt needs a flight from fireballFlight().");
  }
  const t = Math.max(0, Number.isFinite(frame) ? frame : 0);
  const { launch, impact } = flight;
  if (t < flight.flightFrames) {
    const progress = t / flight.flightFrames;
    const y = launch.y === null || impact.y === null ? null : launch.y + (impact.y - launch.y) * progress;
    return Object.freeze({
      stage: "flight",
      x: launch.x + flight.direction * flight.xVelocity * t,
      y,
      height: launch.height,
      clipFrame: SS2_FIREBALL.flightFrame,
      ageFrames: 0
    });
  }
  const age = Math.floor(t - flight.flightFrames);
  const visible = age < flight.explosionVisibleFrames;
  return Object.freeze({
    stage: visible ? "explosion" : "gone",
    x: impact.x,
    y: impact.y,
    // It stops where it was: `flying = false` halts `_x` and nothing ever moved `_y`.
    height: launch.height,
    clipFrame: SS2_FIREBALL.explosionFrame,
    ageFrames: Math.min(age, flight.explosionVisibleFrames - 1)
  });
}

/** How long the fireball is on screen: its flight, then its explosion. */
export function fireballLifetimeMs(flight) {
  if (!flight || flight.kind !== "fireball") {
    throw new ProjectileError("fireballLifetimeMs needs a flight from fireballFlight().");
  }
  return (flight.flightFrames + flight.explosionVisibleFrames) * PROJECTILE_FRAME_MS;
}

/**
 * EVERYTHING A SURFACE NEEDS TO DRAW ONE FIREBALL `elapsedMs` AFTER THE CAST,
 * the way `projectileDrawAt` is for the arrow — so the shell only paints.
 *
 * `done` is decided in MILLISECONDS against `fireballLifetimeMs`, the number a
 * shell prunes with, so "still drawn" and "still attached" are one comparison.
 * `mirrored` is `bullet._xscale = 0 - bullet._xscale` (`+0x92e0`), facing left.
 */
export function fireballDrawAt(flight, elapsedMs, { frontY, rankStride, figureScaleFor, rankOfDepth } = {}) {
  if (typeof figureScaleFor !== "function" || typeof rankOfDepth !== "function") {
    throw new ProjectileError(
      "fireballDrawAt needs figureScaleFor and rankOfDepth injected; this module does not import the painter."
    );
  }
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const done = elapsed >= fireballLifetimeMs(flight);
  const lastFrame = flight.flightFrames + flight.explosionVisibleFrames - 1;
  const point = fireballAt(flight, Math.min(lastFrame, elapsed / PROJECTILE_FRAME_MS));
  // A null depth draws at the front rank, for `projectileDrawAt`'s reason.
  const depth = Number.isFinite(point.y) ? point.y : frontY;
  const size = figureScaleFor({
    yscale: 100,
    rank: rankOfDepth(depth, 0, { frontY, rankStride }),
    slotIndex: 0
  });
  return Object.freeze({
    stage: done ? "gone" : point.stage,
    x: point.x,
    y: depth,
    lift: point.height * ARENA_UNITS_PER_FIGURE_HEIGHT,
    rotation: 0,
    size,
    mirrored: flight.direction < 0,
    clipFrame: point.clipFrame,
    ageFrames: point.ageFrames,
    done
  });
}
