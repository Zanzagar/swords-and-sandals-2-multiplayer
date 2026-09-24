/**
 * RANGED COMBAT — the bow, the two shots, the bash, and the turn that arms it.
 *
 * WHY THIS FILE EXISTS AT ALL, rather than assertions scattered into the files
 * that already own each piece: **the ranged vocabulary was landed in one go
 * across the rule set, the adapter and the renderer, and a green suite is not
 * coverage.** The mutation audit of 2026-09-13 found two survivors in the
 * dressing path and neither was under-asserted — the code had simply never been
 * EXECUTED. Every branch added with the bow gets executed here, on purpose, by
 * a test that would fail if the branch were deleted.
 *
 * WHAT IS MEASURED AND WHAT IS AUTHORED, because the split is unusually clean
 * in this feature and it is the reason it could be built in a session:
 *
 * - **The build's, with offsets at each assertion**: the controller selector
 *   and its `100 + physical_size` floor, the four buttons each archer frame
 *   wires, the two shots' directions (21/22) and the bash's (23), all three
 *   stamina costs, the ammunition tiers and the decrement, the forced swap at
 *   zero ammo and where it sits in frame 1's chain, the swap's own cost and
 *   toggle, and every clip label — `bombard`, `snipe`, `Attack2`, `Block`.
 * - **AUTHORED, inside `MAP_SILENCE.multi-slot-arena-geometry`**: exactly one
 *   rule, `ss2ShotBlocked`. Vanilla has one gladiator a side, so there is never
 *   a body between two fighters and no bytecode anywhere tests for one. Owner's
 *   decision, 2026-09-13.
 * - **NARROWER THAN THE BUILD, and stated at the field**: `criticalhit` is
 *   per-combatant here and is a shared overlay transient there.
 *
 * THE ASSERTIONS PROVE, THEY DO NOT STATE: every sweep asserts it FOUND the
 * case it was sweeping for.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction,
  combatantById,
  createTeamBattle,
  currentCombatant,
  legalActions,
  suggestAction,
  rngJournal
} from "../src/team/index.js";
import { EffectKind, TeamRuleSetError } from "../src/team/rule-set.js";
import {
  ATTACK_DIRECTION_ROLL_LABEL,
  createSs2TeamRules,
  ss2ActiveDamagePair,
  ss2ArcherMinimumRange,
  ss2BattleValues,
  ss2Combatant,
  ss2FightDistance,
  ss2InBowMode,
  ss2MaximumAmmo,
  ss2PhysicalSize,
  ss2Reach,
  ss2ShotBlocked,
  ss2TeamRules,
  SS2_ARENA,
  SS2_PSYCHE_UP,
  SS2_RESOURCE_NAMES,
  Ss2ActionType,
  VANILLA_PHASE_LABEL
} from "../src/team/ss2-rules.js";
import { SS2_WEAPON_IDS, ss2WeaponEntry } from "../src/team/ss2-weapon-table.js";
import { LabelProvenance, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { chooseSound } from "../src/render/sound.js";
import { clipLabelsFor } from "../src/render/clip-labels.js";
import { restAnywhere } from "./ss2-rest-anywhere.js";

/* ------------------------------------------------------------------ */
/* Staging                                                             */
/* ------------------------------------------------------------------ */

/**
 * A gladiator with a resolvable primary weapon, so `weapon_range` is derived
 * and the melee gate is the build's rather than the bare-hands fallback.
 */
const gladiator = (overrides = {}) => ({
  strength: 9, speed: 20, attack: 9, defence: 5, vitality: 6, stamina: 6,
  magicka: 0, charisma: 3, herolevel: 5, character_level: 5,
  weapon: 1,
  ...overrides
});

/** The same, carrying a bow in the secondary slot but HOLDING the sword. */
const bowman = (overrides = {}) => gladiator({ secondary_weapon: 61, ...overrides });

/**
 * A battle with explicit positions on both sides, so every distance in this
 * file is one the test wrote rather than one a layout produced.
 *
 * `rankStride` is passed through because the line-of-sight rule is inert
 * without depth and two tests here turn it off deliberately.
 */
function staged({ red, blue, seed = 1, rankStride = SS2_ARENA.rankStride } = {}) {
  const place = (prefix, list) => ({
    id: prefix,
    name: prefix,
    combatants: list.map((entry, index) =>
      ss2Combatant(entry.fields, {
        id: entry.id ?? `${prefix}-${index + 1}`,
        name: entry.id ?? `${prefix}-${index + 1}`,
        controller: "local"
      })
    )
  });
  const battle = createTeamBattle({
    seed,
    rules: createSs2TeamRules({ rankStride }),
    teams: [place("red", red), place("blue", blue)]
  });
  // Positions are written AFTER construction, not staged through
  // `startingPosition`, because these tests are about what a gladiator can do
  // from a given spot and the layout is a different question with its own file.
  for (const [prefix, list] of [["red", red], ["blue", blue]]) {
    list.forEach((entry, index) => {
      const combatant = combatantById(battle, entry.id ?? `${prefix}-${index + 1}`);
      if (entry.x !== undefined) combatant.x = entry.x;
      if (entry.y !== undefined) combatant.y = entry.y;
    });
  }
  return battle;
}

const typesOf = (battle, actorId) => legalActions(battle, actorId).map((option) => option.type);
const MELEE = [Ss2ActionType.QUICK_ATTACK, Ss2ActionType.NORMAL_ATTACK, Ss2ActionType.POWER_ATTACK];

/**
 * Applies one named action for one actor, resting everybody else until it is
 * that actor's turn.
 *
 * **Rests rather than reaching past the initiative check**, because
 * `applyAction` refuses an out-of-turn action and it is right to: the turn
 * cursor is inside `combatStateHash`, so a test that bypassed it would be
 * measuring a battle no peer could reproduce. Every foe staged in this file
 * carries enough vitality to absorb the heal a rest hands it.
 *
 * ► **IN REACH THE REST IS THE FORCED ONE, since 2026-09-24**: neither
 *   close-range frame offers a voluntary rest (the owner's decision), so a
 *   gladiator staged inside reach passes its turn at zero stamina. See
 *   `./ss2-rest-anywhere.js`; nothing here reads a rester's stamina.
 */
function take(battle, actorId, type, targetId = actorId) {
  for (let guard = 0; guard < 8 && currentCombatant(battle)?.id !== actorId; guard += 1) {
    restAnywhere(battle, currentCombatant(battle).id);
  }
  assert.equal(currentCombatant(battle)?.id, actorId, "the turn cursor must have reached the actor under test");
  applyAction(battle, { actorId, type, targetId });
  return battle.lastResolution;
}

/* ------------------------------------------------------------------ */
/* Ammunition: the tier chain, byte-verified                            */
/* ------------------------------------------------------------------ */

test("maximum_ammo is tiered on herolevel, and the tests are the build's own Less2 boundaries", () => {
  // Re-read off the installed build 2026-09-13 (`77cb545c…`) with
  // `node tools/inspect-swf.mjs "$swf" --references maximum_ammo --around 6`.
  // Six arms, each a `Less2` that jumps past its own assignment:
  //   +0x364b  < 9  -> 5     +0x3714  < 35 -> 20
  //   +0x368e  < 23 -> 10    +0x3757  < 45 -> 25
  //   +0x36d1  < 28 -> 15    +0x3781  else -> 30
  //
  // **The BOUNDARIES are the point, not the values.** A transcription that read
  // the map's prose ("10 for levels 9-22") and wrote `<= 22` would agree with
  // this table everywhere except at 22 and 23 — which is exactly the kind of
  // off-by-one that survives a sweep over round numbers.
  for (const [level, expected] of [
    [1, 5], [8, 5],
    [9, 10], [22, 10],
    [23, 15], [27, 15],
    [28, 20], [34, 20],
    [35, 25], [44, 25],
    [45, 30], [99, 30]
  ]) {
    assert.equal(ss2MaximumAmmo(level), expected, `herolevel ${level}`);
  }

  // Every boundary must be a STEP, or the table above proves nothing about the
  // comparisons — a constant function would satisfy half of it.
  for (const boundary of [9, 23, 28, 35, 45]) {
    assert.notEqual(
      ss2MaximumAmmo(boundary),
      ss2MaximumAmmo(boundary - 1),
      `the tier must change AT ${boundary}, which is where the build's Less2 is`
    );
  }
});

test("battlevalues derives maximum_ammo unconditionally and refills ammo_left from it", () => {
  // The tier assignment is OUTSIDE the `battle_started` skip (`+0x3634` against
  // the skip's `+0x3a90`), so it runs on every call; the refill is INSIDE it.
  const fresh = ss2BattleValues({ strength: 9, herolevel: 30 });
  assert.equal(fresh.maximum_ammo, 20, "herolevel 30 is the < 35 arm");
  assert.equal(fresh.ammo_left, 20, "+0x3b45: !(ammo_left > 0) refills from maximum_ammo");

  // ► **THE REFILL READS THE DERIVED MAXIMUM, NOT THE STATED ONE.** A record
  //   carrying a stale `maximum_ammo` from an older save must be refilled to
  //   the number this herolevel earns, because the build recomputed it four
  //   hundred bytes earlier in the same call.
  const stale = ss2BattleValues({ strength: 9, herolevel: 30, maximum_ammo: 3 });
  assert.equal(stale.maximum_ammo, 20, "a stated maximum_ammo does NOT win: the build's write is unconditional");
  assert.equal(stale.ammo_left, 20);

  // A part-spent quiver is left alone: the test is `!(ammo_left > 0)`.
  const spent = ss2BattleValues({ strength: 9, herolevel: 30, ammo_left: 4 });
  assert.equal(spent.ammo_left, 4, "a quiver with arrows in it is not topped up");

  // `battle_started` skips the refill block entirely (`+0x3aa0` jumps 360 bytes).
  const midFight = ss2BattleValues({ strength: 9, herolevel: 30, ammo_left: 0 }, { battleStarted: true });
  assert.equal(midFight.maximum_ammo, 20, "the tier still runs: it is outside the skip");
  assert.equal(midFight.ammo_left, 0, "but the refill does not, so a bout cannot silently rearm a gladiator");
});

