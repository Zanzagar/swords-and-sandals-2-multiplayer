/**
 * Presentation commands -> an immutable SCENE, which is the thing a painter
 * can draw without knowing anything about combat.
 *
 * WHY THIS MODULE EXISTS AT ALL. `src/adapter/presentation.js` has emitted
 * ordered, JSON-safe presentation commands since long before anything could
 * draw them, and until now its only callers were tests. That is the same shape
 * the campaign record was in before 2026-09-07 — written and never read back —
 * and closing that gap is what found the defects in the record's format. This
 * module is the read-back.
 *
 * THE DIVISION OF LABOUR, measured rather than assumed:
 *
 * - the command stream is complete for **what to show** and empty of **when**.
 *   No command carries a duration, a frame number or a completion signal, and
 *   `place-clip` is constructed at exactly one site — inside
 *   `presentArenaConstruction` — so *nothing in the stream ever moves a clip
 *   again after the arena is built*. All motion, tweening and timing therefore
 *   belong to the renderer, and this module is where that boundary is drawn.
 *
 *   ► **THE SECOND HALF OF THAT IS NOW FALSE, AND IT IS CORRECTED HERE RATHER
 *     THAN ABOVE IT (2026-09-11).** `move-clip` exists, and it moves a clip
 *     after the arena is built. What survives, and is the part that mattered:
 *     the stream still carries no TIME. A `move-clip` says where a figure ends
 *     up and never how long it takes to get there, so the tween is still the
 *     renderer's — see `travelAt` in `timeline.js`. What changed is that the
 *     DESTINATION is no longer the renderer's to invent; it is the resolver's,
 *     and it arrives as data like every other bound field.
 *
 *     `place-clip` is still constructed at exactly one site. `move-clip` is a
 *     separate kind precisely because folding a partial `place-clip` here
 *     would set `y` to `undefined` and make the figure vanish.
 * - so a scene holds two kinds of field: **bound** ones, which came from a
 *   command and may never be invented here, and **presentational** ones, which
 *   are this module's own and are marked as such.
 *
 * WHAT THIS MODULE REFUSES TO DO:
 *
 * - **It computes no combat value.** Health, maxHealth, alive and status are
 *   copied out of `panel-refresh` verbatim. There is no arithmetic here beyond
 *   ordering by depth.
 * - **It never drops `labelProvenance`.** Every clip label carries map-named /
 *   assumed / placeholder, and that flag is the only thing distinguishing a
 *   label the battle map names from one this project guessed. A scene that
 *   swallowed it would let a rendered arena present a guess as measured, which
 *   is the failure mode this whole repository exists to prevent.
 * - **It never silently discards an `unmapped` command.** They accumulate in
 *   `scene.unmapped` so a surface can show them. An arena that renders nothing
 *   for an event the adapter could not map looks identical to an arena where
 *   nothing happened.
 * - **It never invents geometry.** A combatant with no `place-clip` has
 *   `placed: false` and no coordinates, rather than a default position.
 */

export class SceneError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = new.target.name;
  }
}

/**
 * Command kinds this module understands. Deliberately a local list rather than
 * an import of `CommandKind`: a scene that silently ignored a NEW command kind
 * would be the same defect as swallowing an `unmapped`, so an unknown kind
 * throws and names itself.
 */
const HANDLED = Object.freeze([
  "attach-clip",
  "place-clip",
  "move-clip",
  "bind-globals",
  "clip-goto",
  "panel-refresh",
  "overlay-goto",
  "arena-goto",
  "unmapped"
]);

const EMPTY_ACTOR = Object.freeze({
  combatantId: null,
  instanceName: null,
  instancePath: null,
  depth: null,
  vanillaNative: null,
  shadow: null,
  placed: false,
  x: null,
  y: null,
  facing: null,
  xscale: null,
  yscale: null,
  geometryAuthored: null,
  clip: null,
  panel: null,
  /**
   * The step this actor is in the middle of, from the last `move-clip`, or
   * null. `x` above is already the DESTINATION — the fold is not a tween — and
   * this is the origin the surface interpolates from while the gait animation
   * runs. It is left in place once the step is over: a stale `motion` whose
   * `to` equals the current `x` interpolates to a standstill, which is exactly
   * what a figure that has finished walking should do.
   */
  motion: null
});

