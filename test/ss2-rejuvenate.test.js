/**
 * `cast_rejuvinate` (inventory id 43) — the full refill, and the only thing in
 * this engine that brings a removed armour piece back.
 *
 * ## WHAT THE BUILD DOES, AND WHERE
 *
 * Derived from the oracle whose sha256 is `77CB545C…`, read 2026-09-22 from
 * `sprite:862[overlay]/frame:52/DoAction@0x240c7f`, block base `0x240c85`
 * (the main session's dump `arm-cast_rejuvinate.txt`):
 *
 * ```text
 *   phase_decision == "cast_rejuvinate"                              +0x8d69
 *     register:3.crowd_action = 3                  (EVERY tick)      +0x8d7c
 *     game_attacker.staminacost = Math.round(game_attacker.magicka)  +0x8d89
 *     if (attacker.struck == null) {                                 +0x8db0
 *       cast_spell_icon(attacker, 43)                                +0x8dc7
 *       attacker.struck = false                                      +0x8ddf
 *       attacker.gotoAndPlay("Rejuvinate")                           +0x8ded
 *       game_attacker.hitpoints   = game_attacker.hitpointsmax       +0x8e02
 *       game_attacker.staminaleft = game_attacker.staminamax         +0x8e17
 *       game_attacker.armourclass = game_attacker.armourclass_max    +0x8e2c
 *       game_attacker.shoulderguard = whichcharacter.backup_shoulderguard  +0x8e41 (GetVariable +0x8e50)
 *       game_attacker.gauntlet    = game_attacker.backup_gauntlet    +0x8e59
 *       game_attacker.breastplate = game_attacker.backup_breastplate +0x8e6f
 *       game_attacker.helmet      = game_attacker.backup_helmet      +0x8e85
 *       game_attacker.greaves     = game_attacker.backup_greaves     +0x8e9b
 *       game_attacker.shinguard   = game_attacker.backup_shinguard   +0x8eb1
 *       game_attacker.boot        = game_attacker.backup_boot        +0x8ec7
 *       game_attacker.weapon      = game_attacker.backup_weapon      +0x8edd
 *       game_attacker.shield      = game_attacker.backup_shield      +0x8ef3
 *       updatecharacter(game_attacker, attacker)       (art only)    +0x8f09
 *     }
 *     if (attacker.struck == true) { attacker.struck = null; nextphase() }  +0x8f24-+0x8f58
 * ```
 *
 * No draw, no timed counter, no `defender`. `backup_*` is written only by
 * `backup_char` (`root/frame:35` `+0x2d80`-`+0x2e69`), whose four call sites
 * are all outside battle (`sprite:2249/frame:1` `+0x010a`/`+0x012e` before the
 * fight, `sprite:2249/frame:231` after a win, `root/button:2283`), so in battle
 * it is the fight-start snapshot. `armourclass_max` is read and never written,
 * so a caster who lost pieces refills to the LOWERED maximum.
 *
 * Villain ladder arm 1 (`DoAction@0x23e7cf`, base `0x23e7d5`), FIRST in
 * `villain_cast_spells`, behind only the `randomBetween(1, 100) > 10` roll at
 * `+0x056f`:
 *
 * ```text
 *   check_inventory(43) == true                                      +0x0593
 *   && villain.hitpoints < villain.hitpointsmax / 1.5                +0x05b1-+0x05e6 (Push 1.5; Divide; Less2)
 *   -> villaindecisionA = "cast_rejuvinate"; use_item(item_used)     +0x05ed-+0x0605
 * ```
 *
 * ## WHAT IS DECIDED HERE, AND WHOSE
 *
 * - **The shoulderguard is restored from its backup like the other eight.**
 *   The build reads it through `GetVariable "whichcharacter"` (`+0x8e50`), a
 *   free variable nothing in the build assigns, so there it becomes
 *   `undefined`. The owner's decision, 2026-09-22.
 * - **The backups are declared at construction by possession of id 43**, as the
 *   timed-buff counters are, because the resolver creates no resource
 *   mid-battle. A record that STATES one keeps its value.
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, EffectKind, lastResolvedAction,
  legalActions, suggestAction, toTeamWireState
} from "../src/team/index.js";
import {
  buildArenaLayout, CommandKind, LabelProvenance, presentArenaConstruction, presentResolvedEvents,
  SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";
import { allUnmappedLabels, applyCommands, clipLabelsFor, emptyScene, timelineFor } from "../src/render/index.js";
import {
  SS2_INVENTORY_EMPTY, SS2_REJUVENATE, SS2_RESOURCE_DEFAULTS, SS2_RESOURCE_NAMES, Ss2ActionType, VANILLA_PHASE_LABEL,
  createSs2TeamRules, ss2Combatant, ss2TeamRules
} from "../src/team/ss2-rules.js";
import { restAnywhere } from "./ss2-rest-anywhere.js";

const REJUVENATE = Ss2ActionType.CAST_REJUVINATE;

/* ------------------------------------------------------------------ *
 * The vocabulary                                                      *
 * ------------------------------------------------------------------ */

test("the token is `cast-rejuvinate`, the build's spelling, and it round-trips to `cast_rejuvinate`", () => {
  assert.equal(REJUVENATE, "cast-rejuvinate");
  // `Push constant[322]="cast_rejuvinate"` at `+0x8d6f`; ladder arm 1 writes the
  // same string at `+0x05ed`.
  assert.equal(VANILLA_PHASE_LABEL[REJUVENATE], "cast_rejuvinate");
  assert.ok(createSs2TeamRules().actionTypes.includes(REJUVENATE));
});

