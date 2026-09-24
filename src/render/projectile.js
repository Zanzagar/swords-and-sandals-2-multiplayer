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
 * third frame; the `± 30` launch offset; and the launch HEIGHTS, `_yscale * 2 +
 * 30` and `_yscale * 1.5 + 5` arena units over the shooter's feet (since
 * 2026-09-23 — see `launchLiftFor`).
 *
 * **Ours, and each says why below**: the bombard velocity's SOURCE (the build
 * draws it; a renderer here may not), and the arc's peak, normalised to one
 * launch height. ~~"the launch heights in arena units rather than the build's
 * screen pixels"~~ — the build's were arena units all along, and the port of
 * their RATIO onto the authored 150-unit figure launched every arrow at two
 * thirds of the build's height.
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

import { SS2_FIGURE_HALF_WIDTH, SS2_FIGURE_HEIGHT } from "../common/ss2-figure.js";

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
   * HOW HIGH THE ARROW STARTS, in BOMBARD LAUNCH HEIGHTS: 1 is where the
   * shooter's bombard leaves, and `flight.liftPerHeight` turns it into arena
   * units (see `launchLiftFor`).
   *
   * ► ~~**THE BUILD'S NUMBERS ARE SCREEN PIXELS AND ARE NOT PORTED AS NUMBERS
   *   — the RATIO between them is what survives**~~ — **WRONG, corrected
   *   2026-09-23: they ARE arena units, and are now ported as numbers.** The
   *   bullet is attached to `arena.gladiators` (`+0x6da2`), the same object
   *   both fighters are attached to at `_x` ±250, `_y` 200 — which is where
   *   this engine's arena units come from — and it is placed relative to the
   *   shooter's own `_y`. So `_yscale * 2 + 30` for a bombard (`+0x6e42`) and
   *   `_yscale * 1.5 + 5` for a snipe (`+0x6e9e`) are arena units above the
   *   shooter's feet: 230 and 155 at `_yscale` 100. The shield lesson (twips
   *   against pixels, 2026-09-13) was about two spaces that differ; these two
   *   are one. Porting only the ratio and anchoring it at the AUTHORED
   *   figure's 150 units is what launched every arrow at two thirds of the
   *   build's height, below the head of the gladiator actually drawn.
   *
   * **A snipe is still loosed lower** — `155 / 230` at `_yscale` 100, which is
   * what these two keep saying for any caller that reads them as a ratio.
   */
  bombardLaunchHeight: 1,
  snipeLaunchHeightRatio: 155 / 230,
  /** `attacker._yscale * 2 + 30` (`+0x6e42`-`+0x6e76`): a bombard's launch, arena units over the feet. */
  bombardLaunch: Object.freeze({ perYscale: 2, plus: 30 }),
  /** `attacker._yscale * 1.5 + 5` (`+0x6e9e`-`+0x6ed6`): a snipe's, and the fireball's (`+0x9301`). */
  snipeLaunch: Object.freeze({ perYscale: 1.5, plus: 5 }),
  /**
   * The `_yscale` taken when a caller states none: the fighter clip's own,
   * unscaled — the same "absent draws nominal" rule `figureScaleFor` keeps.
   */
  nominalYscale: 100
});

/**
 * A launch, in ARENA UNITS above the shooter's feet, for a shooter drawn at
 * `yscale` — the build's own formula, term for term.
 *
 * ► **IT REPLACES `ARENA_UNITS_PER_FIGURE_HEIGHT = 150`** (until 2026-09-23),
 *   "the arena height of a gladiator at scale 1", duplicated from `painter.js`'s
 *   AUTHORED figure. The build's gladiator is its 222.65-pixel clip drawn 1:1
 *   and scaled by `physical_size` (`ARENA_UNITS_PER_CLIP_PIXEL` in
 *   `extracted-figure.js`), and the build's arrow leaves just over ITS crown:
 *   at strength 9, 202 units up against a 191.5-unit figure. At 150 it left
 *   26 units over the 124-unit figure the arena was drawing — and that figure
 *   was itself two thirds of the build's size.
 *
 * **It exists because mixing units is a real defect and the first version of
 * `rotationAt` had it** — normalising the horizontal by `distance` while the
 * vertical was in figure heights put the launch pitch at 76 degrees, near
 * vertical, for a shot that is plainly a lob. That reason survives the change:
 * a height is converted to arena units HERE and nowhere else.
 */
