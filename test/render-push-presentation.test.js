/**
 * A PUSH MOVES ITS VICTIM ON SCREEN — shove, taunt and gale.
 *
 * ► **FOUND TWICE ON 2026-09-22, BY TWO ROUTES, AND IT HAD BEEN LIVE SINCE
 *   `shove` SHIPPED ON 2026-09-19.** The `cast_gale` implementer measured a
 *   shove through the presentation layer: the resolver moves the VICTIM, and
 *   the screen moved the SHOVER — `move-clip hero 60 -> 171`, the victim's own
 *   endpoints, with the shover playing an assumed `shove` and the victim
 *   playing nothing. Then a Codex review of `cast_gale` found the same class
 *   from the other side: gale moves its victim 1,000 units and the screen moved
 *   nobody at all.
 *
 *   **The cause is one rule applied to events it does not describe.**
 *   `presentation.js` reads an event's `from`/`to` as the ACTOR's own movement
 *   — right for a walk, a charge, a flee — and `shove` and `taunt` put the
 *   TARGET's displacement in those same two fields. The resolver's events are
 *   inside `combatStateHash`, so the fix is in the layer that misread them, not
 *   in the events.
 *
 * What the build does, which is what these pin:
 *
 * - the pusher plays its OWN clip (`shove`, `taunt`, `Cast1`) and stays put;
 * - the victim plays `knockback` where the build plays it — above the force
 *   gate for a shove or a taunt, unconditionally for a gale — and is carried
 *   to where the resolver put it;
 * - `knockback(defender, force)` tweens `_x` over its own second, independent
 *   of the victim's clip. This engine rides the victim's timeline instead,
 *   which is the one approximation, and it is named at `figureXAt`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { applyAction, combatantById, createTeamBattle, legalActions, toTeamWireState } from "../src/team/index.js";
import { Ss2ActionType, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import {
  buildArenaLayout, CommandKind, LabelProvenance, presentArenaConstruction, presentResolvedEvents,
  SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";
import { applyCommands, emptyScene, figureXAt, poseAt, timelineFor, timelinesForStep } from "../src/render/index.js";
import { clipLabelsFor } from "../src/render/clip-labels.js";

const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 40, stamina: 6,
  magicka: 3, charisma: 6, herolevel: 40, character_level: 40, weapon: 1, gauntlet: 1, ...o
});

function staged({ hero = {}, foe = {}, heroX = -60, foeX = 60, seed = 3 } = {}) {
  const battle = createTeamBattle({
    seed,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields({ speed: 21, ...hero }), { id: "hero", name: "hero", controller: "local" })] },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields({ gladiator_dir: "left", ...foe }), { id: "foe", name: "foe", controller: "local" })] }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: heroX, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: foeX, y: 200 });
  return battle;
}

/** Act, then present; hand back the commands and the scene they build. */
function actAndPresent(battle, action) {
  const layoutBefore = buildArenaLayout(toTeamWireState(battle));
  const constructed = applyCommands(emptyScene(), presentArenaConstruction(layoutBefore));
  applyAction(battle, { actorId: "hero", ...action });
  const wire = toTeamWireState(battle);
  const { commands } = presentResolvedEvents(wire, { layout: buildArenaLayout(wire), bindings: SS2_STATIC_MAP_BINDINGS });
  return { commands, scene: applyCommands(constructed, commands), constructed };
}

const moves = (commands) => commands
  .filter((command) => command.kind === CommandKind.MOVE_CLIP)
  .map(({ combatantId, from, to, pushed }) => ({ combatantId, from, to, pushed: pushed === true }));

const clips = (commands) => commands
  .filter((command) => command.kind === CommandKind.CLIP_GOTO)
  .map(({ combatantId, role, label, labelProvenance }) => ({ combatantId, role, label, labelProvenance }));

test("a SHOVE moves the victim, not the shover", () => {
  const battle = staged();
  assert.ok(legalActions(battle, "hero").some((option) => option.type === Ss2ActionType.SHOVE), "a shove is on offer");
  const { commands, scene, constructed } = actAndPresent(battle, { type: Ss2ActionType.SHOVE, targetId: "foe" });
  const event = battle.events.find((entry) => entry.type === Ss2ActionType.SHOVE);

  assert.deepEqual(moves(commands), [{ combatantId: "foe", from: event.from, to: event.to, pushed: true }],
    "exactly one move, and it is the VICTIM's, carrying the resolver's own endpoints");
  assert.equal(scene.actors.foe.x, combatantById(battle, "foe").x, "the victim is drawn where the resolver put it");
  assert.equal(scene.actors.hero.x, constructed.actors.hero.x, "and the shover has not moved");
});

test("the shover plays its own clip and the victim plays knockback above the force gate", () => {
  const battle = staged();
  const { commands } = actAndPresent(battle, { type: Ss2ActionType.SHOVE, targetId: "foe" });
  const event = battle.events.find((entry) => entry.type === Ss2ActionType.SHOVE);
  assert.equal(event.knockbackAnimation, true, "strength 9 with a gauntlet clears the force gate");
  // `attacker.gotoAndPlay("shove")` at `+0x5e27`; `defender.gotoAndPlay("knockback")` only above
  // `|force| > 100` (`+0x5ed3`, `+0x5f94`). Both are the build's own strings.
  assert.deepEqual(clips(commands), [
    { combatantId: "hero", role: "actor", label: "shove", labelProvenance: LabelProvenance.MAP_NAMED },
    { combatantId: "foe", role: "target", label: "knockback", labelProvenance: LabelProvenance.MAP_NAMED }
  ]);
});

