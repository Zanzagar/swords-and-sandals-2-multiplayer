/**
 * The one shared turn/action resolver.
 *
 * 1v1, 2v2 and 3v3 are the same code path with a different slot count. There
 * is no second combat implementation anywhere in this repository, and adding
 * one would be the single most damaging thing a future change could do.
 *
 * What the resolver guarantees to any injected rule set:
 *
 * - it is called at most once per action, only for a legal action, only on the
 *   combatant whose turn it is;
 * - every random value it needs arrives through one ordered, labelled channel
 *   in the order it asks for them; the resolver draws nothing itself;
 * - it sees frozen views, never live state, so it cannot mutate the battle
 *   out from under the resolver;
 * - everything it can see, the projection carries — and therefore the state
 *   hash covers. That is what makes the hash a real desync check rather than
 *   one that agrees right up to the moment two peers diverge, and it is why
 *   the canonical resource bag (`resources.js`) is on both the view and the
 *   projection rather than reaching a rule set through a side channel;
 * - its declarative effects are applied in order and clamped, its events are
 *   stamped with sequence and turn and appended in order;
 * - knockouts, team elimination, the battle result, and campaign settlement
 *   are computed afterwards by the resolver, not by the rule set.
 *
 * Determinism: same blueprint + same ordered action stream => identical
 * combat state hash, for every team size.
 */

import {
  battleStanding,
  collectKnockouts,
  EliminationEvent,
  snapshotLiveness
} from "./elimination.js";
import { fnv1a } from "../common/fnv1a.js";
import { BattleError } from "./errors.js";
import { placeholderTeamRules } from "./placeholder-rules.js";
import { buildRoster, initiativeOrder } from "./roster.js";
import { createOrderedRngChannel } from "./rng.js";
import { freezeResources, projectResources, withDeclaredResources, writeResource } from "./resources.js";
import {
  assertActionOutcome,
  assertTeamRuleSet,
  describeTeamRuleSet,
  EffectKind
} from "./rule-set.js";
import {
  BATTLE_RESULT_PENDING_TYPE,
  createCampaignSettlement
} from "./settlement.js";

export { BattleError };

/**
 * THE FIELDS TWO PEERS EXCHANGE, and the thing the version is computed FROM.
 *
 * Kept beside `combatantProjection` as a declared list rather than read out of
 * it at load time: a probe object would have to be constructed and kept
 * correct, and a module that can fail to load is a worse trade than one whose
 * list is checked by a test. **`test/team-resolver.test.js` asserts that this
 * list is exactly what `combatantProjection` returns**, so adding a field
 * without adding it here fails the suite.
 */
export const COMBATANT_PROJECTION_FIELDS = Object.freeze([
  "alive", "aiFilled", "health", "id", "loadout", "maxHealth", "name",
  "resources", "seatId", "slotIndex", "stats", "status", "teamId", "x", "y"
]);

/**
 * The wire format's version, DERIVED FROM ITS OWN SHAPE.
 *
 * ► **IT WAS A HAND-WRITTEN `1` AND THE FORMAT CHANGED FOUR TIMES UNDER IT** —
 *   `x`, `weapon_range`, `y`, and the limb matrices. Two peers on either side
 *   of any of those changes both advertised version 1 and disagreed about
 *   identical battles, and turning a feature off could not restore
 *   compatibility because the SHAPE had moved, not the behaviour.
 *
 *   Four sessions in a row noticed and deferred it. **The owner's decision,
 *   2026-09-13: derive it, rather than bump it.** Bumping fixes the instance;
 *   deriving removes the failure mode, because the number now cannot fail to
 *   change when the fields do.
 *
 * Hashed with the same `fnv1a` the combat-state hash uses — deliberately, so
 * the two numbers a peer compares are made the same way and neither needs
 * `node:crypto`, which this module cannot have because it runs in a browser.
 *
 * Order-independent: the field list is sorted before hashing, so reordering the
 * literal is not a format change and does not invalidate a peer. Adding,
 * removing or RENAMING a field is, and does.
 *
 * ► **AN INTEGER, because `provenance.battle.stateVersion` in a sealed
 *   campaign record is contracted to be a positive one** — `fnv1a` returns hex
 *   and handing that straight over failed 90 tests on ONE schema line. The hex
 *   is parsed back to the 32-bit number it always was.
 *
 * The value is opaque by design — it is an IDENTITY, not an ordering. **Nothing
 * may infer "newer" from a bigger number**, which is exactly the mistake a
 * hand-maintained integer invites and the reason this one is a hash rather than
 * a counter. Two versions are equal or they are not; there is no "later".
 */
