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
import {
  freezeResources,
  normaliseResourceBag,
  projectResources,
  withDeclaredResources,
  writeResource
} from "./resources.js";
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
 * THE FIELDS TWO PEERS EXCHANGE PER COMBATANT, and one of the two lists the
 * version is computed FROM (the other is `TEAM_WIRE_STATE_KEYS`, below).
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
 * EVERY TOP-LEVEL KEY `toTeamWireState` CAN CARRY — the other thing the
 * version is computed from, added 2026-09-23 (owner's decision).
 *
 * **Every key the FORMAT can carry, not the keys one battle happens to.**
 * Three are conditional — `rngMode` and `rngDrawn` in tape mode only,
 * `battleResources` only when the rule set declares a pool — and all three
 * are named here unconditionally, so every battle of one build advertises one
 * version whatever its rule set or RNG mode. See `BATTLE_STATE_VERSION` for
 * why the version is the format's rather than the battle's.
 *
 * In emission order, for the reader; the version sorts before hashing, so the
 * order carries no meaning. Guarded twice: `toTeamWireState` refuses, on every
 * call, a key this list does not name (`declaredWireState`), so a key added
 * under ANY condition fails the first test that projects a battle meeting it;
 * and `test/team-resolver.test.js` builds a battle in every mode that changes
 * the key set today and asserts the list is exactly what those battles carry,
 * so a name nothing emits fails too.
 */
export const TEAM_WIRE_STATE_KEYS = Object.freeze([
  "version", "seed", "rngState", "rngCursor",
  "rngMode", "rngDrawn", // tape mode only
  "battleResources", // only when the rule set declares a battle pool
  "rules", "teams", "initiative", "turnCursor", "turnNumber", "result",
  "events", "settlement"
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
 * Order-independent: each list is sorted before hashing, so reordering a
 * literal is not a format change and does not invalidate a peer. Adding,
 * removing or RENAMING a field is, and does.
 *
 * ► **IT HASHES THE TOP-LEVEL KEYS TOO, SINCE 2026-09-23 (owner's decision).**
 *   Until then it hashed `COMBATANT_PROJECTION_FIELDS` alone, so a key added
 *   at the TOP of the wire was invisible to it: the two tape fields
 *   (2026-09-02) and `battleResources` (`cefaf83`, SS2's crowd) each changed
 *   the format under an unchanged version, and a peer with the crowd and one
 *   without advertised one version while disagreeing from their first hash
 *   exchange. It now hashes both declared lists, as two SCOPES — a name that
 *   moves from the combatant to the battle is a format change too.
 *   **`573176825` -> `2858363730`**, measured, and every pinned
 *   `combatStateHash` in the suite moved with it, because the version is
 *   itself a field of the state that hash covers.
 *
 * ► **THE FORMAT'S KEYS, NOT ONE BATTLE'S.** The conditional keys are in
 *   `TEAM_WIRE_STATE_KEYS` unconditionally, so a battle that carries no
 *   `battleResources` advertises the same version as one that does. That is
 *   what makes the number a property of the CODE, which is what an identity
 *   has to be: it is known before any battle exists, so it can be compared
 *   before a rule set is chosen, and a sealed record's `stateVersion` names the
 *   build that wrote it rather than which features its battle used. Whether a
 *   conditional key is present in a GIVEN battle is already decided by state
 *   the hash covers (`rules.id`, the RNG mode), so a per-battle version would
 *   re-encode what the hash already says — and two builds that differ only in
 *   a key neither battle used would then share a version, the very collision
 *   this exists to prevent.
 *
 * **What it still does not see**, recorded, not decided here: the shapes BELOW
 * the top level other than a combatant's — a team entry's keys, the `rules`
 * descriptor's, a slot's, `settlement`'s, and every event's. An event's fields
 * are the rule set's (`backAttack` joined the attack event on 2026-09-12 under
 * an unchanged version), so they are not a closed list the resolver could
 * declare.
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
export const BATTLE_STATE_VERSION = deriveBattleStateVersion({
  wireStateKeys: TEAM_WIRE_STATE_KEYS,
  combatantFields: COMBATANT_PROJECTION_FIELDS
});

/**
 * The version of a wire format whose declared lists are these. Exported so a
 * test can vary one list and see the number move; `BATTLE_STATE_VERSION` is
 * this over the two lists the resolver actually declares.
 *
 * The lists are hashed as two named scopes of one JSON document, each sorted:
 * unambiguous whatever a name contains, and a name in one scope never equals
 * the same name in the other.
 */
export function deriveBattleStateVersion({ wireStateKeys, combatantFields }) {
  const shape = JSON.stringify({
    state: [...wireStateKeys].sort(),
    combatant: [...combatantFields].sort()
  });
  return Number.parseInt(fnv1a(shape), 16);
}

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
  const battleResources = declareBattleResources(rules, roster.teams.flatMap((team) => team.combatants));
  const rng = createOrderedRngChannel({ seed, tape: rngTape, journal: journalRolls });
  const battle = {
    version: BATTLE_STATE_VERSION,
    seed: seed >>> 0,
    rules,
    rulesDescriptor: describeTeamRuleSet(rules),
    teams: roster.teams,
    controllers: roster.controllers,
    /**
     * The battle's OWN resources — see `declareBattleResources`. `{}` for every
     * rule set that declares none, and then absent from the projection.
     */
    battleResources,
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

/**
 * ► **THE BATTLE'S OWN RESOURCES: ONE DECLARED, CLAMPED, HASHED POOL PER NAME
 *   THAT BELONGS TO NO COMBATANT.** Added 2026-09-22 for SS2's crowd, whose
 *   `_global.crowd_interest` is one number per bout, fed by every completed
 *   phase of both fighters and read once to scale the victory purse.
 *
 * **Why not a combatant resource.** Copying one crowd onto every gladiator is
 * N copies of one number and N-1 chances for them to disagree, and there is
 * no honest answer to "whose crowd is it". The build has one, so this does.
 *
 * **Why not a named field.** The resolver must not learn a game's nouns (the
 * reason `resources.js` exists), so it learns the one concept it already has
 * — a declared, clamped numeric pool — at a second scope, and the rule set
 * supplies the name. Every constraint `resources.js` enforces holds here
 * unchanged, because the declaration goes through `normaliseResourceBag` and
 * the write through `writeResource`: numbers only, declared at construction,
 * sorted, written only through an absolute effect (`EffectKind.BATTLE_RESOURCE`).
 *
 * `rules.openingBattleResources(views)` is OPTIONAL and is asked ONCE, after
 * every combatant is built and its opening resources declared, with a frozen
 * view of each. It returns a bag declaration — the shape a blueprint's
 * `resources` takes: `{ [name]: number | { value, min, max } }`. A rule set
 * with no hook, or one returning `{}`, declares none; its battles project no
 * `battleResources` key at all, so every such battle keeps the projection and
 * the hash it always had.
 */
function declareBattleResources(rules, combatants) {
  if (typeof rules.openingBattleResources !== "function") return {};
  const declaration = rules.openingBattleResources(combatants.map(combatantView));
  if (declaration === null || typeof declaration !== "object" || Array.isArray(declaration)) {
    throw new BattleError(
      `Rule set ${rules.id} returned something other than a plain object from openingBattleResources(); ` +
      "it declares a bag, { [name]: number | { value, min, max } }."
    );
  }
  return normaliseResourceBag(declaration);
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
    // The battle's own pools, frozen — and projected by `toTeamWireState`
    // whenever any is declared, so the soundness invariant above holds at this
    // scope too. `{}` for a rule set that declares none.
    battleResources: freezeResources(battle.battleResources),
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
    if (effect.kind === EffectKind.BATTLE_RESOURCE) {
      // No combatant: the pool is the battle's. Clamped and refused exactly as
      // a combatant's resource is, by the same writer.
      writeResource({ resources: battle.battleResources }, effect.resource, effect.to, {
        ruleSetId: battle.rules.id,
        owner: "the battle"
      });
      continue;
    }
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
 *
 * ► **EVERY TOP-LEVEL KEY IT RETURNS MUST BE IN `TEAM_WIRE_STATE_KEYS`, AND
 *   THAT IS CHECKED HERE, ON EVERY CALL** — see `declaredWireState`.
 */
export function toTeamWireState(battle) {
  return declaredWireState({
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
    // ► **THE BATTLE'S OWN POOLS, PROJECTED ONLY WHEN ANY IS DECLARED** — the
    //   tape fields' rule above, for the same reason: every battle whose rule
    //   set declares none keeps a byte-identical projection, so no pin taken
    //   under such a rule set moves. Added 2026-09-22 (SS2's `crowd_interest`).
    //   Whether it is present is a function of the rule set, whose id is in
    //   this projection, so two peers running one rule set agree on the key.
    //
    //   ► ~~**`BATTLE_STATE_VERSION` DOES NOT SEE THIS KEY**, because it
    //     hashes `COMBATANT_PROJECTION_FIELDS` only~~ **— IT DOES SINCE
    //     2026-09-23 (owner's decision).** The version hashes
    //     `TEAM_WIRE_STATE_KEYS` too, which names this key whether or not a
    //     given battle carries it, so a build that can emit it and one that
    //     cannot advertise different versions. It moved every pin in the
    //     suite, as this note said it would.
    ...(Object.keys(battle.battleResources).length > 0
      ? { battleResources: projectResources(battle.battleResources) }
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
  });
}

const DECLARED_WIRE_STATE_KEYS = new Set(TEAM_WIRE_STATE_KEYS);

/**
 * Refuses a projection carrying a top-level key `TEAM_WIRE_STATE_KEYS` does not
 * name, because `BATTLE_STATE_VERSION` would not see it.
 *
 * ► **WHY AT RUNTIME AND NOT ONLY IN A TEST.** The suite's key-list test builds
 *   one battle per mode that changes the key set today (tape, a battle pool).
 *   A key added under a NEW condition — measured with one emitted only after
 *   turn 1 — passes that test untouched, because none of its battles meets the
 *   condition. Checked here, the same key fails every test anywhere that
 *   projects such a battle, which is where its author's own tests will be. It
 *   costs one pass over fifteen keys, beside a projection that deep-clones the
 *   whole event log.
 */
function declaredWireState(state) {
  for (const key of Object.keys(state)) {
    if (!DECLARED_WIRE_STATE_KEYS.has(key)) {
      throw new BattleError(
        `toTeamWireState carries "${key}", which TEAM_WIRE_STATE_KEYS does not declare, so ` +
        "BATTLE_STATE_VERSION cannot see it. Declare it there (see the note on BATTLE_STATE_VERSION)."
      );
    }
  }
  return state;
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
