/**
 * The arena's OWN sounds (`src/render/crowd-sound.js`): the crowd's ambience
 * and its live volume, the seeded 1-in-1000 cheer and boo, the win sound, the
 * sting and the pre-fight intro. Every number here is the build's, from the
 * sites the module cites — `crowd_bar` clip-actions 0 and 1 on sprite 751,
 * `soundeffects()` on root frame 10, sprite 2249 frames 81/88/222 (the win)
 * and 250/315 (the loss) and sprite 2224 frame 2 — except the team rules,
 * which are AUTHORED and labelled.
 *
 * What these cannot tell is how the sounds SOUND: the volume sharing on one
 * target clip is AS2's documented model, not a measurement of this build.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ArenaSoundChannel,
  CROWD_FRAME_MS,
  SS2_ARENA_SOUNDS,
  SS2_CROWD_SOUND,
  SOUND_STALE_MS,
  arenaSoundFilesFrom,
  arenaSoundSettled,
  arenaSoundStep,
  createArenaSoundState,
  createCrowdPresenter,
  crowdCallFor,
  crowdGainFor,
  crowdHeardFor,
  crowdRoll,
  crowdVolumeFor,
  PROJECTILE_FRAME_MS,
  crowdInterestAt,
  crowdStopFramesFor,
  decidingBlowMsFor,
  queueCrowdInterest,
  reactionDelaysFor,
  resultSoundsFor,
  settleCrowdInterest,
  soundSecondsFrom,
  stepEndsAtMs,
  victoryStingFor,
  winningSideLevel
} from "../src/render/index.js";
import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { ss2BattleValues, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import { ss2CrowdInterestOf } from "../src/team/ss2-crowd.js";
import { arenaRequestFrom, demoSide } from "../tools/arena/roster.js";

/** A pack shaped like `assets/sound/manifest.json`'s `sounds`, with invented file names. */
const MANIFEST = Object.freeze({
  sounds: [
    { file: "a.mp3", id: 660, exportName: "crowd-ambient.wav", sampleCount: 441000, rate: 44100 },
    { file: "b.mp3", id: 657, exportName: "rockyou.wav", sampleCount: 34171, rate: 11025 },
    { file: "c.mp3", id: 661, exportName: "boo-crowd.wav" },
    { file: "d.mp3", id: 651, exportName: "victory1.wav" },
    { file: "e.mp3", id: 652, exportName: "victory2.wav" },
    { file: "f.mp3", id: 653, exportName: "victory3.wav" },
    { file: "g.mp3", id: 654, exportName: null },
    { file: "h.mp3", id: 2228, exportName: null },
    { file: "i.mp3", id: 655, exportName: "gladiator-chant.wav" },
    { file: "j.mp3", id: 2248, exportName: null }
  ]
});
const FILES = arenaSoundFilesFrom(MANIFEST);

/* ------------------------------------------------------------------ */
/* The pack                                                            */
/* ------------------------------------------------------------------ */

test("each sound is found in the player's own pack by the build's export name or StartSound id — never by a file name", () => {
  assert.deepEqual({ ...FILES }, {
    ambience: "a.mp3", cheer: "b.mp3", boo: "c.mp3",
    victory1: "d.mp3", victory2: "e.mp3", victory3: "f.mp3",
    intro: "g.mp3", won: "h.mp3", lost: "j.mp3"
  });
  assert.equal(Object.values(FILES).includes("i.mp3"), false,
    "the gladiator chant is the LEVEL-UP screen's (root frame 227), not the arena's");
  assert.equal(SS2_ARENA_SOUNDS.cheer.channel, SS2_ARENA_SOUNDS.ambience.channel, "the cheer is on the crowd's clip");
  assert.equal(SS2_ARENA_SOUNDS.boo.channel, ArenaSoundChannel.CROWD);
  assert.equal(SS2_ARENA_SOUNDS.victory2.channel, ArenaSoundChannel.SOUNDS, "the stings are on `sounds`, never given a volume");
});

