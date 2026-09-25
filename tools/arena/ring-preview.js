/**
 * THE RING'S PREVIEWS — slice S7 of `docs/design/battle-ui.md` ("The in-battle
 * actions: DECIDED", items 4 and 9): what a hovered or focused button says it
 * will do, the selected target's odds in the strip, and where the "confirm
 * every move" setting is remembered.
 *
 * Pure. Every number is the ENGINE's — `host.previewAction(action)`, handed
 * in — and this only puts it into words: "the engine decides what is possible;
 * the interface only arranges it". It asks the engine nothing itself.
 */

import { RING_VERB_LABELS, ringActionLabel, ringEntries, ringEntryFor, ringSameAction } from "./ring.js";

/** What a pool is called in words: a potion's `restores.pool`, and rejuvenate's three. */
const POOL_WORDS = Object.freeze({ hitpoints: "health", staminaleft: "stamina", armourclass: "armour" });

/**
 * THE PREVIEW'S WORDS, in the order a player weighs them — whether it lands,
 * how hard, what it gives back, what it costs — each from one field of the
 * engine's preview (`ss2PreviewAction`):
 *
 * - `chance` → "40% to hit": the build's own number, the one its rollover
 *   prints — `"Power (" + hero.power_percentage + " % chance)"`, overlay
 *   frame 13 (`closerange_warrior`) body 0x23a11c, `+0x096a` — and not quite
 *   the odds (`ss2PreviewAction` says why: `chance + 1` in 100 for the
 *   dispatcher, `chance - 1` for the taunt's first roll); a damage spell's
 *   `certain` → "cannot miss"; a discharge or whirlwind the range gate will
 *   waste (`outOfRange`) → "out of range: wasted", and nothing else about
 *   landing;
 * - `damage` → "17 damage" or "12–17 damage", before armour; "from behind"
 *   when `backAttack` adds the authored bonus; a condition's own turn takes
 *   it himself ("takes 3 damage");
 * - `restores` → "restores 40 health" (a potion), or each pool rejuvenate
 *   fills;
 * - `energy` → "costs 10 stamina", or "gains 75 stamina" for a rest, whose
 *   cost is negative.
 */
function previewParts(preview) {
  const parts = [];
  if (preview?.outOfRange === true) parts.push("out of range: wasted");
  else if (Number.isFinite(preview?.chance)) parts.push(`${preview.chance}% to hit`);
  else if (preview?.certain === true) parts.push("cannot miss");
  const damage = preview?.damage;
  if (damage && Number.isFinite(damage.min) && Number.isFinite(damage.max)) {
    const amount = damage.min === damage.max ? `${damage.min}` : `${damage.min}–${damage.max}`;
    // A condition's turn hurts the one whose turn it is (`ss2StatusTickDamage`).
    parts.push(preview.condition
      ? `takes ${amount} damage`
      : `${amount} damage${preview.backAttack === true ? " from behind" : ""}`);
  }
  const restores = preview?.restores;
  if (restores && typeof restores === "object") {
    // A potion names its one pool, even when it would restore nothing (0 at
    // full health); rejuvenate fills all three, and names those it fills.
    const words = typeof restores.pool === "string"
      ? [[restores.pool, restores.amount]].filter(([pool, amount]) => POOL_WORDS[pool] && Number.isFinite(amount))
      : Object.entries(restores).filter(([pool, amount]) => POOL_WORDS[pool] && Number.isFinite(amount) && amount > 0);
    parts.push(words.length > 0 ? `restores ${words.map(([pool, amount]) => `${amount} ${POOL_WORDS[pool]}`).join(", ")}` : "restores nothing");
  }
  if (Number.isFinite(preview?.energy) && preview.energy > 0) parts.push(`costs ${preview.energy} stamina`);
  else if (Number.isFinite(preview?.energy) && preview.energy < 0) parts.push(`gains ${0 - preview.energy} stamina`);
  return parts;
}

