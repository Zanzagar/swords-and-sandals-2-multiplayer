/**
 * THE SCREEN DRAWS EVERY FIGURE WHERE THE ENGINE HAS IT.
 *
 * ► **FOUND 2026-09-23 BY FOUR INVESTIGATORS, EACH CONFIRMED BY A WRITE-NOTHING
 *   REFUTER** (the `out-of-range-hits`, `engine-vs-screen` and
 *   `spell-animations` questions of that day's arena audit). The owner watched
 *   the browser arena and saw "people hitting each other not in melee range".
 *   The engine never let a melee swing land out of reach; the SCREEN drew the
 *   figures somewhere else:
 *
 *   1. **A knockback was never presented.** `damagecharacter`'s knockback moves
 *      the victim — a normal or power blow in directions 5-12, a whirlwind, a
 *      ghost strike — and no `move-clip` was emitted, so the victim was drawn
 *      where it had stood until its own next step: up to 191 units from its
 *      engine x (buffs kit, 3v3, seeds 1-25, at bf53d81). `facingChangesFor`
 *      was already total for FACING; this
 *      file pins that presentation is now total for POSITION too.
 *   2. **The ghost strike's blink was never drawn**, so the caster swung from
 *      500+ units away.
 *   3. **A lane change did not hold the gate**, so the next blow was drawn
 *      mid-slide or snapped the figure a whole lane in one frame.
 *   4. **A lethal blow dropped its victim's reaction** — the death clip replaced
 *      the hurt/burning/lightning clip in the same batch.
 *
 * The sweeps drive REAL bouts through the host the arena builds, with the
 * page's own fold (`applyCommands`) and the page's own pairing
 * (`timelinesForStep`), and each asserts it FOUND the case it is about.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, legalActions, toTeamWireState
} from "../src/team/index.js";
import {
  SS2_CROWD, SS2_FACING_LEFT, Ss2ActionType, ss2BattleValues, ss2Combatant, ss2PhysicalSize, ss2TeamRules
} from "../src/team/ss2-rules.js";
import {
  buildArenaLayout, CommandKind, createVanillaBattleHost, presentArenaConstruction, presentResolvedEvents,
  SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";
import {
  animationCursor, applyCommands, emptyScene, figureXAt, figureYAt, flightDurationMs, poseAt, projectileFlight,
  reactionDelaysFor, timelineFor, timelinesForStep
} from "../src/render/index.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";

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

/**
 * Act, then present THE WAY THE HOST DOES — with the projection taken before
 * the action as `before`, which is what `battle-host.js` hands the binder.
 */
function actAndPresent(battle, action) {
  const before = toTeamWireState(battle);
  const constructed = applyCommands(emptyScene(), presentArenaConstruction(buildArenaLayout(before)));
  applyAction(battle, { actorId: "hero", ...action });
  const wire = toTeamWireState(battle);
  const { commands } = presentResolvedEvents(wire, {
    layout: buildArenaLayout(wire), bindings: SS2_STATIC_MAP_BINDINGS, before
  });
  return { before, commands, scene: applyCommands(constructed, commands) };
}

const moves = (commands) => commands.filter((command) => command.kind === CommandKind.MOVE_CLIP);

/** The pose a figure holds when it is not lunging: position only, no authored step. */
const STILL = Object.freeze({ ...poseAt(timelineFor("Standing", { role: "actor" }), 0), advance: 0 });

test("a POWER ATTACK that knocks its victim back moves the victim on screen, to where the engine put it", () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const battle = staged({ seed });
    if (!legalActions(battle, "hero").some((option) => option.type === Ss2ActionType.POWER_ATTACK)) continue;
    const fromX = combatantById(battle, "foe").x;
    const { commands, scene } = actAndPresent(battle, { type: Ss2ActionType.POWER_ATTACK, targetId: "foe" });
    const event = battle.events.find((entry) => entry.type === Ss2ActionType.POWER_ATTACK);
    const toX = combatantById(battle, "foe").x;
    if (!Number.isFinite(event?.knockback?.force) || toX === fromX) continue;

    const pushed = moves(commands).filter((command) => command.combatantId === "foe");
    assert.equal(pushed.length, 1, `seed ${seed}: exactly one move for the knocked-back victim`);
    assert.equal(pushed[0].from, fromX, "from where the victim stood before the blow");
    assert.equal(pushed[0].to, toX, "to the engine's own x after it");
    assert.equal(pushed[0].pushed, true, "a push, so it rides whatever the victim plays");
    assert.equal(scene.actors.foe.x, toX, "the scene's resting x is the engine's");
    assert.deepEqual(moves(commands).filter((command) => command.combatantId === "hero"), [],
      "and the attacker, who did not move, is not moved");

    // The victim SLIDES on its own reaction clip, rather than snapping.
    const { started } = timelinesForStep(commands);
    const entry = started.get("foe");
    assert.ok(entry, "the victim plays a clip for the blow");
    const halfway = figureXAt({ restingX: scene.actors.foe.x, facing: "left", pose: STILL, timeline: entry.timeline, motion: entry.motion, at: 0.5 });
    assert.equal(halfway, fromX + (toX - fromX) / 2, "halfway through its reaction it is halfway there");
    return;
  }
  assert.fail("no power attack knocked its victim back in 200 seeds");
});

