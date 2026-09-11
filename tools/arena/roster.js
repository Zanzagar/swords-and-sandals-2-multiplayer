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
    weapon_range: 1,
    weapon_min_damage: 3,
    weapon_max_damage: 8,
    weapon_enchantment_type: 0,
    weapon_enchantment_potency: 0,
    weapon_enchantment_damage: 0,
    equipped_weapon: 3,
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

    inventory1: 0, inventory2: 0, inventory3: 0,
    inventory4: 0, inventory5: 0, inventory6: 0,
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
export function demoSide(side, size, { ss2Combatant }) {
  const names = side === "red" ? RED_NAMES : BLUE_NAMES;
  const facing = side === "red" ? "right" : "left";
  return {
    id: side,
    name: side === "red" ? "Red" : "Blue",
    members: Array.from({ length: size }, (unused, index) => {
      const id = `${side}-${index + 1}`;
      const name = names[index] ?? id;
      const vanilla = demoGladiator({
        character_name: name,
        // A little spread so initiative is not a coin flip and the slots are
        // visibly different fighters.
        speed: 6 + (side === "red" ? 1 : 0) - index,
        strength: 9 - index,
        breastplate: 3 - index,
        helmet: 2 - index,
        shield: index === 0 ? 2 : 0
      });
      const canonical = ss2Combatant(vanilla, { id, name, controller: "local", derive: false });
      return { id, controller: "local", vanilla, resources: canonical.resources, clip: { gladiator_dir: facing } };
    })
  };
}
