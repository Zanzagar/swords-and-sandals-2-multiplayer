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
 * placement: export 1241 is the fighter clip, the battle map catalogues its
 * labelled frame ranges, and a sound firing on frame N belongs to whichever
 * animation contains N. The result is written into `assets/sound/manifest.json`
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
 * The animation bucket a timeline family belongs to.
 *
 * `timelineFor(label).family` is already the label's decoded meaning —
 * `movement:walk`, `attack`, `death:death3`, `condition:burning` — and the
 * extractor's buckets are the battle map's own label ranges. The two meet at
 * the prefix, so this is a split rather than a second table to keep in step.
 *
 * Returns null for a family with no bucket, which is not a defect: `standing`
 * is a loop nobody should hear and `knockback` has no `StartSound` on the
 * fighter clip at all.
 */
export function soundBucketFor(family) {
  if (typeof family !== "string" || family.length === 0) return null;
  const prefix = family.split(":")[0];
  // `standing` is deliberately excluded: it loops forever, and a sound on a
  // loop is a sound that never stops.
  if (prefix === "standing" || prefix === "unknown") return null;
  return prefix;
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
  const bucket = soundBucketFor(family);
  if (!bucket) return null;
  const files = bindings?.[bucket];
  if (!Array.isArray(files) || files.length === 0) return null;
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
