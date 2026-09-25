/**
 * The fight pop-ups — `src/render/popups.js`. Every rule here is pinned to the
 * byte offset it came from (overlay 862 frame 52, body 0x240c85); the module
 * header carries the table.
 *
 * Two kinds of test: the rules on synthetic events and a real engine bout
 * (always run — no SS2 asset), and ONE test against the player's own icon and
 * text packs, which skips in a tree that has not extracted them.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  POPUP_FRAME_MS,
  POPUP_ICONS,
  POPUP_Y,
  SPLAT_WORDS,
  STATUS_BONUS_FRAMES,
  createStrikeLedger,
  damageSplatFrame,
  hasPopupArt,
  livePopupsFor,
  popupAnchorFor,
  popupFallbackOpsFor,
  popupFrameAt,
  popupIconScale,
  popupOpsFor,
  popupPackFrom,
  popupsForEvents,
  prunePopups,
  slimStrike
} from "../src/render/popups.js";
import { textPackFrom } from "../src/render/text.js";
import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import {
  createSs2TeamRules, ss2BattleValues, ss2Combatant, ss2StatusToken, ss2TeamRules
} from "../src/team/ss2-rules.js";
import {
  applyAction, combatantById, createTeamBattle, legalActions, toTeamWireState
} from "../src/team/index.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";

/* ------------------------------------------------------------------ */
/* damage_splat's frame: +0x1603 .. +0x18c2                            */
/* ------------------------------------------------------------------ */

test("the splat frame is damagecharacter's own table, case by case", () => {
  // +0x163b: critical is 3 and bypasses the armour block entirely.
  assert.equal(damageSplatFrame({ method: "critical", gross: 9, armour: 50 }), 3);
  assert.equal(damageSplatFrame({ method: "critical", gross: 9, armour: 0 }), 3);
  // normal: frame 1 survives only when armour > 0 stays > 0 (+0x1809 `< 0`
  // is false and +0x1864 `<= 0` is false).
  assert.equal(damageSplatFrame({ method: "normal", gross: 9, armour: 10 }), 1, "absorbed whole");
  // Exactly spent: +0x1809 is false (not < 0) but +0x1864 is true (<= 0), so
  // the hit-point block runs and +0x18c2 turns 1 into 2.
  assert.equal(damageSplatFrame({ method: "normal", gross: 9, armour: 9 }), 2, "exactly spent");
  assert.equal(damageSplatFrame({ method: "normal", gross: 9, armour: 4 }), 2, "broken (+0x1824)");
  assert.equal(damageSplatFrame({ method: "normal", gross: 9, armour: 0 }), 2, "no armour");
  // +0x1673: a taunt strike is a normal one by the time any frame is chosen.
  assert.equal(damageSplatFrame({ method: "taunt", gross: 9, armour: 10 }), 1);
  assert.equal(damageSplatFrame({ method: "taunt", gross: 9, armour: 0 }), 2);
  // grievous: 5 (+0x1698) unless the armour branch runs AND overflows, when
  // +0x1824 overwrites it with 2.
  assert.equal(damageSplatFrame({ method: "grievous", gross: 9, armour: 0 }), 5);
  assert.equal(damageSplatFrame({ method: "grievous", gross: 9, armour: 10 }), 5);
  assert.equal(damageSplatFrame({ method: "grievous", gross: 9, armour: 9 }), 5, "exactly spent is not < 0");
  assert.equal(damageSplatFrame({ method: "grievous", gross: 9, armour: 4 }), 2);
});

test("frame 4 (TAUNT) is never chosen, over every method, number and armour", () => {
  // The only gotoAndStop calls on 815 in the file are 1, 3, 5, 2, 2.
  const seen = new Set();
  for (const method of ["normal", "taunt", "critical", "grievous"]) {
    for (let gross = 0; gross <= 40; gross += 1) {
      for (let armour = 0; armour <= 40; armour += 1) seen.add(damageSplatFrame({ method, gross, armour }));
    }
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3, 5]);
});

