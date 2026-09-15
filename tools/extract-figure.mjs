/**
 * Extract the FIGHTER'S ANIMATION from YOUR OWN Swords & Sandals II install.
 *
 * Stage 2 of asset extraction. `tools/swf-shapes.mjs` says what a shape looks
 * like and `tools/swf-display-list.mjs` says where it is on a given frame; this
 * is the tool that puts the two together, reads a licensed build and writes
 * files — which is why the guards live here and not in either parser.
 *
 * ## Why this is allowed, and it is the same paragraph `extract-sounds.mjs` has
 *
 * `AGENTS.md`:
 *
 * > **Ship no SS2 asset.** The project is intended to be shared, so the repo is
 * > a distribution channel: someone who clones it must still need their own
 * > licensed copy to play. Same model as a Doom source port shipping no WAD.
 * > **This is about what leaves the repo, never about what you may build in it.**
 *
 * So this writes into `assets/`, which is gitignored, and
 * `test/asset-attestation.test.js` FAILS if anything it writes is ever tracked.
 * Two lines of defence, because the ignore rule alone has already failed once
 * on this repository.
 *
 * **READ-ONLY on the SWF.** The installed build is the measurement oracle: 23
 * promoted goldens, 69 observation records and every capture manifest cite its
 * sha256. This opens it for reading and never writes to it, and the manifest
 * records the hash it read so extracted art is always traceable to the build it
 * came out of.
 *
 * ## What comes out, and why it is not 2,222 SVG files
 *
 * The fighter is a RIG: eleven shapes, and 2,222 frames of matrices moving
 * thirteen named limbs. The shapes are the small part — 25 KB — and the
 * matrices are the animation. So the output separates them:
 *
 * ```text
 *   assets/figure/manifest.json    the build's sha256, the clip, the counts
 *   assets/figure/shapes.json      each shape ONCE: bounds and path data
 *   assets/figure/animations.json  each label's frames, as limb placements
 *   assets/figure/preview.html     the rig, animating, in a browser
 * ```
 *
 * ► **`preview.html` is not a nicety and it is the reason this tool writes
 *   HTML at all.** Every defect this project has found in presentation was
 *   found by LOOKING at the thing or LISTENING to it — the pile-up AI, the
 *   blows through a body, the walk that sounded like a leaping attack. A
 *   suite cannot tell a correct rig from a plausible one, and neither can a
 *   JSON file. The preview is how a person checks this extraction.
 *
 * Usage:
 *   node tools/extract-figure.mjs                       # the default install
 *   node tools/extract-figure.mjs "<path to .swf>"
 *   node tools/extract-figure.mjs --out assets/figure
 *   node tools/extract-figure.mjs --clip 1241
 *   node tools/extract-figure.mjs --sound assets/sound
 *   node tools/extract-figure.mjs --report              # measure, write nothing
 *
 * Node builtins only.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { parseShape, shapeToPaths } from "./swf-shapes.mjs";
import { parseMorphShape, morphShapeAt, morphToPaths, ratioOf } from "./swf-morph-shapes.mjs";
import {
  indexCharacters,
  resolveTimeline,
  flattenFrame,
  deriveAnimations,
  IDENTITY_COLOUR_TRANSFORM
} from "./swf-display-list.mjs";

/**
 * ► **THE COLOUR TRANSFORM IS NOT THIS FILE'S TO IMPLEMENT, AND IT USED TO BE.**
 *   `src/render/filters.js` owns the one implementation — it FLOORS, because
 *   `readColourTransform` reads the multiply term as signed 8.8 fixed point and
 *   the player computes `(channel * multTerm) >> 8`, an arithmetic shift. The
 *   copy that used to sit in `previewHtml` ROUNDED, which is a plus-or-minus-one
 *   error on every channel it touched, in the one artefact whose entire job is
 *   to be COMPARED BY EYE against the running game. Measured before removing
 *   it, on the pack this tool writes: **11,018 of 47,025 channel computations
 *   across the 4,544 tinted placements came out one unit apart** — 1,765 of the
 *   3,290 distinct (fill, transform) pairs. See `previewTints`.
 */
import {
  applyColourTransform,
  applyColourTransformAlpha,
  blendModeFor,
  canvasFilterFor,
  summariseFilterUse
} from "../src/render/filters.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * The same default every other tool that reads the build uses. Named here
 * rather than imported so this file stays runnable on its own.
 */
const DEFAULT_SWF =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";

/** `hero_battle` in the build's own linkage table. */
const DEFAULT_CLIP = 1241;

/**
 * The oracle's sha256. Recorded, compared and REPORTED — never enforced.
 *
 * A different build is a legitimate thing to run this against; what is not
 * legitimate is quietly treating its output as evidence about the oracle. So a
 * mismatch prints loudly and the manifest carries the hash that was actually
 * read.
 */
const ORACLE_SHA256 = "77cb545c2061ab41246251467a4edf5926ab6fd1ddd95dc9527d7ba9c45bb8ca";

const TWIPS_PER_PIXEL = 20;

export class ExtractFigureError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

export function parseArguments(argv) {
  const options = {
    file: null,
    out: path.join(REPO_ROOT, "assets", "figure"),
    sound: path.join(REPO_ROOT, "assets", "sound"),
    clip: DEFAULT_CLIP,
    report: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") {
      const next = argv[index + 1];
      if (typeof next !== "string" || next.startsWith("--")) {
        throw new ExtractFigureError("--out needs a directory path.");
      }
      options.out = path.resolve(next);
      index += 1;
    } else if (value === "--sound") {
      const next = argv[index + 1];
      if (typeof next !== "string" || next.startsWith("--")) {
        throw new ExtractFigureError("--sound needs the directory `extract-sounds.mjs` wrote to.");
      }
      options.sound = path.resolve(next);
      index += 1;
    } else if (value === "--clip") {
      const next = argv[index + 1];
      const parsed = Number.parseInt(next, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new ExtractFigureError("--clip needs a positive character id.");
      }
      options.clip = parsed;
      index += 1;
    } else if (value === "--report") {
      options.report = true;
    } else if (value.startsWith("--")) {
      // An unknown flag THROWS rather than being ignored — the rule
      // `tools/engagement-census.mjs` learned the hard way, where a silently
      // ignored flag ran a different job and reported it as the one you asked
      // for.
      throw new ExtractFigureError(
        `Unknown flag ${JSON.stringify(value)}. Known: --out, --sound, --clip, --report.`
      );
    } else if (options.file === null) {
      options.file = value;
    } else {
      throw new ExtractFigureError(`Unexpected argument ${JSON.stringify(value)}.`);
    }
  }
  return options;
}

/** Twips in, pixels out, at the precision the path data already uses. */
const px = (twips) => Math.round((twips / TWIPS_PER_PIXEL) * 100) / 100;

/** A matrix rounded for JSON. Scale terms keep more digits than translations. */
function roundMatrix(matrix) {
  const r = (value, places) => {
    const factor = 10 ** places;
    const rounded = Math.round(value * factor) / factor;
    return Object.is(rounded, -0) ? 0 : rounded;
  };
  return [r(matrix.a, 5), r(matrix.b, 5), r(matrix.c, 5), r(matrix.d, 5), r(matrix.tx, 1), r(matrix.ty, 1)];
}

function isIdentityColour(transform) {
  for (const key of Object.keys(IDENTITY_COLOUR_TRANSFORM)) {
    if (transform[key] !== IDENTITY_COLOUR_TRANSFORM[key]) return false;
  }
  return true;
}

/** A colour transform as the eight numbers a renderer needs, or null if identity. */
function packColour(transform) {
  if (isIdentityColour(transform)) return null;
  const r = (value) => Math.round(value * 1000) / 1000;
  return [
    r(transform.redMultiplier), r(transform.greenMultiplier),
    r(transform.blueMultiplier), r(transform.alphaMultiplier),
    Math.round(transform.redOffset), Math.round(transform.greenOffset),
    Math.round(transform.blueOffset), Math.round(transform.alphaOffset)
  ];
}

/** A filesystem- and URL-safe key for a clip label. The build's names are mixed case. */
export function labelKey(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9_]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * The rig's own limb name for a drawable, from the depth it hangs off.
 *
 * The fighter's TOP-LEVEL depths carry `PlaceObject2` names — `torso`, `head`,
 * `weapon` — and everything under them is anonymous scaffolding. So the name
 * belongs to `path[0]`, and a drawable three levels down still reports the limb
 * it is part of. That is what lets a renderer say "the shield is missing"
 * rather than "character 704 resolved to nothing".
 */
export function buildDepthNames(displayList) {
  const names = new Map();
  for (const entry of displayList) {
    if (entry.name) names.set(entry.depth, entry.name);
  }
  return names;
}

/**
 * One path list's own invoice: how many of its paths are drawn as something
 * simpler than the build draws them, and of which kinds.
 *
 * Derived from the paths every time rather than accumulated alongside them, so
 * a caller cannot build the list and forget the count — which is the whole
 * failure this project keeps paying for.
 */
export function pathApproximations(paths) {
  const approximatedByKind = {};
  for (const entry of paths ?? []) {
    if (entry.approximated) {
      approximatedByKind[entry.approximated] = (approximatedByKind[entry.approximated] ?? 0) + 1;
    }
  }
  return {
    approximated: Object.values(approximatedByKind).reduce((sum, count) => sum + count, 0),
    approximatedByKind
  };
}

