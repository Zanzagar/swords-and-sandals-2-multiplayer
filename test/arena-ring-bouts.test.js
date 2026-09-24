/**
 * THE RING'S ACCEPTANCE (slice S2 of `docs/design/battle-ui.md`): whole bouts
 * played the way the arena seats them under `?play=red`, every red turn chosen
 * ONLY through the ring model — a key on a slot, an arrow key on a move (S4),
 * a letter on the items row (S5), Tab / Shift+Tab to switch the target, or an
 * entry in the off-ring list — by one fixed policy, and every
 * blue turn by the rule set's own AI, as `aiTurnStep` takes it.
 *
 * What is pinned:
 * 1. every action the ring sends is on the engine's offer at that moment, and
 *    every bout finishes — seeds 1-5, 1v1 and 3v3, plain and `tricks`;
 * 2. asking the ring changes nothing: an AI-vs-AI bout (`?spectate=1`) takes
 *    the same state-hash sequence whether or not the ring is built for every
 *    fighter against every foe on every turn.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { ss2BattleValues, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import { seatControllersFrom, seatTurnFor, withSeatControllers } from "../tools/arena/seats.js";
import { ringKeyCommand, ringModelFor } from "../tools/arena/ring.js";

const deps = { ss2Combatant, ss2BattleValues };

/** The arena's host for a query string, seated as `tools/arena/main.js` seats it. */
function seatedHost({ perSide, seed, kit, query }) {
  const items = demoItemsFrom(kit);
  const teams = [demoSide("red", perSide, { ...deps, items, seed }), demoSide("blue", perSide, { ...deps, items, seed })];
  const seats = seatControllersFrom(new URLSearchParams(query), teams);
  const host = createVanillaBattleHost({
    teams: withSeatControllers(teams, seats), rules: ss2TeamRules, bindings: SS2_STATIC_MAP_BINDINGS, seed
  });
  return { host, seats };
}

/** The ring for whoever is due, with his last selection — the shell's own call. */
function ringOf(host, previous) {
  const actorId = host.currentCombatantId();
  return ringModelFor({
    actorId,
    combatants: host.wire().teams.flatMap((team) => team.combatants),
    legal: host.legalActions(),
    previous,
    menuFor: (targetId) => host.unavailableActions(actorId, targetId)
  });
}

const ATTACKS = ["power_attack", "normal_attack", "quick_attack", "bash_attack", "sniperight", "snipeleft", "bombardright", "bombardleft"];
const identity = (action) => JSON.stringify([action.type, action.targetId, action.spellKind ?? null, action.itemId ?? null]);

/**
 * THE FIXED POLICY — one choice from what the model shows, never from the
 * offer itself: a swing or a shot on the ring; else a spell at the selected
 * foe from the items row, the first left to right, by its letter (S5 put the
 * spells there; ~~from the list~~ until then, in the offer's order); else the
 * walk toward him in its slot, by its arrow key; else the
 * rank change toward his rank, by its arrow key (S4 put both on the ring;
 * ~~the list's rank change~~ until then); else the first filled slot; else,
 * with nothing listed, the swap by key 9 (S6); else the first listed.
 * Returns `{ via, action }`.
 */
function choose(model, selected, actor) {
  const byVerb = (verbs) => verbs.map((verb) => model.slots.find((slot) => slot.verb === verb)).find(Boolean);
  const press = (slot) => {
    const command = ringKeyCommand(model, { key: slot.key, focus: "stage" });
    assert.equal(command?.kind, "act", `key ${slot.key} presses ${slot.verb}`);
    return { via: "key", action: command.action };
  };
  const listed = (wanted) => model.offRing.find((entry) => wanted(entry.action));
  const attack = byVerb(ATTACKS);
  if (attack) return press(attack);
  const spell = model.items.find((item) => item.action?.type.startsWith("cast-") && item.action.targetId === model.selectedId);
  if (spell) {
    const command = ringKeyCommand(model, { key: spell.key.toLowerCase(), focus: "stage" });
    assert.equal(command?.kind, "act", `key ${spell.key} casts ${spell.action.type}`);
    return { via: "item", action: command.action };
  }
  const arrow = (key) => {
    const command = ringKeyCommand(model, { key, focus: "stage" });
    return command?.kind === "act" ? { via: "arrow", action: command.action } : null;
  };
  // The walk toward him IN ITS SLOT, as before S4 (a walk beside the ring is one the stance does
  // not wire — toward a foe already in reach — and this policy does not take it).
  const toward = model.moves.find((move) => move.move === (model.stance?.facing === "left" ? "walk-left" : "walk-right") && move.place === "slot");
  if (toward) return arrow(toward.key);
  if (Number.isFinite(selected?.y) && Number.isFinite(actor?.y) && selected.y !== actor.y) {
    const rank = arrow(selected.y > actor.y ? "ArrowDown" : "ArrowUp");
    if (rank) return rank;
  }
  const any = model.slots.find((slot) => slot.action);
  if (any) return press(any);
  // S6 took the swap off the list and put it on key 9: a turn whose only offer is the forced swap (no
  // arrows left, bow drawn) has nothing listed, and presses 9. (Never reached in these 20 bouts: the
  // tally is S4's to the digit, with `swap` 0.)
  if (model.swap && model.offRing.length === 0) {
    const command = ringKeyCommand(model, { key: model.swap.key, focus: "stage" });
    assert.equal(command?.kind, "act", "key 9 presses the swap");
    return { via: "swap", action: command.action };
  }
  assert.ok(model.offRing.length > 0, "a person's turn always offers something");
  return { via: "list", action: model.offRing[0].action };
}