test("a batch presented WITHOUT a `before` projection moves nobody it cannot account for", () => {
  // The same rule `facingChangesFor` keeps: no `before`, no comparison, nothing
  // invented. A caller that wants the screen total hands `before` in.
  for (let seed = 1; seed <= 200; seed += 1) {
    const battle = staged({ seed });
    if (!legalActions(battle, "hero").some((option) => option.type === Ss2ActionType.POWER_ATTACK)) continue;
    const fromX = combatantById(battle, "foe").x;
    applyAction(battle, { actorId: "hero", type: Ss2ActionType.POWER_ATTACK, targetId: "foe" });
    if (combatantById(battle, "foe").x === fromX) continue;
    const wire = toTeamWireState(battle);
    const { commands } = presentResolvedEvents(wire, { layout: buildArenaLayout(wire), bindings: SS2_STATIC_MAP_BINDINGS });
    assert.deepEqual(moves(commands), []);
    return;
  }
  assert.fail("no power attack knocked its victim back in 200 seeds");
});

/* ------------------------------------------------------------------ *
 * The sweep: real bouts, the arena's own host                         *
 * ------------------------------------------------------------------ */

function arenaHost({ perSide, seed, items = [] }) {
  return createVanillaBattleHost({
    teams: [
      demoSide("red", perSide, { ss2Combatant, ss2BattleValues, items }),
      demoSide("blue", perSide, { ss2Combatant, ss2BattleValues, items })
    ],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed,
    awaitAnimations: true
  });
}

/** The spectator's own choice — `host.suggestAction`, what `spectateStep` calls. */
const spectator = (host, actorId) => host.suggestAction(actorId);

/**
 * A HUMAN who likes heavy blows: a power or normal attack whenever one is on
 * offer. The AI only quick-attacks on the plain roster, so without this the
 * directions that knock back (5-12) never occur there — and a person clicking
 * "power-attack" on the plain URL hit exactly this bug (refuter, F1).
 */
function heavyHitter(host, actorId) {
  const options = host.legalActions();
  return options.find((option) => option.type === Ss2ActionType.POWER_ATTACK)
    ?? options.find((option) => option.type === Ss2ActionType.NORMAL_ATTACK)
    ?? host.suggestAction(actorId);
}

/**
 * Plays whole bouts and checks, after EVERY action, that each figure rests —
 * and ends its clip — exactly where the engine has it. Returns what it saw, so
 * each caller can assert it found the case it is about.
 */
function sweep({ kit = null, perSide, seeds, policy = spectator, cap = 1500 }) {
  const seen = { actions: 0, knockbacks: 0, pushedVictims: 0 };
  for (const seed of seeds) {
    const host = arenaHost({ perSide, seed, items: demoItemsFrom(kit) });
    let scene = applyCommands(emptyScene(), host.constructArena().commands);
    for (let n = 0; n < cap && !host.battle.result; n += 1) {
      const actorId = host.currentCombatantId();
      if (host.legalActions().length === 0) break;
      const action = policy(host, actorId);
      const step = host.submit({ ...action, actorId });
      seen.actions += 1;
      scene = applyCommands(scene, step.commands);
      const { started } = timelinesForStep(step.commands);
      const where = `${kit ?? "plain"} ${perSide}v${perSide} seed ${seed} action ${n + 1} (${action.type} by ${actorId})`;

      for (const event of host.wire().events) {
        if (event.sequence < step.actionBoundary || !Number.isFinite(event.knockback?.force)) continue;
        seen.knockbacks += 1;
        if (moves(step.commands).some((command) => command.combatantId === event.targetId && command.pushed === true)) {
          seen.pushedVictims += 1;
        }
      }

      for (const combatant of host.wire().teams.flatMap((team) => team.combatants)) {
        const actor = scene.actors[combatant.id];
        assert.equal(actor.x, combatant.x, `${where}: ${combatant.id} rests at x ${actor.x}, the engine has ${combatant.x}`);
        if (Number.isFinite(combatant.y)) {
          assert.equal(actor.y, combatant.y, `${where}: ${combatant.id} rests at y ${actor.y}, the engine has ${combatant.y}`);
        }
        const entry = started.get(combatant.id);
        if (!entry) continue;
        const endX = figureXAt({ restingX: actor.x, facing: actor.facing, pose: STILL, timeline: entry.timeline, motion: entry.motion, at: 1 });
        assert.equal(endX, combatant.x, `${where}: ${combatant.id}'s "${entry.timeline.label}" ends at x ${endX}, the engine has ${combatant.x}`);
        if (Number.isFinite(combatant.y)) {
          const endY = figureYAt({ restingY: actor.y, timeline: entry.timeline, depthMotion: entry.depthMotion, at: 1 });
          assert.equal(endY, combatant.y, `${where}: ${combatant.id}'s "${entry.timeline.label}" ends at y ${endY}`);
        }
      }
      for (const token of step.actionTokens) host.reportActionAnimation(token);
    }
  }
  return seen;
}

