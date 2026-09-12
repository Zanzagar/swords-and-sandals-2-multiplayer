/**
 * The browser arena's SHELL: canvas painting, input, and the animation clock.
 *
 * Everything interesting is somewhere else on purpose. This file holds only
 * what cannot be tested under `node --test` — a 2D context, DOM nodes and
 * `requestAnimationFrame` — and delegates every decision to `src/render/`,
 * which is pure data and is under the suite.
 *
 * It imports `src/` DIRECTLY over http, so the browser runs the same resolver
 * and the same adapter the tests run. There is no bundler, no build step and no
 * second copy of the engine to drift out of agreement with the first.
 *
 * ---
 *
 * **THIS IS THE FIRST HOST IN THE REPOSITORY THAT ACTUALLY WAITS.**
 *
 * `createVanillaBattleHost({ awaitAnimations: true })` makes the per-action
 * animation gate ENFORCING rather than advisory: `submit` refuses while an
 * action's timeline is unreported. Every other caller — the goldens, the replay
 * harness, the whole test suite — is headless and leaves it advisory, which is
 * correct for them and is why the enforcing path had no production exercise
 * until now.
 *
 * The consequence is that this file owns two decisions the adapter deliberately
 * refuses to make on a surface's behalf:
 *
 * 1. **when an animation is finished** — reported here from the clock, never
 *    fabricated by the adapter (`acknowledgement.js` was rewritten after it was
 *    caught satisfying its own settlement gate);
 * 2. **when to stop waiting** — `abandonReasonFor` in `src/render/timeline.js`,
 *    which is part 4 of the acknowledgement seam and was implemented nowhere
 *    until this surface existed to have a policy.
 *
 * IT DECIDES NO COMBAT. Every number on screen is copied from a `panel-refresh`
 * command or a wire projection. The only arithmetic here is layout and canvas
 * scaling: where a figure stands this frame is `figureXAt`, how it is bent is
 * `poseAt`, and both live in `src/render/` under the suite.
 */

import {
  createVanillaBattleHost,
  SS2_STATIC_MAP_BINDINGS
} from "/src/adapter/index.js";
import { ss2BattleValues, ss2Combatant, ss2TeamRules } from "/src/team/ss2-rules.js";
import {
  animationCursor,
  applyCommands,
  emptyScene,
  figureSpecFor,
  figureScaleFor,
  figureXAt,
  paintFigure,
  paintShadow,
  poseAt,
  timelineFor,
  timelinesForStep
} from "/src/render/index.js";
import { demoSide } from "/tools/arena/roster.js";

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */

const params = new URLSearchParams(location.search);
const perSide = Math.min(3, Math.max(1, Number(params.get("teams")) || 2));
const seed = Number(params.get("seed")) || 7;
/**
 * Spectate mode: both sides pick for themselves, one action at a time, THROUGH
 * THE SAME GATE a person goes through. It is not a fast-forward — `runAiTurns`
 * on the host would submit a whole bout without an animation ever playing —
 * and that is the point: it is the only way to watch the surface actually
 * keep up with the resolver.
 */
const spectate = params.get("spectate") === "1";

const host = createVanillaBattleHost({
  teams: [demoSide("red", perSide, { ss2Combatant, ss2BattleValues }), demoSide("blue", perSide, { ss2Combatant, ss2BattleValues })],
  rules: ss2TeamRules,
  bindings: SS2_STATIC_MAP_BINDINGS,
  seed,
  awaitAnimations: true
});

let scene = applyCommands(emptyScene(), host.constructArena().commands);

/** One entry per actor currently playing a timeline. */
const playing = new Map();
/** Tokens whose timelines are still running, in the order they were dispatched. */
let pendingTokens = [];
let settled = false;

const el = (id) => document.getElementById(id);
const logLines = [];

function log(message, { warn = false } = {}) {
  logLines.push({ message, warn });
  if (logLines.length > 40) logLines.shift();
  el("log").replaceChildren(
    ...logLines.slice().reverse().map((line) => {
      const node = document.createElement("div");
      node.textContent = line.message;
      if (line.warn) node.className = "warn";
      return node;
    })
  );
}

