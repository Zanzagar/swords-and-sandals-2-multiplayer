/**
 * THE BUILD'S OWN FIGHT POP-UPS — the damage number, the spell/status/potion
 * callout and the BLOCK — decided from resolved events and drawn from the
 * player's own extracted art and font.
 *
 * Every byte offset below is in the battle block, sprite 862 `overlay` frame
 * 52, DoAction BODY 0x240c85 (absolute = 0x240c85 + offset), re-derived from
 * the session's `all-actions.txt` dump and `all-function-headers.json` on
 * 2026-09-23. Sprite bodies (817, 153, 821, 815) are cited by their own body
 * offsets. **Cite bodies, never the `DoAction@` tag offsets**: the two dumps
 * disagree on those by 4 bytes and agree on bodies.
 *
 * ## The three families, and who attaches them
 *
 * ```text
 *   damage_icon  817  defender.attachMovie(.., 25000)  damagecharacter +0x15ea
 *                     ONLY from checkattackroll -> defender_hurt (+0x2114): an
 *                     attack roll that HIT. 30 frames, removeMovieClip at f30
 *                     (817 body 0x233227).
 *   bonus_icon   153  defender.attachMovie(.., 25005)  magic_damage_character
 *                     +0x1313 (spells and status ticks), and on the DRINKER at
 *                     25001 from the eight potion arms +0x586b..+0x5d03.
 *                     40 frames, removeMovieClip at f40 (153 body 0x2c476).
 *   defend_icon  821  defender.attachMovie(.., 25005)  defender_blocked
 *                     +0x21ce: a failed attack roll (+0x316d) and a failed
 *                     taunt roll (+0x694d -> +0x6b0e). No number. 30 frames,
 *                     removeMovieClip at f30 (821 body 0x23358a).
 * ```
 *
 * `miss_icon` (823, "MISS!") and `addstats_icon` (162) are never attached, and
 * `add_stats_icon` (+0x23bf) has an EMPTY body (its header's bodyLength is 0),
 * so a rest, a regenerate or boundless-energy tick, the taunt's own recovery
 * and a rejuvenate show NOTHING. Neither do gale, command, knockback,
 * teleport, adulation, weaken armour or any stat spell.
 *
 * ## Per fighter, and replaced by DEPTH
 *
 * Every one is a child of the struck (or healed) fighter's clip at a fixed
 * name and depth, so the build is already one-per-fighter: attaching at an
 * occupied depth REPLACES the live clip there. `damage_icon` (25000) and a
 * spell's `bonus_icon` (25005) coexist; a block and a spell hit share 25005 and
 * replace each other; a potion (25001) sits between them. `livePopupsFor`
 * applies exactly that rule per combatant, which is what makes 3v3 work with
 * nothing added.
 *
 * ## Where, how big, and which way
 *
 * - `check_flipping` (+0x1200; r1 = the icon, r2 = the fighter) sets
 *   `_y = -240` unconditionally (+0x128f) and negates the icon's `_xscale`
 *   when the fighter's is negative (+0x1241..+0x128e): the pop-up reads left
 *   to right whichever way its fighter faces. This module never mirrors one.
 * - `damage_icon` and `defend_icon` are scaled `240 - 1.5 * _global.maxscale`
 *   percent (+0x16cf..+0x1704, +0x21eb..+0x2220), set ONCE at attach. The
 *   bonus icon is never scaled.
 * - `_x` is never written for the damage or block icon (0). A spell or status
 *   `bonus_icon` is moved 100 by `game_defender.gladiator_dir` (+0x132c):
 *   `+100` when it equals `"left"`, `-100` otherwise. **`game_defender` is
 *   `_root.game.hero|villain` (+0x2ba3 / +0x2c19), a data object, and every
 *   `gladiator_dir` WRITE in the file is on a CLIP** — the four in
 *   changeCombatants (+0x290e, +0x29cd, +0x2a24, +0x2ae3) on
 *   `arena.gladiators.hero|villain`, the two in root frame 221 on
 *   `arena_hero|arena_villain`; all 43 other pushes are reads. So the test
 *   is always false and the offset is always `-100`, in the FIGHTER's local
 *   space (it therefore lands behind whichever way he faces). The potion arms
 *   write no `_x` at all.
 * - `bonus_icon`'s own frame 1 (body 0x2c217) adds `random(80) - 40` to `_x`.
 *   The build's `random` is not this engine's RNG; the jitter here is a
 *   deterministic hash of the action and the pop-up's index, so a replayed
 *   bout draws identically. AUTHORED stand-in, named.
 *
 * ## The number
 *
 * `damagecharacter` sets `damage = Math.ceil(damage)` (+0x1719) and hands it to
 * the icon (`damage_icon.damage = this.damage`, +0x1733..+0x1743) BEFORE the
 * armour subtraction (+0x17f5) and the overflow rewrite (+0x1841). So the
 * number is the GROSS rounded-up roll: a blow the armour swallows whole still
 * shows its full number, and a killing blow shows more than the victim had
 * left. `magic_damage_character` shows `Math.ceil(damage)` of its argument
 * (+0x13a1), also before armour. A potion shows `"+ " + bonus`, computed
 * before `check_stats` clamps it (+0x58ab, +0x5d43).
 *
 * ► **THE RESOLVER'S EVENT DOES NOT CARRY THE GROSS PHYSICAL NUMBER, AND IT
 *   CANNOT WITHOUT MOVING EVERY PINNED HASH.** An SS2 attack event carries
 *   `damage` (hit points lost) and `armourAbsorbed`; the gross is
 *   `outcome.calculation.selectedDamage`, which reaches only the rule set's
 *   diagnostic `observer`. `battle.events` is inside `toTeamWireState` and so
 *   inside `combatStateHash` — adding a field there was measured to move the
 *   golden census. And the event CANNOT stand in for it: a blow exactly equal
 *   to the armour (armour absorbs G AND hit points lose G, the build's `< 0`
 *   vs `<= 0` quirk) and an overflow of G = 2A report identical `damage` and
 *   `armourAbsorbed`, and a killing blow's `damage` is clamped. So the gross
 *   travels by `createStrikeLedger`, fed by the rule set's existing,
 *   unhashed `observer`. Without a ledger entry the number is an ESTIMATE and
 *   says so (`numberProvenance: "event-estimate"`).
 *
 * ## The splat frame (damage_splat, 815)
 *
 * ```text
 *   +0x1603  gotoAndStop(1)                         always
 *   +0x163b  gotoAndStop(3)                         method "critical"
 *   +0x1673  method = "normal"                      method "taunt" — NO frame
 *   +0x1698  gotoAndStop(5)                         method "grievous"
 *   +0x17a3  if normal|grievous and armour > 0:
 *   +0x17f5    armour -= damage
 *   +0x1824    if armour < 0: gotoAndStop(2)        OVERWRITES grievous's 5
 *   +0x1864  if armour <= 0 or method not normal|grievous:
 *   +0x18a1    if _currentframe == 1: gotoAndStop(2) (+0x18c2)
 *              hitpoints -= damage
 * ```
 *
 * So: 1 = a normal or taunt blow the armour absorbed whole (no hit points
 * lost); 2 = a blow that reached the hit points (armour broken, exactly
 * spent, or none), and a grievous blow that BROKE armour; 3 = critical
 * (armour bypassed); 5 = grievous, armour whole or none. **Frame 4 (TAUNT) is
 * unreachable**: the only `gotoAndStop` calls on 815 in the file are the five
 * above. `damageSplatFrame` is exactly this table.
 *
 * ## The bonus splat (151)
 *
 * The frame is `magic_damage_character`'s `bonus_frame` argument (+0x1381):
 * the bolts pass 8 (LIGHTNING, +0x858f), the fireballs 4 (BURNING, +0x91a2),
 * each molten-death boulder 4 with a literal 40 (+0x88c1), and the status arms
 * frozen 5 (+0x5335), lifesteal 6 (+0x5469), poisoned 7 (+0x559d), burning 4
 * (+0x56d1). The potions pass 1 HEALTH, 2 STAMINA, 3 ARMOUR (+0x5888 ..
 * +0x5d20). Labels from the pack's static texts 124..150.
 *
 * ## Time
 *
 * Nothing in the build waits on a pop-up; the only read of one is +0x18a1,
 * inside `damagecharacter`. It is attached in the same action as the victim's
 * reaction clip (`defender_hurt` calls `damagecharacter` at +0x211e, then
 * `gotoAndPlay(animstate)` at +0x2120; `defender_blocked` attaches, then
 * plays `defend`+direction at +0x2239), so a surface starts it WITH that clip —
 * the same delay a fireball's, an arrow's (`+0x6d29`) or a boulder's victim waits. Molten death
 * attaches one per landing boulder (+0x88e5), each replacing the last. It
 * plays at the movie's 30 fps.
 *
 * Pure: no canvas, no clock, no battle. A pack is an argument, and every reader
 * is total — a missing or hand-edited pack returns `null` and the caller draws
 * the authored fallback: the plain number (or BLOCK) at the same place and for
 * the same frames.
 */

