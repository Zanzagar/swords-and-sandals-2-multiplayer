/**
 * A clip label -> a keyframe schedule. This module is where the renderer owns
 * TIME, and it owns it because nothing upstream does.
 *
 * MEASURED, NOT ASSUMED: the presentation stream carries no timing at all. No
 * command has a duration, a frame number or a completion signal, and
 * `place-clip` is emitted only during arena construction — so after the arena
 * is built, nothing in the stream ever moves a clip again. Every millisecond
 * and every pose below is therefore the renderer's invention, and the module
 * says so in each schedule's `provenance`.
 *
 * ► **ONE CLAUSE OF THAT IS NOW FALSE, corrected 2026-09-11 at the sentence.**
 *   `move-clip` moves a clip after the arena is built, so "nothing in the
 *   stream ever moves a clip again" no longer holds. **The claim the paragraph
 *   is actually about still holds exactly**: the stream carries no TIME. A
 *   `move-clip` names two endpoints and no duration, so how long the step takes
 *   and how the figure gets there are still authored here — see `travelAt`.
 *   The difference is that the DESTINATION is no longer invented by this
 *   module; it is the resolver's, and inventing one would now be a divergence
 *   from state a peer hashes rather than a harmless flourish.
 *
 * ---
 *
 * **PART 4 OF THE ANIMATION SEAM LANDS HERE, AND IT IS A DECISION.**
 *
 * `src/adapter/action-gate.js` implements parts 2 and 3 of the per-action
 * acknowledgement seam and then stops, deliberately:
 *
 *   "**It never times out.** Nothing here counts wall-clock, holds a timer or
 *   gives up on a surface. A timeout is a policy decision about a particular
 *   animation surface, and no capture of the vanilla timeline's own completion
 *   signal exists to derive one from."
 *
 * That was correct, and it left part 4 implemented nowhere — because until now
 * this repository had no animation surface to have a policy about. It has one
 * now, so the policy is stated here, in the surface that owns it, rather than
 * pushed back into the gate:
 *
 * - a timeline that has run **more than `ANIMATION_TIMEOUT_MS` past its own
 *   scheduled duration** is abandoned, not reported. `abandon(token, reason)`
 *   records that the gate was opened by this surface giving up, which is a
 *   different fact from the animation having finished, and the gate keeps them
 *   apart on purpose;
 * - the timeout is generous rather than tight, because the cost of waiting one
 *   extra beat is a pause and the cost of abandoning early is an action whose
 *   animation is still playing while the next one rebinds the globals under it;
 * - **the number is authored and is not derived from anything.** It cannot be:
 *   no capture records the vanilla timeline's completion signal. If one ever
 *   does, this constant is the thing it settles.
 */

export class TimelineError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = new.target.name;
  }
}

/**
 * How long past its scheduled end a timeline may run before the surface stops
 * waiting. Authored; see this module's header for why it cannot be derived.
 */
export const ANIMATION_TIMEOUT_MS = 4000;

/** The reference beat every authored duration is a multiple of. */
const BEAT_MS = 120;

const DEATH_VARIANTS = Object.freeze(["slain", "yield", "taunt", "arrow", "grievous"]);

/**
 * The vanilla condition FLAG names, which are what a condition phase emits as
 * its actor label. `poison` the condition has the flag `poisoned`; the flag is
 * the label, so this list is the flags.
 */
const CONDITION_LABELS = Object.freeze(new Set(["burning", "frozen", "poisoned", "life_stolen"]));

/**
 * The build's eight movement phases, each mapped to the GAIT it animates.
 *
 * The eight names and their byte offsets are the build's, from the battle
 * map's movement-cost table: `walkleft` `+0x3b37`, `walkright` `+0x3d16`,
 * `runleft` `+0x3ef5`, `runright` `+0x407e` (all `round(movement_speed / 2)`);
 * `chargeright` `+0x4214`, `chargeleft` `+0x4480` (`round(movement_speed * 2)`);
 * `jumpright` `+0x46ec`, `jumpleft` `+0x49c4` (`round(movement_speed)`). That
 * they are also the CLIP labels is the adapter's assumption, which is why
 * every one of them arrives marked `assumed`.
 *
 * **Four gaits, not eight schedules.** Direction is not a schedule: the figure
 * travels from the command's `from` to its `to` whichever way that points, and
 * a mirrored pose is the surface's business. Grouping by cost band would give
 * three; grouping by gait gives four, because a run and a walk cost the same
 * and should not read the same.
 */
