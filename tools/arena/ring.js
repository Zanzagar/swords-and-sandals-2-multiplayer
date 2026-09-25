/**
 * THE RING'S MODEL — slices S2, S4, S5, S6 and S9 of `docs/design/battle-ui.md`
 * ("The in-battle actions: DECIDED"): on a person's turn, which foe is
 * selected, which of the build's four stances the ring shows, which verb sits
 * in which of the eight slots, where each walk and rank change the engine
 * offers stands (S4), which spell or potion each place of the items row holds
 * and whom it is aimed at (S5), whether the weapon swap is on the ring and
 * which weapon it offers (S6), which buttons the team rules GREY and why (S9),
 * what the engine offers that the ring does not show, and the exact action a
 * click, a digit, a letter or an arrow key sends — never one a greyed button
 * shows.
 *
 * Pure. It reads what it is handed — the fighters, the engine's offer and the
 * engine's own menu for the selected foe — and decides only how to ARRANGE
 * them: "the engine decides what is possible; the interface only arranges it".
 */

import { SS2_OPTION_SLOTS, SS2_OVERLAY_SLOTS, SS2_STRIP, SS2_SWAP_SLOT, actionButtonVerbFor } from "../../src/render/action-buttons.js";
import { SS2_UNAVAILABLE_REASONS, ss2FightDistance, ss2SameLane } from "../../src/team/ss2-rules.js";

/**
 * ► **THE FOUR MOVES AND THEIR ARROW KEYS (slice S4; the owner's Q5 and
 *   decision 9, "arrows move").** The walks go the way their arrow points; a
 *   rank BACK is up the stage (arena y falls going back) and FORWARD is down
 *   it, so Up steps back and Down steps forward — the same way the rank
 *   arrows stand, above the head and below the feet. AUTHORED: the build has
 *   no keyboard and no ranks.
 *
 * `place` is where the move stands when no slot of the stance holds it: a
 * walk BESIDE the build's walk slot on its side (see `ringModelFor`), a rank
 * change above the head or below the feet.
 */
export const RING_MOVES = Object.freeze([
  Object.freeze({ move: "walk-left", key: "ArrowLeft", glyph: "←", place: "beside" }),
  Object.freeze({ move: "walk-right", key: "ArrowRight", glyph: "→", place: "beside" }),
  Object.freeze({ move: "rank-back", key: "ArrowUp", glyph: "↑", place: "above-head" }),
  Object.freeze({ move: "rank-front", key: "ArrowDown", glyph: "↓", place: "below-feet" })
]);

/** How the strip writes a move's key: the arrow itself, not its DOM name. */
export const RING_KEY_GLYPHS = Object.freeze(Object.fromEntries(RING_MOVES.map((move) => [move.key, move.glyph])));

/**
 * WHICH KEY PRESSES WHICH SLOT: 1-4 down the ring's LEFT column, 5-8 down its
 * RIGHT column, top to bottom. Computed from the slots' own positions
 * (`SS2_OVERLAY_SLOTS`), never typed, so the numbers read in the order the
 * eye scans the ring. AUTHORED: the build has no keyboard map for the ring.
 */
export const RING_KEY_ORDER = Object.freeze([...SS2_OPTION_SLOTS].sort((left, right) => {
  const a = SS2_OVERLAY_SLOTS[left];
  const b = SS2_OVERLAY_SLOTS[right];
  const column = (position) => (position.x < 0 ? 0 : 1);
  return column(a) - column(b) || a.y - b.y;
}));

/**
 * ► **THE NINTH BUTTON (slice S6; the owner's decision 1, "the build's ninth
 *   button (weapon swap)"): the weapon swap, on key 9.** The build's swap is
 *   not a controller slot — `swap_inventory`, an `inventory_buttons` (116) at
 *   depth 101 of the overlay's frame 1, whose `onRelease` is
 *   `getphase("swap_weapons")` (overlay frame 1 body 0x2378d2, `+0x1067`) — so
 *   it keeps its own place on every stance. The key is AUTHORED: the build has
 *   no keyboard, and 9 follows the eight.
 *
 * `words` are the build's own, the rollover's `optiontext`: "Switch to melee
 * weapon" with the bow drawn (`+0x0f5e`), "Switch to ranged weapon" otherwise
 * (`+0x0f7f`) — the button names the weapon it swaps TO, as its icon does.
 */
export const RING_SWAP_KEY = "9";
const SWAP_WORDS = Object.freeze({ toMelee: "Switch to melee weapon", toRanged: "Switch to ranged weapon" });

/**
 * ► **THE ITEMS ROW (slice S5; the owner's decision 1, "its six-slot items
 *   row above the head for spells and potions").** The build's row is
 *   `inventory_overlay` (sprite 492): six `inventory_buttons` (116),
 *   `inventory_buttonN` showing whatever `hero.inventoryN` holds (492 frame 1
 *   body 0x50e55, `+0x0132`..`+0x0204`). Its buttons do not stand in slot
 *   order — left to right they are slots 5, 4, 1, 2, 3, 6
 *   (`SS2_STRIP.items.slots`) — so the KEYS go left to right across the row as
 *   drawn, Q W E R T Y, one per place, whatever it holds: the six letters of
 *   the keyboard row under the digits, in the order the eye reads the row.
 *   Computed from the row's positions, never typed. AUTHORED: the build has no
 *   keyboard.
 */