test("no pack, a broken pack, or a pack missing a sound is silence for that sound — never a throw", () => {
  for (const manifest of [null, undefined, {}, { sounds: "no" }, { sounds: [null, 7, { file: "" }] }]) {
    assert.ok(Object.values(arenaSoundFilesFrom(manifest)).every((file) => file === null));
  }
  const partial = arenaSoundFilesFrom({ sounds: [{ file: "x.mp3", exportName: "rockyou.wav" }] });
  assert.equal(partial.cheer, "x.mp3");
  assert.equal(partial.ambience, null);
  assert.deepEqual({ ...soundSecondsFrom(MANIFEST) }, { "a.mp3": 10, "b.mp3": 34171 / 11025 },
    "a loop's length is the pack's sampleCount over its rate, and absent where the pack does not say");
});

/* ------------------------------------------------------------------ */
/* The crowd's rules                                                   */
/* ------------------------------------------------------------------ */

test("the crowd's volume is the build's Math.round(crowd_interest / 2) + 4, stepped, 5..54 over the clamped range", () => {
  const table = [[1, 5], [3, 6], [19, 14], [20, 14], [24, 16], [70, 39], [71, 40], [100, 54]];
  for (const [interest, volume] of table) assert.equal(crowdVolumeFor(interest), volume, `crowd ${interest}`);
  assert.equal(crowdGainFor(100), 0.54);
  // AUTHORED clamp: a strong opening sums past 100 before the first phase.
  assert.equal(crowdVolumeFor(240), 124);
  assert.equal(crowdGainFor(240), 1);
  assert.equal(crowdGainFor(Number.NaN), 0);
});

test("the crowd is heard when ANY fighter is above level 1 — the build's hero.herolevel > 1, read for everyone (AUTHORED)", () => {
  assert.equal(crowdHeardFor([1, 1, 1, 1]), false, "an all-level-1 bout is the build's silent prologue crowd");
  assert.equal(crowdHeardFor([1, 1, 2]), true);
  assert.equal(crowdHeardFor([4, 4, 4, 4, 4, 4]), true);
  assert.equal(crowdHeardFor([]), false);
  assert.equal(crowdHeardFor([Number.NaN, undefined]), false);
  assert.equal(SS2_CROWD_SOUND.levelAbove, 1);
});

test("the roll is the build's 1 + random(1000): 1..1000, a pure function of the seed and the BUILD frame, about 1 in 1000", () => {
  let hits = 0;
  let low = Infinity;
  let high = -Infinity;
  for (let frame = 0; frame < 1_000_000; frame += 1) {
    const roll = crowdRoll(7, frame);
    if (roll === 1000) hits += 1;
    if (roll < low) low = roll;
    if (roll > high) high = roll;
  }
  assert.equal(low, 1);
  assert.equal(high, 1000);
  // Binomial(1e6, 1/1000): mean 1000, sd 31.6. Five sd either side.
  assert.ok(hits > 842 && hits < 1158, `${hits} hits in a million frames`);
  // No hidden state: the same frames rolled in reverse order give the same numbers.
  const forward = Array.from({ length: 256 }, (_, frame) => crowdRoll(7, frame));
  const backward = [];
  for (let frame = 255; frame >= 0; frame -= 1) backward[frame] = crowdRoll(7, frame);
  assert.deepEqual(backward, forward, "a frame's roll depends on the seed and the frame alone");
  const seven = Array.from({ length: 64 }, (_, frame) => crowdRoll(7, frame));
  const eight = Array.from({ length: 64 }, (_, frame) => crowdRoll(8, frame));
  assert.notDeepEqual(seven, eight, "another seed is another crowd");
});

test("the cheer is above 70 and the boo below 20, strictly, and only on a roll of exactly 1000", () => {
  assert.equal(crowdCallFor(71, 1000), "cheer");
  assert.equal(crowdCallFor(70, 1000), null, "Greater, not Greater-or-equal");
  assert.equal(crowdCallFor(19, 1000), "boo");
  assert.equal(crowdCallFor(20, 1000), null, "Less2, not Less-or-equal");
  assert.equal(crowdCallFor(45, 1000), null);
  assert.equal(crowdCallFor(100, 999), null);
  assert.equal(crowdCallFor(Number.NaN, 1000), null);
});

test("the sting is the build's ladder at combat_exp, and the winning side's HIGHEST level picks it (AUTHORED)", () => {
  const ladder = [[1, "victory1"], [2, "victory1"], [3, "victory2"], [5, "victory2"], [6, "victory3"], [24, "victory3"]];
  for (const [level, sting] of ladder) assert.equal(victoryStingFor(level), sting, `level ${level}`);
  assert.equal(victoryStingFor(2.5), null, "no rung takes 2.5, as none does in the build");
  assert.equal(victoryStingFor(Number.NaN), null);
  assert.equal(winningSideLevel([2, 6, 3]), 6);
  assert.equal(winningSideLevel([6, 3, 2]), 6, "whatever order the side is listed in");
  assert.equal(winningSideLevel([]), null);
  assert.equal(winningSideLevel(undefined), null);
});

