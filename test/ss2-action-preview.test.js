/**
 * THE BATTLE UI'S TWO ENGINE QUESTIONS — `previewAction` and
 * `unavailableActions` (`docs/design/battle-ui.md`, "Engine additions",
 * slice E, 2026-09-24).
 *
 * ## What this file pins
 *
 * 1. **Every number a preview shows is the one resolution uses.** Real seeded
 *    bouts of the arena's own demo roster (plain, tricks and blasts kits, 1v1
 *    and 3v3, through the arena's own host) are played to the end; every
 *    action taken is previewed first and then RESOLVED, and the resolution is
 *    checked against the preview: the chance the roll was compared against,
 *    the damage the ingress selected (read off the rule set's own `observer`,
 *    which is the arithmetic's full return), the stamina charged, and where
 *    a moved body landed. At sampled states EVERY legal action is resolved on
 *    a replayed copy of the battle and checked the same way.
 * 2. **The ring is complete and honest.** At every turn of those bouts, for
 *    every living foe, every verb the build's ring shows is either on offer
 *    for that foe or carries exactly one reason code; nothing on offer carries
 *    one; `not-offered` (a derivation gap) never appears; and the reasons,
 *    re-derived from the offer's gates, agree with the offer entry by entry.
 * 3. **Neither question touches the battle.** `combatStateHash`, the whole
 *    wire state and the RNG journal are identical before and after.
 * 4. **Each reason code, staged** — the positions written by the test — and
 *    the previews of the verbs the demo roster never reaches (psyche up, a
 *    condition's turn, the taunted flee).
 *
 * The rule the UI design carries: the engine decides what is possible and the
 * interface only arranges it. Nothing here decides combat.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import {
  SS2_EFFECT_KIND, SS2_FACING_LEFT, SS2_PSYCHE_UP, SS2_UNAVAILABLE_REASONS, SS2_WEAKEN_ARMOUR, Ss2ActionType,
  createSs2TeamRules, ss2BattleValues, ss2Combatant, ss2FightDistance, ss2Reach, ss2StatusToken,
  ss2TeamRules, ss2UnavailableActions
} from "../src/team/ss2-rules.js";
import {
  applyAction, combatantById, combatStateHash, createTeamBattle, currentCombatant, defineTeamRuleSet,
  lastResolvedAction, legalActions, previewAction, rngJournal, toTeamWireState, unavailableActions
} from "../src/team/index.js";
import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";

const deps = { ss2Combatant, ss2BattleValues };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const { STRIKE } = SS2_EFFECT_KIND;

/* ------------------------------------------------------------------ */
/* Instruments                                                          */
/* ------------------------------------------------------------------ */

/**
 * The SS2 rule set with two read-only taps: its own `observer` (the attack
 * arithmetic's whole return, so the damage the ingress SELECTED is read, not
 * inferred) and the last view `legalActions` was handed per actor (so the
 * ring's derivation can be asked with no offer at all). Neither changes a
 * decision: the observer is the rule set's own diagnostic sink, and the
 * wrapper returns exactly what the rule set offered.
 */
function instrumented(options = {}) {
  const log = { observed: null, views: new Map(), rankStride: options.rankStride };
  const base = createSs2TeamRules({ ...options, observer: (record) => { log.observed = record; } });
  const rules = defineTeamRuleSet({
    ...base,
    legalActions(view, actorId) {
      log.views.set(actorId, view);
      return base.legalActions(view, actorId);
    }
  });
  return { rules, log };
}

/** The arena's own host over the demo roster (`tools/arena/main.js`'s shape). */
function demoHost({ kit, perSide, seed, rules }) {
  const items = demoItemsFrom(kit);
  return createVanillaBattleHost({
    teams: [
      demoSide("red", perSide, { ...deps, items, seed }),
      demoSide("blue", perSide, { ...deps, items, seed })
    ],
    rules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed
  });
}

const livingFoes = (battle, actorId) => {
  const actor = combatantById(battle, actorId);
  return battle.teams.filter((team) => team.id !== actor.teamId).flatMap((team) => team.combatants).filter((c) => c.alive);
};

/** One combatant's state, copied out before an action so it can be compared after. */
function snap(battle, id) {
  const combatant = combatantById(battle, id);
  const value = (name) => combatant.resources?.[name]?.value;
  return {
    id,
    x: combatant.x,
    y: combatant.y,
    alive: combatant.alive,
    stamina: combatant.stats.stamina,
    staminaleft: value("staminaleft"),
    staminamax: value("staminamax"),
    boundless: value("spell_boundless_energy") ?? 0
  };
}

/** What each verb's resolution reports as the damage it SELECTED, or null when it selected none. */
function selectedDamage(type, event, observed) {
  if (Number.isFinite(event.rolledDamage)) return event.rolledDamage;
  if (type === Ss2ActionType.CAST_DEATH_FROM_ABOVE) return event.boulderCount * event.damagePerBoulder;
  if (/-phase$/.test(type) && type !== Ss2ActionType.TAUNTED_PHASE) return event.damage;
  if (observed && observed.type === type && Number.isFinite(observed.outcome?.calculation?.selectedDamage)) {
    return observed.outcome.calculation.selectedDamage;
  }
  return null;
}

/** Tallies across the whole file, reported by the coverage test at the end. */
const verified = new Map();
const reasonsSeen = new Map();
const tally = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);

/**
 * Resolves `action` on `battle` (through `apply`) and checks the resolution
 * against `preview`, field by field. Returns the resolution.
 */
