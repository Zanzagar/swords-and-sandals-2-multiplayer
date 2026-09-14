/**
 * THE COMBAT PROPS — the build's own arrow, its trail, its blood and its
 * sparks, out of the player's own install and into gitignored `assets/props/`.
 *
 * ## Why this is a third extractor rather than an option on one of the two
 *
 * `extract-figure.mjs` cuts a clip at its `FrameLabel` tags, because the
 * fighter's 2,222 frames are 101 NAMED animations and the name is the join with
 * everything else in this repository. `extract-wardrobe.mjs` takes frame 1 of
 * each of 387 exports, because a wardrobe piece is a static item.
 *
 * **A prop is neither, and the arrow proves it: `bullet` carries no
 * `FrameLabel` at all.** The build reaches its frames by number —
 * `bullet.gotoAndStop(game_attacker.secondary_weapon - 60)` (`+0x6dd4`) — so
 * frame N is not a moment in an animation, it is **a lookup keyed on which bow
 * loosed it**. `extract-figure.mjs` says so plainly when pointed at it: *"Clip
 * 47 carries no FrameLabel tags, so it has no named animations."* That is the
 * correct answer, and it is why this file exists rather than a `--frames` flag
 * that would have made the figure extractor mean two things.
 *
 * So: every frame of a named export, indexed by number, and the caller decides
 * what the number means.
 *
 * ## What was found by extracting it, and it is not what the map implies
 *
 * ► **THE BUILD HAS FIVE ARROWS FOR TWENTY BOWS.** `bullet` declares 50 frames;
 *   they resolve to exactly **five distinct shapes** — characters 42, 43, 44,
 *   45, 46 on frames 1-5 — and **every frame from 6 to 50 draws shape 46
 *   again**. The ranged band is ids 61-80 and the lookup is `id - 60`, so bows
 *   61-65 each have their own arrow and bows 66-80 all share one.
 *
 *   Nothing in the corpus said this. It reads from the `gotoAndStop` as though
 *   there were twenty arts, and there are five.
 *
 * ## The rule every extractor here obeys
 *
 * **Assets come out of the player's own install and never into the repository.**
 * `assets/` is gitignored AND `test/asset-attestation.test.js` fails if
 * anything under it is tracked — two lines of defence, because the ignore rule
 * alone has already failed once. Doom/WAD model: clone this repo and you still
 * need your own licensed copy.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { parseShape, shapeToPaths } from "./swf-shapes.mjs";
import { indexCharacters, resolveTimeline, flattenFrame } from "./swf-display-list.mjs";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The same default every other tool that reads the build uses. */
const DEFAULT_SWF =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";

/** The oracle's sha256. Recorded and REPORTED — never enforced. */
const ORACLE_SHA256 = "77cb545c2061ab41246251467a4edf5926ab6fd1ddd95dc9527d7ba9c45bb8ca";

const TWIPS_PER_PIXEL = 20;

/**
 * THE PROPS THIS TOOL TAKES, by the build's own linkage name.
 *
 * ► **A CLOSED LIST RATHER THAN A PATTERN, and that is the same decision
 *   `UNMAPPED_CLIP_LABELS` records.** The build exports 502 names; 387 are the
 *   wardrobe and ~60 more are UI, screens, spell effects and the AS2 runtime.
 *   A pattern that swept them all would extract a `saving_movie` and a
 *   `charsheet` nothing can use and call it coverage. Each entry here names
 *   what reads it, and an entry with no reader does not belong.
 */