/* ------------------------------------------------------------------ */
/* The action loop                                                     */
/* ------------------------------------------------------------------ */

/**
 * Turns one submitted step into timelines, and registers what must be reported.
 *
 * A command that sets a clip label starts that actor's timeline NOW; the token
 * it carries is what the gate is waiting for, and it is reported only when the
 * longest timeline under it has actually run.
 */
function beginStep(step) {
  scene = applyCommands(scene, step.commands);

  // THE DECISION IS `timelinesForStep` in `src/render/cursor.js`, under the
  // suite — pairing a travelling gait with the `move-clip` from its own batch
  // is exactly the kind of thing that is invisible on a screenshot. This shell
  // stamps the clock and says the notices out loud.
  const { started, notices } = timelinesForStep(step.commands);
  for (const notice of notices) log(notice.reason, { warn: true });

  // The clock is stamped BEFORE the entries reach `playing`, not after: an
  // entry with no `startedAt` reads as infinitely overdue to `animationCursor`.
  // Stamped here rather than inside `timelinesForStep` so a frame that arrives
  // late does not make a timeline look overdue before it has drawn once.
  for (const entry of started.values()) entry.startedAt = performance.now();
  for (const [combatantId, entry] of started) playing.set(combatantId, entry);

  for (const token of step.actionTokens) {
    if (!pendingTokens.includes(token)) pendingTokens.push(token);
  }
  if (step.actionTokens.length === 0 && step.commands.length > 0) {
    log("this action bound commands but carried no token — nothing to wait for", { warn: true });
  }

  for (const notice of step.commands.filter((command) => command.kind === "unmapped")) {
    log(`unmapped: ${notice.reason}`, { warn: true });
  }
  render();
}

/**
 * Reports or abandons any token whose timelines have finished.
 *
 * The DECISION is `animationCursor` in `src/render/cursor.js`, under the suite;
 * this function is only the clock and the side effects. That split exists
 * because the first version of this logic lived entirely here, froze a
 * spectated bout after one action, and could not be reached by a test.
 */
function drainFinishedAnimations(now) {
  const cursor = animationCursor(pendingTokens, playing, now);
  for (const combatantId of cursor.expired) playing.delete(combatantId);

  // The surface gave up. That is a different fact from the animation having
  // finished, and the gate records it as such rather than as a report.
  if (cursor.abandon) {
    host.abandonActionAnimation(cursor.abandon.token, cursor.abandon.reason);
    pendingTokens = pendingTokens.filter((token) => token !== cursor.abandon.token);
    log(cursor.abandon.reason, { warn: true });
    renderControls();
    return;
  }

  if (cursor.finished.length === 0) return;
  for (const token of cursor.finished) host.reportActionAnimation(token);
  pendingTokens = pendingTokens.filter((token) => !cursor.finished.includes(token));
  renderControls();
}

/**
 * Settlement. The bridge refuses to settle until every fighter on the losing
 * side has had a death animation reported AND the arena label the surface
 * reached matches the one resolved state implies — a surface that reported the
 * wrong one is a desync, and it is refused rather than settled.
 */
function settleIfReady() {
  if (settled || !host.battle.result || pendingTokens.length > 0 || playing.size > 0) return;
  if (!scene.completionToken) return;

  const deaths = host.awaitingDeathAnimations();
  try {
    const outcomes = host.acknowledgeResultAnimations({
      deaths,
      arenaLabel: scene.arenaLabel,
      completionToken: scene.completionToken
    });
    settled = true;
    log(`settled: ${outcomes.length} acknowledgements, arena reached ${scene.arenaLabel}`);
  } catch (error) {
    settled = true;
    log(`settlement refused: ${error.message}`, { warn: true });
  }
  renderControls();
}

/* ------------------------------------------------------------------ */
/* Painting                                                            */
/* ------------------------------------------------------------------ */

const canvas = el("arena");
const context = canvas.getContext("2d");

/*
 * `ADVANCE_UNITS` used to live here. It moved to `src/render/timeline.js` on
 * 2026-09-11, with `figureXAt`: a constant only the shell could see is a number
 * no test can be wrong about, and this file is the one part of the renderer the
 * suite cannot reach.
 */

