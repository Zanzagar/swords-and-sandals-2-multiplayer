/**
 * FACING ON SCREEN FOLLOWS THE RESOLVER — the turn a gladiator makes when the
 * phase advances.
 *
 * ► **FOUND 2026-09-22 BY THE `cast_teleport` IMPLEMENTER, AND LIVE SINCE
 *   2026-09-12.** The resolver has recomputed facing from position on every
 *   move since `ss2FacingEffects` shipped, as the build's `changeCombatants`
 *   does at every phase advance. The screen never heard about it: `facing`
 *   reached the scene from exactly one command, the `place-clip` the arena is
 *   built with, so a teleport past a foe, a shove or a gale that carried a
 *   victim past somebody, and an ordinary walk past a foe all left the figure
 *   drawn the way it faced at construction. Measured over six real arena bouts
 *   before the fix: 16 facing changes in 300 actions, and 108 actor-steps drawn
 *   facing the wrong way.
 *
 * What these pin:
 *
 * - a turn is a `face-clip`, one per gladiator that turned, carrying both ends,
 *   emitted LAST in its batch under the batch's token;
 * - it is detected by comparing the resolver with ITSELF across the batch —
 *   the projection the batch started from against the one it ended at — so a
 *   rule set that models no facing turns nobody;
 * - a batch that turns nobody is byte-identical to what it always was;
 * - the painter holds the old facing until the turning action's token has
 *   finished, which is the build's phase advance: a teleporting caster plays
 *   `Cast2` facing the way it stood and turns as it reappears, and a bystander
 *   turns when the action ends rather than when it begins;
 * - **and one turn is drawn at the START of its action (2026-09-24)**: the
 *   actor's turn to the foe he swings, shoots, taunts or casts at, which the
 *   resolver makes before the phase (`ss2TurnToTarget`). It is a `face-clip`
 *   with `at: "action-start"`, before the actor's clip, drawn at once — so the
 *   verb is drawn facing its target, which is what the owner asked to see.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, lastResolvedAction, legalActions, toTeamWireState
} from "../src/team/index.js";
import {
  SS2_FACING_LEFT, Ss2ActionType, ss2BattleValues, ss2Combatant, ss2FacingEffects, ss2PhysicalSize, ss2TeamRules
} from "../src/team/ss2-rules.js";
import {
  buildArenaLayout, CommandKind, createPresentationBinder, createVanillaBattleHost, presentArenaConstruction,
  PresentationError, presentResolvedEvents, SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";
import {
  ADVANCE_UNITS, animationCursor, applyCommands, emptyScene, figureFacingAt, figureXAt, poseAt, TimelineError,
  timelinesForStep
} from "../src/render/index.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";

const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 5, character_level: 5, weapon: 1, ...o
});

/** The teleport's one draw, as `test/ss2-teleport.test.js` stages it. */
const destinationSample = (value) => ({
  label: "teleport-destination-roll", source: "randomBetween", min: -2000, max: 2000, value
});

/** The resolver's own facing, read off the status list it carries it on. */
const resolverFacing = (battle, id) =>
  ((combatantById(battle, id).status ?? []).includes(SS2_FACING_LEFT) ? "left" : "right");

/** A 1v1, hero on red at -60 facing right, foe on blue at 60 facing left. */
function staged({ hero = {}, foe = {}, rngTape = null } = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rngTape,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields({ speed: 21, ...hero }), { id: "hero", name: "hero", controller: "local" })] },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields({ gladiator_dir: "left", ...foe }), { id: "foe", name: "foe", controller: "local" })] }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: -60, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: 60, y: 200 });
  assert.equal(currentCombatant(battle).id, "hero");
  return battle;
}

/**
 * Re-derive every facing from where everybody now stands, with the resolver's
 * OWN rule. Staging moves `x` after construction and construction is the only
 * other place facing is derived, so without this a staged gladiator can face
 * away from every foe it has — and a "turn" measured from there is a turn the
 * staging invented.
 */
function faceByPosition(battle) {
  const [red, blue] = battle.teams.map((team) => team.combatants);
  for (const effect of ss2FacingEffects(red, blue)) {
    const combatant = combatantById(battle, effect.targetId);
    const rest = combatant.status.filter((token) => token !== SS2_FACING_LEFT);
    combatant.status = effect.active ? [...rest, SS2_FACING_LEFT] : rest;
  }
}

