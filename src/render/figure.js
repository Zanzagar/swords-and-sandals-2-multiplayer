/**
 * A combatant's wire projection -> an ORIGINAL vector figure specification.
 *
 * EVERY SHAPE HERE IS DRAWN FROM ARITHMETIC IN THIS FILE. Nothing is traced,
 * extracted, sampled or derived from the licensed build's art, and no SS2
 * asset is imported, embedded or referenced. That is the project's standing
 * distribution rule (`AGENTS.md`, "Ship no SS2 asset") and it is the reason a
 * renderer had to author a figure rather than draw one: the repository is a
 * distribution channel, and someone who clones it must still need their own
 * licensed copy to play.
 *
 * WHAT IT IS ALLOWED TO READ, and why that is not a combat value. The figure
 * is derived from the combatant's own wire projection — the eight armour-slot
 * resources, `equipped_weapon`, `stats` and `loadout`. Choosing how wide to
 * draw a gladiator because he is strong is PRESENTATION; recomputing his
 * damage would not be. Nothing in this module clamps, rounds or re-derives a
 * number the resolver owns, and nothing it returns is fed back into combat.
 *
 * PROVENANCE. Every proportion below is AUTHORED. No capture has ever observed
 * the build's art, so there is nothing here to be faithful to and nothing here
 * may be presented as SS2's appearance. The spec says so in its own
 * `provenance` field so a surface cannot lose the distinction on the way to a
 * canvas.
 */

export class FigureError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = new.target.name;
  }
}

/**
 * The eight armour slots the wire projection actually carries, in the order a
 * painter should lay them down (furthest from the viewer first).
 *
 * The names are the vanilla resource keys; the ORDER is authored, because
 * nothing in the map states a paint order for armour pieces.
 */
export const ARMOUR_SLOTS = Object.freeze([
  "boot",
  "shinguard",
  "greaves",
  "breastplate",
  "gauntlet",
  "shoulderguard",
  "helmet",
  "shield"
]);

/** Which body part each slot dresses. Authored. */
const SLOT_PART = Object.freeze({
  boot: "foot",
  shinguard: "shin",
  greaves: "thigh",
  breastplate: "torso",
  gauntlet: "forearm",
  shoulderguard: "shoulder",
  helmet: "head",
  shield: "offhand"
});

/**
 * Two team palettes, authored. They are keyed by SIDE (hero/villain), which is
 * a layout concept, so a three-team future does not silently reuse one.
 */
export const SIDE_PALETTES = Object.freeze({
  hero: Object.freeze({
    skin: "#c98f63", tunic: "#8c2f39", leather: "#5c4023",
    metal: "#c8ccd4", metalDark: "#7d8490", trim: "#e0b558", blade: "#dfe4ec"
  }),
  villain: Object.freeze({
    skin: "#a97c52", tunic: "#2f4858", leather: "#4a3a26",
    metal: "#b6bcc6", metalDark: "#6c737e", trim: "#8fb8c9", blade: "#d3d9e2"
  })
});

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function resourceValue(combatant, name) {
  const entry = combatant?.resources?.[name];
  if (!entry || !Number.isFinite(entry.value)) return 0;
  return entry.value;
}

/**
 * An armour piece's visual weight, 0..1.
 *
 * The wire carries a piece as an item ID, not a thickness — `breastplate: 2`
 * means "item 2", and the map's item tables are the only thing that would say
 * what item 2 looks like. This module therefore does NOT pretend to know: it
 * reports `worn` (is the slot occupied at all) and a `tier` that is nothing but
 * the id itself, and the painter draws a heavier plate for a higher tier
 * because that is a presentational choice, not a claim about item 2.
 */
function pieceFor(combatant, slot) {
  const id = resourceValue(combatant, slot);
  const worn = id > 0;
  return Object.freeze({
    slot,
    part: SLOT_PART[slot],
    worn,
    itemId: id,
    // Authored ramp. Deliberately saturating, so a high id cannot draw a
    // gladiator wider than the arena.
    weight: worn ? clamp01(0.35 + Math.min(id, 12) / 24) : 0
  });
}

/**
 * Build proportions from the combatant's own stats.
 *
 * Authored mapping, saturating in both directions so no stat line can produce a
 * figure that will not fit a slot.
 */
function buildFor(combatant) {
  const stats = combatant?.stats ?? {};
  const strength = Number.isFinite(stats.strength) ? stats.strength : 5;
  const vitality = Number.isFinite(stats.vitality) ? stats.vitality : 5;
  const agility = Number.isFinite(stats.agility) ? stats.agility : 5;
  return Object.freeze({
    // 1.0 is the reference gladiator. The ranges are narrow on purpose: a
    // silhouette a player can read at a glance beats a faithful stat readout.
    height: 0.92 + clamp01(vitality / 20) * 0.16,
    bulk: 0.85 + clamp01(strength / 20) * 0.34,
    stance: 0.9 + clamp01(agility / 20) * 0.2
  });
}

function weaponFor(combatant) {
  const equipped = resourceValue(combatant, "equipped_weapon");
  const canUseRanged = combatant?.loadout?.canUseRanged === true;
  return Object.freeze({
    equippedId: equipped,
    // A bow is a different silhouette, and `canUseRanged` is the wire's own
    // word for it rather than an inference from the item id.
    kind: canUseRanged ? "bow" : "blade",
    // Authored, saturating: reach for the drawing, never for the arithmetic.
    reach: 0.6 + clamp01(Math.min(equipped, 16) / 20) * 0.6
  });
}

/**
 * @param {object} combatant one entry from `toTeamWireState(battle).teams[].combatants`
 * @param {{side: "hero"|"villain"}} options the arena side, from the layout
 */
export function figureSpecFor(combatant, { side } = {}) {
  if (!combatant || typeof combatant.id !== "string") {
    throw new FigureError("figureSpecFor needs a combatant projection carrying a string id.");
  }
  if (side !== "hero" && side !== "villain") {
    throw new FigureError(
      `figureSpecFor needs the arena side ("hero" or "villain"), not ${JSON.stringify(side)}. ` +
      "It comes from the layout, which is the only thing that knows which team took which side."
    );
  }

  const pieces = ARMOUR_SLOTS.map((slot) => pieceFor(combatant, slot));
  return Object.freeze({
    combatantId: combatant.id,
    name: combatant.name ?? combatant.id,
    side,
    palette: SIDE_PALETTES[side],
    build: buildFor(combatant),
    weapon: weaponFor(combatant),
    armour: Object.freeze(pieces),
    /** Slots actually worn, for a painter that skips empties cheaply. */
    wornSlots: Object.freeze(pieces.filter((piece) => piece.worn).map((piece) => piece.slot)),
    /**
     * Not decoration. Every proportion, colour and paint order above is this
     * module's invention; no capture has observed the build's art. A surface
     * that renders a figure must be able to say so.
     */
    provenance: "authored-original-art"
  });
}
