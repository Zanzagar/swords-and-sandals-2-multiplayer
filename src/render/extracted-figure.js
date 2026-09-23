/**
 * The BUILD'S OWN gladiator, drawn — when the player has extracted it.
 *
 * Stage 3 of asset extraction, and it is deliberately the same shape as
 * `sound.js`: this module holds no art, takes the extracted pack as an
 * ARGUMENT, and returns null for everything when there is none. With no assets
 * the arena falls back to `figure.js`'s authored vector art, exactly as it
 * falls silent with no audio. **A fresh clone still needs its own licensed
 * copy, and nothing here changes that.**
 *
 * ## What the pack is
 *
 * `tools/extract-figure.mjs` writes it into the gitignored `assets/figure/`:
 *
 * - `shapes.json` — each of the fighter's 61 shapes ONCE, as closed SVG path
 *   data with its own bounds.
 * - `animations.json` — 101 labelled animations, each a list of POSES, each
 *   pose a list of limb placements: `{shape, limb, depth, matrix, colour}`,
 *   plus, since 2026-09-15, an `effectGroups` table per animation and an
 *   `effects` index per placement.
 * - `enchantments.json` — OPTIONAL, from a SECOND tool
 *   (`tools/extract-enchantments.mjs`): the twelve-cell weapon-glow ladder and
 *   the filter list on each of its thirteen frames.
 *
 * The fighter is a RIG — thirteen named depths, eleven shapes for the body, and
 * 2,222 frames of matrices moving them — so a pose is thirteen matrices and not
 * a picture. That is why this can be a pure function of the pack.
 *
 * ## Coordinates, which are the one genuinely fiddly part
 *
 * Three spaces meet here and two of them disagree about which way is up.
 *
 * - **Shape path data** is in PIXELS, y DOWN, in the shape's own space.
 * - **A placement matrix** is `[a, b, c, d, tx, ty]` with `tx`/`ty` in TWIPS
 *   (20 to the pixel), mapping shape space into the clip's space, y still DOWN.
 * - **Arena operations** are in arena units with the figure's feet at `(0, 0)`
 *   and **y UP**, which is the contract `painter.js` already emits under and
 *   the shell already consumes.
 *
 * So every placement is composed with one fixed transform — scale to the
 * arena's idea of a gladiator's height, flip y, and put the feet on the ground
 * — and the result is handed to the shell as a matrix it can apply directly.
 * Composing once here rather than per path is why a pose costs thirteen matrix
 * multiplies and not thirteen hundred.
 *
 * ► **THE DATUM IS THE `standing` ANIMATION AND IT MUST BE**, not whichever
 *   animation is playing. Scaling each animation to its own bounds would make
 *   the gladiator SHRINK when he crouches and GROW when he leaps, because a
 *   taller drawing would be squeezed into the same arena height. The reference
 *   is measured once per pack and every animation shares it.
 *
 * ## THE ENCLOSING GROUPS' FILTERS — carried since 2026-09-15
 *
 * A placement may sit inside a filtered SPRITE, and the pack says so: `effects`
 * holds indices, OUTERMOST FIRST, into its animation's own `effectGroups`.
 * **This module read none of it until that date** — the same shape of hole as
 * `colour` before it and the bitmap fill before that, and again with no count
 * saying so. Measured on `assets/figure/animations.json`:
 *
 * ```text
 *   37,077 placements    30 inside an effect group     (37,047 inside none)
 *       12 group-table entries, 10 of them distinct records
 *       24 filters on them: 24 GLOW, 0 blur, 0 colourMatrix, 0 blend modes
 *        0 placements carry their OWN filters or their OWN blend mode
 * ```
 *
 * ► **A FILTER ON A GROUP IS A FILTER OF THE COMPOSITE, so nothing is folded
 *   into a leaf here.** Flash rasterises the group and filters the result;
 *   stamping a blur onto each path blurs every path separately, which is a
 *   different picture that looks plausible. The blur/glow and the blend mode
 *   ride on the op as a frozen, INTERNED group record — `op.group` — for a
 *   painter that can composite to a buffer, exactly as `propOpsFor` hands them
 *   over. `src/render/props.js` ALSO folds colour matrices into its fills;
 *   **this module folds none and says so by name** (`colourMatricesDeferred`,
 *   `groupColourMatrixOps`), because 0 of these 24 filters is a matrix and a
 *   fold written for a case the build does not contain is the "zero focal
 *   gradients" mistake with different nouns.
 *
 * ► **EVERY ONE OF THE 30 IS ON A CLIP NOTHING DISPATCHES, AND THAT OUTRANKS
 *   THE FEATURE.** They sit on `psyche_up`, `psyche_up2`, `psyche_charging`
 *   and `psyche_charging2` — all four DECLARED UNPLAYED in `clip-labels.js`
 *   (`unbuiltSpells`, `continuations`) — so `animationFor` cannot reach one and
 *   a paint of any playable family emits ZERO group records today. The code
 *   below is correct and, for the BODY, currently unreachable; what makes it
 *   reachable is a psyche family, not a change here. The test file mounts
 *   `psyche_up2` under a reachable label so the real filter payloads are still
 *   measured, and pins the four labels' unplayed status so that building the
 *   family turns the suite red and forces this paragraph to be rewritten.
 *
 * ► **AND THE ONE TWEEN IS WHY THE PACK'S TABLE IS KEYED BY THE WHOLE RECORD.**
 *   `psyche_up2`'s nine poses carry nine DISTINCT glow payloads — the outer
 *   `#00ffff` glow sweeps blurX 22 -> 14.5 while its strength dips through
 *   0.9766 and climbs back. A table keyed by path would report one record and
 *   draw a frozen glow nine times. **"inner"/"outer" here is a BLUR-SIZE
 *   convention and NOT the SWF `inner` flag: all 48 glows in both packs have
 *   `inner: false`**, re-derived here, because reading it the other way inverts
 *   every one of them and `canvasFilterFor` would refuse them by name.
 *
 * ## THE WEAPON ENCHANTMENT — carried since 2026-09-15
 *
 * `itemglow(whichitem, enchant_type, enchant_potency)` is a twelve-arm ladder
 * of `gotoAndStop` over the glow shell the blade is attached INSIDE, and
 * `enchantments.json` carries it cell by cell. Three facts decide the code:
 *
 * - **The GLOW reads the equipped slot's OWN pair, and the PROC does not.** See
 *   `weaponEnchantmentFor`, which exists as a separate function from
 *   `activeEnchantment` in `src/golden/ss2-attack-candidate.js` for exactly
 *   that reason and says so at length.
 * - **Out of domain is a NO-OP, not frame 1.** There is no trailing default, so
 *   the clip keeps its current frame — which a stateless renderer expresses by
 *   adding nothing to the paint.
 * - **The glow encloses the ATTACHMENT, not the figure.** It sits on the
 *   placement of `realweapon` inside the shell, so a glow on the gladiator, or
 *   on the `weapon` limb's own rig art, is the wrong picture.
 *
 * ► **THE PACK IS OPTIONAL, AND A PACK WITHOUT IT DRAWS WHAT IT ALWAYS DREW.**
 *   `group` is spread LAST on every operation and only when there is one, so
 *   the bytes of an unenchanted paint — key order included — are unchanged.
 *   That is also **how a reader turns the whole effect off**: ignore the field.
 *   Pinned by `test/render-extracted-figure.test.js`, because the arena draws a
 *   gladiator on every frame and a regression here is the whole screen.
 */

import { clipLabelsFor, directionalLabel } from "./clip-labels.js";
import { clipSequenceFor, shortRunFramesFor } from "./clip-sequences.js";
import {
  applyColourTransform,
  applyColourTransformAlpha,
  blendModeFor,
  canvasFilterFor,
  glowAmplificationFor,
} from "./filters.js";

export class ExtractedFigureError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Twips to pixels, the SWF's own unit. */
const TWIPS_PER_PIXEL = 20;

/**
 * The arena height of a gladiator at `build.height` 1, matching `painter.js`'s
 * own `UNIT`. Duplicated as a NAMED constant rather than imported because the
 * two files answer to the same authored figure and a silent divergence would
 * show up as the extracted rig standing a different height from the drawn one.
 */
const UNIT = 150;

/** The animation every other one is measured against. */
const REFERENCE_LABEL = "standing";

/**
 * Validate and freeze an extracted pack.
 *
 * Throws rather than returning a broken pack: a renderer that silently drew
 * half a gladiator would be worse than one that fell back to authored art, and
 * the caller's fallback is one `catch` away.
 *
 * ► **THE ENCHANTMENTS PACK IS OPTIONAL AND IT THROWS FOR NOTHING**, which is
 *   the `wardrobe` contract and not a new one. `tools/extract-enchantments.mjs`
 *   is a SECOND tool over the same install; a player who ran the figure
 *   extractor and not that one must still get a gladiator, just one whose
 *   weapon does not glow. A pack without it emits operations BYTE-IDENTICAL to
 *   what this module emitted before the argument existed — pinned in
 *   `test/render-extracted-figure.test.js`, because the arena draws a
 *   gladiator on every frame and a regression here is the whole screen.
 */
export function figurePackFrom(shapes, animations, enchantments = null) {
  if (!shapes || typeof shapes !== "object") {
    throw new ExtractedFigureError("A figure pack needs the `shapes.json` object.");
  }
  if (!animations || typeof animations !== "object") {
    throw new ExtractedFigureError("A figure pack needs the `animations.json` object.");
  }
  const reference = animations[REFERENCE_LABEL];
  if (!reference || !Array.isArray(reference.poses) || reference.poses.length === 0) {
    throw new ExtractedFigureError(
      `A figure pack needs a \`${REFERENCE_LABEL}\` animation with poses — it is the size datum ` +
      "every other animation is measured against."
    );
  }
  const bounds = reference.bounds;
  if (!bounds || !Number.isFinite(bounds.yMin) || !Number.isFinite(bounds.yMax)) {
    throw new ExtractedFigureError(`The \`${REFERENCE_LABEL}\` animation carries no usable bounds.`);
  }
  const clipHeight = bounds.yMax - bounds.yMin;
  if (!(clipHeight > 0)) {
    throw new ExtractedFigureError(`The \`${REFERENCE_LABEL}\` animation has no height, so nothing can be scaled to it.`);
  }
  return Object.freeze({
    shapes,
    animations,
    // The ground is the reference animation's LOWEST point — the soles of the
    // feet — so the figure stands on the arena floor rather than floating by
    // however much the clip's origin happens to be above it.
    groundY: bounds.yMax,
    centreX: (bounds.xMin + bounds.xMax) / 2,
    clipHeight,
    labels: Object.freeze(Object.keys(animations)),
    // The twelve-cell glow ladder and its art, or null. Normalised ONCE here
    // rather than per paint: `enchantmentLadderFrom` walks 12 cells and 13
    // frames, and a bout is thousands of them.
    enchantments: enchantmentLadderFrom(enchantments),
    // Per-animation drawability, computed on first use. A `Map` rather than a
    // field on the animation, because the pack is frozen and the JSON is the
    // player's, not ours to annotate.
    drawable: new Map(),
    // Per-label SEQUENCED animations, built on first use for the same reason
    // and cached for a much harder one: `isDrawable` keys its cache on the
    // animation OBJECT, so synthesising a fresh concatenation per frame would
    // miss that cache on every frame of every bout and re-walk thirteen
    // placements per pose. Built once, then it is an ordinary animation.
    sequenced: new Map()
  });
}

