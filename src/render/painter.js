/**
 * A figure spec plus a pose -> a list of DRAW OPERATIONS.
 *
 * This is still pure data: it touches no canvas, no DOM and no timer, so the
 * whole of the drawing logic is testable under `node --test` and the actual
 * shell in `tools/arena/` is reduced to a `switch` over operation kinds. That
 * split is the point — a painter that reached for a `CanvasRenderingContext2D`
 * would put the interesting half of the renderer beyond the suite.
 *
 * EVERY SHAPE IS ARITHMETIC IN THIS FILE. Nothing is traced, sampled or
 * derived from the licensed build's art; see `figure.js` for the standing rule.
 * The proportions are authored and are not a claim about how SS2 looks.
 *
 * COORDINATES. Operations are emitted in the ARENA's own coordinate space —
 * the one the battle map states and `slot-layout.js` derives: x runs -2100 to
 * 2100 with the vanilla pair at ±250, y is 200 at the front rank and DECREASES
 * as a figure stands further back. The shell maps that to a canvas; nothing
 * here knows the canvas size, which is why a resize needs no repaint logic
 * here at all.
 */

export class PainterError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Reference height of a gladiator in arena units, authored. */
const UNIT = 150;

function op(kind, fields) {
  return Object.freeze({ kind, ...fields });
}

function poly(points, fill, { stroke = null, alpha = 1 } = {}) {
  return op("polygon", { points: Object.freeze(points.map((p) => Object.freeze([p[0], p[1]]))), fill, stroke, alpha });
}

function circle(x, y, r, fill, { stroke = null, alpha = 1 } = {}) {
  return op("circle", { x, y, r, fill, stroke, alpha });
}

/**
 * The skeleton, in arena units relative to the figure's own feet at (0, 0),
 * with +y UP. The shell flips it into the arena's ground plane.
 *
 * Authored. A pose bends it; armour thickens it; neither invents a joint.
 */
function skeletonFor(figure, pose) {
  const { height, bulk, stance } = figure.build;
  const h = UNIT * height;
  const lean = pose.lean * 0.16;
  const recoil = pose.recoil;
  const bob = pose.bob * 0.06 * h;
  const spread = (0.12 + pose.legSpread * 0.22) * h * stance;

  const hip = { x: lean * h * 0.5 - recoil * h * 0.22, y: h * 0.48 + bob };
  const shoulder = { x: hip.x + lean * h * 0.42 - recoil * h * 0.18, y: h * 0.82 + bob };
  const head = { x: shoulder.x + lean * h * 0.14 - recoil * h * 0.1, y: h * 0.95 + bob };

  // The weapon arm swings; the shield arm counterbalances it.
  const swing = pose.armSwing;
  const hand = {
    x: shoulder.x + (0.16 + swing * 0.52) * h * figure.weapon.reach,
    y: shoulder.y - (0.06 - swing * 0.16) * h
  };
  const offhand = { x: shoulder.x - (0.2 + Math.max(0, -swing) * 0.16) * h, y: shoulder.y - 0.1 * h };

  return {
    h,
    bulk,
    hip,
    shoulder,
    head,
    hand,
    offhand,
    frontFoot: { x: hip.x + spread * 0.6, y: 0 },
    backFoot: { x: hip.x - spread * 0.6, y: 0 },
    frontKnee: { x: hip.x + spread * 0.34, y: h * 0.24 + bob * 0.5 },
    backKnee: { x: hip.x - spread * 0.34, y: h * 0.24 + bob * 0.5 }
  };
}

function limb(from, to, width, fill, alpha) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = (-dy / length) * width * 0.5;
  const ny = (dx / length) * width * 0.5;
  return poly(
    [
      [from.x + nx, from.y + ny],
      [to.x + nx, to.y + ny],
      [to.x - nx, to.y - ny],
      [from.x - nx, from.y - ny]
    ],
    fill,
    { alpha }
  );
}

function weightOf(figure, slot) {
  const piece = figure.armour.find((entry) => entry.slot === slot);
  return piece ? piece.weight : 0;
}

/**
 * @param {object} figure from `figureSpecFor`
 * @param {object} pose from `poseAt`
 * @returns {ReadonlyArray<object>} draw operations, in paint order
 */
