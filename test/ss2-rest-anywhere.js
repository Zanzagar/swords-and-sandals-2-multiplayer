/**
 * A turn passed by RESTING, wherever the gladiator stands — the filler the
 * SS2 suites use to hand the turn on.
 *
 * ► **IN REACH THE ONLY REST IS THE FORCED ONE — the owner's decision,
 *   2026-09-24 (grill Q7).** Neither close-range controller wires `rest`
 *   (`closerange_warrior`, overlay frame 13; `closerange_archer`, frame 28 —
 *   battle map §"Buttons wired per controller frame"), so `legalActions`
 *   stopped offering it on the close frame, and every suite that staged two
 *   gladiators in reach and passed a turn with `rest` began to throw
 *   "Illegal action". What every frame still has is overlay frame 1's FORCED
 *   rest at `staminaleft <= 0` (`+0x0d2e`), which runs before any button. So
 *   when the voluntary rest is not on offer this empties the rester's stamina
 *   and takes that one; when it is on offer it is taken exactly as before.
 *
 * ► **ONLY THE RESTER'S OWN STAMINA DIFFERS between the two.** The heal, the
 *   crowd's -2, the chain's clears, the psyche reset and every counter tick are
 *   the same phase either way; the combat arithmetic never reads a defender's
 *   `staminaleft`. A test that reads the rester's stamina afterwards must stage
 *   the pair APART instead — the rest's own arithmetic tests do.
 *
 * ► **AND IT REFUSES TO PAPER OVER ANYTHING ELSE.** Once the stamina is empty
 *   the forced rest must be the ONLY option, as the forced chain makes it; a
 *   rest withheld for any other reason (a forced status phase the caller did
 *   not expect) fails here rather than being walked past.
 */
import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { applyAction, combatantById, createTeamBattle, currentCombatant, legalActions } from "../src/team/index.js";
import { Ss2ActionType, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";

const offersRest = (battle, actorId) =>
  legalActions(battle, actorId).some((option) => option.type === Ss2ActionType.REST);

export function restAnywhere(battle, actorId = currentCombatant(battle).id) {
  if (!offersRest(battle, actorId)) {
    combatantById(battle, actorId).resources.staminaleft.value = 0;
    assert.deepEqual(legalActions(battle, actorId), [{ type: Ss2ActionType.REST, targetId: actorId }],
      `${actorId}: at zero stamina the forced rest must be the only action`);
  }
  return applyAction(battle, { actorId, type: Ss2ActionType.REST, targetId: actorId });
}

// Register only when the runner executes this file directly, so these do not
// repeat inside every suite that imports the helper — `ss2-fixture-files.js`'s
// pattern, for its reason.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  // Strength 9 with weapon 1 reaches 130; `staminamax` = 160.
  const pair = ({ gap, hero = {} }) => {
    const battle = createTeamBattle({
      seed: 3,
      rules: ss2TeamRules,
      teams: [
        { id: "red", name: "red", combatants: [ss2Combatant({
          strength: 9, speed: 21, attack: 8, defence: 5, vitality: 6, stamina: 6, magicka: 7, charisma: 6,
          herolevel: 5, character_level: 5, weapon: 1, ...hero
        }, { id: "hero", name: "hero", controller: "local" })] },
        { id: "blue", name: "blue", combatants: [ss2Combatant({
          strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6, magicka: 7, charisma: 6,
          herolevel: 5, character_level: 5, weapon: 1, gladiator_dir: "left"
        }, { id: "foe", name: "foe", controller: "local" })] }
      ]
    });
    Object.assign(combatantById(battle, "hero"), { x: 0, y: 200 });
    Object.assign(combatantById(battle, "foe"), { x: gap, y: 200 });
    combatantById(battle, "hero").resources.staminaleft.value = 50;
    return battle;
  };

  test("apart, the VOLUNTARY rest: the stamina it starts from is the one it had", () => {
    const battle = pair({ gap: 500 });
    restAnywhere(battle, "hero");
    // 50 + round(6 * 15) + 6 + 1 + round(6 / 3) = 149.
    assert.equal(combatantById(battle, "hero").resources.staminaleft.value, 149);
  });

  test("in reach, the FORCED rest: the stamina is emptied first, and it is still a rest", () => {
    const battle = pair({ gap: 120 });
    assert.equal(legalActions(battle, "hero").some((option) => option.type === Ss2ActionType.REST), false,
      "the staging must be in reach, where no voluntary rest is offered");
    restAnywhere(battle, "hero");
    assert.equal(combatantById(battle, "hero").resources.staminaleft.value, 99, "0 + 90 + 6 + 3");
    assert.equal(battle.lastResolution.events[0].type, Ss2ActionType.REST);
  });

  test("it refuses a turn that zero stamina does not make a rest — an empty quiver swaps first", () => {
    const battle = pair({ gap: 120, hero: { secondary_weapon: 61, equipped_weapon: 2 } });
    combatantById(battle, "hero").resources.ammo_left.value = 0;
    assert.deepEqual(legalActions(battle, "hero"), [{ type: Ss2ActionType.SWAP_WEAPONS, targetId: "hero" }],
      "the staging: an empty quiver's forced swap outranks the forced rest");
    assert.throws(() => restAnywhere(battle, "hero"), /the forced rest must be the only action/);
  });
}