function resolveAndCheck(battle, log, action, preview, label, apply = (a) => applyAction(battle, a)) {
  assert.ok(preview, `${label}: a legal action must have a preview`);
  assert.ok(Object.values(SS2_EFFECT_KIND).includes(preview.kind), `${label}: kind ${preview.kind}`);
  assert.equal(preview.type, action.type);
  const actorBefore = snap(battle, action.actorId);
  log.observed = null;
  apply(action);
  const resolution = lastResolvedAction(battle);
  const event = resolution.events[0];
  const actorAfter = snap(battle, action.actorId);
  const killedTarget = action.targetId !== action.actorId && resolution.knockouts.includes(action.targetId);
  const type = action.type;
  assert.equal(event.actorId, action.actorId, `${label}: the first event is the actor's`);

  // THE CHANCE: the percentage the roll was compared against, or no roll.
  if (preview.chance === null) {
    assert.equal(event.chance, undefined, `${label}: previewed with no roll, resolved with chance ${event.chance}`);
  } else {
    assert.equal(event.chance, preview.chance, `${label}: chance`);
  }

  // THE DAMAGE the ingress selected, before armour.
  const selected = selectedDamage(type, event, log.observed);
  if (preview.damage) {
    if (selected !== null) {
      assert.ok(
        selected >= preview.damage.min && selected <= preview.damage.max,
        `${label}: selected ${selected} outside the previewed ${preview.damage.min}-${preview.damage.max}`
      );
      tally(verified, `${type}:damage`);
    }
  } else {
    assert.equal(selected, null, `${label}: previewed no damage, resolution selected ${selected}`);
    const struck = resolution.effects.filter((effect) =>
      effect.kind === "damage" && effect.targetId !== action.actorId && effect.amount > 0);
    assert.deepEqual(struck, [], `${label}: previewed no damage, resolution damaged someone`);
  }

  // THE ENERGY: the phase's staminacost, where the event reports it; and the
  // pools, re-derived with `nextphase`'s own regeneration, wherever it does
  // not — and for the TAUNT always, because its branch recovers before
  // `nextphase` spends, so a right cost charged off the wrong pool is a defect
  // the cost alone cannot show. That is the one this check found on the
  // strike arm, 2026-09-24, and it is fixed: the exception that stood here
  // for it is gone.
  const spentReported = Number.isFinite(event.staminaSpent);
  if (spentReported) {
    assert.equal(event.staminaSpent, killedTarget ? 0 : preview.energy, `${label}: stamina spent`);
    tally(verified, `${type}:energy`);
  }
  if ((!spentReported || type === Ss2ActionType.TAUNT)
    && !killedTarget && actorAfter.alive && Number.isFinite(actorBefore.staminaleft) && actorBefore.boundless <= 1) {
    let before = actorBefore.staminaleft;
    let gain = 0;
    if (type === Ss2ActionType.REST) gain = actorBefore.stamina;
    // The taunt's own recovery (`+= stamina`, clamped by `check_stats` at
    // `+0x68d3`) comes first, BEFORE the roll — so on every outcome alike:
    // failed, effect 2, and the strike (effect 1).
    if (type === Ss2ActionType.TAUNT) before = clamp(before + actorBefore.stamina, 0, actorBefore.staminamax);
    const expected = clamp(
      before - preview.energy + gain + 1 + Math.round(actorBefore.stamina / 3), 0, actorBefore.staminamax
    );
    assert.equal(actorAfter.staminaleft, expected, `${label}: stamina after, from the previewed cost ${preview.energy}`);
    if (!spentReported) tally(verified, `${type}:energy`);
    if (type === Ss2ActionType.TAUNT) tally(verified, `${type}:pools:${event.landed ? `effect-${event.effect}` : "failed"}`);
  }

  // WHERE A MOVED BODY LANDS.
  if (preview.destination) {
    const landed = {
      [Ss2ActionType.WALK_LEFT]: event.to,
      [Ss2ActionType.WALK_RIGHT]: event.to,
      [Ss2ActionType.TAUNTED_PHASE]: event.to,
      [Ss2ActionType.SHOVE]: event.to,
      [Ss2ActionType.CAST_GALE]: event.targetTo,
      [Ss2ActionType.CAST_COMMAND]: event.targetTo,
      [Ss2ActionType.RANK_BACK]: event.to ?? actorBefore.x,
      [Ss2ActionType.RANK_FRONT]: event.to ?? actorBefore.x
    }[type];
    assert.equal(landed, preview.destination.x, `${label}: destination x`);
    if (preview.destination.y !== undefined) assert.equal(event.toY, preview.destination.y, `${label}: destination rank`);
    tally(verified, `${type}:destination`);
  }
  if (preview.destinationRange) {
    assert.ok(event.to >= preview.destinationRange.min && event.to <= preview.destinationRange.max, `${label}: teleport`);
  }
  if (preview.force !== undefined) assert.equal(event.force, preview.force, `${label}: force`);
  if (preview.restores && type === Ss2ActionType.DRINK_POTION) {
    assert.equal(event.bonus, preview.restores.bonus, `${label}: potion bonus`);
    assert.equal(event.statAfter - event.statBefore, preview.restores.amount, `${label}: potion restores`);
  }
  if (preview.restores && type === Ss2ActionType.CAST_REJUVINATE) {
    assert.deepEqual(
      [event.healthRestored, event.staminaRestored, event.armourRestored],
      [preview.restores.hitpoints, preview.restores.staminaleft, preview.restores.armourclass],
      `${label}: rejuvenate restores`
    );
  }
  if (preview.outOfRange) assert.equal(event.outOfRange, true, `${label}: previewed out of range`);
  else if (event.outOfRange !== undefined) assert.equal(event.outOfRange, false, `${label}: resolved out of range`);
  if (event.backAttack) assert.equal(preview.backAttack, true, `${label}: a back attack the preview did not call`);
  if (preview.backAttack && event.hit && event.damage > 0) assert.equal(event.backAttack, true, `${label}: back attack`);
  if (preview.charge) {
    assert.deepEqual([event.counter, event.counterAfter], [preview.charge.counter, preview.charge.counterAfter]);
  }
  if (preview.crowdToll > 0) {
    assert.ok(
      resolution.effects.some((effect) =>
        effect.kind === "damage" && effect.targetId === action.actorId && effect.amount === preview.crowdToll),
      `${label}: the crowd's toll`
    );
  }
  if (preview.kind === STRIKE && !preview.outOfRange) {
    assert.ok(
      "hit" in event || "rolledDamage" in event || "boulderCount" in event || "landed" in event,
      `${label}: a strike resolved with no roll of any kind`
    );
  }
  tally(verified, type);
  return resolution;
}

