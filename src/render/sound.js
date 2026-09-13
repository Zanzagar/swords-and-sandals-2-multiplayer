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

import { clipLabelsFor } from "./clip-labels.js";

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
 * ► **THE TABLE ITSELF NOW LIVES IN `clip-labels.js`, because the FIGURE needs
 *   the same join.** `tools/extract-figure.mjs` cuts the fighter's timeline at
 *   the same `FrameLabel` tags the sound extractor binds to, so sound and art
 *   answer to ONE vocabulary — and a second consumer arriving is exactly when a
 *   duplicated table starts to drift. What stays here is the SOUND POLICY.
 *
 * ► **AND `block` MOVED FROM "no entry" TO "an entry with no bindings", which
 *   is the same silence for a better reason.** `Block` and `BlockForward` carry
 *   no `StartSound` at all, so a block makes no noise — but the clips EXIST and
 *   the figure draws them. Omitting `block` from the table made "the build has
 *   no block animation" and "the build's block is silent" into ONE entry, which
 *   is the same conflation the prose buckets made. Silence is now DERIVED from
 *   the bindings, so it would stop being silent the day the build binds a sound.
 */

/** The build's own clip labels this family may sound as, or an empty list. */
export function soundLabelsFor(family) {
  // A looping idle is deliberately silent: a sound on a loop never stops. That
  // is a policy about SOUND and so it lives here, not in the shared vocabulary.
  if (family === "standing") return [];
  return clipLabelsFor(family);
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
