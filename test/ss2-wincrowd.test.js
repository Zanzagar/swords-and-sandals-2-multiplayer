/**
 * `wincrowd` — the controller verb that plays to the crowd.
 *
 * Re-derived 2026-09-23 from `sprite:862[overlay]/frame:52/DoAction@0x240c7f`
 * (base `0x240c85`), `+0x4fc9`-`+0x513d`, and the four controller frames of
 * `sprite:862[overlay]`:
 *
 * ```text
 *   phase_decision == "wincrowd"                                     +0x4fc9-+0x4fd6
 *     _global.crowd_action = Math.round(_root.game.hero.charisma / 2)  +0x4fdb-+0x500d  (EVERY tick)
 *     game_attacker.staminacost = 3                                  +0x500e-+0x501e
 *     if (attacker.struck == null) {                                 +0x501f-+0x5031
 *       attacker.struck = false                                      +0x5036-+0x5043
 *       if (!(attacker.wincrowd_move > 0) || attacker.wincrowd_move == undefined)
 *         attacker.wincrowd_move = 1 + RandomNumber(6)               +0x5082-+0x5093  (the OPCODE)
 *       attacker.wincrowd_move += 1; if (> 6) = 1                    +0x5094-+0x50dd
 *       animstate = "wincrowd" + attacker.wincrowd_move; attacker.gotoAndPlay(animstate)  +0x50de-+0x5108
 *     }
 *     if (attacker.struck == true) { attacker.struck = null; nextphase() }  +0x5109-+0x513d
 *
 *   the button — optionG or optionH by facing, on ALL FOUR controller frames:
 *     if (_root.game.hero.herolevel < 3) option._visible = false
 *       frame 5  +0x095e / +0x0e12    frame 13 +0x0785 / +0x0bb1
 *       frame 20 +0x0928 / +0x0e1d    frame 28 +0x0951 / +0x0d3a
 * ```
 *
 * OWNER'S DECISION 2026-09-22 (HANDOFF.md living head, (f)): the crowd delta is
 * the ACTOR's own `round(charisma / 2)`; the build always reads the hero's.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, lastResolvedAction, legalActions,
  rngJournal, suggestAction, toTeamWireState
} from "../src/team/index.js";
import {
  SS2_FACING_LEFT, Ss2ActionType, VANILLA_PHASE_LABEL, createSs2TeamRules, ss2Combatant, ss2TeamRules,
  ss2WincrowdClip
} from "../src/team/ss2-rules.js";
import { ss2CrowdInterestOf } from "../src/team/ss2-crowd.js";
import {
  buildArenaLayout, CommandKind, LabelProvenance, presentResolvedEvents, SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";
import { timelineFor } from "../src/render/timeline.js";

const WINCROWD = Ss2ActionType.WINCROWD;

const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 5, character_level: 5, weapon: 1, ...o
});

function face(battle, id, left) {
  const combatant = combatantById(battle, id);
  combatant.status = combatant.status.filter((token) => token !== SS2_FACING_LEFT);
  if (left) combatant.status.push(SS2_FACING_LEFT);
}

/** Hero at 0 facing right, foe `gap` away facing left; `controller` for both. */
function staged({ hero = {}, foe = {}, gap = 100, controller = "local", heroFirst = true, rules = ss2TeamRules } = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rules,
    teams: [
      { id: "red", combatants: [ss2Combatant(fields({ speed: heroFirst ? 21 : 19, ...hero }), { id: "hero", name: "hero", controller })] },
      { id: "blue", combatants: [ss2Combatant(fields({ vitality: 30, ...foe }), { id: "foe", name: "foe", controller })] }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: 0, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: gap, y: 200 });
  face(battle, "hero", false);
  face(battle, "foe", true);
  return battle;
}

const crowd = (battle) => ss2CrowdInterestOf(toTeamWireState(battle));
const offered = (battle, id = "hero") =>
  legalActions(battle, id).filter((option) => option.type === WINCROWD).map((option) => option.targetId);