import { fnv1a } from "../common/fnv1a.js";
import { applyColourTransformAlpha, canvasFilterFor, glowAmplificationFor } from "./filters.js";
import { fieldOpsFor, staticTextOpsFor } from "./text.js";

export class PopupError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** The movie's frame rate, 30 fps. */
export const POPUP_FRAME_MS = 1000 / 30;

/** `check_flipping`'s `_y = -240` (+0x128f), in the fighter clip's own pixels. */
export const POPUP_Y = -240;

/**
 * The four families by what the surface needs to know about each.
 *
 * `frames` is the removeMovieClip frame, which runs as that frame is entered,
 * so the last frame DRAWN is `frames - 1`. `numberFrames` is the last frame the
 * text placement is on the icon's timeline — 816 is removed at 817's frame 25,
 * 152 at 153's frame 36 and 820 at 821's frame 25 (the pack's own timelines) —
 * and is used only by the fallback, which has no timeline to read it from.
 */
export const POPUP_ICONS = Object.freeze({
  damage: Object.freeze({
    family: "damage", linkage: "damage_icon", character: 817, depth: 25000, frames: 30,
    scaled: true, splat: 815, field: 816, numberFrames: 24, x: 0,
    attachedBy: "damagecharacter +0x15ea"
  }),
  bonus: Object.freeze({
    family: "bonus", linkage: "bonus_icon", character: 153, depth: 25005, frames: 40,
    scaled: false, splat: 151, field: 152, numberFrames: 35, x: -100,
    attachedBy: "magic_damage_character +0x1313"
  }),
  potion: Object.freeze({
    family: "potion", linkage: "bonus_icon", character: 153, depth: 25001, frames: 40,
    scaled: false, splat: 151, field: 152, numberFrames: 35, x: 0,
    attachedBy: "drink_potion +0x586b..+0x5d03"
  }),
  defend: Object.freeze({
    family: "defend", linkage: "defend_icon", character: 821, depth: 25005, frames: 30,
    scaled: true, splat: null, field: null, label: 820, numberFrames: 24, x: 0,
    attachedBy: "defender_blocked +0x21ce"
  })
});

