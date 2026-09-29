/**
 * THE RING'S PREVIEWS — slice S7 of `docs/design/battle-ui.md` ("The in-battle
 * actions: DECIDED", items 4 and 9): what a hovered or focused button says it
 * will do, the selected target's odds in the strip, and where the "confirm
 * every move" setting is remembered. And the REACH PREVIEW, the owner's
 * decision 1 of `#decided-hud-2026-09-24` (slice "reach", 2026-09-28): which
 * foes a hovered or focused spell or shot can reach, lit and numbered, the
 * rest dimmed (`ringReachFor`), its words naming the target, and the preview
 * standing while the pointer crosses to another lit foe (`ringReachAfter`,
 * `ringReachShownFor`).
 *
 * Pure. Every number is the ENGINE's — `host.previewAction(action)`, handed
 * in — and every foe in reach is one the engine's offer, handed in, holds the
 * verb against; this only puts them into words and order: "the engine
 * decides what is possible; the interface only arranges it". It asks the
 * engine nothing itself.
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
 * ► **A SPELL OR A SHOT WITH A REACH NAMES ITS TARGET (the owner's decision
 *   1: "the hover text names the target ('Fireball → Nym · click another lit
 *   foe to change')").** Given `reach` — `ringReachFor` of this very action —
 *   the words are "Fireball → Nym", then the engine's preview as S7 writes it,
 *   then " · click another lit foe to change" when another foe is lit to
 *   click; with nothing to preview, exactly the decision's example. AUTHORED:
 *   where the preview's numbers go (the decision's example has none, and S7's
 *   decision 4 keeps the hit chance in every hover) and the hint's absence
 *   when no other foe is lit. Without a reach, S7's words, unchanged.
 *
 * @param {object} model  from `ringModelFor`
 * @param {object} action  an action on it (a slot's, a move's, the swap's, an
 *   item's or a listed one)
 * @param {object|null} preview  `host.previewAction(action)`
 * @param {{nameOf?: (id: string) => string, reach?: object|null}} [options]
 *   `reach`, `ringReachFor(model, action, …)` — ignored unless it is this
 *   action's
 * @returns {object|null} frozen `{action, key, label, chance, certain, text}` —
 *   `action` the model's own, `chance` the preview's, or null when the action
 *   is not on the model (nothing on screen sends it, so nothing previews it)
 */
export function ringPreviewFor(model, action, preview, { nameOf = (id) => id, reach = null } = {}) {
  const entry = ringEntryFor(model, action);
  if (!entry) return null;
  const reaching = ringSameAction(reach?.action, entry.action) && (reach.lit?.length ?? 0) > 0;
  const label = reaching
    ? `${ringActionLabel({ ...entry.action, targetId: null }, { verb: entry.verb, words: entry.words, nameOf })} → ${nameOf(entry.action.targetId)}`
    : ringActionLabel(entry.action, { verb: entry.verb, words: entry.words, nameOf });
  const parts = previewParts(preview);
  const hint = reaching && reach.lit.length > 1 ? ` · ${RING_REACH_HINT}` : "";
  return Object.freeze({
    action: entry.action,
    key: entry.key,
    label,
    chance: Number.isFinite(preview?.chance) ? preview.chance : null,
    certain: preview?.certain === true,
    text: `${parts.length > 0 ? `${label}: ${parts.join(" · ")}` : label}${hint}`
  });
}

/** The decision's own words for how to change the target of a spell or shot with a reach (decision 1). */
const RING_REACH_HINT = "click another lit foe to change";

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
 * ► **THE REACH PREVIEW (the owner's decision 1,
 *   `docs/design/battle-ui.md#decided-hud-2026-09-24`: "multiple enemies means
 *   TARGET PICKING, not area attacks").** Hovering or focusing a spell or a
 *   bombard "lights EVERY foe it can reach with a numbered gold ring (1–3, left
 *   to right) and dims the rest". Which foes it reaches is the ENGINE's: every
 *   foe the offer holds the same verb against — its `type`, `itemId` and
 *   `spellKind`, the identity `host.submit` matches an offer on — and nothing
 *   is re-derived here. Each such action has ONE target, as in the build: the
 *   player picks, the ring still sends one action at the selected foe.
 *
 * ► **A GREYED SHOT HAS A REACH TOO.** A snipe the team rules grey at the
 *   selected foe (`body-blocks`: a body in its flat line, S9) sends nothing,
 *   but the foes a snipe CAN reach are still the offer's — so pointing at it
 *   lights them, and the selected foe it cannot reach is dimmed: the player
 *   sees whom to pick. Its `action` is null; its verb is what it would send
 *   (`withheld`).
 *
 * @param {object} model  from `ringModelFor`
 * @param {object|null} shown  what the pointer or the focus is on — an action
 *   on the model, or a greyed button's entry (`ringShownFor`, `ringGreyFor`,
 *   `ringPreviewShown`'s `action`)
 * @param {{legal?: object[], xOf?: (foeId: string) => number|undefined}} [options]
 *   `legal`, the engine's offer this turn (`host.legalActions()`, the one the
 *   ring was built from); `xOf`, where each foe is DRAWN, canvas x
 * @returns {object|null} frozen `{type, itemId, spellKind, action, lit, dim}`:
 *   `lit` every foe it reaches, `{foeId, number, selected}`, numbered 1..n left
 *   to right by `xOf`; `dim` every other living foe; `action` the model's own,
 *   or null for a greyed button
 */