export const BATTLE_STATE_VERSION =
  Number.parseInt(fnv1a([...COMBATANT_PROJECTION_FIELDS].sort().join(",")), 16);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clone = (value) => JSON.parse(JSON.stringify(value));

/** Deep-freezes a JSON-shaped value in place. Used for the read-only trace. */
function deepFreeze(value) {
  if (value === null || typeof value !== "object") return value;
  for (const entry of Object.values(value)) deepFreeze(entry);
  return Object.freeze(value);
}

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

/**
 * @param {object} blueprint
 * @param {object[]} blueprint.teams   exactly two teams, one to three slots each
 * @param {number} [blueprint.seed]    seed for the ordered RNG channel
 * @param {object} [blueprint.rules]   the injected rule set (the seam)
 * @param {object[]} [blueprint.rngTape] ordered samples instead of a seed
 * @param {boolean} [blueprint.journalRolls] keep the diagnostic roll journal
 * @param {Function} [blueprint.onCampaignSettled] once-only settlement callback
 */
export function createTeamBattle({
  teams,
  seed = 1,
  rules = placeholderTeamRules,
  rngTape = null,
  journalRolls = true,
  onCampaignSettled = null
} = {}) {
  assertTeamRuleSet(rules);
  const roster = buildRoster({ teams, rules });
  declareOpeningResources(rules, roster.teams.flatMap((team) => team.combatants));
  const rng = createOrderedRngChannel({ seed, tape: rngTape, journal: journalRolls });
  const battle = {
    version: BATTLE_STATE_VERSION,
    seed: seed >>> 0,
    rules,
    rulesDescriptor: describeTeamRuleSet(rules),
    teams: roster.teams,
    controllers: roster.controllers,
    // A rule set MAY own turn order. `ss2TeamRules` does, because SS2 does not
    // sort initiative at all — `changeCombatants` alternates — and the flat
    // agility sort this resolver ships is authored. The fallback keeps every
    // other rule set, and every caller that declares no hook, exactly as it
    // was. See `initiativeOrder` in `roster.js` and D3 in
    // `docs/combat-economy-findings-2026-09-10.md`.
    initiative: rules.initiativeOrder?.(roster.teams) ?? initiativeOrder(roster.teams),
    turnCursor: 0,
    turnNumber: 1,
    result: null,
    events: [],
    /** Trace of the last applied action. Never projected, never hashed. */
    lastResolution: null,
    rng,
    settlement: createCampaignSettlement(onCampaignSettled)
  };
  Object.defineProperty(battle, "rngState", {
    enumerable: true,
    configurable: true,
    get: () => rng.state,
    set: (next) => {
      rng.state = next;
    }
  });
  Object.defineProperty(battle, "rngCursor", {
    enumerable: true,
    configurable: true,
    get: () => rng.cursor
  });
  /**
   * ► **THE STATE A BATTLE IS IN BEFORE ANYBODY ACTS, which a per-combatant
   *   hook cannot express.** `startingPosition` and `startingY` are asked one
   *   combatant at a time, while the roster is still being built, so neither
   *   can see the other side. Anything derived from where EVERYONE ended up
   *   standing has to be asked once, afterwards — and facing is exactly that.
   *
   * Added 2026-09-17, after measuring that `ss2TeamRules` derived facing only
   * in its movement branches: a gladiator who had not yet walked carried none,
   * and the absence read as "faces right", so 40 of 40 opening ranged attacks
   * scored as back attacks. The hook is OPTIONAL and every rule set that
   * declares none is untouched.
   *
   * **STATUS only, and the narrowness is the point.** A POSITION here would
   * fight `startingPosition` for the same field with no way to tell which won,
   * and a DAMAGE or RESOURCE would make construction a turn. If a rule set
   * ever needs one of those at construction it should say so and get its own
   * hook, rather than this one quietly widening.
   */
  const opening = typeof rules.openingEffects === "function"
    ? rules.openingEffects(allCombatants(battle))
    : [];
  if (!Array.isArray(opening)) {
    throw new BattleError(`Rule set ${rules.id} returned a non-array from openingEffects().`);
  }
  for (const effect of opening) {
    if (effect?.kind !== EffectKind.STATUS) {
      throw new BattleError(
        `Rule set ${rules.id} returned a ${String(effect?.kind)} effect from openingEffects(), ` +
        "which accepts STATUS effects only."
      );
    }
  }
  if (opening.length) applyEffects(battle, opening);
  return battle;
}