test("the icon's scale is 240 - 1.5 * maxscale percent (+0x16cf), and only damage and block are scaled", () => {
  assert.equal(popupIconScale(100), 0.9);
  assert.equal(popupIconScale(50), 1.65);
  assert.equal(popupIconScale(15), 2.175);
  assert.equal(popupIconScale(undefined), 0.9, "missing is the tightest shot");
  assert.equal(POPUP_ICONS.damage.scaled, true);
  assert.equal(POPUP_ICONS.defend.scaled, true);
  assert.equal(POPUP_ICONS.bonus.scaled, false, "magic_damage_character writes no _xscale");
  assert.equal(POPUP_ICONS.potion.scaled, false);
});

/* ------------------------------------------------------------------ */
/* Which pop-up, from which event                                      */
/* ------------------------------------------------------------------ */

const hit = (overrides = {}) => ({
  sequence: 7, type: "normal-attack", actorId: "red-1", targetId: "blue-1",
  attackDirection: 6, hit: true, diceroll: 55, dispatchedMethod: "normal",
  damage: 0, armourAbsorbed: 0, backAttackDamage: 0, ...overrides
});
const strike = (overrides = {}) => ({
  kind: "physical", actorId: "red-1", targetId: "blue-1", type: "normal-attack",
  attackDirection: 6, diceroll: 55, hit: true, gross: 10, method: "normal", armour: 0, ...overrides
});

test("a hit shows the GROSS number the ledger carries, on the struck fighter, at depth 25000", () => {
  const [popup, ...rest] = popupsForEvents([hit({ damage: 6, armourAbsorbed: 4 })], {
    strikes: [strike({ gross: 10, armour: 4 })], seed: 7
  });
  assert.equal(rest.length, 0);
  assert.equal(popup.family, "damage");
  assert.equal(popup.combatantId, "blue-1");
  assert.equal(popup.depth, 25000);
  assert.equal(popup.number, 10, "set at +0x1733, BEFORE the armour took 4 (+0x17f5)");
  assert.equal(popup.text, "10");
  assert.equal(popup.splatFrame, 2, "armour 4 < 10 broke: +0x1824");
  assert.equal(popup.numberProvenance, "build");
  assert.equal(popup.x, 0, "_x is never written for damage_icon");
});

test("an ABSORBED hit still shows its full number, on frame 1", () => {
  const [popup] = popupsForEvents([hit({ damage: 0, armourAbsorbed: 10 })], {
    strikes: [strike({ gross: 10, armour: 30 })]
  });
  assert.equal(popup.number, 10);
  assert.equal(popup.splatFrame, 1);
});

test("the EVENT alone cannot say the number: exact-armour and a 2A overflow report the same fields", () => {
  // Armour 5, blow 5: armour absorbs 5 AND hit points lose 5 (+0x1809 `< 0`
  // is false, +0x1864 `<= 0` is true). Armour 5, blow 10: absorbs 5, overflow 5.
  const exact = hit({ damage: 5, armourAbsorbed: 5 });
  const overflow = hit({ damage: 5, armourAbsorbed: 5 });
  const [a] = popupsForEvents([exact], { strikes: [strike({ gross: 5, armour: 5 })] });
  const [b] = popupsForEvents([overflow], { strikes: [strike({ gross: 10, armour: 5 })] });
  assert.equal(a.number, 5);
  assert.equal(b.number, 10, "the ledger tells them apart");
  const [c] = popupsForEvents([exact]);
  const [d] = popupsForEvents([overflow]);
  assert.equal(c.number, d.number, "without it they are indistinguishable");
  assert.equal(c.numberProvenance, "event-estimate", "and the estimate says it is one");
});

test("a ledger entry for a DIFFERENT roll is not used", () => {
  const [popup] = popupsForEvents([hit({ damage: 3 })], { strikes: [strike({ diceroll: 54, gross: 99 })] });
  assert.equal(popup.number, 3);
  assert.equal(popup.numberProvenance, "event-estimate");
});

test("the authored back-attack bonus is folded into the number and NAMED", () => {
  const [popup] = popupsForEvents([hit({ damage: 10, backAttackDamage: 5 })], { strikes: [strike({ gross: 10 })] });
  assert.equal(popup.number, 15);
  assert.equal(popup.numberProvenance, "build+authored-back-attack");
});

