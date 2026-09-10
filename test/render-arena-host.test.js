/**
 * The browser arena's PROTOCOL, driven headlessly.
 *
 * WHY THIS FILE EXISTS. `tools/arena/main.js` is a shell — a 2D context, DOM
 * nodes and `requestAnimationFrame` — and none of that runs under
 * `node --test`. What CAN run is the exact sequence of host calls the shell
 * makes, and that sequence is where the interesting failures live: an enforcing
 * animation gate, a timeout policy, and a settlement bridge that refuses a
 * surface disagreeing with resolved state.
 *
 * So this file makes the same calls in the same order, with a fake clock
 * instead of a real one. What it does NOT cover is the canvas `switch` and the
 * DOM wiring, and nothing here should be read as covering them.
 *
 * THE ASSERTIONS PROVE, THEY DO NOT STATE: each one asserts it FOUND the case
 * it is about — an enforcing refusal that never fired would be green and
 * worthless.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createVanillaBattleHost,
  SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";
import { ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import {
  ANIMATION_TIMEOUT_MS,
  abandonReasonFor,
  animationCursor,
  applyCommands,
  emptyScene,
  timelineFor
} from "../src/render/index.js";
import { demoSide } from "../tools/arena/roster.js";

function arenaHost(perSide = 2, seed = 7, options = {}) {
  return createVanillaBattleHost({
    teams: [demoSide("red", perSide, { ss2Combatant }), demoSide("blue", perSide, { ss2Combatant })],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed,
    awaitAnimations: true,
    ...options
  });
}

/** The shell's own dispatch: fold commands, start timelines, collect tokens. */
function beginStep(scene, step) {
  const started = new Map();
  for (const command of step.commands) {
    if (command.kind !== "clip-goto") continue;
    started.set(command.combatantId, {
      timeline: timelineFor(command.label, { role: command.role }),
      token: command.actionToken ?? null
    });
  }
  return { scene: applyCommands(scene, step.commands), started };
}

test("the demo roster builds a host that ss2TeamRules will actually fight", () => {
  const host = arenaHost(2, 7);
  assert.deepEqual(host.combatantIds(), ["red-1", "red-2", "blue-1", "blue-2"]);
  const construction = host.constructArena();
  assert.equal(construction.commands.length, 12, "four fighters: a clip, a shadow and a placement each");
  const scene = applyCommands(emptyScene(), construction.commands);
  assert.equal(scene.drawOrder.length, 4);

  // The roster declares the SS2 resource bag on purpose: the rule set refuses
  // to swing for a combatant that has not, rather than defaulting the numbers
  // and fighting a different gladiator.
  const combatant = host.combatant(host.currentCombatantId());
  assert.ok(Number.isFinite(combatant.resources.min_damage.value));
  assert.ok(Number.isFinite(combatant.resources.max_damage.value));
});

test("the gate genuinely BLOCKS: this is the first enforcing host in the repository", () => {
  const host = arenaHost(1, 7);
  host.constructArena();

  const first = host.submit({ ...host.legalActions()[0], actorId: host.currentCombatantId() });
  assert.ok(first.actionTokens.length > 0, "the action must have carried a token, or this proves nothing");

  const waiting = host.readyForNextAction();
  assert.equal(waiting.enforced, true, "awaitAnimations: true makes the gate enforcing, not advisory");
  assert.equal(waiting.ready, false);

  // The refusal is the point. A headless caller never meets it.
  assert.throws(
    () => host.submit({ ...host.legalActions()[0], actorId: host.currentCombatantId() }),
    (error) => /reportActionAnimation|animation/i.test(error.message),
    "submitting while a timeline is unreported must be refused"
  );

  for (const token of first.actionTokens) host.reportActionAnimation(token);
  assert.equal(host.readyForNextAction().ready, true);
  assert.doesNotThrow(() => host.submit({ ...host.legalActions()[0], actorId: host.currentCombatantId() }));
});

