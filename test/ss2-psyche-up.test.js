/**
 * `psyche_up` — the counter, the three clips, the range gate and the discharge.
 *
 * WHY THIS FILE EXISTS: the same reason `ss2-ranged.test.js` does. The verb was
 * landed in one go across the rule set, the adapter and the renderer, and **a
 * green suite is not coverage**. Every branch added with it is executed here on
 * purpose, by assertions that fail if the branch is deleted.
 *
 * WHAT IS THE BUILD'S AND WHAT IS THIS ENGINE'S, because the split decides
 * which assertions may ever be relaxed:
 *
 * - **The build's, with offsets at each assertion**: the three clips and the
 *   counter values that select them (`+0x658a`, `+0x65b9`, `+0x65ef`), the
 *   discharge at 3, `attack_direction` 30 with no draw, the stamina cost
 *   `round(strength)` (`+0x653f`), the range gate against
 *   `weapon_range + 50` (`+0x6658`-`+0x6699`), the reset on any other decision
 *   (`nextphase` `+0x35c7`-`+0x35ea`), and the counter floor of 1.
 * - **This engine's**: that the clip travels on the event rather than being
 *   re-derived downstream, and that the verb is offered out of reach.
 *
 * ► **ONE THING HERE IS A CANDIDATE AND NOT A DERIVATION, AND IT IS MARKED AT
 *   ITS OWN TEST**: where the counter lands after a discharge. The map records
 *   a STATIC candidate — `+0x6738` writes it back to 1 and `+0x6761` adds one
 *   in a later tick of the same phase, so it lands on 2 — and says a runtime
 *   capture would settle it. Settling it needs `-TraceWindow phase`, because
 *   the ordinary recording window closes on `checkattackroll`'s return and both
 *   writes happen after it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { EffectKind } from "../src/team/rule-set.js";
import {
  applyAction,
  combatantById,
  createTeamBattle,
  currentCombatant,
  legalActions,
  rngJournal
} from "../src/team/index.js";
import {
  createSs2TeamRules,
  ss2Combatant,
  ss2Reach,
  SS2_ARENA,
  SS2_PSYCHE_UP,
  SS2_RESOURCE_DEFAULTS,
  SS2_RESOURCE_NAMES,
  Ss2ActionType,
  VANILLA_PHASE_LABEL
} from "../src/team/ss2-rules.js";
import { LabelProvenance, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { clipLabelsFor } from "../src/render/clip-labels.js";
import { clipSequenceFor } from "../src/render/clip-sequences.js";
import { animationFor, figurePackFrom } from "../src/render/extracted-figure.js";
import { timelineFor } from "../src/render/index.js";

/**
 * The extracted pack, or null on a machine that has not run the extractor.
 *
 * Gated rather than required, like every other pack-bearing test here: a fresh
 * clone has no `assets/` at all and must still run the suite green.
 */
const REAL_PACK = (() => {
  try {
    const read = (name) => JSON.parse(
      readFileSync(new URL(`../assets/figure/${name}.json`, import.meta.url), "utf8")
    );
    return figurePackFrom(read("shapes"), read("animations"));
  } catch {
    return null;
  }
})();

/** Level 9, so the warrior frame's `herolevel >= 7` gate is open. */
const gladiator = (overrides = {}) => ({
  strength: 9, speed: 20, attack: 9, defence: 5, vitality: 20, stamina: 12,
  magicka: 0, charisma: 3, herolevel: 9, character_level: 9,
  weapon: 1,
  // ► **STATED, BECAUSE THERE IS NO DEFAULT.** `psyche_up` is deliberately
  //   absent from `SS2_RESOURCE_DEFAULTS` so that adding it moved no golden
  //   hash; the consequence is that a combatant carries the counter only when
  //   its record states one. The build's own floor is 1.
  psyche_up: SS2_PSYCHE_UP.floor,
  ...overrides
});

function staged({ red, blue, seed = 1 }) {
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
    rules: createSs2TeamRules({ rankStride: SS2_ARENA.rankStride }),
    teams: [place("red", red), place("blue", blue)]
  });
  for (const [prefix, list] of [["red", red], ["blue", blue]]) {
    list.forEach((entry, index) => {
      const combatant = combatantById(battle, entry.id ?? `${prefix}-${index + 1}`);
      if (entry.x !== undefined) combatant.x = entry.x;
      if (entry.y !== undefined) combatant.y = entry.y;
    });
  }
  return battle;
}

/** Two gladiators toe to toe, so the discharge's range gate is open. */
function duel({ seed = 1, gap = 20, hero = {}, villain = {} } = {}) {
  return staged({
    seed,
    red: [{ id: "hero", fields: gladiator(hero), x: 0, y: 0 }],
    blue: [{ id: "villain", fields: gladiator(villain), x: gap, y: 0 }]
  });
}

