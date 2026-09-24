/**
 * The demo roster the browser arena fights with.
 *
 * EVERY NUMBER BELOW IS INVENTED. Nothing here is a measured character: the
 * corpus says what SS2's arithmetic does, not what a hot-seat duellist should
 * be, and `tools/hotseat.mjs` makes the same disclaimer about its own fighters
 * for the same reason. These are tuned so a demo bout lasts a few interesting
 * turns and no further.
 *
 * NO NAME HERE IS FROM THE GAME. Item display names are game CONTENT and this
 * repository deliberately ships none of them (`docs/integration/ss2-item-tables.md`;
 * `src/team/ss2-weapon-table.js` omits a withheld name rather than blanking
 * it). Items are addressed by ID only, exactly as they are everywhere else, and
 * the gladiators are called after nothing in particular.
 *
 * ► **THE CHAMPIONS AT THE FOOT OF THIS FILE ARE THE EXCEPTION, AND NONE OF
 *   THEM IS WRITTEN HERE EITHER** (added 2026-09-23). `championSide` builds a
 *   side from the build's own tournament bosses, but their DNA, names and
 *   quotes come from the player's OWN install through
 *   `tools/extract-champions.mjs`, into gitignored `assets/champions/`. This
 *   file holds the rules for turning an extracted champion into a fighter,
 *   never a champion.
 */

import { fnv1a } from "../../src/common/fnv1a.js";
import { generatedSs2Look, ss2LookFrom } from "../../src/render/appearance.js";
import { ss2ChampionAppearanceFromDna, ss2ChampionFromDna } from "../../src/team/ss2-champion-dna.js";
import { createOrderedRngChannel } from "../../src/team/rng.js";

/**
 * A vanilla-shaped gladiator record — the shape `createVanillaBattleHost`
 * takes. Field NAMES are the build's, which is structure the repository already
 * ships in source; the VALUES are invented here.
 */
export function demoGladiator(overrides = {}) {
  return {
    character_name: "Gladiator",
    herolevel: 4,
    character_level: 4,
    experience: 320,
    experienceneeded: 500,
    current_tournament: 1,
    tournament_ranking: 9,

    strength: 9,
    speed: 6,
    attack: 8,
    defence: 5,
    vitality: 5,
    stamina: 5,
    charisma: 6,
    // Below the floor of 1 that `heroDNA` seeds, and every cast costs
    // `round(magicka)`, so on this template a spell is FREE. A kit fighter
    // casts at `DEMO_KIT_MAGICKA` instead (2026-09-23); nothing without a kit
    // casts at all, so the plain roster keeps its 0.
    magicka: 0,

    hitpoints: 46,
    hitpointsmax: 46,
    staminaleft: 120,
    staminamax: 140,
    armourclass: 38,
    armourclass_max: 38,
    ammo_left: 0,
    maximum_ammo: 0,

    // ► **WAS `weapon: 3` UNTIL 2026-09-10, WHEN THE SHOP'S OWN GATE STARTED
    //   BEING ENFORCED and refused it.** Slashing is gated on speed at
    //   `3 * band_position` (`ss2-item-tables.md:530-552`), so weapon 3
    //   demanded speed 9, while this roster runs speed `6 + side - index` —
    //   4 through 7 across the six slots. Weapon 1 is the only slashing blade
    //   the whole roster can actually carry, and a demo roster carrying gear
    //   the campaign would never have sold it is the exact thing the gate
    //   exists to stop. The declared damage pair below is unchanged, so the
    //   arena plays the same; only the id is now one a shop would sell.
    weapon: 1,
    weapon_type: 1,
    weapon_weight: 7,
    // ► **`weapon_range: 1` STOOD HERE UNTIL 2026-09-11, AND `1` IS A
    //   MULTIPLIER, NOT A RANGE.** `battlevalues` `+0x3190` is
    //   `weapon_range = physical_size + _root["weapon" + weapon][5] * 44`, so
    //   the `[5]` column had been pasted into the field it multiplies into.
    //   It was inert while `ss2Reach` ignored the field; the moment
    //   `weapon_range` became a declared resource the demo's gladiators reached
    //   one unit and NO ATTACK WAS EVER ON OFFER in the arena again.
    //
    //   ► ~~"and no bout in the arena ever settled"~~ **FALSE, and withdrawn
    //     2026-09-12 by a write-nothing verifier. Re-measured here before it
    //     was believed** — 24 bouts (1v1/2v2/3v3 x 8 seeds) through
    //     `createVanillaBattleHost`, driving `options[0]`:
    //
    //       weapon_range: 1   24/24 settle, 20,424 actions,   0 attacks
    //       absent (now)      24/24 settle,  2,764 actions, 637 attacks
    //
    //     **Every bout settled either way.** The crowd toll kills them. The
    //     real diagnostic is "0 attacks and seven times the actions", and
    //     saying "never settled" is EXACTLY the reporting error
    //     `ss2WalkDestination`'s own docstring convicts an earlier session of —
    //     "'settle' only because the crowd kills them ... missed by reporting
    //     only what the assertion checked" — committed again, in the same
    //     commit that quoted it.
    //
    //   **IT IS NOT A TEMPLATE CONSTANT ANY MORE: `demoSide` DERIVES IT PER
    //   SLOT** (2026-09-12). Each member has its own `strength`, so the reaches
    //   are 130 / 129 / 129 (strength 9, 8, 7 -> `physical_size` 86, 85, 85) and
    //   no constant is right for all three. ~~"ANY constant here is wrong for
    //   two of the three slots"~~ — **that was wrong too: 129 is wrong for
    //   exactly ONE.**
    //
    //   ► **AND FOR A DAY THE `weapon: 1` ABOVE REACHED NOTHING AT ALL.**
    //     `demoSide` builds with `derive: false`, so `ss2BattleValues` never
    //     runs and the stated id produced no `weapon_range`: every demo
    //     gladiator declared 32 resources and took `ss2Reach`'s bare-hands
    //     fallback. It was invisible because the shop gate at this roster's
    //     speeds (4-7) sells only `[5]` = 1 weapons, so the fallback happened to
    //     equal the right answer — luck, not a contract. `ss2Combatant` now
    //     REFUSES that contradiction outright, and this roster was the live
    //     instance it caught. **A stated derived field that no code reads is not
    //     verified by a green suite — and neither is a stated INPUT that no code
    //     derives from.**
    //     `physical_size` below is the same hazard once more (86 is right at
    //     strength 9, not 87) and is deliberately left alone:
    //     `src/adapter/presentation.js:408` reads it for the clip SCALE, so
    //     changing it changes what the arena looks like.
    weapon_min_damage: 3,
    weapon_max_damage: 8,
    weapon_enchantment_type: 0,
    weapon_enchantment_potency: 0,
    weapon_enchantment_damage: 0,
    // ► **WAS `3` UNTIL 2026-09-13, AND 3 IS NOT A VALUE THIS FIELD HAS.** The
    //   build writes `equipped_weapon` at exactly two sites, both in the
    //   `swap_weapons` toggle, and both write 1 or 2 (`+0x4dbd`, `+0x4eba`).
    //   A 3 was harmless while nothing read it; the ranged vocabulary reads it
    //   as the bow-mode flag (`ss2InBowMode`) and the enchantment selector
    //   already read it as a slot index (`+0x530e`). **A stated field is
    //   harmless right up until something reads it — the fourth time this
    //   roster has taught that lesson**, and the three above it are recorded a
    //   few lines up.
    equipped_weapon: 1,
    using_bow: false,

    breastplate: 3, breastplate_defence: 18,
    helmet: 2, helmet_defence: 12,
    shinguard: 1, shinguard_defence: 4,
    greaves: 2, greaves_defence: 8,
    shoulderguard: 1, shoulderguard_defence: 5,
    gauntlet: 1, gauntlet_defence: 4,
    boot: 2, boot_defence: 5,
    shield: 2, shield_defence: 14,

    physical_size: 87,
    min_damage: 12,
    max_damage: 17,
    movement_speed: 9,
    attack_type: 1,
    attack_speed: 5,

    power_percentage: 40,
    normal_percentage: 60,
    quick_percentage: 80,
    bash_percentage: 55,
    taunt_percentage: 35,
    bombard_percentage: 0,
    snipe_percentage: 0,
    magicka_percentage: 0,
    psyche_up: 0,

    // ► **WAS `0` UNTIL 2026-09-19, AND `0` IS NOT WHAT THE BUILD WRITES FOR AN
    //   EMPTY SLOT.** The build's empty marker is **1**: measured across the
    //   whole oracle, there are fourteen emptiness tests and every one is
    //   `== 1`, every literal write to a slot is 1
    //   (`randomise_gladiator` `+0x330a`-`+0x334b`, `use_item` `+0x0409`, the
    //   hero's own six consume handlers), and there are **zero** writes of 0.
    //   A 0 can only reach a slot through an authored DNA string, which is
    //   where the champion literals put theirs.
    //
    //   It was inert for exactly as long as nothing read the field, and
    //   `inventory1`-`inventory6` became declared resources in the same commit
    //   as this line — **the fifth time this roster has taught that a stated
    //   field is harmless right up until something reads it.** The four before
    //   it are recorded above: `weapon: 3` against the shop gate,
    //   `weapon_range: 1` as a multiplier, the stated id no code derived from,
    //   and `equipped_weapon: 3`.
    //
    //   `psyche_up: 0` above is NOT the same case and must not be "fixed" to
    //   match: it is below the build's floor of 1 DELIBERATELY, the rule set
    //   reconciles it with `Math.max(floor, stated)` at press time, and two
    //   tests pin it by this file's name (`test/ss2-psyche-up.test.js`,
    //   `test/render-stance.test.js`). Nothing pins these six.
    inventory1: 1, inventory2: 1, inventory3: 1,
    inventory4: 1, inventory5: 1, inventory6: 1,
    spell_colossus: 0, spell_bloodlust: 0,
    ...overrides
  };
}