test("a surface that never reports abandons on its own stated policy, and says so", () => {
  const host = arenaHost(1, 7);
  host.constructArena();
  const step = host.submit({ ...host.legalActions()[0], actorId: host.currentCombatantId() });
  const { started } = beginStep(emptyScene(), step);

  const entry = [...started.values()].find((candidate) => candidate.token !== null);
  assert.ok(entry, "some clip-goto must have carried a token, or this proves nothing");

  // Inside the grace period the surface keeps waiting.
  assert.equal(abandonReasonFor(entry.timeline, entry.timeline.durationMs + ANIMATION_TIMEOUT_MS), null);
  assert.equal(host.readyForNextAction().ready, false, "still shut while it waits");

  const reason = abandonReasonFor(entry.timeline, entry.timeline.durationMs + ANIMATION_TIMEOUT_MS + 1);
  assert.ok(reason, "past the grace period the policy fires");
  host.abandonActionAnimation(entry.token, reason);

  const state = host.actionAnimationState();
  assert.equal(state.ready, true, "abandoning opens the gate");
  assert.equal(state.abandoned.length, 1);
  assert.equal(state.abandoned[0].reason, reason);
  assert.match(state.abandoned[0].reason, /gave up/, "the record says the HOST gave up, not that the animation finished");
  assert.deepEqual(state.reported, [], "and it is not recorded as reported: those are different facts");
});

test("a whole bout plays through the shell's own call order and settles", () => {
  const host = arenaHost(2, 7);
  let scene = applyCommands(emptyScene(), host.constructArena().commands);

  let actions = 0;
  let guard = 0;
  while (!host.battle.result && guard < 500) {
    guard += 1;
    const options = host.legalActions();
    if (options.length === 0) break;
    const step = host.submit({ ...options[0], actorId: host.currentCombatantId() });
    actions += 1;
    const begun = beginStep(scene, step);
    scene = begun.scene;
    // The clock runs out; every timeline finishes; the surface reports.
    for (const token of step.actionTokens) host.reportActionAnimation(token);
    assert.equal(host.readyForNextAction().ready, true, `action ${actions} left the gate shut`);
  }

  assert.ok(actions > 3, `the bout must have taken several actions: ${actions}`);
  assert.ok(host.battle.result, "and must have decided");
  assert.ok(scene.completionToken, "the surface holds the token it must hand back");

  const outcomes = host.acknowledgeResultAnimations({
    deaths: host.awaitingDeathAnimations(),
    arenaLabel: scene.arenaLabel,
    completionToken: scene.completionToken
  });
  assert.ok(outcomes.length > 0);
  assert.equal(
    outcomes.some((outcome) => outcome.kind === "arena-label" && outcome.label === scene.arenaLabel),
    true,
    "the label the surface reached is the one it reported"
  );
});

test("a surface reporting the WRONG arena label is refused, not settled", () => {
  const host = arenaHost(1, 7);
  let scene = applyCommands(emptyScene(), host.constructArena().commands);
  let guard = 0;
  while (!host.battle.result && guard < 500) {
    guard += 1;
    const options = host.legalActions();
    if (options.length === 0) break;
    const step = host.submit({ ...options[0], actorId: host.currentCombatantId() });
    scene = applyCommands(scene, step.commands);
    for (const token of step.actionTokens) host.reportActionAnimation(token);
  }
  assert.ok(host.battle.result, "the bout must have decided, or this proves nothing");

  const wrong = scene.arenaLabel === "combat_won" ? "combat_lost" : "combat_won";
  assert.throws(
    () => host.acknowledgeResultAnimations({
      deaths: host.awaitingDeathAnimations(),
      arenaLabel: wrong,
      completionToken: scene.completionToken
    }),
    "a surface that reached the other ending is a desync and must not settle the campaign"
  );

  // And the honest report still settles afterwards.
  assert.doesNotThrow(() => host.acknowledgeResultAnimations({
    deaths: host.awaitingDeathAnimations(),
    arenaLabel: scene.arenaLabel,
    completionToken: scene.completionToken
  }));
});