export const PROP_EXPORTS = Object.freeze([
  {
    linkage: "bullet",
    /** `bullet.gotoAndStop(secondary_weapon - 60)` (`+0x6dd4`). */
    indexedBy: "secondary_weapon - 60",
    reader: "src/render/projectile.js — the arrow in flight"
  },
  {
    linkage: "bullet_trail",
    /** `trail.bullet.gotoAndStop(secondary_weapon - 60)` (`+0x7255`). */
    indexedBy: "secondary_weapon - 60",
    reader: "src/render/projectile.js — one puff every third frame"
  },
  {
    linkage: "blood",
    indexedBy: "frame, as an animation",
    reader: "unread today; the death morphs already carry the fighter's own blood"
  },
  {
    linkage: "sparks",
    indexedBy: "frame, as an animation",
    reader: "unread today"
  },
  {
    /**
     * ► **THE ARENA'S EDGES, and they are the only scenery the build attaches.**
     *   Root frame 221 puts one `rockMC` at each end of the ground:
     *
     *   ```text
     *     rockLeft._x  = -2160     rockRight._x = 2160
     *     both        ._y  =   210
     *     arena.gladiators is at (0, 0)
     *   ```
     *
     *   **They sit just outside the walk clamp.** `SS2_ARENA.clamp` is ±2100 —
     *   derived from `nextphase` step 1 long before anybody looked at the
     *   scenery — and the rocks are at ±2160, sixty units further out. So the
     *   build marks the edge of the ground a gladiator can reach with a rock at
     *   each end, and two independent derivations agree about where the arena
     *   stops.
     *
     *   `_y` 210 against the fighters' 200 puts them ten units NEARER the
     *   viewer, which is a depth cue rather than a mistake.
     */
    linkage: "rockMC",
    indexedBy: "frame 1; the build never advances it",
    reader: "tools/arena/main.js — the arena's two edges"
  },
  {
    /**
     * ► **THE ARENA SCREEN'S BACKDROP, and it is EXACTLY THE STAGE.** Root
     *   frame 221 places character 643 at depth 1, `(0, 0)`, unscaled, and it
     *   measures **640 x 420 px** — the SWF's declared `FrameSize` RECT, to the
     *   pixel. So this is the sky and ground the whole fight happens against.
     */
    character: 643,
    name: "backdrop",
    framesWanted: 1,
    indexedBy: "frame 1; it has only one",
    reader: "src/render/arena-backdrop.js — the stage-locked backdrop layer"
  },
  {
    /**
     * ► **CHARACTER 1729 IS THE `sky`, AND THIS ENTRY USED TO CALL IT THE
     *   CROWD.** Root frame 221 places it at depth 3 under the instance name
     *   `sky`, scaled 1.04 — the only scaled placement on the frame. The build
     *   names it three independent ways: the `PlaceObject2` name, `_root.sky`
     *   in `day_night_cycle` (root frame 35), and its own child sprite
     *   `cloud_patterns` (char 1690). **The real crowd is character 2112**,
     *   which is a different clip in a different coordinate space.
     *
     * ► **AND ITS 200 FRAMES ARE A LOOKUP, NOT AN ANIMATION** — the same shape
     *   as `bullet`'s. `_root.sky.gotoAndStop(time_of_day)` (`+0x0d33`), and
     *   `_root.sky.cacheAsBitmap = true` immediately after, which a clip that
     *   played could not be. The old entry said "frame 1 of 200; the rest is
     *   its animation" and was wrong on both halves.
     *
     * ► **AND `time_of_day` IS A CLOCK, NOT A DIE ROLL — I HAD THAT WRONG
     *   TOO.** `_global.time_of_day = 1 + random(23)` is only where it STARTS.
     *   `day_night_cycle` runs on a 1500ms `setInterval` (`+0x0a9d`) and, while
     *   a battle is on, does `if (time_of_day < 200 && special_event_happening
     *   != true) { time_of_day++; townsquare.gotoAndStop(time_of_day);
     *   sky.gotoAndStop(time_of_day); }` (`+0x0bd0`..`+0x0c44`). A new day
     *   resets it to 25 (`+0x0a50`). **So the whole 1..200 range is reachable,
     *   and the sky moves while you fight.**
     *
     *   That matters because it nearly cost the masks: I had read the bound as
     *   1..23, noticed every masked frame was 112..200, and was one sentence
     *   from recording "the masks are unreachable, so this is not a defect."
     *   **Frames 112-200 are the night**, and dropping their masks dropped the
     *   moon's glow on 89 of 200 frames.
     */
    character: 1729,
    name: "sky",
    indexedBy: "time_of_day, a CLOCK that starts at 1 + random(23) and climbs to 200",
    reader: "src/render/arena-backdrop.js — the stage-locked sky layer"
  },
  {
    /**
     * ► **THE GROUND, and it is INSIDE the arena clip** — sprite 2249 depth 1,
     *   instance `sand`, at arena-local `(-323.95, -56.75)`. Its own art spans
     *   local y -56.75..256.2, which is the range that decides how far back a
     *   rank may stand before it is off the painted sand.
     *
     * ► **SIX FRAMES, ONE PER ARENA.** `sand.gotoAndStop(current_arena)`
     *   (`+0x0d0f`). So the game has six grounds, not one, and taking frame 1
     *   would ship a sixth of what was measured.
     */
    character: 673,
    name: "sand",
    indexedBy: "current_arena, 1..6",
    reader: "src/render/arena-backdrop.js — the ground, in the arena's own space"
  },
  {
    /**
     * ► **THE ACTUAL CROWD: character 2112**, sprite 2249 depth 3, instance
     *   `crowd`, at arena-local `(1.05, -110.50)`. Eight tiled stands (char
     *   1774 at half scale) and three animated crowd blocks (char 2098).
     *
     * ► **`crowd.gotoAndStop(current_arena)`** (`+0x0c99`) — six again, and the
     *   same index as the sand, so a renderer picks one arena and both agree.
     *
     * ► **IT IS THE ONE PIECE OF SCENERY THE CAMERA MOVES**: `combatscale` ends
     *   `crowd._y = -200 + ceil(zoomscale)` (`+0x0ab1`), so the stands rise as
     *   the camera pulls back.
     */
    character: 2112,
    name: "crowd",
    indexedBy: "current_arena, 1..6",
    reader: "src/render/arena-backdrop.js — the stands, and the build's one parallax"
  },
  {
    /**
     * ► **THE WEATHER, AND ITS FIRST NINE FRAMES ARE EMPTY.** Root frame 221
     *   depth 80, instance `rain`. Frames 1-9 place nothing at all; 10-17 carry
     *   characters 1812-1815. **A `framesWanted: 1` entry here would emit an
     *   empty prop and look like a failed read** — which is exactly what the
     *   first version of the arena-screen table assumed it was.
     */
    character: 1816,
    name: "rain",
    indexedBy: "frame; 1-9 are empty and 10-17 carry the weather",
    reader: "src/render/arena-backdrop.js — the stage-locked weather layer"
  },
  {
    /**
     * ► **THE BOTTOM UI BAR**, root frame 221 depth 438, instance
     *   `fiz_info_panel`, 641 x 26.55 px at `(-0.5, 401)` — so it hangs five
     *   pixels below the stage. It carries two `DefineEditText` children, which
     *   are REPORTED as unsupported rather than dropped; this renderer draws
     *   its own text over the bar.
     */
    character: 1531,
    name: "panel",
    framesWanted: 1,
    indexedBy: "frame 1",
    reader: "src/render/arena-backdrop.js — the UI bar, painted over the fighters"
  },
  {
    /**
     * ► **THE ORNAMENTAL FRAME**, root frame 221 depth 1193 — the highest depth
     *   on the screen, so it paints over everything including the arrows. 732 x
     *   505 px at `(-25.55, -33)`: larger than the 640 x 420 stage on every
     *   side, which is what lets it frame the picture rather than sit inside it.
     */
    character: 646,
    name: "border",
    framesWanted: 1,
    indexedBy: "frame 1",
    reader: "src/render/arena-backdrop.js — the frame, painted last"
  }
]);