test("?play=red: whole bouts chosen only through the ring — every action sent is on offer, and every bout finishes", (t) => {
  const tally = { bouts: 0, personTurns: 0, aiTurns: 0, key: 0, arrow: 0, item: 0, swap: 0, list: 0, tab: 0, shiftTab: 0, attacksByKey: 0 };
  for (const perSide of [1, 3]) {
    for (const kit of ["", "tricks"]) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const { host, seats } = seatedHost({ perSide, seed, kit, query: "play=red" });
        const selection = new Map();
        let personTurn = 0;
        for (let taken = 0; !host.battle.result; taken += 1) {
          assert.ok(taken < 4000, `${perSide}v${perSide} ${kit || "plain"} seed ${seed} never finished`);
          const turn = seatTurnFor(host.battle, seats, { ready: true });
          const actorId = turn.actorId;
          if (turn.ai) {
            assert.ok(actorId.startsWith("blue-"), "the AI plays blue");
            host.submit({ ...host.suggestAction(actorId), actorId });
            tally.aiTurns += 1;
            continue;
          }
          assert.ok(actorId.startsWith("red-"), "a person plays red");
          let model = ringOf(host, selection.get(actorId) ?? null);
          // Every fourth turn the target is switched first: Tab, and every eighth Shift+Tab.
          if (personTurn % 4 === 3 && model.foeIds.length > 1) {
            const back = personTurn % 8 === 7;
            const command = ringKeyCommand(model, { key: "Tab", shiftKey: back, focus: "stage" });
            assert.equal(command.kind, "select");
            assert.notEqual(command.foeId, model.selectedId);
            model = ringOf(host, command.foeId);
            assert.equal(model.selectedId, command.foeId);
            tally[back ? "shiftTab" : "tab"] += 1;
          }
          selection.set(actorId, model.selectedId);
          const byId = new Map(host.wire().teams.flatMap((team) => team.combatants).map((c) => [c.id, c]));
          const { via, action } = choose(model, byId.get(model.selectedId), byId.get(actorId));
          const offer = host.legalActions().map(identity);
          assert.ok(offer.includes(identity(action)), `${actorId}: the ring sent ${identity(action)}, which is not on offer`);
          assert.equal(action.actorId, actorId);
          host.submit(action);
          tally[via] += 1;
          if (via === "key" && /attack|snipe|bombard|bash/.test(action.type)) tally.attacksByKey += 1;
          tally.personTurns += 1;
          personTurn += 1;
        }
        tally.bouts += 1;
      }
    }
  }
  assert.equal(tally.bouts, 20);
  // The policy really plays through the ring: it swings by key, casts by letter (S5), lists, and
  // switches targets both ways.
  assert.ok(tally.attacksByKey > 0 && tally.arrow > 0 && tally.item > 0 && tally.list > 0 && tally.tab > 0 && tally.shiftTab > 0, JSON.stringify(tally));
  t.diagnostic(JSON.stringify(tally));
});

test("asking the ring changes nothing: a spectated bout's state-hash sequence is the same with the ring built on every turn", () => {
  for (const [perSide, kit, seed] of [[1, "", 1], [3, "", 2], [3, "tricks", 3], [1, "tricks", 4]]) {
    const run = (withRing) => {
      const { host, seats } = seatedHost({ perSide, seed, kit, query: "spectate=1" });
      const hashes = [host.hash()];
      while (!host.battle.result) {
        const turn = seatTurnFor(host.battle, seats, { ready: true });
        assert.ok(turn.ai, "spectating: every seat is the AI's");
        if (withRing) {
          const first = ringOf(host, null);
          for (const foeId of first.foeIds) ringOf(host, foeId);
          assert.equal(host.hash(), hashes[hashes.length - 1], "building the ring moved the state");
        }
        host.submit({ ...host.suggestAction(turn.actorId), actorId: turn.actorId });
        hashes.push(host.hash());
        assert.ok(hashes.length < 4000, "finished");
      }
      return hashes;
    };
    const plain = run(false);
    assert.deepEqual(run(true), plain, `${perSide}v${perSide} ${kit || "plain"} seed ${seed}`);
    assert.ok(plain.length > 10);
  }
});
