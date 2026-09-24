/**
 * THE ARENA'S SEATS (`tools/arena/seats.js`, 2026-09-24): who plays which
 * fighter — `?play=red`, `?play=red-1,blue-2`, `?spectate=1`, or nothing for
 * every seat by hand. Slice 1 of `docs/design/battle-ui.md`: the first time a
 * person can play against the AI anywhere in the repository.
 *
 * Four things are pinned here, each by FINDING the case it is about:
 *
 * 1. the parser — what it accepts, what it refuses (loudly, naming the token,
 *    as `?items=` does), and why its spelling is not `?red=human`;
 * 2. that a seat is declared through the ENGINE: the battle's own registry
 *    answers `isAiControlled`, and `chooseAiAction` refuses a person's seat;
 * 3. that the controller is outside the combat hash — the same choices give
 *    the same hash on every step, whoever the registry says is driving;
 * 4. the turn loop the shell runs, on a fake clock through the enforcing
 *    animation gate: a person's moves go in by hand, every AI seat's turn is
 *    `suggestAction` taken only once the gate is open, and the bout settles.
 *
 * `tools/arena/main.js` cannot be imported by node; section 5 reads its TEXT
 * for the few lines that wire these decisions in, as
 * `test/arena-sound-wiring.test.js` does.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { ss2BattleValues, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import {
  ControllerKind,
  chooseAiAction,
  controllerOf,
  isAiControlled,
  isCampaignSettled,
  reassignController,
  toControllerState
} from "../src/team/index.js";
import { animationCursor, applyCommands, emptyScene, resultSoundsFor, timelinesForStep } from "../src/render/index.js";
import { arenaRequestFrom, championRequestFrom, demoSide } from "../tools/arena/roster.js";
import {
  SeatMode,
  resultHeadingFor,
  seatControllersFrom,
  seatControlsFor,
  seatFrameFor,
  seatOutcomeFor,
  seatSummaryFor,
  seatTagFor,
  seatTurnFor,
  seatTurnKey,
  withSeatControllers
} from "../tools/arena/seats.js";

const query = (text) => new URLSearchParams(text);
const deps = { ss2Combatant, ss2BattleValues };
const demoTeams = (perSide, seed = 7) => [demoSide("red", perSide, { ...deps, seed }), demoSide("blue", perSide, { ...deps, seed })];
/** The shape `championSide` builds (ids `red-1`...), without needing the gitignored pack: the seats read ids only. */
const idTeams = (red, blue) => [
  { id: "red", members: Array.from({ length: red }, (unused, index) => ({ id: `red-${index + 1}`, controller: "local" })) },
  { id: "blue", members: Array.from({ length: blue }, (unused, index) => ({ id: `blue-${index + 1}`, controller: "local" })) }
];
const L = ControllerKind.LOCAL;
const A = ControllerKind.AI;

function seatedHost(perSide, seed, text, options = {}) {
  const teams = demoTeams(perSide, seed);
  const seats = seatControllersFrom(query(text), teams);
  const host = createVanillaBattleHost({
    teams: withSeatControllers(teams, seats),
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed,
    ...options
  });
  return { host, seats };
}

/* ------------------------------------------------------------------ */
/* 1. The parser                                                       */
/* ------------------------------------------------------------------ */

test("no parameter is the arena as it was: every seat by hand, and the teams come back EQUAL to the roster's", () => {
  for (const text of ["", "teams=3&seed=4&items=buffs", "spectate=0", "spectate=true"]) {
    const teams = demoTeams(3);
    const seats = seatControllersFrom(query(text), teams);
    assert.equal(seats.mode, SeatMode.LOCAL, text);
    assert.deepEqual({ ...seats.controllers }, { "red-1": L, "red-2": L, "red-3": L, "blue-1": L, "blue-2": L, "blue-3": L });
    assert.deepEqual([...seats.humanSides], ["red", "blue"]);
    // `demoSide` already writes `controller: "local"`, so nothing on any member moves.
    assert.deepEqual(withSeatControllers(teams, seats), teams, `${text}: the default must not change the roster`);
  }
});

