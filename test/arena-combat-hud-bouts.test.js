/**
 * THE IN-FRAME TEAM HUD OVER WHOLE BOUTS (wave 3): real bouts through the
 * arena's own host, seated as `tools/arena/main.js` seats them, with the whole
 * pipeline the shell runs for the gauges — `teamHudFor`, the step's hold
 * (`gaugeHoldFor`, `heldHudFor`), the frame (`combatHudFrameFor`) and every
 * cluster's ops (`createCombatHudOps`) — and for the crowd bar (D8: the
 * crowd presenter queued at each step's drawing end, `crowdBarReadingFor`,
 * `createCrowdBarOps`) — read after EVERY action.
 *
 * The HUD is presentation only: reading it all after every action leaves a
 * spectated bout's state-hash sequence exactly what it is without it (the
 * pattern of `test/arena-team-hud-bouts.test.js`).
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { ss2BattleValues, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import { popupsForEvents } from "../src/render/popups.js";
import { createCrowdPresenter, crowdHeardFor, queueCrowdInterest } from "../src/render/crowd-sound.js";
import { ss2CrowdInterestOf } from "../src/team/ss2-crowd.js";
import { resourceValue } from "../src/team/resources.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import { seatControllersFrom, withSeatControllers } from "../tools/arena/seats.js";
import { teamHudFor } from "../tools/arena/team-hud.js";
import {
  combatHudArtFor,
  combatHudFrameFor,
  createCombatHudOps,
  createCrowdBarOps,
  crowdBarArtFor,
  crowdBarReadingFor,
  gaugeHoldFor,
  heldHudFor
} from "../tools/arena/combat-hud.js";

const deps = { ss2Combatant, ss2BattleValues };

/** The arena's host for a bout, seated as `main.js` seats it. */
function seatedHost({ perSide, seed, kit = "", query = "spectate=1" }) {
  const items = demoItemsFrom(kit);
  const teams = [demoSide("red", perSide, { ...deps, items, seed }), demoSide("blue", perSide, { ...deps, items, seed })];
  const seats = seatControllersFrom(new URLSearchParams(query), teams);
  const host = createVanillaBattleHost({
    teams: withSeatControllers(teams, seats), rules: ss2TeamRules, bindings: SS2_STATIC_MAP_BINDINGS, seed
  });
  return { host, seats };
}

const readingsOf = (hud) => new Map(hud.teams.flatMap((team) => team.rows)
  .map((row) => [row.id, JSON.stringify([row.health, row.energy, row.armour, row.alive])]));

/**
 * Plays a spectated bout, and after every action runs the gauges' whole pipeline as `beginStep` and
 * `render` run it: the hold from the model before and after the step, with the step's own pop-ups
 * (`popupsForEvents` over its events, as `spawnPopups` reads them, each starting at 1000 on a clock the
 * test holds), the held model while the step is drawn and once it has settled, the frame, and the ops.
 */
function playWithHud({ perSide, seed, kit }, onStep = () => {}) {
  const { host, seats } = seatedHost({ perSide, seed, kit });
  const art = combatHudArtFor(null);
  const opsFor = createCombatHudOps();
  // D8, as `main.js` keeps it: the opening levels decide whether the crowd is heard (`crowdHeard`), and the
  // presenter holds the opening and then each step's crowd from the moment its drawing ends
  // (`noteArenaSoundStep`) — here each step's drawing ends at 1000 x (its number) + 500 on the test's clock.
  const heard = crowdHeardFor(host.battle.teams.flatMap((team) => team.combatants.map((one) => resourceValue(one, "herolevel", Number.NaN))));
  const crowdArt = crowdBarArtFor(null);
  const crowdOpsFor = createCrowdBarOps();
  let presenter = createCrowdPresenter(ss2CrowdInterestOf(host.battle));
  let stepNumber = 0;
  const hashes = [host.hash()];
  let before = teamHudFor({ wire: host.wire(), seats });
  while (!host.battle.result) {
    const actorId = host.currentCombatantId();
    const step = host.submit({ ...host.suggestAction(actorId), actorId });
    const after = teamHudFor({ wire: host.wire(), seats });
    const events = host.wire().events.filter((event) => event.sequence >= step.actionBoundary);
    const popups = popupsForEvents(events, { strikes: [], seed: step.actionBoundary }).map((popup) => ({ popup, startedAt: 1000 }));
    const hold = gaugeHoldFor({ before, after, popups, tokens: step.actionTokens });
    const drawing = heldHudFor(after, hold, { now: 999, pendingTokens: step.actionTokens });
    const landed = heldHudFor(after, hold, { now: 1000, pendingTokens: step.actionTokens });
    const settled = heldHudFor(after, hold, { now: 999, pendingTokens: [] });
    stepNumber += 1;
    const endsAt = stepNumber * 1000 + 500;
    presenter = queueCrowdInterest(presenter, ss2CrowdInterestOf(host.battle), endsAt);
    const crowd = { drawing: crowdBarReadingFor({ presenter, now: endsAt - 1, heard }), drawn: crowdBarReadingFor({ presenter, now: endsAt, heard }) };
    for (const shown of [drawing, landed, settled]) {
      const frame = combatHudFrameFor({ hud: shown, pack: art.pack, crowd: crowd.drawing });
      for (const { cluster, reading } of frame.clusters) {
        opsFor({ art, textPack: null, cluster, reading, stageScale: 1 });
      }
      crowdOpsFor({ art: crowdArt, textPack: null, reading: frame.crowd, stageScale: 1 });
    }
    crowdOpsFor({ art: crowdArt, textPack: null, reading: crowd.drawn, stageScale: 1 });
    onStep({ before, after, drawing, landed, settled, popups, hold, crowd, heard });
    before = after;
    hashes.push(host.hash());
  }
  return hashes;
}