test("a critical shows 3 and a grievous 5 — through the event's dispatched method", () => {
  const [crit] = popupsForEvents([hit({ dispatchedMethod: "critical", damage: 12 })],
    { strikes: [strike({ gross: 12, method: "critical", armour: 20 })] });
  assert.equal(crit.splatFrame, 3);
  const [grievous] = popupsForEvents([hit({ dispatchedMethod: "grievous", attackDirection: 30, damage: 12 })],
    { strikes: [strike({ gross: 12, method: "grievous", attackDirection: 30 })] });
  assert.equal(grievous.splatFrame, 5);
});

test("a MISS is BLOCK on the defender, depth 25005, with no number (defender_blocked +0x21ce)", () => {
  const [popup, ...rest] = popupsForEvents([hit({ hit: false })]);
  assert.equal(rest.length, 0);
  assert.equal(popup.family, "defend");
  assert.equal(popup.combatantId, "blue-1");
  assert.equal(popup.depth, 25005);
  assert.equal(popup.number, null);
  assert.equal(popup.text, null);
});

test("a FAILED taunt roll is BLOCK too (+0x694d -> +0x6b0e); a shove or a flag shows nothing", () => {
  const taunt = { sequence: 3, type: "taunt", actorId: "red-1", targetId: "blue-1" };
  const [failed] = popupsForEvents([{ ...taunt, landed: false, effect: null }]);
  assert.equal(failed.family, "defend");
  assert.equal(failed.combatantId, "blue-1");
  assert.deepEqual(popupsForEvents([{ ...taunt, landed: true, effect: 2, force: 150 }]), []);
  assert.deepEqual(popupsForEvents([{ ...taunt, landed: true, effect: 2, flag: "taunted1" }]), []);
});

test("out of range decides nothing and shows nothing", () => {
  assert.deepEqual(popupsForEvents([{ type: "psyche-up", actorId: "a", targetId: "b", outOfRange: true }]), []);
  assert.deepEqual(popupsForEvents([{ type: "cast-whirlwind", actorId: "a", targetId: "b", outOfRange: true }]), []);
});

test("a bolt and a fireball show bonus_icon on the victim: ceil(rolled), their own splat frame, _x -100 + jitter", () => {
  const [bolt] = popupsForEvents([{ sequence: 4, type: "cast-lightning-bolt", actorId: "a", targetId: "b",
    rolledDamage: 16.2, bonusFrame: 8, damage: 16.2 }], { seed: 4 });
  assert.equal(bolt.family, "bonus");
  assert.equal(bolt.combatantId, "b");
  assert.equal(bolt.depth, 25005);
  assert.equal(bolt.number, 17, "Math.ceil at +0x13a1");
  assert.equal(bolt.splatFrame, 8, "LIGHTNING");
  assert.ok(bolt.x >= -140 && bolt.x <= -61, "-100 (+0x1363) plus random(80) - 40 (153 body 0x2c217)");
  const [again] = popupsForEvents([{ sequence: 4, type: "cast-lightning-bolt", actorId: "a", targetId: "b",
    rolledDamage: 16.2, bonusFrame: 8 }], { seed: 4 });
  assert.equal(again.x, bolt.x, "the jitter is deterministic per action");
  // And it IS a jitter: `random(80) - 40` is an integer in -40..39, and over
  // many actions it covers that range rather than sitting at one value.
  const jitters = Array.from({ length: 400 }, (unused, seed) => popupsForEvents([{ type: "cast-fireball",
    actorId: "a", targetId: "b", rolledDamage: 5, bonusFrame: 4 }], { seed })[0].jitter);
  assert.ok(jitters.every((value) => Number.isInteger(value) && value >= -40 && value <= 39));
  assert.ok(Math.min(...jitters) <= -38 && Math.max(...jitters) >= 37, "the whole span is reached");
  const [fireball] = popupsForEvents([{ type: "cast-fireball", actorId: "a", targetId: "b", rolledDamage: 22, bonusFrame: 4 }]);
  assert.equal(fireball.splatFrame, 4, "BURNING");
});

