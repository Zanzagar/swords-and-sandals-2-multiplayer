/**
 * Extract the GLADIATOR'S WARDROBE from YOUR OWN Swords & Sandals II install.
 *
 * Stage 4 of asset extraction, and the one that makes the extracted gladiator
 * stop being naked. `tools/extract-figure.mjs` gets the RIG — eleven body
 * shapes and 2,222 frames of matrices. This gets everything the build hangs on
 * it: armour, weapons, shields, hair, facial hair and features.
 *
 * ## How the build dresses a gladiator, derived from the bytes
 *
 * The mechanism is NOT in the fighter clip. Clip 1241's 236 `DoAction` tags do
 * only three things — a blood/sparks particle emitter, facial expressions on
 * `head.eyes`/`head.mouth`, and `stop()`/`struck`/`fired` flags — and contain
 * the string `shield` zero times.
 *
 * It lives at the ROOT, in the `DoAction` at **`0x40bf76`** (tag code 12,
 * 11,225 bytes, body `0x40bf7c`), whose single 149-entry `ActionConstantPool`
 * carries the whole vocabulary:
 *
 * ```text
 *   skincolor  haircolor  features  hairstyle  facehairstyle
 *   shoulderguard  gauntlet  breastplate  helmet  greaves  shinguard  boot  shield
 *   weapon  realweapon  equipped_weapon  secondary_weapon
 *   head  torso  Lupperarm  Rupperarm  Llowerarm  Rlowerarm
 *                 Lupperleg  Rupperleg  Llowerleg  Rlowerleg
 *   head.bareskin  torso.bareskin  Lupperarm.bareskin  ...  (one per limb)
 *   attachMovie  head.hair  head.facehair  Color  charColorTransform  colorhero
 * ```
 *
 * So: **`attachMovie` onto a NAMED LIMB, and `Color` onto that limb's
 * `bareskin` child.** Which is why the base body art is a grey canvas — it is
 * tinted at runtime, and `skincolor`/`haircolor` are the inputs.
 *
 * ► **AND IT EXPLAINS THE EMPTY `shield` SPRITE.** Sprite 704 sits at depth 35
 *   named `shield` and holds nothing, which read as a placeholder nobody
 *   filled. It is not the shield's home: the shield is attached to the
 *   RIGHT FOREARM clip, not to depth 35. An empty sprite is what a slot looks
 *   like when you are looking at the wrong slot.
 *
 * ## The linkage table IS the catalogue, and it is a clean one
 *
 * Every attachable piece is exported as `<slot><id>`, so the item row's own ID
 * is the linkage-name suffix. Measured over all 502 exported symbols:
 *
 * ```text
 *   weapon         89 symbols   ids 0..220      shield         25   ids 0..25
 *   helmet         40 symbols   ids 1..120      facehair       24   ids 1..24
 *   hair           40 symbols   ids 1..40       features       19   ids 1..24
 *   boot / shinguard / breastplate / shoulderguard / greaves / gauntlet
 *                  25 symbols each, ids 2..26
 * ```
 *
 * **89 weapon symbols against the item tables' ~90 weapon rows** is the join:
 * the tables were never missing an art column, because the ID was the art
 * column all along.
 *
 * ## WHERE EACH PIECE GOES, decoded from the same function
 *
 * `updatecharacter(whichcharacter, whichavatar)` makes 20 `attachMovie` calls.
 * Disassembled from the action records at `0x40bf7c` — AS2 pushes arguments in
 * REVERSE, so each call reads `Push <depth>, <instance>, <linkage>, <argc>,
 * <scope>, <limb>; GetMember; Push "attachMovie"; CallMethod`:
 *
 * ```text
 *   target limb    instance       depth  linkage
 *   head           features         4    "features"      + char.features
 *   head           facehair         3    "facehair"      + char.facehairstyle
 *   head           hair             5    "hair"          + char.hairstyle
 *   head           helmet           5    "helmet"        + char.helmet
 *   torso          breastplate      1    "breastplate"   + char.breastplate
 *   Lupperarm      shoulderguard    1    "shoulderguard" + char.shoulderguard
 *   Rupperarm      shoulderguard    1    "shoulderguard" + char.shoulderguard
 *   Llowerarm      gauntlet         1    "gauntlet"      + char.gauntlet
 *   Rlowerarm      gauntlet         2    "gauntlet"      + char.gauntlet
 *   Lupperleg      greaves          1    "greaves"       + char.greaves
 *   Rupperleg      greaves          1    "greaves"       + char.greaves
 *   Llowerleg      shinguard        1    "shinguard"     + char.shinguard
 *   Rlowerleg      shinguard        1    "shinguard"     + char.shinguard
 *   Lfoot          boot             1    "boot"          + char.boot
 *   Rfoot          boot             1    "boot"          + char.boot
 *   Rlowerarm      shield           3    "shield"        + char.shield
 *   (head)         eyes             1    "eyes1"
 *   (head)         mouth            2    "mouth1"
 * ```
 *
 * ► **`helmet` AND `hair` SHARE DEPTH 5, so a helmet REPLACES the hair.** That
 *   is a game rule falling straight out of the byte layout, not a decision
 *   anyone here has to make — and it is the kind of thing a renderer that
 *   invented its own paint order would get wrong while looking plausible.
 *
 * ► **AND `eyes`/`mouth` ARE ATTACHED TOO, at depths 1 and 2 of the head**,
 *   which is what the 118 `head.eyes.gotoAndPlay` and 106
 *   `head.mouth.gotoAndPlay` calls inside clip 1241 are driving. The face is
 *   not painted into the head shape; it is a pair of attached clips with their
 *   own timelines, and the fighter clip animates the EXPRESSION.
 *
 * ## WHAT IS NOT HERE: the weapon ENCHANTMENT, and where the search stopped
 *
 * `weapon0` is character 703 — the rig's own weapon slot — and it is the ONLY
 * weapon symbol carrying enchantment labels: **13 frames, `flame` at 2, `frost`
 * at 5, `poison` at 8, `wraith` at 11, with an unlabelled frame 1 and a frame-1
 * `stop()`.** The other twenty multi-frame weapons have 2 frames and no labels
 * at all.
 *
 * The resources exist too — `weapon_enchantment_type` and
 * `weapon_enchantment_potency`, both defaulting to 0 — and the shop writes
 * `type = 1` on EVERY weapon purchase, which is why the obvious mapping
 * (`1 = flame`) cannot be right: it would set every bought weapon alight.
 *
 * ► **AND `updatecharacter` DOES NOT SELECT THE FRAME.** Disassembled: it
 *   contains no `gotoAndStop` whatsoever, and every one of its eighteen
 *   references to the enchantment fields is a Push copying them into or out of
 *   `characterDNA`. **So the selector is somewhere else and this session did not
 *   find it.** Everything is taken at frame 1, which is the unenchanted weapon
 *   and is correct until the selector is located.
 *
 * That is a gap in the search, not in the build. Whoever picks it up: the string
 * `flame` occurs in the file and the clip is 703; start from the other readers
 * of `weapon_enchantment_type` rather than from this routine.
 *
 * Usage:
 *   node tools/extract-wardrobe.mjs --report          # measure, write nothing
 *   node tools/extract-wardrobe.mjs                   # writes assets/figure/wardrobe.json
 *   node tools/extract-wardrobe.mjs "<path to .swf>"
 *
 * Node builtins only. READ-ONLY on the SWF, like every tool that touches it.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { parseShape, shapeToPaths } from "./swf-shapes.mjs";
import { indexCharacters, resolveTimeline, flattenFrame } from "./swf-display-list.mjs";
import { assertReplaceableFile, assertWritableOutput } from "./extract-figure.mjs";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

const DEFAULT_SWF =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";

const ORACLE_SHA256 = "77cb545c2061ab41246251467a4edf5926ab6fd1ddd95dc9527d7ba9c45bb8ca";

const TWIPS_PER_PIXEL = 20;

/**
 * The slot names the build's own dressing code uses, read out of the constant
 * pool at `0x40bf7c` rather than chosen here.
 *
 * ► **`weapon` is in this list and `realweapon` is not.** Both are pool
 *   entries, but only `weapon` has exported symbols behind it; `realweapon`
 *   names a variable in that function, not a linkage family. The difference is
 *   measurable — it is why this list is derived from the EXPORT TABLE and only
 *   cross-checked against the pool.
 */
