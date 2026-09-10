/**
 * Event binding: resolved state -> ordered presentation commands.
 *
 * Presentation is strictly downstream of resolved state, and the module
 * boundary is what enforces it rather than a convention:
 *
 * - the only combat input is a **wire projection** (`toTeamWireState(battle)`),
 *   a plain JSON structure. A live battle is rejected, so there is nothing here
 *   to mutate even by accident;
 * - the output is **data**: plain, JSON-safe command records. No callbacks, no
 *   handles, no clip references. A host executes them; this module never does;
 * - no command carries a combat value this module computed. Damage, hit, and
 *   status all come from the resolver's own events and projections.
 *
 * The one decision this module *does* make is which animation label to play,
 * and even that is injected: the label vocabulary belongs to the rule set (see
 * `docs/ss2-adapter-contract.md`), so bindings are a parameter. Two are
 * shipped, both explicitly unverified — the promoted goldens verify the
 * resolver path, not the clip labels.
 *
 * Individual knockouts deliberately produce a death animation and **nothing
 * else**: no overlay label, no arena label, no reward UI. Vanilla's `death()`
 * jumps straight to `combatwon`/`combatlost` on the first knockout, which is
 * exactly what a multi-slot battle must not do (battle map, "Battle result and
 * reward callbacks": "It must not run vanilla win settlement after the first
 * individual knockout").
 *
 * ---
 *
 * **PER-ACTION ANIMATION ACKNOWLEDGEMENT — the part of it that lives here.**
 *
 * This was a stated, deliberately unfilled gap until 2026-09-07. The hazard it
 * names is real: a host that submits action N+1 while action N's timeline is
 * still running rebinds `_global.attacker` / `_global.defender` /
 * `game_attacker` / `game_defender` underneath it, and vanilla's mapped
 * functions read those globals rather than parameters captured at dispatch.
 *
 * The seam has four parts. Part 1 is here — **every command bound from an
 * event carries an `actionToken` naming the resolved action it belongs to** —
 * and parts 2 and 3 are the gate in `src/adapter/action-gate.js`. Part 4, what
 * happens when a surface never reports, is a host policy decision and is
 * deliberately implemented nowhere: see that module's header.
 *
 * **A TOKEN IS NOT `event.sequence`, and the old sketch here said it was.**
 * "The resolver sequence is already unique per action and would do" was wrong.
 * `addEvent` stamps `sequence: battle.events.length + 1`, so it is unique per
 * EVENT; one action emits one, two or four of them (measured over 5,708
 * actions — see `action-gate.js`), so a token read off `event.sequence` would
 * split a killing blow into four actions.
 *
 * The boundary that does work is `lastResolvedAction(battle).firstEventSequence`,
 * which the resolver already computes. It is NOT in `toTeamWireState`, and
 * that is load-bearing: `combatStateHash` hashes the whole projection, so
 * projecting an action boundary would move every pinned battle hash. **So the
 * boundary is carried IN by the caller** — `actionBoundaries` here,
 * `drain(wire, { actionBoundary })` on the binder. A caller that supplies none
 * gets `actionToken: null` on every command, which says "nobody told us where
 * this action began" rather than inventing an answer. It is null, not absent,
 * so a host cannot read a missing field as "no gating needed".
 *
 * ► **THIS PARAGRAPH USED TO END "and is never derived from the wire", AND
 *   THAT WAS WRONG — corrected 2026-09-10.** The boundary is *exactly*
 *   `toTeamWireState(battle).events.length + 1` taken immediately BEFORE
 *   `applyAction`, because `addEvent` (`src/team/resolver.js:236`) is the sole
 *   appender to `battle.events` and stamps `sequence = events.length + 1`, so
 *   the sequences are dense. Measured here, not argued: 0 mismatches over 193
 *   actions across 1v1, 2v2 and 3v3 under `ss2TeamRules`, pinned by
 *   `the action boundary IS derivable from the wire, prospectively` in
 *   `test/action-animation-gate.test.js`. **The reason it is not projected is
 *   HASH STABILITY, never underivability**, and the distinction matters to a
 *   host: a caller inside the action loop can always compute the boundary for
 *   itself and needs no resolver trace. What is genuinely impossible is
 *   recovering boundaries RETROSPECTIVELY from a finished event log — four
 *   events at 7,8,9,10 are indistinguishable from four one-event actions.
 */