test("molten death attaches one '40' per landing rock, in landing order, each at its own frame", () => {
  const event = {
    type: "cast-death-from-above", actorId: "a", targetId: "b", bonusFrame: 4, damagePerBoulder: 40,
    boulders: [{ index: 1, landingFrame: 12 }, { index: 2, landingFrame: 7 }, { index: 3, landingFrame: 9 }],
    hits: [{ boulder: 2 }, { boulder: 3 }, { boulder: 1 }]
  };
  const shown = popupsForEvents([event]);
  assert.deepEqual(shown.map((popup) => popup.delayFrames), [7, 9, 12]);
  assert.ok(shown.every((popup) => popup.number === 40 && popup.splatFrame === 4 && popup.depth === 25005));
  assert.ok(shown.every((popup) => popup.combatantId === "b"));
});

test("a status tick shows on the SUFFERER with the arm's own frame, and the ledger's shown number", () => {
  assert.deepEqual(STATUS_BONUS_FRAMES, { frozen: 5, life_stolen: 6, poison: 7, burning: 4 });
  const tick = { type: "burning-phase", actorId: "hero", targetId: "hero", condition: "burning", damage: 4 };
  const [popup] = popupsForEvents([tick], {
    strikes: [{ kind: "status", actorId: "hero", type: "burning-phase", condition: "burning", shown: 9 }]
  });
  assert.equal(popup.family, "bonus");
  assert.equal(popup.combatantId, "hero");
  assert.equal(popup.splatFrame, 4);
  assert.equal(popup.number, 9, "Math.ceil of the incoming damage, before armour");
  const [estimate] = popupsForEvents([tick]);
  assert.equal(estimate.numberProvenance, "event-estimate");
  assert.equal(popupsForEvents([{ type: "taunted-phase", actorId: "hero", condition: "taunted1" }]).length, 0);
});

test("a potion is bonus_icon on the DRINKER at 25001, '+ bonus' unclamped, no -100", () => {
  const [popup] = popupsForEvents([{ type: "drink-potion", actorId: "red-2", targetId: "red-2",
    bonus: 25, bonusFrame: 1, itemId: 3 }], { seed: 11 });
  assert.equal(popup.family, "potion");
  assert.equal(popup.depth, 25001);
  assert.equal(popup.combatantId, "red-2");
  assert.equal(popup.text, "+ 25");
  assert.ok(popup.x >= -40 && popup.x <= 39, "only the icon's own frame-1 jitter moves it");
});

test("everything add_stats_icon (empty body) and the silent spells would have shown is nothing", () => {
  const silent = ["rest", "walk-left", "rank-back", "cast-gale", "cast-command", "cast-teleport", "cast-adulation",
    "cast-weaken-armour", "cast-colossus", "cast-regenerate", "cast-rejuvinate", "cast-boundless-energy",
    "swap-weapons", "wincrowd", "defeated", "team-eliminated", "battle-result-pending"];
  const events = silent.map((type, index) => ({ sequence: index + 1, type, actorId: "a", targetId: "b", healed: 5 }));
  assert.deepEqual(popupsForEvents(events), []);
});

/* ------------------------------------------------------------------ */
/* Time, and the replace-by-depth rule                                 */
/* ------------------------------------------------------------------ */

test("the timeline: 30 fps, frame 1 at attach, gone at the removeMovieClip frame", () => {
  const damage = { family: "damage" };
  assert.equal(POPUP_FRAME_MS, 1000 / 30);
  assert.deepEqual({ ...popupFrameAt(damage, 0) }, { frame: 1, started: true, done: false });
  assert.equal(popupFrameAt(damage, 29 * POPUP_FRAME_MS - 1).frame, 29);
  assert.equal(popupFrameAt(damage, 29 * POPUP_FRAME_MS - 1).done, false);
  assert.equal(popupFrameAt(damage, 29 * POPUP_FRAME_MS + 1).done, true, "817 frame 30: this.removeMovieClip()");
  assert.equal(popupFrameAt({ family: "bonus" }, 38 * POPUP_FRAME_MS + 1).done, false);
  assert.equal(popupFrameAt({ family: "bonus" }, 39 * POPUP_FRAME_MS + 1).done, true, "153 frame 40");
  assert.equal(popupFrameAt(damage, -5).started, false);
});

