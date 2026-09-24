/**
 * A GLADIATOR IS DRAWN AT THE SIZE A SPELL LEAVES HIM — colossus, little fat
 * kid, and their expiry.
 *
 * ► **THE OWNER, 2026-09-24:** "In the last demo the shrink spell (i think
 *   thats what was used) didnt actually shrink the gladiator." It was not
 *   drawn: the engine has applied both spells' STATS since d551c57, and the
 *   figure took its size (`yscale`) from the construction's `place-clip` alone.
 *
 * What the build does, re-read for this change off the frame-52 action dump
 * (`sprite:862[overlay]/frame:52/DoAction@0x240c7f`, base `0x240c85`):
 *
 * ```text
 *   cast_little_fat_kid  defender.gotoAndPlay("little_fat_kid")     +0x82a2
 *                        defender.oldscale = ToNumber(_yscale)       +0x82b7
 *                        _yscale = ceil((50 - _yscale) / 2), never > 50,
 *                        so _xscale = _yscale = 50 the same tick     +0x833d-+0x83d7
 *   cast_colossus        attacker.gotoAndPlay("Colossus")            +0x806f
 *                        attacker.oldscale = _yscale; newscale = 450 +0x8084-+0x80aa
 *                        EVERY tick _yscale = ceil((450 - _yscale) / 2)   +0x80e7 (assigns)
 *   check_spells, == 0   _xscale = _yscale = oldscale                +0x2485, +0x2513
 * ```
 *
 * ► **THE RESTORE HERE IS TO THE ENTRY SIZE, NOT `oldscale`**, because the
 *   engine restores the two stats from `backup_*` and the drawn size must
 *   agree with it; `CommandKind.SCALE_CLIP` in `src/adapter/presentation.js`
 *   carries the decision and what it measured. The "both on one fighter"
 *   tests below pin it, and pin that the drawing and the engine's strength
 *   agree at every step.
 *
 * Every bout here is driven through the host the arena builds
 * (`createVanillaBattleHost` with `demoSide`), folded with the page's own
 * `applyCommands`, and drawn with the page's own `figureYscaleAt`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { Ss2ActionType, ss2BattleValues, ss2Combatant, ss2PhysicalSize, ss2TeamRules } from "../src/team/ss2-rules.js";
import {
  buildArenaLayout, CommandKind, createVanillaBattleHost, presentResolvedEvents, SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";
import {
  applyCommands, emptyScene, figureYscaleAt, flightDurationMs, launchLiftFor, ProjectileKind, projectileFlight,
  reactionDelaysFor, timelinesForStep
} from "../src/render/index.js";
import { SS2_FIGURE_HALF_WIDTH } from "../src/common/ss2-figure.js";
import { demoSide } from "../tools/arena/roster.js";

const TICK_MS = 1000 / 30;
const scalesIn = (commands) => commands.filter((command) => command.kind === CommandKind.SCALE_CLIP);

/** The arena's own host, with each side's items given separately. */
function arenaHost({ perSide = 1, red = [], blue = [], seed = 1 } = {}) {
  return createVanillaBattleHost({
    teams: [
      demoSide("red", perSide, { ss2Combatant, ss2BattleValues, items: red }),
      demoSide("blue", perSide, { ss2Combatant, ss2BattleValues, items: blue })
    ],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed
  });
}

/**
 * Plays a SCRIPT — `[actorId, type, targetId]` in order — resting everybody
 * else, until `until(host)` holds. Returns every step with the scene it left.
 */
function play(host, script, until, cap = 200) {
  let scene = applyCommands(emptyScene(), host.constructArena().commands);
  const construction = Object.fromEntries(Object.entries(scene.actors).map(([id, actor]) => [id, actor.yscale]));
  const steps = [];
  let next = 0;
  for (let n = 0; n < cap && !host.battle.result && !until(host, next); n += 1) {
    const actorId = host.currentCombatantId();
    const wanted = script[next];
    const option = wanted && wanted[0] === actorId
      ? host.legalActions().find((entry) => entry.type === wanted[1] && entry.targetId === wanted[2])
      : null;
    if (wanted && wanted[0] === actorId) assert.ok(option, `${actorId} was offered no ${wanted[1]} at ${wanted[2]}`);
    if (option) next += 1;
    const action = option ?? { type: Ss2ActionType.REST, targetId: actorId };
    const step = host.submit({ actorId, ...action });
    scene = applyCommands(scene, step.commands);
    steps.push({ step, scene, action: { actorId, ...action }, wire: host.wire() });
  }
  return { steps, construction };
}