/**
 * Every invariant of the ring for one actor and one selected foe, checked
 * against the offer. `view` is the one `legalActions` was handed, so the
 * derivation can be asked with NO offer and compared entry by entry.
 */
function checkRing(battle, log, actorId, foeId, label) {
  const legal = legalActions(battle, actorId);
  const result = unavailableActions(battle, actorId, foeId);
  assert.ok(result, `${label}: a ring`);
  assert.equal(result.ring.length, 8 + 1 + 6 + 2, `${label}: eight controller slots, the swap, six items, two ranks`);
  const matches = (entry, option) => entry.type === option.type && entry.targetId === option.targetId
    && (entry.type !== Ss2ActionType.DRINK_POTION || entry.itemId === option.itemId);
  for (const entry of result.ring) {
    const onOffer = entry.type !== null && legal.some((option) => matches(entry, option));
    assert.equal(entry.available, onOffer, `${label}: ${entry.verb} available=${entry.available}, offered=${onOffer}`);
    if (entry.available) {
      assert.equal(entry.reason, null, `${label}: ${entry.verb} is on offer and carries ${entry.reason}`);
      assert.equal(entry.display, "shown");
    } else {
      assert.ok(Object.hasOwn(SS2_UNAVAILABLE_REASONS, entry.reason), `${label}: ${entry.verb} reason ${entry.reason}`);
      assert.notEqual(entry.reason, "not-offered", `${label}: ${entry.verb} withheld and nothing explains it`);
      assert.equal(entry.display, SS2_UNAVAILABLE_REASONS[entry.reason].display, `${label}: ${entry.verb} display`);
      tally(reasonsSeen, entry.reason);
    }
  }
  assert.deepEqual(result.unavailable, result.ring.filter((entry) => !entry.available));

  // Every option aimed at this foe or at the actor is shown on the ring or
  // listed off it, never both and never neither.
  for (const option of legal.filter((o) => o.targetId === foeId || o.targetId === actorId)) {
    const shown = result.ring.some((entry) => entry.available && matches(entry, option));
    const off = result.offRing.some((o) => o.type === option.type && o.targetId === option.targetId && o.itemId === option.itemId);
    assert.ok(shown !== off, `${label}: ${option.type} shown=${shown} offRing=${off}`);
  }

  if (result.forced) {
    assert.deepEqual(legal.map((o) => o.type), [result.forced.type], `${label}: a forced turn offers one thing`);
    for (const entry of result.unavailable) assert.equal(entry.reason, result.forced.reason);
    return result;
  }
  // THE DERIVATION AGREES WITH THE OFFER, entry by entry: asked with no offer
  // at all, an entry the offer holds must come back `not-offered` (nothing
  // withholds it) and one it does not must come back with its gate. `rest` is
  // excluded: its reason is inferred from the offer by design (see
  // `ss2UnavailableActions`).
  const view = log.views.get(actorId);
  const probe = ss2UnavailableActions(view, foeId, [], { rankStride: log.rankStride });
  probe.ring.forEach((entry, index) => {
    const actual = result.ring[index];
    assert.equal(entry.verb, actual.verb);
    if (actual.type === Ss2ActionType.REST) return;
    assert.equal(
      entry.reason === "not-offered", actual.available,
      `${label}: ${actual.verb} derived ${entry.reason}, offered ${actual.available}`
    );
  });
  return result;
}

/** Both questions, for everything, around a check that the battle did not move. */
function askEverything(battle, log, actorId, label) {
  const hash = combatStateHash(battle);
  const wire = JSON.stringify(toTeamWireState(battle));
  const draws = rngJournal(battle).length;
  const previews = new Map();
  for (const option of legalActions(battle, actorId)) {
    const action = { actorId, ...option };
    const preview = previewAction(battle, action);
    assert.ok(preview && Number.isFinite(preview.energy), `${label}: ${option.type}>${option.targetId} has no preview`);
    previews.set(JSON.stringify(action), preview);
  }
  for (const foe of livingFoes(battle, actorId)) checkRing(battle, log, actorId, foe.id, `${label} vs ${foe.id}`);
  assert.equal(combatStateHash(battle), hash, `${label}: the questions moved the hash`);
  assert.equal(JSON.stringify(toTeamWireState(battle)), wire, `${label}: the questions moved the wire state`);
  assert.equal(rngJournal(battle).length, draws, `${label}: the questions drew randomness`);
  return previews;
}

/** A copy of `host`'s battle at the state after `played`, by replay. */
function replayed(spec, rules, played) {
  const battle = demoHost({ ...spec, rules }).battle;
  for (const action of played) applyAction(battle, action);
  return battle;
}

/**
 * One bout, to the end or `maxActions`, through the arena's own host: at
 * every turn both questions are asked about everything, and the action taken
 * is previewed and then checked against its resolution. At `forkAt` turns
 * EVERY legal action is resolved on a replayed copy and checked too.
 */