const value = (battle, id, name) => combatantById(battle, id).resources[name]?.value;

/* ------------------------------------------------------------------ *
 * The vocabulary and the offer                                        *
 * ------------------------------------------------------------------ */

test("the token round-trips to the build's own label, wincrowd", () => {
  assert.equal(WINCROWD, "wincrowd");
  assert.equal(VANILLA_PHASE_LABEL[WINCROWD], "wincrowd"); // `+0x4fcf`
  assert.ok(ss2TeamRules.actionTypes.includes(WINCROWD));
});

test("the offer is the hero's button gate, herolevel >= 3, applied to every seat: not at 2, at 3", () => {
  // `Push 3; Less2; Not; If` then `_visible = false` — hidden BELOW 3, shown at 3.
  assert.deepEqual(offered(staged({ hero: { herolevel: 2 } })), []);
  assert.deepEqual(offered(staged({ hero: { herolevel: 3 } })), ["hero"]);
  // The hero's rule is the player's rule: the SECOND seat is gated identically.
  assert.deepEqual(offered(staged({ foe: { herolevel: 2 } }), "foe"), []);
  assert.deepEqual(offered(staged({ foe: { herolevel: 3 } }), "foe"), ["foe"]);
});

/* ------------------------------------------------------------------ *
 * The crowd delta — the ACTOR's charisma, the owner's decision        *
 * ------------------------------------------------------------------ */

test("the crowd takes round(charisma / 2) of the ACTOR — the hero acting, half rounding up", () => {
  // Opening crowd = 5 + 5 (both herolevels). charisma 7 -> round(3.5) = 4 (a half rounds UP).
  const odd = staged({ hero: { charisma: 7 } });
  assert.equal(currentCombatant(odd).id, "hero");
  assert.equal(crowd(odd), 10);
  applyAction(odd, { actorId: "hero", type: WINCROWD, targetId: "hero" });
  assert.equal(crowd(odd), 14);
  // charisma 12 -> 6.
  const even = staged({ hero: { charisma: 12 } });
  applyAction(even, { actorId: "hero", type: WINCROWD, targetId: "hero" });
  assert.equal(crowd(even), 16);
});

test("OWNER'S DIVERGENCE: a VILLAIN's wincrowd adds its OWN round(charisma / 2), not the hero's", () => {
  // The build reads `_root.game.hero.charisma` whoever acts (+0x4fe7-+0x4ff2), so this
  // villain would add round(2 / 2) = 1 there. The owner decided the actor's: round(9 / 2) = 5.
  const battle = staged({ hero: { charisma: 2 }, foe: { charisma: 9 }, heroFirst: false });
  assert.equal(currentCombatant(battle).id, "foe");
  applyAction(battle, { actorId: "foe", type: WINCROWD, targetId: "foe" });
  assert.equal(crowd(battle), 15, "10 + 5, not 10 + 1");
});

/* ------------------------------------------------------------------ *
 * The stamina, the heal and the psyche chain — nextphase's            *
 * ------------------------------------------------------------------ */

test("the stamina is nextphase's: -3 (+0x5014, spent at +0x32a1), then + 1 + round(stamina / 3), and the heal", () => {
  const battle = staged({ hero: { stamina: 3 } });
  const hero = combatantById(battle, "hero");
  hero.resources.staminaleft.value = 40;
  hero.health = hero.maxHealth - 10;
  applyAction(battle, { actorId: "hero", type: WINCROWD, targetId: "hero" });
  // 40 - 3 + 1 + round(3 / 3) = 39.
  assert.equal(value(battle, "hero", "staminaleft"), 39);
  // + 1 + ceil(3 / 2) = 3 hitpoints (+0x3305).
  assert.equal(combatantById(battle, "hero").health, combatantById(battle, "hero").maxHealth - 7);
  const event = lastResolvedAction(battle).events.find((entry) => entry.type === WINCROWD);
  assert.equal(event.staminaSpent, 3);
  assert.equal(event.staminaGained, -1);
  assert.equal(event.healed, 3);
});