test("?play= names what a person plays — sides and fighters, in any mix — and every other seat is the AI's", () => {
  const cases = [
    [1, "play=red", { "red-1": L, "blue-1": A }, ["red"]],
    [3, "play=red", { "red-1": L, "red-2": L, "red-3": L, "blue-1": A, "blue-2": A, "blue-3": A }, ["red"]],
    [3, "play=blue-2", { "red-1": A, "red-2": A, "red-3": A, "blue-1": A, "blue-2": L, "blue-3": A }, ["blue"]],
    [2, "play=red-1,blue", { "red-1": L, "red-2": A, "blue-1": L, "blue-2": L }, ["red", "blue"]],
    [2, "play=red,blue", { "red-1": L, "red-2": L, "blue-1": L, "blue-2": L }, ["red", "blue"]],
    // Trimmed, and an empty entry is skipped, as `demoItemsFrom` skips one; a repeat is harmless.
    [2, "play=%20red-2%20,,red-2", { "red-1": A, "red-2": L, "blue-1": A, "blue-2": A }, ["red"]]
  ];
  for (const [perSide, text, controllers, humanSides] of cases) {
    const seats = seatControllersFrom(query(text), demoTeams(perSide));
    assert.equal(seats.mode, SeatMode.PLAY, text);
    assert.deepEqual({ ...seats.controllers }, controllers, text);
    assert.deepEqual([...seats.humanSides], humanSides, text);
    assert.deepEqual([...seats.humans], Object.keys(controllers).filter((id) => controllers[id] === L), text);
  }
});

test("?spectate=1 gives EVERY seat to the AI — through the registry now, not a shell-only flag", () => {
  const seats = seatControllersFrom(query("spectate=1&teams=2"), demoTeams(2));
  assert.equal(seats.mode, SeatMode.SPECTATE);
  assert.deepEqual({ ...seats.controllers }, { "red-1": A, "red-2": A, "blue-1": A, "blue-2": A });
  assert.deepEqual([...seats.humans], []);
  assert.deepEqual([...seats.humanSides], []);
});

test("malformed or impossible seats are REFUSED LOUDLY, naming the token — never silently handed to the AI", () => {
  const two = demoTeams(2);
  const refusals = [
    ["play=", /play= is empty/],
    ["play=,%20,", /play= is empty/],
    ["play=green", /"green" is neither a side nor a fighter here\. Choose from red, blue, red-1, red-2, blue-1, blue-2/],
    ["play=Red", /"Red" is neither a side nor a fighter/],
    ["play=red-1x", /"red-1x" is neither a side nor a fighter/],
    ["play=red-3", /red-3 is not on the field — red has 2 fighters this bout \(red-1, red-2\)/],
    ["play=red,blue-9", /blue-9 is not on the field/],
    ["play=human", /"human" is neither a side nor a fighter/],
    ["play=red&spectate=1", /spectate=1 gives every fighter to the AI\. Drop one/]
  ];
  for (const [text, message] of refusals) {
    assert.throws(() => seatControllersFrom(query(text), two), message, text);
  }
  assert.throws(() => seatControllersFrom(query("play=red-2"), demoTeams(1)), /red has 1 fighter this bout \(red-1\)/);
  assert.throws(() => withSeatControllers(two, { controllers: { "red-1": L } }), /No seat was decided for red-2/);
  assert.throws(() => withSeatControllers(two, { controllers: { "red-1": L, "red-2": "remote", "blue-1": A, "blue-2": A } }),
    /No seat was decided for red-2/, "only the two kinds the arena can drive");
});

test("why `play=` and not `?red=human&blue=ai`: red= and blue= are the CHAMPIONS, and the two readers never cross", () => {
  // The design doc's suggested spelling is refused by the champion reader
  // before any seat could be read — the arena would not start.
  assert.throws(() => arenaRequestFrom(query("red=human&blue=ai")), /"human" is not a which_boss number/);
  // `play=` is invisible to the roster readers...
  assert.equal(championRequestFrom(query("play=red&teams=2")), null);
  assert.deepEqual(arenaRequestFrom(query("play=red")), { kind: "demo", items: [] });
  // ...and composes with the champions: the same ids, so the same seats.
  const request = arenaRequestFrom(query("red=2,4,16&blue=1,3,10&play=red"));
  assert.deepEqual(request, { kind: "champions", red: [2, 4, 16], blue: [1, 3, 10] });
  const seats = seatControllersFrom(query("red=2,4,16&blue=1,3,10&play=red"), idTeams(request.red.length, request.blue.length));
  assert.deepEqual({ ...seats.controllers }, { "red-1": L, "red-2": L, "red-3": L, "blue-1": A, "blue-2": A, "blue-3": A });
  assert.throws(() => seatControllersFrom(query("red=2&blue=1,3&play=red-2"), idTeams(1, 2)), /red-2 is not on the field/);
});