const MOVEMENT_GAITS = Object.freeze(new Map([
  ["walkleft", "walk"], ["walkright", "walk"],
  ["runleft", "run"], ["runright", "run"],
  ["chargeleft", "charge"], ["chargeright", "charge"],
  ["jumpleft", "jump"], ["jumpright", "jump"],
  // ► **AUTHORED, AND IT IS THE ONLY ENTRY HERE THAT IS.** The eight above are
  //   the build's own phase names with byte offsets. `sidestep` names no
  //   vanilla phase — the build has no lane to change — so it is spelled
  //   without a direction, because a lane change has none: the figure travels
  //   from the command's `fromY` to its `toY` whichever way that points.
  ["sidestep", "sidestep"]
]));

/**
 * A pose is a set of normalised offsets a painter applies to the figure. All
 * zero is a neutral standing gladiator; the ranges are authored.
 */
const NEUTRAL = Object.freeze({
  lean: 0,        // -1 back .. +1 forward
  armSwing: 0,    // -1 wound up .. +1 fully extended
  legSpread: 0,   // 0 together .. 1 wide
  weaponAngle: 0, // turns, -0.25 .. +0.25
  bob: 0,         // -1 crouched .. +1 on toes
  recoil: 0,      // 0 none .. 1 fully knocked back
  fade: 0,        // 0 opaque .. 1 gone
  /**
   * How far the figure has stepped TOWARD its opponent, 0..1, applied by the
   * surface as a translation rather than a bend.
   *
   * ► **THIS EXISTS BECAUSE THE FIGURES DID NOT WALK, and they could not.**
   *   The presentation stream emits `place-clip` only during arena
   *   construction, so nothing ever moves a clip again — and it cannot, because
   *   **the resolver models no position at all**: a combatant projection
   *   carries stats, loadout, health, status and resources, and no x. Vanilla
   *   does move gladiators (`nextphase` clamps the active x to [-2100, 2100]),
   *   so this is a real gap, and closing it properly means putting position in
   *   the resolver — which puts it in `combatStateHash`, which makes it a
   *   protocol change. That is ranked, not done here.
   *
   *   What IS legitimate here is a lunge: the attacker steps in on the swing
   *   and back out after it, within its own slot. That is interpolation of a
   *   pose this module authored, which is presentation; it invents no position
   *   the resolver owns, and the figure ends where it started.
   *
   *   ► **HALF OF THAT IS NOW DONE — the PRESENTATION half, 2026-09-11.** The
   *     stream has a `move-clip` command, this module has four movement gaits,
   *     and `travelAt` carries a figure between the two endpoints a
   *     `move-clip` names. **The resolver still models no position**, so
   *     nothing in this repository emits a `move-clip` yet: the rule-set half
   *     is still ranked and is preserved as a reference patch at
   *     `docs/reference/position-in-the-resolver.patch.md`. The order is
   *     deliberate — landing the resolver half first made a walking gladiator
   *     play `Standing`, the idle clip, because there was no movement binding
   *     for it to reach.
   *
   *     `advance` stays exactly what it was, and the movement gaits leave it
   *     at 0 so the two displacements can never compound.
   */
  advance: 0
});

function pose(overrides) {
  return Object.freeze({ ...NEUTRAL, ...overrides });
}

function schedule(family, beats, keyframes, { loop = false, travel = false, depthTravel = false } = {}) {
  return Object.freeze({
    family,
    durationMs: beats * BEAT_MS,
    loop,
    /**
     * True when the figure TRAVELS across this schedule — its x runs from the
     * `move-clip`'s `from` to its `to` — rather than posing in place. It is a
     * flag rather than something a surface infers from the family name, so a
     * surface never has to know which families are movement.
     */
    travel,
    /**
     * The same for the SECOND axis: the figure's y runs from the
     * `move-clip-depth`'s `fromY` to its `toY`.
     *
     * A separate flag rather than a wider `travel`, for the reason the command
     * kinds are separate: a schedule that travels in x must never be handed a
     * depth motion, and a lane change must never slide the figure sideways.
     * No schedule sets both, and nothing yet needs one that does.
     */
    depthTravel,
    keyframes: Object.freeze(keyframes.map((frame) => Object.freeze({ at: frame.at, pose: pose(frame.pose) }))),
    // Not decoration: nothing upstream carries timing, so a surface must be
    // able to say that what it just played was invented here.
    provenance: "authored-timing"
  });
}