export const RING_ITEM_KEYS = Object.freeze(["Q", "W", "E", "R", "T", "Y"]);
export const RING_ITEM_ORDER = Object.freeze(Object.keys(SS2_STRIP.items.slots)
  .sort((left, right) => SS2_STRIP.items.slots[left].x - SS2_STRIP.items.slots[right].x));

/**
 * ► **WHAT EACH ITEM IS CALLED — THE BUILD'S OWN NAMES**, the words its row
 *   shows on rollover: `optiontext` (and `tooltip`) of `inventory_buttonN` is
 *   `_root["inventory" + hero.inventoryN][1]` (overlay frame 1 body 0x2378d2,
 *   `+0x0954`..`+0x0aaf`), and root frame 35 (body 0x3fa9e2) builds each
 *   `inventoryN` as `new Array(label, name, 1, price, description)`
 *   (`+0x4d27` for 2 … `+0x50b8` for 49). The build's spellings are kept
 *   ("Frightning Bolt", "Rejuvinate"), as the engine keeps them. Ids 0 and 1
 *   are "Nothing", and 10-29 have no entry at all.
 */
export const RING_ITEM_WORDS = Object.freeze({
  2: "Small health potion",
  3: "Medium health potion",
  4: "Large health potion",
  5: "Maximum health potion",
  6: "Medium stamina vial",
  7: "Maximum stamina vial",
  8: "Medium armour oil",
  9: "Maximum armour oil",
  30: "Fireball",
  31: "Hell Fireball",
  32: "Dire Fireball",
  33: "Little Fat Kid",
  34: "Lightning Bolt",
  35: "Frightning Bolt",
  36: "Ghost Strike",
  37: "Whirlwind",
  38: "Gale",
  39: "Command",
  40: "Swift Sandals",
  41: "Bloodlust",
  42: "Colossus",
  43: "Rejuvinate",
  44: "Weaken Armour",
  45: "Boundless Energy",
  46: "Regenerate",
  47: "Adulation",
  48: "Teleport",
  49: "Molten Death"
});

/**
 * ► **WHY A BUTTON IS GREYED, OR HIDDEN (slice S9; the owner's Q6 and Q8).**
 *   The engine's menu carries, for every button of the ring it does not
 *   offer, ONE reason code and that code's flag (`SS2_UNAVAILABLE_REASONS`):
 *   `hide` where the build itself hides the button (the stance, the level, an
 *   empty slot, a forced phase), `grey` where the team rules forbid it (another
 *   rank, a foe in reach, a body in the line, the duel, no rank that way) or
 *   the engine has no verb for it. A GREY one is drawn where it stands,
 *   dimmed, says why in the engine's own words, and can never act; a HIDE one
 *   is not drawn at all.
 *
 *   **Jump and charge stay HIDDEN whatever the engine flags them** — the
 *   owner's Q8 ("Jump and charge stay hidden and get their own design pass").
 *   The engine flags them `not-built`, a grey code, and on the long warrior
 *   frames they are three of the eight slots on every turn.
 */
export const RING_HIDDEN_VERBS = Object.freeze(["jumpleft", "jumpright", "chargeleft", "chargeright"]);

/**
 * The reason a menu entry is GREYED — `{code, words}`, the engine's code and
 * its own words for it — or null when the entry is on offer or hidden.
 */
export function ringGreyReasonOf(entry) {
  if (!entry || entry.available !== false || entry.display !== "grey") return null;
  if (RING_HIDDEN_VERBS.includes(entry.verb)) return null;
  const known = Object.hasOwn(SS2_UNAVAILABLE_REASONS, entry.reason) ? SS2_UNAVAILABLE_REASONS[entry.reason] : null;
  return Object.freeze({ code: entry.reason, words: known?.says ?? SS2_UNAVAILABLE_REASONS["not-offered"].says });
}

/**
 * What a greyed button WOULD send, for its words only — never sent: the verb's
 * action type, whom it would be aimed at, the actor, and a potion's item.
 */
function withheldOf(entry, actorId) {
  return Object.freeze({
    type: entry.type ?? null,
    targetId: entry.targetId ?? null,
    actorId,
    ...(entry.type === "drink-potion" && Number.isInteger(entry.itemId) ? { itemId: entry.itemId } : {})
  });
}

/**
 * WHO FIRST (the owner's Q4): a foe is always selected. The previous selection
 * is kept while it is still a living foe; otherwise the nearest foe in the
 * actor's own rank; otherwise the nearest foe.
 */
function selectFoe(actor, foes, previous) {
  const kept = foes.find((foe) => foe.id === previous);
  if (kept) return { id: kept.id, by: "kept" };
  const ownRank = foes.filter((foe) => ss2SameLane(actor, foe));
  if (ownRank.length > 0) return { id: nearest(actor, ownRank).id, by: "own-rank" };
  if (foes.length > 0) return { id: nearest(actor, foes).id, by: "nearest" };
  return { id: null, by: null };
}

