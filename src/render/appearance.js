/**
 * A GLADIATOR'S LOOK — skin colour, hair colour, hair, facial hair and the
 * face "features" — as the build computes it, and as the renderer applies it.
 *
 * Added 2026-09-24 after the owner watched the arena: "Are all different
 * fighter design styles (hair, eyes, body type, skin color, etc) properly
 * implemented? Even the bosses right now are all just default grey humans."
 * They were not. The extracted rig is the build's UNTINTED base art — the body
 * shapes are mostly `#cccccc` and `#eaeaea` because the build tints them at
 * runtime — and nothing here applied the tint or attached the hair.
 *
 * ## What the build does, re-derived from the bytes
 *
 * All of it is in root frame 35, `DoAction@0x40bf76` (body `0x40bf7c`):
 *
 * ```text
 *   initcharacter  +0x0592   DNA.split(",")  +0x05e0
 *                  skincolor = ToNumber(DNA[1])      +0x060d
 *                  haircolor = ToNumber(DNA[2])      +0x0624
 *                  features  = ToNumber(DNA[3])      +0x063b
 *                  hairstyle = ToNumber(DNA[4])      +0x0652
 *                  facehairstyle = ToNumber(DNA[5])  +0x0669
 *                  initcolour +0x0b46, updatecharacter +0x0b56, colorhero +0x0b66
 *   initcolour     +0x0b76   begincolouring(avatar, skincolor, "<limb>.bareskin", character)
 *                            x10: head, L/R upperarm, L/R lowerarm, L/R upperleg,
 *                            L/R lowerleg, torso (+0x0ba8 .. +0x0c9e)
 *   begincolouring +0x10b7   23 independent `if (whichcolor == k)` tests, each
 *                            charColorTransform = {ra, ga, ba, aa, all offsets 0}
 *                            and whichcharacter.features = F(k); then, always,
 *                            new Color(avatar + "." + object).setTransform(...)
 *                            +0x196d / +0x1989
 *   colorhero      +0x29b7   begincolouring(avatar, haircolor, "head.hair")      +0x29f4
 *                            begincolouring(avatar, haircolor, "head.facehair")  +0x2a0c
 * ```
 *
 * ► **ONE TABLE SERVES SKIN AND HAIR.** `begincolouring` is called with the
 *   skin index for the ten `bareskin` clips and with the hair index for the two
 *   hair clips; it does not know which it is colouring.
 *
 * ► **THE ARGUMENT ORDER IS (avatar, colour, object, character)** — the
 *   header's own `DefineFunction2 begincolouring(whichavatar, whichcolor,
 *   whichobject, whichcharacter)`, and `initcolour`'s pushes read
 *   `Push r1, "head.bareskin", r1.skincolor; Push r2, 4, "begincolouring"`, so
 *   the LAST pushed (`r2`, the avatar) is the first argument and the `4` is the
 *   count. A brief that called the skin colour "the 4th argument" was corrected
 *   by a write-nothing verifier before this file was written.
 *
 * ► **FEATURES ARE DERIVED FROM SKIN, NOT CHOSEN.** Every matched branch of
 *   `begincolouring` also writes `whichcharacter.features` — but only a
 *   4-argument call has a `whichcharacter`, and only `initcolour` makes one. It
 *   runs AFTER the DNA parse and BEFORE `updatecharacter` attaches
 *   `"features" + features` (`+0x0d4f`), so the DNA's own `features` field is
 *   overwritten whenever the skin index matches a branch. `featuresForSkin`.
 *   The features art is PRE-COLOURED to match — which is how the arithmetic
 *   below was proved.
 *
 * ## The arithmetic, and why it is 8.8
 *
 * `setTransform` takes PERCENT multipliers; the player holds a multiplier as
 * signed 8.8 fixed point, `floor(percent * 256 / 100)`, and computes
 * `(channel * multTerm) >> 8`. So a channel comes out
 * `min(255, floor(c * floor(p * 256 / 100) / 256))`. **Float `p / 100` is NOT
 * the same number**, and the build's own art says which is right: the
 * pre-coloured features art equals the 8.8 tint of the body greys (204, 234)
 * exactly — features 17 `#cc00ac`/`#ea00c6` is skin 15, features 13 `#df9900`
 * is skin 11, features 7 `#00acd5`/`#00c6f4` is skin 5 — and float `p / 100`
 * misses each of those by one unit (`#cc00ad`, `#e09900`, `#00add6`).
 * `test/render-appearance.test.js` re-measures it on the player's own pack.
 *
 * In this repository's eight-number colour form that is
 * `[m(ra), m(ga), m(ba), m(aa), 0, 0, 0, 0]`, `m(p) = floor(p * 2.56) / 256`
 * computed as `floor(p * 256 / 100) / 256`, and `src/render/filters.js`'s
 * `applyColourTransform` already floors the product — so this module returns
 * a transform and `filters.js` stays the ONE implementation of the arithmetic.
 *
 * ## What this file deliberately does NOT hold
 *
 * No art, no DNA, no boss. The table below is the build's CODE (a switch of
 * numeric literals, as `src/team/ss2-weapon-table.js` holds the build's weapon
 * table); the pieces it selects stay in the player's own `assets/figure/`.
 */

