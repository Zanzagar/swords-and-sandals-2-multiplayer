/**
 * The rendered arena's pure core (`src/render/`).
 *
 * WHY THIS FILE EXISTS. `src/adapter/presentation.js` emitted ordered
 * presentation commands for months with no production consumer — only tests —
 * which is the shape the campaign record was in before 2026-09-07, and reading
 * that record back is what found the defects in its format. These tests drive
 * the core with commands from a REAL battle rather than hand-written ones, for
 * the same reason: a fixture agrees with whatever wrote it.
 *
 * THE ASSERTIONS PROVE, THEY DO NOT STATE. Every sweep asserts it FOUND the
 * case it was sweeping for.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction,
  createTeamBattle,
  currentCombatant,
  lastResolvedAction,
  legalActions,
  toTeamWireState
} from "../src/team/index.js";
import { ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import {
  buildArenaLayout,
  createPresentationBinder,
  presentArenaConstruction,
  SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";
import {
  ANIMATION_TIMEOUT_MS,
  ARMOUR_SLOTS,
  abandonReasonFor,
  applyCommands,
  emptyScene,
  figureSpecFor,
  labelProvenanceSummary,
  poseAt,
  SceneError,
  timelineFor
} from "../src/render/index.js";

/* ------------------------------------------------------------------ */
/* Fixtures: a real battle, never a hand-written command list          */
/* ------------------------------------------------------------------ */

const gladiator = (overrides = {}) => ({
  strength: 9, speed: 5, attack: 9, defence: 5, vitality: 5, stamina: 4,
  magicka: 0, charisma: 3, herolevel: 3, character_level: 3,
  weapon_min_damage: 3, weapon_max_damage: 9,
  breastplate: 4, helmet: 2, greaves: 1,
  ...overrides
});

function battleOf(perSide, seed, overrides = {}) {
  const side = (prefix) => ({
    id: prefix,
    name: prefix,
    combatants: Array.from({ length: perSide }, (unused, index) =>
      ss2Combatant(gladiator({ speed: 5 + index, ...overrides }), {
        id: `${prefix}-${index + 1}`,
        name: `${prefix} ${index + 1}`,
        controller: "local"
      })
    )
  });
  return createTeamBattle({ seed, rules: ss2TeamRules, teams: [side("red"), side("blue")] });
}

/** Builds the arena and plays the whole bout, folding every batch into a scene. */
function playIntoScene(battle) {
  const layout = buildArenaLayout(toTeamWireState(battle));
  const binder = createPresentationBinder({ layout, bindings: SS2_STATIC_MAP_BINDINGS });
  let scene = applyCommands(emptyScene(), presentArenaConstruction(layout));
  const batches = [];
  let guard = 0;
  while (!battle.result && guard < 5000) {
    guard += 1;
    const actor = currentCombatant(battle);
    if (!actor) break;
    const options = legalActions(battle);
    if (options.length === 0) break;
    applyAction(battle, { ...options[0], actorId: actor.id });
    const commands = binder.drain(toTeamWireState(battle), {
      actionBoundary: lastResolvedAction(battle).firstEventSequence
    });
    batches.push(commands);
    scene = applyCommands(scene, commands);
  }
  return { scene, layout, batches };
}

/* ------------------------------------------------------------------ */
/* The scene fold                                                      */
/* ------------------------------------------------------------------ */

test("arena construction places every combatant, and the scene invents no geometry", () => {
  const battle = battleOf(3, 11);
  const layout = buildArenaLayout(toTeamWireState(battle));
  const scene = applyCommands(emptyScene(), presentArenaConstruction(layout));

  assert.equal(scene.drawOrder.length, 6, "3v3 is six actors");
  for (const id of scene.drawOrder) {
    const actor = scene.actors[id];
    assert.equal(actor.placed, true, `${id} was placed`);
    assert.equal(Number.isFinite(actor.x), true);
    assert.equal(Number.isFinite(actor.y), true);
    assert.ok(actor.shadow, `${id} has a shadow, attached by linkage not by name`);
    assert.notEqual(actor.shadow.instanceName, actor.instanceName);
  }

  // An actor nothing placed keeps null coordinates rather than a default.
  const partial = applyCommands(
    emptyScene(),
    presentArenaConstruction(layout).filter((command) => command.kind === "attach-clip")
  );
  for (const id of partial.drawOrder) {
    assert.equal(partial.actors[id].placed, false);
    assert.equal(partial.actors[id].x, null, "an unplaced actor has no position, not position zero");
  }
});

