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
 * arc. `ss2-rules.js` claims a bombard flies `>= 1.055` ~~figure heights~~
 * "everywhere a body could stand", which is wrong as a global minimum — it is
 * 0.789 on the claim's own terms and 0.636 with the adapter's real
 * `targetSize`, both at the LAUNCH end. But over an interposed body the lob
 * genuinely does clear, at 1.04 to 1.34 ~~figure heights~~. It does not fly
 * through the ally; it STOPS on him, at 0.64-0.99 ~~figure heights~~, which is
 * chest to head. So the fix is the endpoint, and the legality rule is untouched.
 *
 * **UNIT CORRECTED 2026-09-23: those numbers are BOMBARD LAUNCH HEIGHTS** —
 * `projectile.js`'s `height`, 1 being the shooter's own `_yscale * 2 + 30`
 * (230 arena units at the `_yscale` 100 they were measured at); a gladiator the
 * shooter's size is 0.937-1.048 of one since he is drawn at the build's size.
 * They were taken with the old `physical_size` stop-short (86): re-derived that
 * day, 0.636 is sequence 3's alone (all eleven velocities reach 0.429), and
 * with the DRAWN stop this file now tests (41.45 at strength 9) the lowest
 * point between bodies is 1.055, `ss2-rules.js`'s own figure. The 0.789,
 * 1.04-1.34 and 0.64-0.99 were not re-derived. See `stopShortFor` in
 * `src/adapter/presentation.js`, which carries the same correction.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildArenaLayout, CommandKind, createVanillaBattleHost, presentResolvedEvents, SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";
import { projectileFlight } from "../src/render/projectile.js";
import { combatantById, currentCombatant, suggestAction } from "../src/team/index.js";
import { ss2BattleValues, ss2Combatant, ss2PhysicalSize, ss2TeamRules } from "../src/team/ss2-rules.js";
import { demoSide } from "../tools/arena/roster.js";
import { SS2_FIGURE_HALF_WIDTH } from "../src/common/ss2-figure.js";

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
        .map((one) => ({
          id: one.id, teamId: one.teamId, x: one.x, y: one.y, size: ss2PhysicalSize(one),
          // How far its DRAWN body reaches either side of `x`: the build's
          // standing clip at its own size (`src/common/ss2-figure.js`).
          reach: SS2_FIGURE_HALF_WIDTH * ss2PhysicalSize(one) / 100
        }));
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
  // ► **"INSIDE" IS THE DRAWN BODY, since 2026-09-23** — the build's standing
  //   clip at the bystander's own size, ~41 units either side at strength 9.
  //   ~~`<= body.size`~~ judged it by `physical_size` (86), the walk clamp's
  //   personal space, which was the arena's idea of a body while the gladiator
  //   was drawn at two thirds of the build's size.
  const shots = sweepShots(12);
  assert.ok(shots.length >= 60, `the sweep must actually loose arrows; loosed ${shots.length}`);

  const landedOnSomebodyElse = [];
  for (const shot of shots) {
    for (const body of shot.standing) {
      if (body.id === shot.command.combatantId || body.id === shot.command.targetId) continue;
      if (body.y !== shot.command.to.y) continue;
      if (Math.abs(body.x - shot.endX) <= body.reach) {
        landedOnSomebodyElse.push(
          `${shot.command.combatantId} -> ${shot.command.targetId} ended at x ${Math.round(shot.endX)} ` +
          `inside ${body.id} (x ${body.x}, reach ${body.reach.toFixed(1)})`
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
  // ► **THE SURFACE IS THE TARGET'S DRAWN FRONT, since 2026-09-23**: the
  //   standing clip's half-width at its own `physical_size`, ~41 at strength 9
  //   — ~~its `physical_size`, 86~~, which left every arrow ~45 units in front
  //   of a body drawn at the build's size.
  for (const shot of kept) {
    const target = shot.standing.find((one) => one.id === shot.command.targetId);
    assert.equal(shot.command.targetSize, target.reach, `${shot.command.targetId}: the stop is its drawn front`);
  }

  // Every dropped one must have had a real reason: a bystander's drawn body at
  // the point the stop-short would have chosen. (~~"and some must fall back,
  // or this rig proves nothing"~~ — on this roster the drawn stop now always
  // lands in the ~3 units between the front-liner's back and the target's
  // front, so none does; the fallback is proven on a formation built for it,
  // in the next test.)
  for (const shot of dropped) {
    const target = shot.standing.find((one) => one.id === shot.command.targetId);
    if (!target) continue;
    const direction = shot.command.to.x >= shot.command.from.x ? 1 : -1;
    const wouldHaveEnded = target.x - direction * target.reach;
    const blocker = shot.standing.find((one) =>
      one.id !== shot.command.combatantId
      && one.id !== shot.command.targetId
      && one.y === shot.command.to.y
      && Math.abs(one.x - wouldHaveEnded) <= one.reach);
    assert.ok(blocker,
      `${shot.command.combatantId} dropped its stop-short with nobody at x ${Math.round(wouldHaveEnded)}`);
  }
});

test("THE FALLBACK STILL DROPS TO THE BUILD'S CENTRE-X END when the surface is inside somebody else", () => {
  // Built through the real presentation: an archer, his target, and a
  // bystander in the target's rank. `presentResolvedEvents` decides.
  const gladiator = (id, teamId, x, strength, slotIndex = 0) => ({
    id, name: id, teamId, seatId: id, slotIndex, aiFilled: false, alive: true, health: 40, maxHealth: 40,
    stats: { strength }, loadout: {}, resources: {}, status: [], x, y: 200
  });
  const stopFor = (bystanders) => {
    const wire = {
      teams: [
        { id: "red", combatants: [gladiator("red-1", "red", -300, 9), ...bystanders] },
        { id: "blue", combatants: [gladiator("blue-1", "blue", 300, 9)] }
      ],
      events: [{ sequence: 1, actorId: "red-1", targetId: "blue-1", hit: true, dispatchedMethod: "normal",
        type: "bombard", attackDirection: 21 }]
    };
    const { commands } = presentResolvedEvents(wire, { layout: buildArenaLayout(wire), bindings: SS2_STATIC_MAP_BINDINGS });
    return commands.find((command) => command.kind === CommandKind.FIRE_PROJECTILE).targetSize;
  };
  const surface = SS2_FIGURE_HALF_WIDTH * 86 / 100;
  assert.equal(stopFor([]), surface, "an open line stops at the target's drawn front, 41.4 short of its centre");
  // The walk clamp's front-liner, `physical_size` (86) from the target: his
  // drawn back is at 300 - 86 + 41.4 = 255.4, the stop at 258.6 — just clear.
  assert.equal(stopFor([gladiator("red-2", "red", 214, 9, 1)]), surface, "a clamp-adjacent front-liner leaves it clear");
  // A strength-50 front-liner (`physical_size` 113) at the same clamp reaches
  // 54.5 either side, to 268.5: the stop is inside him, so it drops to 0.
  assert.equal(stopFor([gladiator("red-2", "red", 214, 50, 1)]), 0, "a bigger front-liner covers the stop: the build's end");
  // And a body anywhere ELSE is not a reason.
  assert.equal(stopFor([gladiator("red-2", "red", 0, 50, 1)]), surface, "a body mid-field is no reason to drop it");
});