test("the readouts: a roster tag only in a play= bout, and one log line naming who plays whom", () => {
  const teams = demoTeams(2);
  const play = seatControllersFrom(query("play=red-1"), teams);
  assert.deepEqual(["red-1", "red-2", "blue-1"].map((id) => seatTagFor(play, id)), ["you", "AI", "AI"]);
  for (const text of ["", "spectate=1"]) {
    const seats = seatControllersFrom(query(text), teams);
    assert.equal(seatTagFor(seats, "red-1"), null, `${text || "no parameter"}: the roster row reads as it did`);
  }
  const names = { "red-1": "Ruk", "red-2": "Vasso", "blue-1": "Cidra", "blue-2": "Nym" };
  assert.equal(seatSummaryFor(play, (id) => names[id]), "seats: you play Ruk (red-1); the AI plays Vasso (red-2), Cidra (blue-1), Nym (blue-2)");
  assert.match(seatSummaryFor(seatControllersFrom(query(""), teams)), /every fighter is played by hand/);
  assert.equal(seatSummaryFor(seatControllersFrom(query("spectate=1"), teams)), "seats: the AI plays every fighter");
});

/* ------------------------------------------------------------------ */
/* 2. The engine answers                                               */
/* ------------------------------------------------------------------ */

test("a seat is declared through the battle's own ControllerRegistry: isAiControlled answers, and the AI door refuses a person", () => {
  const { host, seats } = seatedHost(3, 7, "play=red");
  for (const id of host.combatantIds()) {
    assert.equal(controllerOf(host.battle, id).kind, seats.controllers[id], id);
    assert.equal(isAiControlled(host.battle, host.combatant(id)), id.startsWith("blue-"), id);
  }
  assert.deepEqual(toControllerState(host.battle).map((seat) => [seat.seatId, seat.kind]), [
    ["red:slot-1", L], ["red:slot-2", L], ["red:slot-3", L], ["blue:slot-1", A], ["blue:slot-2", A], ["blue:slot-3", A]
  ]);
  // The resolver's AI door is `suggestAction` plus the seat check — so it
  // takes blue's seats and refuses red's, which is the guard `runAiTurns`
  // relies on never to take a person's turn.
  assert.deepEqual(chooseAiAction(host.battle, "blue-1"), host.suggestAction("blue-1"));
  assert.throws(() => chooseAiAction(host.battle, "red-1"), /non-AI combatant/);
  // With no parameter the registry says what it always said: every seat local.
  const plain = seatedHost(3, 7, "").host;
  assert.ok(plain.combatantIds().every((id) => controllerOf(plain.battle, id).kind === L));
});

/* ------------------------------------------------------------------ */
/* 3. The controller is outside the combat hash                        */
/* ------------------------------------------------------------------ */

/** A whole bout, every turn the rule set's own suggestion, and the hash after each step. */
function hashesOf(host, limit = 600) {
  const hashes = [host.hash()];
  while (!host.battle.result && hashes.length <= limit) {
    const actorId = host.currentCombatantId();
    host.submit({ ...host.suggestAction(actorId), actorId });
    hashes.push(host.hash());
  }
  return hashes;
}