/**
 * THE MANIFEST'S TALLY, READ OFF THE PATHS THEMSELVES.
 *
 * ► **THIS USED TO SUM EACH SHAPE'S OWN `approximatedByKind` FIELD, AND THE 290
 *   BAKED MORPH ENTRIES DO NOT HAVE ONE.** `morphKeyFor` writes `{bounds,
 *   morph, ratio, paths}` and nothing else, so `?? {}` contributed nothing and
 *   an approximated morph path landed in `shapes.json` while the manifest a
 *   human reads counted it zero — which is bit for bit the defect this file was
 *   repaired for once already, one shape-kind over. Reproduced before fixing: a
 *   pack of morphs alone reported `total: 0` against data holding two.
 *
 *   **The effect is DEAD against this oracle and the code was still wrong.**
 *   Re-measured on the installed build: 44 morph shapes, 97 fills, every one of
 *   them SOLID — zero gradients, zero bitmaps — so `morphToPaths` cannot
 *   currently mark anything approximated and the tally reads 8 against data
 *   holding 8. A modded build in the second install lane, or any morph with a
 *   gradient in it, makes the undercount real and silent.
 *
 * Summing the per-shape fields was also structurally weaker than reading the
 * paths: it trusted a number written beside the data instead of the data. This
 * is now the same arithmetic `test/extraction-honesty.test.js` performs, which
 * is what makes that file's check a check rather than a coincidence.
 */
export function approximationTally(shapes) {
  const byKind = {};
  let paths = 0;
  for (const shape of Object.values(shapes ?? {})) {
    for (const entry of shape.paths ?? []) {
      paths += 1;
      if (entry.approximated) byKind[entry.approximated] = (byKind[entry.approximated] ?? 0) + 1;
    }
  }
  return { paths, total: Object.values(byKind).reduce((sum, count) => sum + count, 0), byKind };
}

/**
 * COUNT SOMETHING THIS EXTRACTION COULD NOT CARRY, BY NAME.
 *
 * Every effect-related drop in this file goes through here, so `notCarried` in
 * `manifest.json` is the complete list of what this pack knows about and does
 * not say. `tools/extract-props.mjs` has the same function and the same note,
 * and its note records what happened when the claim stopped being true: two
 * skips went round it and the pack-wide `0 own filters` turned out to be a
 * measurement of the skip list rather than of the build.
 *
 * ► **THAT IS NOT A HYPOTHETICAL HERE.** Before this change,
 *   `tools/extract-figure.mjs` matched ZERO of `hasFilters|ancestorEffects|
 *   \.filters|blendMode` — so the figure pack did not drop effects loudly, it
 *   dropped them SILENTLY, and `--report` had no line where a loss could even
 *   be printed. The 30 placements in `hero_battle` that sit under a glowing
 *   group were dropped 30 times a run with nothing said.
 */
function refuse(notCarried, kind, howMany = 1) {
  notCarried[kind] = (notCarried[kind] ?? 0) + howMany;
}

/**
 * ONE PLACEMENT'S OWN EFFECTS — its own, and on no account its ancestors'.
 *
 * ► **MEASURED ON THE ORACLE, AND IT IS THE REASON THIS IS SEPARATE FROM
 *   `effectGroupsFor` BELOW: ZERO of clip 1241's 37,077 placements carries a
 *   filter or a blend mode of its own.** Every effect this rig has lives on an
 *   ENCLOSING SPRITE. So a fix that spread `drawable.filters` onto the
 *   placement and stopped there would write nothing 37,077 times and report
 *   success, and the arena would still have no filter data for the fighter.
 *
 * ► **AND THE ZERO IS A REAL DENOMINATOR, NOT A SKIP LIST.** In the props
 *   extractor the equivalent zero was an artefact: its sweep ran below an
 *   `unsupported` skip, and the build's only two own-filtered placements were
 *   exactly two of the drawables that skip removed. Re-measured here for the
 *   same trap: clip 1241 flattens to 37,077 drawables, of which **290 are
 *   morphs (all baked, none skipped) and 0 are unsupported by any other kind**
 *   — so nothing at all is removed above this function and 37,077 really is
 *   the population. `refusedEffectsOf` invoices the skip anyway, because a
 *   modded build in a second install lane is where that stops being true.
 *
 * `hasFilters` with an EMPTY list is a real distinction and is refused by name
 * rather than written as `filters: []`: a `PlaceObject3` may carry a filter
 * list of count zero, which means "this instance has had its filters cleared",
 * not "nobody asked". Zero of this clip's placements does that either.
 */
function ownEffectsOf(drawable, notCarried) {
  const effects = {};
  const filters = Array.isArray(drawable.filters) && drawable.filters.length > 0 ? drawable.filters : null;
  if (filters) {
    effects.filters = filters;
    // Carried, and flagged: `parseFilterList` marks the filter kinds that occur
    // ZERO times in the shipped build, so a record with this flag reached a
    // code path no capture has ever exercised.
    for (const filter of filters) if (filter.measured === false) refuse(notCarried, "unmeasuredFilterRecord");
  } else if (drawable.hasFilters) {
    refuse(notCarried, "emptyFilterList");
  }
  if (drawable.blendMode !== undefined && drawable.blendMode !== null) effects.blendMode = drawable.blendMode;
  return effects;
}

/**
 * THE OWN EFFECTS ON A DRAWABLE THIS TOOL IS ABOUT TO THROW AWAY, INVOICED
 * WHERE THE THROWING AWAY HAPPENS.
 *
 * ► **THE SKIP IS THE ONLY PLACE A ZERO CAN BE MANUFACTURED.** This file has
 *   exactly one skip — the `unsupported` branch in `extractFigure`, which also
 *   catches a MORPH whose definition would not parse — and until now it
 *   recorded the KIND and the character id and nothing else. Any effect on
 *   such a drawable vanished. Against the installed build the branch fires
 *   **0 times out of 37,077**, so everything this function counts here is a
 *   counted zero rather than a measured loss; **that is a fact about this
 *   build, not about this code**, and the two look identical from the manifest
 *   unless the number has a name.
 *
 * ► **IT REFUSES RATHER THAN CARRIES, AND THAT IS NOT A DODGE.** A skipped
 *   drawable has no geometry in this pack, so there is nothing for its glow to
 *   sit on. What is owed is a number with a name.
 */
function refusedEffectsOf(drawable, refusedOwn, notCarried) {
  refusedOwn.skipped += 1;
  const filters = Array.isArray(drawable.filters) && drawable.filters.length > 0 ? drawable.filters : null;
  const blend = drawable.blendMode !== undefined && drawable.blendMode !== null ? drawable.blendMode : null;
  if (filters) {
    refusedOwn.filterLists.push(filters);
    refuse(notCarried, "unsupportedDrawableFilters", filters.length);
  } else if (drawable.hasFilters) {
    // The same distinction `ownEffectsOf` draws, on a drawable that is leaving:
    // a CLEARED filter list is a fact about the instance, and losing it
    // silently alongside the drawable would make it look like nobody asked.
    refuse(notCarried, "unsupportedDrawableEmptyFilterList");
  }
  if (blend !== null) {
    refusedOwn.blendModes.push(blend);
    refuse(notCarried, "unsupportedDrawableBlendMode");
  }
  // ► **AND THE ANCESTOR CHAIN GOES TOO.** A skipped drawable that sat inside a
  //   glowing sprite loses the glow as well as its own effects, and the group
  //   itself may never be reached by any surviving leaf — so the pack would
  //   hold no trace of it. Counted per GROUP, the same unit `effectGroupsFor`
  //   counts on.
  const chain = Array.isArray(drawable.ancestorEffects) ? drawable.ancestorEffects : [];
  for (const group of chain) {
    refusedOwn.groupsOnSkipped += 1;
    const groupFilters = Array.isArray(group.filters) && group.filters.length > 0 ? group.filters : null;
    if (groupFilters) refuse(notCarried, "unsupportedDrawableInheritedFilters", groupFilters.length);
    if (group.blendMode !== undefined && group.blendMode !== null) {
      refuse(notCarried, "unsupportedDrawableInheritedBlendMode");
    }
  }
}

/**
 * THE ENCLOSING SPRITES THAT CARRY THIS PLACEMENT'S EFFECTS, as indices into
 * ONE ANIMATION'S `effectGroups` table — deduped BY THE WHOLE RECORD.
 *
 * ► **WHY THE KEY IS `JSON.stringify` OF THE WHOLE RECORD AND NOT THE PATH.
 *   MEASURED ON THE ORACLE, clip 1241, all 101 labels, all 2,222 frames:**
 *
 *   ```text
 *     key                  per-animation tables     distinct across the clip
 *     path only             4 groups /  8 filters    1 group  /  2 filters
 *     THE WHOLE RECORD     12 groups / 24 filters   10 groups / 20 filters
 *   ```
 *
 *   Every one of the 30 group-instances in this clip is the SAME sprite at the
 *   SAME depth — character 1195, `guard_charge`, at top-level path `43`,
 *   enclosing shape 856 at `43/1/1`. So a path key, or a path+character key,
 *   collapses the lot to ONE record and a renderer draws one frozen glow.
 *   **What it throws away is a tween**: the outer `#00ffff` glow runs
 *   `blurX` 22 → 21.4 → 20.8 → 20.2 → 19.6 → 19 → 17.5 → 16 → 14.5 → 13 with
 *   `strength` 2.699 → 0.977 → 2.699 over `psyche_up2`, which is the psych-up
 *   PULSE. Ten of those eleven-ish frames are distinct records; the path key
 *   reports one and loses the animation.
 *
 * ► **12 AND NOT 10 BECAUSE THE TABLE IS PER ANIMATION, and that is the shape
 *   this pack wants.** `psyche_up`, `psyche_charging` and `psyche_up2` each
 *   hold the blur-22 record, so 12 table entries are 10 distinct records.
 *   Splitting it that way keeps an animation self-contained — a renderer that
 *   loads one label needs nothing outside it — and keeps the top-level keys of
 *   `animations.json` exactly the label keys `labelKey` produces, which
 *   `src/render/extracted-figure.js` turns straight into `pack.labels`. A
 *   single clip-wide table would have to live under a top-level key there and
 *   would show up as a phantom 102nd animation. Both numbers are in the
 *   invoice — `inherited.groups` is 12, `inherited.distinctGroups` is 10 — so
 *   neither reading can be had by accident.
 */
