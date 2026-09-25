/**
 * THE ARENA'S OWN SOUNDS — the ones the build plays from CODE and from the
 * arena's own timelines, not from the fighter clip: the crowd's ambience at its
 * live volume, its chance cheers and boos, the win sound and the victory sting,
 * the loss sting (a person who played only the losing side, 2026-09-24) and the
 * pre-fight intro. WHEN and WHICH are decided here; the playing is
 * `tools/arena/sound-player.js`'s `perform`.
 *
 * `sound-timing.js` is the fighter clip's half of the same job. The two do not
 * share a mechanism because the build does not: the fighter's sounds are
 * `StartSound` tags on its timeline, and these are AS2 `Sound` objects.
 *
 * ## Where the build does it (re-read from the action dump, 2026-09-24)
 *
 * ```text
 *   THE BANK     root/frame:10/DoAction@0x3c3895 soundeffects() (DefineFunction2 +0x039d, r1 = _root)
 *                  _root.createEmptyMovieClip("crowdsounds", -50001)        +0x03b4
 *                  crowd_noise = new Sound(crowdsounds) + "crowd-ambient.wav" +0x03c9-+0x03f0
 *                  rockyou     = new Sound(crowdsounds) + "rockyou.wav"       +0x03f1-+0x0418
 *                  crowd_boo   = new Sound(crowdsounds) + "boo-crowd.wav"     +0x0419-+0x0440
 *                  _root.createEmptyMovieClip("sounds", -50003)               +0x04a6
 *                  victory1/2/3 = new Sound(sounds) + "victory1/2/3.wav"      +0x04e3-+0x055a
 *   LOAD         sprite:751[combat_panel] crowd_bar clip-action:0 (0x225e5d)
 *                  if (_root.game.hero.herolevel > 1) {                       +0x0159-+0x017b
 *                    crowd_noise.start(0, 99999)                              +0x0180-+0x01a5
 *                    crowd_noise.setVolume(0) }                               +0x01a6-+0x01c6
 *   EVERY FRAME  crowd_bar clip-action:1 (0x226086), whole body under the same gate (+0x00d0-+0x00f2)
 *                  crowd_noise.setVolume(Math.round(crowd_interest / 2) + 4)  +0x00f7-+0x013d
 *                  if (crowd_interest > 70 && 1 + random(1000) == 1000) rockyou.start()   +0x013e-+0x019b
 *                  if (crowd_interest < 20 && 1 + random(1000) == 1000) crowd_boo.start() +0x019c-+0x01f9
 *   THE WIN      sprite:2249[arena] frame 81 combat_won: StartSound 2228 (envelope)   startsounds.txt
 *                frame 88 +0x03e1-+0x03fc: crowd_noise.stop(), after combat_panel.removeMovieClip()
 *                frame 88 gotoAndPlay("combat_delay") +0x09b1/+0x09c7 -> 189, no Stop to 222
 *                frame 222 combat_exp (DoAction@0x6e6347), by _root.game.hero.herolevel:
 *                  <= 2 victory1.start() +0x00d6;  3..5 victory2.start() +0x0149;  > 5 victory3.start() +0x0191
 *   THE LOSS     frame 250 combat_lost +0x0061-+0x007c: crowd_noise.stop(), after combat_panel.removeMovieClip()
 *                frame 315 (no Stop from 250, which ends in Play): StartSound 2248, with fight_over_lost (2247)
 *                placed at depth 18                                           startsounds.txt
 *   PRE-FIGHT    sprite:2224[arena_intro] frame 1 (DoAction@0x66ffb1): unless
 *                tournament_ranking == 2 (+0x16ca), GotoFrame 1 (+0x17d3), i.e.
 *                frame 2, whose StartSound 654 plays (a 5.41 s sting). The
 *                champion final plays 2223 at frame 4 instead (gotoAndStop(4),
 *                +0x17af). Root frame 221, the arena, stops only town_day and
 *                town_night (+0x0378-+0x03af), so no byte stops 654 as the
 *                fight begins — UNMEASURED whether those two stops, on Sounds
 *                whose `townsounds` clip `sounds` replaced at depth -50003, reach
 *                further in a real player.
 * ```
 *
 * Frame counts: 81 -> 88 is 7 frames (82-87 carry no action); 88 jumps to 189
 * and 189 -> 222 is 33 more, so the sting starts 40 of the build's 30 fps
 * frames after `combat_won`. The loss stops the crowd ON `combat_lost` (250)
 * and its sting, 2248, starts 65 frames later (315; the arena clip's actions
 * sit at 249, 250, 315 and 334, and only 249 and 334 are `Stop`). Counted from
 * the frames, never measured.
 *
 * ► **SOUNDS ON ONE TARGET CLIP SHARE ITS VOLUME AND ITS `stop()`**, which is
 *   AS2's documented `Sound(target)` model, NOT a byte fact and NOT measured in
 *   this build: `setVolume` sets the target clip's sound transform, and a
 *   no-argument `stop()` stops what is sounding on that clip. So a cheer plays
 *   at the crowd's current volume (40-54 above 70), a boo at 5-14, and the
 *   frame-88 stop cuts either off. The stings live on `sounds`, which nothing
 *   ever calls `setVolume` on (6 `setVolume` sites in the whole dump: two here,
 *   two in `toggleSound`, two on `town_day`), so they play at 100. That is
 *   what the CHANNELS below reproduce: `crowdsounds`, `sounds`, and `arena`
 *   for the timeline sounds.
 *
 * ## Authored for team play, and labelled where they are decided
 *
 * - **Who is "the hero"** (`crowdHeardFor`, `winningSideLevel`): the build
 *   reads `_root.game.hero.herolevel` for the crowd's gate and for the sting.
 * - **One crowd per battle** (owner decision f): one ambience loop.
 * - **The chance is a seeded stream** (`crowdRoll`), never `Math.random`, and
 *   never the battle's RNG.
 * - **The value heard is the value the drawing has reached**, stamped with
 *   the moment each step's drawing ends (`crowdInterestAt`).
 */