/* ------------------------------------------------------------------ */
/* The bow's own numbers, and the mode flag                             */
/* ------------------------------------------------------------------ */

test("a drawn bow swaps in the secondary pair, and its strength term is HALVED", () => {
  // `battlevalues` `+0x3424`-`+0x343d`: bow mode overwrites min/max_damage with
  // `secondary_min_damage`/`secondary_max_damage`, which carry
  // `round(strength * 1)` (`+0x33b6`, `+0x33e6`) where the melee pair carries
  // `round(strength * 2)` (`+0x3356`, `+0x3386`).
  const view = {
    stats: { strength: 9 },
    resources: {
      equipped_weapon: { value: 1 },
      min_damage: { value: 40 }, max_damage: { value: 50 },
      secondary_weapon_min_damage: { value: 4 }, secondary_weapon_max_damage: { value: 16 }
    }
  };
  assert.equal(ss2InBowMode(view), false);
  assert.deepEqual(ss2ActiveDamagePair(view), { min_damage: 40, max_damage: 50 });

  view.resources.equipped_weapon = { value: 2 };
  assert.equal(ss2InBowMode(view), true);
  assert.deepEqual(
    ss2ActiveDamagePair(view),
    { min_damage: 9 + 4, max_damage: 9 + 16 },
    "round(strength * 1) + the raw column, not round(strength * 2)"
  );

  // The whole point of the halved term, stated as an assertion rather than a
  // comment: the bow's RAW table damage is the biggest in the game and the
  // strength scaling is what pays for it.
  assert.ok(ss2WeaponEntry(80).maxDamage > ss2WeaponEntry(60).maxDamage,
    "the top ranged row out-damages the top melee row on the table");
});

test("reach follows the weapon in hand, and the MELEE reach is never destroyed", () => {
  // ► **THE ONE SHAPE DECISION THE WHOLE FEATURE TURNS ON.** The build
  //   overwrites `weapon_range` with `secondary_weapon_range` (`+0x343e`) and
  //   can afford to, because it recomputes both from the weapon ids on every
  //   `battlevalues` call. This engine discards equipment identity before the
  //   resolver ever sees a combatant, so an overwritten melee reach could never
  //   be rebuilt — the bag carries both and `ss2Reach` selects.
  const armed = ss2Combatant(bowman(), { id: "a" });
  const melee = armed.resources.weapon_range;
  const bow = armed.resources.secondary_weapon_range;
  assert.equal(melee, 86 + 1 * 44, "physical_size 86 + weapon 1's [5] of 1 * 44");
  assert.equal(bow, 86 + 100 * 44, "physical_size 86 + weapon 61's [5] of 100 * 44");

  const view = (slot) => ({
    stats: { strength: 9 },
    resources: {
      equipped_weapon: { value: slot },
      weapon_range: { value: melee },
      secondary_weapon_range: { value: bow }
    }
  });
  assert.equal(ss2Reach(view(1)), melee);
  assert.equal(ss2Reach(view(2)), bow, "the bow's reach, read at the moment it is asked for");
  assert.equal(ss2Reach(view(1)), melee, "and the melee reach is still there afterwards");
});

test("a RESTORED archer keeps its sword's numbers, and swapping back finds them intact", () => {
  // ► **THE REGRESSION TEST FOR A DEFECT `/codex:adversarial-review` FOUND IN
  //   `7310583`, and for the third instance of one mistake in one session.**
  //
  //   `battlevalues`'s bow block overwrites `min_damage`, `max_damage` and
  //   `weapon_range` in place. This engine's whole shape is that those three
  //   hold the MELEE numbers with the bow's beside them, so a record carrying
  //   `using_bow: true` — which `battleStarted: true` exists to rebuild, from a
  //   capture or a resumed campaign — poured the bow's numbers into the melee
  //   slots and **they never came back**. Swapping to melee then fought with
  //   bow damage and bow reach for the rest of the bout.
  //
  //   **The guard that should have caught it was keyed on
  //   `weapon_range > arena width`** — the exact criterion corrected two
  //   hundred lines earlier in the same session, with the exact same two
  //   exceptions. Bows 65 and 75 carry a range multiplier of 4, so their 262
  //   sails under it. Both are swept here.
  const sword = ss2Combatant(bowman(), { id: "sword" }).resources;
  assert.equal(sword.min_damage, 21, "round(9 * 2) + weapon 1's min of 3");
  assert.equal(sword.max_damage, 27);
  assert.equal(sword.weapon_range, 130);

  for (const bow of [61, 63, 65, 75, 80]) {
    const restored = ss2Combatant(
      {
        ...bowman({ secondary_weapon: bow }),
        equipped_weapon: 2, using_bow: true,
        hitpoints: 90, hitpointsmax: 100, staminamax: 150, staminaleft: 90,
        min_damage: 1, max_damage: 1
      },
      { id: "restored", battleStarted: true }
    ).resources;

    // The three melee fields are the SWORD's, whatever is in hand.
    assert.equal(restored.min_damage, sword.min_damage, `bow ${bow}: melee min_damage`);
    assert.equal(restored.max_damage, sword.max_damage, `bow ${bow}: melee max_damage`);
    assert.equal(restored.weapon_range, sword.weapon_range, `bow ${bow}: melee reach`);

    const view = (slot) => ({
      stats: { strength: 9 },
      resources: Object.fromEntries(
        Object.entries({ ...restored, equipped_weapon: slot }).map(([key, value]) => [key, { value }])
      )
    });
    // Drawn, it fights as the bow...
    const drawn = ss2ActiveDamagePair(view(2));
    assert.equal(drawn.min_damage, 9 + ss2WeaponEntry(bow).minDamage, `bow ${bow}: drawn min`);
    assert.equal(ss2Reach(view(2)), restored.secondary_weapon_range, `bow ${bow}: drawn reach`);
    // ...and sheathed, it is the swordsman it always was.
    assert.deepEqual(
      ss2ActiveDamagePair(view(1)),
      { min_damage: sword.min_damage, max_damage: sword.max_damage },
      `bow ${bow}: swapping back must find the sword's own damage`
    );
    assert.equal(ss2Reach(view(1)), sword.weapon_range, `bow ${bow}: and the sword's own reach`);
  }
});

test("the archer's minimum range is 100 + physical_size, and it is a FLOOR", () => {
  // Frame 4 `DoAction@0x238bbf` `+0x015f`:
  //   using_bow ? (fightdistance < 100 + physical_size
  //                  ? closerange_archer : longrange_archer)
  // `closerange_archer` is the frame that CANNOT shoot, so the comparison that
  // looks like the warrior's reach gate means the opposite of it.
  for (const strength of [0, 9, 30, 60]) {
    const actor = { stats: { strength } };
    assert.equal(ss2ArcherMinimumRange(actor), 100 + ss2PhysicalSize(actor), `strength ${strength}`);
  }
  assert.equal(ss2ArcherMinimumRange({ stats: { strength: 9 } }), 186);

  // ► **AND IT IS LONGER THAN MOST MELEE REACH, which is what makes it a real
  //   constraint rather than a formality.** At strength 9 a bare-handed
  //   gladiator reaches 130 and the widest melee row reaches 218 — so an archer
  //   is shut down well before most swords can touch it, and shut down AFTER
  //   the longest ones can.
  const size = ss2PhysicalSize({ stats: { strength: 9 } });
  const widest = Math.max(...SS2_WEAPON_IDS
    .filter((id) => id < 61)
    .map((id) => ss2WeaponEntry(id).rangeMultiplier));
  assert.equal(widest, 3);
  assert.ok(size + 1 * 44 < 186, "bare hands cannot reach an archer's floor");
  assert.ok(size + widest * 44 > 186, "the widest melee row can");
});

/* ------------------------------------------------------------------ */
/* Construction: what is refused, and what is no longer held by a guard  */
/* ------------------------------------------------------------------ */

test("a drawn bow with an EMPTY secondary slot is refused, and an armed one is not", () => {
  const foe = { fields: gladiator({ gladiator_dir: "left" }), id: "blue-1" };
  assert.throws(
    () => staged({ red: [{ fields: gladiator({ equipped_weapon: 2 }), id: "red-1" }], blue: [foe] }),
    (error) => error instanceof TeamRuleSetError && /no bow in the slot to draw/.test(error.message),
    "bow mode with nothing in the slot is the contradiction the build hides its own swap button for"
  );
  assert.doesNotThrow(
    () => staged({ red: [{ fields: bowman({ equipped_weapon: 2 }), id: "red-1" }], blue: [foe] }),
    "an archer that actually has a bow is a legal state, at construction as well as mid-fight"
  );
});

test("EVERY ranged row is offered ZERO melee verbs in bow mode, INCLUDING the two the old guard missed", () => {
  // ► **THE REGRESSION TEST FOR A HOLE THAT SURVIVED A GREEN SUITE.** Until
  //   2026-09-13 a drawn bow was refused at construction on the criterion
  //   `weapon_range > arena width`, reasoning that a type-4 row's `[5]` is 100
  //   so its reach is at least 4,480 against a 4,200-unit arena.
  //
  //   **Two of the twenty ranged rows carry `[5]` = 4, not 100** — ids 65 and
  //   75, item tables `:472` and `:482`. Their reach is `physical_size + 176`,
  //   about 262, comfortably inside the arena, so they walked straight past the
  //   guard. Measured before the fix: a strength-9 gladiator with
  //   `secondary_weapon: 65` and `equipped_weapon: 2` built a battle and was
  //   offered all three melee verbs at 262 units — a longer reach than any
  //   sword in the game, swung with a bow.
  //
  //   The guard was keyed on a CONSEQUENCE with an exception nobody had
  //   counted. The rule that replaces it is the VOCABULARY: neither archer
  //   frame wires a melee verb, whatever the reach says. This sweeps all twenty
  //   rows so a third exception cannot hide.
  const odd = SS2_WEAPON_IDS.filter((id) => id >= 61 && id <= 80 && ss2WeaponEntry(id).rangeMultiplier !== 100);
  assert.deepEqual(odd, [65, 75], "the two rows that break the [5] = 100 pattern; if this moves, re-read the table");

  let sawShort = false;
  for (const id of SS2_WEAPON_IDS.filter((weapon) => weapon >= 61 && weapon <= 80)) {
    const battle = staged({
      red: [{ fields: bowman({ speed: 60, secondary_weapon: id, equipped_weapon: 2 }), id: "red-1", x: -250, y: 200 }],
      blue: [{ fields: gladiator({ gladiator_dir: "left" }), id: "blue-1", x: 250, y: 200 }]
    });
    const reach = combatantById(battle, "red-1").resources.secondary_weapon_range.value;
    if (reach < SS2_ARENA.clamp.max - SS2_ARENA.clamp.min) sawShort = true;
    const types = typesOf(battle, "red-1");
    for (const verb of MELEE) {
      assert.ok(!types.includes(verb), `bow ${id} (reach ${reach}) must not be offered ${verb}`);
    }
  }
  assert.ok(sawShort, "the sweep must contain a bow whose reach fits inside the arena, or it proves nothing");
});