export function launchLiftFor(kind, yscale) {
  // `_yscale` is a percentage and only its magnitude sizes the clip; absent or
  // zero is the nominal clip, as `figureScaleFor` reads it.
  const size = yscaleOf(yscale);
  const { perYscale, plus } = kind === ProjectileKind.BOMBARD ? SS2_PROJECTILE.bombardLaunch : SS2_PROJECTILE.snipeLaunch;
  return size * perYscale + plus;
}

/** A flight's arena units per unit of `height`, or the nominal shooter's. */
function liftPerHeightOf(flight) {
  return Number.isFinite(flight?.liftPerHeight) && flight.liftPerHeight > 0
    ? flight.liftPerHeight
    : launchLiftFor(ProjectileKind.BOMBARD, null);
}

/**
 * THE DRAWN LIFT — the flight's own height, put on the two BODIES THE ARENA
 * DRAWS, at their ranks. Arena units, for a surface's `toY`.
 *
 * ► **FOUND BY A CODEX REVIEW AND REPRODUCED BEFORE THIS WAS WRITTEN
 *   (2026-09-23).** The lift was `height * liftPerHeight` and nothing else: the
 *   arc's end in the SHOOTER's units, with none of the depth scale every body
 *   is drawn at. A strength-9 bombard over 500 units ended 186.46 up against a
 *   rank-2 crown of 179.99; over 3000 units, 199.79 against a front-rank
 *   crown of 191.48. A resolved hit ended over its victim's head.
 *
 * WHICH PART IS WHOSE:
 *
 * - **The build's**: the LAUNCH, `_yscale * 2 + 30` or `* 1.5 + 5` in the
 *   shooter's own units (`launchLiftFor`), and the flight ENDING AT THE
 *   DEFENDER — its end test (`+0x6c97`-`+0x6d24`) is `bullet._x` passing
 *   `defender._x` along the shooter's facing, or `bullet._y > 160` (the
 *   ground), then `checkattackroll` and `removeMovieClip`. **The build checks
 *   NO height there — it is not a `hitTest`** (a brief for this change said it
 *   was; the bytes say otherwise). Its arrow meets the defender at whatever
 *   height the arc has reached.
 * - **Ours**: WHERE ON THE DEFENDER. The flight ends on the target's own
 *   shoulder by the build's own shoulder formula, `_yscale * 1.5 + 5` in the
 *   TARGET's units, which is on the body for every `_yscale` this game reaches
 *   (0.69-0.70 of its height). A snipe between two gladiators the same size in
 *   the same rank therefore stays exactly flat, as the build's does. The
 *   difference from the shooter's own height is spread linearly over the
 *   flight, so the build's launch is kept and only the end moves.
 * - ► **FLAT SHOTS ONLY — a snipe and a fireball.** ~~The lob went through here
 *   too~~ until a second Codex finding the same day: spreading its correction
 *   over the whole flight pulled it under bystanders' crowns long before the
 *   target. A lob is drawn by `lobLiftAt`, which says what it keeps instead.
 * - **Ours, and the build has nothing to be faithful to**: the DEPTH scale.
 *   Vanilla has one rank. Here each point is drawn at the scale of the rank the
 *   arrow is passing through — the same `size` its art is drawn at — so it
 *   leaves at the shooter's drawn head and lands at the target's drawn
 *   shoulder at their ranks.
 *
 * @param {object} flight  from `projectileFlight` or `fireballFlight`
 * @param {number} height  the point's height, in the flight's own units
 * @param {number} progress 0 at the launch, 1 at the end
 * @param {number} size     the depth scale at this point
 * @param {number} endHeight the flight's own height at its end
 * @param {number} endSize  the depth scale at the end — the target's rank
 */