const fighter = (entry, id) => entry.wire.teams.flatMap((team) => team.combatants).find((one) => one.id === id);
const counterOf = (entry, id, name) => fighter(entry, id).resources?.[name]?.value ?? null;

/* ------------------------------------------------------------------ */
/* Little fat kid                                                      */
/* ------------------------------------------------------------------ */

test("A LITTLE FAT KID SHRINKS ITS VICTIM TO 50 FROM THE FIRST FRAME OF HIS OWN CLIP, while the engine halves his strength", () => {
  const host = arenaHost({ blue: [33] });
  const { steps, construction } = play(host, [["blue-1", Ss2ActionType.CAST_LITTLE_FAT_KID, "red-1"]], (h, next) => next > 0);
  const cast = steps.findIndex((entry) => entry.action.type === Ss2ActionType.CAST_LITTLE_FAT_KID);
  assert.ok(cast >= 0, "the script cast the spell");
  const entry = construction["red-1"];
  assert.equal(entry, ss2PhysicalSize({ stats: { strength: 9 } }), "the victim entered at the build's own 80 + round(9 / 1.5)");

  // THE CAST: one scale-clip, on the VICTIM, after his `little_fat_kid` clip.
  const { step, scene } = steps[cast];
  const [shrink, ...others] = scalesIn(step.commands);
  assert.deepEqual(others, [], "one size change, and only the victim's");
  assert.deepEqual(
    { combatantId: shrink.combatantId, from: shrink.from, to: shrink.to, at: shrink.at, counter: shrink.counter, growth: shrink.growth },
    { combatantId: "red-1", from: entry, to: 50, at: "action-start", counter: "spell_little_fat_kid", growth: undefined }
  );
  const victimClip = step.commands.findIndex((command) =>
    command.kind === CommandKind.CLIP_GOTO && command.combatantId === "red-1" && command.label === "little_fat_kid");
  assert.ok(victimClip >= 0 && victimClip < step.commands.indexOf(shrink),
    "the clip first, then the scale: `gotoAndPlay` at +0x82a2, the scale from +0x82b7");
  assert.equal(scene.actors["red-1"].yscale, 50, "the scene rests him at 50");
  assert.ok(scene.actors["red-1"].xscale > 0, "a hero-side clip keeps its positive mirror");

  // DRAWN: the old size until his clip begins, 50 from its first frame.
  const token = step.actionBoundary;
  const started = timelinesForStep(step.commands).started.get("red-1");
  assert.equal(started.timeline.label, "little_fat_kid");
  assert.equal(started.token, token, "the clock the snap reads is his own clip's, for the same action");
  const drawn = (elapsedMs, pending = [token]) => figureYscaleAt({
    yscale: scene.actors["red-1"].yscale, rescale: scene.actors["red-1"].rescale, pendingTokens: pending, elapsedMs
  });
  assert.equal(drawn(-1), entry, "before his clip begins he is his own size");
  assert.equal(drawn(0), 50, "on its first frame he is 50 — the build snaps in the tick it starts the clip");
  assert.equal(drawn(400), 50);
  assert.equal(drawn(null), 50, "with no clock to read, the snap has happened");
  assert.equal(drawn(0, []), 50, "and once the action is over, the scene's 50");

  // THE ENGINE: strength halved from the backup, and `physical_size` from it.
  assert.equal(fighter(steps[cast], "red-1").stats.strength, 5, "round(9 / 2)");
  assert.equal(ss2PhysicalSize(fighter(steps[cast], "red-1")), 83,
    "the engine's `physical_size` follows the spell — and is NOT the drawn 50, in the build as here");
});

