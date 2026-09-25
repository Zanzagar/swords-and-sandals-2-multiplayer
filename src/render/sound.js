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
import { clipSequenceFor } from "./clip-sequences.js";
import { isStanceFamily } from "./stance.js";

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
  // ► **AND SO IS A HELD STANCE, FOR THE SAME REASON AND A SECOND ONE.** A
  //   charged gladiator rests in `psyche_charging` for as long as the charge
  //   lasts, which is the `standing` argument exactly; and the sound of psyching
  //   up has ALREADY PLAYED, on the `psyche_up` action that set the counter.
  //   Sounding the stance would replay it every time the figure came to rest.
  //
  //   Both charging clips carry no `StartSound` anyway, so this changes nothing
  //   on the shipped build — which is the point of writing it down rather than
  //   relying on it. It would change the day someone bound one.
  if (isStanceFamily(family)) return [];
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
 *
 * ► **BUT TWO FILES ON ONE LABEL ARE NOT ALTERNATIVES (2026-09-23).** They are
 *   two `StartSound` tags, and the build plays both: `stepforward` is `706`
 *   AND `1088`, `death1` is `1103` AND `1104`. Picking one by sequence number
 *   plays half of such a clip. `sound-timing.js` plays every tag at its own
 *   frame when the pack carries `cues`; this pick is the fallback for a pack
 *   that predates them, and it is kept exactly as it was.
 */
export function chooseSound(bindings, family, sequence, label = null) {
  const labels = soundLabelsFor(family);
  if (labels.length === 0) return null;

  // ► **THE ENGINE'S OWN LABEL WINS WHEN IT IS ONE OF THE FAMILY'S, and this
  //   was a live defect until 2026-09-13 — the SEVENTH instance of this
  //   project's signature failure, and the one that had been audible the
  //   longest.**
  //
  //   `animationFor` in `extracted-figure.js` has had this rule since the rig
  //   landed, with its own comment explaining exactly why: the resolver has
  //   already chosen WHICH of twelve attack clips this swing is, and taking the
  //   family's first label draws `attack1` for every attack in the game.
  //   **Sound had no such rule.** It bucketed by family and spread across every
  //   file in it by a counter — so the figure played `attack3` while the
  //   speaker played whichever of `1092`-`1095` the sequence number landed on.
  //
  //   The two halves of one join, disagreeing, with the correct rule written
  //   out in full on the other side of it. It is the same conflation the
  //   `block` and `hurt8` corrections closed, arriving a third time in the
  //   module those corrections were written for.
  //
  //   **The ranged vocabulary is what made it undeniable.** `bombard` and
  //   `snipe` share one `ranged` family and have DIFFERENT sounds — 1192.mp3
  //   and 1193.mp3 — so a snipe would have loosed a bombard, audibly, the first
  //   time anyone drew a bow. Fixed before the feature shipped rather than
  //   after the owner heard it, which is the only reason this one did not cost
  //   a session.
  //
  //   Membership is the guard, exactly as it is in `animationFor`, and for the
  //   same reason: `taunt` is both an attack label and a death variant, so a
  //   bare "is this label bound?" would play the attacking taunt for a
  //   gladiator dying of one.
  const own = typeof label === "string" ? label.toLowerCase() : null;
  if (own && labels.includes(own)) {
    const bound = bindings?.[own];
    if (Array.isArray(bound) && bound.length > 0) {
      const index = Number.isFinite(sequence) ? Math.abs(Math.trunc(sequence)) % bound.length : 0;
      return bound[index];
    }
    // ► **AN UNBOUND ENTRY IS NOT SILENT IF ITS RUN CARRIES A SOUND, and this
    //   engine said it was for three days.** The rule below is still right and
    //   is untouched: falling through to the FAMILY bucket would lend `hurt8` a
    //   noise from `hurt1`, which is the conflation `clip-labels.js` exists to
    //   stop. But a run's continuation is not a family sibling — the build
    //   PLAYS it, in the same performance, and its `StartSound` fires. Direction
    //   8 dispatches `hurt8`, which carries no binding, runs on into `hurt9` at
    //   frame 1266 and sounds `1183.mp3`. **So "the build's direction-8 hurt is
    //   silent" was false**, and this file had written it down twice.
    //
    //   Found by an adversarial Codex review of `67dfc01`, which caught it as a
    //   REGRESSION it had just introduced — adding `knockback` to its own
    //   family turned a knockback silent, because the entry has no binding and
    //   `knockback_mov` at frame 1440 has `1104.mp3`. Re-derived here: the same
    //   hole was already open on `hurt8` and nobody had heard it.
    //
    // ► **WHAT THIS DOES NOT DO IS TIME IT — `sound-timing.js` DOES, since
    //   2026-09-23, and this is its FALLBACK.** The build starts the sound 16
    //   frames into direction 8's 34-frame hurt (`hurt9` at 1266, from 1250)
    //   and ~~7~~ **12** into the 19-frame knockback (`knockback_mov` at 1440,
    //   from 1428 — the 7 counted from `knockback_mov`'s own 1434, and from 1).
    //   The offset never needed the command stream: the extractor had the
    //   frame all along and dropped it. A pack that carries `cues` is timed by
    //   the draw loop there; this one file at clip start is what an OLD pack
    //   still gets.
    for (const member of clipSequenceFor(own).slice(1)) {
      const carried = bindings?.[member];
      if (Array.isArray(carried) && carried.length > 0) {
        const index = Number.isFinite(sequence) ? Math.abs(Math.trunc(sequence)) % carried.length : 0;
        return carried[index];
      }
    }
    // Nothing in the whole run binds a sound. NOW it is silent, and that is an
    // answer: `Block` and `BlockForward` are exactly this.
    return null;
  }
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
