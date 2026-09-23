/**
 * Rejuvenate (43), regenerate (46) and boundless energy (45) THROUGH THE HOST
 * the arena uses — `createVanillaBattleHost`, fed the arena's own members
 * (`demoSide` in `tools/arena/roster.js`, which builds each bag with
 * `ss2Combatant`).
 *
 * ► **WHY THIS FILE EXISTS (2026-09-23).** Every test of these three spells
 *   built its battle with `createTeamBattle` directly, and none went through the
 *   host. The arena's `?items=buffs` and `?items=crowd` kits then failed at
 *   construction: the host checks every name in a caller-supplied resource bag
 *   against the battle map's citations (`assertSuppliedResources` in
 *   `src/adapter/state-bridge.js`), and `ss2Combatant` put two kinds of name in
 *   the bag that the adapter's catalogue could not cite:
 *
 *   - the nine `backup_*` fields `cast_rejuvinate` restores from — REAL vanilla
 *     fields the catalogue had not been told about;
 *   - `timed_spell_tick_owed`, the tick clock beside a timed counter — an
 *     INVENTED engine field with no vanilla field behind it, which the citation
 *     rule is right to refuse.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { citationFor, isKnownVanillaField } from "../src/adapter/vanilla-fields.js";
import { EffectKind, lastResolvedAction } from "../src/team/index.js";
import { demoSide } from "../tools/arena/roster.js";
import { Ss2ActionType, ss2BattleValues, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";

/** The engine's own "owes one bystander tick" fact. AUTHORED: the build has no such field. */
const CLOCK = "timed_spell_tick_owed";

/** A 1v1 of the arena's own members, each side carrying the items named. */
function hostOf({ red = [], blue = [], seed = 7 } = {}) {
  return createVanillaBattleHost({
    teams: [
      demoSide("red", 1, { ss2Combatant, ss2BattleValues, items: red }),
      demoSide("blue", 1, { ss2Combatant, ss2BattleValues, items: blue })
    ],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed
  });
}

test("the adapter cites all thirteen fight-start backups, and still cites nothing for the invented tick clock", () => {
  // The nine `cast_rejuvinate` restores from, and the four the stat spells'
  // expiry restores from — one writer, `backup_char`, one map section.
  for (const name of [
    "backup_shoulderguard", "backup_gauntlet", "backup_breastplate", "backup_helmet", "backup_greaves",
    "backup_shinguard", "backup_boot", "backup_weapon", "backup_shield",
    "backup_strength", "backup_speed", "backup_attack", "backup_defence"
  ]) {
    assert.match(citationFor(name) ?? "", /Five more phases/, `${name} must cite the section that derives it`);
    assert.equal(isKnownVanillaField(name), true, `${name} is a field of the persistent object`);
  }
  assert.equal(citationFor(CLOCK), null, "this engine invented it; no map section can cite it");
  // So the host still refuses it in a supplied bag: the rule stays, the clock moved.
  const [member] = demoSide("red", 1, { ss2Combatant, ss2BattleValues }).members;
  assert.throws(() => createVanillaBattleHost({
    teams: [
      { id: "red", name: "Red", members: [{ ...member, resources: { ...member.resources, [CLOCK]: 1 } }] },
      demoSide("blue", 1, { ss2Combatant, ss2BattleValues })
    ],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS
  }), (error) => /timed_spell_tick_owed, which no battle-map section cites/.test(error.message));
});

const valueOf = (host, id, name) =>
  host.battle.teams.flatMap((team) => team.combatants).find((combatant) => combatant.id === id)
    .resources[name]?.value;

/**
 * `demoSide`'s slot-0 gladiator, read off `tools/arena/roster.js`: the nine
 * fields `cast_rejuvinate` restores, as the roster states them.
 */