export function ringReachFor(model, shown, { legal = [], xOf = null } = {}) {
  const foeIds = model?.foeIds ?? [];
  // AUTHORED: one living foe is no choice to make — a 1v1, or the last foe
  // standing — so there is no preview; the selected ring already marks him.
  if (foeIds.length < 2) return null;
  const entry = reachEntryOf(model, shown);
  if (!entry || !ringReachVerb(model, entry)) return null;
  const sent = entry.action ?? entry.withheld;
  const same = (option) => option.type === sent.type && (option.itemId ?? null) === (sent.itemId ?? null)
    && (option.spellKind ?? null) === (sent.spellKind ?? null);
  const reached = new Set((Array.isArray(legal) ? legal : []).filter(same).map((option) => option.targetId));
  // A verb the offer holds at nobody lights nobody: no preview.
  if (!foeIds.some((foeId) => reached.has(foeId))) return null;
  const order = (foeId) => {
    const x = typeof xOf === "function" ? xOf(foeId) : undefined;
    return Number.isFinite(x) ? x : Infinity;
  };
  const lit = foeIds.filter((foeId) => reached.has(foeId))
    .map((foeId, index) => ({ foeId, index }))
    .sort((left, right) => order(left.foeId) - order(right.foeId) || left.index - right.index)
    .map(({ foeId }, index) => Object.freeze({ foeId, number: index + 1, selected: foeId === model.selectedId }));
  return Object.freeze({
    type: sent.type,
    itemId: sent.itemId ?? null,
    spellKind: sent.spellKind ?? null,
    action: entry.action ?? null,
    lit: Object.freeze(lit),
    dim: Object.freeze(foeIds.filter((foeId) => !reached.has(foeId)))
  });
}

/**
 * ► **WHICH VERBS HAVE A REACH: A SPELL AIMED AT A FOE, AND THE BOW'S TWO
 *   SHOTS.** The decision names "a spell or bombard"; every spell a place of
 *   the items row aims at a foe is one (Fireball, the bolts, Gale, Command,
 *   Whirlwind, Ghost Strike, Weaken Armour, Little Fat Kid — never a potion or
 *   a spell the caster casts on himself, which are aimed at him).
 *
 * ► **AND THE SNIPE — AUTHORED, the decision names only the bombard.** The
 *   owner's report asked for "spells and ranged (bombard particularly)
 *   options"; the design's own targeting table ("Targeting: three cases")
 *   puts spells, bombard AND snipe in one row, "numbered gold rings, pick
 *   1–3"; and the snipe is the one verb whose reach is not every living foe —
 *   a body in its flat line screens a foe (`ss2ShotBlocked`) — so it is the
 *   verb where "dims the rest" says something. Measured over 3,092 turns of
 *   2v2 and 3v3 bouts (five kits, seeds 1-3; a scratch probe in the slice's
 *   report): every foe spell and every bombard was offered at EVERY living
 *   foe on every turn it was offered, the snipe at a strict subset on 172 of
 *   233. Drop "snipe" here and the snipe has no preview.
 *
 * Swings, the bash, the shove, the taunt and a psyche discharge are aimed at
 * one foe too, but reach only the foes beside the fighter: no target to pick.
 */
export const RING_REACH_SHOTS = Object.freeze(["bombard", "snipe"]);

/** Whether an entry of the model is a verb with a reach: a foe-aimed spell on the items row, or a shot at a foe. */
function ringReachVerb(model, entry) {
  const sent = entry?.action ?? entry?.withheld ?? null;
  if (!sent || !(model?.foeIds ?? []).includes(sent.targetId)) return false;
  return entry.place === "item" || RING_REACH_SHOTS.includes(sent.type);
}