/**
 * The label families this module recognises, derived from the label STRING
 * because that is all a command carries. The families are:
 *
 * - `attackN` / `bombard` / `snipe` / `taunt` — the actor's swing;
 * - `hurtN` / `Block` / `taunted` / `knockback` — the target's answer;
 * - a death variant — `slain` / `yield` / `taunt` / `arrow` / `grievous`,
 *   which the adapter marks ASSUMED because the map records "death variants
 *   (585-1083)" without naming any of them;
 * - one of the build's eight movement phases, which collapse to four gaits and
 *   are the only family whose schedules TRAVEL;
 * - `Standing` and `rest`.
 *
 * Note the collision the build itself has: `taunt` is BOTH an attack label and
 * a death variant. This module resolves it by ROLE, which the command carries,
 * rather than by guessing from the string — see `timelineFor`.
 */
function familyOf(label, role) {
  if (typeof label !== "string" || label.length === 0) return "unknown";
  if (role === "defeated") return DEATH_VARIANTS.includes(label) ? `death:${label}` : "death:unknown";
  if (label === "Standing") return "standing";
  if (label === "rest") return "rest";
  // The build's own condition FLAG names, which `SS2_STATIC_MAP_BINDINGS`
  // emits as the actor label for a condition phase. Matched by name rather
  // than by pattern: `poison` is dispatched as `poisoned-phase` and its flag is
  // `poisoned`, so the three spellings differ and only the exact flag is safe.
  if (CONDITION_LABELS.has(label)) return `condition:${label}`;
  // Matched against the build's own eight phase names, never by a
  // /^(walk|run|charge|jump)(left|right)$/ pattern: a pattern would also
  // accept `sprintleft`, and silently giving an invented phase a recognised
  // gait is how a guess stops looking like one.
  if (MOVEMENT_GAITS.has(label)) return `movement:${MOVEMENT_GAITS.get(label)}`;
  if (label === "Block") return "block";
  if (label === "knockback") return "knockback";
  if (label === "taunted") return "taunted";
  if (label === "taunt") return "taunt";
  if (label === "bombard" || label === "snipe") return "ranged";
  if (/^attack\d+$/.test(label)) return "attack";
  if (/^hurt\d+$/.test(label)) return "hurt";
  return "unknown";
}