test("little fat kid: the RESTORE lands on the 16th phase counting the cast's own, at the phase advance, and nowhere else", () => {
  const host = arenaHost({ blue: [33] });
  const { steps, construction } = play(host, [["blue-1", Ss2ActionType.CAST_LITTLE_FAT_KID, "red-1"]], () => false, 40);
  const cast = steps.findIndex((entry) => entry.action.type === Ss2ActionType.CAST_LITTLE_FAT_KID);
  const restore = steps.findIndex((entry, index) => index > cast && scalesIn(entry.step.commands).length > 0);
  assert.equal(restore - cast + 1, 16, "the expiry is the 16th `nextphase` counting the cast's own (map, VERIFIED)");
  assert.equal(counterOf(steps[restore - 1], "red-1", "spell_little_fat_kid"), 1);
  assert.equal(counterOf(steps[restore], "red-1", "spell_little_fat_kid"), -1);

  const { step, scene } = steps[restore];
  const [back, ...others] = scalesIn(step.commands);
  assert.deepEqual(others, []);
  assert.deepEqual({ combatantId: back.combatantId, from: back.from, to: back.to, at: back.at },
    { combatantId: "red-1", from: 50, to: construction["red-1"], at: "phase-advance" });
  assert.equal(fighter(steps[restore], "red-1").stats.strength, 9, "the engine puts his strength back in the same phase");
  // `check_spells` runs before `changeCombatants` turns anybody.
  const firstTurn = step.commands.findIndex((command) => command.kind === CommandKind.FACE_CLIP && command.at !== "action-start");
  if (firstTurn >= 0) assert.ok(step.commands.indexOf(back) < firstTurn, "the restore precedes the phase advance's turns");

  const token = step.actionBoundary;
  const drawn = (pending) => figureYscaleAt({
    yscale: scene.actors["red-1"].yscale, rescale: scene.actors["red-1"].rescale, pendingTokens: pending, elapsedMs: 0
  });
  assert.equal(drawn([token]), 50, "HELD small while the expiring action plays: `check_spells` runs in `nextphase`");
  assert.equal(drawn([]), construction["red-1"], "his own size once it is over");

  // Nothing else in the bout resizes anybody.
  const resized = steps.flatMap((entry, index) => scalesIn(entry.step.commands).map(() => index));
  assert.deepEqual(resized, [cast, restore]);
});

/* ------------------------------------------------------------------ */
/* Colossus                                                            */
/* ------------------------------------------------------------------ */

test("A COLOSSUS GROWS AS THE BUILD TWEENS IT — the arm's own recurrence, a tick a frame from its clip's first — and its expiry restores him", () => {
  const host = arenaHost({ red: [42] });
  const { steps, construction } = play(host, [["red-1", Ss2ActionType.CAST_COLOSSUS, "red-1"]], () => false, 40);
  const cast = steps.findIndex((entry) => entry.action.type === Ss2ActionType.CAST_COLOSSUS);
  assert.ok(cast >= 0);
  const { step, scene } = steps[cast];
  const [grow, ...others] = scalesIn(step.commands);
  assert.deepEqual(others, []);
  assert.deepEqual(
    { combatantId: grow.combatantId, from: grow.from, to: grow.to, at: grow.at, growth: grow.growth },
    { combatantId: "red-1", from: construction["red-1"], to: 150, at: "action-start", growth: { newscale: 450 } }
  );
  const casterClip = step.commands.findIndex((command) =>
    command.kind === CommandKind.CLIP_GOTO && command.combatantId === "red-1" && command.label === "Colossus");
  assert.ok(casterClip >= 0 && casterClip < step.commands.indexOf(grow), "`gotoAndPlay(\"Colossus\")` (+0x806f), then the scale");
  assert.equal(scene.actors["red-1"].yscale, 150);
  assert.equal(fighter(steps[cast], "red-1").stats.strength, 27, "the engine triples strength from the backup");

  // Frame by frame: the first frame already shows the first tick (the
  // once-block and the first write run in one call), and it swings about 150.
  const token = step.actionBoundary;
  const frames = [];
  for (let k = 0; k <= 10; k += 1) {
    frames.push(figureYscaleAt({
      yscale: scene.actors["red-1"].yscale, rescale: scene.actors["red-1"].rescale, pendingTokens: [token], elapsedMs: k * TICK_MS + 1
    }));
  }
  assert.deepEqual(frames, [182, 134, 158, 146, 152, 149, 151, 150, 150, 150, 150],
    "ceil((450 - y) / 2) from 86: the build's ASSIGN-not-add, oscillation and all");
  assert.equal(figureYscaleAt({
    yscale: 150, rescale: scene.actors["red-1"].rescale, pendingTokens: [token], elapsedMs: -1
  }), construction["red-1"], "before the clip begins, his own size");

  const restore = steps.findIndex((entry, index) => index > cast && scalesIn(entry.step.commands).length > 0);
  assert.equal(restore - cast + 1, 16, "colossus's 16 run out on the 16th phase too");
  const [back] = scalesIn(steps[restore].step.commands);
  assert.deepEqual({ from: back.from, to: back.to, at: back.at, counter: back.counter },
    { from: 150, to: construction["red-1"], at: "phase-advance", counter: "spell_colossus" });
  assert.equal(fighter(steps[restore], "red-1").stats.strength, 9);
});