/**
 * ► **"AND DIMS THE REST" — HOW MUCH OF A FOE OUT OF REACH IS LEFT (AUTHORED).**
 *   He is drawn through the painters' own `fade` (0 opaque, 1 gone:
 *   `src/render/timeline.js`), his shadow, body and face alike, at 0.45 of
 *   what he showed — a fallen fighter's plate fades to 0.4, so a foe out of
 *   reach stays a little more there than the dead. His name plate takes the
 *   same 0.45 (`tools/arena/main.js`).
 */
export const RING_REACH_DIM = 0.45;

/** The `fade` a dimmed foe is drawn at: his own, and the dim over it. */
export function ringReachFade(fade) {
  return 1 - (1 - (Number.isFinite(fade) ? fade : 0)) * RING_REACH_DIM;
}

/**
 * ► **THE PREVIEW STAYS (the owner's decision 1: "click another lit foe to
 *   change").** A hover lives only while the pointer is on the button, and
 *   clicking a foe takes the pointer off it — so the reach preview is held
 *   apart, as the VERB it previews: `{turn, type, itemId, spellKind}`. It is
 *   set whenever the pointer or the focus is on a spell or shot with a reach
 *   (acting or greyed), and KEPT while it is on nothing — the sand, a foe, a
 *   Target button — so a click on another lit foe finds it still up on his
 *   ring (`ringReachShownFor`).
 *
 * ► **AND A BUTTON CROSSED ON THE WAY ONLY HIDES IT (AUTHORED; found on this
 *   slice's self-review).** From the items row to a foe on the right the
 *   pointer goes straight through the ring's right column: dropped on every
 *   other button, the preview was gone before the click. So a button that is
 *   not a spell or shot with a reach KEEPS it — while it is pointed at, what
 *   shows is that button (its words, and no foe lit: `ringReachFor` of it is
 *   null); back on nothing, the preview is up again. So does a spell or shot
 *   that lights nobody (a snipe screened from every foe): there is no preview
 *   to switch to. Another spell or shot that lights somebody replaces it; the
 *   shell puts it away on a click on the bare stage; the turn's end drops it.
 *   The decision says the preview stays, not what ends it.
 *
 * @param {object|null} state  the verb previewed so far, or null
 * @param {{turn: string, shown: object|null, model: object, legal: object[]}} now
 *   whose turn (the shell's `turnKey`), what the pointer or the focus is on
 *   (`ringPreviewShown`'s `action`, before this), the ring on screen and the
 *   offer it was built from
 * @returns {object|null} frozen — `state` itself unless a spell or shot that
 *   lights somebody is shown, or the turn is another
 */
export function ringReachAfter(state, { turn, shown = null, model = null, legal = [] } = {}) {
  const kept = state && state.turn === turn ? state : null;
  const reach = shown ? ringReachFor(model, shown, { legal }) : null;
  if (!reach) return kept;
  return Object.freeze({ turn, type: reach.type, itemId: reach.itemId, spellKind: reach.spellKind });
}

/**
 * WHAT A STANDING REACH PREVIEW SHOWS ON THE RING ON SCREEN — its verb's own
 * action there (aimed at whoever is selected now), else the greyed button of
 * that verb (a snipe screened from him), else nothing; and nothing for
 * another turn's preview. What the shell shows when the pointer and the focus
 * are on nothing (`ringShownText`, `ringReachFor`).
 */
export function ringReachShownFor(model, state, { turn } = {}) {
  if (!model || !state || state.turn !== turn) return null;
  let greyed = null;
  for (const entry of ringEntries(model, { greyed: true })) {
    const sent = entry.action ?? entry.withheld;
    if (!sent || sent.type !== state.type || (sent.itemId ?? null) !== state.itemId
      || (sent.spellKind ?? null) !== state.spellKind || !ringReachVerb(model, entry)) continue;
    if (entry.action) return entry.action;
    greyed ??= entry;
  }
  return greyed;
}

/**
 * The model's entry for what is shown: an action's (`ringEntryFor`), or — for
 * a greyed button's entry — the model's own greyed entry for that button, so
 * an entry from another ring is nobody's. Null otherwise.
 */
function reachEntryOf(model, shown) {
  if (!model || !shown) return null;
  if (!shown.reason) return ringEntryFor(model, shown);
  return ringEntries(model, { greyed: true }).find((entry) => entry.reason && entry.slot === shown.slot
    && entry.reason.code === shown.reason.code && ringSameAction(entry.withheld, shown.withheld)) ?? null;
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