test("SWEEP: with the tricks kit (whirlwind, ghost strike) every figure rests where the engine has it", () => {
  const seen = sweep({ kit: "tricks", perSide: 3, seeds: [1, 7, 17] });
  assert.ok(seen.knockbacks >= 5, `the sweep must have met knockbacks to prove anything: ${seen.knockbacks}`);
  assert.equal(seen.pushedVictims, seen.knockbacks, "every knocked-back victim was presented as pushed");
});

test("SWEEP: a human throwing power and normal blows on the plain roster is drawn where the engine has it", () => {
  const seen = sweep({ perSide: 1, seeds: [1, 2, 3, 4], policy: heavyHitter });
  const teams = sweep({ perSide: 2, seeds: [5, 6], policy: heavyHitter });
  assert.ok(seen.knockbacks + teams.knockbacks >= 10,
    `power and normal blows must have knocked back: ${seen.knockbacks} + ${teams.knockbacks}`);
});

test("SWEEP: the buffs kit's normal attacks knock back and are drawn where the engine has them", () => {
  const seen = sweep({ kit: "buffs", perSide: 3, seeds: [5, 6] });
  assert.ok(seen.knockbacks >= 1, `the buffs kit must have met a knockback: ${seen.knockbacks}`);
});

/* ------------------------------------------------------------------ *
 * 2. The ghost strike's blink                                         *
 * ------------------------------------------------------------------ */

/**
 * ► **THE BUILD PUTS THE CASTER BESIDE ITS VICTIM BEFORE THE SWING**:
 *   `attacker_old_x = _x` (`+0x7e3c`), `_x = defender._x ± physical_size`
 *   (`+0x7e64`-`+0x7eac`), THEN `checkattackroll()` (`+0x7f77`), and the restore
 *   to `attacker_old_x` on the completion tick (`+0x7f9f`) — quoted in
 *   `SS2_GHOST_STRIKE`'s docblock. The AI only casts it beyond 500, so without
 *   the blink every strike was a swing at nobody from across the sands.
 */
const GHOST = Ss2ActionType.CAST_GHOST_STRIKE;

function face(battle, id, facing) {
  const combatant = combatantById(battle, id);
  combatant.status = combatant.status.filter((token) => token !== SS2_FACING_LEFT);
  if (facing === "left") combatant.status.push(SS2_FACING_LEFT);
}

test("a ghost strike that does NOT kill blinks its caster beside the victim for the swing, then puts it back", () => {
  for (const [heroX, foeX, heroFacing] of [[0, 1200, "right"], [1200, 0, "left"]]) {
    const battle = staged({ heroX, foeX, hero: { inventory1: 36 } });
    // Facing is status, set at construction from the default placements; the
    // staging moves the pair, so it turns them to face each other as well.
    face(battle, "hero", heroFacing);
    face(battle, "foe", heroFacing === "right" ? "left" : "right");
    const size = ss2PhysicalSize(combatantById(battle, "hero"));
    const landing = heroFacing === "right" ? foeX - size : foeX + size;
    const { commands, scene } = actAndPresent(battle, { type: GHOST, targetId: "foe" });
    assert.ok(combatantById(battle, "foe").alive, "the victim survives, or this is the other test");
    assert.equal(combatantById(battle, "hero").x, heroX, "the engine writes no position on a strike that does not kill");

    const blinks = moves(commands).filter((command) => command.combatantId === "hero");
    assert.equal(blinks.length, 1, "one move for the caster");
    assert.equal(blinks[0].from, heroX);
    assert.equal(blinks[0].to, heroX, "it ends where it began");
    assert.equal(blinks[0].blink, landing, "beside the victim, on the side that keeps it facing its victim");
    assert.equal(scene.actors.hero.x, heroX, "the scene rests it where the engine has it");
    assert.equal(scene.actors.hero.motion.blink, landing, "and carries the blink on its motion record");

    const entry = timelinesForStep(commands).started.get("hero");
    assert.match(entry.timeline.label, /^attack(9|10|11|12)$/, "the caster swings the power band");
    const drawn = (at) => figureXAt({ restingX: scene.actors.hero.x, facing: heroFacing, pose: STILL, timeline: entry.timeline, motion: entry.motion, at });
    assert.equal(drawn(0), landing, "from the first frame of the swing it stands beside the victim");
    assert.equal(drawn(0.5), landing);
    assert.equal(drawn(1), heroX, "and is back where it began when the clip ends");
    assert.equal(drawn(-0.1), heroX, "before its clip begins it has not blinked yet");
  }
});