function drawnLiftAt(flight, height, progress, size, endHeight, endSize) {
  const perHeight = liftPerHeightOf(flight);
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  return height * perHeight * size + p * (shoulderOf(flight) * endSize - endHeight * perHeight * endSize);
}

/** The target's shoulder in its own units, before its rank's depth scale. */
function shoulderOf(flight) {
  return Number.isFinite(flight?.impact?.lift) ? flight.impact.lift : launchLiftFor(ProjectileKind.SNIPE, null);
}

/**
 * How far over a body's crown a drawn lob is required to stay, and how far
 * either side of its drawn body that requirement reaches: 5% each. Authored —
 * the build looses a bombard 202 units up over a strength-9 archer's
 * 191.5-unit crown, 5.5% over his own head, and the drawing keeps about that.
 */
const LOB_CROWN_MARGIN = 0.05;
const LOB_FOOTPRINT_MARGIN = 0.05;

/**
 * THE CAP ON HOW MUCH A LOB MAY BE RAISED: its bulge may peak at a quarter of
 * the flight's length, never less than its own. Authored, and the reason is
 * the STAGE: the camera fits the fight's spread into 640 stage pixels, so the
 * headroom it shows grows with the distance, and at a quarter of the length a
 * raised lob's peak stays on the stage from the default pair to the walls —
 * `test/render-arena-shell.test.js` projects it through the stage camera and
 * says so. Without a cap a body at the very end of a flight would need an
 * unbounded raise.
 */
const LOB_PEAK_PER_LENGTH = 0.25;

/**
 * THE ROOM AT EITHER END OF A LOB IN WHICH IT CANNOT PROMISE TO CLEAR A BODY:
 * 140 arena units. DERIVED, not chosen: near an end the capped bulge rises at
 * most one unit per unit of x (a parabola peaking at a quarter of the length
 * leaves at slope 1), and the most it must climb is the tallest blocker's
 * clearance over the lowest landing — a strength-50 body (`_yscale` 113),
 * `222.65 * 1.13 * 1.05` = 264.2, over a strength-0 target's shoulder, `80 *
 * 1.5 + 5` = 125: 139.2. Beyond 140 units from both ends every body this game
 * can field is cleared; within it, see `lobLiftAt`.
 */
const LOB_END_ROOM = 140;

/**
 * How high on the target a lob lands when a body stands in its approach: 95% of
 * the target's crown, the top of its head, still on its body. See `lobLiftAt`.
 */
const LOB_RAISED_LANDING = 0.95;

