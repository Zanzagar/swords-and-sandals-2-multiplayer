/**
 * S7'S ACCEPTANCE, OVER WHOLE SEEDED BOUTS (`docs/design/battle-ui.md`, "The
 * in-battle actions: DECIDED", items 4 and 9):
 *
 * 1. the preview a hover shows is `host.previewAction` for THAT button's
 *    action — found the way the shell finds it, by the point under the
 *    pointer (`ringSlotAt`) — and the strip's odds are exactly the offer's
 *    rolls at the selected foe, each the engine's chance;
 * 2. with "confirm every move" on, nothing is sent before Confirm: every
 *    press only chooses, the state does not move until Enter or Confirm, and
 *    what they send is the choice, on offer;
 * 3. previewing changes nothing: a spectated bout's state-hash sequence, and
 *    its record of random draws, are the same with every preview and every
 *    odds line asked for every fighter against every foe on every turn.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { rngJournal } from "../src/team/resolver.js";
import { SS2_UNAVAILABLE_REASONS, ss2BattleValues, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import { seatControllersFrom, seatTurnFor, withSeatControllers } from "../tools/arena/seats.js";
import { ringActionFor, ringConfirmCommand, ringEntries, ringKeyCommand, ringModelFor, ringPendingFor, ringPendingKept, ringPressCommand, ringShownFor } from "../tools/arena/ring.js";
import { ringButtonsAt, ringButtonsInside, ringItemButtonsAt, ringMoveButtonsAt, ringSlotAt, ringSwapButtonAt } from "../tools/arena/ring-layout.js";
import { ringOddsFor, ringPreviewFor, ringShownText } from "../tools/arena/ring-preview.js";

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
/** One person's turn, as the shell keys a choice: the round and whose place in it. */
const turnKeyOf = (host) => `${host.battle.turnNumber}:${host.battle.turnCursor}`;
const identity = (action) => JSON.stringify([action.actorId ?? null, action.type, action.targetId, action.spellKind ?? null, action.itemId ?? null]);
/** Everything drawn for a model, as `paintRing` gathers it, on a 640 x 420 stage. */
function drawnButtons(model) {
  const at = { centerX: 320, centerY: 210, unit: 1.2 };
  const bounds = { top: 0, bottom: 420 };
  return ringButtonsInside([
    ...ringButtonsAt(model, at),
    ...ringItemButtonsAt(model, { ...at, head: 140, bounds }),
    ...ringSwapButtonAt(model, at),
    ...ringMoveButtonsAt(model, { ...at, head: 140, feet: 330, bounds })
  ], { x: 0, y: 0, width: 640, height: 420 }, { fighterX: at.centerX });
}

/**
 * THE NUMBERS A PREVIEW'S WORDS STATE, read back out of the text by a parser
 * that shares nothing with the code that wrote it.
 */
function statedIn(text) {
  const hit = /(\d+)% to hit/.exec(text);
  const damage = /(\d+)(?:–(\d+))? damage/.exec(text);
  const costs = /costs (\d+) stamina/.exec(text);
  const gains = /gains (\d+) stamina/.exec(text);
  return {
    chance: hit ? Number(hit[1]) : null,
    certain: text.includes("cannot miss"),
    wasted: text.includes("out of range: wasted"),
    damage: damage ? { min: Number(damage[1]), max: Number(damage[2] ?? damage[1]) } : null,
    energy: costs ? Number(costs[1]) : gains ? 0 - Number(gains[1]) : 0
  };
}