/**
 * How many ARENA UNITS one unit of the fighter clip's own space is worth.
 *
 * ► **EXPOSED BECAUSE THE BLOOD NEEDS IT AND GOT IT WRONG WITHOUT IT.** The
 *   build's `bounceitem` spawns drops by calling `attachMovie` on the FIGHTER
 *   CLIP — `register:1`, the clip itself, not the arena — so every number in
 *   that particle system is in the clip's own space. The extracted `standing`
 *   bounds say what that space is: `y` runs `-220.85` to `1.8`, so **the origin
 *   is the soles of the feet and the head is at -220**, which is exactly the
 *   band the drops spawn in (`-220 + RandomNumber(150)`) and exactly where the
 *   bounce triggers (`_y > 0`, the ground).
 *
 *   A surface that anchored those numbers in ARENA units would spray blood four
 *   hundred units into the sky. This is the same factor `paintExtractedFigure`
 *   already composes into every limb matrix, named once so the two cannot
 *   disagree.
 */
export function clipToArenaScale(pack, height = 1) {
  if (!hasExtractedArt(pack)) return null;
  return (UNIT * height) / pack.clipHeight;
}

/** Whether a pack is usable at all. Cheap, and the shell's fallback test. */
export function hasExtractedArt(pack) {
  return Boolean(pack && pack.animations && pack.shapes && pack.clipHeight > 0);
}

/**
 * Is every placement in this animation drawable — a six-number matrix and a
 * shape the pack actually holds?
 *
 * ► **A PARTIAL PACK USED TO DRAW A PARTIAL GLADIATOR, and a malformed one
 *   FROZE THE ARENA.** `paintExtractedFigure` skipped a placement whose shape
 *   was missing, so a pack short one shape returned 59 operations instead of
 *   65 — non-empty, so the caller never fell back, and the figure was drawn
 *   with a limb missing. And a placement with no `matrix` threw on the
 *   destructure, out of `render()`, which `frame()` calls BEFORE scheduling the
 *   next one: **the whole arena stops, permanently.**
 *
 *   That is the failure this repository already has a scar from — `cursor.js`
 *   exists because "the first spectated bout froze after one action inside a
 *   `requestAnimationFrame` callback the suite could not reach". Validating
 *   here turns both into the fallback that was always meant to happen.
 *
 * Checked ONCE per animation and cached on the pack: a pose is thirteen
 * placements and a bout is thousands of frames, so re-checking per frame would
 * be the one place this module could be accidentally slow.
 */
function isDrawable(pack, animation) {
  if (!animation || !Array.isArray(animation.poses) || animation.poses.length === 0) return false;
  const cached = pack.drawable.get(animation);
  if (cached !== undefined) return cached;
  let ok = true;
  outer: for (const pose of animation.poses) {
    if (!Array.isArray(pose)) { ok = false; break; }
    for (const placement of pose) {
      const matrix = placement?.matrix;
      if (!Array.isArray(matrix) || matrix.length < 6 || !matrix.every((value) => Number.isFinite(value))) {
        ok = false;
        break outer;
      }
      const shape = pack.shapes[placement.shape];
      if (!shape || !Array.isArray(shape.paths)) { ok = false; break outer; }
    }
  }
  pack.drawable.set(animation, ok);
  return ok;
}

/**
 * ONE ANIMATION OUT OF THE RUN THE BUILD ACTUALLY PLAYS, or null.
 *
 * Six of the fighter clip's labels run on past the clip that carries their
 * name — `psyche_up` into `psyche_charging`, `hurt8` into `hurt9`, `knockback`
 * into `knockback_mov`, `burning` around `flame_repeat` twice — because their
 * span carries no terminating action. `clip-sequences.js` reads that from the
 * build's own frame actions; this glues the members' poses into one animation
 * so every consumer downstream stays unchanged.
 *
 * ► **THE GROUP INDICES MUST BE REBASED AND THAT IS THE WHOLE DIFFICULTY.** A
 *   placement's `effects` holds indices into ITS OWN animation's
 *   `effectGroups`, so concatenating two tables without shifting the second
 *   animation's indices would give `psyche_charging`'s glow whichever of
 *   `psyche_up2`'s nine pulse frames sat at the same index — a wrong picture
 *   that draws perfectly happily. The placements are copied rather than
 *   mutated: the JSON is the player's.
 *
 * Returns null when a member is missing or undrawable, so a partial pack falls
 * back to the entry clip alone rather than to nothing.
 *
 * A label that runs on NOWHERE may still play LESS than its span — see
 * `shortRunAnimation` below, which answers for it through the same cache.
 */
function sequencedAnimation(pack, name) {
  if (pack.sequenced.has(name)) return pack.sequenced.get(name);
  const members = clipSequenceFor(name);
  let built = null;
  if (members.length > 1) {
    const parts = members.map((member) => pack.animations[member]);
    if (parts.every((animation) => isDrawable(pack, animation))) {
      const poses = [];
      const limbs = [];
      const effectGroups = [];
      for (const part of parts) {
        const offset = effectGroups.length;
        if (Array.isArray(part.effectGroups)) effectGroups.push(...part.effectGroups);
        part.poses.forEach((pose, index) => {
          poses.push(pose.map((placement) => (
            Array.isArray(placement.effects) && placement.effects.length > 0 && offset > 0
              ? { ...placement, effects: placement.effects.map((id) => id + offset) }
              : placement
          )));
          // Pushed even when undefined, so a member with no limb table does not
          // shift every later pose's limbs by its own length.
          limbs.push(part.limbs?.[index]);
        });
      }
      const first = parts[0];
      const last = parts[parts.length - 1];
      built = Object.freeze({
        label: first.label,
        firstFrame: first.firstFrame,
        lastFrame: last.lastFrame,
        effectGroups,
        poses,
        limbs,
        // The union, because a continuation may reach further than its entry —
        // the psych-up orb travels to x -121 over `psyche_charging2`, well
        // outside `psyche_up2`'s own box.
        bounds: parts.reduce((box, part) => (part.bounds ? {
          xMin: Math.min(box.xMin, part.bounds.xMin), xMax: Math.max(box.xMax, part.bounds.xMax),
          yMin: Math.min(box.yMin, part.bounds.yMin), yMax: Math.max(box.yMax, part.bounds.yMax)
        } : box), { xMin: Infinity, xMax: -Infinity, yMin: Infinity, yMax: -Infinity }),
        // Not decoration: a consumer looking at a 34-pose `hurt8` needs to be
        // able to tell that the build plays it that way rather than that the
        // extractor produced something odd.
        playsSequence: Object.freeze([...members])
      });
    }
  } else {
    built = shortRunAnimation(pack, name);
  }
  pack.sequenced.set(name, built);
  return built;
}

/**
 * THE OTHER DIRECTION: a label whose build `Stop` comes BEFORE the end of the
 * span the extractor cut, trimmed to the frames the build plays — or null when
 * the label is not one (`SHORT_RUNS` in `clip-sequences.js`) or the pack
 * already ends at the stop.
 *
 * ► **ONE LABEL, `little_fat_kid`, AND THE VICTIM VANISHED WITHOUT THIS.** Its
 *   span runs to the clip's end at 2222; the build stops at 2216, and the six
 *   frames after it are empty. Stretched over the schedule whole, the last
 *   quarter of the performance drew nothing. Sliced, not rebuilt: `lastFrame`
 *   moves to the stop so `face.js`'s absolute frame numbers stay true, and the
 *   bounds are kept because the frames cut hold no art to widen them.
 */
function shortRunAnimation(pack, name) {
  const frames = shortRunFramesFor(name);
  const animation = pack.animations[name];
  if (frames === null || !isDrawable(pack, animation) || animation.poses.length <= frames) return null;
  return Object.freeze({
    ...animation,
    lastFrame: Number.isFinite(animation.firstFrame) ? animation.firstFrame + frames - 1 : animation.lastFrame,
    poses: animation.poses.slice(0, frames),
    limbs: Array.isArray(animation.limbs) ? animation.limbs.slice(0, frames) : animation.limbs
  });
}

/**
 * The animation a family should play, and the label it resolved through.
 *
 * Returns null when the pack holds nothing DRAWABLE for this family — which is
 * a real answer, not a failure: this engine can express phases the build has no
 * clip for, and the caller falls back to authored art for exactly those.
 */
export function animationFor(pack, { family, label = null, facing = "right" } = {}) {
  if (!hasExtractedArt(pack)) return null;
  const labels = clipLabelsFor(family);

  // ► **THE ENGINE'S OWN LABEL WINS WHEN IT IS ONE OF THE FAMILY'S**, and this
  //   is not a nicety. The resolver has already chosen WHICH of twelve attack
  //   clips this swing is — `attack3` is a different animation from `attack1`,
  //   and the build draws it differently. A first version took the family's
  //   first label and drew `attack1` for every attack in the game, throwing the
  //   choice away and making twelve clips look like one.
  //
  //   **Membership is the guard, and it is load-bearing rather than
  //   defensive.** `taunt` is BOTH an attack label and a death variant — the
  //   collision `timeline.js` resolves by ROLE — so a bare "is this label in
  //   the pack?" would draw the attacking taunt for a gladiator dying of one.
  //   Requiring the label to belong to the family this timeline resolved to
  //   makes that impossible instead of merely unlikely.
  const own = typeof label === "string" ? label.toLowerCase() : null;
  const direct = own && labels.includes(own) ? own : null;

  const preferred = directionalLabel(family, label, facing);
  const candidates = [];
  for (const name of [direct, preferred, ...labels]) {
    if (name && !candidates.includes(name)) candidates.push(name);
  }
  for (const name of candidates) {
    const animation = pack.animations[name];
    if (!isDrawable(pack, animation)) continue;
    // The LABEL stays the entry's, because that is what the resolver chose and
    // what the sound bindings are keyed on. Only the poses grow.
    return { label: name, animation: sequencedAnimation(pack, name) ?? animation };
  }
  return null;
}