function effectGroupsFor(drawable, groups, groupIndex, notCarried) {
  const chain = drawable.ancestorEffects;
  if (!Array.isArray(chain) || chain.length === 0) return null;
  const indices = [];
  for (const group of chain) {
    const filters = Array.isArray(group.filters) && group.filters.length > 0 ? group.filters : null;
    const record = {
      // The chain of depths that reaches the group, so a reader can find it in
      // the same frame's placements without re-deriving which level it was on.
      path: [...(group.path ?? [])],
      character: group.characterId,
      ...(group.blendMode !== undefined && group.blendMode !== null ? { blendMode: group.blendMode } : {}),
      ...(filters ? { filters } : {})
    };
    const key = JSON.stringify(record);
    let at = groupIndex.get(key);
    if (at === undefined) {
      at = groups.length;
      groups.push(record);
      groupIndex.set(key, at);
      if (!filters && group.hasFilters) refuse(notCarried, "emptyFilterList");
      for (const filter of filters ?? []) if (filter.measured === false) refuse(notCarried, "unmeasuredFilterRecord");
      // ► **A GROUP HAS NO MATRIX HERE, AND A BLUR RADIUS IS IN PIXELS.**
      //   `flattenFrame`'s ancestor record is `{path, characterId, blendMode,
      //   hasFilters, filters}` — no matrix — so a renderer scaling `blur(11)`
      //   by the group's own transform cannot, and must fall back to the stage
      //   scale `canvasFilterFor` already takes. Composing it here would mean a
      //   second copy of that recursion in this file. Counted instead, once per
      //   table entry, which on this build is 12.
      refuse(notCarried, "effectGroupMatrix");
    }
    indices.push(at);
  }
  return indices;
}

/**
 * THE WHOLE RIG'S EFFECT INVOICE, RECOUNTED FROM THE PACK ITSELF: what the
 * placements carry, what encloses them, WHAT A RENDERER WOULD ACTUALLY DO WITH
 * EACH — applied, deferred to the colour-matrix path, measured no-op, or
 * refused by name — and what could not be carried at all.
 *
 * ► **IT WALKS THE ANIMATIONS, exactly as `approximationTally` walks the
 *   shapes, and for the same reason.** That function used to sum a field
 *   written beside each shape, the 290 baked morphs had no such field, and the
 *   manifest a human reads counted an approximated morph path as zero. A
 *   counter kept alongside the data is a second thing to drift; a recount is
 *   not. So `main` hands this the animations object it is about to WRITE, and
 *   the numbers in `manifest.json` are numbers about the file on disk.
 *
 * ► **WHAT CANNOT BE RECOUNTED, AND IS THEREFORE PASSED IN.** `notCarried` and
 *   `dropped` describe things that are NOT in the pack — that is what makes
 *   them losses. No walk of the pack can find them, so they are carried from
 *   the extraction in `carried` and the split is named here rather than blurred:
 *   everything under `own` and `inherited` and `use` is a fact about the file,
 *   everything under `dropped` and `notCarried` is a fact about the run.
 *
 * ► **`scale` IS DELIBERATELY LEFT AT 1 in `canvasFilterFor`.** The invoice is
 *   about which filters can be expressed at all; the stage-to-canvas scale is
 *   the renderer's and changes the NUMBERS in the string, never the four
 *   buckets.
 *
 * ► **THE VERDICTS COME FROM `src/render/filters.js`, NOT FROM A TABLE HERE**,
 *   so "the pack carries it" and "the renderer can draw it" cannot drift apart
 *   while both stay green.
 */
export function effectTally(animations, carried = {}) {
  const notCarried = { ...(carried.notCarried ?? {}) };
  const dropped = carried.dropped ?? {};
  const droppedFilterLists = dropped.filterLists ?? [];
  const droppedBlendModes = dropped.blendModes ?? [];

  const groupFilterLists = [];
  const groupBlendModes = [];
  const ownFilterLists = [];
  const ownBlendModes = [];
  const distinct = new Set();
  let placements = 0;
  let groups = 0;
  let underGroup = 0;
  let groupInstances = 0;

  for (const animation of Object.values(animations ?? {})) {
    for (const group of animation?.effectGroups ?? []) {
      groups += 1;
      distinct.add(JSON.stringify(group));
      const filters = Array.isArray(group.filters) && group.filters.length > 0 ? group.filters : [];
      groupFilterLists.push(filters);
      if (group.blendMode !== undefined && group.blendMode !== null) groupBlendModes.push(group.blendMode);
    }
    for (const pose of animation?.poses ?? []) {
      for (const placement of pose) {
        placements += 1;
        const filters = Array.isArray(placement.filters) && placement.filters.length > 0 ? placement.filters : null;
        if (filters) ownFilterLists.push(filters);
        if (placement.blendMode !== undefined && placement.blendMode !== null) {
          ownBlendModes.push(placement.blendMode);
        }
        const indices = Array.isArray(placement.effects) ? placement.effects : null;
        if (indices && indices.length > 0) {
          underGroup += 1;
          groupInstances += indices.length;
        }
      }
    }
  }

  const byType = (lists) => {
    const counts = {};
    for (const list of lists) for (const filter of list) counts[filter.type] = (counts[filter.type] ?? 0) + 1;
    return counts;
  };
  const sum = (lists) => lists.reduce((total, list) => total + list.length, 0);

  const blend = { exact: {}, refused: {} };
  for (const id of [...groupBlendModes, ...ownBlendModes]) {
    const verdict = blendModeFor(id);
    const key = verdict.composite && verdict.exact ? "exact" : "refused";
    const label = key === "exact" ? verdict.name : `${verdict.name ?? id}:${verdict.refused}`;
    blend[key][label] = (blend[key][label] ?? 0) + 1;
  }

  return {
    // What the rig's OWN placements carry. Zero everywhere in the shipped
    // build; see `ownEffectsOf` for why that zero is the headline and not a
    // footnote, and why `placements` is printed beside it.
    own: {
      placements,
      filteredPlacements: ownFilterLists.length,
      filters: sum(ownFilterLists),
      filtersByType: byType(ownFilterLists),
      blendModePlacements: ownBlendModes.length,
      // ► **THE ZEROES ABOVE ARE ONLY HONEST NEXT TO THIS.** They count
      //   drawables this tool EMITTED. `dropped` counts effects on drawables it
      //   SKIPPED — which in the props pack is where 100% of the own filters
      //   turned out to be. Always present, even when empty, so "nothing was
      //   skipped" and "nobody counted the skips" are different shapes.
      dropped: {
        drawables: dropped.skipped ?? 0,
        placements: droppedFilterLists.length,
        filters: sum(droppedFilterLists),
        filtersByType: byType(droppedFilterLists),
        blendModePlacements: droppedBlendModes.length,
        inheritedGroups: dropped.groupsOnSkipped ?? 0
      }
    },
    // What ENCLOSES them. `groups` counts TABLE ENTRIES across every
    // animation, `distinctGroups` counts the records that are actually
    // different (12 and 10 on this build — see `effectGroupsFor`), and
    // `placements` counts the leaves inside them. Reporting only the last
    // would report one pulsing glow as 30 glows.
    inherited: {
      groups,
      distinctGroups: distinct.size,
      placements: underGroup,
      groupInstances,
      filters: sum(groupFilterLists),
      filtersByType: byType(groupFilterLists),
      blendModes: groupBlendModes.length
    },
    // ► **THE TWO ARE COUNTED ON DIFFERENT UNITS, ON PURPOSE.** A group's
    //   filters are counted ONCE however many leaves sit under it, because the
    //   build applies them once to the group; a placement's own are counted per
    //   placement, because each placement really does get its own. Adding them
    //   on one unit would either inflate this clip's two glows to sixty or
    //   deflate an own-filtered placement to one.
    //
    // ► **AND `use` IS COSTED PER TABLE ENTRY, not per distinct record**, so
    //   the blur-22 group that three labels share is costed three times. That
    //   is what a renderer actually pays: it builds the filter string once per
    //   animation it plays.
    use: {
      filters: summariseFilterUse([...groupFilterLists, ...ownFilterLists].map((list) => canvasFilterFor(list))),
      blendModes: blend
    },
    notCarried
  };
}

/**
 * Everything the extraction needs, without writing a byte.
 *
 * Separated from `main` so the report path and the write path cannot disagree
 * about what was measured, and so a caller can measure a build it does not want
 * to extract.
 */