test("ACCEPTANCE: every hover shows host.previewAction for the button under the pointer, and the odds are the offer's rolls at the selected foe", (t) => {
  const tally = { bouts: 0, turns: 0, selections: 0, hovered: 0, greyedHovered: 0, listed: 0, withChance: 0, certain: 0, wasted: 0, oddsLines: 0, odds: 0 };
  for (const perSide of [1, 3]) {
    for (const kit of ["", "tricks", "blasts", "crowd"]) {
      for (const seed of [1, 2]) {
        const { host } = seatedHost({ perSide, seed, kit, query: "" });
        for (let taken = 0; !host.battle.result; taken += 1) {
          assert.ok(taken < 4000, "finished");
          const actorId = host.currentCombatantId();
          const nameOf = (id) => host.combatant(id)?.name ?? id;
          const before = host.hash();
          const draws = rngJournal(host.battle).length;
          const offer = host.legalActions().map((action) => ({ ...action, actorId }));
          for (const foeId of ringOf(host, null).foeIds) {
            const model = ringOf(host, foeId);
            if (!model.stance) continue;
            tally.selections += 1;
            const check = (action, label) => {
              const preview = host.previewAction(action);
              assert.ok(preview, `${label}: the engine previews every offered action`);
              const shown = ringPreviewFor(model, action, preview, { nameOf });
              assert.ok(shown, `${label}: on screen, so it previews`);
              assert.ok(shown.action === ringActionFor(model, label) || label === "list", `${label}: the button's own action`);
              const stated = statedIn(shown.text);
              if (preview.outOfRange) {
                assert.ok(stated.wasted && stated.chance === null, `${label}: ${shown.text}`);
                tally.wasted += 1;
              } else {
                assert.equal(stated.chance, preview.chance, `${label}: ${shown.text}`);
                assert.equal(shown.chance, preview.chance);
              }
              assert.equal(stated.certain, preview.certain === true && !preview.outOfRange, `${label}: ${shown.text}`);
              assert.deepEqual(stated.damage, preview.damage ? { min: preview.damage.min, max: preview.damage.max } : null, `${label}: ${shown.text}`);
              assert.equal(stated.energy, preview.energy, `${label}: ${shown.text}`);
              if (Number.isFinite(preview.chance)) tally.withChance += 1;
              if (preview.certain) tally.certain += 1;
            };
            // Hover: the point under the pointer is each drawn button's own centre.
            const buttons = drawnButtons(model);
            for (const button of buttons) {
              const slot = ringSlotAt(buttons, button.x, button.y);
              assert.equal(slot, button.slot, "the pointer on a button's centre is on that button");
              // S9: a GREYED button is drawn too, and the pointer on it shows why — the engine's own words
              // for its reason — and no preview: it sends nothing. ~~Every drawn button previews~~ before S9.
              if (button.reason) {
                assert.equal(ringActionFor(model, slot), null, `${slot}: greyed, it sends nothing`);
                const text = ringShownText(ringShownFor(model, slot), () => "a preview", { nameOf });
                assert.ok(text.endsWith(` — not now: ${SS2_UNAVAILABLE_REASONS[button.reason.code].says}`), `${slot}: ${text}`);
                tally.greyedHovered += 1;
                continue;
              }
              check(ringActionFor(model, slot), slot);
              tally.hovered += 1;
            }
            // Focus: every strip button, the listed ones included.
            for (const entry of ringEntries(model)) {
              check(entry.action, entry.place === "off" ? "list" : entry.slot);
              tally.listed += 1;
            }
            // The odds: exactly the OFFER's actions at this foe that roll to hit him, each the engine's chance.
            const odds = ringOddsFor(model, (action) => host.previewAction(action), { nameOf });
            const expected = offer
              .filter((action) => action.targetId === foeId)
              .map((action) => [action, host.previewAction(action)])
              .filter(([, preview]) => Number.isFinite(preview?.chance) && !preview.outOfRange);
            assert.deepEqual(odds.odds.map((one) => identity(one.action)).sort(), expected.map(([action]) => identity(action)).sort(),
              `${actorId} at ${foeId}: the odds are the offer's rolls at him`);
            for (const one of odds.odds) {
              assert.equal(one.chance, host.previewAction(one.action).chance);
              assert.ok(odds.text.includes(`${one.words} ${one.chance}%`), odds.text);
            }
            assert.ok(odds.text.includes(nameOf(foeId)), odds.text);
            tally.oddsLines += 1;
            tally.odds += odds.odds.length;
          }
          // ► Asking changed nothing: the state and the random draws are where they were.
          assert.equal(host.hash(), before, "previewing moved the state");
          assert.equal(rngJournal(host.battle).length, draws, "previewing drew randomness");
          tally.turns += 1;
          host.submit({ ...host.suggestAction(actorId), actorId });
        }
        tally.bouts += 1;
      }
    }
  }
  assert.equal(tally.bouts, 16);
  assert.ok(tally.withChance > 0 && tally.certain > 0 && tally.wasted > 0 && tally.odds > 0 && tally.greyedHovered > 0, JSON.stringify(tally));
  t.diagnostic(JSON.stringify(tally));
});

