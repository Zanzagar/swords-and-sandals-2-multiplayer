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
import { ss2BattleValues, ss2Combatant, ss2TeamRules, createSs2TeamRules, SS2_ARENA } from "/src/team/ss2-rules.js";
import {
  animationCursor,
  applyCommands,
  emptyScene,
  figureSpecFor,
  figureScaleFor,
  figureYAt,
  figureXAt,
  figureFacingAt,
  figureYscaleAt,
  paintFigure,
  paintShadow,
  paintExtractedFigure,
  figurePackFrom,
  hasExtractedArt,
  clipToArenaScale,
  loadoutFrom,
  attachmentsFor,
  facePackFrom,
  faceOpsFor,
  mergeFaceOps,
  canvasBackingFor,
  groupPaintReadout,
  rankStrideFrom,
  settlementReadiness,
  selectRules,
  masterGainFor,
  DEFAULT_VOLUME,
  figureProvenance,
  perSideFrom,
  rankOfDepth,
  viewportFor,
  rosterOrderOf,
  poseAt,
  idleFrameFor,
  timelineFor,
  timelinesForStep,
  bindingsFrom,
  soundTimingFrom,
  soundCuesFor,
  dueSoundCues,
  leadInSecondsFrom,
  unhonouredCuesIn,
  animationFor,
  projectileFlight,
  projectileDrawAt,
  flightDurationMs,
  fireballFlight,
  fireballDrawAt,
  fireballLifetimeMs,
  fireballOpsFor,
  reactionDelaysFor,
  propPackFrom,
  hasExtractedProps,
  propFrameCount,
  propOpsFor,
  propInvoiceFor,
  arrowOpsFor,
  arrowTrailOpsFor,
  boltOpsFor,
  boulderOpsFor,
  boulderDrawAt,
  boulderLandedFramesFor,
  boulderOutline,
  propOriginMatrix,
  propPlacementMatrix,
  effectLifetimeMs,
  spellEffectDrawAt,
  arenaSceneryFor,
  arenaScreenLayersFor,
  splitArenaScreen,
  SS2_ARENA_DRESSING,
  SS2_ARENA_SCREEN_LAYERS,
  propEffectsUnreachable,
  hasArenaScreen,
  uiBarReadoutsFor,
  textPackFrom,
  fieldsPlacedIn,
  fieldOpsFor,
  colourTransformFrom,
  canvasFilterFor,
  stepFramedCamera,
  actorSpanFor,
  stageFitFor,
  stageClipRectFor,
  stageFitReportFor,
  stageProjectorFor,
  clipEffectTableFrom,
  effectsForAnimation,
  spawnDrops,
  dropAt,
  SS2_DROP,
  PROJECTILE_FRAME_MS,
  createStrikeLedger,
  popupsForEvents,
  livePopupsFor,
  prunePopups,
  popupAnchorFor,
  popupPackFrom,
  popupOpsFor,
  popupFallbackOpsFor,
  actionButtonFallbackOpsFor,
  SS2_OVERLAY_PLACEMENT
} from "/src/render/index.js";
// Imported directly, like `crowd-sound.js` below: the blood's plan and clock.
import { bloodPlanFor, bloodSeedFor, dueBloodEffects } from "/src/render/blood-timing.js";
import { citationFor } from "/src/adapter/vanilla-fields.js";
import {
  CHAMPION_PACK_COMMAND,
  CHAMPION_PACK_URL,
  arenaRequestFrom,
  championSide,
  demoSide
} from "/tools/arena/roster.js";
import {
  resultHeadingFor,
  seatControllersFrom,
  seatControlsFor,
  seatFrameFor,
  seatOutcomeFor,
  seatSummaryFor,
  seatTagFor,
  seatTurnFor,
  withSeatControllers
} from "/tools/arena/seats.js";
import { createSoundPlayer } from "/tools/arena/sound-player.js";
import {
  RING_VERB_LABELS,
  ringActionFor,
  ringActionLabel,
  ringFocusKind,
  ringKeyCommand,
  ringModelFor
} from "/tools/arena/ring.js";
import { RING_STAGE_SCALE, fighterBoxFor, foeAt, ringButtonsAt, ringSlotAt } from "/tools/arena/ring-layout.js";
import {
  ARENA_ASSET_TIMEOUT_MS,
  PackOutcome,
  assetGateReport,
  createAssetGate,
  lateArrivalReport,
  loadingFrameFor
} from "/tools/arena/asset-gate.js";
import {
  SS2_ARENA_SOUNDS,
  arenaSoundFilesFrom,
  arenaSoundSettled,
  arenaSoundStep,
  createArenaSoundState,
  createCrowdPresenter,
  crowdHeardFor,
  decidingBlowMsFor,
  queueCrowdInterest,
  settleCrowdInterest,
  soundSecondsFrom,
  stepEndsAtMs,
  winningSideLevel
} from "/src/render/crowd-sound.js";
import { ss2CrowdInterestOf } from "/src/team/ss2-crowd.js";
import { resourceValue } from "/src/team/resources.js";

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */

/** Arena y of the front rank — the vanilla `_y`, and `toY`'s own datum. */
const ARENA_FRONT_Y = 200;


/**
 * How many ranks back a drawn depth is, FRACTIONALLY, for the perspective
 * falloff. Falls back to the roster's slot for any rule set that models no
 * depth, which is what `figureScaleFor` keyed on before the second axis.
 */
const rankOf = (drawnY, slotIndex) =>
  rankOfDepth(drawnY, slotIndex, { frontY: ARENA_FRONT_Y, rankStride: SS2_ARENA.rankStride });

const params = new URLSearchParams(location.search);
const perSide = perSideFrom(params);
const seed = Number(params.get("seed")) || 7;
/**
 * Spectate mode: both sides pick for themselves, one action at a time, THROUGH
 * THE SAME GATE a person goes through. It is not a fast-forward — `runAiTurns`
 * on the host would submit a whole bout without an animation ever playing —
 * and that is the point: it is the only way to watch the surface actually
 * keep up with the resolver.
 *
 * ► **SINCE THE SEATS (2026-09-24) IT IS READ IN `tools/arena/seats.js`, AND
 *   THE `spectate` FLAG THAT STOOD HERE IS GONE.** `?spectate=1` declares every
 *   seat AI in the battle's own registry (`seatControllersFrom`), and
 *   `aiTurnStep` plays any AI seat, spectated or not; the heading and the
 *   controls' note read the seat mode. A second reader of the parameter here
 *   could only ever disagree with that one.
 */
/**
 * THE SECOND AXIS, and it is here so the owner can answer the question only he
 * can: **how much should standing in the right place matter?**
 *
 * The default is the SHIPPED stride, `SS2_ARENA.rankStride` (97) — the measured
 * sweet spot, where everything still settles, blows through a living body fall
 * from 44.7% to 14.7%, and a breakoff fight exists. `?rank=0` is the
 * one-dimensional game exactly; `?rank=150` is past the top of the dial (three
 * simultaneous fights, but 15 of 24 bouts never settle). Measure any change
 * with `node tools/engagement-census.mjs --rank-stride N`; this is the same
 * number that tool takes.
 *
 * 97 is not tuned — it is `floor(sqrt(reach^2 - physical_size^2))`, the depth
 * at which a second rank leaves the front rank's reach.
 *
 * ► **THIS READ `Number(params.get("rank")) || 0` AND SELECTED THE SINGLETON ON
 *   ZERO, WHICH IS THE EXACT DEFECT `tools/engagement-census.mjs` WAS FIXED FOR
 *   ON 2026-09-12 — it simply survived here, in the file the owner actually
 *   plays.** `ss2TeamRules` is `createSs2TeamRules()` and so carries the
 *   DEFAULT stride, 97. Once 97 became the default, `?rank=0` stopped meaning
 *   "off": it handed back the shipped engine while the docstring above promised
 *   "the one-dimensional game exactly". Measured on this tree before the fix —
 *   `?rank=0` gave combatant `y` of `200, 103, 6`, three ranks, while
 *   `createSs2TeamRules({ rankStride: 0 })` gives `null, null, null`.
 *
 *   **So the arena could not be put into the 1-D game at all, and said it
 *   could.** Compare against the SHIPPED value, not against zero: the singleton
 *   is correct only when the request IS the default.
 */
const rankStride = rankStrideFrom(params, SS2_ARENA.rankStride);
/*
 * `?items=` — a kit (`buffs`, `blasts`, `tricks`, `crowd`, `doom`) or item ids,
 * given to every fighter on both sides (`DEMO_ITEM_KITS` in `roster.js`, which
 * also gives a kit fighter a level-4 magicka, and a damage kit's the build's own
 * pools) — is read in
 * `arenaTeams()` below, through `arenaRequestFrom`, and NOT here any more.
 * ► It was parsed on this line at module initialisation until 2026-09-23, so a
 *   malformed kit threw before any refusal could reach the page, and beat the
 *   champion refusal of `items=` to it (Codex review; `test/arena-champions.test.js`).
 */

/**
 * Says on the PAGE why there is no bout, then stops the module.
 *
 * ► **ON THE PAGE, NOT IN THE CONSOLE.** A module that throws at the top level
 *   leaves "loading…" in the header and the reason in a console the person
 *   watching never opens — so a missing pack would read as a hung arena. The
 *   message goes to the header, the controls, the footer and over the stage,
 *   and only then is the error thrown.
 *
 * Uses `document.getElementById` directly: this runs before `el` and `log` are
 * declared further down, and touching them here is a temporal-dead-zone error
 * that would replace the message with a worse one.
 */
function refuseToStart(title, message) {
  const byId = (id) => document.getElementById(id);
  document.title = `${title} — The Arena`;
  byId("tier").textContent = "NO BOUT";
  byId("turn-heading").textContent = title;
  const note = document.createElement("div");
  note.className = "provenance";
  note.textContent = message;
  byId("actions").replaceChildren(note);
  byId("footer").textContent = message;
  const banner = document.createElement("div");
  banner.setAttribute("role", "alert");
  banner.style.cssText =
    "position:absolute;left:16px;right:16px;top:16px;z-index:5;padding:12px 14px;border-radius:6px;" +
    "border:1px solid #c9a227;background:#2a2208;color:#f3e3a8;font-size:14px;line-height:1.5;white-space:pre-wrap";
  banner.textContent = `${title}\n\n${message}`;
  byId("stage").append(banner);
  throw new Error(`${title}: ${message}`);
}

/**
 * `?red=2,4,16&blue=1,3,10` — THE BUILD'S OWN CHAMPIONS, by `which_boss`, one
 * to three a side, instead of the demo roster. Absent, the arena is exactly
 * what it was.
 *
 * The champions come from the player's OWN install: `tools/extract-champions.mjs`
 * writes them to gitignored `assets/champions/`, and the repository ships none.
 * Every decision — which champion, how its DNA decodes, how it is priced, what
 * the host would refuse — is `arenaRequestFrom`/`championSide` in
 * `roster.js`, under the suite (`test/arena-champions.test.js`). What lives
 * here is the fetch, and saying so on the page when anything fails —
 * including a malformed `items=` for the demo roster.
 */
async function arenaTeams() {
  let request;
  try {
    request = arenaRequestFrom(params);
  } catch (error) {
    refuseToStart("The roster request was refused", error.message);
  }
  if (request.kind === "demo") {
    // `seed` reaches the roster for a KIT bout's opener only (even seeds open
    // with blue); with no kit `demoSide` never reads it.
    return [
      demoSide("red", perSide, { ss2Combatant, ss2BattleValues, items: request.items, seed }),
      demoSide("blue", perSide, { ss2Combatant, ss2BattleValues, items: request.items, seed })
    ];
  }
  let pack = null;
  let why = "";
  try {
    const response = await fetch(CHAMPION_PACK_URL);
    if (response.ok) pack = await response.json();
    else why = `${CHAMPION_PACK_URL} answered ${response.status}.`;
  } catch (error) {
    why = `${CHAMPION_PACK_URL} could not be read: ${error.message}.`;
  }
  if (!pack) {
    refuseToStart(
      "No champion pack",
      `${why} The champions are the build's own, and this repository ships none of them.\n\n` +
      `Run   ${CHAMPION_PACK_COMMAND}   (add the path to your own swords_sandals2_download.swf if it is not ` +
      "the Steam default), then reload this page.\n\n" +
      "Or import every pack the arena uses in one go:   node tools/extract-all.mjs"
    );
  }
  try {
    return [
      championSide("red", request.red, { ss2Combatant, ss2BattleValues, pack, admitResource: citationFor }),
      championSide("blue", request.blue, { ss2Combatant, ss2BattleValues, pack, admitResource: citationFor })
    ];
  } catch (error) {
    refuseToStart("A champion cannot fight here", error.message);
  }
  return null;
}

/**
 * THE SEATS (2026-09-24): which fighters the person at this screen plays and
 * which the AI does — `?play=red`, `?play=red-1,blue-2`, `?spectate=1`, or
 * nothing for every seat by hand. Decided by `seatControllersFrom` and written
 * onto each member's `controller` by `withSeatControllers`, which the host
 * hands to the battle's own `ControllerRegistry`: the engine's
 * `isAiControlled` is what the turn loop asks, never a flag here. A refusal
 * (a typo, a slot this bout does not field) is said on the page.
 */
const rosterTeams = await arenaTeams();
let seats;
try {
  seats = seatControllersFrom(params, rosterTeams);
} catch (error) {
  refuseToStart("The seat request was refused", error.message);
}
const teams = withSeatControllers(rosterTeams, seats);
/** Which champion stands in which slot, for every line that names a slot id. */
const championsBySlot = new Map(
  teams.flatMap((team) => team.members)
    .filter((member) => Number.isInteger(member.whichBoss))
    .map((member) => [member.id, member.whichBoss])
);
/**
 * EACH FIGHTER'S LOOK, by combatant id (2026-09-24): skin, hair colour, hair,
 * facial hair and the skin-derived features, as the roster built them — a
 * champion's from its own DNA, a demo gladiator's from `randomise_gladiator`'s
 * rule on the bout's seed. **Read from the roster, never from the host**: the
 * look is presentation and is not in the combat state, so it cannot move a
 * hash. `src/render/appearance.js` holds the rules.
 */
const appearanceById = new Map(
  teams.flatMap((team) => team.members).map((member) => [member.id, member.appearance ?? null])
);
const matchLabel = `${teams[0].members.length}v${teams[1].members.length}`;

/**
 * What the rule set's diagnostic `observer` saw, for the fight pop-ups: the
 * GROSS number the build shows on a hit (`damagecharacter` +0x1719/+0x1733),
 * which the hashed event log does not carry and cannot without moving every
 * pinned hash. See `src/render/popups.js`. Emptied before every submit and
 * read once per step in `spawnPopups`.
 */
const strikeLedger = createStrikeLedger();

let host;
try {
  host = createVanillaBattleHost({
    teams,
    // ~~The module singleton when the request IS the shipped stride~~ — a
    // FRESH rule set with the pop-ups' observer, always (2026-09-23): the same
    // id, descriptor and stride as the singleton, plus the diagnostic sink.
    // `selectRules` says why.
    rules: selectRules(rankStride, {
      shippedStride: SS2_ARENA.rankStride,
      singleton: ss2TeamRules,
      create: createSs2TeamRules,
      observer: strikeLedger.observe
    }),
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed,
    awaitAnimations: true
  });
} catch (error) {
  // The host names a slot ("Combatant red-2"), never a champion; say which is which.
  if (championsBySlot.size === 0) throw error;
  const legend = [...championsBySlot].map(([id, whichBoss]) => `${id} is which_boss ${whichBoss}`).join(", ");
  refuseToStart("The arena host refused a champion", `${error.message}\n\n(${legend}.)`);
}

let scene = applyCommands(emptyScene(), host.constructArena().commands);

/** One entry per actor currently playing a timeline. */
const playing = new Map();
/** Tokens whose timelines are still running, in the order they were dispatched. */
let pendingTokens = [];
/**
 * Arrows currently in the air, each with its OWN clock and its own token.
 *
 * ► **NOT `playing`, and not `scene.projectiles` either.** `playing` is keyed by
 *   combatant and is what the painter poses; an arrow is nobody's figure.
 *   `scene.projectiles` is the batch's own record and is replaced whole on the
 *   next fold, which is correct for a scene and useless as a clock — an arrow
 *   outlives the action that loosed it by design now, because the build will
 *   not complete a ranged phase while one is flying (`bullet_in_air` on the
 *   phase-completion guard, `+0x3829`).
 */
let inFlight = [];
/**
 * Spell clips attached at their victims — the bolt, today — each with its own
 * clock and its own lifetime.
 *
 * Like `inFlight` and unlike `scene.effects`, which is replaced whole on the
 * next fold. The lifetime is `spellEffectDrawAt`'s, which reads it off the
 * victim's own timeline: the build removes the bolt when that clip reports back
 * (`+0x85ed`), so the two end together and neither holds the gate on its own.
 */
let attached = [];
/**
 * Fireballs, each on its own clock — the flight AND the explosion after it.
 *
 * Not `inFlight`: that list is drawn as ARROWS and pruned at the end of the
 * flight, and a fireball stays on screen for its explosion after it lands
 * (`bullet.gotoAndStop(4)`, `+0x91cd`). Only the FLIGHT holds the gate, as the
 * build's `bullet_in_air` does; the victim's reaction, started at impact,
 * holds it after that. Every decision is `fireballDrawAt`'s.
 */
let fireballs = [];
/**
 * Molten death's boulders, each on its own clock — the fall, and the landing
 * for as long as the pack says the build shows it (`boulderLandedFramesFor`).
 * Added 2026-09-23; until then a shower drew nothing at all.
 *
 * Not `attached`: that list is drawn as the BOLT, and a boulder routed into it
 * would have been painted as lightning. Only the FALL holds the gate, as a
 * fireball's flight does — the victim's reaction, started when the killing (or
 * first) rock lands, holds it after that. Every decision is `boulderDrawAt`'s.
 */
let boulders = [];
let settled = false;

/**
 * ► **THE RING (slice S2 of `docs/design/battle-ui.md`, "The in-battle
 *   actions: DECIDED").** On a person's turn the build's eight buttons stand
 *   around the acting fighter, a gold ring marks the selected foe, one click
 *   acts, and the strip under the stage carries the same actions for the
 *   keyboard and for screen readers. What sits where, who is selected and
 *   what a click or key sends are `tools/arena/ring.js`'s, under the suite;
 *   where the buttons are drawn and what a point hits are
 *   `tools/arena/ring-layout.js`'s. This file holds the state they are handed
 *   and paints what they return.
 *
 * - `ringView` — the ring for the person's turn on screen: its model, whose
 *   turn and whether the arena is ready for it. Null on every other turn, so
 *   spectating and AI seats draw exactly what they drew before.
 * - `ringSelection` — each fighter's last selected foe, which his next turn
 *   keeps while it is valid (the owner's Q4: "it stays selected between
 *   turns"). Per fighter, because a person playing three fighters in three
 *   ranks fights three different foes.
 * - `ringButtons`, `fighterBoxes`, `ringAnchor` — where the last frame DREW
 *   the buttons, the fighters and the acting fighter's ring centre, in canvas
 *   pixels, so a click is tested against what the person actually saw.
 */
let ringView = null;
const ringSelection = new Map();
let ringButtons = [];
let fighterBoxes = [];
let ringAnchor = null;
/** The slot under the pointer, drawn in the fallback's hover look. */
let ringHover = null;
/** Which person's turn the live region last announced, so a turn is announced once. */
let ringAnnounced = null;
/**
 * The strip button that had the keyboard focus when a rebuild took it away —
 * `{row, text}` — so the focus comes back to the strip on the person's next
 * ready turn instead of falling to the page. Forgotten once the focus or a
 * pointer goes anywhere else.
 */
let ringFocusWanted = null;

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
/* ------------------------------------------------------------------ */
/* Sound — the player's OWN extracted assets, or silence                */
/* ------------------------------------------------------------------ */

/**
 * ► **NO EXTRACTED ASSETS MEANS SILENCE, NEVER AN ERROR.** A fresh clone has
 *   no `assets/` — that is the point, the repo ships none — so the manifest
 *   fetch is expected to 404 and the arena must stay fully playable when it
 *   does. Run `node tools/extract-sounds.mjs <your swf>` to fill it.
 *
 * WHICH sound plays and WHEN are decided in `src/render/sound.js` and
 * `src/render/sound-timing.js`, under the suite, and the playing is
 * `tools/arena/sound-player.js`, which the suite drives with fakes. What lives
 * here is the wiring: the fetch, the draw loop's clock, and the DOM slider.
 */
let soundBindings = Object.freeze({});
/** The build's frame timing for each sound, or null on a pack that predates it. */
let soundTiming = null;
let soundEnabled = true;
/** Sounds fired before they were decoded — dropped rather than played late. Said once. */
let soundNotReadyLogged = false;

/**
 * ► **WEB AUDIO WHEN THE BROWSER HAS IT (2026-09-23).** One context, every file
 *   decoded once, a fresh source node per play: no fetch or decode at the
 *   moment of the hit, and overlap for free. The `<audio>` clone path it
 *   replaced is the fallback, kept for a browser with no `AudioContext`.
 */
const soundPlayer = createSoundPlayer({
  AudioContextCtor: window.AudioContext ?? window.webkitAudioContext ?? null,
  fetchImpl: typeof window.fetch === "function" ? window.fetch.bind(window) : null,
  createAudio: (url) => new Audio(url),
  onBlocked: noteAudioBlocked,
  onNotReady: (file) => {
    if (soundNotReadyLogged) return;
    soundNotReadyLogged = true;
    log(`sound ${file} fired before it was decoded — dropped rather than played late (said once).`, { warn: true });
  }
});

/* ------------------------------------------------------------------ */
/* The asset gate — no stage and no action until the art has settled    */
/* ------------------------------------------------------------------ */

/**
 * ► **THE OWNER SAW THE AUTHORED FIGURES FLASH BEFORE HIS OWN (2026-09-24):**
 *   *"the 'old skins' flash for a second before being populated by the real
 *   swords and sandals 2 skins."* The loop below started at once while every
 *   pack arrived on its own fetch and filled its variable when it landed, so
 *   the first frames drew the authored fallback and then swapped — and an AI
 *   seat could act before any of it was in.
 *
 * Every VISUAL pack is now handed to this gate (`assetGate.track`), and what
 * each one fills is applied only when the gate OPENS (`useArenaPacks`, at the
 * clock). Until then `render` draws the loading frame, `renderControls` offers
 * no button and `frame` steps nothing. The rule — settled means loaded, 404'd
 * or errored; an 8 s timeout; a pack that arrives after the gate is not used
 * that bout — is `tools/arena/asset-gate.js`, under the suite. Sound is not
 * gated: it keeps loading in the background, as it always has.
 */
let assetGateOpen = false;
const assetGate = createAssetGate({
  clock: () => performance.now(),
  // Said, never used: swapping art mid-bout is the flash this gate exists to stop.
  onLateArrival: (arrival) => {
    const line = lateArrivalReport(arrival);
    log(line.message, { warn: line.warn });
  }
});

/* ------------------------------------------------------------------ */
/* Art — the player's OWN extracted rig, or the authored figure         */
/* ------------------------------------------------------------------ */

/**
 * ► **NO EXTRACTED ART MEANS THE AUTHORED FIGURE, NEVER AN ERROR**, exactly as
 *   no extracted audio means silence. A fresh clone has no `assets/` — that is
 *   the point, the repo ships none — so these fetches are EXPECTED to 404 and
 *   the arena must stay fully playable when they do. Run
 *   `node tools/extract-figure.mjs` to fill it.
 *
 * WHICH pose is drawn is decided in `src/render/extracted-figure.js`, under the
 * suite. All that lives here is the fetch and the `Path2D`, which are the two
 * things a test cannot reach.
 *
 * The fallback is PER FAMILY, not per session: this engine can express phases
 * the build has no clip for, so a gladiator may draw from the extracted rig for
 * a walk and from `figure.js` for something vanilla never had.
 */
let figurePack = null;

let wardrobe = null;

/**
 * The build's own arrow and trail, or null.
 *
 * Loaded on its OWN fetch rather than joined to the figure's `Promise.all`,
 * because the two extractions are independent: a player who has run
 * `extract-figure.mjs` but not `extract-props.mjs` should get the build's
 * gladiator firing this shell's authored arrow, not lose both. Same
 * arrangement the wardrobe has for the same reason.
 *
 * Fetched here, USED when the asset gate opens (`usePropPack`).
 */
let propPack = null;
assetGate.track("props", fetch("/assets/props/props.json")
  .then((response) => (response.ok ? response.json() : null)));

function usePropPack(data) {
  try {
    propPack = propPackFrom(data);
    if (!hasExtractedProps(propPack)) {
      log("no extracted props — drawing an authored arrow. `node tools/extract-props.mjs` to use the build's own.");
      return;
    }
    log(`props: ${propFrameCount(propPack, "bullet")} arrow frame(s) from your own install`);
    reportArenaEffects(propPack);
  } catch (error) {
    // A pack that cannot be read through falls back whole, as it always did.
    propPack = null;
    throw error;
  }
}

/**
 * The build's own embedded glyph outlines, or null — the UI bar's words.
 *
 * ► **NO EXTRACTED TEXT MEANS A WORDLESS BAR, NEVER AN ERROR**, exactly as no
 *   extracted audio means silence. Same fetch-and-fall-back shape as the props
 *   and the figures, and for the same reason: this repository ships no SS2
 *   asset, so a 404 here is the supported case and not a failure.
 */
assetGate.track("text", fetch("/assets/text/text.json")
  .then((response) => (response.ok ? response.json() : null)));

function useTextPack(data) {
  try {
    textPack = textPackFrom(data);
    if (!textPack) {
      log("no extracted text — the UI bar draws no words. `node tools/extract-text.mjs` to add them.");
      return;
    }
    reportUiBar();
  } catch (error) {
    textPack = null;
    throw error;
  }
}

/**
 * Which frame of the fighter clip throws blood or sparks, from
 * `tools/extract-clip-effects.mjs`. Optional on top of the props, exactly as
 * the wardrobe is optional on top of the rig.
 */
let clipEffects = null;
assetGate.track("clipEffects", fetch("/assets/props/clip-effects.json")
  .then((response) => (response.ok ? response.json() : null)));

function useClipEffects(data) {
  clipEffects = clipEffectTableFrom(data);
}

/**
 * Blood and sparks currently in the air, each with its own clock.
 *
 * ► **NOT held against the gladiator that threw them.** The build attaches a
 *   drop to `arena.gladiators` at depth 45300 and lets it outlive whatever
 *   spawned it — a death sprays and the body is already gone — so these are the
 *   arena's, like the arrows, and they are pruned by their own 25-frame life.
 */
let drops = [];

/**
 * The fight pop-ups on screen or waiting to be — the damage number, the
 * spell/status/potion callout and BLOCK — each `{ popup, startedAt, maxscale }`.
 *
 * ► **HELD AGAINST THE FIGHTER, UNLIKE THE DROPS**: the build attaches every one
 *   to the struck fighter's own clip at a fixed depth (`damagecharacter`
 *   +0x15ea at 25000, `magic_damage_character` +0x1313 and `defender_blocked`
 *   +0x21ce at 25005, the potions at 25001), so it rides with him and a new one
 *   at the same depth REPLACES the old. `livePopupsFor` applies that rule;
 *   `renderStage` draws each fighter's right after his body. Every decision is
 *   `src/render/popups.js`'s.
 */
let popups = [];

/**
 * WHAT THE RIG'S OWN PACK SAYS ABOUT EFFECT GROUPS, counted from the raw
 * `animations.json` before `figurePackFrom` ever sees it.
 *
 * ► **IT IS THE DENOMINATOR `reportFigureGroups` IS READ AGAINST.** "0 groups
 *   this frame" is the correct answer whenever no fighter is in `psyche_up2`,
 *   and is indistinguishable from "this counter is never reached" without the
 *   pack's own total beside it. It is also the one number that would move if
 *   `tools/extract-figure.mjs` stopped carrying the filters again — the freeze
 *   that hid 24 glows until 2026-09-15 is exactly what a zero here looks like.
 *
 * ► **AND IT COUNTS PLACEMENTS AS WELL AS GROUPS, because the two disagree.**
 *   A group-table entry is a record; a placement is a leaf that names one. This
 *   build has more placements than groups in three of the four labels and nine
 *   of each in the fourth, which is what a tweened glow looks like.
 *
 * Pure — it reads the object it is handed and nothing else — so the test lifts
 * it out of this file and runs it against the real pack.
 */
function figureEffectCensusOf(animations) {
  const census = {
    animations: 0, withEffects: 0, groups: 0,
    placements: 0, effectedPlacements: 0,
    ownFilters: 0, ownBlendModes: 0, labels: []
  };
  if (!animations || typeof animations !== "object") return census;
  for (const [label, animation] of Object.entries(animations)) {
    if (!animation || typeof animation !== "object") continue;
    census.animations += 1;
    const groups = Array.isArray(animation.effectGroups) ? animation.effectGroups.length : 0;
    let effected = 0;
    for (const frame of Array.isArray(animation.poses) ? animation.poses : []) {
      for (const placement of Array.isArray(frame) ? frame : []) {
        if (!placement || typeof placement !== "object") continue;
        census.placements += 1;
        // A placement's OWN filter list and blend mode, which are a DIFFERENT
        // thing from the enclosing group's and are 0 of 37,077 on this build.
        // Counted so that a pack where they appear is loud rather than silently
        // drawn flat — this painter has nowhere to put them.
        if (Array.isArray(placement.filters) && placement.filters.length > 0) census.ownFilters += 1;
        if (placement.blendMode !== undefined && placement.blendMode !== null) census.ownBlendModes += 1;
        if (Array.isArray(placement.effects) && placement.effects.length > 0) effected += 1;
      }
    }
    census.groups += groups;
    census.effectedPlacements += effected;
    if (groups > 0 || effected > 0) {
      census.withEffects += 1;
      census.labels.push(label);
    }
  }
  return census;
}

/**
 * WHAT `assets/figure/enchantments.json` SAYS ABOUT ITSELF, for the log panel.
 *
 * It reads the pack's OWN invoice rather than re-deriving anything: the ladder
 * is twelve cells because `tools/extract-enchantments.mjs` accounted for all
 * 107 instructions of `itemglow`'s body, and this file is in no position to
 * check that. Total on a missing or malformed pack, because a 404 here is the
 * supported case — this repository ships no SS2 asset.
 */
function enchantmentCensusOf(pack) {
  const invoice = pack && typeof pack === "object" && pack.invoice && typeof pack.invoice === "object"
    ? pack.invoice : null;
  const ladder = invoice && typeof invoice.ladder === "object" && invoice.ladder ? invoice.ladder : {};
  const art = invoice && typeof invoice.art === "object" && invoice.art ? invoice.art : {};
  const rows = pack && typeof pack === "object" && pack.types && Array.isArray(pack.types.rows)
    ? pack.types.rows : [];
  const count = (value) => (Number.isFinite(value) ? value : 0);
  return {
    cells: count(ladder.cells),
    types: count(ladder.types),
    potencies: count(ladder.potencies),
    frames: count(art.frames),
    framesWithAGlow: count(art.framesWithAGlow),
    groups: count(art.distinctEnclosingGroups),
    filters: count(art.enclosingFilters),
    names: rows.map((row) => (row && typeof row.name === "string" ? row.name : "?"))
  };
}

/**
 * The rig's effect-group census, so `reportFigureGroups` always has a
 * denominator — an empty one until the pack lands, never `undefined`.
 */
let figureEffects = figureEffectCensusOf(null);

/**
 * The twelve-cell weapon-enchantment ladder and its art.
 *
 * OPTIONAL on top of the rig, exactly as the wardrobe is and for the same
 * reason: a player who ran `tools/extract-figure.mjs` but not
 * `tools/extract-enchantments.mjs` gets an unglowing sword rather than no
 * gladiator. A missing pack is one log line and the picture that was drawn
 * before it existed.
 */
let enchantments = null;

/*
 * Three packs to the asset gate, where they used to be one `Promise.all`: the
 * rig (both halves or neither), and the two optional layers over it, each
 * counted and each able to be late on its own. `useArenaPacks` applies the
 * wardrobe and the enchantments BEFORE the rig, which is built with them.
 */
assetGate.track("figure", Promise.all([
  fetch("/assets/figure/shapes.json").then((response) => (response.ok ? response.json() : null)),
  fetch("/assets/figure/animations.json").then((response) => (response.ok ? response.json() : null))
]).then(([shapes, animations]) => (shapes && animations ? { shapes, animations } : null)));
// The wardrobe is OPTIONAL on top of the rig: a player who ran the figure
// extractor but not the wardrobe one gets a naked gladiator rather than none.
assetGate.track("wardrobe",
  fetch("/assets/figure/wardrobe.json").then((response) => (response.ok ? response.json() : null)).catch(() => null));
assetGate.track("enchantments",
  fetch("/assets/figure/enchantments.json").then((response) => (response.ok ? response.json() : null)).catch(() => null));

function useFigurePack(rig) {
  const shapes = rig?.shapes ?? null;
  const animations = rig?.animations ?? null;
  figureEffects = figureEffectCensusOf(animations);
  if (!shapes || !animations) {
    log("no extracted art — drawing the authored figure. `node tools/extract-figure.mjs` to use the build's own.");
    return;
  }
  try {
    figurePack = figurePackFrom(shapes, animations, enchantments);
    const pieces = wardrobe ? Object.values(wardrobe.pieces ?? {}).reduce((n, slot) => n + Object.keys(slot).length, 0) : 0;
    log(`art: ${Object.keys(shapes).length} shape(s), ${figurePack.labels.length} animation(s)` +
      (wardrobe ? `, ${pieces} wardrobe piece(s)` : ", no wardrobe — `node tools/extract-wardrobe.mjs` to dress him") +
      " from your own install");
    log(`art effects: ${figureEffects.groups} effect group(s) over ` +
      `${figureEffects.effectedPlacements}/${figureEffects.placements} placement(s) in ` +
      `${figureEffects.withEffects}/${figureEffects.animations} animation(s)` +
      (figureEffects.labels.length > 0 ? ` (${figureEffects.labels.join(", ")})` : "") +
      `; ${figureEffects.ownFilters} placement(s) carry their own filter, ` +
      `${figureEffects.ownBlendModes} their own blend mode.`);
    if (!enchantments) {
      log("no enchantment pack — a weapon draws unglowed. `node tools/extract-enchantments.mjs` to add the ladder.");
    } else {
      const ladder = enchantmentCensusOf(enchantments);
      log(`enchantments: ${ladder.cells} cell(s) — ${ladder.types} type(s) x ${ladder.potencies} potency(ies)` +
        (ladder.names.length > 0 ? ` (${ladder.names.join(", ")})` : "") +
        `, ${ladder.framesWithAGlow}/${ladder.frames} art frame(s) glow, ` +
        `${ladder.groups} enclosing group(s), ${ladder.filters} filter(s).`);
    }
    // ~~`renderProvenance()` here~~ — the panel that must not go on claiming
    // authored figures over the build's own is re-rendered ONCE, by
    // `openArena`, after every pack is applied.
  } catch (error) {
    // A broken pack falls back rather than taking the arena down with it.
    figurePack = null;
    log(`extracted art unusable, drawing the authored figure (${String(error.message).slice(0, 80)})`);
  }
}