/**
 * WHAT `flattenFrame`'s FRAME-1 FREEZE NEVER LOOKED AT — measured by walking
 * the clip's own placements and re-resolving each multi-frame child.
 *
 * ► **THIS EXISTS BECAUSE THE INVOICE ABOVE IT SHIPPED A CLEAN BILL OF HEALTH
 *   OVER TWENTY-FOUR GLOWS.** `--report` read
 *   *"DROPPED 0 filters and 0 inherited groups with 0 skipped drawables"* while
 *   sprite 703 `weapon0` sat at depth 39 of this very clip carrying two glows
 *   on each of its frames 2..13 — the weapon enchantment. Nothing in this file
 *   was wrong: every branch that can drop an effect really did drop none. The
 *   flatten pins every nested sprite to frame 1 (`spriteFrames[id] ?? 1` in
 *   `flattenFrame`), so those filters are not DROPPED, they are NEVER READ, and
 *   a loss counter that only counts drops cannot see them. **An approximation
 *   that is not counted is indistinguishable from a correct read**, and this is
 *   that rule arriving one level below where the file was watching for it.
 *
 * ► **AND FRAME 1 IS NOT A NEUTRAL SAMPLE OF SPRITE 703, IT IS A LOADED ONE.**
 *   `itemglow(whichitem, enchant_type, enchant_potency)` — root frame 35,
 *   `DefineFunction2` at file offset `0x3fa786` — drives that clip to frames
 *   2..13, and frame 1 is exactly the UNENCHANTED weapon. Freezing there does
 *   not sample the thirteen frames badly; it selects the one on which the
 *   effect is off. `tools/extract-enchantments.mjs` owns that table.
 *
 * ► **IT COUNTS, IT DOES NOT CARRY.** Carrying would mean a second frame axis
 *   on every pose in this pack to serve one clip, and the thing a renderer
 *   actually needs is a twelve-cell lookup, which is a different tool's output.
 *   What is owed here is a NUMBER WITH A NAME so a reader of `manifest.json`
 *   cannot mistake "this pack has no other effects" for "nobody looked".
 *
 * Returns `{sprites, frames, filters, byCharacter}` — `sprites` the distinct
 * multi-frame children frozen, `frames` the frames of them never resolved,
 * `filters` the filter records on those frames, and `byCharacter` the per-child
 * detail so the report can NAME the clip rather than print a bare count.
 */
export function frozenNestedSpriteCensus(buffer, characters, frames, animations, cache = new Map()) {
  // Which characters are placed anywhere under this clip, at any depth. Built
  // from the SAME display lists the walk above uses, so a child this census
  // names is one the pack really contains — never one merely reachable in the
  // file.
  const placed = new Map();
  const visit = (entries, depth, visiting) => {
    if (depth > 8) return;
    for (const entry of entries) {
      const character = characters.get(entry.characterId);
      if (!character || character.kind !== "sprite") continue;
      if (visiting.has(character.id)) continue;
      if (character.frames > 1) {
        placed.set(character.id, character);
        // A multi-frame child is where the freeze bites, and this census does
        // not descend past it: everything below is frozen too, and counting it
        // here would report the same loss twice under two names.
        continue;
      }
      const resolved = resolveTimeline(buffer, character, { frames: [1] });
      const inner = resolved.frames[0];
      if (!inner) continue;
      visiting.add(character.id);
      visit(inner, depth + 1, visiting);
      visiting.delete(character.id);
    }
  };
  for (const animation of animations) {
    for (let frame = animation.firstFrame; frame <= animation.lastFrame; frame += 1) {
      const displayList = frames[frame - 1];
      if (displayList) visit(displayList, 0, new Set());
    }
  }

  const byCharacter = [];
  let unresolvedFrames = 0;
  let filters = 0;
  for (const character of [...placed.values()].sort((left, right) => left.id - right.id)) {
    // Frames 2..N — the ones the freeze never asks for. Frame 1 IS read by the
    // walk above, so counting it here would inflate the loss by a frame per
    // child.
    let behind = 0;
    for (let frame = 2; frame <= character.frames; frame += 1) {
      const resolved = resolveTimeline(buffer, character, { frames: [frame] });
      const inner = resolved.frames[frame - 1];
      if (!inner) continue;
      for (const drawable of flattenFrame(buffer, characters, inner, { cache })) {
        behind += (drawable.filters ?? []).length;
        for (const group of drawable.ancestorEffects ?? []) behind += (group.filters ?? []).length;
      }
    }
    unresolvedFrames += character.frames - 1;
    filters += behind;
    byCharacter.push({
      character: character.id,
      name: character.exportName ?? null,
      frames: character.frames,
      framesNotResolved: character.frames - 1,
      filtersBehindTheFreeze: behind
    });
  }
  return { sprites: byCharacter.length, frames: unresolvedFrames, filters, byCharacter };
}