import { EliminationEvent } from "../team/elimination.js";
import { BATTLE_RESULT_PENDING_TYPE } from "../team/settlement.js";
import { bindingPlanFor, resultLabelsFor } from "./slot-layout.js";
import { GLADIATOR_CLIP_ROOT, HERO_SIDE, isPlainVanillaObject } from "./vanilla-fields.js";

export class PresentationError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = new.target.name;
  }
}

export const CommandKind = Object.freeze({
  ATTACH_CLIP: "attach-clip",
  PLACE_CLIP: "place-clip",
  BIND_GLOBALS: "bind-globals",
  CLIP_GOTO: "clip-goto",
  PANEL_REFRESH: "panel-refresh",
  OVERLAY_GOTO: "overlay-goto",
  ARENA_GOTO: "arena-goto",
  UNMAPPED: "unmapped"
});

/** Provenance of a chosen animation label. Never "runtime-verified". */
export const LabelProvenance = Object.freeze({
  /** The battle map names this exact label string. */
  MAP_NAMED: "map-named",
  /** The map names the family but not this string, or leaves the rule unstated. */
  ASSUMED: "assumed",
  /** Belongs to the placeholder vocabulary, which is not SS2's vocabulary. */
  PLACEHOLDER: "placeholder"
});

/** Map, "UI and movie-clip map": `hero_battle`, export 1241, used for both sides. */
export const FIGHTER_LINKAGE = "hero_battle";

/* ------------------------------------------------------------------ */
/* Animation bindings                                                  */
/* ------------------------------------------------------------------ */

const label = (value, provenance) => Object.freeze({ label: value, provenance });

/**
 * PLACEHOLDER vocabulary bindings (melee / ranged / spell / rest).
 *
 * This is not SS2's action vocabulary — the licensed build's is power, normal,
 * quick, bash, taunt, bombard, snipe, grievous. These exist so the shipped
 * placeholder rule set can drive a presentation surface end to end.
 */
export const PLACEHOLDER_ANIMATION_BINDINGS = Object.freeze({
  id: "placeholder-vocabulary",
  verification: "placeholder",
  note: "Placeholder action vocabulary bound to map-named clip labels. Not SS2 parity.",
  action(event) {
    switch (event.type) {
      case "melee":
      case "ranged":
        return Object.freeze({
          actor: label(event.type === "ranged" ? "snipe" : "attack5", LabelProvenance.PLACEHOLDER),
          target: event.hit ? label("hurt5", LabelProvenance.PLACEHOLDER) : label("Block", LabelProvenance.MAP_NAMED)
        });
      case "spell":
        return Object.freeze({
          actor: label("cast", LabelProvenance.PLACEHOLDER),
          target: label("burning", LabelProvenance.PLACEHOLDER)
        });
      case "heal":
        return Object.freeze({ actor: label("cast", LabelProvenance.PLACEHOLDER), target: null });
      case "rest":
        return Object.freeze({ actor: label("rest", LabelProvenance.MAP_NAMED), target: null });
      default:
        return null;
    }
  },
  defeated() {
    return label("death", LabelProvenance.PLACEHOLDER);
  }
});

/** Map, "Attack roll dispatcher": which directions are the ranged band. */
const RANGED_DIRECTIONS = Object.freeze(new Set([21, 22, 23]));
/** Map `+0x2093`–`+0x20d6`: the ranged band's hurt label is `direction - 20`. */
const RANGED_DIRECTION_OFFSET = 20;

/**
 * SS2 vocabulary bindings, derived from the static map only.
 *
 * NOT runtime-verified. The promoted goldens in
 * `test/fixtures/ss2-1v1-golden/` verify the roll order, the mutation order,
 * and the result transition — they do not observe a single clip label. Every
 * entry below carries its own provenance and the emitted command carries it
 * onward, so a consumer can always tell a map-named label from a guess.
 */