/**
 * The status arms' `bonus_frame`, keyed by the condition flag an SS2 status
 * event carries (`condition`): frozen +0x5335, life_stolen ("lifesteal")
 * +0x5469, poison ("poisoned") +0x559d, burning +0x56d1.
 */
export const STATUS_BONUS_FRAMES = Object.freeze({ frozen: 5, life_stolen: 6, poison: 7, burning: 4 });

/**
 * The words the two splats carry, for the FALLBACK only — the pack's own
 * static texts (810/812/814 in 815; 124..150 in 151) are what the real art
 * draws. Frame 4 of 815 is listed because it exists, not because it is shown.
 */
export const SPLAT_WORDS = Object.freeze({
  815: Object.freeze({ 3: "CRITICAL", 4: "TAUNT", 5: "GRIEVOUS" }),
  151: Object.freeze({
    1: "HEALTH", 2: "STAMINA", 3: "ARMOUR", 4: "BURNING",
    5: "FROZEN", 6: "WRAITH", 7: "POISONED", 8: "LIGHTNING"
  })
});

/**
 * `240 - 1.5 * _global.maxscale`, as a factor (the build writes percent).
 * `maxscale` is the camera's TARGET zoom (`combatCamera`), 15..100 in the
 * build. A missing value is read as 100, the tightest shot.
 */
export function popupIconScale(maxscale) {
  const value = Number.isFinite(maxscale) ? maxscale : 100;
  return (240 - 1.5 * value) / 100;
}

/**
 * damage_splat's frame for one blow — the table in the header, exactly.
 *
 * @param {object} blow
 * @param {string} blow.method  the DISPATCHED method: normal, taunt, critical, grievous
 * @param {number} blow.gross   `Math.ceil(damage)`, the number shown
 * @param {number} blow.armour  `armourclass` at +0x17cd, AFTER any `remove_armour`
 */
export function damageSplatFrame({ method, gross, armour } = {}) {
  if (method === "critical") return 3;
  // +0x1673: a taunt strike is rewritten to "normal" before any armour test.
  const effective = method === "taunt" ? "normal" : method;
  const g = Number.isFinite(gross) ? gross : 0;
  const a = Number.isFinite(armour) ? armour : 0;
  if (effective === "grievous") {
    // +0x1824 only when the armour branch ran AND overflowed.
    return a > 0 && a - g < 0 ? 2 : 5;
  }
  // normal: frame 1 survives only when armour > 0 and stays > 0 — an exact
  // spend enters the hit-point block (+0x1864 tests `<= 0`) and turns it 2.
  return a > 0 && a - g > 0 ? 1 : 2;
}

/**
 * A place to put what the rule set's `observer` sees, so a surface can read the
 * two numbers the events do not carry: the gross physical number and a status
 * tick's shown number. See the header for why this is not an event field.
 *
 * `observe` is the function to hand `createSs2TeamRules({ observer })`; it
 * keeps a SLIM copy and nothing else. `take()` returns what arrived since the
 * last `take()` and forgets it. Nothing here is battle state.
 */
export function createStrikeLedger() {
  let pending = [];
  return Object.freeze({
    observe(record) {
      const slim = slimStrike(record);
      if (slim) pending.push(slim);
    },
    take() {
      const out = pending;
      pending = [];
      return Object.freeze(out);
    }
  });
}

/** One observer record, reduced to what a pop-up needs, or null. */
export function slimStrike(record) {
  if (!record || typeof record !== "object") return null;
  const calculation = record.outcome?.calculation;
  if (!calculation || typeof calculation !== "object") return null;
  if (Number.isFinite(calculation.selectedDamage)) {
    // The physical ingress. The armour at the test (+0x17cd) is the defender's
    // armour AFTER the blow plus what the blow took off it — `armourDamage` is
    // `armourBeforeDamage - armourclass` after `check_stats`, and
    // `armourBeforeDamage` is read after `remove_armour`.
    const defender = record.scenario?.villain;
    const after = Number.isFinite(defender?.armourclass) ? defender.armourclass : null;
    const taken = Number.isFinite(record.outcome?.mutation?.armourDamage) ? record.outcome.mutation.armourDamage : null;
    return Object.freeze({
      kind: "physical",
      actorId: record.actorId ?? null,
      targetId: record.targetId ?? null,
      type: record.type ?? null,
      attackDirection: Number.isFinite(record.attackDirection) ? record.attackDirection : null,
      diceroll: Number.isFinite(calculation.diceroll) ? calculation.diceroll : null,
      hit: calculation.hit === true,
      gross: calculation.selectedDamage,
      method: calculation.dispatchedMethod ?? null,
      armour: after !== null && taken !== null ? after + taken : null
    });
  }
  if (typeof record.condition === "string" && Number.isFinite(calculation.displayedBonus)) {
    return Object.freeze({
      kind: "status",
      actorId: record.actorId ?? null,
      type: record.type ?? null,
      condition: record.condition,
      shown: calculation.displayedBonus
    });
  }
  return null;
}