test("a LETHAL ghost strike blinks its caster beside the body BEFORE the swing, and it stays there", () => {
  const battle = staged({ heroX: 0, foeX: 1200, hero: { inventory1: 36, attack: 100, strength: 60 }, foe: { vitality: 1 } });
  combatantById(battle, "foe").health = 1;
  const landing = 1200 - ss2PhysicalSize(combatantById(battle, "hero"));
  const { commands, scene } = actAndPresent(battle, { type: GHOST, targetId: "foe" });
  assert.equal(combatantById(battle, "foe").alive, false, "the strike must kill");
  const blinks = moves(commands).filter((command) => command.combatantId === "hero");
  assert.equal(blinks.length, 1);
  assert.deepEqual({ from: blinks[0].from, to: blinks[0].to, blink: blinks[0].blink }, { from: 0, to: landing, blink: landing },
    "the move to the body is kept, and the caster is beside it from the first frame, not only once the clip ends");
  const entry = timelinesForStep(commands).started.get("hero");
  for (const at of [0, 0.5, 1]) {
    assert.equal(figureXAt({ restingX: scene.actors.hero.x, facing: "right", pose: STILL, timeline: entry.timeline, motion: entry.motion, at }), landing,
      `at ${at} the killer is beside the body`);
  }
});

test("SWEEP: every ghost strike in real bouts is drawn beside its victim for the swing", () => {
  let strikes = 0;
  for (const seed of [1, 7, 17]) {
    const host = arenaHost({ perSide: 3, seed, items: demoItemsFrom("tricks") });
    let scene = applyCommands(emptyScene(), host.constructArena().commands);
    for (let n = 0; n < 1500 && !host.battle.result; n += 1) {
      const actorId = host.currentCombatantId();
      if (host.legalActions().length === 0) break;
      const action = host.suggestAction(actorId);
      const before = new Map(host.wire().teams.flatMap((team) => team.combatants).map((c) => [c.id, c]));
      const step = host.submit({ ...action, actorId });
      scene = applyCommands(scene, step.commands);
      if (action.type === GHOST) {
        strikes += 1;
        const caster = before.get(actorId);
        const victim = before.get(action.targetId);
        const entry = timelinesForStep(step.commands).started.get(actorId);
        const x = figureXAt({ restingX: scene.actors[actorId].x, facing: "right", pose: STILL, timeline: entry.timeline, motion: entry.motion, at: 0.5 });
        const gap = Math.abs(x - victim.x);
        assert.equal(gap, ss2PhysicalSize(caster),
          `seed ${seed} action ${n + 1}: ${actorId} is drawn ${gap} from ${action.targetId} mid-swing`);
      }
      for (const token of step.actionTokens) host.reportActionAnimation(token);
    }
  }
  assert.ok(strikes >= 5, `the tricks bouts must have cast ghost strikes: ${strikes}`);
});

/* ------------------------------------------------------------------ *
 * 3. A lane change holds the gate, and slides in x and y together     *
 * ------------------------------------------------------------------ */

/**
 * The page's own frame loop on a fake 60fps clock: drain, then act when the
 * gate opens — `drainFinishedAnimations` and `spectateStep` in
 * `tools/arena/main.js`, calling the same `src/render` decisions. `onStep` sees
 * every batch as it begins, with the timelines it is about to replace.
 */