test("the constants are the build's literals", () => {
  // `cast_spell_icon(attacker, 43)` `+0x8dc7`; `check_inventory(43)` `+0x0593`.
  assert.equal(SS2_REJUVENATE.itemId, 43);
  // `gotoAndPlay("Rejuvinate")` `+0x8ded` — capital R, as the build passes it.
  assert.equal(SS2_REJUVENATE.casterClip, "Rejuvinate");
  // `register:3.crowd_action = 3` `+0x8d7c` — ~~recorded, not modelled~~ MODELLED 2026-09-22 (`test/ss2-crowd.test.js`).
  assert.equal(SS2_REJUVENATE.crowdAction, 3);
  // Ladder arm 1, `hitpoints < hitpointsmax / 1.5` (`Push 1.5` at `+0x05d9`).
  assert.equal(SS2_REJUVENATE.ladderArm, 1);
  assert.equal(SS2_REJUVENATE.aiHealthDivisor, 1.5);
  // The nine restores, in the arm's own order, `+0x8e41`-`+0x8f08`.
  assert.deepEqual(SS2_REJUVENATE.restores.map(({ piece, backup }) => [piece, backup]), [
    ["shoulderguard", "backup_shoulderguard"],
    ["gauntlet", "backup_gauntlet"],
    ["breastplate", "backup_breastplate"],
    ["helmet", "backup_helmet"],
    ["greaves", "backup_greaves"],
    ["shinguard", "backup_shinguard"],
    ["boot", "backup_boot"],
    ["weapon", "backup_weapon"],
    ["shield", "backup_shield"]
  ]);
});

/* ------------------------------------------------------------------ *
 * The backups: declared at construction, by possession                *
 * ------------------------------------------------------------------ */

/** 170 hitpoints, 160 stamina, magicka 7 and stamina 6 once derived — the timed-buff test's gladiator. */
const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 5, character_level: 5, weapon: 1, ...o
});

const BACKUPS = [
  "backup_boot", "backup_breastplate", "backup_gauntlet", "backup_greaves", "backup_helmet",
  "backup_shield", "backup_shinguard", "backup_shoulderguard", "backup_weapon"
];

test("the nine backups are declarable resources with NO default, so nothing fills them in", () => {
  for (const name of BACKUPS) {
    assert.ok(SS2_RESOURCE_NAMES.includes(name), `${name} must be declarable`);
    assert.equal(Object.hasOwn(SS2_RESOURCE_DEFAULTS, name), false,
      `${name} with a default would be filled into every golden's combatant and move all 23 hashes`);
  }
});

test("carrying 43 declares each backup AT THE PIECE IT BACKS, at construction — `backup_char`'s snapshot", () => {
  const holder = ss2Combatant(fields({ inventory2: 43, helmet: 2, shoulderguard: 1, shield: 3 }));
  const backups = Object.fromEntries(BACKUPS.map((name) => [name, holder.resources[name]]));
  assert.deepEqual(backups, {
    backup_boot: 0,
    backup_breastplate: 0,
    backup_gauntlet: 0,
    backup_greaves: 0,
    backup_helmet: 2,
    backup_shield: 3,
    backup_shinguard: 0,
    backup_shoulderguard: 1,
    backup_weapon: 1
  });
});

test("a gladiator WITHOUT 43 declares no backup; a STATED backup is kept; the empty marker is not an item", () => {
  const plain = ss2Combatant(fields({ helmet: 2 }));
  assert.deepEqual(BACKUPS.filter((name) => Object.hasOwn(plain.resources, name)), []);
  assert.equal(ss2Combatant(fields({ inventory1: 43, helmet: 2, backup_helmet: 4 })).resources.backup_helmet, 4,
    "a record that states its backup — a capture's `game_*` object carries them — keeps it");
  const empty = ss2Combatant(fields({ inventory1: SS2_INVENTORY_EMPTY, helmet: 2 }));
  assert.equal(Object.hasOwn(empty.resources, "backup_helmet"), false);
});

test("a weaponless holder declares no `backup_weapon`: absent is not zero, and zero is a real weapon row", () => {
  const { weapon, ...bare } = fields({ inventory1: 43 });
  assert.equal(weapon, 1);
  const holder = ss2Combatant(bare);
  assert.equal(Object.hasOwn(holder.resources, "weapon"), false);
  assert.equal(Object.hasOwn(holder.resources, "backup_weapon"), false);
  assert.equal(holder.resources.backup_helmet, 0, "the eight armour pieces are always declared, so are theirs");
});

/* ------------------------------------------------------------------ *
 * The offer                                                           *
 * ------------------------------------------------------------------ */

/** A 1v1 with the caster on RED, opening — the timed-buff test's staging. */
function staged({ hero = {}, foe = {}, heroX = -60, foeX = 60, controller = "local", rngTape = null } = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rngTape,
    rules: ss2TeamRules,
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [ss2Combatant(fields({ speed: 21, ...hero }), { id: "hero", name: "hero", controller })]
      },
      {
        id: "blue",
        name: "blue",
        combatants: [ss2Combatant(fields({ gladiator_dir: "left", ...foe }), { id: "foe", name: "foe", controller })]
      }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: heroX, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: foeX, y: 200 });
  assert.equal(currentCombatant(battle).id, "hero", "the caster must open for these tests to mean anything");
  return battle;
}

const offersOf = (battle, id = "hero") => legalActions(battle, id).filter((option) => option.type === REJUVENATE);

test("carrying no 43 offers no rejuvenate", () => {
  assert.deepEqual(offersOf(staged()), []);
});

