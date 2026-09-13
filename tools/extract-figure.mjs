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
import {
  indexCharacters,
  resolveTimeline,
  flattenFrame,
  deriveAnimations,
  IDENTITY_COLOUR_TRANSFORM
} from "./swf-display-list.mjs";

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
        `Unknown flag ${JSON.stringify(value)}. Known: --out, --clip, --report.`
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
 * Everything the extraction needs, without writing a byte.
 *
 * Separated from `main` so the report path and the write path cannot disagree
 * about what was measured, and so a caller can measure a build it does not want
 * to extract.
 */
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

  for (const animation of animations) {
    const key = labelKey(animation.name);
    const poses = [];
    for (let frame = animation.firstFrame; frame <= animation.lastFrame; frame += 1) {
      const displayList = frames[frame - 1];
      if (!displayList) continue;
      const depthNames = buildDepthNames(displayList);
      const drawables = flattenFrame(buffer, characters, displayList, { cache });
      const pose = [];
      for (const drawable of drawables) {
        placementCount += 1;
        if (drawable.unsupported) {
          const tally = unsupported.get(drawable.unsupported) ?? new Set();
          tally.add(drawable.characterId);
          unsupported.set(drawable.unsupported, tally);
          continue;
        }
        shapeIds.add(drawable.characterId);
        const colour = packColour(drawable.colourTransform);
        if (colour) colourTransformed.add(drawable.characterId);
        const placement = {
          shape: drawable.characterId,
          limb: depthNames.get(drawable.path[0]) ?? null,
          depth: drawable.path,
          matrix: roundMatrix(drawable.matrix)
        };
        if (colour) placement.colour = colour;
        pose.push(placement);
      }
      poses.push(pose);
    }
    out[key] = {
      label: animation.name,
      firstFrame: animation.firstFrame,
      lastFrame: animation.lastFrame,
      poses
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
        approximated: paths.filter((entry) => entry.approximated).length,
        paths
      };
    } catch (error) {
      failures.push({ id, message: String(error.message) });
    }
  }

  return {
    clip,
    clipName: sprite.exportName ?? null,
    frameCount: sprite.frames,
    animations: out,
    shapes,
    failures,
    placementCount,
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
 * A page that plays the extracted rig.
 *
 * Deliberately dependency-free and deliberately dumb: it reads the two JSON
 * files this tool just wrote and draws them with `<svg>` transforms. If the
 * figure in here looks wrong, the extraction is wrong — there is no third thing
 * between them to blame.
 */
function previewHtml(clip, clipName) {
  return `<!doctype html>
<meta charset="utf-8">
<title>Extracted figure — clip ${clip}${clipName ? ` (${clipName})` : ""}</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font: 14px system-ui, sans-serif; background: #14161a; color: #e6e8ec; }
  header { padding: 12px 16px; border-bottom: 1px solid #2a2e36; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  select, button, input { font: inherit; background: #22262e; color: inherit; border: 1px solid #3a3f4a; border-radius: 6px; padding: 4px 8px; }
  main { display: grid; place-items: center; padding: 16px; }
  svg { background: #0e1013; border: 1px solid #2a2e36; border-radius: 8px; max-width: 100%; height: auto; }
  .meta { color: #9aa3b2; font-variant-numeric: tabular-nums; }
  .warn { color: #f0b429; }
</style>
<header>
  <label>Animation <select id="anim"></select></label>
  <button id="play">Pause</button>
  <label>fps <input id="fps" type="number" value="24" min="1" max="60" style="width:5em"></label>
  <span class="meta" id="meta"></span>
</header>
<main><svg id="stage" width="520" height="620" preserveAspectRatio="xMidYMid meet"></svg></main>
<script type="module">
const [shapes, animations] = await Promise.all([
  fetch("shapes.json").then((r) => r.json()),
  fetch("animations.json").then((r) => r.json())
]);
const stage = document.getElementById("stage");
const picker = document.getElementById("anim");
const meta = document.getElementById("meta");
const fpsInput = document.getElementById("fps");
const playButton = document.getElementById("play");
const keys = Object.keys(animations);
for (const key of keys) {
  const option = document.createElement("option");
  option.value = key;
  option.textContent = \`\${animations[key].label} (\${animations[key].poses.length}f)\`;
  picker.append(option);
}
const NS = "http://www.w3.org/2000/svg";
let current = keys.includes("standing") ? "standing" : keys[0];
let frame = 0;
let playing = true;
let last = 0;

function draw() {
  const animation = animations[current];
  const pose = animation.poses[frame % animation.poses.length] ?? [];
  const box = animation.bounds;
  stage.setAttribute("viewBox", \`\${box.xMin} \${box.yMin} \${box.xMax - box.xMin} \${box.yMax - box.yMin}\`);
  stage.replaceChildren();
  for (const placement of pose) {
    const shape = shapes[placement.shape];
    if (!shape) continue;
    const [a, b, c, d, tx, ty] = placement.matrix;
    const group = document.createElementNS(NS, "g");
    group.setAttribute("transform", \`matrix(\${a} \${b} \${c} \${d} \${tx / 20} \${ty / 20})\`);
    if (placement.limb) group.dataset.limb = placement.limb;
    for (const entry of shape.paths) {
      const node = document.createElementNS(NS, "path");
      node.setAttribute("d", entry.d);
      node.setAttribute("fill", entry.fill);
      node.setAttribute("fill-opacity", String(entry.fillOpacity));
      if (entry.stroke) {
        node.setAttribute("stroke", entry.stroke);
        node.setAttribute("stroke-width", String(entry.strokeWidth));
      }
      group.append(node);
    }
    stage.append(group);
  }
  meta.textContent = \`frame \${(frame % animation.poses.length) + 1}/\${animation.poses.length} · clip frames \${animation.firstFrame}-\${animation.lastFrame} · \${pose.length} parts\`;
}

function tick(now) {
  const step = 1000 / Math.max(1, Number(fpsInput.value) || 24);
  if (playing && now - last >= step) {
    last = now;
    frame += 1;
    draw();
  }
  requestAnimationFrame(tick);
}

picker.value = current;
picker.addEventListener("change", () => { current = picker.value; frame = 0; draw(); });
playButton.addEventListener("click", () => {
  playing = !playing;
  playButton.textContent = playing ? "Pause" : "Play";
});
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

  console.log(`build      ${file}`);
  console.log(`sha256     ${sha256}${sha256 === ORACLE_SHA256 ? "  (the oracle)" : "  ** NOT the oracle **"}`);
  console.log(`clip       ${result.clip}${result.clipName ? ` (${result.clipName})` : ""}, ${result.frameCount} frames`);
  console.log(`animations ${animationKeys.length} labels, ${poseCount} poses, ${result.placementCount} placements`);
  console.log(`shapes     ${shapeIds.length} distinct, ${result.failures.length} failed to parse`);
  if (result.colourTransformed.length > 0) {
    console.log(`tinted     ${result.colourTransformed.length} shapes carry a colour transform`);
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
      shapeFailures: result.failures.length
    },
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
      write("preview.html", previewHtml(result.clip, result.clipName))
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
  const served = path.relative(REPO_ROOT, options.out).split(path.sep).join("/");
  console.log("");
  console.log("LOOK AT IT — this extraction has no other check. `preview.html` fetches the");
  console.log("JSON beside it, which a file:// page may not do, so it needs an origin:");
  console.log("");
  console.log("  node tools/arena-server.mjs");
  console.log(`  # then open http://127.0.0.1:8123/${served}/preview.html`);
  console.log("");
  console.log("Nothing here is committed: `assets/` is gitignored and");
  console.log("test/asset-attestation.test.js fails if any of it is ever tracked.");
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main(process.argv.slice(2));
}