export const SS2_STATIC_MAP_BINDINGS = Object.freeze({
  id: "ss2-static-map",
  verification: "static-map",
  note:
    "Derived from docs/integration/ss2-battle-map.md, 'UI and movie-clip map' and 'Hit and damage path'. " +
    "No capture has observed a clip label; every entry is map-named at best.",
  action(event) {
    const direction = Number(event.attackDirection);

    // ► SELF-TARGETED ACTIONS USED TO FALL THROUGH TO THE ATTACK BRANCH, and
    //   that was wrong twice over (found 2026-09-10 by watching the browser
    //   arena, then measured over 360 bouts / 158,317 commands):
    //
    //   1. the ACTOR played `Standing` — the idle clip — because
    //      `attackLabel(NaN)` returns it. A resting gladiator stood still; so
    //      did a burning one. 4,326 times in the sweep.
    //   2. the TARGET label `hurt5` had nowhere to play, because actor and
    //      target are one clip, so every one of those actions ALSO emitted an
    //      `unmapped`. Same 4,326: `rest` 2,929, `burning-phase` 824,
    //      `poisoned-phase` 573.
    //
    //   `presentResolvedEvents` was right to refuse to guess which of the two
    //   labels wins — the bug was upstream, here, in handing it two labels for
    //   one clip in the first place.

    // Map, "Key fighter animation labels on export 1241": `rest` (1380). The
    // map NAMES this one, so it is map-named, not assumed.
    if (event.type === "rest") {
      return Object.freeze({ actor: label("rest", LabelProvenance.MAP_NAMED), target: null });
    }

    // A condition phase: burning, frozen, poisoned, life_stolen. Detected by
    // the event carrying a `condition`, never by parsing the type string —
    // `poison` is dispatched as `poisoned-phase` and its vanilla flag is
    // `poisoned`, so the three names differ and only the fields are reliable.
    //
    // The label is the build's own flag name, and it is ASSUMED: the map
    // records "condition effects (1911–2004)" as a frame RANGE and names no
    // label inside it — exactly the position the death variants are in.
    if (typeof event.condition === "string" && event.condition.length > 0) {
      const conditionLabel = typeof event.vanillaLabel === "string" && event.vanillaLabel.length > 0
        ? event.vanillaLabel
        : event.condition;
      return Object.freeze({ actor: label(conditionLabel, LabelProvenance.ASSUMED), target: null });
    }

    if (event.hit === false) {
      // Map, "Attack roll dispatcher": "A miss calls `defender_blocked()`."
      return Object.freeze({ actor: attackLabel(direction), target: label("Block", LabelProvenance.MAP_NAMED) });
    }
    switch (event.dispatchedMethod) {
      case "taunt":
        // Map: `taunt`/`taunted` at frames 1482/1512 — the actor taunts, the target is taunted.
        return Object.freeze({
          actor: label("taunt", LabelProvenance.MAP_NAMED),
          target: label("taunted", LabelProvenance.MAP_NAMED)
        });
      case "grievous":
        // Map: direction 30 dispatches `defender_hurt("grievous")`; `knockback` is frame 1428.
        return Object.freeze({ actor: attackLabel(direction), target: label("knockback", LabelProvenance.MAP_NAMED) });
      default:
        return Object.freeze({ actor: attackLabel(direction), target: hurtLabel(direction) });
    }
  },
  defeated(event) {
    // Map, "Defeat gate and death dispatch": death(clip, how_died) with
    // how_died in slain / yield / taunt / arrow / grievous. That these strings
    // are ALSO clip labels is an assumption; the map records "death variants
    // (585-1083)" without naming any of them.
    const howDied = typeof event.howDied === "string" ? event.howDied : "slain";
    return label(howDied, LabelProvenance.ASSUMED);
  }
});

function attackLabel(direction) {
  // Map: "attack directions 1-12 (190-360)". The frame range is recorded; the
  // label strings are not, so the naming is assumed.
  if (!Number.isFinite(direction)) return label("Standing", LabelProvenance.MAP_NAMED);
  if (direction === 20) return label("taunt", LabelProvenance.MAP_NAMED);
  if (direction === 21) return label("bombard", LabelProvenance.MAP_NAMED);
  if (direction === 22) return label("snipe", LabelProvenance.MAP_NAMED);
  return label(`attack${direction}`, LabelProvenance.ASSUMED);
}