/** Authored so the two sides read differently at a glance, not for balance. */
const RED_NAMES = ["Ruk", "Vasso", "Tarn"];
const BLUE_NAMES = ["Cidra", "Nym", "Orso"];

/**
 * ITEM KITS FOR THE ARENA, added 2026-09-23 so the spells built that week can
 * be SEEN: the demo roster carries empty slots (the build's empty marker, 1),
 * so without a kit no spell or potion is ever offered. Authored groupings,
 * ~~six ids each (six slots)~~ **up to six ids (six slots; `blasts` has two
 * and `doom` one since 2026-09-23)**, by what they show off — not a balance
 * statement. `?items=buffs` in the arena, or ids: `?items=42,41,43`. Every
 * fighter on both sides gets the same kit, so both the player and the AI can
 * use it.
 *
 * ► **A KIT IS MORE THAN ITS ITEMS (2026-09-23): `demoSide` gives every kit
 *   fighter a level-4 magicka and — given the bout's seed — an opener that
 *   alternates by seed parity, and a DAMAGE kit's fighters `battlevalues`'
 *   own pools as well.** See `DEMO_KIT_MAGICKA`, `DEMO_DAMAGE_SPELL_IDS` and
 *   `demoSide`. The owner watched `?items=blasts` and saw "guys dying
 *   immediately after one hit", and a damage kit is where the roster was
 *   that thin.
 *
 * ► **ITEM 49 (death from above) IS `doom`, ON ITS OWN, AND ENDS THE BOUT.**
 *   It stood in `blasts` until 2026-09-23, and so `blasts` showed NOTHING
 *   ELSE: the AI casts it on possession, ladder arm 7, ahead of every other
 *   spell the kit holds (battle map, the ladder table's row
 *   `| **7** | **49** | **cast_death_from_above** | **NONE** |`, and
 *   `chooseAiAction`'s potion walk, `arm > SS2_DEATH_FROM_ABOVE.ladderArm`).
 *   Its 400-800 kills a damage-kit fighter's whole 185-261 pool from
 *   full, so the side that opens wins without the other acting — on every
 *   seed. That is the build's ladder, not a defect; watch it for the
 *   boulders, not for a fight. No other kit may hold 49
 *   (`test/arena-item-kits.test.js`), and a mixed `?items=` list that names
 *   it gets exactly this.
 *
 * ► **`blasts` IS THE TWO LEVEL-4 DAMAGE SPELLS, lightning bolt (34) and
 *   fireball (30), because nothing bigger survives a cast at level 4 —
 *   measured 2026-09-23, main session's call.** The AI prices a damage spell
 *   at its mean and casts the largest, so with the endgame spells in the kit
 *   ~~`blasts` IS STILL A ONE-CAST BOUT~~ every fighter opened with the dire
 *   fireball (300-600), which killed a 185-261 pool from full every time:
 *   2 and 3 actions at 2v2 and 3v3, 25 of 25 seeds. Only 34 (100-200) and 30
 *   (80-160) are level-4 spells in the build's own terms: the random-opponent
 *   generator hands out 34 and 30 from magicka 8 and 10, and 31, 35, 32 from
 *   20, 24 and 30 (battle map, `randomise_gladiator`'s pool,
 *   `+0x3654`-`+0x38fd`). With them, 25 of 25 bouts show both spells cast
 *   and survived.
 *
 *   **A mid-tier kit (35 frightning bolt 200-400, 31 hell fireball 150-450)
 *   was measured and LEFT OUT, because it is not watchable either:** 3.2 and
 *   5.8 mean actions at 2v2 and 3v3, the first kill from full in 22 of 25
 *   bouts, both spells survived in 1 of 25 (the frightning bolt killed from
 *   full 75 times in 102 casts at 3v3). `?items=35,31` still plays it.
 */