/* ------------------------------------------------------------------ */
/* The crowd a spectator hears                                         */
/* ------------------------------------------------------------------ */

test("the crowd is a HISTORY: each step's value from the moment its drawing ENDS, and a later one never overtakes", () => {
  let presenter = createCrowdPresenter(24);
  presenter = queueCrowdInterest(presenter, 22, 5000);
  presenter = queueCrowdInterest(presenter, 30, 4000);
  assert.equal(crowdInterestAt(presenter, 4999), 24, "still being drawn");
  assert.equal(crowdInterestAt(presenter, 5000), 30, "the later step, stamped earlier, takes effect with the earlier one");
  assert.equal(crowdInterestAt(queueCrowdInterest(createCrowdPresenter(24), 22, 5000), 5000), 22);
  const settled = settleCrowdInterest(queueCrowdInterest(presenter, 40, 9000), 6000);
  assert.equal(settled.changes.length, 1, "changes a second old fold into the opening");
  assert.equal(crowdInterestAt(settled, 6000), 30);
  assert.equal(crowdInterestAt(settled, 9000), 40);
  assert.equal(crowdInterestAt(null, 0), null);
  assert.equal(crowdInterestAt(createCrowdPresenter(Number.NaN), 0), null);
});

test("a step's drawing ends with its latest clip chain or projectile — where the gate opens", () => {
  const chain = { startedAt: 100, timeline: { durationMs: 400 }, then: { timeline: { durationMs: 900 } } };
  assert.equal(stepEndsAtMs({ entries: [chain, { startedAt: 300, timeline: { durationMs: 200 } }], fallbackMs: 7 }), 1400);
  assert.equal(stepEndsAtMs({ entries: [chain], projectiles: [{ startedAt: 50, durationMs: 2000 }] }), 2050,
    "an arrow still flying holds the phase, as `bullet_in_air` does");
  assert.equal(stepEndsAtMs({ fallbackMs: 7 }), 7, "a step that draws nothing is heard at once");
});

/* ------------------------------------------------------------------ */
/* The deciding blow                                                   */
/* ------------------------------------------------------------------ */

/** A molten-death batch: a burning reaction, a death queued behind it, rocks landing on the given frames. */
function showerBatch({ landings, lethal }) {
  return [
    { kind: "clip-goto", role: "target", combatantId: "blue-1", label: "burning" },
    ...landings.map((frame, index) => ({
      kind: "attach-effect", effect: "boulder_combat", targetId: "blue-1", boulder: index,
      fall: { landingFrame: frame }, lethal: index === lethal
    })),
    { kind: "clip-goto", role: "defeated", combatantId: "blue-1", label: "death1" }
  ];
}

test("the result lands with the LETHAL rock, not the first — the burn starts at the first, the death at the lethal one", () => {
  const batch = showerBatch({ landings: [6, 9, 12], lethal: 1 });
  assert.equal(reactionDelaysFor(batch).get("blue-1"), 6 * PROJECTILE_FRAME_MS, "the reaction still starts at the first rock");
  assert.equal(decidingBlowMsFor(batch), 9 * PROJECTILE_FRAME_MS, "but the fight is decided at frame 9");
  // A melee blow decides with its batch; so does a batch naming no defeat.
  assert.equal(decidingBlowMsFor([{ kind: "clip-goto", role: "defeated", combatantId: "blue-2" }]), 0);
  assert.equal(decidingBlowMsFor([]), 0);
});