/**
 * THE POLICY, pressing through the ring as a person would, with the setting
 * ON: a swing or a shot; else a spell at the selected foe; else the walk
 * toward him; else the first filled slot; else the first listed. By its key
 * (a digit, a letter, an arrow) — or, with `click`, by a click on the centre
 * of its drawn button, found by `ringSlotAt` as the shell finds it. Returns
 * the COMMAND the press made (never sent here).
 */
function pressWithConfirm(model, { click = false } = {}) {
  // S9: a greyed slot or move shows its verb and sends nothing, so the policy takes only what ACTS;
  // ~~any slot showing the verb~~ was the same thing before S9.
  const attack = model.slots.find((slot) => slot.action && /attack|snipe|bombard|bash/.test(slot.verb ?? ""));
  const spell = model.items.find((item) => item.action?.type.startsWith("cast-") && item.action.targetId === model.selectedId);
  const toward = model.moves.find((move) => move.action && move.move === (model.stance?.facing === "left" ? "walk-left" : "walk-right"));
  const any = model.slots.find((slot) => slot.action);
  const [via, pick] = attack ? ["key", attack] : spell ? ["letter", spell] : toward ? ["arrow", toward] : any ? ["key", any] : ["list", null];
  if (!pick) return { via, command: ringPressCommand(model.offRing[0]?.action ?? null, { confirm: true }) };
  if (click) {
    const buttons = drawnButtons(model);
    const name = pick.move && pick.place !== "slot" ? pick.move : pick.slot;
    const button = buttons.find((one) => one.slot === name);
    assert.ok(button, `${name} is drawn`);
    return { via: "click", command: ringPressCommand(ringActionFor(model, ringSlotAt(buttons, button.x, button.y)), { confirm: true }) };
  }
  return { via, command: ringKeyCommand(model, { key: via === "letter" ? pick.key.toLowerCase() : pick.key, focus: "stage", confirm: true }) };
}