/**
 * `begincolouring`'s table, row by row: the `Push register:2, k` that opens
 * each test, the four percent multipliers, and the `features` it writes. All
 * four offsets (`rb`, `gb`, `bb`, `ab`) are the string `"0"` or `"00"` in
 * every row. **There is no row 23**: the tests run 1..22 and then 24.
 *
 * `features` 25 (skin 21) has NO exported symbol — the build exports features
 * 1, 6..20 and 22..24 — so a skin-21 fighter attaches nothing there. Row 9
 * writes `features` twice (10 at `+0x144b`, then 11 at `+0x1458`); 11 is what
 * stands.
 */
export const SS2_LOOK_COLOURS = Object.freeze({
  1: Object.freeze({ at: "+0x111c", ra: 255, ga: 90, ba: 75, aa: 100, features: 1 }),
  2: Object.freeze({ at: "+0x1178", ra: 255, ga: 105, ba: 75, aa: 100, features: 1 }),
  3: Object.freeze({ at: "+0x11d4", ra: 58, ga: 34, ba: 0, aa: 100, features: 1 }),
  4: Object.freeze({ at: "+0x1230", ra: 0, ga: 155, ba: 155, aa: 100, features: 6 }),
  5: Object.freeze({ at: "+0x128c", ra: 0, ga: 85, ba: 105, aa: 100, features: 7 }),
  6: Object.freeze({ at: "+0x12e8", ra: 0, ga: 0, ba: 100, aa: 100, features: 9 }),
  7: Object.freeze({ at: "+0x1344", ra: 60, ga: 70, ba: 0, aa: 100, features: 8 }),
  8: Object.freeze({ at: "+0x13a0", ra: 0, ga: 100, ba: 0, aa: 100, features: 10 }),
  9: Object.freeze({ at: "+0x13fc", ra: 0, ga: 65, ba: 15, aa: 100, features: 11 }),
  10: Object.freeze({ at: "+0x1465", ra: 155, ga: 105, ba: 0, aa: 100, features: 12 }),
  11: Object.freeze({ at: "+0x14c1", ra: 110, ga: 75, ba: 0, aa: 100, features: 13 }),
  12: Object.freeze({ at: "+0x151d", ra: 128, ga: 64, ba: 0, aa: 100, features: 14 }),
  13: Object.freeze({ at: "+0x1579", ra: 160, ga: 0, ba: 0, aa: 100, features: 15 }),
  14: Object.freeze({ at: "+0x15d5", ra: 100, ga: 0, ba: 0, aa: 100, features: 16 }),
  15: Object.freeze({ at: "+0x1631", ra: 100, ga: 0, ba: 85, aa: 100, features: 17 }),
  16: Object.freeze({ at: "+0x168d", ra: 55, ga: 0, ba: 35, aa: 100, features: 18 }),
  17: Object.freeze({ at: "+0x16e9", ra: 55, ga: 0, ba: 55, aa: 100, features: 19 }),
  18: Object.freeze({ at: "+0x1745", ra: 255, ga: 255, ba: 255, aa: 100, features: 20 }),
  19: Object.freeze({ at: "+0x17a1", ra: 100, ga: 100, ba: 100, aa: 100, features: 20 }),
  20: Object.freeze({ at: "+0x17fd", ra: 80, ga: 80, ba: 80, aa: 100, features: 20 }),
  21: Object.freeze({ at: "+0x1859", ra: 0, ga: 0, ba: 0, aa: 100, features: 25 }),
  22: Object.freeze({ at: "+0x18b5", ra: 58, ga: 34, ba: 0, aa: 100, features: 22 }),
  24: Object.freeze({ at: "+0x1911", ra: 255, ga: 105, ba: 78, aa: 122, features: 24 })
});

