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
   */
  advance: 0
});

function pose(overrides) {
  return Object.freeze({ ...NEUTRAL, ...overrides });
}

function schedule(family, beats, keyframes, { loop = false } = {}) {
  return Object.freeze({
    family,
    durationMs: beats * BEAT_MS,
    loop,
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