function hurtLabel(direction) {
  // Map, "Attack roll dispatcher" (`docs/integration/ss2-battle-map.md:1471-1473`):
  // the animation label is `"hurt" + attack_direction` (`+0x2086`), REWRITTEN to
  // `"hurt" + (attack_direction - 20)` for directions 21–23
  // (`+0x2093`–`+0x20d6`), and replaced by `knockback` at direction 30
  // (`+0x20dd`–`+0x20ec`, reached here through `dispatchedMethod: "grievous"`).
  //
  // ► THIS FUNCTION USED TO EMIT `hurt21`/`hurt22`/`hurt23` AND MARK THEM
  //   `ASSUMED`, ON THE STRENGTH OF A `MAP_SILENCE` ENTRY THAT SAID THE MAP
  //   GAVE THE PHRASE "adjusted for ranged directions" "without giving the
  //   adjustment". The map gives it, with byte offsets, one sentence later —
  //   the silence entry quoted the summary and stopped reading. So the label
  //   was wrong AND its provenance understated the evidence, and
  //   `test/ss2-adapter.test.js` pinned the wrong value, which is why the
  //   suite was green. Corrected 2026-09-10; the silence entry is gone and
  //   `the ranged hurt band is rewritten exactly as the map's byte offsets
  //   say` pins the rule instead.
  //
  // The rewrite makes the ranged band REUSE the melee hurt animations: a
  // bombard (21) plays `hurt1`, the same clip a direction-1 melee hit plays.
  // That is the build's own arithmetic, not a simplification made here.
  if (!Number.isFinite(direction)) return label("hurt5", LabelProvenance.ASSUMED);
  if (RANGED_DIRECTIONS.has(direction)) {
    return label(`hurt${direction - RANGED_DIRECTION_OFFSET}`, LabelProvenance.MAP_NAMED);
  }
  return label(`hurt${direction}`, LabelProvenance.MAP_NAMED);
}

/* ------------------------------------------------------------------ */
/* Projection guard                                                    */
/* ------------------------------------------------------------------ */

const LIVE_BATTLE_KEYS = Object.freeze(["rng", "controllers", "settlement", "rulesDescriptor"]);

/**
 * Refuses anything that is not a plain combat projection. Passing a live
 * battle here would be the one way presentation could reach mutable state, so
 * it is rejected by shape rather than trusted not to be misused.
 */
export function assertCombatProjection(wire) {
  if (!isPlainVanillaObject(wire) || !Array.isArray(wire.teams)) {
    throw new PresentationError("Presentation needs a combat projection: toTeamWireState(battle).");
  }
  for (const key of LIVE_BATTLE_KEYS) {
    if (wire[key] !== undefined && typeof wire[key] === "object" && typeof wire[key]?.toJSON === "function") {
      throw new PresentationError(
        `Presentation was handed a live battle (it carries ${key}). Pass toTeamWireState(battle) instead.`
      );
    }
  }
  if (typeof wire.rules === "function" || typeof wire.rules?.resolveAction === "function") {
    throw new PresentationError("Presentation was handed a live battle carrying a rule set. Pass the projection.");
  }
  return wire;
}

function combatantIndex(wire) {
  return new Map(wire.teams.flatMap((team) => team.combatants.map((combatant) => [combatant.id, combatant])));
}

/* ------------------------------------------------------------------ */
/* Arena construction                                                  */
/* ------------------------------------------------------------------ */

/**
 * The six-slot arena build. Slot 0 of each side reproduces the vanilla
 * construction exactly (linkage, depth, position, facing, mirrored scale);
 * every further slot uses the authored band from `slot-layout.js`.
 *
 * The clip scale is read from the vanilla record's `physical_size`. It is not
 * computed here: `physical_size = 80 + round(strength / 1.5)` is part of
 * `battlevalues` (map, "Combatant state objects"), which is a formula and
 * therefore rule-set work. Absent, the command carries `scale: null`.
 */