test("no stamina gate: offered at 1 stamina left, floored at 0 by check_stats — and pre-empted only at 0", () => {
  const battle = staged({ hero: { stamina: 1 } });
  combatantById(battle, "hero").resources.staminaleft.value = 1;
  assert.deepEqual(offered(battle), ["hero"]);
  applyAction(battle, { actorId: "hero", type: WINCROWD, targetId: "hero" });
  // 1 - 3 + 1 + round(1 / 3) = -1, and the build's clamp floors it.
  assert.equal(value(battle, "hero", "staminaleft"), 0);
  // At zero the forced rest takes the turn before any button is wired.
  const broke = staged();
  combatantById(broke, "hero").resources.staminaleft.value = 0;
  assert.deepEqual(offered(broke), []);
});

test("a wincrowd breaks a psyche chain: nextphase writes psyche_up = 1 on every decision but psyche_up (+0x35c7)", () => {
  const battle = staged({ hero: { psyche_up: 3 } });
  assert.equal(value(battle, "hero", "psyche_up"), 3);
  applyAction(battle, { actorId: "hero", type: WINCROWD, targetId: "hero" });
  assert.equal(value(battle, "hero", "psyche_up"), 1);
});

/* ------------------------------------------------------------------ *
 * Nothing drawn, nobody touched, nobody killed                        *
 * ------------------------------------------------------------------ */

test("NOT ONE sample on the combat channel, and the defender is neither read nor written", () => {
  const battle = staged();
  const draws = rngJournal(battle).length;
  const cursor = battle.rngCursor;
  const foeBefore = JSON.stringify(combatantById(battle, "foe"));
  applyAction(battle, { actorId: "hero", type: WINCROWD, targetId: "hero" });
  // The build's one draw is the `RandomNumber(6)` OPCODE (+0x5091), and it picks a clip.
  assert.equal(rngJournal(battle).length, draws, "no randomBetween, and the clip's opcode is not taken here");
  assert.equal(battle.rngCursor, cursor);
  assert.equal(JSON.stringify(combatantById(battle, "foe")), foeBefore);
});

test("THE KILLING PATH CANNOT OCCUR: the arm deals no damage, so it never kills and nextphase always runs", () => {
  // A hero one hitpoint from death, a foe one hitpoint from death: nobody falls,
  // because nothing in +0x4fc9-+0x513d touches hitpoints or calls a damage helper.
  const battle = staged({ foe: { vitality: 6 } });
  combatantById(battle, "hero").health = 1;
  combatantById(battle, "foe").health = 1;
  applyAction(battle, { actorId: "hero", type: WINCROWD, targetId: "hero" });
  const resolved = lastResolvedAction(battle);
  assert.deepEqual(resolved.effects.filter((effect) => effect.kind === "damage"), [], "no damage effect at all");
  assert.equal(battle.result, null);
  assert.equal(combatantById(battle, "foe").health, 1);
  // nextphase ran: the heal (1 + ceil(6 / 2) = 4) and the crowd step both landed.
  assert.equal(combatantById(battle, "hero").health, 5);
  assert.equal(crowd(battle), 13, "10 + round(6 / 2)");
});

/* ------------------------------------------------------------------ *
 * The clip — "wincrowd" + wincrowd_move, chosen without a sample      *
 * ------------------------------------------------------------------ */

const CYCLE = ["wincrowd1", "wincrowd2", "wincrowd3", "wincrowd4", "wincrowd5", "wincrowd6"];
const next = (clip) => CYCLE[(CYCLE.indexOf(clip) + 1) % CYCLE.length];