import { SOUND_STALE_MS } from "./sound-timing.js";
import { reactionDelaysFor } from "./cursor.js";
import { PROJECTILE_FRAME_MS } from "./projectile.js";

/** One of the build's frames: `Movie: 30 fps` in the dump header, `cues.frameRate` in the sound pack. */
export const CROWD_FRAME_MS = 1000 / 30;

/** The build's `Sound` target clips, and the arena clip whose timeline starts the rest. */
export const ArenaSoundChannel = Object.freeze({
  /** `_root.crowdsounds`: the ambience, the cheer and the boo share its volume and its stop. */
  CROWD: "crowdsounds",
  /** `_root.sounds`: the stings. Never given a volume, so 100. */
  SOUNDS: "sounds",
  /** A `StartSound` on the arena's own timelines (2224 `arena_intro`, 2249 `arena`): 100. */
  ARENA: "arena"
});

/**
 * EVERY SOUND THIS MODULE CAN PLAY, by how the player's own pack names it: the
 * EXPORT NAME the build's `attachSound` uses, or the `StartSound` id for the two
 * timeline sounds that have no export. Resolved against the pack by
 * `arenaSoundFilesFrom`, so nothing here names a file.
 */
export const SS2_ARENA_SOUNDS = Object.freeze({
  ambience: Object.freeze({ exportName: "crowd-ambient.wav", channel: ArenaSoundChannel.CROWD, site: "soundeffects +0x03c9" }),
  cheer: Object.freeze({ exportName: "rockyou.wav", channel: ArenaSoundChannel.CROWD, site: "soundeffects +0x03f1" }),
  boo: Object.freeze({ exportName: "boo-crowd.wav", channel: ArenaSoundChannel.CROWD, site: "soundeffects +0x0419" }),
  victory1: Object.freeze({ exportName: "victory1.wav", channel: ArenaSoundChannel.SOUNDS, site: "soundeffects +0x04e3" }),
  victory2: Object.freeze({ exportName: "victory2.wav", channel: ArenaSoundChannel.SOUNDS, site: "soundeffects +0x050b" }),
  victory3: Object.freeze({ exportName: "victory3.wav", channel: ArenaSoundChannel.SOUNDS, site: "soundeffects +0x0533" }),
  /** No export: its only placements are `arena_intro` frames 1 (syncStop) and 2, and the inert bank 665. */
  intro: Object.freeze({ soundId: 654, channel: ArenaSoundChannel.ARENA, site: "sprite:2224[arena_intro] frame 2" }),
  /**
   * No export. Its `SOUNDINFO` carries an ENVELOPE whose points no dump has
   * read, so it is played whole — the policy `unhonouredCuesIn` already applies
   * to a fighter cue with an envelope — and the shell says so once.
   */
  won: Object.freeze({ soundId: 2228, channel: ArenaSoundChannel.ARENA, site: "sprite:2249[arena] frame 81 combat_won", envelope: true }),
  /**
   * No export. The loss sting, played only when a person played the LOSING
   * side alone (`resultSoundsFor`). Its one placement is the arena clip's
   * frame 315, under `combat_lost`; no envelope.
   */
  lost: Object.freeze({ soundId: 2248, channel: ArenaSoundChannel.ARENA, site: "sprite:2249[arena] frame 315, under combat_lost" })
});