export function extractFigure(buffer, { clip = DEFAULT_CLIP } = {}) {
  const { characters } = indexCharacters(buffer);
  const sprite = characters.get(clip);
  if (!sprite) throw new ExtractFigureError(`No character ${clip} in this build.`);
  if (sprite.kind !== "sprite") {
    throw new ExtractFigureError(`Character ${clip} is a ${sprite.kind}, not a sprite with a timeline.`);
  }

  const { frames } = resolveTimeline(buffer, sprite);
  const animations = deriveAnimations(buffer, sprite);
  if (animations.length === 0) {
    throw new ExtractFigureError(`Clip ${clip} carries no FrameLabel tags, so it has no named animations.`);
  }

  const cache = new Map();
  const shapeIds = new Set();
  const unsupported = new Map();
  const colourTransformed = new Set();
  const out = {};
  let placementCount = 0;

  // ► **EFFECT LOSSES ARE CLIP-WIDE, EFFECT TABLES ARE PER ANIMATION.** These
  //   two accumulate across every label because a loss is a fact about the
  //   RUN; the `effectGroups` table below is rebuilt per animation because a
  //   group is a fact about a timeline a renderer plays on its own. See
  //   `effectGroupsFor` for the 12-versus-10 that distinction costs, and
  //   `effectTally` for how both reach the manifest.
  const notCarried = {};
  const refusedOwn = { skipped: 0, groupsOnSkipped: 0, filterLists: [], blendModes: [] };

  /**
   * MORPH SHAPES, BAKED AT THE RATIO THEY ARE PLACED AT.
   *
   * ► **Measured before choosing this: the fighter clip has 290 morph
   *   placements across all 2,222 frames, and all 290 are a DISTINCT
   *   `(morph, ratio)` pair.** So there is nothing to deduplicate and nothing
   *   to interpolate at runtime — baking each one costs 290 path sets and
   *   lets a morph be an ordinary entry in `shapes`, keyed `"<id>@<ratio>"`.
   *   The renderer needs no second code path and no morph parser in the
   *   browser.
   *
   * The alternative — shipping both edge streams and lerping per frame — would
   * put a second geometry pipeline in the renderer to serve 290 placements.
   */
  const morphDefinitions = new Map();
  const morphShapes = {};
  const morphFailures = [];
  const morphKeyFor = (characterId, rawRatio) => {
    const ratio = Number.isFinite(rawRatio) ? rawRatio : 0;
    const key = `${characterId}@${ratio}`;
    if (morphShapes[key]) return key;
    let definition = morphDefinitions.get(characterId);
    if (definition === undefined) {
      const character = characters.get(characterId);
      try {
        definition = parseMorphShape(buffer, character.bodyStart, character.bodyEnd, character.tagCode);
      } catch (error) {
        definition = null;
        morphFailures.push({ id: characterId, message: String(error.message).slice(0, 120) });
      }
      morphDefinitions.set(characterId, definition);
    }
    if (!definition) return null;
    const frame = morphShapeAt(definition, ratioOf(ratio));
    const paths = morphToPaths(frame);
    morphShapes[key] = {
      bounds: {
        xMin: px(frame.bounds.xMin), xMax: px(frame.bounds.xMax),
        yMin: px(frame.bounds.yMin), yMax: px(frame.bounds.yMax)
      },
      morph: characterId,
      ratio,
      // ► **A MORPH ENTRY USED TO CARRY NO TALLY AT ALL** while every ordinary
      //   shape entry beside it carried one. A reader of the pack could not
      //   tell "this morph approximates nothing" from "nobody counted", and
      //   the manifest's own sum was built out of exactly this missing field.
      //   The invoice travels with the picture here too.
      ...pathApproximations(paths),
      paths
    };
    return key;
  };

  for (const animation of animations) {
    const key = labelKey(animation.name);
    const poses = [];
    // THIS ANIMATION'S EFFECT GROUPS, in first-seen order, deduped by the WHOLE
    // record. `groupIndex` is the dedup and never leaves this scope; `groups`
    // is written into the pack and is what a placement's `effects` indexes.
    const groups = [];
    const groupIndex = new Map();
    // ► **THE LIMB'S OWN MATRIX, kept beside the flattened pose.** A flattened
    //   placement carries the FULLY composed transform — limb x wrapper x inner
    //   — which is what you need to draw the body and is NOT what you need to
    //   dress it. `attachMovie` puts a piece INSIDE the limb clip, so a helmet
    //   is positioned by the head's transform alone. The product cannot be
    //   un-multiplied afterwards, so it is recorded here or not at all.
    const limbPoses = [];
    for (let frame = animation.firstFrame; frame <= animation.lastFrame; frame += 1) {
      const displayList = frames[frame - 1];
      if (!displayList) continue;
      const depthNames = buildDepthNames(displayList);
      const limbs = {};
      for (const entry of displayList) {
        if (entry.name) limbs[entry.name] = roundMatrix(entry.matrix ?? { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
      }
      limbPoses.push(limbs);
      const drawables = flattenFrame(buffer, characters, displayList, { cache });
      const pose = [];
      for (const drawable of drawables) {
        placementCount += 1;
        // ► **THE MORPH BRANCH AND THE ORDINARY BRANCH USED TO BUILD TWO
        //   PLACEMENT LITERALS, AND THAT IS HOW A FIELD GOES MISSING FROM ONE
        //   OF THEM.** `morphKeyFor`'s copy already lagged once: it wrote no
        //   approximation invoice while every shape beside it did. So the two
        //   now differ only in WHICH KEY names the geometry, and everything
        //   that is true of a placement — colour, own effects, enclosing
        //   groups — is written once, below, for both. The 290 baked morphs in
        //   this clip carry no effects on this build; they are in the invoice's
        //   denominator all the same.
        let shapeKey = null;
        if (drawable.unsupported === "morph") {
          shapeKey = morphKeyFor(drawable.characterId, drawable.ratio);
        } else if (!drawable.unsupported) {
          shapeIds.add(drawable.characterId);
          shapeKey = drawable.characterId;
        }
        if (shapeKey === null) {
          // The one skip in this file: an unsupported drawable, or a morph
          // whose definition would not parse. Both are REPORTED — and now both
          // invoice the effects that leave with them, which is the difference
          // between a measured zero and a measurement of this branch.
          const tally = unsupported.get(drawable.unsupported) ?? new Set();
          tally.add(drawable.characterId);
          unsupported.set(drawable.unsupported, tally);
          refusedEffectsOf(drawable, refusedOwn, notCarried);
          continue;
        }
        const colour = packColour(drawable.colourTransform);
        if (colour && typeof shapeKey === "number") colourTransformed.add(shapeKey);
        const own = ownEffectsOf(drawable, notCarried);
        const inherited = effectGroupsFor(drawable, groups, groupIndex, notCarried);
        const placement = {
          shape: shapeKey,
          limb: depthNames.get(drawable.path[0]) ?? null,
          depth: drawable.path,
          matrix: roundMatrix(drawable.matrix)
        };
        if (colour) placement.colour = colour;
        // THIS PLACEMENT'S OWN filter list and blend mode, spread the same
        // conditional way `colour` is and absent when it has none. `filters`
        // on a placement means the placement's own and nothing else — measured
        // 0 of 37,077 on this build, so this is the dead half of the fix and is
        // written that way deliberately.
        if (own.filters) placement.filters = own.filters;
        if (own.blendMode !== undefined) placement.blendMode = own.blendMode;
        // ► **ITS ANCESTORS' ARE A DIFFERENT KEY WITH A DIFFERENT NAME**,
        //   holding indices into THIS ANIMATION's `effectGroups` and NOT filter
        //   records, so no reader can take an enclosing sprite's blur for this
        //   leaf's. Outermost first, which is the order a renderer has to nest
        //   its buffers in — every chain in clip 1241 is length 1, so that
        //   order is unmeasurable against this build and is pinned by fixture
        //   instead.
        if (inherited) placement.effects = inherited;
        pose.push(placement);
      }
      poses.push(pose);
    }
    out[key] = {
      label: animation.name,
      firstFrame: animation.firstFrame,
      lastFrame: animation.lastFrame,
      // ALWAYS PRESENT, EMPTY WHERE THERE ARE NONE — 97 of this clip's 101
      // labels have no effects at all. An absent key would make "this
      // animation encloses nothing" and "this pack predates effect groups" the
      // same shape, and telling those apart is the whole point of writing a
      // count down.
      effectGroups: groups,
      poses,
      limbs: limbPoses
    };
  }

  // Shapes ONCE, not per frame. This is the whole reason the output is a pack
  // rather than a per-frame dump: eleven shapes serve 2,222 frames.
  const shapes = {};
  const failures = [];
  for (const id of [...shapeIds].sort((left, right) => left - right)) {
    const character = characters.get(id);
    try {
      const shape = parseShape(buffer, character.bodyStart, character.bodyEnd, character.tagCode);
      const paths = shapeToPaths(shape);
      shapes[id] = {
        bounds: {
          xMin: px(shape.bounds.xMin), xMax: px(shape.bounds.xMax),
          yMin: px(shape.bounds.yMin), yMax: px(shape.bounds.yMax)
        },
        // ► **A COUNT THAT COLLAPSES THE KIND IS HALF A COUNT.** This was one
        //   integer folding gradient, bitmap and line-fill together, and it was
        //   then never rolled up into the manifest at all — so `assets/figure/
        //   manifest.json` reported no approximations while eight body
        //   gradients sat in `shapes.json`. Kept per shape AND summed by kind
        //   for the manifest, because "8 approximated" and "8 gradients" lead
        //   to different next actions. The manifest's sum no longer reads these
        //   fields — it recounts the paths — so the two cannot drift apart.
        ...pathApproximations(paths),
        paths
      };
    } catch (error) {
      failures.push({ id, message: String(error.message) });
    }
  }
  // The baked morphs join the shape table: from here they are ordinary entries
  // whose key happens to carry a ratio.
  Object.assign(shapes, morphShapes);
  for (const failure of morphFailures) failures.push({ id: failure.id, message: `morph: ${failure.message}` });

  // ► **AND THE PART NO WALK OF THE *RUN* CAN FIND EITHER, WHICH IS THE ONE
  //   THAT SHIPPED A CLEAN BILL OF HEALTH OVER 24 MISSING GLOWS.** See
  //   `frozenNestedSpriteCensus`: everything above this line measures drawables
  //   the flatten RETURNED, and `flattenFrame` freezes every nested sprite on
  //   frame 1, so a filter that lives on frame 2 of a child is not dropped by
  //   any branch here — it is never looked at. The census is the only thing in
  //   this file that can see it.
  //   ► `frozen.sprites` is a COUNT, not an array, and the first version of
  //     these three lines read `frozen.sprites.length` — `undefined > 0` is
  //     false, so the sprite line silently never fired while the filter line
  //     beside it did. Caught by printing the invoice rather than by the suite.
  //     A guard that cannot fire is the same defect this function exists to
  //     count, committed inside the fix for it.
  const frozen = frozenNestedSpriteCensus(buffer, characters, frames, animations, cache);
  if (frozen.sprites > 0) refuse(notCarried, "nestedSpriteFrame1", frozen.sprites);
  if (frozen.frames > 0) refuse(notCarried, "nestedSpriteFramesNotResolved", frozen.frames);
  if (frozen.filters > 0) refuse(notCarried, "filtersBehindNestedFreeze", frozen.filters);

  const effectLoss = { notCarried, dropped: refusedOwn, frozen };

  return {
    morphCount: Object.keys(morphShapes).length,
    clip,
    clipName: sprite.exportName ?? null,
    frameCount: sprite.frames,
    animations: out,
    shapes,
    failures,
    placementCount,
    effectLoss,
    frozenNested: frozen,
    effects: effectTally(out, effectLoss),
    colourTransformed: [...colourTransformed].sort((left, right) => left - right),
    unsupported: Object.fromEntries(
      [...unsupported.entries()].map(([kind, ids]) => [kind, [...ids].sort((left, right) => left - right)])
    )
  };
}

/**
 * The union of every shape's transformed bounds across an animation — the
 * viewBox a renderer can hold steady while the figure moves inside it.
 *
 * All four corners are transformed, not two: a rotated limb's box is not the
 * rotation of its box's opposite corners, and the fighter's arms rotate on
 * almost every frame.
 */
export function poseBounds(shapes, poses) {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const pose of poses) {
    for (const placement of pose) {
      const shape = shapes[placement.shape];
      if (!shape) continue;
      const [a, b, c, d, tx, ty] = placement.matrix;
      const corners = [
        [shape.bounds.xMin, shape.bounds.yMin], [shape.bounds.xMax, shape.bounds.yMin],
        [shape.bounds.xMin, shape.bounds.yMax], [shape.bounds.xMax, shape.bounds.yMax]
      ];
      for (const [cornerX, cornerY] of corners) {
        const x = a * cornerX + c * cornerY + tx / TWIPS_PER_PIXEL;
        const y = b * cornerX + d * cornerY + ty / TWIPS_PER_PIXEL;
        if (x < xMin) xMin = x;
        if (x > xMax) xMax = x;
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
    }
  }
  if (!Number.isFinite(xMin)) return { xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
  const round = (value) => Math.round(value * 100) / 100;
  return { xMin: round(xMin), xMax: round(xMax), yMin: round(yMin), yMax: round(yMax) };
}

/**
 * EVERY TINTED COLOUR THE PREVIEW CAN ASK FOR, COMPUTED HERE BY `filters.js` SO
 * THE PAGE HOLDS NO COLOUR ARITHMETIC OF ITS OWN.
 *
 * ► **THIS EXISTS BECAUSE THE PREVIEW HELD A FIFTH COPY OF THE COLOUR
 *   TRANSFORM AND THE COPY WAS WRONG.** The emitted page computed
 *   `Math.round(value * mul + off)`; the player computes
 *   `(channel * multTerm) >> 8`, which FLOORS. So the picture a person checks
 *   this extraction against disagreed with what the renderer draws, in the file
 *   whose own header calls it "the reason this tool writes HTML at all".
 *
 *   Measured on the pack this tool writes before removing it: **11,018 of
 *   47,025 channel computations across the 4,544 tinted placements came out one
 *   unit apart**, and 1,765 of the 3,290 distinct (fill, transform) pairs. The
 *   alpha half was NOT wrong — `tintAlpha` already matched
 *   `applyColourTransformAlpha` term for term, offset divided by 255 and
 *   multiplier not — and it is routed through here anyway, because a copy that
 *   agrees today is a copy that can stop agreeing.
 *
 * ► **AND IT IS NOT FIXED BY CHANGING `round` TO `floor` IN PLACE.** A sixth
 *   copy that happens to agree is still a sixth copy, and the page cannot
 *   `import` anything: it is opened from `file://` with no server, which is a
 *   constraint this file has already paid for once. So the arithmetic runs
 *   ONCE, HERE, through `src/render/filters.js`, and the page does a lookup.
 *
 * The table is keyed by the placement's own colour array joined with commas —
 * the page computes the same key from the same array — and holds only the
 * (colour, value) pairs the poses actually reach, so a lookup cannot miss.
 * Measured on the oracle's pack: 250 distinct transforms and 3,290 distinct
 * (fill, transform) pairs — an 84 KB island on a page that was already 6.4 MB.
 *
 * ► **A MISS IS COUNTED AND SHOWN RATHER THAN SWALLOWED.** If a lookup ever
 *   does fail, the page draws the untinted colour — the only thing it can do —
 *   and says so in its own footer, because an approximation that is not counted
 *   is indistinguishable from a correct read.
 *
 * @param shapes      the pack this tool writes: `{[id]: {paths: [...]}}`
 * @param animations  the poses, whose placements carry the eight-number colour
 */
export function previewTints(shapes, animations) {
  const fills = {};
  const alphas = {};
  let fillPairs = 0;
  let alphaPairs = 0;
  for (const animation of Object.values(animations ?? {})) {
    for (const pose of animation?.poses ?? []) {
      for (const placement of pose) {
        const colour = placement?.colour;
        if (!colour) continue;
        const key = colour.join(",");
        const fillRow = fills[key] ?? (fills[key] = {});
        const alphaRow = alphas[key] ?? (alphas[key] = {});
        const shape = shapes?.[placement.shape];
        if (!shape) continue;
        for (const entry of shape.paths ?? []) {
          // EXACTLY the values the page will look up, and in the same shape:
          // its `tintHex` returns early on a falsy fill and on "none", and its
          // `tintAlpha` defaults a missing stroke opacity to 1. A table built
          // from anything else is a table with holes in it.
          for (const hex of [entry.fill, entry.stroke]) {
            if (!hex || hex === "none" || hex in fillRow) continue;
            fillRow[hex] = applyColourTransform(hex, colour);
            fillPairs += 1;
          }
          for (const alpha of [entry.fillOpacity, entry.strokeOpacity ?? 1]) {
            const slot = String(alpha);
            if (slot in alphaRow) continue;
            alphaRow[slot] = applyColourTransformAlpha(alpha, colour);
            alphaPairs += 1;
          }
        }
      }
    }
  }
  return { fills, alphas, transforms: Object.keys(fills).length, fillPairs, alphaPairs };
}

/**
 * A page that plays the extracted rig, AND sounds it.
 *
 * ► **THE FIRST VERSION NEEDED A SERVER AND THAT WAS A DESIGN ERROR.** It
 *   `fetch`ed the two JSON files beside it, which a `file://` page may not do,
 *   so opening it directly gave a BLANK PAGE with the reason only in a console
 *   nobody was asked to open. The owner hit exactly that. A page whose entire
 *   job is "a person looks at it" must not have a prerequisite, so the data is
 *   INLINED and this file is self-contained: double-click it.
 *
 * ► **AND IT PLAYS THE SOUND BOUND TO THE ANIMATION ON SCREEN.** The two
 *   extractions join perfectly, because both key on the BUILD'S OWN frame
 *   labels — `tools/extract-sounds.mjs` binds a `StartSound` to the label it
 *   fires under, and this binds a pose run to the same label. 80 of the 101
 *   animations carry sound and 21 are silent, `Block` among them.
 *
 *   That join is what makes this page the check for BOTH extractions at once:
 *   a walk that sounds like a leaping attack is visible here as a walking
 *   gladiator making the wrong noise, which is the defect the owner caught by
 *   ear last session and which no test in this repository could see.
 *
 * The mp3s are NOT inlined — they are referenced by relative path, because a
 * media element may load `file://` where `fetch` may not, and 4.79 MB of base64
 * helps nobody.
 *
 * Deliberately dependency-free and deliberately dumb. If the figure in here
 * looks wrong, the extraction is wrong: there is no third thing to blame.
 */
export function previewHtml({ clip, clipName, shapes, animations, soundBindings, soundPath }) {
  // `</script>` cannot appear inside a script element even in a JSON island,
  // and `<` is the only character that can start one.
  const island = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
  const labels = Object.keys(animations);
  const sounded = labels.filter((key) => (soundBindings?.[key] ?? []).length > 0).length;
  // Every tinted colour these poses can ask for, computed by filters.js so
  // that nothing below has to. See `previewTints`.
  const tints = previewTints(shapes, animations);
  return `<!doctype html>
<meta charset="utf-8">
<title>Extracted figure — clip ${clip}${clipName ? ` (${clipName})` : ""}</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font: 14px system-ui, sans-serif; background: #14161a; color: #e6e8ec; }
  header { padding: 10px 16px; border-bottom: 1px solid #2a2e36; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  select, button, input { font: inherit; background: #22262e; color: inherit; border: 1px solid #3a3f4a; border-radius: 6px; padding: 4px 8px; }
  button { cursor: pointer; }
  main { display: grid; grid-template-columns: minmax(0, 1fr); place-items: center; padding: 16px; }
  svg { background: #0e1013; border: 1px solid #2a2e36; border-radius: 8px; max-width: 100%; height: auto; }
  .meta { color: #9aa3b2; font-variant-numeric: tabular-nums; }
  .silent { color: #f0b429; }
  footer { padding: 10px 16px; border-top: 1px solid #2a2e36; color: #9aa3b2; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  footer button { padding: 2px 8px; }
</style>
<header>
  <label>Animation <select id="anim"></select></label>
  <button id="play">Pause</button>
  <label>fps <input id="fps" type="number" value="24" min="1" max="60" style="width:5em"></label>
  <label><input type="checkbox" id="sound" checked> sound</label>
  <span class="meta" id="meta"></span>
</header>
<main><svg id="stage" width="520" height="620" preserveAspectRatio="xMidYMid meet"></svg></main>
<footer>
  <span class="meta">${sounded} of ${labels.length} animations carry sound.</span>
  <span class="meta" id="tintnote"></span>
  <span id="bound"></span>
</footer>
<script type="application/json" id="shapes">${island(shapes)}</script>
<script type="application/json" id="animations">${island(animations)}</script>
<script type="application/json" id="bindings">${island(soundBindings ?? {})}</script>
<script type="application/json" id="tints">${island({ fills: tints.fills, alphas: tints.alphas })}</script>
<script>
const shapes = JSON.parse(document.getElementById("shapes").textContent);
const animations = JSON.parse(document.getElementById("animations").textContent);
const bindings = JSON.parse(document.getElementById("bindings").textContent);
const TINTS = JSON.parse(document.getElementById("tints").textContent);
const FILL_TINTS = TINTS.fills;
const ALPHA_TINTS = TINTS.alphas;
const TINT_PAIRS = ${tints.fillPairs};
const TINT_TRANSFORMS = ${tints.transforms};
const SOUND_PATH = ${JSON.stringify(soundPath)};

const stage = document.getElementById("stage");
const picker = document.getElementById("anim");
const meta = document.getElementById("meta");
const bound = document.getElementById("bound");
const tintNote = document.getElementById("tintnote");
const fpsInput = document.getElementById("fps");
const playButton = document.getElementById("play");
const soundToggle = document.getElementById("sound");
const keys = Object.keys(animations);
for (const key of keys) {
  const option = document.createElement("option");
  option.value = key;
  const files = bindings[key] || [];
  option.textContent = animations[key].label + " (" + animations[key].poses.length + "f" + (files.length ? ", " + files.length + " snd" : ", silent") + ")";
  picker.append(option);
}
const NS = "http://www.w3.org/2000/svg";
let current = keys.includes("standing") ? "standing" : keys[0];
let frame = 0;
let playing = true;
let last = 0;
let soundIndex = 0;

function playFor(key) {
  if (!soundToggle.checked || !SOUND_PATH) return;
  const files = bindings[key] || [];
  if (files.length === 0) return;
  // Cycle rather than always taking the first: the build fires several sounds
  // per animation and the arena spreads across them by sequence number, so an
  // audition that only ever played files[0] would check a fraction of what you
  // will actually hear.
  const file = files[soundIndex % files.length];
  soundIndex += 1;
  const audio = new Audio(SOUND_PATH + "/" + file);
  audio.volume = 0.7;
  audio.play().catch(() => {});
}

function showBound(key) {
  const files = bindings[key] || [];
  bound.replaceChildren();
  if (files.length === 0) {
    const span = document.createElement("span");
    span.className = "silent";
    span.textContent = "no StartSound on this label — silent in the build, and that is not a gap";
    bound.append(span);
    return;
  }
  for (const file of files) {
    const button = document.createElement("button");
    button.textContent = "▸ " + file;
    button.addEventListener("click", () => {
      const audio = new Audio(SOUND_PATH + "/" + file);
      audio.volume = 0.7;
      audio.play().catch(() => {});
    });
    bound.append(button);
  }
}

// ► **THE COLOUR ARITHMETIC USED TO BE HERE, AND IT WAS WRONG.** This page did
// the tint itself — Math.round of value x mul + off — as the FIFTH copy of the
// colour transform in this tree, and the one feeding the artefact a human
// checks the extraction against. The player FLOORS: readColourTransform reads
// the multiply term as signed 8.8 fixed point, and (channel x multTerm) >> 8 is
// an arithmetic shift. Measured on this pack, 11,018 of 47,025 channel
// computations came out one unit apart from what src/render/filters.js draws.
//
// So there is no colour arithmetic left in this page. previewTints precomputed
// every (colour, value) pair these poses can reach, through filters.js itself,
// and these two functions are lookups. 4,544 placements in this clip carry a
// colour transform and they are the CONDITION TINTS — frozen, burning,
// poisoned, lifesteal, the two casts.
//
// (No backticks and no dollar-brace below: this script is emitted from a
// template literal, and a stray one of either ends the page mid-sentence.)
//
// A miss is impossible by construction and is COUNTED anyway: the table was
// built by walking the same poses this draws, so a miss means the two walks
// disagree, which is worth a line in the footer rather than a silent flat
// colour.
let tintMisses = 0;

function tintHex(hex, c) {
  if (!c || !hex || hex === "none") return hex;
  const row = FILL_TINTS[c.join(",")];
  const tinted = row ? row[hex] : undefined;
  if (tinted === undefined) { tintMisses += 1; return hex; }
  return tinted;
}

function tintAlpha(alpha, c) {
  if (!c) return alpha;
  const row = ALPHA_TINTS[c.join(",")];
  const tinted = row ? row[String(alpha)] : undefined;
  if (tinted === undefined) { tintMisses += 1; return alpha; }
  return tinted;
}

// ONE VIEWBOX FOR EVERY ANIMATION, and it is the STANDING one padded.
// Sizing per animation looked right until the morph effects landed: death2's
// own bounds are 781x312 against standing's 96x223, because the blood sprays
// most of a screen to the left. Fitting that shrinks the gladiator to a speck
// exactly when you want to watch him. A fixed box is also what a game camera
// does — the effect leaves frame, the fighter does not.
const BASE = animations.standing ? animations.standing.bounds : null;
const PAD = 0.45;
const VIEWBOX = BASE
  ? [BASE.xMin - (BASE.xMax - BASE.xMin) * PAD, BASE.yMin - (BASE.yMax - BASE.yMin) * 0.1,
     (BASE.xMax - BASE.xMin) * (1 + PAD * 2), (BASE.yMax - BASE.yMin) * 1.2].join(" ")
  : null;

function draw() {
  const animation = animations[current];
  const pose = animation.poses[frame % animation.poses.length] || [];
  const box = animation.bounds;
  stage.setAttribute("viewBox", VIEWBOX
    || (box.xMin + " " + box.yMin + " " + (box.xMax - box.xMin) + " " + (box.yMax - box.yMin)));
  stage.replaceChildren();
  for (const placement of pose) {
    const shape = shapes[placement.shape];
    if (!shape) continue;
    const m = placement.matrix;
    const group = document.createElementNS(NS, "g");
    group.setAttribute("transform", "matrix(" + m[0] + " " + m[1] + " " + m[2] + " " + m[3] + " " + (m[4] / 20) + " " + (m[5] / 20) + ")");
    if (placement.limb) group.dataset.limb = placement.limb;
    const c = placement.colour;
    for (const entry of shape.paths) {
      const node = document.createElementNS(NS, "path");
      node.setAttribute("d", entry.d);
      node.setAttribute("fill", tintHex(entry.fill, c));
      node.setAttribute("fill-opacity", String(tintAlpha(entry.fillOpacity, c)));
      if (entry.fillRule) node.setAttribute("fill-rule", entry.fillRule);
      if (entry.stroke) {
        node.setAttribute("stroke", tintHex(entry.stroke, c));
        node.setAttribute("stroke-opacity", String(tintAlpha(entry.strokeOpacity ?? 1, c)));
        node.setAttribute("stroke-width", String(entry.strokeWidth));
        node.setAttribute("stroke-linejoin", "round");
        node.setAttribute("stroke-linecap", "round");
      }
      group.append(node);
    }
    stage.append(group);
  }
  meta.textContent = "frame " + ((frame % animation.poses.length) + 1) + "/" + animation.poses.length +
    " · clip frames " + animation.firstFrame + "-" + animation.lastFrame + " · " + pose.length + " parts";
  // The tint invoice, on screen rather than in a console nobody opens.
  tintNote.textContent = tintMisses === 0
    ? TINT_PAIRS + " precomputed tints across " + TINT_TRANSFORMS + " colour transforms"
    : tintMisses + " TINT LOOKUPS MISSED — those fills are drawn UNTINTED";
  tintNote.className = tintMisses === 0 ? "meta" : "silent";
}

function select(key) {
  current = key;
  frame = 0;
  soundIndex = 0;
  showBound(key);
  draw();
  playFor(key);
}

function tick(now) {
  const step = 1000 / Math.max(1, Number(fpsInput.value) || 24);
  if (playing && now - last >= step) {
    last = now;
    frame += 1;
    // A new pass over the animation is a new performance of it, so it sounds
    // again — which is what makes a wrong binding audible rather than a thing
    // you had to catch in the first second.
    if (frame % animations[current].poses.length === 0) playFor(current);
    draw();
  }
  requestAnimationFrame(tick);
}

picker.value = current;
picker.addEventListener("change", () => select(picker.value));
playButton.addEventListener("click", () => {
  playing = !playing;
  playButton.textContent = playing ? "Pause" : "Play";
});
showBound(current);
draw();
requestAnimationFrame(tick);
</script>
`;
}

/**
 * Where this tool may write, and it is not "anywhere `--out` says".
 *
 * ► **Two different dangers, and only one of them is about licensing.**
 *
 *   The licensing one: `--out .` puts extracted art in the repository root,
 *   outside `assets/`, where the ignore rule does not reach it and one
 *   `git add -A` commits it. That is not hypothetical here — on 2026-09-01 a
 *   subagent wrote 67 raw traces to an unexpected path and exactly that
 *   happened, because the ignore rule covered one directory and nothing looked.
 *
 *   The evidence one: the installed build is the MEASUREMENT ORACLE, and
 *   writing anywhere near it risks the one file whose bytes 23 goldens, 69
 *   observation records and every capture manifest depend on.
 *
 * So: a path INSIDE the repository must be inside `assets/`, and a path
 * outside it is free — nothing out there can be committed by accident. That
 * keeps the legitimate case (extract two builds side by side under /tmp and
 * diff them) while closing the one that has actually bitten.
 */
export function assertWritableOutput(out, swfPath) {
  const resolved = path.resolve(out);
  const root = path.resolve(REPO_ROOT);
  const assets = path.join(root, "assets");
  const within = (parent, child) => child === parent || child.startsWith(parent + path.sep);

  if (within(root, resolved) && !within(assets, resolved)) {
    throw new ExtractFigureError(
      `--out ${resolved} is inside the repository but outside assets/. Extracted art may only ` +
      "land in assets/, which is gitignored and which test/asset-attestation.test.js watches. " +
      "Anywhere outside the repository is fine."
    );
  }
  const swf = path.resolve(swfPath);
  if (within(resolved, swf)) {
    throw new ExtractFigureError(
      `--out ${resolved} contains the build being read (${swf}). That is the measurement oracle; ` +
      "nothing writes into its directory."
    );
  }
}

/**
 * Refuse a target that is a symlink, or that IS the build.
 *
 * `writeFileSync` follows a symlink and truncates its destination, so a link
 * named `manifest.json` pointing at the installed SWF would destroy the oracle
 * through a tool that opened it read-only. `lstat` is the check that sees the
 * link rather than what it points at.
 */
export function assertReplaceableFile(target, swfPath) {
  if (path.resolve(target) === path.resolve(swfPath)) {
    throw new ExtractFigureError(`Refusing to write over the build being read: ${target}`);
  }
  let stats = null;
  try {
    stats = fs.lstatSync(target);
  } catch {
    return; // Nothing there, which is the ordinary case.
  }
  if (stats.isSymbolicLink()) {
    throw new ExtractFigureError(
      `${target} is a symlink. Writing through it would truncate whatever it points at, which ` +
      "on this machine could be the installed build. Remove the link and run again."
    );
  }
  if (!stats.isFile()) {
    throw new ExtractFigureError(`${target} exists and is not a regular file.`);
  }
}

/**
 * The sound extractor's own label bindings, if it has run.
 *
 * ► **The two extractions join on the BUILD'S OWN frame labels and on nothing
 *   else.** `extract-sounds.mjs` binds each `StartSound` to the label it fires
 *   under; this tool cuts the timeline at the same labels. That shared
 *   vocabulary is the build's, not a convention either tool invented, so the
 *   join cannot silently drift — which is exactly what the PROSE buckets it
 *   replaced did do.
 *
 * Absent or unreadable is not an error: the preview is simply silent, the same
 * way the arena is silent with no assets extracted.
 */
export function readSoundBindings(soundDir) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(soundDir, "manifest.json"), "utf8"));
    const bindings = manifest?.bindings;
    if (!bindings || typeof bindings !== "object") return null;
    return { bindings, sha256: manifest?.source?.sha256 ?? null };
  } catch {
    return null;
  }
}

