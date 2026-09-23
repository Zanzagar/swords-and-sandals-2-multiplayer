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
 */

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
 * Builds one side's members in the shape the host takes.
 *
 * `resources` is the OPT-IN SS2 resource bag. It is declared here rather than
 * left to default because `ss2TeamRules` refuses to swing for a combatant that
 * has not declared `min_damage`/`max_damage` — it would otherwise silently
 * default them and fight a different gladiator. `derive: false` keeps the
 * stated values instead of letting `battlevalues` recompute them over the top.
 */
/**
 * ITEM KITS FOR THE ARENA, added 2026-09-23 so the spells built that week can
 * be SEEN: the demo roster carries empty slots (the build's empty marker, 1),
 * so without a kit no spell or potion is ever offered. Authored groupings, six
 * ids each (six slots), by what they show off — not a balance statement.
 * `?items=buffs` in the arena, or ids: `?items=42,41,43`. Every fighter on both
 * sides gets the same kit, so both the player and the AI can use it.
 */
export const DEMO_ITEM_KITS = Object.freeze({
  // colossus, bloodlust, swift sandals, boundless energy, regenerate, rejuvenate
  buffs: Object.freeze([42, 41, 40, 45, 46, 43]),
  // lightning bolt, frightening bolt, fireball, hell fireball, dire fireball, death from above
  blasts: Object.freeze([34, 35, 30, 31, 32, 49]),
  // gale, teleport, command, whirlwind, ghost strike, weaken armour
  tricks: Object.freeze([38, 48, 39, 37, 36, 44]),
  // adulation, little fat kid, rejuvenate, full-health, full-stamina and full-armour potions
  crowd: Object.freeze([47, 33, 43, 5, 7, 9])
});

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

export function demoSide(side, size, { ss2Combatant, ss2BattleValues, items = [] }) {
  const slots = Object.fromEntries(items.slice(0, 6).map((id, index) => [`inventory${index + 1}`, id]));
  const names = side === "red" ? RED_NAMES : BLUE_NAMES;
  const facing = side === "red" ? "right" : "left";
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
      //   12/12 bouts settle at every value. 16 is the first that makes the
      //   verb a CHARACTER — about five taunts a bout, 61 of 69 of them this
      //   slot's — for 7% longer bouts. **It is the roster's number and not the
      //   engine's**: every other slot keeps charisma 6 and never taunts, which
      //   is the point. Three gladiators who fight differently.
      const duellist = index === 2;
      const vanilla = demoGladiator({
        ...slots,
        character_name: name,
        ...(duellist ? { charisma: 16 } : {}),
        // A little spread so initiative is not a coin flip and the slots are
        // visibly different fighters.
        speed: 6 + (side === "red" ? 1 : 0) - index,
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
          : {})
      };
      const canonical = ss2Combatant(priced, { id, name, controller: "local", derive: false });
      return { id, controller: "local", vanilla: priced, resources: canonical.resources, clip: { gladiator_dir: facing } };
    })
  };
}