export const DEMO_ITEM_KITS = Object.freeze({
  // colossus, bloodlust, swift sandals, boundless energy, regenerate, rejuvenate
  buffs: Object.freeze([42, 41, 40, 45, 46, 43]),
  // lightning bolt, fireball — the level-4 damage spells (see above).
  // ~~frightening bolt, hell fireball, dire fireball, death from above~~ —
  // 49 moved to `doom`, and 35, 31, 32 dropped, 2026-09-23.
  blasts: Object.freeze([34, 30]),
  // gale, teleport, command, whirlwind, ghost strike, weaken armour
  tricks: Object.freeze([38, 48, 39, 37, 36, 44]),
  // adulation, little fat kid, rejuvenate, full-health, full-stamina and full-armour potions
  crowd: Object.freeze([47, 33, 43, 5, 7, 9]),
  // death from above, alone: it ENDS THE BOUT (see above)
  doom: Object.freeze([49])
});

/**
 * THE MAGICKA A KIT FIGHTER CASTS WITH, added 2026-09-23. The plain roster's
 * `magicka: 0` made every spell FREE — `staminacost = round(magicka)` on every
 * cast arm (battle map, §"`staminacost` by phase", `+0x7567` through
 * `+0x8fa7`) — so a cast was the one action that cost nothing and nobody could
 * see it being paid for. At 12 each cast costs 12 stamina, less `nextphase`'s
 * `1 + round(stamina / 3)` = 3 back.
 *
 * **Why 12, and how far that is sourced:**
 * - A generated level-4 opponent has `statpoints = ceil(4 * 5) - 8 = 12` to
 *   spread over eight stats all seeded at 1 (`randomise_gladiator` `+0x24a6`,
 *   `+0x24fe`-`+0x2565`; `docs/integration/ss2-arena-route.md` §"Opponent
 *   generation for a duel"), so its magicka is at least 1 and — IF the
 *   distribution loop spends exactly its 12 points, which the docs do not
 *   transcribe and this was not re-derived — at most 13. 12 is inside that,
 *   at its top.
 * - The generator's spell pool (battle map, `+0x3654`-`+0x38fd`) is
 *   cumulative on magicka, and 12 is the step that adds weaken armour (44)
 *   and the full-armour potion (9); by 12 it also holds the lightning bolt
 *   (34), fireball (30), whirlwind (37), command (39), teleport (48),
 *   adulation (47), swift sandals (40) and potions 2, 3, 5, 6 and 7.
 *
 * Magicka decides nothing else in the engine: grep `stats.magicka` in
 * `src/team/ss2-rules.js` and every read is a `staminaCost`, apart from the
 * projection back onto the vanilla record. The AI does not price stamina, so
 * this moves no choice directly — only what a cast costs, and what a tired
 * caster then does.
 */
export const DEMO_KIT_MAGICKA = 12;

/**
 * The DAMAGE spells, by item id: the bolts (34, 35), the fireballs (30, 31,
 * 32) and death from above (49). A kit holding any of them is a DAMAGE KIT,
 * and only a damage kit's fighters take `battlevalues`' pools (`demoSide`).
 * Named, not written as the range 30-35: 33 is little fat kid, which `crowd`
 * holds. `test/arena-item-kits.test.js` checks this list against the engine's
 * own spell tables (`SS2_BOLT_SPELLS`, `SS2_FIREBALL_SPELLS`,
 * `SS2_DEATH_FROM_ABOVE`).
 */
export const DEMO_DAMAGE_SPELL_IDS = Object.freeze([34, 35, 30, 31, 32, 49]);

/** The eight pieces `battlevalues` prices, whose `_defence` a damage-kit fighter takes from it. */
const DEMO_KIT_PIECES = Object.freeze([
  "breastplate", "helmet", "shinguard", "greaves", "shoulderguard", "gauntlet", "boot", "shield"
]);

/**
 * The `items` parameter as up to six inventory ids: comma-separated kit names
 * and/or integer ids, in order, the first six kept. Anything else is refused
 * loudly — a typo that silently gave nobody anything would look like a broken
 * spell.
 */
export function demoItemsFrom(spec) {
  if (spec == null || spec === "") return [];
  const ids = [];
  for (const token of String(spec).split(",").map((part) => part.trim()).filter(Boolean)) {
    if (Object.hasOwn(DEMO_ITEM_KITS, token)) ids.push(...DEMO_ITEM_KITS[token]);
    else if (/^\d+$/.test(token) && Number(token) >= 2) ids.push(Number(token));
    else {
      throw new Error(
        `items=${spec}: "${token}" is neither a kit (${Object.keys(DEMO_ITEM_KITS).join(", ")}) nor an item id >= 2 ` +
        "(1 is the build's EMPTY marker)."
      );
    }
  }
  return ids.slice(0, 6);
}

/**
 * THE SEED A DEMO LOOK IS DRAWN FROM WHEN THE CALLER GIVES NONE — the arena's
 * own default bout seed (`tools/arena/main.js`: `Number(params.get("seed")) ||
 * 7`), so a caller that passes nothing sees what the arena shows by default.
 */
export const DEMO_LOOK_DEFAULT_SEED = 7;