const entry = (combatantId, depth, family, startedAt) => ({
  popup: { combatantId, depth, family, id: `${combatantId}:${startedAt}` }, startedAt
});

test("a later attach at the SAME depth on the SAME fighter replaces the live one, and it never comes back", () => {
  const bonus = entry("b", 25005, "bonus", 0);
  const block = entry("b", 25005, "defend", 5 * POPUP_FRAME_MS);
  const at = (frame) => livePopupsFor([bonus, block], frame * POPUP_FRAME_MS + 1).get("b") ?? [];
  assert.equal(at(2)[0].entry, bonus);
  assert.equal(at(6)[0].entry, block, "defender_blocked took 25005");
  // At frame 36 the block (30 frames from frame 5) is gone and the bonus, by
  // its own 40-frame clock, would still be alive — but it was replaced.
  assert.deepEqual(at(36), []);
  assert.deepEqual(prunePopups([bonus, block], 6 * POPUP_FRAME_MS + 1), [block]);
});

test("different depths coexist on one fighter, in depth order; different fighters never touch", () => {
  const damage = entry("b", 25000, "damage", 0);
  const potion = entry("b", 25001, "potion", 0);
  const bonus = entry("b", 25005, "bonus", 0);
  const other = entry("c", 25000, "damage", 0);
  const live = livePopupsFor([bonus, other, potion, damage], 1);
  assert.deepEqual(live.get("b").map((item) => item.entry.popup.depth), [25000, 25001, 25005]);
  assert.equal(live.get("c").length, 1, "3v3: every fighter owns his own");
  assert.equal(prunePopups([bonus, other, potion, damage], 1).length, 4);
});

test("a rock's pop-up waits for its landing, then replaces the one before", () => {
  const rocks = [7, 9, 12].map((frame) => entry("b", 25005, "bonus", frame * POPUP_FRAME_MS));
  assert.deepEqual(livePopupsFor(rocks, 6 * POPUP_FRAME_MS).get("b"), undefined, "nothing before the first lands");
  assert.equal(livePopupsFor(rocks, 10 * POPUP_FRAME_MS).get("b")[0].entry, rocks[1]);
  assert.equal(livePopupsFor(rocks, 13 * POPUP_FRAME_MS).get("b")[0].entry, rocks[2]);
  assert.equal(prunePopups(rocks, 13 * POPUP_FRAME_MS).length, 1);
});

/* ------------------------------------------------------------------ */
/* Where                                                               */
/* ------------------------------------------------------------------ */

test("the anchor: 240 clip pixels up (+0x128f), at the fighter's size times the icon's, never mirrored", () => {
  const origin = { x: 300, y: 200, facing: "left", size: 0.86 };
  const damage = popupAnchorFor({ family: "damage", x: 0 }, { origin, clipScale: 0.86, maxscale: 50 });
  assert.equal(POPUP_Y, -240);
  assert.equal(damage.x, 300);
  assert.equal(damage.y, 200);
  assert.ok(Math.abs(damage.lift - 240 * 0.86) < 1e-9);
  assert.ok(Math.abs(damage.size - 0.86 * 1.65) < 1e-9);
  assert.equal(damage.mirrored, false, "check_flipping un-mirrors it");
  // The bonus icon's -100 is in the FIGHTER's space, so it lands behind him
  // whichever way he faces.
  const left = popupAnchorFor({ family: "bonus", x: -100 }, { origin, clipScale: 1 });
  const right = popupAnchorFor({ family: "bonus", x: -100 }, { origin: { ...origin, facing: "right" }, clipScale: 1 });
  assert.equal(left.x, 400);
  assert.equal(right.x, 200);
  assert.equal(left.size, 1, "bonus_icon is never scaled");
});

/* ------------------------------------------------------------------ */
/* The fallback, and a pack that is not one                            */
/* ------------------------------------------------------------------ */