/**
 * ► **CHARACTER 2249, THE ARENA CLIP, IS DELIBERATELY NOT DECLARED, AND IT
 *   USED TO BE.** Taking it whole gave one FUSED frame: the sand and the crowd
 *   flattened into nine placements with no way to tell them apart, plus the
 *   `about_fight_mov` text field that showed up as this tool's only failure.
 *   That is strictly worse than taking `sand` and `crowd` separately, because
 *   **the camera moves one of them and not the other** — `crowd._y` tracks the
 *   zoom and the sand does not — and a fused blob cannot express that. It also
 *   lost the six arenas, since the fused frame 1 is arena 1 of 6.
 *
 *   The arena clip's other 333 frames are `combat_won`, `combat_lost`,
 *   `combat_exp` and the intro — bout STATES, a different asset and a different
 *   question from the ground a fight happens on.
 */

export class ExtractPropsError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

export function parseArguments(argv) {
  const options = { file: null, out: path.join(REPO_ROOT, "assets", "props"), report: false };
  const rest = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") {
      const next = argv[index + 1];
      if (typeof next !== "string" || next.startsWith("--")) {
        throw new ExtractPropsError("--out needs a directory path.");
      }
      options.out = next;
      index += 1;
    } else if (value === "--report") {
      options.report = true;
    } else if (value.startsWith("--")) {
      throw new ExtractPropsError(`Unknown option ${value}.`);
    } else {
      rest.push(value);
    }
  }
  options.file = rest[0] ?? DEFAULT_SWF;
  return options;
}