/**
 * The ranges the build hands out — `global_DNA_settings`, root frame 35
 * `DoAction@0x3ffdcf`, `r1 = _global`. The character creator wraps within them
 * and `randomise_gladiator` draws `1 + random(max)` from them. **Bosses go
 * outside them** (skin 22 and 24 are champion-only), which is why the table
 * above is keyed by what it holds and not clamped to these.
 *
 * `featuresmax = 11` (`+0x085a`) is written and never read anywhere in the
 * build, so it is not here: features are derived, not drawn.
 */
export const SS2_LOOK_LIMITS = Object.freeze({
  colormax: 21, //         +0x0826  hair colour
  skincolormax: 18, //     +0x0833
  facehairstylemax: 24, // +0x0840
  hairstylemax: 40 //      +0x084d
});

/**
 * The ten limbs `initcolour` tints, by the rig's own limb names. **The feet
 * are not among them**: foot sprite 682 has no `bareskin` child and
 * `initcolour` names none, so the build's feet keep their own `#b2987f`.
 */
export const BARESKIN_LIMBS = Object.freeze([
  "head", "Lupperarm", "Rupperarm", "Llowerarm", "Rlowerarm",
  "Lupperleg", "Rupperleg", "Llowerleg", "Rlowerleg", "torso"
]);
const BARESKIN = new Set(BARESKIN_LIMBS);

/**
 * THE BARESKIN CHILD'S DEPTH INSIDE ITS LIMB, and why the pack is read by depth.
 *
 * The SWF's own instance-name table names exactly one child `bareskin` in each
 * of the six limb sprites (677 upper leg, 680 lower leg, 685 upper arm, 688
 * torso, 697 head, 700 lower arm), ALWAYS at depth 1; the head's other
 * children (depths 3, 5 and 7: the transparent default facehair, hair and
 * features) are unnamed.
 *
 * ► **`assets/figure/animations.json` DROPPED THE NAME AND KEPT THE DEPTH.**
 *   `tools/extract-figure.mjs` names only the fighter clip's TOP-LEVEL depths
 *   (`buildDepthNames`: "everything under them is anonymous scaffolding"), so a
 *   placement says `limb: "head", depth: [25, 1, 1]` and not `head.bareskin`.
 *   The path is enough: `depth[1] === 1` under one of the ten limbs IS the
 *   bareskin child. Measured on the real pack by the test file — every such
 *   placement in all 101 animations is one of the six bareskin shapes, and no
 *   other placement is. A re-extraction that recorded the name would make this
 *   a lookup instead of a rule; nothing in this build needs it.
 */
export const BARESKIN_CHILD_DEPTH = 1;

/** Whether one pack placement is inside a limb's `bareskin` child. */
export function isBareskinPlacement(placement) {
  const depth = placement?.depth;
  return Boolean(placement)
    && BARESKIN.has(placement.limb)
    && Array.isArray(depth)
    && depth.length >= 2
    && depth[1] === BARESKIN_CHILD_DEPTH;
}

/**
 * A `setTransform` percent as the player's 8.8 multiplier, as a plain number:
 * `floor(percent * 256 / 100) / 256`. 85 is 217/256, 100 is exactly 1, 122 is
 * 312/256.
 */
export function multiplierFromPercent(percent) {
  if (!Number.isFinite(percent)) return null;
  return Math.floor((percent * 256) / 100) / 256;
}

/**
 * The colour transform `begincolouring` applies for a colour index, in this
 * repository's eight-number form, or `null` when the index has no branch.
 *
 * ► **NULL IS NOT THE BUILD'S ANSWER, AND SAYS SO.** For an index with no
 *   branch (23, 0, 25+, NaN) the build applies whatever `charColorTransform`
 *   held from the LAST call — a timeline variable, not a local — which a
 *   stateless renderer cannot know. This draws the untinted art instead. No
 *   DNA in the build reaches the case: the player and generated opponents stay
 *   inside 1..18 / 1..21 and the champions use none of the missing indices.
 */
export function colourTransformForLook(index) {
  const row = SS2_LOOK_COLOURS[index];
  if (!row || !Number.isInteger(index)) return null;
  return Object.freeze([
    multiplierFromPercent(row.ra),
    multiplierFromPercent(row.ga),
    multiplierFromPercent(row.ba),
    multiplierFromPercent(row.aa),
    0, 0, 0, 0
  ]);
}

/**
 * The `features` the build actually attaches: the skin row's, or — only when
 * the skin index matches no branch — the DNA's own. (`MAP[skin] ?? dna`, the
 * rule a verifier corrected "always overwritten" to.)
 */
export function featuresForSkin(skincolor, dnaFeatures = null) {
  const row = Number.isInteger(skincolor) ? SS2_LOOK_COLOURS[skincolor] : undefined;
  if (row) return row.features;
  return Number.isFinite(dnaFeatures) ? dnaFeatures : null;
}