test("a REAL bout decided by a shower (?items=doom, seed 1, 1v1): victory at the lethal rock's frame 8, not the first rock's 6", () => {
  const items = arenaRequestFrom(new URLSearchParams("items=doom")).items;
  const host = createVanillaBattleHost({
    teams: [
      demoSide("red", 1, { ss2Combatant, ss2BattleValues, items, seed: 1 }),
      demoSide("blue", 1, { ss2Combatant, ss2BattleValues, items, seed: 1 })
    ],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed: 1,
    awaitAnimations: false
  });
  let step = null;
  for (let actions = 0; !host.battle.result && actions < 600; actions += 1) {
    step = host.submit({ actorId: host.currentCombatantId(), ...host.suggestAction() });
  }
  assert.ok(host.battle.result, "the bout is decided");
  const rocks = step.commands.filter((command) => command.kind === "attach-effect" && command.effect === "boulder_combat");
  const lethal = rocks.find((command) => command.lethal === true);
  assert.ok(lethal, "by a shower");
  assert.deepEqual([Math.min(...rocks.map((rock) => rock.fall.landingFrame)), lethal.fall.landingFrame], [6, 8]);
  assert.equal(Math.max(0, ...reactionDelaysFor(step.commands).values()), 200, "the reaction clock: 67 ms early");
  assert.equal(decidingBlowMsFor(step.commands), 8 * PROJECTILE_FRAME_MS);
});

/* ------------------------------------------------------------------ */
/* The director                                                        */
/* ------------------------------------------------------------------ */

const BASE = Object.freeze({ boutStartMs: 1000, seed: 7, crowdHeard: true, files: FILES });

/** Drive the director from `fromMs` to `toMs` at a display rate, returning every action with its time. */
function drive({ fromMs = 1000, toMs, stepMs, input = {}, outcome = () => "played", state = createArenaSoundState() }) {
  const log = [];
  let now = fromMs;
  for (; now <= toMs; now += stepMs) {
    const crowd = input.crowd ? settleCrowdInterest(input.crowd, now - 1000) : undefined;
    const step = arenaSoundStep(state, { ...BASE, ...input, ...(crowd ? { crowd } : {}), nowMs: now });
    state = step.state;
    for (const action of step.actions) {
      log.push({ now, ...action });
      state = arenaSoundSettled(state, action, outcome(action, now));
    }
  }
  return { log, state };
}

const starts = (log, sound) => log.filter((entry) => entry.kind === "start" && entry.sound === sound);

test("the ambience loops at the crowd's volume on every draw while it is heard — volume FIRST — and not at all when it is not", () => {
  const { actions } = arenaSoundStep(createArenaSoundState(), { ...BASE, nowMs: 1000, crowdInterest: 24, started: true });
  assert.deepEqual(actions, [
    { kind: "volume", channel: "crowdsounds", gain: 0.16 },
    { kind: "loop", sound: "ambience", channel: "crowdsounds", file: "a.mp3" }
  ]);
  const silent = arenaSoundStep(createArenaSoundState(), { ...BASE, nowMs: 1000, crowdInterest: 24, crowdHeard: false, started: true });
  assert.deepEqual(silent.actions, [], "a level-1 bout has no crowd at all");
  const none = arenaSoundStep(createArenaSoundState(), { ...BASE, nowMs: 1000, crowdInterest: null, started: true });
  assert.deepEqual(none.actions, [], "a battle that declares no crowd has none to hear");
});

test("cheers fire on the BUILD'S frames: the same frames at 30, 60 and 144 fps, each once, and never while the crowd is in the middle", () => {
  const input = { crowdInterest: 90, started: true };
  const span = 60_000;
  // Compared below the last few frames, where a display rate's final draw may fall either side of one.
  const cutoff = Math.floor(span / CROWD_FRAME_MS) - 10;
  const at = (rate) => starts(drive({ toMs: 1000 + span, stepMs: 1000 / rate, input }).log, "cheer")
    .map((entry) => entry.frame).filter((frame) => frame < cutoff);
  const thirty = at(30);
  assert.ok(thirty.length > 0, "a minute above 70 cheers, on the shipped seed");
  assert.deepEqual(at(60), thirty);
  assert.deepEqual(at(144), thirty);
  assert.equal(new Set(thirty).size, thirty.length, "no frame fires twice");
  // The frames are exactly the ones whose roll is 1000.
  const expected = [];
  for (let frame = 0; frame < cutoff; frame += 1) {
    if (crowdRoll(7, frame) === 1000) expected.push(frame);
  }
  assert.deepEqual(thirty, expected);
  assert.deepEqual(starts(drive({ toMs: 1000 + span, stepMs: 1000 / 60, input: { crowdInterest: 45, started: true } }).log, "cheer"), []);
  const boos = starts(drive({ toMs: 1000 + span, stepMs: 1000 / 60, input: { crowdInterest: 10, started: true } }).log, "boo");
  assert.deepEqual(boos.map((entry) => entry.frame).filter((frame) => frame < cutoff), expected,
    "the boo rolls the same stream, in its own band");
  assert.ok(boos.every((entry) => entry.channel === "crowdsounds" && entry.file === "c.mp3"));
});