test("the same choices hash the same on EVERY step whoever drives each seat — 1v1 and 3v3, and a mid-bout reassignment too", () => {
  for (const [perSide, seed, assignments] of [
    [1, 7, ["", "play=red", "play=blue", "spectate=1"]],
    [3, 11, ["", "play=red", "play=blue-2", "play=red-1,blue-3", "spectate=1"]]
  ]) {
    const runs = assignments.map((text) => {
      const { host } = seatedHost(perSide, seed, text);
      const controllers = JSON.stringify(toControllerState(host.battle));
      return { text, controllers, hashes: hashesOf(host), wire: JSON.stringify(host.wire()), result: host.battle.result };
    });
    const [base, ...rest] = runs;
    assert.ok(base.result, `${perSide}v${perSide} seed ${seed} decided`);
    assert.ok(base.hashes.length > 4, "a bout long enough to mean something");
    // Found, not stated: the registries really do differ between these runs.
    assert.equal(new Set(runs.map((run) => run.controllers)).size, runs.length, "every run's registry is different");
    for (const run of rest) {
      assert.deepEqual(run.hashes, base.hashes, `${perSide}v${perSide} ${run.text}: a step's hash moved with the controller`);
      assert.equal(run.wire, base.wire, `${perSide}v${perSide} ${run.text}: the wire state moved with the controller`);
    }
  }
  // And handing a seat over mid-bout is not a desync either.
  const { host } = seatedHost(2, 7, "play=red");
  for (let step = 0; step < 6; step += 1) {
    const actorId = host.currentCombatantId();
    host.submit({ ...host.suggestAction(actorId), actorId });
  }
  const before = host.hash();
  reassignController(host.battle, "blue:slot-1", L);
  reassignController(host.battle, "red:slot-2", A);
  assert.equal(host.hash(), before);
  assert.equal(isAiControlled(host.battle, host.combatant("red-2")), true, "and the reassignment took");
});

/* ------------------------------------------------------------------ */
/* 4. The turn loop, on a fake clock, through the enforcing gate       */
/* ------------------------------------------------------------------ */

/**
 * The shell's frame, headless: drain the animations, then ask `seatTurnFor`
 * — the one decision `aiTurnStep` and `renderControls` both read — and act on
 * it. A person's turn is a scripted "player" (the last attack on offer, else
 * the first option, which is nothing like the AI's ladder); an AI seat's turn
 * is `host.suggestAction`, exactly `aiTurnStep`'s call.
 */
function playHumanVsAi(perSide, seed) {
  const { host, seats } = seatedHost(perSide, seed, "play=red", { awaitAnimations: true });
  let scene = applyCommands(emptyScene(), host.constructArena().commands);
  const playing = new Map();
  let pendingTokens = [];
  let clock = 0;
  let framesWithoutProgress = 0;
  const tally = { human: 0, ai: 0, aiHeldByGate: 0, humanHeldByGate: 0, headings: new Set() };

  while (!host.battle.result && framesWithoutProgress < 600) {
    const cursor = animationCursor(pendingTokens, playing, clock);
    for (const combatantId of cursor.expired) playing.delete(combatantId);
    if (cursor.abandon) {
      host.abandonActionAnimation(cursor.abandon.token, cursor.abandon.reason);
      pendingTokens = pendingTokens.filter((token) => token !== cursor.abandon.token);
    }
    for (const token of cursor.finished) host.reportActionAnimation(token);
    pendingTokens = pendingTokens.filter((token) => !cursor.finished.includes(token));

    const ready = host.readyForNextAction().ready;
    const turn = seatTurnFor(host.battle, seats, { ready });
    tally.headings.add(turn.heading);
    let action = null;
    if (turn.ai) {
      assert.ok(turn.actorId.startsWith("blue-"), `${turn.actorId} is not an AI seat`);
      assert.equal(turn.heading, `${turn.name} (AI) is thinking…`);
      if (!turn.autoplay) {
        // The gate is shut: the previous action is still being drawn.
        assert.equal(ready, false);
        tally.aiHeldByGate += 1;
      } else {
        action = host.suggestAction(turn.actorId);
        assert.deepEqual(action, chooseAiAction(host.battle, turn.actorId), "an AI seat's move is the engine's AI door's");
        tally.ai += 1;
      }
    } else {
      assert.ok(turn.actorId.startsWith("red-"), `${turn.actorId} is not a person's seat`);
      assert.equal(turn.autoplay, false, "a person's turn is never taken for them");
      assert.equal(turn.choose, true);
      assert.throws(() => chooseAiAction(host.battle, turn.actorId), /non-AI combatant/);
      if (!ready) {
        assert.equal(turn.heading, `Your turn: ${turn.name} — wait for the arena`);
        tally.humanHeldByGate += 1;
      } else {
        assert.equal(turn.heading, `Your turn: ${turn.name}`);
        const options = host.legalActions();
        action = options.filter((option) => /attack$/.test(option.type)).at(-1) ?? options[0];
        tally.human += 1;
      }
    }

    if (action) {
      // Enforcing gate: `submit` would THROW had anything moved before the
      // last action finished drawing, so reaching here is the proof.
      const step = host.submit({ ...action, actorId: turn.actorId });
      const { started } = timelinesForStep(step.commands);
      scene = applyCommands(scene, step.commands);
      for (const [combatantId, entry] of started) playing.set(combatantId, { ...entry, startedAt: clock });
      pendingTokens = [...new Set([...pendingTokens, ...step.actionTokens])];
      framesWithoutProgress = 0;
    } else {
      framesWithoutProgress += 1;
    }
    clock += 16;
  }

  const label = `${perSide}v${perSide} seed ${seed}`;
  assert.ok(host.battle.result, `${label} STALLED: ${tally.human} human, ${tally.ai} AI actions`);
  assert.equal(seatTurnFor(host.battle, seats, { ready: true }), null, "a decided bout has no turn");
  // The tail: the deciding blow is still being drawn; drain it, then settle.
  let tail = 0;
  while (pendingTokens.length > 0 && tail < 600) {
    tail += 1;
    clock += 16;
    const cursor = animationCursor(pendingTokens, playing, clock);
    for (const combatantId of cursor.expired) playing.delete(combatantId);
    for (const token of cursor.finished) host.reportActionAnimation(token);
    pendingTokens = pendingTokens.filter((token) => !cursor.finished.includes(token));
  }
  assert.deepEqual(pendingTokens, [], `${label}: every token answered`);
  host.acknowledgeResultAnimations({
    deaths: host.awaitingDeathAnimations(),
    arenaLabel: scene.arenaLabel,
    completionToken: scene.completionToken
  });
  assert.equal(isCampaignSettled(host.battle), true, `${label} settled`);
  return { host, seats, tally, result: host.battle.result };
}