function take(battle, actorId, type, targetId = actorId) {
  for (let guard = 0; guard < 8 && currentCombatant(battle)?.id !== actorId; guard += 1) {
    const other = currentCombatant(battle);
    applyAction(battle, { actorId: other.id, type: Ss2ActionType.REST, targetId: other.id });
  }
  assert.equal(currentCombatant(battle)?.id, actorId, "the turn cursor must have reached the actor under test");
  applyAction(battle, { actorId, type, targetId });
  return battle.lastResolution;
}

/**
 * On a live battle a resource is `{value, min, max}` rather than a bare number —
 * it is a POOL with bounds, which is what lets the resolver clamp one. Unwrapped
 * here so every assertion below reads the number it means.
 */
function counterOf(battle, id) {
  const entry = combatantById(battle, id).resources.psyche_up;
  return typeof entry === "object" && entry !== null ? entry.value : entry;
}
const psycheEvent = (resolution) =>
  resolution.events.find((event) => event.type === Ss2ActionType.PSYCHE_UP);

/* ------------------------------------------------------------------ *
 * THE VOCABULARY
 * ------------------------------------------------------------------ */

test("the counter has NO default, which is what kept every golden hash still", () => {
  assert.ok(SS2_RESOURCE_NAMES.includes("psyche_up"), "the counter must be a declared resource");
  assert.equal(Object.hasOwn(SS2_RESOURCE_DEFAULTS, "psyche_up"), false,
    "a default would fill the counter into every golden's combatant and move all 23 replay hashes");
});

test("the floor is 1 and not 0, because both of the build's resets write 1", () => {
  // `nextphase` `+0x35c7`-`+0x35ea` on any decision that is not `psyche_up`,
  // and `damagecharacter` `+0x1be4` to the defender. What the build holds
  // BEFORE the first write is a map silence; this models the reset.
  assert.equal(SS2_PSYCHE_UP.floor, 1);
  assert.equal(SS2_PSYCHE_UP.dischargeAt, 3);
  assert.deepEqual([...SS2_PSYCHE_UP.clips], ["psyche_up", "psyche_up2", "psyche_up3"]);
  assert.equal(VANILLA_PHASE_LABEL[Ss2ActionType.PSYCHE_UP], "psyche_up");
});

/* ------------------------------------------------------------------ *
 * WHAT IS OFFERED
 * ------------------------------------------------------------------ */

test("the verb is offered on a melee frame at herolevel 7 and refused below it", () => {
  // Map `:247` and the controller frame table: the BUTTON is hidden below
  // `herolevel` 7 on the warrior frames. The phase machine itself never
  // consults the frame, so this gates the OFFER and not the phase.
  const open = duel({ hero: { herolevel: 7 } });
  assert.ok(legalActions(open, "hero").some((option) => option.type === Ss2ActionType.PSYCHE_UP),
    "herolevel 7 is the warrior gate and must open it");

  const shut = duel({ hero: { herolevel: 6 } });
  assert.equal(legalActions(shut, "hero").some((option) => option.type === Ss2ActionType.PSYCHE_UP), false,
    "herolevel 6 is below the warrior gate");
});

test("a combatant that never stated the counter is not offered the verb", () => {
  // ► **THE ASSERTION THAT COULD HAVE VARIED, and the reason the offer is
  //   gated on declaration at all.** Without a default the resource write is
  //   skipped for such a combatant, so the button would advance nothing: a verb
  //   whose whole effect is a number it cannot hold.
  const battle = staged({
    red: [{ id: "hero", fields: (() => { const f = gladiator(); delete f.psyche_up; return f; })(), x: 0 }],
    blue: [{ id: "villain", fields: gladiator(), x: 20 }]
  });
  assert.equal(counterOf(battle, "hero"), undefined,
    "this fixture exists to have no counter; if it grew one the test proves nothing");
  assert.equal(legalActions(battle, "hero").some((option) => option.type === Ss2ActionType.PSYCHE_UP), false);
});

test("it is offered OUT of reach too, because charging has no range test", () => {
  // Only the DISCHARGING press gates on range, and it resolves its own gate.
  // Hiding the verb at distance would stop a gladiator charging while he closes.
  const far = duel({ gap: 4000 });
  const offered = legalActions(far, "hero");
  assert.ok(offered.some((option) => option.type === Ss2ActionType.PSYCHE_UP),
    "a distant gladiator may still start charging");
  assert.equal(offered.some((option) => option.type === Ss2ActionType.NORMAL_ATTACK), false,
    "the control: an ordinary attack IS hidden at this distance, so the offer above is not a blanket one");
});

/* ------------------------------------------------------------------ *
 * THE THREE PRESSES
 * ------------------------------------------------------------------ */

