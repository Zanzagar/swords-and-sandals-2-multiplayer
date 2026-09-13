/**
 * WHICH OF THE BUILD'S OWN CLIP LABELS a timeline family corresponds to.
 *
 * This is the single join between this engine's vocabulary and the licensed
 * build's, and everything that reads an extracted asset goes through it:
 * `sound.js` to pick a sound, `extracted-figure.js` to pick an animation. Both
 * extractors key their output on these same names — `tools/extract-sounds.mjs`
 * binds a `StartSound` to the `FrameLabel` it fires under, and
 * `tools/extract-figure.mjs` cuts the fighter's timeline at the same labels —
 * so the join is the BUILD'S OWN and not a convention this project invented.
 *
 * ## Why this is its own module, and it is the whole lesson of 2026-09-12
 *
 * ► **The table used to live in `sound.js`, and before that it was not a table
 *   at all — it was arithmetic on the battle map's PROSE ranges.** The map
 *   summarises the fighter clip as "movement and charge (33-104)" and "Block
 *   (118/179)". Those are ranges over SEVERAL animations, so "movement" held
 *   `StepBack`, `StepForward`, `Charge` AND `Chargeattack` — a leaping attack —
 *   and "block" swallowed `Jump` and `Superjump`. The owner heard it
 *   immediately: *"I am hearing a block sound and jump sound for walking."*
 *
 *   **Nothing in the suite could catch it, because BOTH SIDES of the lookup
 *   bucketed the same coarse way and agreed with each other perfectly.** Two
 *   coarse mappings agreeing is not the same as either being right.
 *
 * So the vocabulary lives in ONE place now. A second consumer arriving is
 * exactly when a duplicated table starts to drift, and the figure is that
 * second consumer.
 *
 * ## Every name here is the build's, lower-cased, and none is inferred
 *
 * The clip carries 101 `FrameLabel` tags. A family maps to the labels it may
 * play, in the order a caller should prefer them. **A family with no entry
 * returns an empty list, and an empty list is an answer rather than a gap** —
 * the build genuinely has no clip for some of what this engine can express.
 */

export class ClipLabelError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Family -> the build's own labels.
 *
 * ► **`block` IS HERE, and it is silent.** `Block` and `BlockForward` carry no
 *   `StartSound` at all, so a block makes no noise — but the clip exists and
 *   the figure must draw it. **Those are two different facts and the old table
 *   conflated them** by omitting `block` entirely, which made "the build has no
 *   block animation" and "the build's block is silent" the same entry. Silence
 *   is a property of the BINDINGS, and `chooseSound` derives it from them.
 */
const FAMILY_LABELS = Object.freeze({
  standing: Object.freeze(["standing"]),
  rest: Object.freeze(["rest"]),
  block: Object.freeze(["block", "blockforward"]),

  // The build's own four gaits, each with its own pair of clips. The pair is
  // FORWARD FIRST, then back; `directionalLabel` picks between them.
  "movement:walk": Object.freeze(["stepforward", "stepback"]),
  "movement:run": Object.freeze(["runforward", "runback"]),
  "movement:charge": Object.freeze(["charge", "chargeattack"]),
  "movement:jump": Object.freeze(["jump", "superjump"]),
  // AUTHORED, and the only entry here that is: `sidestep` names no vanilla
  // phase, because the build has no lane to change. A lane change borrows the
  // walk, which is the nearest thing the build actually has.
  "movement:sidestep": Object.freeze(["stepforward", "stepback"]),

  attack: Object.freeze(["attack1", "attack2", "attack3", "attack4", "attack5", "attack6",
    "attack7", "attack8", "attack9", "attack10", "attack11", "attack12"]),
  hurt: Object.freeze(["hurt1", "hurt2", "hurt3", "hurt4", "hurt5", "hurt6", "hurt7",
    "hurt9", "hurt10", "hurt11", "hurt12", "hurt20"]),
  knockback: Object.freeze(["knockback_mov", "shove"]),
  taunt: Object.freeze(["taunt"]),
  taunted: Object.freeze(["taunted"]),
  ranged: Object.freeze(["bombard", "snipe"]),

  // Per-flag in the build, so per-flag here: a burning gladiator and a frozen
  // one neither sound nor look alike.
  "condition:burning": Object.freeze(["burning"]),
  "condition:frozen": Object.freeze(["frozen"]),
  "condition:poisoned": Object.freeze(["poisoned"]),
  "condition:life_stolen": Object.freeze(["lifesteal"])
});