/**
 * ► **THE RESOURCES A RULE SET'S VERBS WILL WRITE ON SOMEBODY WHO IS NOT
 *   CARRYING THE THING THAT WRITES THEM.** Added 2026-09-22 for SS2's little
 *   fat kid, whose counter and whose stat backups live on the VICTIM — and a
 *   blueprint builds one combatant at a time, so it cannot know that a foe
 *   will carry the item.
 *
 * `rules.openingResources(views)` is OPTIONAL and is asked ONCE, after every
 * combatant is built and before anybody acts, with a frozen view of each. It
 * returns `[{ targetId, resource, value, min?, max? }]`. Each is declared
 * through `withDeclaredResources`, so it meets every rule a blueprint's
 * declaration does, and a name the combatant already declares is left as the
 * blueprint stated it.
 *
 * **Declarations only, never a write**, and the narrowness is the point for
 * the reason `openingEffects` gives: a rule set that needs a pool to MOVE at
 * construction should say so and get its own hook. A rule set with no hook,
 * or one returning `[]`, builds exactly the battle it always did — nothing
 * here touches a bag it adds nothing to.
 */
function declareOpeningResources(rules, combatants) {
  if (typeof rules.openingResources !== "function") return;
  const declarations = rules.openingResources(combatants.map(combatantView));
  if (!Array.isArray(declarations)) {
    throw new BattleError(`Rule set ${rules.id} returned a non-array from openingResources().`);
  }
  for (const declaration of declarations) {
    const target = combatants.find((combatant) => combatant.id === declaration?.targetId);
    if (!target) {
      throw new BattleError(
        `Rule set ${rules.id} declared an opening resource for unknown combatant ${String(declaration?.targetId)}.`
      );
    }
    const { value, min, max } = declaration;
    const entry = { value };
    if (min !== undefined) entry.min = min;
    if (max !== undefined) entry.max = max;
    target.resources = withDeclaredResources(target.resources, { [declaration.resource]: entry });
  }
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export function allCombatants(battle) {
  return battle.teams.flatMap((team) => team.combatants);
}

export function combatantById(battle, id) {
  return allCombatants(battle).find((combatant) => combatant.id === id);
}

export function currentCombatant(battle) {
  if (battle.result) return null;
  return combatantById(battle, battle.initiative[battle.turnCursor]);
}

export function aliveCombatants(battle, teamId) {
  return allCombatants(battle).filter((combatant) => combatant.alive && (!teamId || combatant.teamId === teamId));
}

export function teamById(battle, teamId) {
  return battle.teams.find((team) => team.id === teamId);
}

export function seatOf(battle, combatantId) {
  const combatant = combatantById(battle, combatantId);
  if (!combatant) throw new BattleError(`Unknown combatant: ${String(combatantId)}.`);
  return combatant.seatId;
}

export function controllerOf(battle, combatantId) {
  return battle.controllers.identityFor(seatOf(battle, combatantId));
}

export function isAiControlled(battle, combatant) {
  return battle.controllers.isAi(combatant.seatId);
}

/** Hand a seat to a different controller. Combat state is deliberately untouched. */
export function reassignController(battle, seatId, controller) {
  return battle.controllers.reassign(seatId, controller);
}

/* ------------------------------------------------------------------ */
/* Rule-set views                                                      */
/* ------------------------------------------------------------------ */

/**
 * What a rule set is allowed to see of one combatant.
 *
 * **Soundness invariant:** every field here also appears in
 * `combatantProjection` below, and therefore inside `combatStateHash`. That is
 * not a coincidence to be maintained by care — it is the property that makes
 * the hash a real desync check, because a rule set can only read what the hash
 * already covers. A field added here and not there would let two peers agree
 * on their hashes and then diverge on the next action, which is the one thing
 * the hash exists to prevent. `test/team-resolver.test.js` pins it.
 */
function combatantView(combatant) {
  if (!combatant) return null;
  return Object.freeze({
    id: combatant.id,
    name: combatant.name,
    teamId: combatant.teamId,
    seatId: combatant.seatId,
    slotIndex: combatant.slotIndex,
    aiFilled: combatant.aiFilled,
    stats: Object.freeze({ ...combatant.stats }),
    loadout: Object.freeze({ ...combatant.loadout }),
    resources: freezeResources(combatant.resources),
    maxHealth: combatant.maxHealth,
    health: combatant.health,
    alive: combatant.alive,
    status: Object.freeze([...combatant.status]),
    // Where this gladiator stands, or `null` for a rule set that models no
    // geometry. Present either way — see `normaliseCombatant` for why the key
    // is never absent — so the soundness invariant above holds: it is in
    // `combatantProjection` too, and therefore inside `combatStateHash`.
    x: combatant.x,
    // The second axis, same contract. A rule set may model `x` and not `y`.
    y: combatant.y
  });
}

function actorView(battle, actor) {
  return {
    turnNumber: battle.turnNumber,
    actor: combatantView(actor),
    allies: Object.freeze(aliveCombatants(battle, actor.teamId).map(combatantView)),
    foes: Object.freeze(
      aliveCombatants(battle).filter((combatant) => combatant.teamId !== actor.teamId).map(combatantView)
    )
  };
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export function legalActions(battle, actorId = currentCombatant(battle)?.id) {
  const actor = combatantById(battle, actorId);
  if (!actor?.alive || battle.result) return [];
  const options = battle.rules.legalActions(Object.freeze(actorView(battle, actor)), actor.id);
  if (!Array.isArray(options)) {
    throw new BattleError(`Rule set ${battle.rules.id} did not return a list of legal actions.`);
  }
  return options;
}

/**
 * An action's identity is `type`, `targetId`, `spellKind` and `itemId`, and a
 * submitted action is legal only if an offered option matches ALL FOUR.
 *
 * ► **`itemId` JOINED 2026-09-22, WITH THE SS2 `drink-potion` VERB**, because
 *   one build label (`drink_potion`) serves eight inventory items and the
 *   label alone cannot say which. Before it, the resolver compared three
 *   fields and built the rule set's request from the same three, so an
 *   action's `itemId` was DROPPED on the way in: an option for item 2 would
 *   have licensed a submission naming item 5, and the rule set would never
 *   have seen either number. It is opaque here, exactly as `spellKind` is — a
 *   rule set's own discriminator, compared and passed through, never read.
 *   Absent on both sides compares equal (`null === null`), so every rule set
 *   that never offers one is unaffected.
 */
function actionIsLegal(battle, action) {
  return legalActions(battle, action.actorId).some((option) =>
    option.type === action.type &&
    option.targetId === action.targetId &&
    (option.spellKind ?? null) === (action.spellKind ?? null) &&
    (option.itemId ?? null) === (action.itemId ?? null)
  );
}

function addEvent(battle, event) {
  battle.events.push({ sequence: battle.events.length + 1, turn: battle.turnNumber, ...event });
}

/**
 * Applies a rule set's declarative effects, in order, clamping each.
 *
 * Ordering is load-bearing and is the rule set's to choose. An armour-first
 * damage split is `{ resource: armour, to: 0 }` then `{ damage: overflow }`,
 * and the resolver applies exactly that, in exactly that order — it does not
 * know what "armour" is and must not.
 *
 * Only `health` decides life. A resource reaching zero means nothing to the
 * resolver, which is the point: making a pool lethal would be a combat rule.
 */
function applyEffects(battle, effects) {
  for (const effect of effects) {
    const target = combatantById(battle, effect.targetId);
    if (!target) {
      throw new BattleError(
        `Rule set ${battle.rules.id} produced an effect for unknown combatant ${effect.targetId}.`
      );
    }
    if (effect.kind === EffectKind.DAMAGE) {
      target.health = clamp(target.health - effect.amount, 0, target.maxHealth);
    } else if (effect.kind === EffectKind.HEAL) {
      target.health = clamp(target.health + effect.amount, 0, target.maxHealth);
    } else if (effect.kind === EffectKind.RESOURCE) {
      writeResource(target, effect.resource, effect.to, { ruleSetId: battle.rules.id });
    } else if (effect.kind === EffectKind.POSITION) {
      // The rule set owns the arena bound and has already applied it; this is
      // the same division as a RESOURCE write, where the rule set clamps to
      // its own pool and the resolver stores what it is handed.
      if (target.x === null) {
        throw new BattleError(
          `Rule set ${battle.rules.id} moved ${effect.targetId}, which models no position. ` +
          "A rule set that emits POSITION effects must also declare startingPosition()."
        );
      }
      target.x = effect.to;
    } else if (effect.kind === EffectKind.LATERAL) {
      // The same division as POSITION above: the rule set owns the arena bound
      // and has already applied it, and the resolver stores what it is handed.
      if (target.y === null) {
        throw new BattleError(
          `Rule set ${battle.rules.id} moved ${effect.targetId} laterally, which models no depth. ` +
          "A rule set that emits LATERAL effects must also declare startingY()."
        );
      }
      target.y = effect.to;
    } else if (effect.kind === EffectKind.STAT) {
      // The same division again — the rule set owns any bound — and the same
      // refusal a resource write makes: a stat the combatant was not built
      // with is not created here. See `EffectKind.STAT`.
      if (!Object.hasOwn(target.stats, effect.stat)) {
        throw new BattleError(
          `Rule set ${battle.rules.id} wrote stat ${String(effect.stat)} on ${effect.targetId}, which carries ` +
          `${Object.keys(target.stats).join(", ")}. The resolver creates no stat mid-battle.`
        );
      }
      target.stats[effect.stat] = effect.to;
    } else if (effect.kind === EffectKind.STATUS) {
      const present = target.status.includes(effect.status);
      if (effect.active === false && present) {
        target.status = target.status.filter((entry) => entry !== effect.status);
      } else if (effect.active !== false && !present) {
        target.status = [...target.status, effect.status];
      }
    }
    target.alive = target.health > 0;
  }
}

/**
 * A whole team is down. Record it, freeze the battle result, and arm — but do
 * not fire — campaign settlement. Settlement waits for the acknowledgement.
 *
 * The settlement is armed with a **battle discriminator** as well as the
 * outcome, because the outcome alone does not identify a battle. Two bouts
 * between the same two teams ending the same way are the delivery target here
 * — a networked campaign of consecutive bouts — and without a discriminator
 * they share a completion token, so bout 1's `battle-result-animation-complete`
 * satisfies bout 2's second gate and settles it with bout 1's winner.
 *
 * The discriminator is `combatStateHash(battle)` read *here*: after the result
 * and the `team-eliminated` events are on the battle and before the settlement
 * is armed. That ordering matters twice over.
 *
 * - It is late enough to cover this battle's whole terminal state — seed, RNG
 *   cursor, rosters, healths, statuses, initiative, turn number and the entire
 *   ordered event log — so two genuinely independent bouts differ in it.
 * - It is early enough that the hash cannot see the token it is about to go
 *   into. `toTeamWireState` carries `settlement.toJSON()`, which is still the
 *   unarmed constant at this line, so there is no circularity to resolve.
 *
 * It stays a pure function of this battle's own play: a replay of the same
 * blueprint and the same ordered actions reaches the identical terminal state
 * and therefore the identical token. A counter or a random value would have
 * discriminated just as well and broken deterministic replay, which is why
 * neither is used.
 */
function checkResult(battle) {
  if (battle.result) return;
  const standing = battleStanding(battle.teams);
  if (!standing.decided) return;
  battle.result = { winnerTeamId: standing.winnerTeamId, reason: standing.reason };
  for (const teamId of standing.eliminatedTeamIds) {
    addEvent(battle, { type: EliminationEvent.TEAM_ELIMINATED, teamId });
  }
  battle.settlement.arm({
    winnerTeamId: standing.winnerTeamId,
    loserTeamIds: standing.eliminatedTeamIds,
    reason: standing.reason,
    battleDiscriminator: combatStateHash(battle)
  });
  const pending = battle.settlement.pendingResultEvent();
  addEvent(battle, {
    type: BATTLE_RESULT_PENDING_TYPE,
    status: pending.status,
    completionToken: pending.completionToken,
    winnerTeamId: pending.winnerTeamId,
    loserTeamIds: [...pending.loserTeamIds],
    reason: pending.reason
  });
}

function advanceTurn(battle) {
  checkResult(battle);
  if (battle.result) return;
  const total = battle.initiative.length;
  for (let steps = 0; steps < total; steps += 1) {
    battle.turnCursor = (battle.turnCursor + 1) % total;
    if (battle.turnCursor === 0) battle.turnNumber += 1;
    if (currentCombatant(battle).alive) return;
  }
  throw new BattleError("No living combatant was found while advancing the turn.");
}

/**
 * Applies exactly one legal action. Network clients should submit this shape.
 *
 * Returns the battle, as it always has. The effects and events the rule set
 * produced are recorded on `battle.lastResolution` and readable with
 * `lastResolvedAction(battle)`; `applyActionWithOutcome` returns them
 * directly. They used to be discarded, which forced any honest integration to
 * wrap the rule set in a recording decorator just to see what the resolver had
 * already computed.
 */
export function applyAction(battle, action) {
  const actor = currentCombatant(battle);
  if (!actor) throw new BattleError("The battle has already ended.");
  if (action.actorId !== actor.id) throw new BattleError(`It is ${actor.id}'s turn, not ${action.actorId}'s.`);
  if (!actionIsLegal(battle, action)) throw new BattleError("Illegal action.");
  const target = combatantById(battle, action.targetId);

  const request = Object.freeze({
    ...actorView(battle, actor),
    actorId: actor.id,
    teamId: actor.teamId,
    type: action.type,
    targetId: action.targetId,
    spellKind: action.spellKind ?? null,
    // See `actionIsLegal`: compared there, carried here, read by nobody but
    // the rule set that offered it.
    itemId: action.itemId ?? null,
    target: combatantView(target)
  });
  const rolls = battle.rng.withContext({
    turn: battle.turnNumber,
    actorId: actor.id,
    actionType: action.type
  });
  const outcome = assertActionOutcome(battle.rules.resolveAction(request, rolls), battle.rules.id);

  const liveness = snapshotLiveness(allCombatants(battle));
  const firstEventSequence = battle.events.length + 1;
  applyEffects(battle, outcome.effects);
  for (const event of outcome.events) addEvent(battle, event);
  const knockouts = collectKnockouts(liveness, allCombatants(battle));
  for (const knockedOut of knockouts) {
    // An individual knockout is only a combatant-defeated event. It never
    // settles the campaign, and on a multi-slot team it never ends the battle.
    addEvent(battle, {
      type: EliminationEvent.COMBATANT_DEFEATED,
      actorId: actor.id,
      targetId: knockedOut
    });
  }
  // Recorded, not projected: this is the resolver's trace of what it just
  // applied, not combat state. `toTeamWireState` does not carry it and
  // `combatStateHash` does not cover it — the state the effects produced is
  // already in the projection, and hashing the derivation too would make a
  // rule set's internal bookkeeping look like a desync.
  battle.lastResolution = deepFreeze({
    action: { ...action },
    actorId: actor.id,
    turn: battle.turnNumber,
    firstEventSequence,
    effects: clone(outcome.effects),
    events: clone(outcome.events),
    knockouts: [...knockouts]
  });
  advanceTurn(battle);
  return battle;
}

/**
 * The effects and events the last applied action produced, or `null` before
 * the first action. Frozen deep copies: reading the trace cannot alter state.
 */
export function lastResolvedAction(battle) {
  return battle.lastResolution ?? null;
}

/**
 * `applyAction`, returning the resolution record instead of the battle, for
 * callers that want the effects in one call. Same protocol, same validation,
 * same everything — this is sugar over `applyAction` and nothing else.
 */
export function applyActionWithOutcome(battle, action) {
  applyAction(battle, action);
  return lastResolvedAction(battle);
}

/* ------------------------------------------------------------------ */
/* AI                                                                  */
/* ------------------------------------------------------------------ */

/**
 * What the rule set's AI would do for this combatant, WHOEVER is seated.
 *
 * `chooseAiAction` below is this plus a seat check, and the seat check is the
 * whole difference: it exists so `advanceAiTurns` can never take a human's
 * turn. A SPECTATOR asks a different question — "play this bout for me" — about
 * seats that are deliberately human, and answering it through the AI-seat door
 * would have meant either lying about the seat or bypassing the guard at the
 * call site. Added 2026-09-12 for `tools/arena/main.js`'s spectate mode, which
 * had invented its own choice policy for want of this and never reached a swing.
 *
 * It suggests and never applies, so the caller keeps the turn.
 */
export function suggestAction(battle, actorId = currentCombatant(battle)?.id) {
  const actor = combatantById(battle, actorId);
  if (!actor) throw new BattleError(`No combatant ${actorId} to suggest an action for.`);
  const options = legalActions(battle, actor.id);
  return battle.rules.chooseAiAction(Object.freeze(actorView(battle, actor)), actor.id, options);
}

/** Deterministic AI. Its actions use exactly the same protocol as players. */
export function chooseAiAction(battle, actorId = currentCombatant(battle)?.id) {
  const actor = combatantById(battle, actorId);
  if (!actor || !isAiControlled(battle, actor)) {
    throw new BattleError("AI action requested for a non-AI combatant.");
  }
  return suggestAction(battle, actor.id);
}

/** Runs all consecutive AI turns; stops as soon as a human/controller is due. */
export function advanceAiTurns(battle, maximumActions = 100) {
  const actions = [];
  while (!battle.result && isAiControlled(battle, currentCombatant(battle))) {
    if (actions.length >= maximumActions) throw new BattleError("AI turn limit reached.");
    const action = { actorId: currentCombatant(battle).id, ...chooseAiAction(battle) };
    actions.push(clone(action));
    applyAction(battle, action);
  }
  return actions;
}

/* ------------------------------------------------------------------ */
/* Settlement bridge                                                   */
/* ------------------------------------------------------------------ */

export function pendingResultEvent(battle) {
  return battle.settlement.pendingResultEvent();
}

/**
 * Gate 2 of settlement. Returns true exactly once: on the acknowledgement that
 * actually settles the campaign.
 */
export function acknowledgeResultAnimation(battle, acknowledgement) {
  return battle.settlement.acknowledge(acknowledgement);
}

export function campaignSettlement(battle) {
  return battle.settlement.settled;
}

export function isCampaignSettled(battle) {
  return battle.settlement.isSettled;
}

/* ------------------------------------------------------------------ */
/* Projections                                                         */
/* ------------------------------------------------------------------ */

/** The authoritative per-combatant projection. See `combatantView`: this is a
 * superset of it, by construction and by test. */
function combatantProjection(combatant) {
  return {
    id: combatant.id,
    name: combatant.name,
    teamId: combatant.teamId,
    seatId: combatant.seatId,
    slotIndex: combatant.slotIndex,
    aiFilled: combatant.aiFilled,
    stats: { ...combatant.stats },
    loadout: { ...combatant.loadout },
    resources: projectResources(combatant.resources),
    maxHealth: combatant.maxHealth,
    health: combatant.health,
    alive: combatant.alive,
    status: [...combatant.status],
    x: combatant.x,
    y: combatant.y
  };
}

/**
 * The authoritative combat projection.
 *
 * It deliberately excludes controller identity: a host and a client that
 * disagree about who is driving a seat must still agree on combat state, and
 * reassigning a controller must not look like a desync.
 */
export function toTeamWireState(battle) {
  return {
    version: battle.version,
    seed: battle.seed,
    rngState: battle.rngState,
    rngCursor: battle.rngCursor,
    // A tape channel has no generator state — `rngState` is a constant 0 — so
    // these two fields alone let two peers holding DIFFERENT tapes agree they
    // are in sync. Added 2026-09-02; see `OrderedRngChannel.drawnDigest` for
    // why this commits to the CONSUMED prefix rather than the remainder, and
    // what that deliberately cannot detect.
    //
    // Projected ONLY in tape mode, and that asymmetry is load-bearing twice
    // over: a seeded channel's `rngState` is already a commitment to its whole
    // stream, so the digest would be redundant; and their PRESENCE is itself
    // the discriminator between a tape peer and a seeded peer that happens to
    // sit at state 0 and cursor 0, who would otherwise hash identically. It
    // also leaves every seeded battle's projection byte-identical, so no
    // pinned hash in the suite moves.
    ...(battle.rng.mode === "tape"
      ? { rngMode: "tape", rngDrawn: battle.rng.drawnDigest }
      : {}),
    rules: {
      id: battle.rulesDescriptor.id,
      contractVersion: battle.rulesDescriptor.contractVersion,
      verification: battle.rulesDescriptor.verification,
      runtimeVerified: battle.rulesDescriptor.runtimeVerified
    },
    teams: battle.teams.map((team) => ({
      id: team.id,
      name: team.name,
      slots: team.slots.map((slot) => ({ ...slot })),
      combatants: team.combatants.map(combatantProjection)
    })),
    initiative: [...battle.initiative],
    turnCursor: battle.turnCursor,
    turnNumber: battle.turnNumber,
    result: battle.result ? clone(battle.result) : null,
    events: clone(battle.events),
    settlement: battle.settlement.toJSON()
  };
}

/** Seat -> controller projection, kept separate from combat state on purpose. */
export function toControllerState(battle) {
  return battle.controllers.toJSON();
}

/**
 * Re-exported, not defined here: `src/team/rng.js` needs it to commit to its
 * own drawn samples and cannot import this module, which imports it.
 */
export { fnv1a };

/** Controller-independent consistency check for host-authoritative play. */
export function combatStateHash(battle) {
  return fnv1a(JSON.stringify(toTeamWireState(battle)));
}

/** Diagnostic ordered record of every RNG draw. Not part of any hash. */
export function rngJournal(battle) {
  return battle.rng.journal;
}

export function replayTeamBattle(blueprint, actions) {
  const battle = createTeamBattle(blueprint);
  for (const action of actions) applyAction(battle, action);
  return battle;
}