function main(argv) {
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    console.error(String(error.message));
    return 2;
  }
  const file = options.file ?? DEFAULT_SWF;
  if (!fs.existsSync(file)) {
    console.error(`No such file: ${file}`);
    console.error("Pass the path to YOUR OWN Swords & Sandals II install's .swf.");
    return 2;
  }

  // Opened for READING. The installed build is the measurement oracle.
  const buffer = fs.readFileSync(file);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  let result;
  try {
    result = extractFigure(buffer, { clip: options.clip });
  } catch (error) {
    console.error(String(error.message));
    return 1;
  }

  const shapeIds = Object.keys(result.shapes);
  const animationKeys = Object.keys(result.animations);
  const poseCount = animationKeys.reduce((total, key) => total + result.animations[key].poses.length, 0);

  // Counted here rather than beside the manifest, because `--report` returns
  // before the manifest is built and USED TO SAY NOTHING ABOUT APPROXIMATIONS
  // AT ALL — a measuring mode that reported the picture and not the invoice.
  // It walks the PATHS, not the per-shape counters: see `approximationTally`
  // for the 290 baked morph entries that made those two readings differ.
  const tally = approximationTally(result.shapes);

  console.log(`build      ${file}`);
  console.log(`sha256     ${sha256}${sha256 === ORACLE_SHA256 ? "  (the oracle)" : "  ** NOT the oracle **"}`);
  console.log(`clip       ${result.clip}${result.clipName ? ` (${result.clipName})` : ""}, ${result.frameCount} frames`);
  console.log(`animations ${animationKeys.length} labels, ${poseCount} poses, ${result.placementCount} placements`);
  console.log(`shapes     ${shapeIds.length} distinct, ${result.failures.length} failed to parse`);
  console.log(
    `paths      ${tally.paths}, of which ${tally.total} are APPROXIMATED` +
    `${tally.total > 0 ? ` (${Object.entries(tally.byKind).map(([kind, count]) => `${count} ${kind}`).join(", ")})` : ""}`
  );
  if (result.morphCount > 0) {
    console.log(`morphs     ${result.morphCount} baked frames — the effects: blood, the charge guard, potions, the heart`);
  }
  if (result.colourTransformed.length > 0) {
    console.log(`tinted     ${result.colourTransformed.length} shapes carry a colour transform`);
  }
  // ► **THE ZERO AND THE LOSS ON THE SAME LINE.** `own 0` is the whole truth
  //   about this build only because `dropped 0` sits beside it: in the props
  //   pack the identical zero was an artefact of a skip that dropped every
  //   own-filtered placement before anything counted them. A reader must be
  //   able to tell "none exist" from "I dropped them before looking" without
  //   opening the manifest.
  const effects = result.effects;
  console.log(
    `effects    ${effects.inherited.groups} group${effects.inherited.groups === 1 ? "" : "s"} in the tables ` +
    `(${effects.inherited.distinctGroups} distinct), ${effects.inherited.filters} filters, ` +
    `over ${effects.inherited.placements} of ${effects.own.placements} placements`
  );
  console.log(
    `           own ${effects.own.filters} filters / ${effects.own.blendModePlacements} blend modes on ` +
    `${effects.own.filteredPlacements} placements; DROPPED ${effects.own.dropped.filters} filters and ` +
    `${effects.own.dropped.inheritedGroups} inherited groups with ${effects.own.dropped.drawables} skipped drawables`
  );
  console.log(
    `           a renderer applies ${effects.use.filters.applied} of ${effects.use.filters.total}` +
    `${effects.use.filters.deferred > 0 ? `, defers ${effects.use.filters.deferred}` : ""}` +
    `${effects.use.filters.noOp > 0 ? `, ${effects.use.filters.noOp} draw nothing` : ""}` +
    `${effects.use.filters.refused > 0 ? `, REFUSES ${effects.use.filters.refused}` : ""}` +
    `${Object.keys(effects.use.filters.approximatedByKind).length > 0
      ? ` (${Object.entries(effects.use.filters.approximatedByKind).map(([kind, count]) => `${count} ${kind}`).join(", ")})`
      : ""}`
  );
  for (const [reason, count] of Object.entries(effects.use.filters.refusedByReason)) {
    console.log(`           REFUSED ${count} x ${reason}`);
  }
  const notCarried = Object.entries(effects.notCarried);
  console.log(
    `           notCarried ${notCarried.length === 0 ? "{}" : notCarried.map(([kind, count]) => `${count} ${kind}`).join(", ")}`
  );
  // ► **THE LINE ABOVE USED TO BE THE WHOLE STORY AND IT READ AS A CLEAN BILL
  //   OF HEALTH.** `DROPPED 0 filters ... 0 skipped drawables` is true of every
  //   branch in this file and says nothing about the frames the flatten never
  //   asked for. NAME the children rather than print a bare count: "24
  //   filtersBehindNestedFreeze" does not tell a reader that the 24 are the
  //   weapon enchantment, and that is the whole value of the number.
  for (const child of result.frozenNested?.byCharacter ?? []) {
    if (child.filtersBehindTheFreeze === 0) continue;
    console.log(
      `FROZEN     ${child.filtersBehindTheFreeze} filters on character ${child.character}` +
      `${child.name ? ` (${child.name})` : ""} sit on its frames 2..${child.frames}, which flattenFrame ` +
      `never resolves — see tools/extract-enchantments.mjs`
    );
  }
  for (const [kind, ids] of Object.entries(result.unsupported)) {
    console.log(`SKIPPED    ${ids.length} ${kind} characters this tool cannot turn into paths: ${ids.join(", ")}`);
  }
  for (const failure of result.failures) {
    console.log(`FAILED     shape ${failure.id}: ${failure.message}`);
  }
  if (sha256 !== ORACLE_SHA256) {
    console.log("");
    console.log("This is NOT the build this project's goldens cite. The manifest records");
    console.log("the hash actually read, so nothing extracted here may be presented as");
    console.log("evidence about the oracle.");
  }

  if (options.report) {
    console.log("\n--report: nothing written.");
    return 0;
  }

  try {
    assertWritableOutput(options.out, file);
  } catch (error) {
    console.error(String(error.message));
    return 2;
  }

  fs.mkdirSync(options.out, { recursive: true });

  // The viewBox is computed per animation and written with it, so a consumer
  // does not have to walk every pose to find out how big the figure is.
  const animations = {};
  for (const key of animationKeys) {
    const animation = result.animations[key];
    animations[key] = { ...animation, bounds: poseBounds(result.shapes, animation.poses) };
  }

  const sound = readSoundBindings(options.sound);
  if (sound) {
    const sounded = Object.keys(animations).filter((key) => (sound.bindings[key] ?? []).length > 0).length;
    console.log(`sound      ${sounded} of ${Object.keys(animations).length} animations carry sound, from ${path.relative(REPO_ROOT, options.sound)}`);
    if (sound.sha256 && sound.sha256 !== sha256) {
      console.log("SOUND MISMATCH: the audio was extracted from a DIFFERENT build than this figure.");
      console.log(`  figure ${sha256}`);
      console.log(`  sound  ${sound.sha256}`);
    }
  } else {
    console.log(`sound      none — run tools/extract-sounds.mjs to hear the preview`);
  }

  const manifest = {
    tool: "tools/extract-figure.mjs",
    generated: new Date().toISOString(),
    source: { path: file, sha256, isOracle: sha256 === ORACLE_SHA256, oracleSha256: ORACLE_SHA256 },
    clip: result.clip,
    clipName: result.clipName,
    frameCount: result.frameCount,
    counts: {
      animations: animationKeys.length,
      poses: poseCount,
      placements: result.placementCount,
      shapes: shapeIds.length,
      // The rule this whole run enforces, cashed out in the file a human reads:
      // an approximation that is not counted is indistinguishable from a
      // correct read. `shapeFailures` is what could not be PARSED; this is what
      // parsed and is drawn as something simpler than the build draws it.
      paths: tally.paths,
      approximated: tally.total,
      shapeFailures: result.failures.length
    },
    approximated: tally,
    // ► **RECOUNTED FROM THE ANIMATIONS ABOUT TO BE WRITTEN, not copied from
    //   `result.effects`.** `animations` here is `result.animations` with a
    //   `bounds` added per label, so the two must agree — and asserting that
    //   they do is what stops this becoming a counter kept beside the data.
    //   `test/extract-figure.test.js` pins the equality; recomputing here is
    //   what gives it something to pin.
    effects: effectTally(animations, result.effectLoss),
    sound: sound ? { path: path.relative(REPO_ROOT, options.sound), sha256: sound.sha256 } : null,
    unsupported: result.unsupported,
    colourTransformed: result.colourTransformed,
    failures: result.failures
  };

  const write = (name, data) => {
    const target = path.join(options.out, name);
    assertReplaceableFile(target, file);
    // `wx` on a fresh temporary file, then rename. `writeFileSync` on the
    // target directly would FOLLOW a symlink sitting there and truncate
    // whatever it points at — and the thing most worth not truncating on this
    // machine is the build being read three lines above.
    const temporary = `${target}.tmp-${process.pid}`;
    fs.writeFileSync(temporary, data, { flag: "wx" });
    fs.renameSync(temporary, target);
    return { target, bytes: Buffer.byteLength(data) };
  };

  let written;
  try {
    written = [
      write("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`),
      write("shapes.json", `${JSON.stringify(result.shapes)}\n`),
      write("animations.json", `${JSON.stringify(animations)}\n`),
      write("preview.html", previewHtml({
        clip: result.clip,
        clipName: result.clipName,
        shapes: result.shapes,
        animations,
        soundBindings: sound?.bindings ?? null,
        soundPath: sound ? path.relative(options.out, options.sound).split(path.sep).join("/") : null
      }))
    ];
  } catch (error) {
    // A refused target is a REPORT, not a stack trace: the thing it is most
    // likely protecting is the oracle, and a person reading a crash dump is
    // less likely to understand that than a person reading one sentence.
    console.error(String(error.message));
    return 2;
  }

  // THE ORACLE IS STILL THE ORACLE. Read-only is what this tool intends; this
  // is what it can prove, and it costs one re-read of a file already in cache.
  const after = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  if (after !== sha256) {
    console.error("");
    console.error(`THE BUILD CHANGED WHILE THIS RAN: ${sha256} -> ${after}`);
    console.error("Nothing in this tool writes to it, so something else did. Every golden,");
    console.error("observation record and capture manifest cites the old hash.");
    return 1;
  }

  console.log("");
  for (const entry of written) {
    console.log(`wrote ${path.relative(REPO_ROOT, entry.target)}  ${(entry.bytes / 1024).toFixed(1)} KB`);
  }
  console.log(`build unchanged: ${after}`);
  console.log("");
  console.log("LOOK AT IT — this extraction has no other check, and it now SOUNDS too.");
  console.log("`preview.html` is SELF-CONTAINED: open the file, no server needed.");
  console.log("");
  console.log(`  ${path.join(options.out, "preview.html")}`);
  console.log("");
  console.log("Nothing here is committed: `assets/` is gitignored and");
  console.log("test/asset-attestation.test.js fails if any of it is ever tracked.");
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main(process.argv.slice(2));
}