function frozenActor(actor) {
  return Object.freeze({ ...actor });
}

/** An empty scene. Every field is present so a painter never branches on absence. */
export function emptyScene() {
  return Object.freeze({
    actors: Object.freeze({}),
    /** Combatant ids in DRAW ORDER: ascending depth, ties broken by id. */
    drawOrder: Object.freeze([]),
    globals: null,
    overlayLabel: null,
    arenaLabel: null,
    /** The completion token the surface must hand back to settle. Null until a result. */
    completionToken: null,
    unmapped: Object.freeze([]),
    /** The highest resolver sequence any command in this scene carried. */
    sequence: 0
  });
}

function withDrawOrder(actors) {
  const ids = Object.keys(actors).sort((left, right) => {
    const leftDepth = actors[left].depth;
    const rightDepth = actors[right].depth;
    if (leftDepth === rightDepth) return left < right ? -1 : 1;
    if (leftDepth === null) return -1;
    if (rightDepth === null) return 1;
    return leftDepth - rightDepth;
  });
  return Object.freeze(ids);
}

function actorFor(actors, combatantId) {
  return actors[combatantId] ?? { ...EMPTY_ACTOR, combatantId };
}

/**
 * Folds one batch of presentation commands into a new scene.
 *
 * Pure: the input scene is never mutated and the output is frozen all the way
 * down. Call it with the construction batch first, then once per drained batch.
 *
 * @param {object} scene the scene so far, from `emptyScene()`
 * @param {Iterable<object>} commands presentation commands, in emitted order
 * @returns {object} a new frozen scene
 */