/**
 * ONE DEMO GLADIATOR'S LOOK, added 2026-09-24: `randomise_gladiator`'s own
 * four draws (`generatedSs2Look` in `src/render/appearance.js`), from a stream
 * seeded by the BOUT'S seed and the SLOT — so a bout looks the same every time
 * it is replayed, two slots never share a stream, and a 1v1's `red-1` looks
 * like the 3v3's `red-1` on the same seed.
 *
 * ► **ITS OWN STREAM, NEVER THE BATTLE'S.** A draw from the battle's ordered
 *   channel would move its cursor and with it every hash the bout produces.
 *   This is a separate `createOrderedRngChannel` (the repository's seeded
 *   generator, not `Math.random`) that nothing else reads, seeded by
 *   `fnv1a("demo-look|<seed>|<side>|<slot>")`.
 *
 * ► **AND THE VILLAIN BRANCH'S ONE LOOK RULE IS APPLIED**: a gladiator whose
 *   helmet is above 1 gets `hairstyle 0` (`+0x2aac`) — bald under the helmet,
 *   as the build's own generated opponents are, which shows only if the helmet
 *   is knocked off. The helmet is the roster's and is not touched.
 */
export function demoLookFor(side, slotIndex, seed = DEMO_LOOK_DEFAULT_SEED, { helmet = null } = {}) {
  const channel = createOrderedRngChannel({
    seed: Number.parseInt(fnv1a(`demo-look|${seed}|${side}|${slotIndex}`), 16),
    journal: false
  });
  return generatedSs2Look((upperExclusive) => channel.randomNumber("demo_look", upperExclusive), { helmet });
}

/**
 * Builds one side's members in the shape the host takes.
 *
 * `resources` is the OPT-IN SS2 resource bag. It is declared here rather than
 * left to default because `ss2TeamRules` refuses to swing for a combatant that
 * has not declared `min_damage`/`max_damage` — it would otherwise silently
 * default them and fight a different gladiator. `derive: false` keeps the
 * stated values instead of letting `battlevalues` recompute them over the top.
 * *(This paragraph sat orphaned above `DEMO_ITEM_KITS` from 5322ce4, which put
 * the kits between it and this function, until the kits learned pools the
 * same day; moved back to the function it describes.)*
 *
 * @param {"red"|"blue"} side
 * @param {number} size one to three
 * @param {object} deps
 * @param {Function} deps.ss2Combatant
 * @param {Function} deps.ss2BattleValues
 * @param {number[]} [deps.items] a kit (`demoItemsFrom`). EMPTY is the plain
 *   roster, byte for byte. NON-EMPTY is a KIT FIGHTER: `DEMO_KIT_MAGICKA` and
 *   the seed-parity opener below — and, if it holds any of
 *   `DEMO_DAMAGE_SPELL_IDS`, `battlevalues`' own pools.
 * @param {number|null} [deps.seed] the bout's seed. For COMBAT it is read ONLY
 *   for a kit, and only for which side opens: on an even seed the +1 speed is
 *   blue's. Pass the same seed to both sides, as the arena does. **Since
 *   2026-09-24 it also seeds each member's LOOK** (`demoLookFor`; absent, the
 *   arena's default 7), which is presentation and reaches no combat number.
 *
 * Each member carries `appearance` — its look, BESIDE `vanilla` and
 * `resources` and never in them, so nothing the host builds or hashes sees it.
 */