export const WARDROBE_SLOTS = Object.freeze([
  "helmet", "breastplate", "shoulderguard", "gauntlet",
  "greaves", "shinguard", "boot", "shield",
  "weapon", "hair", "facehair", "features"
]);

export class WardrobeError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

export function parseArguments(argv) {
  const options = { file: null, out: path.join(REPO_ROOT, "assets", "figure"), report: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") {
      const next = argv[index + 1];
      if (typeof next !== "string" || next.startsWith("--")) throw new WardrobeError("--out needs a directory path.");
      options.out = path.resolve(next);
      index += 1;
    } else if (value === "--report") {
      options.report = true;
    } else if (value.startsWith("--")) {
      throw new WardrobeError(`Unknown flag ${JSON.stringify(value)}. Known: --out, --report.`);
    } else if (options.file === null) {
      options.file = value;
    } else {
      throw new WardrobeError(`Unexpected argument ${JSON.stringify(value)}.`);
    }
  }
  return options;
}

/**
 * Split an exported linkage name into its slot and id.
 *
 * ► **Anchored and case-sensitive on the slot, because the suffix is what
 *   carries the meaning.** `helmet12` is helmet 12; `helmetx` is not a helmet
 *   at all and must not be read as one. Returns null rather than guessing.
 */
export function splitLinkageName(name) {
  if (typeof name !== "string") return null;
  const match = /^([a-z]+)(\d+)$/.exec(name);
  if (!match) return null;
  if (!WARDROBE_SLOTS.includes(match[1])) return null;
  return { slot: match[1], id: Number(match[2]) };
}