test("the clip is one of the six, and back-to-back rounds step it one along the build's cycle, 6 wrapping to 1", () => {
  for (const id of ["hero", "foe", "red-1", "blue-3"]) {
    for (let round = 1; round <= 14; round += 1) {
      const clip = ss2WincrowdClip(id, round);
      assert.ok(CYCLE.includes(clip), `${id} round ${round}: ${clip}`);
      // `wincrowd_move += 1; if (> 6) = 1` (+0x5094-+0x50dd): the next one is the next clip.
      assert.equal(ss2WincrowdClip(id, round + 1), next(clip), `${id} round ${round} -> ${round + 1}`);
    }
  }
});

test("each fighter has its own start, as each fighter clip has its own wincrowd_move — and it is deterministic", () => {
  // PINNED, not derived: two peers must pick the same clip from the same state, so a
  // change to the rule is a version boundary. (These are this engine's values, not the build's.)
  assert.equal(ss2WincrowdClip("hero", 1), "wincrowd5");
  assert.equal(ss2WincrowdClip("red-2", 1), "wincrowd1");
  // Per FIGHTER, not one phase for the whole arena: across a 3v3's ids the round-1
  // clips are not all one clip. (Two fighters CAN share a start, one pair in six, as
  // two independent draws of the build's can — `hero` and `foe` happen to.)
  const ids = ["red-1", "red-2", "red-3", "blue-1", "blue-2", "blue-3"];
  assert.ok(new Set(ids.map((id) => ss2WincrowdClip(id, 1))).size > 1);
  // Every one of the six is reachable, so every render family the six have is played.
  assert.deepEqual(new Set(Array.from({ length: 6 }, (unused, index) => ss2WincrowdClip("hero", index + 1))), new Set(CYCLE));
});

test("the event carries the clip it plays, and consecutive rounds of wincrowd by one fighter cycle it", () => {
  // 500 apart, so the foe can pass its turn with a rest: in reach no voluntary
  // rest is offered since 2026-09-24 (the owner's decision).
  const battle = staged({ gap: 500 });
  applyAction(battle, { actorId: "hero", type: WINCROWD, targetId: "hero" });
  const first = lastResolvedAction(battle).events.find((entry) => entry.type === WINCROWD);
  assert.deepEqual(
    { ...first, staminaGained: undefined, healed: undefined },
    {
      type: WINCROWD,
      actorId: "hero",
      targetId: "hero",
      vanillaLabel: "wincrowd",
      casterClip: ss2WincrowdClip("hero", 1),
      staminaSpent: 3,
      staminaGained: undefined,
      healed: undefined
    }
  );
  applyAction(battle, { actorId: "foe", type: Ss2ActionType.REST, targetId: "foe" });
  applyAction(battle, { actorId: "hero", type: WINCROWD, targetId: "hero" });
  const second = lastResolvedAction(battle).events.find((entry) => entry.type === WINCROWD);
  assert.equal(second.casterClip, next(first.casterClip));
});

test("a presented wincrowd plays its clip on the actor, MAP_NAMED and drawable, and nothing on anybody else", () => {
  const battle = staged();
  applyAction(battle, { actorId: "hero", type: WINCROWD, targetId: "hero" });
  const played = lastResolvedAction(battle).events[0].casterClip;
  const wire = toTeamWireState(battle);
  const { commands } = presentResolvedEvents(wire, { layout: buildArenaLayout(wire), bindings: SS2_STATIC_MAP_BINDINGS });
  const clips = commands.filter((command) => command.kind === CommandKind.CLIP_GOTO);
  assert.deepEqual(
    clips.map(({ combatantId, role, label, labelProvenance }) => ({ combatantId, role, label, labelProvenance })),
    [{ combatantId: "hero", role: "actor", label: played, labelProvenance: LabelProvenance.MAP_NAMED }]
  );
  assert.deepEqual(commands.filter((command) => command.kind === CommandKind.UNMAPPED), []);
  // All six have a render family since 0298fb2, so whichever is chosen draws.
  for (const clip of CYCLE) assert.equal(timelineFor(clip, { role: "actor" }).recognised, true, clip);
});