/**
 * Arena units -> canvas pixels, FITTED TO THE ROSTER ACTUALLY ON STAGE.
 *
 * The arena's own x runs -2100..2100 (`ARENA_X_CLAMP`), but a bout occupies a
 * tiny part of that: ±250 at 1v1, ±380 at 2v2, ±510 at 3v3. Scaling for the
 * clamp drew a correct arena two-thirds of which was empty sky — measured on
 * the first screenshot of this page, which is exactly the kind of thing only
 * looking at it can tell you. So the view fits the placements it has, with a
 * margin for the figures' own width, and 1v1 fills the stage as well as 3v3.
 */
function viewport() {
  const width = canvas.width;
  const height = canvas.height;

  let extent = 250;
  for (const combatantId of scene.drawOrder) {
    const actor = scene.actors[combatantId];
    if (actor.placed) extent = Math.max(extent, Math.abs(actor.x));
  }
  // A gladiator is about 150 arena units tall and swings about half that wide.
  const halfWidth = extent + 105;
  const scale = Math.min(width / (halfWidth * 2), height / 250);
  // The ground plane starts here. Everything above it is the arena bowl, which
  // is why the horizon sits near the middle rather than at the bottom: a bout
  // is much wider than it is tall, so fitting the width leaves vertical room,
  // and an empty sky is the wrong thing to spend it on.
  const horizon = height * 0.58;

  return {
    scale,
    horizon,
    toX: (x) => width / 2 + x * scale,
    // Arena y is 200 at the front rank and DECREASES further back, so a bigger
    // y is nearer the viewer and further down the canvas.
    toY: (y, lift) => horizon + (height - horizon) * 0.62 - (200 - y) * scale * 1.7 - lift * scale
  };
}