function playOnClock({ perSide = 3, seed, kit = null, onStep = () => {}, onFrame = () => {}, choose = null }) {
  const host = arenaHost({ perSide, seed, items: demoItemsFrom(kit) });
  let scene = applyCommands(emptyScene(), host.constructArena().commands);
  const playing = new Map();
  let pendingTokens = [];
  let clock = 0;
  let actions = 0;
  for (let frame = 0; frame < 400000; frame += 1) {
    clock = frame * (1000 / 60);
    const cursor = animationCursor(pendingTokens, playing, clock);
    for (const { combatantId, entry } of cursor.advanced ?? []) playing.set(combatantId, entry);
    for (const combatantId of cursor.expired) playing.delete(combatantId);
    if (cursor.abandon) {
      host.abandonActionAnimation(cursor.abandon.token, cursor.abandon.reason);
      pendingTokens = pendingTokens.filter((token) => token !== cursor.abandon.token);
    }
    for (const token of cursor.finished) host.reportActionAnimation(token);
    pendingTokens = pendingTokens.filter((token) => !cursor.finished.includes(token));
    onFrame({ clock, playing, scene, host });
    if (host.battle.result && pendingTokens.length === 0) break;
    if (host.battle.result || !host.readyForNextAction().ready || host.legalActions().length === 0) continue;
    const actorId = host.currentCombatantId();
    // `choose` lets a sweep steer toward a verb the spectator's AI never picks
    // (a snipe); it is handed the spectator's own choice and the legal options.
    const suggested = host.suggestAction(actorId);
    const action = choose ? choose(suggested, host.legalActions(), actions) : suggested;
    const step = host.submit({ ...action, actorId });
    actions += 1;
    scene = applyCommands(scene, step.commands);
    const { started } = timelinesForStep(step.commands);
    const delays = reactionDelaysFor(step.commands);
    for (const [combatantId, entry] of started) entry.startedAt = clock + (delays.get(combatantId) ?? 0);
    const stop = onStep({ clock, step, action, actorId, started, playing, scene, host, actions });
    for (const [combatantId, entry] of started) playing.set(combatantId, entry);
    pendingTokens = [...new Set([...pendingTokens, ...step.actionTokens])];
    // A caller that has found what it came for ends the bout there.
    if (stop === true) break;
  }
  return { host, actions };
}

/**
 * The first batch, in real 3v3 bouts searched seed by seed, that `pick` finds
 * something in. SEARCHED rather than pinned to a seed: an engine change that
 * plays a seed differently must not make the case vanish from under the test
 * (it did once, 2026-09-23, to the lane-and-death test below).
 */
function firstBatchWhere(pick, seeds = Array.from({ length: 24 }, (unused, index) => index + 1)) {
  for (const seed of seeds) {
    let found = null;
    playOnClock({
      seed,
      onStep: (context) => {
        found = pick(context);
        return found !== null;
      }
    });
    if (found !== null) return found;
  }
  return null;
}

test("a LANE CHANGE's sidestep carries its action's token, so the gate waits for the slide", () => {
  const found = firstBatchWhere(({ step, started }) => {
    const depth = step.commands.find((command) => command.kind === CommandKind.MOVE_CLIP_DEPTH);
    return depth ? { depth, entry: started.get(depth.combatantId) } : null;
  });
  assert.ok(found, "some default 3v3 bout changes lane");
  const { depth, entry } = found;
  assert.equal(entry.timeline.family, "movement:sidestep");
  assert.notEqual(depth.actionToken, null, "the command carries its action's token");
  assert.equal(entry.token, depth.actionToken, "and so does the slide it starts");

  const playing = new Map([[depth.combatantId, { ...entry, startedAt: 0 }]]);
  assert.deepEqual(animationCursor([entry.token], playing, 17).finished, [],
    "one frame into a 1200ms slide the action is NOT finished — this is where the next blow used to go in");
  assert.deepEqual(animationCursor([entry.token], playing, entry.timeline.durationMs).finished, [entry.token],
    "and it is finished when the slide is");
});

test("a lane change that also shifts x slides in x and y TOGETHER, rather than jumping sideways", () => {
  const found = firstBatchWhere(({ step, started }) => {
    const depth = step.commands.find((command) => command.kind === CommandKind.MOVE_CLIP_DEPTH);
    const move = depth && step.commands.find((command) => command.kind === CommandKind.MOVE_CLIP && command.combatantId === depth.combatantId);
    return move && move.from !== move.to ? { depth, move, entry: started.get(depth.combatantId) } : null;
  });
  assert.ok(found, "some default 3v3 bout changes lane into an occupied one, shifting x as well");
  const { depth, move, entry } = found;
  const at = (fraction) => ({
    x: figureXAt({ restingX: move.to, facing: "right", pose: STILL, timeline: entry.timeline, motion: entry.motion, at: fraction }),
    y: figureYAt({ restingY: depth.toY, timeline: entry.timeline, depthMotion: entry.depthMotion, at: fraction })
  });
  assert.deepEqual(at(0), { x: move.from, y: depth.fromY }, "it starts where it stood");
  assert.deepEqual(at(0.5), { x: move.from + (move.to - move.from) / 2, y: depth.fromY + (depth.toY - depth.fromY) / 2 },
    "halfway through it is halfway there on BOTH axes");
  assert.deepEqual(at(1), { x: move.to, y: depth.toY });
});

test("SWEEP: no lane change is cut short by the next action, on the page's own clock", () => {
  let laneChanges = 0;
  const cut = [];
  for (const seed of [3, 7, 8, 15]) {
    playOnClock({
      seed,
      onStep: ({ clock, step, started, playing, actions }) => {
        if (step.commands.some((command) => command.kind === CommandKind.MOVE_CLIP_DEPTH)) laneChanges += 1;
        for (const combatantId of started.keys()) {
          const current = playing.get(combatantId);
          if (!current?.timeline.depthTravel) continue;
          const at = (clock - current.startedAt) / current.timeline.durationMs;
          if (at >= 0 && at < 1) cut.push(`seed ${seed} action ${actions}: ${combatantId}'s slide cut at ${Math.round(at * 100)}%`);
        }
      }
    });
  }
  assert.ok(laneChanges >= 4, `the bouts must have changed lanes: ${laneChanges}`);
  assert.deepEqual(cut, []);
});

