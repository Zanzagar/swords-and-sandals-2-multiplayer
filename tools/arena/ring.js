/**
 * THE RING'S MODEL — slice S2 of `docs/design/battle-ui.md` ("The in-battle
 * actions: DECIDED"): on a person's turn, which foe is selected, which of the
 * build's four stances the ring shows, which verb sits in which of the eight
 * slots, what the engine offers that no slot shows, and the exact action a
 * click or a key sends.
 *
 * Pure. It reads what it is handed — the fighters, the engine's offer and the
 * engine's own menu for the selected foe — and decides only how to ARRANGE
 * them: "the engine decides what is possible; the interface only arranges it".
 */

import { SS2_OPTION_SLOTS, SS2_OVERLAY_SLOTS } from "../../src/render/action-buttons.js";
import { ss2FightDistance, ss2SameLane } from "../../src/team/ss2-rules.js";

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
 *   - `offRing` — `{action}` for every offered action at the selected foe or
 *     at no foe that no slot holds, in the offer's order;
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

  // OFF THE RING: whatever the engine offers against the selected foe or
  // anyone who is not a foe (the actor, today) that no slot holds, in the
  // offer's own order. An action at ANOTHER foe is that foe's: selecting him
  // puts it on his ring or in his list, so every offered action is reachable
  // and none is listed twice.
  const foeIds = new Set(foes.map((foe) => foe.id));
  const slotted = new Set([...bySlot.values()].map((held) => held.option));
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
    offRing: Object.freeze(offRing),
    menuError
  });
}

/**
 * THE EXACT ACTION ONE SLOT SENDS — named by its key (`"1"`-`"8"`) or by the
 * build's slot name (`"optionD"`) — or null for an empty slot or no slot.
 * It is the engine's own offered option with the actor added, which is what
 * `host.submit` takes.
 */
export function ringActionFor(model, slotOrKey) {
  const slot = model?.slots?.find((candidate) => candidate.key === slotOrKey || candidate.slot === slotOrKey);
  return slot?.action ?? null;
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
 * stage's canvas), `"control"` (a button, the volume slider) or `"text"` (a
 * field that types).
 *
 * - `1`-`8` press the slots, from the stage or a control; never while typing,
 *   never with Ctrl/Alt/Meta (the browser's), and never on a held key's
 *   repeats — one press, one action.
 * - Tab / Shift+Tab switch the target, from the stage only and only with a
 *   second foe to switch to. **Inside a control Tab stays the browser's**, so
 *   the strip's buttons are reachable and nothing traps the focus.
 * - Esc, from the stage, moves the focus into the strip — the way into its
 *   list by keyboard, since Tab on the stage is taken.
 */
export function ringKeyCommand(model, { key, shiftKey = false, ctrlKey = false, altKey = false, metaKey = false, repeat = false, focus = "stage" } = {}) {
  if (!model || focus === "text" || ctrlKey || altKey || metaKey) return null;
  if (/^[1-8]$/.test(key ?? "")) {
    if (repeat) return null;
    const action = ringActionFor(model, key);
    return action ? Object.freeze({ kind: "act", action }) : null;
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
  ["sniperight", "Snipe", "Snipe"]
].map(([verb, short, long]) => [verb, Object.freeze({ short, long })])));

/** The engine tokens whose words are not simply the token's. */
const ACTION_WORDS = Object.freeze({
  "rank-back": "Step back a rank",
  "rank-front": "Step forward a rank",
  "swap-weapons": "Swap weapons",
  "drink-potion": "Drink potion"
});

/**
 * AN ACTION IN WORDS — the strip's button text and accessible name: the slot
 * verb's long label when there is one, else the engine token worded
 * (`cast-gale` -> "Cast gale"), then the item (`#5`), then the foe it is
 * aimed at by name. An action at the actor names nobody.
 */
export function ringActionLabel(action, { verb = null, nameOf = (id) => id } = {}) {
  const type = String(action?.type ?? "");
  const words = RING_VERB_LABELS[verb]?.long
    ?? ACTION_WORDS[type]
    ?? (type.charAt(0).toUpperCase() + type.slice(1).replaceAll("-", " "));
  const item = action?.itemId != null ? ` #${action.itemId}` : "";
  const aimed = action?.targetId != null && action.targetId !== action.actorId ? ` at ${nameOf(action.targetId)}` : "";
  return `${words}${item}${aimed}`;
}

/** Input types a digit or a Tab does not type into. */
const NON_TYPING_INPUTS = new Set(["range", "checkbox", "radio", "button", "submit", "reset", "color", "image", "file"]);

/**
 * WHERE THE KEYBOARD FOCUS IS, as `ringKeyCommand` reads it, from a focused
 * element (duck-typed: `tagName`, `type`, `isContentEditable`): `"stage"` for
 * nothing, the page or `stage` itself; `"text"` for anything that types or
 * takes letters (a text input, a textarea, a select, an editable element);
 * `"control"` for every other focusable thing (a button, the volume slider).
 */
export function ringFocusKind(element, { stage = null } = {}) {
  if (!element || element === stage) return "stage";
  const tag = String(element.tagName ?? "").toUpperCase();
  if (tag === "BODY" || tag === "HTML") return "stage";
  if (element.isContentEditable) return "text";
  if (tag === "TEXTAREA" || tag === "SELECT") return "text";
  if (tag === "INPUT" && !NON_TYPING_INPUTS.has(String(element.type ?? "text").toLowerCase())) return "text";
  return "control";
}