test("draw order is depth order, and the vanilla pair keeps its measured depths", () => {
  const battle = battleOf(1, 3);
  const layout = buildArenaLayout(toTeamWireState(battle));
  const scene = applyCommands(emptyScene(), presentArenaConstruction(layout));

  const depths = scene.drawOrder.map((id) => scene.actors[id].depth);
  assert.deepEqual([...depths].sort((a, b) => a - b), depths, "drawOrder ascends by depth");

  // Map, "Battle entry": hero 301, villain 300, shadows 298/299.
  const byInstance = Object.fromEntries(
    scene.drawOrder.map((id) => [scene.actors[id].instanceName, scene.actors[id]])
  );
  assert.equal(byInstance.hero.depth, 301);
  assert.equal(byInstance.villain.depth, 300);
  assert.equal(byInstance.hero.shadow.depth, 298);
  assert.equal(byInstance.villain.shadow.depth, 299);
});

/**
 * A finding from actually trying to DRAW the authored geometry, which is the
 * whole reason a consumer is worth building.
 *
 * Vanilla's own four depths increase toward the viewer: shadows at 298/299 sit
 * BEHIND fighters at 300/301. The authored ally band extends that surface with
 * depth 320+ — in FRONT of both vanilla fighters — while placing allies at a
 * SMALLER y, which in a ground-plane arena reads as further away.
 *
 * So the authored band draws a figure that stands further back in front of one
 * that stands nearer. This test does not decide which of the two is wrong: it
 * pins the tension so it is a decision rather than a surprise, and the renderer
 * honours the depth the command carries, because that is the contract.
 */
test("the authored ally band draws in front of figures standing nearer than it", () => {
  const battle = battleOf(2, 3);
  const layout = buildArenaLayout(toTeamWireState(battle));
  const scene = applyCommands(emptyScene(), presentArenaConstruction(layout));

  const front = Object.values(scene.actors).find((actor) => actor.instanceName === "hero");
  const ally = Object.values(scene.actors).find((actor) => actor.instanceName === "hero_ally_2");
  assert.ok(front && ally, "the sweep must have found both, or it proves nothing");

  assert.ok(ally.y < front.y, `the ally stands further back: y ${ally.y} vs ${front.y}`);
  assert.ok(ally.depth > front.depth, `and is drawn in front: depth ${ally.depth} vs ${front.depth}`);
  assert.ok(
    front.shadow.depth < front.depth,
    "vanilla's own convention is the opposite: its shadow is behind it"
  );
});

test("a label's provenance survives the fold, because it is the only guess marker", () => {
  const { scene } = playIntoScene(battleOf(1, 3));
  const summary = labelProvenanceSummary(scene);
  const total = Object.values(summary).reduce((sum, count) => sum + count, 0);
  assert.ok(total > 0, "the bout must have set some clip labels, or this proves nothing");
  assert.equal(summary["runtime-verified"], undefined, "no clip label has ever been observed in a capture");
  for (const id of scene.drawOrder) {
    const clip = scene.actors[id].clip;
    if (!clip) continue;
    assert.ok(
      ["map-named", "assumed", "placeholder"].includes(clip.provenance),
      `${id} carries a real provenance, not undefined: ${clip.provenance}`
    );
  }
});

test("panel values are copied verbatim: the scene computes no combat value", () => {
  const battle = battleOf(1, 3);
  const { scene } = playIntoScene(battle);
  const wire = toTeamWireState(battle);
  const byId = new Map(wire.teams.flatMap((team) => team.combatants).map((c) => [c.id, c]));

  let compared = 0;
  for (const id of scene.drawOrder) {
    const panel = scene.actors[id].panel;
    if (!panel) continue;
    const combatant = byId.get(id);
    assert.equal(panel.values.health, combatant.health, `${id} health is the resolver's`);
    assert.equal(panel.values.maxHealth, combatant.maxHealth);
    assert.equal(panel.values.alive, combatant.alive);
    compared += 1;
  }
  assert.ok(compared > 0, "the sweep must have found panels, or it proves nothing");
});

test("an unmapped command is kept, never swallowed", () => {
  const scene = applyCommands(emptyScene(), [
    { kind: "unmapped", sequence: 4, reason: "no animation binding for event type invented", detail: { eventType: "invented" }, actionToken: 4 }
  ]);
  assert.equal(scene.unmapped.length, 1);
  assert.equal(scene.unmapped[0].detail.eventType, "invented");
  assert.equal(scene.unmapped[0].actionToken, 4);
});