test("43 in any declared slot offers ONE self-targeted cast — the arm never reads `defender`", () => {
  assert.deepEqual(offersOf(staged({ hero: { inventory1: 43 } })), [{ type: REJUVENATE, targetId: "hero" }]);
  assert.deepEqual(offersOf(staged({ hero: { inventory6: 43 } })), [{ type: REJUVENATE, targetId: "hero" }]);
  assert.deepEqual(offersOf(staged({ hero: { inventory1: 43, inventory2: 43 } })), [{ type: REJUVENATE, targetId: "hero" }],
    "two 43s are one action; which slot empties is the resolver's");
});

test("the offer reads no pool: a gladiator at full health, stamina and armour is offered it", () => {
  const battle = staged({ hero: { inventory1: 43, helmet: 2 } });
  const hero = combatantById(battle, "hero");
  assert.equal(hero.health, hero.maxHealth);
  assert.equal(hero.resources.armourclass.value, hero.resources.armourclass_max.value);
  assert.equal(offersOf(battle).length, 1);
});

test("the slot window applies: 43 in slot 3 is hidden at maxslots 2 and offered at 3", () => {
  assert.equal(offersOf(staged({ hero: { inventory3: 43, inventory_maxslots: 2 } })).length, 0);
  assert.equal(offersOf(staged({ hero: { inventory3: 43, inventory_maxslots: 3 } })).length, 1);
});

test("a holder that declares a piece but NOT its backup is not offered it: the restore would have nothing to read", () => {
  const raw = ss2Combatant(fields({ inventory1: 43, speed: 21 }), { id: "hero", name: "hero", controller: "local" });
  delete raw.resources.backup_helmet;
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [raw] },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields(), { id: "foe", name: "foe", controller: "local" })] }
    ]
  });
  assert.equal(currentCombatant(battle).id, "hero");
  assert.deepEqual(offersOf(battle), []);
});

/* ------------------------------------------------------------------ *
 * The resolution                                                      *
 * ------------------------------------------------------------------ */

const cast = (battle, actorId = "hero") => applyAction(battle, { actorId, type: REJUVENATE, targetId: actorId });
const valueOf = (battle, id, name) => combatantById(battle, id).resources[name]?.value;
const effectsOn = (battle, id) => lastResolvedAction(battle).effects.filter((effect) => effect.targetId === id);
const shapeOf = (effects) => effects.map((effect) =>
  effect.kind === EffectKind.RESOURCE ? `${effect.resource}=${effect.to}` : `${effect.kind}:${effect.amount}`);

/**
 * Helmet 2 (`_defence` `round(2 * 10)` = 20) and shield 1 (12): armour 32 of 32
 * at construction. The hero is then worn down in place: 40 of 170 hitpoints,
 * 30 of 160 stamina, 5 of 32 armour.
 */
function wornDown(o = {}) {
  const battle = staged({ hero: { inventory2: 43, helmet: 2, shield: 1, ...o } });
  const hero = combatantById(battle, "hero");
  assert.equal(hero.maxHealth, 170);
  assert.equal(hero.resources.staminamax.value, 160);
  assert.equal(hero.resources.armourclass_max.value, 32);
  hero.health = 40;
  hero.resources.staminaleft.value = 30;
  hero.resources.armourclass.value = 5;
  return battle;
}

test("the three pools refill to their ceilings, then `nextphase` charges round(magicka) against the REFILLED stamina", () => {
  const battle = wornDown();
  cast(battle);
  const hero = combatantById(battle, "hero");
  // `hitpoints = hitpointsmax` `+0x8e02`; `nextphase`'s own heal then finds no headroom.
  assert.equal(hero.health, 170);
  // `staminaleft = staminamax` `+0x8e17` (160), then `nextphase` (`+0x32a1`, `+0x32c3`):
  // 160 - round(7) + 1 + round(6 / 3) = 156, under the ceiling.
  assert.equal(valueOf(battle, "hero", "staminaleft"), 156);
  // `armourclass = armourclass_max` `+0x8e2c`.
  assert.equal(valueOf(battle, "hero", "armourclass"), 32);
  assert.equal(valueOf(battle, "hero", "armourclass_max"), 32, "read, never written");
});

test("the slot is consumed first, then the arm's writes in the build's order, then `nextphase`", () => {
  const battle = wornDown();
  cast(battle);
  assert.deepEqual(shapeOf(effectsOn(battle, "hero")), [
    `inventory2=${SS2_INVENTORY_EMPTY}`, // the hero's click / `use_item`, before the phase
    `${EffectKind.HEAL}:130`,            // hitpoints = hitpointsmax      +0x8e02
    "staminaleft=160",                   // staminaleft = staminamax      +0x8e17
    "armourclass=32",                    // armourclass = armourclass_max +0x8e2c
    "staminaleft=156"                    // nextphase: - 7 + 1 + 2
  ]);
});

test("MERGE PIN (2026-09-22): a rejuvenate is a completed phase to the tick clock — it ticks its caster and pays the owed foe", () => {
  // Rejuvenate and the owner's bearer's-turn tick rule (611094d) were built in
  // separate worktrees; neither could see the other. A rejuvenate reaches
  // `nextphase` like any phase, so `check_spells` ticks the caster, and under
  // the tick rule the foe too, because at the bout's opening every bearer is
  // owed (`timed_spell_tick_owed` 1).
  const battle = staged({
    hero: { inventory2: 43, inventory3: 46, spell_regenerate: 5 },
    foe: { inventory1: 46, spell_regenerate: 3 }
  });
  assert.equal(valueOf(battle, "hero", "timed_spell_tick_owed"), 1);
  assert.equal(valueOf(battle, "foe", "timed_spell_tick_owed"), 1);
  combatantById(battle, "hero").health = 40;
  cast(battle);
  assert.equal(valueOf(battle, "hero", "spell_regenerate"), 4, "the caster's own tick");
  assert.equal(valueOf(battle, "foe", "spell_regenerate"), 2, "the owed foe's tick, paid");
  assert.equal(valueOf(battle, "hero", "timed_spell_tick_owed"), 1, "the caster is now owed");
  assert.equal(valueOf(battle, "foe", "timed_spell_tick_owed"), 0, "the foe is paid");
  // `hitpoints = hitpointsmax` +0x8e02, then regenerate's +round(max/4) at step 8
  // meets `check_stats`' ceiling: the refill is not exceeded.
  assert.equal(combatantById(battle, "hero").health, 170);
});