/* ------------------------------------------------------------------ *
 * 4. A lethal blow plays its victim's reaction, THEN the death        *
 * ------------------------------------------------------------------ */

/**
 * ► **`timelinesForStep` KEPT ONE TIMELINE PER COMBATANT AND THE LAST
 *   `clip-goto` WON**, so a lethal blow or spell dropped the victim's reaction
 *   — hurt, burning, lightning, taunted, knockback — and only the death played
 *   (`engine-vs-screen` F4; the refuter measured it on every lethal action of
 *   every kit). **The refuter's correction, recorded rather than smoothed
 *   over:** for a single-hit kill the BUILD dispatches the reaction and the
 *   death within one frame (`defender_hurt` calls `damagecharacter` at
 *   `+0x211e`, then `gotoAndPlay(animstate)` at `+0x2120`; `magic_damage_character`
 *   plays `damage_method` then `death()`), so showing the reaction first is an
 *   AUTHORED presentation choice for a readable kill, not a restoration of the
 *   build's frames. It changes no number and no hash.
 */

/** The chain of timelines an entry plays, head first. */
const chainOf = (entry) => {
  const links = [];
  for (let link = entry; link; link = link.then) links.push(link);
  return links;
};

/** Every clip-goto a batch sends one combatant, in order. */
const gotosFor = (commands, combatantId) => commands
  .filter((command) => command.kind === CommandKind.CLIP_GOTO && command.combatantId === combatantId)
  .map((command) => command.label);

test("a LETHAL blow queues the victim's death BEHIND its reaction, under the same token", () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const battle = staged({ seed, foe: { vitality: 1 } });
    combatantById(battle, "foe").health = 1;
    const { commands } = actAndPresent(battle, { type: Ss2ActionType.QUICK_ATTACK, targetId: "foe" });
    if (combatantById(battle, "foe").alive) continue;
    const gotos = gotosFor(commands, "foe");
    assert.equal(gotos.length, 2, `seed ${seed}: a reaction and a death`);

    const entry = timelinesForStep(commands).started.get("foe");
    assert.deepEqual(chainOf(entry).map((link) => link.timeline.label), gotos, "both clips play, in the batch's order");
    assert.equal(entry.then.timeline.family.startsWith("death:"), true);
    assert.equal(entry.then.token, entry.token, "one action, one token, so the gate is shut across both");
    return;
  }
  assert.fail("no quick attack killed a 1-HP victim in 200 seeds");
});

test("the gate stays shut through the reaction AND the death, and the painter is handed the death when the reaction ends", () => {
  const reaction = timelineFor("hurt2", { role: "target" });
  const death = timelineFor("slain", { role: "defeated" });
  const token = 11;
  const playing = new Map([["foe", {
    timeline: reaction, token, motion: null, depthMotion: null, startedAt: 100,
    then: { timeline: death, token, motion: null, depthMotion: null }
  }]]);
  const during = animationCursor([token], playing, 100 + reaction.durationMs - 1);
  assert.deepEqual(during.finished, []);
  assert.deepEqual(during.advanced, [], "nothing to hand over while the reaction plays");

  const turned = animationCursor([token], playing, 100 + reaction.durationMs + 1);
  assert.deepEqual(turned.finished, [], "the death is still to play: the action is NOT finished");
  assert.deepEqual(turned.expired, [], "and the victim is not idle");
  assert.equal(turned.advanced.length, 1);
  assert.equal(turned.advanced[0].combatantId, "foe");
  assert.equal(turned.advanced[0].entry.timeline, death);
  assert.equal(turned.advanced[0].entry.startedAt, 100 + reaction.durationMs,
    "the death starts where the reaction ended, not on whichever frame noticed");

  const over = animationCursor([token], playing, 100 + reaction.durationMs + death.durationMs + 1);
  assert.deepEqual(over.finished, [token], "released when the death has played");
  assert.deepEqual(over.expired, ["foe"]);
});