export function presentArenaConstruction(layout, { mirrors = new Map() } = {}) {
  const mirrorFor = (id) => (mirrors instanceof Map ? mirrors.get(id) : mirrors?.[id]) ?? null;
  const commands = [];
  for (const placement of layout.placements) {
    commands.push(Object.freeze({
      kind: CommandKind.ATTACH_CLIP,
      combatantId: placement.combatantId,
      parentPath: GLADIATOR_CLIP_ROOT,
      linkage: FIGHTER_LINKAGE,
      instanceName: placement.instanceName,
      depth: placement.depth,
      vanillaNative: placement.vanillaNative
    }));
    commands.push(Object.freeze({
      kind: CommandKind.ATTACH_CLIP,
      combatantId: placement.combatantId,
      parentPath: GLADIATOR_CLIP_ROOT,
      linkage: `${placement.side}_shadow`,
      instanceName: placement.shadowInstanceName,
      depth: placement.shadowDepth,
      vanillaNative: placement.vanillaNative
    }));
    const size = mirrorFor(placement.combatantId)?.fields?.physical_size;
    const scale = Number.isFinite(size) ? size : null;
    commands.push(Object.freeze({
      kind: CommandKind.PLACE_CLIP,
      combatantId: placement.combatantId,
      instancePath: placement.instancePath,
      x: placement.x,
      y: placement.y,
      facing: placement.facing,
      // Map, "Battle entry" step 5: the villain's horizontal scale is mirrored.
      xscale: scale === null ? null : (placement.side === HERO_SIDE ? scale : -scale),
      yscale: scale,
      geometryAuthored: placement.geometryAuthored
    }));
  }
  return Object.freeze(commands);
}

/* ------------------------------------------------------------------ */
/* Event binding                                                       */
/* ------------------------------------------------------------------ */

function panelRefresh(sequence, placement, combatant) {
  return Object.freeze({
    kind: CommandKind.PANEL_REFRESH,
    sequence,
    combatantId: combatant.id,
    panelRoot: placement.panel.root,
    vanillaNativePanel: placement.panel.vanillaNative,
    widgets: placement.panel.widgets.map((widget) => ({ ...widget })),
    // Resolved values, read from the projection. Nothing is derived here.
    values: Object.freeze({
      health: combatant.health,
      maxHealth: combatant.maxHealth,
      alive: combatant.alive,
      status: [...combatant.status]
    })
  });
}

function clipGoto(sequence, placement, chosen, role) {
  return Object.freeze({
    kind: CommandKind.CLIP_GOTO,
    sequence,
    role,
    combatantId: placement.combatantId,
    instancePath: placement.instancePath,
    label: chosen.label,
    labelProvenance: chosen.provenance
  });
}

/**
 * Normalises the caller-supplied action boundaries.
 *
 * Each entry is one resolved action's `lastResolvedAction(battle).firstEventSequence`.
 * They must be positive integers in strictly ascending order, because an
 * action that began at a lower sequence than the one before it is not a thing
 * the resolver can produce, and silently sorting the caller's list would hide
 * a host that had lost track of its own action order.
 */
function assertActionBoundaries(actionBoundaries) {
  if (!Array.isArray(actionBoundaries)) {
    throw new PresentationError(
      "actionBoundaries must be an array of resolver sequence numbers, one per resolved action."
    );
  }
  let previous = 0;
  for (const boundary of actionBoundaries) {
    if (!Number.isInteger(boundary) || boundary <= 0) {
      throw new PresentationError(
        `An action boundary is a positive integer resolver sequence, not ${String(boundary)}.`
      );
    }
    if (boundary <= previous) {
      throw new PresentationError(
        `Action boundaries must ascend strictly; ${boundary} follows ${previous}. ` +
        "Each one is an action's firstEventSequence, and the resolver stamps those in order."
      );
    }
    previous = boundary;
  }
  return actionBoundaries;
}

/**
 * Converts resolver events into ordered presentation commands.
 *
 * `actionBoundaries` is how the per-action animation token gets here. The
 * resolver's own action boundary lives on `battle.lastResolution`, which
 * `toTeamWireState` deliberately does not project because `combatStateHash`
 * covers everything it does project. Supply none and every command carries
 * `actionToken: null`.
 *
 * This used to say the boundary is "NOT derivable from `wire`". It is — see
 * the correction in this module's header. Not projected, for hash stability;
 * not the same thing as not derivable.
 *
 * @param {object} wire `toTeamWireState(battle)`
 * @param {object} options.layout from `buildArenaLayout`
 * @param {object} [options.bindings] the animation binding table
 * @param {number} [options.fromSequence] resume point; only events after it are bound
 * @param {number[]} [options.actionBoundaries] each action's `firstEventSequence`, ascending
 * @returns {{ commands: object[], nextSequence: number, actionTokens: number[] }}
 */