test("a person plays red against the AI (1v1 and 3v3): red by hand, every blue turn the AI's once the gate opens, and the bout settles", () => {
  const outcomes = [];
  for (const [perSide, seed] of [[1, 7], [1, 3], [3, 7], [3, 11]]) {
    const { seats, tally, result } = playHumanVsAi(perSide, seed);
    const label = `${perSide}v${perSide} seed ${seed}`;
    assert.ok(tally.human > 0, `${label}: the person moved`);
    assert.ok(tally.ai > 0, `${label}: the AI moved`);
    assert.ok(tally.aiHeldByGate > 0, `${label}: FOUND an AI turn held while the last action was drawn`);
    assert.ok(tally.headings.has("Ruk (AI) is thinking…") === false && [...tally.headings].some((heading) => heading.startsWith("Your turn: Ruk")),
      `${label}: red's fighter is announced as yours and never as the AI`);
    const outcome = seatOutcomeFor(result, seats);
    assert.equal(outcome, result.winnerTeamId === null ? "draw" : result.winnerTeamId === "red" ? "won" : "lost", label);
    assert.equal(resultHeadingFor(result, seats), { won: "You won", lost: "You lost", draw: "A draw" }[outcome]);
    outcomes.push(outcome);
  }
  // Found, not stated: at least one of these the person LOST — the case the
  // loss sting is for — and it is heard as `combat_lost`, not as a win.
  assert.ok(outcomes.includes("lost"), `no bout here was lost: ${outcomes.join(", ")}`);
  assert.ok(outcomes.includes("won"), `and none was won, so "You won" was never reached: ${outcomes.join(", ")}`);
  const heard = resultSoundsFor({ atMs: 0, winnerTeamId: "blue", winnerLevel: 4, lost: true }, { lost: "2248.mp3", won: "2228.mp3", victory2: "v.mp3" });
  assert.deepEqual(heard.map((event) => event.sound), ["ambience", "lost"]);
});

/* ------------------------------------------------------------------ */
/* 4b. A seat handed over mid-bout (Codex review, 2026-09-24)          */
/* ------------------------------------------------------------------ */