/**
 * Which pose of an animation is showing at progress `at` in `[0, 1]`.
 *
 * ► **The last frame is reachable and the wrap is not.** `at` of exactly 1 is
 *   the END of an action — the moment the shell reports the animation finished
 *   — so it must show the final pose rather than wrapping to the first, which
 *   is what a bare modulo does and which reads as a one-frame twitch at the end
 *   of every swing.
 */
export function poseIndexAt(count, at) {
  if (!Number.isFinite(count) || count <= 0) return 0;
  const clamped = Number.isFinite(at) ? Math.min(1, Math.max(0, at)) : 0;
  return Math.min(count - 1, Math.floor(clamped * count));
}

/** `channel * multiplier + offset`, clamped — the SWF's own colour transform. */
/**
 * ► **THIS USED TO HAVE ITS OWN COPY OF THE ARITHMETIC AND IT ROUNDED.**
 *   `src/render/filters.js` now owns the one implementation, and it FLOORS,
 *   because `readColourTransform` reads the multiply term as signed 8.8 fixed
 *   point and the player computes `(channel * multTerm) >> 8` — an arithmetic
 *   shift. Measured across the real pack, rounding disagreed with flooring on
 *   69 of 1023 tinted fills, always by one unit.
 *
 *   Three modules had grown a copy of this by the end of one evening; a fourth
 *   would have been inevitable. Delegating is what stops the next one.
 */
function tint(hex, colour) {
  return applyColourTransform(hex, colour);
}

/**
 * WHERE EACH WARDROBE PIECE ATTACHES, and it is the build's own table.
 *
 * Disassembled from `updatecharacter` — the root `DoAction` at `0x40bf76`,
 * body `0x40bf7c` — which makes 20 `attachMovie` calls. Each reads
 * `<limb>.attachMovie("<slot>" + character.<field>, "<instance>", <depth>)`,
 * with an init object only where an offset is needed.
 *
 * ► **FIFTEEN OF THE SEVENTEEN PIECES HAVE NO OFFSET AT ALL.** They are
 *   attached at the limb clip's own origin and the art is authored to fit
 *   there. **The only non-zero offset in the whole routine is the shield's
 *   `_y: 50`** — measured, not assumed, and the reason this table carries an
 *   offset column at all.
 *
 * ► **`helmet` AND `hair` SHARE DEPTH 5**, so a helmet REPLACES the hair. That
 *   is the build's rule, falling out of the byte layout rather than a paint
 *   order anyone here chose — and a renderer that invented its own would draw
 *   hair through a helm while looking perfectly plausible.
 *
 * ► **AND THE SHIELD HANGS OFF THE RIGHT FOREARM, not the depth-35 `shield`
 *   sprite.** That sprite is empty, which read for two sessions as a
 *   placeholder nobody had filled. An empty slot can mean you are looking at
 *   the wrong slot.
 *
 * The `field` is the character resource whose VALUE is the linkage suffix:
 * `helmet3` is the art for helmet 3, so the item row's own id is the selector.
 */
export const ATTACHMENTS = Object.freeze([
  { slot: "features", field: "features", limb: "head", depth: 4 },
  { slot: "facehair", field: "facehairstyle", limb: "head", depth: 3 },
  { slot: "hair", field: "hairstyle", limb: "head", depth: 5 },
  { slot: "helmet", field: "helmet", limb: "head", depth: 5 },
  { slot: "breastplate", field: "breastplate", limb: "torso", depth: 1 },
  { slot: "shoulderguard", field: "shoulderguard", limb: "Lupperarm", depth: 1 },
  { slot: "shoulderguard", field: "shoulderguard", limb: "Rupperarm", depth: 1 },
  { slot: "gauntlet", field: "gauntlet", limb: "Llowerarm", depth: 1 },
  { slot: "gauntlet", field: "gauntlet", limb: "Rlowerarm", depth: 2 },
  { slot: "greaves", field: "greaves", limb: "Lupperleg", depth: 1 },
  { slot: "greaves", field: "greaves", limb: "Rupperleg", depth: 1 },
  { slot: "shinguard", field: "shinguard", limb: "Llowerleg", depth: 1 },
  { slot: "shinguard", field: "shinguard", limb: "Rlowerleg", depth: 1 },
  { slot: "boot", field: "boot", limb: "Lfoot", depth: 1 },
  { slot: "boot", field: "boot", limb: "Rfoot", depth: 1 },

  // ► **THE SHIELD IS MELEE-ONLY, AND THIS ROW USED TO BE UNCONDITIONAL.**
  //   `updatecharacter` attaches it inside the `equipped_weapon == 1` branch
  //   (`+0x0fa5` tests it, `+0x0fb7` jumps past on anything else, and the
  //   shield attach is at `+0x1026` INSIDE that branch). So a gladiator with a
  //   bow drawn carries no shield in vanilla, and this engine gave him one.
  { slot: "shield", field: "shield", limb: "Rlowerarm", depth: 3, whenEquipped: 1, offset: { x: 0, y: 50 } },

  // ► **THE WEAPON, WHICH WAS MISSING ENTIRELY — 89 OF THE 387 EXTRACTED
  //   WARDROBE PIECES, THE WHOLE SLOT, INDEXED BY NOTHING.** The table had
  //   sixteen rows and `updatecharacter` makes twenty `attachMovie` calls; a
  //   test asserted `ATTACHMENTS.length === 16` and so certified the
  //   incomplete table as complete. Found by the asset census 2026-09-14.
  //
  //   **It attaches into `weapon.realweapon`, not into `weapon`** — a NESTED
  //   target, at depth 0, with an init object of `{_x: 0, _y: 0}`. And
  //   `realweapon` is NOT at identity: measured on the oracle, char 703 places
  //   char 702 named `realweapon` at `tx = ty = -70` TWIPS. Assuming identity
  //   would put every weapon 3.5 pixels out, which is small enough to look like
  //   a drawing style and never like a bug.
  //
  //   Which weapon depends on what is drawn: the primary in melee, the
  //   SECONDARY when a bow is up (`+0x1087` reads `secondary_weapon` in the
  //   `equipped_weapon == 2` branch). Both land on the same target and only one
  //   can be attached at a time, which is why they are two rows and not one.
  {
    slot: "weapon", field: "weapon", limb: "weapon", depth: 0, whenEquipped: 1,
    nested: { name: "realweapon", matrix: [1, 0, 0, 1, -70, -70] }
  },
  {
    slot: "weapon", field: "secondary_weapon", limb: "weapon", depth: 0, whenEquipped: 2,
    nested: { name: "realweapon", matrix: [1, 0, 0, 1, -70, -70] }
  }
]);

/**
 * WHICH ATTACHMENTS APPLY AT THIS LOADOUT.
 *
 * ► **`equipped_weapon` IS A SELECTOR, NOT A DECORATION.** `updatecharacter`
 *   branches on it (`+0x0fa5` / `+0x1051`) and the branches attach DIFFERENT
 *   things: melee gets the primary weapon AND the shield, ranged gets the
 *   secondary weapon and no shield at all. A table that ignored it dressed
 *   every archer with a shield he cannot be holding.
 *
 * A combatant with no `equipped_weapon` at all is treated as MELEE, because
 * that is what root frame 221 starts everyone in — but the absence is a real
 * one and is not invented into a `1` on the combatant.
 */
export function attachmentsFor(loadout) {
  const equipped = Number.isFinite(loadout?.equipped_weapon) ? loadout.equipped_weapon : 1;
  return ATTACHMENTS.filter((attachment) =>
    attachment.whenEquipped === undefined || attachment.whenEquipped === equipped);
}

/**
 * A combatant's wire projection -> the loadout the dressing table indexes.
 *
 * ► **The resource names ARE the build's own**, which is not a coincidence and
 *   is the whole reason this is four lines: `ss2Combatant` already carries
 *   `helmet`, `breastplate`, `shoulderguard`, `gauntlet`, `greaves`,
 *   `shinguard`, `boot` and `shield` because the item tables do. The linkage
 *   suffix is the same number. Nothing is mapped or renamed here.
 *
 * `hairstyle`, `facehairstyle` and `features` are the build's appearance
 * fields and this engine does not model them yet, so they are absent and the
 * gladiator simply has no hair. **Absent is not zero** — a `0` would be a
 * claim that the build's piece 0 is what he wears.
 */
export function loadoutFrom(combatant) {
  if (!combatant || typeof combatant !== "object") return null;
  const loadout = {};
  for (const attachment of ATTACHMENTS) {
    const value = resourceValue(combatant, attachment.field);
    if (Number.isFinite(value)) loadout[attachment.field] = value;
  }
  // ► **THE SELECTOR IS NOT AN ATTACHMENT FIELD AND STILL HAS TO TRAVEL.**
  //   `equipped_weapon` dresses nothing itself; it decides WHICH rows apply.
  //   Reading it from the same projection keeps the decision with the data
  //   rather than making the renderer ask the combatant a second question.
  const equipped = resourceValue(combatant, "equipped_weapon");
  if (Number.isFinite(equipped)) loadout.equipped_weapon = equipped;
  // ► **AND NEITHER IS AN ENCHANTMENT, WHICH DRESSES NOTHING AND STILL DECIDES
  //   WHAT THE BLADE LOOKS LIKE.** All four are declared SS2 resources
  //   (`src/team/ss2-rules.js`) and reach the wire, so they arrive in the same
  //   two shapes every field here does and go through the same reader. Absent
  //   stays ABSENT: `weaponEnchantmentFor` reports `absent` rather than
  //   inventing the build's enchantment 0, which is a real row.
  for (const field of ENCHANTMENT_FIELDS) {
    const value = resourceValue(combatant, field);
    if (Number.isFinite(value)) loadout[field] = value;
  }
  return Object.keys(loadout).length > 0 ? loadout : null;
}