function drawOps(ops, view, origin) {
  // How big this figure draws. `src/render/figure.js` decides it, for the same
  // reason `figureXAt` and `timelinesForStep` live there: a number only the
  // shell can see is a number the suite cannot reach. `1` is a figure at its
  // nominal size in the front rank.
  const size = origin.size ?? 1;
  for (const operation of ops) {
    context.globalAlpha = operation.alpha ?? 1;
    if (operation.kind === "polygon") {
      context.beginPath();
      operation.points.forEach(([x, y], index) => {
        const px = view.toX(origin.x + x * size * (origin.facing === "left" ? -1 : 1));
        const py = view.toY(origin.y, y * size);
        if (index === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      });
      context.closePath();
      if (operation.fill && operation.fill !== "transparent") {
        context.fillStyle = operation.fill;
        context.fill();
      }
      if (operation.stroke) {
        context.strokeStyle = operation.stroke;
        context.lineWidth = Math.max(1, view.scale * 2);
        context.stroke();
      }
    } else if (operation.kind === "circle" || operation.kind === "ellipse") {
      const px = view.toX(origin.x + operation.x * size * (origin.facing === "left" ? -1 : 1));
      const py = view.toY(origin.y, operation.y * size);
      const rx = (operation.r ?? operation.rx) * size * view.scale;
      const ry = (operation.r ?? operation.ry) * size * view.scale;
      context.beginPath();
      context.ellipse(px, py, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
      if (operation.fill && operation.fill !== "transparent") {
        context.fillStyle = operation.fill;
        context.fill();
      }
      if (operation.stroke) {
        context.strokeStyle = operation.stroke;
        context.lineWidth = Math.max(1, view.scale * 2);
        context.stroke();
      }
    }
  }
  context.globalAlpha = 1;
}

/**
 * The arena bowl: sky, tiered stands, a crowd and the sand.
 *
 * Pure decoration, and deliberately the ONE piece of drawing that stays in the
 * shell rather than moving to `src/render/painter.js`. It has no data
 * dependency and no logic worth a test — asserting that a gradient is a
 * gradient would be theatre — whereas everything that depends on resolved
 * state or on a command is in the painter, under the suite.
 *
 * Authored original art, like every other shape this page draws.
 */
function drawArenaBowl(view) {
  const width = canvas.width;
  const height = canvas.height;
  const horizon = view.horizon;

  const sky = context.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#0f0e14");
  sky.addColorStop(1, "#2a2430");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, horizon);

  // Tiered seating, receding upward. Deterministic: the crowd is a function of
  // its own index, never of Math.random, so a screenshot is reproducible.
  const tiers = 7;
  for (let tier = tiers - 1; tier >= 0; tier -= 1) {
    const top = horizon * (0.18 + (tier / tiers) * 0.72);
    const bottom = horizon * (0.18 + ((tier + 1) / tiers) * 0.72);
    const inset = width * 0.5 * (0.035 * (tiers - 1 - tier));
    // Darker with height, so the bowl has depth instead of reading as a flat
    // pyramid — which is what the first screenshot showed.
    const depth = 1 - tier / tiers;
    const base = tier % 2 === 0 ? [58, 51, 64] : [51, 45, 58];
    context.fillStyle = `rgb(${base.map((channel) => Math.round(channel * (0.55 + depth * 0.45))).join(",")})`;
    context.beginPath();
    context.moveTo(inset, bottom);
    context.lineTo(width - inset, bottom);
    context.lineTo(width - inset - width * 0.02, top);
    context.lineTo(inset + width * 0.02, top);
    context.closePath();
    context.fill();

    const seatY = (top + bottom) / 2;
    const dot = Math.max(1.5, (bottom - top) * 0.16);
    const count = Math.floor(width / (dot * 5));
    for (let seat = 0; seat < count; seat += 1) {
      const x = inset + width * 0.02 + ((seat + 0.5) / count) * (width - 2 * inset - width * 0.04);
      // A repeating, index-derived palette: a crowd that reads as a crowd
      // without ever calling a random number generator.
      const shade = [(seat * 7 + tier * 3) % 5];
      context.fillStyle = ["#6b5f52", "#7d6a5c", "#584e60", "#6e6473", "#4f4a55"][shade];
      context.globalAlpha = 0.5 + ((seat + tier) % 3) * 0.16;
      context.beginPath();
      context.ellipse(x, seatY + ((seat + tier) % 2) * dot * 0.4, dot, dot * 1.15, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  // The barrier between the crowd and the sand.
  context.fillStyle = "#241f2a";
  context.fillRect(0, horizon - Math.max(4, view.scale * 14), width, Math.max(4, view.scale * 14));

  // The sand, lit from the front so the far edge falls away.
  const sand = context.createLinearGradient(0, horizon, 0, height);
  sand.addColorStop(0, "#4a3a2b");
  sand.addColorStop(0.35, "#6d573d");
  sand.addColorStop(1, "#836b4b");
  context.fillStyle = sand;
  context.fillRect(0, horizon, width, height - horizon);

  // The fighting line the front rank stands on, so the depth offset between
  // slot 0 and an authored ally is legible rather than implied.
  const front = view.toY(200, 0);
  context.strokeStyle = "rgba(0,0,0,0.14)";
  context.lineWidth = Math.max(1, view.scale * 2);
  context.beginPath();
  context.ellipse(width / 2, front, width * 0.46, Math.max(6, view.scale * 26), 0, 0, Math.PI * 2);
  context.stroke();
}

function combatantsById() {
  const wire = host.wire();
  return new Map(wire.teams.flatMap((team) => team.combatants).map((combatant) => [combatant.id, combatant]));
}

function render(now = performance.now()) {
  const rect = canvas.parentElement.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));

  const view = viewport();
  context.clearRect(0, 0, canvas.width, canvas.height);

  drawArenaBowl(view);

  const byId = combatantsById();
  for (const combatantId of scene.drawOrder) {
    const actor = scene.actors[combatantId];
    if (!actor.placed) continue;
    const combatant = byId.get(combatantId);
    if (!combatant) continue;
    const placement = host.layout.placementFor(combatantId);
    const figure = figureSpecFor(combatant, { side: placement.side });

    const entry = playing.get(combatantId);
    // How far through its own schedule the running timeline is. Computed once:
    // the pose and the travelled x are two readings of the same clock, and
    // computing it twice is how they drift apart.
    const at = entry ? Math.min(1, (now - entry.startedAt) / entry.timeline.durationMs) : 0;
    let pose;
    if (entry) {
      pose = poseAt(entry.timeline, at);
    } else if (!combatant.alive) {
      pose = poseAt(timelineFor("slain", { role: "defeated" }), 1);
    } else {
      const idle = timelineFor("Standing", { role: "actor" });
      pose = poseAt(idle, ((now / idle.durationMs) % 1));
    }

    // The lunge and the step, resolved into one coordinate by
    // `src/render/timeline.js` — where the suite can reach the decision, the
    // way `animationCursor` is. This shell computes no arithmetic of its own.
    const origin = {
      x: figureXAt({
        restingX: actor.x,
        facing: actor.facing,
        pose,
        timeline: entry?.timeline ?? null,
        motion: entry?.motion ?? null,
        at
      }),
      y: actor.y,
      facing: actor.facing,
      size: figureScaleFor({ yscale: actor.yscale, slotIndex: combatant.slotIndex })
    };
    drawOps(paintShadow(figure, pose), view, origin);
    drawOps(paintFigure(figure, pose), view, origin);

    // The name plate. It is the combatant's OWN name, never an item name.
    context.globalAlpha = combatant.alive ? 0.85 : 0.4;
    context.fillStyle = "#e8e4dc";
    context.font = `${Math.max(10, view.scale * 15)}px ui-sans-serif, system-ui, sans-serif`;
    context.textAlign = "center";
    context.fillText(combatant.name, view.toX(actor.x), view.toY(actor.y, -22));
    context.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------------ */
/* Side panel                                                          */
/* ------------------------------------------------------------------ */

function renderRoster() {
  const byId = combatantsById();
  const acting = host.battle.result ? null : host.currentCombatantId();
  el("roster").replaceChildren(
    ...scene.drawOrder.map((combatantId) => {
      const combatant = byId.get(combatantId);
      const placement = host.layout.placementFor(combatantId);
      const node = document.createElement("div");
      node.className = `fighter${combatantId === acting ? " acting" : ""}${combatant.alive ? "" : " down"}`;
      const ratio = combatant.maxHealth > 0 ? combatant.health / combatant.maxHealth : 0;
      node.innerHTML = "";
      const row = document.createElement("div");
      row.className = "row";
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = combatant.name;
      const slot = document.createElement("span");
      slot.className = "slot";
      slot.textContent = `${placement.side} slot ${placement.slotIndex}${placement.vanillaNative ? "" : " · authored"}`;
      row.append(name, slot);
      const numbers = document.createElement("div");
      numbers.className = "slot";
      // Copied from resolved state. Nothing here recomputes a combat value.
      numbers.textContent = `${combatant.health} / ${combatant.maxHealth}${combatant.status.length ? ` · ${combatant.status.join(", ")}` : ""}`;
      const bar = document.createElement("div");
      bar.className = ratio < 0.35 ? "bar hurt" : "bar";
      const fill = document.createElement("i");
      fill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
      bar.append(fill);
      node.append(row, numbers, bar);
      return node;
    })
  );
}

function renderControls() {
  renderRoster();
  const container = el("actions");
  const ready = host.readyForNextAction();

  if (host.battle.result) {
    el("turn-heading").textContent = settled ? "Settled" : "Decided";
    const note = document.createElement("div");
    note.className = "provenance";
    const winner = host.battle.result.winnerTeamId;
    note.textContent = winner ? `${winner} wins.` : "A draw.";
    container.replaceChildren(note);
    settleIfReady();
    return;
  }

  const actorId = host.currentCombatantId();
  const byId = combatantsById();
  // In spectate mode the heading said "waiting for the arena" almost the whole
  // bout, because the spectator takes its turn the instant the gate opens — so
  // the only state a person ever SAW was the waiting one, which read as a
  // stall. It is not: it is the gate doing its job between two automatic turns.
  el("turn-heading").textContent = spectate
    ? `Spectating — ${byId.get(actorId)?.name ?? actorId}`
    : ready.ready
      ? `${byId.get(actorId)?.name ?? actorId} — choose`
      : "waiting for the arena";

  container.replaceChildren(
    ...host.legalActions().map((action) => {
      const button = document.createElement("button");
      const target = action.targetId ? byId.get(action.targetId) : null;
      button.textContent = target && action.targetId !== actorId
        ? `${action.type} → ${target.name}`
        : action.type;
      button.disabled = !ready.ready;
      button.addEventListener("click", () => {
        try {
          const step = host.submit({ ...action, actorId });
          log(`${byId.get(actorId)?.name ?? actorId}: ${action.type}${target ? ` → ${target.name}` : ""}`);
          beginStep(step);
          renderControls();
        } catch (error) {
          log(error.message, { warn: true });
        }
      });
      return button;
    })
  );
}

function renderProvenance() {
  const rules = host.battle.rulesDescriptor ?? ss2TeamRules;
  el("tier").textContent = `${(rules.verification ?? "unknown").toUpperCase()} — NOT RUNTIME-VERIFIED`;
  el("seed").textContent = `seed ${seed} · ${perSide}v${perSide} · the same seed and the same choices replay exactly`;
  el("provenance").innerHTML = "";
  const lines = [
    ["The arithmetic", "runs the same `ss2TeamRules` the test suite runs — map-derived from a licensed build, never observed in it."],
    ["The figures", "are original vector art drawn from code in `src/render/painter.js`. No SS2 asset ships in this repository."],
    ["The animation timing", "is authored. No capture has ever recorded a clip label or a frame duration."],
    ["Slot 0 of each side", "reuses the battle map's own instance names, depths and positions. Everything past it is authored mod surface no capture can settle."]
  ];
  for (const [subject, body] of lines) {
    const node = document.createElement("div");
    node.innerHTML = "";
    const strong = document.createElement("b");
    strong.textContent = `${subject} `;
    node.append(strong, document.createTextNode(body));
    el("provenance").append(node);
  }
  el("footer").textContent =
    "This surface decides no combat: every number shown is copied from resolved state. " +
    "Reload with ?teams=1|2|3&seed=N to change the bout, or ?spectate=1 to watch one play itself.";
}

/* ------------------------------------------------------------------ */
/* Clock                                                               */
/* ------------------------------------------------------------------ */

/** In spectate mode, take the turn the moment the arena is ready for it. */
function spectateStep() {
  if (!spectate || host.battle.result) return;
  if (!host.readyForNextAction().ready) return;
  const actorId = host.currentCombatantId();
  const options = host.legalActions();
  if (options.length === 0) return;
  // ► **THIS WAS `options[host.battle.turnNumber % options.length]` UNTIL
  //   2026-09-12, AND IT NEVER REACHED A SWING.** Out of range the SS2 option
  //   list is `[walk-left, walk-right, rest]`, so cycling 0, 1, 2 is net-zero
  //   displacement forever: the gladiators oscillated on the spot until the
  //   crowd's patience killed them. Measured over 24 bouts, 20,712 actions and
  //   **0 attacks** — and every one of them SETTLED, which is why nothing ever
  //   looked wrong. Settling is not the diagnostic; an attack being on offer is.
  //
  //   The old comment said "deterministic, so a spectated bout replays exactly
  //   like a played one". `chooseAiAction` is deterministic too — it is the
  //   rule set's own AI over the resolver's own `actorView` — so that property
  //   survives and the bout actually happens.
  const action = host.suggestAction(actorId);
  try {
    const step = host.submit({ ...action, actorId });
    log(`${host.combatant(actorId)?.name ?? actorId}: ${action.type}`);
    beginStep(step);
    renderControls();
  } catch (error) {
    log(error.message, { warn: true });
  }
}

function frame(now) {
  drainFinishedAnimations(now);
  spectateStep();
  settleIfReady();
  render(now);
  requestAnimationFrame(frame);
}

renderProvenance();
renderControls();
log(`arena built: ${scene.drawOrder.length} fighters, ${perSide}v${perSide}, seed ${seed}`);
requestAnimationFrame(frame);
window.addEventListener("resize", () => render());