const ROSTER_PIECES = Object.freeze({
  shoulderguard: 1, gauntlet: 1, breastplate: 3, helmet: 2, greaves: 2, shinguard: 1, boot: 2, weapon: 1, shield: 2
});
const piecesOf = (host, id) => Object.fromEntries(Object.keys(ROSTER_PIECES).map((piece) => [piece, valueOf(host, id, piece)]));

test("a rejuvenate holder built the arena's way constructs through the host", () => {
  const host = hostOf({ red: [43] });
  // `demoSide`'s slot-0 gladiator wears breastplate 3, helmet 2, shield 2,
  // shoulderguard 1, gauntlet 1, greaves 2, shinguard 1, boot 2 and weapon 1
  // (`tools/arena/roster.js`), and `backup_char` snapshots each before the fight.
  assert.equal(valueOf(host, "red-1", "backup_helmet"), 2);
  assert.equal(valueOf(host, "red-1", "backup_breastplate"), 3);
  assert.equal(valueOf(host, "red-1", "backup_shield"), 2);
});

test("through the host, a weaken armour strips pieces and the holder's rejuvenate brings every one back from its backup", () => {
  const host = hostOf({ red: [43], blue: [44] });
  assert.deepEqual(piecesOf(host, "red-1"), ROSTER_PIECES);
  assert.equal(host.currentCombatantId(), "red-1", "red opens at this seed");
  host.submit({ actorId: "red-1", type: Ss2ActionType.REST, targetId: "red-1" });
  host.submit({ actorId: "blue-1", type: Ss2ActionType.CAST_WEAKEN_ARMOUR, targetId: "red-1" });

  const stripped = piecesOf(host, "red-1");
  const removed = Object.keys(ROSTER_PIECES).filter((piece) => stripped[piece] === 0);
  assert.ok(removed.length > 0, "the weaken must take something, or the restore proves nothing");
  const lowered = valueOf(host, "red-1", "armourclass_max");
  assert.ok(lowered < 38, "and take its worth out of the maximum (38 at construction)");

  host.submit({ actorId: "red-1", type: Ss2ActionType.CAST_REJUVINATE, targetId: "red-1" });
  assert.deepEqual(piecesOf(host, "red-1"), ROSTER_PIECES, "every piece is back at what the roster gave it");
  assert.deepEqual(host.battle.events.at(-1).piecesRestored.map(({ piece }) => piece).sort(), [...removed].sort());
  // `armourclass = armourclass_max` (+0x8e2c) reads the LOWERED maximum and never writes it.
  assert.equal(valueOf(host, "red-1", "armourclass_max"), lowered);
  assert.equal(valueOf(host, "red-1", "armourclass"), lowered);
  // The backups are read, never written.
  assert.equal(valueOf(host, "red-1", "backup_helmet"), 2);
  assert.equal(valueOf(host, "red-1", "backup_breastplate"), 3);
});

/* ------------------------------------------------------------------ *
 * Regenerate and boundless energy: the counter, and the tick clock    *
 * ------------------------------------------------------------------ */

test("a regenerate holder and a boundless holder built the arena's way construct through the host, owed a tick", () => {
  for (const [itemId, counter] of [[46, "spell_regenerate"], [45, "spell_boundless_energy"]]) {
    const host = hostOf({ red: [itemId] });
    // The build's "no buff" (0 and `undefined` both fail `> 0`), and before any
    // phase every bearer is owed its bystander tick.
    assert.equal(valueOf(host, "red-1", counter), 0, `${itemId}: ${counter}`);
    assert.equal(valueOf(host, "red-1", CLOCK), 1, `${itemId}: the clock`);
    assert.equal(valueOf(host, "blue-1", CLOCK), undefined, `${itemId}: a gladiator bearing nothing carries no clock`);
  }
});

/**
 * The arena's 1v1 with red-1 carrying `items`, entering with the stated
 * `hitpoints` / `staminaleft` so a gain has headroom to show. The roster's
 * gladiator is 46 hitpoints, 140 staminamax, magicka 0 (`demoGladiator`).
 */