/**
 * A resource's number, from either shape the projection can be in.
 *
 * ► **A PROJECTED resource is `{value, min, max}`, and a ROSTER one is a plain
 *   number — and I tested against the roster.** `loadoutFrom` originally read
 *   `combatant.resources[field]` as a number, which is true of the objects
 *   `demoSide` builds and false of everything `host.combatant()` returns. The
 *   node check passed, the arena drew a naked gladiator, and nothing said why:
 *   `Number.isFinite({value: 2})` is false, so every slot was silently skipped.
 *
 *   **Testing against the wrong shape is the same failure as testing against
 *   your own model** — the third variant of it this session. Both shapes are
 *   handled here, and the projected one is what the arena actually passes.
 */
function resourceValue(combatant, name) {
  const entry = combatant?.resources?.[name] ?? combatant?.[name];
  if (Number.isFinite(entry)) return entry;
  if (entry && Number.isFinite(entry.value)) return entry.value;
  return null;
}

/**
 * `limb x piece`, in CLIP space and twips, with the attachment's offset folded
 * into the translation.
 *
 * Both matrices are `[a, b, c, d, tx, ty]` with the translation in TWIPS and
 * the rest unitless, which is the form the extractor writes. Composing here
 * rather than after the arena transform is what lets the offset be a plain
 * addition: `_y: 50` is fifty twips in the LIMB's space, and it rotates with
 * the forearm exactly as the build's does.
 */
export function composeInClipSpace(limb, piece, offset) {
  const [la, lb, lc, ld, ltx, lty] = limb;
  const [pa, pb, pc, pd, ptx, pty] = piece;
  // ► **THE OFFSET IS IN ACTIONSCRIPT PIXELS AND THE MATRICES ARE IN TWIPS, and
  //   the first version added them directly — a factor of twenty out.**
  //   `attachMovie`'s init object sets `_x`/`_y`, which are MovieClip
  //   properties in local PIXELS; a SWF matrix stores its translation in twips.
  //
  //   The build's own numbers settle it without reaching for the specification:
  //   the same routine sets `head.eyes._y = -14`, and the head shape is 55
  //   pixels tall. As pixels that is a quarter of the head — an eye placement.
  //   As twips it is 0.7 pixels, an invisible nudge nobody would write. So the
  //   shield's `_y: 50` is fifty PIXELS down the forearm, not 2.5.
  //
  //   Found by Codex; the derivation above is this session's own.
  const ox = (offset?.x ?? 0) * TWIPS_PER_PIXEL;
  const oy = (offset?.y ?? 0) * TWIPS_PER_PIXEL;
  // The offset applies to the PIECE inside the limb, so it shifts the piece's
  // own translation before the limb's rotation is applied to the result.
  const tx = ptx + ox;
  const ty = pty + oy;
  return [
    la * pa + lc * pb,
    lb * pa + ld * pb,
    la * pc + lc * pd,
    lb * pc + ld * pd,
    la * tx + lc * ty + ltx,
    lb * tx + ld * ty + lty
  ];
}

/** Negative zero normalised away; see `emitFigureOps` for why. */
const zero = (value) => (Object.is(value, -0) ? 0 : value);

/**
 * A placement inside NO effect group — one shared frozen empty array rather
 * than a fresh `[]` per placement, because a full sweep of this pack walks
 * 37,077 of them and 30 are inside one.
 */
const NO_EFFECTS = Object.freeze([]);

function tintAlpha(alpha, colour) {
  return applyColourTransformAlpha(alpha, colour);
}

/* ══════════ THE ENCLOSING EFFECT GROUPS — read here since 2026-09-15 ═════ */

/**
 * ONE ENCLOSING GROUP as the frozen record every operation under it will SHARE.
 *
 * ► **INTERNED, AND THE IDENTITY IS THE POINT.** This is deliberately the twin
 *   of `effectGroupEntryFor` in `src/render/props.js`. A painter walks the flat
 *   op array and flushes its buffer when `op.group` stops being the same
 *   OBJECT — `groupRunsOf` in `tools/arena/main.js` says in its own docstring
 *   that the test is identity and NOT `group.id`. Building a fresh record per
 *   operation would make that comparison always true and every group a group of
 *   one, which is the per-leaf picture `src/render/screen.js`'s header refuses,
 *   arrived at by accident instead of on purpose.
 *
 * ► **MUTABLE UNTIL THE WALK ENDS.** `ops` and `placements` are denominators
 *   and cannot be known until the last placement has been seen, so the record
 *   is filled in as the walk runs and frozen by `emitFigureOps` before it
 *   returns. Nothing outside this file ever sees an unfrozen one.
 *
 * ► **AND THE COLOUR MATRICES ARE NOT FOLDED HERE, which is the one field
 *   where this record must NOT copy the props one.** `props.js` carries
 *   `colourMatricesFolded` because it has already applied each matrix to every
 *   fill, stroke and gradient stop. This module applies none, so the field is
 *   `colourMatricesDeferred` — counted and NOT drawn — because a reader
 *   comparing the two files must not be able to read "folded" off a module that
 *   folds nothing. **Measured 2026-09-15: 0 of the figure pack's 24 group
 *   filters and 0 of the enchantment ladder's 24 is a colour matrix** (both
 *   tables are glows, and every one of the 48 has `inner: false`), so nothing
 *   is lost on this build and `groupColourMatrixOps` is what would say so if
 *   that changed. What it would take: `applyColourMatrix` from `filters.js`
 *   folded into `fill`, `stroke` and any `gradient.stops`, exactly as
 *   `foldColourMatrices` does next door.
 *
 * @param {object} spec   `{id, path, character, filters, blendMode}`
 * @param {number} scale  canvas pixels per unit of the FILTER'S OWN space
 */
/** The rig depth-name the build's glow shell hangs at. `ATTACHMENTS` uses it too. */
const WEAPON_LIMB = "weapon";

/**
 * THE WEAPON GLOW'S ONE RECORD, AND THE SCOPE DECISION IT ENCODES.
 *
 * ► **WHAT THIS FIXES, AND THE ERROR WAS IN THE BRIEF BEFORE IT WAS IN THE
 *   CODE.** The first version hung the glow on the weapon ATTACHMENT's
 *   operations only — 8 of them — on the stated ground that the filter
 *   "encloses the attached blade and not the `weapon` limb's own rig art
 *   either". **That last clause is false, and the code implemented it
 *   faithfully because the brief asserted it.** Measured on the oracle:
 *
 *   ```text
 *     char 703  weapon0        the glow SHELL, 13 frames
 *       depth 1  char 702      `realweapon` — THE PLACEMENT THAT WEARS THE FILTER
 *         depth 1  char 701    the rig's own weapon art
 *         depth 0  <attached>  what `attachMovie("weapon" + id, …)` puts there
 *   ```
 *
 *   `assets/figure/animations.json` states the same thing from the other side:
 *   all 2,216 `limb: "weapon"` placements are shape 701 at depth
 *   **`[39, 1, 1]`** — one shape, one chain, every animation. Depth 39 is the
 *   shell, the first `1` is `realweapon`, and 701 is INSIDE it. **So the
 *   build's glow encloses the placeholder and the blade together**, and the
 *   faithful scope is their union, which is exactly `op.limb === "weapon"`.
 *
 * ► **AND IT IS STILL ONE BUFFER.** The two runs are contiguous in the merged
 *   array — the body's weapon placement and the weapon attachment sort
 *   adjacently — so `groupRunsOf` sees one boundary, not two. That is why this
 *   returns ONE entry that both sites share: two equal records would be two
 *   objects, `op.group !== previous` would fire between them, and one glow
 *   would be composited twice.
 *
 * ► **WHY THE PACK CANNOT SAY THIS ITSELF.** A body placement carries no
 *   `effects` chain here, because the chain is what the EXTRACTOR could see and
 *   `flattenFrame` froze char 703 on frame 1 — the unenchanted frame, which
 *   carries no filter at all. So this is the one group in this module attached
 *   from the LOADOUT rather than read from the pack, and it is a named function
 *   rather than two lines inside a loop precisely so that asymmetry is visible.
 *
 * ► **THE LIMB'S OWN SCALE IS PART OF THE FILTER'S FACTOR.** The glow lives in
 *   the shell's space and `limbs.weapon` maps that space into the clip's, so a
 *   radius reaching arena units passes through it as well as through
 *   `filterScale`. Measured on this pack: that scale runs 0.9863 to 0.9981
 *   across all 2,216 poses that have a weapon limb, only 2 of them anisotropic
 *   — under 1.4%, small enough that assuming it away would never have been
 *   caught, which is exactly why it is composed instead.
 *
 * Returns `null` — and builds nothing — for every case that is not a resolved
 * cell with filters, so an unenchanted gladiator's operations stay
 * BYTE-IDENTICAL to what this module produced before the pack existed.
 */
function weaponGlowEntryFor(pack, enchantment, limbs, filterScale, invoice) {
  if (!enchantment || enchantment.reason !== "cell" || !enchantment.filters) return null;
  const limbMatrix = limbs?.[WEAPON_LIMB];
  // No weapon limb on this pose means nothing to enclose. Counted rather than
  // skipped in silence: a pose where the rig has no weapon is a fact about the
  // animation, not about the enchantment.
  if (!Array.isArray(limbMatrix)) {
    invoice.enchantmentNoLimb += 1;
    return null;
  }
  const limbScale = Math.sqrt(
    Math.hypot(limbMatrix[0], limbMatrix[1]) * Math.hypot(limbMatrix[2], limbMatrix[3]));
  const usable = Number.isFinite(limbScale) && limbScale > 0;
  if (!usable) invoice.enchantmentLimbScaleDegenerate += 1;
  const ladder = pack.enchantments;
  return groupEntryFrom({
    // The FRAME is this group's identity: two paints of the same frame are the
    // same glow, and two frames are two different ones.
    id: enchantment.frame,
    path: Number.isFinite(ladder?.inner?.depth) ? [ladder.inner.depth] : [],
    character: ladder?.inner?.character ?? null,
    filters: enchantment.filters,
    blendMode: undefined
  }, filterScale * (usable ? limbScale : 1), invoice);
}