test("SWEEP: no lethal blow or spell drops its victim's reaction, and every clip the batch sends plays", () => {
  let lethal = 0;
  const dropped = [];
  for (const [kit, seeds] of [[null, [1, 2]], ["blasts", [1, 2]], ["tricks", [1]], ["34", [1, 2]], ["30", [3, 7]]]) {
    for (const seed of seeds) {
      playOnClock({
        seed,
        kit,
        onStep: ({ step, started, actions }) => {
          for (const combatantId of started.keys()) {
            const gotos = gotosFor(step.commands, combatantId);
            if (gotos.length < 2) continue;
            lethal += 1;
            const chain = chainOf(started.get(combatantId));
            const played = chain.map((link) => link.timeline.label);
            if (JSON.stringify(played) !== JSON.stringify(gotos)) {
              dropped.push(`${kit ?? "plain"} seed ${seed} action ${actions}: ${combatantId} sent ${gotos.join(",")} and plays ${played.join(",")}`);
            }
            if (!chain.every((link) => link.token === step.actionBoundary)) {
              dropped.push(`${kit ?? "plain"} seed ${seed} action ${actions}: ${combatantId}'s chain is not all under the action's token`);
            }
          }
        }
      });
    }
  }
  assert.ok(lethal >= 10, `the bouts must have killed: ${lethal}`);
  assert.deepEqual(dropped, []);
});

test("a figure that changes lane and dies in the SAME action slides first, then dies", () => {
  // Found by a one-frame-snap sweep after the fixes above: a figure stepped
  // back a rank and was defeated in the same batch — the crowd's toll ending a
  // long bout on the stepper's own turn. The death replaced the sidestep, so
  // the figure jumped a lane in one frame. A death queues behind WHATEVER the
  // batch started for the figure, the slide included.
  //
  // ► **STAGED, NOT FOUND BY SEED (2026-09-23).** The first cut replayed tricks
  //   3v3 seed 4 to its action 871, and the next engine change (lane-aware
  //   facing) played that seed differently and the case vanished. So it is
  //   built here: a 2v2 in two ranks (a rank change is only offered off a
  //   duel), the actor on 1 HP and the turn past `SS2_CROWD.patience`, so the
  //   toll the resolver applies LAST on every path kills it in the batch that
  //   changes its lane.
  const members = (side) => [1, 2].map((slot) => ss2Combatant(fields(), { id: `${side}-${slot}`, name: `${side}-${slot}`, controller: "local" }));
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [{ id: "red", name: "red", combatants: members("red") }, { id: "blue", name: "blue", combatants: members("blue") }]
  });
  const actor = currentCombatant(battle);
  const verb = legalActions(battle, actor.id)
    .map((option) => option.type)
    .find((type) => type === Ss2ActionType.RANK_BACK || type === Ss2ActionType.RANK_FRONT);
  assert.ok(verb, `${actor.id} must be offered a rank change, or this proves nothing`);
  actor.health = 1;
  battle.turnNumber = SS2_CROWD.patience + 10;

  const before = toTeamWireState(battle);
  applyAction(battle, { actorId: actor.id, type: verb, targetId: actor.id });
  const wire = toTeamWireState(battle);
  const { commands } = presentResolvedEvents(wire, { layout: buildArenaLayout(wire), bindings: SS2_STATIC_MAP_BINDINGS, before });

  assert.equal(combatantById(battle, actor.id).alive, false, "the toll killed the stepper");
  const depth = commands.find((command) => command.kind === CommandKind.MOVE_CLIP_DEPTH && command.combatantId === actor.id);
  assert.ok(depth, "and its lane change is in the same batch");
  const gotos = gotosFor(commands, actor.id);
  assert.ok(gotos.length > 0, "as is its death");

  const chain = chainOf(timelinesForStep(commands).started.get(actor.id));
  assert.equal(chain[0].timeline.depthTravel, true, "the lane change still slides");
  assert.deepEqual(chain[0].depthMotion, { from: depth.fromY, to: depth.toY });
  assert.deepEqual(chain.slice(1).map((link) => link.timeline.label), gotos, "and the death plays after it");
});

test("a KILLING fireball delays the victim's reaction to impact, then burns, then dies", () => {
  let checked = 0;
  playOnClock({
    perSide: 1,
    seed: 1,
    kit: "32",
    onStep: ({ step, started, clock }) => {
      const shot = step.commands.find((command) => command.kind === CommandKind.FIRE_PROJECTILE && command.projectile === "fireball");
      if (!shot) return;
      const entry = started.get(shot.targetId);
      if (!entry?.then) return;
      checked += 1;
      assert.equal(entry.timeline.label, "burning");
      assert.equal(entry.then.timeline.family.startsWith("death:"), true);
      assert.ok(entry.startedAt > clock, "the reaction waits for the impact");
      assert.equal(entry.startedAt - clock, reactionDelaysFor(step.commands).get(shot.targetId));
    }
  });
  assert.ok(checked >= 1, "a dire fireball kills a demo gladiator");
});

/* ------------------------------------------------------------------ *
 * 5. An arrow's victim reacts when the arrow LANDS (+0x6d29)          *
 * ------------------------------------------------------------------ */