test("the event names the caster's clip and nothing on anybody else, and the cost", () => {
  const battle = wornDown();
  cast(battle);
  const event = battle.events.at(-1);
  assert.equal(event.type, REJUVENATE);
  assert.equal(event.actorId, "hero");
  assert.equal(event.targetId, "hero");
  assert.equal(event.vanillaLabel, "cast_rejuvinate");
  assert.equal(event.casterClip, "Rejuvinate");
  assert.equal(Object.hasOwn(event, "victimClip"), false, "a lone casterClip binds as a self-cast");
  assert.equal(event.spellId, 43);
  assert.equal(event.consumedSlot, "inventory2");
  assert.equal(event.staminaSpent, 7);
  assert.equal(event.healthRestored, 130);
  assert.equal(event.staminaRestored, 130);
  assert.equal(event.armourRestored, 27);
  assert.deepEqual(event.piecesRestored, []);
});

test("it takes no sample: an EMPTY tape replays a cast", () => {
  const battle = staged({ hero: { inventory1: 43 }, rngTape: [] });
  cast(battle);
  assert.equal(battle.events.at(-1).type, REJUVENATE);
});

/* ------------------------------------------------------------------ *
 * The pieces, and the maximum they do not bring back                  *
 * ------------------------------------------------------------------ */

/**
 * Helmet 2 (20), shoulderguard 1 (8), shield 1 (12): armour 40 of 40. Then the
 * helmet and the shoulderguard are taken exactly as `remove_armour` takes them
 * (`+0x0477`-`+0x04a2` for the shoulderguard): the id to 0 and its `_defence`
 * out of BOTH pools, `_defence` itself untouched — armour 12 of 12 — and then
 * 9 more off the class alone, as a blow's armour damage takes it: 3 of 12.
 */
function stripped() {
  const battle = staged({ hero: { inventory1: 43, helmet: 2, shoulderguard: 1, shield: 1 } });
  const { resources } = combatantById(battle, "hero");
  assert.equal(resources.armourclass_max.value, 40);
  assert.equal(resources.helmet_defence.value, 20);
  assert.equal(resources.shoulderguard_defence.value, 8);
  resources.helmet.value = 0;
  resources.shoulderguard.value = 0;
  resources.armourclass.value = 3;
  resources.armourclass_max.value = 12;
  return battle;
}

test("the removed pieces come back from `backup_*`; the armour class refills only to the LOWERED maximum", () => {
  const battle = stripped();
  cast(battle);
  assert.equal(valueOf(battle, "hero", "helmet"), 2, "helmet = backup_helmet, +0x8e85");
  assert.equal(valueOf(battle, "hero", "shoulderguard"), 1);
  assert.equal(valueOf(battle, "hero", "shield"), 1, "never lost, never written");
  // `armourclass = armourclass_max` (+0x8e2c) reads the lowered 12, and nothing
  // in battle rebuilds the maximum (`battlevalues` gates it on `battle_started`,
  // `+0x3a90`-`+0x3aa0`).
  assert.equal(valueOf(battle, "hero", "armourclass"), 12);
  assert.equal(valueOf(battle, "hero", "armourclass_max"), 12);
  // The `_defence` fields are the ones `battlevalues` recomputes from the
  // restored ids (+0x3480-+0x3633): round(2 * 10) and round(1 * 8).
  assert.equal(valueOf(battle, "hero", "helmet_defence"), 20);
  assert.equal(valueOf(battle, "hero", "shoulderguard_defence"), 8);
  assert.deepEqual(battle.events.at(-1).piecesRestored, [
    { piece: "shoulderguard", from: 0, to: 1 },
    { piece: "helmet", from: 0, to: 2 }
  ]);
});

test("the restores are written in the ARM's order — shoulderguard before helmet — and a `_defence` that already fits its id is not rewritten", () => {
  const battle = stripped();
  cast(battle);
  const written = effectsOn(battle, "hero")
    .filter((effect) => effect.kind === EffectKind.RESOURCE)
    .map((effect) => effect.resource);
  // +0x8e41 shoulderguard, +0x8e85 helmet; unchanged fields write nothing.
  assert.deepEqual(written.filter((name) => /^(helmet|shoulderguard|gauntlet|breastplate|greaves|shinguard|boot|weapon|shield)$/.test(name)),
    ["shoulderguard", "helmet"]);
  assert.deepEqual(written.filter((name) => name.endsWith("_defence") || name.startsWith("backup_")), []);
  assert.ok(written.indexOf("armourclass") < written.indexOf("shoulderguard"),
    "the pools (+0x8e02-+0x8e40) precede the pieces (+0x8e41-)");
});

test("OWNER'S DECISION 2026-09-22: the shoulderguard comes back from its OWN backup, where the build's reads a free variable", () => {
  // The build's restore is `whichcharacter.backup_shoulderguard` through
  // `GetVariable "whichcharacter"` (+0x8e50), which nothing assigns, so there
  // the shoulderguard becomes `undefined`. Here it is 1, like the other eight.
  const battle = stripped();
  cast(battle);
  assert.equal(valueOf(battle, "hero", "shoulderguard"), valueOf(battle, "hero", "backup_shoulderguard"));
  assert.equal(valueOf(battle, "hero", "shoulderguard"), 1);
});