function groupEntryFrom(spec, scale, invoice) {
  // ► **`canvasFilterFor` AND `blendModeFor` ARE THE VERDICT, never a table in
  //   here.** Same arrangement `tools/extract-figure.mjs` gives its reason for:
  //   "the pack carries it" and "the renderer can draw it" are then one answer
  //   and cannot drift apart while both stay green.
  const built = canvasFilterFor(spec.filters ?? [], { scale });
  const blend = spec.blendMode === undefined || spec.blendMode === null
    ? null
    : blendModeFor(spec.blendMode);
  invoice.effectGroups += 1;
  invoice.groupFilters += built.counts.total;
  invoice.groupFiltersApplied += built.counts.applied;
  invoice.groupFiltersDeferred += built.counts.deferred;
  invoice.groupFiltersNoOp += built.counts.noOp;
  invoice.groupFiltersRefused += built.counts.refused;
  invoice.groupColourMatrices += built.colourMatrices.length;
  // `normal` is what a group with no blend mode already does, so counting it
  // would make "this group blends" true for every group that so much as
  // mentions the field — the identity-transform mistake in a second field.
  const blends = Boolean(blend) && (blend.refused !== null || blend.composite !== "source-over");
  if (blends) {
    invoice.groupBlendModes += 1;
    if (blend.refused) invoice.groupBlendModesRefused += 1;
  }
  const path = Array.isArray(spec.path) ? [...spec.path] : [];
  // ► **A FILTER LIVES IN ITS PLACEMENT'S PARENT'S SPACE, so a group one level
  //   down would need its enclosing matrices composed — and the pack carries
  //   none.** `tools/extract-figure.mjs` counts exactly that as
  //   `notCarried.effectGroupMatrix`, 12 of 12 on this build. All 12 have
  //   `path: [43]`, a TOP-LEVEL depth in the fighter clip, so the
  //   clip-to-arena factor this module already composes is the whole of the
  //   conversion and nothing is missing. A deeper group would be scaled by the
  //   wrong factor, which is why it is COUNTED rather than assumed away.
  if (path.length > 1) invoice.groupsBelowTopLevel += 1;
  return {
    record: {
      id: Number.isFinite(spec.id) ? spec.id : null,
      path: Object.freeze(path),
      character: Number.isFinite(spec.character) ? spec.character : null,
      // The next group OUT, as the same kind of record, or null. A painter that
      // walks this composites the outermost buffer last.
      enclosedBy: null,
      // The blur/glow string only. Never a colour matrix — see the docstring.
      filter: built.filter,
      // ► **THE AMPLIFIED PLAN TRAVELS BESIDE THE STRING, NEVER INSTEAD OF IT.**
      //   `null` for all but a saturating glow list, and a painter that does not
      //   know the field keeps drawing exactly what it drew before. See
      //   `glowAmplificationFor` for what it describes and why it declines.
      amplify: glowAmplificationFor(spec.filters ?? [], { scale }),
      composite: blends && !blend.refused ? blend.composite : null,
      blendModeRefused: blend?.refused ?? null,
      colourMatricesDeferred: built.colourMatrices.length,
      // Denominators, filled in by the walk.
      ops: 0,
      placements: 0,
      counts: built.counts
    },
    filtered: built.filter !== null,
    deferredMatrices: built.colourMatrices.length
  };
}

/**
 * One index into THIS animation's own `effectGroups`, resolved once per paint.
 *
 * An index the animation's table does not hold draws UNFILTERED and is COUNTED
 * — `groupsUnresolved`, the same name and the same refusal-to-be-silent
 * `props.js` has for a group index a prop does not hold. Counted ONCE per
 * distinct index per paint, because the `null` goes into the cache beside it.
 *
 * ► **ONE `canvasFilterFor` PER GROUP PER PAINT, NOT ONE PER OPERATION.** The
 *   cache is per CALL, so a record can never be shared between two paints that
 *   happen to name the same index — the records carry per-paint denominators.
 */
function effectGroupEntryFor(animation, id, cache, scale, invoice, records) {
  if (cache.has(id)) return cache.get(id);
  const group = Array.isArray(animation.effectGroups) ? animation.effectGroups[id] : undefined;
  if (!group || typeof group !== "object") {
    invoice.groupsUnresolved += 1;
    cache.set(id, null);
    return null;
  }
  const entry = groupEntryFrom({
    id,
    path: group.path,
    character: group.character,
    filters: group.filters,
    blendMode: group.blendMode
  }, scale, invoice);
  cache.set(id, entry);
  // First-appearance order, which is the order the operations come out in, so
  // a reader of the table and a reader of the ops see one sequence.
  records.push(entry.record);
  return entry;
}

/**
 * WHAT ONE PAINT COULD NOT CARRY, BY NAME — with a denominator for every zero.
 *
 * ► **THE DENOMINATORS ARE HERE FOR THE REASON `props.js`'s `emptyInvoice`
 *   STATES.** A zero with no denominator beside it does not say whether the
 *   counter is quiet or DEAD, and most of these are dead on the real pack.
 *   Measured 2026-09-15 on `assets/figure/animations.json`: **0 of 37,077
 *   placements carries its own `filters`, 0 carries its own `blendMode`, 0 of
 *   the 12 group-table entries carries a blend mode or a colour matrix, and all
 *   12 sit at a top-level path.** So `ownEffectPlacements`, `groupBlendModes`,
 *   `groupColourMatrices` and `groupsBelowTopLevel` CANNOT FIRE on this build,
 *   and `placements`/`effectGroups` beside them are what says so out loud
 *   instead of letting four zeros read as "nothing was lost". The synthetic
 *   packs in `test/render-extracted-figure.test.js` reach every one, because a
 *   counter this pack cannot exercise is a counter nothing pins.
 */
function emptyFigureInvoice() {
  return {
    /* Denominators first, so every count below can be read. --------------- */
    placements: 0,
    placementsSkipped: 0,
    ops: 0,
    attachedPlacements: 0,
    attachedOps: 0,

    /* THE ENCLOSING GROUPS. `effectGroups` is the DISTINCT groups this paint
       reached — the body's inherited ones, a placement's own, and the weapon's
       glow, all through `groupEntryFrom` so there is one tally and not three. */
    effectGroups: 0,
    inheritedPlacements: 0,
    ownEffectPlacements: 0,
    groupedPlacements: 0,
    groupedOps: 0,
    // A chain deeper than one needs a STACK of buffers, and `groupRunsOf`
    // composites only the INNERMOST record. Every chain in this pack is one
    // deep, so only a synthetic pack can move this.
    nestedGroupPlacements: 0,
    groupsUnresolved: 0,
    groupsBelowTopLevel: 0,

    /* `canvasFilterFor`'s own verdicts, over the DISTINCT groups. */
    groupFilters: 0,
    groupFiltersApplied: 0,
    groupFiltersDeferred: 0,
    groupFiltersNoOp: 0,
    groupFiltersRefused: 0,
    groupBlendModes: 0,
    groupBlendModesRefused: 0,
    // ► **THE ONE NUMBER THAT SAYS WHAT IS STILL NOT DRAWN.** Operations under
    //   a group whose blur or glow no per-operation arithmetic can express, so
    //   they ride on the record for a painter that composites to a buffer. Not
    //   a loss while a painter does, a total loss while none does — counted
    //   either way, and read against `groupedOps`.
    groupFilterOps: 0,

    /* NOT FOLDED HERE, so counted rather than lost. See `groupEntryFrom`. */
    groupColourMatrices: 0,
    groupColourMatrixOps: 0,

    /* THE WEAPON ENCHANTMENT. `enchantmentSlots` is the denominator the five
       reasons below it partition EXACTLY. */
    enchantmentLadder: 0,
    enchantmentSlots: 0,
    enchantmentCell: 0,
    enchantmentBare: 0,
    enchantmentNoOp: 0,
    enchantmentAbsent: 0,
    enchantmentNoPack: 0,
    enchantmentOps: 0,
    // A weapon limb with no usable scale: the glow would be sized by a factor
    // of zero, and `canvasFilterFor` would silently fall back to 1. Dead on the
    // real pack — the `weapon` limb's uniform scale runs 0.9863 to 0.9981 over
    // all 2,216 poses that have one — so only the synthetic pack moves it.
    enchantmentLimbScaleDegenerate: 0,
    // A resolved cell on a pose whose rig has NO weapon limb, so there is
    // nothing for the glow to enclose. Dead on the real pack for a different
    // reason from the line above — 2,216 of 2,222 poses have a weapon limb, and
    // the six that do not are unreachable labels — but a pose without one is an
    // ordinary thing for an animation to be, so it is counted rather than
    // assumed away.
    enchantmentNoLimb: 0
  };
}

/* ══════════════ THE WEAPON ENCHANTMENT'S GLOW ═══════════════════════════ */

/**
 * THE TWO SLOTS' FIELD NAMES, PAIRED — and they are paired because reading one
 * slot's type beside the other slot's potency is the exact mistake this half of
 * the file exists to make impossible. See `weaponEnchantmentFor`.
 */
const PRIMARY_ENCHANTMENT = Object.freeze({
  type: "weapon_enchantment_type",
  potency: "weapon_enchantment_potency"
});
const SECONDARY_ENCHANTMENT = Object.freeze({
  type: "secondary_weapon_enchantment_type",
  potency: "secondary_weapon_enchantment_potency"
});

/** The four resources `loadoutFrom` carries for the glow, named in one place. */
export const ENCHANTMENT_FIELDS = Object.freeze([
  PRIMARY_ENCHANTMENT.type, PRIMARY_ENCHANTMENT.potency,
  SECONDARY_ENCHANTMENT.type, SECONDARY_ENCHANTMENT.potency
]);

/**
 * `assets/figure/enchantments.json` reduced to the two lookups a paint needs,
 * or `null` when the file is absent, truncated or hand-edited.
 *
 * **Total rather than throwing**, exactly as `wardrobe` is optional and for the
 * same reason: a player who ran `tools/extract-figure.mjs` and not
 * `tools/extract-enchantments.mjs` must still get a gladiator, just an
 * unenchanted one. `hasExtractedArt` is the model — absence is a supported way
 * to run this renderer, never an error path.
 *
 * ► **NOT ONE OF THE TWELVE CELLS IS WRITTEN HERE, AND NEITHER IS THE CLOSED
 *   FORM.** `selector.cells` is the ladder as `tools/extract-enchantments.mjs`
 *   read it out of `itemglow`'s own instruction stream, and `selector.default`
 *   is its `enchant_type < 2 -> gotoAndStop(1)` arm with the `2` and the `1`
 *   both off the bytes. Pasting `3 * (type - 2) + potency + 1` in here would
 *   make this file a second, unmeasured witness to a table the pack already
 *   carries — which is the shape of every fixture defect this project has paid
 *   for. The pack's own `selector.closedForm.holds` is where that fit lives.
 */