export function presentResolvedEvents(wire, {
  layout,
  bindings = PLACEHOLDER_ANIMATION_BINDINGS,
  fromSequence = 0,
  actionBoundaries = []
} = {}) {
  assertCombatProjection(wire);
  if (!layout || typeof layout.placementFor !== "function") {
    throw new PresentationError("Presentation needs an arena layout from buildArenaLayout().");
  }
  assertActionBoundaries(actionBoundaries);
  // The action an event belongs to is the last one that began at or before it.
  // Linear rather than clever: the boundaries ascend and so do the events, but
  // this is called with a whole event log often enough that a scan per event
  // is the honest cost of not assuming the caller's list is aligned.
  const tokenFor = (sequence) => {
    let token = null;
    for (const boundary of actionBoundaries) {
      if (boundary > sequence) break;
      token = boundary;
    }
    return token;
  };
  const combatants = combatantIndex(wire);
  const commands = [];
  let nextSequence = fromSequence;

  for (const event of wire.events ?? []) {
    if (!Number.isFinite(event.sequence) || event.sequence <= fromSequence) continue;
    nextSequence = Math.max(nextSequence, event.sequence);

    if (event.type === EliminationEvent.COMBATANT_DEFEATED) {
      // A knockout plays a death animation and nothing else. No overlay label,
      // no arena label, no reward UI: the battle may well continue.
      const placement = layout.placementFor(event.targetId);
      commands.push(clipGoto(event.sequence, placement, bindings.defeated(event), "defeated"));
      commands.push(panelRefresh(event.sequence, placement, combatants.get(event.targetId)));
      continue;
    }

    if (event.type === EliminationEvent.TEAM_ELIMINATED) {
      // Informational. The transition is driven by the result event below, so
      // a two-team draw cannot fire two conflicting arena transitions.
      continue;
    }

    if (event.type === BATTLE_RESULT_PENDING_TYPE) {
      const labels = resultLabelsFor(layout, event.winnerTeamId);
      if (labels.arenaLabel === null) {
        // A draw. There is no transition to play, and the adapter will not
        // invent one — but the acknowledgement path is not missing, only
        // different: the death animations already emitted above are the whole
        // of it, and `acknowledgedBy` says so on the record itself.
        commands.push(Object.freeze({
          kind: CommandKind.UNMAPPED,
          sequence: event.sequence,
          reason: labels.unmapped,
          detail: Object.freeze({
            eventType: event.type,
            winnerTeamId: event.winnerTeamId ?? null,
            acknowledgedBy: labels.acknowledgedBy ?? null,
            // Carried even though there is no transition to play: the surface
            // still has to hand a token back, and a draw's acknowledgement has
            // no `arena-goto` command to read one off.
            completionToken: event.completionToken
          })
        }));
        continue;
      }
      // Map, "Battle result": overlay frames 62/74 bridge combatwon/combatlost
      // to _root.arena.gotoAndPlay("combat_won"/"combat_lost").
      commands.push(Object.freeze({
        kind: CommandKind.OVERLAY_GOTO,
        sequence: event.sequence,
        label: labels.overlayLabel,
        completionToken: event.completionToken
      }));
      commands.push(Object.freeze({
        kind: CommandKind.ARENA_GOTO,
        sequence: event.sequence,
        label: labels.arenaLabel,
        completionToken: event.completionToken
      }));
      continue;
    }

    const chosen = bindings.action(event);
    if (!chosen) {
      commands.push(Object.freeze({
        kind: CommandKind.UNMAPPED,
        sequence: event.sequence,
        reason: `no animation binding for event type ${event.type} in ${bindings.id}`,
        detail: Object.freeze({ eventType: event.type })
      }));
      continue;
    }
    const actorPlacement = layout.placementFor(event.actorId);
    const selfTargeted = event.targetId != null && event.targetId === event.actorId;
    const targetPlacement = event.targetId && !selfTargeted ? layout.placementFor(event.targetId) : null;
    commands.push(Object.freeze({
      kind: CommandKind.BIND_GLOBALS,
      sequence: event.sequence,
      globals: bindingPlanFor(layout, { actorId: event.actorId, targetId: event.targetId ?? null })
    }));
    if (chosen.actor) commands.push(clipGoto(event.sequence, actorPlacement, chosen.actor, "actor"));
    if (chosen.target && targetPlacement) {
      commands.push(clipGoto(event.sequence, targetPlacement, chosen.target, "target"));
    } else if (chosen.target && selfTargeted) {
      // One clip cannot play the actor's animation and the target's at once,
      // and picking one silently would hide the choice. Reported, as an
      // unmapped label always is.
      commands.push(Object.freeze({
        kind: CommandKind.UNMAPPED,
        sequence: event.sequence,
        reason:
          `a self-targeted ${event.type} has one clip for both roles, so the target label ` +
          `${chosen.target.label} has nowhere to play`,
        detail: Object.freeze({
          eventType: event.type,
          combatantId: event.actorId,
          label: chosen.target.label,
          labelProvenance: chosen.target.provenance
        })
      }));
    }
    // Totality, the same rule `vanillaWritesForResolvedAction` step 2 applies:
    // every combatant whose panel could be stale is refreshed, not only the
    // ones the event names. An event names one actor and at most one target,
    // but an action can move anyone — a rule set that damages three foes emits
    // one event, and an action that costs the actor health names the target
    // only. Refreshing the named pair therefore left panels showing numbers
    // the resolver had already replaced, while every one of those changes
    // produced a vanilla *write*. Presentation was the half that was not total.
    //
    // The values come from the projection, so a refresh cannot carry a stale
    // number; what it costs is one command per combatant per bound event,
    // which is inert JSON a host may coalesce.
    const refreshed = new Set();
    const refresh = (placement) => {
      if (!placement || refreshed.has(placement.combatantId)) return;
      const combatant = combatants.get(placement.combatantId);
      if (!combatant) return;
      refreshed.add(placement.combatantId);
      commands.push(panelRefresh(event.sequence, placement, combatant));
    };
    refresh(targetPlacement);
    refresh(actorPlacement);
    for (const placement of layout.placements) refresh(placement);
  }

  // Stamped here rather than at each push site, because the action a command
  // belongs to is a pure function of the `sequence` it already carries — the
  // last boundary at or before it. So a knockout, its `team-eliminated` and the
  // terminal `battle-result-pending` all inherit the token of the killing blow,
  // which is the action whose timeline is actually playing.
  const tokensSeen = [];
  const stamped = commands.map((command) => {
    const actionToken = tokenFor(command.sequence);
    if (actionToken !== null && !tokensSeen.includes(actionToken)) tokensSeen.push(actionToken);
    return Object.freeze({ ...command, actionToken });
  });
  return Object.freeze({
    commands: Object.freeze(stamped),
    nextSequence,
    // The distinct tokens this batch carried, in order, so a gate can register
    // them without rescanning the commands.
    actionTokens: Object.freeze(tokensSeen)
  });
}