test("every clip label a real bout emits has a timeline, so nothing freezes mid-bout", () => {
  const seen = new Set();
  for (const [perSide, seed] of [[1, 3], [2, 7], [3, 11]]) {
    const host = arenaHost(perSide, seed);
    host.constructArena();
    let guard = 0;
    while (!host.battle.result && guard < 500) {
      guard += 1;
      const options = host.legalActions();
      if (options.length === 0) break;
      const step = host.submit({ ...options[0], actorId: host.currentCombatantId() });
      for (const command of step.commands) {
        if (command.kind !== "clip-goto") continue;
        seen.add(`${command.role}:${command.label}`);
      }
      for (const token of step.actionTokens) host.reportActionAnimation(token);
    }
  }
  assert.ok(seen.size >= 4, `the sweep must have met several labels: ${[...seen].join(", ")}`);

  const unrecognised = [...seen].filter((entry) => {
    const [role, label] = entry.split(":");
    return !timelineFor(label, { role }).recognised;
  });
  assert.deepEqual(
    unrecognised,
    [],
    `every label these bouts emitted must animate: ${unrecognised.join(", ")}`
  );
});

/* ------------------------------------------------------------------ */
/* The static server's path containment                                */
/* ------------------------------------------------------------------ */

/**
 * `tools/arena-server.mjs` exists only so the page has an origin to import
 * `src/` from. It still serves a directory over http, so what it refuses is
 * worth pinning: this repository sits next to a licensed install, and a
 * convenience server that will hand out a `.swf` is how a tool for building a
 * game becomes a loader for someone's licensed bytes.
 */
test("the arena server serves the repository and refuses what it must", async () => {
  const { resolveRequestPath } = await import("../tools/arena-server.mjs");
  const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

  assert.equal(resolveRequestPath("/"), `${root}/tools/arena/index.html`, "the bare origin is the arena");
  assert.equal(resolveRequestPath("/src/render/index.js"), `${root}/src/render/index.js`);
  assert.equal(resolveRequestPath("/tools/arena/main.js?v=2#x"), `${root}/tools/arena/main.js`);

  for (const refused of [
    "/captures/README.md",
    "/captures/anything/at/all",
    "/local-mod-work/README.md",
    "/.git/config",
    "/node_modules/x",
    "/tools/build.swf",
    "/anything.SWF",
    "/save.sol",
    "/x\0.js",
    "/a\\b.js"
  ]) {
    assert.equal(resolveRequestPath(refused), null, `${refused} must be refused`);
  }

  // Traversal is contained by resolving first and then checking, so nothing
  // escapes the root however it is spelled.
  for (const traversal of ["/../../../etc/passwd", "/%2e%2e/%2e%2e/etc/passwd", "/src/../../etc/passwd"]) {
    const resolved = resolveRequestPath(traversal);
    assert.ok(
      resolved === null || resolved.startsWith(`${root}/`),
      `${traversal} escaped the repository root: ${resolved}`
    );
  }

  // A malformed percent-escape is refused rather than thrown.
  assert.equal(resolveRequestPath("/%zz"), null);
});

/* ------------------------------------------------------------------ */
/* The stall: a whole bout on a fake clock                             */
/* ------------------------------------------------------------------ */

/**
 * THE BUG THIS TEST WAS WRITTEN FOR. The browser arena's first spectated bout
 * submitted ONE action and then froze on "waiting for the arena" for ever. The
 * decision lived in a `requestAnimationFrame` callback, so nothing in the suite
 * could reach it; the fix was to move the decision into `animationCursor` and
 * drive it here from a fake clock, where a stall is a failing test rather than
 * a frozen screenshot.
 *
 * The test is the whole loop, on a clock this file controls: submit, start
 * timelines, advance time, report, submit again — for an entire bout.
 */