function playBout(spec, options) {
  const { driver, maxActions = 400, forkAt = () => false } = options;
  const { rules, log } = instrumented();
  const host = demoHost({ ...spec, rules });
  const played = [];
  let forked = 0;
  const label = (turn) => `${spec.kit || "plain"} ${spec.perSide}v${spec.perSide} seed ${spec.seed} turn ${turn}`;
  while (!host.battle.result && played.length < maxActions) {
    const turn = played.length;
    const actorId = host.currentCombatantId();
    const legal = host.legalActions(actorId);
    const previews = askEverything(host.battle, log, actorId, label(turn));
    if (forkAt(turn)) {
      for (const option of legal) {
        const action = { actorId, ...option };
        const copy = replayed(spec, rules, played);
        resolveAndCheck(copy, log, action, previews.get(JSON.stringify(action)), `${label(turn)} fork ${option.type}>${option.targetId}`);
        forked += 1;
      }
    }
    const action = { actorId, ...driver({ host, legal, turn }) };
    const preview = host.previewAction(action);
    assert.deepEqual(preview, previews.get(JSON.stringify({ actorId, ...legal.find((o) =>
      o.type === action.type && o.targetId === action.targetId && (o.itemId ?? null) === (action.itemId ?? null)) })),
    "the host's preview is the resolver's");
    resolveAndCheck(host.battle, log, action, preview, `${label(turn)} took ${action.type}>${action.targetId}`,
      (a) => host.submit(a));
    played.push(action);
  }
  return { host, played, forked };
}

const AI = ({ host }) => host.suggestAction();
/** Walks the whole offer over a bout, so verbs the AI never picks are resolved too. */
const WIDE = ({ legal, turn }) => legal[(turn * 7 + 3) % legal.length];

/* ------------------------------------------------------------------ */
/* Real seeded bouts                                                    */
/* ------------------------------------------------------------------ */

const CORE = [];
for (const kit of ["", "tricks", "blasts"]) {
  for (const perSide of [1, 3]) CORE.push({ kit, perSide });
}

for (const { kit, perSide } of CORE) {
  test(`${kit || "plain"} ${perSide}v${perSide}: every action taken matches its preview, every ring is honest, nothing moves`, () => {
    for (const seed of [3, 8]) {
      const spec = { kit, perSide, seed };
      const bout = playBout(spec, {
        driver: AI,
        // Every legal action resolved on a replayed copy at turns 0-2, 12 and
        // 30 (the ones a bout reaches).
        forkAt: (turn) => turn <= 2 || turn === 12 || turn === 30
      });
      assert.ok(bout.host.battle.result, `seed ${seed}: the AI's bout ends inside the cap`);
      assert.ok(bout.forked >= 3, `seed ${seed}: every legal action was resolved at the opening turns`);
      const wide = playBout(spec, { driver: WIDE, maxActions: 80, forkAt: (turn) => turn === 5 });
      assert.ok(wide.host.battle.result || wide.played.length === 80, `seed ${seed}: the wide bout ran to its end or its cap`);
    }
  });
}

test("the other kits, walked wide: buffs, crowd (potions, little fat kid, adulation) and doom", () => {
  for (const kit of ["buffs", "crowd", "doom"]) {
    for (const perSide of [1, 3]) {
      const bout = playBout({ kit, perSide, seed: 5 }, { driver: WIDE, maxActions: 60, forkAt: (turn) => turn <= 1 });
      assert.ok(bout.forked > 0, `${kit} ${perSide}v${perSide}: the opening's legal actions were resolved`);
    }
  }
});

/* ------------------------------------------------------------------ */
/* Staged: every reason code, and the verbs the demo roster never uses   */
/* ------------------------------------------------------------------ */

const FRONT = 200;
const SECOND = 103;

/** Level 9, psyche declared, a real primary weapon, charisma to taunt with. */
const fields = (o = {}) => ({
  strength: 9, speed: 10, attack: 8, defence: 5, vitality: 8, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 9, character_level: 9, weapon: 1,
  psyche_up: SS2_PSYCHE_UP.floor, ...o
});

/**
 * `hero` (red, opens: speed 30) and any `allies` against blue `foes`, at the
 * given `[x, y]`, with the facings the engine's own rule would give (derived
 * by resting nobody: `openingEffects` ran at construction on the layout, so
 * they are re-derived here by the same hook over the written positions).
 * `resources` writes declared values after construction.
 */
function staged({ at, hero = {}, foe = {}, allies = [], foes, resources = {}, status = {}, options = {} }) {
  const { rules, log } = instrumented(options);
  const battle = createTeamBattle({
    seed: 11,
    rules,
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [
          ss2Combatant(fields({ speed: 30, ...hero }), { id: "hero", name: "hero", controller: "local" }),
          ...allies.map((id) => ss2Combatant(fields(), { id, name: id, controller: "local" }))
        ]
      },
      {
        id: "blue",
        name: "blue",
        combatants: foes.map((id) => ss2Combatant(fields(foe[id] ?? {}), { id, name: id, controller: "local" }))
      }
    ]
  });
  for (const [id, [x, y]] of Object.entries(at)) Object.assign(combatantById(battle, id), { x, y });
  for (const combatant of battle.teams.flatMap((team) => team.combatants)) {
    combatant.status = combatant.status.filter((token) => token !== SS2_FACING_LEFT);
  }
  for (const effect of rules.openingEffects(battle.teams.flatMap((team) => team.combatants))) {
    if (effect.active !== false) combatantById(battle, effect.targetId).status.push(effect.status);
  }
  for (const [id, values] of Object.entries(resources)) {
    for (const [name, value] of Object.entries(values)) {
      const bag = combatantById(battle, id).resources;
      assert.ok(bag[name], `${id} must declare ${name} for the staging to mean anything`);
      bag[name].value = value;
    }
  }
  for (const [id, tokens] of Object.entries(status)) combatantById(battle, id).status.push(...tokens);
  assert.equal(currentCombatant(battle).id, "hero", "the hero opens");
  return { battle, log };
}

