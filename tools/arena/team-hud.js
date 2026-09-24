/**
 * THE TEAM HUD — the HUD track of `docs/design/battle-ui.md` ("Team HUD, reach
 * preview and the camera: DECIDED by the owner, 2026-09-24", items 2-5): the
 * team colours on the stage's name plates (H1), the two team panels and the
 * crowd meter (H2), and the turn-order strip (H3).
 *
 * Pure. State in — the host's wire projection, the seats — and a plain view
 * model out; `tools/arena/main.js` only turns it into canvas strokes and DOM.
 * Every number is copied from the engine's own state: "the engine decides
 * what is possible; the interface only arranges it". It changes nothing and
 * asks the engine nothing.
 */

/**
 * THE TWO SIDES' COLOURS — the owner's decision (Q4, Q12): red `#e0584f`, blue
 * `#4c8fe0`. The roster's sides are `"red"` and `"blue"` (`demoSide`,
 * `championSide` in `roster.js`). The demo fighters' SKIN colours are random
 * across both teams, which is why the name plate has to say whose side a
 * fighter is on — and says it with a letter too, not colour alone.
 */
const TEAM_STYLES = Object.freeze({
  red: Object.freeze({ teamId: "red", colour: "#e0584f", initial: "R", name: "Red" }),
  blue: Object.freeze({ teamId: "blue", colour: "#4c8fe0", initial: "B", name: "Blue" })
});

/** The page's dim ink (`--ink-dim` in `index.html`), for a side with no colour of its own. */
const UNCOLOURED = "#9a9287";

/**
 * A side's colour, its initial and its name. Total: a side the arena has no
 * colour for (no roster builds one today) is drawn in the page's dim ink with
 * the first letter of its id, so the HUD never throws on a rule set's team.
 */
export function teamStyleFor(teamId) {
  if (Object.hasOwn(TEAM_STYLES, teamId ?? "")) return TEAM_STYLES[teamId];
  const id = typeof teamId === "string" && teamId.length > 0 ? teamId : null;
  return Object.freeze({
    teamId: id,
    colour: UNCOLOURED,
    initial: id ? id[0].toUpperCase() : "?",
    name: id ?? "?"
  });
}

/**
 * The name plate's dark outline: stroked under the team-coloured name, its
 * underline and its initial, so they read on the sand as well as on the dark
 * stands. The team colours alone reach only 1.4-3.4 : 1 against the sand
 * (`#602d18`, the build's own sand shape 667; `#4a3a2b`-`#836b4b`, the
 * authored bowl) — the outline is what carries them: 5.3 : 1 (red) and
 * 5.9 : 1 (blue) against it. `test/arena-team-hud.test.js` measures both.
 */
export const NAME_PLATE_OUTLINE = "#0b0a0d";

/**
 * How a fighter's name plate on the stage is coloured (H1): his side's colour
 * and initial, the dark outline, and its alpha — OPAQUE while he stands, and
 * 0.4 once he has fallen, as the plate always faded the fallen. The words are
 * his own name, which the shell draws from the combatant as it always has.
 *
 * ► **A LIVING PLATE IS OPAQUE, NOT THE 0.85 THE LIGHT PLATE HAD** (Codex
 *   review of H1, pass 1). The canvas applies the alpha to the outline and to
 *   the fill SEPARATELY, so at 0.85 the sand showed through the outline and
 *   the outline through the fill: red came out at 4.39 : 1 on the build's sand
 *   (glyph interior) and about 4.0 at its edges, under the 4.5 the outline was
 *   chosen for. A fallen fighter's plate is meant to recede, and is exempt.
 *
 * @param {{teamId: string, alive: boolean}} combatant a wire combatant
 */
export function namePlateFor(combatant) {
  const style = teamStyleFor(combatant?.teamId);
  return Object.freeze({
    initial: style.initial,
    fill: style.colour,
    underline: style.colour,
    outline: NAME_PLATE_OUTLINE,
    alpha: combatant?.alive === false ? 0.4 : 1
  });
}

/**
 * WHERE THE PLATE'S PARTS GO, in canvas pixels, around the name the shell
 * draws centred on `x` at `baseline` in a `px` font (H1): the name's outline
 * width, the coloured underline and the outline under it, and the initial's
 * disc to the left of the name.
 *
 * ► **NOTHING REACHES UNDER `baseline + px / 2`**, which is where the ring
 *   reads the bottom of the acting fighter's name (`below` in `renderStage`)
 *   and stands its forward arrow off. An underline drawn past it would sit
 *   under that arrow.
 *
 * @param {{x: number, baseline: number, px: number, nameWidth: number}} input
 *   the name's centre and baseline, its font size and its measured width
 */
export function namePlateLayout({ x, baseline, px, nameWidth }) {
  const left = x - nameWidth / 2;
  // The underline: just under the baseline, a hair wider than the name.
  const lineHeight = Math.max(1.5, px * 0.1);
  const lineOver = px * 0.05;
  const line = Object.freeze({ x: left - lineOver, y: baseline + px * 0.16, width: nameWidth + 2 * lineOver, height: lineHeight });
  const edge = Math.max(1, px * 0.08);
  const lineOutline = Object.freeze({
    x: line.x - edge, y: line.y - edge, width: line.width + 2 * edge, height: line.height + 2 * edge
  });
  // The initial: a disc on the name's line, a gap to the left of its first letter.
  const r = px * 0.42;
  const gap = px * 0.3;
  const disc = Object.freeze({
    x: left - gap - r,
    y: baseline - px * 0.35,
    r,
    outlineWidth: Math.max(1.5, px * 0.12),
    letterPx: Math.max(7, px * 0.62)
  });
  return Object.freeze({ outlineWidth: Math.max(2, px * 0.24), line, lineOutline, disc });
}