test("with no pack the fallback draws the plain number (and BLOCK) for the frames the build shows its text", () => {
  const damage = { family: "damage", text: "12", splatFrame: 2 };
  assert.equal(popupOpsFor(null, null, damage, 1), null, "no pack: the caller falls back");
  assert.equal(hasPopupArt(null), false);
  const first = popupFallbackOpsFor(damage, 1);
  assert.deepEqual(first.map((op) => [op.kind, op.text]), [["text", "12"]]);
  assert.equal(popupFallbackOpsFor(damage, 24).length, 1);
  assert.equal(popupFallbackOpsFor(damage, 25).length, 0, "816 is removed at 817's frame 25");
  const critical = popupFallbackOpsFor({ family: "damage", text: "30", splatFrame: 3 }, 1);
  assert.deepEqual(critical.map((op) => op.text), ["CRITICAL", "30"]);
  assert.deepEqual(popupFallbackOpsFor({ family: "defend", text: null }, 1).map((op) => [op.text, op.fill]),
    [["BLOCK", "#ffff00"]]);
  const lightning = popupFallbackOpsFor({ family: "bonus", text: "17", splatFrame: 8 }, 30);
  assert.deepEqual(lightning.map((op) => op.text), ["LIGHTNING", "17"], "152 stays until 153's frame 36");
  assert.equal(popupFallbackOpsFor({ family: "bonus", text: "17", splatFrame: 8 }, 36).length, 0);
});

test("a pack that is not one is null, never a throw", () => {
  assert.equal(popupPackFrom(null), null);
  assert.equal(popupPackFrom({}), null);
  assert.equal(popupPackFrom({ icons: { damage_icon: { frames: [[]] } }, shapes: {} }), null, "bonus and defend missing");
  const minimal = popupPackFrom({
    icons: { damage_icon: { frames: [[]] }, bonus_icon: { frames: [[]] }, defend_icon: { frames: [[]] } },
    shapes: {}
  });
  assert.ok(minimal);
  assert.deepEqual([...popupOpsFor(minimal, null, { family: "damage", text: "1" }, 1)], []);
});

/* ------------------------------------------------------------------ */
/* The real engine: the observer carries the number and moves no state */
/* ------------------------------------------------------------------ */

function bout({ size, seed, items, observer }) {
  const rules = observer ? createSs2TeamRules({ observer }) : ss2TeamRules;
  const host = createVanillaBattleHost({
    teams: [
      demoSide("red", size, { ss2Combatant, ss2BattleValues, items, seed }),
      demoSide("blue", size, { ss2Combatant, ss2BattleValues, items, seed })
    ],
    rules, bindings: SS2_STATIC_MAP_BINDINGS, seed
  });
  host.constructArena();
  return host;
}

test("THE REAL ENGINE: every hit's number comes from the ledger, and the observer moves no hash", () => {
  let hits = 0;
  let misses = 0;
  let bonuses = 0;
  for (const [size, seed, kit] of [[1, 3, ""], [3, 5, ""], [2, 2, "blasts"], [3, 4, "tricks"]]) {
    const items = demoItemsFrom(kit);
    const ledger = createStrikeLedger();
    const watched = bout({ size, seed, items, observer: ledger.observe });
    const plain = bout({ size, seed, items, observer: null });
    for (let turn = 0; turn < 400 && !watched.battle.result; turn += 1) {
      const action = { actorId: watched.currentCombatantId(), ...watched.suggestAction() };
      ledger.take();
      const step = watched.submit(action);
      plain.submit(action);
      assert.equal(watched.hash(), plain.hash(), `${size}v${size} seed ${seed}: the observer changed state`);
      const events = watched.wire().events.filter((event) => event.sequence >= step.actionBoundary);
      const strikes = ledger.take();
      for (const popup of popupsForEvents(events, { strikes, seed: step.actionBoundary })) {
        if (popup.family === "damage") {
          hits += 1;
          assert.match(popup.numberProvenance, /^build/, "every hit must pair with its own ledger entry");
          const event = events.find((candidate) => candidate.sequence === popup.source.sequence);
          // The gross never shows LESS than the blow took off the armour and
          // the hit points together — except the exact-armour quirk, which
          // takes it twice.
          assert.ok(popup.number >= event.damage, "gross >= hit points lost");
          assert.ok([1, 2, 3, 5].includes(popup.splatFrame));
        } else if (popup.family === "defend") {
          misses += 1;
        } else {
          bonuses += 1;
          assert.equal(popup.numberProvenance, "build");
        }
      }
    }
  }
  assert.ok(hits > 20 && misses > 3 && bonuses > 0, `the sweep must reach all three (${hits}/${misses}/${bonuses})`);
});