test("A DRAW CATCHING UP IS JUDGED BY THE CROWD AT EACH FRAME: seed 7's winning roll at frame 664, the crowd 71 -> 70 ten ms later", () => {
  // Codex's reproduction (gpt-6-astra): judged by the draw's crowd, a draw before
  // the change cheered and a draw after it, catching up on the same frame, did not.
  assert.equal(crowdRoll(7, 664), 1000);
  const frameAt = 1000 + 664 * CROWD_FRAME_MS;
  const crowd = queueCrowdInterest(createCrowdPresenter(71), 70, frameAt + 10);
  const cheersWith = (draws) => {
    let state = { ...createArenaSoundState(), intro: "none" };
    const heard = [];
    for (const now of draws) {
      const step = arenaSoundStep(state, { ...BASE, nowMs: now, crowd, started: true });
      state = step.state;
      heard.push(...step.actions.filter((action) => action.sound === "cheer").map((action) => action.frame));
    }
    return heard;
  };
  assert.deepEqual(cheersWith([frameAt - 20, frameAt + 5]), [664], "a draw before the change");
  assert.deepEqual(cheersWith([frameAt - 20, frameAt + 15]), [664], "a draw after it: the same frame, the same crowd");
});

test("the same cheers and boos at 30, 60 and 144 fps and on a ragged clock, with the crowd crossing 70 and 20 around every winning roll", () => {
  // Seed 7's first ten winning rolls, each with a band edge placed just before
  // or just after it — the frames a display rate could otherwise decide.
  const hits = [];
  for (let frame = 0; hits.length < 10; frame += 1) if (crowdRoll(7, frame) === 1000) hits.push(frame);
  const offsets = [10, -10, 3, -3, 25, -25, 1, -1, 16, -16];
  let crowd = createCrowdPresenter(45);
  hits.forEach((frame, index) => {
    const at = 1000 + frame * CROWD_FRAME_MS + offsets[index];
    // Alternate the cheer band's edge and the boo band's.
    const [before, after] = index % 2 === 0 ? [71, 70] : [19, 20];
    const swap = index % 4 < 2;
    crowd = queueCrowdInterest(crowd, swap ? before : after, at - 400);
    crowd = queueCrowdInterest(crowd, swap ? after : before, at);
    crowd = queueCrowdInterest(crowd, 45, at + 400);
  });
  const expected = [];
  for (let frame = 0; frame <= hits.at(-1) + 30; frame += 1) {
    const call = crowdCallFor(crowdInterestAt(crowd, 1000 + frame * CROWD_FRAME_MS), crowdRoll(7, frame));
    if (call) expected.push(`${frame}:${call}`);
  }
  assert.ok(expected.some((entry) => entry.endsWith("cheer")) && expected.some((entry) => entry.endsWith("boo")),
    `both bands are exercised: ${expected.join(" ")}`);
  assert.ok(expected.length < hits.length, "and some winning rolls fall just outside their band");
  const toMs = 1000 + (hits.at(-1) + 30) * CROWD_FRAME_MS;
  const heard = (log) => log.filter((entry) => entry.sound === "cheer" || entry.sound === "boo").map((entry) => `${entry.frame}:${entry.sound}`);
  for (const rate of [30, 60, 144]) {
    assert.deepEqual(heard(drive({ toMs, stepMs: 1000 / rate, input: { crowd, started: true } }).log), expected, `${rate} fps`);
  }
  // A ragged clock: draws 5-41 ms apart, from a fixed sequence.
  let state = createArenaSoundState();
  const ragged = [];
  for (let now = 1000, index = 0; now <= toMs; now += 5 + ((index * 17) % 37), index += 1) {
    const step = arenaSoundStep(state, { ...BASE, nowMs: now, crowd: settleCrowdInterest(crowd, now - 1000), started: true });
    state = step.state;
    ragged.push(...step.actions.map((action) => ({ ...action })));
  }
  assert.deepEqual(heard(ragged), expected, "ragged");
});