test("three presses walk the counter 1 -> 2 -> 3 and name a different clip each time", () => {
  const battle = duel();
  assert.equal(counterOf(battle, "hero"), 1, "a fresh gladiator is at the floor");

  const first = psycheEvent(take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain"));
  assert.equal(first.clip, "psyche_up", "counter 1 selects psyche_up (+0x658a)");
  assert.equal(first.discharged, false);
  assert.equal(counterOf(battle, "hero"), 2);

  const second = psycheEvent(take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain"));
  assert.equal(second.clip, "psyche_up2", "counter 2 selects psyche_up2 (+0x65b9)");
  assert.equal(second.discharged, false);
  assert.equal(counterOf(battle, "hero"), 3);

  const third = psycheEvent(take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain"));
  assert.equal(third.clip, "psyche_up3", "counter 3 selects psyche_up3 (+0x65ef)");
  assert.equal(third.discharged, true, "the third press is the one that swings");
});

test("A CHARGING PRESS DRAWS NOTHING, which is why psyche_up is not an ATTACK_BAND", () => {
  // ► **THE SHARPEST ASSERTION IN THIS FILE.** `ATTACK_BANDS` membership means
  //   "always attacks", and an attack's first act is to put its direction on
  //   the ordered channel. Two of this verb's three presses take no sample at
  //   all, so a band entry would desynchronise every peer replaying the same
  //   tape from the first charge onward.
  const battle = duel();
  const before = rngJournal(battle).length;
  take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain");
  assert.equal(rngJournal(battle).length, before,
    "a charging press took a sample off the ordered channel that the build never takes");

  // The control: an ordinary attack from the same position DOES draw, so the
  // assertion above is measuring a real difference rather than a quiet battle.
  const attacking = duel({ seed: 2 });
  const drawnBefore = rngJournal(attacking).length;
  take(attacking, "hero", Ss2ActionType.NORMAL_ATTACK, "villain");
  assert.ok(rngJournal(attacking).length > drawnBefore, "an ordinary attack must draw");
});

test("the charge costs round(strength) in stamina, which is a COST and not a damage", () => {
  // `+0x653f`. It sits in the map's staminacost-by-phase table beside
  // `power_attack round(strength * 3)` and `rest 0 - round(stamina * 15)` — a
  // table whose `rest` row is negative can only be a cost table. Reading that
  // row as damage is a mistake this project published once.
  const battle = duel({ hero: { strength: 9 } });
  const poolOf = (id, name) => {
    const entry = combatantById(battle, id).resources[name];
    return typeof entry === "object" && entry !== null ? entry.value : entry;
  };
  const before = poolOf("hero", "staminaleft");
  const event = psycheEvent(take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain"));
  const after = poolOf("hero", "staminaleft");
  // A completed phase also regenerates, so the cost is recovered from the net
  // rather than asserted as the whole movement.
  assert.equal(after - before, event.staminaGained,
    "the event's own staminaGained must describe the move the resources made");
  assert.ok(Number.isFinite(event.staminaGained));
});

/* ------------------------------------------------------------------ *
 * THE RESET
 * ------------------------------------------------------------------ */

test("ANY other decision resets the counter, so a charge cannot be banked", () => {
  // `nextphase` writes `game_attacker.psyche_up = 1` whenever
  // `phase_decision != "psyche_up"` (`+0x35c7`-`+0x35ea`).
  const battle = duel();
  take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain");
  assert.equal(counterOf(battle, "hero"), 2, "the charge must have landed before the reset is meaningful");
  take(battle, "hero", Ss2ActionType.REST, "hero");
  assert.equal(counterOf(battle, "hero"), SS2_PSYCHE_UP.floor,
    "resting between charges banked the charge, which the build does not allow");
});

test("a psyche press does NOT reset its own counter, which is the other half of the rule", () => {
  // The reset fires only when the decision is something else. Without this
  // exemption the counter would be written back to 1 by the same phase
  // transition that just advanced it, and no chain could ever reach 3.
  const battle = duel();
  take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain");
  take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain");
  assert.equal(counterOf(battle, "hero"), 3, "two consecutive presses must reach 3");
});

/* ------------------------------------------------------------------ *
 * THE RANGE GATE
 * ------------------------------------------------------------------ */

test("OUT OF RANGE the discharge decides nothing: no roll, no damage, no death", () => {
  // ► **UNLIKE EVERY MELEE ATTACK.** `power_attack`, `normal_attack` and
  //   `quick_attack` draw a direction and call `checkattackroll()` with no
  //   distance test whatever (`power_attack` runs from `+0x607c` straight to
  //   the call at `+0x6146`), so a melee blow from across the arena still
  //   resolves and misses. Only `psyche_up` and `cast_whirlwind` gate on range
  //   (`+0x6658`-`+0x6699` right, `+0x66d1`-`+0x6712` left).
  const battle = duel({ gap: 4000 });
  take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain");
  take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain");
  assert.equal(counterOf(battle, "hero"), 3, "the chain must be ready to discharge");

  const healthBefore = combatantById(battle, "villain").health;
  const drawsBefore = rngJournal(battle).length;
  const event = psycheEvent(take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain"));

  assert.equal(event.outOfRange, true, "the event must SAY it was gated, not merely miss");
  assert.equal(event.discharged, false);
  assert.equal(rngJournal(battle).length, drawsBefore, "a gated press must take no sample at all");
  assert.equal(combatantById(battle, "villain").health, healthBefore, "nothing may be damaged");
  assert.ok(event.separation > event.gate, "the event carries the two numbers that decided it");
  assert.equal(event.gate, Math.round(ss2Reach(combatantById(battle, "hero")) + SS2_PSYCHE_UP.rangeBonus));
  // ~~And the charge is KEPT, so closing and pressing again spends it.~~
  // ~~`assert.equal(counterOf(battle, "hero"), 3, "a gated press must not burn the chain");`~~
  //
  // ► **CORRECTED 2026-09-22: A GATED PRESS SPENDS THE CHARGE, AND LANDS ON 2
  //   — exactly where a non-lethal discharge lands.** Verified by a
  //   write-nothing verifier and re-read by the implementer from the dump of
  //   `DoAction@0x240c7f`: all four exits of the gate (pass or fail, facing
  //   right or left) fall through to `+0x6732`-`+0x6742`,
  //   `game_attacker.psyche_up = 1`, in the same tick; the completion tick then
  //   adds one at `+0x6761`; and `nextphase`'s reset is skipped because the
  //   decision is still `psyche_up`. **The old assertion was this engine's
  //   invention asserted as the build's**: nothing in the bytes keeps a charge
  //   through a gated press, and the rationale that "advancing and not
  //   advancing produce the same clip and the same next press" was false the
  //   day it was written — at 2 the next press plays `psyche_up2` and charges.
  assert.equal(event.counterAfter, SS2_PSYCHE_UP.floor + 1, "the write-back to 1 and the completion's + 1");
  assert.equal(counterOf(battle, "hero"), SS2_PSYCHE_UP.floor + 1, "a gated press burns the chain down to 2");
  const next = psycheEvent(take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain"));
  assert.equal(next.clip, "psyche_up2", "so the next press CHARGES, where the old reading had it discharge");
  assert.equal(next.discharged, false);
});

/**
 * The gate at exactly its bound, both facings. `K = weapon_range + 50`; the
 * build fires facing right only when `attacker._x > round(defender._x - K)`
 * and facing left only when `attacker._x < round(defender._x + K)`
 * (`+0x6658`-`+0x6699`, `+0x66d1`-`+0x6712`) — STRICT, so a gap of exactly K
 * is out. ~~`separation <= round(reach + 50)`~~ accepted it until 2026-09-22.
 */
function gateCase({ gap, heroLeft = false, hero = {} }) {
  const battle = staged({
    red: [{ id: "hero", fields: gladiator({ psyche_up: 3, ...(heroLeft ? { gladiator_dir: "left" } : {}), ...hero }), x: heroLeft ? gap : 0, y: 0 }],
    blue: [{ id: "villain", fields: gladiator(heroLeft ? {} : { gladiator_dir: "left" }), x: heroLeft ? 0 : gap, y: 0 }]
  });
  // Construction derived facing from the STARTING positions, so it is
  // re-stated for the ones staged here: the pair faces each other.
  for (const [id, left] of [["hero", heroLeft], ["villain", !heroLeft]]) {
    const combatant = combatantById(battle, id);
    combatant.status = combatant.status.filter((token) => token !== "facing-left");
    if (left) combatant.status.push("facing-left");
  }
  const drawsBefore = rngJournal(battle).length;
  const event = psycheEvent(take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain"));
  return { event, draws: rngJournal(battle).length - drawsBefore, battle };
}

test("THE GATE IS STRICT: facing right, a discharge fires at K - 1 and is gated at exactly K", () => {
  const K = ss2Reach(combatantById(duel(), "hero")) + SS2_PSYCHE_UP.rangeBonus;
  const inside = gateCase({ gap: K - 1 });
  assert.equal(inside.event.discharged, true);
  assert.ok(inside.draws > 0);
  const onBound = gateCase({ gap: K });
  assert.equal(onBound.event.outOfRange, true, "0 > round(K - K) is false");
  assert.equal(onBound.draws, 0);
});

test("THE GATE IS STRICT: facing left, a discharge fires at K - 1 and is gated at exactly K", () => {
  const K = ss2Reach(combatantById(duel(), "hero")) + SS2_PSYCHE_UP.rangeBonus;
  const inside = gateCase({ gap: K - 1, heroLeft: true });
  assert.equal(inside.event.discharged, true);
  const onBound = gateCase({ gap: K, heroLeft: true });
  assert.equal(onBound.event.outOfRange, true, "K < round(0 + K) is false");
  assert.equal(onBound.draws, 0);
});

test("THE ROUND IS THE BUILD'S: round(defender._x -/+ K), so a HALF-INTEGER K gates the two facings one apart", () => {
  // ► **UNREACHABLE THROUGH A DERIVED `weapon_range`**, which is
  //   `physical_size + multiplier * 44` with integer multipliers — so K is an
  //   integer for every record this engine derives, and for integer positions
  //   `round(dx - K)` and `dx - round(K)` agree. A record may STATE a
  //   fractional `weapon_range`, and then they do not: `Math.round` rounds a
  //   half toward +infinity, so `round(dx - 170.5)` is `dx - 170` and
  //   `round(dx + 170.5)` is `dx + 171`. Facing right the last firing gap is
  //   169; facing left it is 170. `dx - round(K)` would make both 170.
  const hero = { weapon_range: 120.5 };
  assert.equal(gateCase({ gap: 169, hero }).event.discharged, true);
  assert.equal(gateCase({ gap: 170, hero }).event.outOfRange, true, "facing right: 0 > round(170 - 170.5) = -0 is false");
  assert.equal(gateCase({ gap: 170, hero, heroLeft: true }).event.discharged, true, "facing left: 170 < round(170.5) = 171");
  assert.equal(gateCase({ gap: 171, hero, heroLeft: true }).event.outOfRange, true);
});

test("A TARGET IN ANOTHER RANK KEEPS THE DEPTH TERM — INVENTED; the build's gate reads _x alone and has no ranks", () => {
  // `K - 10` along the arena passes both of the build's expressions; one rank
  // back, the Euclidean fight distance is past K, and the gate this function
  // always had (now strict) still refuses it. On one rank the term is inert.
  const K = ss2Reach(combatantById(duel(), "hero")) + SS2_PSYCHE_UP.rangeBonus;
  const build = (villainY) => staged({
    red: [{ id: "hero", fields: gladiator({ psyche_up: 3 }), x: 0, y: 0 }],
    blue: [{ id: "villain", fields: gladiator(), x: K - 10, y: villainY }]
  });
  const sameRank = psycheEvent(take(build(0), "hero", Ss2ActionType.PSYCHE_UP, "villain"));
  assert.equal(sameRank.discharged, true, "on one rank K - 10 is inside");
  const offRank = psycheEvent(take(build(0 - SS2_ARENA.rankStride), "hero", Ss2ActionType.PSYCHE_UP, "villain"));
  assert.ok(offRank.separation >= K, "one rank back the fight distance is past the bound, or this proves nothing");
  assert.equal(offRank.outOfRange, true);
});

test("A TARGET BEHIND THE CASTER IS GATED BY DISTANCE — INVENTED; the build's facing test would pass it at any range", () => {
  // The caster faces right and the target stands 4000 BEHIND it. The build's
  // facing-right expression is `attacker._x > round(defender._x - K)`, true
  // for every defender to the caster's left — only team play reaches that in
  // the build, because a 1v1 pair always faces each other (a staged record can
  // state a facing, which is how this reaches it). This engine keeps the
  // symmetric test instead, so a charge is never spent across the arena.
  const battle = staged({
    red: [{ id: "hero", fields: gladiator({ psyche_up: 3 }), x: 0, y: 0 }],
    blue: [{ id: "villain", fields: gladiator(), x: -4000, y: 0 }]
  });
  assert.ok(!combatantById(battle, "hero").status.includes("facing-left"), "the caster must face AWAY from its target");
  const event = psycheEvent(take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain"));
  assert.ok(!combatantById(battle, "hero").status.includes("facing-left"), "and still be facing away when it presses");
  assert.equal(event.outOfRange, true);
});

/* ------------------------------------------------------------------ *
 * THE DISCHARGE
 * ------------------------------------------------------------------ */

test("the discharge is an ordinary direction-30 attack and resolves like one", () => {
  const battle = duel();
  take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain");
  take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain");
  const drawsBefore = rngJournal(battle).length;
  const resolution = take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain");
  const event = psycheEvent(resolution);

  assert.equal(event.discharged, true);
  assert.equal(event.attackDirection, 30, "direction 30, assigned with no draw (+0x669e / +0x6717)");
  assert.ok(rngJournal(battle).length > drawsBefore,
    "the discharging press DOES reach checkattackroll, unlike the two before it");
});

test("THE COUNTER LANDS ON 2 AFTER A DISCHARGE — a STATIC CANDIDATE, not a derivation", () => {
  // ► **MARKED, BECAUSE THE MAP COULD NOT SETTLE IT.** `+0x6738` writes
  //   `game_attacker.psyche_up = 1` after the range-gated grievous and
  //   `+0x6761` adds one when the animation reports back; the two are in
  //   different ticks of the same phase, so statically it lands on 2.
  //
  //   ► **AND THE MAP'S OWN GLOSS IS WRONG BY ONE PRESS.** It says landing on 2
  //     "would let the next press discharge again". It would not: at 2 the
  //     selector picks `psyche_up2`. The readings differ as a CADENCE — three
  //     presses to the first discharge and TWO per discharge after it, against
  //     three every time.
  //
  //   Settling it needs a capture of two consecutive discharges with
  //   `-TraceWindow phase`: the ordinary window closes on `checkattackroll`'s
  //   return and BOTH writes happen after it.
  const battle = duel();
  take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain");
  take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain");
  take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain");
  assert.equal(counterOf(battle, "hero"), 2,
    "the map's static reading is what ships; a capture may yet move this to 1");

  // The cadence that follows from it, asserted so the consequence is pinned
  // and not just the number: ONE more press re-arms, the next discharges.
  const rearm = psycheEvent(take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain"));
  assert.equal(rearm.discharged, false, "at 2 the next press charges rather than discharging");
  assert.equal(counterOf(battle, "hero"), 3);
});

/* ------------------------------------------------------------------ *
 * WHAT REACHES THE SCREEN
 * ------------------------------------------------------------------ */

test("the clip travels on the EVENT, because nothing downstream could derive it", () => {
  // The phase label is one word for all three presses and the direction is 30
  // for the discharge and for `cast_whirlwind` alike, so both of the things the
  // presentation layer normally reads are ambiguous.
  const bound = SS2_STATIC_MAP_BINDINGS.action({
    type: Ss2ActionType.PSYCHE_UP, clip: "psyche_up2", discharged: false
  });
  assert.equal(bound.actor.label, "psyche_up2");
  assert.equal(bound.actor.provenance, LabelProvenance.MAP_NAMED, "the build names all three clips outright");
  assert.equal(bound.target, null, "a charge is self-targeted and has no victim");

  const discharge = SS2_STATIC_MAP_BINDINGS.action({
    type: Ss2ActionType.PSYCHE_UP, clip: "psyche_up3", discharged: true, hit: true, attackDirection: 30
  });
  assert.equal(discharge.actor.label, "psyche_up3");
  assert.equal(discharge.target.label, "knockback", "a grievous blow knocks its victim back");
});

test("all three clips are PLAYED, and both continuations are deliberately not", () => {
  const family = clipLabelsFor("psyche");
  assert.deepEqual([...family], ["psyche_up", "psyche_up2", "psyche_up3"]);
  for (const label of family) {
    assert.equal(timelineFor(label).recognised, true, `${label} must have a timeline or it freezes mid-bout`);
  }
  // ► ~~**THE DISCHARGE IS LONGER THAN THE CHARGE**, from the pack's own frame
  //   ranges: `psyche_up` and `psyche_up2` are nine frames each, `psyche_up3`
  //   thirteen.~~ **THE COMPARISON WAS RIGHT AND THE FRAME COUNTS WERE HALF THE
  //   RUN — CORRECTED 2026-09-16 FROM THE BUILD'S FRAME ACTIONS.** Entering at
  //   `psyche_up` plays to the `Stop` at 1626, so a first charge is 18 frames
  //   and a second 17, against the discharge's 13. **The CHARGE is the longer
  //   one**, and it should be: it is a wind-up that goes nowhere.
  //
  //   What this test is actually for survives the flip intact — one schedule
  //   for all three would give them one length, and these are three lengths.
  const lengths = family.map((label) => timelineFor(label).durationMs);
  assert.equal(new Set(lengths).size, 3, "three clips, three lengths, or one schedule is doing all three");
  assert.ok(timelineFor("psyche_up").durationMs > timelineFor("psyche_up3").durationMs,
    "a charge runs on into psyche_charging, so it outlasts the discharge");
  // The continuations are matched by exact name, never by a /^psyche/ pattern —
  // and that matters MORE now, not less: they resolve to their own families and
  // a `/^psyche/` rule would fold the stance into the performance.
  //
  // ► ~~`recognised: false` — nothing dispatches a continuation, so a schedule
  //   would promise what cannot be reached.~~ **BOTH HALVES WERE WRONG AND
  //   EACH WAS CORRECTED BY A DIFFERENT THING.** A verifier broke the premise
  //   (`changeCombatants` dispatches both with `gotoAndStop`, `+0x281e`,
  //   `+0x284d`, `+0x287c`, `+0x28ab`), and then the stance was built on it, so
  //   this engine reaches the label too. The schedule promises a HELD FRAME
  //   now, and `src/render/stance.js` redeems it every frame a charged
  //   gladiator is at rest.
  assert.equal(timelineFor("psyche_charging").family, "stance:psyche");
  assert.equal(timelineFor("psyche_charging2").family, "stance:psyche2");
  assert.equal(timelineFor("psyche_charging").recognised, true,
    "the charged stance holds this label, so it must have a schedule of its own");
  // ► **AND IT MUST NOT BE THE PERFORMANCE FAMILY.** A stance is one held
  //   frame; folding it into `psyche` would give a resting gladiator the
  //   charge's nine-frame animation on a loop.
  assert.notEqual(timelineFor("psyche_charging").family, timelineFor("psyche_up").family);
});

test("A CHARGE RUNS ON INTO ITS CONTINUATION, and the glow's pulse is what proves it", () => {
  // ► **THIS IS THE DEFECT THE `psyche_up` BUILD SHIPPED WITH, and three
  //   handoffs recorded it as a design.** They said the two `psyche_charging*`
  //   clips "reach nobody" because "this engine dispatches one animation per
  //   action and has no concept of a sequence". The first half is true of the
  //   engine; the second was never true of the BUILD. Export 1241 carries no
  //   terminating action between 1609 and 1625, so `gotoAndPlay("psyche_up")`
  //   runs to the `Stop` at 1626 and plays `psyche_charging` as the second half
  //   of one performance. `tools/clip-sequences.mjs` re-derives it.
  assert.deepEqual([...clipSequenceFor("psyche_up")], ["psyche_up", "psyche_charging"]);
  assert.deepEqual([...clipSequenceFor("psyche_up2")], ["psyche_up2", "psyche_charging2"]);
  // ► **AND THE DISCHARGE HAS NONE**, which is the control: if the table simply
  //   paired everything up, this would have one too.
  assert.deepEqual([...clipSequenceFor("psyche_up3")], ["psyche_up3"]);

  if (!REAL_PACK) {
    assert.equal(REAL_PACK, null, "no extraction on this machine");
    return;
  }
  // ► **THE PULSE COMPLETES, AND TRUNCATION IS VISIBLE IN ONE NUMBER.** The
  //   pack's only tween is the outer cyan glow over `psyche_up2`: `strength`
  //   falls 2.699 -> 0.977 across its nine frames and climbs back to exactly
  //   2.699 on `psyche_charging2`'s first. Cutting at the label boundary
  //   stopped it mid-climb at 2.270 and snapped the glow back.
  const { animation } = animationFor(REAL_PACK, { family: "psyche", label: "psyche_up2" });
  assert.equal(animation.poses.length, 17, "nine frames of charge and eight of continuation");
  const cyanAt = (index) => {
    const placement = animation.poses[index].find((one) => one.effects?.length > 0);
    const group = animation.effectGroups[placement.effects[0]];
    return group.filters.find((filter) => filter.colour.green === 255);
  };
  assert.equal(Math.round(cyanAt(0).strength * 1000), 2699);
  assert.equal(Math.round(cyanAt(5).strength * 1000), 977, "the trough is in the entry clip");
  assert.equal(Math.round(cyanAt(8).strength * 1000), 2270, "where the old truncation left it");
  assert.equal(Math.round(cyanAt(9).strength * 1000), 2699, "and the continuation closes the loop");
  // ► **THE INDEX HAD TO BE REBASED OR THIS WOULD READ 2,699 BY ACCIDENT.** A
  //   placement's `effects` indexes its OWN animation's table; `psyche_up2`'s
  //   entry 0 is also blur 22 / strength 2.699. Pinning the BLUR as well is
  //   what makes the two distinguishable: 22 at the start, 13 at the end.
  assert.equal(cyanAt(0).blurX, 22);
  assert.equal(cyanAt(9).blurX, 13, "an unrebased index would give 22 here and look right");
});

/* ------------------------------------------------------------------ *
 * THE THREE DEFECTS AN ADVERSARIAL REVIEW FOUND IN THE FIRST CUT.
 *
 * All three were shipped in `b201486` and fixed the same night. Each is pinned
 * here so the fix cannot quietly regress, and each names how it was found —
 * two of them by a review that reproduced them, one of them twice over.
 * ------------------------------------------------------------------ */

test("TAKING DAMAGE INTERRUPTS A CHARGE, which is what prices the discharge", () => {
  // ► **THE ONE THAT MATTERED.** `damagecharacter` resets the DEFENDER's
  //   counter at `+0x1be4` — the other half of the rule `nextphase` carries for
  //   the actor. Without it a gladiator could charge to 3 while being hit every
  //   turn, and three presses of `ceil(max_damage * 1.5)` are only expensive
  //   because three uninterrupted turns are hard to get. **As first shipped,
  //   this action was strictly stronger than the build's.**
  //
  //   `phaseTransitionEffects` cannot cover it: it resets the ACTING combatant
  //   and here the one losing the charge is the one being hit.
  const battle = duel({ seed: 2, hero: { attack: 100 }, villain: { psyche_up: 3 } });
  assert.equal(counterOf(battle, "villain"), 3, "the villain must start charged or this proves nothing");

  take(battle, "hero", Ss2ActionType.NORMAL_ATTACK, "villain");
  assert.ok(combatantById(battle, "villain").health < combatantById(battle, "villain").maxHealth,
    "the blow must have LANDED, or the reset is untested rather than absent");
  assert.equal(counterOf(battle, "villain"), SS2_PSYCHE_UP.floor,
    "a landed blow must interrupt the charge");
});

test("a MISS does not interrupt a charge, because no damage was taken", () => {
  // ► **THE CONTROL, and without it the assertion above is satisfied by a
  //   reset that fires on every attack whether or not it lands.** The build's
  //   reset is in `damagecharacter`, which a miss never reaches: a miss calls
  //   `defender_blocked()` instead.
  //
  //   Driven by effect rather than by seed-hunting for a miss: the defender
  //   keeps its charge exactly when `after.hitpoints === before.hitpoints`, so
  //   a zero-damage blow is the case under test.
  const battle = duel({ seed: 2, hero: { attack: 0 }, villain: { psyche_up: 2, defence: 100 } });
  const before = counterOf(battle, "villain");
  const resolution = take(battle, "hero", Ss2ActionType.NORMAL_ATTACK, "villain");
  const damage = resolution.effects
    .filter((effect) => effect.kind === EffectKind.DAMAGE && effect.targetId === "villain")
    .reduce((total, effect) => total + effect.amount, 0);
  if (damage > 0) return; // the roll landed; this seed cannot exercise the control
  assert.equal(counterOf(battle, "villain"), before,
    "a blow that dealt no damage must leave the charge alone");
});

test("A LETHAL DISCHARGE LEAVES 1, because the callback that adds one never runs", () => {
  // ► **RAISED BY AN ADVERSARIAL REVIEW AND CONFIRMED AGAINST BYTES THIS FILE'S
  //   MODULE ALREADY CITES.** The `+0x6738` write-back is SYNCHRONOUS ~~inside
  //   `checkattackroll`~~ — in the phase arm, same tick, after
  //   `checkattackroll()` returns (location corrected 2026-09-22; the
  //   conclusion stands); the `+0x6761` increment is gated on
  //   `attacker.struck == true` and fires on a LATER tick. `damagecharacter`
  //   calls `death()` in the same synchronous call, and `death()` deletes
  //   `attacker.onEnterFrame` (`+0x2035`), `defender.onEnterFrame` (`+0x2042`)
  //   and `nextphase` itself (`+0x2049`) — **so after a kill that tick never
  //   comes.** The same rule the stamina transition already applies, which
  //   nineteen goldens measure.
  //
  //   Without it, killing with a discharge banked an extra charge and, with a
  //   second enemy standing, re-armed two presses sooner than the build allows.
  const battle = duel({ seed: 2, hero: { attack: 100, strength: 60, psyche_up: 3 }, villain: { vitality: 1 } });
  const villain = combatantById(battle, "villain");
  villain.health = 1;
  const event = psycheEvent(take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain"));
  assert.equal(event.discharged, true);
  assert.ok(combatantById(battle, "villain").health <= 0, "the discharge must have killed, or this proves nothing");
  assert.equal(event.counterAfter, SS2_PSYCHE_UP.floor, "a lethal discharge leaves the floor");
  assert.equal(counterOf(battle, "hero"), SS2_PSYCHE_UP.floor);
});

test("A STATED ZERO READS AS FRESH, because the arena's own roster authored one", () => {
  // ► **AN INTEGRATION GAP RATHER THAN A BUG IN EITHER HALF.**
  //   `tools/arena/roster.js` has authored `psyche_up: 0` since 2026-09-10, and
  //   the tests above all start at 1 — so the arena got a different action from
  //   the one they exercised. Unclamped, such a gladiator needed FOUR presses
  //   and played `psyche_up` TWICE, because `clips[Math.min(0, 3) - 1]` is
  //   `clips[-1]` and fell through to `clips[0]`.
  //
  //   Below-floor reads as fresh: both of the build's resets write 1, so
  //   anything under 1 is a state the build leaves nobody in. The map is silent
  //   on the value before the first write, which is why a 0 exists to be read.
  const battle = duel({ hero: { psyche_up: 0 } });
  assert.equal(counterOf(battle, "hero"), 0, "this fixture exists to state a zero");

  const first = psycheEvent(take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain"));
  assert.equal(first.clip, "psyche_up", "a stated zero is a FRESH gladiator, not a pre-fresh one");
  assert.equal(first.counter, SS2_PSYCHE_UP.floor);

  const second = psycheEvent(take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain"));
  assert.equal(second.clip, "psyche_up2", "the second press must not repeat the first clip");

  const third = psycheEvent(take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain"));
  assert.equal(third.discharged, true, "THREE presses from a stated zero, not four");
});

test("the arena's own roster reaches a discharge in three presses", () => {
  // The integration case the unit tests above could not see, driven from the
  // real roster value rather than from a number this file chose.
  const authored = 0; // tools/arena/roster.js
  const battle = duel({ hero: { psyche_up: authored } });
  let presses = 0;
  let discharged = false;
  while (presses < 5 && !discharged) {
    presses += 1;
    discharged = psycheEvent(take(battle, "hero", Ss2ActionType.PSYCHE_UP, "villain")).discharged;
  }
  assert.equal(presses, SS2_PSYCHE_UP.dischargeAt,
    `the authored roster value ${authored} must reach a discharge in ${SS2_PSYCHE_UP.dischargeAt} presses`);
});