export function paintFigure(figure, pose) {
  if (!figure || typeof figure.combatantId !== "string") {
    throw new PainterError("paintFigure needs a figure spec from figureSpecFor().");
  }
  if (!pose || !Number.isFinite(pose.lean)) {
    throw new PainterError("paintFigure needs a pose from poseAt().");
  }

  const s = skeletonFor(figure, pose);
  const p = figure.palette;
  const alpha = 1 - pose.fade;
  const b = s.bulk;
  const ops = [];

  const legWidth = 0.1 * s.h * b;
  const armWidth = 0.075 * s.h * b;

  // Back leg, back arm, then torso, then front limbs: a paint order that reads
  // as depth without needing a second pass.
  ops.push(limb(s.hip, s.backKnee, legWidth * (1 + weightOf(figure, "greaves") * 0.4), p.skin, alpha));
  ops.push(limb(s.backKnee, s.backFoot, legWidth * 0.85 * (1 + weightOf(figure, "shinguard") * 0.5), p.skin, alpha));
  ops.push(limb(s.shoulder, s.offhand, armWidth, p.skin, alpha));

  // Torso: a tunic, then the breastplate over it if one is worn.
  const chestWidth = 0.34 * s.h * b;
  ops.push(
    poly(
      [
        [s.hip.x - chestWidth * 0.38, s.hip.y],
        [s.shoulder.x - chestWidth * 0.5, s.shoulder.y],
        [s.shoulder.x + chestWidth * 0.5, s.shoulder.y],
        [s.hip.x + chestWidth * 0.38, s.hip.y]
      ],
      p.tunic,
      { alpha }
    )
  );
  const plate = weightOf(figure, "breastplate");
  if (plate > 0) {
    const w = chestWidth * (0.42 + plate * 0.16);
    ops.push(
      poly(
        [
          [s.hip.x - w * 0.7, s.hip.y + s.h * 0.04],
          [s.shoulder.x - w, s.shoulder.y - s.h * 0.02],
          [s.shoulder.x + w, s.shoulder.y - s.h * 0.02],
          [s.hip.x + w * 0.7, s.hip.y + s.h * 0.04]
        ],
        p.metal,
        { stroke: p.metalDark, alpha }
      )
    );
  }
  const pauldron = weightOf(figure, "shoulderguard");
  if (pauldron > 0) {
    ops.push(circle(s.shoulder.x + chestWidth * 0.45, s.shoulder.y, 0.075 * s.h * (0.8 + pauldron), p.metal, { stroke: p.metalDark, alpha }));
  }

  // Front leg.
  ops.push(limb(s.hip, s.frontKnee, legWidth * (1 + weightOf(figure, "greaves") * 0.4), p.skin, alpha));
  ops.push(limb(s.frontKnee, s.frontFoot, legWidth * 0.85 * (1 + weightOf(figure, "shinguard") * 0.5), p.skin, alpha));
  if (weightOf(figure, "boot") > 0) {
    ops.push(poly(
      [
        [s.frontFoot.x - legWidth * 0.6, 0],
        [s.frontFoot.x + legWidth * 1.4, 0],
        [s.frontFoot.x + legWidth * 1.2, legWidth * 0.55],
        [s.frontFoot.x - legWidth * 0.6, legWidth * 0.55]
      ],
      p.leather,
      { alpha }
    ));
  }

  // Head, then helmet over it.
  const headRadius = 0.085 * s.h;
  ops.push(circle(s.head.x, s.head.y, headRadius, p.skin, { alpha }));
  const helm = weightOf(figure, "helmet");
  if (helm > 0) {
    // The dome sits on the head; the face is left open so the figure still has
    // a front, and the crest rides the top rather than covering it. Drawn as a
    // bulb-and-spike in the first pass, which read as a lightbulb.
    const dome = headRadius * (1.04 + helm * 0.12);
    ops.push(poly(
      [
        [s.head.x - dome, s.head.y + headRadius * 0.05],
        [s.head.x - dome * 0.92, s.head.y + dome * 0.72],
        [s.head.x, s.head.y + dome * 1.02],
        [s.head.x + dome * 0.92, s.head.y + dome * 0.72],
        [s.head.x + dome, s.head.y + headRadius * 0.05],
        [s.head.x + dome * 0.55, s.head.y + headRadius * 0.05],
        [s.head.x + dome * 0.42, s.head.y - headRadius * 0.42],
        [s.head.x - dome * 0.42, s.head.y - headRadius * 0.42],
        [s.head.x - dome * 0.55, s.head.y + headRadius * 0.05]
      ],
      p.metal,
      { stroke: p.metalDark, alpha }
    ));
    // A swept crest along the crown, thickest at the front.
    ops.push(poly(
      [
        [s.head.x + dome * 0.26, s.head.y + dome * 0.98],
        [s.head.x + dome * 0.05, s.head.y + dome * 1.52],
        [s.head.x - dome * 0.62, s.head.y + dome * 1.18],
        [s.head.x - dome * 0.5, s.head.y + dome * 0.82]
      ],
      p.trim,
      { alpha }
    ));
  } else {
    // Bare-headed: a brow line, so an unhelmed gladiator still faces somewhere.
    ops.push(limb(
      { x: s.head.x - headRadius * 0.5, y: s.head.y + headRadius * 0.35 },
      { x: s.head.x + headRadius * 0.7, y: s.head.y + headRadius * 0.35 },
      headRadius * 0.22,
      p.leather,
      alpha
    ));
  }

  // Weapon arm and weapon.
  ops.push(limb(s.shoulder, s.hand, armWidth * (1 + weightOf(figure, "gauntlet") * 0.5), p.skin, alpha));
  const turn = pose.weaponAngle * Math.PI * 2;
  if (figure.weapon.kind === "bow") {
    ops.push(circle(s.hand.x, s.hand.y, 0.16 * s.h, "transparent", { stroke: p.leather, alpha }));
    ops.push(limb(
      { x: s.hand.x, y: s.hand.y + 0.16 * s.h },
      { x: s.hand.x, y: s.hand.y - 0.16 * s.h },
      0.012 * s.h,
      p.blade,
      alpha
    ));
  } else {
    // A tapered blade, not a bar: drawn as a quadrilateral from a wide ricasso
    // to a point, so it reads as a weapon at any swing angle. The first
    // screenshot of the browser arena drew this as a constant-width limb and it
    // read as a stick — which is the sort of thing only looking at it tells you.
    const reach = 0.46 * s.h * figure.weapon.reach;
    const dirX = Math.cos(turn);
    const dirY = Math.sin(turn);
    const nX = -dirY;
    const nY = dirX;
    const root = 0.026 * s.h;
    const near = { x: s.hand.x + dirX * 0.05 * s.h, y: s.hand.y + dirY * 0.05 * s.h };
    const tip = { x: s.hand.x + dirX * reach, y: s.hand.y + dirY * reach };
    ops.push(poly(
      [
        [near.x + nX * root, near.y + nY * root],
        [tip.x + nX * root * 0.18, tip.y + nY * root * 0.18],
        [tip.x - nX * root * 0.18, tip.y - nY * root * 0.18],
        [near.x - nX * root, near.y - nY * root]
      ],
      p.blade,
      { stroke: p.metalDark, alpha }
    ));
    // Crossguard across the blade, and a grip behind the hand.
    ops.push(limb(
      { x: near.x + nX * 0.055 * s.h, y: near.y + nY * 0.055 * s.h },
      { x: near.x - nX * 0.055 * s.h, y: near.y - nY * 0.055 * s.h },
      0.022 * s.h,
      p.trim,
      alpha
    ));
    ops.push(limb(
      s.hand,
      { x: s.hand.x - dirX * 0.05 * s.h, y: s.hand.y - dirY * 0.05 * s.h },
      0.03 * s.h,
      p.leather,
      alpha
    ));
  }

  // Shield, painted last so it reads as nearest the viewer.
  const shield = weightOf(figure, "shield");
  if (shield > 0) {
    ops.push(circle(s.offhand.x, s.offhand.y, 0.15 * s.h * (0.85 + shield * 0.4), p.metalDark, { stroke: p.trim, alpha }));
    ops.push(circle(s.offhand.x, s.offhand.y, 0.05 * s.h, p.trim, { alpha }));
  }

  return Object.freeze(ops);
}

/**
 * The shadow, drawn from the figure's own footprint rather than as a fixed
 * ellipse: a knocked-back gladiator's shadow moves with him.
 */
export function paintShadow(figure, pose) {
  const s = skeletonFor(figure, pose);
  const width = 0.4 * s.h * s.bulk * (1 + pose.legSpread * 0.5);
  return Object.freeze([
    op("ellipse", {
      x: (s.frontFoot.x + s.backFoot.x) / 2,
      y: 0,
      rx: width,
      ry: width * 0.22,
      fill: "rgba(0,0,0,0.28)",
      alpha: 1 - pose.fade
    })
  ]);
}