/**
 * A 1v2 in which the hero faces AWAY from one of its foes — the case a push
 * past the pusher needs, and one only teams can produce.
 *
 * hero at 0 faces right, toward `near` at 50; `behind` at -80 faces right,
 * toward the hero. ~~A gale is signed by the CASTER's facing (`+0x7b45`), so
 * blowing `behind` carries it rightward, straight past the hero.~~
 *
 * ~~A shove or a gale~~ **A shove did the same until 2026-09-23** (it signs on
 * the shover's facing, `ss2ShoveForce`); since then a swing — the shove among
 * them — turns its swinger to face the man swung at first, so a shove at
 * `behind` drives him AWAY. **And a gale since 2026-09-24**, when the turn
 * (`ss2TurnToTarget`) was widened to every verb aimed at a foe. So this layout
 * is now the case "a verb aimed at the man behind": the actor turns to it at
 * the start of his action. See the shove's, the gale's and the bolt's tests.
 */
function pastTheAttacker({ hero = {} } = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields({ speed: 21, gauntlet: 1, vitality: 40, ...hero }), { id: "hero", name: "hero", controller: "local" })] },
      {
        id: "blue",
        name: "blue",
        combatants: [
          ss2Combatant(fields({ vitality: 40 }), { id: "near", name: "near", controller: "local" }),
          ss2Combatant(fields({ vitality: 40 }), { id: "behind", name: "behind", controller: "local" })
        ]
      }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: 0, y: 200 });
  Object.assign(combatantById(battle, "near"), { x: 50, y: 200 });
  Object.assign(combatantById(battle, "behind"), { x: -80, y: 200 });
  faceByPosition(battle);
  assert.equal(currentCombatant(battle).id, "hero");
  assert.deepEqual(["hero", "near", "behind"].map((id) => resolverFacing(battle, id)), ["right", "left", "right"],
    "staged: the hero faces its nearest foe, and has its back to the other");
  return battle;
}

/**
 * Build the arena, act, and present the batch the way a host does — with the
 * projection the batch STARTED from carried in beside the one it ended at.
 */
function actAndPresent(battle, action, { withBefore = true } = {}) {
  const before = toTeamWireState(battle);
  const layout = buildArenaLayout(before);
  // A real `physical_size` per fighter, derived by the rule set's own formula,
  // so the construction's `xscale` is a number with a SIGN — the mirror a turn
  // must not touch. Without it `xscale` is null and a fold that flipped it
  // would be invisible to every assertion here (measured: it was).
  const mirrors = new Map(before.teams.flatMap((team) => team.combatants)
    .map((combatant) => [combatant.id, { fields: { physical_size: ss2PhysicalSize(combatant) } }]));
  const constructed = applyCommands(emptyScene(), presentArenaConstruction(layout, { mirrors }));
  applyAction(battle, action);
  const wire = toTeamWireState(battle);
  const actionBoundaries = [lastResolvedAction(battle).firstEventSequence];
  const { commands } = presentResolvedEvents(wire, {
    layout, bindings: SS2_STATIC_MAP_BINDINGS, actionBoundaries, ...(withBefore ? { before } : {})
  });
  return { before, wire, layout, constructed, commands, token: actionBoundaries[0], scene: applyCommands(constructed, commands) };
}

const turns = (commands) => commands
  .filter((command) => command.kind === CommandKind.FACE_CLIP)
  .map(({ combatantId, from, to, at }) => ({ combatantId, from, to, ...(at ? { at } : {}) }));

const teleportPast = () => staged({ hero: { inventory1: 48 }, rngTape: [destinationSample(500)] });
const TELEPORT_SELF = { actorId: "hero", type: Ss2ActionType.CAST_TELEPORT, targetId: "hero" };

/* ------------------------------------------------------------------ *
 * The defect                                                          *
 * ------------------------------------------------------------------ */

test("RED: a teleport past the foe turns both fighters in the resolver, and the scene must turn them too", () => {
  const battle = teleportPast();
  const { constructed, scene } = actAndPresent(battle, TELEPORT_SELF);
  // The resolver's half, which has worked since 2026-09-12.
  assert.equal(resolverFacing(battle, "hero"), "left", "the caster now stands right of its foe");
  assert.equal(resolverFacing(battle, "foe"), "right", "and the foe turns to face it");
  // The construction drew them the other way round, so this is a real turn.
  assert.equal(constructed.actors.hero.facing, "right");
  assert.equal(constructed.actors.foe.facing, "left");
  // The screen's half, which is the defect.
  assert.equal(scene.actors.hero.facing, "left", "the scene still draws the caster facing the way it was built");
  assert.equal(scene.actors.foe.facing, "right", "the scene still draws the foe facing the way it was built");
});