/** Twips in, pixels out, at the precision the path data already uses. */
const px = (twips) => Math.round((twips / TWIPS_PER_PIXEL) * 100) / 100;

function roundMatrix(matrix) {
  const r = (value, places) => {
    const factor = 10 ** places;
    const rounded = Math.round(value * factor) / factor;
    return Object.is(rounded, -0) ? 0 : rounded;
  };
  return [r(matrix.a, 5), r(matrix.b, 5), r(matrix.c, 5), r(matrix.d, 5), r(matrix.tx, 1), r(matrix.ty, 1)];
}

/**
 * Every wardrobe piece the build exports, resolved to shapes and placements.
 *
 * A piece is a SPRITE, so it is resolved through the same display list the
 * fighter's own limbs go through — frame 1, which is where a piece with no
 * timeline of its own sits and where `attachMovie` leaves it.
 */
/**
 * HOW MANY REGIONS THIS EXTRACTION COULD NOT READ EXACTLY, BY KIND.
 *
 * ► **`failures` IS NOT THIS LIST, AND TREATING IT AS ONE LOST A HELMET.**
 *   `failures` holds what could not be PARSED. This holds what parsed and is
 *   DRAWN AS SOMETHING SIMPLER than the build draws it — a gradient flattened
 *   to one stop, a bitmap fill with no image. helmet116's plume is the case
 *   that proves the difference: it parsed perfectly, shipped in the pack, was
 *   reported as a success, and rendered at opacity zero.
 *
 *   **An approximation that is not counted is indistinguishable from a correct
 *   read**, and a count that is never printed is not a count.
 */
function tallyApproximations(shapes) {
  const byKind = {};
  let paths = 0;
  for (const shape of Object.values(shapes)) {
    for (const path of shape.paths ?? []) {
      paths += 1;
      if (path.approximated) byKind[path.approximated] = (byKind[path.approximated] ?? 0) + 1;
    }
  }
  const total = Object.values(byKind).reduce((sum, count) => sum + count, 0);
  return { paths, total, byKind };
}