function strikeFor(strikes, event) {
  return strikes.find((strike) => strike.kind === "physical"
    && strike.actorId === event.actorId
    && strike.targetId === event.targetId
    && strike.type === event.type
    && strike.diceroll === event.diceroll
    && (event.attackDirection === undefined || strike.attackDirection === event.attackDirection)) ?? null;
}

function statusFor(strikes, event) {
  return strikes.find((strike) => strike.kind === "status"
    && strike.actorId === event.actorId && strike.type === event.type) ?? null;
}

/** `random(80) - 40`, as a deterministic stand-in: -40..39. */
function jitterFor(seed, index) {
  return (Number.parseInt(fnv1a(`popup:${seed}:${index}`), 16) % 80) - 40;
}

function ceilOf(value) {
  return Number.isFinite(value) ? Math.ceil(value) : 0;
}

/**
 * WHICH POP-UPS ONE ACTION'S EVENTS SHOW — the family, the fighter, the number,
 * the splat frame, and (for molten death) when.
 *
 * @param {object[]} events   the action's events, in order (the wire's)
 * @param {object} [options]
 * @param {object[]} [options.strikes] what `createStrikeLedger().take()` returned
 *   for this action; without one a physical number is an estimate
 * @param {*} [options.seed]  anything stable per action (the action boundary);
 *   seeds the bonus icon's `_x` jitter
 * @returns {object[]} frozen pop-up specs, in the order the build attaches them
 */
export function popupsForEvents(events, { strikes = [], seed = 0 } = {}) {
  const list = Array.isArray(events) ? events : [];
  const ledger = Array.isArray(strikes) ? strikes : [];
  const out = [];
  const push = (spec) => {
    const index = out.length;
    const icon = POPUP_ICONS[spec.family];
    const jitter = icon.family === "bonus" || icon.family === "potion" ? jitterFor(seed, index) : 0;
    out.push(Object.freeze({
      id: `${seed}:${index}`,
      depth: icon.depth,
      linkage: icon.linkage,
      x: icon.x + jitter,
      jitter,
      delayFrames: null,
      number: null,
      text: null,
      splatFrame: null,
      numberProvenance: null,
      ...spec
    }));
  };

  for (const event of list) {
    if (!event || typeof event !== "object") continue;
    const source = Object.freeze({ type: event.type ?? null, sequence: event.sequence ?? null });

    // A resolved attack roll: the dispatcher's event carries `hit` and the
    // `diceroll` it was decided on. An out-of-range discharge or whirlwind
    // carries neither (`outOfRange: true`) and shows nothing, as in the build.
    if (typeof event.hit === "boolean" && Number.isFinite(event.diceroll) && event.targetId != null) {
      if (!event.hit) {
        push({ family: "defend", combatantId: event.targetId, source });
        continue;
      }
      const strike = strikeFor(ledger, event);
      const bonus = Number.isFinite(event.backAttackDamage) && event.backAttackDamage > 0 ? event.backAttackDamage : 0;
      const method = event.dispatchedMethod ?? strike?.method ?? "normal";
      if (strike) {
        const number = strike.gross + bonus;
        push({
          family: "damage",
          combatantId: event.targetId,
          number,
          text: String(number),
          splatFrame: damageSplatFrame({ method, gross: strike.gross, armour: strike.armour }),
          // The back attack is this engine's own, AUTHORED, and a separate
          // DAMAGE effect; it is folded into the number so the pop-up says what
          // the blow cost, and named here so it is never read as the build's.
          numberProvenance: bonus > 0 ? "build+authored-back-attack" : "build",
          source
        });
        continue;
      }
      // No ledger: an ESTIMATE from the event, and it says so. Exact whenever
      // the armour did not exactly equal the blow and the blow did not kill.
      const absorbed = Number.isFinite(event.armourAbsorbed) ? event.armourAbsorbed : 0;
      const lost = Number.isFinite(event.damage) ? event.damage : 0;
      const number = absorbed + lost + bonus;
      push({
        family: "damage",
        combatantId: event.targetId,
        number,
        text: String(number),
        splatFrame: method === "critical" ? 3
          : method === "grievous" ? (absorbed > 0 && lost > 0 ? 2 : 5)
            : (lost === 0 && absorbed > 0 ? 1 : 2),
        numberProvenance: "event-estimate",
        source
      });
      continue;
    }

    // A failed taunt roll goes to `defender_blocked` (+0x694d -> +0x6b0e).
    // A landed taunt whose effect is the shove or the flag shows nothing; one
    // whose effect is the strike arrives above as a dispatcher event.
    if (event.type === "taunt" && event.landed === false && event.targetId != null) {
      push({ family: "defend", combatantId: event.targetId, source });
      continue;
    }

    // Molten death: one ingress call per landing boulder (+0x88e5), a literal
    // 40, frame 4, each attach replacing the last on the one victim.
    if (Array.isArray(event.hits) && Array.isArray(event.boulders) && event.targetId != null) {
      const landing = new Map(event.boulders
        .filter((boulder) => Number.isFinite(boulder?.index) && Number.isFinite(boulder?.landingFrame))
        .map((boulder) => [boulder.index, boulder.landingFrame]));
      const number = ceilOf(event.damagePerBoulder);
      for (const hit of event.hits) {
        const frame = landing.get(hit?.boulder);
        if (!Number.isFinite(frame)) continue;
        push({
          family: "bonus",
          combatantId: event.targetId,
          number,
          text: String(number),
          splatFrame: Number.isFinite(event.bonusFrame) ? event.bonusFrame : 4,
          delayFrames: frame,
          numberProvenance: "build",
          source
        });
      }
      continue;
    }

    // The bolts and the fireballs: `magic_damage_character` shows
    // `Math.ceil(damage)` of the rolled argument (+0x13a1), before armour.
    if (Number.isFinite(event.rolledDamage) && Number.isFinite(event.bonusFrame) && event.targetId != null) {
      const number = ceilOf(event.rolledDamage);
      push({
        family: "bonus",
        combatantId: event.targetId,
        number,
        text: String(number),
        splatFrame: event.bonusFrame,
        numberProvenance: "build",
        source
      });
      continue;
    }

    // A status tick: on the SUFFERER, who is the phase's actor.
    if (typeof event.condition === "string" && Object.hasOwn(STATUS_BONUS_FRAMES, event.condition)
      && event.actorId != null) {
      const shown = statusFor(ledger, event);
      const number = shown ? shown.shown : ceilOf(event.damage);
      push({
        family: "bonus",
        combatantId: event.actorId,
        number,
        text: String(number),
        splatFrame: STATUS_BONUS_FRAMES[event.condition],
        numberProvenance: shown ? "build" : "event-estimate",
        source
      });
      continue;
    }

    // A potion: on the drinker, depth 25001, `"+ " + bonus` unclamped.
    if (event.type === "drink-potion" && Number.isFinite(event.bonus) && Number.isFinite(event.bonusFrame)) {
      push({
        family: "potion",
        combatantId: event.actorId,
        number: event.bonus,
        text: `+ ${event.bonus}`,
        splatFrame: event.bonusFrame,
        numberProvenance: "build",
        source
      });
    }
  }
  return Object.freeze(out);
}