/* ------------------------------------------------------------------ */
/* Both on one fighter                                                 */
/* ------------------------------------------------------------------ */

/**
 * The drawn size the ENGINE's strength implies, for these rosters (strength
 * 9, no bloodlust): halved -> 50, tripled -> 150, the backup -> the entry size.
 */
const impliedBy = (strength, entry) => ({ 5: 50, 27: 150, 9: entry })[strength];

function bothOnOne(script) {
  const host = arenaHost({ red: [42], blue: [33] });
  const { steps, construction } = play(host, script, () => false, 60);
  const entry = construction["red-1"];
  // At EVERY step, the size red-1 rests at is the one the engine's strength says.
  for (const [index, { scene }] of steps.entries()) {
    const strength = fighter(steps[index], "red-1").stats.strength;
    assert.equal(scene.actors["red-1"].yscale, impliedBy(strength, entry),
      `step ${index + 1}: drawn ${scene.actors["red-1"].yscale} with the engine at strength ${strength}`);
  }
  return { steps, entry };
}

test("BOTH ON ONE FIGHTER, colossus then little fat kid: 150, then 50, then his own size at the FIRST expiry — as the engine's strength", () => {
  const { steps, entry } = bothOnOne([
    ["red-1", Ss2ActionType.CAST_COLOSSUS, "red-1"],
    ["blue-1", Ss2ActionType.CAST_LITTLE_FAT_KID, "red-1"]
  ]);
  const changes = steps.flatMap((step, index) => scalesIn(step.step.commands).map((command) =>
    ({ index, from: command.from, to: command.to, at: command.at, counter: command.counter })));
  assert.equal(changes.length, 3, JSON.stringify(changes));
  assert.deepEqual(changes.map(({ from, to, at, counter }) => ({ from, to, at, counter })), [
    { from: entry, to: 150, at: "action-start", counter: "spell_colossus" },
    { from: 150, to: 50, at: "action-start", counter: "spell_little_fat_kid" },
    // The colossus runs out first and the engine puts strength back to 9 WHILE
    // little fat kid's counter still runs; the build would restore his shared
    // `oldscale` — 150, captured by little fat kid — and keep him at 150 for
    // good. The second expiry finds nothing to change.
    { from: 50, to: entry, at: "phase-advance", counter: "spell_colossus" }
  ]);
  const colossusOut = changes[2].index;
  assert.ok(counterOf(steps[colossusOut], "red-1", "spell_little_fat_kid") > 0, "little fat kid's counter is still running");
  const fatKidOut = steps.findIndex((step) => counterOf(step, "red-1", "spell_little_fat_kid") === -1
    && steps.indexOf(step) > changes[1].index);
  assert.ok(fatKidOut > colossusOut, "and runs out later, with no scale-clip");
});