export function extractWardrobe(buffer) {
  const { characters, names } = indexCharacters(buffer);

  const pieces = {};
  const shapeIds = new Set();
  const failures = [];
  const unsupported = new Map();
  const cache = new Map();
  let frames = 0;

  for (const [id, name] of names) {
    const split = splitLinkageName(name);
    if (!split) continue;
    const character = characters.get(id);
    if (!character) {
      failures.push({ name, id, message: "exported name points at no character" });
      continue;
    }
    if (character.kind !== "sprite") {
      failures.push({ name, id, message: `exported as a ${character.kind}, not a sprite` });
      continue;
    }
    let drawables;
    try {
      const resolved = resolveTimeline(buffer, character, { frames: [1] });
      const displayList = resolved.frames[0];
      if (!displayList) {
        failures.push({ name, id, message: "sprite has no frame 1" });
        continue;
      }
      drawables = flattenFrame(buffer, characters, displayList, { cache });
      if (character.frames > 1) frames += 1;
    } catch (error) {
      failures.push({ name, id, message: String(error.message).slice(0, 120) });
      continue;
    }

    const placements = [];
    for (const drawable of drawables) {
      if (drawable.unsupported) {
        const tally = unsupported.get(drawable.unsupported) ?? new Set();
        tally.add(drawable.characterId);
        unsupported.set(drawable.unsupported, tally);
        continue;
      }
      shapeIds.add(drawable.characterId);
      placements.push({ shape: drawable.characterId, matrix: roundMatrix(drawable.matrix) });
    }
    if (!pieces[split.slot]) pieces[split.slot] = {};
    pieces[split.slot][split.id] = { linkage: name, character: id, frames: character.frames, placements };
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
      failures.push({ name: `shape ${id}`, id, message: String(error.message).slice(0, 120) });
    }
  }

  return {
    pieces,
    shapes,
    failures,
    // ► **WHAT PARSED BUT IS DRAWN AS SOMETHING SIMPLER.** This list used not to
    //   exist, and its absence hid a real piece: helmet116's plume is a 4-stop
    //   radial whose FIRST stop is `#ffffff` at alpha 0, so the flat fallback
    //   drew an 1104-character path at opacity ZERO — shipped in the pack,
    //   reported as a success, and invisible. `failures` holds what could not be
    //   PARSED; this holds what could not be drawn EXACTLY, and conflating them
    //   is how an extraction reports zero while losing a helmet.
    approximated: tallyApproximations(shapes),
    multiFrame: frames,
    unsupported: Object.fromEntries(
      [...unsupported.entries()].map(([kind, ids]) => [kind, [...ids].sort((left, right) => left - right)])
    )
  };
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

  const buffer = fs.readFileSync(file);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  let result;
  try {
    result = extractWardrobe(buffer);
  } catch (error) {
    console.error(String(error.message));
    return 1;
  }

  console.log(`build      ${file}`);
  console.log(`sha256     ${sha256}${sha256 === ORACLE_SHA256 ? "  (the oracle)" : "  ** NOT the oracle **"}`);
  console.log("");
  let total = 0;
  for (const slot of WARDROBE_SLOTS) {
    const pieces = result.pieces[slot];
    if (!pieces) {
      console.log(`  ${slot.padEnd(16)} none`);
      continue;
    }
    const ids = Object.keys(pieces).map(Number).sort((a, b) => a - b);
    total += ids.length;
    const parts = ids.reduce((sum, id) => sum + pieces[id].placements.length, 0);
    // ► **`ids 1..24` READS AS A CONTIGUOUS RANGE AND IS A MIN AND A MAX.**
    //   `features` has 19 symbols between 1 and 24, and printing the endpoints
    //   alone made five absent ids look like an extraction failure for a
    //   session. They are simply not in the build: no `features2`, `3`, `4`,
    //   `5` or `21` is exported. Gaps are named now.
    //   A SPARSE id space is not a gap, though: `weapon` runs 0..220 with 89
    //   pieces and listing 131 absent numbers is noise. Only a nearly-complete
    //   range gets its holes named; a sparse one gets a count.
    const gaps = [];
    for (let id = ids[0]; id <= ids[ids.length - 1]; id += 1) if (!pieces[id]) gaps.push(id);
    const span = ids[ids.length - 1] - ids[0] + 1;
    const gapNote = gaps.length === 0
      ? ""
      : gaps.length <= 8
        ? `  MISSING ${gaps.join(",")}`
        : `  (sparse: ${gaps.length} of ${span} ids unused)`;
    console.log(`  ${slot.padEnd(16)} ${String(ids.length).padStart(3)} pieces  ids ${ids[0]}..${ids[ids.length - 1]}  ${parts} placement(s)${gapNote}`);
  }
  console.log("");
  console.log(`total      ${total} wardrobe pieces, ${Object.keys(result.shapes).length} distinct shapes`);
  if (result.multiFrame > 0) console.log(`           ${result.multiFrame} piece(s) have more than one frame — frame 1 was taken`);
  for (const [kind, ids] of Object.entries(result.unsupported)) {
    console.log(`SKIPPED    ${ids.length} ${kind} character(s) this tool cannot turn into paths`);
  }
  for (const failure of result.failures.slice(0, 10)) {
    console.log(`FAILED     ${failure.name}: ${failure.message}`);
  }
  if (result.failures.length > 10) console.log(`FAILED     ... and ${result.failures.length - 10} more`);

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

  const target = path.join(options.out, "wardrobe.json");
  const payload = `${JSON.stringify({
    tool: "tools/extract-wardrobe.mjs",
    generated: new Date().toISOString(),
    source: { path: file, sha256, isOracle: sha256 === ORACLE_SHA256 },
    slots: WARDROBE_SLOTS,
    counts: {
      pieces: total,
      shapes: Object.keys(result.shapes).length,
      paths: result.approximated.paths,
      approximated: result.approximated.total,
      failures: result.failures.length
    },
    approximated: result.approximated,
    pieces: result.pieces,
    shapes: result.shapes,
    unsupported: result.unsupported,
    failures: result.failures
  })}\n`;
  try {
    assertReplaceableFile(target, file);
    const temporary = `${target}.tmp-${process.pid}`;
    fs.writeFileSync(temporary, payload, { flag: "wx" });
    fs.renameSync(temporary, target);
  } catch (error) {
    console.error(String(error.message));
    return 2;
  }

  const after = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  if (after !== sha256) {
    console.error(`\nTHE BUILD CHANGED WHILE THIS RAN: ${sha256} -> ${after}`);
    return 1;
  }

  console.log("");
  console.log(`wrote ${path.relative(REPO_ROOT, target)}  ${(Buffer.byteLength(payload) / 1024).toFixed(1)} KB`);
  console.log(`build unchanged: ${after}`);
  console.log("");
  console.log("Nothing here is committed: `assets/` is gitignored and");
  console.log("test/asset-attestation.test.js fails if any of it is ever tracked.");
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main(process.argv.slice(2));
}