/**
 * Which frame of its own timeline a pop-up is on, `elapsedMs` after it was
 * attached. `frame` is 1-based; `done` once the removeMovieClip frame is
 * reached (that frame is never drawn); `started` false before it is attached.
 */
export function popupFrameAt(popup, elapsedMs) {
  const icon = POPUP_ICONS[popup?.family];
  if (!icon) throw new PopupError(`No pop-up family "${popup?.family}".`);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return Object.freeze({ frame: 0, started: false, done: false });
  const frame = Math.floor(elapsedMs / POPUP_FRAME_MS) + 1;
  return Object.freeze({ frame, started: true, done: frame >= icon.frames });
}

/** How long a pop-up is on screen, in ms. */
export function popupLifetimeMs(popup) {
  const icon = POPUP_ICONS[popup?.family];
  if (!icon) throw new PopupError(`No pop-up family "${popup?.family}".`);
  return icon.frames * POPUP_FRAME_MS;
}

/**
 * WHAT IS ON SCREEN, per fighter: the build's replace-by-depth rule applied to
 * every entry a surface is holding.
 *
 * For each (fighter, depth) slot the entry ATTACHED MOST RECENTLY at or before
 * `now` owns it — a later attach replaces a live one, and a replaced one never
 * comes back even if its replacement ends first. The owner is drawn only while
 * it has not reached its removeMovieClip frame.
 *
 * @param {Array<{popup: object, startedAt: number}>} entries
 * @param {number} now
 * @returns {Map<string, Array<{entry: object, frame: number}>>} per combatant,
 *   in ascending DEPTH order — the build's paint order within the fighter
 */
export function livePopupsFor(entries, now) {
  const owners = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry, order) => {
    if (!entry?.popup || !Number.isFinite(entry.startedAt) || entry.startedAt > now) return;
    const key = `${entry.popup.combatantId}\u0000${entry.popup.depth}`;
    const held = owners.get(key);
    if (!held || entry.startedAt > held.entry.startedAt || (entry.startedAt === held.entry.startedAt && order > held.order)) {
      owners.set(key, { entry, order });
    }
  });
  const byFighter = new Map();
  for (const { entry } of owners.values()) {
    const at = popupFrameAt(entry.popup, now - entry.startedAt);
    if (!at.started || at.done) continue;
    const list = byFighter.get(entry.popup.combatantId) ?? [];
    list.push({ entry, frame: at.frame });
    byFighter.set(entry.popup.combatantId, list);
  }
  for (const list of byFighter.values()) list.sort((a, b) => a.entry.popup.depth - b.entry.popup.depth);
  return byFighter;
}

/**
 * The entries still worth holding: not finished, and not replaced by a later
 * attach in the same slot that has already happened.
 */