test("a feeble shove still MOVES its victim, with no knockback clip", () => {
  // The displacement is unconditional in the build and the clip is gated, so a
  // weak shove carries the victim a little way and plays nothing on it.
  const battle = staged({ hero: { strength: 1, gauntlet: 0 } });
  const { commands } = actAndPresent(battle, { type: Ss2ActionType.SHOVE, targetId: "foe" });
  const event = battle.events.find((entry) => entry.type === Ss2ActionType.SHOVE);
  assert.equal(event.knockbackAnimation, false);
  assert.equal(moves(commands)[0].combatantId, "foe");
  assert.deepEqual(clips(commands).map((clip) => clip.combatantId), ["hero"], "only the shover's own clip");
});

test("a GALE moves its victim a thousand units, and the caster stays put", () => {
  const battle = staged({ hero: { inventory1: 38 }, heroX: -200, foeX: 250 });
  const { commands, scene, constructed } = actAndPresent(battle, { type: Ss2ActionType.CAST_GALE, targetId: "foe" });
  const event = battle.events.find((entry) => entry.type === Ss2ActionType.CAST_GALE);
  assert.deepEqual(moves(commands), [{ combatantId: "foe", from: event.targetFrom, to: event.targetTo, pushed: true }]);
  assert.equal(scene.actors.foe.x, combatantById(battle, "foe").x);
  assert.equal(scene.actors.hero.x, constructed.actors.hero.x);
  assert.deepEqual(clips(commands).map(({ combatantId, label }) => ({ combatantId, label })), [
    { combatantId: "hero", label: "Cast1" },
    { combatantId: "foe", label: "knockback" }
  ]);
});

test("a TAUNT that shoves moves its victim, and is not read as the taunter walking", () => {
  // Effect 2 against a melee defender is a `charisma * 25` shove (`+0x69a7`).
  // Searched over seeds exactly as `test/ss2-taunt.test.js` does, because the
  // outcome is two draws deep.
  for (let seed = 1; seed <= 120; seed += 1) {
    // Out of melee reach: `closerange_warrior` wires no taunt; the long-range
    // frame does, above half stamina (map, "Buttons wired per controller frame").
    const battle = staged({ seed, hero: { charisma: 30 }, foe: { charisma: 1 }, heroX: -250, foeX: 250 });
    if (!legalActions(battle, "hero").some((option) => option.type === Ss2ActionType.TAUNT)) continue;
    const { commands } = actAndPresent(battle, { type: Ss2ActionType.TAUNT, targetId: "foe" });
    const event = battle.events.find((entry) => entry.type === Ss2ActionType.TAUNT);
    if (!(event?.landed && event.effect === 2 && Number.isFinite(event.from))) continue;
    assert.deepEqual(moves(commands), [{ combatantId: "foe", from: event.from, to: event.to, pushed: true }]);
    assert.equal(clips(commands)[0].label, "taunt", "the taunter plays taunt, not a walk");
    assert.equal(clips(commands)[0].labelProvenance, LabelProvenance.MAP_NAMED);
    return;
  }
  assert.fail("no displacing taunt in 120 seeds");
});

test("a WALK is still the walker's own move, and not a push", () => {
  const battle = staged({ foeX: 900 });
  const walk = legalActions(battle, "hero").find((option) => option.type === Ss2ActionType.WALK_RIGHT);
  assert.ok(walk, "a walk is on offer");
  const { commands } = actAndPresent(battle, walk);
  const [move] = moves(commands);
  assert.equal(move.combatantId, "hero");
  assert.equal(move.pushed, false);
});

test("the victim SLIDES across its knockback, because a push rides whatever clip it plays", () => {
  // `knockback` does not travel — a flinch must not drag a figure — so the
  // cursor pairs a move with it only because the move says it is a PUSH.
  const battle = staged();
  const { commands } = actAndPresent(battle, { type: Ss2ActionType.SHOVE, targetId: "foe" });
  const entry = timelinesForStep(commands).started.get("foe");
  assert.equal(entry.timeline.travel, false, "knockback is not a travelling schedule");
  assert.ok(entry.motion, "and still carries the push");
  const pose = poseAt(entry.timeline, 0);
  const at = (fraction) => figureXAt({ restingX: entry.motion.to, facing: "left", pose, timeline: entry.timeline, motion: entry.motion, at: fraction });
  assert.equal(at(0), entry.motion.from, "it starts where it stood");
  assert.equal(at(1), entry.motion.to, "and ends where the resolver put it");
});

test("the shover's own clip resolves to a family that can draw it", () => {
  // `shove` is frames 1447-1481 of the fighter clip and ends in
  // `this.struck = true; Stop` (`@0x38e87f`) — which only the ACTING clips do;
  // no hurt, defend or knockback run writes `struck`. So it is the shover's own
  // animation, and it gets the build's 35 frames at 30 fps: 1,167 ms, rounded to
  // the 120 ms beat as `clip-sequences.js` rounds every unpaced family.
  const timeline = timelineFor("shove", { role: "actor" });
  assert.equal(timeline.recognised, true, "not the `unknown` schedule");
  assert.ok(clipLabelsFor(timeline.family).includes("shove"));
  assert.equal(timeline.durationMs, 1200);
});