test("BOTH ON ONE FIGHTER, little fat kid then colossus: 50, GROWING from 50, then his own size at the first expiry", () => {
  const { steps, entry } = bothOnOne([
    ["blue-1", Ss2ActionType.CAST_LITTLE_FAT_KID, "red-1"],
    ["red-1", Ss2ActionType.CAST_COLOSSUS, "red-1"]
  ]);
  const changes = steps.flatMap((step, index) => scalesIn(step.step.commands).map((command) => ({ index, command })));
  assert.deepEqual(changes.map(({ command }) => [command.from, command.to, command.at, command.counter]), [
    [entry, 50, "action-start", "spell_little_fat_kid"],
    [50, 150, "action-start", "spell_colossus"],
    [150, entry, "phase-advance", "spell_little_fat_kid"]
  ]);
  // The growth from 50: 200, 125, 163, 144, 153, 149, 151, 150.
  const { index, command } = changes[1];
  const actor = steps[index].scene.actors["red-1"];
  const frames = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => figureYscaleAt({
    yscale: actor.yscale, rescale: actor.rescale, pendingTokens: [command.actionToken], elapsedMs: k * TICK_MS + 1
  }));
  assert.deepEqual(frames, [200, 125, 163, 144, 153, 149, 151, 150]);
});

/* ------------------------------------------------------------------ */
/* The arrow                                                           */
/* ------------------------------------------------------------------ */

test("AN ARROW AT A SHRUNKEN VICTIM LANDS ON HIS DRAWN BODY: its stop, its landing height and the victim's reaction all read 50", () => {
  // 2v2: red-2 is the arena's archer, one rank back, level with blue-2.
  const host = arenaHost({ perSide: 2, red: [33] });
  const { steps } = play(host, [
    ["red-1", Ss2ActionType.CAST_LITTLE_FAT_KID, "blue-2"],
    ["red-2", "swap-weapons", "red-2"],
    ["red-2", "snipe", "blue-2"]
  ], () => false, 12);
  const shot = steps.find((entry) => entry.action.type === "snipe");
  assert.ok(shot, "the archer shot the shrunken man");
  const fired = shot.step.commands.find((command) => command.kind === CommandKind.FIRE_PROJECTILE);
  const target = shot.scene.actors["blue-2"];
  assert.equal(target.yscale, 50, "he is drawn at 50 when the arrow is loosed");
  assert.equal(fired.targetSize, SS2_FIGURE_HALF_WIDTH * 50 / 100, "the stop is his DRAWN front, 20.7 short of his centre");
  // What it was before: his `physical_size`, which the engine has at 83 — an
  // arrow ending ~14 units in front of the body on screen.
  const engineSize = ss2PhysicalSize(fighter(shot, "blue-2"));
  assert.equal(engineSize, 80 + Math.round(4 / 1.5), "round(8 / 2) = 4 -> 83");
  assert.ok(SS2_FIGURE_HALF_WIDTH * engineSize / 100 > SS2_FIGURE_HALF_WIDTH * 50 / 100 + 10,
    "the old stop would have ended well clear of him");

  // The page's flight, with the page's own drawn sizes.
  const drawnYscale = (id) => figureYscaleAt({
    yscale: shot.scene.actors[id].yscale, rescale: shot.scene.actors[id].rescale,
    pendingTokens: [shot.step.actionBoundary], elapsedMs: null
  });
  const flight = projectileFlight({
    kind: fired.projectile, from: fired.from, to: fired.to, sequence: fired.sequence, targetSize: fired.targetSize,
    shooterYscale: drawnYscale("red-2"), targetYscale: drawnYscale("blue-2")
  });
  const reach = SS2_FIGURE_HALF_WIDTH * drawnYscale("blue-2") / 100;
  assert.ok(Math.abs(flight.impact.x - target.x) <= reach + 1e-9, "the flight ends ON his drawn body");
  assert.equal(flight.impact.lift, launchLiftFor(ProjectileKind.SNIPE, 50), "at his drawn shoulder, 50 * 1.5 + 5");
  assert.equal(reactionDelaysFor(shot.step.commands).get("blue-2"), flightDurationMs(flight),
    "and he reacts on the frame that drawn arrow arrives — the stop the delay reads is the same one");
});

