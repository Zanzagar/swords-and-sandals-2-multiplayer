/**
 * `initcharacter`'s DNA decode — how a tournament champion's literal `charDNA`
 * becomes a character record.
 *
 * `initcharacter(whichcharacter, whichavatar, DNA)`, root frame 35
 * `DoAction@0x40bf76`, `DefineFunction2` at `+0x0592`: the body splits the
 * string on `","` (`+0x05e0`) and then makes fifty flat
 * `whichcharacter.<field> = ToNumber(characterDNA[<n>])` assignments (indices 0
 * and 28 are `ToString`). The full table, with every offset, is
 * `docs/integration/ss2-champion-dna.md` §1; `test/ss2-champion-dna-decode.test.js`
 * holds this map against it row for row.
 *
 * WHY IT IS HERE AND NOT IN A TEST. It lived in `test/ss2-champion-dna.test.js`
 * until 2026-09-23, when the browser arena began building champions from an
 * extracted pack (`tools/extract-champions.mjs`, `tools/arena/roster.js`). Two
 * copies of one index map is two places for a typo to disagree.
 *
 * WHAT IS DECODED. The 32 fields a combatant is built from — equipment, stats,
 * level, enchantments, inventory and the weapon selector. Progression (15,
 * 25-31, 41-44) and the name are left out: nothing in the engine reads them,
 * and a decode that carries fields no consumer checks is how a wrong index goes
 * unnoticed. **No DNA value, name or quote lives in this repository**; they
 * come from the player's own install, into gitignored `assets/champions/`.
 *
 * ► ~~Appearance (1-5) … left out: nothing in the engine reads them~~ — **the
 *   RENDERER reads them since 2026-09-24**, so they are decoded, by a SEPARATE
 *   function into a SEPARATE record (`ss2ChampionAppearanceFromDna`). The look
 *   is presentation: folding it into `ss2ChampionFromDna`'s record would put
 *   it on the vanilla mirror and in reach of the combat state, and the combat
 *   record — and every hash built from it — is exactly what it was.
 */

export class Ss2ChampionDnaError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * `initcharacter`'s index for each field decoded here, with the
 * `Push register:3, "<field>"` offset that opens its assignment.
 */
export const SS2_CHAMPION_DNA_INDEX = Object.freeze({
  shoulderguard: 6, //                          +0x0680
  gauntlet: 7, //                               +0x0697
  breastplate: 8, //                            +0x06ae
  helmet: 9, //                                 +0x06c5
  greaves: 10, //                               +0x06dc
  shinguard: 11, //                             +0x06f3
  boot: 12, //                                  +0x070a
  weapon: 13, //                                +0x0721
  shield: 14, //                                +0x0738
  strength: 16, //                              +0x0766
  speed: 17, //                                 +0x077d
  attack: 18, //                                +0x0794
  defence: 19, //                               +0x07ab
  vitality: 20, //                              +0x07c2
  charisma: 21, //                              +0x07d9
  stamina: 22, //                               +0x07f0
  magicka: 23, //                               +0x0807
  herolevel: 24, //                             +0x081e
  weapon_enchantment_potency: 32, //            +0x08d6
  weapon_enchantment_type: 33, //               +0x08ed
  inventory1: 34, //                            +0x0904
  inventory2: 35, //                            +0x091b
  inventory3: 36, //                            +0x0932
  inventory4: 37, //                            +0x0949
  inventory5: 38, //                            +0x0960
  inventory6: 39, //                            +0x0977
  inventory_maxslots: 40, //                    +0x098e
  secondary_weapon: 45, //                      +0x0a01
  secondary_weapon_enchantment_potency: 46, //  +0x0a18
  secondary_weapon_enchantment_type: 47, //     +0x0a2f
  maximum_ammo: 48, //                          +0x0a46
  equipped_weapon: 49 //                        +0x0a5d
});

/**
 * AFTER the table, `initcharacter` overwrites `inventory_maxslots` by level in
 * five sequential tests (`+0x0a8d`-`+0x0b45`), each
 * `herolevel < L; Not; Not; If -> skip; inventory_maxslots = V`. The skip
 * fires while the level is BELOW L, so every write whose threshold the level
 * has reached lands, and the last to land wins. Below 6 nothing is written and
 * the DNA's own index-40 value stands.
 */