const ringOf = (battle, foeId) => unavailableActions(battle, "hero", foeId);
const entry = (result, verb) => {
  const found = result.ring.find((candidate) => candidate.verb === verb);
  assert.ok(found, `no ${verb} on the ${result.stance.frame} ring (${result.ring.map((e) => e.verb)})`);
  return found;
};
const reasonOf = (result, verb) => entry(result, verb).reason;

test("the stance is measured to the SELECTED foe; the lane is a team rule and greys (other-rank)", () => {
  // b1 one rank back at the same x: 97 away, inside every melee reach — the
  // build's selector says close; the lane rule says not him.
  const { battle, log } = staged({ at: { hero: [0, FRONT], b1: [0, SECOND], b2: [700, FRONT] }, foes: ["b1", "b2"] });
  assert.ok(ss2FightDistance(combatantById(battle, "hero"), combatantById(battle, "b1")) < ss2Reach(combatantById(battle, "hero")));
  const near = checkRing(battle, log, "hero", "b1", "other-rank");
  assert.equal(near.stance.frame, "closerange_warrior");
  for (const verb of ["quick_attack", "normal_attack", "power_attack", "shove"]) assert.equal(reasonOf(near, verb), "other-rank");
  assert.equal(entry(near, "power_attack").display, "grey");
  // The far foe in his own rank: the long frame, and the taunt is his.
  const far = checkRing(battle, log, "hero", "b2", "long");
  assert.equal(far.stance.frame, "longrange_warrior");
  assert.equal(entry(far, "taunt").available, true);
  assert.equal(far.ring.some((e) => e.verb === "power_attack"), false, "the long frame wires no melee: hidden by stance, not listed");
});

test("in-reach: with one foe engaged, a far foe's long-range verbs are withheld for the whole turn", () => {
  const { battle, log } = staged({ at: { hero: [0, FRONT], b1: [60, FRONT], b2: [700, FRONT] }, foes: ["b1", "b2"] });
  const far = checkRing(battle, log, "hero", "b2", "engaged");
  assert.equal(far.stance.frame, "longrange_warrior");
  assert.equal(far.stance.turnFrame, "closerange_warrior");
  assert.equal(reasonOf(far, "taunt"), "in-reach", "the brief's own case");
  // b1 is on his right, so the close frame lets him back away LEFT only.
  assert.equal(entry(far, "walkleft").available, true);
  assert.equal(reasonOf(far, "walkright"), "in-reach");
  const near = checkRing(battle, log, "hero", "b1", "engaged near");
  assert.equal(near.stance.frame, "closerange_warrior");
  for (const verb of ["quick_attack", "normal_attack", "power_attack", "shove", "walkleft"]) {
    assert.equal(entry(near, verb).available, true, verb);
  }
});

/** An archer with the bow drawn and a quiver, at `herolevel` 9. */
const archer = (o = {}) => ({ secondary_weapon: 61, ...o });
const drawn = { equipped_weapon: 2, ammo_left: 5 };

test("the archer: in-reach when a foe is inside the floor, body-blocks on a screened snipe, bow-drawn hides psyche", () => {
  // Closed on: b1 inside 100 + physical_size. b2 far: the ring for b2 is the
  // long archer frame, but the TURN is the close one.
  const closed = staged({
    at: { hero: [0, FRONT], b1: [120, FRONT], b2: [800, FRONT] }, hero: archer(), foes: ["b1", "b2"],
    resources: { hero: drawn }
  });
  const far = checkRing(closed.battle, closed.log, "hero", "b2", "closed on");
  assert.equal(far.stance.frame, "longrange_archer");
  assert.equal(far.stance.turnFrame, "closerange_archer");
  assert.equal(reasonOf(far, "bombardright"), "in-reach");
  assert.equal(reasonOf(far, "sniperight"), "in-reach");
  assert.equal(reasonOf(far, "psyche_up"), "bow-drawn");
  assert.equal(entry(far, "psyche_up").display, "hide");
  const near = checkRing(closed.battle, closed.log, "hero", "b1", "closed on near");
  assert.equal(near.stance.frame, "closerange_archer");
  assert.equal(entry(near, "bash_attack").available, true);
  assert.equal(entry(near, "taunt").available, true, "closerange_archer always wires the taunt");

  // Screened: a foe between the archer and his target, both beyond the floor.
  const screened = staged({
    at: { hero: [0, FRONT], b1: [400, FRONT], b2: [800, FRONT] }, hero: archer(), foes: ["b1", "b2"],
    resources: { hero: drawn }
  });
  const shot = checkRing(screened.battle, screened.log, "hero", "b2", "screened");
  assert.equal(reasonOf(shot, "sniperight"), "body-blocks");
  assert.equal(entry(shot, "bombardright").available, true, "the lob clears every body");
});

test("the build's own hides: level, empty and locked slots, no second weapon — and a not-built item greys", () => {
  const { battle, log } = staged({
    at: { hero: [0, FRONT], b1: [700, FRONT] }, foes: ["b1"],
    hero: { herolevel: 2, character_level: 2, inventory1: 38, inventory2: 1, inventory3: 12, inventory4: 34, inventory_maxslots: 3 }
  });
  const result = checkRing(battle, log, "hero", "b1", "hides");
  assert.equal(reasonOf(result, "wincrowd"), "level");
  assert.equal(reasonOf(result, "psyche_up"), "level");
  assert.equal(entry(result, "inventory1").available, true, "the gale, per foe");
  assert.equal(reasonOf(result, "inventory2"), "slot-empty");
  assert.equal(reasonOf(result, "inventory3"), "not-built", "item 12 has no verb here");
  assert.equal(entry(result, "inventory3").display, "grey");
  assert.equal(reasonOf(result, "inventory4"), "slot-locked", "a bolt above inventory_maxslots 3");
  assert.equal(reasonOf(result, "swap_weapons"), "no-secondary");
  for (const code of ["level", "slot-empty", "slot-locked", "no-secondary"]) {
    assert.equal(SS2_UNAVAILABLE_REASONS[code].display, "hide", code);
  }
  for (const verb of ["jumpleft", "jumpright", "chargeright"]) assert.equal(reasonOf(result, verb), "not-built");
});

