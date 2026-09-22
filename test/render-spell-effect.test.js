/**
 * THE BOLT ITSELF — the clip a cast attaches at its victim, from the resolved
 * event to the pixel.
 *
 * Until 2026-09-22 a bolt played its two fighter clips (`Cast2`, `lightning`)
 * and drew no bolt: the build's `lightning_bolt_combat` was not in the props
 * pack and nothing asked for it. The bolt phase attaches it ONCE, at the
 * victim, between the caster's clip and the ingress that plays the victim's:
 *
 * ```text
 *   attacker.gotoAndPlay("Cast2")                                   +0x8515
 *   bolt = arena.gladiators.attachMovie("lightning_bolt_combat",
 *            ..., { _x: defender._x, _y: 50 })                       +0x852a
 *   magic_damage_character(... "lightning", 8, lightning_damage)    +0x85af
 *   bolt.gotoAndStop(lightning_frame)                               +0x85c2
 *   ...
 *   if (defender.struck == true) bolt.removeMovieClip()             +0x85ed
 * ```
 *
 * Three seams, each tested here: the COMMAND the presentation layer emits, the
 * SCENE that folds it, and the ARITHMETIC that says where and for how long.
 * `tools/arena/main.js` only paints, because it cannot be tested.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { applyAction, combatantById, createTeamBattle, toTeamWireState } from "../src/team/index.js";
import { Ss2ActionType, SS2_ARENA, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import {
  buildArenaLayout, CommandKind, presentResolvedEvents, SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";
import {
  applyCommands, effectLifetimeMs, emptyScene, spellEffectDrawAt, timelineFor, timelinesForStep
} from "../src/render/index.js";

const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 40, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 40, character_level: 40, weapon: 1, ...o
});

/** A caster that opens, and a victim tough enough to survive the bolt. */
function castAndPresent(type, inventory, { foeX = 60, foeY = 200, foe = {} } = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [ss2Combatant(fields({ speed: 21, inventory1: inventory }), { id: "hero", name: "hero", controller: "local" })]
      },
      {
        id: "blue",
        name: "blue",
        combatants: [ss2Combatant(fields({ gladiator_dir: "left", ...foe }), { id: "foe", name: "foe", controller: "local" })]
      }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: -60, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: foeX, y: foeY });
  applyAction(battle, { actorId: "hero", type, targetId: "foe" });
  const wire = toTeamWireState(battle);
  const layout = buildArenaLayout(wire);
  return { battle, layout, ...presentResolvedEvents(wire, { layout, bindings: SS2_STATIC_MAP_BINDINGS }) };
}

/* ------------------------------------------------------------------ *
 * The command                                                         *
 * ------------------------------------------------------------------ */

test("a presented bolt ATTACHES the build's own clip at its victim, once", () => {
  for (const [type, inventory, frame] of [
    [Ss2ActionType.CAST_LIGHTNING_BOLT, 34, 1],
    [Ss2ActionType.CAST_FRIGHTNING_BOLT, 35, 2]
  ]) {
    const { commands } = castAndPresent(type, inventory, { foeX: 140 });
    const effects = commands.filter((command) => command.kind === CommandKind.ATTACH_EFFECT);
    assert.equal(effects.length, 1, `${type}: exactly one bolt`);
    const [effect] = effects;
    assert.equal(effect.effect, "lightning_bolt_combat", "the build's own linkage name");
    assert.equal(effect.frame, frame, "`bolt.gotoAndStop(lightning_frame)`, 1 or 2");
    assert.equal(effect.casterId, "hero");
    assert.equal(effect.targetId, "foe");
    assert.equal(effect.x, 140, "`_x: defender._x` — the victim's own x");
    assert.equal(effect.y, 200, "and the victim's own depth");
    assert.equal(effect.endsWithClip, "lightning",
      "removed when the victim's hurt clip reports back, so it names that clip");
  }
});

test("the bolt is attached AFTER the caster's clip and BEFORE the victim's, as the build orders them", () => {
  const { commands } = castAndPresent(Ss2ActionType.CAST_LIGHTNING_BOLT, 34);
  const order = commands
    .filter((command) => command.kind === CommandKind.CLIP_GOTO || command.kind === CommandKind.ATTACH_EFFECT)
    .map((command) => (command.kind === CommandKind.ATTACH_EFFECT ? "bolt" : command.label));
  assert.deepEqual(order, ["Cast2", "bolt", "lightning"]);
});

test("an ordinary swing attaches nothing", () => {
  const { commands } = castAndPresent(Ss2ActionType.QUICK_ATTACK, 1);
  assert.equal(commands.filter((command) => command.kind === CommandKind.ATTACH_EFFECT).length, 0);
});

/* ------------------------------------------------------------------ *
 * The scene                                                           *
 * ------------------------------------------------------------------ */

test("the scene carries the bolt as its own record, touching no actor", () => {
  const { commands } = castAndPresent(Ss2ActionType.CAST_FRIGHTNING_BOLT, 35, { foeX: 90 });
  const scene = applyCommands(emptyScene(), commands);
  assert.equal(scene.effects.length, 1);
  const [record] = scene.effects;
  assert.equal(record.effect, "lightning_bolt_combat");
  assert.equal(record.frame, 2);
  assert.equal(record.x, 90);
  assert.equal(record.endsWithClip, "lightning");
  assert.ok(record.actionToken === null || Number.isInteger(record.actionToken));
  // Batch-local, like an arrow: a bolt belongs to the action that attached it.
  const next = applyCommands(scene, []);
  assert.equal(next.effects.length, 0, "the next batch does not inherit this one's bolt");
});