fetch("/assets/sound/manifest.json")
  .then((response) => (response.ok ? response.json() : null))
  .then((manifest) => {
    if (!manifest) {
      log("no extracted assets — running silent. `node tools/extract-sounds.mjs <your swf>` to add sound.");
      return;
    }
    soundBindings = bindingsFrom(manifest);
    soundTiming = soundTimingFrom(manifest);
    arenaSoundFiles = arenaSoundFilesFrom(manifest);
    const buckets = Object.keys(soundBindings).length;
    log(`sound: ${manifest.count} file(s) from ${manifest.source?.sha256?.slice(0, 12) ?? "an unknown build"}, ${buckets} animation bucket(s), via ${soundPlayer.route}`);
    reportArenaSounds();
    // ► **AN OLD PACK IS SAID ONCE, AND STILL PLAYS.** A manifest written before
    //   `extract-sounds.mjs` kept each sound's frame has `bindings` and no
    //   `cues`; every sound then starts with its clip, as it always did.
    if (!soundTiming) {
      log("sound: this pack predates frame timing, so each sound plays when its clip STARTS rather than on the " +
        "build's own frame — re-run `node tools/extract-sounds.mjs <your swf>` to time them.", { warn: true });
    } else if (unhonouredCuesIn(soundTiming) > 0) {
      log(`sound: ${unhonouredCuesIn(soundTiming)} cue(s) carry a loop count, in/out point or envelope this arena ` +
        "does not honour; each plays once, whole.", { warn: true });
    }
    primeSoundCache(manifest);
  })
  .catch(() => {
    // Total on purpose: a stack trace where a footstep should be is a worse
    // outcome than quiet.
    log("no extracted assets — running silent.");
  });

/**
 * ► **AUTOPLAY IS BLOCKED UNTIL THE PAGE IS INTERACTED WITH, AND SPECTATE MODE
 *   NEVER INTERACTS.** Every browser refuses `play()` on a page the user has
 *   not touched. The first version caught that rejection and threw it away with
 *   a comment saying it was "not an error worth a log line" — so a spectated
 *   bout ran silent for its opening actions with no explanation anywhere, which
 *   the owner reported as "some early attacks don't kick in".
 *
 *   **Swallowing it was the mistake, not the rejection.** It is now said ONCE,
 *   and the next real interaction unblocks the arena.
 */
let audioBlocked = false;
let audioBlockLogged = false;
let audioLatencyLogged = false;

/**
 * The player's report that the browser is holding sound back: a rejected
 * `play()` on the element path, a suspended context on Web Audio. Said once in
 * the log; the banner says what to do.
 */
function noteAudioBlocked() {
  audioBlocked = true;
  showAudioPrompt();
  if (!audioBlockLogged) {
    audioBlockLogged = true;
    log("your browser is blocking audio until you interact with the page — click the arena once.", { warn: true });
  }
}

/**
 * ► **A LOG LINE IS NOT A PROMPT, AND THE OWNER MISSED IT.** The blocked-audio
 *   warning went into the log panel, forty lines deep, next to every other
 *   message — so a spectated bout ran silent and the one sentence explaining
 *   why scrolled away. Reported as *"did sounds disappear? I haven't heard them
 *   in a while."*
 *
 *   It is a BANNER over the stage now, it says what to do, and it clears itself
 *   on the click that fixes it. The log line stays as the record.
 */
function showAudioPrompt() {
  let banner = document.getElementById("audio-prompt");
  if (banner) return;
  banner = document.createElement("button");
  banner.id = "audio-prompt";
  banner.type = "button";
  banner.textContent = "🔇  Your browser is blocking sound — click here to turn it on";
  banner.addEventListener("click", unblockAudio);
  el("stage").append(banner);
}

function hideAudioPrompt() {
  document.getElementById("audio-prompt")?.remove();
}

function unblockAudio() {
  hideAudioPrompt();
  // ► **THE CONTEXT IS RESUMED HERE, INSIDE THE GESTURE**, because that is the
  //   only place a browser lets a suspended `AudioContext` start. The latency
  //   it reports once running is logged once: the number nobody had measured
  //   for the element path it replaced.
  soundPlayer.unlock().then((running) => {
    if (!running) return;
    // ► **CLEARED AGAIN ONCE IT REALLY RUNS (2026-09-24).** The crowd's loop is
    //   asked for on EVERY draw, so a draw between this gesture and the resume
    //   finds the context still suspended and raises the banner again — which
    //   then stayed up over a crowd that was audibly playing.
    if (audioBlocked) {
      audioBlocked = false;
      hideAudioPrompt();
    }
    if (audioLatencyLogged) return;
    const latency = soundPlayer.latency();
    if (!latency) return;
    audioLatencyLogged = true;
    const ms = (seconds) => (seconds === null ? "?" : `${(seconds * 1000).toFixed(1)} ms`);
    log(`audio: Web Audio running — base latency ${ms(latency.base)}, output latency ${ms(latency.output)}.`);
  });
  if (!audioBlocked) return;
  audioBlocked = false;
  log("audio unblocked — sound is on from here.");
}
for (const type of ["pointerdown", "keydown", "touchstart"]) {
  window.addEventListener(type, unblockAudio, { passive: true });
}

/**
 * FETCH AND DECODE EVERY BOUND SOUND BEFORE IT IS NEEDED.
 *
 * ► **`cloneNode()` OF AN UNLOADED `Audio` STARTS ITS OWN FETCH**, so the FIRST
 *   play of each file waited on a network round trip and a decode — which is
 *   heard as a footstep that lands after the foot. The owner reported it as
 *   *"some were delayed with their action"*, and it would have thinned out on
 *   its own over a long bout, which is exactly the shape of a bug that gets
 *   called a fluke.
 *
 *   Measured before doing this: **57 distinct bound files, 0.90 MB in total,
 *   mean 16 KB, none over 120 KB.** So the whole combat soundtrack costs less
 *   than one of the arena's own JSON files and there is nothing to be clever
 *   about. The big ambient tracks are NOT bound to a clip label and are not
 *   touched.
 *
 * ► **ON WEB AUDIO THIS IS A DECODE, NOT A HINT (2026-09-23).** Each file is
 *   fetched and decoded into a buffer once, here; a play never waits on either.
 *   The timed cues' files are included, which on the shipped build are the
 *   bindings' files again — the same `StartSound` tags read twice.
 */
function primeSoundCache(manifest) {
  const files = new Set();
  for (const bound of Object.values(soundBindings ?? {})) {
    for (const file of Array.isArray(bound) ? bound : [bound]) {
      if (typeof file === "string" && file.length > 0) files.add(file);
    }
  }
  for (const entry of Object.values(soundTiming?.labels ?? {})) {
    for (const sound of entry.sounds) files.add(sound.file);
  }
  // The arena's own: the crowd, the stings, the intro and the win — eight
  // files, 0.84 MB on the shipped build, the crowd's 14 s loop the largest —
  // and, since the seats, the loss sting 2248 (192,618 bytes in the pack's
  // manifest; not re-summed with the eight).
  for (const file of Object.values(arenaSoundFiles)) if (file) files.add(file);
  soundPlayer.preload(files, {
    leadInSeconds: leadInSecondsFrom(manifest),
    lengthSeconds: soundSecondsFrom(manifest)
  }).then(({ requested, ready, trimmed }) => {
    const verb = soundPlayer.route === "webaudio" ? "decoded" : "preloaded";
    const lead = trimmed > 0 ? `, ${trimmed} with the build's MP3 lead-in skipped` : "";
    log(`sound: ${ready} of ${requested} clip(s) ${verb} from your own install${lead}.`);
  });
}

/* ------------------------------------------------------------------ */
/* The arena's own sounds — the crowd, the intro and the result         */
/* ------------------------------------------------------------------ */

/**
 * ► **THE SOUNDS THE BUILD PLAYS FROM CODE, NOT FROM THE FIGHTER CLIP
 *   (2026-09-24).** The crowd's ambience at its live volume, its chance cheers
 *   and boos, the win sound, the victory sting and the pre-fight intro. Which,
 *   when, how loud and whose level are all `arenaSoundStep` and its neighbours
 *   in `src/render/crowd-sound.js`, under the suite, with the authored team
 *   rules labelled there. What lives here is the clock, the host's numbers and
 *   the hand-off to the player's `perform`.
 */
let arenaSoundFiles = arenaSoundFilesFrom(null);
let arenaSoundState = createArenaSoundState();
/** The crowd a spectator hears: the host's, from the moment each action's DRAWING ends. */
let crowdPresenter = createCrowdPresenter(ss2CrowdInterestOf(host.battle));
/**
 * The build's `combat_panel` load: the crowd's clock and its roll's frame 0.
 * ► **STAMPED WHEN THE ASSET GATE OPENS (2026-09-24)**, not at module load: the
 *   panel loads when the arena APPEARS, and until then the page is showing the
 *   loading frame. No arena sound is stepped before it (`frame`).
 */
let boutStartedAt = null;
/** Each side's opening levels — the build's `hero.herolevel`, read before any experience. */
const sideLevels = new Map(host.battle.teams.map((team) => [
  team.id,
  team.combatants.map((combatant) => resourceValue(combatant, "herolevel", Number.NaN))
]));
const crowdHeard = crowdHeardFor([...sideLevels.values()].flat());
let boutUnderway = false;
/** `{atMs, winnerTeamId, winnerLevel, lost}` once decided: the build's `combat_won`, or `combat_lost` when `lost`. */
let arenaResult = null;

/**
 * A submitted step as the arena's sounds see it: the crowd it leaves, heard
 * from the moment its drawing ENDS (its latest clip chain or projectile, as
 * the gate counts them), and the result it may decide — which lands when the
 * deciding blow is DRAWN landing (`decidingBlowMsFor`: a lethal rock, an
 * arrow's or a fireball's impact), as `death()` does in the build.
 */
function noteArenaSoundStep(step, started) {
  boutUnderway = true;
  const now = performance.now();
  const tokens = new Set(step.actionTokens);
  const endsAt = stepEndsAtMs({
    entries: started.values(),
    projectiles: [
      ...inFlight.filter((shot) => tokens.has(shot.token)),
      ...fireballs.filter((entry) => tokens.has(entry.token)).map((entry) => ({ startedAt: entry.startedAt, durationMs: entry.flightMs })),
      ...boulders.filter((entry) => tokens.has(entry.token)).map((entry) => ({ startedAt: entry.startedAt, durationMs: entry.fallMs }))
    ],
    fallbackMs: now
  });
  crowdPresenter = queueCrowdInterest(crowdPresenter, ss2CrowdInterestOf(host.battle), endsAt);
  const result = host.battle.result;
  if (!result || arenaResult) return;
  const winnerTeamId = result.winnerTeamId ?? null;
  arenaResult = {
    atMs: now + decidingBlowMsFor(step.commands),
    winnerTeamId,
    winnerLevel: winnerTeamId === null ? null : winningSideLevel(sideLevels.get(winnerTeamId)),
    // The build's `combat_lost` — the crowd stopped at once and 2248 — only
    // for a person who played the losing side alone (`seatOutcomeFor`).
    lost: seatOutcomeFor(result, seats) === "lost"
  };
}

/**
 * One draw of the arena's own sounds: decided in `crowd-sound.js`, played by
 * the player. Its own `try`, because it runs FIRST in `frame`: a throw here
 * must cost the crowd, never the drawing and the turn after it.
 */
let arenaSoundErrorLogged = false;
function stepArenaSounds(now) {
  try {
    // Only frames inside the stale window are judged again; older changes fold.
    crowdPresenter = settleCrowdInterest(crowdPresenter, now - 1000);
    const { state, actions } = arenaSoundStep(arenaSoundState, {
      nowMs: now,
      boutStartMs: boutStartedAt,
      seed,
      crowd: crowdPresenter,
      crowdHeard,
      started: boutUnderway,
      result: arenaResult,
      files: arenaSoundFiles
    });
    arenaSoundState = state;
    for (const action of actions) {
      // A `"pending"` element play answers later, and the intro waits for it.
      const late = (outcome) => { arenaSoundState = arenaSoundSettled(arenaSoundState, action, outcome); };
      arenaSoundState = arenaSoundSettled(arenaSoundState, action, soundPlayer.perform(action, late));
    }
  } catch (error) {
    if (arenaSoundErrorLogged) return;
    arenaSoundErrorLogged = true;
    log(`arena sounds stopped on an error, the bout goes on: ${String(error?.message ?? error).slice(0, 160)}`, { warn: true });
  }
}

/** Said once, when the pack lands: what the arena's own sounds found, and what this bout will hear. */
function reportArenaSounds() {
  const found = Object.entries(arenaSoundFiles).filter(([, file]) => file).map(([key]) => key);
  const missing = Object.keys(arenaSoundFiles).filter((key) => !arenaSoundFiles[key]);
  log(`arena sounds: ${found.length} of ${found.length + missing.length} in your pack` +
    (missing.length > 0 ? ` (missing: ${missing.join(", ")})` : "") +
    (crowdHeard
      ? "; the crowd is heard — its volume follows the crowd, with a seeded 1-in-1000 cheer above 70 and boo below 20."
      : "; the crowd is SILENT this bout, as the build's is when the hero is level 1: no fighter is above level 1."));
  if (arenaSoundFiles.won && SS2_ARENA_SOUNDS.won.envelope) {
    log("arena sounds: the win sound carries a volume envelope no dump has read; it plays whole.", { warn: true });
  }
}

/**
 * ► **ONE `Audio` ELEMENT PER FILE MEANT ONE SOUND AT A TIME, and the owner
 *   heard exactly that: "sounds get cut off and don't play out."** The cache
 *   held a single element per file and every play did `currentTime = 0` on it.
 *   Every play has had its own voice since, capped at 16 by `retireVoices`;
 *   both now live in `tools/arena/sound-player.js`, where a test can drive them.
 *
 * ► **A SOUND FIRES WHEN THE DRAWN POSE REACHES ITS FRAME, NOT WHEN ITS CLIP
 *   STARTS (2026-09-23).** ~~`playFor(family, sequence, label)` at `beginStep`
 *   and at a queued clip's takeover, with a `setTimeout` for a victim's
 *   delay~~ — which played every sound at the FIRST frame of its clip, while
 *   the build starts it where its `StartSound` sits: 16 frames into direction
 *   8's hurt run, 12 into a knockback. The draw loop now asks
 *   `dueSoundCues` each frame, with the clock it poses the figure by, exactly
 *   as the blood beside it does; so a sound waits for a delayed start, fires
 *   in a continuation at its frame, and never fires for a clip cut short
 *   before it. `settleEntrySounds` covers the frame a clip ENDS between draws.
 */
function soundPlanFor(entry, facing) {
  const { family, label } = entry.timeline;
  // The DRAWING's own resolved label when there is a rig: a walk draws
  // `stepforward` or `stepback` by facing, and the sound must be that clip's.
  const drawnLabel = hasExtractedArt(figurePack)
    ? animationFor(figurePack, { family, label, facing })?.label ?? null
    : null;
  return soundCuesFor(
    { bindings: soundBindings, timing: soundTiming },
    { family, label, facing, sequence: entry.token ?? 0, drawnLabel }
  );
}

/** Play whatever of this entry's cues its clock has reached, once each. */
function soundEntry(entry, now, facing) {
  if (!entry?.timeline) return;
  if (!entry.soundPlan) entry.soundPlan = soundPlanFor(entry, facing);
  const { due, fired } = dueSoundCues(entry.soundPlan, {
    elapsedMs: now - entry.startedAt,
    durationMs: entry.timeline.durationMs,
    fired: entry.soundsFired ?? 0
  });
  entry.soundsFired = fired;
  for (const cue of due) soundPlayer.play(cue);
}

/**
 * The cues an entry reached since the last draw, played as it LEAVES
 * `playing` — expired, handed to its queued successor, or replaced by a new
 * step. A clip that finished between two frames still sounds its last pose;
 * one replaced mid-run sounds only what it reached, which is the build's
 * `gotoAndPlay` cutting a run short. `dueSoundCues` drops anything stale.
 */
function settleEntrySounds(combatantId, entry, now) {
  if (!entry || !Number.isFinite(entry.startedAt) || now < entry.startedAt) return;
  const actor = scene.actors[combatantId];
  soundEntry(entry, now, figureFacingAt({ facing: actor?.facing, turn: actor?.turn ?? null, pendingTokens }));
}

/**
 * What the draw loop needs beside a timeline entry it is about to pose: the
 * blood its clip throws and the sounds it plays, both still to be resolved.
 * Called when an entry STARTS — at `beginStep`, and when a queued `then` takes
 * over in `drainFinishedAnimations`.
 */
function prepareEntry(entry) {
  // ► **WHICH POSE THROWS BLOOD is the DRAWN run's, resolved at the entry's
  //   first draw (2026-09-24; `src/render/blood-timing.js`).** ~~The un-joined
  //   `figurePack.animations[entry.timeline.label]`, converted here by
  //   `effectsForAnimation` and compared against its own pose count~~ — which
  //   drew `hurt8` as the 34-pose run into `hurt9` and bled only from the 16
  //   poses of `hurt8`, so `hurt9`'s two sprays never fired; and which found
  //   nothing at all for a death, whose timeline carries the engine's variant
  //   (`slain`) while the figure draws `death1`. The plan is resolved from the
  //   painter's own options, at the first draw, where the facing is the one
  //   the figure is drawn with — the sounds' reason, below.
  //
  //   No table or no pack is a plan with no blood: still a bout.
  entry.bloodPlan = null;
  entry.bloodFired = 0;
  // The sounds, resolved at the entry's first DRAW, where its facing is the
  // one the figure is drawn with. See `soundEntry`.
  entry.soundPlan = null;
  entry.soundsFired = 0;
  return entry;
}

/**
 * The `_yscale` a gladiator is DRAWN at, this frame — the scene's, or the size
 * it has part-way through a colossus, a little fat kid or their expiry
 * (`figureYscaleAt`, 2026-09-24). Every size read in this file goes through
 * here, so the figure, its face and blood, the arrows it looses and takes, and
 * the body a lob clears are one size. `extraPending` are tokens a step has
 * folded but not yet registered — `beginStep` flies its arrows first.
 */
function drawnYscaleOf(combatantId, now = performance.now(), extraPending = []) {
  const actor = scene.actors[combatantId];
  if (!actor) return null;
  const rescale = actor.rescale ?? null;
  const running = playing.get(combatantId);
  return figureYscaleAt({
    yscale: actor.yscale,
    rescale,
    pendingTokens: extraPending.length > 0 ? [...pendingTokens, ...extraPending] : pendingTokens,
    elapsedMs: running && rescale && running.token === rescale.actionToken && Number.isFinite(running.startedAt)
      ? now - running.startedAt
      : null
  });
}

/**
 * Every placed, living gladiator but these two, as `{x, y, yscale}` — the
 * bodies a drawn lob must pass over. Positions are the scene's (this batch
 * already folded), life is the wire's, and the size is the one each is DRAWN
 * at while the shot flies (`drawnYscaleOf`).
 */
function bodiesBesides(ids, extraPending = []) {
  const living = combatantsById();
  const bodies = [];
  for (const id of scene.drawOrder) {
    if (ids.includes(id)) continue;
    const actor = scene.actors[id];
    if (!actor?.placed || !Number.isFinite(actor.x) || living.get(id)?.alive === false) continue;
    bodies.push({ x: actor.x, y: actor.y, yscale: drawnYscaleOf(id, performance.now(), extraPending) });
  }
  return bodies;
}