/* ------------------------------------------------------------------ */
/* The two archer controller frames                                     */
/* ------------------------------------------------------------------ */

test("longrange_archer wires two shots and BOTH walks; closerange_archer wires a bash and ONE", () => {
  // Map table `:227-230`. The archer rows, read as sets:
  //   longrange_archer  jumpleft, walkleft, taunt/rest, bombard, walkright, snipe, wincrowd, psyche_up
  //   closerange_archer jumpleft, walkleft, shove, jumpright, bash_attack, taunt, wincrowd, psyche_up
  // — so the close frame wires exactly one walk and it is the RETREAT, like
  // `closerange_warrior`, and the long frame wires both.
  //
  // `psyche_up` in both rows is the `onRelease` WIRING, and it is not a button
  // anybody can press: both frames hide that slot at every level (the test
  // after this one). Neither list below includes it, but for a weaker reason —
  // `bowman()` declares no counter — so it is pinned there, not here.
  const far = staged({
    red: [{ fields: bowman({ equipped_weapon: 2 }), id: "red-1", x: -250, y: 200 }],
    blue: [{ fields: gladiator({ gladiator_dir: "left" }), id: "blue-1", x: 250, y: 200 }]
  });
  const farTypes = typesOf(far, "red-1");
  assert.deepEqual(
    farTypes,
    [
      Ss2ActionType.BOMBARD, Ss2ActionType.SNIPE,
      Ss2ActionType.WALK_LEFT, Ss2ActionType.WALK_RIGHT,
      // Frame 20 shares one slot between taunt and rest on
      // `staminaleft / staminamax * 100 >= 50` (`+0x0c15`/`+0x110a`), and this
      // bowman is at full stamina.
      Ss2ActionType.TAUNT,
      // `wincrowd` joined 2026-09-23 — the row above already lists it: frame 20
      // wires it in both facings (`+0x0dd5`, `+0x12ec`) behind `herolevel < 3`
      // (`+0x0928`, `+0x0e1d`), and this bowman is level 5.
      Ss2ActionType.WINCROWD,
      Ss2ActionType.SWAP_WEAPONS, Ss2ActionType.REST
    ],
    "500 apart is beyond the floor of 186, so this is longrange_archer"
  );

  // Inside the floor. 100 units apart at strength 9 is well under 186.
  const near = staged({
    red: [{ fields: bowman({ equipped_weapon: 2 }), id: "red-1", x: -50, y: 200 }],
    blue: [{ fields: gladiator({ gladiator_dir: "left" }), id: "blue-1", x: 50, y: 200 }]
  });
  assert.equal(ss2FightDistance(combatantById(near, "red-1"), combatantById(near, "blue-1")), 100);
  assert.deepEqual(
    typesOf(near, "red-1"),
    [
      Ss2ActionType.BASH_ATTACK,
      // The retreat only: red stands left of blue, so backing off is LEFT.
      Ss2ActionType.WALK_LEFT,
      // `closerange_archer` wires the taunt too; the case below is the one
      // that shows it is NOT gated on stamina the way frames 5 and 20 are.
      Ss2ActionType.TAUNT,
      // And it wires `shove` (map `:229`-`:230`), which is why an archer that
      // has been closed on has something to do about it besides backing away.
      Ss2ActionType.SHOVE,
      // `wincrowd` joined 2026-09-23: frame 28 wires it too (`+0x0cf2`,
      // `+0x10fd`, gated `+0x0951`, `+0x0d3a`).
      Ss2ActionType.WINCROWD,
      // ► ~~`Ss2ActionType.REST`~~ — **left 2026-09-24, the owner's decision:
      //   frame 28 wires no rest in either facing** (the row above), so an
      //   archer closed on cannot rest either. The long frame's list above
      //   keeps it.
      Ss2ActionType.SWAP_WEAPONS
    ],
    "inside the floor an archer bashes and backs away; it cannot shoot, cannot advance, and cannot rest"
  );

  // ► **AND `closerange_archer` HAS NO STAMINA TEST AT ALL, which is the ONE
  //   frame that differs and the only case that can show it.** The map records
  //   it explicitly — frame 28 "always wires `taunt`" — where frames 5 and 20
  //   share the slot with `rest` on `staminaleft / staminamax * 100 >= 50` and
  //   frame 13 wires none. **Both fixtures above are at full stamina, so they
  //   cannot tell the two rules apart**; this one is at a tenth, where a gate
  //   written as ">= 50% everywhere" would drop the taunt and this frame keeps
  //   it.
  const tired = staged({
    red: [{ fields: bowman({ equipped_weapon: 2 }), id: "red-1", x: -50, y: 200 }],
    blue: [{ fields: gladiator({ gladiator_dir: "left" }), id: "blue-1", x: 50, y: 200 }]
  });
  const archer = combatantById(tired, "red-1");
  const max = archer.resources.staminamax.value ?? archer.resources.staminamax;
  archer.resources.staminaleft = { value: Math.floor(max * 0.1), min: 0, max: null };
  assert.ok(typesOf(tired, "red-1").includes(Ss2ActionType.TAUNT),
    "the close archer frame wires the taunt at ANY stamina, unlike frames 5 and 20");
});

test("A DRAWN BOW IS NEVER OFFERED psyche_up, at ANY herolevel — both archer frames hide the button outright", () => {
  // ► **THE PIN THE TEST ABOVE COULD NOT BE.** Its two `deepEqual`s exclude
  //   `psyche-up` only because `bowman()` declares no `psyche_up` counter, so
  //   they hold under the DECLARATION gate and say nothing about the LEVEL
  //   gate. This bowman declares the counter, so only the level/frame rule can
  //   keep the verb off the list.
  //
  // ► **THE BYTES (`sprite:862[overlay]`, re-read from the action dump
  //   2026-09-23).** Each archer frame has ONE `herolevel < 3` test per facing,
  //   `Push 3; Less2; Not; If` with delta 14, and each hide after it is 14
  //   bytes (`Push opt; GetVariable; Push "_visible", false; SetMember`). So
  //   the If skips ONE hide — Win the Crowd's — and the psyche hide after it
  //   runs unconditionally:
  //     frame 20 (base `0x23b171`)  right: If `+0x0938` -> `+0x094b`, optionH (psyche) hidden at `+0x094b`
  //                                 left:  If `+0x0e2d` -> `+0x0e40`, optionG (psyche) hidden at `+0x0e40`
  //     frame 28 (base `0x23c4fb`)  right: If `+0x0961` -> `+0x0974`, optionH (psyche) hidden at `+0x0974`
  //                                 left:  If `+0x0d4a` -> `+0x0d5d`, optionG (psyche) hidden at `+0x0d5d`
  //   Which slot is psyche is read off the onRelease handlers (frame 20
  //   `+0x0df7`/`+0x12ca`, frame 28 `+0x0d14`/`+0x10db`), and nothing anywhere
  //   in the build sets an option slot `_visible` again. The warrior frames
  //   (5 and 13) test `herolevel < 7` separately before their psyche hide, so
  //   the melee rule really is `>= 7`. Frame 4 sends `using_bow == true` to the
  //   archer frames (`+0x00b9`-`+0x00c7`).
  //
  //   The map used to read this as "a single test hides both slots", i.e. a
  //   bow-mode gate at `herolevel >= 3`, and this engine offered exactly that
  //   until 2026-09-23.
  const psycheBowman = (overrides) => bowman({ psyche_up: SS2_PSYCHE_UP.floor, ...overrides });
  const offersPsyche = (fields, { redX, blueX }) => {
    const battle = staged({
      red: [{ fields, id: "red-1", x: redX, y: 200 }],
      blue: [{ fields: gladiator({ gladiator_dir: redX < blueX ? "left" : "right" }), id: "blue-1", x: blueX, y: 200 }]
    });
    return typesOf(battle, "red-1").includes(Ss2ActionType.PSYCHE_UP);
  };
  const geometries = [
    // 500 apart: beyond the floor of 186, `longrange_archer` (frame 20).
    { frame: "frame 20, facing right", redX: -250, blueX: 250 },
    { frame: "frame 20, facing left", redX: 250, blueX: -250 },
    // 100 apart: inside it, `closerange_archer` (frame 28).
    { frame: "frame 28, facing right", redX: -50, blueX: 50 },
    { frame: "frame 28, facing left", redX: 50, blueX: -50 }
  ];
  for (const herolevel of [3, 7, 12]) {
    for (const geometry of geometries) {
      assert.equal(
        offersPsyche(psycheBowman({ herolevel, equipped_weapon: 2 }), geometry), false,
        `a drawn bow at herolevel ${herolevel} (${geometry.frame}) must not be offered psyche_up`
      );
    }
  }

  // ► **THE CONTROL: THE SAME GLADIATOR WITH THE SWORD DRAWN.** It declares the
  //   same counter, so the assertions above cannot be passing on the
  //   declaration gate; and the warrior gate is exactly 7.
  const toeToToe = { redX: -10, blueX: 10 };
  assert.equal(offersPsyche(psycheBowman({ herolevel: 6, equipped_weapon: 1 }), toeToToe), false,
    "herolevel 6 is below the warrior gate");
  for (const herolevel of [7, 12]) {
    assert.equal(offersPsyche(psycheBowman({ herolevel, equipped_weapon: 1 }), toeToToe), true,
      `the same gladiator holding the sword at herolevel ${herolevel} IS offered psyche_up`);
  }
});