/* ------------------------------------------------------------------ *
 * The arithmetic                                                      *
 * ------------------------------------------------------------------ */

const DEPS = Object.freeze({
  frontY: SS2_ARENA.frontY,
  rankStride: 97,
  figureScaleFor: ({ rank }) => 1 - 0.1 * rank,
  rankOfDepth: (depth, unused, { frontY, rankStride }) => Math.round((frontY - depth) / rankStride)
});

const record = (overrides = {}) => ({
  effect: "lightning_bolt_combat", frame: 1, x: 140, y: 200, endsWithClip: "lightning", ...overrides
});

test("the bolt stands ONE FIGURE HEIGHT over its victim, at the victim's x", () => {
  // `_y: 50` in `arena.gladiators`, the object both fighters stand in at `_y`
  // 200: the bolt's origin is 150 arena units above the victim's.
  const drawn = spellEffectDrawAt(record(), 0, DEPS);
  assert.equal(drawn.x, 140);
  assert.equal(drawn.y, 200);
  assert.equal(drawn.lift, 150);
  assert.equal(drawn.size, 1, "front rank, full size");
  assert.equal(drawn.rotation, 0);
});

test("it scales with its victim's rank, and a null depth draws at the front", () => {
  assert.equal(spellEffectDrawAt(record({ y: 200 - 97 }), 0, DEPS).size, 0.9);
  const flat = spellEffectDrawAt(record({ y: null }), 0, DEPS);
  assert.equal(flat.y, SS2_ARENA.frontY);
  assert.equal(flat.size, 1);
});

test("its AGE is the build's 30 fps clock, and it lives exactly as long as the victim's clip", () => {
  const lifetime = timelineFor("lightning", { role: "target" }).durationMs;
  assert.equal(spellEffectDrawAt(record(), 0, DEPS).ageFrames, 0);
  assert.equal(spellEffectDrawAt(record(), 34, DEPS).ageFrames, 1, "one 30 fps frame is 33.3 ms");
  assert.equal(spellEffectDrawAt(record(), 400, DEPS).ageFrames, 12);
  assert.equal(spellEffectDrawAt(record(), 0, DEPS).lifetimeMs, lifetime,
    "read off the victim's own timeline, so the two cannot disagree");
  assert.equal(spellEffectDrawAt(record(), lifetime - 1, DEPS).done, false);
  assert.equal(spellEffectDrawAt(record(), lifetime, DEPS).done, true, "removed when the clip reports back");
});

test("the arithmetic refuses to guess its painter's scale", () => {
  assert.throws(() => spellEffectDrawAt(record(), 0, { frontY: 200 }), /figureScaleFor/);
});

test("the bolt lives as long as its victim's LAST clip in the batch — which on a kill is the death", () => {
  // ► **FOUND BY A CODEX ADVERSARIAL REVIEW, 2026-09-22, and reproduced first.**
  //   The first cut read the lifetime off `endsWithClip` — `lightning`, 480 ms —
  //   while a lethal cast emits `lightning` AND then the victim's death clip,
  //   and `timelinesForStep` keeps the LAST clip per combatant: `slain`, 1,200
  //   ms. The bolt vanished 720 ms before its victim finished dying. The tests
  //   above staged only survivors, which is why they could not see it.
  //
  //   The fix is to ask the SAME function the shell asks. `effectLifetimeMs`
  //   reads the victim's entry in `timelinesForStep(...).started`, so the bolt
  //   and the figure it strikes end together by construction.
  const lethal = castAndPresent(Ss2ActionType.CAST_FRIGHTNING_BOLT, 35, {
    foe: { vitality: 6, herolevel: 5, character_level: 5 }
  });
  assert.equal(combatantById(lethal.battle, "foe").alive, false, "a 170-HP victim cannot survive 200-400");
  const { started } = timelinesForStep(lethal.commands);
  const [record] = applyCommands(emptyScene(), lethal.commands).effects;
  assert.equal(started.get("foe").timeline.label, "slain", "the victim's last clip is its death");
  assert.equal(effectLifetimeMs(record, started), started.get("foe").timeline.durationMs);
  assert.ok(effectLifetimeMs(record, started) > timelineFor("lightning", { role: "target" }).durationMs,
    "longer than the hurt clip alone, which is the whole defect");

  // A survivor's last clip IS `lightning`, so nothing changes for it.
  const survivor = castAndPresent(Ss2ActionType.CAST_LIGHTNING_BOLT, 34);
  const [kept] = applyCommands(emptyScene(), survivor.commands).effects;
  assert.equal(effectLifetimeMs(kept, timelinesForStep(survivor.commands).started),
    timelineFor("lightning", { role: "target" }).durationMs);

  // And with no cursor to ask, it falls back to the clip the command names.
  assert.equal(effectLifetimeMs(kept, new Map()), timelineFor("lightning", { role: "target" }).durationMs);
});

test("the draw honours a lifetime it is HANDED, so the painter and the prune agree", () => {
  const handed = spellEffectDrawAt(record(), 1000, DEPS, { lifetimeMs: 1200 });
  assert.equal(handed.lifetimeMs, 1200);
  assert.equal(handed.done, false, "at 1,000 ms a bolt bound to a 1,200 ms death is still up");
  assert.equal(spellEffectDrawAt(record(), 1200, DEPS, { lifetimeMs: 1200 }).done, true);
});
