/**
 * EVERY TIMELINE FAMILY MUST OWN A CLIP VOCABULARY.
 *
 * WHY THIS FILE EXISTS. On 2026-09-16 `familyOf` split `psyche_up3` out of the
 * `psyche` family into `psyche:discharge`, because that clip is thirteen frames
 * against the other two's nine and is the one that swings. The split landed;
 * `FAMILY_LABELS` in `clip-labels.js` was never told.
 *
 * So for two days the third psych-up press — the ONLY press that does anything —
 * asked for a family with an empty vocabulary. `animationFor` found no clip,
 * `chooseSound` found no binding, and a fully dressed gladiator reverted to
 * authored stick-figure art with no face and no sound at the exact moment of his
 * biggest blow. **And `timelineFor` reported `recognised: true` the whole time**,
 * because "recognised" means `familyOf` named a family, not that anything can
 * draw it — so no log line and no test fired. Found by an audit, 2026-09-18.
 *
 * `src/render/stance.js` already had exactly this guard for its own two families
 * (`stanceFamiliesCover`), with a comment saying a family that does not list its
 * own label "silently falls back to authored art on a machine that has the pack —
 * a wrong picture with no error". This is that check, made symmetric.
 *
 * It asserts over the labels the ENGINE can actually dispatch, driven through
 * `timelineFor`, rather than over a hand-written list of families — a list would
 * have to be kept in step with `familyOf` and is the same kind of second copy
 * that caused the defect.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { clipLabelsFor, allClipLabels } from "../src/render/clip-labels.js";
import { timelineFor } from "../src/render/timeline.js";
import { VANILLA_PHASE_LABEL } from "../src/team/ss2-rules.js";

/** Every label this engine can hand `timelineFor`, from the two places it comes from. */
function dispatchableLabels() {
  const labels = new Set(Object.values(VANILLA_PHASE_LABEL));
  for (const label of allClipLabels()) labels.add(label);
  return [...labels].sort();
}

test("EVERY FAMILY A DISPATCHABLE LABEL RESOLVES TO CAN NAME AT LEAST ONE CLIP", () => {
  const labels = dispatchableLabels();
  assert.ok(labels.length > 40, `the sweep must see a real vocabulary; saw ${labels.length}`);

  const empty = [];
  for (const label of labels) {
    for (const role of ["actor", "target"]) {
      const timeline = timelineFor(label, { role });
      if (!timeline.recognised) continue;
      if (clipLabelsFor(timeline.family).length === 0) {
        empty.push(`${label} (${role}) -> ${timeline.family}`);
      }
    }
  }
  assert.deepEqual(
    empty, [],
    "a RECOGNISED family with no clip vocabulary draws authored stick-figure art on a machine " +
    "that has the extracted pack, makes no sound, and logs nothing — because `recognised` means " +
    "`familyOf` named it, not that anything can draw it. Add the family to `FAMILY_LABELS`."
  );
});

test("THE DISCHARGE IS THE CASE THIS WAS WRITTEN FOR, named so a regression is legible", () => {
  // Deliberately specific as well as swept. The sweep above would go quiet if
  // `familyOf` ever stopped splitting the discharge out; this one says which
  // clip the split is about and fails loudly if it loses its art again.
  const timeline = timelineFor("psyche_up3", { role: "actor" });
  assert.equal(timeline.family, "psyche:discharge", "the discharge has its own family, by length");
  assert.deepEqual([...clipLabelsFor(timeline.family)], ["psyche_up3"],
    "and that family names the one clip it is for");
});