test("THE REAL ENGINE: a burning tick pairs with its observer record — frame 4, on the sufferer, the shown number", () => {
  // No demo roster carries an enchantment, so the seeded sweep above never
  // reaches a status phase. Staged the way test/ss2-team-rules.test.js stages
  // one: the villain's weapon does ceil(9 / 3 * 3) = 9, and the hero burns.
  const gladiator = (overrides) => ({
    strength: 5, speed: 5, attack: 5, defence: 5, vitality: 8, stamina: 4, magicka: 0, charisma: 3,
    herolevel: 3, character_level: 3, weapon_min_damage: 3, weapon_max_damage: 6, ...overrides
  });
  const ledger = createStrikeLedger();
  const battle = createTeamBattle({
    seed: 5,
    rules: createSs2TeamRules({ observer: ledger.observe }),
    teams: [
      { id: "red", combatants: [ss2Combatant(gladiator({ speed: 9 }), { id: "hero", name: "Hero", x: -30 })] },
      { id: "blue", combatants: [ss2Combatant(gladiator({ weapon_enchantment_type: 2, weapon_enchantment_potency: 3,
        weapon_max_damage: 9 }), { id: "villain", name: "Villain", x: 30 })] }
    ]
  });
  combatantById(battle, "hero").status = [ss2StatusToken("burning", "villain")];
  const [only] = legalActions(battle);
  applyAction(battle, { actorId: "hero", ...only });
  const events = toTeamWireState(battle).events;
  const [popup, ...rest] = popupsForEvents(events, { strikes: ledger.take(), seed: 1 });
  assert.equal(rest.length, 0);
  assert.equal(popup.family, "bonus");
  assert.equal(popup.combatantId, "hero", "the sufferer, the phase's own actor");
  assert.equal(popup.splatFrame, 4, "burning, +0x56d1");
  assert.equal(popup.number, 9);
  assert.equal(popup.numberProvenance, "build", "paired with the status arm's own observer record");
});

test("slimStrike keeps what a pop-up needs from a real observer record, and ignores anything else", () => {
  assert.equal(slimStrike(null), null);
  assert.equal(slimStrike({ outcome: {} }), null);
  const record = {
    actorId: "a", targetId: "b", type: "power-attack", attackDirection: 10,
    scenario: { villain: { armourclass: 3 } },
    outcome: { calculation: { selectedDamage: 14, diceroll: 80, hit: true, dispatchedMethod: "normal" },
      mutation: { armourDamage: 4 } }
  };
  const slim = slimStrike(record);
  assert.equal(slim.gross, 14);
  assert.equal(slim.armour, 7, "after (3) plus taken (4): the armour +0x17cd tested");
});

/* ------------------------------------------------------------------ */
/* The player's own packs                                               */
/* ------------------------------------------------------------------ */