test("the controller is chosen ONCE by the nearest foe, not per foe — which is the whole counterplay", () => {
  // ► **THE DESIGN DECISION THIS PINS, and the owner chose it on 2026-09-13:**
  //   closing on an archer must shut down its shooting. The build picks ONE
  //   controller frame per turn; with one opponent that is indistinguishable
  //   from deciding per-foe, and with three it is the difference between
  //   "closing on an archer works" and "closing on an archer is free".
  //
  //   A per-foe reading would let this archer bash the fighter on top of it AND
  //   shoot the one across the arena in the same turn.
  const battle = staged({
    red: [{ fields: bowman({ equipped_weapon: 2 }), id: "red-1", x: 0, y: 200 }],
    blue: [
      { fields: gladiator({ gladiator_dir: "left" }), id: "blue-1", x: 100, y: 200 },
      { fields: gladiator({ gladiator_dir: "left" }), id: "blue-2", x: 900, y: 200 }
    ]
  });
  const actor = combatantById(battle, "red-1");
  assert.equal(ss2FightDistance(actor, combatantById(battle, "blue-1")), 100, "inside the floor");
  assert.ok(ss2FightDistance(actor, combatantById(battle, "blue-2")) > 186, "and the other is beyond it");

  const options = legalActions(battle, "red-1");
  assert.ok(
    !options.some((option) => option.type === Ss2ActionType.BOMBARD || option.type === Ss2ActionType.SNIPE),
    "the near foe puts this archer on closerange_archer, so NOTHING may be shot this turn"
  );
  assert.deepEqual(
    options.filter((option) => option.type === Ss2ActionType.BASH_ATTACK).map((option) => option.targetId),
    ["blue-1"],
    "and only the foe actually inside the frame's own reach may be bashed"
  );
});

test("an out-of-ammo archer is FORCED to swap, and it outranks the forced rest", () => {
  // Frame 1's forced chain, map `:299-307`. Row 1 is
  // `ammo_left <= 0 && using_bow -> getphase("swap_weapons")` (`+0x0cce`); row
  // 2 is the zero-stamina rest (`+0x0d2e`). `getphase` sets `turnphase = 2`, so
  // the FIRST call that lands takes the turn and every later one is a no-op.
  const battle = staged({
    red: [{ fields: bowman({ equipped_weapon: 2 }), id: "red-1", x: -250, y: 200 }],
    blue: [{ fields: gladiator({ gladiator_dir: "left" }), id: "blue-1", x: 250, y: 200 }]
  });
  const actor = combatantById(battle, "red-1");
  assert.equal(actor.resources.ammo_left.value, 5, "herolevel 5 is the < 9 arm");

  actor.resources.ammo_left.value = 0;
  assert.deepEqual(
    typesOf(battle, "red-1"),
    [Ss2ActionType.SWAP_WEAPONS],
    "an empty quiver leaves exactly one action"
  );

  // ► **AND AT ZERO STAMINA TOO, which is the ordering that reads like a bug
  //   until you follow the `turnphase` gate.** The archer puts the bow away
  //   rather than resting, spending a stamina it does not have; the floor is
  //   `check_stats`'s (`+0x114b`).
  actor.resources.staminaleft.value = 0;
  assert.deepEqual(
    typesOf(battle, "red-1"),
    [Ss2ActionType.SWAP_WEAPONS],
    "row 1 of the forced chain outranks row 2"
  );

  // A MELEE gladiator at zero ammo is untouched: the build's row 1 tests
  // `using_bow` as well, so an empty quiver only matters to somebody holding a
  // bow.
  const swordsman = staged({
    red: [{ fields: gladiator(), id: "red-1", x: -30, y: 200 }],
    blue: [{ fields: gladiator({ gladiator_dir: "left" }), id: "blue-1", x: 30, y: 200 }]
  });
  assert.ok(typesOf(swordsman, "red-1").includes(Ss2ActionType.QUICK_ATTACK));
});

test("the swap is offered on EVERY frame, and only to a gladiator that owns a bow", () => {
  // No controller frame wires `swap_weapons`; the only manual route is the
  // battle inventory overlay (`sprite:862/frame:1/DoAction@0x2378cc` `+0x1015`,
  // body `+0x1067`), which is available whatever frame the controller rests on.
  const near = staged({
    red: [{ fields: bowman(), id: "red-1", x: -30, y: 200 }],
    blue: [{ fields: gladiator({ gladiator_dir: "left" }), id: "blue-1", x: 30, y: 200 }]
  });
  const types = typesOf(near, "red-1");
  assert.ok(types.includes(Ss2ActionType.QUICK_ATTACK), "this is closerange_warrior");
  assert.ok(types.includes(Ss2ActionType.SWAP_WEAPONS), "and the swap is still there");

  // The build hides its own swap button when there is no secondary weapon
  // (`+0x0e77`-`+0x0e96`); ~~here the test is a reach above zero, because
  // equipment identity does not survive into the resolver~~ — **corrected
  // 2026-09-23**: the id survives (a declared resource since 2026-09-14) and a
  // stated 0 is priced WITH a reach, so the engine asks both; see the next test.
  const empty = staged({
    red: [{ fields: gladiator(), id: "red-1", x: -30, y: 200 }],
    blue: [{ fields: gladiator({ gladiator_dir: "left" }), id: "blue-1", x: 30, y: 200 }]
  });
  assert.ok(
    !typesOf(empty, "red-1").includes(Ss2ActionType.SWAP_WEAPONS),
    "a gladiator with an empty secondary slot is never offered a weapon it does not have"
  );
});

test("a STATED secondary_weapon 0 is the build's own 'no second weapon': never offered the swap, and the AI never takes it", () => {
  // ► **THE BUILD ASKS `secondary_weapon == 0` EVERY TIME, AND NEVER ASKS THE
  //   REACH.** The hero's swap button is hidden on
  //   `(ammo_left <= 0 && secondary_weapon != 0) || secondary_weapon == 0`
  //   (`sprite:862/frame:1/DoAction@0x2378cc`, `Equals2` at `+0x0e5c` and
  //   `+0x0e89`, `_visible = false` at `+0x0e90`); the villain's swap roll needs
  //   `secondary_weapon != 0` (`DoAction@0x23f835` `+0x0f14`-`+0x0f27`); both
  //   character sheets print "no ranged weapon" on the same `== 0`.
  //
  //   `battlevalues` meanwhile prices the slot UNCONDITIONALLY off
  //   `_root["weapon" + secondary_weapon]` (`+0x323c`-`+0x3326`), so a 0 reads
  //   weapon row 0 and comes out with a reach. Every randomised gladiator
  //   starts at 0 (`randomise_gladiator` `+0x2be9`), and so do ten of the
  //   eighteen `unleash_hell` literals — so a reach above zero cannot be the
  //   test for owning a bow.
  const foe = (x) => ({ fields: gladiator({ gladiator_dir: "left" }), id: "blue-1", x, y: 200 });
  const far = staged({
    red: [{ fields: gladiator({ secondary_weapon: 0 }), id: "red-1", x: -250, y: 200 }],
    blue: [foe(250)]
  });
  const bag = combatantById(far, "red-1").resources;
  // The premise, measured rather than assumed: the slot IS priced. strength 9
  // -> physical_size 80 + round(9 / 1.5) = 86 (`+0x30f1`); weapon row 0's `[5]`
  // is 1, so 86 + 1 * 44 = 130 (`+0x32aa`). Reach alone cannot tell.
  assert.equal(bag.secondary_weapon.value, 0, "the id survives into the bag");
  assert.equal(bag.secondary_weapon_range.value, 130, "and battlevalues prices row 0 as a reach");

  assert.ok(
    !typesOf(far, "red-1").includes(Ss2ActionType.SWAP_WEAPONS),
    "longrange_warrior: no swap to a weapon the slot does not hold"
  );
  for (let guard = 0; guard < 4 && currentCombatant(far)?.id !== "red-1"; guard += 1) {
    const other = currentCombatant(far);
    applyAction(far, { actorId: other.id, type: Ss2ActionType.REST, targetId: other.id });
  }
  assert.equal(currentCombatant(far)?.id, "red-1");
  assert.notEqual(
    suggestAction(far, "red-1").type,
    Ss2ActionType.SWAP_WEAPONS,
    "nothing is in reach at 500 and it has arrows, which is exactly where the AI draws a real bow"
  );
  assert.throws(
    () => applyAction(far, { actorId: "red-1", type: Ss2ActionType.SWAP_WEAPONS, targetId: "red-1" }),
    /Illegal action/,
    "and a submitted swap is refused, not resolved"
  );

  const near = staged({
    red: [{ fields: gladiator({ secondary_weapon: 0 }), id: "red-1", x: -30, y: 200 }],
    blue: [foe(30)]
  });
  const nearTypes = typesOf(near, "red-1");
  assert.ok(nearTypes.includes(Ss2ActionType.QUICK_ATTACK), "this is closerange_warrior");
  assert.ok(!nearTypes.includes(Ss2ActionType.SWAP_WEAPONS), "closerange_warrior: no swap either");

  // The control: the SAME gladiator with a bow in the slot, at the same spot,
  // is offered the swap and the AI takes it. The id is the only difference.
  const armed = staged({
    red: [{ fields: bowman(), id: "red-1", x: -250, y: 200 }],
    blue: [foe(250)]
  });
  assert.ok(typesOf(armed, "red-1").includes(Ss2ActionType.SWAP_WEAPONS), "a real bow is still offered");
  for (let guard = 0; guard < 4 && currentCombatant(armed)?.id !== "red-1"; guard += 1) {
    const other = currentCombatant(armed);
    applyAction(armed, { actorId: other.id, type: Ss2ActionType.REST, targetId: other.id });
  }
  assert.equal(suggestAction(armed, "red-1").type, Ss2ActionType.SWAP_WEAPONS, "and the AI still draws it");
});

/* ------------------------------------------------------------------ */
/* Line of sight — the one AUTHORED rule in the feature                 */
/* ------------------------------------------------------------------ */