export function demoSide(side, size, { ss2Combatant, ss2BattleValues, items = [], seed = null }) {
  const slots = Object.fromEntries(items.slice(0, 6).map((id, index) => [`inventory${index + 1}`, id]));
  const names = side === "red" ? RED_NAMES : BLUE_NAMES;
  const facing = side === "red" ? "right" : "left";
  const kit = items.length > 0;
  const damageKit = items.some((id) => DEMO_DAMAGE_SPELL_IDS.includes(id));
  // ► **WHICH SIDE OPENS, AND WHY A KIT BOUT ALTERNATES IT (2026-09-23).** The
  //   +1 speed below makes red's head the fastest gladiator on the field, and
  //   `ss2InitiativeOrder` lets that side open. Harmless in a plain bout; in a
  //   kit bout whose first cast kills (`doom`, and `blasts` while it held the
  //   endgame spells) it handed RED EVERY SEED — 25 of 25 at 2v2 and 3v3, blue
  //   taking 0 actions.
  //   So in a kit bout the +1 is blue's on an even seed. The speeds are the
  //   same multiset either way (7/6/5 and 6/5/4), so neither side is built
  //   stronger; only who moves first changes. The plain roster, and a kit
  //   built with no seed, keep red's.
  const fastSide = kit && Number.isInteger(seed) && seed % 2 === 0 ? "blue" : "red";
  return {
    id: side,
    name: side === "red" ? "Red" : "Blue",
    members: Array.from({ length: size }, (unused, index) => {
      const id = `${side}-${index + 1}`;
      const name = names[index] ?? id;
      // ► **SLOT 2 OF EACH SIDE CARRIES A BOW, ADDED 2026-09-13 WITH THE
      //   RANGED VOCABULARY — and it is slot 2 rather than slot 3 on purpose.**
      //
      //   Ranks are assigned by slot index, so slot 2 stands one rank back:
      //   behind its own front line, level with the enemy archer, and with a
      //   rank between it and the enemy's front. That is the geometry every
      //   part of the ranged rules has to answer for at once — the minimum
      //   range, the Euclidean distance across ranks, and the authored
      //   line-of-sight rule. Slot 3 would only appear in a 3v3; slot 2 shows
      //   up in a 2v2 as well, so the arena has an archer in it more often
      //   than not.
      //
      //   **It carries a sword too, and starts holding the sword** —
      //   `equipped_weapon` 1, as root frame 221 forces for everyone. Drawing
      //   the bow is a turn it has to spend, which is the owner's decision of
      //   2026-09-13 and is the build's own answer. Watch for it on turn one:
      //   nothing is in reach at the opening separation of 500, so the AI's one
      //   voluntary swap fires instead of a step.
      //
      //   Weapon 61 is the cheapest ranged row and the gate is `speed >= 3`
      //   (`3 * band_position`, band position 1); this slot runs speed 4 or 5,
      //   so it is gear the shop would actually have sold it — which the
      //   primary weapon above was changed for on 2026-09-10 for the same
      //   reason.
      const archer = index === 1;
      // ► **SLOT 3 IS THE DUELLIST, ADDED 2026-09-18, AND IT EXISTS BECAUSE A
      //   CORRECT POLICY WITH NOBODY TO EXPRESS IT IS THE `aiCharges` FAILURE
      //   AGAIN.**
      //
      //   `chooseAiAction` prices a taunt in hitpoints now and takes it when it
      //   beats the swing the gladiator is walking toward (`ss2TauntValue`).
      //   Measured on this roster BEFORE this line existed, 25 seeded 3v3 bouts
      //   through `createVanillaBattleHost`: **taunt offered 926 times, taken
      //   5.** The policy was right and the roster could not express it —
      //   exactly what the 2026-09-18 audit found about the melee band ranking,
      //   in the same file, for the same reason.
      //
      //   **`charisma` is the only stat that drives a taunt and it drives
      //   nothing else.** Grepped, not assumed: across `ss2-rules.js` and
      //   `ss2-attack-candidate.js` it appears in the chance
      //   (`(attacker.charisma + 9) / (defender.charisma + 9)`), the
      //   direction-20 strike (`round(charisma * 4) - defender.charisma`), the
      //   taunt's own stamina cost (`round(charisma * 2)`) and the shove force
      //   (`charisma * 25`). ~~Nothing else reads it~~ **— and, since
      //   2026-09-23, the `wincrowd` verb's crowd delta, `round(charisma / 2)`
      //   of the actor (a crowd number, not a combat one) —** so this raises a
      //   taunt and a crowd-pleaser and moves no other combat number — unlike
      //   `strength`, which would move
      //   `physical_size` and therefore reach, scale and the walk clamp.
      //
      //   **16 is chosen against a sweep, not picked.** Slot-3 charisma over
      //   12 seeded 3v3 bouts, everything else the roster's own:
      //
      //   ```text
      //      charisma   taunts taken / offered   from slot 3   bout length
      //          6              1 / 444                 0           82
      //         10             21 / 462                20           84
      //         12             20 / 470                19           87
      //         14             20 / 467                19           86
      //         16             69 / 433                61           88
      //         20             55 / 400                49           75
      //   ```
      //
      //   12/12 bouts settle at every value. ~~16 is the first that makes the
      //   verb a CHARACTER — about five taunts a bout, 61 of 69 of them this
      //   slot's — for 7% longer bouts.~~ **It is the roster's number and not the
      //   engine's**: every other slot keeps charisma 6 and never taunts, which
      //   is the point. Three gladiators who fight differently.
      //
      //   ► **THE SWEEP ABOVE IS STALE ONCE TAUNTS ARE OWN-RANK ONLY (owner,
      //     2026-09-23; the offer change is `ss2-rules.js`', landing with or
      //     before this note).** It was measured while a taunt was offered at
      //     any range and any rank, so "about five taunts a bout" described an
      //     offer that no longer exists; the brief that carried the rule
      //     expected the duellist to taunt rarely in team play after it.
      //     ~~**Not re-measured here** — the rule was not in this tree. Re-run
      //     the sweep before trusting 16, or any claim about how often slot 3
      //     taunts.~~
      //
      //   ► **RE-MEASURED 2026-09-23, AND 16 NO LONGER MAKES SLOT 3 A
      //     CHARACTER IN TEAM PLAY — NOR DOES ANY CHARISMA.** Same sweep (slot
      //     3 on BOTH sides, seeds 1-12, the arena's own host), on the tree
      //     that prices a taunt at the foe in the taunter's own rank
      //     (`nearestTauntableFoe` in `ss2-rules.js`):
      //
      //     ```text
      //        charisma   taunts taken / offered   from slot 3   bout length
      //            6              2 / 422                 0           90
      //           10              2 / 412                 0           88
      //           12              2 / 403                 0           89
      //           14              4 / 418                 2           90
      //           16              5 / 407                 3           90
      //           20              4 / 415                 2           91
      //           24              5 / 440                 3           94
      //     ```
      //
      //     (The same script at 2690559, before the rule, gives 68 / 457 and
      //     61 from slot 3 at charisma 16 and 54 / 449 and 48 at 20 — taken
      //     and from-slot-3 within one of the old rows — but 10 and 8 at each
      //     of 10-14, where the old table has 20-21 and 19-20; the engine has
      //     moved since 2026-09-18.)
      //     12/12 settle everywhere; 25 seeds give the same shape (0-3 from
      //     slot 3 at every value).
      //     **The cause is the ROSTER'S GEOMETRY, not the AI.** Ranks go by
      //     slot, so the two slot-3s open in the same rank (y 6) and the only
      //     foe a duellist may taunt is the other duellist. At equal charisma a
      //     taunt lands 40% of the time and, unwounded, is worth 3.84 hitpoints
      //     against an approach worth 11.88. On the plain 3v3, seeds 1-25, the
      //     duellist is offered a taunt on 253 decisions; on 250 the only
      //     tauntee is the other duellist and it declines all 250. Every one of
      //     the 122 taunts it took at 2690559 was across a rank, at a
      //     charisma-6 foe. Give the OTHER side's slot 3 charisma 6 and red's
      //     duellist taunts it 60 times in those 25 bouts (17 without the
      //     pricing fix). What to do about it — ranks that do not mirror, a
      //     duellist on one side, or nothing — is the owner's.
      //     (Scripts: the 2026-09-23 taunt-pricing agent's scratchpad; not
      //     committed.)
      //
      //   ► **AND ITS STRIKE CAN KILL A 46-HITPOINT GLADIATOR FROM FULL
      //     (measured 2026-09-23).** The direction-20 strike is
      //     `round(16 * 4) - 6` = 58 (`src/golden/ss2-attack-candidate.js`,
      //     direction 20); once the armour has been stripped to 12 or less
      //     (58 - 12 = 46), one taunt kills the plain roster's 46 hitpoints
      //     from full. `tricks` and `crowd` keep those 46 (see "A DAMAGE-KIT
      //     FIGHTER TAKES ITS POOLS" below), so they keep this: 22 and 5 such
      //     deaths over 25 seeded 3v3 bouts (and 1 on the plain roster). A
      //     damage-kit fighter has 140 and cannot die of it from full.
      //     (Measured before the own-rank rule, like the sweep. **Re-measured
      //     after it, same 25 seeds: 2 in `tricks`, 0 in `crowd`, 0 plain** —
      //     both of the 2 by slot 3, on a victim at full health.)
      const duellist = index === 2;
      const vanilla = demoGladiator({
        ...slots,
        character_name: name,
        ...(duellist ? { charisma: 16 } : {}),
        ...(kit ? { magicka: DEMO_KIT_MAGICKA } : {}),
        // A little spread so initiative is not a coin flip and the slots are
        // visibly different fighters. `fastSide` is red except in an
        // even-seeded kit bout (above).
        speed: 6 + (side === fastSide ? 1 : 0) - index,
        strength: 9 - index,
        breastplate: 3 - index,
        helmet: 2 - index,
        shield: index === 0 ? 2 : 0,
        ...(archer ? { secondary_weapon: 61 } : {})
      });
      // ► **`weapon_range` IS DERIVED PER SLOT, and `derive: false` is why it
      //   has to be (2026-09-12).** These members state `weapon: 1` and build
      //   with `derive: false`, so `ss2BattleValues` never runs and the weapon
      //   id — which is equipment identity and does not survive into the
      //   resolver — would reach the fight as nothing at all. `ss2Combatant`
      //   now REFUSES that contradiction rather than silently handing the
      //   gladiator bare hands, and this roster was the live instance of it.
      //
      //   One field is taken from the derivation and the rest is discarded, so
      //   the stated `min_damage`, `max_damage`, `hitpointsmax` and
      //   `staminamax` above are still the roster's own and are not recomputed
      //   — which is the whole reason `derive: false` is passed below.
      //   **— except a DAMAGE-kit fighter's `hitpointsmax` (and the rest of
      //   its hitpoint and armour pools), which since 2026-09-23 ARE the
      //   derivation's; see "A DAMAGE-KIT FIGHTER TAKES ITS POOLS" below.**
      //   Per SLOT, not per template: each member has its own `strength`, so
      //   the reaches are 130 / 129 / 129 and no constant is right for all
      //   three.
      // ► **`physical_size` IS DERIVED PER SLOT TOO (2026-09-12), for the same
      //   reason and after the same hazard.** The template states 87, which is
      //   wrong at every strength this roster actually uses (9, 8, 7 give 86,
      //   85, 85) and was left alone while the only consumer was a clip scale
      //   nothing read. `tools/arena/main.js` now DOES read it — via
      //   `figureScaleFor` — so a stale constant here makes three visibly
      //   different gladiators draw at one size, defeating the thing it feeds.
      //   **A stated derived field is harmless right up until something reads
      //   it**, which is the third time this roster has taught that lesson.
      // ► **AND THE BOW'S FIVE NUMBERS COME FROM THE SAME DERIVATION, FOR THE
      //   SAME REASON AND AFTER THE SAME HAZARD (2026-09-13).** `derive: false`
      //   keeps this roster's stated damage and pools, and it also means a
      //   stated `secondary_weapon: 61` reaches the resolver as nothing at all
      //   — the id is equipment identity and does not survive. Without these
      //   five the archer would build, be offered no swap (a
      //   `secondary_weapon_range` of 0 reads as "no bow"), and fight the whole
      //   bout with a sword while the record said it carried a bow. **Silently**
      //   — which is the failure mode `weapon_range` had here on 2026-09-11 and
      //   `physical_size` had on 2026-09-12.
      //
      //   `maximum_ammo` is tiered on `herolevel`, which is 4 for every member
      //   of this roster, so all five arrows come from the level-under-9 arm.
      // ► **A DAMAGE-KIT FIGHTER TAKES ITS POOLS FROM THE SAME DERIVATION
      //   (2026-09-23) — hitpoints and armour, and nothing else.** The stated
      //   46 hitpoints and 38 armour are this file's invention; `battlevalues`
      //   gives these same stats and pieces `hitpointsmax = herolevel * 10 +
      //   vitality * 20` = 140 and, by slot, armour 121 / 71 / 45 (the eight
      //   `round(id * dval)`; `test/arena-item-kits.test.js` works them by
      //   hand). An 84-point pool sat under the low end of every damage
      //   spell's roll, so with a damage spell in the kit the first cast
      //   killed. Damage, stamina, reach and speed stay the plain roster's, so
      //   the ONLY differences are the slots, these pools and
      //   `DEMO_KIT_MAGICKA`.
      //
      //   ~~**Kit fighters only**~~ **DAMAGE-KIT FIGHTERS ONLY (main session,
      //   2026-09-23), a trade the numbers forced.** Given to EVERY kit first,
      //   and measured over seeds 1-25: `buffs`, `tricks` and `crowd` were
      //   already watchable on the stated pools (most of their spells cast and
      //   survived in 25 of 25 bouts) and the pools only made them 2-5x longer
      //   (mean actions, 3v3: buffs 143 -> 393, tricks 202 -> 997, crowd 217
      //   -> 446). What that bought them — no death from full health (3v3,
      //   as the kits now stand: 22 in tricks and 5 in crowd, every one a
      //   taunt) — they give back: the
      //   stated 46 is theirs again, as it is the plain roster's, byte for
      //   byte. The damage kits keep the pools, because at 84 the lightning
      //   bolt (100-200) killed from full on every cast — `blasts` was 2 and 3
      //   actions at 2v2 and 3v3, 75 of 75 casts at 3v3 — and at 185-261 the
      //   fireball never does and the bolt rarely does (see the table in
      //   `DEMO_ITEM_KITS`).
      const derived = ss2BattleValues(vanilla);
      const priced = {
        ...vanilla,
        weapon_range: derived.weapon_range,
        physical_size: derived.physical_size,
        ...(archer
          ? {
            secondary_weapon_range: derived.secondary_weapon_range,
            secondary_weapon_min_damage: derived.secondary_weapon_min_damage,
            secondary_weapon_max_damage: derived.secondary_weapon_max_damage,
            maximum_ammo: derived.maximum_ammo,
            ammo_left: derived.ammo_left
          }
          : {}),
        ...(damageKit
          ? {
            hitpoints: derived.hitpoints,
            hitpointsmax: derived.hitpointsmax,
            armourclass: derived.armourclass,
            armourclass_max: derived.armourclass_max,
            ...Object.fromEntries(DEMO_KIT_PIECES.map((piece) => [`${piece}_defence`, derived[`${piece}_defence`]]))
          }
          : {})
      };
      const canonical = ss2Combatant(priced, { id, name, controller: "local", derive: false });
      return {
        id,
        controller: "local",
        vanilla: priced,
        resources: canonical.resources,
        clip: { gladiator_dir: facing },
        appearance: demoLookFor(side, index, Number.isInteger(seed) ? seed : DEMO_LOOK_DEFAULT_SEED, { helmet: priced.helmet })
      };
    })
  };
}