const px = (twips) => Math.round((twips / TWIPS_PER_PIXEL) * 100) / 100;

/**
 * The same rounding `extract-wardrobe.mjs` uses, and deliberately the same
 * numbers: a matrix is `{a, b, c, d, tx, ty}` from the display list and reaches
 * JSON as a six-element array, scale terms to 5 places and translations to 1.
 * Duplicated rather than imported so this file stays
 * runnable on its own, which is the convention every tool here follows.
 *
 * ► **THE TRANSLATIONS ARE TWIPS AND THIS COMMENT USED TO SAY THEY WERE
 *   PIXELS.** `readMatrix` leaves `tx`/`ty` in twips and `composeMatrix` keeps
 *   them there, deliberately, because composing in twips is exact; only the
 *   path data and the bounds go through `px()`. A consumer must divide by 20.
 *   Latent until now because every prop declared here had an identity matrix
 *   with a zero translation — the arena screen is the first with real offsets.
 *
 * ► **`-0` IS NORMALISED TO `0`.** It round-trips through JSON as `-0` and
 *   compares unequal under `Object.is`, which is how a byte-identical
 *   re-extraction can look like a changed one.
 */
function roundMatrix(matrix) {
  const r = (value, places) => {
    const factor = 10 ** places;
    const rounded = Math.round(value * factor) / factor;
    return Object.is(rounded, -0) ? 0 : rounded;
  };
  return [r(matrix.a, 5), r(matrix.b, 5), r(matrix.c, 5), r(matrix.d, 5), r(matrix.tx, 1), r(matrix.ty, 1)];
}

/**
 * Every frame of every declared prop, plus the shapes they reach.
 *
 * **Frames are 1-BASED, matching the build's own `gotoAndStop`.** A zero-based
 * array here would put an off-by-one between this data and every offset in the
 * map that indexes it, which is the kind of seam that goes wrong silently.
 */