test("a body in the lane blocks the shot, and one that is merely nearby does not", () => {
  // AUTHORED, owner's decision 2026-09-13, inside
  // `MAP_SILENCE.multi-slot-arena-geometry`. Shaped after `ss2BodyBlocks`,
  // which gates the walk clamp on the blocker's own `physical_size` — so the
  // threshold here is the blocker's extent from the shot line, not a constant.
  const body = (id, x, y, strength = 9) => ({ id, x, y, alive: true, stats: { strength } });
  const archer = body("archer", -250, 103);
  const target = body("target", 250, 103);
  const size = ss2PhysicalSize(archer);
  assert.equal(size, 86);

  assert.equal(ss2ShotBlocked(archer, target, []), false, "an empty lane");
  assert.equal(ss2ShotBlocked(archer, target, [body("ally", 0, 103)]), true, "squarely in the way");
  assert.equal(
    ss2ShotBlocked(archer, target, [body("ally", 0, 103 + size - 1)]), true,
    "just inside its own extent blocks"
  );
  assert.equal(
    ss2ShotBlocked(archer, target, [body("ally", 0, 103 + size)]), false,
    "and exactly its own extent is clear — `<`, matching ss2BodyBlocks"
  );

  // ► **A RANK AWAY DOES NOT BLOCK AT THE SHIPPED STRIDE, and that is not a
  //   coincidence — it is what makes the front rank a screen rather than a
  //   wall.** 97 is bigger than `physical_size`, so your own front line does
  //   not stop you shooting along your rank; it only stops shots that actually
  //   cross it.
  assert.ok(SS2_ARENA.rankStride > size, "the shipped stride is wider than a body");
  assert.equal(ss2ShotBlocked(archer, target, [body("ally", 0, 103 + SS2_ARENA.rankStride)]), false);

  // Neither endpoint is ever its own blocker, and neither is anything outside
  // the segment. A rule using raw distance-to-LINE would fail all three.
  assert.equal(ss2ShotBlocked(archer, target, [target]), false, "the target does not block itself");
  assert.equal(ss2ShotBlocked(archer, target, [body("ally", -400, 103)]), false, "behind the archer");
  assert.equal(ss2ShotBlocked(archer, target, [body("ally", 400, 103)]), false, "beyond the target");
  assert.equal(
    ss2ShotBlocked(archer, target, [{ ...body("ally", 0, 103), alive: false }]), false,
    "a corpse is not cover"
  );

  // Diagonally, which is the case the second axis actually produces.
  const diagonal = ss2ShotBlocked(body("a", -250, 103), body("t", 250, 200), [body("b", 0, 151)]);
  assert.equal(diagonal, true, "a body on the midpoint of a cross-rank shot");
});

test("line of sight is INERT with the second axis off, so a 1-D arena is untouched", () => {
  // ► **STRUCTURAL, NOT TUNED.** At `rankStride` 0 every gladiator gets
  //   `y: null`, so every body stands on one line and a blocker's perpendicular
  //   distance is 0 — which would block EVERY shot in the game. The predicate
  //   returns false unless both ends model depth, so the axis being off removes
  //   the rule rather than making it always true.
  const flat = (id, x) => ({ id, x, y: null, alive: true, stats: { strength: 9 } });
  assert.equal(ss2ShotBlocked(flat("a", -250), flat("t", 250), [flat("b", 0)]), false);

  // ► **THE BODY IN THE MIDDLE IS A FOE, and after 2026-09-13 it has to be.**
  //   Only enemies screen, so staging this with an ALLY would pass whatever the
  //   axis were doing and prove nothing at all — the test would have gone quiet
  //   the moment the blocking rule changed, while still reading as a pin on it.
  //   With a foe there, the axis-off switch is the only thing that can keep
  //   this shot legal, which is exactly the claim.
  const battle = staged({
    rankStride: 0,
    red: [{ fields: bowman({ equipped_weapon: 2 }), id: "red-1", x: -250 }],
    blue: [
      { fields: gladiator({ gladiator_dir: "left" }), id: "blue-1", x: 250 },
      { fields: gladiator({ gladiator_dir: "left" }), id: "blue-2", x: 0 }
    ]
  });
  assert.equal(combatantById(battle, "red-1").y, null, "the axis really is off");
  const targets = legalActions(battle, "red-1")
    .filter((option) => option.type === Ss2ActionType.BOMBARD)
    .map((option) => option.targetId)
    .sort();
  assert.deepEqual(
    targets,
    ["blue-1", "blue-2"],
    "a foe standing directly between them cannot screen anybody in an arena with no depth"
  );
});

test("a BOMBARD goes over everything and a SNIPE needs a clean lane, ANY body", () => {
  // ► **THE OWNER'S DESIGN, 2026-09-13 — and it turned out to be DERIVABLE
  //   rather than a balance choice.** The two shots fly differently in vanilla:
  //   `_y -= Yvelocity` is inside a bombard-only test (`+0x72c7`), so a bombard
  //   arcs and a snipe holds one height the whole way. Measured off
  //   `src/render/projectile.js`, in FIGURE HEIGHTS where a gladiator is 1.0:
  //
  //   ```text
  //     snipe     0.674 flat                         chest height
  //     bombard   >= 1.055 everywhere a body could
  //               stand, at every range 200..4,000   over their heads
  //   ```
  //
  //   The bombard's low point is always at the LAUNCH end — it leaves at head
  //   height and climbs — and the only place it comes back down is the final
  //   approach onto the target, where nobody else can be standing. So a lobbed
  //   arrow passes over a body and a flat one does not, and the rule IS that
  //   fact.
  //
  // ► **AND THE SNIPE IS BLOCKED BY YOUR OWN SIDE, which reverses the earlier
  //   correction of the same day — deliberately, and only because bombard now
  //   covers the case that correction existed to fix.** The archer had ONE
  //   legal target because its own rank-0 ally screened it, so ally-blocking was
  //   dropped wholesale; the real fault was applying a flat shot's rule to a
  //   lobbed one.
  const withBodyAt = (id, team, y) => staged({
    red: [
      { fields: bowman({ equipped_weapon: 2 }), id: "red-1", x: -250, y: 103 },
      ...(team === "red" ? [{ fields: gladiator(), id, x: 0, y }] : [])
    ],
    blue: [
      { fields: gladiator({ gladiator_dir: "left" }), id: "blue-1", x: 250, y: 103 },
      ...(team === "blue" ? [{ fields: gladiator({ gladiator_dir: "left" }), id, x: 0, y }] : [])
    ]
  });
  const shotsAt = (battle, target) => {
    const offered = legalActions(battle, "red-1")
      .filter((option) => option.targetId === target)
      .map((option) => option.type);
    return {
      bombard: offered.includes(Ss2ActionType.BOMBARD),
      snipe: offered.includes(Ss2ActionType.SNIPE)
    };
  };

  // An ALLY squarely in the lane.
  const ally = withBodyAt("red-2", "red", 103);
  assert.deepEqual(
    shotsAt(ally, "blue-1"),
    { bombard: true, snipe: false },
    "the lob goes over your own man; the flat shot does not"
  );

  // A FOE on the identical spot — same geometry, same physical_size, other
  // colour. Both must behave the same, because an arrow at chest height does
  // not care whose chest it is.
  const foe = withBodyAt("blue-2", "blue", 103);
  assert.deepEqual(
    shotsAt(foe, "blue-1"),
    { bombard: true, snipe: false },
    "and a foe in the lane screens the one behind it from the flat shot only"
  );
  assert.deepEqual(
    shotsAt(foe, "blue-2"),
    { bombard: true, snipe: true },
    "while the screen itself is shootable both ways"
  );

  // ► **`ss2ShotBlocked` NEEDED NO NEW GEOMETRY FOR ANY OF THIS.** It is
  //   already a 2-D segment test over `(x, depth)`, so a cross-lane shot is
  //   handled by the same arithmetic; what changed is which bodies are handed
  //   to it. A body one rank clear of the lane blocks nothing.
  const clear = withBodyAt("red-2", "red", 200);
  assert.deepEqual(
    shotsAt(clear, "blue-1"),
    { bombard: true, snipe: true },
    "one rank over and the flat shot is back"
  );
});

test("the demo roster's archer can lob at EVERY lane and snipe only down a clear one", () => {
  // The shape the owner actually looks at, asserted rather than described.
  // Allies stagger diagonally, so at the opening the rank-0 ally sits just off
  // the rank-1 archer's diagonal to the enemy front, and the enemy's own rank-1
  // screens their rank-2.
  const battle = staged({
    red: [
      { fields: gladiator(), id: "red-1", x: -250, y: 200 },
      { fields: bowman({ equipped_weapon: 2 }), id: "red-2", x: -380, y: 103 },
      { fields: gladiator(), id: "red-3", x: -510, y: 6 }
    ],
    blue: [
      { fields: gladiator({ gladiator_dir: "left" }), id: "blue-1", x: 250, y: 200 },
      { fields: gladiator({ gladiator_dir: "left" }), id: "blue-2", x: 380, y: 103 },
      { fields: gladiator({ gladiator_dir: "left" }), id: "blue-3", x: 510, y: 6 }
    ]
  });
  const offered = (type) => legalActions(battle, "red-2")
    .filter((option) => option.type === type)
    .map((option) => option.targetId)
    .sort();

  assert.deepEqual(
    offered(Ss2ActionType.BOMBARD),
    ["blue-1", "blue-2", "blue-3"],
    "the lob reaches every enemy in every lane, which is the whole point of it"
  );
  assert.deepEqual(
    offered(Ss2ActionType.SNIPE),
    ["blue-2"],
    "the flat shot reaches only down its own lane: blue-1 is screened by red-1 and blue-3 by blue-2"
  );
});

/* ------------------------------------------------------------------ */
/* Resolving the three new attacks                                      */
/* ------------------------------------------------------------------ */

/** A staged archer already in bow mode with a foe beyond the floor. */
function archerBout({ seed = 3, distance = 500 } = {}) {
  return staged({
    seed,
    red: [{ fields: bowman({ equipped_weapon: 2 }), id: "red-1", x: -distance / 2, y: 200 }],
    blue: [{ fields: gladiator({ gladiator_dir: "left", vitality: 30 }), id: "blue-1", x: distance / 2, y: 200 }]
  });
}