test("the backups are READ, never written, and a piece never owned stays at 0", () => {
  const battle = stripped();
  const before = Object.fromEntries(BACKUPS.map((name) => [name, valueOf(battle, "hero", name)]));
  cast(battle);
  const after = Object.fromEntries(BACKUPS.map((name) => [name, valueOf(battle, "hero", name)]));
  assert.deepEqual(after, before);
  for (const piece of ["gauntlet", "breastplate", "greaves", "shinguard", "boot"]) {
    assert.equal(valueOf(battle, "hero", piece), 0, piece);
  }
});

/* The weaken-armour tape, every label a LITERAL (see `test/ss2-weaken-armour.test.js`). */
const direction = (round, value) => ({
  label: `weaken-armour-direction-${round}`, source: "randomNumber", min: 0, max: 8, value: value - 1
});
const selection = (round, groupSize, value) => ({
  label: `armour-selection-${round}`, source: "randomBetween", min: 1, max: groupSize, value
});
/** One `destroy_armour` call on a RIGHT-facing victim: `-30 + RandomNumber(20)`, so 0..19. */
const debris = (clip) => [
  { label: `armour-debris-${clip}-x`, source: "randomNumber", min: 0, max: 19, value: 3 },
  { label: `armour-debris-${clip}-y`, source: "randomNumber", min: 0, max: 19, value: 4 },
  { label: `armour-debris-${clip}-rotation`, source: "randomNumber", min: 0, max: 4, value: 1 }
];

test("THROUGH THE REAL `remove_armour`: stripped, rejuvenated, and a second removal takes the helmet's 20 AGAIN", () => {
  // The foe opens this time and carries two 44s. The hero wears helmet 2 (20),
  // shoulderguard 1 (8), breastplate 3 (48) and shield 1 (12): armour 88 of 88.
  const rngTape = [
    // Weaken 1: helmet (dir 1, pick 1), shoulderguard (dir 1, pick 2, paired: two
    // debris calls), then direction 3's group picks the shinguard the hero lacks.
    direction(1, 1), selection(1, 2, 1), ...debris(1),
    direction(2, 1), selection(2, 2, 2), ...debris(2), ...debris(3),
    direction(3, 3), selection(3, 3, 1),
    // The hero's rejuvenate draws nothing.
    // Weaken 2: the RESTORED helmet again, then two misses on the shinguard.
    direction(1, 1), selection(1, 2, 1), ...debris(1),
    direction(2, 3), selection(2, 3, 1),
    direction(3, 3), selection(3, 3, 1)
  ];
  const battle = createTeamBattle({
    seed: 3,
    rngTape,
    rules: ss2TeamRules,
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [ss2Combatant(
          fields({ inventory1: 43, helmet: 2, shoulderguard: 1, breastplate: 3, shield: 1 }),
          { id: "hero", name: "hero", controller: "local" }
        )]
      },
      {
        id: "blue",
        name: "blue",
        combatants: [ss2Combatant(
          fields({ speed: 21, gladiator_dir: "left", inventory1: 44, inventory2: 44 }),
          { id: "foe", name: "foe", controller: "local" }
        )]
      }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: -60, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: 60, y: 200 });
  const armour = () => [valueOf(battle, "hero", "armourclass"), valueOf(battle, "hero", "armourclass_max"),
    valueOf(battle, "hero", "helmet"), valueOf(battle, "hero", "shoulderguard")];
  assert.equal(currentCombatant(battle).id, "foe");
  assert.deepEqual(armour(), [88, 88, 2, 1]);

  applyAction(battle, { actorId: "foe", type: Ss2ActionType.CAST_WEAKEN_ARMOUR, targetId: "hero" });
  assert.deepEqual(armour(), [60, 60, 0, 0], "both pools lose 20 + 8, both pieces zeroed");

  cast(battle);
  assert.deepEqual(armour(), [60, 60, 2, 1], "pieces back; the class refills to the LOWERED 60 and no further");

  applyAction(battle, { actorId: "foe", type: Ss2ActionType.CAST_WEAKEN_ARMOUR, targetId: "hero" });
  assert.deepEqual(armour(), [40, 40, 0, 1],
    "the restored helmet's `_defence` is 20 again — `battlevalues` recomputes it from the id — so it costs 20 AGAIN");
});

/* ------------------------------------------------------------------ *
 * A restored piece is worth what its id says, however the gladiator  *
 * was built — `battlevalues` at the end of `nextphase`                *
 * ------------------------------------------------------------------ */

/**
 * A RESUMED gladiator, rebuilt mid-battle with `battleStarted` after its helmet
 * and shoulderguard were already knocked off. `battlevalues` runs its ungated
 * block over the record as it stands, so it derives `helmet_defence` and
 * `shoulderguard_defence` from ids of 0 — which is exactly what the build's own
 * `nextphase` had recomputed them to (+0x3480-+0x3633). Breastplate 2 (32) is
 * still on: armour 40 of 40.
 */