test("no-arrows: a sword in hand with an empty quiver has no swap button — the build's hide, not a grey, and not no-secondary", () => {
  // The build's button test is `(!(ammo_left > 0) && secondary_weapon != 0) ||
  // secondary_weapon == 0` (overlay frame 1 body 0x2378d2 +0x0e0a-+0x0e9d),
  // whichever weapon is in hand; see `test/ss2-ranged.test.js` "NO ARROWS, NO
  // SWAP TO THE BOW" for the bytes. Both stances of the sword: far and near.
  for (const [label, x] of [["far", 700], ["near", 60]]) {
    const { battle, log } = staged({
      at: { hero: [0, FRONT], b1: [x, FRONT] }, hero: archer(), foes: ["b1"], resources: { hero: { ammo_left: 0 } }
    });
    const result = checkRing(battle, log, "hero", "b1", `empty quiver ${label}`);
    assert.equal(result.stance.weapon, "warrior", `${label}: the sword is in hand`);
    assert.equal(result.forced, null, `${label}: no forced phase — the empty quiver only forces a DRAWN bow`);
    const swap = entry(result, "swap_weapons");
    assert.deepEqual([swap.available, swap.reason, swap.display], [false, "no-arrows", "hide"], label);
  }
  assert.deepEqual(
    [SS2_UNAVAILABLE_REASONS["no-arrows"].display, SS2_UNAVAILABLE_REASONS["no-arrows"].rule],
    ["hide", "build"]
  );

  // The controls. One arrow: the button is back. No second weapon AND no
  // arrows: `no-secondary`, the gate the build tests first on that path.
  const loaded = staged({
    at: { hero: [0, FRONT], b1: [700, FRONT] }, hero: archer(), foes: ["b1"], resources: { hero: { ammo_left: 1 } }
  });
  assert.equal(entry(checkRing(loaded.battle, loaded.log, "hero", "b1", "one arrow"), "swap_weapons").available, true);
  const bare = staged({
    at: { hero: [0, FRONT], b1: [700, FRONT] }, hero: { secondary_weapon: 0 }, foes: ["b1"], resources: { hero: { ammo_left: 0 } }
  });
  assert.equal(reasonOf(checkRing(bare.battle, bare.log, "hero", "b1", "bare and empty"), "swap_weapons"), "no-secondary");
});

test("undeclared: a level-9 warrior who never stated the psyche counter", () => {
  const { battle, log } = staged({ at: { hero: [0, FRONT], b1: [700, FRONT] }, foes: ["b1"], hero: { psyche_up: undefined } });
  assert.equal(combatantById(battle, "hero").resources.psyche_up, undefined, "the staging must leave the counter undeclared");
  const result = checkRing(battle, log, "hero", "b1", "undeclared");
  assert.equal(reasonOf(result, "psyche_up"), "undeclared");
});

test("the rank verbs: duel, no-rank, and no-ranks in a one-rank arena", () => {
  const duel = staged({ at: { hero: [0, FRONT], b1: [700, FRONT] }, foes: ["b1"] });
  const alone = checkRing(duel.battle, duel.log, "hero", "b1", "duel");
  assert.equal(reasonOf(alone, "rank-back"), "duel");
  assert.equal(reasonOf(alone, "rank-front"), "duel");
  const team = staged({ at: { hero: [0, FRONT], ally: [-200, SECOND], b1: [700, FRONT], b2: [800, SECOND] }, allies: ["ally"], foes: ["b1", "b2"] });
  const front = checkRing(team.battle, team.log, "hero", "b1", "front rank");
  assert.equal(reasonOf(front, "rank-front"), "no-rank");
  assert.equal(entry(front, "rank-back").available, true);
  const flat = staged({ at: { hero: [0, null], b1: [700, null] }, foes: ["b1"], options: { rankStride: 0 } });
  const one = checkRing(flat.battle, flat.log, "hero", "b1", "one rank");
  assert.equal(reasonOf(one, "rank-back"), "no-ranks");
  assert.equal(entry(one, "rank-back").display, "hide");
});

test("the forced chain: no stamina, a condition, no arrows — the whole ring is the build's to hide", () => {
  const tired = staged({ at: { hero: [0, FRONT], b1: [700, FRONT] }, foes: ["b1"], resources: { hero: { staminaleft: 0 } } });
  const rest = checkRing(tired.battle, tired.log, "hero", "b1", "tired");
  assert.deepEqual(rest.forced, { type: Ss2ActionType.REST, targetId: "hero", reason: "no-stamina" });
  assert.equal(entry(rest, "rest").available, true, "on the long frame below half, the slot IS the rest");
  assert.equal(reasonOf(rest, "walkleft"), "no-stamina");

  const burning = staged({
    at: { hero: [0, FRONT], b1: [700, FRONT] }, foes: ["b1"], status: { hero: [ss2StatusToken("burning", "b1")] }
  });
  const condition = checkRing(burning.battle, burning.log, "hero", "b1", "burning");
  assert.equal(condition.forced.reason, "condition");
  assert.equal(condition.forced.condition, "burning");
  assert.deepEqual(condition.offRing.map((o) => o.type), [Ss2ActionType.BURNING_PHASE], "the condition's turn is off the ring");

  const empty = staged({
    at: { hero: [0, FRONT], b1: [800, FRONT] }, hero: archer(), foes: ["b1"], resources: { hero: { ...drawn, ammo_left: 0 } }
  });
  const quiver = checkRing(empty.battle, empty.log, "hero", "b1", "no arrows");
  assert.equal(quiver.forced.reason, "no-ammo");
  assert.equal(entry(quiver, "swap_weapons").available, true, "the forced swap is the swap slot");
  assert.equal(reasonOf(quiver, "bombardright"), "no-ammo");
  for (const code of ["no-ammo", "no-stamina", "condition"]) assert.equal(SS2_UNAVAILABLE_REASONS[code].display, "hide");
});