/* ------------------------------------------------------------------ */
/* The build's own champions, from the player's extracted pack          */
/* ------------------------------------------------------------------ */

/** Where the arena finds the pack, and the one command that makes it. */
export const CHAMPION_PACK_URL = "/assets/champions/champions.json";
export const CHAMPION_PACK_COMMAND = "node tools/extract-champions.mjs";

/** Three a side: the arena's rosters and its rank geometry are built for at most three. */
const CHAMPIONS_PER_SIDE = 3;

/**
 * `?red=2,4,16&blue=1,3,10` — which `unleash_hell` champion stands in each
 * slot, by `which_boss`, one to three a side, in slot order. Repeats are
 * allowed (three of one champion is a fair thing to watch).
 *
 * Returns `null` when neither parameter is present, which is today's arena
 * exactly. Everything else that is not a well-formed request is refused
 * loudly, naming the parameter at fault, for the reason `demoItemsFrom`
 * gives: a typo that silently fielded somebody else would look like a
 * champion playing badly.
 *
 * - Both sides must be named: half a champion bout is not a thing to guess.
 * - `items=` is refused alongside: a kit is the DEMO roster's, and a champion
 *   carries its own inventory out of its DNA (indices 34-39).
 * - `teams=` is ignored: each side's size is its list's length.
 *
 * Whether a number is a champion at all is the PACK's to say, not this
 * function's — the extractor finds the branches, and no range is written here.
 */