export function extractProps(buffer) {
  const { characters, names } = indexCharacters(buffer);
  const byName = new Map([...names].map(([id, name]) => [name, id]));

  const props = {};
  const shapeIds = new Set();
  const failures = [];
  const cache = new Map();

  for (const declared of PROP_EXPORTS) {
    // ► **BY NAME WHERE THE BUILD EXPORTS ONE, BY CHARACTER ID WHERE IT DOES
    //   NOT.** Every wardrobe piece and every prop above is in `ExportAssets`;
    //   the arena is not — it is a named INSTANCE on a root frame, which is a
    //   different thing. An entry states which it is and this loop does not
    //   guess: a `character` with no matching id fails loudly rather than
    //   silently extracting nothing.
    const key = declared.linkage ?? declared.name;
    const id = declared.character ?? byName.get(declared.linkage);
    if (id === undefined) {
      failures.push({ linkage: key, message: "no export of that name in this build" });
      continue;
    }
    const character = characters.get(id);
    if (!character || character.kind !== "sprite") {
      failures.push({ linkage: key, id, message: `is a ${character?.kind ?? "nothing"}, not a sprite` });
      continue;
    }
    // **Frame 1 only when the entry says so** — the arena's other 333 frames
    // are `combatwon`, `combatlost` and the intro, which is a different asset
    // and a different question from the ground a fight happens on.
    const frameCount = declared.framesWanted === 1 ? 1 : character.frames;
    const wanted = Array.from({ length: frameCount }, (unused, index) => index + 1);
    let resolved;
    try {
      resolved = resolveTimeline(buffer, character, { frames: wanted });
    } catch (error) {
      failures.push({ linkage: key, id, message: String(error.message).slice(0, 120) });
      continue;
    }

    const frames = [];
    for (let index = 0; index < frameCount; index += 1) {
      const displayList = resolved.frames[index];
      if (!displayList) { frames.push([]); continue; }
      let drawables;
      try {
        // ► **CLIP PATHS ARE ASKED FOR HERE AND NOWHERE ELSE.** The sky's night
        //   frames put a shape mask over the moon's glow, and without this the
        //   extraction reported 178 failures and dropped both halves — a moon
        //   with no glow on 89 of 200 frames. The flag is opt-in precisely so
        //   that the figure and wardrobe extractions, which are pinned by tests
        //   and by a preview the owner has looked at, do not silently gain
        //   geometry they never had.
        drawables = flattenFrame(buffer, characters, displayList, { cache, resolveMasks: true });
      } catch (error) {
        failures.push({ linkage: key, id, message: `frame ${index + 1}: ${String(error.message).slice(0, 90)}` });
        frames.push([]);
        continue;
      }
      // THE MASKS ON THIS FRAME, by their own path — so a masked placement can
      // name its cutter without depth alone having to be unique across nesting.
      const masks = new Map();
      for (const drawable of drawables) {
        if (drawable.isMask && !drawable.unsupported) masks.set(drawable.path.join("/"), drawable);
      }

      const placements = [];
      for (const drawable of drawables) {
        // A MASK IS A CUTTER, NOT A DRAWING. Painting it would put the stencil
        // on the canvas instead of the thing it cuts, so it is carried on the
        // placements it clips and never emitted as one of its own.
        if (drawable.isMask) {
          if (drawable.unsupported) {
            failures.push({
              linkage: key, id,
              message: `frame ${index + 1} carries ${drawable.unsupported} (character ${drawable.characterId})`
            });
          }
          continue;
        }
        // An unsupported drawable is REPORTED and skipped, never silently
        // dropped — the three combat icons are mostly `DefineEditText`, which
        // is why they are not in `PROP_EXPORTS` at all.
        if (drawable.unsupported) {
          failures.push({
            linkage: key, id,
            message: `frame ${index + 1} carries ${drawable.unsupported} (character ${drawable.characterId})`
          });
          continue;
        }
        const cutter = drawable.maskPath ? masks.get(drawable.maskPath.join("/")) : null;
        if (cutter) shapeIds.add(cutter.characterId);
        shapeIds.add(drawable.characterId);
        placements.push({
          shape: drawable.characterId,
          matrix: roundMatrix(drawable.matrix),
          ...(drawable.colourTransform ? { colour: drawable.colourTransform } : {}),
          // The clip travels WITH the thing it clips rather than as a sibling,
          // because a renderer has to set it before the fill and clear it after,
          // and a list of cutters somewhere else is an invitation to forget.
          ...(cutter ? { clip: { shape: cutter.characterId, matrix: roundMatrix(cutter.matrix) } } : {})
        });
      }
      frames.push(placements);
    }

    // ► **THE DISTINCT-CONTENT TALLY IS THE POINT OF THE REPORT, not a
    //   statistic.** It is what found that `bullet`'s fifty frames are five
    //   arrows: a lookup clip whose frames mostly repeat is telling you the
    //   index has fewer meanings than it has slots.
    const signatures = frames.map((placements) => placements.map((p) => p.shape).sort().join(","));
    props[key] = {
      linkage: key,
      character: id,
      frameCount,
      declaredFrames: character.frames,
      indexedBy: declared.indexedBy,
      reader: declared.reader,
      distinctFrames: new Set(signatures.filter((s) => s.length > 0)).size,
      frames
    };
  }

  const shapes = {};
  for (const id of [...shapeIds].sort((left, right) => left - right)) {
    const character = characters.get(id);
    try {
      const shape = parseShape(buffer, character.bodyStart, character.bodyEnd, character.tagCode);
      shapes[id] = {
        bounds: {
          xMin: px(shape.bounds.xMin), xMax: px(shape.bounds.xMax),
          yMin: px(shape.bounds.yMin), yMax: px(shape.bounds.yMax)
        },
        paths: shapeToPaths(shape)
      };
    } catch (error) {
      failures.push({ linkage: `shape ${id}`, id, message: String(error.message).slice(0, 120) });
    }
  }

  return { props, shapes, failures };
}