test("THE REAL PACKS: the icons' timelines, the splat words and the number's glyphs are what the rules assume", (t) => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets");
  const iconsAt = path.join(root, "icons", "icons.json");
  const textAt = path.join(root, "text", "text.json");
  if (!fs.existsSync(iconsAt) || !fs.existsSync(textAt)) {
    t.skip("no extracted icons + text packs in this tree (a fresh clone): run node tools/extract-icons.mjs and tools/extract-text.mjs");
    return;
  }
  const raw = JSON.parse(fs.readFileSync(iconsAt, "utf8"));
  const pack = popupPackFrom(raw);
  const text = textPackFrom(JSON.parse(fs.readFileSync(textAt, "utf8")));
  assert.ok(hasPopupArt(pack) && text);

  // The timelines: removeMovieClip frames and the last frame the text is on.
  for (const icon of [POPUP_ICONS.damage, POPUP_ICONS.bonus, POPUP_ICONS.defend]) {
    const frames = pack.icons[icon.linkage].frames;
    assert.equal(frames.length, icon.frames, `${icon.linkage} declares ${icon.frames} frames`);
    assert.equal(raw.icons[icon.linkage].timeline.removesSelfAt, icon.frames);
    const lastText = frames.reduce((last, placements, index) =>
      (placements.some((placement) => placement.kind === "text") ? index + 1 : last), 0);
    assert.equal(lastText, icon.numberFrames, `${icon.linkage}'s text leaves after frame ${icon.numberFrames}`);
  }
  // The number fields: 816 in 817 and 152 in 153, font 118 at 34 px, variable damage/bonus.
  assert.equal(text.fields[816].variable, "damage");
  assert.equal(text.fields[152].variable, "bonus");
  assert.equal(text.fields[816].fontHeight, 680);
  // The splat words are the build's own static texts.
  for (const [splat, words] of Object.entries(SPLAT_WORDS)) {
    pack.nested[splat].frames.forEach((placements, index) => {
      const word = words[index + 1];
      const statics = placements.filter((placement) => placement.kind === "text").map((placement) => text.statics[placement.character]?.text);
      if (word) assert.deepEqual(statics, [word], `${splat} frame ${index + 1}`);
      else assert.deepEqual(statics, [], `${splat} frame ${index + 1} carries no word`);
    });
  }
  assert.equal(text.statics[820].text, "BLOCK");

  // A hurt blow: the red splat, the number in the build's own glyphs with its
  // black glow, and no number from frame 25.
  const hurt = { family: "damage", text: "12", splatFrame: 2 };
  const first = popupOpsFor(pack, text, hurt, 1, { scale: 2 });
  assert.equal(first.filter((op) => op.glyph).map((op) => op.glyph.char).join(""), "12");
  assert.ok(first.filter((op) => op.glyph).every((op) => op.group && (op.group.filter || op.group.amplify)),
    "816 carries a GlowFilter (black, blur 2, strength 10)");
  assert.equal(popupOpsFor(pack, text, hurt, 25, { scale: 2 }).filter((op) => op.glyph).length, 0);
  // The splat fades on its own timeline: 254/256 at frame 7, gone by 30.
  const fade = (frame) => popupOpsFor(pack, text, hurt, frame).filter((op) => op.popup === "shape")[0].fillOpacity;
  assert.equal(fade(6), 1);
  assert.equal(fade(7), 0.992);
  assert.equal(popupOpsFor(pack, text, hurt, 30).length, 0, "frame 30 is never drawn");
  // A critical carries CRITICAL; a bolt carries LIGHTNING over its number.
  const words = (popup) => popupOpsFor(pack, text, popup, 1).filter((op) => op.glyph).map((op) => op.glyph.char).join("");
  assert.equal(words({ family: "damage", text: "30", splatFrame: 3 }), "CRITICAL30");
  assert.equal(words({ family: "bonus", text: "17", splatFrame: 8 }), "LIGHTNING17");
  assert.equal(words({ family: "defend", text: null }), "BLOCK");

  // The fallback stands where the pack draws: its centres are the pack's boxes.
  const centre = (character, matrix) => {
    const b = raw.texts[character].bounds;
    return [(b.xMin + b.xMax) / 2 + matrix[4] / 20, (b.yMin + b.yMax) / 2 + matrix[5] / 20];
  };
  const number = popupFallbackOpsFor(hurt, 1)[0];
  const [nx, ny] = centre(816, raw.icons.damage_icon.frames[0][1].matrix);
  assert.ok(Math.abs(number.x - nx) < 0.05 && Math.abs(number.y - ny) < 0.05, `number at ${nx},${ny}`);
  const block = popupFallbackOpsFor({ family: "defend" }, 1)[0];
  const [bx, by] = centre(820, raw.icons.defend_icon.frames[0][1].matrix);
  assert.ok(Math.abs(block.x - bx) < 0.05 && Math.abs(block.y - by) < 0.05, `BLOCK at ${bx},${by}`);
});