/** The crowd's numbers, each at its site above. */
export const SS2_CROWD_SOUND = Object.freeze({
  /** `if (hero.herolevel > 1)` — the Push 1 at clip-action:0 `+0x0171` and clip-action:1 `+0x00e8`. */
  levelAbove: 1,
  /** `Math.round(crowd_interest / 2) + 4` — Push 2 `+0x0103`, Push 4 `+0x011d`. */
  volumeDivisor: 2,
  volumeOffset: 4,
  /** `crowd_interest > 70` (Push 70 `+0x014a`, Greater) and `crowd_interest < 20` (Push 20 `+0x01a8`, Less2). */
  cheerAbove: 70,
  booBelow: 20,
  /** `1 + random(1000) == 1000`: `+0x0159`-`+0x017b` and `+0x01b7`-`+0x01d9`. */
  chance: 1000,
  /** combat_won (81) to the frame-88 stop. */
  stopAfterFrames: 7,
  /** combat_won (81) to 88, then combat_delay (189) to combat_exp (222). */
  stingAfterFrames: 40,
  /** combat_lost (250) stops the crowd on its own frame (`+0x0061`-`+0x007c`). */
  lostStopAfterFrames: 0,
  /** combat_lost (250) to the StartSound 2248 at 315. */
  lostStingAfterFrames: 65
});

/**
 * The files the player's pack holds for each sound, or null for any it lacks.
 * Total: no pack, or a pack with no `sounds` list, is every entry null, and
 * each sound that has no file is simply not played.
 */
export function arenaSoundFilesFrom(manifest) {
  const sounds = Array.isArray(manifest?.sounds) ? manifest.sounds : [];
  const files = {};
  for (const [key, spec] of Object.entries(SS2_ARENA_SOUNDS)) {
    const found = sounds.find((sound) => typeof sound?.file === "string" && sound.file.length > 0 && (
      spec.exportName ? sound.exportName === spec.exportName : sound.id === spec.soundId
    ));
    files[key] = found ? found.file : null;
  }
  return Object.freeze(files);
}

/**
 * The seconds of audio in each file, `sampleCount / rate` from the pack, so a
 * LOOP can end where the sound ends rather than on the MP3's trailing padding.
 * Absent for any file that does not say.
 */
export function soundSecondsFrom(manifest) {
  const out = {};
  for (const sound of Array.isArray(manifest?.sounds) ? manifest.sounds : []) {
    const { file, sampleCount, rate } = sound ?? {};
    if (typeof file !== "string" || !(sampleCount > 0) || !(rate > 0)) continue;
    out[file] = sampleCount / rate;
  }
  return Object.freeze(out);
}

/** The build's volume number for a crowd: `Math.round(crowd_interest / 2) + 4`. NaN in, NaN out. */
export function crowdVolumeFor(crowdInterest) {
  return Math.round(crowdInterest / SS2_CROWD_SOUND.volumeDivisor) + SS2_CROWD_SOUND.volumeOffset;
}

/**
 * The crowd channel's GAIN, 0-1, for a crowd value.
 *
 * ► **CLAMPED AT 100, AND THE CLAMP IS AUTHORED.** `nextphase` keeps the crowd
 *   in 1..100, so the volume is 5..54 — but the OPENING is the sum of every
 *   fighter's level, unclamped until the first completed phase, so six fighters
 *   averaging above level 16 open past 100. AS2 documents `setVolume` as 0-100;
 *   what a player does above it is not measured here, so the gain stops at 1.
 */
