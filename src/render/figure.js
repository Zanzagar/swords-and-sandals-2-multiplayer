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

/* ------------------------------------------------------------------ */
/* How big a figure draws                                              */
/* ------------------------------------------------------------------ */

/**
 * How much smaller each rank BEHIND the front one draws, per rank.
 *
 * AUTHORED. Vanilla has exactly one gladiator a side
 * (`MAP_SILENCE.multi-slot-arena-geometry`), so there is no second rank in the
 * build to observe and nothing here can be derived. Tuned by looking at the
 * rendered arena, which is the only way to tune it.
 *
 * ► **0.11 UNTIL 2026-09-12, WITH `ALLY_Y_STRIDE` AT -35, AND TOGETHER THEY
 *   MADE THE PICTURE LIE.** The shell draws x at `scale` and arena-y at
 *   `scale * 1.7` (`tools/arena/main.js` `toX`/`toY`), so one unit of y is 1.7
 *   x-equivalent units on screen — a constant that lives in neither file a
 *   reader of these two would think to open. A -35 stride therefore reached the
 *   screen as ~59 x-equivalent units per rank, and this falloff then shrank the
 *   back rank 30%, which is the standard perspective cue for "much further
 *   away".
 *
 *   Measured as the worst drawn-separation over model-separation across every
 *   pair the engine offers a melee verb on, 24 seeds through the arena's own
 *   host path:
 *
 *   ```text
 *                        1v1     2v2     3v3 worst
 *     -35 / 0.11        1.000   1.216   1.658   (model 90, DRAWN 149)
 *     -10 / 0.03        1.000   1.019   1.069   (model 90, drawn 96)
 *   ```
 *
 *   **1v1 is 1.000 under both, which is what identifies the culprit**: the
 *   whole disagreement is the rank stagger, not the model. The resolver was
 *   telling the truth and the renderer was contradicting it.
 *
 *   **This is a floor, not a finished answer.** A one-dimensional model drawn
 *   honestly shows what it actually contains: measured on the same sweep,
 *   **44.7% of the blows thrown in a 3v3 pass through a living body**, and
 *   58.4% of melee-legal pairs have someone standing in the way. No renderer
 *   setting fixes that — it is the model, and it is the brief for a second axis.
 */
export const DEPTH_SCALE_PER_RANK = 0.03;

/**
 * The scale a figure draws at: the build's own `physical_size` percentage,
 * then a falloff for how far back it stands.
 *
 * ## The `physical_size` half is NOT new, and the shell was ignoring it
 *
 * ► **`presentation.js` has emitted `xscale`/`yscale` on every `place-clip`
 *   since the presentation stream existed, `scene.js` carries them onto the
 *   actor — and `tools/arena/main.js` never read either one.** So every
 *   gladiator drew at an identical size no matter its `physical_size`, and a
 *   strength-30 fighter looked exactly like a strength-1 one. Found 2026-09-12
 *   while chasing a different visual complaint. They are PERCENTAGES, as
 *   `_xscale`/`_yscale` are in the build (map, "Battle entry" step 5, which is
 *   also where the villain's negative x-scale comes from), so 86 means 0.86.
 *
 * ## The depth half is what a one-dimensional arena needs from a renderer
 *
 * The resolver models ONE axis. ~~That is faithful — vanilla has one gladiator a
 * side, so there is no second axis to be faithful to~~ — but it means a team
 * walking at the enemy all stops at the same clamp line: measured, three allies
 * at x = 40, 40, 30 while each claims 85 units of personal space. **That is not
 * the model being wrong, it is the model being 1-D**, and a queue is a perfectly
 * good description of it. Drawing a queue as a legible rank is the renderer's
 * job, and doing it by RANK rather than by current position means figures never
 * pop or swap as they move: `slotIndex` does not change during a bout.
 *
 * ~~Lanes in the resolver were tried first and are arithmetically impossible.~~
 * **X-LANES are. Read the arithmetic below for what it actually rules out,
 * corrected 2026-09-12.** Reach is `physical_size + 44` at minimum and the front
 * rank already parks at `physical_size`, so the whole budget for standing
 * further back IS 44 units, shared across every rank, against a drawn figure
 * ~57 wide. Measured over 8 seeds at strides 60, 85 and 130: **0 of 8 bouts
 * settled and the third rank never once had an attack on offer.** See the
 * handoff of 2026-09-12.
 *
 * ► **THAT MEASUREMENT IS SOUND AND IT IS ABOUT ONE AXIS.** Every quantity in
 *   it — the clamp line, the reach, the 44 — is an `x` quantity, because the
 *   ranks were staggered along the SAME axis the walk and the reach gate both
 *   spend. A PERPENDICULAR axis does not spend that budget at all, and the
 *   struck-through sentence above is why nobody checked: it asserted there was
 *   no second axis to be faithful to, and **the build's own `getfightdistance`
 *   is two-dimensional** (`ydist` at `+0x0338`, combined at `+0x0427`; see
 *   `ss2FightDistance`).
 *
 *   Under the build's own metric, `round(sqrt(xdist^2 + ydist^2))`, a second
 *   rank parked at the front rank's clamp line (`dx = 86` at strength 9,
 *   `reach = 130`) stays in reach until `dy` reaches 97:
 *
 *   ```text
 *     dy      0    20    40    60    80    97   100   120
 *     dist   86    88    95   105   117   130   132   148
 *            <-------- in reach -------->|<-- out of reach -->
 *   ```
 *
 *   **97 units against x's 44 — 2.2x the budget, and it does not compete with
 *   the walk clamp.** Two of the three strides that failed as x-lanes (60, 85)
 *   are comfortable as y-strides. This does NOT make a second rank faithful —
 *   vanilla stands both clips at `_y = 200` and `MAP_SILENCE.multi-slot-arena-
 *   geometry` still owns where an ally stands — it makes the DISTANCE between
 *   two unlevel gladiators derived rather than invented.
 *
 * @param {object} actor `{ yscale, slotIndex }` — composed by the caller from
 *   the scene actor (which carries `yscale`) and the wire combatant (which
 *   carries `slotIndex`). Deliberately NOT a new field on `place-clip`: rank is
 *   a property of the roster, the projection already states it, and widening a
 *   command shape to re-deliver something the caller already holds is how a
 *   presentation stream grows fields nobody consumes — which is exactly the
 *   defect this function was written to fix. A null or absent `yscale` means the
 *   vanilla record carried no `physical_size`, and the figure draws nominal
 *   rather than vanishing.
 * @returns {number} a positive multiplier for the painter's local coordinates.
 */
export function figureScaleFor(actor, { depthPerRank = DEPTH_SCALE_PER_RANK } = {}) {
  const stated = Number(actor?.yscale);
  // `_yscale` is a percentage in the build. Absent is not zero: a figure with no
  // stated size draws nominal, and a NEGATIVE one is the villain's mirror on the
  // x axis only, so the magnitude is what matters here.
  const size = Number.isFinite(stated) && stated !== 0 ? Math.abs(stated) / 100 : 1;
  const rank = Number.isFinite(actor?.slotIndex) ? Math.max(0, actor.slotIndex) : 0;
  const depth = Math.max(0.25, 1 - depthPerRank * rank);
  return size * depth;
}