function resumed({ hero = {}, rngTape = null } = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rngTape,
    rules: ss2TeamRules,
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [ss2Combatant(
          fields({
            speed: 21, inventory1: 43, helmet: 0, shoulderguard: 0, breastplate: 2,
            backup_helmet: 2, backup_shoulderguard: 1, backup_breastplate: 2,
            hitpoints: 100, staminaleft: 100, armourclass: 40, armourclass_max: 40, ...hero
          }),
          { id: "hero", name: "hero", controller: "local", battleStarted: true }
        )]
      },
      {
        id: "blue",
        name: "blue",
        combatants: [ss2Combatant(
          fields({ gladiator_dir: "left", inventory1: 44 }),
          { id: "foe", name: "foe", controller: "local" }
        )]
      }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: -60, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: 60, y: 200 });
  assert.equal(currentCombatant(battle).id, "hero");
  return battle;
}

test("REGRESSION (Codex, reproduced): a resumed gladiator's restored helmet is worth 20 again, and a removal takes 20", () => {
  const battle = resumed({
    rngTape: [
      // The hero's rejuvenate draws nothing; the foe's weaken then takes the
      // helmet (dir 1, pick 1) and misses twice on the shinguard.
      direction(1, 1), selection(1, 2, 1), ...debris(1),
      direction(2, 3), selection(2, 3, 1),
      direction(3, 3), selection(3, 3, 1)
    ]
  });
  assert.equal(valueOf(battle, "hero", "helmet_defence"), 0, "derived from the knocked-off id, as the build had it");
  cast(battle);
  assert.equal(valueOf(battle, "hero", "helmet"), 2);
  assert.equal(valueOf(battle, "hero", "helmet_defence"), 20, "round(2 * helmet_dval 10), +0x34bf");
  assert.equal(valueOf(battle, "hero", "shoulderguard_defence"), 8, "round(1 * shoulderguard_dval 8), +0x356d");
  assert.deepEqual([valueOf(battle, "hero", "armourclass"), valueOf(battle, "hero", "armourclass_max")], [40, 40],
    "the maximum is NOT rebuilt from the new `_defence`: that block is gated on `battle_started` (+0x3a90)");
  applyAction(battle, { actorId: "foe", type: Ss2ActionType.CAST_WEAKEN_ARMOUR, targetId: "hero" });
  assert.equal(valueOf(battle, "hero", "helmet"), 0);
  assert.deepEqual([valueOf(battle, "hero", "armourclass"), valueOf(battle, "hero", "armourclass_max")], [20, 20],
    "the removal takes the restored helmet's 20 from both pools, where the stale 0 took nothing");
});

test("the rule is `battlevalues`' own: a helmet above id 25 is worth round(herolevel * 0.5 * 10), not id * 10", () => {
  // `+0x34a7`-`+0x34ba`: `helmet > 25` branches to `round(herolevel * 0.5 *
  // helmet_dval)` at `+0x34eb`. herolevel 5 -> 25, where id * 10 would be 300.
  const battle = resumed({ hero: { backup_helmet: 30 } });
  cast(battle);
  assert.equal(valueOf(battle, "hero", "helmet"), 30);
  assert.equal(valueOf(battle, "hero", "helmet_defence"), 25);
});

test("the `_defence` writes land AFTER all of `nextphase`'s own, in `battlevalues`' order", () => {
  // `nextphase` resets the psyche counter at `+0x35c7`-`+0x35ea` and THEN calls
  // `battlevalues(game_attacker)` at `+0x35f1`, which assigns breastplate
  // (+0x3480), helmet (+0x34bf), shinguard, greaves, shoulderguard (+0x356d),
  // gauntlet, boot, shield — so helmet before shoulderguard (the ARM restored
  // them the other way round), both after the reset. The breastplate's 32
  // already fits its id, so nothing is written for it.
  const battle = resumed({ hero: { psyche_up: 3 } });
  cast(battle);
  const tail = shapeOf(effectsOn(battle, "hero")).slice(-4);
  // 160 - round(7) + 1 + round(6 / 3) = 156, off the refilled bar.
  assert.deepEqual(tail, ["staminaleft=156", "psyche_up=1", "helmet_defence=20", "shoulderguard_defence=8"]);
});

/*
 * THE SHIELD, UNDER EACH WEAPON MODE. The rest of the build's rule is
 * `nextphase`'s `battlevalues` (`+0x35f1`), whose shield line reads the MODE:
 * `using_bow == true ? 0 : round(shield * 12)` (`+0x35e2`-`+0x35f2`, `+0x3623`,
 * `+0x35f7`). So a shield restored to an archer is worth 0 until it sheathes,
 * and the sheathing swap reprices it (`+0x4fab`).
 *
 * ~~NAMED CHOICE: `usingBow: false`, the shield's melee value, with the bow
 * zeroing left as `swap_weapons`' divergence.~~ Retired 2026-09-22 with that
 * divergence: `vanillaRecordOf` now zeroes the shield while `equipped_weapon`
 * is 2, so the bag holds the SHEATHED rating by design and the restore writes
 * exactly that. What these pin is what `remove_armour` then takes.
 *
 * The foe's weaken: direction 3 (lower group), selector 3 -> the shield;
 * rounds 2-3 find no shinguard.
 */
const SHIELD_TAPE = Object.freeze([
  direction(1, 3), selection(1, 3, 3), ...debris(1),
  direction(2, 3), selection(2, 3, 1),
  direction(3, 3), selection(3, 3, 1)
]);
/** A resumed archer, rebuilt mid-fight with the bow in hand: the state `battleStarted` exists to rebuild. */
const ARCHER = Object.freeze({
  backup_shield: 1, secondary_weapon: 61, ammo_left: 5, equipped_weapon: 2, using_bow: true
});
const weakenHero = (battle) =>
  applyAction(battle, { actorId: "foe", type: Ss2ActionType.CAST_WEAKEN_ARMOUR, targetId: "hero" });
const heroArmour = (battle) => [
  valueOf(battle, "hero", "armourclass"), valueOf(battle, "hero", "armourclass_max"), valueOf(battle, "hero", "shield")
];