test("a draw's completion token survives, even though it arrives on an unmapped", () => {
  // A drawn battle has no arena transition, so the token rides an `unmapped`.
  // Losing it here would leave a decided battle that can never settle.
  const scene = applyCommands(emptyScene(), [
    {
      kind: "unmapped",
      sequence: 9,
      reason: "a draw has no vanilla arena transition",
      detail: { eventType: "battle-result-pending", winnerTeamId: null, acknowledgedBy: "death-animations", completionToken: "tok-9" }
    }
  ]);
  assert.equal(scene.completionToken, "tok-9");
});

test("an unknown command kind throws instead of being ignored", () => {
  assert.throws(
    () => applyCommands(emptyScene(), [{ kind: "teleport-clip", sequence: 1 }]),
    (error) => error instanceof SceneError && /Unknown presentation command kind/.test(error.message)
  );
  assert.throws(() => applyCommands(emptyScene(), [null]), SceneError);
  assert.throws(() => applyCommands(emptyScene(), "not-iterable"), SceneError);
});

test("the fold is pure: the input scene is untouched and the output is frozen", () => {
  const before = applyCommands(emptyScene(), [
    { kind: "attach-clip", combatantId: "red-1", parentPath: "_root.arena.gladiators", linkage: "hero_battle", instanceName: "hero", depth: 301, vanillaNative: true }
  ]);
  const snapshot = JSON.stringify(before);
  const after = applyCommands(before, [
    { kind: "clip-goto", sequence: 1, role: "actor", combatantId: "red-1", instancePath: "x", label: "attack7", labelProvenance: "assumed", actionToken: 1 }
  ]);
  assert.equal(JSON.stringify(before), snapshot, "the input scene did not move");
  assert.notEqual(before.actors["red-1"].clip, after.actors["red-1"].clip);
  assert.equal(Object.isFrozen(after), true);
  assert.equal(Object.isFrozen(after.actors["red-1"]), true);
  assert.equal(Object.isFrozen(after.drawOrder), true);
});

test("a whole bout folds, and the result reaches the scene with a token to answer", () => {
  const battle = battleOf(1, 3);
  const { scene } = playIntoScene(battle);
  assert.ok(battle.result, "the bout must have settled, or this proves nothing");
  assert.ok(
    scene.overlayLabel === "combatwon" || scene.overlayLabel === "combatlost",
    `a decided bout reaches an overlay label: ${scene.overlayLabel}`
  );
  assert.ok(
    scene.arenaLabel === "combat_won" || scene.arenaLabel === "combat_lost",
    `and an arena label: ${scene.arenaLabel}`
  );
  assert.ok(scene.completionToken, "and the token the surface must hand back");
});

/* ------------------------------------------------------------------ */
/* The figure spec                                                     */
/* ------------------------------------------------------------------ */

test("a figure is built from the combatant's own eight armour slots", () => {
  const battle = battleOf(1, 3);
  const wire = toTeamWireState(battle);
  const combatant = wire.teams[0].combatants[0];
  const figure = figureSpecFor(combatant, { side: "hero" });

  assert.equal(figure.armour.length, 8);
  assert.deepEqual(figure.armour.map((piece) => piece.slot), [...ARMOUR_SLOTS]);
  assert.equal(figure.provenance, "authored-original-art");

  // The fixture wears breastplate 4, helmet 2, greaves 1 and nothing else.
  assert.deepEqual([...figure.wornSlots].sort(), ["breastplate", "greaves", "helmet"]);
  const bare = figure.armour.find((piece) => piece.slot === "boot");
  assert.equal(bare.worn, false);
  assert.equal(bare.weight, 0, "an empty slot has no visual weight, rather than a small one");
});

test("a heavier item id draws heavier, and saturates rather than running away", () => {
  const light = figureSpecFor(
    toTeamWireState(battleOf(1, 3, { breastplate: 1 })).teams[0].combatants[0],
    { side: "hero" }
  );
  const heavy = figureSpecFor(
    toTeamWireState(battleOf(1, 3, { breastplate: 900 })).teams[0].combatants[0],
    { side: "hero" }
  );
  const weightOf = (figure) => figure.armour.find((piece) => piece.slot === "breastplate").weight;
  assert.ok(weightOf(heavy) > weightOf(light), "a higher id is drawn heavier");
  assert.ok(weightOf(heavy) <= 1, "and saturates: no stat line draws wider than the arena");
});