function beginStep(step) {
  scene = applyCommands(scene, step.commands);

  // THE DECISION IS `timelinesForStep` in `src/render/cursor.js`, under the
  // suite — pairing a travelling gait with the `move-clip` from its own batch
  // is exactly the kind of thing that is invisible on a screenshot. This shell
  // stamps the clock and says the notices out loud.
  const { started, notices } = timelinesForStep(step.commands);
  for (const notice of notices) log(notice.reason, { warn: true });

  // The arrows this batch loosed, each given its own clock and the same action
  // token the shooter's timeline carries — so the gate waits for the arrow AND
  // the animation, whichever is longer, which is what the build does.
  //
  // Read off the SCENE rather than the command stream, because the scene has
  // already folded them and a shell reading both would be holding two sources
  // for one fact. `scene.projectiles` is this batch's own and does not carry
  // forward, which is exactly the list wanted here.
  for (const shotRecord of scene.projectiles) {
    // A FIREBALL is routed out before `projectileFlight`, which refuses it:
    // it flies the build's own impact test, not the arrow's stop-short. See
    // `fireballFlight` in `src/render/projectile.js`.
    if (shotRecord.projectile === "fireball") {
      const flight = fireballFlight({
        from: shotRecord.from,
        to: shotRecord.to,
        gladiatorDir: shotRecord.gladiatorDir,
        xVelocity: shotRecord.xVelocity,
        // `attacker._yscale * 1.5 + 5`: the build writes the launch height in
        // terms of the caster's own size, so the caster's size is handed over —
        // and the target's, whose shoulder the burst is drawn on.
        casterYscale: drawnYscaleOf(shotRecord.combatantId, performance.now(), step.actionTokens),
        targetYscale: drawnYscaleOf(shotRecord.targetId, performance.now(), step.actionTokens)
      });
      fireballs.push({
        flight,
        token: shotRecord.actionToken,
        startedAt: performance.now(),
        flightMs: flightDurationMs(flight),
        lifetimeMs: fireballLifetimeMs(flight)
      });
      continue;
    }
    const flight = projectileFlight({
      kind: shotRecord.projectile,
      from: shotRecord.from,
      to: shotRecord.to,
      sequence: shotRecord.sequence,
      targetSize: shotRecord.targetSize,
      // `attacker._yscale * 2 + 30` / `* 1.5 + 5`: the arrow leaves from THIS
      // shooter's head or shoulder, which the build writes in terms of its
      // `_yscale` — the same `yscale` its figure is drawn at. And the drawn
      // flight ends on the TARGET's shoulder, which its own `yscale` places.
      // Both DRAWN (`drawnYscaleOf`): a spell that runs out as this phase ends
      // resizes its bearer only once the arrow is home.
      shooterYscale: drawnYscaleOf(shotRecord.combatantId, performance.now(), step.actionTokens),
      targetYscale: drawnYscaleOf(shotRecord.targetId, performance.now(), step.actionTokens),
      // ► **EVERY OTHER LIVING BODY, so a LOB IS DRAWN OVER THEM (2026-09-23).**
      //   The rules exempt a bombard from line blocking because it clears
      //   bodies; `lobLiftAt` keeps the drawing true to that, and it can only
      //   clear the bodies it is told about.
      bodies: bodiesBesides([shotRecord.combatantId, shotRecord.targetId], step.actionTokens)
    });
    inFlight.push({
      flight,
      artFrame: shotRecord.artFrame,
      token: shotRecord.actionToken,
      startedAt: performance.now(),
      durationMs: flightDurationMs(flight)
    });
  }

  // The spell clips this batch attached, each on its own clock. Read off the
  // SCENE for the reason the arrows are: the scene has already folded them.
  //
  // ► **ROUTED BY THE BUILD'S OWN LINKAGE, and until 2026-09-23 nothing was.**
  //   Every attached record went to `attached`, which `drawSpellEffects` paints
  //   as a lightning bolt — so any second kind of effect would have been drawn
  //   as lightning (`test/ss2-teleport.test.js` names that hazard for the
  //   teleport's `circlets`). An effect this shell cannot draw is said out loud
  //   and not drawn as something else.
  for (const record of scene.effects ?? []) {
    if (record.effect === "boulder_combat" && record.fall) {
      // How long the landing stays is the PACK's answer, asked once per rock so
      // the frame that draws it and the prune that removes it read one number.
      const landedFrames = boulderLandedFramesFor(propPack);
      const drawn = boulderDrawAt(record, 0, effectDrawDeps(), { landedFrames });
      boulders.push({
        record,
        token: record.actionToken,
        startedAt: performance.now(),
        landedFrames,
        fallMs: drawn.fallMs,
        lifetimeMs: drawn.lifetimeMs
      });
      continue;
    }
    if (record.effect !== "lightning_bolt_combat") {
      log(`no painter for the attached effect "${record.effect}" — not drawn`, { warn: true });
      continue;
    }
    attached.push({
      record,
      startedAt: performance.now(),
      // The victim's clips in this batch — on a kill, its reaction and then
      // its death, queued behind it — from the same `started` map that is
      // about to pose it. See `effectLifetimeMs`.
      lifetimeMs: effectLifetimeMs(record, started)
    });
  }

  // The clock is stamped BEFORE the entries reach `playing`, not after: an
  // entry with no `startedAt` reads as infinitely overdue to `animationCursor`.
  // Stamped here rather than inside `timelinesForStep` so a frame that arrives
  // late does not make a timeline look overdue before it has drawn once.
  //
  // ► **A FIREBALL'S VICTIM STARTS AT IMPACT**, `reactionDelaysFor`'s answer,
  //   so its clock is stamped in the FUTURE. `animationCursor` already counts
  //   an entry that has not begun as running, so the gate stays shut; the two
  //   pose sites below treat it as absent until it begins.
  // ► **AND AN ARROW'S, since 2026-09-23** — the build rolls the shot on the
  //   frame the bullet arrives (`+0x6d29`), so the hurt or defend clip, the
  //   death behind it and the pop-up wait for the drawn arrow above, whose
  //   flight `reactionDelaysFor` measures from the same four inputs.
  const delays = reactionDelaysFor(step.commands);
  for (const [combatantId, entry] of started) {
    entry.startedAt = performance.now() + (delays.get(combatantId) ?? 0);
    prepareEntry(entry);
  }
  for (const [combatantId, entry] of started) {
    // The clip this one replaces sounds what it reached and no more.
    settleEntrySounds(combatantId, playing.get(combatantId), performance.now());
    playing.set(combatantId, entry);
  }

  // The fight pop-ups, each starting WITH its fighter's reaction clip — the
  // build attaches it in the same action (`defender_hurt` +0x211e/+0x2120).
  spawnPopups(step, started, delays);

  // The crowd this step leaves, and the result it may decide, for the arena's
  // own sounds — played from the draw loop, never here (`stepArenaSounds`).
  // After the projectiles and the clips are stamped: it reads when they end.
  noteArenaSoundStep(step, started);

  // ► **NO SOUND IS PLAYED HERE ANY MORE (2026-09-23).** A sound per animation
  //   that started used to fire at this line, keyed on the family AND the
  //   label (missing until 2026-09-13, when `attack3` on screen met whichever
  //   attack sound a counter landed on — `chooseSound` carries that story),
  //   with a `setTimeout` for a victim's delay. The draw loop sounds each
  //   entry now, at the pose the build's `StartSound` sits on; the delay is
  //   the entry's own future `startedAt`. See `soundEntry`.

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
 * The pop-ups one step shows, clocked. WHICH and WITH WHAT is
 * `popupsForEvents`; this reads the step's own events off the wire (every event
 * at or after its action boundary is this action's — it was just applied) and
 * the ledger the rule set's observer filled during `host.submit`.
 *
 * WHEN: a pop-up starts with its fighter's clip from this batch (a fireball's
 * or an arrow's victim at impact, via `reactionDelaysFor`), a molten-death rock's on its own
 * landing frame. `maxscale` is the camera's TARGET zoom now, because the build
 * scales the icon once, at attach (+0x16cf).
 */
function spawnPopups(step, started, delays) {
  const strikes = strikeLedger.take();
  const boundary = step.actionBoundary;
  if (!Number.isFinite(boundary)) return;
  const events = host.wire().events.filter((event) => event.sequence >= boundary);
  const now = performance.now();
  for (const popup of popupsForEvents(events, { strikes, seed: boundary })) {
    const clipStart = started.get(popup.combatantId)?.startedAt;
    const startedAt = Number.isFinite(popup.delayFrames)
      ? now + popup.delayFrames * PROJECTILE_FRAME_MS
      : (Number.isFinite(clipStart) ? clipStart : now + (delays.get(popup.combatantId) ?? 0));
    popups.push({ popup, startedAt, maxscale: camera?.maxscale ?? null });
  }
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
  // An arrow that has landed stops being work in progress AND stops being
  // drawn, in one place, so the two can never disagree about whether it is
  // still there.
  inFlight = inFlight.filter((shot) => now - shot.startedAt < shot.durationMs);
  // A bolt is removed when its victim's clip ends, by the same comparison the
  // painter uses, so a bolt being drawn and a bolt still attached are one fact.
  attached = attached.filter((entry) => now - entry.startedAt < entry.lifetimeMs);
  // A fireball is removed by its explosion's last frame — `fireballDrawAt`'s
  // `done`, by the same comparison.
  fireballs = fireballs.filter((entry) => now - entry.startedAt < entry.lifetimeMs);
  // A boulder is removed when its landing is over — `boulderDrawAt`'s `done`,
  // which is never for a still landing nothing in the build removes.
  boulders = boulders.filter((entry) => now - entry.startedAt < entry.lifetimeMs);
  // A drop lives 25 of the build's frames and is REMOVED rather than fading
  // (`+0x046a`). Pruned by the same comparison that decides whether to draw it.
  drops = drops.filter((spray) => (now - spray.startedAt) / PROJECTILE_FRAME_MS <= SS2_DROP.lifeFrames);
  // A pop-up goes at its removeMovieClip frame, or the moment a later one takes
  // its depth on the same fighter. It holds no gate: nothing in the build
  // waits on one (the only read is +0x18a1, inside `damagecharacter`).
  popups = prunePopups(popups, now);
  // Only a fireball's FLIGHT holds the gate — `bullet_in_air` is cleared at
  // impact (`+0x91f5`) — and its victim's reaction, started then, holds it on.
  const cursor = animationCursor(pendingTokens, playing, now, {
    projectiles: [
      ...inFlight,
      ...fireballs.map((entry) => ({ token: entry.token, startedAt: entry.startedAt, durationMs: entry.flightMs })),
      // A rock still in the air is work in progress, as a fireball in flight
      // is: without a kill the build's burn cannot release the phase before
      // the last one lands (`SS2_DEATH_FROM_ABOVE`).
      ...boulders.map((entry) => ({ token: entry.token, startedAt: entry.startedAt, durationMs: entry.fallMs }))
    ]
  });
  // ► **A QUEUED CLIP TAKES OVER WHEN ITS PREDECESSOR ENDS** — a victim's
  //   death, queued behind the reaction its killing blow started (2026-09-23;
  //   `timelinesForStep`). The cursor stamps where it starts; this shell poses
  //   it, as `beginStep` does for a clip a batch starts. Before `expired`, so a
  //   late frame that ran past the whole chain still ends it.
  //
  //   The link that ENDED is settled first, so a sound on its last pose is not
  //   lost between two draws; the new link sounds from the draw loop, at its
  //   own poses, like any other entry (`soundEntry`). A link a very late frame
  //   skipped WHOLE is never in `playing` and is not sounded — its cues would
  //   be stale by the whole of its length anyway.
  for (const { combatantId, entry } of cursor.advanced) {
    settleEntrySounds(combatantId, playing.get(combatantId), now);
    playing.set(combatantId, prepareEntry(entry));
  }
  for (const combatantId of cursor.expired) {
    settleEntrySounds(combatantId, playing.get(combatantId), now);
    playing.delete(combatantId);
  }

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
/**
 * ► **THE GATE MOVED TO `settlementReadiness` ON 2026-09-19.** It was five
 *   terms of boolean inside a function the suite cannot reach, whose failure
 *   mode is a page that looks alive, keeps painting and silently never
 *   acknowledges. What is left here is the state it reads and the call it
 *   makes.
 */
function settleIfReady() {
  const readiness = settlementReadiness({
    alreadySettled: settled,
    hasResult: Boolean(host.battle.result),
    pendingTokens: pendingTokens.length,
    playingCount: playing.size,
    completionToken: scene.completionToken
  });
  if (!readiness.ready) return;

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

/**
 * THE SURFACE, AND THE BINDING EVERY PAINTER ACTUALLY DRAWS THROUGH.
 *
 * ► **`context` IS A `let` SINCE 2026-09-15, AND THE REASON IS THE ONE THING
 *   THIS FILE MUST NOT GET WRONG.** `paintGroupRuns` composites a filtered or
 *   blended group by REBINDING this name to an offscreen for the length of one
 *   run — see its docstring for why that beats threading a `ctx` parameter
 *   through six painters in the one file `node --test` cannot import. `surface`
 *   is the real canvas and never moves, so `render()` can re-assert the
 *   invariant at the top of every frame and an exception mid-run cannot leave
 *   the whole arena being drawn into a buffer nobody looks at.
 */
const surface = canvas.getContext("2d");
let context = surface;

/**
 * ► **THE CANVAS HAD NO SIZE, AND NOBODY HAD EVER GIVEN IT ONE — found by an
 *   audit, 2026-09-18, and it is the oldest defect in this file.**
 *
 * `index.html` declares a bare `<canvas id="arena">`. HTML's default backing
 * store is **300x150**, and this file only ever READ `canvas.width` /
 * `canvas.height` — at `viewport()`, at the stage-fit report and at the click
 * mapper — it never assigned them. There was no `resize` handler and no
 * `devicePixelRatio` anywhere in 4,000 lines. CSS then stretched that 300x150
 * image across a stage several times its size.
 *
 * So every pixel measurement this project has published, every clip-residual
 * sweep and every rasteriser comparison was taken through one bilinear upscale
 * that nothing recorded. The arithmetic in `src/render/` was always right; it
 * was being asked to fit a camera into a postage stamp.
 *
 * **Device pixels, not CSS pixels**: the backing store is the CSS box times
 * `devicePixelRatio`, so the projection gets the resolution the display
 * actually has. `viewport()` reads `canvas.width`, which is now that number,
 * and the click mapper at the bottom of this file already divides by
 * `rect.width` — so it keeps working without being told.
 */
/**
 * ► **THE ARITHMETIC MOVED TO `canvasBackingFor` ON 2026-09-19, AND WHAT IS
 *   LEFT HERE IS THE FOUR DOM ACCESSES IT NEEDS.** Two reads
 *   (`devicePixelRatio`, the CSS box) and two writes (`canvas.width/height`).
 *   The decision between them ran with nothing behind it for the whole life of
 *   this project, in the same function that had no sizing at all until
 *   2026-09-18 and so published every pixel number through a 300x150 buffer.
 *
 *   **Assigning either dimension CLEARS the canvas and resets the 2d state**,
 *   which is why the decision reports `changed` and this applies it only then.
 */
function sizeCanvasToStage() {
  const rect = canvas.getBoundingClientRect();
  const wanted = canvasBackingFor({
    rectWidth: rect.width,
    rectHeight: rect.height,
    devicePixelRatio: window.devicePixelRatio,
    currentWidth: canvas.width,
    currentHeight: canvas.height
  });
  if (!wanted.changed) return false;
  canvas.width = wanted.width;
  canvas.height = wanted.height;
  return true;
}

sizeCanvasToStage();
window.addEventListener("resize", sizeCanvasToStage, { passive: true });

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
/**
 * WHICH OF THE SIX ARENAS, WHICH OF THE SKIES, AND WHETHER IT RAINS.
 *
 * ► **THE GAME HAS SIX ARENAS AND THIS PAGE USED TO SHOW ONE.** The build
 *   dresses `sand` and `crowd` from one `current_arena` index and the sky from
 *   `time_of_day`; all three are query parameters here so they can be LOOKED
 *   AT, which is the only check any of this has. `?arena=4&sky=11&rain=13`.
 *
 * Out-of-range values fall back to frame 1 in `frameForLayer` rather than
 * throwing — it is a URL, not a config file, which is the rule `rankStrideFrom`
 * already set.
 */
const arenaDressing = {
  arena: Number(params.get("arena")) || SS2_ARENA_DRESSING.arena,
  timeOfDay: Number(params.get("sky")) || SS2_ARENA_DRESSING.timeOfDay,
  weather: Number(params.get("rain")) || SS2_ARENA_DRESSING.weather
};

/**
 * `?enchant=<type>.<potency>` — A DEMO OVERRIDE, AND IT IS NOT A BATTLE.
 *
 * ► **NOTHING ON THIS ROSTER CARRIES AN ENCHANTMENT, SO WITHOUT THIS NOBODY
 *   CAN LOOK AT ONE.** `tools/arena/roster.js` builds its gladiators from
 *   `ss2Combatant` with no enchantment fields at all, and
 *   `randomise_gladiator` zeroes them in the build — so every weapon in this
 *   page draws bare, forever, and the whole twelve-cell ladder is invisible.
 *   This forces a pair onto every fighter so the art can be SEEN.
 *
 * ► **AND IT IS ANNOUNCED IN THE LOG PANEL AS AN OVERRIDE, IN THE PANEL A
 *   SCREENSHOT CATCHES, BECAUSE A PICTURE OF IT IS NOT EVIDENCE.** This
 *   project's corpus is measured, and a screenshot of a forced glow filed
 *   beside one of a real bout would be a fabricated observation. The line says
 *   so on the shot itself, not only here.
 *
 * ► **BOTH SLOTS, AND THAT IS THE POINT OF THE FOUR-PART FORM.** The build
 *   reads the EQUIPPED slot's own pair for the glow — `itemglow(weapon,
 *   weapon_enchantment_type, weapon_enchantment_potency)` in melee and
 *   `itemglow(weapon, secondary_weapon_enchantment_type,
 *   secondary_weapon_enchantment_potency)` with a bow up — while
 *   `damagecharacter` gates the PROC on `weapon_enchantment_potency` whichever
 *   is equipped. `?enchant=3.2` sets both pairs, so a glow appears whatever is
 *   in hand; `?enchant=3.2.5.1` sets them apart, which is the configuration
 *   where a renderer that reused the proc's rule would draw the wrong colour.
 *
 * ► **A MISSING POTENCY IS 0 AND IS NOT QUIETLY PROMOTED TO 1.** In the build,
 *   a potency outside 1..3 calls `gotoAndStop` ZERO times and the clip keeps
 *   whatever frame it is on — there is no trailing default — so `?enchant=3`
 *   really does mean "no cell". Defaulting it would invent a measurement, and
 *   `Number(params.get(...)) || 0` inventing a default is the exact defect
 *   `rankStrideFrom` exists over, forty lines up. `complete` is what the log
 *   line warns on instead.
 *
 * Pure, so the test lifts it out of this file and runs it: a URL is not a
 * config file and nothing here may throw.
 */
function enchantDemoFrom(params) {
  const raw = params && typeof params.get === "function" ? params.get("enchant") : null;
  if (raw === null || raw === undefined || String(raw).length === 0) return null;
  const parts = String(raw).split(".");
  const at = (index) => {
    const value = Number(parts[index]);
    return Number.isFinite(value) ? value : 0;
  };
  const type = at(0);
  const potency = parts.length > 1 ? at(1) : 0;
  return {
    text: String(raw),
    // Both halves given? A one-part `?enchant=3` is a type with no cell.
    complete: parts.length > 1,
    fields: {
      weapon_enchantment_type: type,
      weapon_enchantment_potency: potency,
      // The bow slot follows the melee slot unless the URL splits them.
      secondary_weapon_enchantment_type: parts.length > 2 ? at(2) : type,
      secondary_weapon_enchantment_potency: parts.length > 3 ? at(3) : potency
    }
  };
}

const ENCHANT_DEMO = enchantDemoFrom(params);

/**
 * THE CAMERA, and it is the build's own — `combatscale`, which runs every
 * enterFrame in the shipped build. See `src/render/arena-backdrop.js`: reading
 * it the other way round cost this session a retraction.
 *
 * Module state because it is a TWEEN: the zoom eases toward its target by a
 * fifth a frame and the pan by a sixteenth, so each frame needs the last one.
 * ~~"It is re-seeded settled whenever the roster changes size"~~ — it was
 * re-seeded at the build's OPENING shot (zoom 5, rushing in), never settled,
 * and keyed on a COUNT. Since 2026-09-24 it frames only the fighters still in
 * the fight, so that count falls with every death; the re-seed is keyed on the
 * roster's identity instead, and a death eases the camera. In a team bout it
 * then closes in on the survivors — AUTHORED, the owner's request, never a 1v1.
 * `stepFramedCamera` and `SS2_CLOSE_UP`.
 */
let camera = null;
let cameraFrame = null;

/**
 * Every placed actor — what the camera may frame, which of them are fighting
 * each other, and which are still in the fight.
 *
 * ► **THE SIDE IS LOAD-BEARING AND USED TO BE DROPPED HERE.** Without it the
 *   camera cannot tell the distance between two OPPONENTS from the width of the
 *   whole formation, so a 3v3 opening read as a 1020-unit fight and pulled back
 *   to a zoom of 30. Measured: the 3v3 then used 58% of the stage, LESS than
 *   the 2v2's 76%, with gladiators 45px tall instead of 75px. The owner saw it
 *   on the first screenshot. See `midwaypointFor`.
 * ► **`alive` IS THE WIRE'S AND `drawing` IS `playing`'s** — a fallen fighter
 *   stays framed while any clip of his is queued or running, so the camera does
 *   not pull away mid-fall. WHO is framed is `framedActors`, under the suite.
 * ► **THE DEPTH, THE SIZE AND THE SPAN are the survivors' close-up's**
 *   (`SS2_CLOSE_UP`): it fits each fighter's crown and swing on the stage, and
 *   `actorSpanFor` widens him to everywhere his running clip draws him.
 */
function placedActors() {
  const living = combatantsById();
  return scene.drawOrder
    .map((combatantId) => ({ id: combatantId, actor: scene.actors[combatantId] }))
    .filter(({ actor }) => actor && actor.placed !== false && Number.isFinite(actor.x))
    .map(({ id, actor }) => {
      const placement = host.layout.placementFor(id);
      return {
        id,
        x: actor.x,
        y: actor.y,
        yscale: actor.yscale,
        ...actorSpanFor(actor, playing.get(id) ?? null),
        side: placement?.side ?? null,
        teamId: placement?.teamId ?? null,
        alive: living.get(id)?.alive !== false,
        drawing: playing.has(id)
      };
    });
}

function stepCamera() {
  cameraFrame = stepFramedCamera(cameraFrame, placedActors(), { result: host?.battle?.result ?? null });
  camera = cameraFrame.camera;
}

/**
 * Arena units -> canvas pixels.
 *
 * ► **TWO VIEWS, AND WHICH ONE YOU GET DEPENDS ON WHETHER THE PLAYER HAS
 *   EXTRACTED THE ARENA.** Same arrangement as the figures and the sound: the
 *   build's own art when it is there, this repository's own when it is not.
 *
 * - **The STAGE view** is the build's: a fixed 640x420 stage letterboxed into
 *   the canvas, the arena at its measured origin inside it, and the camera
 *   panning and zooming `gladiators` the way `combatscale` does. Nothing is
 *   fitted to the roster — a 1v1 and a 3v3 get the same frame and differ in how
 *   far the camera has pulled back inside it. **That is what "the backdrop sets
 *   the scale" means** (owner, 2026-09-13).
 * - **The FITTED view** is the authored fallback, unchanged. `viewportFor` fits
 *   the roster because the authored bowl has no fixed size to be faithful to.
 *
 * All the arithmetic in both now lives in `src/render/`, under the suite. This
 * function chooses between them and holds no numbers of its own — which is the
 * standing lesson about this file, arriving for the sixth time.
 */
function viewport() {
  const width = canvas.width;
  const height = canvas.height;

  if (arenaScreenAvailable()) {
    return stageProjectorFor(camera, stageFitFor({ width, height }));
  }

  // WHICH scale and horizon fit this roster is decided in
  // `src/render/arena-shell.js`, under the suite — two live defects lived in
  // that arithmetic and both were found by screenshotting, because nothing
  // could test this file. What stays here is `toX`/`toY`, which close over the
  // canvas and are the mapping rather than the decision.
  const { scale, horizon } = viewportFor({
    width,
    height,
    frontY: ARENA_FRONT_Y,
    actors: scene.drawOrder.map((combatantId) => scene.actors[combatantId])
  });

  return {
    scale,
    horizon,
    toX: (x) => width / 2 + x * scale,
    // Arena y is 200 at the front rank and DECREASES further back, so a bigger
    // y is nearer the viewer and further down the canvas.
    // ► The `1.7` here is the AUTHORED depth factor and stays with the authored
    //   bowl, where the ground is a rectangle from the horizon down. The
    //   extracted arena draws depth behind the front rank at 0.5, and frames a
    //   team on the visible floor, because the build's crowd wall paints over
    //   the top of its sand: ~~"uses 1, because the build's sand is painted
    //   for the build's own `_y` range"~~ was measured against the sand and
    //   put the back rank in the wall. See `RANK_DEPTH_FACTOR` and
    //   `SS2_TEAM_FRAMING` in `src/render/arena-backdrop.js`.
    toY: (y, lift) => horizon + (height - horizon) * 0.62 - (ARENA_FRONT_Y - y) * scale * 1.7 - lift * scale
  };
}

/**
 * `Path2D` objects for extracted path data, by the `d` string.
 *
 * A pose is ~155 paths and six gladiators is ~930 a frame; building those from
 * strings every frame is the one place this shell can be accidentally slow. The
 * data is immutable and the key IS the geometry, so the cache never staleness.
 */
const pathCache = new Map();
function path2dFor(d) {
  let path = pathCache.get(d);
  if (!path) {
    path = new Path2D(d);
    pathCache.set(d, path);
  }
  return path;
}

/**
 * THE FIGURE'S OWN SPACE AS A CANVAS MATRIX — where it stands, how big it
 * draws, that arena y is UP while canvas y is DOWN, and which way it faces.
 *
 * ► **IT IS HOISTED OUT OF THE PER-OPERATION DRAW BECAUSE THE COMPOSITOR
 *   MEASURES ITS BUFFER AGAINST `context.getTransform()`, AND THAT IS THE
 *   WHOLE OF WHY `drawOps` CHANGED.** The old body applied
 *   `translate`/`scale` inside the SAME `save()` as the operation's own
 *   matrix, once per operation. That is pixel-identical to applying it once
 *   outside — `composedMatrix(figureOriginMatrix(...), op.matrix)` is the same
 *   product, and the test asserts it — but it left the CTM at whatever the
 *   canvas already held for the whole of `paintGroupRuns`. `runBoxOf` would
 *   then have measured a run in the figure's LOCAL units, which are a few
 *   hundred wide and centred on the soles of the feet: `bufferRegionOf` would
 *   have handed back a small rectangle in the canvas's top-left corner, and
 *   every glowing weapon would have been composited as an empty box.
 *
 * ► **`view.toX`/`view.toY` ARE CALLED ONCE HERE, NOT PER OPERATION.** They are
 *   the only part of this that reads the canvas, and a figure is ~130
 *   operations a frame.
 */
function figureOriginMatrix(view, origin) {
  const size = origin.size ?? 1;
  const flip = origin.facing === "left" ? -1 : 1;
  const k = size * view.scale;
  return [k * flip, 0, 0, -k, view.toX(origin.x), view.toY(origin.y, 0)];
}

/**
 * WHICH SPACE EACH RUN OF OPERATIONS IS IN, as maximal adjacent runs.
 *
 * A `path` operation is the EXTRACTED rig: it carries its own matrix in the
 * figure's local space and is drawn under `figureOriginMatrix`. Every other
 * kind is the authored fallback — `paintFigure`'s polygons and circles,
 * `paintShadow`'s ellipse — which works out canvas pixels for itself through
 * `view.toX`/`view.toY` and must NOT have that transform on the context.
 *
 * ► **EVERY CALL IN THIS BUILD IS HOMOGENEOUS, AND THIS IS A PARTITION
 *   ANYWAY.** `paintShadow` is all ellipses, `paintFigure` all polygons and
 *   circles, `paintExtractedFigure` and `mergeFaceOps` all paths — so this
 *   returns exactly one run every time it is called today, and the test says
 *   so against the real pack rather than leaving it as a claim. The
 *   alternative — a single `kind === "path"` test at the top of `drawOps` —
 *   would silently drop half of a mixed list, and `mergeFaceOps` is precisely
 *   the seam where a mixed list would first appear.
 */
function opSpaceRunsOf(ops) {
  const list = Array.isArray(ops) ? ops : [];
  const runs = [];
  let current = null;
  for (let index = 0; index < list.length; index += 1) {
    const operation = list[index];
    const space = operation && typeof operation === "object" && operation.kind === "path" ? "figure" : "canvas";
    if (!current || current.space !== space) {
      current = { space, from: index, to: index };
      runs.push(current);
    }
    current.to = index + 1;
  }
  return runs;
}

/**
 * HOW `paintGroupRuns` MUST READ AN EXTRACTED-FIGURE OPERATION.
 *
 * - `translationDivisor: 1` — `drawFigureOperation` hands `operation.matrix`
 *   straight to `context.transform` with no twips divisor, so the box has to be
 *   measured the same way. `paintArenaLayer` is the 20; `paintProp` is the
 *   other 1.
 * - `filtersScaled: true` — **FLIPPED 2026-09-16, ON THE CONDITION THIS
 *   PARAGRAPH SET ITSELF.** `render` passes `scale: (origin.size ?? 1) *
 *   view.scale` to `paintExtractedFigure`, and the radii arrive in device
 *   pixels.
 *
 *   ► **THAT PRODUCT IS ONLY HALF THE FACTOR, AND A FIRST VERSION OF THIS LINE
 *     SAID IT WAS THE WHOLE ONE.** `src/render/extracted-figure.js` multiplies
 *     it by its own `clipToArenaScale` — arena units per clip pixel, the
 *     build's 1:1 since 2026-09-23 (~~`(UNIT * height) / pack.clipHeight`~~,
 *     the authored figure's height fitted to the clip) — and hands the PRODUCT to
 *     `canvasFilterFor`. This file supplies canvas-per-arena; the other
 *     supplies arena-per-clip; neither half is the factor. A reader who checked
 *     the old sentence literally against `figureOriginMatrix` would have found
 *     it not to hold.
 *
 *   ► **AND IT HOLDS ONLY BECAUSE EVERY GROUP IN THIS PACK IS AT TOP-LEVEL
 *     DEPTH.** The psyche group's `path` is `[43]`. `extracted-figure.js`
 *     states that a `path.length > 1` group would be scaled by the wrong factor
 *     and counts it as `invoice.groupsBelowTopLevel` — **and nothing in this
 *     file prints that counter**, so a future extraction with a nested group
 *     would draw its glow at the wrong radius with every visible counter
 *     reading zero. That is the next hole on this route, and it is narrower
 *     than the one just closed.
 *
 *   ► **It said `false` until a figure group could be OBSERVED**, and its own
 *     instruction was: *"Flip it in the commit that makes a figure group
 *     observable, beside a test that reads two `figureEffectGroupsFor` results
 *     at two scales and asserts the radius moved."* The charged stance is that
 *     commit. A gladiator holding a psych-up charge rests in `psyche_charging`,
 *     which carries the cyan glow, so `figureEffectGroupsFor` returns a record
 *     with a real filter string on an ordinary idle frame — the first figure
 *     group in this repository that anything draws. Measured there: the radius
 *     is 4.2742px at `scale` 1, 8.5483px at 2 and 17.0967px at 4, exactly
 *     linear, and that test is in `test/render-stance.test.js`.
 *
 *   ► **The old reason for `false` was sound and is spent**, and it is worth
 *     keeping the shape of it: the claim was about ANOTHER module, nothing
 *     could watch it be used, and `true` would have been an assertion no test
 *     could go red on. What changed is not the claim but the observability.
 *
 * ► **AND THE COST OF BEING WRONG EITHER WAY IS ONE COUNTER.**
 *   `paintGroupRuns` reads the flag in exactly one place —
 *   `groupPaint.filterAtStageScale += run.to - run.from` — and nowhere else.
 *   The buffer, the region, the bleed and the composite are identical whichever
 *   way it is set; `test/render-arena-shell.test.js` asserts that, because the
 *   argument depended on it and still does. So this flip moves an honesty
 *   counter from over-reporting an approximation to reporting none, and it
 *   moves no pixel.
 *
 *   ► **"NO PIXEL" IS EXACT FOR THE CANVAS AND NOT FOR THE PAGE.**
 *     `filterAtStageScale` feeds `lost` and the `groups: approximated —
 *     ... unscaled N ...` line below, including its `warn` severity. On a frame
 *     with one charged gladiator that line goes from `unscaled 3` with a
 *     warning to `unscaled 0` without one. Cosmetic, in the surface panel, and
 *     the whole point of an honesty counter — but it is a visible change and
 *     the old wording denied one.
 *
 *   ► **AND AT DEFAULT SETTINGS THE FILTER STRING IS NOT WHAT DRAWS.**
 *     `GLOW_AMPLIFY` defaults on, the psyche group carries an `amplify` ladder,
 *     and `amplifyGlows` draws instead of `context.filter`. The counter still
 *     fires, because it tests `run.group.filter` rather than which path drew —
 *     which is correct for an approximation counter and worth knowing before
 *     someone reads `unscaled` as "this many filter strings were applied".
 *
 * A function rather than a bare `const` so that the test can LIFT it and assert
 * the values, instead of matching the source text and going green on a comment.
 */
function figureRouteFor() {
  return { translationDivisor: 1, filtersScaled: true };
}

/**
 * ONE extracted-rig operation, into whatever `context` currently is.
 *
 * Split out of `drawOps` so that `paintGroupRuns` can call it a run at a time —
 * into the canvas for an ungrouped run and into an offscreen for a filtered or
 * blended one. The body is the old `kind === "path"` branch with the origin
 * transform lifted off it; nothing else moved.
 */
function drawFigureOperation(operation) {
  context.globalAlpha = operation.alpha ?? 1;
  // ► **THE EXTRACTED RIG, and it is the only operation that carries its own
  //   MATRIX.** `src/render/extracted-figure.js` has already composed the
  //   limb's placement with the clip-to-arena transform; `figureOriginMatrix`
  //   is on the context above, so all that is left here is the placement.
  //
  //   `transform` rather than `setTransform`, so this composes with the
  //   figure's space instead of replacing it — and so that it still composes
  //   correctly when the destination is a group buffer whose transform is the
  //   canvas's shifted by the buffer's origin.
  const m = operation.matrix;
  context.save();
  context.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  const path = path2dFor(operation.d);
  if (operation.fill && operation.fill !== "none") {
    context.globalAlpha = (operation.alpha ?? 1) * (operation.fillOpacity ?? 1);
    context.fillStyle = operation.fill;
    context.fill(path, operation.fillRule ?? "evenodd");
  }
  if (operation.stroke && operation.strokeWidth > 0) {
    context.globalAlpha = (operation.alpha ?? 1) * (operation.strokeOpacity ?? 1);
    context.strokeStyle = operation.stroke;
    // In the CURRENT transform's units, which the scale above then applies.
    context.lineWidth = operation.strokeWidth;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.stroke(path);
  }
  context.restore();
}

/**
 * ONE authored-fallback operation. Unchanged from the branch it was cut out of:
 * it computes canvas pixels itself, so it runs with NO figure transform on the
 * context.
 */
function drawAuthoredOperation(operation, view, origin) {
  const size = origin.size ?? 1;
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

/**
 * ► **THE FIGURE'S OPERATIONS GO THROUGH THE GROUP COMPOSITOR, AND UNTIL
 *   2026-09-15 THEY DID NOT.** This was a flat `for (const operation of ops)`
 *   loop. `paintArenaLayer` and `paintProp` both route through
 *   `paintGroupRuns`; the figure — the one drawable in this file whose pack
 *   carries the build's twelve weapon-enchantment glows — was the third painter
 *   and was not wired to it at all, so an `op.group` arriving from
 *   `src/render/extracted-figure.js` would have been drawn per leaf and the
 *   glow would never have appeared. `groupRunsOf` and `paintGroupRuns`
 *   themselves needed NO change; the routing did.
 */
function drawOps(ops, view, origin) {
  for (const run of opSpaceRunsOf(ops)) {
    if (run.space === "canvas") {
      for (let index = run.from; index < run.to; index += 1) drawAuthoredOperation(ops[index], view, origin);
      continue;
    }
    // The whole array, whenever it IS the whole array — which is every call in
    // this build. A `slice` per figure per frame is 360 allocations a second
    // for a copy of a list nothing is going to modify.
    const slice = run.from === 0 && run.to === ops.length ? ops : ops.slice(run.from, run.to);
    const m = figureOriginMatrix(view, origin);
    context.save();
    context.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    try {
      countFigureGroups(paintGroupRuns(slice, figureRouteFor(), drawFigureOperation));
    } finally {
      // ► **A `finally`, for the reason `paintGroupRuns` has one.** A throw
      //   inside a painter must not leave the figure's transform on the context
      //   for the name plate, the arrows and the UI bar that are drawn next.
      context.restore();
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
  const front = view.toY(ARENA_FRONT_Y, 0);
  context.strokeStyle = "rgba(0,0,0,0.14)";
  context.lineWidth = Math.max(1, view.scale * 2);
  context.beginPath();
  context.ellipse(width / 2, front, width * 0.46, Math.max(6, view.scale * 26), 0, 0, Math.PI * 2);
  context.stroke();
}

/**
 * THE BUILD'S OWN ARENA SCREEN — the backdrop, the sky, the sand, the crowd,
 * the rain, the UI bar and the ornamental border, at the stage coordinates root
 * frame 221 places them at.
 *
 * ► **DRAWN IN STAGE SPACE, WITH NO Y-FLIP, and that is the difference from
 *   every other painter in this file.** `drawOps` and `paintProp` both do
 *   `context.scale(k, -k)` because a FIGURE's local space has its origin at the
 *   soles of the feet and its head at negative y, so drawing it needs arena y
 *   (which is up) rather than screen y (which is down). Scenery has no such
 *   local space: it is placed straight onto the stage in the build's own
 *   coordinates, which are already screen coordinates. Flipping it would draw
 *   the sky under the sand.
 *
 * ► **AND THE PLACEMENT TRANSLATIONS ARE IN TWIPS.** Every extracted matrix in
 *   this repository carries `tx`/`ty` in twips while its path data is in pixels
 *   — stated in `extracted-figure.js` and handled there, and latent everywhere
 *   else because every prop drawn until now had an IDENTITY matrix and a zero
 *   translation. The arena's layers are the first with real offsets, so the
 *   `/ TWIPS_PER_PIXEL` below is the first place it bites.
 */
const TWIPS_PER_PIXEL = 20;

/**
 * THE BUILD'S OWN RASTER ART, loaded once and composited once.
 *
 * ► **THE ARENA'S WALLS AND CROWDS ARE JPEGs AND THIS PAGE DREW NONE OF THEM.**
 *   A bitmap-filled shape arrived as `fill: "none"` and painted nothing, so
 *   every arena was bare solid colour with the entire stand missing — and the
 *   extractor reported zero failures, because an approximation nobody counts
 *   looks exactly like a correct read. The owner asked the right question:
 *   *"where are the backgrounds that are actually in game? Did you make
 *   these?"*
 *
 * ► **A JPEG WITH AN ALPHA CHANNEL IS TWO FILES AND ONE CANVAS.** SWF stores
 *   the colour as JPEG and the alpha as a separate zlib'd plane;
 *   `tools/extract-bitmaps.mjs` writes them as `<id>.jpg` and `<id>-alpha.png`
 *   because compositing them in node would need a JPEG decoder it does not
 *   ship. They are composited HERE, once, with `destination-in` — which is the
 *   one place a canvas is actually the right tool.
 *
 * ► **THE PACK IS THE IMAGES, NOT THE MANIFEST (2026-09-24).** The manifest
 *   used to be the whole wait: each image then arrived on its own and entered
 *   this cache as it loaded, so even behind a gate on the manifest the walls
 *   and the crowd would have popped in over a bare vector stand — the same
 *   flash, one layer down. `loadBitmaps` now settles only when every image has
 *   loaded or failed, and the finished set is copied in by `useBitmaps` when
 *   the asset gate opens, or never, if it is late.
 */
const bitmapCache = new Map();

/** One image, or null if it will not load: a missing file is a fallback, never a hang. */
function imageFrom(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => resolve(null), { once: true });
    image.src = src;
  });
}

async function loadBitmaps(manifest) {
  const bitmaps = new Map();
  let unloadable = 0;
  await Promise.all(Object.entries(manifest?.bitmaps ?? {}).map(async ([id, entry]) => {
    // Both halves have to have arrived before the two can be combined.
    const [colour, alpha] = await Promise.all([
      imageFrom(`/assets/bitmaps/${entry.file}`),
      entry.alpha ? imageFrom(`/assets/bitmaps/${entry.alpha}`) : null
    ]);
    if (!colour?.naturalWidth || (entry.alpha && !alpha?.naturalWidth)) {
      unloadable += 1;
      return;
    }
    if (!entry.alpha) {
      bitmaps.set(Number(id), colour);
      return;
    }
    const off = document.createElement("canvas");
    off.width = entry.width;
    off.height = entry.height;
    const ctx = off.getContext("2d");
    ctx.drawImage(colour, 0, 0, entry.width, entry.height);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(alpha, 0, 0, entry.width, entry.height);
    bitmaps.set(Number(id), off);
  }));
  return { manifest, bitmaps, unloadable };
}

/**
 * THE FACE, and it is why a gladiator stops being a blank oval.
 *
 * ► **`heldFace` IS NOT A CACHE — IT IS FLASH'S OWN BEHAVIOUR.** The build
 *   issues 228 expression calls across 83 animations, and the other 18 bind
 *   nothing while 10 more set eyes and never a mouth. A `gotoAndPlay` on a
 *   label a clip does not have is a NO-OP in Flash: the playhead stays where it
 *   was. So an expression PERSISTS until something changes it, and without this
 *   map the mouth would snap back to `normal` every time an animation that
 *   never mentions it began.
 */
let facePack = null;
const heldFace = new Map();
/**
 * The pop-ups' art — `damage_icon`, `bonus_icon`, `defend_icon` and their
 * splats — from the SAME `icons.json` the face comes from. Null until it
 * loads, and then the pop-ups draw their authored fallback: the plain number
 * (or BLOCK) at the same place and for the same frames.
 */
let popupPack = null;

assetGate.track("icons", fetch("/assets/icons/icons.json")
  .then((response) => (response.ok ? response.json() : null)));

/** No icons extracted (null) leaves the gladiator his blank head and the pop-ups their plain number. */
function useIconPack(data) {
  facePack = facePackFrom(data);
  if (facePack) log("face: eyes and mouth from your own install.");
  popupPack = popupPackFrom(data);
  if (popupPack) log("pop-ups: the damage, spell and BLOCK art from your own install.");
}

assetGate.track("bitmaps", fetch("/assets/bitmaps/manifest.json")
  .then((response) => (response.ok ? response.json() : null))
  .then((manifest) => (manifest ? loadBitmaps(manifest) : null)));

/** No bitmaps extracted (null): the vector layer still draws. */
function useBitmaps(loaded) {
  if (!loaded) return;
  for (const [id, image] of loaded.bitmaps) bitmapCache.set(id, image);
  const failures = loaded.manifest.failures?.length ?? 0;
  log(`bitmaps: ${Object.keys(loaded.manifest.bitmaps ?? {}).length} from your own install`
    + (failures ? `, ${failures} undecodable` : "")
    + (loaded.unloadable ? `, ${loaded.unloadable} would not load` : ""),
  { warn: failures > 0 || loaded.unloadable > 0 });
}

/**
 * A canvas gradient built in the SWF's own canonical gradient space.
 *
 * ► **BUILT AS A TRANSFORM, NOT AS TWO MAPPED ENDPOINTS, AND THE BUILD FORCES
 *   THAT.** A SWF gradient is defined over a fixed square running -16384..16384
 *   in its OWN space, and the fill matrix maps that square into the shape. It
 *   is tempting to map the two endpoints into shape space and call
 *   `createLinearGradient` on them — and that is wrong for any matrix with
 *   skew, because the ramp would stay perpendicular to its own axis when the
 *   build's does not. Measured on the oracle: **four linear gradients are
 *   genuinely skewed** (chars 808, 813 and 1516 twice, at 54-76 degrees), and
 *   **two radials are strongly anisotropic** — char 1227 at 26:1 and char 1230
 *   at 1:22 — which `createRadialGradient` cannot express at all with one
 *   radius. Applying the matrix handles all six uniformly and needs no cases.
 *
 * ► **±16384 IS NOT TWIPS.** It is the gradient's own space; the matrix is what
 *   turns it into shape twips, and the path is in shape PIXELS — so the matrix
 *   is divided by 20 exactly as a bitmap fill's is. Reading the square as twips
 *   puts a factor of twenty in the wrong place and was a premise the asset
 *   census had to break.
 *
 * ► **`offset` IS `ratio / 255`, never "evenly spaced"** — only 75 of the
 *   build's 97 gradients span the full range; the rest start as late as 175 or
 *   end as early as 131 and rely on PAD, which is canvas's default too.
 *   Measured: every one of the 97 is spread PAD and interpolation normal-RGB,
 *   so nothing here emulates either.
 */
const GRADIENT_SQUARE = 16384;

function paintGradientFill(operation, path) {
  const g = operation.gradient;
  if (!g || !Array.isArray(g.stops) || g.stops.length === 0) return false;
  const m = g.matrix;
  context.save();
  context.transform(
    m.a / TWIPS_PER_PIXEL, m.b / TWIPS_PER_PIXEL,
    m.c / TWIPS_PER_PIXEL, m.d / TWIPS_PER_PIXEL,
    m.tx / TWIPS_PER_PIXEL, m.ty / TWIPS_PER_PIXEL
  );
  const ramp = g.type === "radial"
    ? context.createRadialGradient(0, 0, 0, 0, 0, GRADIENT_SQUARE)
    : context.createLinearGradient(-GRADIENT_SQUARE, 0, GRADIENT_SQUARE, 0);
  for (const stop of g.stops) {
    // `addColorStop` refuses a non-finite offset and throws, which would take
    // the whole frame down — a clamp is cheaper than a try/catch per stop.
    const offset = Math.min(1, Math.max(0, Number.isFinite(stop.offset) ? stop.offset : 0));
    ramp.addColorStop(offset, rgbaOf(stop.fill, stop.opacity ?? 1));
  }
  context.fillStyle = ramp;
  // The path was built in SHAPE space and we are in GRADIENT space, so it
  // cannot simply be filled here — it is the clip, and the ramp covers it.
  context.restore();
  context.save();
  context.clip(path, operation.fillRule ?? "evenodd");
  context.transform(
    m.a / TWIPS_PER_PIXEL, m.b / TWIPS_PER_PIXEL,
    m.c / TWIPS_PER_PIXEL, m.d / TWIPS_PER_PIXEL,
    m.tx / TWIPS_PER_PIXEL, m.ty / TWIPS_PER_PIXEL
  );
  context.fillStyle = ramp;
  context.fillRect(-GRADIENT_SQUARE, -GRADIENT_SQUARE, GRADIENT_SQUARE * 2, GRADIENT_SQUARE * 2);
  context.restore();
  return true;
}

/** `#rrggbb` plus an opacity, as the `rgba()` canvas wants for a gradient stop. */
function rgbaOf(fill, opacity) {
  if (typeof fill !== "string" || fill[0] !== "#" || fill.length !== 7) return `rgba(0,0,0,${opacity})`;
  const value = Number.parseInt(fill.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${opacity})`;
}

/**
 * Paint one path's BITMAP fill, clipped to the path.
 *
 * ► **THE MATRIX MAPS BITMAP PIXELS TO SHAPE TWIPS, AND THE PATH IS IN SHAPE
 *   PIXELS.** So every term is divided by 20 — which is why `a` is almost
 *   always exactly 20 in the build and comes out as 1. Getting this wrong by
 *   the factor of twenty draws one corner of the wall across the whole arena,
 *   which reads as a texture bug rather than a units bug.
 */
function paintBitmapFill(operation, path) {
  const image = bitmapCache.get(operation.bitmap.id);
  if (!image || (image.naturalWidth === 0 && image.width === 0)) return false;
  const m = operation.bitmap.matrix;
  context.save();
  context.clip(path, operation.fillRule ?? "evenodd");
  context.transform(
    m.a / TWIPS_PER_PIXEL, m.b / TWIPS_PER_PIXEL,
    m.c / TWIPS_PER_PIXEL, m.d / TWIPS_PER_PIXEL,
    m.tx / TWIPS_PER_PIXEL, m.ty / TWIPS_PER_PIXEL
  );
  if (operation.bitmap.repeat) {
    const pattern = context.createPattern(image, "repeat");
    if (pattern) {
      context.fillStyle = pattern;
      // In the bitmap's own space now, so the region to cover is the path's
      // bounds transformed back — a generous rectangle is cheaper than exact
      // and the clip above is what actually bounds it.
      context.fillRect(-4000, -4000, 8000, 8000);
    }
  } else {
    context.drawImage(image, 0, 0);
  }
  context.restore();
  return true;
}

/* ------------------------------------------------------------------ */
/* The colour transform was composed HERE, and is not any more         */
/* ------------------------------------------------------------------ */

/**
 * ► **THIS FILE APPLIED THE PLACEMENT'S COLOUR TRANSFORM UNTIL 2026-09-14 AND
 *   THE WHOLE APPARATUS IS GONE.** `tintedPropOpsFor` wrapped `propOpsFor` and
 *   re-tinted what came back; `probeColourTransform` ran one placement through
 *   the real function at load to decide whether it still had to;
 *   `firstTintedPlacement` and `onePlacementPack` fed that probe;
 *   `colourTransformMode` held what the probe decided — the name this list
 *   forgot until 2026-09-14, when a track checking the six names
 *   `test/render-arena-shell.test.js` greps for found that five of them were
 *   recorded here and the sixth was recorded nowhere, so the one identifier a
 *   reader could not account for was the one the guard could not justify; and
 *   `colourTransformTally` counted what the wrapper did. `propOpsFor` in
 *   `src/render/props.js` now folds the transform onto every fill, stroke,
 *   opacity and gradient stop itself, so this shell injects that function
 *   UNWRAPPED at the seam `arena-backdrop.js` already provides, and composes
 *   nothing.
 *
 * ► **TWO APPLICATIONS SQUARE THE MULTIPLIER, WHICH IS WHY THE PROBE EXISTED
 *   AND WHY DELETION BEATS LEAVING IT PROBING.** Measured in node against this
 *   repository's own `assets/props/props.json`: the UI bar's plate is shape 487
 *   — a white rectangle — under `rgb x0, alpha x0.5`, and it comes out
 *   `#000000` at 0.5 applied once and `#000000` at **0.25** applied twice. A
 *   half-transparent bar is a design decision; a quarter-transparent one is a
 *   bug wearing a design decision's clothes. **And the bar's own FILL cannot
 *   see the difference** — 0 x 0 is 0, so the hex is `#000000` either way and
 *   only the alpha moves. At the shipped dressing exactly **2 of the arena
 *   screen's 17 operations** change under a second application: this plate's
 *   alpha and one `sky` fill. A test that pinned the plate's colour would have
 *   watched the squaring happen.
 *
 * ► **AND THE TALLY WAS WRITE-ONLY, WHICH IS THIS PROJECT'S SIGNATURE DEFECT
 *   COMMITTED IN THIS FILE.** `colourTransformTally` had four increment sites
 *   and **no reader anywhere in the tree** — nothing logged it, no panel showed
 *   it, no test asked for it. So nothing is lost by deleting it; what is worth
 *   recording is that `unpairable`, the count of operations this shell could
 *   not match back to a placement, would have fired into silence if the pairing
 *   had ever slipped. The replacement is `propInvoiceFor`, printed by
 *   `reportArenaEffects`, and it comes from the same walk that emits the
 *   operations instead of from a second one that can disagree with it.
 *
 * ► **WHAT STILL READS A TRANSFORM HERE, AND WHY THAT IS NOT APPLYING ONE.**
 *   `colourTransformFrom` survives in `soundButtonPlate`, which finds the bar's
 *   invisible hit plate by its `alphaMultiplier` of 0, and in
 *   `reportArenaEffects`, which counts tinted placements. Both ASK what a
 *   placement carries; neither changes a pixel. `applyColourTransform`,
 *   `applyColourTransformAlpha` and `colourTransformApplies` are no longer
 *   imported into this file at all, and `test/render-arena-shell.test.js` reads
 *   this file as text to keep it that way — node cannot import a browser module
 *   with absolute URL specifiers, so the source IS the only surface a test has.
 */

/**
 * WHETHER THIS PACK HOLDS THE ARENA SCREEN, ASKED ONCE PER PACK.
 *
 * `hasArenaScreen` builds every layer's operations to answer it, and
 * `viewport()` was asking it on EVERY FRAME while `render()` built the same
 * layers again immediately afterwards — so the arena's whole backdrop was
 * composed twice a frame before anything was drawn. The answer depends only on
 * the pack (no camera, default dressing), so it is memoised on the pack's own
 * identity and a pack that arrives later still gets asked.
 */
let arenaScreenAnswer = null;
function arenaScreenAvailable() {
  if (!arenaScreenAnswer || arenaScreenAnswer.pack !== propPack) {
    arenaScreenAnswer = { pack: propPack, yes: hasArenaScreen(propPack, propOpsFor) };
  }
  return arenaScreenAnswer.yes;
}

/* ------------------------------------------------------------------ */
/* The UI bar's words                                                  */
/* ------------------------------------------------------------------ */

/**
 * WHAT THE BAR SAYS, AND WHICH HALF OF IT IS REAL.
 *
 * `uiBarReadoutsFor` deliberately refuses to invent a value: it returns the two
 * readouts sprite 1531 places with `text: null` until a caller supplies one,
 * and counts what is still owed. This surface supplies ONE of the two and says
 * so, rather than filling both and reporting a bar with nothing outstanding.
 *
 * - **`soundvar` (1527) gets a LIVE value.** This arena has a sound system and
 *   now has a toggle, so `soundOn()` is a real fact about what the player is
 *   hearing — not a picture of one. The build drives its own from
 *   `_root.pSound` through `_root.toggleSound`, which this engine does not
 *   have and is not pretending to.
 * - **`tooltips_text` (1528) gets the PACK'S BAKED STRING**, via `text:
 *   undefined`, which `fieldOpsFor` falls back to the field's own tag for.
 *   That is the build's opening frame and it is the pack's business. **It stays
 *   in the unresolved count**: this engine has no tooltip system, so the words
 *   are the shipped label and not a readout of anything.
 *
 * ► **THE STRINGS ARE THE BUILD'S OWN RUNTIME SPELLING AND I RE-DERIVED THEM
 *   FROM THE ORACLE RATHER THAN COPYING THE CLAIM.** Read out of
 *   `swords_sandals2_download.swf`, sha256 77cb545c…45bb8ca — the same hash
 *   `assets/props/manifest.json` cites:
 *
 * ```text
 *   sprite:1531/frame:1/DoAction@0x3d3686 +0x017d   soundvar.text = "sound:off"
 *   sprite:1531/frame:1/DoAction@0x3d3686 +0x01ad   soundvar.text = "sound:on"
 * ```
 *
 *   Both disagree in CASE with the string baked into character 1527, which is
 *   `"sound:ON\r"` — so the baked value is provably not what a running game
 *   shows, and that is the whole reason this readout is supplied rather than
 *   defaulted. `tooltips_text` is written `"Tooltips:on"` / `"Tooltips:off"` at
 *   `sprite:1531/frame:1/instance:9/clip-action:0 +0x00c5 / +0x00ea` against a
 *   baked `"tooltips:off"`, and is NOT used here for the reason above.
 */
let textPack = null;

/** Whether this arena will actually make a noise if something asks it to. */
function soundOn() {
  return soundEnabled && !audioBlocked;
}

/** `{value, ops, tally}` for the bar's current reading, rebuilt only on change. */
let barText = null;

/**
 * ► **`fieldOpsFor` ALLOCATES A GLYPH OUTLINE PER CHARACTER AND `text.js` SAYS
 *   OUTRIGHT THAT A CALLER REDRAWING THE SAME STRING EVERY FRAME SHOULD HOLD
 *   ONTO THE ARRAY.** The bar changes when the player toggles the sound and at
 *   no other time, so it is built on the transition and kept.
 */
function uiBarOps() {
  if (!textPack) return null;
  const value = soundOn() ? "sound:on" : "sound:off";
  if (barText && barText.pack === textPack && barText.value === value) return barText.ops;

  const bar = uiBarReadoutsFor(textPack, fieldsPlacedIn, { sound: value });
  const ops = [];
  const baked = [];
  for (const readout of bar.readouts) {
    // `text: undefined` is what makes `fieldOpsFor` fall back to the field's
    // own baked string.
    //
    // ► ~~`null` would be drawn as the four characters "null".~~ **It would
    //   not, and I wrote that here before checking.** `fieldLayoutOptionsFor`
    //   tests `text === undefined || text === null` and falls back on both, so
    //   `?? undefined` is belt-and-braces rather than the thing that makes this
    //   work. Measured: `fieldOpsFor(pack, 1528, {text: null})` draws
    //   "tooltips:off", the same as `{text: undefined}` and the same as passing
    //   no key at all. The `??` stays because the CONTRACT `text.js` documents
    //   is `text: undefined`, and a reader should not have to know that null
    //   happens to be handled too.
    const drawn = fieldOpsFor(textPack, readout.field, {
      matrix: readout.matrix,
      text: readout.text ?? undefined
    });
    if (readout.text === null) baked.push(readout.instance);
    if (drawn) ops.push(...drawn);
  }
  const sound = bar.readouts.find((readout) => readout.valueOf === "sound") ?? null;
  barText = {
    pack: textPack,
    value,
    ops: Object.freeze(ops),
    tally: bar.tally,
    baked,
    // The bar-local x the pack places the sound readout at. `soundButtonPlate`
    // uses it to tell the two alpha-zero button plates apart by POSITION, so
    // neither this file nor that one has to know which one comes first.
    soundX: sound ? sound.x : 0
  };
  return barText.ops;
}

/** The invoice for the bar, printed where a screenshot catches it. */
function reportUiBar() {
  const ops = uiBarOps();
  if (!barText) return;
  const { tally, baked } = barText;
  log(`ui bar: ${tally.placed}/${tally.declared} placed, ${tally.valued} live, ` +
    `${ops.length} glyph ops, unresolved ${tally.unresolved}.`, { warn: tally.unresolved > 0 });
  if (baked.length > 0) log(`ui bar: ${baked.join(", ")} = the pack's baked string.`, { warn: true });
  if (tally.unplacedInBuild > 0) log(`ui bar: ${tally.unplacedInBuild} readout(s) the build never places.`);
}

/**
 * WHERE THE BAR'S SOUND BUTTON IS ON THE CANVAS, in canvas pixels, or null.
 *
 * Set while the bar is painted rather than computed from constants: the layer's
 * placement and the fit are both already in hand there, and a hit box derived
 * from anything else is a second copy of the layout that can drift from the one
 * the player is looking at.
 */
let soundButtonBox = null;

/**
 * The build's own invisible hit plate for the sound toggle, in the bar's local
 * pixels — **found by its `alphaMultiplier` of 0 and its x, never by index.**
 * Two of the bar's four rectangles are alpha-zero button plates; the sound one
 * is whichever sits nearest the `soundvar` readout the pack places.
 */
function soundButtonPlate(pack, readoutX) {
  const placements = pack?.props?.panel?.frames?.[0] ?? [];
  let best = null;
  for (const placement of placements) {
    const transform = colourTransformFrom(placement?.colour ?? null);
    if (!transform || transform[3] !== 0) continue;
    const shape = pack?.shapes?.[placement.shape];
    if (!shape?.bounds || !Array.isArray(placement.matrix)) continue;
    const [a, , , d, tx, ty] = placement.matrix;
    const x = tx / TWIPS_PER_PIXEL;
    const y = ty / TWIPS_PER_PIXEL;
    const box = {
      x0: x + shape.bounds.xMin * a, x1: x + shape.bounds.xMax * a,
      y0: y + shape.bounds.yMin * d, y1: y + shape.bounds.yMax * d
    };
    const distance = Math.abs(box.x0 - readoutX);
    if (!best || distance < best.distance) best = { box, distance };
  }
  return best ? best.box : null;
}

/**
 * ► **THE BAR IS A CONTROL NOW, AND THAT IS THE POINT OF GIVING THE READOUT A
 *   LIVE VALUE.** A readout with no way to change is decoration; the build's
 *   bar has two buttons and this engine now honours one of them. The other
 *   stays inert because there is no tooltip system to toggle, which is the same
 *   answer the unresolved count gives.
 */
canvas.addEventListener("click", (event) => {
  if (!soundButtonBox) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const x = (event.clientX - rect.left) * (canvas.width / rect.width);
  const y = (event.clientY - rect.top) * (canvas.height / rect.height);
  if (x < soundButtonBox.x0 || x > soundButtonBox.x1) return;
  if (y < soundButtonBox.y0 || y > soundButtonBox.y1) return;
  soundEnabled = !soundEnabled;
  // Off silences what is already sounding too, not only what fires next.
  soundPlayer.setEnabled(soundEnabled);
  log(`sound ${soundEnabled ? "on" : "off"} — the bar's own toggle.`);
});

/**
 * ► **THE MASTER VOLUME, A REAL DOM CONTROL (2026-09-23).** `sound.js` named a
 *   volume slider as this shell's job from the start and none existed. It
 *   drives the player's `GainNode` (each voice's `volume` on the element
 *   fallback) through `masterGainFor`'s curve, and the position is remembered
 *   per viewer — storage that throws or is empty just means the default.
 */
const VOLUME_KEY = "arena.volume";
const volumeSlider = el("volume");
const volumeReadout = el("volume-readout");

function applyVolume(position) {
  soundPlayer.setVolume(masterGainFor(position));
  if (volumeReadout) volumeReadout.textContent = `${Math.round(Number(position))}%`;
}

if (volumeSlider) {
  let saved = null;
  try { saved = window.localStorage.getItem(VOLUME_KEY); } catch { /* private window: the default */ }
  const initial = saved !== null && Number.isFinite(Number(saved)) ? Number(saved) : DEFAULT_VOLUME;
  volumeSlider.value = String(Math.min(100, Math.max(0, initial)));
  applyVolume(volumeSlider.value);
  volumeSlider.addEventListener("input", () => {
    applyVolume(volumeSlider.value);
    try { window.localStorage.setItem(VOLUME_KEY, volumeSlider.value); } catch { /* not remembered, still applied */ }
  });
}

/* ------------------------------------------------------------------ */
/* What the arena still cannot draw, counted                           */
/* ------------------------------------------------------------------ */

/**
 * ► ~~**NOTHING IN THIS REPOSITORY EXTRACTS A FILTER'S PARAMETERS, so no
 *   filter can be applied anywhere — not here, not on the 26 screens.**
 *   Re-derived this session rather than taken from the brief, which said the
 *   data reached this file:~~
 *
 * ```text
 *   assets/props/props.json    "filter" occurs 0 times, "blend" 0 times
 *   placement keys, ALL of them: clip, colour, matrix, shape
 *   tools/extract-props.mjs:453 copies drawable.colourTransform and nothing else
 *   assets/screens/screens.json carries `filteredPlacements: [{character, path}]`
 *   tools/extract-screens.mjs:944 writes `filters: true` — a BOOLEAN, not a list
 * ```
 *
 * ►  ~~`tools/swf-display-list.mjs` does decode a FILTERLIST into typed records
 *   (`parseFilterList`, and `flattenFrame`'s drawables carry `filters`), so the
 *   data exists one layer upstream and dies in the two extractors. Until one of
 *   them writes it out, `src/render/filters.js`'s `canvasFilterFor`,
 *   `blendModeFor`, `colourMatrixFilterString`, `blurSigma`, `applyColourMatrix`
 *   and `summariseFilterUse` have **no caller anywhere in `src/` or `tools/`
 *   except the probe below** — grep says so, and the probe is the exception
 *   this sentence had to grow the moment it was written.~~ **Grep no longer
 *   says so, and the sentence that had to grow one exception should have been
 *   read as a warning about its own shelf life.**
 *
 * ► **FALSE SINCE THE DAY IT WAS WRITTEN — BOTH EXTRACTORS NOW WRITE THE
 *   FILTER'S NUMBERS, and the same wave that made it false left it standing
 *   here.** Struck rather than deleted, because the interesting part is that a
 *   block explicitly labelled "re-derived, not taken from the brief" still went
 *   stale inside one session: re-derivation dates a claim, it does not pin it.
 *   Re-re-derived 2026-09-14 by this track, in node, on this tree:
 *
 * ```text
 *   tools/extract-props.mjs:113   imports blendModeFor, canvasFilterFor and
 *                                 summariseFilterUse FROM src/render/filters.js
 *                                 and calls them at :797 and :842
 *   tools/extract-screens.mjs:850 writes `filters: typed` — the list, not a
 *                                 boolean (and :1341 for a button's records)
 *   node tools/extract-props.mjs --out <scratch>
 *                                 363 effect groups over 3,209 placements,
 *                                 570 filters (150 colourMatrix, 208 blur,
 *                                 212 glow), 1 blend mode; a renderer applies
 *                                 306, defers 148, calls 116 no-ops, refuses 0
 * ```
 *
 * ► ~~**WHAT IS STILL TRUE IS THE HALF ABOUT THE INSTALLED PACKS, AND ONLY
 *   UNTIL THEY ARE REGENERATED.** `assets/` is deliberately stale on this
 *   route — measured here: `assets/screens/screens.json` holds 243
 *   `filteredPlacements` and **0** of them carry a typed list, and
 *   `assets/props/props.json` carries no `effectGroups` at all.~~
 *   **THE PACKS WERE REGENERATED ON 2026-09-15 AND BOTH HALVES OF THAT ARE NOW
 *   FALSE.** Re-measured on the installed packs the same day: `screens.json`'s
 *   243 `filteredPlacements` carry a typed list on **242** of them, and
 *   `props.json` carries **363** `effectGroups`. The stale-pack WARNING below
 *   stays, because it is what tells the two apart on somebody else's machine;
 *   the sentence claiming this machine's packs are the stale ones does not.
 *
 * ► ~~**AND THE SENTENCE THAT SURVIVES ALL OF IT: THIS SHELL STILL APPLIES NO
 *   FILTER TO A PIXEL.** `context.filter` is set nowhere in this file except
 *   the probe below.~~ **IT DOES NOW, SINCE 2026-09-15** — see
 *   `paintGroupRuns`, which composites each filtered or blended group through
 *   an offscreen. What survives of that paragraph is the CAVEAT, and it is
 *   worth more than the claim was: **the group's own matrix is not carried**
 *   (`notCarried.effectGroupMatrix`, 363 of them, one per group), so a radius
 *   is scaled by the stage and the layer and by nothing the group sprite
 *   itself does. That is an approximation this file cannot close from this
 *   pack, so it is printed below rather than hidden behind a picture that
 *   looks finished.
 *
 * This prints the absence with the pack's own numbers, because an absence
 * nobody counts is this project's signature defect.
 */
function reportArenaEffects(pack) {
  let placements = 0;
  let tinted = 0;
  let withFilters = 0;
  let withBlend = 0;
  let underAGroup = 0;
  for (const prop of Object.values(pack?.props ?? {})) {
    for (const frame of prop?.frames ?? []) {
      for (const placement of frame ?? []) {
        placements += 1;
        if (colourTransformFrom(placement?.colour ?? null)) tinted += 1;
        if (placement?.filters) withFilters += 1;
        if (Number.isFinite(placement?.blendMode) && placement.blendMode > 1) withBlend += 1;
        if (Array.isArray(placement?.inheritedEffects) && placement.inheritedEffects.length > 0) underAGroup += 1;
      }
    }
  }
  // ► **THE TWO OWN-EFFECT COUNTS ARE `0 of 3,345` AND THE REASON IS NOT
  //   "THE BUILD HAS NONE".** Re-measured 2026-09-14 by regenerating the pack
  //   into scratch: this build has exactly TWO own-filtered placements (two
  //   glows on characters 1527/1528, `panel`'s edit-text fields) and
  //   `extract-props.mjs` skips both drawables, invoicing them as
  //   `droppedOwnFilteredPlacements: 2` rather than writing them out. Its one
  //   own blend mode is on a GROUP, not a placement. So no input this
  //   extractor can produce from the shipped SWF makes either line above
  //   non-zero — the code path is live (`ownEffectsOf` does write `filters`
  //   and `blendMode` onto a placement) and a modded build in a second install
  //   lane is where it fires first. The group counter below is the one that
  //   moves on this build, and printing them side by side is the only way a
  //   reader can tell "the pack has no effects" from "the effects are not on
  //   the placements".
  let groups = 0;
  let groupFilters = 0;
  let groupBlend = 0;
  for (const prop of Object.values(pack?.props ?? {})) {
    for (const group of prop?.effectGroups ?? []) {
      groups += 1;
      groupFilters += Array.isArray(group?.filters) ? group.filters.length : 0;
      if (Number.isFinite(group?.blendMode) && group.blendMode > 1) groupBlend += 1;
    }
  }
  log(`props: ${placements} placements, ${tinted} tinted, ` +
    `${withFilters} filtered, ${withBlend} blended.`);
  // Two short lines rather than one long one, for the reason the lines above
  // are short: the aside is 330px wide and a wrapping log grows the column.
  log(`props: ${groups} effect group(s) over ${underAGroup} placement(s).`);
  log(`props: group effects — ${groupFilters} filter(s), ${groupBlend} blend.`);

  // ► **THE INVOICE IS UPSTREAM NOW, AND THIS PRINTS THAT ONE RATHER THAN
  //   KEEPING A SECOND.** Until 2026-09-14 this block counted the tinted
  //   operations the shell could NOT reach: `arenaScreenLayersFor` takes the
  //   props reader as an argument, but `arrowOpsFor`, `arrowTrailOpsFor` and
  //   `arenaSceneryFor` call `propOpsFor` INSIDE `props.js`, so a transform
  //   composed out here could never touch them. The count was **28** — every
  //   operation of `bullet_trail`'s seven-frame fade, the puffs that drew
  //   solid. **It is zero now BECAUSE the transform moved into `propOpsFor`,
  //   not because the counter broke**, which is exactly the reading a bare
  //   vanishing number invites, so the line below says which invoice it is.
  //
  // ► **AND THE ROLL-UP IS BUILT HERE BECAUSE `propInvoiceFor` IS PER FRAME BY
  //   DESIGN** — which frame is being drawn is the caller's business in that
  //   module, and it declined to make itself the exception. Twelve linkages
  //   across their frames, once at load: measured at ~10ms against this
  //   repository's own pack, against a 16ms frame budget it never shares.
  //
  // ► **THE DENOMINATORS ARE PRINTED BESIDE THE TWO APPROXIMATION COUNTS ON
  //   PURPOSE, BECAUSE BOTH COUNTS ARE DEAD ON THIS BUILD'S PROPS.** Measured:
  //   41 bitmap operations, 0 of them under a transform of any kind, and 0 of
  //   the pack's 3,345 placements carrying a non-zero alpha offset. So the two
  //   zeros cannot move, and a zero with no denominator cannot say whether a
  //   counter is quiet or cannot fire. That distinction is six defects old in
  //   this repository.
  const invoice = {};
  for (const linkage of Object.keys(pack?.props ?? {})) {
    for (let frame = 1; frame <= propFrameCount(pack, linkage); frame += 1) {
      for (const [key, value] of Object.entries(propInvoiceFor(pack, { linkage, frame }))) {
        invoice[key] = (invoice[key] ?? 0) + value;
      }
    }
  }
  // ► **KEPT SHORT, for the reason the probe's own log lines were.** The aside
  //   is 330px wide at 11.5px monospace, so a long line wraps and a wrapping
  //   log grows the column; the long version of each of these is the comment
  //   above it. (Not re-measured in a browser this session — no agent in this
  //   wave may launch one — so these match the length of the lines already
  //   here rather than a fresh measurement of the wrap point.)
  log(`props: tint applied in props.js — ${invoice.tintedOps ?? 0}/${invoice.ops ?? 0} ops.`);
  const lost = (invoice.bitmapColourTransformDropped ?? 0) + (invoice.gradientAlphaOffsetApproximated ?? 0);
  log(`props: tint lost — bitmap ${invoice.bitmapColourTransformDropped ?? 0}/${invoice.bitmapOps ?? 0}, ` +
    `gradient ${invoice.gradientAlphaOffsetApproximated ?? 0}/${invoice.gradientOps ?? 0}.`,
    { warn: lost > 0 });
  // Three silent `continue`s in `propOpsFor` that used to draw nothing and say
  // nothing. Printed only when they fire, because on this pack they do not.
  const dropped = (invoice.shapesMissing ?? 0) + (invoice.shapesWithNoPaths ?? 0) + (invoice.clipsUnresolved ?? 0);
  if (dropped > 0) {
    log(`props: ${invoice.shapesMissing} shape(s) missing, ${invoice.shapesWithNoPaths} pathless, ` +
      `${invoice.clipsUnresolved} clip(s) unresolved.`, { warn: true });
  }
  // ► ~~`if (withFilters === 0) log("props: NO filter data in the pack — see
  //   extract-props.mjs.")`~~ **— WHICH BLAMED A TOOL THAT HAD ALREADY FIXED
  //   IT.** `withFilters` counts OWN filters on a placement and cannot be
  //   non-zero on this build (see above), so that line fired unconditionally
  //   and pointed the reader at `extract-props.mjs`, which since 2026-09-14
  //   writes 363 groups and 570 filters. A warning that cannot turn itself off
  //   is not a measurement, and one that names the wrong culprit costs the next
  //   reader the trip.
  //
  //   What is worth warning about is the STALE PACK: `assets/` here is
  //   regenerated by hand, so a pack written before the effect invoice carries
  //   none of this and looks exactly like a build with no effects. The
  //   condition below is now "no effect data of EITHER kind", which the
  //   installed pack trips and a freshly extracted one does not.
  if (groups === 0 && withFilters === 0) {
    log("props: no effect data — re-run extract-props.mjs.", { warn: true });
  }

  // ► **WHAT THE GROUPS ASK OF A PAINTER, FROM `canvasFilterFor`'S OWN
  //   VERDICTS RATHER THAN A SECOND OPINION.** `propInvoiceFor` sums them over
  //   the distinct groups each frame reaches, so these are per-pack roll-ups of
  //   the same buckets `tools/extract-props.mjs` writes into the manifest and
  //   the two can be checked against each other. On this build: 570 filter
  //   records over 363 groups, 0 refused — the 54 bevels canvas cannot express
  //   are all on screens, none on props.
  log(`props: group filters — ${invoice.groupFiltersApplied ?? 0} drawn, ` +
    `${invoice.groupFiltersDeferred ?? 0} folded as colour, ${invoice.groupFiltersNoOp ?? 0} no-op, ` +
    `${invoice.groupFiltersRefused ?? 0} refused, of ${invoice.groupFilters ?? 0}.`,
    { warn: (invoice.groupFiltersRefused ?? 0) > 0 });
  log(`props: ${invoice.groupFilterOps ?? 0}/${invoice.groupedOps ?? 0} op(s) await a buffer; ` +
    `${invoice.groupBlendModes ?? 0} blend mode(s), ${invoice.groupBlendModesRefused ?? 0} refused.`);

  // ► **THE GROUP'S OWN MATRIX IS NOT IN THE PACK, WHICH IS WHY EVERY RADIUS
  //   HERE IS AT THE STAGE SCALE AND NOT THE GROUP'S.** A blur is authored in
  //   the group sprite's own space, and `extract-props.mjs` records the matrix
  //   it did not carry as `effects.notCarried.effectGroupMatrix` — one per
  //   group, 363 of them on this build. So `paintGroupRuns` scales a radius by
  //   the stage and by the layer, and by nothing the group itself does. Printed
  //   because a renderer that is 4% or 200% wrong on every blur and says
  //   nothing is indistinguishable from one that is right.
  let groupMatrixGap = 0;
  for (const prop of Object.values(pack?.props ?? {})) {
    const missing = prop?.effects?.notCarried?.effectGroupMatrix;
    if (Number.isFinite(missing)) groupMatrixGap += missing;
  }
  if (groupMatrixGap > 0) {
    log(`props: ${groupMatrixGap}/${groups} group matrix(es) NOT in the pack — ` +
      "blur radii are at the stage scale only.", { warn: true });
  }

  // ► **THE ARENA UI BAR'S OWN GLOWS, WHICH NOTHING ON THIS ROUTE CAN DRAW.**
  //   Characters 1527 and 1528 are `DefineEditText` fields on `panel` and the
  //   extractor drops a drawable it cannot turn into paths, so their two glows
  //   are dropped with them and there is no shape in the pack for a glow to sit
  //   on. `propEffectsUnreachable` reports them per PACK because they are a
  //   property of the extraction and not of a frame. Saying so out loud beats
  //   drawing the bar as though the bar were complete.
  const unreachable = propEffectsUnreachable(pack);
  if (unreachable.filters > 0) {
    const kinds = Object.entries(unreachable.byType)
      .map(([type, count]) => `${count} ${type}`).join(", ");
    log(`props: ${unreachable.filters} filter(s) reach NO shape — ${kinds} on ` +
      `${unreachable.placements} text field(s); the UI bar's own glows are NOT drawn.`, { warn: true });
  }
}

/**
 * IS `ctx.filter` USABLE AND WHAT DOES IT COST — asked of the real browser,
 * behind `?filterprobe=1`, because both questions were answered by reading in
 * the brief and reading is what produced the claim above that was wrong.
 *
 * ► **THE FILTER RECORDS HERE ARE SYNTHETIC AND SAY SO.** They are the shape
 *   `parseFilterList` emits, invented for the probe, because the pack carries
 *   none. Nothing in this probe reaches the arena's pixels.
 */
function probeCanvasFilter() {
  const synthetic = [
    { type: "glow", blurX: 8, blurY: 8, passes: 2, strength: 2, inner: false, knockout: false,
      colour: { red: 255, green: 220, blue: 90, alpha: 255 } },
    { type: "blur", blurX: 6, blurY: 6, passes: 3 }
  ];
  const built = canvasFilterFor(synthetic, { scale: 1 });
  log(`filter probe: canvasFilterFor -> ${JSON.stringify(built.filter)} ` +
    `(applied ${built.counts.applied}, refused ${built.counts.refused}, noOp ${built.counts.noOp})`);

  context.save();
  context.filter = "none";
  context.filter = built.filter ?? "none";
  const accepted = context.filter;
  log(`filter probe: the browser read it back as ${JSON.stringify(accepted)} — ` +
    (accepted !== "none" && accepted.length > 0 ? "ACCEPTED" : "REJECTED"));

  // ► **THE FIRST VERSION OF THIS PRINTED `0.00ms plain and 0.00ms filtered`
  //   AND I ALMOST REPORTED IT.** Canvas fills are QUEUED: the loop returns
  //   before any of them has been rasterised, so timing the loop times the
  //   queueing. `getImageData` forces the surface to be finished, which is what
  //   makes the number a measurement of drawing rather than of bookkeeping —
  //   and 400 fills is below the noise floor either way.
  const SAMPLES = 4000;
  const wallStart = Date.now();
  const time = (filter) => {
    context.filter = filter;
    const started = performance.now();
    for (let n = 0; n < SAMPLES; n += 1) {
      context.fillStyle = "#123456";
      context.fillRect((n * 7) % 200, (n * 11) % 200, 24, 24);
    }
    context.getImageData(0, 0, 1, 1);
    return performance.now() - started;
  };
  const wallOf = () => Date.now() - wallStart;
  time("none");
  const plain = time("none");
  const filtered = time(built.filter ?? "none");
  const wallDelta = wallOf();
  context.filter = "none";
  context.restore();
  log(`filter probe: ${SAMPLES} fills took ${plain.toFixed(2)}ms plain and ` +
    `${filtered.toFixed(2)}ms filtered (${(filtered / Math.max(plain, 0.001)).toFixed(1)}x).`);
  // ► **AND WHETHER THAT NUMBER MEANS ANYTHING, REPORTED BESIDE IT.**
  //   `tools/shot.sh` drove Chrome with `--virtual-time-budget` (RETIRED 2026-09-16), under which
  //   `performance.now()` is VIRTUAL: it advances when the page yields and not
  //   while script runs, so every synchronous measurement in a screenshot comes
  //   back 0.00ms however much work was done. The clock is printed raw so a
  //   reader can see that rather than believing a zero.
  log(`filter probe: clock now=${performance.now().toFixed(2)} wall=${wallDelta.toFixed(2)}` +
    (plain === 0 && filtered === 0 ? " — BOTH ZERO, the clock is virtual; open the page in a real browser to time this." : ""));
}

/* ------------------------------------------------------------------ */
/* THE ENCLOSING GROUPS, COMPOSITED                                    */
/* ------------------------------------------------------------------ */

/**
 * WHAT FLASH DOES WITH A FILTER, AND WHAT THIS PAINTER HAD TO DO ABOUT IT.
 *
 * ► **A FILTER IS A FILTER OF THE COMPOSITE, NEVER OF A LEAF.** The player
 *   rasterises a filtered sprite and transforms the RESULT. `src/render/props.js`
 *   therefore folds the one kind that is exact per fill — the colour matrix —
 *   and hands everything else back as `op.group`, a frozen record SHARED by
 *   every operation under that group. Until this section existed nothing read
 *   it, so **363 groups carrying 208 blurs, 212 glows and 1 blend mode reached
 *   the canvas as though they were not there** — `ctx.filter` and
 *   `globalCompositeOperation` appeared nowhere in this file.
 *
 * ► **AND THE OBVIOUS IMPLEMENTATION IS THE WRONG PICTURE.** Setting
 *   `ctx.filter` around each operation blurs every path SEPARATELY, which is a
 *   different image with an internal seam at every path edge — and it looks
 *   plausible, which is why it is the version that ships. Measured on this
 *   repository's own pack rather than argued: of the **5,810 `sky` operations
 *   that sit under a group with a filter, 4,312 carry a CLIP**, and canvas
 *   applies `ctx.filter` to the source and THEN clips — so a per-leaf blur is
 *   cut off at the cutter's edge, where the build's blur spills past it. The
 *   two are not close.
 *
 * So each run of operations under one filtered or blended group is drawn into
 * an offscreen, and the offscreen is composited back ONCE.
 *
 * ## THE TWO TRAPS, AND WHY NEITHER IS REACHABLE HERE
 *
 * ► **THE BLEED.** An offscreen sized to the geometry CUTS THE BLUR OFF at the
 *   geometry's edge, which is a hard line where the build has a soft one. So
 *   the buffer is the geometry's device box **expanded by `filterBleedOf`**,
 *   and the operations are drawn into that larger region — everything outside
 *   the geometry draws nothing anyway, so the expansion costs pixels and never
 *   content. `filterBleedOf` is deliberately over-generous (three times the sum
 *   of EVERY length in the filter string, plus 4): a CSS Gaussian's support is
 *   3 sigma and `drop-shadow`'s radius is twice its sigma, so three times the
 *   stated length bounds both, and over-padding costs area while under-padding
 *   costs the picture.
 *
 * ► **THE SCALE, WHICH ON THIS SURFACE IS THREE DIFFERENT NUMBERS.**
 *   `ctx.filter` lengths are in the surface's own pixels — `filters.js` states
 *   that as an UNMEASURED hypothesis about the browser, and this painter is
 *   arranged so that the hypothesis cannot matter: **the buffer is composited
 *   back at the IDENTITY transform**, where a filter measured in user units and
 *   a filter measured in device units are the same filter. What remains is
 *   making the radius right in device pixels, and that is `propOpsFor`'s
 *   `scale` option, injected at the seam `arena-backdrop.js` already provides.
 *
 *   The three scales, measured rather than assumed:
 *
 *   - a STAGE layer is drawn at `fit.scale * layer.placement.scale` — 1.04 for
 *     `sky`, which is the one layer on the build's own arena frame that is not
 *     unscaled, and 1 for the other five;
 *   - `paintProp` draws at `size * view.scale`, and `view.scale` is
 *     `fit.scale * camera.zoomscale / 100` — **so a radius that ignored the
 *     camera would be wrong at every zoom but one**;
 *   - and the GROUP'S OWN MATRIX IS NOT IN THE PACK AT ALL.
 *     `assets/props/props.json` records `effects.notCarried.effectGroupMatrix`
 *     = 362 on `sky` and 1 on `bullet_trail`, one per group, so the radius is
 *     scaled by the stage and NOT by whatever the group sprite's own placement
 *     does. That is an approximation, it is `reportArenaEffects`'s job to print
 *     it, and it is not this file's to fix — see `blockedOutsideOwnership`.
 *
 *   ► **THE CAMERA ONE IS LUCKY RATHER THAN HANDLED, AND IS COUNTED SO THAT
 *     LUCK CANNOT BE MISTAKEN FOR CARE.** Every operation reaching `paintProp`
 *     comes from `arrowOpsFor`, `arrowTrailOpsFor`, `arenaSceneryFor` or
 *     `drawDrops`, all of which call `propOpsFor` INSIDE `props.js` with no
 *     scale — so their filter strings would be at scale 1. On this build that
 *     is harmless because the only group on that route is `bullet_trail`'s,
 *     which carries a blend mode and NO filter (`blur`/`glow` count 0 across
 *     `bullet`, `bullet_trail`, `blood`, `sparks` and `rockMC`). A pack where
 *     that stopped being true would be silently blurred at the wrong width, so
 *     `groupPaint.filterAtStageScale` counts every operation it happens to.
 *
 * ## WHAT IS STILL NOT RIGHT, COUNTED RATHER THAN QUIET
 *
 * - **A NESTED group composites only its INNERMOST record.** `op.group` is the
 *   innermost and `enclosedBy` walks out; doing this properly needs a stack of
 *   buffers. Every chain in this build's pack is one deep
 *   (`propInvoiceFor().nestedGroupPlacements` is 0), so `groupsNested` is the
 *   counter that says when that stops being true.
 * - **A group whose operations are NOT CONTIGUOUS is composited once per run**,
 *   which filters each piece separately — the per-leaf mistake at a coarser
 *   grain. Measured: 0 of the 745 group instances in this pack reach more than
 *   one run, because the extractor emits placements in path order.
 *   `groupsSplit` counts it, and the synthetic ops in
 *   `test/render-arena-shell.test.js` are the only thing that can move it.
 * - **A blend mode canvas cannot express is dropped by name**, not silently:
 *   `blendModeFor` refuses `layer`, `subtract`, `invert`, `alpha` and `erase`,
 *   and `groupsBlendRefused` counts them. This build uses one blend mode,
 *   `lighten`, and `filters.js` says outright that the id-to-name table is the
 *   SPECIFICATION'S and not a measurement — so what is drawn here is the
 *   spec's reading of id 5 and nothing in this repository has verified it.
 */

/**
 * `?groups=0` draws exactly what this file drew before any of it existed.
 *
 * Kept because the ONLY check on this section is a screenshot, and a screenshot
 * of one picture says nothing: the pair is the measurement. It also means a
 * player on a browser where `ctx.filter` is ruinous has a way back.
 */
const GROUP_COMPOSITING = params.get("groups") !== "0";
// `?clip=0` restores the pre-2026-09-15 picture: the stage letterboxed and
// every painter drawing straight through the bars. See `render`.
const STAGE_CLIP = params.get("clip") !== "0";
// `?amplify=0` restores the pre-2026-09-15 glow: `ctx.filter` alone, with every
// strength at or above the clamp drawing identically. See `amplifyGlows`.
const GLOW_AMPLIFY = params.get("amplify") !== "0";

/**
 * One frame's worth of what the compositor did, accumulated by
 * `paintGroupRuns` and printed ONCE by `reportGroupPaint`.
 *
 * ► **DENOMINATORS FIRST, for the reason `propInvoiceFor`'s invoice has them.**
 *   `groupsSplit`, `groupsNested`, `groupsBlendRefused` and `boxUnknown` are
 *   all ZERO on this build's pack, and a zero with nothing beside it cannot be
 *   told from a counter that is never reached. `ops`, `groupedOps`, `groups`
 *   and `buffers` are what say which.
 */
const groupPaint = {
  ops: 0,
  groupedOps: 0,
  runs: 0,
  groups: 0,
  // What got a buffer, and what was drawn straight onto the canvas.
  buffers: 0,
  bufferedOps: 0,
  direct: 0,
  // Groups whose only effect was a colour matrix `props.js` has already folded
  // into the fills. They need no buffer and are not a loss.
  inert: 0,
  // Off the canvas entirely, so the buffer was skipped. A saving, not a loss —
  // but it is the one branch that draws NOTHING, so it is counted rather than
  // trusted.
  offscreen: 0,
  // ► **WHAT THE STRING PATH COULD NOT DRAW AND THE SEQUENCE DID.** Counted
  //   rather than assumed, because "the amplified glow is wired in" and "a
  //   frame reached one" are different claims and this file has shipped the
  //   first while the second was false before. A frame with an enchanted
  //   gladiator should report a non-zero here; one without should report 0.
  glowAmplifiedGroups: 0,
  glowsAmplified: 0,
  // THE APPROXIMATIONS.
  groupsSplit: 0,
  groupsNested: 0,
  groupsBlendRefused: 0,
  boxUnknown: 0,
  boxClamped: 0,
  filterAtStageScale: 0,
  notComposited: 0
};

/**
 * THE RUNS ONE FLAT OPERATION ARRAY BREAKS INTO, and the invoice for them.
 *
 * ► **THE TEST IS OBJECT IDENTITY, NOT `group.id`.** `props.js` interns one
 *   frozen record per group per frame precisely so that `op.group !== previous`
 *   is the whole of the question; comparing ids would merge two DIFFERENT
 *   groups that happen to share an index across two props, and comparing
 *   `JSON.stringify` would be both slower and wrong for the same reason.
 *
 * Pure: it reads nothing but the array it is handed, which is what lets
 * `test/render-arena-shell.test.js` lift it out of this file's source and run
 * it. Node cannot import this module — absolute URL specifiers, `document`,
 * `Audio` at module scope — so lifting the text IS the only surface a test has,
 * and a function that closed over `context` or `canvas` would not have one.
 */
function groupRunsOf(ops) {
  const list = Array.isArray(ops) ? ops : [];
  const runs = [];
  const tally = {
    ops: 0, groupedOps: 0, runs: 0, groups: 0,
    buffered: 0, bufferedOps: 0, direct: 0, inert: 0,
    split: 0, nested: 0, blendRefused: 0
  };
  const seen = new Map();
  let current = null;
  for (let index = 0; index < list.length; index += 1) {
    const operation = list[index];
    const group = operation && typeof operation === "object" && operation.group ? operation.group : null;
    tally.ops += 1;
    if (group) tally.groupedOps += 1;
    if (!current || current.group !== group) {
      current = { group, from: index, to: index, buffered: false };
      runs.push(current);
      tally.runs += 1;
      if (group) {
        const before = seen.get(group) ?? 0;
        seen.set(group, before + 1);
        if (before === 0) {
          tally.groups += 1;
          if (group.blendModeRefused) tally.blendRefused += 1;
          if (group.enclosedBy) tally.nested += 1;
          if (!group.filter && !group.composite) tally.inert += 1;
        } else if (before === 1) {
          // Counted ONCE per split group rather than once per extra run, so it
          // reads against `groups` as its denominator.
          tally.split += 1;
        }
        current.buffered = Boolean(group.filter || group.composite);
      }
    }
    current.to = index + 1;
  }
  for (const run of runs) {
    if (run.buffered) {
      tally.buffered += 1;
      tally.bufferedOps += run.to - run.from;
    } else {
      tally.direct += 1;
    }
  }
  return { runs, tally };
}

/**
 * A CONSERVATIVE box around one path's `d`, in the path's own space.
 *
 * ► **EVERY NUMBER IN THIS BUILD'S PATH DATA IS A COORDINATE, WHICH IS WHY
 *   READING IT AS PAIRS IS CORRECT AND NOT A SHORTCUT.** Measured across every
 *   shape in `assets/props/props.json`: the only commands that occur are
 *   **M 1477, L 5481, Q 1740, Z 388** — no `A`, no `H`, no `V`, no `S`, none of
 *   the forms whose parameters are not points. A quadratic lies inside the
 *   convex hull of its control points, so taking the hull of every number pair
 *   OVER-estimates a curve and never clips one.
 *
 * ► **AND AN ODD COUNT RETURNS `null` RATHER THAN DROPPING THE LAST NUMBER.**
 *   That is the shape a new command letter would arrive in, and a box that
 *   silently lost a coordinate would clip the drawing instead of failing. The
 *   caller falls back to the whole canvas and `groupPaint.boxUnknown` says so.
 *
 * ► **THAT `% 2 !== 0` IS REDUNDANT AND IS KEPT ANYWAY, MEASURED RATHER THAN
 *   ASSUMED.** Deleting it (mutation M19, 2026-09-15) left the whole suite
 *   green, because an odd count always reaches `numbers[index + 1] ===
 *   undefined` on its last pair and the `Number.isFinite` guard below returns
 *   `null` for it anyway. It stays because it NAMES the condition a reader
 *   needs to know about — the two guards catch one fault for two different
 *   reasons — and it is recorded here as an equivalent mutant so that nobody
 *   later reports it as untested coverage.
 */
function pathBoxOf(d) {
  if (typeof d !== "string" || d.length === 0) return null;
  const numbers = d.match(/[-+]?[0-9]*[.]?[0-9]+(?:[eE][-+]?[0-9]+)?/g);
  if (!numbers || numbers.length < 2 || numbers.length % 2 !== 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < numbers.length; index += 2) {
    const x = Number(numbers[index]);
    const y = Number(numbers[index + 1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** `outer` then `inner`, as canvas's own `transform()` composes them. */
function composedMatrix(outer, inner) {
  return [
    outer[0] * inner[0] + outer[2] * inner[1],
    outer[1] * inner[0] + outer[3] * inner[1],
    outer[0] * inner[2] + outer[2] * inner[3],
    outer[1] * inner[2] + outer[3] * inner[3],
    outer[0] * inner[4] + outer[2] * inner[5] + outer[4],
    outer[1] * inner[4] + outer[3] * inner[5] + outer[5]
  ];
}

/**
 * A box through a matrix, as the AXIS-ALIGNED hull of its four corners.
 *
 * ► **ALL FOUR CORNERS, because two of them is only right for a matrix with no
 *   rotation and no mirror.** The figure scales by `(k, -k)` — the arena's y
 *   is up and the canvas's is down — and `paintProp` rotates every arrow by
 *   its pitch and mirrors a left-facing fireball, so the two-corner version
 *   would have been wrong on the first shot fired.
 */
function boxThrough(box, matrix) {
  if (!box || !Array.isArray(matrix) || matrix.length < 6) return null;
  const corners = [
    [box.minX, box.minY], [box.maxX, box.minY],
    [box.minX, box.maxY], [box.maxX, box.maxY]
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of corners) {
    const px = matrix[0] * x + matrix[2] * y + matrix[4];
    const py = matrix[1] * x + matrix[3] * y + matrix[5];
    if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * HOW FAR A CANVAS FILTER STRING REACHES PAST THE THING IT IS FILTERING, in
 * the same pixels the string's own lengths are in.
 *
 * ► **OVER-GENEROUS ON PURPOSE, AND THE ASYMMETRY IS THE WHOLE ARGUMENT.**
 *   Padding too much costs buffer area; padding too little cuts the blur off at
 *   a hard edge and puts the per-leaf picture back in a place no count would
 *   notice. A CSS Gaussian's support is 3 sigma; `blur(R)` takes R AS sigma
 *   while `drop-shadow(dx dy R c)` takes R as a box-shadow radius, which is
 *   TWICE sigma (`filters.js` states both and applies the doubling) — so three
 *   times the stated length bounds the reach of either, and summing across a
 *   chained string bounds the chain.
 *
 * ► **IT READS LENGTHS, NOT ARGUMENTS, so the `dx`/`dy` of a drop shadow are
 *   included in the sum rather than treated separately.** They are offsets and
 *   not radii, so summing them is more padding than is needed and never less.
 *   This build's shadows are all at `0px 0px` anyway — `canvasFilterFor` emits
 *   a glow as a zero-offset `drop-shadow` — so the distinction is unexercised
 *   here and the generous reading is what makes that safe.
 */
function filterBleedOf(filter) {
  if (typeof filter !== "string" || filter.length === 0) return 0;
  const lengths = filter.match(/[-+]?[0-9]*[.]?[0-9]+px/g);
  if (!lengths) return 0;
  let total = 0;
  for (const token of lengths) {
    const value = Number(token.slice(0, token.length - 2));
    if (Number.isFinite(value)) total += Math.abs(value);
  }
  return total * 3 + 4;
}

/**
 * The device-space box one run of operations covers, or `null` when any one of
 * them cannot be read.
 *
 * `translationDivisor` is 20 where the painter divides the placement's
 * translation by twips ~~(`paintArenaLayer`) and 1 where it does not
 * (`paintProp`)~~ — **both painters divide since 2026-09-23**; `paintProp`'s
 * 1 was a defect (see `paintPropOperation`). Still passed in rather than
 * assumed, because a box that disagreed with the draw would cut the layer in
 * half at a plausible-looking angle, and a figure route passes 1 for its own
 * pre-divided matrices.
 */
function runBoxOf(ops, run, ctm, translationDivisor) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let index = run.from; index < run.to; index += 1) {
    const operation = ops[index];
    const local = pathBoxOf(operation && operation.d);
    const matrix = operation && operation.matrix;
    if (!local || !Array.isArray(matrix) || matrix.length < 6) return null;
    // A stroke is centred on the path, so it reaches half its width outside —
    // padded by a whole width because half of an approximation is not a saving.
    const pad = Math.abs(Number(operation.strokeWidth) || 0);
    const padded = {
      minX: local.minX - pad, minY: local.minY - pad,
      maxX: local.maxX + pad, maxY: local.maxY + pad
    };
    const placed = [
      matrix[0], matrix[1], matrix[2], matrix[3],
      matrix[4] / translationDivisor, matrix[5] / translationDivisor
    ];
    const box = boxThrough(padded, composedMatrix(ctm, placed));
    if (!box) return null;
    if (box.minX < minX) minX = box.minX;
    if (box.minY < minY) minY = box.minY;
    if (box.maxX > maxX) maxX = box.maxX;
    if (box.maxY > maxY) maxY = box.maxY;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * The buffer REGION for a run: its box grown by the filter's bleed, snapped to
 * whole pixels and clipped to the surface.
 *
 * A `null` box means "this run could not be measured", and the honest answer to
 * that is the WHOLE SURFACE — never a guess at a smaller one. An empty result
 * means the run is entirely off the canvas and nothing has to be drawn at all.
 */
function bufferRegionOf(box, bleed, width, height) {
  const left = box ? Math.floor(box.minX - bleed) : 0;
  const top = box ? Math.floor(box.minY - bleed) : 0;
  const right = box ? Math.ceil(box.maxX + bleed) : width;
  const bottom = box ? Math.ceil(box.maxY + bleed) : height;
  const x = Math.max(0, Math.min(width, left));
  const y = Math.max(0, Math.min(height, top));
  const x1 = Math.max(0, Math.min(width, right));
  const y1 = Math.max(0, Math.min(height, bottom));
  return {
    x, y,
    width: Math.max(0, x1 - x),
    height: Math.max(0, y1 - y),
    clamped: Boolean(box) && (left < 0 || top < 0 || right > width || bottom > height)
  };
}

/* --- Everything below here touches the DOM and cannot be lifted out. ----- */

/**
 * ONE OFFSCREEN PER NESTING DEPTH, reused across frames and resized only when
 * it has to be.
 *
 * ► **A FRESH CANVAS PER GROUP IS A FRESH ALLOCATION PER GROUP PER FRAME.**
 *   At `?sky=124` — the frame with the most filtered groups in the pack —
 *   three are composited, and an arrow in flight adds six more for its trail. Keyed by
 *   DEPTH rather than pooled arbitrarily so that a buffer can never be the one
 *   being drawn into further up the stack.
 *
 * ► **SHRINKS AS WELL AS GROWS.** `clearRect` costs the buffer's whole area, so
 *   a buffer left at the size of the biggest run ever seen would make every
 *   20-pixel trail puff pay for the sky. The hysteresis (only shrink past 2x)
 *   stops a resize on every frame, and a resize clears the canvas by itself.
 */
const groupBuffers = [];
let groupDepth = 0;

function groupBufferAt(depth, width, height) {
  let buffer = groupBuffers[depth];
  if (!buffer) {
    const offscreen = document.createElement("canvas");
    buffer = { canvas: offscreen, context: offscreen.getContext("2d") };
    groupBuffers[depth] = buffer;
  }
  const wanted = Math.max(1, Math.ceil(width));
  const tall = Math.max(1, Math.ceil(height));
  if (buffer.canvas.width < wanted || buffer.canvas.height < tall
    || buffer.canvas.width > wanted * 2 || buffer.canvas.height > tall * 2) {
    // Assigning either dimension clears the canvas, which is the cheap path.
    buffer.canvas.width = wanted;
    buffer.canvas.height = tall;
  } else {
    buffer.context.setTransform(1, 0, 0, 1, 0, 0);
    buffer.context.clearRect(0, 0, buffer.canvas.width, buffer.canvas.height);
  }
  buffer.context.setTransform(1, 0, 0, 1, 0, 0);
  buffer.context.globalAlpha = 1;
  buffer.context.globalCompositeOperation = "source-over";
  buffer.context.filter = "none";
  return buffer;
}

/**
 * Whether this browser can be asked to do any of it.
 *
 * `getTransform` is what copies the destination's transform onto the buffer, so
 * without it a run would be drawn at the wrong place rather than unfiltered —
 * which is worse than not compositing at all. Asked once and logged, because a
 * silent fallback is the thing this file keeps being punished for.
 */
let groupCompositingAnswer = null;
function groupCompositingAvailable() {
  if (groupCompositingAnswer === null) {
    groupCompositingAnswer = GROUP_COMPOSITING
      && typeof context.getTransform === "function"
      && typeof document.createElement === "function";
    if (!groupCompositingAnswer) {
      log(GROUP_COMPOSITING
        ? "groups: this browser has no ctx.getTransform — filters and blends are NOT drawn."
        : "groups: ?groups=0 — filters and blends are NOT drawn, on purpose.", { warn: true });
    }
  }
  return groupCompositingAnswer;
}

/**
 * DRAW ONE FLAT OPERATION ARRAY, COMPOSITING EACH FILTERED OR BLENDED GROUP.
 *
 * ► **THE DESTINATION IS SWAPPED BY REBINDING `context`, AND THAT IS A CHOICE
 *   RATHER THAN A SHORTCUT.** Every painter in this file — `paintGradientFill`,
 *   `paintBitmapFill`, `paintLayerOperation`, `paintPropOperation` — already
 *   reads the module's one `context` binding, so rebinding it is the seam they
 *   all share. Threading a `ctx` parameter through them instead would be a
 *   six-function change in THE ONE FILE THE SUITE CANNOT IMPORT, which is the
 *   opposite of what this file's history asks for. The restore is in a
 *   `finally`, and `render()` re-asserts `context = surface` at the top of every
 *   frame so that an exception mid-run cannot leave the whole arena being
 *   painted into an offscreen nobody looks at.
 *
 * @param {object[]} ops
 * @param {object}   route  `{ translationDivisor, filtersScaled }` — how THIS
 *                          painter reads a placement matrix, and whether the
 *                          filter strings on the groups were built at the
 *                          device scale
 * @param {Function} drawOne  draws one operation into the current `context`
 */
/**
 * A pool of scratch surfaces for the amplified-glow sequence, one per NAME per
 * depth — nested groups composite while an outer one is outstanding, so sharing
 * by name alone would let the inner pass clear the outer pass's working copy.
 */
const glowScratch = new Map();

function glowScratchAt(name, depth, width, height) {
  const key = `${name}:${depth}`;
  let found = glowScratch.get(key);
  if (!found) {
    const element = document.createElement("canvas");
    found = { canvas: element, context: element.getContext("2d") };
    glowScratch.set(key, found);
  }
  const wanted = Math.max(1, Math.ceil(width));
  const tall = Math.max(1, Math.ceil(height));
  if (found.canvas.width !== wanted || found.canvas.height !== tall) {
    found.canvas.width = wanted;
    found.canvas.height = tall;
  } else {
    found.context.setTransform(1, 0, 0, 1, 0, 0);
    found.context.clearRect(0, 0, wanted, tall);
  }
  found.context.setTransform(1, 0, 0, 1, 0, 0);
  found.context.globalAlpha = 1;
  found.context.globalCompositeOperation = "source-over";
  found.context.filter = "none";
  return found;
}

/**
 * THE GLOW A PLAYER DRAWS, RUN ON A COMPOSITED GROUP BUFFER.
 *
 * ► **THIS FILE HOLDS THE DRAWING AND NONE OF THE DECIDING**, which is the rule
 *   the living head keeps restating: `tools/arena/main.js` cannot be imported
 *   by node, so anything decided here is unreachable by the suite, and five
 *   live defects have come out of that arrangement. Every number below —
 *   which filters amplify, how many additive draws, the final draw's alpha, the
 *   silhouette's own radius and the colour — is computed by
 *   `glowAmplificationFor` in `src/render/filters.js` and pinned there.
 *
 * ► **THE SEQUENCE IS AN IDENTITY, NOT A FIT, and the verification is on
 *   disk.** `tools/glow-compare/amplified.html` runs these same four steps on
 *   the six-strength ladder `tools/swf-probe.mjs` hands Ruffle. Measured, blue
 *   channel outward from the source edge, strength 1 / 2 / 4:
 *
 * ```text
 *     oracle   63 39 26 2  |  126 78 52 4  |  252 156 104 8
 *     ours     62 38 19 8  |  124 76 38 16 |  248 152  76 32
 * ```
 *
 *   The peaks agree to within 1.6% and the doubling is exact, which is the
 *   strength. What remains is the box-versus-Gaussian tail that
 *   `boxBlurAsGaussian` has always counted — multiplied faithfully rather than
 *   introduced here.
 *
 * ► **STRENGTH 1 IS THE NULL CONTROL.** At strength 1 the old string path is
 *   already exact, and the plan there is a single draw at full alpha; both
 *   render `62 38 19 8 2`, identically. A sequence that changed that number
 *   would be wrong before it ever reached a saturating glow.
 *
 * Returns the surface to draw, or `null` when there is nothing to amplify — so
 * a caller that ignores the return keeps its previous behaviour exactly.
 */
function amplifyGlows(source, region, plan) {
  const steps = plan?.steps;
  if (!Array.isArray(steps) || steps.length === 0) return null;
  const width = region.width;
  const height = region.height;
  if (!(width > 0) || !(height > 0)) return null;

  // The bitmap each filter applies to. Flash walks a filter list in order, each
  // filter over the accumulated result, so this is reassigned per step rather
  // than every step reading the original.
  let current = glowScratchAt("current", groupDepth, width, height);
  current.context.drawImage(source, 0, 0);

  for (const step of steps) {
    // 1. SILHOUETTE — white, because white is the only colour whose
    //    premultiplied channels equal its alpha, so the additive step cannot
    //    shift a hue.
    const silhouette = glowScratchAt("silhouette", groupDepth, width, height);
    silhouette.context.filter = step.silhouette;
    silhouette.context.drawImage(current.canvas, 0, 0);
    silhouette.context.filter = "none";

    // 2. AMPLIFY — `lighter` sums premultiplied channels and clamps at 1, so
    //    the alpha out is exactly min(1, blurredAlpha * strength).
    const accumulator = glowScratchAt("accumulator", groupDepth, width, height);
    accumulator.context.globalCompositeOperation = "lighter";
    for (let draw = 0; draw < step.repeats; draw += 1) {
      accumulator.context.globalAlpha = draw === step.repeats - 1 ? step.lastAlpha : 1;
      accumulator.context.drawImage(silhouette.canvas, 0, 0);
    }
    accumulator.context.globalAlpha = 1;

    // 3. COLOURISE — which also erases the source's own colours, which rode
    //    along inside the silhouette and are not wanted in the glow.
    accumulator.context.globalCompositeOperation = "source-in";
    accumulator.context.fillStyle = step.colour;
    accumulator.context.fillRect(0, 0, width, height);
    accumulator.context.globalCompositeOperation = "source-over";

    // 4. UNDER — the glow, then the bitmap that cast it, on top.
    const next = glowScratchAt("next", groupDepth, width, height);
    next.context.drawImage(accumulator.canvas, 0, 0);
    next.context.drawImage(current.canvas, 0, 0);
    const held = glowScratchAt("held", groupDepth, width, height);
    held.context.drawImage(next.canvas, 0, 0);
    current = held;
  }
  return current;
}

function paintGroupRuns(ops, route, drawOne) {
  const plan = groupRunsOf(ops);
  groupPaint.ops += plan.tally.ops;
  groupPaint.groupedOps += plan.tally.groupedOps;
  groupPaint.runs += plan.tally.runs;
  groupPaint.groups += plan.tally.groups;
  groupPaint.direct += plan.tally.direct;
  groupPaint.inert += plan.tally.inert;
  groupPaint.groupsSplit += plan.tally.split;
  groupPaint.groupsNested += plan.tally.nested;
  groupPaint.groupsBlendRefused += plan.tally.blendRefused;

  const composite = groupCompositingAvailable();
  for (const run of plan.runs) {
    if (!run.buffered || !composite) {
      if (run.buffered) groupPaint.notComposited += run.to - run.from;
      for (let index = run.from; index < run.to; index += 1) drawOne(ops[index]);
      continue;
    }
    if (run.group.filter && !route.filtersScaled) groupPaint.filterAtStageScale += run.to - run.from;

    const ctm = context.getTransform();
    const outer = [ctm.a, ctm.b, ctm.c, ctm.d, ctm.e, ctm.f];
    const box = runBoxOf(ops, run, outer, route.translationDivisor);
    if (!box) groupPaint.boxUnknown += 1;
    const region = bufferRegionOf(box, filterBleedOf(run.group.filter), canvas.width, canvas.height);
    if (region.clamped) groupPaint.boxClamped += 1;
    if (region.width === 0 || region.height === 0) {
      groupPaint.offscreen += 1;
      continue;
    }

    const buffer = groupBufferAt(groupDepth, region.width, region.height);
    // The buffer's origin is the region's top-left, so the SAME device
    // transform draws the same pixels one translation over.
    buffer.context.setTransform(1, 0, 0, 1, -region.x, -region.y);
    buffer.context.transform(outer[0], outer[1], outer[2], outer[3], outer[4], outer[5]);
    const destination = context;
    context = buffer.context;
    groupDepth += 1;
    try {
      for (let index = run.from; index < run.to; index += 1) drawOne(ops[index]);
    } finally {
      groupDepth -= 1;
      context = destination;
    }

    groupPaint.buffers += 1;
    groupPaint.bufferedOps += run.to - run.from;

    // ► **A SATURATING GLOW IS DRAWN, NOT DESCRIBED.** `ctx.filter` cannot
    //   express a SWF glow's `strength` — the whole loss ranked first in the
    //   2026-09-15 handoff — so when `src/render/filters.js` hands back a plan,
    //   the sequence below runs instead of the filter string. `amplifyGlows`
    //   returns the canvas to draw; when there is no plan it returns null and
    //   the string path below is untouched.
    //   The composite below then sets `context.filter` only when there is NO
    //   plan: the sequence has already drawn the blur, so applying the string
    //   as well would blur the result a second time.
    const amplified = run.group.amplify && GLOW_AMPLIFY
      ? amplifyGlows(buffer.canvas, region, run.group.amplify)
      : null;
    if (amplified) {
      groupPaint.glowsAmplified += run.group.amplify.steps.length;
      groupPaint.glowAmplifiedGroups += 1;
    }

    context.save();
    // ► **IDENTITY, WHICH IS WHAT MAKES THE UNMEASURED SCALE HYPOTHESIS STOP
    //   MATTERING.** Whether a browser measures `ctx.filter` in user units or
    //   in device pixels, the two coincide when the transform is the identity —
    //   so the only remaining question is whether the RADIUS was built at the
    //   device scale, which is `route.filtersScaled` above.
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    if (run.group.filter && !amplified) context.filter = run.group.filter;
    if (run.group.composite) context.globalCompositeOperation = run.group.composite;
    context.drawImage(
      (amplified ?? buffer).canvas, 0, 0, region.width, region.height,
      region.x, region.y, region.width, region.height
    );
    context.restore();
  }
  return plan;
}

/**
 * The compositor's invoice, printed ONCE — after the first frame that actually
 * had a group in it, because a frame before the pack has loaded says nothing.
 *
 * ► **WHAT THESE NUMBERS COULD HAVE VARIED OVER, STATED.** They are per FRAME
 *   and they move with `?sky=`, with the camera, and with whether an arrow is
 *   in the air. Measured: at the shipped dressing `sky` frame 1 reaches 2
 *   groups over 2 operations and exactly ONE of them is filtered; `?sky=124`
 *   reaches 4 groups over 70 operations, 3 of them filtered and covering 69 of
 *   the 70; and a shot in flight adds six more, one per `bullet_trail` puff,
 *   each carrying a blend mode and no filter. A run at one dressing that
 *   reported the same numbers as another would be the finding.
 *
 * ► **THE `ops` DENOMINATOR ABOVE IS A PROPS-ONLY MEASUREMENT AND STOPPED
 *   BEING ONE ON 2026-09-15.** `drawOps` now routes the extracted figure
 *   through `paintGroupRuns` too, and a figure is ~130 operations — so `ops`
 *   here is now the props' plus every fighter's, and the "2 operations" and
 *   "70 operations" above describe the props alone. The GROUP counts are
 *   unaffected while the rig's pack contributes none. The figure's own
 *   numbers, with their own denominators, are `reportFigureGroups`.
 */
let groupPaintHigh = -1;
let groupPaintReports = 0;

function resetGroupPaint() {
  for (const key of Object.keys(groupPaint)) groupPaint[key] = 0;
}

/**
 * THE FIGURE'S OWN HALF OF THE COMPOSITOR'S INVOICE, per frame.
 *
 * ► **SEPARATE FROM `groupPaint` BECAUSE THE FIGURE AND THE PROPS ANSWER
 *   DIFFERENT QUESTIONS, AND SHARING ONE TALLY WOULD HIDE BOTH.** A frame is
 *   ~130 operations per fighter and six fighters — so rolled into
 *   `groupPaint.ops` the props' own denominators (2 operations at the shipped
 *   sky, 70 at `?sky=124`) would be lost in four figures of rig. The figure's
 *   operations DO still feed `groupPaint`, because `paintGroupRuns` writes
 *   there and that total is genuinely "what the compositor did this frame"; the
 *   props line's numbers therefore moved on 2026-09-15 and the comment above
 *   `reportGroupPaint` says which measurement that invalidated.
 *
 * ► **AND THE DENOMINATORS ARE THE POINT, for `groupPaint`'s own stated
 *   reason.** `groups: 0` beside nothing cannot be told from a counter that is
 *   never reached — which is exactly the state this file is in until
 *   `src/render/extracted-figure.js` attaches an `op.group`. `ops`, `figures`
 *   and the pack census beside them are what say "reached, and empty".
 */
/**
 * ► **`plannedBuffers` IS NOT `groupPaint.buffers`, AND THE FIRST VERSION OF
 *   THIS OBJECT CALLED IT `buffered` AND PRINTED IT AS THOUGH IT WERE.**
 *   `groupRunsOf` sets `run.buffered = Boolean(group.filter || group.composite)`
 *   from the RECORD alone — it never consults `groupCompositingAvailable()`,
 *   never sees `?groups=0`, and never sees the region check that skips an
 *   off-canvas run. So this counts buffers the compositor was ASKED for.
 *   `groupPaint.buffers` beside it counts buffers actually opened, because it
 *   is incremented inside the composite branch after the region test.
 *
 *   **At `?groups=0` the old name reported buffers while zero were made.**
 *   Renamed rather than recomputed: the planned number is the useful one here
 *   (it says what the pack asked for), and the made number already has an
 *   honest home. What was wrong was one word in a log line.
 */
const figureGroupPaint = {
  figures: 0,
  ops: 0,
  groupedOps: 0,
  groups: 0,
  plannedBuffers: 0,
  plannedBufferOps: 0,
  direct: 0,
  inert: 0,
  split: 0,
  nested: 0,
  blendRefused: 0
};

function resetFigureGroupPaint() {
  for (const key of Object.keys(figureGroupPaint)) figureGroupPaint[key] = 0;
}

/** One figure's plan, added to this frame's figure invoice. */
function countFigureGroups(plan) {
  if (!plan || typeof plan !== "object" || !plan.tally) return;
  figureGroupPaint.figures += 1;
  figureGroupPaint.ops += plan.tally.ops;
  figureGroupPaint.groupedOps += plan.tally.groupedOps;
  figureGroupPaint.groups += plan.tally.groups;
  figureGroupPaint.plannedBuffers += plan.tally.buffered;
  figureGroupPaint.plannedBufferOps += plan.tally.bufferedOps;
  figureGroupPaint.direct += plan.tally.direct;
  figureGroupPaint.inert += plan.tally.inert;
  figureGroupPaint.split += plan.tally.split;
  figureGroupPaint.nested += plan.tally.nested;
  figureGroupPaint.blendRefused += plan.tally.blendRefused;
}

/**
 * ► **PRINTED ON THE FIRST FRAME THAT DREW A FIGURE AT ALL, AND AGAIN ON EVERY
 *   NEW HIGH-WATER MARK — SO THE ZERO IS PRINTED TOO.** `reportGroupPaint`
 *   returns early on `groups === 0`, which is right for the props (the pack has
 *   363 groups and a frame with none is a frame that drew no scenery) and would
 *   be exactly wrong here: the interesting state today IS the zero, and it is
 *   only readable beside `ops` and the pack's own census.
 */
let figureGroupsHigh = -1;
let figureGroupsReports = 0;

function reportFigureGroups() {
  if (figureGroupPaint.ops === 0 || figureGroupPaint.groups <= figureGroupsHigh) return;
  figureGroupsHigh = figureGroupPaint.groups;
  figureGroupsReports += 1;
  // Four, for `reportGroupPaint`'s reason: `psyche_up2` raises the mark one
  // group at a time as its nine frames play, and the load-time lines must not
  // scroll out of a 40-line panel.
  if (figureGroupsReports > 4) return;
  log(`figure groups: ${figureGroupPaint.groups} group(s) over ` +
    `${figureGroupPaint.groupedOps}/${figureGroupPaint.ops} op(s) in ` +
    `${figureGroupPaint.figures} figure(s) this frame, ` +
    `${figureGroupPaint.plannedBuffers} buffer(s) ASKED FOR ` +
    `(${figureGroupPaint.plannedBufferOps} op(s)) — see the \`groups:\` line for how many were ` +
    `actually opened, which is 0 at ?groups=0, ` +
    `${figureGroupPaint.direct} straight, ${figureGroupPaint.inert} matrix-only.`);
  const lost = figureGroupPaint.split + figureGroupPaint.nested + figureGroupPaint.blendRefused;
  log(`figure groups: approximated — split ${figureGroupPaint.split}, ` +
    `nested ${figureGroupPaint.nested}, blend refused ${figureGroupPaint.blendRefused} ` +
    `(a run the compositor SKIPPED as off-canvas or clipped is counted in \`groups:\`, not here — ` +
    `this route has no counter of its own for it); ` +
    `the rig's pack carries ${figureEffects.groups} group(s) over ` +
    `${figureEffects.effectedPlacements}/${figureEffects.placements} placement(s) in ` +
    `${figureEffects.withEffects}/${figureEffects.animations} animation(s)` +
    (figureEffects.labels.length > 0 ? ` (${figureEffects.labels.join(", ")})` : "") + ".",
  { warn: lost > 0 });
}

/**
 * ► **THE GATE AND THE SIX-TERM TALLY MOVED TO `groupPaintReadout` ON
 *   2026-09-19.** What is left here is the log formatting.
 */
function reportGroupPaint() {
  const readout = groupPaintReadout(groupPaint, { seenHigh: groupPaintHigh, reportsMade: groupPaintReports });
  groupPaintHigh = readout.seenHigh;
  // ► **CAPPED AT THREE, BECAUSE A TRAIL BUILDS UP ONE PUFF AT A TIME.** An
  //   arrow attaches its six `bullet_trail` groups over six frames, so every
  //   one of those frames is a new high water mark — six reports of three
  //   lines each, into a 40-line panel, and the load-time invoice scrolls off
  //   the top. Three is the busiest frame this page reaches in practice and
  //   the cap is stated rather than left as an accident of the ramp.
  groupPaintReports = readout.reportsMade;
  if (!readout.report) return;
  log(`groups: ${groupPaint.groups} group(s) over ${groupPaint.groupedOps}/${groupPaint.ops} ops, ` +
    `${groupPaint.buffers} buffered (${groupPaint.bufferedOps} ops).`);
  log(`groups: ${groupPaint.inert} matrix-only (already folded), ${groupPaint.offscreen} off-canvas, ` +
    `${groupPaint.direct} run(s) straight, ${groupPaint.boxClamped} buffer(s) clipped by the canvas.`);
  // ► **PRINTED EVEN WHEN ZERO, because zero is the answer that matters.** A
  //   frame with no enchanted gladiator reaches no amplified glow and should
  //   say 0; one with a glowing weapon should not. "It is wired in" and "a
  //   frame reached it" are different claims and this file has shipped the
  //   first while the second was false.
  log(`groups: ${groupPaint.glowAmplifiedGroups} group(s) drew an AMPLIFIED glow ` +
    `(${groupPaint.glowsAmplified} step(s)) — what \`ctx.filter\` cannot express.`);
  // The six-term sum is `groupPaintReadout`'s. Dropping a term here would
  // hide the warning while the panel still printed the number.
  const lost = readout.approximated;
  log(`groups: approximated — split ${groupPaint.groupsSplit}, nested ${groupPaint.groupsNested}, ` +
    `blend refused ${groupPaint.groupsBlendRefused}, unmeasurable ${groupPaint.boxUnknown}, ` +
    `unscaled ${groupPaint.filterAtStageScale}, not composited ${groupPaint.notComposited} ` +
    `(of ${groupPaint.groups} groups / ${groupPaint.groupedOps} ops).`, { warn: lost > 0 });
}

/**
 * ONE operation of an arena-screen layer, into whatever `context` currently is.
 *
 * Lifted out of `paintArenaLayer`'s loop so that `paintGroupRuns` can call it
 * for a run at a time — into the canvas for an unfiltered run and into an
 * offscreen for a filtered one. The body is unchanged.
 */
function paintLayerOperation(operation) {
  const m = operation.matrix;
  context.save();
  // ► **THE CLIP GOES ON BEFORE THE SHAPE'S OWN TRANSFORM**, because the
  //   cutter's matrix is composed in the SAME space as the shape's and not
  //   inside it. Setting it after would clip the moon's glow by a mask
  //   already moved by the glow's own placement — which is a plausible
  //   picture and the wrong one.
  //
  // ► **AND IT IS INSIDE THE GROUP'S BUFFER, WHICH IS THE ONLY PLACE IT CAN
  //   BE RIGHT.** Canvas applies `ctx.filter` to the source and clips the
  //   RESULT, so a per-operation filter would be cut off at the cutter's edge
  //   while the build's blur spills past it. 4,312 of the 5,810 `sky`
  //   operations under a filtered group carry one of these, so that is not a
  //   corner case — it is most of the sky.
  if (operation.clip) {
    const c = operation.clip.matrix;
    context.save();
    context.transform(c[0], c[1], c[2], c[3], c[4] / TWIPS_PER_PIXEL, c[5] / TWIPS_PER_PIXEL);
    context.clip(path2dFor(operation.clip.d), "evenodd");
    context.restore();
  }
  context.transform(m[0], m[1], m[2], m[3], m[4] / TWIPS_PER_PIXEL, m[5] / TWIPS_PER_PIXEL);
  const path = path2dFor(operation.d);
  if (operation.bitmap) {
    context.globalAlpha = operation.fillOpacity ?? 1;
    paintBitmapFill(operation, path);
  } else if (operation.gradient) {
    context.globalAlpha = 1;
    paintGradientFill(operation, path);
  } else if (operation.fill && operation.fill !== "none") {
    context.globalAlpha = operation.fillOpacity ?? 1;
    context.fillStyle = operation.fill;
    context.fill(path, operation.fillRule ?? "evenodd");
  }
  if (operation.stroke && operation.strokeWidth > 0) {
    context.globalAlpha = operation.strokeOpacity ?? 1;
    context.strokeStyle = operation.stroke;
    context.lineWidth = operation.strokeWidth;
    context.lineJoin = "round";
    context.stroke(path);
  }
  context.restore();
}

function paintArenaLayer(layer, fit) {
  const { x, y, scale } = layer.placement;
  context.save();
  context.translate(fit.offsetX, fit.offsetY);
  context.scale(fit.scale, fit.scale);
  context.translate(x, y);
  if (scale !== 1) context.scale(scale, scale);
  // ► **`filtersScaled: true` BECAUSE `render()` INJECTS THE STAGE SCALE.**
  //   The reader handed to `arenaScreenLayersFor` asks `propOpsFor` for
  //   `fit.scale * layer.scale`, so the radii on these groups are already in
  //   the device pixels the composite step measures them in. The 20 is this
  //   painter's own twips divisor, three lines below in `paintLayerOperation`.
  paintGroupRuns(layer.ops, { translationDivisor: TWIPS_PER_PIXEL, filtersScaled: true }, paintLayerOperation);
  context.globalAlpha = 1;
  context.restore();
}

/**
 * ONE-TIME INSTRUMENTATION OF THE WIRE-TO-DRAW SEAM.
 *
 * ► **THE WEAPON IS DECLARED, REACHES THE WIRE, AND DOES NOT APPEAR.**
 *   Measured in node: `ss2Combatant` declares `weapon: 1` on this roster's exact
 *   `derive: false` path, `attachmentsFor` returns the weapon row, and
 *   `paintExtractedFigure` called directly produces eight weapon ops spanning
 *   66% of the figure's width. It is absent from four headless screenshots.
 *
 *   So the break is in THIS file, which the suite cannot reach — and the
 *   previous session lost an hour reasoning about the seam instead of looking
 *   at it. This prints what the shell actually hands the painter, ONCE, into
 *   the log panel that a screenshot captures. It is the cheapest possible
 *   instrument and it should have been the first move.
 *
 * ► **AND IT ANSWERED IN ONE SHOT: NOTHING WAS BROKEN AT THIS SEAM.**
 *   `loadout.weapon=1`, the weapon row is offered, and the painter returns 132
 *   ops. Rendered at 2400x1500 the sword is plainly there — grey blade, brown
 *   grip — **drawn across the hips rather than held.** So the defect was never
 *   "the weapon does not reach the renderer"; it is a TRANSFORM, and an hour of
 *   reasoning about plumbing was spent on a question a screenshot answered.
 *
 * Kept behind `?seam=1` rather than deleted: it cost two minutes, it is the
 * only window into the one file the suite cannot reach, and the next question
 * about this seam will not be the last.
 */
let loadoutReported = false;
const SEAM_PROBE = params.has("seam");

function reportedLoadout(combatant) {
  const declared = loadoutFrom(combatant);
  // ► **THE DEMO OVERRIDE GOES ON THE LOADOUT, NOT ON THE COMBATANT.** The
  //   combatant is the wire projection — the thing the resolver produced — and
  //   writing an enchantment into it would put a number the engine never
  //   computed into the same object every panel readout is copied from.
  //   `loadoutFrom` has already projected the resource shapes, so these four
  //   plain numbers are the shape the painter reads.
  const loadout = ENCHANT_DEMO && declared ? { ...declared, ...ENCHANT_DEMO.fields } : declared;
  if (SEAM_PROBE && !loadoutReported) {
    loadoutReported = true;
    const rows = attachmentsFor(loadout);
    log(`seam: loadout.weapon=${loadout?.weapon ?? "ABSENT"} equipped=${loadout?.equipped_weapon ?? "ABSENT"}`);
    // ► **BOTH PAIRS, BECAUSE THE GLOW READS THE EQUIPPED SLOT'S OWN.** With a
    //   bow up the build calls `itemglow` with the SECONDARY pair while
    //   `damagecharacter` still gates the proc on the melee potency, so a probe
    //   that printed one pair could not tell a correct picture from the
    //   configuration where the two disagree.
    log(`seam: enchant melee=${loadout?.weapon_enchantment_type ?? "ABSENT"}` +
      `.${loadout?.weapon_enchantment_potency ?? "ABSENT"} ` +
      `bow=${loadout?.secondary_weapon_enchantment_type ?? "ABSENT"}` +
      `.${loadout?.secondary_weapon_enchantment_potency ?? "ABSENT"}` +
      (ENCHANT_DEMO ? " (FORCED by ?enchant=, not the engine's)" : ""));
    log(`seam: weapon row offered=${rows.some((r) => r.slot === "weapon")} shield row=${rows.some((r) => r.slot === "shield")}`);
    // The decisive number: how many ops the painter returns for the weapon slot.
    const probe = hasExtractedArt(figurePack)
      ? paintExtractedFigure(figurePack, {
        family: "standing", label: "Standing", facing: "right", at: 0,
        height: 150, wardrobe, loadout
      })
      : [];
    const bySlot = {};
    for (const op of probe) if (op.slot) bySlot[op.slot] = (bySlot[op.slot] ?? 0) + 1;
    log(`seam: painter ops=${probe.length} dressed=${JSON.stringify(bySlot)}`);
  }
  return loadout;
}

function combatantsById() {
  const wire = host.wire();
  return new Map(wire.teams.flatMap((team) => team.combatants).map((combatant) => [combatant.id, combatant]));
}

/**
 * THE PROPS READER THE ARENA SCREEN IS DRAWN THROUGH, at THIS canvas's scale.
 *
 * ► **THE ONLY THING IT ADDS IS `scale`, AND THE LAST WRAPPER AT THIS SEAM WAS
 *   A DEFECT.** `tintedPropOpsFor` re-applied the placement's colour transform
 *   to what `propOpsFor` returned and squared every multiplier; it was deleted
 *   on 2026-09-14 and `test/render-arena-shell.test.js` reads this file as text
 *   to keep it deleted. This wrapper changes NO fill, NO opacity and NO
 *   geometry — measured across all twelve linkages and all 302 frames of this
 *   repository's own pack, the operations are byte-identical at scale 1 and at
 *   scale 3.75 in every field except `group.filter`, which is the string whose
 *   radii are in canvas pixels and is the whole reason to pass a scale at all.
 *
 * ► **AND THE LAYER'S OWN SCALE IS IN IT, WHICH IS NOT THE SAME AS THE FIT'S.**
 *   `sky` is placed at 1.04 — the build's own arena frame puts exactly one
 *   object on it that is not unscaled — so a reader that passed `fit.scale`
 *   alone would draw every sky blur 4% narrow. `paintArenaLayer` applies the
 *   same two factors to the geometry, ten lines apart, which is what makes them
 *   one number rather than two that can drift.
 */
function stagePropOpsFor(fit) {
  return (pack, options) => propOpsFor(pack, {
    ...options,
    scale: fit.scale * layerScaleOf(options && options.linkage)
  });
}

/** The `scale` the arena-screen layer table places this linkage at, or 1. */
function layerScaleOf(linkage) {
  for (const layer of SS2_ARENA_SCREEN_LAYERS) {
    if (layer.prop === linkage) return Number.isFinite(layer.scale) ? layer.scale : 1;
  }
  return 1;
}

/**
 * The clock reading at which the current bout was settled, or `null` while one
 * is still being fought. Stamped in `render` because that is where the result
 * first becomes visible every frame; see the `celebratingSince` note at its
 * one reader.
 */
let celebrationStartedAt = null;

function render(now = performance.now()) {
  // ► **NOTHING OF THE STAGE BEFORE THE ASSET GATE OPENS** — not the authored
  //   bowl, not a vector gladiator: the loading frame, whoever called (the
  //   loop, a resize). See `paintLoadingFrame`.
  if (!assetGateOpen) {
    paintLoadingFrame(now);
    return;
  }
  // Re-asserted every frame for the same reason the drawing surface is: a
  // stage that changes size between frames must not be drawn through the old
  // backing store, and the guard inside makes this free when nothing moved.
  sizeCanvasToStage();
  if (host?.battle?.result) {
    if (celebrationStartedAt === null) celebrationStartedAt = now;
  } else {
    celebrationStartedAt = null;
  }
  // ► **THE INVARIANT, RE-ASSERTED ONCE A FRAME.** `paintGroupRuns` rebinds
  //   `context` to an offscreen while it composites a group and restores it in
  //   a `finally`; this is the belt to that braces, so a throw anywhere in a
  //   frame cannot make the NEXT frame draw the whole arena into a buffer.
  context = surface;
  // The compositor's tally is PER FRAME, so it is zeroed here rather than
  // accumulated: a running total over an unknown number of frames cannot be
  // read against the per-frame denominators `reportGroupPaint` prints beside
  // it. `groupPaintHigh` is what makes the report fire again when a frame
  // reaches MORE groups than any before it — which is what an arrow in flight
  // does, six `bullet_trail` groups at a time.
  resetGroupPaint();
  resetFigureGroupPaint();
  const rect = canvas.parentElement.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));

  // ► **THE CAMERA IS STEPPED ONCE A FRAME, BEFORE THE VIEW IS BUILT.** It is
  //   a tween — the zoom eases by a fifth and the pan by a sixteenth — so
  //   stepping it twice would run it at double speed, and stepping it after
  //   `viewport()` would draw a frame behind the positions it was computed
  //   from. Both are the class of defect this file keeps producing.
  stepCamera();

  const view = viewport();
  context.clearRect(0, 0, canvas.width, canvas.height);

  // The BUILD'S OWN arena when the player has extracted it, this repository's
  // own bowl when they have not — the same fallback the figures and the sound
  // already have, and a clone with no assets is unchanged.
  const fit = stageFitFor({ width: canvas.width, height: canvas.height });

  // ► **EVERYTHING THIS FRAME DRAWS IS CLIPPED TO THE STAGE, AND THAT IS THE
  //   GREEN BAND.** `stageFitFor` letterboxes the 640x420 stage into the
  //   canvas and every painter below then drew straight through the bars it
  //   creates — the sky reaches stage y -164.8 at `sky=60` and the crowd
  //   leaves the stage on every frame. `stageClipRectFor` and the measurement
  //   that settled it are in `src/render/arena-backdrop.js`; the short version
  //   is that a real player rasterises out-of-stage content and MASKS it, and
  //   this renderer was doing the first half only.
  //
  //   It wraps the WHOLE frame rather than the scenery alone, because a
  //   gladiator walking off the edge, an arrow leaving the arena and the
  //   border's own overhang are all the same question, and clipping three of
  //   the four would be a harder thing to reason about than clipping none.
  //   `restore` is in a `finally` for the reason `context` is reassigned in
  //   one: a throw mid-frame must not leave the next frame clipped to a stale
  //   rectangle.
  //   ► **AND IT HAS A KILL SWITCH, `?clip=0`**, for the same reason
  //     `?filters=0` and `?groups=0` do: this repository's rule is that the
  //     difference between two shots is the measurement, and a change with no
  //     off switch cannot be measured, only asserted. With `clip=0` the page
  //     draws exactly what it drew before this landed — green band included.
  const stageRect = stageClipRectFor(fit);

  // ► **THE PAGE REPORTS ITS OWN RECTANGLE, AS A VALUE RATHER THAN A LOG LINE.**
  //   Every "inside the stage" number this project has published was computed
  //   from a canvas rectangle the READER derived off the page layout — the
  //   2026-09-15 residual was reported over a stage of 176,211 pixels that is
  //   really 186,667, and a first attempt at the same check reported a false
  //   FAILURE for exactly that reason. This is the page's own answer.
  //
  //   ► **AND IT IS DELIBERATELY NOT `log()`.** The previous attempt at this
  //     logged into the surface panel, its lines were never seen, and the
  //     session concluded that logging from inside `render` does not work and
  //     wrote a warning telling the next reader not to try. That was wrong —
  //     `reportGroupPaint`, `reportFigureGroups` and `reportedLoadout` all log
  //     from inside this very call and their lines are in the panel — the panel
  //     just sits BELOW THE FOLD at every window size the clip work was shot at.
  //     A value on `window` is immune to both problems: read it with one
  //     `Runtime.evaluate`, exactly as `tools/shot-live.mjs` already reads
  //     `window.__frames`.
  //
  //   Set every frame rather than once, because the canvas is resized at the top
  //   of every frame and a report taken at load describes the 300x150 default.
  window.__stageFit = stageFitReportFor({
    canvas: { width: canvas.width, height: canvas.height },
    cssRect: { width: rect.width, height: rect.height }
  });

  context.save();
  if (STAGE_CLIP) {
    context.beginPath();
    context.rect(stageRect.x, stageRect.y, stageRect.width, stageRect.height);
    context.clip();
  }
  try {
    renderStage(view, fit, now);
  } finally {
    context.restore();
  }
}

/**
 * THE LOADING FRAME: the page's own ground, "Loading your arena…" and a count
 * of the packs settled, drawn in the PAGE's font — never the game's, because
 * the text pack may be one of the packs still coming. What it says and how
 * full the bar is are `loadingFrameFor`'s; the one thing that moves, the bar's
 * empty track, holds still under `prefers-reduced-motion`. No spinner.
 */
const reducedMotionQuery = typeof window.matchMedia === "function"
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : null;
let pageLookCache = null;

/** The page's own colours and font, read once from `index.html`'s tokens. */
function pageLook() {
  if (pageLookCache) return pageLookCache;
  const look = {
    ground: "#17151a", ink: "#e8e4dc", inkDim: "#9a9287", accent: "#d8a13a",
    font: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif"
  };
  try {
    const root = getComputedStyle(document.documentElement);
    const token = (name, otherwise) => root.getPropertyValue(name).trim() || otherwise;
    look.ground = token("--ground", look.ground);
    look.ink = token("--ink", look.ink);
    look.inkDim = token("--ink-dim", look.inkDim);
    look.accent = token("--warn", look.accent);
    look.font = getComputedStyle(document.body).fontFamily || look.font;
  } catch {
    // No computed style (a headless run): the tokens' own values above.
  }
  pageLookCache = look;
  return look;
}

function paintLoadingFrame(now) {
  sizeCanvasToStage();
  context = surface;
  const width = canvas.width;
  const height = canvas.height;
  const ratio = window.devicePixelRatio || 1;
  const look = pageLook();
  const shown = loadingFrameFor(assetGate.progress(), {
    elapsedMs: now - assetGate.startedAtMs,
    reducedMotion: Boolean(reducedMotionQuery?.matches)
  });
  context.save();
  try {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.fillStyle = look.ground;
    context.fillRect(0, 0, width, height);
    const titleSize = Math.round(18 * ratio);
    const countSize = Math.round(13 * ratio);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = look.ink;
    context.font = `600 ${titleSize}px ${look.font}`;
    context.fillText(shown.title, width / 2, height / 2 - titleSize);
    context.fillStyle = look.inkDim;
    context.font = `${countSize}px ${look.font}`;
    context.fillText(shown.count, width / 2, height / 2 + countSize * 0.5);
    const barWidth = Math.min(width * 0.5, 240 * ratio);
    const barHeight = Math.max(2, Math.round(3 * ratio));
    const barX = (width - barWidth) / 2;
    const barY = height / 2 + countSize * 1.8;
    context.globalAlpha = shown.trackAlpha;
    context.fillStyle = look.inkDim;
    context.fillRect(barX, barY, barWidth, barHeight);
    context.globalAlpha = 1;
    context.fillStyle = look.accent;
    context.fillRect(barX, barY, barWidth * shown.progress, barHeight);
  } finally {
    context.restore();
  }
}

/** Everything inside the stage rectangle — see `render` for why it is clipped. */
function renderStage(view, fit, now) {
  const screen = splitArenaScreen(arenaScreenLayersFor(propPack, stagePropOpsFor(fit), camera, arenaDressing));
  if (screen.behind.length > 0 || screen.inFront.length > 0) {
    for (const layer of screen.behind) paintArenaLayer(layer, fit);
  } else {
    drawArenaBowl(view);
  }

  const byId = combatantsById();
  // Which pop-ups each fighter is showing this frame, by the build's
  // replace-by-depth rule; drawn with him, below.
  const livePopups = livePopupsFor(popups, now);
  // THE RING's hit boxes and centre, re-made from what THIS frame draws.
  const drawnBoxes = [];
  ringAnchor = null;

  // ► **PAINT ORDER FOLLOWS THE DEPTH BEING DRAWN, NOT THE ONE BEING HELD
  //   (2026-09-12).** `scene.drawOrder` sorts on the actor's `y`, which the
  //   fold sets to the DESTINATION the instant a lane change resolves — so a
  //   figure sliding from the front lane to the back painted in its
  //   destination order for the whole slide, popping behind its opponent
  //   before it had visibly moved.
  //
  //   The scene's order stays the authoritative RESTING order and is not
  //   touched: this re-sorts by the same rule — ascending arena y is
  //   back-to-front — using the interpolated depth the shell is actually
  //   about to draw. A figure that is not mid-step sorts identically, so an
  //   ordinary bout is unaffected.
  const drawnYById = new Map();
  for (const combatantId of scene.drawOrder) {
    const actor = scene.actors[combatantId];
    if (!actor?.placed || !Number.isFinite(actor.y)) continue;
    // The same clock the draw loop below reads, for the same reason it
    // computes `at` once: two readings of one clock drift apart. An entry that
    // has not BEGUN is read at its NEGATIVE `at` — where the batch found the
    // figure — for the reason given at `placedAt` below.
    const queued = playing.get(combatantId);
    const placedAt = queued ? Math.min(1, (now - queued.startedAt) / queued.timeline.durationMs) : 0;
    drawnYById.set(combatantId, figureYAt({
      restingY: actor.y,
      timeline: queued?.timeline ?? null,
      depthMotion: queued?.depthMotion ?? null,
      at: placedAt
    }));
  }
  const paintOrder = [...scene.drawOrder].sort((left, right) => {
    const a = drawnYById.get(left);
    const b = drawnYById.get(right);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return 0;
    return a - b;
  });

  // ► **THE ARENA'S OWN EDGES, DRAWN BEFORE THE FIGHTERS.** Two `rockMC` at
  //   ±2160 — the build's own coordinates, in arena units, sixty units outside
  //   the walk clamp they mark the end of. They are scenery, so they paint
  //   under every body rather than over it, which is the opposite of the arrows
  //   and the blood.
  for (const piece of arenaSceneryFor(propPack)) {
    paintProp(piece.ops, view, {
      x: piece.x,
      y: piece.y,
      lift: 0,
      // Scenery is drawn at the arena's own scale, not a figure's: it IS the
      // ground rather than something standing on it.
      size: figureScaleFor({ yscale: 100, rank: rankOf(piece.y, 0), slotIndex: 0 }),
      rotation: 0
    });
  }

  for (const combatantId of paintOrder) {
    const actor = scene.actors[combatantId];
    if (!actor.placed) continue;
    const combatant = byId.get(combatantId);
    if (!combatant) continue;
    const placement = host.layout.placementFor(combatantId);
    const figure = figureSpecFor(combatant, { side: placement.side, appearance: appearanceById.get(combatantId) ?? null });

    // ► **A QUEUED ENTRY IS NOT POSED UNTIL IT BEGINS** — a fireball's or an
    //   arrow's victim before impact (`reactionDelaysFor`). Until then it stands
    //   as it was, EVEN when the resolver has already killed it: it dies at impact.
    const queued = playing.get(combatantId);
    const waiting = Boolean(queued) && queued.startedAt > now;
    const entry = waiting ? undefined : queued;
    // How far through its own schedule the running timeline is. Computed once:
    // the pose and the travelled x are two readings of the same clock, and
    // computing it twice is how they drift apart.
    const at = entry ? Math.min(1, (now - entry.startedAt) / entry.timeline.durationMs) : 0;
    // ► **WHERE THE FIGURE STANDS reads the queued entry EVEN BEFORE IT BEGINS**
    //   (2026-09-23), at its negative `at`: not begun means where the batch
    //   found the figure — a move's `from`, a lane change's `fromY`. Reading no
    //   entry at all drew the scene's resting x and y, which the fold has
    //   already set to the DESTINATION, and that is not only a fireball's victim:
    //   `beginStep` stamps `performance.now()`, later than this frame's rAF
    //   `now` when a spectated step begins inside `frame(now)`, so a walk, a
    //   push or a lane change painted one frame at its destination and then
    //   jumped back to slide there (found by the `engine-vs-screen` F2 refuter;
    //   re-measured with a 4 ms skew over 8 default bouts: 451 one-frame x
    //   jumps and 46 y jumps before, 0 and 0 after). The POSE still waits.
    const placedAt = queued ? Math.min(1, (now - queued.startedAt) / queued.timeline.durationMs) : 0;
    // The timeline AND how far through it, kept together: the extracted rig
    // needs both to pick a clip and a pose, and re-deriving either at the draw
    // site is how the drawn figure and the drawn position drift apart.
    let pose;
    let drawnTimeline;
    let drawnAt;
    if (entry) {
      drawnTimeline = entry.timeline;
      drawnAt = at;
      pose = poseAt(entry.timeline, at);
    } else if (waiting && !combatant.alive) {
      drawnTimeline = timelineFor("Standing", { role: "actor" });
      drawnAt = 0;
      pose = poseAt(drawnTimeline, 0);
    } else if (!combatant.alive) {
      drawnTimeline = timelineFor("slain", { role: "defeated" });
      drawnAt = 1;
      pose = poseAt(drawnTimeline, 1);
    } else {
      // ► **THE IDLE IS NOT ALWAYS `Standing`, and this used to assume it was.**
      //   A gladiator holding a psych-up charge stands in the charged pose —
      //   `changeCombatants` overrides its own `Standing` reset with
      //   `gotoAndStop("psyche_charging")` at counter 2 and `psyche_charging2`
      //   at 3. The branch and the clock both live in `src/render/stance.js`
      //   now, so the whole decision is somewhere the suite can call it; this
      //   site asks one question and draws the answer.
      const idle = idleFrameFor(combatant, {
        now,
        winnerTeamId: host.battle.result?.winnerTeamId ?? null,
        // ► **WHEN THE BOUT ENDED, so the winner's opening flourish plays ONCE.**
        //   Frame 1426 loops `celebrate1a`, not the run, so vanilla cycles only
        //   the 18-frame body. `idleFrameFor` needs a start to reproduce that
        //   and is deliberately stateless, so the SHELL holds the stamp — it is
        //   one clock reading, taken where the bout's end is already visible,
        //   and it is cleared when a new bout starts. Reported by the owner
        //   watching a bout end: "the guy keeps victory emoting".
        celebratingSince: celebrationStartedAt
      });
      drawnTimeline = idle.timeline;
      drawnAt = idle.at;
      pose = poseAt(drawnTimeline, drawnAt);
    }

    // The lunge and the step, resolved into one coordinate by
    // `src/render/timeline.js` — where the suite can reach the decision, the
    // way `animationCursor` is. This shell computes no arithmetic of its own.
    const drawnY = Number.isFinite(actor.y)
      ? figureYAt({
        restingY: actor.y,
        timeline: queued?.timeline ?? null,
        depthMotion: queued?.depthMotion ?? null,
        at: placedAt
      })
      : actor.y;
    // ► **THE FACING BEING DRAWN, not the one being held.** `actor.facing` is
    //   already the facing AFTER a turn — the fold is not a tween — and the
    //   build turns a gladiator at the phase advance, once the action is over.
    //   `figureFacingAt` holds the old one while the turning action's token is
    //   still pending. Read ONCE and used for the lunge, the mirror and the
    //   clip choice alike, so the three cannot disagree about which way a
    //   figure faces.
    const facing = figureFacingAt({ facing: actor.facing, turn: actor.turn ?? null, pendingTokens });
    const origin = {
      x: figureXAt({
        restingX: actor.x,
        facing,
        pose,
        timeline: queued?.timeline ?? null,
        motion: queued?.motion ?? null,
        at: placedAt
      }),
      // ► **THE INTERPOLATED DEPTH, not the destination.** `actor.y` is already
      //   where the lane change ENDS — the scene's fold is not a tween — so
      //   drawing it directly is what made a lane change a single-frame
      //   teleport. `figureYAt` is the mirror of `figureXAt` beside it.
      y: drawnY,
      facing,
      // And the SIZE follows that same interpolated depth rather than the
      // roster's `slotIndex`, which never changes during a bout. Without this
      // the figure keeps its front-lane size for the whole slide, so nothing
      // about the movement says "further away" — leaving a pure vertical
      // translation, which in this game is what a jump looks like.
      // ► **AND THE SIZE IT IS DRAWN AT THIS FRAME** (2026-09-24): a little
      //   fat kid's victim at 50 from his clip's first frame, a colossus
      //   growing tick by tick, an expiry once its action is over —
      //   `drawnYscaleOf`. The face, the blood and the pop-ups all scale off
      //   `origin.size`, so they follow.
      size: figureScaleFor({
        yscale: drawnYscaleOf(combatantId, now),
        rank: rankOf(drawnY, combatant.slotIndex),
        slotIndex: combatant.slotIndex
      })
    };
    // THE GOLD RING on the selected foe, on the sand under him: under his
    // shadow and his body, like the ground it is drawn on.
    if (ringShown() && combatantId === ringView.model.selectedId) paintTargetRing(view, origin);
    drawOps(paintShadow(figure, pose), view, origin);

    // ► **THE FALLBACK IS PER FAMILY, not per session.** This engine can express
    //   phases the build has no clip for — a lane change, for one — so a
    //   gladiator may draw from the extracted rig for a walk and from
    //   `figure.js` for something vanilla never had. An empty list from
    //   `paintExtractedFigure` is that answer, and it is not an error.
    // The options BOTH the body and the face answer to. Built once so the face
    // cannot drift onto a different animation than the body is drawing — which
    // is the same reason `at` is computed once above.
    const figureOptions = {
      family: drawnTimeline.family,
      label: drawnTimeline.label,
      facing,
      at: drawnAt,
      // ► **NO `height`, AND THAT IS THE FIX OF 2026-09-23.** ~~`height:
      //   figure.build.height`~~ handed the extracted rig — and through these
      //   same options its face — the AUTHORED figure's vitality multiplier
      //   (0.92-1.08, `figure.js`'s `buildFor`), on top of a clip already fitted
      //   to the authored 150-unit height: 64.7% of the build's size for this
      //   roster. The build draws the clip 1:1 and sizes it with `_yscale` =
      //   `physical_size` alone (root frame 221, `+0x061e`-`+0x06a1`), which is
      //   `origin.size` below. `figure.build` (bulk, stance) is the AUTHORED
      //   fallback's shape only; the fallback stands at the build's height too
      //   (`SS2_FIGURE_HEIGHT` in `painter.js`), so one geometry serves both.
      fade: pose.fade,
      // ► **CANVAS PIXELS PER ARENA UNIT — the same `k` `figureOriginMatrix`
      //   puts on the context, and the one factor the figure painter cannot
      //   work out for itself.** A group's blur radius is in the fighter clip's
      //   own pixels; `src/render/extracted-figure.js` knows clip-to-arena
      //   (`clipToArenaScale`, the build's 1:1 — ~~`pack.clipHeight` and
      //   `height`~~ until 2026-09-23) and this file knows arena-to-canvas
      //   (`view.scale`, which carries the camera's zoom and the device pixel
      //   ratio, times `origin.size`, which carries `physical_size` and the
      //   rank). Neither half is
      //   the whole factor. Without this the glow is drawn at the radius it
      //   would have on an unzoomed 640x420 stage, which on this canvas is
      //   between two and four times too narrow.
      //
      // ► ~~AND `figureRouteFor()` STILL SAYS `filtersScaled: false` ... nothing
      //   in this repository can observe a figure filter string yet.~~
      //   **CLOSED 2026-09-16 BY THE CHARGED STANCE.** A gladiator holding a
      //   charge rests in `psyche_charging`, which carries the cyan glow, so a
      //   figure group with a real filter string is now drawn on an ordinary
      //   idle frame. The radius was measured at three scales and is linear,
      //   `figureRouteFor()` says `filtersScaled: true`, and
      //   `test/render-stance.test.js` is the test that could not exist.
      scale: (origin.size ?? 1) * view.scale
    };
    const extracted = hasExtractedArt(figurePack)
      ? paintExtractedFigure(figurePack, {
        ...figureOptions,
        wardrobe,
        loadout: reportedLoadout(combatant),
        appearance: appearanceById.get(combatantId) ?? null
      })
      : [];
    // ► **`mergeFaceOps`, NEVER `concat`.** The eyes and the mouth are two
    //   attachments on the HEAD at depths 1 and 2, so concatenating paints them
    //   over the helmet. The merge puts them at their own depths inside the
    //   head, which is where the build puts them.
    const face = extracted.length > 0
      ? faceOpsFor(facePack, figurePack, { ...figureOptions, held: heldFace.get(combatantId) ?? null })
      : null;
    if (face) heldFace.set(combatantId, { eyes: face.eyes.expression, mouth: face.mouth.expression });
    drawOps(
      face ? mergeFaceOps(extracted, face.ops) : (extracted.length > 0 ? extracted : paintFigure(figure, pose)),
      view,
      origin
    );

    // ► **THE CLIP THROWS ITS OWN BLOOD, at the pose the build throws it.**
    //   Fired once per CALL per timeline — `entry.bloodFired` counts them
    //   (~~`firedEffects`, a set of poses~~ until 2026-09-24) — because a draw
    //   loop visits the same pose many times at 60fps and the build spawns on a
    //   frame, not on a redraw.
    //
    //   **Armour strikes SPARKS and flesh BLEEDS** (`bounceitem` `+0x018e`),
    //   and the projection already carries the `armourclass` that decides it.
    //
    // ► **THE PLAN IS THE DRAWN ANIMATION'S, from `figureOptions` itself**
    //   (2026-09-24): the object the body and the face were just painted with,
    //   so the run, the clip and the facing are the drawing's by construction.
    //   `dueBloodEffects` compares `poseIndexAt(poseCount, drawnAt)` — the
    //   painter's own arithmetic — so a spray starts on the frame the figure
    //   is showing. ~~`drawnAt * entry.effectPoses`, the UN-JOINED clip's
    //   count~~ until then; see `prepareEntry`.
    if (entry && !entry.bloodPlan) entry.bloodPlan = bloodPlanFor(clipEffects, figurePack, figureOptions);
    const bleeding = entry
      ? dueBloodEffects(entry.bloodPlan, { at: drawnAt, fired: entry.bloodFired })
      : { due: [], fired: 0 };
    if (entry) entry.bloodFired = bleeding.fired;
    for (const effect of bleeding.due) {
      const armour = combatant.resources?.armourclass?.value ?? 0;
      drops.push({
        startedAt: now,
        // Anchored where the figure IS this frame, not where it rests: a
        // gladiator hit mid-step bleeds from where it was struck.
        x: origin.x,
        y: origin.y,
        size: origin.size,
        // ► **THE DROPS ARE IN THE FIGHTER CLIP'S OWN SPACE, NOT THE ARENA'S**,
        //   because the build attaches them to the clip rather than to the
        //   arena. The clip's origin is the soles of the feet and its head is
        //   at -220, so a spawn band of -220..-70 is head-to-waist. This is the
        //   same factor every limb matrix already carries — one arena unit per
        //   clip pixel — times the fighter's own `size`, which is `_yscale` as
        //   the build scales the clip the drops are children of.
        //   ~~`clipToArenaScale(figurePack, figure.build.height)`~~ until
        //   2026-09-23: the authored vitality multiplier, see `figureOptions`.
        clipScale: (clipToArenaScale(figurePack) ?? 1) * origin.size,
        spray: spawnDrops({
          // ► **`entry.token`, NOT `step.actionBoundary` — FIXED 2026-09-23.** There
          //   is no `step` in this function (it is `beginStep`'s parameter), so
          //   this line threw a ReferenceError at the first effect pose of every
          //   hurt or death clip from f0a3780 (2026-09-13) on: no drop was ever
          //   spawned, and the frame's remaining draws were skipped. Found by a
          //   write-nothing inventory agent reading the code; the token is the
          //   same action boundary (`drain(wire, { actionBoundary })` stamps it
          //   on every command) and the one `drainFinishedAnimations` seeds the
          //   entry's sound with. `test/arena-render-stage-scope.test.js`.
          // ► **AND TOLD APART PER CALL (2026-09-24; `bloodSeedFor`)**: the
          //   build draws fresh numbers on every `bounceitem`, and one seed per
          //   entry made a `hurt8` run's three calls, and a kill's hurt and the
          //   death under the same token, one spray repeated.
          seed: bloodSeedFor(entry.token ?? scene.sequence, effect),
          armoured: armour > 0,
          frames: propFrameCount(propPack, armour > 0 ? "sparks" : "blood") || 1
        })
      });
    }

    // ► **AND ITS OWN SOUNDS, at the pose the build starts each one on**, by
    //   the same clock this figure was just posed with and the same `facing`
    //   it was drawn with. A waiting entry is `undefined` here, so a victim
    //   is heard at its impact and not before (2026-09-23; `soundEntry`).
    if (entry) soundEntry(entry, now, facing);

    // ► **HIS POP-UPS, RIGHT AFTER HIS BODY**, because the build attaches them
    //   to HIS clip (depths 25000/25001/25005): over his own limbs, under any
    //   fighter painted after him. Anchored where he is DRAWN this frame, at
    //   his own size — the same `clipScale` the blood uses — so a pop-up rides
    //   a knockback and shrinks with a rear rank.
    drawPopups(livePopups.get(combatantId), view, origin);

    // The name plate. It is the combatant's OWN name, never an item name.
    //
    // ► **IT USED TO BE DRAWN AT `actor.x`/`actor.y` WHILE THE BODY WAS DRAWN
    //   AT `origin` — so the name detached from its fighter for the whole of
    //   every travelling step.** Found by an audit, 2026-09-18, and measured
    //   over 188 travelling gaits in 8 seeded bouts: **mean 102 arena units
    //   apart, max 158**, plus 7 rank changes of a full 97 units of depth.
    //   `actor.x` is where the gladiator RESTS; `origin` is where he is being
    //   drawn this frame, and the two are the same only when nothing is moving.
    //   Both values were already in scope eleven lines apart.
    context.globalAlpha = combatant.alive ? 0.85 : 0.4;
    context.fillStyle = "#e8e4dc";
    context.font = `${Math.max(10, view.scale * 15)}px ui-sans-serif, system-ui, sans-serif`;
    context.textAlign = "center";
    context.fillText(combatant.name, view.toX(origin.x), view.toY(origin.y, -22));
    context.globalAlpha = 1;

    // Where he was drawn, for a click on him and — for the acting fighter —
    // for the ring: the build's overlay stands 180 above his feet.
    drawnBoxes.push({
      id: combatantId,
      ...fighterBoxFor({ footX: view.toX(origin.x), footY: view.toY(origin.y, 0), pxPerUnit: view.scale, size: origin.size ?? 1 })
    });
    if (combatantId === ringView?.actorId) {
      ringAnchor = { x: view.toX(origin.x), y: view.toY(origin.y, SS2_OVERLAY_PLACEMENT.aboveFeet) };
    }
  }
  fighterBoxes = drawnBoxes;

  drawProjectiles(view, now);
  // At the arrow's depth, 45000 on `arena.gladiators` (`+0x9225`): over every body.
  drawFireballs(view, now);
  // Above the figures: the build attaches the bolt with `getNextHighestDepth()`
  // on `arena.gladiators`, over both fighters.
  drawSpellEffects(view, now);
  // The boulders are attached to `arena.gladiators` too (`+0x870f`), over the
  // fighters, falling past them.
  drawBoulders(view, now);
  drawDrops(view, now);
  // THE RING, over every fighter and under the build's own bar and border
  // (drawn next): the overlay is `gladiators`' child at depth 40000, above the
  // bodies, and the bar and border are root layers above the whole arena. The
  // build's arrows (45000) would pass over it; the ring is drawn only once
  // nothing is in flight, so the order between them never shows.
  paintRing(fit);

  // ► **THE RAIN, THE UI BAR AND THE BORDER GO ON TOP, and the build's own
  //   depths are what say so.** They sit at root depths 80, 438 and 1193,
  //   above the arena's 59 — so an arrow crossing the ornamental frame passes
  //   BEHIND it. Painting every layer before every body is the version of this
  //   that looks right on a still and is wrong in motion.
  for (const layer of screen.inFront) {
    paintArenaLayer(layer, fit);
    if (layer.character !== 1531) continue;
    // ► **THE WORDS GO ON WITH THE BAR, NOT AFTER THE LOOP.** The bar is root
    //   depth 438 and the ornamental border is 1193, so the border paints OVER
    //   the bar in the build — and text drawn after the loop would sit on top
    //   of the frame. `splitArenaScreen` has already put both in the in-front
    //   half; all this does is keep their order.
    //
    // ► **AND IT REUSES `paintArenaLayer` RATHER THAN ADDING A SECOND PAINTER.**
    //   `fieldOpsFor` emits the same `{kind: "path", d, matrix, fill, ...}`
    //   shape `propOpsFor` does — `d` in pixels, `matrix[4]`/`[5]` in twips —
    //   so the loop that draws the plate draws the letters, at the same layer
    //   placement, with no new code at all.
    const words = uiBarOps();
    if (words && words.length > 0) paintArenaLayer({ placement: layer.placement, ops: words }, fit);
    // The hit box for the bar's sound button, in canvas pixels, derived from
    // the same placement and fit the bar was just drawn with.
    const plate = barText ? soundButtonPlate(propPack, barText.soundX) : null;
    soundButtonBox = plate ? {
      x0: fit.offsetX + fit.scale * (layer.placement.x + plate.x0),
      x1: fit.offsetX + fit.scale * (layer.placement.x + plate.x1),
      y0: fit.offsetY + fit.scale * (layer.placement.y + plate.y0),
      y1: fit.offsetY + fit.scale * (layer.placement.y + plate.y1)
    } : null;
  }

  // What the group compositor did with THIS frame, once. It is after the whole
  // frame rather than inside `paintGroupRuns` because the arena screen, the
  // scenery, the drops and the arrows all feed the same tally and a line
  // printed mid-frame would report a third of it.
  reportGroupPaint();
  reportFigureGroups();
}

/* ------------------------------------------------------------------ */
/* The ring on the stage (S2)                                          */
/* ------------------------------------------------------------------ */

/** Whether the ring is on the stage: a person's turn, and the arena ready for it. */
function ringShown() {
  return assetGateOpen && ringView !== null && ringView.ready && !host.battle.result;
}

/**
 * THE GOLD RING ON THE SELECTED FOE — authored (the owner's design canvas):
 * an ellipse on the sand around his feet, sized with him.
 */
function paintTargetRing(view, origin) {
  const x = view.toX(origin.x);
  const y = view.toY(origin.y, 0);
  const rx = 70 * (origin.size ?? 1) * view.scale;
  if (!(rx > 0)) return;
  context.save();
  try {
    context.globalAlpha = 0.95;
    context.strokeStyle = "#f2c14e";
    context.lineWidth = Math.max(2, rx * 0.07);
    context.beginPath();
    context.ellipse(x, y, rx, rx * 0.3, 0, 0, Math.PI * 2);
    context.stroke();
  } finally {
    context.restore();
  }
}

/**
 * THE EIGHT BUTTONS AROUND THE ACTING FIGHTER, in the AUTHORED fallback look
 * (`actionButtonFallbackOpsFor`: a round bronze button and a glyph; the
 * build's own art is slice S3), each with its key and a short label on the
 * ring's outer side. Only the slots the engine offers are drawn (S2).
 * `ringButtons` records where, for the click.
 */
function paintRing(fit) {
  ringButtons = [];
  if (!ringShown() || !ringAnchor) return;
  const buttons = ringButtonsAt(ringView.model, {
    centerX: ringAnchor.x,
    centerY: ringAnchor.y,
    unit: fit.scale * RING_STAGE_SCALE
  });
  ringButtons = buttons;
  const facing = ringView.model.stance?.facing ?? "right";
  for (const button of buttons) {
    const ops = actionButtonFallbackOpsFor(button.verb, { state: button.slot === ringHover ? "hover" : "normal", facing });
    context.save();
    try {
      context.translate(button.x, button.y);
      context.scale(button.scale, button.scale);
      for (const operation of ops) paintPropOperation(operation);
    } finally {
      context.restore();
    }
    const label = `${button.key} ${RING_VERB_LABELS[button.verb]?.short ?? button.verb}`;
    const gap = Math.max(3, button.r * 0.2);
    context.save();
    try {
      context.font = `600 ${Math.max(9, Math.round(button.r * 0.62))}px ui-sans-serif, system-ui, sans-serif`;
      context.textBaseline = "middle";
      context.textAlign = button.side === "left" ? "right" : "left";
      const x = button.side === "left" ? button.x - button.r - gap : button.x + button.r + gap;
      context.lineJoin = "round";
      context.lineWidth = Math.max(2, button.r * 0.16);
      context.strokeStyle = "rgba(0, 0, 0, 0.8)";
      context.strokeText(label, x, button.y);
      context.fillStyle = button.slot === ringHover ? "#fff6e4" : "#f3e6c8";
      context.fillText(label, x, button.y);
    } finally {
      context.restore();
    }
  }
}

/**
 * One fighter's live pop-ups, in depth order. The anchor, the frame, the ops
 * and the fallback are all `src/render/popups.js`'s; this places and paints.
 */
function drawPopups(list, view, origin) {
  if (!list || list.length === 0) return;
  // Arena units per fighter-clip pixel, his size and rank included — the
  // blood's factor, because both are children of his clip.
  const clipScale = (clipToArenaScale(figurePack) ?? 1) * (origin.size ?? 1);
  for (const { entry, frame } of list) {
    const anchor = popupAnchorFor(entry.popup, { origin, clipScale, maxscale: entry.maxscale });
    const ops = popupOpsFor(popupPack, textPack, entry.popup, frame, { scale: anchor.size * view.scale })
      ?? popupFallbackOpsFor(entry.popup, frame);
    paintPopup(ops, view, anchor);
  }
}

/**
 * A pop-up's ops, in the icon's own pixels, placed like a prop (no flip — the
 * build un-mirrors it in `check_flipping`). Paths go through the group
 * compositor so the number's glow is drawn; `text` ops are the fallback's
 * words and numbers, in this page's own font.
 */
function paintPopup(ops, view, anchor) {
  if (!ops || ops.length === 0) return;
  const paths = ops.filter((op) => op.kind === "path");
  const words = ops.filter((op) => op.kind === "text");
  const m = propOriginMatrix(view, anchor);
  context.save();
  context.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  try {
    if (paths.length > 0) {
      paintGroupRuns(paths, { translationDivisor: TWIPS_PER_PIXEL, filtersScaled: true }, paintLayerOperation);
    }
    for (const word of words) {
      context.globalAlpha = word.alpha ?? 1;
      context.font = `bold ${word.size}px ui-sans-serif, system-ui, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineJoin = "round";
      if (word.outline) {
        context.strokeStyle = word.outline;
        context.lineWidth = Math.max(1, word.size / 7);
        context.strokeText(word.text, word.x, word.y);
      }
      context.fillStyle = word.fill ?? "#ffffff";
      context.fillText(word.text, word.x, word.y);
    }
  } finally {
    context.restore();
  }
  context.globalAlpha = 1;
}

/**
 * The blood and the sparks, drawn last with the arrows and for the same reason:
 * the build attaches them at depth 45300, above every body in the arena.
 *
 * ~~Their offsets are ARENA UNITS already — a drop is attached to
 * `arena.gladiators`~~ — **corrected 2026-09-23: a drop is attached to the
 * FIGHTER CLIP** (`bounceitem` calls `attachMovie` on `register:1`, which it
 * compares against `_root.arena.gladiators.hero`), so its offsets are in the
 * clip's space and are converted by `spray.clipScale`: one arena unit per clip
 * pixel times the fighter's own `size`. See `clipToArenaScale`.
 */
function drawDrops(view, now) {
  for (const spray of drops) {
    const frame = (now - spray.startedAt) / PROJECTILE_FRAME_MS;
    for (const drop of spray.spray) {
      const at = dropAt(drop, frame);
      if (!at) continue;
      const ops = propOpsFor(propPack, { linkage: drop.prop, frame: drop.artFrame });
      // Clip space -> arena units, then screen y is DOWN in the build's own
      // numbers while arena lift is UP, so the drop's `y` is negated once,
      // here, at the point it is drawn — exactly as the figure's own limbs are
      // flipped once in `drawOps`.
      const lift = -at.y * spray.clipScale;
      const offsetX = at.x * spray.clipScale;
      if (!ops) {
        context.globalAlpha = 0.85;
        context.fillStyle = drop.prop === "sparks" ? "#ffd889" : "#7a1010";
        const radius = Math.max(1, view.scale * 2 * spray.size);
        context.beginPath();
        context.arc(view.toX(spray.x + offsetX), view.toY(spray.y, lift), radius, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
        continue;
      }
      paintProp(ops, view, {
        x: spray.x + offsetX, y: spray.y, lift, size: spray.clipScale, rotation: at.rotation
      });
    }
  }
  context.globalAlpha = 1;
}

/**
 * The arrows, drawn LAST and therefore over everything.
 *
 * **That is the build's own answer, not a convenience**: it attaches the bullet
 * to `arena.gladiators` at depth 45000 (`+0x6d81`), where the two fighters are
 * at 300 and 301, so an arrow passes in front of every body in the arena.
 *
 * ► **THE FLIGHT IS FITTED TO THE SHOOTER'S ANIMATION, AND THAT IS A STATED
 *   DIVERGENCE.** The build holds the whole phase open until the arrow lands —
 *   `bullet_in_air != true` is one of the conditions on the phase-completion
 *   guard (`+0x3829`) — so a long bombard genuinely takes a long turn there. A
 *   derived flight is `ceil(distance / Xvelocity)` frames, which at 30 fps is
 *   about two seconds for a bombard across the arena; this shell's actions are
 *   a fraction of that, and an arrow outliving its own action would still be in
 *   the air when the scene that owns it is replaced.
 *
 *   So the SHAPE is the build's and only the wall clock is ours: the arc, the
 *   pitch, the lane interpolation, and snipe-flat-against-bombard-arced all
 *   come from `src/render/projectile.js` and all survive. Closing the gap
 *   properly means holding the action open for the flight, which is the
 *   animation gate's business and not this shell's.
 */
/**
 * One extracted PROP, drawn at an arena point that has a HEIGHT.
 *
 * ► **A SEPARATE HELPER FROM `drawOps`, and the difference is the whole
 *   reason.** That one translates with `view.toY(origin.y, 0)` — no lift —
 *   because a gladiator stands on the sand and its vertical motion is inside
 *   the pose. A prop in flight is at a real height above the ground, and
 *   passing a lift to `drawOps` would have been silently ignored and drawn
 *   every arrow along the floor.
 *
 * ~~Otherwise identical to `drawOps`'s path branch: translate, scale by the view,
 * flip y (arena y is UP and canvas y is DOWN), then compose the placement's own
 * matrix.~~ **NOT the figure's path, and the y-flip that sentence described
 * was a defect — corrected 2026-09-23.** The figure's paths are pre-flipped
 * before they meet `drawOps`'s `-k` (`extracted-figure.js`); a prop's never
 * were, and SWF art is y-down like the canvas. So the flip turned every prop
 * upside down: the arena's rocks stood on their heads, the fireball's burst
 * went downwards, and every snipe flew tail first. Both matrices are now
 * `propOriginMatrix` and `propPlacementMatrix` in `src/render/props.js`, under
 * the suite (`test/render-prop-placement.test.js`).
 */
/**
 * ONE operation of a prop, into whatever `context` currently is.
 *
 * ► ~~**IT DOES NOT DIVIDE THE TRANSLATION BY TWIPS AND `paintLayerOperation`
 *   DOES.**~~ **IT DOES NOW — the difference was a defect, corrected
 *   2026-09-23.** The pack's translations are twips (`tools/extract-props.mjs`,
 *   `roundMatrix`: "A consumer must divide by 20"); every prop that reached
 *   this painter before the spell props happened to carry a zero one, so it
 *   hid until the lightning bolt was painted some 6,800 pixels below the
 *   canvas and the fireball's explosion a figure height over its victim.
 *   `runBoxOf` is told the same divisor, so the box and the draw still agree.
 */
function paintPropOperation(operation) {
  const m = propPlacementMatrix(operation.matrix);
  if (!m) return;
  context.save();
  context.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  const path = path2dFor(operation.d);
  if (operation.fill && operation.fill !== "none") {
    context.globalAlpha = operation.fillOpacity ?? 1;
    context.fillStyle = operation.fill;
    context.fill(path, operation.fillRule ?? "evenodd");
  }
  if (operation.stroke && operation.strokeWidth > 0) {
    context.globalAlpha = operation.strokeOpacity ?? 1;
    context.strokeStyle = operation.stroke;
    context.lineWidth = operation.strokeWidth;
    context.lineJoin = "round";
    context.stroke(path);
  }
  context.restore();
}

function paintProp(ops, view, { x, y, lift, size, rotation, filtersScaled = false, mirrored = false }) {
  context.save();
  context.globalAlpha = 1;
  // ► **ONE MATRIX, FROM THE SUITE: translate, rotate, scale — and NO y-flip.**
  //   `bullet._rotation` is degrees CLOCKWISE in screen space, which is what
  //   `rotationAt` returns in radians, so it is applied as it comes. ~~It was
  //   applied "BEFORE the y-flip below"~~ — and the flip is what sent every
  //   snipe tail first: the arrow's art points UP, and a mirrored up-arrow
  //   turned 90 degrees clockwise points LEFT. `mirrored` is a negative
  //   `_xscale` — the fireball facing left (`+0x92e0`). See `propOriginMatrix`.
  const origin = propOriginMatrix(view, { x, y, lift, size, rotation, mirrored });
  context.transform(origin[0], origin[1], origin[2], origin[3], origin[4], origin[5]);
  // ► **`filtersScaled: false`, AND THAT IS AN ADMISSION RATHER THAN A
  //   SETTING.** Every array that reaches here comes from `arrowOpsFor`,
  //   `arrowTrailOpsFor`, `arenaSceneryFor` or `drawDrops`, each of which calls
  //   `propOpsFor` INSIDE `props.js` with no scale — so any filter string on
  //   these groups would be at scale 1 while the draw is at `size * view.scale`,
  //   which carries the camera's zoom. On this build no group on that route
  //   carries a filter at all (`bullet_trail`'s has a blend mode and nothing
  //   else; `bullet`, `blood`, `sparks` and `rockMC` have no groups), so
  //   `groupPaint.filterAtStageScale` is 0 — and it is counted precisely so
  //   that a pack where it stops being 0 says so instead of drawing every blur
  //   at the wrong width.
  // ► **EXCEPT THE BOLT, which passes `filtersScaled: true` and means it**:
  //   `boltOpsFor` builds its glow at `size * view.scale`, the same `k` this
  //   function draws at. Every other caller keeps the default and the admission.
  // ► **`translationDivisor` IS 20, as `paintPropOperation` now divides** —
  //   ~~`1`~~ until 2026-09-23, which also put the bolt's group box thousands
  //   of pixels off the canvas, so the compositor skipped it as `offscreen`.
  paintGroupRuns(ops, { translationDivisor: TWIPS_PER_PIXEL, filtersScaled }, paintPropOperation);
  context.restore();
}

/** The painter's own scale and rank rules, handed to `spellEffectDrawAt`. */
function effectDrawDeps() {
  return { frontY: ARENA_FRONT_Y, rankStride, figureScaleFor, rankOfDepth };
}

/**
 * THE BOLT, drawn. Every decision — where, how big, how old, whether it is
 * still attached — is `spellEffectDrawAt`'s and `boltOpsFor`'s, under the
 * suite; this is canvas calls.
 */
function drawSpellEffects(view, now) {
  for (const entry of attached) {
    const drawn = spellEffectDrawAt(entry.record, now - entry.startedAt, effectDrawDeps(), {
      lifetimeMs: entry.lifetimeMs
    });
    if (drawn.done) continue;
    // ► **THE GLOW IS BUILT AT THE DRAW'S OWN SCALE**, the one arena prop that
    //   needs it: the bolt's child carries a glow, and a canvas filter is in
    //   device pixels. `paintProp` is told so, rather than admitting otherwise.
    const scale = drawn.size * view.scale;
    const ops = boltOpsFor(propPack, entry.record.frame, drawn.ageFrames, { scale });
    if (ops) {
      paintProp(ops, view, {
        x: drawn.x, y: drawn.y, lift: drawn.lift, size: drawn.size, rotation: drawn.rotation, filtersScaled: true
      });
      continue;
    }
    // The authored bolt for a machine with no extracted pack — a jagged stroke
    // from the bolt's origin down to the victim, flickering on the same clock.
    // It says it is authored by being plainly a line.
    const top = view.toY(drawn.y, drawn.lift);
    const bottom = view.toY(drawn.y, 0);
    const x = view.toX(drawn.x);
    const jag = Math.max(3, view.scale * 8 * drawn.size) * (drawn.ageFrames % 2 === 0 ? 1 : -1);
    context.save();
    context.globalAlpha = 0.9;
    context.strokeStyle = "#9fd8ff";
    context.lineWidth = Math.max(1.5, view.scale * 3 * drawn.size);
    context.beginPath();
    const steps = 5;
    for (let step = 0; step <= steps; step += 1) {
      const y = top + ((bottom - top) * step) / steps;
      const offset = step === 0 || step === steps ? 0 : (step % 2 === 0 ? jag : -jag);
      if (step === 0) context.moveTo(x + offset, y);
      else context.lineTo(x + offset, y);
    }
    context.stroke();
    context.restore();
  }
}

/**
 * THE FIREBALLS, drawn. Where, how big, which frame, how old and whether it is
 * gone are all `fireballDrawAt`'s, under the suite; this is canvas calls.
 *
 * ► **`fireball_combat` IS NOT IN A PACK EXTRACTED BEFORE 2026-09-22**, so
 *   `fireballOpsFor` answers null and the authored ball below is drawn — the
 *   same per-prop fallback the arrow has. It says it is authored by being
 *   plainly a disc and a ring.
 */
function drawFireballs(view, now) {
  for (const entry of fireballs) {
    const drawn = fireballDrawAt(entry.flight, now - entry.startedAt, {
      frontY: ARENA_FRONT_Y, rankStride, figureScaleFor, rankOfDepth
    });
    if (drawn.done) continue;
    const ops = fireballOpsFor(propPack, drawn.clipFrame, drawn.ageFrames);
    if (ops) {
      paintProp(ops, view, {
        x: drawn.x, y: drawn.y, lift: drawn.lift, size: drawn.size, rotation: drawn.rotation, mirrored: drawn.mirrored
      });
      context.globalAlpha = 1;
      continue;
    }
    const cx = view.toX(drawn.x);
    const cy = view.toY(drawn.y, drawn.lift);
    const unit = Math.max(2, view.scale * 10 * drawn.size);
    context.save();
    if (drawn.stage === "flight") {
      context.globalAlpha = 0.95;
      context.fillStyle = "#ff9a2e";
      context.beginPath();
      context.arc(cx, cy, unit, 0, Math.PI * 2);
      context.fill();
    } else {
      const fade = 1 - drawn.ageFrames / Math.max(1, entry.flight.explosionVisibleFrames);
      context.globalAlpha = Math.max(0, fade);
      context.strokeStyle = "#ffcf5a";
      context.lineWidth = Math.max(1.5, unit * 0.4);
      context.beginPath();
      context.arc(cx, cy, unit * (1 + drawn.ageFrames * 0.25), 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }
}

/**
 * MOLTEN DEATH'S BOULDERS, drawn — added 2026-09-23; a shower drew nothing
 * before. Where each rock is, how big, which clip frame and whether it is gone
 * are all `boulderDrawAt`'s, under the suite; this is canvas calls.
 *
 * ► **THE BUILD'S OWN ROCK WHEN THE PACK HOLDS `boulder_combat`**: frame 1
 *   while it falls, frame 4 from the landing at the landing's own age, and for
 *   as long as `boulderLandedFramesFor` says the build shows it — all
 *   decided in `src/render/`, none of it here.
 *
 * ► ~~A molten core, a heat streak, an impact ring and fading rubble~~ were
 *   drawn here until a Codex review (2026-09-23) pointed out that the build had
 *   shown none of them. **With no extracted rock, the fallback is a PLAIN
 *   AUTHORED ROCK** — one flat polygon, `boulderOutline` — drawn only while it
 *   falls, because the fall is the build's own numbers and the landing art is
 *   not in hand. It says it is authored by being a plain grey polygon.
 */
function drawBoulders(view, now) {
  for (const entry of boulders) {
    const drawn = boulderDrawAt(entry.record, now - entry.startedAt, effectDrawDeps(), {
      landedFrames: entry.landedFrames
    });
    if (drawn.done) continue;
    // The landing's own clock from the landing on; the fall's age before it.
    const age = drawn.stage === "landed" ? drawn.landedAgeFrames : drawn.ageFrames;
    const ops = boulderOpsFor(propPack, drawn.clipFrame, age, { scale: drawn.size * view.scale });
    if (ops) {
      paintProp(ops, view, {
        x: drawn.x, y: drawn.y, lift: drawn.lift, size: drawn.size, rotation: drawn.rotation, filtersScaled: true
      });
      context.globalAlpha = 1;
      continue;
    }
    // AUTHORED: a plain rock, and only in the air — see the header.
    if (drawn.stage !== "falling") continue;
    const k = drawn.size * view.scale;
    context.save();
    context.translate(view.toX(drawn.x), view.toY(drawn.y, drawn.lift));
    context.scale(k, k);
    context.globalAlpha = 1;
    context.fillStyle = "#6b625a";
    context.strokeStyle = "#2b2622";
    context.lineWidth = 2 / Math.max(k, 0.01);
    context.beginPath();
    boulderOutline(entry.record.boulder).forEach(([px, py], index) => {
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    });
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  }
  context.globalAlpha = 1;
}

function drawProjectiles(view, now) {
  for (const shot of inFlight) {
    // ► **THE ARROW'S OWN CLOCK, not the shooter's timeline.** It rode the
    //   shooter's animation until 2026-09-13, which meant it VANISHED the
    //   moment that animation ended — and for a bombard across the arena that
    //   is most of the flight, because `ranged` is 9 beats (1,080ms) against a
    //   58-frame shot at over 1,900. The build has the opposite arrangement:
    //   the PHASE waits for the arrow (`bullet_in_air` on the completion guard,
    //   `+0x3829`), so the arrow is never the thing that gets cut short.
    //
    //   `inFlight` is pruned by the same comparison in the action loop, so an
    //   arrow being drawn and an arrow holding the gate open are one fact.
    // ► **EVERY DECISION IS `projectileDrawAt`'s, under the suite.** Where the
    //   arrow is, how big it draws, what a null depth means and where each
    //   trail puff sits are all arithmetic, and this file cannot be tested —
    //   it has given up six live defects in three days and every one was found
    //   by screenshotting. What is left here is canvas calls.
    //
    //   The SIZE in particular is the owner's own lane question: the arrow
    //   rides `figureScaleFor` on its interpolated depth, so it shrinks and
    //   grows exactly as the gladiators it flies between do.
    const drawn = projectileDrawAt(
      shot.flight,
      (now - shot.startedAt) / shot.durationMs,
      { frontY: ARENA_FRONT_Y, rankStride, figureScaleFor, rankOfDepth }
    );
    const { size } = drawn;

    // ► **THE BUILD'S OWN TRAIL PUFF WHEN THE PLAYER HAS EXTRACTED IT, and an
    //   authored dot when they have not.** Same per-family fallback the figure
    //   already has: an empty answer from the pack is an answer, not an error.
    //
    // ► **THE SECOND ARGUMENT IS THE PUFF'S AGE, AND THIS LINE PASSED THE
    //   WEAPON UNTIL 2026-09-14 — 15 OF THE 20 BOWS DREW NO TRAIL AT ALL.**
    //   ~~`const trailOps = arrowTrailOpsFor(propPack, shot.artFrame);`~~, once
    //   outside the loop. `shot.artFrame` is `secondary_weapon - 60`, the
    //   ARROW's lookup into `bullet`'s fifty frames; `bullet_trail` has seven,
    //   and they are one puff's ALPHA FADE over time. Re-measured in node
    //   against this repository's own pack, through `arrowTrailOpsFor` itself:
    //   at ages 0..6 the four operations come back at fillOpacity
    //   **0.699, 0.582, 0.465, 0.352, 0.234, 0.117, 0**, so feeding it a weapon
    //   index put every bow from 66 up on the clamped last frame at alpha 0.
    //   It drew SOLID and looked fine for as long as this shell ignored the
    //   transform; `props.js` folding the transform onto `fillOpacity` is what
    //   turned an old wrong index into an invisible trail. See
    //   `arrowTrailOpsFor` for the bytes that settle which quantity it is.
    //
    // ► **INDEX 0 IS THE OLDEST PUFF, SO THE AGE COUNTS DOWN THE ARRAY**, and
    //   getting this backwards fades the trail towards the archer and looks
    //   deliberate. Checked twice rather than read once: `projectileTrail`
    //   (`src/render/projectile.js`) pushes `projectileAt(flight, at)` for
    //   `at = 3, 6, 9 …` ASCENDING and then keeps the LAST six, and measured on
    //   a 100-frame bombard at 70% of the flight the six puffs sit 128, 104,
    //   80, 56, 32 and 8 units behind the head — monotonically CLOSER as the
    //   index rises. The authored ramp below is brightest at the last index for
    //   the same reason, which is a third, independent agreement.
    //
    // ► **ONE AGE STEP PER PUFF IS A CHOICE AND NOT A MEASUREMENT. Say so
    //   here, because the seven alphas beside it are measured and the two read
    //   alike.** In the build a puff ages ONE frame per frame while
    //   `SS2_PROJECTILE.trailEveryFrames` attaches a new one every THREE, so at
    //   any instant the live puffs are 0, 3 and 6 frames old — alphas 0.699,
    //   0.352, 0 — a TWO-puff trail. Spending one age step per puff instead
    //   spreads the whole seven-step ramp across all six, which is a longer,
    //   smoother comet and is what this shell draws on purpose. The faithful
    //   version needs each puff's age IN FRAMES (`1 + floor(t - at)`), which
    //   `projectileTrail` knows and does not carry: its entries are
    //   `{x, y, lift, size}`. That is a change to `src/render/projectile.js`,
    //   not to this line.
    //
    // ► **AND THE CALL MOVED INSIDE THE LOOP, WHICH THE OLD ONE WAS HOISTED OUT
    //   OF.** Six lookups per arrow per frame instead of one: measured at
    //   1.4us each against this repository's own pack, so **0.009ms of a 16ms
    //   frame** for an arrow in flight. Hoisting it back is what forces one
    //   age on all six puffs, which is the shape the defect had.
    for (const [index, puff] of drawn.trail.entries()) {
      const puffOps = arrowTrailOpsFor(propPack, drawn.trail.length - 1 - index);
      if (puffOps) {
        // NOT `drawOps`: that helper translates with `toY(origin.y, 0)` and has
        // no lift, so every puff would have been drawn on the sand. A prop in
        // the air needs the lift the flight computed, which is what
        // `paintProp` below exists for.
        //
        // ► **AND NO `globalAlpha` IS SET FOR THIS BRANCH, WHICH IS THE OTHER
        //   HALF OF THE FIX.** The authored ramp used to be set for both
        //   branches and `paintProp` overwrote it immediately — `globalAlpha =
        //   1` on entry, then `operation.fillOpacity ?? 1` per operation — so
        //   an extracted puff never wore it. The fade rides `fillOpacity` now
        //   and `paintProp` already reads it.
        //
        // ► **AND THE PUFF WEARS THE ROTATION THE ARROW HAD WHEN IT WAS
        //   DROPPED.** ~~`rotation: 0`~~ was hardcoded here because
        //   `projectileDrawAt` did not carry one — it computed each puff's
        //   rotation and dropped it on the way out, one seam short of this
        //   call. The build attaches the puff "at the bullet's _x, _y AND
        //   _rotation" (`+0x71ee`), so a flat trail behind a pitching bombard
        //   was wrong and looked deliberate. `src/render/projectile.js` carries
        //   it now; this reads it rather than assuming it.
        paintProp(puffOps, view, {
          x: puff.x, y: puff.y, lift: puff.lift, size: puff.size, rotation: puff.rotation
        });
        continue;
      }
      // The authored dot, for a player with no extracted pack — the supported
      // way to run the arena without a licensed copy. Its ramp is authored, it
      // is applied where nothing overwrites it, and it is brightest at the
      // newest puff exactly as the build's is.
      context.globalAlpha = 0.10 + 0.05 * index;
      context.fillStyle = "#d8cdb4";
      const radius = Math.max(1, view.scale * 2.5 * puff.size);
      context.beginPath();
      context.arc(view.toX(puff.x), view.toY(puff.y, puff.lift), radius, 0, Math.PI * 2);
      context.fill();
    }

    // ► **THE BUILD'S OWN ARROW WHEN IT HAS BEEN EXTRACTED.** Character 47,
    //   frame `secondary_weapon - 60`, which the adapter derived from the
    //   weapon table and stamped on the command — this shell decides nothing
    //   about which arrow, only whether it has one.
    const arrowOps = arrowOpsFor(propPack, shot.artFrame);
    if (arrowOps) {
      paintProp(arrowOps, view, {
        x: drawn.x, y: drawn.y, lift: drawn.lift, size: drawn.size, rotation: drawn.rotation
      });
      context.globalAlpha = 1;
      continue;
    }

    // The authored shaft, drawn along its own pitch — the same fallback
    // `figure.js` is to the extracted rig, and it says so rather than
    // pretending otherwise.
    context.save();
    context.globalAlpha = 1;
    context.translate(view.toX(drawn.x), view.toY(drawn.y, drawn.lift));
    // ► ~~Canvas y is DOWN and the pitch is up-positive, so the rotation is
    //   negated exactly as `drawOps` flips the figure's own y.~~ **WRONG SINCE
    //   `rotationAt` BECAME THE BUILD'S OWN `_rotation` — corrected
    //   2026-09-23.** The rotation is clockwise-positive on screen and is
    //   applied to art that points UP (the build's arrow is vertical; ±90 is
    //   what lays it flat). This shaft is drawn pointing along +x, so it is
    //   turned a quarter less: a right-facing snipe (`_rotation` 90) points
    //   right, and a bombard leaves pointing up and tumbles clockwise. Negated,
    //   the snipe pointed straight up and the bombard tumbled backwards.
    context.rotate(drawn.rotation - Math.PI / 2);
    const length = Math.max(6, view.scale * 26 * size);
    context.strokeStyle = "#e8e0cc";
    context.lineWidth = Math.max(1, view.scale * 1.6 * size);
    context.beginPath();
    context.moveTo(-length / 2, 0);
    context.lineTo(length / 2, 0);
    context.stroke();
    // The head, so the direction of travel reads at a glance.
    context.fillStyle = "#cfc3a4";
    context.beginPath();
    context.moveTo(length / 2, 0);
    context.lineTo(length / 2 - length * 0.22, -length * 0.10);
    context.lineTo(length / 2 - length * 0.22, length * 0.10);
    context.closePath();
    context.fill();
    context.restore();
    context.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------------ */
/* Side panel                                                          */
/* ------------------------------------------------------------------ */

/**
 * The roster list's own order: by SIDE, then by slot. Stable, and nothing to do
 * with paint order.
 *
 * ► **THIS ITERATED `scene.drawOrder` UNTIL 2026-09-12, and that stopped being
 *   harmless the moment draw order became correct.** `withDrawOrder` used to
 *   sort by clip depth, which happened to group the two sides; it now sorts
 *   back-to-front by arena `y`, because that is what painting needs — and the
 *   side panel silently became a back-to-front list with the two teams
 *   interleaved (Tarn, Orso, Vasso, Nym, Cidra, Ruk). A player reads this list;
 *   it should not be ordered by who is painted first. Caught by SCREENSHOTTING
 *   the arena and noticing the panel had changed, which no test was watching.
 */
function rosterOrder() {
  return rosterOrderOf(scene.drawOrder, (id) => host.layout.placementFor(id));
}

function renderRoster() {
  const byId = combatantsById();
  const acting = host.battle.result ? null : host.currentCombatantId();
  el("roster").replaceChildren(
    ...rosterOrder().map((combatantId) => {
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
      // `you` / `AI` in a `?play=` bout only: with no parameter, and when
      // spectating, the row reads exactly as it did.
      const seatTag = seatTagFor(seats, combatantId);
      slot.textContent = `${placement.side} slot ${placement.slotIndex}${placement.vanillaNative ? "" : " · authored"}` +
        (seatTag ? ` · ${seatTag}` : "");
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

/** The `seatTurnKey` the controls on screen were drawn for; `aiTurnStep` redraws when it goes stale. */
let shownSeatKey = null;

function renderControls() {
  renderRoster();
  // THE RING is made again below on a person's turn only; every other branch
  // leaves none on the stage or in the strip.
  ringView = null;
  renderRingStrip();
  const container = el("actions");
  // ► **NO BUTTON BEFORE THE ASSET GATE OPENS.** A person's first action is
  //   held to the same line as the AI's (`frame`): nobody acts on a stage that
  //   is not drawn yet. `openArena` redraws this the moment it opens.
  if (!assetGateOpen) {
    el("turn-heading").textContent = "Loading your arena…";
    const note = document.createElement("div");
    note.className = "provenance";
    note.textContent = "The bout starts when your extracted art is in — at most " +
      `${ARENA_ASSET_TIMEOUT_MS / 1000} s, and at once when there is none.`;
    container.replaceChildren(note);
    return;
  }
  const ready = host.readyForNextAction();
  // WHOSE TURN, from the seats (`seatTurnFor`), and the panel for it
  // (`seatControlsFor`): what a person can press is decided there, under the
  // suite. The key is recorded FIRST, so every branch below counts as drawn.
  const turn = seatTurnFor(host.battle, seats, { ready: ready.ready });
  const panel = seatControlsFor(turn, turn && !turn.ai ? host.legalActions() : [], seats);
  shownSeatKey = panel.key;

  if (host.battle.result) {
    // "You won" / "You lost" when a person played one side against the AI;
    // "Settled" / "Decided", as before, when there is no single "you".
    el("turn-heading").textContent = resultHeadingFor(host.battle.result, seats, { settled });
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
  // "Your turn: Vasso", "Nym (AI) is thinking…", or — with no parameter — the
  // headings the arena always had.
  // In spectate mode the heading said "waiting for the arena" almost the whole
  // bout, because the spectator takes its turn the instant the gate opens — so
  // the only state a person ever SAW was the waiting one, which read as a
  // stall. It is not: it is the gate doing its job between two automatic turns.
  el("turn-heading").textContent = turn?.heading ?? "waiting for the arena";

  // An AI seat's turn offers no buttons (`seatControlsFor`): `aiTurnStep`
  // takes it once the gate opens, and a click must never take a person's turn
  // for them or the AI's for it.
  if (panel.note !== null) {
    const note = document.createElement("div");
    note.className = "provenance";
    note.textContent = panel.note;
    container.replaceChildren(note);
    return;
  }

  // ► **A PERSON'S TURN IS THE RING (slice S2).** Built from the panel's
  //   own offer — the engine's `legalActions`, read once above — and the
  //   engine's own menu for the selected foe; `ringModelFor` decides who is
  //   selected, the stance, the eight slots and the list off the ring. The
  //   raw list below is kept only for a rule set with no menu to ask, where
  //   the model has no stance.
  const ring = ringModelFor({
    actorId,
    combatants: [...byId.values()],
    legal: panel.buttons.map(({ action }) => action),
    previous: ringSelection.get(actorId) ?? null,
    menuFor: (targetId) => host.unavailableActions(actorId, targetId)
  });
  if (ring.menuError !== null) log(`the ring could not ask the engine (${ring.menuError}); the plain list is drawn`, { warn: true });
  if (ring.stance) {
    if (ring.selectedId !== null) ringSelection.set(actorId, ring.selectedId);
    ringView = { model: ring, actorId, ready: turn.ready, turnNumber: host.battle.turnNumber };
    renderRingStrip();
    const note = document.createElement("div");
    note.className = "provenance";
    note.textContent = `${byId.get(actorId)?.name ?? actorId}'s actions are on the ring around him and in the strip ` +
      "under the stage: click a button or press 1–8; click a foe or press Tab to change the target.";
    container.replaceChildren(note);
    return;
  }

  container.replaceChildren(
    ...panel.buttons.map(({ action, enabled }) => {
      const button = document.createElement("button");
      const target = action.targetId ? byId.get(action.targetId) : null;
      // `drink-potion` is one token for eight items, so without the id two
      // different potions would be two identical buttons.
      const item = Number.isInteger(action.itemId) ? ` #${action.itemId}` : "";
      button.textContent = target && action.targetId !== actorId
        ? `${action.type}${item} → ${target.name}`
        : `${action.type}${item}`;
      button.disabled = !enabled;
      button.addEventListener("click", () => {
        // A button drawn for one person's turn is never a way to take another
        // seat's — the AI's above all — whatever has happened since it was drawn.
        const current = seatTurnFor(host.battle, seats, { ready: host.readyForNextAction().ready });
        if (!current || current.ai || current.actorId !== actorId) {
          log(`not ${byId.get(actorId)?.name ?? actorId}'s turn any more — the controls were stale`, { warn: true });
          renderControls();
          return;
        }
        try {
          // Anything a refused submit left in the ledger is not this action's.
          strikeLedger.take();
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

/* ------------------------------------------------------------------ */
/* The ring: the strip, acting, selecting (S2)                         */
/* ------------------------------------------------------------------ */

/** What the strip says when no person's ring is up. */
function ringIdleNote() {
  if (host.battle.result) return "The bout is over.";
  if (seats.humans.length === 0) return "Spectating — the AI plays every fighter.";
  return "Your actions appear here on your turn.";
}

/** Says something in the strip's polite live region, for a screen reader. */
function announce(text) {
  const live = el("ring-live");
  if (live) live.textContent = text;
}

/**
 * ► **THE STRIP UNDER THE STAGE (the owner's decision 9): the ring's actions
 *   as REAL BUTTONS**, for the keyboard and for screen readers — the target
 *   (one button per foe, the selected one pressed), the ring's filled slots
 *   with their keys, and every action the engine offers that no slot shows.
 *   Rebuilt with the ring, so it can never disagree with the stage.
 */
function renderRingStrip() {
  const strip = el("ring-strip");
  if (!strip) return;
  // Only where a person plays: a spectated bout keeps the whole stage.
  strip.hidden = seats.humans.length === 0;
  const focused = document.activeElement;
  if (focused && focused.tagName === "BUTTON" && strip.contains(focused)) {
    ringFocusWanted = { row: focused.parentElement?.id ?? null, text: focused.textContent };
  }
  const targetRow = el("ring-target");
  const slotRow = el("ring-slots");
  const offRow = el("ring-off");
  const status = el("ring-status");
  const view = ringView;
  if (!view) {
    strip.dataset.state = "idle";
    targetRow.replaceChildren();
    slotRow.replaceChildren();
    offRow.replaceChildren();
    status.textContent = ringIdleNote();
    return;
  }
  const { model } = view;
  const nameOf = (id) => host.combatant(id)?.name ?? id;
  const heading = (text) => {
    const node = document.createElement("b");
    node.textContent = text;
    return node;
  };
  const actionButton = (action, { verb = null, key = null } = {}) => {
    const button = document.createElement("button");
    button.type = "button";
    if (key) {
      const hint = document.createElement("kbd");
      hint.textContent = key;
      button.append(hint, document.createTextNode(" "));
      button.setAttribute("aria-keyshortcuts", key);
    }
    button.append(document.createTextNode(ringActionLabel(action, { verb, nameOf })));
    // Greyed only while the arena is still drawing the last action.
    button.disabled = !view.ready;
    button.addEventListener("click", () => actFromRing(action));
    return button;
  };
  strip.dataset.state = view.ready ? "ready" : "waiting";
  targetRow.replaceChildren(heading("Target"), ...model.foeIds.map((foeId) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = nameOf(foeId);
    button.setAttribute("aria-pressed", String(foeId === model.selectedId));
    button.addEventListener("click", () => selectRingFoe(foeId));
    return button;
  }));
  const filled = model.slots.filter((slot) => slot.action);
  slotRow.replaceChildren(heading("Ring"), ...filled.map((slot) => actionButton(slot.action, { verb: slot.verb, key: slot.key })));
  offRow.replaceChildren(...(model.offRing.length > 0
    ? [heading("Also"), ...model.offRing.map((entry) => actionButton(entry.action))]
    : []));
  const range = model.stance ? `${model.stance.range} range` : "";
  status.textContent = `${nameOf(view.actorId)} against ${nameOf(model.selectedId)}${range ? `, ${range}` : ""}` +
    (view.ready ? "." : " — wait for the arena.") +
    " Keys: 1–8 the ring, Tab / Shift+Tab the target (from the stage), Esc into this list.";
  if (ringFocusWanted && view.ready) {
    const enabled = (row) => [...(el(row)?.querySelectorAll("button:not(:disabled)") ?? [])];
    const wanted = ringFocusWanted;
    const next = enabled(wanted.row).find((button) => button.textContent === wanted.text)
      ?? enabled("ring-slots")[0] ?? enabled("ring-target")[0] ?? enabled("ring-off")[0];
    if (next) {
      next.focus();
      ringFocusWanted = null;
    }
  }
  const turnKey = `${view.actorId}|${view.turnNumber}`;
  if (view.ready && ringAnnounced !== turnKey) {
    ringAnnounced = turnKey;
    announce(`Your turn: ${nameOf(view.actorId)}. Target ${nameOf(model.selectedId)}${range ? `, ${range}` : ""}. ` +
      `${filled.length} on the ring${model.offRing.length > 0 ? `, ${model.offRing.length} more listed` : ""}.`);
  }
}

/**
 * THE ONE ROUTE FROM THE RING TO THE ENGINE — a click on a button, a key, or
 * a strip button. Whose turn it is is asked AGAIN here, of the engine's seats,
 * so a ring drawn for one turn can never take another, and nothing is sent
 * while the arena is still drawing the last action.
 */
function actFromRing(action) {
  const view = ringView;
  if (!view || !action) return;
  const nameOf = (id) => host.combatant(id)?.name ?? id;
  const current = seatTurnFor(host.battle, seats, { ready: host.readyForNextAction().ready });
  if (!current || current.ai || current.actorId !== view.actorId || action.actorId !== view.actorId) {
    log(`not ${nameOf(view.actorId)}'s turn any more — the ring was stale`, { warn: true });
    renderControls();
    return;
  }
  if (!current.ready) return;
  try {
    // Anything a refused submit left in the ledger is not this action's.
    strikeLedger.take();
    const step = host.submit(action);
    log(`${nameOf(view.actorId)}: ${action.type}${action.targetId !== view.actorId ? ` → ${nameOf(action.targetId)}` : ""}`);
    beginStep(step);
    renderControls();
  } catch (error) {
    log(error.message, { warn: true });
  }
}

/** Selects a foe for the person's turn on screen — a click on him, Tab, or the strip — and redraws the ring. */
function selectRingFoe(foeId) {
  const view = ringView;
  if (!view || !view.model.foeIds.includes(foeId) || foeId === view.model.selectedId) return;
  ringSelection.set(view.actorId, foeId);
  renderControls();
  const now = ringView;
  if (now?.model.selectedId === foeId) {
    announce(`Target ${host.combatant(foeId)?.name ?? foeId}${now.model.stance ? `, ${now.model.stance.range} range` : ""}.`);
  }
}

/** A pointer event's position in canvas (device) pixels, or null before layout. */
function canvasPointOf(event) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height)
  };
}

/**
 * ONE CLICK ACTS (the owner's Q2): on a drawn button it sends that slot's
 * action; on a foe it selects him. The bar's sound toggle keeps its own click.
 */
canvas.addEventListener("click", (event) => {
  if (!ringView) return;
  const point = canvasPointOf(event);
  if (!point) return;
  const box = soundButtonBox;
  if (box && point.x >= box.x0 && point.x <= box.x1 && point.y >= box.y0 && point.y <= box.y1) return;
  const slot = ringShown() ? ringSlotAt(ringButtons, point.x, point.y) : null;
  if (slot) {
    actFromRing(ringActionFor(ringView.model, slot));
    return;
  }
  const foeId = foeAt(fighterBoxes, point.x, point.y, ringView.model.foeIds);
  if (foeId) selectRingFoe(foeId);
});

canvas.addEventListener("pointermove", (event) => {
  const point = ringView ? canvasPointOf(event) : null;
  const slot = point && ringShown() ? ringSlotAt(ringButtons, point.x, point.y) : null;
  const foeId = point && !slot ? foeAt(fighterBoxes, point.x, point.y, ringView.model.foeIds) : null;
  ringHover = slot;
  canvas.style.cursor = slot || foeId ? "pointer" : "";
});

canvas.addEventListener("pointerleave", () => {
  ringHover = null;
  canvas.style.cursor = "";
});

for (const type of ["focusin", "pointerdown"]) {
  document.addEventListener(type, (event) => {
    if (!el("ring-strip")?.contains(event.target)) ringFocusWanted = null;
  }, { capture: true });
}

/** The ring's keys — `ringKeyCommand` decides; this only reads the event and does it. */
window.addEventListener("keydown", (event) => {
  if (!ringView) return;
  const command = ringKeyCommand(ringView.model, {
    key: event.key,
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
    repeat: event.repeat,
    focus: ringFocusKind(document.activeElement, { stage: canvas })
  });
  if (!command) return;
  event.preventDefault();
  if (command.kind === "act") actFromRing(command.action);
  else if (command.kind === "select") selectRingFoe(command.foeId);
  else if (command.kind === "focus-strip") el("ring-strip").querySelector("button:not(:disabled)")?.focus();
});

function renderProvenance() {
  const rules = host.battle.rulesDescriptor ?? ss2TeamRules;
  el("tier").textContent = `${(rules.verification ?? "unknown").toUpperCase()} — NOT RUNTIME-VERIFIED`;
  el("seed").textContent = `seed ${seed} · ${matchLabel}${championsBySlot.size > 0 ? " champions" : ""} · the same seed and the same choices replay exactly`;
  el("provenance").innerHTML = "";
  // ► **THIS PANEL MUST DESCRIBE WHAT IS ACTUALLY ON SCREEN, and for one commit
  //   it did not.** It said the figures were authored vector art while the
  //   extracted rig was being drawn over the top of that sentence. A surface
  //   whose whole purpose is saying where its numbers came from cannot be wrong
  //   about where its ART came from — so the line is derived from `figurePack`
  //   rather than written once and left.
  const wardrobePieces = wardrobe
    ? Object.values(wardrobe.pieces ?? {}).reduce((total, slot) => total + Object.keys(slot).length, 0)
    : 0;
  // Before the asset gate opens NO figure is drawn, of either kind, and the
  // line says so rather than naming the authored art the loading frame is not.
  const figureLine = ["The figures", assetGateOpen
    ? figureProvenance({ hasExtractedArt: hasExtractedArt(figurePack), wardrobePieces })
    : "are not drawn yet: the stage waits for your extracted packs to settle."];
  const lines = [
    ["The arithmetic", "runs the same SS2 rule set the test suite runs (a fresh instance whose only addition is the " +
      "pop-ups' diagnostic observer) — map-derived from a licensed build, never observed in it."],
    figureLine,
    ["The animation timing", "is authored. No capture has ever recorded a clip label or a frame duration."],
    ["The fight pop-ups", "are the build's own damage, spell and BLOCK callouts, drawn from your install's icons when " +
      "extracted and as a plain number when not. A hit shows the build's GROSS roll, before armour — read off the " +
      "rule set's unhashed observer, because the event log does not carry it."],
    ["Slot 0 of each side", "reuses the battle map's own instance names, depths and positions. Everything past it is authored mod surface no capture can settle."]
  ];
  if (championsBySlot.size > 0) {
    const slots = [...championsBySlot].map(([id, whichBoss]) => `${id} = ${whichBoss}`).join(", ");
    lines.unshift(["The champions",
      `are the BUILD'S OWN tournament bosses, by unleash_hell which_boss (${slots}): each one's DNA, read from ` +
      "your own install into the gitignored `assets/champions/` and decoded by initcharacter's index map, then " +
      "priced by the same battlevalues the tests run. None ships in this repository. A DNA secondary slot of 0 " +
      "is read as no secondary weapon, as the build's swap button and villain AI read it; a bow drawn in the DNA " +
      "is a proper archer (owner, 2026-09-23)."]);
  }
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
    "Reload with ?teams=1|2|3&seed=N to change the bout, ?play=red to play red against the AI " +
    "(or ?play=red-1,red-2 for single fighters — the AI plays every seat you do not name), ?spectate=1 to watch " +
    "the AI play itself, or ?red=2,4,16&blue=1,3,10&spectate=1 to watch the build's own champions " +
    "(after `node tools/extract-champions.mjs`; add &play=red instead of &spectate=1 to fight them).";
}

/* ------------------------------------------------------------------ */
/* Clock                                                               */
/* ------------------------------------------------------------------ */

/**
 * On an AI SEAT'S turn, take it the moment the arena is ready for it.
 *
 * ► **WAS `spectateStep` UNTIL THE SEATS (2026-09-24), and played every seat or
 *   none.** It now plays exactly the seats the battle's own registry calls AI
 *   (`seatTurnFor` asks `isAiControlled`): all of them under `?spectate=1`,
 *   the ones a person did not name under `?play=`, none with no parameter. It
 *   is still the spectator's path — one action, through the gate a person goes
 *   through, only once the last action has been drawn (`autoplay` is false
 *   while the gate is shut) — so an AI move never lands mid-animation.
 *
 * ► **AND IT REDRAWS STALE CONTROLS FIRST (Codex review, 2026-09-24).** A seat
 *   handed over mid-bout with the gate open changes whose turn it is with no
 *   action and no animation to redraw anything; it returned early here and the
 *   AI's note stayed up over a person's turn for good. `seatFrameFor` compares
 *   what was drawn with what is true, every frame.
 */
function aiTurnStep() {
  const frame = seatFrameFor(host.battle, seats, { ready: host.readyForNextAction().ready, shownKey: shownSeatKey });
  if (frame.refresh) renderControls();
  if (!frame.autoplay) return;
  const actorId = frame.turn.actorId;
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
    strikeLedger.take();
    const step = host.submit({ ...action, actorId });
    log(`${host.combatant(actorId)?.name ?? actorId}: ${action.type}`);
    beginStep(step);
    renderControls();
  } catch (error) {
    log(error.message, { warn: true });
  }
}

/**
 * ► **THE NEXT FRAME IS SCHEDULED IN A `finally`, and that is not defensive
 *   programming — it is a scar.** `render(now)` used to be called before
 *   `requestAnimationFrame(frame)` with nothing between them, so ANY throw
 *   inside it stopped the arena permanently. That has already happened once on
 *   this project: `src/render/cursor.js` exists because "the first spectated
 *   bout froze after one action inside a `requestAnimationFrame` callback the
 *   suite could not reach", and a malformed extracted pack was about to do it
 *   again from a new direction.
 *
 *   **The suite cannot reach this file**, so the loop must survive the one
 *   thing a test would otherwise have to catch. The error is logged once —
 *   a per-frame log would bury the arena in its own noise.
 */
let loopErrorLogged = false;

/**
 * THE PACKS THE GATE OPENED WITH, handed to what turns each into the thing the
 * painters read — in DEPENDENCY order: the rig is built with the enchantments
 * and logs the wardrobe, so both go first.
 *
 * Only a pack that ANSWERED is applied: loaded, or `null` for a 404, whose
 * user draws the fallback and says how to extract it. A FAILED or LATE pack is
 * skipped whole — its variable keeps the fallback it started with — because
 * "run the extractor" is the wrong advice for either, and `assetGateReport`
 * names both with the reason. One pack's throw costs that pack, never the rest.
 */
const PACK_USERS = Object.freeze([
  ["wardrobe", (data) => { wardrobe = data; }],
  ["enchantments", (data) => { enchantments = data; }],
  ["figure", useFigurePack],
  ["props", usePropPack],
  ["clipEffects", useClipEffects],
  ["text", useTextPack],
  ["icons", useIconPack],
  ["bitmaps", useBitmaps]
]);

function useArenaPacks(opened) {
  for (const [name, use] of PACK_USERS) {
    const outcome = opened.outcomes[name];
    if (outcome !== PackOutcome.LOADED && outcome !== PackOutcome.MISSING) continue;
    try {
      use(opened.inUse[name]);
    } catch (error) {
      log(`${name}: unusable, its fallback is drawn (${String(error?.message ?? error).slice(0, 80)})`, { warn: true });
    }
  }
}

/**
 * Asks the gate, once a frame until it opens; on the frame it does, applies
 * every pack it opened with, says how it opened, starts the bout's clock and
 * draws the controls. Returns whether the arena is open.
 *
 * ► **`window.__assetGate` IS THE GATE AS A VALUE, NOT A LOG LINE**, for the
 *   reason `window.__stageFit` is one: a headless run or `tools/shot-live.mjs`
 *   reads it with one evaluate. Its data is left out — only which pack did what.
 */
function openArena(now) {
  const verdict = assetGate.status(now);
  window.__assetGate = Object.fromEntries(Object.entries(verdict).filter(([key]) => key !== "inUse"));
  if (!verdict.open) return false;
  assetGateOpen = true;
  useArenaPacks(verdict);
  for (const line of assetGateReport(verdict)) log(line.message, { warn: line.warn });
  boutStartedAt = now;
  renderProvenance();
  renderControls();
  return true;
}

function frame(now) {
  try {
    // ► **THE ASSET GATE, FIRST.** Until every visual pack has settled — or
    //   the timeout — the loading frame is all that draws, and nothing steps:
    //   no animation, no arena sound, no AI seat. The frame it opens on goes
    //   straight on to the bout, drawn with the packs it opened with.
    if (!assetGateOpen && !openArena(now)) {
      render(now);
      return;
    }
    drainFinishedAnimations(now);
    // After the drain, so a crowd whose action just finished is heard; before
    // an AI seat's turn, so the intro gets its one pre-fight draw.
    stepArenaSounds(now);
    aiTurnStep();
    settleIfReady();
    render(now);
  } catch (error) {
    if (!loopErrorLogged) {
      loopErrorLogged = true;
      log(`frame error, the arena keeps running: ${String(error?.message ?? error).slice(0, 160)}`);
    }
  } finally {
    requestAnimationFrame(frame);
  }
}

renderProvenance();
renderControls();
log(`arena built: ${scene.drawOrder.length} fighters, ${matchLabel}, seed ${seed}`);
log(seatSummaryFor(seats, (id) => host.combatant(id)?.name));
if (championsBySlot.size > 0) {
  log(`champions (which_boss): ${[...championsBySlot].map(([id, whichBoss]) => `${id} ${whichBoss}`).join(", ")}`);
}
if (ENCHANT_DEMO) {
  const fields = ENCHANT_DEMO.fields;
  log(`enchant: DEMO OVERRIDE ?enchant=${ENCHANT_DEMO.text} — every fighter's melee slot is forced to ` +
    `type ${fields.weapon_enchantment_type} potency ${fields.weapon_enchantment_potency}, ` +
    `bow slot type ${fields.secondary_weapon_enchantment_type} ` +
    `potency ${fields.secondary_weapon_enchantment_potency}. ` +
    "THE ENGINE PRODUCED NONE OF IT — a screenshot of this is not evidence about a battle.",
  { warn: true });
  // ► **IT COSTS ~4x A FRAME, AND `tools/shot.sh` COULD NOT SHOOT IT — BUT IT DOES
  //   NOT HANG, AND THE FIRST VERSION OF THIS COMMENT SAID IT DID.** Measured
  //   2026-09-15 over CDP, and **the flag that matters is `--disable-gpu`**:
  //   under software rasterisation the arena runs at 15.51 fps with the glow
  //   against 60.16 without (64.5ms against 16.6ms a frame), and with GPU
  //   rasterisation it runs at **6.1ms a frame either way for two fighters and
  //   11.8ms against 6.1ms for six** — about a millisecond a frame per
  //   enchanted fighter. A CPU profile puts 95.8% of samples in `(program)`,
  //   native rasterisation rather than script, which is why the flag decides it.
  //   **The 3.9x is a property of the measuring configuration, not of this
  //   feature.**
  //
  //   What stalls is `--virtual-time-budget`, which `tools/shot.sh` drove
  //   Chrome with and which does not advance while a filtered composite is
  //   outstanding. **A `FAILED` from a virtual-time shot is evidence about the
  //   screenshot mode, not about this page.** `tools/shot-live.sh` shoots it in
  //   real time and freezes at a frame number so two shots can be differenced.
  //
  //   **The glow is on screen and is the right colour for all four types** —
  //   Flame R +64.6, Frost B +45.4, Poison G +37.9, Wraith neutral, each
  //   dominant channel matching its own glow record, against a null control of
  //   zero differing pixels.
  //
  //   The buffer is only 244x141, so what costs anything at all is the two
  //   `drop-shadow` passes themselves — which GPU rasterisation absorbs.
  log("enchant: the glow costs about 1ms a frame per enchanted fighter with GPU rasterisation " +
    "(6.1ms/frame either way at 2 fighters, 11.8 against 6.1 at 6). Under --disable-gpu it is 4x, " +
    "which is the measuring configuration and not this feature. Use tools/shot-live.sh, which shoots " +
    "in real time, freezes at a frame number, and takes a freeze of 0 to wait for a static page to go quiet.",
  { warn: true });
  if (!ENCHANT_DEMO.complete) {
    log("enchant: no potency given, so it is 0 — outside 1..3 the build calls gotoAndStop zero times and " +
      "the weapon keeps its current frame. Nothing will glow. Use ?enchant=<type>.<potency>, e.g. ?enchant=3.2.",
    { warn: true });
  }
}
// ► **RUN AFTER THE ARENA IS WARM, NOT DURING MODULE INIT.** The canvas is
//   still at its default 300x150 until the first `render()` sizes it, and a
//   timing measurement taken against that is a measurement of a different
//   canvas. Two seconds is past the packs landing as well, so the log line
//   lands at the TOP of the panel where a screenshot catches it.
if (params.has("filterprobe")) setTimeout(probeCanvasFilter, 2000);
requestAnimationFrame(frame);
window.addEventListener("resize", () => render());