test("THE GAUGES ARE PRESENTATION ONLY: a spectated bout's state-hash sequence is the same with the whole HUD pipeline read after every action, or never", () => {
  for (const [perSide, kit, seed] of [[3, "tricks", 2], [2, "", 5], [1, "tricks", 4]]) {
    const { host } = seatedHost({ perSide, kit, seed });
    const bare = [host.hash()];
    while (!host.battle.result) {
      const actorId = host.currentCombatantId();
      host.submit({ ...host.suggestAction(actorId), actorId });
      bare.push(host.hash());
    }
    assert.deepEqual(playWithHud({ perSide, kit, seed }), bare, `${perSide}v${perSide} ${kit || "plain"} seed ${seed}`);
  }
});

test("D6 OVER REAL STEPS: while a step is drawn every gauge shows the step's starting readings; a fighter with a pop-up drains when it starts, the rest when the step settles", () => {
  let held = 0;
  let released = 0;
  let steps = 0;
  for (const [perSide, kit, seed] of [[2, "tricks", 3], [3, "", 1], [1, "", 2]]) {
    playWithHud({ perSide, kit, seed }, ({ before, after, drawing, landed, settled, popups }) => {
      steps += 1;
      const was = readingsOf(before);
      const now = readingsOf(after);
      const onScreen = readingsOf(drawing);
      const atImpact = readingsOf(landed);
      const withPopup = new Set(popups.map((entry) => entry.popup.combatantId));
      for (const [id, reading] of now) {
        assert.equal(onScreen.get(id), was.get(id), `${id}: before the blow lands, the step's starting readings`);
        assert.equal(atImpact.get(id), withPopup.has(id) ? reading : was.get(id), `${id}: his pop-up starts — or he waits for the settle`);
        if (reading !== was.get(id)) {
          held += 1;
          if (withPopup.has(id)) released += 1;
        }
      }
      assert.deepEqual(readingsOf(settled), now, "the step settled: the wire's readings, everyone");
    });
  }
  assert.ok(steps > 50 && held > 50 && released > 20, `the sweep is not empty (${steps} steps, ${held} held, ${released} released by a pop-up)`);
});

test("D3 OVER REAL BOUTS: the camera is handed the band's top in a team bout and nothing in a 1v1, on every step", () => {
  for (const [perSide, expectTop] of [[1, false], [2, true], [3, true]]) {
    let checked = 0;
    playWithHud({ perSide, kit: "", seed: 6 }, ({ drawing }) => {
      const frame = combatHudFrameFor({ hud: drawing, pack: null });
      assert.equal(frame.clusters.length, perSide * 2, "a cluster per fighter, the fallen included");
      assert.equal(Number.isFinite(frame.cameraHudTop), expectTop, `${perSide}v${perSide}`);
      checked += 1;
    });
    assert.ok(checked > 5, `${perSide}v${perSide}: ${checked} steps`);
  }
});

test("D8 OVER REAL STEPS: while a step is drawn the crowd bar shows the crowd the step found; once its drawing ends, the side panel's — the wire's own number", () => {
  let steps = 0;
  let moved = 0;
  const heardIn = [];
  for (const [perSide, kit, seed] of [[3, "tricks", 2], [2, "", 5], [1, "tricks", 4], [2, "crowd", 3]]) {
    let found = null;
    playWithHud({ perSide, kit, seed }, ({ before, after, crowd, heard }) => {
      steps += 1;
      found ??= heard;
      // The side panel's meter reads the wire (`teamHudFor` -> `crowdMeterFor(ss2CrowdInterestOf(wire))`).
      assert.equal(crowd.drawing.value, before.crowd.value, "the swing still being drawn: the crowd the step found");
      assert.equal(crowd.drawn.value, after.crowd.value, "the action drawn: the side panel's number, the wire's");
      assert.equal(crowd.drawn.shown, heard && Number.isFinite(after.crowd.value), "shown while the crowd is heard");
      if (crowd.drawn.value !== crowd.drawing.value) moved += 1;
    });
    heardIn.push(found);
  }
  assert.ok(steps > 50 && moved > 20, `the sweep is not empty (${steps} steps, the crowd moved on ${moved})`);
  assert.ok(heardIn.includes(true), `at least one of the bouts has a crowd heard: ${heardIn}`);
});
