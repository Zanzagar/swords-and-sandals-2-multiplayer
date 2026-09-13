/**
 * WHICH sound a running animation should play. Not the playing of it.
 *
 * The division is the one this directory already draws: deciding is testable
 * and lives here, while `new Audio()` and a volume slider are the shell's and
 * live in `tools/arena/`. A number only the shell can see is a number the
 * suite cannot reach.
 *
 * ## Where the bindings come from, and why they are not in this file
 *
 * `tools/extract-sounds.mjs` derives them from the build's own `StartSound`
 * placement: export 1241 is the fighter clip, its `FrameLabel` tags name 101
 * animations, and a sound belongs to the label it fires UNDER. The result is
 * written into `assets/sound/manifest.json`
 * beside the extracted audio, **not committed**, because the sound ids are
 * specific to the build they were read out of — and because a clone must still
 * need its own licensed copy.
 *
 * So this module takes a bindings table as an ARGUMENT and has no table of its
 * own. With no assets extracted there are no bindings, every lookup returns
 * null, and the arena is silent. That is the fallback, and it is the same shape
 * as `figure.js` drawing authored vector art when no sprite has been extracted.
 */

export class SoundError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * WHICH OF THE BUILD'S OWN CLIP LABELS a timeline family may play a sound from.
 *
 * ► **THE FIRST VERSION SPLIT THE FAMILY ON `:` AND USED THE PREFIX AS A
 *   BUCKET, AND THE OWNER HEARD IT: "I am hearing a block sound and jump sound
 *   for walking."**
 *
 *   It worked only because the extractor was ALSO bucketing coarsely, by the
 *   battle map's prose ranges — so `movement` meant "frames 33-104", which is
 *   `StepBack`, `StepForward`, `Charge` AND `Chargeattack`, four different
 *   clips; and `block` meant "118-179", which swallowed `Jump` and
 *   `Superjump`. **Two coarse mappings agreeing with each other is not the same
 *   as either being right**, and nothing in the suite could tell: both sides
 *   were self-consistent and only an ear caught it.
 *
 * The extractor now binds by the clip's own `FrameLabel` tags — 80 of them
 * against the prose's 17 ranges — so this maps a family to the EXACT labels it
 * may sound as. The names are the build's, lower-cased, and none is inferred
 * from a pattern.
 *
 * **A family with no entry is silent, and that is usually correct rather than
 * missing.** `Block` and `BlockForward` carry no `StartSound` at all — a block
 * in this build makes no noise — which the prose bucket hid by lending it a
 * jump.
 */
const FAMILY_LABELS = Object.freeze({
  // The build's own four gaits, each with its own pair of clips.
  "movement:walk": ["stepforward", "stepback"],
  "movement:run": ["runforward", "runback"],
  "movement:charge": ["charge", "chargeattack"],
  "movement:jump": ["jump", "superjump"],

  attack: ["attack1", "attack2", "attack3", "attack4", "attack5", "attack6",
    "attack7", "attack8", "attack9", "attack10", "attack11", "attack12"],
  hurt: ["hurt1", "hurt2", "hurt3", "hurt4", "hurt5", "hurt6", "hurt7",
    "hurt9", "hurt10", "hurt11", "hurt12", "hurt20"],
  rest: ["rest"],
  knockback: ["knockback_mov", "shove"],
  taunt: ["taunt"],
  ranged: ["bombard", "snipe"],

  // Per-flag in the build, so per-flag here: a burning gladiator and a frozen
  // one do not share a sound.
  "condition:burning": ["burning"],
  "condition:frozen": ["frozen"],
  "condition:poisoned": ["poisoned"],
  "condition:life_stolen": ["lifesteal"]
});

/**
 * Death is per-variant, and the variant IS the family suffix: `familyOf`
 * returns `death:<label>` using the build's own name, so no table is needed.
 * An unknown variant falls back to the whole set, because a death with a
 * neighbouring sound beats a death with none.
 */
const DEATH_LABELS = Object.freeze([
  "death1", "death2", "death3", "death4", "death5", "death6", "death7",
  "death21", "death22", "death23", "deathspike", "deathtaunt", "death_poisoned"
]);

/** The build's own clip labels this family may sound as, or an empty list. */
export function soundLabelsFor(family) {
  if (typeof family !== "string" || family.length === 0) return [];
  // A looping idle is deliberately silent: a sound on a loop never stops.
  if (family === "standing" || family === "unknown") return [];
  if (family.startsWith("death:")) {
    const variant = family.slice("death:".length).toLowerCase();
    return DEATH_LABELS.includes(variant) ? [variant] : DEATH_LABELS;
  }
  return FAMILY_LABELS[family] ?? [];
}

/** The first label a family may sound as, or null. Kept for callers wanting one name. */
export function soundBucketFor(family) {
  const labels = soundLabelsFor(family);
  return labels.length > 0 ? labels[0] : null;
}

/**
 * One file from the bucket, chosen DETERMINISTICALLY.
 *
 * ► **Deterministic because this project's whole shape is "the same seed and
 *   the same choices replay exactly".** A `Math.random()` here would make two
 *   replays of one bout sound different, which is a small lie in the same
 *   family as a renderer that draws a separation the model does not have. The
 *   sequence number is the presentation stream's own counter, so the same
 *   action in the same bout picks the same sound every time.
 *
 * The build fires several sounds per animation — 7 distinct in `attack`, 10 in
 * `hurt`, 15 in `death` on the shipped build — and this spreads across them
 * rather than always taking the first, so a bout does not become one noise.
 */
export function chooseSound(bindings, family, sequence) {
  const labels = soundLabelsFor(family);
  if (labels.length === 0) return null;
  // Every file the build could play for this animation, in label order, so the
  // pick is stable across runs and across re-extractions.
  const files = [];
  for (const label of labels) {
    const bound = bindings?.[label];
    if (!Array.isArray(bound)) continue;
    for (const file of bound) if (!files.includes(file)) files.push(file);
  }
  if (files.length === 0) return null;
  const index = Number.isFinite(sequence) ? Math.abs(Math.trunc(sequence)) % files.length : 0;
  return files[index];
}

/**
 * The bindings table out of a manifest, or an empty one.
 *
 * Total rather than throwing: a missing, truncated or hand-edited manifest
 * must leave the arena silent and playable, never broken. The arena is the
 * thing a person looks at, and a stack trace where a footstep should be is a
 * worse outcome than quiet.
 */
export function bindingsFrom(manifest) {
  const bindings = manifest?.bindings;
  if (!bindings || typeof bindings !== "object") return Object.freeze({});
  const clean = {};
  for (const [bucket, files] of Object.entries(bindings)) {
    if (!Array.isArray(files)) continue;
    const usable = files.filter((file) => typeof file === "string" && file.length > 0);
    if (usable.length > 0) clean[bucket] = Object.freeze([...usable]);
  }
  return Object.freeze(clean);
}