export function prunePopups(entries, now) {
  const list = Array.isArray(entries) ? entries : [];
  return list.filter((entry, order) => {
    if (!entry?.popup || !Number.isFinite(entry.startedAt)) return false;
    if (entry.startedAt <= now && popupFrameAt(entry.popup, now - entry.startedAt).done) return false;
    // Replaced: a later attach in the same slot has already happened.
    return !list.some((other, otherOrder) => other !== entry && other?.popup
      && other.popup.combatantId === entry.popup.combatantId && other.popup.depth === entry.popup.depth
      && other.startedAt <= now
      && (other.startedAt > entry.startedAt || (other.startedAt === entry.startedAt && otherOrder > order)));
  });
}

/**
 * WHERE A POP-UP DRAWS, for a painter that places a prop by `{x, y, lift, size}`
 * (`propOriginMatrix`): the fighter's DRAWN origin, `_x` along his own facing,
 * 240 of his clip pixels up, at his size times the icon's own scale.
 *
 * @param {object} popup  from `popupsForEvents`
 * @param {object} at
 * @param {object} at.origin     `{x, y, facing}` — where the fighter is DRAWN this frame
 * @param {number} at.clipScale  arena units per fighter-clip pixel, his size included
 * @param {number} [at.maxscale] the camera target zoom when the pop-up was attached
 */
export function popupAnchorFor(popup, { origin, clipScale, maxscale } = {}) {
  const icon = POPUP_ICONS[popup?.family];
  if (!icon) throw new PopupError(`No pop-up family "${popup?.family}".`);
  const k = Number.isFinite(clipScale) && clipScale > 0 ? clipScale : 1;
  // `_x` is in the FIGHTER's local space, so it turns with him; the art itself
  // never mirrors (check_flipping).
  const flip = origin?.facing === "left" ? -1 : 1;
  const x = Number.isFinite(popup.x) ? popup.x : 0;
  return Object.freeze({
    x: (Number.isFinite(origin?.x) ? origin.x : 0) + x * k * flip,
    y: Number.isFinite(origin?.y) ? origin.y : 0,
    lift: -POPUP_Y * k,
    size: k * (icon.scaled ? popupIconScale(maxscale) : 1),
    mirrored: false
  });
}

/* ------------------------------------------------------------------ */
/* The pack                                                            */
/* ------------------------------------------------------------------ */

const FAMILY_LINKAGES = Object.freeze(["damage_icon", "bonus_icon", "defend_icon"]);

/**
 * The pop-up half of `assets/icons/icons.json` (`tools/extract-icons.mjs`), or
 * null. Total: a pack missing any of the three icons, or their frames, is no
 * pack, and the surface draws the fallback.
 *
 * ► **IT DOES NOT READ THE PACK'S `meaning` FIELDS.** Packs extracted before
 *   2026-09-23 name damage_splat frame 1 "normal" and 151's frames unknown,
 *   both wrong; the frame is `damageSplatFrame`'s and the event's.
 */
export function popupPackFrom(data) {
  if (!data || typeof data !== "object") return null;
  const icons = data.icons;
  const shapes = data.shapes;
  if (!icons || typeof icons !== "object" || !shapes || typeof shapes !== "object") return null;
  const picked = {};
  for (const linkage of FAMILY_LINKAGES) {
    const icon = icons[linkage];
    if (!icon || !Array.isArray(icon.frames) || icon.frames.length === 0) return null;
    picked[linkage] = icon;
  }
  return Object.freeze({
    icons: Object.freeze(picked),
    nested: Object.freeze(data.nested && typeof data.nested === "object" ? data.nested : {}),
    shapes: Object.freeze(shapes),
    texts: Object.freeze(data.texts && typeof data.texts === "object" ? data.texts : {})
  });
}

/** Whether a pack can draw pop-ups at all. */
export function hasPopupArt(pack) {
  return Boolean(pack && pack.icons && pack.icons.damage_icon && pack.shapes);
}

/** `outer` then `inner`, both `[a, b, c, d, tx, ty]` with tx/ty in TWIPS. */
function compose(outer, inner) {
  const [a, b, c, d, tx, ty] = outer;
  const [e, f, g, h, ux, uy] = inner;
  return [
    a * e + c * f, b * e + d * f,
    a * g + c * h, b * g + d * h,
    a * ux + c * uy + tx, b * ux + d * uy + ty
  ];
}

const IDENTITY = Object.freeze([1, 0, 0, 1, 0, 0]);

function matrixOf(value) {
  return Array.isArray(value) && value.length >= 6 && value.slice(0, 6).every(Number.isFinite)
    ? value.slice(0, 6)
    : null;
}