/* ------------------------------------------------------------------ *
 * The command                                                         *
 * ------------------------------------------------------------------ */

test("a turn is ONE face-clip per gladiator that turned, carrying both ends, LAST in its batch, under its token", () => {
  const { commands, token, layout } = actAndPresent(teleportPast(), TELEPORT_SELF);
  assert.deepEqual(turns(commands), [
    { combatantId: "hero", from: "right", to: "left" },
    { combatantId: "foe", from: "left", to: "right" }
  ]);
  // LAST: every command after the first turn is a turn. That is the stream's
  // only way of saying "after the action's clips", which is when the build
  // turns a gladiator.
  const first = commands.findIndex((command) => command.kind === CommandKind.FACE_CLIP);
  assert.ok(first > 0, "the batch has other commands, and the turns come after them");
  assert.ok(commands.slice(first).every((command) => command.kind === CommandKind.FACE_CLIP));
  for (const command of commands.slice(first)) {
    assert.equal(command.actionToken, token, "under the turning action's own token");
    assert.equal(command.sequence, Math.max(...commands.slice(0, first).map((other) => other.sequence)),
      "stamped with the batch's last event, because the turn ends the action");
    assert.equal(command.instancePath, layout.placementFor(command.combatantId).instancePath);
  }
});

test("a teleport AWAY turns nobody, and its batch is byte-identical to one presented without `before`", () => {
  const away = () => staged({ hero: { inventory1: 48 }, rngTape: [destinationSample(-1800)] });
  const withBefore = actAndPresent(away(), TELEPORT_SELF);
  const without = actAndPresent(away(), TELEPORT_SELF, { withBefore: false });
  assert.deepEqual(turns(withBefore.commands), []);
  assert.deepEqual(withBefore.commands, without.commands, "a batch that turns nobody adds nothing to the stream");
  assert.equal(withBefore.scene.actors.hero.facing, "right");
  assert.equal(withBefore.scene.actors.foe.facing, "left");
});

test("without `before` nothing is turned: the caller carries it in, exactly as it carries the boundaries", () => {
  const { commands, scene } = actAndPresent(teleportPast(), TELEPORT_SELF, { withBefore: false });
  assert.deepEqual(turns(commands), []);
  assert.equal(scene.actors.hero.facing, "right", "which is the defect, reproduced by a caller that did not say");
});

test("`before` is refused by shape exactly as the wire is: a live battle is not a projection", () => {
  const battle = teleportPast();
  const layout = buildArenaLayout(toTeamWireState(battle));
  applyAction(battle, TELEPORT_SELF);
  assert.throws(
    () => presentResolvedEvents(toTeamWireState(battle), { layout, bindings: SS2_STATIC_MAP_BINDINGS, before: battle }),
    (error) => error instanceof PresentationError && /live battle/.test(error.message)
  );
});