test("a shield restored with the SWORD in hand is worth 12, and its next removal takes 12 from both pools", () => {
  const battle = resumed({ hero: { backup_shield: 1 }, rngTape: SHIELD_TAPE });
  cast(battle);
  assert.equal(valueOf(battle, "hero", "shield"), 1);
  assert.equal(valueOf(battle, "hero", "shield_defence"), 12, "round(1 * shield_dval 12), +0x35f7");
  assert.deepEqual(heroArmour(battle), [40, 40, 1]);
  weakenHero(battle);
  assert.equal(battle.rng.remainingCount, 0);
  assert.deepEqual(heroArmour(battle), [28, 28, 0]);
});

test("a shield restored with the BOW in hand is worth NOTHING while the bow stays drawn (+0x3623)", () => {
  // Arrows in the quiver, or the only offer would be the forced swap back.
  const battle = resumed({ hero: { ...ARCHER }, rngTape: SHIELD_TAPE });
  assert.equal(valueOf(battle, "hero", "equipped_weapon"), 2);
  assert.equal(offersOf(battle).length, 1, "the archer is offered the cast");
  cast(battle);
  assert.equal(valueOf(battle, "hero", "shield"), 1);
  weakenHero(battle);
  assert.equal(battle.rng.remainingCount, 0);
  assert.deepEqual(heroArmour(battle), [40, 40, 0], "the shield falls and neither pool moves");
});

test("...and once it SHEATHES, the restored shield is worth its 12 again (+0x4fab)", () => {
  const battle = resumed({ hero: { ...ARCHER }, rngTape: SHIELD_TAPE });
  cast(battle);
  // In reach, so the FORCED rest (2026-09-24; see `./ss2-rest-anywhere.js`).
  restAnywhere(battle, "foe");
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.SWAP_WEAPONS, targetId: "hero" });
  assert.equal(valueOf(battle, "hero", "equipped_weapon"), 1, "the sword is back in hand");
  weakenHero(battle);
  assert.equal(battle.rng.remainingCount, 0);
  assert.deepEqual(heroArmour(battle), [28, 28, 0]);
});

/* ------------------------------------------------------------------ *
 * The AI: ladder arm 1, FIRST in `villain_cast_spells`                *
 * ------------------------------------------------------------------ */

/** An AI hero at `health` with a foe in melee reach — the timed-buff test's staging. */
function aiHero({ health = 170, hero = {}, foe = {}, foeX = 120 } = {}) {
  const battle = staged({ controller: "ai", hero, foe, heroX: 0, foeX });
  combatantById(battle, "hero").health = health;
  return battle;
}
const choose = (battle) => suggestAction(battle, "hero");

test("arm 1: carrying 43 below max / 1.5, the AI rejuvenates", () => {
  assert.deepEqual(choose(aiHero({ health: 60, hero: { inventory1: 43 } })), { type: REJUVENATE, targetId: "hero" });
});

test("arm 1 is UNROUNDED: 113 of 170 is below 113.33 and casts, where a rounded 113 would not; 114 does not", () => {
  assert.equal(choose(aiHero({ health: 113, hero: { inventory1: 43 } })).type, REJUVENATE);
  assert.notEqual(choose(aiHero({ health: 114, hero: { inventory1: 43 } })).type, REJUVENATE);
  assert.notEqual(choose(aiHero({ health: 170, hero: { inventory1: 43 } })).type, REJUVENATE);
});

test("arm 1 is STRICT: at exactly 100 of 150 it does not rejuvenate, at 99 it does", () => {
  // `herolevel * 10 + vitality * 20` = 50 + 100 (battlevalues), and 150 / 1.5 is exactly 100.
  const at = (health) => {
    const battle = aiHero({ health, hero: { inventory1: 43, vitality: 5 } });
    assert.equal(combatantById(battle, "hero").maxHealth, 150);
    return choose(battle).type;
  };
  assert.notEqual(at(100), REJUVENATE);
  assert.equal(at(99), REJUVENATE);
});

test("arm 1 PRE-EMPTS a health potion (arm 2, the id-5 vial) when both qualify", () => {
  assert.deepEqual(choose(aiHero({ health: 60, hero: { inventory1: 5, inventory2: 43 } })), { type: REJUVENATE, targetId: "hero" });
  assert.deepEqual(choose(aiHero({ health: 60, hero: { inventory1: 5 } })),
    { type: Ss2ActionType.DRINK_POTION, targetId: "hero", itemId: 5 }, "the control: without 43 it drinks");
});

test("arm 1 PRE-EMPTS regenerate (arm 3) and every potion arm below half", () => {
  assert.equal(choose(aiHero({ health: 60, hero: { inventory1: 46, inventory2: 43 } })).type, REJUVENATE);
  for (const potion of [4, 3, 2]) {
    assert.equal(choose(aiHero({ health: 60, hero: { inventory1: potion, inventory2: 43 } })).type, REJUVENATE,
      `potion ${potion}`);
  }
});

test("arm 1 PRE-EMPTS molten death (arm 7, possession alone) — and above its threshold molten death fires", () => {
  assert.equal(choose(aiHero({ health: 100, hero: { inventory1: 49, inventory2: 43 } })).type, REJUVENATE);
  assert.equal(choose(aiHero({ health: 170, hero: { inventory1: 49, inventory2: 43 } })).type,
    Ss2ActionType.CAST_DEATH_FROM_ABOVE);
});