/** The nearest by the engine's own fight distance; ties by id, as the engine breaks them. */
function nearest(actor, foes) {
  let best = null;
  let bestDistance = Infinity;
  for (const foe of foes) {
    const distance = ss2FightDistance(actor, foe) ?? Infinity;
    if (best === null || distance < bestDistance || (distance === bestDistance && foe.id < best.id)) {
      best = foe;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * THE ORDER TAB STEPS THROUGH: left to right across the stage, so Tab moves
 * the gold ring rightward and Shift+Tab leftward whichever way the actor
 * faces. Level foes: the front rank first (a larger arena y is nearer the
 * viewer), then the id. An unplaced foe goes last. AUTHORED.
 */
function stageOrder(foes) {
  const x = (foe) => (Number.isFinite(foe.x) ? foe.x : Infinity);
  const y = (foe) => (Number.isFinite(foe.y) ? foe.y : 0);
  return [...foes].sort((left, right) => x(left) - x(right) || y(right) - y(left) || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

/**
 * ► **THE RING FOR ONE PERSON'S TURN.**
 *
 * @param {object} input
 * @param {string} input.actorId  whoever is due
 * @param {object[]} input.combatants  every fighter as `host.wire()` projects
 *   him (`id`, `teamId`, `alive`, `x`, `y` are read)
 * @param {object[]} input.legal  `host.legalActions()` — THE OFFER
 * @param {string|null} [input.previous]  the foe this fighter had selected last
 * @param {(targetId: string) => object|null} input.menuFor
 *   `host.unavailableActions(actorId, targetId)` — the engine's own ring
 *   measured to that foe: its stance and, per slot, the build's verb
 * @returns {object} frozen:
 *   - `selectedId`, `selectedBy` (`kept` | `own-rank` | `nearest`), `foeIds`
 *     (Tab's order);
 *   - `stance` — `{frame, range, weapon, facing}` — **the ENGINE's**, measured
 *     to the selected foe (the build's controller selector, overlay frame 4,
 *     in `ss2UnavailableActions`); null when there is no menu to ask;
 *   - `slots` — eight, in KEY order (`RING_KEY_ORDER`), each `{key, slot,
 *     verb, action, reason, withheld}`; `action` null unless the offer holds
 *     it; `verb` null unless it acts or is GREYED (S9: `reason` `{code,
 *     words}`, `ringGreyReasonOf`, and `withheld` what it would send, for its
 *     words only); `reason`/`withheld` null otherwise;
 *   - `moves` (S4) — every walk and rank change the offer holds, in
 *     `RING_MOVES` order, each `{move, key, verb, place, slot, action}`:
 *     `place` is `slot` (a walk the stance wires, `slot` naming it and
 *     `action` the slot's own), `beside` (a walk it does not), `above-head`
 *     or `below-feet`; empty when there is no ring (no stance). A move the
 *     offer does not hold is here only when GREYED (S9: `action` null, with
 *     `reason` and `withheld` — a walk its slot greys, or a rank change the
 *     engine's rank entry greys); every move carries `reason`/`withheld`;
 *   - `swap` (S6) — `{key: "9", slot: "swap_inventory", verb: "swap_weapons",
 *     usingBow, words, action}` when there is a ring and the offer holds the
 *     swap; else null, and there is no button: the engine withholds it with no
 *     second weapon (`no-secondary`) or under a forced phase, all "hide"s in
 *     `SS2_UNAVAILABLE_REASONS`. `usingBow` is the engine's stance `weapon`;
 *     `words` the build's rollover text for what it does;
 *   - `items` (S5) — the items row's six places, in KEY order (Q-Y, left to
 *     right as the build draws them), each `{key, slot, inventory, itemId,
 *     verb, words, action}`: `slot` the build's `inventory_buttonN`,
 *     `inventory` the engine's slot it shows, `itemId` what it holds (null
 *     when empty), `words` the build's name for it; `verb` (`item`) and
 *     `action` null unless the offer holds the item's action — aimed at the
 *     SELECTED foe for a spell that strikes a foe, at the actor otherwise, as
 *     the engine's menu aims it; S9: a held item the engine withholds for a
 *     grey code keeps `verb` `item`, with `reason` and `withheld`;
 *   - `offRing` — `{action}` for every offered action at the selected foe or
 *     at no foe that no slot, move, the swap or the items row holds, in the
 *     offer's order;
 *   - `menuError` — why the menu could not be asked, or null.
 *   Every `action` is an offered option plus `actorId`: what `host.submit` takes.
 */
export function ringModelFor({ actorId, combatants, legal, previous = null, menuFor }) {
  const everyone = Array.isArray(combatants) ? combatants : [];
  const actor = everyone.find((combatant) => combatant.id === actorId) ?? null;
  const foes = actor
    ? everyone.filter((combatant) => combatant.alive !== false && combatant.teamId !== actor.teamId)
    : [];
  const selected = selectFoe(actor, foes, previous);
  const offer = Array.isArray(legal) ? legal : [];
  // The engine's menu for the selected foe. One that THROWS is no ring, and
  // the reason is kept so the shell can say it rather than swallow it.
  let menu = null;
  let menuError = null;
  if (selected.id !== null && typeof menuFor === "function") {
    try {
      menu = menuFor(selected.id) ?? null;
    } catch (error) {
      menuError = String(error?.message ?? error);
    }
  }

  // The engine's own ring for the selected foe: a slot ACTS only when the
  // OFFER holds its action (S2) — the same test the menu's own `available`
  // makes — and what it sends is the offered option itself, so a slot can
  // never send what the engine did not offer. One the engine withholds for a
  // GREY reason keeps its verb, sends nothing, and says why (S9); one it
  // withholds for a HIDE reason is empty (`ringGreyReasonOf`).
  const bySlot = new Map();
  const greyBySlot = new Map();
  for (const entry of menu?.ring ?? []) {
    if (entry.group !== "controller") continue;
    const option = offer.find((candidate) => candidate.type === entry.type && candidate.targetId === entry.targetId
      && (candidate.itemId ?? null) === null);
    if (option) bySlot.set(entry.slot, { verb: entry.verb, option });
    else {
      const reason = ringGreyReasonOf(entry);
      if (reason) greyBySlot.set(entry.slot, { verb: entry.verb, reason, withheld: withheldOf(entry, actorId) });
    }
  }
  const slots = RING_KEY_ORDER.map((slot, index) => {
    const held = bySlot.get(slot) ?? null;
    const grey = held ? null : greyBySlot.get(slot) ?? null;
    return Object.freeze({
      key: String(index + 1),
      slot,
      verb: held ? held.verb : grey ? grey.verb : null,
      action: held ? Object.freeze({ ...held.option, actorId }) : null,
      reason: grey ? grey.reason : null,
      withheld: grey ? grey.withheld : null
    });
  });

  // THE MOVES (S4): every walk and rank change the engine offers the actor,
  // on the ring whenever there is a ring. A walk the stance wires stays in its
  // slot, and is the same action as that slot's; one the stance does not wire
  // stands beside its side's walk slot. A move the engine withholds is not
  // here at all, so nothing can press it.
  // S9: a move the engine withholds for a GREY reason is here too, sending
  // nothing and saying why — a walk its slot greys (the arrow is that
  // button's), or a rank change the engine's rank entry greys, at its place.
  const moved = new Set();
  const moves = menu
    ? RING_MOVES.flatMap((move) => {
      const option = offer.find((candidate) => candidate.type === move.move && candidate.targetId === actorId
        && (candidate.itemId ?? null) === null);
      if (!option) {
        const greySlot = slots.find((slot) => slot.reason && slot.withheld?.type === move.move);
        const rankEntry = greySlot ? null : (menu.ring ?? []).find((entry) => entry.group === "rank" && entry.type === move.move);
        const reason = greySlot ? greySlot.reason : ringGreyReasonOf(rankEntry);
        if (!reason) return [];
        return [Object.freeze({
          move: move.move,
          key: move.key,
          verb: greySlot ? greySlot.verb : actionButtonVerbFor(move.move),
          place: greySlot ? "slot" : move.place,
          slot: greySlot ? greySlot.slot : null,
          action: null,
          reason,
          withheld: greySlot ? greySlot.withheld : withheldOf(rankEntry, actorId)
        })];
      }
      moved.add(option);
      const inSlot = slots.find((slot) => slot.action?.type === move.move);
      return [Object.freeze({
        move: move.move,
        key: move.key,
        verb: inSlot ? inSlot.verb : actionButtonVerbFor(move.move),
        place: inSlot ? "slot" : move.place,
        slot: inSlot ? inSlot.slot : null,
        action: inSlot ? inSlot.action : Object.freeze({ ...option, actorId }),
        reason: null,
        withheld: null
      })];
    })
    : [];

  // THE SWAP (S6): on the ring whenever there is a ring and the engine offers
  // it — which it does not with no second weapon (`no-secondary`, a "hide" in
  // `SS2_UNAVAILABLE_REASONS`), so there is then no button at all. What it
  // offers is sent as offered. The weapon in hand is the ENGINE's (the stance's
  // `weapon`, its bow mode), and picks what the button offers.
  const swapOption = menu
    ? offer.find((candidate) => candidate.type === "swap-weapons" && candidate.targetId === actorId
      && (candidate.itemId ?? null) === null)
    : null;
  const usingBow = menu?.stance?.weapon === "archer";
  const swap = swapOption
    ? Object.freeze({
      key: RING_SWAP_KEY,
      slot: SS2_SWAP_SLOT,
      verb: "swap_weapons",
      usingBow,
      words: usingBow ? SWAP_WORDS.toMelee : SWAP_WORDS.toRanged,
      action: Object.freeze({ ...swapOption, actorId })
    })
    : null;

  // THE ITEMS ROW (S5): the engine's own six inventory buttons for the
  // selected foe — each slot's item, its verb, and whom it is aimed at: the
  // SELECTED foe for a spell that strikes a foe, the actor for his own spells
  // and potions (`ss2UnavailableActions`'s `inventory` group). A place holds
  // its item's action only when the OFFER holds it (S2's rule), and sends the
  // offered option itself — a potion's with its `itemId`, which must be the
  // slot's own. The build's `inventory_buttonN` shows `hero.inventoryN`.
  const byInventory = new Map();
  for (const entry of menu?.ring ?? []) if (entry.group === "inventory") byInventory.set(entry.slot, entry);
  const itemOptions = new Set();
  const items = RING_ITEM_ORDER.map((slot, index) => {
    const inventory = slot.replace("inventory_button", "inventory");
    const entry = byInventory.get(inventory) ?? null;
    // 1 is the build's empty marker and 0 the item table's "Nothing".
    const itemId = Number.isInteger(entry?.itemId) && entry.itemId > 1 ? entry.itemId : null;
    const option = itemId !== null && entry.type
      ? offer.find((candidate) => candidate.type === entry.type && candidate.targetId === entry.targetId
        && (candidate.itemId == null || candidate.itemId === itemId)) ?? null
      : null;
    if (option) itemOptions.add(option);
    // S9: an item the engine withholds for a GREY reason keeps its place.
    const reason = option || itemId === null ? null : ringGreyReasonOf(entry);
    return Object.freeze({
      key: RING_ITEM_KEYS[index],
      slot,
      inventory,
      itemId,
      verb: option || reason ? "item" : null,
      words: itemId !== null ? (RING_ITEM_WORDS[itemId] ?? null) : null,
      action: option ? Object.freeze({ ...option, actorId }) : null,
      reason,
      withheld: reason ? withheldOf(entry, actorId) : null
    });
  });

  // OFF THE RING: whatever the engine offers against the selected foe or
  // anyone who is not a foe (the actor, today) that no slot, move, the swap or
  // the items row holds, in the offer's own order. An action at ANOTHER foe is
  // that foe's: selecting him puts it on his ring or in his list, so every
  // offered action is reachable and none is listed twice.
  const foeIds = new Set(foes.map((foe) => foe.id));
  const slotted = new Set([...bySlot.values()].map((held) => held.option));
  for (const option of moved) slotted.add(option);
  if (swapOption) slotted.add(swapOption);
  for (const option of itemOptions) slotted.add(option);
  const offRing = offer
    .filter((option) => !slotted.has(option) && (option.targetId === selected.id || !foeIds.has(option.targetId)))
    .map((option) => Object.freeze({ action: Object.freeze({ ...option, actorId }) }));

  return Object.freeze({
    actorId,
    selectedId: selected.id,
    selectedBy: selected.by,
    foeIds: Object.freeze(stageOrder(foes).map((foe) => foe.id)),
    stance: menu
      ? Object.freeze({ frame: menu.stance.frame, range: menu.stance.range, weapon: menu.stance.weapon, facing: menu.stance.facing })
      : null,
    slots: Object.freeze(slots),
    moves: Object.freeze(moves),
    swap,
    items: Object.freeze(items),
    offRing: Object.freeze(offRing),
    menuError
  });
}

/**
 * THE EXACT ACTION ONE SLOT OR MOVE SENDS — named by its key (`"1"`-`"9"`,
 * `"Q"`-`"Y"`, `"ArrowUp"`), by the build's slot name (`"optionD"`,
 * `"swap_inventory"`, `"inventory_button1"`) or by the move's name
 * (`"rank-back"`, what a move's drawn button is called) — or null for an
 * empty slot or place, a withheld move or swap, or no such thing. It is the engine's own
 * offered option with the actor added, which is what `host.submit` takes.
 */
export function ringActionFor(model, slotOrKey) {
  const slot = model?.slots?.find((candidate) => candidate.key === slotOrKey || candidate.slot === slotOrKey);
  if (slot) return slot.action ?? null;
  const swap = model?.swap ?? null;
  if (swap && (swap.key === slotOrKey || swap.slot === slotOrKey)) return swap.action;
  const item = model?.items?.find((candidate) => candidate.key === slotOrKey || candidate.slot === slotOrKey);
  if (item) return item.action ?? null;
  const move = model?.moves?.find((candidate) => candidate.key === slotOrKey || candidate.move === slotOrKey);
  return move?.action ?? null;
}

/**
 * WHETHER TWO ACTIONS ARE THE SAME ACTION: the fields `host.submit` reads —
 * who, what, at whom, which item, which spell. A potion's `itemId` tells two
 * drinks apart; nothing else does.
 */
export function ringSameAction(left, right) {
  if (!left || !right) return false;
  return left.actorId === right.actorId && left.type === right.type && left.targetId === right.targetId
    && (left.itemId ?? null) === (right.itemId ?? null) && (left.spellKind ?? null) === (right.spellKind ?? null);
}

/**
 * ► **EVERY ACTION ON SCREEN, ONCE PER BUTTON (slice S7)** — in the strip's
 *   own order: the eight's filled slots in key order, the moves no slot
 *   holds, the weapon swap, the items row left to right, then the list off
 *   the ring. Each `{place, key, slot, verb, words, action}`: `place` is
 *   `slot`, `move`, `swap`, `item` or `off`; `key` the key that presses it
 *   (null for a listed one); `slot` the name its drawn button carries
 *   (`ringSlotAt` returns it); `verb` and `words` what the strip labels it
 *   with. What a hover previews and what "confirm every move" may hold.
 *
 * ► **`{greyed: true}` (S9) puts every GREYED button in its place too** —
 *   `action` null, `reason` `{code, words}` (`ringGreyReasonOf`) and
 *   `withheld` (what it would send, for its words only). The strip lists them
 *   so; nothing that sends or previews asks for them.
 */
export function ringEntries(model, { greyed = false } = {}) {
  if (!model) return Object.freeze([]);
  const out = [];
  const grey = (place, key, slot, verb, words, from) => (greyed && from.reason && !from.action
    ? out.push({ place, key, slot, verb, words, action: null, reason: from.reason, withheld: from.withheld ?? null })
    : 0);
  for (const slot of model.slots ?? []) {
    if (slot.action) out.push({ place: "slot", key: slot.key, slot: slot.slot, verb: slot.verb, words: null, action: slot.action });
    else grey("slot", slot.key, slot.slot, slot.verb, null, slot);
  }
  for (const move of model.moves ?? []) {
    if (move.place === "slot") continue;
    if (move.action) out.push({ place: "move", key: move.key, slot: move.move, verb: move.verb, words: null, action: move.action });
    else grey("move", move.key, move.move, move.verb, null, move);
  }
  const swap = model.swap ?? null;
  if (swap) out.push({ place: "swap", key: swap.key, slot: swap.slot, verb: swap.verb, words: swap.words, action: swap.action });
  for (const item of model.items ?? []) {
    if (item.action) out.push({ place: "item", key: item.key, slot: item.slot, verb: item.verb, words: item.words, action: item.action });
    // An item with no name in the build's table (10-29) is called by its id.
    else grey("item", item.key, item.slot, item.verb, item.words ?? `Item #${item.itemId}`, item);
  }
  for (const entry of model.offRing ?? []) {
    out.push({ place: "off", key: null, slot: null, verb: null, words: null, action: entry.action });
  }
  return Object.freeze(out.map((entry) => Object.freeze(entry)));
}

/**
 * THE GREYED BUTTON (S9) named by its key (`"3"`, `"E"`, `"ArrowDown"`), its
 * slot (`"optionC"`, `"inventory_button1"`) or its move (`"rank-front"`) — its
 * `ringEntries(model, {greyed: true})` entry — or null when that button acts,
 * is hidden or does not exist. A walk greyed in its slot answers to the slot's
 * digit and name and to its arrow and move name alike.
 */
export function ringGreyFor(model, slotOrKey) {
  if (slotOrKey === null || slotOrKey === undefined || slotOrKey === "") return null;
  const entries = ringEntries(model, { greyed: true }).filter((entry) => entry.reason);
  const direct = entries.find((entry) => entry.key === slotOrKey || entry.slot === slotOrKey);
  if (direct) return direct;
  // A greyed walk in its slot: its arrow and its move's name are the slot's.
  const move = model?.moves?.find((candidate) => candidate.place === "slot" && candidate.reason
    && (candidate.key === slotOrKey || candidate.move === slotOrKey));
  return move ? entries.find((entry) => entry.slot === move.slot) ?? null : null;
}

/**
 * ► **WHAT A CLICK ON A DRAWN BUTTON DOES (S9), named as `ringSlotAt` names
 *   it** — a slot (`"optionC"`), the swap, an items place, a move
 *   (`"rank-front"`) — or by its key: an acting one presses
 *   (`ringPressCommand`: acts, or chooses with "confirm every move" on); a
 *   GREYED one is `{kind: "ignore", why: "greyed", entry}` — nothing is sent,
 *   whatever the setting, and `entry` (`ringGreyFor`) is there for the shell to
 *   say why; anything else, null. A digit or a letter takes this same road
 *   (`ringKeyCommand`).
 */
export function ringClickCommand(model, slotOrKey, { confirm = false } = {}) {
  const press = ringPressCommand(ringActionFor(model, slotOrKey), { confirm });
  if (press) return press;
  const entry = ringGreyFor(model, slotOrKey);
  return entry ? Object.freeze({ kind: "ignore", why: "greyed", entry }) : null;
}

/**
 * WHAT THE POINTER ON A DRAWN BUTTON SHOWS (S7, S9) — the button named as
 * `ringSlotAt` names it: its own action when it acts (`ringActionFor`, which a
 * preview previews), its greyed entry when it is greyed (`ringGreyFor`, whose
 * reason is said), else null.
 */
export function ringShownFor(model, slotOrKey) {
  return ringActionFor(model, slotOrKey) ?? ringGreyFor(model, slotOrKey);
}

/** The first entry on screen that sends `action` (`ringSameAction`), or null. */
export function ringEntryFor(model, action) {
  if (!action) return null;
  return ringEntries(model).find((entry) => ringSameAction(entry.action, action)) ?? null;
}

/** The foe Tab (`step` 1) or Shift+Tab (`step` -1) selects next, wrapping; null with no foe. */
export function ringNextFoe(model, step = 1) {
  const order = model?.foeIds ?? [];
  if (order.length === 0) return null;
  const at = order.indexOf(model.selectedId);
  const from = at < 0 ? (step > 0 ? -1 : 0) : at;
  return order[(((from + step) % order.length) + order.length) % order.length];
}

/**
 * WHAT ONE KEY DOES ON A PERSON'S TURN — `{kind: "act", action}`,
 * `{kind: "select", foeId}`, `{kind: "focus-strip"}` or null (the key is not
 * the ring's, and the browser keeps it).
 *
 * `focus` is where the keyboard focus is: `"stage"` (nothing, the page or the
 * stage's canvas), `"control"` (a button), `"adjust"` (a control whose own
 * arrow keys change it: the volume slider) or `"text"` (a field that types).
 *
 * - `1`-`8` press the slots, `9` the weapon swap (S6) and `Q`-`Y` the items
 *   row (S5, either case), from the stage or a control; never while typing,
 *   never with Ctrl/Alt/Meta (the browser's), and never on a held key's
 *   repeats — one press, one action. A key with nothing behind it is the
 *   browser's.
 * - Tab / Shift+Tab switch the target, from the stage only and only with a
 *   second foe to switch to. **Inside a control Tab stays the browser's**, so
 *   the strip's buttons are reachable and nothing traps the focus.
 * - Esc, from the stage, moves the focus into the strip — the way into its
 *   list by keyboard, since Tab on the stage is taken.
 * - The arrows (S4) send their move (`RING_MOVES`) from the stage or a
 *   control, never from a field that types or a control whose own arrows
 *   adjust it (`"adjust"`: a slider, a radio button), never with a modifier.
 *   Where they would move nobody — a held key's repeat, or a move the engine
 *   withholds — they return `{kind: "ignore", why, move}`: the key is still
 *   the ring's, so the page does not scroll under the fight, and nothing is
 *   sent.
 * - With NO ring (`model` null: not a person's turn) nothing is the ring's
 *   but the repeats of an arrow it took that is still down — `held`, the
 *   keys the shell saw the ring take and has not yet seen let go — which
 *   stay `ignore`d: the press moved the person, the turn went to the AI, and
 *   the key must not start scrolling the page halfway through.
 */
export function ringKeyCommand(model, {
  key, shiftKey = false, ctrlKey = false, altKey = false, metaKey = false, repeat = false, focus = "stage", held = null,
  confirm = false, pending = null
} = {}) {
  if (focus === "text" || ctrlKey || altKey || metaKey) return null;
  if (!model) {
    // THE RING'S OWN ARROW, STILL HELD, after the turn it moved has gone (to
    // the AI, or the bout's end): its repeats stay swallowed, so the page does
    // not scroll under the animation (Codex review, S4 pass 1). Nothing else
    // with no ring on screen is the ring's.
    const heldMove = RING_MOVES.find((candidate) => candidate.key === key);
    if (heldMove && repeat && focus !== "adjust" && !shiftKey && held?.has?.(key)) {
      return Object.freeze({ kind: "ignore", why: "repeat", move: heldMove.move });
    }
    return null;
  }
  // S9: a key on a GREYED button presses nothing, whatever the setting; it
  // is still the ring's, so the shell can say why (`{kind: "ignore", why:
  // "greyed", entry}`, the button's `ringGreyFor` entry) — the road a click
  // takes (`ringClickCommand`).
  if (/^[1-8]$/.test(key ?? "") || key === RING_SWAP_KEY) {
    if (repeat) return null;
    return ringClickCommand(model, key, { confirm });
  }
  // The items row (S5): a letter, whichever case Shift or Caps Lock gives it.
  const letter = typeof key === "string" && key.length === 1 ? key.toUpperCase() : null;
  if (letter !== null && RING_ITEM_KEYS.includes(letter)) {
    if (repeat) return null;
    return ringClickCommand(model, letter, { confirm });
  }
  const move = RING_MOVES.find((candidate) => candidate.key === key);
  if (move) {
    if (focus === "adjust" || shiftKey) return null;
    if (repeat) return Object.freeze({ kind: "ignore", why: "repeat", move: move.move });
    const action = ringActionFor(model, move.key);
    return action
      ? ringPressCommand(action, { confirm })
      : ringClickCommand(model, move.key, { confirm }) ?? Object.freeze({ kind: "ignore", why: "not-offered", move: move.move });
  }
  // S7: with "confirm every move" on, Enter from the stage sends the choice
  // (on a button it presses that button, as the browser does), and Esc takes
  // the choice back from the stage or a button. A HELD Enter's repeats are
  // the ring's wherever the focus is, and do nothing (Codex review of S7, pass
  // 1): Enter on a strip button chooses and moves the focus to Confirm, and its
  // repeats would press Confirm — so a choice is confirmed only by a fresh press.
  if (key === "Enter") {
    if (!confirm) return null;
    if (repeat) return Object.freeze({ kind: "ignore", why: "repeat" });
    if (focus !== "stage") return null;
    return ringConfirmCommand(model, pending) ?? Object.freeze({ kind: "ignore", why: "nothing-chosen" });
  }
  if (key === "Escape" && confirm && ringConfirmCommand(model, pending)) return Object.freeze({ kind: "back" });
  if (focus !== "stage") return null;
  if (key === "Tab") {
    if ((model.foeIds?.length ?? 0) < 2) return null;
    return Object.freeze({ kind: "select", foeId: ringNextFoe(model, shiftKey ? -1 : 1) });
  }
  if (key === "Escape") return Object.freeze({ kind: "focus-strip" });
  return null;
}

/**
 * ► **WHAT ONE PRESS DOES (slice S7; the owner's decisions 2 and 4): "one
 *   click acts, as in the original", unless the person has turned on
 *   "confirm every move" — then it only CHOOSES**, and the strip's Confirm or
 *   Enter acts (`ringConfirmCommand`). Every press takes this road: a click on
 *   the stage, a strip button, and every key `ringKeyCommand` sends —
 *   `{kind: "act"|"choose", action}`, or null when there is nothing to press.
 */
export function ringPressCommand(action, { confirm = false } = {}) {
  if (!action) return null;
  return Object.freeze({ kind: confirm ? "choose" : "act", action });
}

/**
 * CONFIRM (S7): the chosen action — as the model on screen holds it, so what
 * is sent is always an offered option a button shows — or null when the
 * choice is not on screen any more.
 */
export function ringConfirmCommand(model, pending) {
  const entry = ringEntryFor(model, pending);
  return entry ? Object.freeze({ kind: "act", action: entry.action }) : null;
}

/**
 * THE CHOICE STILL STANDING (S7): `record` is `{turn, action}` as the shell
 * kept it; it stands while the turn is the same and a button on `model` sends
 * it — so a potion outlasts a change of target, a swing at the old target
 * does not, and a new turn starts with nothing chosen. The model's own action,
 * or null.
 */
export function ringPendingFor(model, record, { turn } = {}) {
  if (!record || record.turn !== turn) return null;
  return ringEntryFor(model, record.action)?.action ?? null;
}

/**
 * WHAT THE SHELL KEEPS OF A CHOICE WHEN THE RING IS BUILT AGAIN (S7; Codex
 * review of S7, pass 1): the record itself while `ringPendingFor` finds it on
 * the new ring, else null — so a choice a new target's ring does not show is
 * DROPPED, and switching back to the first target does not bring it back.
 */
export function ringPendingKept(model, record, { turn } = {}) {
  return ringPendingFor(model, record, { turn }) ? record : null;
}

/**
 * WHAT A RING BUTTON SAYS, per build verb: `short` beside the button on the
 * stage (seven letters at most), `long` in the strip and in its accessible
 * name. AUTHORED words; the build's buttons are icons with no text.
 */
export const RING_VERB_LABELS = Object.freeze(Object.fromEntries([
  ["walkleft", "Walk", "Walk left"],
  ["walkright", "Walk", "Walk right"],
  ["taunt", "Taunt", "Taunt"],
  ["rest", "Rest", "Rest"],
  ["wincrowd", "Crowd", "Win the crowd"],
  ["psyche_up", "Psyche", "Psyche up"],
  ["shove", "Shove", "Shove"],
  ["power_attack", "Power", "Power attack"],
  ["normal_attack", "Normal", "Normal attack"],
  ["quick_attack", "Quick", "Quick attack"],
  ["bash_attack", "Bash", "Bash"],
  ["bombardleft", "Bombard", "Bombard"],
  ["bombardright", "Bombard", "Bombard"],
  ["snipeleft", "Snipe", "Snipe"],
  ["sniperight", "Snipe", "Snipe"],
  // S6: the swap's long words are the build's own and change with the weapon
  // in hand (`model.swap.words`); this pair is the stage label and the fallback.
  ["swap_weapons", "Swap", "Swap weapons"]
].map(([verb, short, long]) => [verb, Object.freeze({ short, long })])));

/** The engine tokens whose words are not simply the token's. */
const ACTION_WORDS = Object.freeze({
  "rank-back": "Step back a rank",
  "rank-front": "Step forward a rank",
  "swap-weapons": "Swap weapons",
  "drink-potion": "Drink potion"
});

/**
 * AN ACTION IN WORDS — the strip's button text and accessible name: `words`
 * when the caller has them (the swap's, S6: the build's own rollover text),
 * else the slot verb's long label when there is one, else the engine token
 * worded (`cast-gale` -> "Cast gale"), then the item (`#5`), then the foe it
 * is aimed at by name. An action at the actor names nobody.
 */
export function ringActionLabel(action, { verb = null, words: given = null, nameOf = (id) => id } = {}) {
  const type = String(action?.type ?? "");
  const words = given
    ?? RING_VERB_LABELS[verb]?.long
    ?? ACTION_WORDS[type]
    ?? (type.charAt(0).toUpperCase() + type.slice(1).replaceAll("-", " "));
  // A potion's id says which of eight it is — unless its own name already has.
  const item = action?.itemId != null && given === null ? ` #${action.itemId}` : "";
  const aimed = action?.targetId != null && action.targetId !== action.actorId ? ` at ${nameOf(action.targetId)}` : "";
  return `${words}${item}${aimed}`;
}

/** Input types a digit or a Tab does not type into. */
const NON_TYPING_INPUTS = new Set(["range", "checkbox", "radio", "button", "submit", "reset", "color", "image", "file"]);
/** Of those, the ones whose own arrow keys change their value: a slider steps, a radio group moves. */
const ARROW_INPUTS = new Set(["range", "radio"]);

/**
 * WHERE THE KEYBOARD FOCUS IS, as `ringKeyCommand` reads it, from a focused
 * element (duck-typed: `tagName`, `type`, `isContentEditable`): `"stage"` for
 * nothing, the page or `stage` itself; `"text"` for anything that types or
 * takes letters (a text input, a textarea, a select, an editable element);
 * `"adjust"` for an input whose own arrow keys change it (a slider, a radio
 * button — S4, so the ring's arrows leave it alone; ~~a slider was
 * `"control"`~~ in S2); `"control"` for every other focusable thing (a
 * button, a checkbox).
 */
export function ringFocusKind(element, { stage = null } = {}) {
  if (!element || element === stage) return "stage";
  const tag = String(element.tagName ?? "").toUpperCase();
  if (tag === "BODY" || tag === "HTML") return "stage";
  if (element.isContentEditable) return "text";
  if (tag === "TEXTAREA" || tag === "SELECT") return "text";
  const type = String(element.type ?? "text").toLowerCase();
  if (tag === "INPUT" && !NON_TYPING_INPUTS.has(type)) return "text";
  if (tag === "INPUT" && ARROW_INPUTS.has(type)) return "adjust";
  return "control";
}