export function championRequestFrom(params) {
  const has = (name) => Boolean(params) && typeof params.has === "function" && params.has(name);
  if (!has("red") && !has("blue")) return null;
  for (const [present, missing] of [["red", "blue"], ["blue", "red"]]) {
    if (has(present) && !has(missing)) {
      throw new Error(
        `${present}= names champions for one side and ${missing}= names none. Name both, e.g. ?red=2,4,16&blue=1,3,10.`
      );
    }
  }
  if (has("items")) {
    throw new Error(
      `items=${params.get("items")} gives the DEMO roster a kit; a champion carries its own inventory from its DNA. ` +
      "Drop items= to watch champions, or drop red=/blue= to use the kit."
    );
  }
  const side = (name) => {
    const raw = String(params.get(name) ?? "");
    if (raw.trim() === "") throw new Error(`${name}= is empty; give one to three which_boss numbers, e.g. ${name}=2,4,16.`);
    const tokens = raw.split(",").map((token) => token.trim());
    const refused = tokens.find((token) => !/^\d+$/.test(token));
    if (refused !== undefined) {
      throw new Error(
        `${name}=${raw}: ${JSON.stringify(refused)} is not a which_boss number (a whole number, as unleash_hell tests it).`
      );
    }
    if (tokens.length > CHAMPIONS_PER_SIDE) {
      throw new Error(`${name}=${raw} names ${tokens.length} champions; a side holds at most ${CHAMPIONS_PER_SIDE}.`);
    }
    return tokens.map(Number);
  };
  return { red: side("red"), blue: side("blue") };
}

/**
 * THE ROSTER THE QUERY STRING ASKS FOR — the arena's one reader of `red=`,
 * `blue=` and `items=`, in that order.
 *
 * ► **CHAMPIONS FIRST, AND THE ORDER IS THE FIX (Codex review, 2026-09-23).**
 *   The shell used to parse `items=` at module initialisation, before it had
 *   looked for champions at all, so `?red=1&blue=2&items=typo` died in
 *   `demoItemsFrom` at the top level and the champion refusal of `items=`
 *   never ran — the page sat on "loading…" with the reason in the console.
 *   Reading champions first makes that URL the champion refusal it is, and
 *   putting both readers behind this one call lets the shell catch EVERY
 *   refusal, a bad kit on its own included, and show it on the page.
 *
 * @returns {{kind: "champions", red: number[], blue: number[]} | {kind: "demo", items: number[]}}
 */
export function arenaRequestFrom(params) {
  const champions = championRequestFrom(params);
  if (champions !== null) return { kind: "champions", ...champions };
  const items = params && typeof params.get === "function" ? params.get("items") : null;
  return { kind: "demo", items: demoItemsFrom(items) };
}