/**
 * The shell's controls and its per-frame seat step, headless: `render` is
 * `renderControls`' model — `seatControlsFor` on `seatTurnFor`, recording the
 * key it drew — and `frame` is `aiTurnStep`: `seatFrameFor`, redraw when
 * stale, then move an AI seat through `host.suggestAction` and redraw. Section
 * 5 pins that `tools/arena/main.js` makes exactly these calls in this order.
 *
 * `preFix: true` is `aiTurnStep` as it stood before the review — the turn
 * read, `if (!turn?.autoplay) return;`, no redraw — kept as the CONTROL that
 * proves each test below reaches the defect it is about.
 */
function headlessShell(host, seats, { preFix = false } = {}) {
  const shell = { panel: null, draws: 0, moves: [] };
  const ready = () => host.readyForNextAction().ready;
  shell.render = () => {
    const turn = seatTurnFor(host.battle, seats, { ready: ready() });
    shell.panel = seatControlsFor(turn, turn && !turn.ai ? host.legalActions() : [], seats);
    shell.draws += 1;
  };
  shell.frame = () => {
    let turn;
    if (preFix) {
      turn = seatTurnFor(host.battle, seats, { ready: ready() });
      if (!turn?.autoplay) return;
    } else {
      const frame = seatFrameFor(host.battle, seats, { ready: ready(), shownKey: shell.panel?.key ?? null });
      if (frame.refresh) shell.render();
      if (!frame.autoplay) return;
      turn = frame.turn;
    }
    const action = host.suggestAction(turn.actorId);
    shell.moves.push({ actorId: turn.actorId, action, panelWhenMoved: shell.panel });
    host.submit({ ...action, actorId: turn.actorId });
    shell.render();
  };
  shell.render();
  return shell;
}

test("an ACTING AI seat handed to a person with the gate open gets usable buttons — no action or animation needed", () => {
  const run = (preFix) => {
    // play=blue: red-1 (the faster side) opens, and it is the AI's.
    const { host, seats } = seatedHost(1, 7, "play=blue", { awaitAnimations: true });
    assert.equal(host.currentCombatantId(), "red-1");
    assert.equal(host.readyForNextAction().ready, true, "the gate is open: nothing has been submitted");
    const shell = headlessShell(host, seats, { preFix });
    assert.ok(shell.panel.note && shell.panel.buttons.length === 0, "drawn as the AI's turn");
    reassignController(host.battle, "red:slot-1", L);
    for (let frame = 0; frame < 10; frame += 1) shell.frame();
    return { host, shell };
  };

  const { host, shell } = run(false);
  assert.equal(shell.moves.length, 0, "nobody moved: it is a person's turn now");
  assert.equal(host.steps.length, 0);
  assert.equal(shell.panel.note, null, "the AI's note is gone");
  assert.ok(shell.panel.buttons.length > 0, "a person's buttons are drawn");
  assert.ok(shell.panel.buttons.every((button) => button.enabled), "and usable: the gate is open");
  assert.deepEqual(shell.panel.buttons.map((button) => button.action), host.legalActions());
  assert.equal(seatTurnFor(host.battle, seatControllersFrom(query("play=blue"), demoTeams(1)), { ready: true }).ai, false);
  assert.equal(shell.draws, 2, "redrawn ONCE — the first stale frame — and not on every frame after it");

  // The control: the pre-fix step never redraws, so the person is stuck behind the AI's note.
  const stuck = run(true).shell;
  assert.equal(stuck.draws, 1, "pre-fix: ten frames, zero redraws");
  assert.equal(stuck.panel.buttons.length, 0, "pre-fix: still no buttons — the stall Codex reported");
});