test("a SHOVE at the man BEHIND the shover drives him away, not past — and the stream draws the shover turning to shove", () => {
  // ~~a SHOVE that carries its victim past the shover turns the victim, and
  // nobody else~~ — **the premise went on 2026-09-23.** The shove is signed on
  // the SHOVER's facing, and a shover facing `near` pushed `behind` straight
  // through himself (-80 -> 31). A swing now turns its swinger to face the man
  // swung at before anything reads the facing (`ss2TurnToTarget`), so `behind`
  // goes the way a 1v1 shove always sends its victim: away.
  //
  // ► ~~**AND THE STREAM IS NET, WHICH THIS PINS AS A KNOWN GAP.** ... so
  //   nothing here says the shove was thrown LEFT.~~ **CLOSED 2026-09-24**:
  //   ~~`turns(commands)` is `[]`~~. The presentation now draws the turn the
  //   resolver made BEFORE the phase at the START of the action
  //   (`at: "action-start"`, ahead of the shover's clip), and measures the
  //   phase-advance turn from the facing he shoved with — so the stream says
  //   both: left to shove, right again once `behind` is gone.
  const battle = pastTheAttacker();
  assert.ok(legalActions(battle, "hero").some((option) => option.type === Ss2ActionType.SHOVE && option.targetId === "behind"));
  const { commands, scene, token } = actAndPresent(battle, { actorId: "hero", type: Ss2ActionType.SHOVE, targetId: "behind" });
  const event = battle.events.find((entry) => entry.type === Ss2ActionType.SHOVE);
  assert.ok(event.force < 0 && event.to < event.from, `the victim was driven away, left: ${event.from} -> ${event.to}`);
  assert.deepEqual(["hero", "near", "behind"].map((id) => resolverFacing(battle, id)), ["right", "left", "right"],
    "the resolver ends facing exactly as it began");
  assert.deepEqual(turns(commands), [
    { combatantId: "hero", from: "right", to: "left", at: "action-start" },
    { combatantId: "hero", from: "left", to: "right" }
  ], "the shover turns to shove, then back at the phase advance; nobody else turns");
  assert.deepEqual(battle.lastResolution.effects.filter((effect) => effect.status === SS2_FACING_LEFT)
    .map((effect) => [effect.targetId, effect.active]), [["hero", true], ["hero", false]],
    "exactly the two turns the resolver made");
  assert.equal(scene.actors.hero.facing, "right");
  const hero = scene.actors.hero;
  assert.equal(figureFacingAt({ facing: hero.facing, turn: hero.turn, pendingTokens: [token] }), "left",
    "drawn LEFT, toward the man he shoves, for as long as the shove plays");
  assert.equal(figureFacingAt({ facing: hero.facing, turn: hero.turn, pendingTokens: [] }), "right",
    "and facing `near` again once it is over");
});

test("a GALE at the man BEHIND the caster blows him AWAY: the caster turns to cast, and back as the phase advances", () => {
  // ~~a GALE that blows its victim past the caster turns the victim, and
  // nobody else~~ (`behind` -80 -> 920, `turns` = behind right -> left).
  //
  // ► **MOVED 2026-09-24 BY THE TURN TO THE TARGET, TWICE OVER.** The
  //   resolver now turns the caster to face `behind` before the gale reads his
  //   facing (`ss2TurnToTarget`; the gale signs on it, `+0x7b45`), so `behind`
  //   is blown -1000, away, and never crosses him: nobody but the caster turns.
  //   And the presentation draws that turn at the START of the action
  //   (`at: "action-start"`), then the phase-advance turn back to `near`.
  const battle = pastTheAttacker({ hero: { inventory1: 38 } });
  const { commands, scene, token } = actAndPresent(battle, { actorId: "hero", type: Ss2ActionType.CAST_GALE, targetId: "behind" });
  const event = battle.events.find((entry) => entry.type === Ss2ActionType.CAST_GALE);
  assert.deepEqual([event.force, event.targetFrom, event.targetTo], [-1000, -80, -1080], "blown AWAY from the caster");
  assert.deepEqual(turns(commands), [
    { combatantId: "hero", from: "right", to: "left", at: "action-start" },
    { combatantId: "hero", from: "left", to: "right" }
  ]);
  // `behind` is left out of this loop, and only because of the STAGING: the
  // construction draws each side its own way (blue facing left), while
  // `pastTheAttacker` re-faces `behind` right after construction. The old
  // version of this test checked it only because the gale happened to turn it
  // back to the construction's facing; nothing turns it now, which is right.
  for (const id of ["hero", "near"]) {
    assert.equal(scene.actors[id].facing, resolverFacing(battle, id), `${id} is drawn the way the resolver faces it`);
  }
  const hero = scene.actors.hero;
  assert.equal(figureFacingAt({ facing: hero.facing, turn: hero.turn, pendingTokens: [token] }), "left",
    "the caster casts FACING the man he gales");
  assert.equal(figureFacingAt({ facing: hero.facing, turn: hero.turn, pendingTokens: [] }), "right",
    "and faces `near` again once the gale is over");
});

/* ------------------------------------------------------------------ *
 * The turn to the target, drawn at the start of the action            *
 * ------------------------------------------------------------------ */