/**
 * Death is per-variant, and the variant IS the family suffix: `familyOf`
 * returns `death:<label>` using the build's own name, so no table is needed.
 * An unknown variant falls back to the whole set, because a death with a
 * neighbouring clip beats a death with none.
 */
const DEATH_LABELS = Object.freeze([
  "death1", "death2", "death3", "death4", "death5", "death6", "death7",
  "death21", "death22", "death23", "deathspike", "deathtaunt", "death_poisoned"
]);

/**
 * This engine's death VARIANTS are not the build's death CLIPS, and exactly one
 * of the five can be matched to one.
 *
 * `timeline.js` emits `death:slain`, `death:yield`, `death:taunt`,
 * `death:arrow` and `death:grievous`. The build's clips are `death1`-`death7`,
 * `death21`-`death23`, `deathspike`, `deathtaunt` and `death_poisoned`. Only
 * `taunt` has a counterpart, and it is DERIVED rather than guessed from the
 * name: **`deathtaunt` sits at frames 1083-1116, inside the contiguous death
 * block that runs 585-1116, while the attacking `taunt` is away at 1482-1511.**
 * The build files it with the deaths, so that is what it is.
 *
 * ► **THE OTHER FOUR ARE DELIBERATELY UNMAPPED.** `slain`, `yield`, `arrow` and
 *   `grievous` name no clip and nothing in the build says which they would be —
 *   `deathspike` is not an arrow, and inventing the rest is precisely the move
 *   this project forbids. They fall back to the whole death set, which is a
 *   death animation for a death, and the loss is that it is always the same
 *   one. **A capture that recorded which clip the build plays for each would
 *   settle it; none has.**
 */
const DEATH_VARIANT_CLIPS = Object.freeze({ taunt: "deathtaunt" });

/** The build's own clip labels this family may play, or an empty list. */
export function clipLabelsFor(family) {
  if (typeof family !== "string" || family.length === 0) return [];
  if (family === "unknown") return [];
  if (family.startsWith("death:")) {
    const variant = family.slice("death:".length).toLowerCase();
    if (DEATH_LABELS.includes(variant)) return [variant];
    const mapped = DEATH_VARIANT_CLIPS[variant];
    // The mapped clip FIRST, then the rest, so a pack missing it still dies.
    if (mapped) return [mapped, ...DEATH_LABELS.filter((name) => name !== mapped)];
    return DEATH_LABELS;
  }
  return FAMILY_LABELS[family] ?? [];
}

/** Every label this module can name, for a consumer that wants to check coverage. */
export function allClipLabels() {
  const names = new Set(DEATH_LABELS);
  for (const labels of Object.values(FAMILY_LABELS)) for (const label of labels) names.add(label);
  return [...names].sort();
}

/**
 * The one label a DIRECTIONAL family should play, given where the figure is
 * going and which way it is facing.
 *
 * ► **The build has no `walkleft`/`walkright` CLIPS — it has `StepForward` and
 *   `StepBack`, and which one plays depends on facing.** This engine's labels
 *   are absolute (`walkleft`) while the build's are relative to the gladiator,
 *   so a renderer that took the first label of the pair would walk a retreating
 *   gladiator forwards. Vanilla has one gladiator a side and always closes, so
 *   this distinction never arose until a team could retreat.
 *
 * Non-directional families are unaffected and return their first label.
 */
export function directionalLabel(family, label, facing) {
  const labels = clipLabelsFor(family);
  if (labels.length === 0) return null;
  if (!family.startsWith("movement:") || labels.length < 2) return labels[0];
  const goingLeft = typeof label === "string" && label.endsWith("left");
  const goingRight = typeof label === "string" && label.endsWith("right");
  if (!goingLeft && !goingRight) return labels[0];
  const facingLeft = facing === "left";
  // Travelling the way you face is FORWARD; the other way is BACK, and the
  // build animates a backward step as its own clip rather than a mirrored one.
  const forward = goingLeft === facingLeft;
  return forward ? labels[0] : labels[1];
}
