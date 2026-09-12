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
import { ss2BattleValues, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import {
  ANIMATION_TIMEOUT_MS,
  abandonReasonFor,
  animationCursor,
  applyCommands,
  emptyScene,
  poseAt,
  timelineFor,
  timelinesForStep
} from "../src/render/index.js";
import { demoSide } from "../tools/arena/roster.js";

function arenaHost(perSide = 2, seed = 7, options = {}) {
  return createVanillaBattleHost({
    teams: [demoSide("red", perSide, { ss2Combatant, ss2BattleValues }), demoSide("blue", perSide, { ss2Combatant, ss2BattleValues })],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed,
    awaitAnimations: true,
    ...options
  });
}

/**
 * The shell's own dispatch: fold commands, start timelines, collect tokens.
 *
 * ► **THIS USED TO RE-IMPLEMENT THE LOOP IT WAS TESTING, and that is a
 *   correlated failure, not a convenience.** It walked the commands itself and
 *   built its own `started` map, so the shell and the test were two
 *   implementations of one decision and could agree with each other while both
 *   disagreeing with what a person would see. The decision now lives in
 *   `timelinesForStep` (`src/render/cursor.js`) and both call it, which is how
 *   `animationCursor` is already arranged.
 */
function beginStep(scene, step) {
  const { started, notices } = timelinesForStep(step.commands);
  return { scene: applyCommands(scene, step.commands), started, notices };
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
  // ► **THIS TEST RE-IMPLEMENTED THE SHELL'S CHOICE POLICY VERBATIM, and that
  //   is the second time this file has made that mistake (2026-09-12).** It
  //   carried `options[host.battle.turnNumber % options.length]` — the same
  //   line `tools/arena/main.js` carried — so the test and the shell were two
  //   implementations of one decision that agreed with each other while both
  //   were wrong. The header block above already records the first instance,
  //   `timelinesForStep`, and the fix is the same: both call
  //   `host.aiAction()`.
  //
  //   **And its assertions could not have caught it**: "settles" and
  //   "actions > 3" are both satisfied by a bout of pure walking that the crowd
  //   eventually kills. Measured under the old policy — 24 bouts, 20,712
  //   actions, ZERO attacks, all 24 settling. So the sweep below now asserts
  //   that an attack was actually ON OFFER and TAKEN, which is the fact that
  //   distinguishes a fight from an oscillation.
  let spectatedAttacks = 0;
  let spectatedOffers = 0;
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
        // The SHELL'S OWN CHOICE, not a copy of it. See the block above.
        const actorId = host.currentCombatantId();
        const chosen = host.suggestAction(actorId);
        if (options.some((option) => /attack$/.test(option.type))) spectatedOffers += 1;
        if (/attack$/.test(chosen.type)) spectatedAttacks += 1;
        const step = host.submit({ ...chosen, actorId });
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

  // ► **THE ASSERTION THE OLD VERSION OF THIS TEST WAS MISSING.** Everything
  //   above passed for a day while the spectated arena threw ZERO punches: the
  //   gladiators oscillated on the spot and the crowd's patience ended each
  //   bout, which satisfies "settles" and "more than 3 actions" perfectly. A
  //   spectator watching that would have seen three rounds of shuffling and a
  //   corpse.
  assert.ok(spectatedOffers > 0, "the spectated bouts must have CLOSED to where an attack is on offer");
  assert.ok(
    spectatedAttacks > 0,
    `and must have actually swung: ${spectatedAttacks} attacks over ${spectatedOffers} turns with one on offer`
  );
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

/* ------------------------------------------------------------------ */
/* The sweep the browser should never have been the first to run       */
/* ------------------------------------------------------------------ */

/**
 * THE GUARD THIS PROJECT DID NOT HAVE. Every `unmapped` command the adapter
 * emits is a thing the arena cannot draw, and until 2026-09-10 the only way to
 * discover one was to open the page and read the amber lines in its log. The
 * owner did exactly that and found three — and the sidebar showed the SYMPTOM
 * (a target label with nowhere to play) while hiding the worse half, which was
 * that every one of those actions was also playing the IDLE clip.
 *
 * A log a person reads is not a guard. This is: the sidebar's content is
 * computable, because it is derived from presentation commands, and those run
 * under `node --test` perfectly well. Bouts across three team sizes, forty
 * seeds and three enchantment loadouts, asserting that nothing is unmapped and
 * that every clip label the run emits can actually be animated.
 *
 * Kept deliberately smaller than the 360-bout sweep that found the bug, because
 * this runs on every commit. The full sweep lives in the commit message.
 */
test("a broad sweep of real bouts emits no unmapped command and no unplayable label", () => {
  const unmapped = new Map();
  const unplayable = new Map();
  let bouts = 0;
  let actions = 0;
  let commands = 0;
  let selfTargetedSeen = 0;

  for (const perSide of [1, 2, 3]) {
    for (const seed of [3, 7, 11, 19]) {
      for (const enchant of [null, "burning", "poison"]) {
        const host = arenaHost(perSide, seed, enchant ? { rngTape: null } : {});
        host.constructArena();
        bouts += 1;
        let guard = 0;
        while (!host.battle.result && guard < 900) {
          guard += 1;
          const options = host.legalActions();
          if (options.length === 0) break;
          const step = host.submit({
            ...options[host.battle.turnNumber % options.length],
            actorId: host.currentCombatantId()
          });
          actions += 1;
          for (const command of step.commands) {
            commands += 1;
            if (command.kind === "unmapped") {
              const key = command.reason.replace(/\b(red|blue)-\d+\b/g, "<id>");
              unmapped.set(key, (unmapped.get(key) ?? 0) + 1);
            }
            if (command.kind === "clip-goto") {
              if (command.role === "actor" && command.label === "rest") selfTargetedSeen += 1;
              if (!timelineFor(command.label, { role: command.role }).recognised) {
                const key = `${command.role}:${command.label} [${command.labelProvenance}]`;
                unplayable.set(key, (unplayable.get(key) ?? 0) + 1);
              }
            }
          }
          for (const token of step.actionTokens) host.reportActionAnimation(token);
        }
      }
    }
  }

  // The sweep must have done enough to mean something.
  assert.ok(bouts >= 30, `too few bouts to prove anything: ${bouts}`);
  assert.ok(actions > 500, `too few actions to prove anything: ${actions}`);
  assert.ok(commands > 3000, `too few commands to prove anything: ${commands}`);
  // And it must have MET the case that was broken, or it is green for the wrong
  // reason: a sweep that never rests would pass with the bug still in place.
  assert.ok(selfTargetedSeen > 0, "the sweep must have met a self-targeted action");

  assert.deepEqual([...unmapped.entries()], [], "every action the adapter binds must be drawable");
  assert.deepEqual([...unplayable.entries()], [], "every clip label emitted must have a timeline");
});

test("the lunge is a step, not a walk: a figure ends an attack where it started", () => {
  // `advance` exists because the figures could not walk and CANNOT: the stream
  // carries no position after construction, and the resolver models none. A
  // lunge is presentation; a walk would be a protocol change. So the one thing
  // that must hold is that the lunge always comes home.
  for (const label of ["attack7", "bombard", "rest", "Block", "burning"]) {
    const timeline = timelineFor(label, { role: label === "Block" ? "target" : "actor" });
    assert.equal(poseAt(timeline, 0).advance, 0, `${label} starts at rest`);
    assert.equal(poseAt(timeline, 1).advance, 0, `${label} returns to its own ground`);
  }

  // And an attack must actually leave it, or the lunge does nothing.
  const attack = timelineFor("attack7", { role: "actor" });
  const peak = Math.max(...[0.28, 0.4, 0.52, 0.62, 0.75].map((at) => poseAt(attack, at).advance));
  assert.ok(peak > 0.8, `an attack must visibly step in: peak advance ${peak}`);
});

test("the four conditions do not read alike, and none is the idle pose", () => {
  const idle = timelineFor("Standing", { role: "actor" });
  const seen = new Map();
  for (const label of ["burning", "frozen", "poisoned", "life_stolen"]) {
    const timeline = timelineFor(label, { role: "actor" });
    assert.equal(timeline.recognised, true, `${label} must animate`);
    assert.equal(timeline.family, `condition:${label}`);
    assert.notEqual(timeline.family, idle.family, `${label} must not be the idle clip`);
    seen.set(label, JSON.stringify(timeline.keyframes));
  }
  assert.equal(new Set(seen.values()).size, 4, "four conditions, four distinct schedules");

  // Frozen is the rigid one on purpose; poisoned doubles over. If those ever
  // collapse into each other the read is gone even though both "animate".
  const frozenPeak = Math.max(...[0.3, 0.5, 0.72].map((at) => Math.abs(poseAt(timelineFor("frozen", { role: "actor" }), at).lean)));
  const poisonPeak = Math.max(...[0.35, 0.5, 0.7].map((at) => Math.abs(poseAt(timelineFor("poisoned", { role: "actor" }), at).lean)));
  assert.ok(poisonPeak > frozenPeak * 3, `poisoned must double over far more than frozen: ${poisonPeak} vs ${frozenPeak}`);
});