/**
 * ► **WHAT A HOVERED OR FOCUSED BUTTON SAYS IT WILL DO (the owner's decision
 *   4: "hovering shows the verb and its hit chance").** `preview` is
 *   `host.previewAction(action)` for that very action; the words are the
 *   strip's own for the button (`ringActionLabel` with the entry's verb or
 *   the build's own words), then the preview's.
 *
 * @param {object} model  from `ringModelFor`
 * @param {object} action  an action on it (a slot's, a move's, the swap's, an
 *   item's or a listed one)
 * @param {object|null} preview  `host.previewAction(action)`
 * @param {{nameOf?: (id: string) => string}} [options]
 * @returns {object|null} frozen `{action, key, label, chance, certain, text}` —
 *   `action` the model's own, `chance` the preview's, or null when the action
 *   is not on the model (nothing on screen sends it, so nothing previews it)
 */
export function ringPreviewFor(model, action, preview, { nameOf = (id) => id } = {}) {
  const entry = ringEntryFor(model, action);
  if (!entry) return null;
  const label = ringActionLabel(entry.action, { verb: entry.verb, words: entry.words, nameOf });
  const parts = previewParts(preview);
  return Object.freeze({
    action: entry.action,
    key: entry.key,
    label,
    chance: Number.isFinite(preview?.chance) ? preview.chance : null,
    certain: preview?.certain === true,
    text: parts.length > 0 ? `${label}: ${parts.join(" · ")}` : label
  });
}

/**
 * ► **WHAT A GREYED BUTTON SAYS (slice S9; the owner's Q6, "GREYED with a
 *   hover reason").** Its name in the strip's own words — the verb, the
 *   build's name for an item, and the foe it would be aimed at — then "not
 *   now:" and the ENGINE's words for its reason (`SS2_UNAVAILABLE_REASONS`
 *   `says`). The hover caption on the stage, the preview line, the strip
 *   button's accessible description and the live region all say this.
 *
 * @param {object|null} entry  a greyed entry (`ringGreyFor`, or
 *   `ringEntries(model, {greyed: true})`): `{verb, words, withheld, reason}`
 * @param {{nameOf?: (id: string) => string}} [options]
 * @returns {string|null}
 */
export function ringGreyTextFor(entry, { nameOf = (id) => id } = {}) {
  if (!entry?.reason) return null;
  return `${ringGreyLabelFor(entry, { nameOf })} — not now: ${entry.reason.words}`;
}

/**
 * THE WORDS FOR WHATEVER A CAPTION OR THE PREVIEW LINE SHOWS (S9): `shown` is
 * a greyed entry (`ringShownFor`, `ringGreyFor`) — its reason
 * (`ringGreyTextFor`) — or an action — `previewTextOf(action)`, the caller's
 * S7 preview in words — or null.
 */
export function ringShownText(shown, previewTextOf, { nameOf = (id) => id } = {}) {
  if (!shown) return null;
  if (shown.reason) return ringGreyTextFor(shown, { nameOf });
  return (typeof previewTextOf === "function" ? previewTextOf(shown) : null) ?? null;
}

/** A greyed button's name, as the strip labels it: `ringActionLabel` of what it would send. */
export function ringGreyLabelFor(entry, { nameOf = (id) => id } = {}) {
  return ringActionLabel(entry?.withheld ?? {}, { verb: entry?.verb ?? null, words: entry?.words ?? null, nameOf });
}

/**
 * ► **THE SELECTED TARGET'S ODDS (the owner's decision 9: the strip "shows
 *   the selected target's odds").** Every action on screen aimed at the
 *   selected foe that rolls to hit him — a swing, a shot, the bash, the
 *   taunt, a ghost strike, a whirlwind in range — with the engine's `chance`
 *   for it (`previewOf(action)`, the host's `previewAction`), in the strip's
 *   order and once per action (two slots of one spell are one roll). A spell
 *   that cannot miss, and anything that takes no roll, is not odds; its hover
 *   says what it does. AUTHORED: the build's HUD shows no odds, only each
 *   button's rollover.
 *
 * @param {object} model  from `ringModelFor`
 * @param {(action: object) => object|null} previewOf  `host.previewAction`
 * @param {{nameOf?: (id: string) => string}} [options]
 * @returns {object} frozen `{foeId, odds: [{key, words, chance, action}], text}`
 */