/**
 * ► **ADOPTED 2026-09-23.** The build calls `checkattackroll()` from the ranged
 *   arm's impact test (`+0x6d29`), which runs every tick and holds only once
 *   the bullet is past the defender or on the ground (`+0x6c97`..`+0x6d24`).
 *   So the victim's hurt or defend clip, the death behind it and its pop-up
 *   wait for the drawn arrow — the fireball's rule, one kind over.
 */
test("SWEEP: an ARROW's victim reacts when the drawn arrow lands — hit, miss and kill — and the gate never opens early", () => {
  const found = { hit: 0, miss: 0, kill: 0, bombard: 0, snipe: 0 };
  const problems = [];
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    playOnClock({
      seed,
      // The spectator's AI never snipes, so on every other shot this takes the
      // snipe the build offers beside the bombard.
      choose: (suggested, options, actions) => {
        if (suggested.type !== Ss2ActionType.BOMBARD || actions % 2 === 0) return suggested;
        return options.find((option) => option.type === Ss2ActionType.SNIPE && option.targetId === suggested.targetId) ?? suggested;
      },
      onStep: ({ step, started, clock, scene, host, actions }) => {
        const shot = step.commands.find((command) => command.kind === CommandKind.FIRE_PROJECTILE
          && (command.projectile === "bombard" || command.projectile === "snipe"));
        if (!shot) return;
        const where = `seed ${seed} action ${actions}`;
        const entry = started.get(shot.targetId);
        if (!entry) { problems.push(`${where}: the victim plays nothing`); return; }
        // The flight tools/arena/main.js draws, built the way it builds it.
        const flight = projectileFlight({
          kind: shot.projectile, from: shot.from, to: shot.to, sequence: shot.sequence, targetSize: shot.targetSize,
          shooterYscale: scene.actors[shot.combatantId]?.yscale ?? null,
          targetYscale: scene.actors[shot.targetId]?.yscale ?? null,
          bodies: scene.drawOrder.filter((id) => id !== shot.combatantId && id !== shot.targetId)
            .map((id) => scene.actors[id]).filter((actor) => Number.isFinite(actor?.x))
            .map((actor) => ({ x: actor.x, y: actor.y, yscale: actor.yscale }))
        });
        const landsAt = clock + flightDurationMs(flight);
        if (entry.startedAt !== landsAt) problems.push(`${where}: reacts at +${entry.startedAt - clock}ms, lands at +${landsAt - clock}ms`);
        found[shot.projectile] += 1;
        found[shot.hit ? "hit" : "miss"] += 1;
        const chain = chainOf(entry);
        const family = chain[0].timeline.family;
        if (shot.hit && family !== "hurt" && family !== "knockback") problems.push(`${where}: a hit plays ${family}`);
        if (!shot.hit && family !== "defend" && family !== "block") problems.push(`${where}: a miss plays ${family}`);
        if (chain.length > 1) found.kill += 1;

        // Arrows never knock back (directions 21/22 are outside the 5-12/30
        // gate), so the victim is drawn where the engine has him throughout.
        if (step.commands.some((command) => command.kind === CommandKind.MOVE_CLIP && command.combatantId === shot.targetId)) {
          problems.push(`${where}: an arrow moved its victim`);
        }
        const engineX = host.wire().teams.flatMap((team) => team.combatants).find((c) => c.id === shot.targetId).x;
        if (scene.actors[shot.targetId].x !== engineX) problems.push(`${where}: drawn at ${scene.actors[shot.targetId].x}, engine ${engineX}`);

        // THE GATE, on the page's own terms (the arrow is in `projectiles`, as
        // `drainFinishedAnimations` passes it): shut from the loose to the end
        // of the victim's chain, with no frame between.
        const chainEnd = entry.startedAt + chain.reduce((sum, link) => sum + link.timeline.durationMs, 0);
        const playing = new Map([[shot.targetId, entry]]);
        const shooter = started.get(shot.combatantId);
        if (shooter) playing.set(shot.combatantId, shooter);
        const projectiles = [{ token: entry.token, startedAt: clock, durationMs: flightDurationMs(flight) }];
        for (let t = clock; t < chainEnd; t += 1000 / 60) {
          const cursor = animationCursor([entry.token], playing, t, { projectiles });
          for (const { combatantId, entry: next } of cursor.advanced ?? []) playing.set(combatantId, next);
          if (cursor.finished.includes(entry.token)) {
            problems.push(`${where}: the gate opened ${Math.round(chainEnd - t)}ms before the reaction ended`);
            break;
          }
        }
      }
    });
  }
  assert.ok(found.bombard > 0 && found.snipe > 0 && found.hit > 0 && found.miss > 0 && found.kill > 0,
    `the bouts must loose both arrows, land and miss, and kill with one: ${JSON.stringify(found)}`);
  assert.deepEqual(problems, []);
});
