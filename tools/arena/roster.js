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
export function demoSide(side, size, { ss2Combatant, ss2BattleValues }) {
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
      const priced = { ...vanilla, weapon_range: ss2BattleValues(vanilla).weapon_range };
      const canonical = ss2Combatant(priced, { id, name, controller: "local", derive: false });
      return { id, controller: "local", vanilla: priced, resources: canonical.resources, clip: { gladiator_dir: facing } };
    })
  };
}