export function crowdGainFor(crowdInterest) {
  const volume = crowdVolumeFor(crowdInterest);
  if (!Number.isFinite(volume)) return 0;
  return Math.min(100, Math.max(0, volume)) / 100;
}

/**
 * ► **AUTHORED: WHOSE LEVEL OPENS THE CROWD.** The build asks
 *   `_root.game.hero.herolevel > 1` — a level-1 hero, whose first fight is the
 *   prologue bout, gets no crowd at all. This arena has no single hero: both
 *   sides are played from one seat, or watched. The owner's rule is that the
 *   hero's rule is the player's rule for everyone, so every gladiator above
 *   level 1 would bring the crowd — and there is ONE crowd per battle (decision
 *   f), opened from every fighter's level. So it is heard when ANY fighter on
 *   the field is above level 1: the highest level across both sides.
 *   Deterministic, and it does not depend on which side is drawn first.
 */
export function crowdHeardFor(levels) {
  let highest = -Infinity;
  for (const level of Array.isArray(levels) ? levels : []) {
    if (Number.isFinite(level) && level > highest) highest = level;
  }
  return highest > SS2_CROWD_SOUND.levelAbove;
}

/**
 * ► **AUTHORED: THE WINNING SIDE'S LEVEL, for the sting.** The build plays a
 *   sting only when the hero wins, so at `combat_exp` "the hero" IS the
 *   winner. A side has up to three, and one sting plays: its HIGHEST level,
 *   which picks the same sting whatever order the side is listed in. The level
 *   is the one the bout opened with, which is the build's "before this fight's
 *   experience" (experience lands at frame 231, after the sting at 222) — this
 *   engine never changes `herolevel` mid-bout.
 *
 * Null for a side with no finite level.
 */
export function winningSideLevel(levels) {
  let highest = null;
  for (const level of Array.isArray(levels) ? levels : []) {
    if (Number.isFinite(level) && (highest === null || level > highest)) highest = level;
  }
  return highest;
}

/**
 * The build's sting ladder at `combat_exp`, exactly, or null. The three tests
 * are the build's three `If`s, so a level no rung takes (2.5, NaN) plays
 * nothing, as it would there.
 */
export function victoryStingFor(level) {
  if (!Number.isFinite(level)) return null;
  if (level <= 2) return "victory1";
  if (level >= 3 && level <= 5) return "victory2";
  if (level > 5) return "victory3";
  return null;
}