test("A VERB AIMED AT THE MAN BEHIND IS DRAWN FACING HIM FROM ITS FIRST FRAME: an action-start face-clip, before the actor's clip", () => {
  // A lightning bolt moves nobody and kills nobody here, so the turn is the
  // resolver's only facing change and it persists: ONE face-clip, and it is
  // the action-start one — not held back to the old facing while `Cast2`
  // plays, which is what the owner saw ("flip the model ... facing the way of
  // the target they are attacking", 2026-09-24).
  const battle = pastTheAttacker({ hero: { inventory1: 34 } });
  const { commands, scene, token } = actAndPresent(battle, { actorId: "hero", type: Ss2ActionType.CAST_LIGHTNING_BOLT, targetId: "behind" });
  assert.ok(combatantById(battle, "behind").alive, "the bolt must not kill, or the kill's re-facing is in the picture too");
  assert.equal(resolverFacing(battle, "hero"), "left", "the resolver turned the caster and left him turned");
  assert.deepEqual(turns(commands), [{ combatantId: "hero", from: "right", to: "left", at: "action-start" }]);
  const turnAt = commands.findIndex((command) => command.kind === CommandKind.FACE_CLIP);
  const clipAt = commands.findIndex((command) => command.kind === CommandKind.CLIP_GOTO && command.combatantId === "hero");
  assert.ok(turnAt !== -1 && clipAt !== -1 && turnAt < clipAt, "the turn comes BEFORE the caster's own clip");
  assert.equal(commands[turnAt].actionToken, token, "under the action it belongs to");
  const hero = scene.actors.hero;
  assert.deepEqual({ ...hero.turn }, { from: "right", to: "left", sequence: commands[turnAt].sequence, actionToken: token, at: "action-start" });
  assert.equal(figureFacingAt({ facing: hero.facing, turn: hero.turn, pendingTokens: [token] }), "left",
    "drawn facing its target WHILE the action plays");
  assert.equal(figureFacingAt({ facing: hero.facing, turn: hero.turn, pendingTokens: [] }), "left", "and after");
});

test("a verb at the foe the actor ALREADY faces adds no face-clip: the stream is what it always was", () => {
  const battle = pastTheAttacker({ hero: { inventory1: 34 } });
  const { commands } = actAndPresent(battle, { actorId: "hero", type: Ss2ActionType.CAST_LIGHTNING_BOLT, targetId: "near" });
  assert.deepEqual(turns(commands), []);
});

test("figureFacingAt draws an action-start turn at once, and still holds a phase-advance one", () => {
  const turn = { from: "right", to: "left", sequence: 4, actionToken: 3 };
  assert.equal(figureFacingAt({ facing: "left", turn: { ...turn, at: "action-start" }, pendingTokens: [3] }), "left",
    "the turn to the target is drawn from the first frame of its action");
  assert.equal(figureFacingAt({ facing: "left", turn, pendingTokens: [3] }), "right", "a phase-advance turn is still held");
});

test("a GHOST STRIKE at the man behind blinks its caster to ITS OWN side of him, where the resolver lands it", () => {
  // The resolver's `ghostLanding` reads the facing AFTER the turn to the
  // target, so a caster at 0 turned left to `behind` at -80 lands at
  // -80 + 86 = 6. `ghostLandingOf` read the projected facing alone until
  // 2026-09-24 and drew the blink on the far side, at -80 - 86 = -166.
  const battle = pastTheAttacker({ hero: { inventory1: 36 } });
  const size = ss2PhysicalSize(combatantById(battle, "hero"));
  const { commands } = actAndPresent(battle, { actorId: "hero", type: Ss2ActionType.CAST_GHOST_STRIKE, targetId: "behind" });
  const event = battle.events.find((entry) => entry.type === Ss2ActionType.CAST_GHOST_STRIKE);
  const blink = commands.find((command) => command.kind === CommandKind.MOVE_CLIP && command.combatantId === "hero");
  const landing = -80 + size;
  assert.ok(blink, "the caster blinks");
  assert.equal(blink.blink, event.casterTo ?? landing, "beside `behind`, on the caster's own side");
  assert.equal(blink.blink, landing);
  assert.deepEqual(turns(commands)[0], { combatantId: "hero", from: "right", to: "left", at: "action-start" },
    "and it turned to face him before it went");
});