test("the mirror: an acting PERSON's seat handed to the AI with the gate open withdraws the buttons, then the AI moves", () => {
  const run = (preFix) => {
    const { host, seats } = seatedHost(1, 7, "play=red", { awaitAnimations: true });
    assert.equal(host.currentCombatantId(), "red-1");
    const shell = headlessShell(host, seats, { preFix });
    assert.ok(shell.panel.buttons.length > 0 && shell.panel.buttons.every((button) => button.enabled), "drawn as a person's turn");
    reassignController(host.battle, "red:slot-1", A);
    const expected = chooseAiAction(host.battle, "red-1");
    shell.frame();
    return { host, shell, expected };
  };

  const { host, shell, expected } = run(false);
  assert.equal(shell.moves.length, 1, "the AI moved on the next frame, with no other event");
  assert.equal(shell.moves[0].actorId, "red-1");
  assert.deepEqual(shell.moves[0].action, expected, "the engine's AI door's own choice");
  assert.equal(host.steps.length, 1);
  assert.equal(shell.moves[0].panelWhenMoved.buttons.length, 0, "the person's buttons were withdrawn BEFORE the AI moved");
  assert.ok(shell.moves[0].panelWhenMoved.note, "and the AI's note was up");

  // The control, stated honestly: the pre-fix step DID start the AI's move
  // (it re-read the registry each frame); what it lacked was withdrawing the
  // person's live buttons first — it moved with them still on screen.
  const before = run(true).shell;
  assert.equal(before.moves.length, 1, "pre-fix: the AI still moved");
  assert.ok(before.moves[0].panelWhenMoved.buttons.some((button) => button.enabled),
    "pre-fix: it moved while a person's enabled buttons were the controls on screen");
});

test("the outcome needs a single 'you': both sides by hand, spectating, or a person on each side is the arena's own words", () => {
  const teams = demoTeams(2);
  const redWins = { winnerTeamId: "red" };
  for (const text of ["", "spectate=1", "play=red-1,blue-1", "play=red,blue"]) {
    const seats = seatControllersFrom(query(text), teams);
    assert.equal(seatOutcomeFor(redWins, seats), null, text);
    assert.equal(resultHeadingFor(redWins, seats), "Decided", text);
    assert.equal(resultHeadingFor(redWins, seats, { settled: true }), "Settled", text);
  }
  const blue = seatControllersFrom(query("play=blue-2"), teams);
  assert.equal(resultHeadingFor(redWins, blue), "You lost");
  assert.equal(resultHeadingFor({ winnerTeamId: "blue" }, blue), "You won");
  assert.equal(resultHeadingFor({ winnerTeamId: null }, blue), "A draw");
  assert.equal(seatOutcomeFor(null, blue), null, "undecided");
});

test("the headings with no parameter and when spectating are the ones the arena always had", () => {
  const { host } = seatedHost(2, 7, "");
  const seats = seatControllersFrom(query(""), demoTeams(2));
  const name = host.combatant(host.currentCombatantId()).name;
  assert.equal(seatTurnFor(host.battle, seats, { ready: true }).heading, `${name} — choose`);
  assert.equal(seatTurnFor(host.battle, seats, { ready: false }).heading, "waiting for the arena");
  assert.equal(seatTurnFor(host.battle, seats, { ready: true }).autoplay, false, "nobody plays itself with no parameter");
  const watched = seatedHost(2, 7, "spectate=1");
  const spectating = seatTurnFor(watched.host.battle, watched.seats, { ready: true });
  assert.equal(spectating.heading, `Spectating — ${name}`);
  assert.equal(spectating.autoplay, true);
  assert.equal(seatTurnFor(watched.host.battle, watched.seats, { ready: false }).autoplay, false, "never through a shut gate");
});

test("the controls panel: buttons only on a person's turn and enabled only through an open gate; a note on an AI's", () => {
  const { host, seats } = seatedHost(2, 7, "play=red");
  const legal = host.legalActions();
  const open = seatTurnFor(host.battle, seats, { ready: true });
  const shut = seatTurnFor(host.battle, seats, { ready: false });
  assert.deepEqual(seatControlsFor(open, legal, seats).buttons.map((button) => [button.action, button.enabled]), legal.map((action) => [action, true]));
  assert.ok(seatControlsFor(shut, legal, seats).buttons.every((button) => button.enabled === false));
  assert.notEqual(seatTurnKey(open), seatTurnKey(shut), "the gate opening makes what was drawn stale");
  assert.equal(seatTurnKey(null), "none");
  // The same actor, handed to the AI: a different key, a note, no buttons — whatever is passed in.
  reassignController(host.battle, "red:slot-1", A);
  const handed = seatTurnFor(host.battle, seats, { ready: true });
  assert.notEqual(seatTurnKey(handed), seatTurnKey(open));
  assert.deepEqual(seatControlsFor(handed, legal, seats).buttons, []);
  assert.match(seatControlsFor(handed, legal, seats).note, /is played by the AI/);
  const watched = seatedHost(2, 7, "spectate=1");
  assert.equal(seatControlsFor(seatTurnFor(watched.host.battle, watched.seats, { ready: true }), [], watched.seats).note,
    "The AI plays every fighter (?spectate=1).");
  // And a frame with nothing changed asks for no redraw.
  const steady = seatFrameFor(host.battle, seats, { ready: true, shownKey: seatTurnKey(handed) });
  assert.equal(steady.refresh, false);
  assert.equal(steady.autoplay, true);
});