test("the three new directions are CONSTANTS and take no sample off the ordered channel", () => {
  // ► **A TAPE-LENGTH FACT, NOT A STYLE CHOICE.** The three melee bands assign
  //   their direction with a `randomBetween` (`+0x608a`, `+0x61f1`, `+0x635c`);
  //   `bash_attack` and the two shots assign a literal with no RNG call in the
  //   branch at all (`+0x64c3`, `+0x6c67`, `+0x6c8c`). A `randomBetween(21, 21)`
  //   would give the same number and the wrong tape — every peer replaying it
  //   would fall one entry out of step from the first shot onward.
  //
  // **The JOURNAL is the evidence, not a sample count.** A count comparison
  // reads like the same claim and is not: a miss returns early and draws fewer
  // samples than a hit, so "the shot drew fewer than the swing" is a fact about
  // whichever seed was picked. The direction roll is a NAMED entry on the
  // ordered channel, so its absence is exact.
  const labelsFor = (battle) => rngJournal(battle).map((entry) => entry.label);

  for (const [type, direction] of [
    [Ss2ActionType.BOMBARD, 21],
    [Ss2ActionType.SNIPE, 22]
  ]) {
    const battle = archerBout();
    const resolution = take(battle, "red-1", type, "blue-1");
    assert.equal(resolution.events[0].attackDirection, direction, `${type} is direction ${direction}`);
    assert.ok(
      !labelsFor(battle).includes(ATTACK_DIRECTION_ROLL_LABEL),
      `${type} must take no direction sample: ${labelsFor(battle).join(", ")}`
    );
  }

  const bash = staged({
    red: [{ fields: bowman({ equipped_weapon: 2 }), id: "red-1", x: -50, y: 200 }],
    blue: [{ fields: gladiator({ gladiator_dir: "left", vitality: 30 }), id: "blue-1", x: 50, y: 200 }]
  });
  assert.equal(take(bash, "red-1", Ss2ActionType.BASH_ATTACK, "blue-1").events[0].attackDirection, 23);
  assert.ok(!labelsFor(bash).includes(ATTACK_DIRECTION_ROLL_LABEL), "and neither does the bash");

  // ► **AND THE CONTROL, without which this test asserts nothing.** A melee
  //   verb MUST take the sample, or "no direction roll" would be satisfied by a
  //   resolver that had stopped drawing one at all.
  const melee = staged({
    red: [{ fields: gladiator(), id: "red-1", x: -30, y: 200 }],
    blue: [{ fields: gladiator({ gladiator_dir: "left", vitality: 30 }), id: "blue-1", x: 30, y: 200 }]
  });
  take(melee, "red-1", Ss2ActionType.NORMAL_ATTACK, "blue-1");
  assert.ok(
    labelsFor(melee).includes(ATTACK_DIRECTION_ROLL_LABEL),
    "a normal attack still draws its direction — randomBetween(5, 8), +0x61f1"
  );
});

test("snipe is direction 22 with a flat min_damage and NO critical draw; bombard is 21 and rolls both", () => {
  // Dispatcher table (§"Attack roll dispatcher", rows 21 and 22, in
  // `docs/integration/ss2-battle-map.md`), and the
  // arms read out opcode by opcode at `+0x2e69` (21) and `+0x2ed6` (22):
  //   21  criticalhit = randomBetween(-20, 20); damage = randomBetween(min, max)
  //   22  criticalhit = 0;                      damage = min_damage
  const sniped = archerBout();
  const snipe = take(sniped, "red-1", Ss2ActionType.SNIPE, "blue-1").events[0];
  assert.equal(snipe.attackDirection, 22);

  const bombarded = archerBout();
  const bombard = take(bombarded, "red-1", Ss2ActionType.BOMBARD, "blue-1").events[0];
  assert.equal(bombard.attackDirection, 21);

  // Snipe's arm draws strictly fewer samples than bombard's: it takes neither
  // the critical nor the damage roll.
  assert.ok(
    sniped.rngCursor < bombarded.rngCursor,
    `snipe's tape must be shorter: ${sniped.rngCursor} vs ${bombarded.rngCursor}`
  );

  // Snipe is the ACCURATE one and bombard the heavy one — the build's own
  // factors, 0.90 against 0.60 (map §"Chance calculation").
  assert.ok(snipe.chance > bombard.chance, `snipe ${snipe.chance} must beat bombard ${bombard.chance}`);
});

test("a shot spends an arrow, and an empty quiver never goes negative", () => {
  // `+0x6bf5`-`+0x6c14`, and the decrement is UNGUARDED in the build: the map
  // records at §"The ammunition-visibility defect" that a harness driving
  // `getphase` directly can drive the counter negative, because the zero-ammo
  // branch assigns `visible` rather than `_visible` and never hides the button.
  // The forced auto-swap is what makes it unreachable in play.
  const battle = archerBout();
  const actor = () => combatantById(battle, "red-1");
  assert.equal(actor().resources.ammo_left.value, 5);

  const resolution = take(battle, "red-1", Ss2ActionType.BOMBARD, "blue-1");
  assert.equal(actor().resources.ammo_left.value, 4, "one arrow per shot");
  const write = resolution.effects.find((effect) => effect.resource === "ammo_left");
  assert.equal(write.kind, EffectKind.RESOURCE);
  assert.equal(write.targetId, "red-1", "the ATTACKER's arrow, not the target's");

  // ► **THE FLOOR IS TESTED THROUGH `resolveAction` DIRECTLY, AND THAT IS THE
  //   FINDING RATHER THAN A WORKAROUND: `legalActions` makes it unreachable.**
  //   An archer at zero ammo is handed the forced swap and nothing else, so no
  //   caller going through the resolver can ever submit a shot with an empty
  //   quiver. The build has the same structure and the same escape hatch — the
  //   map records at §"The ammunition-visibility defect" that a harness driving
  //   `getphase` directly reaches the unguarded decrement, because the buttons
  //   are never actually hidden. This is that harness.
  const empty = archerBout();
  const shooter = combatantById(empty, "red-1");
  shooter.resources.ammo_left.value = 0;
  assert.deepEqual(
    typesOf(empty, "red-1"),
    [Ss2ActionType.SWAP_WEAPONS],
    "the ordinary route cannot reach the decrement at all"
  );
  const forced = createSs2TeamRules().resolveAction(
    {
      type: Ss2ActionType.BOMBARD,
      actor: shooter,
      target: combatantById(empty, "blue-1"),
      targetId: "blue-1",
      turnNumber: 1,
      allies: [shooter],
      foes: [combatantById(empty, "blue-1")]
    },
    { randomBetween: (label, min) => min, randomNumber: () => 0 }
  );
  const floored = forced.effects.find((effect) => effect.resource === "ammo_left");
  assert.equal(floored.to, 0, "floored, because the resolver has no negative pool to represent");

  // A MELEE swing spends none, which is what `band.ranged` is for.
  const melee = staged({
    red: [{ fields: bowman(), id: "red-1", x: -30, y: 200 }],
    blue: [{ fields: gladiator({ gladiator_dir: "left", vitality: 30 }), id: "blue-1", x: 30, y: 200 }]
  });
  const before = combatantById(melee, "red-1").resources.ammo_left.value;
  take(melee, "red-1", Ss2ActionType.QUICK_ATTACK, "blue-1");
  assert.equal(combatantById(melee, "red-1").resources.ammo_left.value, before, "a sword takes no arrows");
});

test("criticalhit is written by EVERY attack including a miss, which is what bash inherits", () => {
  // `checkattackroll` assigns `criticalhit` at the top of each arm — `+0x2e7e`
  // for bombard, `+0x2eeb` for snipe — ahead of the damage term and therefore
  // ahead of the hit test. Direction 23 assigns nothing and reads whatever is
  // there, which the map records as a static candidate at §"Two
  // transient/boundary behaviors".
  assert.ok(SS2_RESOURCE_NAMES.includes("criticalhit"), "it is a declared resource, so it is hashed and replayed");

  // Snipe writes a flat 0, which is the build's own spelling for "no critical".
  const sniper = archerBout();
  take(sniper, "red-1", Ss2ActionType.SNIPE, "blue-1");
  assert.equal(combatantById(sniper, "red-1").resources.criticalhit.value, 0);

  // A MISS still writes it. Swept because whether a given seed misses is not
  // something to assume, and the sweep asserts it found one.
  let sawMiss = false;
  for (let seed = 1; seed <= 40 && !sawMiss; seed += 1) {
    const battle = archerBout({ seed });
    combatantById(battle, "red-1").resources.criticalhit.value = 7;
    const event = take(battle, "red-1", Ss2ActionType.BOMBARD, "blue-1").events[0];
    if (event.hit) continue;
    sawMiss = true;
    assert.notEqual(
      combatantById(battle, "red-1").resources.criticalhit.value,
      7,
      "a miss overwrites the transient, because the assignment is ahead of the hit test"
    );
  }
  assert.ok(sawMiss, "the sweep must contain a miss, or it proves nothing about the miss path");
});

test("bash_attack is direction 23, costs round(strength * 2), and inherits the transient", () => {
  // `+0x6463`: `staminacost = round(strength * 2)` at `+0x6475`,
  // `attack_direction = 23` at `+0x64c3`, then `gotoAndPlay("Attack2")`.
  const battle = staged({
    red: [{ fields: bowman({ equipped_weapon: 2 }), id: "red-1", x: -50, y: 200 }],
    blue: [{ fields: gladiator({ gladiator_dir: "left", vitality: 30 }), id: "blue-1", x: 50, y: 200 }]
  });
  combatantById(battle, "red-1").resources.criticalhit.value = 20;

  const event = take(battle, "red-1", Ss2ActionType.BASH_ATTACK, "blue-1").events[0];
  assert.equal(event.attackDirection, 23);

  // ► **AND THE INHERITANCE IS LOAD-BEARING: a critical BYPASSES ARMOUR.** The
  //   candidate's `effectiveMethod` of `critical` skips the armour branch
  //   outright, so a bash following your own critical lands in full on
  //   hitpoints. That is why the transient had to be carried rather than
  //   zeroed, and it is what the owner accepted the cost of on 2026-09-13.
  if (event.hit && !event.armourDestroyed.length) {
    assert.equal(
      event.dispatchedMethod,
      "critical",
      "a surviving 20 dispatches critical, which is the whole reason the transient is carried"
    );
  }

  // A gladiator that has never swung inherits the default 0 rather than
  // throwing, which is what the candidate refuses to guess at.
  const fresh = staged({
    red: [{ fields: bowman({ equipped_weapon: 2 }), id: "red-1", x: -50, y: 200 }],
    blue: [{ fields: gladiator({ gladiator_dir: "left", vitality: 30 }), id: "blue-1", x: 50, y: 200 }]
  });
  assert.doesNotThrow(() => take(fresh, "red-1", Ss2ActionType.BASH_ATTACK, "blue-1"));
});