/**
 * THE DRAWN LOB — `chord + k * bulge`, one scalar `k` per flight, so the path
 * is exactly as smooth as the shooter's own arc. Arena units, for `toY`.
 *
 * ► **THREE CODEX FINDINGS ON ONE DAY, EACH REPRODUCED BEFORE IT WAS FIXED
 *   (2026-09-23).** (1) The lob's end correction was spread over the whole
 *   flight and pulled it under bystanders' crowns 172 units short of the
 *   target. (2) The fix for that took the MAX of the arc and a clearance floor
 *   that existed only directly over a body, so the arrow JUMPED at every
 *   footprint edge: a strength-50 bystander at x 86 in front of a strength-9
 *   archer at 0 shooting at 1000 gave 203.28 at x 31.53865 and 264.17 at
 *   31.54065 — 60.89 units in 0.002. (3) This construction, which cannot jump.
 *
 * ## THE CONSTRUCTION
 *
 * With `s` the arrow's progress in x, 0 at the launch and 1 at the landing:
 *
 * - **the chord** runs straight from the launch to the landing;
 * - **the bulge** is the SHOOTER's own arc's excess over ITS OWN chord — zero
 *   at both ends, so the landing is exact whatever `k` is (the arc's excess
 *   over the launch-to-landing chord would not vanish at the landing);
 * - **`k`** is the smallest value `>= 1` for which every body in the way, its
 *   footprint widened by `LOB_FOOTPRINT_MARGIN`, is cleared by
 *   `LOB_CROWN_MARGIN` — evaluated over the whole footprint outside the end
 *   rooms — and never more than the cap (`LOB_PEAK_PER_LENGTH`).
 *
 * Every term is continuous in `s` and `k` is fixed for the flight, so there is
 * nothing to jump. With nobody in the way `k` is 1 and the lob is the
 * shooter's arc bent linearly onto the target's shoulder.
 *
 * ## THE ENDS, which no bounded `k` can reach
 *
 * Within `LOB_END_ROOM` of either end the bulge is too small for any capped
 * `k` to clear a tall body, and the two ends are treated differently:
 *
 * - **At the landing, THE LANDING RISES.** If a body in the target's rank
 *   stands within the end room, the lob lands at `LOB_RAISED_LANDING` of the
 *   target's crown — its head — instead of its shoulder. Chosen over simply
 *   accepting the overlap because the case is COMMON, not rare: the walk clamp
 *   parks the shooter's own front-liner `physical_size` in front of the target,
 *   ~3 units from its drawn front, and a lob landing on the shoulder would come
 *   down through that ally's back on nearly every team-fight bombard — the
 *   "shooting its own teammate" picture the owner already reported once
 *   (`stopShortFor`). Landing on the head keeps it on the target (the build's
 *   end checks no height at all) and leaves only a graze of the ally's crown in
 *   the last few units — measured between two strength-9 gladiators with the
 *   ally at the clamp, the lob's lowest point over him is 187.6 at ±250, 182.9
 *   at ±1500 and 182.6 at the walls, against his 191.5 crown: 3.9 to 8.9 units
 *   into the top of his head, where a shoulder landing would go through his back.
 * - **At the launch, THE OVERLAP IS ACCEPTED.** The launch is the build's own
 *   formula and is not moved. A body standing within the end room in front of
 *   the archer — taller than his launch height — is passed through as the lob
 *   leaves, before it is high enough to clear him.
 *
 * WHICH PART IS WHOSE: the LAUNCH (`_yscale * 2 + 30`, the shooter's units)
 * and the END AT THE DEFENDER (`bullet._x` passing `defender._x`, or `_y >
 * 160`, `+0x6c97`-`+0x6d24`) are the build's. The arc's normalised peak, the
 * chord, `k`, the cap, the end rooms and where on the target it lands are
 * ours: the build has one defender and nobody in the way.
 */
function lobLiftAt(flight, point, deps) {
  const shape = lobShapeFor(flight, deps);
  return shape.liftAt(shape.progressAt(point.x));
}

/** Whether a body at depth `a` stands in the rank a point at depth `b` is passing. */
function sameRank(a, b, halfStride) {
  return !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) <= halfStride;
}

/**
 * A flight's lob, built ONCE per flight and drawing context and cached: `k`
 * walks every body's footprint, and a surface asks for the lift every frame.
 */
const lobShapes = new WeakMap();