/** A field's number, or null — a look field that is not a number draws as absent. */
function lookNumber(value) {
  return Number.isFinite(value) ? value : null;
}

/**
 * A look, normalised: the five fields the renderer reads, with `features`
 * DERIVED from the skin as `initcolour` derives it. Every field is a number or
 * `null` (absent: nothing attached, nothing tinted). Frozen.
 *
 * This is PRESENTATION DATA. It rides beside the roster, never in the combat
 * state: nothing the resolver reads is a look, and a declared resource would
 * move every battle hash for no gameplay reason.
 *
 * @param {object} fields `{skincolor, haircolor, hairstyle, facehairstyle,
 *   features?}` — `features` is the DNA's own and is used only when the skin
 *   matches no branch
 */
export function ss2LookFrom(fields) {
  if (!fields || typeof fields !== "object") return null;
  const skincolor = lookNumber(fields.skincolor);
  return Object.freeze({
    skincolor,
    haircolor: lookNumber(fields.haircolor),
    hairstyle: lookNumber(fields.hairstyle),
    facehairstyle: lookNumber(fields.facehairstyle),
    features: featuresForSkin(skincolor, lookNumber(fields.features))
  });
}

/**
 * THE BUILD'S OWN RULE FOR A NEW GLADIATOR'S LOOK — `randomise_gladiator`,
 * root frame 35 `DoAction@0x40198e`, `+0x23c3`, `r3 = whichcharacter`,
 * `r2 = _global`. Four draws, IN THIS ORDER, each
 * `field = 1 + RandomNumber(_global.<max>)`:
 *
 * ```text
 *   skincolor      1 + random(skincolormax 18)       +0x2409
 *   hairstyle      1 + random(hairstylemax 40)       +0x241d
 *   haircolor      1 + random(colormax 21)           +0x2431
 *   facehairstyle  1 + random(facehairstylemax 24)   +0x2445
 * ```
 *
 * then `updaterace(whichcharacter)` (`+0x2459`), which is DEFINED NOWHERE in
 * the build and so does nothing. `features` is never drawn: it is derived from
 * the skin (`ss2LookFrom`).
 *
 * ► **AND ONE LOOK RULE ON THE VILLAIN BRANCH, WHICH THIS TAKES AS AN
 *   OPTION.** After rolling the villain's helmet, `+0x2a95`-`+0x2aa7`: if
 *   `helmet > 1` then `hairstyle = 0` (`+0x2aac`); otherwise `helmet = 0`
 *   (`+0x2ad0`). There is no `hair0` symbol, so a helmeted generated villain is
 *   BALD — which shows only if the helmet is knocked off. Pass `{helmet}` to
 *   apply it; the helmet itself is combat data and is never written here.
 *
 * @param {(upperExclusive: number) => number} randomNumber AVM1's
 *   `RandomNumber(n)`: an integer in `0..n-1`. The caller's SEEDED stream —
 *   never `Math.random`.
 * @param {{helmet?: number|null}} [options]
 */
export function generatedSs2Look(randomNumber, { helmet = null } = {}) {
  if (typeof randomNumber !== "function") {
    throw new TypeError("generatedSs2Look needs the caller's seeded RandomNumber(n) -> 0..n-1.");
  }
  const draw = (max) => 1 + randomNumber(max);
  const skincolor = draw(SS2_LOOK_LIMITS.skincolormax);
  let hairstyle = draw(SS2_LOOK_LIMITS.hairstylemax);
  const haircolor = draw(SS2_LOOK_LIMITS.colormax);
  const facehairstyle = draw(SS2_LOOK_LIMITS.facehairstylemax);
  if (Number.isFinite(helmet) && helmet > 1) hairstyle = 0;
  return ss2LookFrom({ skincolor, hairstyle, haircolor, facehairstyle });
}

/**
 * What a paint needs from a look: the two transforms and the three attachment
 * ids. `skin`/`hair` are `null` when the index has no branch (see
 * `colourTransformForLook`) or is absent.
 */
export function lookPaintFor(appearance) {
  const look = appearance && typeof appearance === "object" ? appearance : null;
  if (!look) return null;
  return Object.freeze({
    skin: Number.isInteger(look.skincolor) ? colourTransformForLook(look.skincolor) : null,
    hair: Number.isInteger(look.haircolor) ? colourTransformForLook(look.haircolor) : null,
    hairstyle: lookNumber(look.hairstyle),
    facehairstyle: lookNumber(look.facehairstyle),
    features: lookNumber(look.features)
  });
}