test("the swap costs one stamina and a whole turn, and flips exactly one resource", () => {
  // `+0x4d35` sets `staminacost = 1`; `+0x4dbd`/`+0x4dce` and
  // `+0x4eba`/`+0x4ecb` are the toggle. It is a completed PHASE, so it goes
  // through `phaseTransitionEffects` and gets the regeneration and heal every
  // completed phase gets — which is why the net stamina change is positive.
  const battle = staged({
    red: [{ fields: bowman(), id: "red-1", x: -250, y: 200 }],
    blue: [{ fields: gladiator({ gladiator_dir: "left" }), id: "blue-1", x: 250, y: 200 }]
  });
  const actor = () => combatantById(battle, "red-1");
  assert.equal(actor().resources.equipped_weapon.value, 1, "root frame 221 starts everybody in melee mode");
  // Spent, so the phase transition has somewhere to put its regeneration and
  // the stamina write is actually emitted. At a full bar the clamp makes it a
  // no-op and `phaseTransitionEffects` correctly emits nothing — which is
  // behaviour worth not asserting around.
  const spent = actor().resources.staminaleft.value - 40;
  actor().resources.staminaleft.value = spent;

  const resolution = take(battle, "red-1", Ss2ActionType.SWAP_WEAPONS);
  assert.equal(actor().resources.equipped_weapon.value, 2, "the bow is drawn");
  assert.equal(resolution.events[0].drewBow, true);
  assert.equal(resolution.events[0].vanillaLabel, "swap_weapons");

  const written = resolution.effects
    .filter((effect) => effect.kind === EffectKind.RESOURCE)
    .map((effect) => effect.resource);
  assert.deepEqual(
    [...new Set(written)].sort(),
    ["equipped_weapon", "staminaleft"],
    "the mode and the phase's own stamina; the three derived numbers are selected at read time"
  );
  // `staminacost = 1` (`+0x4d35`), and it is a COMPLETED PHASE, so
  // `nextphase`'s `1 + round(stamina / 3)` still applies — a swap is net
  // positive on stamina and what it really costs is the turn.
  assert.equal(
    actor().resources.staminaleft.value,
    spent - 1 + 1 + Math.round(6 / 3),
    "spend one, then take the phase transition's own regeneration"
  );

  // Back again, and the melee reach and damage pair are exactly what they were.
  const bowReach = ss2Reach(actor());
  take(battle, "red-1", Ss2ActionType.SWAP_WEAPONS);
  assert.equal(actor().resources.equipped_weapon.value, 1, "and it toggles both ways");
  assert.ok(ss2Reach(actor()) < bowReach, "the melee reach is back, because it was never destroyed");
  assert.equal(ss2Reach(actor()), actor().resources.weapon_range.value);
});

test("a blow that knocks the shield off a gladiator HOLDING ITS BOW takes nothing from either pool", () => {
  // `battlevalues` zeroes `shield_defence` while `using_bow == true`
  // (`+0x35e2`-`+0x35f2`, `+0x3623`), in the swap arm itself (`+0x4ea1`) and
  // at every `nextphase`; `remove_armour` subtracts that field (`+0x0ca2`-
  // `+0x0ccd`); the pools are rebuilt only before the fight (`+0x3a90`). The
  // weaken-armour file pins the spell's road to `remove_armour`; this is the
  // ATTACK path's, and the tape is the one the attack draws, label for label:
  // direction 7 is the lower group, selector 3 is the shield.
  const tape = [
    { label: "attack-direction-roll", source: "randomBetween", min: 5, max: 8, value: 7 },
    { label: "hit-roll", source: "randomBetween", min: 1, max: 100, value: 70 },
    { label: "normal-damage-roll", source: "randomBetween", min: 21, max: 27, value: 23 },
    { label: "normal-critical-roll", source: "randomBetween", min: 1, max: 20, value: 20 },
    { label: "critical-deflection-roll", source: "randomBetween", min: 1, max: 100, value: 29 },
    { label: "armour-removal-roll", source: "randomBetween", min: 1, max: 100, value: 97 },
    { label: "armour-selection-1", source: "randomBetween", min: 1, max: 3, value: 3 },
    { label: "armour-debris-1-x", source: "randomNumber", min: 0, max: 29, value: 10 },
    { label: "armour-debris-1-y", source: "randomNumber", min: 0, max: 19, value: 14 },
    { label: "armour-debris-1-rotation", source: "randomNumber", min: 0, max: 4, value: 3 },
    { label: "knockback-roll", source: "randomBetween", min: 1, max: 4, value: 4 },
    { label: "enchantment-potency-roll", source: "randomBetween", min: 1, max: 100, value: 34 }
  ];
  const fight = (victimTurn) => {
    const battle = createTeamBattle({
      seed: 1,
      rngTape: tape,
      rules: ss2TeamRules,
      teams: [
        { id: "red", name: "red", combatants: [ss2Combatant(gladiator({ attack: 60, charisma: 6, magicka: 7 }), { id: "hero", name: "hero" })] },
        {
          id: "blue",
          name: "blue",
          combatants: [ss2Combatant(
            bowman({ speed: 21, gladiator_dir: "left", shield: 1, breastplate: 2, charisma: 6, magicka: 7 }),
            { id: "foe", name: "foe" }
          )]
        }
      ]
    });
    Object.assign(combatantById(battle, "hero"), { x: -60, y: 200 });
    Object.assign(combatantById(battle, "foe"), { x: 60, y: 200 });
    assert.equal(currentCombatant(battle).id, "foe", "the victim opens, so its own turn sets the mode");
    // In reach, so the control's rest is the FORCED one (2026-09-24; see
    // `./ss2-rest-anywhere.js`): the victim's own stamina, which nothing here reads.
    if (victimTurn === Ss2ActionType.REST) restAnywhere(battle, "foe");
    else applyAction(battle, { actorId: "foe", type: victimTurn, targetId: "foe" });
    applyAction(battle, { actorId: "hero", type: Ss2ActionType.NORMAL_ATTACK, targetId: "foe" });
    assert.equal(battle.rng.remainingCount, 0, "every scripted sample is consumed");
    const { resources } = combatantById(battle, "foe");
    return [resources.armourclass.value, resources.armourclass_max.value, resources.shield.value];
  };
  assert.deepEqual(fight(Ss2ActionType.SWAP_WEAPONS), [44, 44, 0], "drawn: the shield falls, worth 0");
  assert.deepEqual(fight(Ss2ActionType.REST), [32, 32, 0], "the control, sword in hand: worth round(1 * 12)");
});

test("the ranged shots cost round(strength * 3), one shared branch for all four labels", () => {
  // `+0x6bb5`, and the branch `+0x6b53`-`+0x6b9d` is entered by
  // `bombardright`, `bombardleft`, `sniperight` and `snipeleft` alike.
  // `fixtureReplay` keeps the build's own formula, which is what makes this
  // assertion the build's number and not the repriced one.
  const rules = createSs2TeamRules({ fixtureReplay: true });
  const battle = createTeamBattle({
    seed: 1,
    rules,
    teams: [
      { id: "red", combatants: [ss2Combatant(bowman({ equipped_weapon: 2 }), { id: "red-1" })] },
      { id: "blue", combatants: [ss2Combatant(gladiator({ gladiator_dir: "left", vitality: 30 }), { id: "blue-1" })] }
    ]
  });
  // `fixtureReplay` models no position, so the archer keeps the position-blind
  // vocabulary; the shots are submitted directly.
  for (const [type, factor] of [[Ss2ActionType.BOMBARD, 3], [Ss2ActionType.SNIPE, 3], [Ss2ActionType.BASH_ATTACK, 2]]) {
    const before = combatantById(battle, "red-1").resources.staminaleft.value;
    const event = take(battle, "red-1", type, "blue-1").events[0];
    if (event.staminaSpent === 0) continue;  // a killing blow costs nothing
    assert.equal(event.staminaSpent, Math.round(9 * factor), `${type} spends round(strength * ${factor})`);
    assert.ok(before > 0);
  }
});

/* ------------------------------------------------------------------ */
/* Presentation: the labels, every one of them the build's              */
/* ------------------------------------------------------------------ */