/* ------------------------------------------------------------------ */
/* 5. The shell's wiring, read as text                                 */
/* ------------------------------------------------------------------ */

/** Comments out, strings blanked, so a word in prose cannot match. */
function codeOnly(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, '""');
}

function functionBody(code, name) {
  const start = code.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is not defined in tools/arena/main.js`);
  let depth = 0;
  for (let index = code.indexOf("{", start); index < code.length; index += 1) {
    if (code[index] === "{") depth += 1;
    else if (code[index] === "}") { depth -= 1; if (depth === 0) return code.slice(start, index + 1); }
  }
  throw new Error(`${name}'s braces do not balance`);
}

test("the shell builds its host from the SEATED teams and asks seatTurnFor, never a flag of its own", () => {
  const code = codeOnly(fs.readFileSync(new URL("../tools/arena/main.js", import.meta.url), "utf8"));
  assert.match(code, /seats = seatControllersFrom\(params, rosterTeams\);/);
  assert.match(code, /const teams = withSeatControllers\(rosterTeams, seats\);/);
  assert.match(code, /createVanillaBattleHost\(\{\s*teams,/, "the host is built from those teams");
  // `aiTurnStep` is `headlessShell`'s `frame`: stale controls redrawn FIRST, then the AI's move.
  const step = functionBody(code, "aiTurnStep");
  assert.match(step, /const frame = seatFrameFor\(host\.battle, seats, \{ ready: host\.readyForNextAction\(\)\.ready, shownKey: shownSeatKey \}\);\s*if \(frame\.refresh\) renderControls\(\);\s*if \(!frame\.autoplay\) return;\s*const actorId = frame\.turn\.actorId;/);
  assert.match(step, /host\.suggestAction\(actorId\)/);
  assert.equal((step.match(/\bspectate\b/g) ?? []).length, 0, "the AI plays by seat, not by mode");
  // `renderControls` is `headlessShell`'s `render`: the panel model, its key recorded before any branch.
  const controls = functionBody(code, "renderControls");
  assert.match(controls, /const turn = seatTurnFor\(host\.battle, seats, \{ ready: ready\.ready \}\);\s*const panel = seatControlsFor\(turn, turn && !turn\.ai \? host\.legalActions\(\) : \[\], seats\);\s*shownSeatKey = panel\.key;/);
  assert.ok(controls.indexOf("shownSeatKey = panel.key;") < controls.indexOf("if (host.battle.result)"), "every branch counts as drawn");
  assert.match(controls, /resultHeadingFor\(host\.battle\.result, seats, \{ settled \}\)/);
  assert.ok(controls.indexOf("if (panel.note !== null)") >= 0 && controls.indexOf("if (panel.note !== null)") < controls.indexOf("panel.buttons.map("),
    "an AI seat's turn returns before any button is drawn");
  assert.match(controls, /panel\.buttons\.map\(\(\{ action, enabled \}\) =>/);
  assert.match(controls, /button\.disabled = !enabled;/);
  assert.equal((controls.match(/host\.legalActions\(\)/g) ?? []).length, 1, "the buttons come from the panel, not a second read");
  assert.match(controls, /if \(!current \|\| current\.ai \|\| current\.actorId !== actorId\)/, "a stale button cannot take a turn");
  // The loss sting follows the same outcome the heading shows (strings are blanked: `=== "lost"`).
  const note = functionBody(code, "noteArenaSoundStep");
  assert.match(note, /lost: seatOutcomeFor\(result, seats\) === ""/);
  // `play=` has one reader, `seats.js`.
  const raw = fs.readFileSync(new URL("../tools/arena/main.js", import.meta.url), "utf8");
  assert.equal((raw.match(/params\.(get|has)\("(play|spectate)"\)/g) ?? []).length, 0, "main.js reads neither play= nor spectate= itself");
});
