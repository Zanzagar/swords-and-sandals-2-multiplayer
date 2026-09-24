/**
 * THE TEAM HUD (the HUD track of `docs/design/battle-ui.md`, "Team HUD, reach
 * preview and the camera: DECIDED", items 2-5): `tools/arena/team-hud.js`,
 * the pure model the arena's name plates, team panels, crowd meter and
 * turn-order strip are drawn from.
 *
 * Seams: the module's exports, and whole bouts played through the arena's own
 * host with the model read after every action.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { NAME_PLATE_OUTLINE, namePlateFor, namePlateLayout, teamStyleFor } from "../tools/arena/team-hud.js";

/* ------------------------------------------------------------------ */
/* H1: the team colours                                                */
/* ------------------------------------------------------------------ */

test("H1: red is #e0584f and blue #4c8fe0 (the owner's Q4), each with its initial — a cue that is not colour alone", () => {
  assert.deepEqual(
    { ...teamStyleFor("red") },
    { teamId: "red", colour: "#e0584f", initial: "R", name: "Red" }
  );
  assert.deepEqual(
    { ...teamStyleFor("blue") },
    { teamId: "blue", colour: "#4c8fe0", initial: "B", name: "Blue" }
  );
});

test("H1: a side the arena has no colour for is drawn in the page's dim ink with its own initial, never a crash", () => {
  assert.deepEqual({ ...teamStyleFor("green") }, { teamId: "green", colour: "#9a9287", initial: "G", name: "green" });
  assert.deepEqual({ ...teamStyleFor(null) }, { teamId: null, colour: "#9a9287", initial: "?", name: "?" });
});

test("H1: a name plate is in his side's colour, over a dark outline, with his side's initial; the dead are faint", () => {
  const living = namePlateFor({ id: "red-1", name: "Tarn", teamId: "red", alive: true });
  // Opaque while he stands (~~0.85, the light plate's~~ until the Codex review of H1: see below).
  assert.deepEqual({ ...living }, {
    initial: "R", fill: "#e0584f", underline: "#e0584f", outline: NAME_PLATE_OUTLINE, alpha: 1
  });
  const dead = namePlateFor({ id: "blue-2", name: "Nym", teamId: "blue", alive: false });
  assert.equal(dead.fill, "#4c8fe0");
  assert.equal(dead.initial, "B");
  assert.equal(dead.alpha, 0.4, "the alpha the plate always had for the fallen");
});

/** WCAG 2.1's contrast ratio of two `#rrggbb` colours (relative luminance, sRGB). */
function contrast(one, two) {
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(one), luminance(two)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

const page = fs.readFileSync(new URL("../tools/arena/index.html", import.meta.url), "utf8");
/** A custom property's value in `index.html`'s `:root`. */
const cssVar = (name) => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(page)?.[1];

test("H1: both colours read at WCAG AA (4.5 : 1) on the plate's outline and on the panel rows they are written on", () => {
  // Worked by hand from WCAG 2.1's formula: #e0584f on #0b0a0d is 5.34, #4c8fe0 5.94.
  assert.ok(contrast("#e0584f", "#0b0a0d") > 5.3 && contrast("#e0584f", "#0b0a0d") < 5.4, "the formula, checked on a worked value");
  for (const team of ["red", "blue"]) {
    const { colour } = teamStyleFor(team);
    assert.ok(contrast(colour, NAME_PLATE_OUTLINE) >= 4.5, `${team} on the plate's outline: ${contrast(colour, NAME_PLATE_OUTLINE).toFixed(2)}`);
    // The side panel (--panel) gives red only 4.44, so a row is drawn on the page's --ground.
    const ground = cssVar("ground");
    assert.ok(ground, "index.html declares --ground");
    assert.ok(contrast(colour, ground) >= 4.5, `${team} on a row (--ground ${ground}): ${contrast(colour, ground).toFixed(2)}`);
  }
  assert.match(page, /\.fighter \{[^}]*background: var\(--ground\)/, "a roster row is drawn on --ground");
});

test("H1: the plate's underline and initial stay inside what the ring reads as the name — its forward arrow clears them", () => {
  // The ring's rank arrows stand off `below: nameY + namePx * 0.5` (renderStage; pinned in
  // test/arena-ring-movement.test.js), so nothing the plate draws may reach under that line.
  for (const px of [10, 15, 22.5, 40]) {
    for (const nameWidth of [12, 80, 160]) {
      const x = 500;
      const baseline = 300;
      const plate = namePlateLayout({ x, baseline, px, nameWidth });
      const where = `px ${px}, width ${nameWidth}`;
      const left = x - nameWidth / 2;
      const right = x + nameWidth / 2;
      assert.ok(plate.outlineWidth > 0, `${where}: the name is outlined`);
      // The underline: under the baseline, the whole name's width, in colour over its own outline.
      const { line, lineOutline } = plate;
      assert.ok(line.y > baseline, `${where}: the underline is under the baseline`);
      assert.ok(line.x <= left && line.x + line.width >= right, `${where}: it underlines the whole name`);
      assert.ok(line.height >= 1.5, `${where}: at least 1.5 px, so it is seen`);
      assert.ok(lineOutline.x < line.x && lineOutline.y < line.y
        && lineOutline.x + lineOutline.width > line.x + line.width
        && lineOutline.y + lineOutline.height > line.y + line.height, `${where}: its outline surrounds it`);
      // The initial: a disc left of the name, on the name's own line, never over a letter.
      const { disc } = plate;
      assert.ok(disc.x + disc.r + disc.outlineWidth / 2 < left, `${where}: the initial is clear of the name`);
      assert.ok(disc.y < baseline && disc.y > baseline - px, `${where}: on the name's line`);
      assert.ok(disc.letterPx >= 7, `${where}: a letter that can be read`);
      // Nothing under the ring's line.
      const lowest = Math.max(lineOutline.y + lineOutline.height, disc.y + disc.r + disc.outlineWidth / 2);
      assert.ok(lowest <= baseline + px * 0.5, `${where}: the plate reaches ${lowest - baseline} under the baseline, past ${px * 0.5}`);
    }
  }
});

/** `top` drawn at `alpha` over `under`, as a 2D canvas composites (source-over, in sRGB). */
function over(top, alpha, under) {
  const channels = (hex) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  const mixed = channels(top).map((value, index) => Math.round(alpha * value + (1 - alpha) * channels(under)[index]));
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

test("H1 (Codex review of H1, pass 1): a LIVING plate reads at 4.5 : 1 as the canvas composites it, on every sand", () => {
  // The plate's alpha applies to the stroke and to the fill SEPARATELY: at 0.85 the outline let the
  // sand through and the fill let the outline through, and red fell to ~4.0 : 1 on the build's sand.
  const sands = ["#602d18", "#4a3a2b", "#6d573d", "#836b4b"];
  for (const team of ["red", "blue"]) {
    const plate = namePlateFor({ teamId: team, alive: true });
    for (const sand of sands) {
      const outline = over(plate.outline, plate.alpha, sand);
      // A glyph's interior: the fill over the sand; its edge: the fill over the outline.
      for (const glyph of [over(plate.fill, plate.alpha, sand), over(plate.fill, plate.alpha, outline)]) {
        assert.ok(contrast(glyph, outline) >= 4.5, `${team} on ${sand}: ${glyph} against ${outline} is ${contrast(glyph, outline).toFixed(2)}`);
      }
    }
  }
});