test("a tab back from the background does not burst: frames older than the stale window are skipped whole", () => {
  const state = { ...createArenaSoundState(), frame: 0 };
  const late = arenaSoundStep(state, { ...BASE, nowMs: 1000 + 600_000, crowdInterest: 90, started: true });
  const calls = late.actions.filter((action) => action.kind === "start");
  const window = Math.ceil(SOUND_STALE_MS / CROWD_FRAME_MS) + 1;
  assert.ok(calls.length <= window, `${calls.length} calls after ten minutes away`);
  assert.equal(late.state.frame, Math.floor(600_000 / CROWD_FRAME_MS));
});

test("the result: the win sound at combat_won, the crowd stopped 7 frames later, the sting 40 frames after — by the winner's level", () => {
  const result = { atMs: 11_000, winnerTeamId: "red", winnerLevel: 4 };
  const { log } = drive({ toMs: 14_000, stepMs: 1000 / 60, input: { crowdInterest: 90, started: true, result } });
  const won = starts(log, "won");
  assert.equal(won.length, 1);
  assert.ok(won[0].now >= 11_000 && won[0].now < 11_000 + 17, "on the first draw at or after combat_won");
  assert.equal(won[0].channel, "arena");
  const stop = log.filter((entry) => entry.kind === "stop");
  assert.equal(stop.length, 1, "stopped once");
  assert.equal(stop[0].channel, "crowdsounds");
  assert.ok(stop[0].now >= 11_000 + 7 * CROWD_FRAME_MS && stop[0].now < 11_000 + 7 * CROWD_FRAME_MS + 17, "frame 88: 7 after combat_won");
  assert.equal(log.filter((entry) => entry.kind === "loop" && entry.now >= stop[0].now).length, 0, "no loop after the stop");
  assert.equal(log.filter((entry) => entry.sound === "cheer" && entry.now >= 11_000 + 7 * CROWD_FRAME_MS).length, 0,
    "no cheer rolls once the panel is gone");
  const sting = starts(log, "victory2");
  assert.equal(sting.length, 1, "level 4 is victory2");
  assert.equal(sting[0].channel, "sounds");
  assert.ok(sting[0].now >= 11_000 + 40 * CROWD_FRAME_MS && sting[0].now < 11_000 + 40 * CROWD_FRAME_MS + 17);
  assert.deepEqual(resultSoundsFor({ winnerTeamId: null }, FILES).map((event) => event.kind), ["stop"],
    "a draw — no path in the build — only sends the crowd home (AUTHORED)");
  assert.deepEqual(resultSoundsFor({ winnerTeamId: "blue", winnerLevel: 1 }, FILES).map((event) => [event.sound, event.atFrames]),
    [["won", 0], ["ambience", 7], ["victory1", 40]]);
});

test("a person who played only the LOSING side hears combat_lost: the crowd stopped at once, 2248 65 frames later, no win and no victory sting", () => {
  // The build's loss path: sprite 2249 frame 250 stops `crowd_noise` on the
  // label itself (+0x0061-+0x007c), and frame 315 carries StartSound 2248.
  assert.equal(SS2_ARENA_SOUNDS.lost.soundId, 2248);
  assert.equal(SS2_ARENA_SOUNDS.lost.channel, ArenaSoundChannel.ARENA, "a StartSound on the arena's own timeline");
  assert.deepEqual([SS2_CROWD_SOUND.lostStopAfterFrames, SS2_CROWD_SOUND.lostStingAfterFrames], [0, 315 - 250]);
  const lost = { atMs: 11_000, winnerTeamId: "blue", winnerLevel: 4, lost: true };
  assert.deepEqual(resultSoundsFor(lost, FILES).map((event) => [event.kind, event.sound, event.atFrames]),
    [["stop", "ambience", 0], ["start", "lost", 65]]);
  assert.equal(crowdStopFramesFor(lost), 0);
  const { log } = drive({ toMs: 14_000, stepMs: 1000 / 60, input: { crowdInterest: 90, started: true, result: lost } });
  assert.equal(starts(log, "won").length, 0, "no win sound for the loser");
  assert.equal(log.filter((entry) => /^victory/.test(entry.sound ?? "")).length, 0, "and no victory sting");
  const stop = log.filter((entry) => entry.kind === "stop");
  assert.equal(stop.length, 1, "stopped once");
  assert.ok(stop[0].now >= 11_000 && stop[0].now < 11_000 + 17, "on the first draw at or after combat_lost");
  assert.equal(log.filter((entry) => entry.kind === "loop" && entry.now >= stop[0].now).length, 0, "no loop after the stop");
  const sting = starts(log, "lost");
  assert.equal(sting.length, 1);
  assert.equal(sting[0].file, "j.mp3");
  assert.ok(sting[0].now >= 11_000 + 65 * CROWD_FRAME_MS && sting[0].now < 11_000 + 65 * CROWD_FRAME_MS + 17, "frame 315");

  // `lost` means nothing without a winner (a draw has no losing hero), and a
  // result WITHOUT it is the win exactly as before — which is every result the
  // arena made before seats existed.
  assert.deepEqual(resultSoundsFor({ winnerTeamId: null, lost: true }, FILES).map((event) => [event.kind, event.atFrames]), [["stop", 7]]);
  assert.deepEqual(resultSoundsFor({ winnerTeamId: "blue", winnerLevel: 4, lost: false }, FILES).map((event) => [event.sound, event.atFrames]),
    [["won", 0], ["ambience", 7], ["victory2", 40]]);
  assert.equal(crowdStopFramesFor({ winnerTeamId: "blue" }), 7);
  // A pack without 2248 still stops the crowd.
  assert.deepEqual(resultSoundsFor(lost, { ...FILES, lost: null }).map((event) => event.kind), ["stop"]);
});