/** murmur3's 32-bit finaliser. */
function mix32(value) {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

/** Salts the crowd's stream away from every other use of the bout seed ("crow"). */
const CROWD_STREAM = 0x63726f77;

/**
 * The build's `1 + random(1000)` for build frame `frame` of a bout: 1..1000.
 *
 * ► **A PURE FUNCTION OF (SEED, FRAME), NOT A GENERATOR THAT IS DRAWN FROM.**
 *   The build draws only in a frame whose crowd is in a band, from Flash's one
 *   global random. A stateful stream here would make frame 900's roll depend
 *   on how many frames before it were in a band, and so on every draw the
 *   display rate happened to catch. Keyed by the frame, the same frame rolls
 *   the same number whatever the display rate and however often the crowd
 *   crossed a band — and a skipped frame costs nothing to skip.
 *
 * ► **NEVER THE BATTLE'S RNG.** It takes the bout seed and no generator, draws
 *   from nothing, and is salted and mixed differently from `src/team/rng.js`'s
 *   `seed + k * 0x6d2b79f5` stepper, so frame k is not the battle's k-th draw.
 *   Nothing here can reach the battle.
 */
export function crowdRoll(seed, frame) {
  const base = Number.isFinite(seed) ? Math.trunc(seed) : 0;
  const index = Number.isFinite(frame) ? Math.trunc(frame) : 0;
  const stream = mix32((base ^ CROWD_STREAM) >>> 0);
  const hash = mix32((stream + Math.imul(index >>> 0, 0x9e3779b9)) >>> 0);
  return 1 + Math.floor((hash / 4294967296) * SS2_CROWD_SOUND.chance);
}

/** `"cheer"`, `"boo"` or null: the two bands and the build's `== 1000`. */
export function crowdCallFor(crowdInterest, roll) {
  if (roll !== SS2_CROWD_SOUND.chance || !Number.isFinite(crowdInterest)) return null;
  if (crowdInterest > SS2_CROWD_SOUND.cheerAbove) return "cheer";
  if (crowdInterest < SS2_CROWD_SOUND.booBelow) return "boo";
  return null;
}

/* ------------------------------------------------------------------ */
/* The crowd a spectator hears                                         */
/* ------------------------------------------------------------------ */

/**
 * ► **THE CROWD MOVES WHEN THE DRAWING FINISHES THE ACTION, NOT WHEN THE HOST
 *   RESOLVES IT.** The build steps `crowd_interest` in `nextphase`, which runs
 *   as the phase COMPLETES. This host resolves a whole action at `submit`, so
 *   its crowd is already the post-action value while the swing is still being
 *   drawn. Each step's value is heard from the moment its drawing ENDS
 *   (`stepEndsAtMs`) — the moment the arena's own gate opens.
 *
 * ► **AND IT IS A HISTORY, STAMPED WITH THAT MOMENT, NOT A VALUE SAMPLED ON A
 *   DRAW** — found by a Codex review (gpt-6-astra) of this module's first
 *   version, which held one `shown` value, applied when a draw noticed the
 *   step's tokens had cleared, and judged every build frame a draw caught up on
 *   against it. With the crowd moving 71 -> 70 ten ms after frame 664 (seed 7,
 *   a roll of 1000), a draw before the change cheered and a draw after it,
 *   catching up on the same frame, did not: the display rate chose the cheer.
 *   Each build frame is now judged against `crowdInterestAt` its own time.
 */
export function createCrowdPresenter(opening) {
  return Object.freeze({ base: Number.isFinite(opening) ? opening : null, changes: Object.freeze([]) });
}

/**
 * A resolved step's crowd, heard from `atMs`. A change never takes effect
 * before an earlier one: a later step never overtakes.
 */
export function queueCrowdInterest(presenter, value, atMs) {
  const changes = Array.isArray(presenter?.changes) ? presenter.changes : [];
  const last = changes.at(-1);
  const at = Number.isFinite(atMs) ? atMs : (last?.atMs ?? -Infinity);
  const entry = Object.freeze({ atMs: last ? Math.max(at, last.atMs) : at, value: Number.isFinite(value) ? value : null });
  return Object.freeze({ base: presenter?.base ?? null, changes: Object.freeze([...changes, entry]) });
}

/** The crowd in effect at time `t`: the latest change at or before it, else the opening. */
export function crowdInterestAt(presenter, t) {
  let value = presenter?.base ?? null;
  for (const change of Array.isArray(presenter?.changes) ? presenter.changes : []) {
    if (change.atMs > t) break;
    value = change.value;
  }
  return value;
}

/**
 * Folds every change at or before `beforeMs` into the opening, so the history
 * stays short. Only frames inside the stale window are ever judged again, so
 * the shell folds anything a second old.
 */
export function settleCrowdInterest(presenter, beforeMs) {
  const changes = Array.isArray(presenter?.changes) ? presenter.changes : [];
  let folded = 0;
  while (folded < changes.length && changes[folded].atMs <= beforeMs) folded += 1;
  if (folded === 0) return presenter ?? createCrowdPresenter(null);
  return Object.freeze({ base: changes[folded - 1].value, changes: Object.freeze(changes.slice(folded)) });
}

/**
 * WHEN A STEP'S DRAWING ENDS: its latest timeline chain (`then` links run end
 * to end) or projectile — the moment `animationCursor` finds nothing of it
 * still running and the gate opens. `fallbackMs` for a step that draws nothing.
 *
 * @param {object} parts
 * @param {Iterable<{startedAt: number, timeline: {durationMs: number}, then?: object}>} parts.entries
 * @param {Iterable<{startedAt: number, durationMs: number}>} parts.projectiles
 * @param {number} parts.fallbackMs
 */
export function stepEndsAtMs({ entries = [], projectiles = [], fallbackMs = null } = {}) {
  let end = -Infinity;
  for (const entry of entries ?? []) {
    if (!Number.isFinite(entry?.startedAt)) continue;
    let at = entry.startedAt;
    for (let link = entry; link; link = link.then) {
      const duration = Number(link.timeline?.durationMs);
      if (Number.isFinite(duration) && duration > 0) at += duration;
    }
    end = Math.max(end, at);
  }
  for (const shot of projectiles ?? []) {
    if (Number.isFinite(shot?.startedAt) && Number.isFinite(shot?.durationMs)) end = Math.max(end, shot.startedAt + shot.durationMs);
  }
  return Number.isFinite(end) ? end : fallbackMs;
}

/**
 * HOW LONG AFTER ITS BATCH THE DECIDING BLOW LANDS, in ms: when the last
 * fighter this step defeats is struck down — the build's `death()`, whose
 * overlay jump starts `combat_won`.
 *
 * ► **NOT `reactionDelaysFor`, and the first version used it** — found by a
 *   Codex review (gpt-6-astra). That is when a victim's REACTION starts, and a
 *   molten death's victim reacts (burns) from the FIRST rock, while it dies
 *   under the rock `presentation.js` marks `lethal`. The first seeded shower
 *   that decides a bout (`?items=doom`, seed 1, 1v1) lands its first rock on
 *   frame 6 and the lethal one on frame 8, so the win sound, the crowd's stop
 *   and the sting were each 67 ms early.
 *
 *   So each defeated fighter dies at its lethal rock when a rock killed it,
 *   else at its reaction delay (an arrow's or a fireball's impact), else with
 *   the batch; the step is decided by the LATEST of them. A step that defeats
 *   nobody it names falls back to its latest reaction.
 */
export function decidingBlowMsFor(commands) {
  const batch = [...(commands ?? [])];
  const delays = reactionDelaysFor(batch);
  const lethal = new Map();
  const defeated = new Set();
  for (const command of batch) {
    if (command?.kind === "clip-goto" && command.role === "defeated") defeated.add(command.combatantId);
    if (command?.kind === "attach-effect" && command.effect === "boulder_combat" && command.lethal === true) {
      const frame = command.fall?.landingFrame;
      if (!Number.isFinite(frame) || frame < 0 || command.targetId == null) continue;
      lethal.set(command.targetId, Math.max(lethal.get(command.targetId) ?? 0, frame * PROJECTILE_FRAME_MS));
    }
  }
  const finite = (value) => (Number.isFinite(value) && value > 0 ? value : 0);
  if (defeated.size === 0) return Math.max(0, ...[...delays.values()].map(finite));
  let latest = 0;
  for (const id of defeated) latest = Math.max(latest, lethal.has(id) ? lethal.get(id) : finite(delays.get(id)));
  return latest;
}

/* ------------------------------------------------------------------ */
/* The director                                                        */
/* ------------------------------------------------------------------ */

/**
 * How many of the build's frames after the result the crowd is stopped: 7 on
 * the win path (frame 88), 0 on the loss path (`combat_lost` stops it itself).
 */
export function crowdStopFramesFor(result) {
  return lostResult(result) ? SS2_CROWD_SOUND.lostStopAfterFrames : SS2_CROWD_SOUND.stopAfterFrames;
}

/** A result the person at the screen LOST: `lost: true` on a result that has a winner. */
function lostResult(result) {
  return result?.lost === true && result.winnerTeamId !== null && result.winnerTeamId !== undefined;
}

/**
 * What happens after the result, in the build's frames from `combat_won` — or
 * from `combat_lost`, when the person at the screen lost.
 *
 * ► **AUTHORED: A RESULT IS PLAYED AS THE BUILD'S WIN, FOR THE WINNING SIDE**
 *   (the owner's call for team play; in spectate, whichever side wins) —
 *   ~~"Both sides are played from one seat or watched, so there is no losing
 *   player to hear `combat_lost`'s 2248"~~ **UNLESS `result.lost` (2026-09-24,
 *   the arena's seats):** with `?play=`, a person can play one side against the
 *   AI, and when that side loses they are the build's losing hero. They hear
 *   `combat_lost`: the crowd stopped at once and 2248 at frame 315, and no win
 *   sound and no victory sting. The shell sets `lost` only when every seat a
 *   person plays is on the losing side (`seatOutcomeFor` in
 *   `tools/arena/seats.js`); both sides by hand, or watched, is still the win.
 *   A DRAW — which the build has no path for — gets only the stop: the crowd
 *   leaves, and nobody's sting plays, whoever was playing.
 */
export function resultSoundsFor(result, files) {
  const events = [];
  const winner = result?.winnerTeamId !== null && result?.winnerTeamId !== undefined;
  if (lostResult(result)) {
    events.push(Object.freeze({ kind: "stop", sound: "ambience", channel: ArenaSoundChannel.CROWD, atFrames: SS2_CROWD_SOUND.lostStopAfterFrames }));
    if (files?.lost) {
      events.push(Object.freeze({
        kind: "start", sound: "lost", channel: SS2_ARENA_SOUNDS.lost.channel, file: files.lost,
        atFrames: SS2_CROWD_SOUND.lostStingAfterFrames
      }));
    }
    return events;
  }
  if (winner && files?.won) {
    events.push(Object.freeze({ kind: "start", sound: "won", channel: SS2_ARENA_SOUNDS.won.channel, file: files.won, atFrames: 0 }));
  }
  events.push(Object.freeze({ kind: "stop", sound: "ambience", channel: ArenaSoundChannel.CROWD, atFrames: SS2_CROWD_SOUND.stopAfterFrames }));
  const sting = winner ? victoryStingFor(result.winnerLevel) : null;
  if (sting && files?.[sting]) {
    events.push(Object.freeze({
      kind: "start", sound: sting, channel: SS2_ARENA_SOUNDS[sting].channel, file: files[sting],
      atFrames: SS2_CROWD_SOUND.stingAfterFrames
    }));
  }
  return events;
}

export function createArenaSoundState() {
  return Object.freeze({ frame: -1, intro: "waiting", resultFired: 0, crowdStopped: false });
}

/**
 * EVERYTHING THE ARENA'S OWN SOUNDS DO ON ONE DRAW, as actions for the player.
 *
 * Returns `{ state, actions, dropped }`. Each action is one of
 * `{kind: "volume", channel, gain}`, `{kind: "loop", channel, file}` (start it
 * unless it is already looping — the player's `loop` is idempotent, so the
 * ambience comes back after the sound toggle or an autoplay block),
 * `{kind: "start", channel, file, sound}` and `{kind: "stop", channel}`.
 *
 * @param {object} state  `createArenaSoundState()`, then what this returned
 * @param {object} input
 * @param {number} input.nowMs         the draw clock
 * @param {number} input.boutStartMs   when the bout began: the build's `combat_panel` load
 * @param {number} input.seed          the bout seed, for `crowdRoll` only
 * @param {object} [input.crowd]     the crowd's history (`queueCrowdInterest`): each build
 *   frame and the volume are judged against `crowdInterestAt` their own time
 * @param {number|null} [input.crowdInterest]  a constant crowd, when there is no history; null is no crowd
 * @param {boolean} input.crowdHeard   `crowdHeardFor`'s answer
 * @param {boolean} input.started      the first action has been submitted
 * @param {{atMs: number, winnerTeamId: string|null, winnerLevel: number|null, lost?: boolean}|null} input.result
 *   null until decided; `atMs` is when the deciding blow is drawn landing — the
 *   build's `death()`, whose overlay jump starts `combat_won` (or
 *   `combat_lost`: `lost` is true when the person at the screen played only the
 *   losing side) — and a draw has no winner
 * @param {object} input.files         `arenaSoundFilesFrom`'s answer
 */
export function arenaSoundStep(state, {
  nowMs,
  boutStartMs,
  seed,
  crowd = null,
  crowdInterest = null,
  crowdHeard = false,
  started = false,
  result = null,
  files = {},
  staleMs = SOUND_STALE_MS,
  frameMs = CROWD_FRAME_MS
} = {}) {
  const now = Number(nowMs);
  const start = Number(boutStartMs);
  const actions = [];
  const dropped = [];
  let { frame, intro, resultFired, crowdStopped } = state ?? createArenaSoundState();
  if (!Number.isFinite(now) || !Number.isFinite(start)) {
    return { state: Object.freeze({ frame, intro, resultFired, crowdStopped }), actions, dropped };
  }

  // ► THE PRE-FIGHT SCREEN IS THE TIME BEFORE THE FIRST ACTION. The build plays
  //   654 as `arena_intro` appears and the fight starts on its "yes" button;
  //   this arena has no such screen, so the intro may start any time until the
  //   first action is submitted — and is retried while the browser holds sound
  //   back (`arenaSoundSettled`), because on a fresh page it always does. A
  //   pack that has not landed yet is waited for too: the manifest is fetched
  //   after the bout is built, so the first draws always see no files.
  //   A play still PENDING (the element fallback's promise) is neither retried
  //   nor given up on until the browser answers (`arenaSoundSettled`).
  if (intro === "waiting") {
    if (started) intro = files?.intro ? "missed" : "none";
    else if (files?.intro) {
      actions.push({ kind: "start", sound: "intro", channel: SS2_ARENA_SOUNDS.intro.channel, file: files.intro, settles: "intro" });
    }
  }

  const interestAt = crowd ? (t) => crowdInterestAt(crowd, t) : () => crowdInterest;
  const nowInterest = interestAt(now);
  const heard = Boolean(crowdHeard);
  const stopAtMs = Number.isFinite(result?.atMs) ? result.atMs + crowdStopFramesFor(result) * frameMs : Infinity;

  if (heard && Number.isFinite(nowInterest) && !crowdStopped && now < stopAtMs && files?.ambience) {
    // Volume first, so a loop that starts on this draw starts at it.
    actions.push({ kind: "volume", channel: ArenaSoundChannel.CROWD, gain: crowdGainFor(nowInterest) });
    actions.push({ kind: "loop", sound: "ambience", channel: ArenaSoundChannel.CROWD, file: files.ambience });
  }

  // One roll per BUILD frame since the last draw, at the build's 30 fps and not
  // the display's, each judged against the crowd AT THAT FRAME — never the
  // draw's, or the display rate would choose which frames cheer. A frame
  // already past `staleMs` is skipped whole rather than rolled and dropped: a
  // tab back from the background must not burst.
  const current = Math.floor((now - start) / frameMs);
  if (heard && !crowdStopped) {
    const freshFrom = Math.ceil((now - staleMs - start) / frameMs);
    for (let index = Math.max(frame + 1, freshFrom, 0); index <= current; index += 1) {
      const frameAt = start + index * frameMs;
      if (frameAt >= stopAtMs) break;
      const call = crowdCallFor(interestAt(frameAt), crowdRoll(seed, index));
      if (call && files?.[call]) {
        actions.push({ kind: "start", sound: call, channel: SS2_ARENA_SOUNDS[call].channel, file: files[call], frame: index });
      }
    }
  }
  frame = Math.max(frame, current);

  if (Number.isFinite(result?.atMs)) {
    const events = resultSoundsFor(result, files);
    while (resultFired < events.length) {
      const event = events[resultFired];
      const at = result.atMs + event.atFrames * frameMs;
      if (at > now) break;
      resultFired += 1;
      // A stop is never stale: a crowd left looping is worse than a late stop.
      if (event.kind === "stop") {
        crowdStopped = true;
        actions.push({ kind: "stop", sound: event.sound, channel: event.channel });
      } else if (now - at > staleMs) {
        dropped.push(event);
      } else {
        actions.push({ kind: "start", sound: event.sound, channel: event.channel, file: event.file });
      }
    }
  }

  return { state: Object.freeze({ frame, intro, resultFired, crowdStopped }), actions, dropped };
}

/**
 * What the player's answer to an action means for the state. Only the intro
 * waits on it: played, turned off or impossible, it is done; held back by the
 * browser or not yet decoded, it is tried again on the next draw.
 *
 * ► **`"pending"` IS NOT PLAYED** — found by a Codex review (gpt-6-astra). The
 *   element fallback's `play()` is a promise, and the first version counted
 *   the intro played the moment it was asked for; an autoplay rejection then
 *   raised the banner and the intro was gone for good. Pending now holds the
 *   intro — no second start — until the shell settles it again with the
 *   promise's answer: `"played"`, or `"blocked"`, which makes it retryable.
 */
export function arenaSoundSettled(state, action, outcome) {
  if (action?.settles !== "intro") return state;
  if (state?.intro !== "waiting" && state?.intro !== "pending") return state;
  if (outcome === "pending") return Object.freeze({ ...state, intro: "pending" });
  if (outcome === "blocked" || outcome === "not-ready") {
    return state.intro === "waiting" ? state : Object.freeze({ ...state, intro: "waiting" });
  }
  return Object.freeze({ ...state, intro: outcome === "played" ? "played" : "silenced" });
}