function woundedHost(items, { hitpoints, staminaleft } = {}) {
  const red = demoSide("red", 1, { ss2Combatant, ss2BattleValues, items });
  const [member] = red.members;
  red.members[0] = {
    ...member,
    vanilla: {
      ...member.vanilla,
      ...(hitpoints === undefined ? {} : { hitpoints }),
      ...(staminaleft === undefined ? {} : { staminaleft })
    },
    // `staminaleft` is a resource as well as a field; the two must agree.
    resources: { ...member.resources, ...(staminaleft === undefined ? {} : { staminaleft }) }
  };
  return createVanillaBattleHost({
    teams: [red, demoSide("blue", 1, { ss2Combatant, ss2BattleValues })],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed: 7
  });
}

const healsOn = (host, id) => lastResolvedAction(host.battle).effects
  .filter((effect) => effect.targetId === id && effect.kind === EffectKind.HEAL)
  .map((effect) => effect.amount);
const healthOf = (host, id) =>
  host.battle.teams.flatMap((team) => team.combatants).find((combatant) => combatant.id === id).health;

test("through the host, regenerate heals round(46 / 4) = 12 on the bearer's own phases and ticks by the bearer's-turn rule", () => {
  const host = woundedHost([46], { hitpoints: 5 });
  assert.equal(host.currentCombatantId(), "red-1");
  host.submit({ actorId: "red-1", type: Ss2ActionType.CAST_REGENERATE, targetId: "red-1" });
  // The arm writes 20 and the cast's own `nextphase` decrements before the test.
  assert.equal(valueOf(host, "red-1", "spell_regenerate"), 19);
  assert.ok(healsOn(host, "red-1").includes(12), "the cast phase applies: Math.round(11.5) = 12");
  assert.equal(host.mirrorFor("red-1").fields.hitpoints, healthOf(host, "red-1"), "and the heal reaches the vanilla mirror");
  assert.equal(valueOf(host, "red-1", CLOCK), 1, "its own phase leaves it owed");

  host.submit({ actorId: "blue-1", type: Ss2ActionType.REST, targetId: "blue-1" });
  assert.equal(valueOf(host, "red-1", "spell_regenerate"), 18, "the foe's phase pays the owed tick");
  assert.equal(valueOf(host, "red-1", CLOCK), 0);
  assert.deepEqual(healsOn(host, "red-1"), [], "and a bystander gains nothing");

  host.submit({ actorId: "red-1", type: Ss2ActionType.REST, targetId: "red-1" });
  assert.equal(valueOf(host, "red-1", "spell_regenerate"), 17);
  assert.ok(healsOn(host, "red-1").includes(12), "applied again on its own phase");
  assert.equal(host.mirrorFor("red-1").fields.hitpoints, healthOf(host, "red-1"));
});

test("through the host, boundless energy adds round(140 / 4) = 35 stamina over the same cast without it, and ticks the same way", () => {
  const boundless = woundedHost([45], { staminaleft: 60 });
  const control = woundedHost([46], { staminaleft: 60 });
  boundless.submit({ actorId: "red-1", type: Ss2ActionType.CAST_BOUNDLESS_ENERGY, targetId: "red-1" });
  // Regenerate costs the same round(magicka) and takes the same transition, and adds no stamina.
  control.submit({ actorId: "red-1", type: Ss2ActionType.CAST_REGENERATE, targetId: "red-1" });
  const gained = valueOf(boundless, "red-1", "staminaleft") - valueOf(control, "red-1", "staminaleft");
  assert.equal(gained, 35);
  assert.equal(boundless.mirrorFor("red-1").fields.staminaleft, valueOf(boundless, "red-1", "staminaleft"));
  assert.equal(valueOf(boundless, "red-1", "spell_boundless_energy"), 19);
  boundless.submit({ actorId: "blue-1", type: Ss2ActionType.REST, targetId: "blue-1" });
  assert.equal(valueOf(boundless, "red-1", "spell_boundless_energy"), 18, "the foe's phase pays the owed tick");
});