test("unpositioned: a fixture replay has no walks and no shove to offer", () => {
  const { battle, log } = staged({ at: {}, foes: ["b1"], options: { fixtureReplay: true } });
  assert.equal(combatantById(battle, "hero").x, null);
  const result = checkRing(battle, log, "hero", "b1", "unpositioned");
  assert.equal(result.stance.frame, "closerange_warrior", "position-blind reaches everyone, as the offer says");
  assert.equal(reasonOf(result, "walkleft"), "unpositioned");
  assert.equal(reasonOf(result, "shove"), "unpositioned");
  assert.equal(entry(result, "power_attack").available, true);
});

test("two listed reasons are not offer gates: out-of-reach is the stance, and a walk into the wall is offered", () => {
  assert.equal(SS2_UNAVAILABLE_REASONS["out-of-reach"], undefined);
  assert.equal(SS2_UNAVAILABLE_REASONS.wall, undefined);
  // A walk into the arena wall is OFFERED, goes nowhere, and still costs: the
  // preview says so by its destination rather than by a reason.
  const { battle } = staged({ at: { hero: [-2100, FRONT], b1: [700, FRONT] }, foes: ["b1"] });
  const walk = { actorId: "hero", type: Ss2ActionType.WALK_LEFT, targetId: "hero" };
  assert.ok(legalActions(battle, "hero").some((o) => o.type === walk.type));
  const preview = previewAction(battle, walk);
  assert.deepEqual(preview.destination, { x: -2100 });
  assert.ok(preview.energy > 0);
});

/** Resolves one staged action through the preview check. */
function stagedCheck(setup, action, label) {
  const { battle, log } = staged(setup);
  const full = { actorId: "hero", ...action };
  const preview = previewAction(battle, full);
  assert.ok(preview, `${label}: previewed`);
  return { preview, resolution: resolveAndCheck(battle, log, full, preview, label) };
}

test("psyche up: a charging press, an in-range discharge and a wasted one, each as resolution has it", () => {
  const at = { hero: [0, FRONT], b1: [60, FRONT] };
  const charging = stagedCheck({ at, foes: ["b1"] }, { type: Ss2ActionType.PSYCHE_UP, targetId: "b1" }, "charge");
  assert.equal(charging.preview.kind, "self");
  assert.deepEqual(charging.preview.charge, { counter: 1, counterAfter: 2 });
  assert.equal(charging.preview.chance, null);

  const discharge = stagedCheck(
    { at, foes: ["b1"], resources: { hero: { psyche_up: 3 } } },
    { type: Ss2ActionType.PSYCHE_UP, targetId: "b1" }, "discharge"
  );
  assert.equal(discharge.preview.kind, STRIKE);
  assert.ok(discharge.preview.chance > 0);
  assert.equal(discharge.preview.damage.min, discharge.preview.damage.max, "ceil(max_damage * 1.5), one number");

  const wasted = stagedCheck(
    { at: { hero: [0, FRONT], b1: [900, FRONT] }, foes: ["b1"], resources: { hero: { psyche_up: 3 } } },
    { type: Ss2ActionType.PSYCHE_UP, targetId: "b1" }, "wasted"
  );
  assert.equal(wasted.preview.outOfRange, true);
  assert.equal(wasted.preview.damage, null);
});

test("the archer's three verbs resolve as previewed: bombard and snipe from range, bash when closed on", () => {
  for (const type of [Ss2ActionType.BOMBARD, Ss2ActionType.SNIPE]) {
    const { preview } = stagedCheck(
      { at: { hero: [0, FRONT], b1: [800, FRONT] }, hero: archer(), foes: ["b1"], resources: { hero: drawn } },
      { type, targetId: "b1" }, type
    );
    assert.equal(preview.kind, STRIKE);
    assert.ok(preview.chance > 0);
  }
  const bash = stagedCheck(
    { at: { hero: [0, FRONT], b1: [120, FRONT] }, hero: archer(), foes: ["b1"], resources: { hero: drawn } },
    { type: Ss2ActionType.BASH_ATTACK, targetId: "b1" }, "bash"
  );
  assert.equal(bash.preview.damage.min, bash.preview.damage.max, "ceil(min_damage / 2), one number");
});

test("a condition's turn and the taunted flee preview what they will do to the actor", () => {
  const burn = stagedCheck(
    {
      at: { hero: [0, FRONT], b1: [700, FRONT] }, foes: ["b1"],
      foe: { b1: { weapon_enchantment_type: 2, weapon_enchantment_potency: 3, weapon_max_damage: 9 } },
      status: { hero: [ss2StatusToken("burning", "b1")] }
    },
    { type: Ss2ActionType.BURNING_PHASE, targetId: "hero" }, "burning"
  );
  assert.equal(burn.preview.damage.min, burn.resolution.events[0].damage);
  assert.ok(burn.preview.damage.min > 0, "the inflictor's enchantment damage");
  assert.equal(burn.preview.energy, 0);

  const flee = stagedCheck(
    { at: { hero: [0, FRONT], b1: [700, FRONT] }, foes: ["b1"], status: { hero: [ss2StatusToken("taunted1", "b1")] } },
    { type: Ss2ActionType.TAUNTED_PHASE, targetId: "hero" }, "flee"
  );
  assert.equal(flee.preview.kind, "move");
  assert.ok(flee.preview.destination.x < 0, "facing right, he runs left");
});