const FAMILIES = Object.freeze({
  standing: () => schedule("standing", 12, [
    { at: 0, pose: {} },
    { at: 0.5, pose: { bob: 0.12 } },
    { at: 1, pose: {} }
  ], { loop: true }),

  rest: () => schedule("rest", 10, [
    { at: 0, pose: {} },
    { at: 0.45, pose: { bob: -0.55, lean: 0.15, armSwing: -0.3 } },
    { at: 1, pose: { bob: -0.1 } }
  ]),

  attack: () => schedule("attack", 7, [
    { at: 0, pose: {} },
    { at: 0.28, pose: { armSwing: -0.7, lean: -0.25, weaponAngle: -0.18, bob: 0.15, advance: -0.12 } },
    { at: 0.52, pose: { armSwing: 1, lean: 0.55, weaponAngle: 0.2, legSpread: 0.6, advance: 1 } },
    { at: 0.75, pose: { armSwing: 0.45, lean: 0.3, legSpread: 0.35, advance: 0.55 } },
    { at: 1, pose: {} }
  ]),

  ranged: () => schedule("ranged", 9, [
    { at: 0, pose: {} },
    { at: 0.35, pose: { armSwing: -0.55, lean: -0.2, weaponAngle: -0.08 } },
    { at: 0.6, pose: { armSwing: -0.85, lean: -0.05, bob: 0.1 } },
    { at: 0.72, pose: { armSwing: 0.65, lean: 0.2 } },
    { at: 1, pose: {} }
  ]),

  /**
   * A condition taking its bearer's turn: burning, frozen, poisoned,
   * life_stolen. Four schedules rather than one, because they should not read
   * alike — but every millisecond of all four is AUTHORED, and the map records
   * "condition effects (1911-2004)" as a frame range naming no label inside it.
   */
  "condition:burning": () => schedule("condition:burning", 7, [
    { at: 0, pose: {} },
    { at: 0.2, pose: { recoil: 0.35, lean: -0.3, bob: 0.12, armSwing: 0.3 } },
    { at: 0.45, pose: { recoil: 0.2, lean: 0.2, bob: -0.1, armSwing: -0.2 } },
    { at: 0.7, pose: { recoil: 0.3, lean: -0.2, bob: 0.08, armSwing: 0.25 } },
    { at: 1, pose: {} }
  ]),
  "condition:frozen": () => schedule("condition:frozen", 8, [
    { at: 0, pose: {} },
    // Rigid on purpose: almost nothing moves, which is the whole read.
    { at: 0.3, pose: { bob: -0.08, legSpread: 0.05, lean: -0.04 } },
    { at: 0.72, pose: { bob: -0.05, legSpread: 0.02, lean: 0.03 } },
    { at: 1, pose: {} }
  ]),
  "condition:poisoned": () => schedule("condition:poisoned", 9, [
    { at: 0, pose: {} },
    { at: 0.35, pose: { lean: -0.55, bob: -0.45, armSwing: -0.35, legSpread: 0.25 } },
    { at: 0.7, pose: { lean: -0.35, bob: -0.3, armSwing: -0.2 } },
    { at: 1, pose: {} }
  ]),
  "condition:life_stolen": () => schedule("condition:life_stolen", 8, [
    { at: 0, pose: {} },
    { at: 0.4, pose: { bob: -0.5, lean: -0.15, armSwing: -0.45, fade: 0.18 } },
    { at: 0.75, pose: { bob: -0.25, armSwing: -0.2, fade: 0.08 } },
    { at: 1, pose: {} }
  ]),

  /**
   * The four gaits. **Every millisecond and every pose is AUTHORED**, and the
   * map is more silent here than it is about the conditions: it gives one
   * unnamed frame range, "movement and charge (33-104)", for all eight phases
   * together, so it does not even separate a walk from a charge.
   *
   * All four keep `advance` at 0 throughout, and that is load-bearing rather
   * than an omission. `advance` is the within-slot LUNGE the surface applies
   * with its own `ADVANCE_UNITS`; a movement schedule's displacement comes
   * from the `move-clip`'s two endpoints instead, through `travelAt`. A
   * schedule that used both would move the figure twice and the second
   * displacement would be one this module invented.
   *
   * The legs carry the read: a walk paces, a run leans in and spreads wider, a
   * charge commits the weapon forward, a jump leaves the ground (`bob` peaks
   * near 1 and the feet come together at the apex).
   */
  "movement:walk": () => schedule("movement:walk", 8, [
    { at: 0, pose: {} },
    { at: 0.25, pose: { legSpread: 0.45, bob: 0.06, lean: 0.08, armSwing: -0.15 } },
    { at: 0.5, pose: { legSpread: 0.08, bob: -0.04, lean: 0.05 } },
    { at: 0.75, pose: { legSpread: 0.45, bob: 0.06, lean: 0.08, armSwing: 0.15 } },
    { at: 1, pose: {} }
  ], { travel: true }),

  /**
   * ► **THE LANE CHANGE, AND IT IS AUTHORED TWICE OVER.** The build has no
   *   sidestep phase — its eight movement phases all change `_x` — so there is
   *   no clip label to be faithful to and no frame count to copy. This is mod
   *   surface for the second axis, named so it cannot be mistaken for one of
   *   the six map-named gaits above it.
   *
   * `depthTravel` rather than `travel`, and the distinction is the whole
   * point: `travel` means "interpolate the actor's X from its `motion`", and a
   * lane change moves the other axis. A schedule that set `travel` would have
   * the shell slide the figure sideways across the arena.
   *
   * Longer than a walk (10 frames against 8) on purpose: a lane change moves
   * 97 arena units of depth, which reaches the screen as 1.16 times the
   * figure's own drawn height. Covering that in a walk's time is what made the
   * first version read as a leap.
   */
  "movement:sidestep": () => schedule("movement:sidestep", 10, [
    { at: 0, pose: {} },
    { at: 0.2, pose: { legSpread: 0.3, bob: 0.04, lean: 0.06 } },
    { at: 0.5, pose: { legSpread: 0.5, bob: 0.02, lean: 0.02 } },
    { at: 0.8, pose: { legSpread: 0.3, bob: 0.04, lean: -0.04 } },
    { at: 1, pose: {} }
  ], { depthTravel: true }),

  "movement:run": () => schedule("movement:run", 6, [
    { at: 0, pose: {} },
    { at: 0.22, pose: { legSpread: 0.75, bob: 0.22, lean: 0.3, armSwing: -0.35 } },
    { at: 0.5, pose: { legSpread: 0.15, bob: 0.05, lean: 0.34 } },
    { at: 0.78, pose: { legSpread: 0.75, bob: 0.22, lean: 0.3, armSwing: 0.35 } },
    { at: 1, pose: { lean: 0.1 } }
  ], { travel: true }),

  "movement:charge": () => schedule("movement:charge", 7, [
    { at: 0, pose: {} },
    { at: 0.18, pose: { lean: -0.2, armSwing: -0.5, bob: -0.1, weaponAngle: -0.12 } },
    { at: 0.55, pose: { lean: 0.6, armSwing: 0.55, legSpread: 0.7, weaponAngle: 0.1, bob: 0.1 } },
    { at: 0.85, pose: { lean: 0.45, armSwing: 0.4, legSpread: 0.5, weaponAngle: 0.08 } },
    { at: 1, pose: { lean: 0.15 } }
  ], { travel: true }),

  "movement:jump": () => schedule("movement:jump", 7, [
    { at: 0, pose: {} },
    { at: 0.18, pose: { bob: -0.6, legSpread: 0.35, lean: 0.1 } },
    { at: 0.5, pose: { bob: 0.95, legSpread: 0.05, lean: 0.2, armSwing: -0.25 } },
    { at: 0.82, pose: { bob: -0.35, legSpread: 0.5, lean: 0.05 } },
    { at: 1, pose: {} }
  ], { travel: true }),

  taunt: () => schedule("taunt", 10, [
    { at: 0, pose: {} },
    { at: 0.3, pose: { armSwing: 0.8, bob: 0.4, lean: -0.3 } },
    { at: 0.6, pose: { armSwing: 0.5, bob: 0.15, legSpread: 0.5 } },
    { at: 1, pose: {} }
  ]),

  taunted: () => schedule("taunted", 8, [
    { at: 0, pose: {} },
    { at: 0.4, pose: { lean: -0.4, bob: -0.25 } },
    { at: 1, pose: {} }
  ]),

  hurt: () => schedule("hurt", 5, [
    { at: 0, pose: {} },
    { at: 0.3, pose: { recoil: 0.7, lean: -0.5, bob: -0.2 } },
    { at: 0.65, pose: { recoil: 0.3, lean: -0.2 } },
    { at: 1, pose: {} }
  ]),

  block: () => schedule("block", 5, [
    { at: 0, pose: {} },
    { at: 0.35, pose: { armSwing: 0.3, lean: -0.25, legSpread: 0.4, bob: -0.15 } },
    { at: 1, pose: {} }
  ]),

  knockback: () => schedule("knockback", 9, [
    { at: 0, pose: {} },
    { at: 0.25, pose: { recoil: 1, lean: -0.9, bob: 0.3 } },
    { at: 0.6, pose: { recoil: 0.8, lean: -0.6, bob: -0.4, legSpread: 0.7 } },
    { at: 1, pose: { recoil: 0.15, lean: -0.1 } }
  ]),

  unknown: () => schedule("unknown", 6, [
    { at: 0, pose: {} },
    { at: 0.5, pose: { bob: -0.2 } },
    { at: 1, pose: {} }
  ])
});