test("a presentation with no memory of a resize stops the arrow where it always did, and one told of it stops at the drawn body", () => {
  const gladiator = (id, teamId, x, strength) => ({
    id, name: id, teamId, seatId: id, slotIndex: 0, aiFilled: false, alive: true, health: 40, maxHealth: 40,
    stats: { strength }, loadout: {}, resources: {}, status: [], x, y: 200
  });
  const wire = {
    teams: [
      { id: "red", combatants: [gladiator("red-1", "red", -300, 9)] },
      { id: "blue", combatants: [gladiator("blue-1", "blue", 300, 9)] }
    ],
    events: [{ sequence: 1, actorId: "red-1", targetId: "blue-1", hit: true, dispatchedMethod: "normal",
      type: "bombard", attackDirection: 21 }]
  };
  const stop = (clipScales) => presentResolvedEvents(wire, {
    layout: buildArenaLayout(wire), bindings: SS2_STATIC_MAP_BINDINGS, clipScales
  }).commands.find((command) => command.kind === CommandKind.FIRE_PROJECTILE).targetSize;
  assert.equal(stop(null), SS2_FIGURE_HALF_WIDTH * 86 / 100);
  assert.equal(stop({ "blue-1": 50 }), SS2_FIGURE_HALF_WIDTH * 50 / 100);
  assert.equal(stop(new Map([["blue-1", 150]])), SS2_FIGURE_HALF_WIDTH * 150 / 100);
});

/* ------------------------------------------------------------------ */
/* The scene and the clock                                             */
/* ------------------------------------------------------------------ */

test("a scale-clip folds `xscale` (sign kept), `yscale` and `rescale`, and one action's stages accumulate", () => {
  const placed = applyCommands(emptyScene(), [{
    kind: "place-clip", combatantId: "v", x: 100, y: 200, facing: "left", xscale: -86, yscale: 86, geometryAuthored: false
  }]);
  const shrunk = applyCommands(placed, [
    { kind: "scale-clip", sequence: 4, combatantId: "v", from: 150, to: 50, at: "action-start", actionToken: 4 },
    { kind: "scale-clip", sequence: 5, combatantId: "v", from: 50, to: 86, at: "phase-advance", actionToken: 4 }
  ]);
  const actor = shrunk.actors.v;
  assert.equal(actor.xscale, -86, "the villain's mirror survives: the build's positive `_xscale` is not reproduced");
  assert.equal(actor.yscale, 86);
  assert.deepEqual(actor.rescale.stages.map((stage) => [stage.from, stage.to, stage.at]),
    [[150, 50, "action-start"], [50, 86, "phase-advance"]]);
  assert.deepEqual([actor.x, actor.y, actor.facing], [100, 200, "left"], "and nothing else moves");
  // A cast AND an expiry in one action: the cast's size while it plays, the restore after.
  assert.equal(figureYscaleAt({ yscale: 86, rescale: actor.rescale, pendingTokens: [4], elapsedMs: 10 }), 50);
  assert.equal(figureYscaleAt({ yscale: 86, rescale: actor.rescale, pendingTokens: [4], elapsedMs: -5 }), 150);
  assert.equal(figureYscaleAt({ yscale: 86, rescale: actor.rescale, pendingTokens: [], elapsedMs: 10 }), 86);

  // The next action's stages replace them.
  const next = applyCommands(shrunk, [
    { kind: "scale-clip", sequence: 9, combatantId: "v", from: 86, to: 50, at: "action-start", actionToken: 9 }
  ]);
  assert.deepEqual(next.actors.v.rescale.stages.map((stage) => stage.from), [86]);
  // With no token (no action boundaries supplied) the change is drawn at once.
  const tokenless = applyCommands(placed, [
    { kind: "scale-clip", sequence: 1, combatantId: "v", from: 86, to: 50, at: "action-start" }
  ]);
  assert.equal(figureYscaleAt({ yscale: 50, rescale: tokenless.actors.v.rescale, pendingTokens: [1], elapsedMs: -1 }), 50);
});