/** A shape's paths as ops, with the placement's matrix and fade folded in. */
function shapeOps(pack, character, matrix, alpha) {
  const shape = pack.shapes[character] ?? pack.shapes[String(character)];
  if (!shape || !Array.isArray(shape.paths)) return [];
  const ops = [];
  for (const path of shape.paths) {
    if (!path || typeof path.d !== "string" || path.d.length === 0) continue;
    const gradient = path.gradient && Array.isArray(path.gradient.stops)
      ? Object.freeze({
        ...path.gradient,
        stops: Object.freeze(path.gradient.stops.map((stop) => Object.freeze({
          ...stop, opacity: (Number.isFinite(stop.opacity) ? stop.opacity : 1) * alpha
        })))
      })
      : null;
    ops.push(Object.freeze({
      kind: "path",
      d: path.d,
      matrix: Object.freeze(matrix.slice()),
      fill: path.fill ?? null,
      fillOpacity: (Number.isFinite(path.fillOpacity) ? path.fillOpacity : 1) * alpha,
      fillRule: path.fillRule ?? "evenodd",
      stroke: path.stroke ?? null,
      strokeWidth: Number.isFinite(path.strokeWidth) ? path.strokeWidth : 0,
      strokeOpacity: (Number.isFinite(path.strokeOpacity) ? path.strokeOpacity : 1) * alpha,
      ...(gradient ? { gradient } : {}),
      popup: "shape"
    }));
  }
  return ops;
}

/** The group a glowing text placement's ops share, built at the draw scale. */
function glowGroupFor(filters, scale) {
  if (!Array.isArray(filters) || filters.length === 0) return null;
  const built = canvasFilterFor(filters, { scale });
  const amplify = glowAmplificationFor(filters, { scale });
  if (!built.filter && !amplify) return null;
  return Object.freeze({
    id: null, path: Object.freeze([]), character: null, enclosedBy: null,
    filter: built.filter, amplify, composite: null, blendModeRefused: null,
    colourMatricesFolded: 0, ops: 0, placements: 0, counts: built.counts
  });
}

function withFade(ops, alpha, group) {
  return ops.map((op) => Object.freeze({
    ...op,
    fillOpacity: (Number.isFinite(op.fillOpacity) ? op.fillOpacity : 1) * alpha,
    strokeOpacity: (Number.isFinite(op.strokeOpacity) ? op.strokeOpacity : 1) * alpha,
    ...(group ? { group } : {}),
    popup: "text"
  }));
}

/**
 * A `text` op the surface draws with its own font — the fallback for a word or
 * a number whose glyphs are not in any pack. Positioned at the CENTRE of the
 * box the build draws it in, in the icon's own pixels.
 */
function fallbackText({ text, x, y, size, fill, outline, alpha = 1, role }) {
  return Object.freeze({ kind: "text", text: String(text), x, y, size, fill, outline, alpha, role });
}

/** The box a placed text record occupies, in icon pixels, or a default. */
function textBoxCentre(pack, character, matrix, fallback) {
  const record = pack?.texts?.[character] ?? pack?.texts?.[String(character)];
  const b = record?.bounds;
  if (!b || ![b.xMin, b.xMax, b.yMin, b.yMax].every(Number.isFinite)) return fallback;
  const cx = (b.xMin + b.xMax) / 2;
  const cy = (b.yMin + b.yMax) / 2;
  return {
    x: matrix[0] * cx + matrix[2] * cy + matrix[4] / 20,
    y: matrix[1] * cx + matrix[3] * cy + matrix[5] / 20,
    size: Number.isFinite(record.fontHeight) ? record.fontHeight : fallback.size
  };
}

/**
 * The fallback's positions, derived from the placements `popupPackFrom` reads
 * (so a pack-less clone draws where the build does): the number field sits at
 * (-1330, -399) twips in 817 and (-1370, -399) in 153 with a 34 px font; the
 * splat's word at (-1593, -1195) twips inside 815/151, 20 px; BLOCK at
 * (-1000, -192) in 821, 16 px. Centres computed from the pack's own boxes.
 */
const FALLBACK = Object.freeze({
  number: Object.freeze({ x: 0, y: 4, size: 34 }),
  word: Object.freeze({ x: 7.75, y: -46.4, size: 20 }),
  block: Object.freeze({ x: 4.85, y: 1, size: 16 })
});

const WHITE = "#ffffff";
const BLACK = "#000000";

/**
 * THE AUTHORED FALLBACK: the plain number, the splat's word and BLOCK, in the
 * build's own colours, at the same place, for the frames the build shows its
 * text. No splat. Used when there is no pack at all.
 */
export function popupFallbackOpsFor(popup, frame) {
  const icon = POPUP_ICONS[popup?.family];
  if (!icon) throw new PopupError(`No pop-up family "${popup?.family}".`);
  if (!Number.isFinite(frame) || frame < 1 || frame >= icon.frames || frame > icon.numberFrames) {
    return Object.freeze([]);
  }
  const ops = [];
  if (icon.family === "defend") {
    // 820: #ffff00 with a (204, 0, 0) glow.
    ops.push(fallbackText({ ...FALLBACK.block, text: "BLOCK", fill: "#ffff00", outline: "#cc0000", role: "label" }));
    return Object.freeze(ops);
  }
  const words = SPLAT_WORDS[icon.splat] ?? {};
  const word = words[popup.splatFrame];
  // 815 frame 4 is unreachable; `damageSplatFrame` never returns it.
  if (word && !(icon.splat === 815 && popup.splatFrame === 4)) {
    ops.push(fallbackText({ ...FALLBACK.word, text: word, fill: WHITE, outline: BLACK, role: "label" }));
  }
  if (popup.text !== null && popup.text !== undefined) {
    ops.push(fallbackText({ ...FALLBACK.number, text: popup.text, fill: WHITE, outline: BLACK, role: "number" }));
  }
  return Object.freeze(ops);
}