function deathSchedule(variant) {
  const beats = variant === "yield" ? 12 : 10;
  return schedule(`death:${variant}`, beats, [
    { at: 0, pose: {} },
    { at: 0.3, pose: { recoil: 0.6, lean: -0.5, bob: -0.3 } },
    { at: 0.7, pose: { lean: -0.9, bob: -0.9, legSpread: 0.8, fade: 0.2 } },
    { at: 1, pose: { lean: -1, bob: -1, legSpread: 0.9, fade: variant === "yield" ? 0.35 : 0.6 } }
  ]);
}

/**
 * @param {string} label the clip label from a `clip-goto` command
 * @param {{role?: string}} options the command's own `role` — "actor",
 *   "target" or "defeated". Passed rather than inferred because `taunt` is both
 *   an attack label and a death variant, and only the role tells them apart.
 * @returns {object} a frozen keyframe schedule; never throws on an unknown
 *   label, because the adapter legitimately emits assumed ones and the arena
 *   must still advance.
 */
export function timelineFor(label, { role = "actor" } = {}) {
  const family = familyOf(label, role);
  if (family.startsWith("death:")) {
    const variant = family.slice("death:".length);
    return Object.freeze({
      ...deathSchedule(variant === "unknown" ? "slain" : variant),
      label,
      recognised: variant !== "unknown"
    });
  }
  const build = FAMILIES[family] ?? FAMILIES.unknown;
  return Object.freeze({ ...build(), label, recognised: family !== "unknown" });
}