function main(argv) {
  const options = parseArguments(argv);
  if (!fs.existsSync(options.file)) {
    throw new ExtractPropsError(
      `No SWF at ${options.file}. Pass the path to YOUR OWN installed copy; this repository ships none.`
    );
  }
  const buffer = fs.readFileSync(options.file);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  if (sha256 !== ORACLE_SHA256) {
    process.stdout.write(
      `NOTE: this build is ${sha256.slice(0, 16)}…, not the oracle ${ORACLE_SHA256.slice(0, 16)}…\n` +
      "      That is legitimate; what is not is treating the output as evidence about the oracle.\n"
    );
  }

  const { props, shapes, failures } = extractProps(buffer);

  fs.mkdirSync(options.out, { recursive: true });
  const payload = JSON.stringify({ props, shapes }, null, 1);
  fs.writeFileSync(path.join(options.out, "props.json"), payload);
  fs.writeFileSync(path.join(options.out, "manifest.json"), JSON.stringify({
    source: path.basename(options.file),
    sha256,
    extractedFrom: "ExportAssets linkage names; frames are 1-based, as gotoAndStop indexes them",
    props: Object.fromEntries(Object.entries(props).map(([name, prop]) => [name, {
      character: prop.character,
      frameCount: prop.frameCount,
      distinctFrames: prop.distinctFrames,
      indexedBy: prop.indexedBy,
      reader: prop.reader
    }])),
    shapeCount: Object.keys(shapes).length,
    failures
  }, null, 1));

  const lines = [`props -> ${options.out}`];
  for (const prop of Object.values(props)) {
    lines.push(
      `  ${prop.linkage.padEnd(13)} char ${String(prop.character).padStart(4)}  ` +
      `${String(prop.frameCount).padStart(3)} frames, ${prop.distinctFrames} distinct  (${prop.indexedBy})`
    );
  }
  lines.push(`  ${Object.keys(shapes).length} shapes, ${failures.length} failures`);
  if (options.report) for (const failure of failures.slice(0, 20)) lines.push(`    ! ${failure.linkage}: ${failure.message}`);
  process.stdout.write(`${lines.join("\n")}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