/**
 * ONE FRAME OF A POP-UP, from the player's own pack: the splat (scaled and
 * faded by the icon's own timeline), its word, and the number in the build's
 * font with its glow — as ops in the ICON's own pixels, `matrix` tx/ty in
 * TWIPS, which is `propOpsFor`'s convention.
 *
 * Returns null when `pack` cannot draw pop-ups (use `popupFallbackOpsFor`).
 * With a pack and no text pack, the words and the number come back as
 * fallback `text` ops at the build's own boxes.
 *
 * @param {object} pack      from `popupPackFrom`
 * @param {object|null} textPack  from `textPackFrom`
 * @param {object} popup     from `popupsForEvents`
 * @param {number} frame     1-based, from `popupFrameAt`
 * @param {object} [options]
 * @param {number} [options.scale=1] device pixels per icon pixel, so the glow is
 *   built at the width it is drawn at
 */
export function popupOpsFor(pack, textPack, popup, frame, { scale = 1 } = {}) {
  if (!hasPopupArt(pack)) return null;
  const family = POPUP_ICONS[popup?.family];
  if (!family) throw new PopupError(`No pop-up family "${popup?.family}".`);
  const icon = pack.icons[family.linkage];
  if (!icon) return null;
  if (!Number.isFinite(frame) || frame < 1 || frame >= family.frames) return Object.freeze([]);
  const placements = icon.frames[Math.min(icon.frames.length, Math.trunc(frame)) - 1];
  if (!Array.isArray(placements)) return Object.freeze([]);

  const ops = [];
  const drawText = (placement, matrix, alpha, text) => {
    const character = placement.character;
    const group = glowGroupFor(placement.filters, scale);
    const isField = Boolean(textPack?.fields?.[character] ?? textPack?.fields?.[String(character)]);
    if (isField) {
      const glyphs = fieldOpsFor(textPack, character, { text: text ?? "", matrix });
      if (glyphs) ops.push(...withFade(glyphs, alpha, group));
      return;
    }
    const isStatic = Boolean(textPack?.statics?.[character] ?? textPack?.statics?.[String(character)]);
    if (isStatic) {
      const own = matrixOf(textPack.statics[character]?.matrix ?? textPack.statics[String(character)]?.matrix) ?? IDENTITY;
      const glyphs = staticTextOpsFor(textPack, character, { matrix: compose(matrix, own) });
      if (glyphs) ops.push(...withFade(glyphs, alpha, group));
      return;
    }
    // No glyphs for it: the fallback word or number, at the build's own box.
    const role = text !== undefined ? "number" : "label";
    const box = textBoxCentre(pack, character, matrix, role === "number" ? FALLBACK.number : FALLBACK.word);
    const word = text !== undefined ? text
      : family.family === "defend" ? "BLOCK" : (SPLAT_WORDS[family.splat]?.[popup.splatFrame] ?? null);
    if (word === null || word === undefined) return;
    const record = pack.texts?.[character] ?? pack.texts?.[String(character)];
    const colour = record?.colour && Number.isFinite(record.colour.red)
      ? `#${[record.colour.red, record.colour.green, record.colour.blue].map((v) => v.toString(16).padStart(2, "0")).join("")}`
      : (family.family === "defend" ? "#ffff00" : WHITE);
    ops.push(fallbackText({
      ...box, text: word, fill: colour, outline: family.family === "defend" ? "#cc0000" : BLACK, alpha, role
    }));
  };

  for (const placement of placements) {
    const matrix = matrixOf(placement?.matrix);
    if (!matrix) continue;
    const alpha = applyColourTransformAlpha(1, placement.colour ?? null);
    if (placement.kind === "shape") {
      ops.push(...shapeOps(pack, placement.character, matrix, alpha));
    } else if (placement.kind === "text") {
      // The number field (816 / 152) takes the pop-up's text; a static run
      // (820, BLOCK) draws its own.
      const isNumber = placement.character === family.field;
      drawText(placement, matrix, alpha, isNumber ? (popup.text ?? "") : undefined);
    } else if (placement.kind === "clip") {
      // The splat: its frame is the pop-up's, chosen by the build with
      // `gotoAndStop` and held (`Stop` on 815's frame 1, body 0x232fdf).
      const nested = pack.nested[placement.character] ?? pack.nested[String(placement.character)];
      if (!nested || !Array.isArray(nested.frames) || nested.frames.length === 0) continue;
      const wanted = Number.isFinite(popup.splatFrame) ? Math.trunc(popup.splatFrame) : 1;
      const inner = nested.frames[Math.min(nested.frames.length, Math.max(1, wanted)) - 1];
      if (!Array.isArray(inner)) continue;
      for (const child of inner) {
        const childMatrix = matrixOf(child?.matrix);
        if (!childMatrix) continue;
        const composed = compose(matrix, childMatrix);
        const childAlpha = alpha * applyColourTransformAlpha(1, child.colour ?? null);
        if (child.kind === "shape") ops.push(...shapeOps(pack, child.character, composed, childAlpha));
        else if (child.kind === "text") drawText(child, composed, childAlpha, undefined);
      }
    }
  }
  return Object.freeze(ops);
}