function lobShapeFor(flight, deps) {
  const { frontY, rankStride, figureScaleFor, rankOfDepth } = deps;
  const cached = lobShapes.get(flight);
  if (cached && cached.frontY === frontY && cached.rankStride === rankStride
    && cached.figureScaleFor === figureScaleFor && cached.rankOfDepth === rankOfDepth) {
    return cached.shape;
  }
  const sizeAt = (at) => figureScaleFor({ yscale: 100, rank: rankOfDepth(at, 0, { frontY, rankStride }), slotIndex: 0 });
  const halfStride = Number.isFinite(rankStride) && rankStride > 0 ? rankStride / 2 : Infinity;
  const direction = flight.direction;
  const x0 = flight.launch.x;
  const x1 = flight.impact.x;
  const length = Math.abs(x1 - x0);
  const y0 = Number.isFinite(flight.launch.y) ? flight.launch.y : frontY;
  const y1 = Number.isFinite(flight.impact.y) ? flight.impact.y : frontY;
  const sigma0 = sizeAt(y0);
  const sigma1 = sizeAt(y1);
  const perHeight = liftPerHeightOf(flight);
  // The arc is sampled over the frames the arrow spends MOVING: x reaches the
  // landing at `length / Xvelocity`, a little before `flightFrames`.
  const travelFrames = flight.xVelocity > 0 ? length / flight.xVelocity : 0;
  const heightAt = (s) => projectileAt(flight, s * travelFrames).height;
  const h0 = heightAt(0);
  const h1 = heightAt(1);
  const bulgeAt = (s) => Math.max(0, (heightAt(s) - (h0 + s * (h1 - h0))) * perHeight);
  const progressAt = (x) => (length > 0 ? Math.min(1, Math.max(0, (direction * (x - x0)) / length)) : 1);
  const depthAt = (s) => y0 + s * (y1 - y0);
  const scaleAt = (s) => sigma0 + s * (sigma1 - sigma0);
  const fromLanding = (x) => -direction * (x - x1);
  const fromLaunch = (x) => direction * (x - x0);

  // The bodies in the way, with their widened drawn footprints and crowns.
  const bodies = (flight.bodies ?? []).map((body) => {
    const scale = (body.yscale / 100) * sizeAt(body.y);
    return {
      x: body.x,
      y: body.y,
      reach: SS2_FIGURE_HALF_WIDTH * scale * (1 + LOB_FOOTPRINT_MARGIN),
      clearance: SS2_FIGURE_HEIGHT * scale * (1 + LOB_CROWN_MARGIN)
    };
  });

  // The landing: the target's shoulder, raised to its head when somebody in
  // its rank stands in the end room before it.
  const crowded = bodies.some((body) => sameRank(body.y, y1, halfStride)
    && fromLanding(body.x - direction * body.reach) > 0
    && fromLanding(body.x + direction * body.reach) < LOB_END_ROOM);
  const targetScale = (flight.impact.yscale ?? SS2_PROJECTILE.nominalYscale) / 100;
  const landing = crowded
    ? Math.max(shoulderOf(flight), LOB_RAISED_LANDING * SS2_FIGURE_HEIGHT * targetScale)
    : shoulderOf(flight);
  const launch = h0 * perHeight;
  const chordAt = (s) => launch * sigma0 + s * (landing * sigma1 - launch * sigma0);

  // `k`: the smallest raise that clears every footprint outside the end rooms,
  // sampled a unit apart and at both edges.
  const peak = bulgeAt(0.5) * scaleAt(0.5);
  const cap = peak > 0 ? Math.max(1, (LOB_PEAK_PER_LENGTH * length) / peak) : 1;
  let k = 1;
  for (const body of bodies) {
    const lo = body.x - body.reach;
    const hi = body.x + body.reach;
    const xs = [];
    for (let x = lo; x < hi; x += 1) xs.push(x);
    xs.push(hi);
    for (const x of xs) {
      if (fromLaunch(x) < LOB_END_ROOM || fromLanding(x) < LOB_END_ROOM) continue;
      const s = progressAt(x);
      if (!sameRank(body.y, depthAt(s), halfStride)) continue;
      const room = bulgeAt(s) * scaleAt(s);
      if (!(room > 0)) continue;
      k = Math.max(k, (body.clearance - chordAt(s)) / room);
    }
  }
  k = Math.min(k, cap);

  const shape = Object.freeze({
    k, cap, landing, crowded,
    progressAt,
    liftAt: (s) => chordAt(s) + k * bulgeAt(s) * scaleAt(s)
  });
  lobShapes.set(flight, { frontY, rankStride, figureScaleFor, rankOfDepth, shape });
  return shape;
}

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
 * @param {number} [shot.shooterYscale]  the SHOOTER's `_yscale` — its
 *   `physical_size`, the place-clip's `yscale` — which the build's launch
 *   height is written in terms of. Absent is the nominal 100.
 * @param {number} [shot.targetYscale]  the TARGET's, which says where its
 *   shoulder is: the drawn flight ends there (`drawnLiftAt`). Absent is 100.
 * @param {Array<{x, y, yscale}>} [shot.bodies]  every OTHER living gladiator
 *   standing when the shot is loosed — the bodies a drawn lob must pass over
 *   (`lobLiftAt`). Absent is an empty arena.
 * @returns {object} frozen flight, or throws if the two ends are not placed
 */
