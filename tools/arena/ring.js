/**
 * THE RING'S MODEL — slices S2, S4 and S6 of `docs/design/battle-ui.md` ("The
 * in-battle actions: DECIDED"): on a person's turn, which foe is selected,
 * which of the build's four stances the ring shows, which verb sits in which
 * of the eight slots, where each walk and rank change the engine offers
 * stands (S4), whether the weapon swap is on the ring and which weapon it
 * offers (S6), what the engine offers that the ring does not show, and the
 * exact action a click, a digit or an arrow key sends.
 *
 * Pure. It reads what it is handed — the fighters, the engine's offer and the
 * engine's own menu for the selected foe — and decides only how to ARRANGE
 * them: "the engine decides what is possible; the interface only arranges it".
 */

import { SS2_OPTION_SLOTS, SS2_OVERLAY_SLOTS, SS2_SWAP_SLOT, actionButtonVerbFor } from "../../src/render/action-buttons.js";
import { ss2FightDistance, ss2SameLane } from "../../src/team/ss2-rules.js";

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
 *     verb, action}`; `verb`/`action` null unless the offer holds it;
 *   - `moves` (S4) — every walk and rank change the offer holds, in
 *     `RING_MOVES` order, each `{move, key, verb, place, slot, action}`:
 *     `place` is `slot` (a walk the stance wires, `slot` naming it and
 *     `action` the slot's own), `beside` (a walk it does not), `above-head`
 *     or `below-feet`; empty when there is no ring (no stance). A move the
 *     offer does not hold is not here;
 *   - `swap` (S6) — `{key: "9", slot: "swap_inventory", verb: "swap_weapons",
 *     usingBow, words, action}` when there is a ring and the offer holds the
 *     swap; else null, and there is no button: the engine withholds it with no
 *     second weapon (`no-secondary`) or under a forced phase, all "hide"s in
 *     `SS2_UNAVAILABLE_REASONS`. `usingBow` is the engine's stance `weapon`;
 *     `words` the build's rollover text for what it does;
 *   - `offRing` — `{action}` for every offered action at the selected foe or
 *     at no foe that no slot, move or the swap holds, in the offer's order;
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

  // The engine's own ring for the selected foe: a slot holds its verb only
  // when the OFFER holds its action (S2; hidden-vs-greyed is S9) — the same
  // test the menu's own `available` makes — and what it sends is the offered
  // option itself, so a slot can never send what the engine did not offer.
  const bySlot = new Map();
  for (const entry of menu?.ring ?? []) {
    if (entry.group !== "controller") continue;
    const option = offer.find((candidate) => candidate.type === entry.type && candidate.targetId === entry.targetId
      && (candidate.itemId ?? null) === null);
    if (option) bySlot.set(entry.slot, { verb: entry.verb, option });
  }
  const slots = RING_KEY_ORDER.map((slot, index) => {
    const held = bySlot.get(slot) ?? null;
    return Object.freeze({
      key: String(index + 1),
      slot,
      verb: held ? held.verb : null,
      action: held ? Object.freeze({ ...held.option, actorId }) : null
    });
  });

  // THE MOVES (S4): every walk and rank change the engine offers the actor,
  // on the ring whenever there is a ring. A walk the stance wires stays in its
  // slot, and is the same action as that slot's; one the stance does not wire
  // stands beside its side's walk slot. A move the engine withholds is not
  // here at all, so nothing can press it.
  const moved = new Set();
  const moves = menu
    ? RING_MOVES.flatMap((move) => {
      const option = offer.find((candidate) => candidate.type === move.move && candidate.targetId === actorId
        && (candidate.itemId ?? null) === null);
      if (!option) return [];
      moved.add(option);
      const inSlot = slots.find((slot) => slot.action?.type === move.move);
      return [Object.freeze({
        move: move.move,
        key: move.key,
        verb: inSlot ? inSlot.verb : actionButtonVerbFor(move.move),
        place: inSlot ? "slot" : move.place,
        slot: inSlot ? inSlot.slot : null,
        action: inSlot ? inSlot.action : Object.freeze({ ...option, actorId })
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

  // OFF THE RING: whatever the engine offers against the selected foe or
  // anyone who is not a foe (the actor, today) that no slot, move or the swap holds, in
  // the offer's own order. An action at ANOTHER foe is that foe's: selecting
  // him puts it on his ring or in his list, so every offered action is
  // reachable and none is listed twice.
  const foeIds = new Set(foes.map((foe) => foe.id));
  const slotted = new Set([...bySlot.values()].map((held) => held.option));
  for (const option of moved) slotted.add(option);
  if (swapOption) slotted.add(swapOption);
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
    offRing: Object.freeze(offRing),
    menuError
  });
}

/**
 * THE EXACT ACTION ONE SLOT OR MOVE SENDS — named by its key (`"1"`-`"9"`,
 * `"ArrowUp"`), by the build's slot name (`"optionD"`, `"swap_inventory"`)
 * or by the move's name (`"rank-back"`, what a move's drawn button is called)
 * — or null for an empty slot, a withheld move or swap, or no such thing. It is the engine's own
 * offered option with the actor added, which is what `host.submit` takes.
 */
export function ringActionFor(model, slotOrKey) {
  const slot = model?.slots?.find((candidate) => candidate.key === slotOrKey || candidate.slot === slotOrKey);
  if (slot) return slot.action ?? null;
  const swap = model?.swap ?? null;
  if (swap && (swap.key === slotOrKey || swap.slot === slotOrKey)) return swap.action;
  const move = model?.moves?.find((candidate) => candidate.key === slotOrKey || candidate.move === slotOrKey);
  return move?.action ?? null;
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
 * - `1`-`8` press the slots, and `9` the weapon swap (S6), from the stage or a
 *   control; never while typing, never with Ctrl/Alt/Meta (the browser's), and
 *   never on a held key's repeats — one press, one action. A digit with
 *   nothing behind it is the browser's.
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
export function ringKeyCommand(model, { key, shiftKey = false, ctrlKey = false, altKey = false, metaKey = false, repeat = false, focus = "stage", held = null } = {}) {
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
  if (/^[1-8]$/.test(key ?? "") || key === RING_SWAP_KEY) {
    if (repeat) return null;
    const action = ringActionFor(model, key);
    return action ? Object.freeze({ kind: "act", action }) : null;
  }
  const move = RING_MOVES.find((candidate) => candidate.key === key);
  if (move) {
    if (focus === "adjust" || shiftKey) return null;
    if (repeat) return Object.freeze({ kind: "ignore", why: "repeat", move: move.move });
    const action = ringActionFor(model, move.key);
    return action
      ? Object.freeze({ kind: "act", action })
      : Object.freeze({ kind: "ignore", why: "not-offered", move: move.move });
  }
  if (focus !== "stage") return null;
  if (key === "Tab") {
    if ((model.foeIds?.length ?? 0) < 2) return null;
    return Object.freeze({ kind: "select", foeId: ringNextFoe(model, shiftKey ? -1 : 1) });
  }
  if (key === "Escape") return Object.freeze({ kind: "focus-strip" });
  return null;
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
  const item = action?.itemId != null ? ` #${action.itemId}` : "";
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