test("arm 1 PRE-EMPTS the damage spells (arms 14-18) and boundless energy (arm 23), which fire on possession", () => {
  assert.equal(choose(aiHero({ health: 100, hero: { inventory1: 35, inventory2: 43 } })).type, REJUVENATE);
  assert.equal(choose(aiHero({ health: 100, hero: { inventory1: 45, inventory2: 43 } })).type, REJUVENATE);
  assert.equal(choose(aiHero({ health: 170, hero: { inventory1: 45, inventory2: 43 } })).type,
    Ss2ActionType.CAST_BOUNDLESS_ENERGY, "above the threshold the ladder carries on");
});

test("a TIRED AI rejuvenates rather than rests: the ladder replaces the rest; at zero stamina only the forced rest is left", () => {
  const tired = aiHero({ health: 100, hero: { inventory1: 43 } });
  combatantById(tired, "hero").resources.staminaleft.value = 5;
  assert.equal(choose(tired).type, REJUVENATE);
  const spent = aiHero({ health: 100, hero: { inventory1: 43 } });
  combatantById(spent, "hero").resources.staminaleft.value = 0;
  assert.equal(choose(spent).type, Ss2ActionType.REST, "the zero-stamina floor offers nothing else");
});

/* ------------------------------------------------------------------ *
 * The presentation                                                    *
 * ------------------------------------------------------------------ */

test("a presented rejuvenate plays `Rejuvinate` on the caster, MAP_NAMED, and nothing on anybody else", () => {
  const battle = stripped();
  const constructed = applyCommands(emptyScene(), presentArenaConstruction(buildArenaLayout(toTeamWireState(battle))));
  cast(battle);
  const wire = toTeamWireState(battle);
  const { commands } = presentResolvedEvents(wire, { layout: buildArenaLayout(wire), bindings: SS2_STATIC_MAP_BINDINGS });
  const clips = commands.filter((command) => command.kind === CommandKind.CLIP_GOTO);
  assert.deepEqual(
    clips.map(({ combatantId, role, label, labelProvenance }) => ({ combatantId, role, label, labelProvenance })),
    [{ combatantId: "hero", role: "actor", label: "Rejuvinate", labelProvenance: LabelProvenance.MAP_NAMED }]
  );
  assert.deepEqual(commands.filter((command) => command.kind === CommandKind.UNMAPPED), []);
  assert.deepEqual(commands.filter((command) => command.kind === CommandKind.MOVE_CLIP), [], "nobody moves");
  assert.doesNotThrow(() => applyCommands(constructed, commands));
});

test("`Rejuvinate` resolves to a family that can DRAW it, for the build's own length", () => {
  // ~~KNOWN GAP, NOT BUILT HERE: `Rejuvinate` has no timeline family yet, so it
  // draws the `unknown` schedule~~ — this test's title until the family landed,
  // the same day as the verb. A verb is not a family (`unbuiltSpells` in
  // `src/render/clip-labels.js`); the pin was written so the day it was wired
  // this test would say so, and it did.
  //
  // ► **TWO SPELLINGS OF ONE LABEL, AND THE EVENT CARRIES THE BUILD'S CALL.**
  //   The arm passes `"Rejuvinate"` (`+0x8ded`); the fighter clip's `FrameLabel`
  //   is lowercase `rejuvinate` (frames 2169-2199). AVM1's label lookup ignores
  //   case, so the build reaches one with the other; `familyOf` matches the
  //   string the event carries, and the rig and the sound find the clip by the
  //   lower-cased label, as they find `Cast2` by `cast2`.
  const timeline = timelineFor("Rejuvinate", { role: "actor" });
  assert.equal(timeline.recognised, true, "Rejuvinate must not fall to the `unknown` schedule");
  assert.equal(timeline.family, "rejuvinate");
  assert.ok(clipLabelsFor(timeline.family).includes("rejuvinate"));
  // Frames 2169-2199 with the `struck = true; Stop` at 2199: 31 frames at
  // 30 fps is 1,033 ms = 8.61 beats of 120 ms, and the nearest beat is 9 =
  // 1,080 ms — the rule `Cast2`'s 21 -> 6 and `drink_potion`'s 24 -> 7 follow.
  assert.equal(timeline.durationMs, 1080);
  assert.equal(new Set(allUnmappedLabels()).has("rejuvinate"), false, "played now, so no longer declared unplayed");
});

/* ------------------------------------------------------------------ *
 * No golden can move                                                  *
 * ------------------------------------------------------------------ */

test("no promoted golden declares a backup or carries 43, built exactly as the replay builds it", async () => {
  // The MECHANISM behind the census (`tools/golden-hash-census.mjs`, 23/23
  // identical before and after this verb): a backup key is declared only by a
  // record that states one or by id 43 in a slot, and no golden side does
  // either, so no golden's projection gains a key and no hash can move.
  const dir = fileURLToPath(new URL("fixtures/ss2-1v1-golden/", import.meta.url));
  const files = (await readdir(dir)).filter((name) => name.endsWith(".json"));
  assert.ok(files.length >= 23, `the 23-golden corpus, or more; listed ${files.length}`);
  for (const file of files) {
    const text = await readFile(path.join(dir, file), "utf8");
    const golden = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
    for (const side of ["hero", "villain"]) {
      const record = golden.scenario[side];
      const built = ss2Combatant(
        { ...record, stamina: (record.staminamax - 100) / 10, speed: 0 },
        { id: side, name: side, controller: "local", derive: false }
      );
      assert.deepEqual(Object.keys(built.resources).filter((name) => name.startsWith("backup_")), [],
        `${file} ${side}`);
      const slots = Object.keys(built.resources).filter((name) => /^inventory[1-6]$/.test(name));
      assert.deepEqual(slots.filter((slot) => built.resources[slot] === 43), [], `${file} ${side}`);
    }
  }
});