/**
 * A stateful cursor over `presentResolvedEvents`, so a host can drain new
 * commands after each action without rebinding the whole event log. The cursor
 * holds a sequence number and the action boundaries it has been told about —
 * no combat state.
 *
 * `drain(wire, { actionBoundary })` is how the per-action animation token gets
 * in. Pass `lastResolvedAction(battle).firstEventSequence` after each
 * `applyAction` and every command this binder emits for that action carries it.
 * Pass nothing and every command carries `actionToken: null`, because the
 * boundary is not in the wire projection and this module will not guess one —
 * see the header for why `event.sequence` is NOT that boundary.
 */
export function createPresentationBinder({ layout, bindings = PLACEHOLDER_ANIMATION_BINDINGS } = {}) {
  let cursor = 0;
  const actionBoundaries = [];
  return Object.freeze({
    get sequence() {
      return cursor;
    },
    /** The action boundaries this binder has been told about, in order. */
    get actionBoundaries() {
      return Object.freeze([...actionBoundaries]);
    },
    drain(wire, { actionBoundary } = {}) {
      if (actionBoundary !== undefined && actionBoundary !== null) {
        // Validated against the whole list, so a host that hands the same
        // boundary twice — or an older one — fails here rather than producing
        // commands stamped with a token for an action that already finished.
        assertActionBoundaries([...actionBoundaries, actionBoundary]);
        actionBoundaries.push(actionBoundary);
      }
      const result = presentResolvedEvents(wire, { layout, bindings, fromSequence: cursor, actionBoundaries });
      cursor = result.nextSequence;
      return result.commands;
    },
    reset() {
      cursor = 0;
      actionBoundaries.length = 0;
    }
  });
}