test("a rule set that models no facing turns nobody, over a whole bout, although its villains are drawn facing left", () => {
  // ► **THE PIN ON HOW A TURN IS DETECTED.** The placeholder rule set carries
  //   no `facing-left` on anybody, so its villain reads "right" off the wire
  //   while the construction draws it facing left. A turn detected against
  //   what the construction DREW would spin every villain round on the first
  //   action; one detected against the resolver's own previous state cannot.
  const brute = (id, agility) => ({
    id, name: id, controller: "local",
    stats: { strength: 10, agility, attack: 40, defense: 0, vitality: 0, stamina: 5, magicka: 0 },
    loadout: { meleeDamage: 40, rangedDamage: 10, canUseRanged: false, canUseSpell: false, canHeal: false }
  });
  const battle = createTeamBattle({
    seed: 5,
    teams: [
      { id: "red", name: "Red", slots: 2, combatants: [brute("red-1", 20), brute("red-2", 19)] },
      { id: "blue", name: "Blue", slots: 2, combatants: [brute("blue-1", 5), brute("blue-2", 4)] }
    ]
  });
  const layout = buildArenaLayout(toTeamWireState(battle));
  const binder = createPresentationBinder({ layout });
  let scene = applyCommands(emptyScene(), presentArenaConstruction(layout));
  assert.equal(scene.actors["blue-1"].facing, "left", "the construction draws the villain facing left");
  assert.equal(combatantById(battle, "blue-1").status.includes(SS2_FACING_LEFT), false,
    "and the resolver carries no facing for it at all — the case this test is about");
  let actions = 0;
  while (!battle.result && actions < 500) {
    const before = toTeamWireState(battle);
    const options = legalActions(battle);
    if (options.length === 0) break;
    applyAction(battle, { ...options[0], actorId: currentCombatant(battle).id });
    const commands = binder.drain(toTeamWireState(battle), {
      actionBoundary: lastResolvedAction(battle).firstEventSequence, before
    });
    assert.deepEqual(turns(commands), [], `action ${actions + 1} turned somebody`);
    scene = applyCommands(scene, commands);
    actions += 1;
  }
  assert.ok(actions > 1, "a bout was actually played");
  assert.equal(scene.actors["blue-1"].facing, "left");
});

test("the arena build is unchanged: it carries no turn, and faces each side its own way", () => {
  const layout = buildArenaLayout(toTeamWireState(teleportPast()));
  const construction = presentArenaConstruction(layout);
  assert.deepEqual(construction.filter((command) => command.kind === CommandKind.FACE_CLIP), []);
  const placed = construction.filter((command) => command.kind === CommandKind.PLACE_CLIP);
  assert.deepEqual(placed.map(({ combatantId, facing }) => ({ combatantId, facing })), [
    { combatantId: "hero", facing: "right" },
    { combatantId: "foe", facing: "left" }
  ]);
  const scene = applyCommands(emptyScene(), construction);
  assert.equal(scene.actors.hero.turn, null, "a figure nothing has turned carries no turn");
});

/* ------------------------------------------------------------------ *
 * The fold                                                            *
 * ------------------------------------------------------------------ */

test("a face-clip folds `facing` and `turn` and touches nothing else", () => {
  const { commands, constructed, token } = actAndPresent(teleportPast(), TELEPORT_SELF);
  const faced = applyCommands(constructed, commands.filter((command) => command.kind === CommandKind.FACE_CLIP));
  for (const id of ["hero", "foe"]) {
    assert.ok(Number.isFinite(constructed.actors[id].xscale), `${id} was built with a real, signed xscale`);
    const { facing, turn, ...rest } = faced.actors[id];
    const { facing: builtFacing, turn: builtTurn, ...builtRest } = constructed.actors[id];
    assert.deepEqual(rest, builtRest, `${id}: every other field is what the construction left`);
    assert.notEqual(facing, builtFacing);
    assert.equal(builtTurn, null);
    assert.deepEqual({ ...turn }, { from: builtFacing, to: facing, sequence: turn.sequence, actionToken: token });
    assert.ok(Object.isFrozen(turn));
  }
});

test("a face-clip on a combatant nothing placed is recorded and still refuses to be drawn", () => {
  const { commands } = actAndPresent(teleportPast(), TELEPORT_SELF);
  const scene = applyCommands(emptyScene(), commands.filter((command) => command.kind === CommandKind.FACE_CLIP));
  assert.equal(scene.actors.hero.placed, false);
  assert.equal(scene.actors.hero.facing, "left");
  assert.equal(scene.actors.hero.x, null, "and no geometry was invented to go with it");
});

/* ------------------------------------------------------------------ *
 * When the turn is drawn                                              *
 * ------------------------------------------------------------------ */