test("a late draw drops a stale sting but never a stop — a crowd left looping is worse than a late stop", () => {
  const result = { atMs: 2000, winnerTeamId: "red", winnerLevel: 9 };
  const { actions, dropped, state } = arenaSoundStep(createArenaSoundState(),
    { ...BASE, nowMs: 60_000, crowdInterest: 50, started: true, result });
  assert.deepEqual(actions.filter((action) => action.kind !== "start" || action.sound !== "intro").map((action) => action.kind), ["stop"]);
  assert.deepEqual(dropped.map((event) => event.sound), ["won", "victory3"]);
  assert.equal(state.crowdStopped, true);
});

test("the intro plays before the first action, is retried while the browser holds sound back, and is gone once the fight starts", () => {
  let state = createArenaSoundState();
  const first = arenaSoundStep(state, { ...BASE, nowMs: 1000, crowdInterest: 24 });
  const intro = first.actions.find((action) => action.sound === "intro");
  assert.deepEqual(intro, { kind: "start", sound: "intro", channel: "arena", file: "g.mp3", settles: "intro" });
  state = arenaSoundSettled(first.state, intro, "blocked");
  assert.equal(state.intro, "waiting", "held back: tried again");
  const second = arenaSoundStep(state, { ...BASE, nowMs: 1017, crowdInterest: 24 });
  state = arenaSoundSettled(second.state, second.actions.find((action) => action.sound === "intro"), "played");
  assert.equal(state.intro, "played");
  assert.equal(arenaSoundStep(state, { ...BASE, nowMs: 1034, crowdInterest: 24 }).actions.some((action) => action.sound === "intro"), false);
  const missed = arenaSoundStep(createArenaSoundState(), { ...BASE, nowMs: 1000, crowdInterest: 24, started: true });
  assert.equal(missed.state.intro, "missed", "the pre-fight screen is over: not played late");
  assert.equal(arenaSoundSettled(first.state, intro, "off").intro, "silenced", "turned off is done, not deferred");
  // The pack is fetched after the bout is built: the first draws see no files, and the intro waits for them.
  const early = arenaSoundStep(createArenaSoundState(), { ...BASE, nowMs: 1000, crowdInterest: 24, files: arenaSoundFilesFrom(null) });
  assert.equal(early.state.intro, "waiting");
  assert.deepEqual(early.actions, []);
  const landed = arenaSoundStep(early.state, { ...BASE, nowMs: 1100, crowdInterest: 24 });
  assert.ok(landed.actions.some((action) => action.sound === "intro"), "and plays once the pack lands");
});