export function enchantmentLadderFrom(data) {
  const selector = data?.selector;
  const art = data?.art;
  if (!selector || selector.matched !== true) return null;
  if (!Array.isArray(selector.cells) || selector.cells.length === 0) return null;
  if (!art || !Array.isArray(art.frames) || art.frames.length === 0) return null;

  const frameByCell = {};
  for (const cell of selector.cells) {
    if (!Number.isFinite(cell?.type) || !Number.isFinite(cell?.potency)) continue;
    if (!Number.isFinite(cell?.frame)) continue;
    frameByCell[`${cell.type}/${cell.potency}`] = cell.frame;
  }
  if (Object.keys(frameByCell).length === 0) return null;

  // ► **KEYED BY THE FRAME NUMBER THE LADDER NAMES, NEVER BY ARRAY POSITION.**
  //   A pack missing one frame would otherwise shift every glow by one and
  //   still look entirely plausible — twelve wrong colours, no error.
  const filtersByFrame = {};
  for (const frame of art.frames) {
    if (!Number.isFinite(frame?.frame)) continue;
    filtersByFrame[frame.frame] = Array.isArray(frame.filters) && frame.filters.length > 0
      ? Object.freeze(frame.filters.map((filter) => Object.freeze({ ...filter })))
      : null;
  }

  return Object.freeze({
    belowType: Number.isFinite(selector.default?.below) ? selector.default.below : null,
    bareFrame: Number.isFinite(selector.default?.frame) ? selector.default.frame : null,
    frameByCell: Object.freeze(frameByCell),
    filtersByFrame: Object.freeze(filtersByFrame),
    cells: Object.keys(frameByCell).length,
    frames: Object.keys(filtersByFrame).length,
    character: Number.isFinite(art.character) ? art.character : null,
    linkage: typeof art.linkage === "string" ? art.linkage : null,
    // ► **WHERE THE GLOW SITS, AND IT IS NOT ON THE FIGURE.** The filter is on
    //   the placement OF `realweapon` inside the glow shell, so it encloses the
    //   attached blade and nothing else. A glow on the whole gladiator, or on
    //   the `weapon` limb's own art instead of the attachment, is a different
    //   and entirely plausible-looking picture. `ATTACHMENTS`' two weapon rows
    //   are the other half of the same join.
    inner: Object.freeze({
      instance: typeof art.inner?.instance === "string" ? art.inner.instance : null,
      depth: Number.isFinite(art.inner?.depth) ? art.inner.depth : null,
      character: Number.isFinite(art.inner?.character) ? art.inner.character : null
    })
  });
}

/**
 * WHICH GLOW THE EQUIPPED WEAPON WEARS — the `(type, potency)` pair, the frame
 * `itemglow` would stop the shell on, and the filter list on that frame.
 *
 * ► **THIS IS NOT `activeEnchantment` IN `src/golden/ss2-attack-candidate.js`,
 *   AND THE TWO MUST NOT BE MERGED.** They look like one function and they read
 *   DIFFERENT FIELDS, because the build does:
 *
 *   - **The GLOW** — `skincharacter`, whose two `itemglow` calls the pack
 *     records at `0x40da92` and `0x40dad4` — passes the equipped slot's OWN
 *     pair: `itemglow(weapon, weapon_enchantment_type,
 *     weapon_enchantment_potency)` in melee, and `itemglow(weapon,
 *     secondary_weapon_enchantment_type, secondary_weapon_enchantment_potency)`
 *     with a bow up. Matched pairs, both slots.
 *   - **The PROC** — `damagecharacter` — gates on `weapon_enchantment_potency`
 *     for BOTH, because the potency test at `+0x1c0f` is hoisted out of, and
 *     evaluated before, the first `equipped_weapon` test at `+0x1c27`.
 *     `activeEnchantment` implements THAT rule and is correct for what it does.
 *
 *   So `activeEnchantment` returns the SECONDARY type beside the PRIMARY
 *   potency whenever a bow is up: right for the roll, and the wrong glow the
 *   moment the two potencies differ. Two functions on purpose, and this
 *   paragraph is why neither may be deleted in favour of the other.
 *
 * ► **WHICH SLOT IS READ IS DECIDED BY WHICH WEAPON ROW `attachmentsFor`
 *   OFFERS, NOT BY A SECOND READING OF `equipped_weapon`.** That is what makes
 *   it structurally impossible to glow art that is not drawn: the row carrying
 *   `whenEquipped: 2` IS the row that attaches `secondary_weapon`, so the pair
 *   and the blade cannot come from different slots however the selector is
 *   spelled. An `equipped_weapon` of 0 or 3 offers NO weapon row —
 *   `updatecharacter` attaches nothing in either branch — so there is nothing
 *   to glow and the reason is `noSlot`.
 *
 * ► **AND OUT OF DOMAIN IS A NO-OP, NOT FRAME 1.** `itemglow` is a twelve-arm
 *   ladder plus a `type < 2` arm and **no trailing default**: for a type of 6,
 *   or a potency outside 1..3 (including the `0` that `randomise_gladiator`
 *   zeroes to), it calls `gotoAndStop` ZERO times and the clip KEEPS ITS
 *   CURRENT FRAME. A stateless renderer has no current frame — it draws a
 *   function of the state it is handed — so the faithful expression of "keep
 *   what you had" is **to add nothing to this paint**: the weapon draws exactly
 *   what the previous paint drew it with, which for a painter with no history
 *   is bare. `reason: "noOp"` is that, named, so it can never be confused with
 *   the DECISION the build makes for `type < 2`, which is a real
 *   `gotoAndStop(1)` onto a real bare frame (`reason: "bare"`).
 *
 * @returns {object} `{whenEquipped, type, potency, frame, filters, reason}`,
 *   `reason` one of `cell`, `bare`, `noOp`, `absent`, `noPack`, `noSlot` — and
 *   only `cell` and `bare` carry a frame.
 */
export function weaponEnchantmentFor(pack, loadout) {
  const answer = (fields) => Object.freeze({
    whenEquipped: null, type: null, potency: null, frame: null, filters: null, ...fields
  });
  const row = attachmentsFor(loadout).find((attachment) => attachment.slot === "weapon") ?? null;
  if (!row) return answer({ reason: "noSlot" });
  const fields = row.whenEquipped === 2 ? SECONDARY_ENCHANTMENT : PRIMARY_ENCHANTMENT;
  const type = Number.isFinite(loadout?.[fields.type]) ? loadout[fields.type] : null;
  const potency = Number.isFinite(loadout?.[fields.potency]) ? loadout[fields.potency] : null;
  const seen = { whenEquipped: row.whenEquipped, type, potency };

  const ladder = pack?.enchantments ?? null;
  if (!ladder) return answer({ ...seen, reason: "noPack" });
  // ► **ABSENT IS NOT ZERO**, the rule `loadoutFrom` already keeps for every
  //   wardrobe slot. A combatant the wire never gave an enchantment is not a
  //   combatant the build would call `itemglow(_, 0, 0)` for, and saying so
  //   would be a claim rather than a silence. Both draw bare; only one of them
  //   is a measurement, and the invoice keeps them apart.
  if (type === null || potency === null) return answer({ ...seen, reason: "absent" });
  if (ladder.belowType !== null && type < ladder.belowType) {
    return answer({
      ...seen,
      frame: ladder.bareFrame,
      filters: ladder.bareFrame === null ? null : (ladder.filtersByFrame[ladder.bareFrame] ?? null),
      reason: "bare"
    });
  }
  const frame = ladder.frameByCell[`${type}/${potency}`];
  if (!Number.isFinite(frame)) return answer({ ...seen, reason: "noOp" });
  return answer({ ...seen, frame, filters: ladder.filtersByFrame[frame] ?? null, reason: "cell" });
}

/**
 * ONE POSE of the extracted rig as draw operations, with the invoice filled in
 * as it goes.
 *
 * Shared by `paintExtractedFigure`, `figureInvoiceFor` and
 * `figureEffectGroupsFor` so that the counts, the operations and the group
 * table can never describe three different walks. Same arrangement, and the
 * same reason, as `emitPropOps` in `src/render/props.js`.
 *
 * @param {object[]} [collected]  when given, this paint's DISTINCT group
 *                                records are pushed into it in first-appearance
 *                                order
 */