test("figureFacingAt holds the old facing while the turning action is pending, and draws the new one after", () => {
  const turn = { from: "right", to: "left", sequence: 4, actionToken: 3 };
  assert.equal(figureFacingAt({ facing: "left", turn, pendingTokens: [3] }), "right", "held while its action plays");
  assert.equal(figureFacingAt({ facing: "left", turn, pendingTokens: [] }), "left", "turned once it has finished");
  assert.equal(figureFacingAt({ facing: "left", turn, pendingTokens: [9] }), "left", "another action's token holds nothing");
  assert.equal(figureFacingAt({ facing: "left", turn: { ...turn, actionToken: null }, pendingTokens: [3] }), "left",
    "a turn with no token has nothing to wait for");
  assert.equal(figureFacingAt({ facing: "right" }), "right", "no turn at all is the resting facing");
  assert.throws(() => figureFacingAt({ facing: undefined, turn, pendingTokens: [3] }), TimelineError);
  assert.throws(() => figureFacingAt({ facing: "left", turn, pendingTokens: new Set([3]) }), TimelineError);
});

test("THE TIMING: the caster plays Cast2 facing the way it stood, and turns as it reappears; the foe turns then too", () => {
  const battle = teleportPast();
  const { commands, scene, token } = actAndPresent(battle, TELEPORT_SELF);
  const event = battle.events.find((entry) => entry.type === Ss2ActionType.CAST_TELEPORT);
  const { started } = timelinesForStep(commands);
  assert.deepEqual([...started.keys()], ["hero"], "the foe plays nothing: it is a bystander to its own turn");
  const cast2 = started.get("hero");
  assert.equal(cast2.token, token);

  // The shell's own frame, in its own order: drain what finished, then draw.
  const playing = new Map([["hero", { ...cast2, startedAt: 0 }]]);
  let pendingTokens = [token];
  const frameAt = (clock) => {
    const cursor = animationCursor(pendingTokens, playing, clock);
    for (const id of cursor.expired) playing.delete(id);
    pendingTokens = pendingTokens.filter((pending) => !cursor.finished.includes(pending));
    const drawn = (id) => {
      const actor = scene.actors[id];
      const entry = playing.get(id);
      const at = entry ? Math.min(1, (clock - entry.startedAt) / entry.timeline.durationMs) : 0;
      const facing = figureFacingAt({ facing: actor.facing, turn: actor.turn, pendingTokens });
      const pose = entry ? poseAt(entry.timeline, at) : { advance: 0 };
      const x = figureXAt({ restingX: actor.x, facing, pose, timeline: entry?.timeline ?? null, motion: entry?.motion ?? null, at });
      // The lunge taken back off, so what is compared is the point the figure
      // is HELD at; the facing it lunges with is asserted on its own.
      return { x: x - pose.advance * ADVANCE_UNITS * (facing === "left" ? -1 : 1), facing };
    };
    return { hero: drawn("hero"), foe: drawn("foe") };
  };

  const duration = cast2.timeline.durationMs;
  for (const fraction of [0, 0.25, 0.5, 0.99]) {
    const frame = frameAt(fraction * duration);
    assert.deepEqual(frame.hero, { x: event.from, facing: "right" }, `at ${fraction} of Cast2 the caster has not moved or turned`);
    assert.equal(frame.foe.facing, "left", `at ${fraction} of Cast2 the foe has not turned either`);
  }
  const after = frameAt(duration);
  assert.deepEqual(pendingTokens, [], "the action finished at the end of Cast2");
  assert.deepEqual(after.hero, { x: event.to, facing: "left" }, "and the caster reappears already turned");
  assert.equal(after.foe.facing, "right", "and the foe turns on the same frame");
});

test("a bystander holds its turn until the ACTION ends, not until its own clip does — it has none", () => {
  // The foe plays nothing on a teleport, so a rule keyed on the figure's own
  // timeline would turn it the instant the batch folded, before the caster had
  // cast. Keyed on the token, it waits for the phase advance.
  const { scene, token } = actAndPresent(teleportPast(), TELEPORT_SELF);
  const foe = scene.actors.foe;
  assert.equal(figureFacingAt({ facing: foe.facing, turn: foe.turn, pendingTokens: [token] }), "left");
  assert.equal(figureFacingAt({ facing: foe.facing, turn: foe.turn, pendingTokens: [] }), "right");
});

/* ------------------------------------------------------------------ *
 * The host, over real bouts                                           *
 * ------------------------------------------------------------------ */