test("every ranged label is the build's own, and direction 23 is Attack2 rather than a number", () => {
  const actorFor = (event) => SS2_STATIC_MAP_BINDINGS.action(event).actor;

  assert.deepEqual(
    actorFor({ type: "bombard", attackDirection: 21, hit: true, dispatchedMethod: "normal" }),
    { label: "bombard", provenance: LabelProvenance.MAP_NAMED }
  );
  assert.deepEqual(
    actorFor({ type: "snipe", attackDirection: 22, hit: true, dispatchedMethod: "normal" }),
    { label: "snipe", provenance: LabelProvenance.MAP_NAMED }
  );

  // ► **THE ONE THAT WOULD HAVE BEEN WRONG, and it is the same failure the
  //   `hurt21`/`hurt22`/`hurt23` correction closed: a label invented by
  //   arithmetic on a direction number while the build names one outright a few
  //   bytes away.** `+0x64c3` sets the direction and `+0x64ce` is
  //   `gotoAndPlay("Attack2")`. The fall-through would have produced
  //   `attack23`, and the fighter clip carries `attack1`-`attack12` and nothing
  //   higher — so a bash would have found no animation and silently dropped to
  //   authored art.
  assert.deepEqual(
    actorFor({ type: "bash-attack", attackDirection: 23, hit: true, dispatchedMethod: "normal" }),
    { label: "attack2", provenance: LabelProvenance.MAP_NAMED }
  );
  assert.ok(clipLabelsFor("attack").includes("attack2"), "and it is a clip the pack actually has");
  assert.ok(!clipLabelsFor("attack").includes("attack23"), "which attack23 is not");

  // `swap_weapons` plays `Block` — `+0x4d65`, read off the build — and `Block`
  // carries no `StartSound`, so the swap is silent because the build binds no
  // sound to it rather than because anything here decided so.
  assert.deepEqual(
    actorFor({ type: "swap-weapons", targetId: "red-1", actorId: "red-1", vanillaLabel: "swap_weapons" }),
    { label: "Block", provenance: LabelProvenance.MAP_NAMED }
  );

  // The ranged band REUSES the melee hurt clips: `"hurt" + (direction - 20)`,
  // `+0x2093`-`+0x20d6`. A bombard hurts like a direction-1 melee hit.
  for (const [direction, label] of [[21, "hurt1"], [22, "hurt2"], [23, "hurt3"]]) {
    assert.equal(
      SS2_STATIC_MAP_BINDINGS.action({ attackDirection: direction, hit: true, dispatchedMethod: "normal" }).target.label,
      label
    );
  }
});

test("the SOUND follows the label, not the family — the defect ranged would have made audible", () => {
  // ► **THE SEVENTH INSTANCE OF THIS PROJECT'S SIGNATURE FAILURE, found
  //   2026-09-13 while wiring ranged, and it had been live since sound
  //   landed.** `animationFor` has always preferred the engine's own label over
  //   the family's first, with a comment explaining that drawing `attack1` for
  //   every attack throws away a choice the resolver already made.
  //   `chooseSound` had no such rule: it spread across every file bound to any
  //   label in the family, indexed by a counter. The figure played `attack3`
  //   while the speaker played whichever of the attack sounds the counter
  //   landed on.
  //
  //   Ranged is what made it undeniable rather than merely wrong: `bombard` and
  //   `snipe` share one family and have DIFFERENT sounds, so a snipe would have
  //   loosed a bombard the first time anyone drew a bow.
  const bindings = {
    bombard: ["1192.mp3"],
    snipe: ["1193.mp3"],
    attack1: ["1092.mp3"],
    attack2: ["1093.mp3"],
    attack3: ["1094.mp3"]
  };
  assert.deepEqual(clipLabelsFor("ranged"), ["bombard", "snipe"], "one family, two clips, two sounds");

  // Every sequence number, because the defect was a counter and a single
  // sample could have landed on the right file by luck.
  for (let sequence = 0; sequence < 8; sequence += 1) {
    assert.equal(chooseSound(bindings, "ranged", sequence, "snipe"), "1193.mp3", `snipe at ${sequence}`);
    assert.equal(chooseSound(bindings, "ranged", sequence, "bombard"), "1192.mp3", `bombard at ${sequence}`);
    assert.equal(chooseSound(bindings, "attack", sequence, "attack3"), "1094.mp3", `attack3 at ${sequence}`);
  }

  // Without a label the old spreading behaviour is intact, so nothing that
  // cannot name its clip lost its voice.
  const spread = new Set(
    Array.from({ length: 8 }, (unused, sequence) => chooseSound(bindings, "attack", sequence))
  );
  assert.ok(spread.size > 1, "a caller with no label still spreads across the family");

  // ► **A LABEL THE BUILD BINDS NO SOUND TO IS SILENT, and must not borrow
  //   one.** That is the `hurt8` correction: "the build plays no sound here"
  //   and "the animation does not exist" are different facts, and lending
  //   `hurt8` a noise from `hurt1` conflates them again.
  assert.equal(
    chooseSound({ hurt1: ["1103.mp3"] }, "hurt", 0, "hurt8"),
    null,
    "hurt8 draws and is silent; it does not borrow hurt1's sound"
  );

  // Membership is the guard, exactly as in `animationFor`: `taunt` is both an
  // attack label and a death variant, so a label outside the family is ignored.
  assert.equal(chooseSound(bindings, "ranged", 0, "attack1"), "1192.mp3",
    "a label that is not the family's falls back to the family bucket");
});

/* ------------------------------------------------------------------ */
/* End to end                                                          */
/* ------------------------------------------------------------------ */

test("an AI archer draws its bow, empties the quiver, and is forced back to melee", () => {
  // ► **THE ONE VOLUNTARY SWAP THE AI MAKES, and there is deliberately no swap
  //   BACK.** `closerange_archer` wires no swap button — the only route is the
  //   inventory overlay — so an archer that gets closed on bashes and retreats
  //   rather than drawing a sword. That is what gives closing on an archer its
  //   value, and it is also what keeps the arm from oscillating as the distance
  //   moves.
  const battle = staged({
    seed: 11,
    red: [{ fields: bowman({ speed: 30 }), id: "red-1", x: -250, y: 200 }],
    blue: [{ fields: gladiator({ gladiator_dir: "left", speed: 3, vitality: 40 }), id: "blue-1", x: 250, y: 200 }]
  });

  const seen = [];
  for (let step = 0; step < 200 && !battle.result; step += 1) {
    const actor = currentCombatant(battle);
    if (!actor) break;
    // Blue rests through the whole thing, so nothing here depends on how the
    // other side plays and the archer's own sequence is the only variable.
    if (actor.id !== "red-1") {
      applyAction(battle, { actorId: actor.id, type: Ss2ActionType.REST, targetId: actor.id });
      continue;
    }
    const chosen = suggestAction(battle, "red-1");
    seen.push(chosen.type);
    applyAction(battle, { actorId: "red-1", ...chosen });
    if (seen.filter((type) => type === Ss2ActionType.SWAP_WEAPONS).length >= 2) break;
  }

  assert.equal(seen[0], Ss2ActionType.SWAP_WEAPONS, "nothing is in reach at 500, so it arms rather than steps");
  assert.ok(seen.includes(Ss2ActionType.BOMBARD), `and then it shoots: ${seen.slice(0, 10).join(", ")}`);
  assert.equal(
    seen.filter((type) => type === Ss2ActionType.SWAP_WEAPONS).length,
    2,
    "exactly two swaps: one to arm, and the FORCED one when the quiver runs dry"
  );
  assert.equal(combatantById(battle, "red-1").resources.ammo_left.value, 0);
  assert.equal(
    seen.filter((type) => type === Ss2ActionType.BOMBARD || type === Ss2ActionType.SNIPE).length,
    5,
    "herolevel 5 buys five arrows and every one of them is spent"
  );
  assert.equal(
    combatantById(battle, "red-1").resources.equipped_weapon.value,
    1,
    "and the forced swap put the sword back in its hand"
  );
});

test("the AI snipes when snipe is BETTER, and the demo roster is simply too soft for it", () => {
  // ► **THIS CORRECTS A REPORT MADE THREE TIMES TODAY: that snipe "is never
  //   chosen by the AI" and that firing it needed a policy decision.** That was
  //   measured on the demo roster alone and generalised, which is the
  //   signature failure this project keeps finding in itself. The policy was
  //   already right.
  //
  //   **Snipe's chance is CLAMPED at 99** and bombard's is not, so against a
  //   soft target snipe wastes accuracy it cannot use while bombard's heavier
  //   damage term wins. As the foe's defence rises the clamp stops binding and
  //   the accurate shot overtakes the heavy one. Measured for the demo
  //   archer — strength 8, attack 8, bow 61, secondary pair 12-24:
  //
  //   ```text
  //     foe defence    bombard EV    snipe EV    chances
  //         5             13.14        11.88      73 / 99
  //        15              7.74         7.68      43 / 64
  //        20              6.30         6.36      35 / 53   <- snipe
  //   ```
  //
  //   **The demo roster's gladiators have defence 5.** So the AI lobbing every
  //   arrow in the arena is the policy working, not the policy failing.
  const archerVs = (defence) => {
    const battle = staged({
      seed: 5,
      red: [{ fields: bowman({ strength: 8, attack: 8, equipped_weapon: 2 }), id: "red-1", x: -300, y: 200 }],
      blue: [{
        fields: gladiator({ gladiator_dir: "left", speed: 3, attack: 3, defence, vitality: 40 }),
        id: "blue-1", x: 300, y: 200
      }]
    });
    return suggestAction(battle, "red-1").type;
  };

  assert.equal(archerVs(5), Ss2ActionType.BOMBARD, "against the demo roster's own defence, the lob wins");
  assert.equal(archerVs(20), Ss2ActionType.SNIPE, "and against a tough one the accurate shot does");

  // The crossover must be a real boundary, not a coincidence of one seed: the
  // choice has to be stable either side of it.
  assert.equal(archerVs(15), Ss2ActionType.BOMBARD);
  assert.equal(archerVs(25), Ss2ActionType.SNIPE);
});

test("VANILLA_PHASE_LABEL names a real getphase label for all four new verbs", () => {
  assert.equal(VANILLA_PHASE_LABEL[Ss2ActionType.BOMBARD], "bombard");
  assert.equal(VANILLA_PHASE_LABEL[Ss2ActionType.SNIPE], "snipe");
  assert.equal(VANILLA_PHASE_LABEL[Ss2ActionType.BASH_ATTACK], "bash_attack");
  assert.equal(VANILLA_PHASE_LABEL[Ss2ActionType.SWAP_WEAPONS], "swap_weapons");

  // ► **THE TWO SHOTS CARRY THE UNHANDED SPELLING, WHICH IS THE DERIVATION AND
  //   NOT A SIMPLIFICATION.** The build has four phase labels —
  //   `bombardleft/right`, `snipeleft/right` — and all four reach ONE branch
  //   which plays `gotoAndPlay("bombard")` or `("snipe")`. This table feeds
  //   `clip-labels.js`, and the fighter clip has no handed variant of either.
  for (const label of ["bombard", "snipe"]) {
    assert.ok(clipLabelsFor("ranged").includes(label), `${label} must be a clip the pack has`);
    assert.ok(!clipLabelsFor("ranged").includes(`${label}left`), "and no handed variant exists to name");
  }
});