/**
 * Linear interpolation between the two keyframes bracketing `at`.
 *
 * Presentation arithmetic only: it interpolates poses this module authored. It
 * touches no combat value and reads nothing the resolver owns.
 */
export function poseAt(timeline, at) {
  if (!timeline || !Array.isArray(timeline.keyframes) || timeline.keyframes.length === 0) {
    throw new TimelineError("poseAt needs a timeline from timelineFor().");
  }
  const clamped = at < 0 ? 0 : at > 1 ? 1 : at;
  const frames = timeline.keyframes;
  let previous = frames[0];
  for (const frame of frames) {
    if (frame.at <= clamped) previous = frame;
    else {
      const span = frame.at - previous.at;
      const ratio = span === 0 ? 0 : (clamped - previous.at) / span;
      const blended = {};
      for (const key of Object.keys(NEUTRAL)) {
        blended[key] = previous.pose[key] + (frame.pose[key] - previous.pose[key]) * ratio;
      }
      return Object.freeze(blended);
    }
  }
  return previous.pose;
}

/**
 * Where a travelling figure is, `at` fraction of the way through its gait.
 *
 * The endpoints are the resolver's, read off the scene's `motion` record; only
 * the CURVE between them is this module's, and it is deliberately the dullest
 * one available. An ease would look better and would put the figure somewhere
 * the resolver never said it was for most of the step; linear is the only
 * interpolation that is wrong nowhere except in taste.
 *
 * Called with a motion whose `to` equals its `from` — a step the arena clamp
 * swallowed — it returns that coordinate throughout, which is the right
 * picture of walking into a wall.
 *
 * @param {{from: number, to: number}} motion the scene actor's `motion` record
 * @param {number} at 0..1, clamped
 * @returns {number} the arena x
 */
export function travelAt(motion, at) {
  if (!motion || !Number.isFinite(motion.from) || !Number.isFinite(motion.to)) {
    throw new TimelineError("travelAt needs a scene actor's `motion` record, carrying finite from and to.");
  }
  if (!Number.isFinite(at)) {
    throw new TimelineError("travelAt needs the fraction of the way through the gait.");
  }
  const clamped = at < 0 ? 0 : at > 1 ? 1 : at;
  return motion.from + (motion.to - motion.from) * clamped;
}

/**
 * How far a full `advance` steps, in arena units. Authored, and deliberately
 * smaller than the gap between two slots: a lunge is a step inside your own
 * ground, not a walk across the arena.
 *
 * ► **IT LIVED IN `tools/arena/main.js` UNTIL 2026-09-11, AND MOVING IT IS THE
 *   POINT OF `figureXAt` BELOW.** The shell is the one part of the renderer the
 *   suite cannot reach, so a constant that only the shell could see was a
 *   number no test could be wrong about.
 */
export const ADVANCE_UNITS = 74;