export function projectileFlight({
  kind, from, to, sequence = 0, targetSize = 0, shooterYscale = null, targetYscale = null, bodies = []
} = {}) {
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
  // The unit every `height` is in: THIS shooter's bombard launch, in arena
  // units. A snipe leaves at its own formula's share of it — `155 / 230` at the
  // nominal `_yscale`, a shade less for a smaller gladiator (`134 / 202` at 86).
  const liftPerHeight = launchLiftFor(ProjectileKind.BOMBARD, shooterYscale);
  const launchHeight = arc
    ? SS2_PROJECTILE.bombardLaunchHeight
    : launchLiftFor(ProjectileKind.SNIPE, shooterYscale) / liftPerHeight;
  return Object.freeze({
    kind,
    arc,
    distance,
    direction,
    xVelocity,
    yVelocity,
    gravity: SS2_PROJECTILE.gravity,
    flightFrames,
    /** Arena units per unit of `height` — this shooter's bombard launch. */
    liftPerHeight,
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
      y: Number.isFinite(to?.y) ? to.y : null,
      // The TARGET's shoulder, `_yscale * 1.5 + 5` in its own units, before its
      // rank's depth scale: where the DRAWN flight ends. See `drawnLiftAt`.
      lift: launchLiftFor(ProjectileKind.SNIPE, targetYscale),
      // Its `_yscale`, which is its `physical_size`: the room the walk clamp
      // keeps in front of it, and so a lob's default approach (`lobLiftAt`).
      yscale: yscaleOf(targetYscale)
    }),
    bodies: bodiesFrom(bodies)
  });
}

/** A `_yscale` as a positive percentage, the nominal clip's when none is stated. */
function yscaleOf(yscale) {
  const stated = Number(yscale);
  return Number.isFinite(stated) && stated !== 0 ? Math.abs(stated) : SS2_PROJECTILE.nominalYscale;
}