export function ringOddsFor(model, previewOf, { nameOf = (id) => id } = {}) {
  const foeId = model?.selectedId ?? null;
  const odds = [];
  for (const entry of ringEntries(model)) {
    if (foeId === null || entry.action.targetId !== foeId) continue;
    if (odds.some((seen) => ringSameAction(seen.action, entry.action))) continue;
    const preview = typeof previewOf === "function" ? previewOf(entry.action) : null;
    if (!Number.isFinite(preview?.chance) || preview.outOfRange === true) continue;
    odds.push(Object.freeze({
      key: entry.key,
      words: RING_VERB_LABELS[entry.verb]?.short ?? entry.words ?? ringActionLabel({ ...entry.action, targetId: null }),
      chance: preview.chance,
      action: entry.action
    }));
  }
  const name = foeId === null ? null : nameOf(foeId);
  const text = foeId === null
    ? "No foe to roll against."
    : odds.length > 0
      ? `Odds on ${name}: ${odds.map((one) => `${one.words} ${one.chance}%`).join(" · ")}`
      : `No roll to hit ${name} on offer.`;
  return Object.freeze({ foeId, odds: Object.freeze(odds), text });
}

/**
 * ► **"CONFIRM EVERY MOVE" (the owner's decision 4: "an optional 'confirm
 *   every move' setting adds Confirm"), remembered per browser.** OFF unless
 *   this page stored "1" under `RING_CONFIRM_KEY` — the owner's Q2 is "one
 *   click acts, as in the original", so the setting is opt-in. Storage that
 *   throws (a private window, blocked site data, a sandboxed frame — even the
 *   `localStorage` getter itself) or holds anything else means OFF, and the
 *   page runs on; a save that cannot be made returns false and the setting
 *   still applies for this visit. `storageOf` is called inside the guard.
 */
export const RING_CONFIRM_KEY = "arena.ring.confirm";

/** Whether "confirm every move" is on in this browser: only a stored "1" is. */
export function ringConfirmSettingFrom(storageOf) {
  try {
    const storage = typeof storageOf === "function" ? storageOf() : null;
    return storage?.getItem?.(RING_CONFIRM_KEY) === "1";
  } catch {
    return false;
  }
}

/** Remembers the setting ("1" on, "0" off); false when it could not be stored. */
export function ringConfirmSettingSave(storageOf, on) {
  try {
    const storage = typeof storageOf === "function" ? storageOf() : null;
    if (typeof storage?.setItem !== "function") return false;
    storage.setItem(RING_CONFIRM_KEY, on ? "1" : "0");
    return true;
  } catch {
    return false;
  }
}

/**
 * ► **THE STRIP'S FOCUS AND ITS POINTER ARE TWO THINGS (Codex review of S7,
 *   pass 3).** The first build kept one "previewed" button for both, so
 *   pointing at the focused button and away again blanked the preview of the
 *   button the keyboard was still on. `{focus, hover}` — the action of the
 *   strip button with the keyboard focus, and of the one under the pointer —
 *   each set by its own event and cleared only by its own button's.
 */
export const RING_STRIP_IDLE = Object.freeze({ focus: null, hover: null });

/**
 * The strip's preview state after one of its buttons' events: `focus` /
 * `blur` / `enter` (pointerenter) / `leave` (pointerleave), with that
 * button's action. A late `blur` or `leave` from a button that is no longer
 * the focused or pointed-at one changes nothing.
 */
export function ringStripPreviewAfter(state, { type, action }) {
  const now = state ?? RING_STRIP_IDLE;
  if (type === "focus") return Object.freeze({ ...now, focus: action });
  if (type === "enter") return Object.freeze({ ...now, hover: action });
  if (type === "blur" && now.focus === action) return Object.freeze({ ...now, focus: null });
  if (type === "leave" && now.hover === action) return Object.freeze({ ...now, hover: null });
  return now;
}

/**
 * WHAT THE PREVIEW LINE SHOWS: the button under the pointer — in the strip,
 * else on the stage — else the one with the keyboard focus, else the choice
 * waiting for Confirm; and whether what it shows IS that choice ("Chosen — ").
 * `{action, chosen}`, `action` null for nothing.
 */
export function ringPreviewShown({ strip = RING_STRIP_IDLE, stageHover = null, pending = null } = {}) {
  const action = strip?.hover ?? stageHover ?? strip?.focus ?? pending ?? null;
  return Object.freeze({ action, chosen: action !== null && pending !== null && ringSameAction(action, pending) });
}