/**
 * Where a figure draws this frame, in arena x. The two displacements a figure
 * can have, resolved into one coordinate.
 *
 * ► **WHY THIS IS NOT IN THE SHELL, which is the same reason `cursor.js` is not
 *   in the shell.** The browser arena's first spectated bout froze after one
 *   action, and it was hard to diagnose because the logic lived in a
 *   `requestAnimationFrame` callback the suite could not reach; the decision
 *   moved into `src/render/` and the shell kept only the clock. Movement added
 *   a second such decision — lunge or travel — and it goes the same way. The
 *   shell now reads a coordinate rather than computing one.
 *
 * THE TWO DISPLACEMENTS, and they are different things:
 *
 * - **the LUNGE.** `pose.advance` is a fraction of a step toward the opponent,
 *   authored in this module. It invents no position the resolver owns, and the
 *   figure ends exactly where it started.
 * - **the STEP.** A travelling gait runs between the two endpoints its own
 *   `move-clip` named, which are the RESOLVER's.
 *
 * A travelling figure ignores `restingX` entirely. That is not belt-and-braces
 * over the gaits' `advance: 0`: `restingX` is the scene's fold, which is
 * already the DESTINATION, so adding a lunge to it would overshoot the end of
 * the very step being drawn.
 *
 * @param {object} options.restingX the scene actor's `x` — already the destination
 * @param {string} options.facing "left" or "right"; which way a lunge carries
 * @param {object} options.pose from `poseAt`
 * @param {object} [options.timeline] the running schedule, or null when idle
 * @param {object} [options.motion] the scene actor's `motion`, or null
 * @param {number} [options.at] 0..1 through the schedule
 */
/**
 * WHERE A FIGURE IS DRAWN ON THE SECOND AXIS, part-way through a lane change.
 *
 * ► **Without this a lane change is a single-frame TELEPORT, and the owner
 *   played it and said so: "the lane jump looked like a jump and there was no
 *   animation".** It was worse than unanimated — it was a whole-body vertical
 *   translation of 1.16 figure-heights with no horizontal component and no
 *   scale change, which in THIS game is the definition of a leap, because
 *   vanilla spends `_y` on the jump arc.
 *
 * The mirror of `figureXAt` and deliberately the same shape: the scene actor's
 * `y` is already the DESTINATION — the fold is not a tween — and
 * `depthMotion` carries the origin to interpolate from.
 */
export function figureYAt({ restingY, timeline = null, depthMotion = null, at = 0 }) {
  if (!Number.isFinite(restingY)) {
    throw new TimelineError("figureYAt needs the scene actor's own y; an actor with no depth has none to draw at.");
  }
  if (!Number.isFinite(at)) {
    throw new TimelineError("figureYAt needs the fraction of the way through the gait.");
  }
  if (timeline?.depthTravel && depthMotion) return travelAt(depthMotion, at);
  return restingY;
}

export function figureXAt({ restingX, facing, pose, timeline = null, motion = null, at = 0 }) {
  if (!Number.isFinite(restingX)) {
    throw new TimelineError("figureXAt needs the scene actor's own x; an unplaced actor has none to draw at.");
  }
  if (!pose || !Number.isFinite(pose.advance)) {
    throw new TimelineError("figureXAt needs a pose from poseAt().");
  }
  if (timeline?.travel && motion) return travelAt(motion, at);
  return restingX + pose.advance * ADVANCE_UNITS * (facing === "left" ? -1 : 1);
}

/**
 * The surface's own timeout policy, stated as a function so it can be tested
 * and so the reason reaching the gate is never an empty string.
 *
 * Returns null while the surface should keep waiting.
 */
export function abandonReasonFor(timeline, elapsedMs) {
  if (!Number.isFinite(elapsedMs)) {
    throw new TimelineError("abandonReasonFor needs the elapsed milliseconds.");
  }
  const overrun = elapsedMs - timeline.durationMs;
  if (overrun <= ANIMATION_TIMEOUT_MS) return null;
  return (
    `the browser arena stopped waiting for "${timeline.label}" after ${Math.round(elapsedMs)}ms ` +
    `(${timeline.durationMs}ms scheduled, ${ANIMATION_TIMEOUT_MS}ms grace). This surface gave up; ` +
    "the animation did not report."
  );
}