function emitFigureOps(pack, options, invoice, collected = null) {
  const {
    family, label = null, facing = "right", at = 0, height = 1, fade = 0,
    wardrobe = null, loadout = null, scale: canvasScale = 1
  } = options;
  const chosen = animationFor(pack, { family, label, facing });
  if (!chosen) return [];

  const pose = chosen.animation.poses[poseIndexAt(chosen.animation.poses.length, at)];
  if (!Array.isArray(pose)) return [];

  // ONE transform for the whole figure: arena units per clip pixel, y flipped,
  // feet on the ground, centred on the reference animation's own midline.
  const scale = (UNIT * height) / pack.clipHeight;
  const alpha = 1 - (Number.isFinite(fade) ? fade : 0);
  const ops = [];

  // ► **THE FILTER SCALE IS COMPOSED HERE BECAUSE HALF OF IT IS THIS MODULE'S
  //   SECRET.** A group's blur radius is in the space the filter's own
  //   placement sits in — the FIGHTER CLIP's pixels for every one of this
  //   pack's 12 groups, all of which are at a top-level depth. `scale` above is
  //   arena units per clip pixel, and `canvasScale` is the caller's canvas
  //   pixels per ARENA unit, so their product is what `canvasFilterFor` wants.
  //   A caller cannot supply the first factor — it depends on `pack.clipHeight`
  //   and on `height` — so asking for the whole thing would be asking the shell
  //   to re-derive a number only this file holds.
  //
  //   **The default of 1 puts the radius in ARENA UNITS, which is the same
  //   space the op's own `matrix` maps into.** That is the invariant worth
  //   holding: the filter and the geometry beside it are always in one space.
  //   `ctx.filter` lengths are NOT scaled by `ctx.setTransform`, so a painter
  //   that sets a stage transform and then draws must pass its own factor here
  //   or every glow comes out at the wrong width. See `canvasFilterFor`'s
  //   header, which records that this is a HYPOTHESIS about browsers and has
  //   not been measured on this route.
  const viewScale = Number.isFinite(canvasScale) && canvasScale > 0 ? canvasScale : 1;
  const filterScale = scale * viewScale;

  const groupCache = new Map();
  const records = [];

  // ► **THE LIMB MATRICES AND THE ENCHANTMENT ARE RESOLVED BEFORE THE BODY
  //   LOOP, AND THAT ORDER IS THE FIX FOR A WRONG PICTURE.** Both used to sit
  //   inside the dressing block below, which meant the glow could only reach
  //   the ATTACHED blade. See `weaponGlowEntryFor`, which is where that prose
  //   lives — **these two sites used to cite a `weaponGlowScope` that has never
  //   existed anywhere in this repository**, found 2026-09-15 by a
  //   mutation-audit agent that went looking for it. A pointer to nothing sends
  //   a reader hunting, and this file's own header already records that
  //   correcting a pointer is not correcting the pointee.
  const limbs = chosen.animation.limbs?.[poseIndexAt(chosen.animation.poses.length, at)];
  // ► **RESOLVED ONCE PER PAINT, NOT ONCE PER ATTACHMENT.** It is a property of
  //   the loadout, and at most one of the two weapon rows can apply.
  const enchantment = loadout ? weaponEnchantmentFor(pack, loadout) : null;
  if (loadout && pack.enchantments) invoice.enchantmentLadder += 1;
  const enchantmentEntry = weaponGlowEntryFor(pack, enchantment, limbs, filterScale, invoice);
  const enchantmentGroup = enchantmentEntry ? enchantmentEntry.record : null;
  if (enchantmentEntry) records.push(enchantmentEntry.record);

  // THE BODY first, then what the build hangs on it.
  for (const placement of pose) {
    invoice.placements += 1;

    // ► **THE ENCLOSING GROUPS, RESOLVED ONCE PER PLACEMENT AND BEFORE THE
    //   SHAPE LOOKUP**, so `groupedPlacements` counts over the same population
    //   `placements` does. `effects` is OUTERMOST FIRST —
    //   `tools/swf-display-list.mjs` builds the chain as
    //   `[...parentEffects, thisGroup]` and `effectGroupsFor` in
    //   `tools/extract-figure.mjs` preserves that order — so the walk runs
    //   BACKWARDS to reach the innermost group first, which is the one a
    //   painter composites.
    const chain = Array.isArray(placement.effects) ? placement.effects : NO_EFFECTS;
    let group = null;
    let filtered = false;
    let deferredMatrices = 0;
    if (chain.length > 0) {
      invoice.inheritedPlacements += 1;
      let inner = null;
      for (let depth = chain.length - 1; depth >= 0; depth -= 1) {
        const entry = effectGroupEntryFor(chosen.animation, chain[depth], groupCache, filterScale, invoice, records);
        if (!entry) continue;
        entry.record.placements += 1;
        // Inner-to-outer, so the record built on the previous turn of this loop
        // is the one this group ENCLOSES.
        if (inner) inner.enclosedBy = entry.record;
        if (group === null) group = entry.record;
        inner = entry.record;
        if (entry.filtered) filtered = true;
        deferredMatrices += entry.deferredMatrices;
      }
    }

    // ► **A PLACEMENT'S *OWN* FILTER IS A GROUP OF ONE PLACEMENT, and carrying
    //   it costs less than counting it would.** `tools/extract-figure.mjs`
    //   writes `filters` and `blendMode` straight onto a placement when the
    //   drawable itself had them; **0 of this build's 37,077 placements does**,
    //   so this branch is dead on the real pack and the synthetic pack in the
    //   test file is the only thing that reaches it. It is here rather than in
    //   a counter because a filter on ONE leaf is exactly per-leaf — there is
    //   no composite to get wrong — so the honest handling and the cheap
    //   handling are the same code, and a field this reader walked past would
    //   be the sixth instance of this project's standing defect.
    if (placement.filters || placement.blendMode !== undefined) {
      invoice.ownEffectPlacements += 1;
      const own = groupEntryFrom({
        // NOT an index into any table: this group is the placement itself, so
        // the depth chain that reached it IS its path.
        id: null,
        path: placement.depth,
        character: null,
        filters: placement.filters,
        blendMode: placement.blendMode
      }, filterScale, invoice);
      own.record.placements += 1;
      own.record.enclosedBy = group;
      records.push(own.record);
      group = own.record;
      if (own.filtered) filtered = true;
      deferredMatrices += own.deferredMatrices;
    }
    if (group) {
      invoice.groupedPlacements += 1;
      if (group.enclosedBy) invoice.nestedGroupPlacements += 1;
    }

    const shape = pack.shapes[placement.shape];
    // Unreachable for an animation `isDrawable` accepted, and kept anyway: a
    // throw from this function stops the arena's animation loop for good, so it
    // is the last place in the renderer that should trust its input.
    if (!shape || !Array.isArray(shape.paths) || !Array.isArray(placement.matrix)) {
      invoice.placementsSkipped += 1;
      continue;
    }
    const [a, b, c, d, tx, ty] = placement.matrix;

    // Compose `S * M`, where S scales and flips. Doing it here means the shell
    // applies ONE matrix per limb and the path data is never touched.
    //
    // `zero` normalises NEGATIVE ZERO, which the y-flip produces for anything
    // sitting exactly on the ground datum. `-0` draws identically and compares
    // `=== 0`, but it is NOT `Object.is` 0 and it survives `JSON.stringify` as
    // `-0`, so it leaks into any snapshot or equality check downstream.
    const matrix = Object.freeze([
      zero(scale * a),
      zero(-scale * b),
      zero(scale * c),
      zero(-scale * d),
      zero(scale * (tx / TWIPS_PER_PIXEL - pack.centreX)),
      zero(-scale * (ty / TWIPS_PER_PIXEL - pack.groundY))
    ]);

    // ► **THE RIG'S OWN WEAPON ART IS INSIDE THE GLOW, AND SAYING OTHERWISE WAS
    //   MY BRIEF'S ERROR, FAITHFULLY IMPLEMENTED.** See `weaponGlowEntryFor`
    //   (the second of two sites that cited a non-existent `weaponGlowScope`):
    //   char 701 sits at depth `[39, 1, 1]`, i.e. INSIDE the `realweapon`
    //   placement that wears the filter, so the build's glow encloses it. The
    //   placement carries no `effects` chain of its own — the chain is what the
    //   extractor could see, and it could not see past the frame-1 freeze — so
    //   this is the one place a group is attached from the LOADOUT rather than
    //   from the pack, and it is named rather than folded in silently.
    if (!group && enchantmentGroup && placement.limb === WEAPON_LIMB) {
      group = enchantmentGroup;
      filtered = enchantmentEntry.filtered;
      invoice.inheritedPlacements += 1;
      invoice.groupedPlacements += 1;
      group.placements += 1;
    }

    const colour = placement.colour ?? null;
    for (const entry of shape.paths) {
      if (!entry.d) continue;
      invoice.ops += 1;
      if (group) {
        invoice.groupedOps += 1;
        // ► **EVERY RECORD IN THE CHAIN, NOT JUST THE INNERMOST.** An outer
        //   group's composite CONTAINS these operations too, so an `ops` that
        //   counted only the innermost would hand a painter a denominator of
        //   zero for the outer buffer it is being asked to build.
        for (let record = group; record; record = record.enclosedBy) record.ops += 1;
        if (filtered) invoice.groupFilterOps += 1;
        if (deferredMatrices > 0) invoice.groupColourMatrixOps += 1;
      }
      ops.push(Object.freeze({
        kind: "path",
        d: entry.d,
        matrix,
        limb: placement.limb ?? null,
        // The rig depth this part hangs at, so an attached piece can be merged
        // into the body's own paint order rather than stacked after all of it.
        rigDepth: Array.isArray(placement.depth) ? placement.depth[0] : null,
        fill: tint(entry.fill, colour),
        fillOpacity: tintAlpha(entry.fillOpacity ?? 1, colour),
        fillRule: entry.fillRule ?? "evenodd",
        // ► **THIS IS THE ARENA-WALL DEFECT, UNFIXED, ON THE FIGHTER.** Both
        //   loops in this file copied named fields one at a time and neither
        //   copied `approximated` — so eight body gradients and three wardrobe
        //   ones arrived at the painter as ordinary flat fills with no trace of
        //   what was lost. `src/render/props.js` had the identical bug and its
        //   own comment states the rule: an approximation that is not carried
        //   is indistinguishable from a correct read. Found by the asset census
        //   on 2026-09-14, in the same sweep that found it here.
        ...(entry.gradient ? { gradient: entry.gradient } : {}),
        ...(entry.bitmap ? { bitmap: entry.bitmap } : {}),
        ...(entry.approximated ? { approximated: entry.approximated } : {}),
        stroke: entry.stroke ? tint(entry.stroke, colour) : null,
        strokeOpacity: tintAlpha(entry.strokeOpacity ?? 1, colour),
        // ► **IN THE SHAPE'S OWN PIXELS, UNSCALED, and the first version
        //   multiplied by `scale` here.** The matrix above ALREADY carries that
        //   factor, and the shell sets `lineWidth` after applying the matrix —
        //   so pre-scaling applied it twice and drew every outline at 67.4% of
        //   its width, with the error growing quadratically in `height`.
        //   **My own test asserted the pre-scaled value**, which is the third
        //   time this session a test inherited the code's wrong model.
        strokeWidth: entry.strokeWidth ?? 0,
        alpha,
        // ► **THE ENCLOSING GROUP, AS THE SHARED FROZEN RECORD — and it is the
        //   LAST key on purpose.** Absent when the placement is inside none, so
        //   an operation from a pack with no `effectGroups` is BYTE-IDENTICAL
        //   to what this module emitted before the field existed, key order
        //   included. A painter branches on presence and flushes its buffer
        //   where `op.group` stops being the same object; a painter that
        //   ignores the field draws exactly what it drew before, which is how a
        //   reader turns the whole effect off.
        ...(group ? { group } : {})
      }));
    }
  }

  // ── DRESS IT ────────────────────────────────────────────────────────────
  // Attached pieces are drawn AFTER the body, in the build's own table order.
  // Within a limb the build separates them by depth; across limbs the body's
  // own paint order already holds, and a piece never crosses limbs.
  let result = ops;
  if (wardrobe && loadout && limbs) {
    // ► **PAINT ORDER IS THE LIMB'S DEPTH, THEN THE ATTACHMENT'S — not "all
    //   armour last".** The first version appended every piece after every body
    //   part, in table order, and never read `attachment.depth` at all. The
    //   build does not do that: `attachMovie` puts a piece INSIDE a limb clip,
    //   so it paints at that LIMB's place in the rig's order. Appending them
    //   all at the end lets a breastplate cover the head and paints the shield
    //   over everything regardless of where the forearm is.
    //
    //   The limb's depth is recovered from the pose itself — a body placement
    //   carries `depth: [23, 1, 1]` alongside `limb: "torso"` — so nothing new
    //   has to be extracted for it.
    const limbDepth = new Map();
    for (const placement of pose) {
      if (placement.limb && Array.isArray(placement.depth)) {
        if (!limbDepth.has(placement.limb)) limbDepth.set(placement.limb, placement.depth[0]);
      }
    }
    const dressed = [];
    for (const attachment of attachmentsFor(loadout)) {
      const id = loadout[attachment.field];
      if (!Number.isFinite(id)) continue;
      // ► **A HELMET REPLACES THE HAIR**, because the build gives them the same
      //   depth on the same limb. Derived, not chosen.
      if (attachment.slot === "hair" && Number.isFinite(loadout.helmet)) continue;
      const piece = wardrobe.pieces?.[attachment.slot]?.[id];
      if (!piece || !Array.isArray(piece.placements)) continue;
      const limbMatrix = limbs[attachment.limb];
      if (!Array.isArray(limbMatrix)) continue;

      // ► **THE GLOW GOES ON THE WEAPON ATTACHMENT AND NOWHERE ELSE.** In the
      //   build the filter sits on the placement of `realweapon` INSIDE the
      //   glow shell, so it encloses the attached blade and not the fighter,
      //   and not the `weapon` limb's own rig art either. Counted only once the
      //   attachment has survived every guard above, because a glow with
      //   nothing under it is not a loss.
      let attachmentGroup = null;
      const attachmentEntry = enchantmentEntry;
      if (attachment.slot === "weapon") {
        invoice.enchantmentSlots += 1;
        if (enchantment.reason === "cell") invoice.enchantmentCell += 1;
        else if (enchantment.reason === "bare") invoice.enchantmentBare += 1;
        else if (enchantment.reason === "noOp") invoice.enchantmentNoOp += 1;
        else if (enchantment.reason === "absent") invoice.enchantmentAbsent += 1;
        else if (enchantment.reason === "noPack") invoice.enchantmentNoPack += 1;
        // ► **ONLY A RESOLVED CELL WITH FILTERS BUILDS A RECORD.** The bare
        //   frame carries none, and a record with `filter: null` and
        //   `composite: null` is INERT — `groupRunsOf` would open a run
        //   boundary for it and composite nothing. So an unenchanted gladiator,
        //   which is nearly all of them, keeps operations byte-identical to
        //   what this module produced before the pack existed.
        // ► **THE RECORD IS THE ONE THE BODY LOOP ALREADY HUNG ON CHAR 701, NOT
        //   A SECOND ONE.** Building a fresh record here would give the rig's
        //   placeholder and the attached blade two DIFFERENT objects, and
        //   `groupRunsOf` flushes on object identity — so one glow would open
        //   two buffers and be composited twice, which is a different picture
        //   from one buffer over both. `weaponGlowEntryFor` builds it once.
        attachmentGroup = enchantmentGroup;
      }

      for (const placement of piece.placements) {
        const pieceShape = wardrobe.shapes?.[placement.shape];
        if (!pieceShape || !Array.isArray(pieceShape.paths)) continue;
        // ► **A MALFORMED WARDROBE MUST NOT THROW HERE.** The pack is validated
        //   per animation; the WARDROBE was not, and a placement with a shape
        //   but no matrix gave `TypeError: piece is not iterable` out of
        //   `render()`. The shell catches that and schedules another frame
        //   against the same bad data, so it aborts the draw EVERY frame while
        //   the bout carries on underneath — a worse failure than falling back,
        //   because it never stops. Skip the piece, keep the body.
        if (!Array.isArray(placement.matrix) || placement.matrix.length < 6
          || !placement.matrix.every((value) => Number.isFinite(value))) continue;
        invoice.attachedPlacements += 1;
        if (attachmentGroup) {
          attachmentGroup.placements += 1;
          invoice.groupedPlacements += 1;
        }
        // limb (in clip space) x the piece's own placement, then the same
        // clip-to-arena transform the body uses. Composed in TWIPS throughout,
        // which is why the offset can simply be added to the translation.
        // ► **A NESTED TARGET IS A THIRD MATRIX AND IT IS NOT IDENTITY.** The
        //   weapon attaches into `weapon.realweapon`, which sits at -70/-70
        //   twips inside the weapon clip. Composed BEFORE the piece so the
        //   order matches the build's own containment: limb, then the child
        //   clip, then the piece inside it.
        const target = attachment.nested
          ? composeInClipSpace(limbMatrix, attachment.nested.matrix, null)
          : limbMatrix;
        const composed = composeInClipSpace(target, placement.matrix, attachment.offset);
        const matrix = Object.freeze([
          zero(scale * composed[0]),
          zero(-scale * composed[1]),
          zero(scale * composed[2]),
          zero(-scale * composed[3]),
          zero(scale * (composed[4] / TWIPS_PER_PIXEL - pack.centreX)),
          zero(-scale * (composed[5] / TWIPS_PER_PIXEL - pack.groundY))
        ]);
        for (const entry of pieceShape.paths) {
          if (!entry.d) continue;
          invoice.attachedOps += 1;
          if (attachmentGroup) {
            invoice.enchantmentOps += 1;
            invoice.groupedOps += 1;
            for (let record = attachmentGroup; record; record = record.enclosedBy) record.ops += 1;
            if (attachmentEntry.filtered) invoice.groupFilterOps += 1;
            if (attachmentEntry.deferredMatrices > 0) invoice.groupColourMatrixOps += 1;
          }
          dressed.push(Object.freeze({
            kind: "path",
            d: entry.d,
            matrix,
            limb: attachment.limb,
            slot: attachment.slot,
            sortKey: [limbDepth.get(attachment.limb) ?? Number.MAX_SAFE_INTEGER, attachment.depth],
            fill: entry.fill,
            fillOpacity: entry.fillOpacity ?? 1,
            fillRule: entry.fillRule ?? "evenodd",
            stroke: entry.stroke ?? null,
            strokeOpacity: entry.strokeOpacity ?? 1,
            strokeWidth: entry.strokeWidth ?? 0,
            alpha,
            // Last, and absent unless there is a glow — see the body's own
            // copy of this comment for why the position matters.
            ...(attachmentGroup ? { group: attachmentGroup } : {})
          }));
        }
      }
    }

    // Merge into the body's own order: a piece sits with its limb, at its own
    // depth within it. A STABLE sort, so two pieces at one depth keep the
    // build's table order rather than swapping unpredictably.
    //
    // ► **AND THE MERGE CANNOT SPLIT A GROUP RUN.** Every operation under one
    //   group shares a `sortKey` (an attachment) or a `rigDepth` (a placement),
    //   and the insertion only ever fires BEFORE the first operation of a new
    //   depth — so a run of grouped operations stays contiguous and a painter
    //   flushing on `op.group !== previous` opens one buffer, not several.
    dressed.sort((left, right) =>
      (left.sortKey[0] - right.sortKey[0]) || (left.sortKey[1] - right.sortKey[1]));
    let cursor = 0;
    const merged = [];
    for (const op of ops) {
      const depth = Number.isFinite(op.rigDepth) ? op.rigDepth : Number.MAX_SAFE_INTEGER;
      while (cursor < dressed.length && dressed[cursor].sortKey[0] < depth) merged.push(dressed[cursor++]);
      merged.push(op);
    }
    while (cursor < dressed.length) merged.push(dressed[cursor++]);
    result = merged;
  }

  // ► **FROZEN LAST, because the denominators on them are not known until
  //   here.** Every operation emitted above already holds the record by
  //   reference, so freezing now freezes the same object those operations point
  //   at and not a copy they would have missed.
  for (const record of records) Object.freeze(record);
  if (collected) for (const record of records) collected.push(record);
  return Object.freeze(result);
}

