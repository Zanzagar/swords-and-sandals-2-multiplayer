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

import { allClipLabels, allUnmappedLabels, clipLabelsFor, UNMAPPED_CLIP_LABELS } from "../src/render/clip-labels.js";
import { timelineFor } from "../src/render/timeline.js";
import * as ss2Rules from "../src/team/ss2-rules.js";
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

/**
 * Every clip label a built verb's descriptor carries onto its event, found by
 * walking the rule set's own exports rather than by a list written here.
 *
 * `VANILLA_PHASE_LABEL` above is the PHASE vocabulary; the spells name their
 * clips somewhere else — `casterClip`, `victimClip`, `damageMethod` (the
 * victim's clip, `magic_damage_character`'s `defenderClip.gotoAndPlay`), the
 * whirlwind's `victimClipOnHit`/`OnMiss`, the psych-up's `clips` — and the
 * presentation binds those strings straight through. A walk of the exports
 * reaches the next verb's descriptor without anybody adding it here.
 */
function descriptorClipLabels() {
  const found = new Map();
  const seen = new Set();
  const record = (label, where) => {
    if (typeof label !== "string" || label.length === 0) return;
    if (!found.has(label)) found.set(label, where);
  };
  const walk = (value, where) => {
    if (value === null || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      if (/clip/i.test(key) || key === "damageMethod") {
        for (const label of Array.isArray(child) ? child : [child]) record(label, `${where}.${key}`);
      }
      walk(child, `${where}.${key}`);
    }
  };
  for (const [name, value] of Object.entries(ss2Rules)) walk(value, name);
  return found;
}

test("EVERY CLIP A BUILT VERB CARRIES ON ITS EVENT RESOLVES TO A FAMILY THAT CAN DRAW IT", () => {
  // ► **WHY: THREE VERBS SHIPPED ON 2026-09-22 DRAWING THE `unknown` SCHEDULE.**
  //   `cast_colossus` carries `Colossus`, `cast_rejuvinate` `Rejuvinate` and
  //   `cast_little_fat_kid` `little_fat_kid` for its victim, all bound
  //   MAP_NAMED by `SS2_STATIC_MAP_BINDINGS` — and `familyOf` knew none of
  //   them, so the caster bobbed through six authored beats and the extracted
  //   rig drew nothing. The bolts had done the same for two days on 2026-09-20.
  //   The sweep above could not see it: it walks the PHASE labels, and a spell's
  //   clip is not its phase label.
  const labels = descriptorClipLabels();
  assert.ok(labels.size >= 10, `the walk must reach the spell descriptors; found ${labels.size}`);
  const failing = [];
  for (const [label, where] of labels) {
    const timeline = timelineFor(label, { role: "actor" });
    const drawable = clipLabelsFor(timeline.family).includes(label.toLowerCase());
    if (!timeline.recognised || !drawable) failing.push(`${label} (${where}) -> ${timeline.family}`);
  }
  assert.deepEqual(failing, [],
    "a clip the resolver names must have a family whose vocabulary holds it, or the figure plays the " +
    "`unknown` schedule on a machine with no pack and draws nothing from the rig on one that has it");
});

test("THE SIX `wincrowd` CLIPS RESOLVE TO FAMILIES THAT CAN DRAW THEM, each for the build's own length", () => {
  // ► **WHY A DIRECT TEST AS WELL AS THE WALK ABOVE.** `cast_adulation` plays
  //   `wincrowd1` (`+0x7732`) and the `wincrowd` phase plays
  //   `"wincrowd" + attacker.wincrowd_move`, any of the six
  //   (`+0x50de`-`+0x5107`). The walk only sees a clip once a descriptor
  //   exports it, and the phase assembles its label from a number, so no
  //   descriptor will ever carry five of the six by name.
  //
  // Each clip is played to its own end: frames per the fighter clip, each span
  // closed by `this.struck = true; Stop` on its own last frame. 30 fps, rounded
  // to the 120 ms beat — the rule `Cast2`'s 21 -> 6 and `drink_potion`'s 24 -> 7
  // follow — which gives four schedules for six clips:
  //   wincrowd1  1657-1686  30 frames  1000 ms  8.33 -> 8  = 960
  //   wincrowd2  1687-1721  35         1167     9.72 -> 10 = 1200
  //   wincrowd3  1722-1750  29          967     8.06 -> 8  = 960
  //   wincrowd4  1751-1808  58         1933    16.11 -> 16 = 1920
  //   wincrowd5  1809-1858  50         1667    13.89 -> 14 = 1680
  //   wincrowd6  1859-1886  28          933     7.78 -> 8  = 960
  const expected = {
    wincrowd1: 960, wincrowd2: 1200, wincrowd3: 960, wincrowd4: 1920, wincrowd5: 1680, wincrowd6: 960
  };
  for (const [label, durationMs] of Object.entries(expected)) {
    const timeline = timelineFor(label, { role: "actor" });
    assert.equal(timeline.recognised, true, `${label} must not fall to the \`unknown\` schedule`);
    assert.ok(clipLabelsFor(timeline.family).includes(label), `${label}'s family ${timeline.family} must draw it`);
    assert.equal(timeline.durationMs, durationMs, `${label} plays for its own length`);
  }
  // One family per SCHEDULE: the three that round alike share one, as `Cast1`
  // and `Cast2` do; the three that do not each have their own, as the
  // discharge does against the charge.
  const familyOf = (label) => timelineFor(label, { role: "actor" }).family;
  assert.equal(familyOf("wincrowd3"), familyOf("wincrowd1"));
  assert.equal(familyOf("wincrowd6"), familyOf("wincrowd1"));
  assert.equal(new Set(Object.keys(expected).map(familyOf)).size, 4);

  const unplayed = new Set(allUnmappedLabels());
  for (const label of Object.keys(expected)) assert.equal(unplayed.has(label), false, `${label} is played now`);
  assert.deepEqual([...UNMAPPED_CLIP_LABELS.unbuiltOutcome], ["yield1", "yield2"],
    "the two yields are the bout's outcome and stay unbuilt");
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