test("the item spells a demo kit carries resolve as previewed, staged at every distance the offer allows", () => {
  const kit = { inventory1: 34, inventory2: 30, inventory3: 44, inventory4: 38, inventory5: 39, inventory6: 37 };
  for (const [x, label] of [[60, "close"], [700, "far"]]) {
    for (const type of [
      Ss2ActionType.CAST_LIGHTNING_BOLT, Ss2ActionType.CAST_FIREBALL, Ss2ActionType.CAST_WEAKEN_ARMOUR,
      Ss2ActionType.CAST_GALE, Ss2ActionType.CAST_COMMAND, Ss2ActionType.CAST_WHIRLWIND
    ]) {
      const { preview } = stagedCheck(
        { at: { hero: [0, FRONT], b1: [x, FRONT] }, foes: ["b1"], hero: kit },
        { type, targetId: "b1" }, `${type} ${label}`
      );
      if (type === Ss2ActionType.CAST_WEAKEN_ARMOUR) assert.equal(preview.kind, "debuff");
      if (type === Ss2ActionType.CAST_WHIRLWIND) assert.equal(Boolean(preview.outOfRange), x > 200, `whirlwind ${label}`);
    }
  }
  assert.equal(SS2_WEAKEN_ARMOUR.itemId, 44);
});

/* ------------------------------------------------------------------ */
/* The host, and what was covered                                       */
/* ------------------------------------------------------------------ */

test("the host exposes both beside legalActions and suggestAction, and they are the resolver's", () => {
  const host = demoHost({ kit: "tricks", perSide: 3, seed: 3, rules: ss2TeamRules });
  const actorId = host.currentCombatantId();
  const [option] = host.legalActions();
  assert.deepEqual(host.previewAction(option), previewAction(host.battle, { actorId, ...option }));
  const foe = livingFoes(host.battle, actorId)[0];
  assert.deepEqual(host.unavailableActions(actorId, foe.id), unavailableActions(host.battle, actorId, foe.id));
  assert.equal(host.previewAction({ type: Ss2ActionType.POWER_ATTACK, targetId: foe.id }), null,
    "an action not on offer has no preview");
  assert.throws(() => host.unavailableActions(actorId, actorId), /not a living foe/);
});

test("coverage: which verbs were resolved against their preview, and which reasons the bouts reached", (t) => {
  // The tallies, in the test's own output (`node --test` prints diagnostics).
  t.diagnostic(`verified: ${JSON.stringify(Object.fromEntries([...verified].sort()))}`);
  t.diagnostic(`reasons reached in bouts and staging: ${JSON.stringify(Object.fromEntries([...reasonsSeen].sort()))}`);
  // Every verb the demo kits and the staging can reach. The status phases other
  // than burning, and the potions and stat spells outside the crowd and buffs
  // kits, go through the same branches as their resolved siblings.
  for (const type of [
    Ss2ActionType.QUICK_ATTACK, Ss2ActionType.NORMAL_ATTACK, Ss2ActionType.POWER_ATTACK, Ss2ActionType.SHOVE,
    Ss2ActionType.BOMBARD, Ss2ActionType.SNIPE, Ss2ActionType.BASH_ATTACK, Ss2ActionType.TAUNT,
    Ss2ActionType.WALK_LEFT, Ss2ActionType.WALK_RIGHT, Ss2ActionType.RANK_BACK, Ss2ActionType.RANK_FRONT,
    Ss2ActionType.REST, Ss2ActionType.SWAP_WEAPONS, Ss2ActionType.WINCROWD, Ss2ActionType.PSYCHE_UP,
    Ss2ActionType.CAST_LIGHTNING_BOLT, Ss2ActionType.CAST_FIREBALL, Ss2ActionType.CAST_DEATH_FROM_ABOVE,
    Ss2ActionType.CAST_GALE, Ss2ActionType.CAST_COMMAND, Ss2ActionType.CAST_TELEPORT, Ss2ActionType.CAST_WHIRLWIND,
    Ss2ActionType.CAST_GHOST_STRIKE, Ss2ActionType.CAST_WEAKEN_ARMOUR, Ss2ActionType.CAST_ADULATION,
    Ss2ActionType.CAST_LITTLE_FAT_KID, Ss2ActionType.CAST_REJUVINATE, Ss2ActionType.DRINK_POTION,
    Ss2ActionType.CAST_COLOSSUS, Ss2ActionType.CAST_BLOODLUST, Ss2ActionType.CAST_SWIFTSANDALS,
    Ss2ActionType.CAST_REGENERATE, Ss2ActionType.CAST_BOUNDLESS_ENERGY,
    Ss2ActionType.BURNING_PHASE, Ss2ActionType.TAUNTED_PHASE
  ]) {
    assert.ok(verified.get(type) > 0, `${type} was never resolved against its preview`);
  }
  for (const type of [Ss2ActionType.QUICK_ATTACK, Ss2ActionType.NORMAL_ATTACK, Ss2ActionType.POWER_ATTACK,
    Ss2ActionType.BOMBARD, Ss2ActionType.SNIPE, Ss2ActionType.CAST_LIGHTNING_BOLT, Ss2ActionType.CAST_FIREBALL]) {
    assert.ok(verified.get(`${type}:damage`) > 0, `${type}: no selected damage was checked against the band`);
    assert.ok(verified.get(`${type}:energy`) > 0, `${type}: no energy was checked`);
  }
  // The taunt's pools, on every outcome — the strike arm above all, which is
  // where the recovery was once lost. A check that never met a strike would
  // pass over nobody.
  for (const outcome of ["failed", "effect-1", "effect-2"]) {
    assert.ok(verified.get(`${Ss2ActionType.TAUNT}:pools:${outcome}`) > 0, `taunt ${outcome}: its pools were never checked`);
  }
  for (const code of ["other-rank", "in-reach", "level", "slot-empty", "not-built", "no-secondary", "no-arrows", "duel", "no-rank"]) {
    assert.ok(reasonsSeen.get(code) > 0, `${code} never reached`);
  }
});