/** The other bodies a flight passes, frozen and normalised; malformed ones are dropped. */
function bodiesFrom(bodies) {
  return Object.freeze((Array.isArray(bodies) ? bodies : [])
    .filter((body) => Number.isFinite(body?.x))
    .map((body) => Object.freeze({
      x: body.x,
      y: Number.isFinite(body.y) ? body.y : null,
      yscale: yscaleOf(body.yscale)
    })));
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
 *   and is null when neither end models any; `height` is in BOMBARD LAUNCH
 *   HEIGHTS (~~figure heights~~ until 2026-09-23), which `flight.liftPerHeight`
 *   turns into arena units.
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
  // Written in BOMBARD LAUNCH HEIGHTS (see `bombardLaunchHeight`), with the
  // ballistic term normalised by the same `yVelocity` that generated it: the
  // peak is one launch-height above the launch, whatever the range, which is
  // what keeps a long shot readable instead of leaving the arena. **That
  // normalisation is OURS** — the build's rise is `Yvelocity^2 / 4` arena units
  // at the peak, 841 on a 58-frame shot — and the launch it starts from is the
  // build's, in the build's units (`launchLiftFor`). ~~"Written in FIGURE
  // HEIGHTS rather than the build's pixels"~~ until 2026-09-23: the build's
  // numbers were never pixels, see `SS2_PROJECTILE.bombardLaunchHeight`.
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
  const sizeAt = (at) => figureScaleFor({ yscale: 100, rank: rankOfDepth(at, 0, { frontY, rankStride }), slotIndex: 0 });
  const size = sizeAt(depth);
  // ► **ON THE BODIES THE ARENA DRAWS, AT THEIR RANKS** — `drawnLiftAt`, which
  //   says which half of this is the build's. The end is read once here: every
  //   point and every puff bends toward the same target shoulder.
  const end = projectileAt(flight, flight.flightFrames);
  const endSize = sizeAt(Number.isFinite(end.y) ? end.y : frontY);
  // A LOB goes over the bodies it passes (`lobLiftAt`); a flat shot is gated on
  // a clear line by the rules, so it flies straight from shoulder to shoulder.
  const deps = { frontY, rankStride, figureScaleFor, rankOfDepth };
  const lift = (shotPoint, pointSize) => (flight.arc
    ? lobLiftAt(flight, shotPoint, deps)
    : drawnLiftAt(flight, shotPoint.height, shotPoint.progress, pointSize, end.height, endSize));
  return Object.freeze({
    x: point.x,
    y: depth,
    lift: lift(point, size),
    rotation: point.rotation,
    size,
    trail: Object.freeze(projectileTrail(flight, frame, keep === undefined ? {} : { keep }).map((puff) => {
      const puffDepth = Number.isFinite(puff.y) ? puff.y : frontY;
      return Object.freeze({
        x: puff.x,
        y: puffDepth,
        lift: lift(puff, sizeAt(puffDepth)),
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
        size: sizeAt(puffDepth)
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
   * snipe's height here, in the same bombard-launch units, AT THE NOMINAL
   * `_yscale` 100. `fireballFlight` works it out for the caster it is given
   * (`launchLiftFor`); this is the value a caster with no stated size gets.
   * ~~"See `SS2_PROJECTILE.snipeLaunchHeightRatio` for why pixels are not
   * ported"~~ — they are arena units and are ported, since 2026-09-23.
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
 * @param {number} [shot.casterYscale] the caster's `_yscale` (`physical_size`),
 *   which its launch height is written in terms of; absent is the nominal 100
 */
export function fireballFlight({ from, to, gladiatorDir, xVelocity, casterYscale = null, targetYscale = null } = {}) {
  if (!Number.isFinite(from?.x) || !Number.isFinite(to?.x)) {
    throw new ProjectileError("A fireball needs a finite x on both ends; an unplaced caster has nothing to loose.");
  }
  const impact = fireballImpact({ casterX: from.x, targetX: to.x, gladiatorDir, xVelocity });
  const launchX = from.x + impact.direction * SS2_FIREBALL.launchOffsetX;
  // The arrow's unit, for the arrow's reason: one bombard launch of THIS caster.
  const liftPerHeight = launchLiftFor(ProjectileKind.BOMBARD, casterYscale);
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
    /** Arena units per unit of `height`, as on the arrow's flight. */
    liftPerHeight,
    launch: Object.freeze({
      x: launchX,
      // Depth is INVENTED, as for the arrow: the build has none. The caster's
      // rank at launch, the target's at impact, linear between.
      y: Number.isFinite(from.y) ? from.y : null,
      // `_yscale * 1.5 + 5` over THIS caster's feet — the snipe's formula.
      height: launchLiftFor("fireball", casterYscale) / liftPerHeight
    }),
    impact: Object.freeze({
      // Where the bullet STOPS — `flying = false` — which is past the victim's
      // centre by up to one `Xvelocity`, and is where the explosion plays.
      x: launchX + impact.direction * xVelocity * impact.moves,
      centreX: to.x,
      y: Number.isFinite(to.y) ? to.y : null,
      // The TARGET's shoulder, as on the arrow: the drawn flight ends there and
      // the burst plays there. The build's is the CASTER's shoulder height,
      // which is the same point between two gladiators alike. See `drawnLiftAt`.
      lift: launchLiftFor("fireball", targetYscale)
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
  const sizeAt = (at) => figureScaleFor({ yscale: 100, rank: rankOfDepth(at, 0, { frontY, rankStride }), slotIndex: 0 });
  const size = sizeAt(depth);
  // On the two drawn bodies, as the arrow is (`drawnLiftAt`): the flight is flat
  // in the build, so its end height IS its launch height, and the burst is the
  // end.
  const endY = Number.isFinite(flight.impact.y) ? flight.impact.y : frontY;
  const progress = point.stage === "flight" && flight.flightFrames > 0
    ? Math.min(1, Math.max(0, elapsed / PROJECTILE_FRAME_MS) / flight.flightFrames)
    : 1;
  return Object.freeze({
    stage: done ? "gone" : point.stage,
    x: point.x,
    y: depth,
    lift: drawnLiftAt(flight, point.height, progress, size, flight.launch.height, sizeAt(endY)),
    rotation: 0,
    size,
    mirrored: flight.direction < 0,
    clipFrame: point.clipFrame,
    ageFrames: point.ageFrames,
    done
  });
}
