/**
 * WHERE AN ARROW STOPS, AND WHY IT USED TO STOP INSIDE A TEAMMATE.
 *
 * WHY THIS FILE EXISTS. The owner watched a 3v3 in the browser arena and asked
 * whether the AI was shooting its own teammate. **It was not** — ranged options
 * are built from `view.foes` and cannot name an ally; measured over 25 seeded
 * 3v3 bouts, 2,064 AI actions, 250 of them shots, **0 ally-targeted**. But the
 * picture said otherwise, every time: on the arena's own host and roster,
 * **85 of 120 shots ended at a coordinate inside a living teammate's body, at
 * the same depth, painted over them.**
 *
 * THE CAUSE WAS TWO CORRECT RULES LANDING ON ONE NUMBER. `ss2WalkDestination`
 * parks a gladiator against a body at `target.x ∓ physical_size`. The arrow's
 * stop-short — added in September after the owner reported an arrow clipping
 * INTO a model — ends the flight at `target.x ∓ physical_size`. The same point,
 * by construction, and the walk clamp is what puts the shooter's own front-liner
 * there.
 *
 * WHAT IS *NOT* THE CAUSE, because a plausible wrong answer was available: the
 * arc. `ss2-rules.js` claims a bombard flies `>= 1.055` figure heights
 * "everywhere a body could stand", which is wrong as a global minimum — it is
 * 0.789 on the claim's own terms and 0.636 with the adapter's real
 * `targetSize`, both at the LAUNCH end. But over an interposed body the lob
 * genuinely does clear, at 1.04 to 1.34 figure heights. It does not fly through
 * the ally; it STOPS on him, at 0.64-0.99 figure heights, which is chest to head.
 * So the fix is the endpoint, and the legality rule is untouched.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { projectileFlight } from "../src/render/projectile.js";
import { combatantById, currentCombatant, suggestAction } from "../src/team/index.js";
import { ss2BattleValues, ss2Combatant, ss2PhysicalSize, ss2TeamRules } from "../src/team/ss2-rules.js";
import { demoSide } from "../tools/arena/roster.js";

/** Drive the arena's own host exactly as `tools/arena/main.js` builds it. */
function sweepShots(seeds) {
  const shots = [];
  for (let seed = 1; seed <= seeds; seed += 1) {
    const host = createVanillaBattleHost({
      teams: [
        demoSide("red", 3, { ss2Combatant, ss2BattleValues }),
        demoSide("blue", 3, { ss2Combatant, ss2BattleValues })
      ],
      rules: ss2TeamRules,
      bindings: SS2_STATIC_MAP_BINDINGS,
      seed,
      awaitAnimations: false
    });
    for (let turn = 0; turn < 600 && !host.battle.result; turn += 1) {
      const who = currentCombatant(host.battle);
      if (!who) break;
      const action = suggestAction(host.battle);
      if (!action) break;
      const actorTeam = combatantById(host.battle, who.id).teamId;
      const standing = host.battle.teams.flatMap((team) => team.combatants)
        .filter((one) => one.alive)
        .map((one) => ({ id: one.id, teamId: one.teamId, x: one.x, y: one.y, size: ss2PhysicalSize(one) }));
      const step = host.submit({ actorId: who.id, ...action });
      for (const command of step?.commands ?? []) {
        if (command.kind !== "fire-projectile") continue;
        const flight = projectileFlight({
          kind: command.projectile,
          from: command.from,
          to: command.to,
          sequence: command.sequence,
          targetSize: command.targetSize
        });
        shots.push({
          command,
          actorTeam,
          standing,
          endX: flight.launch.x + flight.direction * flight.distance
        });
      }
    }
  }
  return shots;
}

test("NO ARROW ENDS INSIDE A LIVING BODY THAT IS NOT ITS TARGET, and 85 of 120 used to", () => {
  const shots = sweepShots(12);
  assert.ok(shots.length >= 60, `the sweep must actually loose arrows; loosed ${shots.length}`);

  const landedOnSomebodyElse = [];
  for (const shot of shots) {
    for (const body of shot.standing) {
      if (body.id === shot.command.combatantId || body.id === shot.command.targetId) continue;
      if (body.y !== shot.command.to.y) continue;
      if (Math.abs(body.x - shot.endX) <= body.size) {
        landedOnSomebodyElse.push(
          `${shot.command.combatantId} -> ${shot.command.targetId} ended at x ${Math.round(shot.endX)} ` +
          `inside ${body.id} (x ${body.x}, size ${body.size})`
        );
        break;
      }
    }
  }
  assert.deepEqual(landedOnSomebodyElse.slice(0, 5), [],
    `${landedOnSomebodyElse.length} of ${shots.length} arrows stopped inside a bystander`);
});

test("THE STOP-SHORT IS KEPT WHERE IT HELPS, so the defect it was added for stays fixed", () => {
  // The cosmetic fix — ending at the body's surface instead of inside the model —
  // must survive. Falling back to 0 unconditionally would re-open the owner's
  // September report, which is the obvious wrong way to fix this one.
  const shots = sweepShots(12);
  const kept = shots.filter((shot) => shot.command.targetSize > 0);
  const dropped = shots.filter((shot) => shot.command.targetSize === 0);
  assert.ok(kept.length > 0, "some shots must still stop at the target's surface");
  assert.ok(dropped.length > 0, "and some must fall back, or this rig proves nothing");

  // Every dropped one must have had a real reason: a bystander at the point the
  // stop-short would have chosen.
  for (const shot of dropped) {
    const target = shot.standing.find((one) => one.id === shot.command.targetId);
    if (!target) continue;
    const direction = shot.command.to.x >= shot.command.from.x ? 1 : -1;
    const wouldHaveEnded = target.x - direction * target.size;
    const blocker = shot.standing.find((one) =>
      one.id !== shot.command.combatantId
      && one.id !== shot.command.targetId
      && one.y === shot.command.to.y
      && Math.abs(one.x - wouldHaveEnded) <= one.size);
    assert.ok(blocker,
      `${shot.command.combatantId} dropped its stop-short with nobody at x ${Math.round(wouldHaveEnded)}`);
  }
});