const MAXSLOTS_BY_LEVEL = Object.freeze([
  Object.freeze([6, 2]), //   +0x0aa5
  Object.freeze([15, 3]), //  +0x0aca
  Object.freeze([20, 4]), //  +0x0aef
  Object.freeze([30, 5]), //  +0x0b14
  Object.freeze([40, 6]) //   +0x0b39
]);

/**
 * AVM1's `ToNumber` over one split field, held to what a DNA literal can
 * legitimately contain. A number passes through; a string must be a plain
 * decimal. Anything else — an empty field, a word, a field shifted by a comma
 * inside a name — is `NaN` in the build and is refused here rather than
 * reaching `ss2Combatant` as a number nobody wrote.
 */
function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !/^\s*-?(\d+(\.\d*)?|\.\d+)\s*$/.test(value)) return null;
  return Number(value);
}

/**
 * The character record `initcharacter` leaves behind for a DNA: the 32 fields
 * above, ToNumber'd, then the level-driven `inventory_maxslots`.
 *
 * `dna` is the split literal (`DNA.split(",")`, strings) or anything indexable
 * by DNA index — an array, or an object keyed by index as the transcribed test
 * fixtures are. Every field that is missing or not a number is refused, all of
 * them named at once.
 *
 * @param {ArrayLike<string|number>|Record<number, string|number>} dna
 * @returns {Record<string, number>} a new record; the input is never mutated
 */
export function ss2ChampionFromDna(dna) {
  if (dna === null || typeof dna !== "object") {
    throw new Ss2ChampionDnaError(
      `A champion's DNA is the split charDNA literal (an array of its fifty fields), not ${String(dna)}.`
    );
  }
  const record = {};
  const refused = [];
  for (const [field, index] of Object.entries(SS2_CHAMPION_DNA_INDEX)) {
    const value = toNumber(dna[index]);
    if (value === null) refused.push(`${field} [${index}] = ${JSON.stringify(dna[index] ?? null)}`);
    else record[field] = value;
  }
  if (refused.length > 0) {
    throw new Ss2ChampionDnaError(
      `initcharacter reads these DNA fields as numbers, and they are missing or not numbers: ${refused.join(", ")}.`
    );
  }
  for (const [level, slots] of MAXSLOTS_BY_LEVEL) {
    if (!(record.herolevel < level)) record.inventory_maxslots = slots;
  }
  return record;
}

/**
 * `initcharacter`'s index for each APPEARANCE field, with the
 * `Push register:3, "<field>"` offset that opens its assignment. Each is
 * `ToNumber(characterDNA[n])` with no clamp and no default; the serialisers
 * (`constructDNA` `+0x1b66`, `constructvillainDNA` `+0x268c`) write them back in
 * the same order.
 *
 * ► **INDEX 3 IS NOT WHAT THE BUILD DRAWS.** `initcolour` runs straight after
 *   this parse and overwrites `features` from the skin colour for every skin
 *   index `begincolouring` has a branch for — see `featuresForSkin` in
 *   `src/render/appearance.js`. It is decoded here as the DNA says and derived
 *   there, so the two facts stay separately checkable.
 */
export const SS2_CHAMPION_APPEARANCE_INDEX = Object.freeze({
  skincolor: 1, //      +0x060d
  haircolor: 2, //      +0x0624
  features: 3, //       +0x063b
  hairstyle: 4, //      +0x0652
  facehairstyle: 5 //   +0x0669
});

/**
 * A champion's LOOK as its DNA states it: the five appearance fields,
 * ToNumber'd, each a number or `null`.
 *
 * ► **IT REFUSES NOTHING, where `ss2ChampionFromDna` refuses loudly — on
 *   purpose.** A malformed combat field would fight a gladiator nobody wrote;
 *   a malformed look field only draws him untinted or bald, which is what the
 *   build does too (a `NaN` index matches no `begincolouring` branch and no
 *   linkage). A cosmetic field is not a reason to refuse a bout.
 *
 * @param {ArrayLike<string|number>|Record<number, string|number>} dna
 * @returns {{skincolor: number|null, haircolor: number|null, features: number|null,
 *   hairstyle: number|null, facehairstyle: number|null} | null} null when there is no DNA
 */
export function ss2ChampionAppearanceFromDna(dna) {
  if (dna === null || typeof dna !== "object") return null;
  const record = {};
  for (const [field, index] of Object.entries(SS2_CHAMPION_APPEARANCE_INDEX)) {
    record[field] = toNumber(dna[index]);
  }
  return record;
}