test("over real arena bouts the scene is drawn the way the resolver faces every gladiator, after every action", () => {
  let turnsSeen = 0;
  let walkTurns = 0;
  let startTurns = 0;
  let steps = 0;
  // ► **AND THE TRICKS KIT OVER THE SAME SIX (2026-09-24)**: the plain roster
  //   plays no action-start turn at all in these bouts (measured: 0 in 312
  //   actions), so the ordering and chaining rules below for the actor's turn
  //   to his target would be checked against nothing. With the kit's gales,
  //   ghost strikes and bows the same six bouts play 11 of them.
  for (const [perSide, seed, kit] of [
    [1, 7], [2, 7], [3, 11], [1, 3], [2, 5], [3, 9],
    [1, 7, "tricks"], [2, 7, "tricks"], [3, 11, "tricks"], [1, 3, "tricks"], [2, 5, "tricks"], [3, 9, "tricks"]
  ]) {
    const extra = kit ? { items: demoItemsFrom(kit), seed } : {};
    const host = createVanillaBattleHost({
      teams: [
        demoSide("red", perSide, { ss2Combatant, ss2BattleValues, ...extra }),
        demoSide("blue", perSide, { ss2Combatant, ss2BattleValues, ...extra })
      ],
      rules: ss2TeamRules,
      bindings: SS2_STATIC_MAP_BINDINGS,
      seed
    });
    const construction = host.constructArena().commands;
    assert.deepEqual(construction.filter((command) => command.kind === CommandKind.FACE_CLIP), []);
    let scene = applyCommands(emptyScene(), construction);
    const built = scene;
    const ids = Object.keys(scene.actors);
    const facingOf = (id) => (host.wire().teams.flatMap((team) => team.combatants).find((c) => c.id === id)
      .status.includes(SS2_FACING_LEFT) ? "left" : "right");
    for (const id of ids) assert.equal(scene.actors[id].facing, facingOf(id), `${id} is BUILT facing the resolver's way`);
    let previous = new Map(ids.map((id) => [id, facingOf(id)]));

    while (!host.battle.result && steps < 5000) {
      const actorId = host.currentCombatantId();
      const chosen = host.suggestAction(actorId);
      const step = host.submit({ ...chosen, actorId });
      steps += 1;
      scene = applyCommands(scene, step.commands);
      // Phase-advance turns come LAST; an action-start turn (the actor's turn
      // to his target, 2026-09-24) comes before the actor's own clip.
      const phaseTurn = (command) => command.kind === CommandKind.FACE_CLIP && command.at !== "action-start";
      const first = step.commands.findIndex(phaseTurn);
      if (first !== -1) {
        assert.ok(step.commands.slice(first).every(phaseTurn), "phase-advance turns come last");
      }
      // Each turn starts from the facing the one before it left — within the
      // action, and from the last action for the first turn of each gladiator.
      const drawn = new Map(previous);
      for (const command of step.commands.filter((entry) => entry.kind === CommandKind.FACE_CLIP)) {
        turnsSeen += 1;
        if (/^walk-/.test(chosen.type)) walkTurns += 1;
        if (command.at === "action-start") {
          startTurns += 1;
          assert.equal(command.combatantId, actorId, "only the actor turns at the start of his action");
          const clipAt = step.commands.findIndex((entry) => entry.kind === CommandKind.CLIP_GOTO && entry.combatantId === actorId);
          assert.ok(clipAt === -1 || step.commands.indexOf(command) < clipAt, "and before his own clip");
        }
        assert.equal(command.from, drawn.get(command.combatantId), "a turn starts from the facing the last turn left");
        assert.equal(command.actionToken, step.actionBoundary, "under the action that turned it");
        drawn.set(command.combatantId, command.to);
      }
      for (const id of ids) {
        assert.equal(scene.actors[id].facing, facingOf(id),
          `${perSide}v${perSide} seed ${seed} after ${chosen.type}: ${id} is drawn facing the wrong way`);
        // A turn is not a re-placement: the construction's mirror and size
        // are `place-clip`'s, and nothing after it may rewrite them.
        for (const field of ["xscale", "yscale", "geometryAuthored", "placed"]) {
          assert.equal(scene.actors[id][field], built.actors[id][field], `${id}.${field} changed after ${chosen.type}`);
        }
      }
      previous = new Map(ids.map((id) => [id, facingOf(id)]));
    }
  }
  // The sweep proves it FOUND what it was about: turns happen in real bouts,
  // and at least one is the plainest case of all — a walk past a foe.
  assert.ok(turnsSeen > 0, "the sweep saw no turn at all, so it proves nothing");
  assert.ok(walkTurns > 0, "and none of them came from a walk");
  assert.ok(startTurns > 0, "and none of them was an actor turning to his target at the start of his action");
});