/**
 * One side of the build's own champions, in the shape the host takes.
 *
 * Each member is its `unleash_hell` branch run through the build's own chain:
 * `initcharacter` decodes the DNA (`ss2ChampionFromDna`), `battlevalues`
 * prices it (`ss2BattleValues`), and `ss2Combatant` enters it by the route
 * the build gave it — `weaponFrom: "unleash_hell"`, because a champion's
 * weapon was never bought and the shop's stat gate would refuse some of them.
 *
 * ► **PRICED ONCE, BUILT WITH `derive: false` — `demoSide`'s convention, for a
 *   different reason.** `demoSide` passes `derive: false` to keep its AUTHORED
 *   damage and pools from being recomputed. A champion has nothing authored:
 *   every number is the build's derivation. So the one `ss2BattleValues` run
 *   IS the champion, and both the host's vanilla mirror and the resource bag
 *   are cut from it — a second derivation inside `ss2Combatant` could only
 *   ever agree or introduce a disagreement.
 *
 * ► **A SECONDARY SLOT OF 0 IS "NO SECONDARY WEAPON"** ~~**, AND IS NOT
 *   STATED.**~~ **— AND SINCE 2026-09-23 IT IS STATED, AS THE DNA HAS IT.** Both
 *   of the build's readers test the id: the hero's swap button hides on
 *   `secondary_weapon == 0` (sprite 862 `DoAction@0x2378cc` `+0x0e77`-`+0x0e89`)
 *   and the villain's voluntary swap requires `secondary_weapon != 0`
 *   (`villainChooseAction` `+0x0f14`-`+0x0f27`). ~~This engine instead reads
 *   `secondary_weapon_range > 0` as owning a bow … Leaving the id out is what
 *   the build's readers mean by 0. **This is a WORKAROUND, and it can go when
 *   the engine fix lands.**~~ **The engine fix landed in 731ef20:**
 *   `legalActions` now asks `secondary_weapon !== 0` as well as the reach, so
 *   the workaround that deleted a stated 0 is gone. `ss2BattleValues` still
 *   prices the 0 as weapon ROW 0 (`+0x32aa`, unguarded, as the build does), so
 *   the bag carries `secondary_weapon: 0` beside row 0's pair (1-3) and a reach
 *   of `physical_size + 44`; the id is what says "no bow".
 *
 *   ► **AND THE WORKAROUND WAS HIDING A BUILD NUMBER, NOT ONLY THE PHANTOM
 *     BOW — measured when it went, 2026-09-23.** Deleting the id also
 *     unpriced the secondary pair, so `secondary_weapon_enchantment_damage =
 *     ceil(secondary_weapon_max_damage / 3 * potency)` (`+0x3326`) came out 0
 *     for every 0-secondary champion. Priced from row 0 (max 3) it is the
 *     DNA's own potency: 1 for `which_boss` 3 and **61 for `which_boss` 12**.
 *     The enchantment tick reads that field whenever its VICTIM is not
 *     holding weapon 1 (`resolveStatusPhase`, `victim.equipped_weapon === 1 ?
 *     "weapon_enchantment_damage" : "secondary_weapon_enchantment_damage"`),
 *     so which_boss 12's poison now ticks 61 into a gladiator with its bow
 *     drawn, where it ticked 0. Over every ordered 1v1 pair of the 18
 *     buildable champions plus six 3v3s, seeds 1-3 (1,011 bouts): **20 bouts'
 *     actions change, every one of them which_boss 12 against an archer
 *     (4, 6, 9, 11)**, and 819 bouts' state hashes move (the bag). No test
 *     pins a champion hash, so no pin moved.
 *
 * ► **A BOW DRAWN FROM THE DNA IS A PROPER ARCHER (owner, 2026-09-23).** Three
 *   of the build's champions carry `equipped_weapon` 2 with `using_bow` never
 *   written — a split state the engine does not represent. The owner decided
 *   they are NORMALISED to the engine's single bow flag, `equipped_weapon`,
 *   which index 49 already sets; nothing here writes `using_bow`, and
 *   `test/ss2-champion-dna.test.js` pins the engine's reading.
 *
 * FAILS LOUDLY, NAMING THE CHAMPION. A number the pack does not hold, the
 * branch that copies the hero (it has no DNA of its own), a DNA the extractor
 * could not split, anything `ss2Combatant` refuses, and — when `admitResource`
 * is given (the arena passes the adapter's `citationFor`) — any resource the
 * host would refuse: each is an error that starts with `which_boss N`, because
 * the host's own refusal names only a slot id.
 *
 * @param {"red"|"blue"} side
 * @param {number[]} whichBossList one to three `which_boss` numbers, slot order
 * @param {object} deps
 * @param {Function} deps.ss2Combatant
 * @param {Function} deps.ss2BattleValues
 * @param {object} deps.pack the parsed `champions.json`
 * @param {(name: string) => unknown} [deps.admitResource] truthy for a
 *   resource name the host accepts
 */
export function championSide(side, whichBossList, { ss2Combatant, ss2BattleValues, pack, admitResource = null }) {
  if (!pack || !Array.isArray(pack.champions)) {
    throw new Error(
      `There is no champion pack at ${CHAMPION_PACK_URL}. The champions are the build's own and this repository ships ` +
      `none of them: run ${CHAMPION_PACK_COMMAND} against your own install to extract them, then reload.`
    );
  }
  if (!Array.isArray(whichBossList) || whichBossList.length === 0) {
    throw new Error(`${side} needs at least one champion.`);
  }
  if (whichBossList.length > CHAMPIONS_PER_SIDE) {
    throw new Error(`${side} names ${whichBossList.length} champions; a side holds at most ${CHAMPIONS_PER_SIDE}.`);
  }
  const facing = side === "red" ? "right" : "left";
  return {
    id: side,
    name: side === "red" ? "Red" : "Blue",
    members: whichBossList.map((whichBoss, index) => {
      const id = `${side}-${index + 1}`;
      const entry = pack.champions.find((candidate) => candidate?.whichBoss === whichBoss);
      if (!entry) {
        const held = pack.champions.map((candidate) => candidate?.whichBoss).filter(Number.isInteger);
        throw new Error(`which_boss ${whichBoss} is not in the pack (it has ${held.join(", ")}).`);
      }
      const label = `which_boss ${whichBoss}${typeof entry.name === "string" ? ` (${entry.name})` : ""}`;
      if (!Array.isArray(entry.dna)) {
        if (typeof entry.dnaFrom === "string" && entry.dnaFrom !== "literal") {
          throw new Error(
            `which_boss ${whichBoss} has no DNA of its own: unleash_hell writes ${entry.dnaFrom} — the hero's — so it ` +
            "is a mirror of whoever is playing, and a champion bout has no hero to mirror."
          );
        }
        throw new Error(
          `${label}: its DNA could not be decoded at extraction (see assets/champions/manifest.json, failures).`
        );
      }
      let priced;
      let canonical;
      try {
        const record = ss2ChampionFromDna(entry.dna);
        // ~~TEMPORARY (2026-09-23): a WORKAROUND for the engine reading a stated
        // secondary weapon 0 as a bow … `if (record.secondary_weapon === 0)
        // delete record.secondary_weapon;`~~ **REMOVED 2026-09-23: the engine
        // fix landed (731ef20), so the DNA's 0 enters as stated.** See this
        // function's header.
        priced = {
          ...ss2BattleValues(record),
          character_name: typeof entry.name === "string" ? entry.name : `which_boss ${whichBoss}`
        };
        canonical = ss2Combatant(priced, {
          id, name: priced.character_name, controller: "local", derive: false, weaponFrom: "unleash_hell"
        });
      } catch (error) {
        throw new Error(`${label} cannot be built: ${error.message}`);
      }
      if (typeof admitResource === "function") {
        const refused = Object.keys(canonical.resources).filter((name) => !admitResource(name));
        if (refused.length > 0) {
          throw new Error(
            `${label} cannot enter the arena host: its resource bag declares ${refused.join(", ")}, which no ` +
            "battle-map section cites, and the adapter refuses an uncited resource. The champion builds; the " +
            "host is what cannot take it yet."
          );
        }
      }
      return {
        id,
        controller: "local",
        vanilla: priced,
        resources: canonical.resources,
        clip: { gladiator_dir: facing },
        whichBoss,
        // ► **THE CHAMPION'S OWN LOOK, from its own DNA (2026-09-24)** —
        //   indices 1-5, decoded beside the combat record and never into it,
        //   with `features` derived from the skin as `initcolour` derives it
        //   (so three champions do NOT wear their DNA's index 3). Presentation
        //   only: `vanilla` and `resources` are exactly what they were.
        appearance: ss2LookFrom(ss2ChampionAppearanceFromDna(entry.dna))
      };
    })
  };
}