export function applyCommands(scene, commands) {
  if (!scene || typeof scene !== "object") {
    throw new SceneError("applyCommands needs a scene; start from emptyScene().");
  }
  if (!commands || typeof commands[Symbol.iterator] !== "function") {
    throw new SceneError("applyCommands needs an iterable of presentation commands.");
  }

  const actors = { ...scene.actors };
  const unmapped = [...scene.unmapped];
  let globals = scene.globals;
  let overlayLabel = scene.overlayLabel;
  let arenaLabel = scene.arenaLabel;
  let completionToken = scene.completionToken;
  let sequence = scene.sequence;

  for (const command of commands) {
    if (!command || typeof command.kind !== "string") {
      throw new SceneError("A presentation command must be an object carrying a string `kind`.");
    }
    if (!HANDLED.includes(command.kind)) {
      throw new SceneError(
        `Unknown presentation command kind "${command.kind}". A scene that ignored it would draw an ` +
        "arena missing whatever it meant, and look identical to one where nothing happened."
      );
    }
    if (Number.isFinite(command.sequence)) sequence = Math.max(sequence, command.sequence);

    switch (command.kind) {
      case "attach-clip": {
        const actor = actorFor(actors, command.combatantId);
        // The shadow is a second attach for the same combatant. It is told
        // apart by its linkage, never by name-matching, because ally instance
        // names are authored and a name test would be a guess about them.
        const isShadow = typeof command.linkage === "string" && command.linkage.endsWith("_shadow");
        actors[command.combatantId] = frozenActor(
          isShadow
            ? {
                ...actor,
                shadow: Object.freeze({
                  instanceName: command.instanceName,
                  depth: command.depth,
                  linkage: command.linkage
                })
              }
            : {
                ...actor,
                instanceName: command.instanceName,
                instancePath: `${command.parentPath}.${command.instanceName}`,
                depth: command.depth,
                vanillaNative: command.vanillaNative,
                linkage: command.linkage
              }
        );
        break;
      }

      case "place-clip": {
        const actor = actorFor(actors, command.combatantId);
        actors[command.combatantId] = frozenActor({
          ...actor,
          placed: true,
          x: command.x,
          y: command.y,
          facing: command.facing,
          xscale: command.xscale,
          yscale: command.yscale,
          geometryAuthored: command.geometryAuthored
        });
        break;
      }

      case "move-clip": {
        const actor = actorFor(actors, command.combatantId);
        // ONLY `x` and `motion`. Not `y`, `facing`, `xscale`, `yscale`,
        // `geometryAuthored` or `placed` — that is the whole reason this is
        // not a `place-clip`, and the reason it is spelled out rather than
        // spread: a future field added to `place-clip`'s fold must not
        // silently start being overwritten by a step sideways.
        //
        // `placed` is deliberately NOT set true. A combatant that never got a
        // `place-clip` has no `y`, no facing and no scale, and a painter that
        // drew it would be inventing five fields to use one. The move is still
        // recorded, so the scene and the resolver never disagree about where
        // the figure is — it simply cannot be drawn yet.
        actors[command.combatantId] = frozenActor({
          ...actor,
          x: command.to,
          motion: Object.freeze({
            from: command.from,
            to: command.to,
            sequence: command.sequence,
            actionToken: command.actionToken ?? null
          })
        });
        break;
      }

      case "bind-globals":
        globals = Object.freeze({ ...command.globals, sequence: command.sequence });
        break;

      case "clip-goto": {
        const actor = actorFor(actors, command.combatantId);
        actors[command.combatantId] = frozenActor({
          ...actor,
          clip: Object.freeze({
            label: command.label,
            // Carried, never dropped: this is the only signal separating a
            // label the map names from one this project guessed.
            provenance: command.labelProvenance,
            role: command.role,
            sequence: command.sequence,
            actionToken: command.actionToken ?? null
          })
        });
        break;
      }

      case "panel-refresh": {
        const actor = actorFor(actors, command.combatantId);
        actors[command.combatantId] = frozenActor({
          ...actor,
          panel: Object.freeze({
            root: command.panelRoot,
            vanillaNative: command.vanillaNativePanel,
            widgets: Object.freeze(command.widgets.map((widget) => Object.freeze({ ...widget }))),
            // Verbatim. Nothing here recomputes a combat value.
            values: Object.freeze({ ...command.values }),
            sequence: command.sequence
          })
        });
        break;
      }

      case "overlay-goto":
        overlayLabel = command.label;
        completionToken = command.completionToken ?? completionToken;
        break;

      case "arena-goto":
        arenaLabel = command.label;
        completionToken = command.completionToken ?? completionToken;
        break;

      case "unmapped":
        unmapped.push(Object.freeze({
          sequence: command.sequence ?? null,
          reason: command.reason,
          detail: Object.freeze({ ...command.detail }),
          actionToken: command.actionToken ?? null
        }));
        // A draw carries its completion token on an `unmapped`, because there
        // is no arena transition to read one off. Losing it here would leave a
        // decided battle that can never settle.
        if (command.detail && command.detail.completionToken !== undefined) {
          completionToken = command.detail.completionToken;
        }
        break;

      default:
        break;
    }
  }

  const frozenActors = Object.freeze({ ...actors });
  return Object.freeze({
    actors: frozenActors,
    drawOrder: withDrawOrder(frozenActors),
    globals,
    overlayLabel,
    arenaLabel,
    completionToken,
    unmapped: Object.freeze(unmapped),
    sequence
  });
}

/**
 * Every clip label the scene is currently showing, with its provenance.
 *
 * A surface is expected to render this somewhere a player can see. The project
 * decided long ago that a playable demo is "the easiest place in the world" to
 * present a guess as a measurement; a prettier surface makes that easier still,
 * not harder.
 */
export function labelProvenanceSummary(scene) {
  const counts = { "map-named": 0, assumed: 0, placeholder: 0 };
  for (const id of scene.drawOrder) {
    const clip = scene.actors[id].clip;
    if (!clip) continue;
    if (counts[clip.provenance] === undefined) counts[clip.provenance] = 0;
    counts[clip.provenance] += 1;
  }
  return Object.freeze(counts);
}