test("A PENDING intro is neither started again nor counted played: a rejection makes it retryable, a resolution plays it", () => {
  // Codex (gpt-6-astra): the element fallback's play() is a promise, and the
  // first version settled the intro "played" the moment it was asked for.
  let state = createArenaSoundState();
  const first = arenaSoundStep(state, { ...BASE, nowMs: 1000, crowdInterest: 24 });
  const intro = first.actions.find((action) => action.sound === "intro");
  state = arenaSoundSettled(first.state, intro, "pending");
  assert.equal(state.intro, "pending");
  const waiting = arenaSoundStep(state, { ...BASE, nowMs: 1017, crowdInterest: 24 });
  assert.equal(waiting.actions.some((action) => action.sound === "intro"), false, "no second start while the first is pending");
  state = arenaSoundSettled(waiting.state, intro, "blocked");
  assert.equal(state.intro, "waiting", "the browser refused it: tried again");
  const again = arenaSoundStep(state, { ...BASE, nowMs: 1034, crowdInterest: 24 });
  assert.equal(again.actions.filter((action) => action.sound === "intro").length, 1);
  state = arenaSoundSettled(arenaSoundSettled(again.state, intro, "pending"), intro, "played");
  assert.equal(state.intro, "played");
  // Pending across the first action: it is the browser's answer, not the fight, that settles it.
  const pendingStarted = arenaSoundStep(arenaSoundSettled(first.state, intro, "pending"), { ...BASE, nowMs: 1017, crowdInterest: 24, started: true });
  assert.equal(pendingStarted.state.intro, "pending");
  assert.equal(arenaSoundStep(arenaSoundSettled(pendingStarted.state, intro, "blocked"), { ...BASE, nowMs: 1034, crowdInterest: 24, started: true }).state.intro,
    "missed", "refused after the fight began: not played late");
});

test("the ambience comes back on the next draw whatever stopped it — it is asked for on every draw", () => {
  let state = createArenaSoundState();
  const loops = [];
  for (let now = 1000; now < 1100; now += 17) {
    const step = arenaSoundStep(state, { ...BASE, nowMs: now, crowdInterest: 50, started: true });
    state = step.state;
    loops.push(step.actions.filter((action) => action.kind === "loop").length);
  }
  assert.ok(loops.every((count) => count === 1));
});

/* ------------------------------------------------------------------ */
/* It never reaches the battle                                         */
/* ------------------------------------------------------------------ */

test("a whole seeded 3v3 bout, heard: the director reads the host and changes nothing — same hash, same winner, same sounds twice", () => {
  const run = () => {
    const host = createVanillaBattleHost({
      teams: [demoSide("red", 3, { ss2Combatant, ss2BattleValues }), demoSide("blue", 3, { ss2Combatant, ss2BattleValues })],
      rules: ss2TeamRules,
      bindings: SS2_STATIC_MAP_BINDINGS,
      seed: 7,
      awaitAnimations: false
    });
    const levels = host.battle.teams.flatMap((team) => team.combatants.map((combatant) => combatant.resources.herolevel.value));
    let state = createArenaSoundState();
    const heard = [];
    let now = 0;
    for (let actions = 0; !host.battle.result && actions < 400; actions += 1) {
      host.submit({ actorId: host.currentCombatantId(), ...host.suggestAction() });
      // Two build seconds of drawing per action, at 60 fps.
      for (let draw = 0; draw < 120; draw += 1, now += 1000 / 60) {
        const step = arenaSoundStep(state, {
          nowMs: now, boutStartMs: 0, seed: 7, files: FILES, started: true,
          crowdInterest: ss2CrowdInterestOf(host.battle), crowdHeard: crowdHeardFor(levels)
        });
        state = step.state;
        heard.push(...step.actions.filter((action) => action.kind === "start").map((action) => `${action.frame}:${action.sound}`));
      }
    }
    return { hash: host.hash(), result: host.battle.result, heard };
  };
  const plain = (() => {
    const host = createVanillaBattleHost({
      teams: [demoSide("red", 3, { ss2Combatant, ss2BattleValues }), demoSide("blue", 3, { ss2Combatant, ss2BattleValues })],
      rules: ss2TeamRules,
      bindings: SS2_STATIC_MAP_BINDINGS,
      seed: 7,
      awaitAnimations: false
    });
    for (let actions = 0; !host.battle.result && actions < 400; actions += 1) {
      host.submit({ actorId: host.currentCombatantId(), ...host.suggestAction() });
    }
    return { hash: host.hash(), result: host.battle.result };
  })();
  const first = run();
  const second = run();
  assert.equal(first.hash, plain.hash, "listening to the crowd changed nothing in the battle");
  assert.deepEqual(first.result, plain.result);
  assert.deepEqual(second.heard, first.heard, "and the same bout sounds the same, call for call");
});