/* ------------------------------------------------------------------ *
 * The AI — the build's `choices > 95` band is a draw this AI never    *
 * takes; ~~and wincrowd prices at zero hitpoints~~ since 2026-09-23   *
 * it prices the PURSE, and only safely out of range and ahead         *
 * (`test/ss2-ai-crowd.test.js`)                                       *
 * ------------------------------------------------------------------ */

test("the AI is offered wincrowd and never takes it BEHIND: near or far, rested or below 30%, taunting or not", () => {
  // The build's villain takes it on `choices = randomBetween(1, 100) > 95` (+0x0b7c, +0x0e6b), or
  // rests below 30% stamina (+0x0bc3, +0x0eb2), in the branch its OWN range test fails into
  // (+0x08c3). This AI takes no `choices` sample, ~~and its criterion — hitpoints — prices a
  // phase that deals none, moves nobody and closes nothing at zero.~~
  //
  // ► **CORRECTED 2026-09-23: it prices the purse now (`aiPlaysToCrowd`, the owner's decision),
  //   and plays to the crowd when SAFELY OUT OF RANGE AND AHEAD.** Every state here still
  //   refuses, for a reason this comment used not to need: the hero is BEHIND — `staged` gives
  //   the foe vitality 30, 650 max health against the hero's 170, so the hero's side holds 21%
  //   of the living hitpoints and the ahead gate is shut. The old AI, `aiPlaysToCrowd: false`,
  //   is swept too: it refuses everywhere, as it always did.
  const noTaunt = createSs2TeamRules({ aiTaunts: false });
  const oldAi = createSs2TeamRules({ aiPlaysToCrowd: false });
  let offers = 0;
  for (const rules of [ss2TeamRules, noTaunt, oldAi]) {
    for (const gap of [100, 150, 400, 1200]) {
      for (const fraction of [1, 0.35, 0.25, 0.05]) {
        for (const hero of [{}, { secondary_weapon: 61, equipped_weapon: 2, using_bow: true, ammo_left: 5 }]) {
          const battle = staged({ controller: "ai", gap, rules, hero });
          const actor = combatantById(battle, "hero");
          actor.resources.staminaleft.value = Math.max(1, Math.floor(actor.resources.staminamax.value * fraction));
          if (offered(battle).length === 1) offers += 1;
          const chosen = suggestAction(battle, "hero");
          assert.notEqual(chosen.type, WINCROWD, `gap ${gap}, stamina ${fraction}, ${rules.id}`);
        }
      }
    }
  }
  assert.equal(offers, 96, "every one of those states OFFERED it: the test is about the choice, not the gate");
});

test("a whole AI bout at herolevel 5: wincrowd offered on every turn, taken on none", () => {
  // ► **STILL TRUE SINCE THE AI VALUES THE PURSE (2026-09-23), and not because it prices the
  //   crowd at zero.** The foe here is far ahead (650 max health against 170) and plays to the
  //   crowd whenever it is safely out of range — but it never is on its own turn: the hero's
  //   opening walk closes the whole 500 in one step (to 86, inside both reaches), and the fight
  //   never opens again. The hero, behind all bout, never qualifies.
  const battle = staged({ controller: "ai", gap: 500 });
  let offers = 0;
  let taken = 0;
  let guard = 0;
  while (!battle.result && guard < 400) {
    guard += 1;
    const actor = currentCombatant(battle);
    if (legalActions(battle, actor.id).some((option) => option.type === WINCROWD)) offers += 1;
    const action = suggestAction(battle, actor.id);
    if (action.type === WINCROWD) taken += 1;
    applyAction(battle, { ...action, actorId: actor.id });
  }
  assert.ok(battle.result, `the bout must settle: ${guard} actions`);
  assert.ok(offers > 10, `offered ${offers} times`);
  assert.equal(taken, 0);
});