test("ACCEPTANCE: with confirm every move ON, nothing is sent before Confirm — whole ?play=red bouts", (t) => {
  const tally = { bouts: 0, personTurns: 0, aiTurns: 0, chosen: 0, key: 0, letter: 0, arrow: 0, click: 0, list: 0, back: 0, retargeted: 0, kept: 0, dropped: 0, enter: 0, confirmButton: 0 };
  for (const perSide of [1, 3]) {
    for (const kit of ["", "tricks", "crowd"]) {
      for (const seed of [1, 2, 3]) {
        const { host, seats } = seatedHost({ perSide, seed, kit, query: "play=red" });
        const selection = new Map();
        let personTurn = 0;
        for (let taken = 0; !host.battle.result; taken += 1) {
          assert.ok(taken < 4000, `${perSide}v${perSide} ${kit || "plain"} seed ${seed} never finished`);
          const turn = seatTurnFor(host.battle, seats, { ready: true });
          if (turn.ai) {
            host.submit({ ...host.suggestAction(turn.actorId), actorId: turn.actorId });
            tally.aiTurns += 1;
            continue;
          }
          const actorId = turn.actorId;
          const turnNumber = turnKeyOf(host);
          const start = host.hash();
          let model = ringOf(host, selection.get(actorId) ?? null);
          const choose = () => {
            // Every fifth turn by a click on the stage, else by a key.
            const { via, command } = pressWithConfirm(model, { click: personTurn % 5 === 2 });
            assert.equal(command?.kind, "choose", `${actorId}: a press with the setting on only chooses (${via})`);
            tally[via] += 1;
            tally.chosen += 1;
            assert.equal(host.hash(), start, "a choice sent nothing");
            return { turn: turnNumber, action: command.action };
          };
          let record = choose();
          // Every third turn, Esc takes the choice back and the person chooses again.
          if (personTurn % 3 === 1) {
            const back = ringKeyCommand(model, { key: "Escape", focus: "stage", confirm: true, pending: ringPendingFor(model, record, { turn: turnNumber }) });
            assert.deepEqual(back, { kind: "back" });
            record = null;
            assert.equal(ringKeyCommand(model, { key: "Enter", focus: "stage", confirm: true, pending: ringPendingFor(model, record, { turn: turnNumber }) }).kind,
              "ignore", "Enter with nothing chosen sends nothing");
            tally.back += 1;
            record = choose();
          }
          // Every fourth turn, Tab: the choice stands only if the new ring still shows it.
          if (personTurn % 4 === 3 && model.foeIds.length > 1) {
            const tab = ringKeyCommand(model, { key: "Tab", focus: "stage", confirm: true, pending: record.action });
            assert.equal(tab.kind, "select");
            model = ringOf(host, tab.foeId);
            tally.retargeted += 1;
            // What the shell keeps on the rebuild (`ringPendingKept`): the choice, or nothing to confirm.
            record = ringPendingKept(model, record, { turn: turnNumber });
            if (record) {
              tally.kept += 1;
            } else {
              tally.dropped += 1;
              assert.equal(ringConfirmCommand(model, ringPendingFor(model, record, { turn: turnNumber })), null, "nothing to confirm");
              record = choose();
            }
          }
          assert.equal(host.hash(), start, "nothing was sent before Confirm");
          selection.set(actorId, model.selectedId);
          const pending = ringPendingFor(model, record, { turn: turnNumber });
          assert.ok(pending, "the choice is on screen");
          // Confirm: Enter from the stage, or every other turn the strip's Confirm button.
          const command = personTurn % 2 === 0
            ? ringKeyCommand(model, { key: "Enter", focus: "stage", confirm: true, pending })
            : ringConfirmCommand(model, pending);
          assert.equal(command.kind, "act");
          assert.equal(identity(command.action), identity(record.action), "Confirm sends the choice");
          const offer = host.legalActions().map((action) => identity({ ...action, actorId }));
          assert.ok(offer.includes(identity(command.action)), "and it is on offer");
          host.submit(command.action);
          tally[personTurn % 2 === 0 ? "enter" : "confirmButton"] += 1;
          // After it is sent, the next turn starts with nothing chosen (a blow that ends the bout leaves
          // no next turn: the ring is gone with the result).
          if (!host.battle.result) assert.equal(ringPendingFor(model, record, { turn: turnKeyOf(host) }), null);
          tally.personTurns += 1;
          personTurn += 1;
        }
        tally.bouts += 1;
      }
    }
  }
  assert.equal(tally.bouts, 18);
  assert.equal(tally.chosen, tally.personTurns + tally.back + tally.dropped, "one choice a turn, plus one after each Esc or dropped choice");
  assert.ok(tally.key > 0 && tally.letter > 0 && tally.arrow > 0 && tally.click > 0 && tally.back > 0 && tally.kept > 0 && tally.dropped > 0 && tally.enter > 0 && tally.confirmButton > 0,
    JSON.stringify(tally));
  t.diagnostic(JSON.stringify(tally));
});

test("ACCEPTANCE: previewing changes nothing — a spectated bout's hashes and draws are the same with every preview asked", () => {
  for (const [perSide, kit, seed] of [[1, "", 1], [3, "", 2], [3, "tricks", 3], [1, "blasts", 4], [3, "crowd", 5]]) {
    const run = (withPreviews) => {
      const { host, seats } = seatedHost({ perSide, seed, kit, query: "spectate=1" });
      const hashes = [host.hash()];
      while (!host.battle.result) {
        const turn = seatTurnFor(host.battle, seats, { ready: true });
        assert.ok(turn.ai, "spectating: every seat is the AI's");
        if (withPreviews) {
          const draws = rngJournal(host.battle).length;
          for (const foeId of ringOf(host, null).foeIds) {
            const model = ringOf(host, foeId);
            for (const entry of ringEntries(model)) ringPreviewFor(model, entry.action, host.previewAction(entry.action));
            ringOddsFor(model, (action) => host.previewAction(action));
          }
          assert.equal(host.hash(), hashes[hashes.length - 1], "previewing moved the state");
          assert.equal(rngJournal(host.battle).length, draws, "previewing drew randomness");
        }
        host.submit({ ...host.suggestAction(turn.actorId), actorId: turn.actorId });
        hashes.push(host.hash());
        assert.ok(hashes.length < 4000, "finished");
      }
      return { hashes, draws: rngJournal(host.battle).length };
    };
    const plain = run(false);
    assert.deepEqual(run(true), plain, `${perSide}v${perSide} ${kit || "plain"} seed ${seed}`);
    // A blasts bout can end in a handful of bolts; it still has to have been fought.
    assert.ok(plain.hashes.length > 3, `${perSide}v${perSide} ${kit || "plain"} seed ${seed}: ${plain.hashes.length} hashes`);
  }
});