/**
 * One pose of the extracted rig as DRAW OPERATIONS, in arena units.
 *
 * Emits `kind: "path"` — a new operation the authored painter never needed,
 * carrying SVG path data and the matrix that places it. The shell applies the
 * matrix and strokes the path; it still decides nothing.
 *
 * ► **AN OPERATION MAY NOW CARRY `group`, AND IT IS ADDITIVE.** The enclosing
 *   sprite's blur, glow or blend mode cannot be folded into a path — Flash
 *   filters the COMPOSITE — so they ride as a shared frozen record on each
 *   operation under them, inside the same flat array. Every other field is
 *   byte-identical with the field present or absent, so a painter that ignores
 *   it draws exactly what it drew before; that is the off switch, and it is the
 *   same one `propOpsFor` offers.
 *
 * @param {object} pack from `figurePackFrom`
 * @param {object} options `{family, label, facing, at, height, fade, wardrobe,
 *   loadout, scale}` — `scale` is canvas pixels per ARENA unit and reaches only
 *   the filter strings; see `emitFigureOps`.
 * @returns {ReadonlyArray<object>} operations in paint order, or `[]`
 */
export function paintExtractedFigure(pack, options = {}) {
  return emitFigureOps(pack, options, emptyFigureInvoice());
}

/**
 * WHAT ONE PAINT'S WORTH OF OPERATIONS COULD NOT CARRY, counted by name.
 *
 * Same arguments as `paintExtractedFigure` and the SAME WALK; see
 * `emptyFigureInvoice` for what each field means and which of them are dead on
 * the real pack. A second function rather than a second return value for the
 * reason `propInvoiceFor` is one: `paintExtractedFigure` returns a flat frozen
 * array that `mergeFaceOps` and the shell both index, and `{ops, invoice}`
 * would break every caller. The cost is honest and stated — asking for both
 * walks the pose twice — and nothing on the per-frame paint path asks for it.
 */
export function figureInvoiceFor(pack, options = {}) {
  const invoice = emptyFigureInvoice();
  emitFigureOps(pack, options, invoice);
  return Object.freeze(invoice);
}

/**
 * THE ENCLOSING EFFECT GROUPS ONE PAINT REACHES, in first-appearance order.
 *
 * The same records `paintExtractedFigure` stamps on its operations, built by
 * the same private walk. ► **EQUAL, NOT IDENTICAL — a separate call is a
 * separate walk**, so `figureEffectGroupsFor(...)[0] === paintExtractedFigure(...)[0].group`
 * is FALSE. The identity that matters is WITHIN one array: every operation
 * under one group holds one object, which is what lets a painter flush on
 * `!==`.
 *
 * For a caller that wants to know what a pose is asking of a painter WITHOUT
 * walking its operations: a manifest line, a log line, a test.
 */
export function figureEffectGroupsFor(pack, options = {}) {
  const groups = [];
  emitFigureOps(pack, options, emptyFigureInvoice(), groups);
  return Object.freeze(groups);
}