test("a spectated bout runs to a decision on a fake clock, and never stalls", () => {
  for (const [perSide, seed] of [[1, 7], [2, 7], [3, 11]]) {
    const host = arenaHost(perSide, seed);
    let scene = applyCommands(emptyScene(), host.constructArena().commands);
    const playing = new Map();
    let pendingTokens = [];
    let clock = 0;
    let actions = 0;
    let framesWithoutProgress = 0;

    while (!host.battle.result && framesWithoutProgress < 200) {
      // One frame: drain, then act if the gate is open.
      const cursor = animationCursor(pendingTokens, playing, clock);
      for (const combatantId of cursor.expired) playing.delete(combatantId);
      if (cursor.abandon) {
        host.abandonActionAnimation(cursor.abandon.token, cursor.abandon.reason);
        pendingTokens = pendingTokens.filter((token) => token !== cursor.abandon.token);
      } else if (cursor.finished.length > 0) {
        for (const token of cursor.finished) host.reportActionAnimation(token);
        pendingTokens = pendingTokens.filter((token) => !cursor.finished.includes(token));
      }

      if (host.readyForNextAction().ready) {
        const options = host.legalActions();
        if (options.length === 0) break;
        const step = host.submit({ ...options[host.battle.turnNumber % options.length], actorId: host.currentCombatantId() });
        const begun = beginStep(scene, step);
        scene = begun.scene;
        for (const [combatantId, entry] of begun.started) playing.set(combatantId, { ...entry, startedAt: clock });
        pendingTokens = [...new Set([...pendingTokens, ...step.actionTokens])];
        actions += 1;
        framesWithoutProgress = 0;
      } else {
        framesWithoutProgress += 1;
      }
      // 60fps.
      clock += 16;
    }

    assert.ok(host.battle.result, `${perSide}v${perSide} seed ${seed} STALLED after ${actions} actions`);
    assert.ok(actions > 3, `${perSide}v${perSide} seed ${seed} decided in too few actions to prove anything: ${actions}`);

    // The bout being decided does not end the surface's work: the killing
    // blow's own timeline is still playing, and the shell keeps draining until
    // it finishes. A loop that stopped at the result would leave the last
    // token unanswered — which is what settlement then waits on for ever.
    assert.ok(pendingTokens.length > 0, "the killing blow's animation is still running at the decision");
    let tailFrames = 0;
    while (pendingTokens.length > 0 && tailFrames < 500) {
      tailFrames += 1;
      clock += 16;
      const cursor = animationCursor(pendingTokens, playing, clock);
      for (const combatantId of cursor.expired) playing.delete(combatantId);
      for (const token of cursor.finished) host.reportActionAnimation(token);
      pendingTokens = pendingTokens.filter((token) => !cursor.finished.includes(token));
    }
    assert.deepEqual(pendingTokens, [], "the tail drains: every token was answered");
    assert.deepEqual(host.actionAnimationState().abandoned, [], "and none had to be abandoned on a clock that ran");

    // And only then can the campaign settle.
    assert.doesNotThrow(() => host.acknowledgeResultAnimations({
      deaths: host.awaitingDeathAnimations(),
      arenaLabel: scene.arenaLabel,
      completionToken: scene.completionToken
    }), `${perSide}v${perSide} seed ${seed} could not settle after its animations finished`);
  }
});

test("a token whose action started NO timeline is finished, not waited on for ever", () => {
  // The stall's actual mechanism: "no timeline running under this token" was
  // indistinguishable from "still running", so such a token was never reported.
  const cursor = animationCursor([4], new Map(), 0);
  assert.deepEqual([...cursor.finished], [4], "nothing is running under token 4, so token 4 is done");
  assert.equal(cursor.abandon, null, "and it is FINISHED, not abandoned: nobody gave up on anything");
});

test("the cursor reports a running token as running, and only the worst overrun is abandoned", () => {
  const fast = timelineFor("hurt1", { role: "target" });
  const slow = timelineFor("attack7", { role: "actor" });
  const playing = new Map([
    ["a", { timeline: slow, startedAt: 0, token: 1 }],
    ["b", { timeline: fast, startedAt: 0, token: 1 }]
  ]);

  // Mid-flight: the slow one is still going, so the token is not finished.
  const mid = animationCursor([1], playing, fast.durationMs + 1);
  assert.deepEqual([...mid.finished], [], "the token waits for the LONGEST timeline under it");
  assert.deepEqual([...mid.expired], ["b"], "and the short one has stopped posing");

  // Both done, in time: finished, nothing abandoned.
  const done = animationCursor([1], playing, slow.durationMs + 1);
  assert.deepEqual([...done.finished], [1]);
  assert.equal(done.abandon, null);

  // Both far overdue: exactly one abandonment, naming the worst overrun.
  const late = animationCursor([1], playing, slow.durationMs + ANIMATION_TIMEOUT_MS + 5000);
  assert.ok(late.abandon, "past the grace period the surface gives up");
  assert.equal(late.abandon.token, 1);
  assert.match(late.abandon.reason, /hurt1/, "the worst overrun is the SHORTER timeline, which ran over by more");
});