test("the two sides get different palettes, and an unknown side is refused", () => {
  const wire = toTeamWireState(battleOf(1, 3));
  const combatant = wire.teams[0].combatants[0];
  assert.notEqual(
    figureSpecFor(combatant, { side: "hero" }).palette.tunic,
    figureSpecFor(combatant, { side: "villain" }).palette.tunic
  );
  assert.throws(() => figureSpecFor(combatant, { side: "red" }), /arena side/);
  assert.throws(() => figureSpecFor(combatant, {}), /arena side/);
});

/* ------------------------------------------------------------------ */
/* The timeline, and the timeout policy the gate refused to decide     */
/* ------------------------------------------------------------------ */

test("every label the SS2 bindings can emit gets a timeline, recognised or not", () => {
  const cases = [
    ["attack7", "actor", "attack", true],
    ["bombard", "actor", "ranged", true],
    ["snipe", "actor", "ranged", true],
    ["taunt", "actor", "taunt", true],
    ["Standing", "actor", "standing", true],
    ["hurt1", "target", "hurt", true],
    ["hurt12", "target", "hurt", true],
    ["Block", "target", "block", true],
    ["taunted", "target", "taunted", true],
    ["knockback", "target", "knockback", true],
    ["slain", "defeated", "death:slain", true],
    ["yield", "defeated", "death:yield", true],
    // `taunt` is BOTH an attack label and a death variant. Only the role tells
    // them apart, which is why the role is passed rather than inferred.
    ["taunt", "defeated", "death:taunt", true],
    ["a-label-nobody-has-seen", "actor", "unknown", false]
  ];
  for (const [label, role, family, recognised] of cases) {
    const timeline = timelineFor(label, { role });
    assert.equal(timeline.family, family, `${label} as ${role}`);
    assert.equal(timeline.recognised, recognised, `${label} as ${role} recognised`);
    assert.ok(timeline.durationMs > 0);
    assert.equal(timeline.provenance, "authored-timing", "no capture settles a frame duration");
  }
});

test("an unrecognised label still animates, because the arena must advance", () => {
  const timeline = timelineFor("hurt99999", { role: "target" });
  assert.equal(timeline.family, "hurt", "a well-formed hurt label is still a hurt");
  const invented = timelineFor("", { role: "actor" });
  assert.equal(invented.family, "unknown");
  assert.ok(invented.durationMs > 0, "an unknown label plays something rather than freezing the bout");
});

test("poses interpolate between the frames, and clamp outside them", () => {
  const timeline = timelineFor("attack7", { role: "actor" });
  const start = poseAt(timeline, 0);
  const mid = poseAt(timeline, 0.52);
  assert.equal(start.armSwing, 0);
  assert.ok(mid.armSwing > 0.9, `the swing peaks: ${mid.armSwing}`);
  assert.deepEqual(poseAt(timeline, -5), poseAt(timeline, 0), "clamped, not extrapolated");
  assert.deepEqual(poseAt(timeline, 5), poseAt(timeline, 1));

  // Interpolation is monotone through a rising segment, which is what makes a
  // swing read as a swing rather than a flicker.
  let previous = -Infinity;
  for (let at = 0.28; at <= 0.52; at += 0.02) {
    const value = poseAt(timeline, at).armSwing;
    assert.ok(value >= previous - 1e-9, `armSwing must not go backwards through the wind-up: ${value}`);
    previous = value;
  }
});

test("the timeout policy names itself, and waits before it gives up", () => {
  const timeline = timelineFor("attack7", { role: "actor" });
  assert.equal(abandonReasonFor(timeline, timeline.durationMs), null, "on time: keep waiting");
  assert.equal(
    abandonReasonFor(timeline, timeline.durationMs + ANIMATION_TIMEOUT_MS),
    null,
    "the whole grace period is waiting, not giving up"
  );
  const reason = abandonReasonFor(timeline, timeline.durationMs + ANIMATION_TIMEOUT_MS + 1);
  assert.equal(typeof reason, "string");
  assert.ok(reason.length > 0, "the gate refuses an unexplained abandonment");
  assert.match(reason, /gave up/, "it must say the surface gave up, not that the animation finished");
  assert.match(reason, /attack7/, "and name the timeline it gave up on");
});
