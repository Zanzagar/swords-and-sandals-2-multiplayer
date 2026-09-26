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

import { SS2_CROWD_MOODS } from "../../src/render/crowd-bar.js";
import { SS2_CROWD_SOUND } from "../../src/render/crowd-sound.js";
import { SPLAT_WORDS, STATUS_BONUS_FRAMES } from "../../src/render/popups.js";
import { ss2CrowdInterestOf } from "../../src/team/ss2-crowd.js";
import { SS2_DEATH_CLEAR_FLAGS, SS2_TAUNT_FLAGS, ss2StatusFlagOf } from "../../src/team/ss2-rules.js";
import { resourceValue } from "../../src/team/resources.js";
import { seatTagFor } from "./seats.js";

/**
 * THE TWO SIDES' COLOURS — the owner's decision (Q4, Q12): red `#e0584f`, blue
 * `#4c8fe0`. The roster's sides are `"red"` and `"blue"` (`demoSide`,
 * `championSide` in `roster.js`). The demo fighters' SKIN colours are random
 * across both teams, which is why the name plate has to say whose side a
 * fighter is on — and it says so in his side's colour, and nothing else.
 *
 * ► **THE COLOUR IS THE SIDE'S ONLY CUE (D1 of the in-frame team HUD, the
 *   owner, 2026-09-24: "the team names dont need the R and B icons next to
 *   them and underlined. Colors suffice.").** ~~Each side also carried an
 *   `initial`, "R" or "B", drawn on a disc beside every name — the plate, the
 *   roster heading and rows, the turn strip — "a cue that is not colour
 *   alone", with a coloured underline on the plate and under each strip
 *   chip~~: all of it is gone, from the drawing and from this model.
 */
const TEAM_STYLES = Object.freeze({
  red: Object.freeze({ teamId: "red", colour: "#e0584f", name: "Red" }),
  blue: Object.freeze({ teamId: "blue", colour: "#4c8fe0", name: "Blue" })
});

/** The page's dim ink (`--ink-dim` in `index.html`), for a side with no colour of its own. */
const UNCOLOURED = "#9a9287";

/**
 * A side's colour and its name. Total: a side the arena has no colour for (no
 * roster builds one today) is drawn in the page's dim ink under its own id, so
 * the HUD never throws on a rule set's team.
 */
export function teamStyleFor(teamId) {
  if (Object.hasOwn(TEAM_STYLES, teamId ?? "")) return TEAM_STYLES[teamId];
  const id = typeof teamId === "string" && teamId.length > 0 ? teamId : null;
  return Object.freeze({
    teamId: id,
    colour: UNCOLOURED,
    name: id ?? "?"
  });
}

/**
 * The name plate's dark outline: stroked under the team-coloured name, so it
 * reads on the sand as well as on the dark stands. The team colours alone
 * reach only 1.4-3.4 : 1 against the sand
 * (`#602d18`, the build's own sand shape 667; `#4a3a2b`-`#836b4b`, the
 * authored bowl) — the outline is what carries them: 5.3 : 1 (red) and
 * 5.9 : 1 (blue) against it. `test/arena-team-hud.test.js` measures both.
 */
export const NAME_PLATE_OUTLINE = "#0b0a0d";

/**
 * How a fighter's name plate on the stage is coloured (H1): his side's colour,
 * the dark outline, and its alpha — OPAQUE while he stands, and 0.4 once he
 * has fallen, as the plate always faded the fallen. The words are his own
 * name, which the shell draws from the combatant as it always has; the plate
 * is that name and nothing else (D1: no initial, no underline).
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
    fill: style.colour,
    outline: NAME_PLATE_OUTLINE,
    alpha: combatant?.alive === false ? 0.4 : 1
  });
}

/**
 * THE PLATE'S SHAPE, in canvas pixels, for a name the shell draws in a `px`
 * font (H1): the width of the dark outline stroked under the name — which is
 * all of the plate there is besides the name itself (D1).
 *
 * ► **~~The coloured underline under the name, its outline, and the initial's
 *   disc to the left of it~~** were placed here until 2026-09-24 (D1), and
 *   were why this took the name's centre, baseline and measured width.
 *
 * ► **NOTHING REACHES UNDER `baseline + px / 2`**, which is where the ring
 *   reads the bottom of the acting fighter's name (`below` in `renderStage`)
 *   and stands its forward arrow off. Under the baseline the plate now inks a
 *   descender and half of this outline, and the test holds the two together
 *   above that line.
 *
 * @param {{px: number}} input the name's font size
 */
export function namePlateLayout({ px }) {
  return Object.freeze({ outlineWidth: Math.max(2, px * 0.24) });
}

/* ------------------------------------------------------------------ */
/* H2: the crowd meter                                                 */
/* ------------------------------------------------------------------ */

/**
 * THE BUILD'S TEN MOODS, index 0 the empty string — `crowd_interest_array`,
 * built by `combat_panel`'s `crowd_bar` on load (`sprite:751`, clip-action 0,
 * `+0x01c7`-`+0x01ea`: eleven operands and `new Array`, pushed last-first, so
 * the `""` pushed last is index 0) and read every frame as
 * `"crowd: " + crowd_interest_array[Math.ceil(crowd_interest / 10)]`
 * (clip-action 1, `+0x01fa`-`+0x0232`). Read from the oracle's action dump
 * (`all-actions.txt`, sha256 77cb545c…). "Tranfixed" is the build's spelling.
 *
 * ► **NOT FROM THE TEXT PACK OR THE BATTLE MAP**, where the brief looked for
 *   them: neither records them. ~~The icons pack does (`combat_panel`'s
 *   `clipEvents[].touches`), but as a SORTED set, which has lost the order.~~
 *   Since D8 (2026-09-25) the icons pack carries them IN ORDER, read off the
 *   bytes (`crowd.drive.moods`, `tools/extract-icons.mjs`).
 *
 * ► **ONE TABLE, THE CROWD BAR'S** (D8): this is `SS2_CROWD_MOODS` of
 *   `src/render/crowd-bar.js`, which draws the same words in the frame — two
 *   hand-cited copies could drift apart with nothing to say so.
 */
export const CROWD_MOODS = SS2_CROWD_MOODS;

/**
 * THE CROWD METER (H2; the owner's Q11): one shared meter, the build's label
 * and its bar.
 *
 * - `text` is the build's `"crowd: " + mood`, `mood` its
 *   `crowd_interest_array[ceil(interest / 10)]`;
 * - `percent` is the bar, the build's `_xscale = round(crowd_interest)`;
 * - `band` is `"boo"` below 20 and `"cheer"` above 70 — the lines the build's
 *   boos and cheers wait on (`SS2_CROWD_SOUND`), marked on the bar.
 *
 * ► **AUTHORED ABOVE 100.** `nextphase` clamps the crowd to 1..100, but the
 *   OPENING is every fighter's level summed and is unclamped until the first
 *   completed phase (`src/team/ss2-crowd.js`), so six fighters averaging above
 *   level 16 open past 100 — index 11, where the build's own array has nothing
 *   and its label would read "crowd: undefined". The meter keeps the top mood
 *   and a full bar; `value` is still the engine's number.
 *
 * `shown` is false with no crowd at all (a rule set without one) and when the
 * caller says the crowd is not heard — the build hides `crowd_bar` while
 * `hero.herolevel` is 1 (clip-action 0's else branch, `+0x01f0`-`+0x021f`),
 * which the arena answers with `crowdHeardFor`.
 *
 * @param {number|null} interest the battle's `crowd_interest`
 * @param {{shown?: boolean}} [options]
 */
export function crowdMeterFor(interest, { shown = true } = {}) {
  const { booBelow, cheerAbove } = SS2_CROWD_SOUND;
  if (!Number.isFinite(interest)) {
    return Object.freeze({ shown: false, value: null, percent: 0, mood: "", text: "", band: null, booBelow, cheerAbove });
  }
  const index = Math.min(CROWD_MOODS.length - 1, Math.max(0, Math.ceil(interest / 10)));
  const mood = CROWD_MOODS[index];
  return Object.freeze({
    shown: shown !== false,
    value: interest,
    percent: Math.min(100, Math.max(0, Math.round(interest))),
    mood,
    text: `crowd: ${mood}`,
    band: interest < booBelow ? "boo" : interest > cheerAbove ? "cheer" : null,
    booBelow,
    cheerAbove
  });
}

/* ------------------------------------------------------------------ */
/* H2: the condition chips                                             */
/* ------------------------------------------------------------------ */

/** "BURNING" -> "Burning". */
const titleCase = (word) => word.charAt(0) + word.slice(1).toLowerCase();

/**
 * THE CONDITIONS A CHIP NAMES, in the engine's own order (`death()`'s clear
 * order, `SS2_DEATH_CLEAR_FLAGS`, then the taunt), each in plain words:
 *
 * - the four damage conditions carry the word the build's bonus splat shows
 *   over the sufferer when one ticks — `SPLAT_WORDS[151]` at
 *   `STATUS_BONUS_FRAMES` (`src/render/popups.js`): BURNING, FROZEN,
 *   POISONED, and WRAITH for life stolen — so the chip and the pop-up say the
 *   same thing;
 * - the taunt has no splat, so "Taunted" is authored. `taunted1` and
 *   `taunted2` are one condition to a player (`SS2_TAUNT_FLAGS`).
 *
 * Each `title` says what the condition does WHEN it plays, and never
 * promises that it will: the build's forced chain (`legalActions`,
 * `forcedStatusFlag`, `statusConsumptionEffects` in `ss2-rules.js`) puts the
 * forced weapon swap (an empty quiver) and the forced rest (no stamina) ahead
 * of the flee, the flee ahead of the four, the four in this order — and
 * clears every flag it walks past, so an exhausted burning fighter rests and
 * never burns, and a frozen-and-burning one plays frozen and loses the
 * burning (Codex review of H2, pass 2: ~~"it takes his next turn"~~). And the
 * damage is the INFLICTOR's enchantment damage, read off the living only
 * (`resolveStatusPhase`): once he has fallen the condition still plays and
 * hurts nobody (pass 3: ~~"is hurt by it"~~).
 *
 * ► **`facing-left` IS NOT A CONDITION** (`SS2_FACING_LEFT`: the build's
 *   `gladiator_dir`, carried as a status token only because a string has
 *   nowhere else to live), and the roster used to print it raw. Nor is any
 *   token this table does not know: a chip never shows an engine token.
 */
const CONDITIONS = Object.freeze([
  ...SS2_DEATH_CLEAR_FLAGS.map((flag) => {
    const words = titleCase(SPLAT_WORDS[151][STATUS_BONUS_FRAMES[flag]]);
    return Object.freeze({
      flags: Object.freeze([flag]),
      words,
      title: `${words}: when it plays he loses that turn to it and takes enchantment damage from the fighter who ` +
        "inflicted it — none once that fighter has fallen. A forced rest or weapon swap, a taunt, or a condition " +
        "ahead of it plays instead and clears it unplayed."
    });
  }),
  Object.freeze({
    flags: SS2_TAUNT_FLAGS,
    words: "Taunted",
    title: "Taunted: when it plays he spends that turn running from his foes. A forced rest or weapon swap plays " +
      "instead and clears it unplayed."
  })
]);

/**
 * A fighter's condition chips (H2), from his wire `status`: one per condition
 * he carries, whoever inflicted it, in the engine's order.
 *
 * @param {string[]} status
 * @returns {{flag: string, words: string, title: string}[]}
 */
export function conditionsFor(status) {
  const carried = new Set((Array.isArray(status) ? status : []).map((token) => ss2StatusFlagOf(String(token))));
  const chips = [];
  for (const condition of CONDITIONS) {
    const flag = condition.flags.find((candidate) => carried.has(candidate));
    if (flag !== undefined) chips.push(Object.freeze({ flag, words: condition.words, title: condition.title }));
  }
  return Object.freeze(chips);
}

/* ------------------------------------------------------------------ */
/* H2: the team panels                                                 */
/* ------------------------------------------------------------------ */

/** The sides in the order the panels stand: red, then blue (the owner's decision), then any other. */
const PANEL_ORDER = Object.freeze(["red", "blue"]);

/**
 * One of the build's three readings: a pool and its maximum, and the bar's
 * fill as the build rounds it — `round(value / max * 100)` for the health
 * vial, the energy vial and the armour gauge alike (`combat_panel`'s
 * `villain_potion`, `hero_stamina_potion` and `hero_armour` clip-actions,
 * `+0x00de`/`+0x00e5`/`+0x0147`, the `Divide` in each), kept inside 0..100.
 */
function readingOf(value, max, shown = true) {
  const known = Number.isFinite(value) && Number.isFinite(max);
  const percent = known && max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;
  return Object.freeze({ value: known ? value : null, max: known ? max : null, percent, shown: known && shown });
}

/**
 * THE TWO TEAM PANELS (H2; the owner's Q1a, Q2, Q3c), the crowd meter and the
 * turn-order strip (H3, `turnOrderFor`) — from the host's wire projection.
 *
 * Each row carries the build's THREE READINGS, and where each lives in the
 * engine:
 *
 * - **health**: `health` / `maxHealth` — the build's `hitpoints` /
 *   `hitpointsmax` (`CANONICAL_HEALTH_SOURCES`);
 * - **energy**: `staminaleft` / `staminamax` — SS2 has no mana: a spell is
 *   paid from stamina (`staminacost = round(magicka)`);
 * - **armour**: `armourclass` / `armourclass_max`, the maximum falling back to
 *   `armourclass` as `vanillaRecordOf` and the potion arm do. The build's
 *   gauge reads the same pair and HIDES itself unless `armourclass > 0`
 *   (`hero_armour` clip-action 0, `+0x0094`-`+0x00bb`), so `shown` is false
 *   at 0 — broken, or none worn.
 *
 * and who acts (`initiative[turnCursor]`, nobody once decided), who has
 * fallen, the condition chips, and the seat's tag — `"you"` or `"AI"` in a
 * `?play=` bout (`seatTagFor`), nothing otherwise.
 *
 * @param {object} input
 * @param {object} input.wire `host.wire()` — `toTeamWireState`
 * @param {object|null} [input.seats] `seatControllersFrom`'s answer
 * @param {boolean} [input.crowdShown] whether the crowd is heard (`crowdHeardFor`)
 */
export function teamHudFor({ wire, seats = null, crowdShown = true }) {
  const actingId = wire?.result ? null : (wire?.initiative?.[wire?.turnCursor] ?? null);
  const teams = [...(wire?.teams ?? [])].sort((left, right) => panelRank(left.id) - panelRank(right.id));
  return Object.freeze({
    actingId,
    crowd: crowdMeterFor(ss2CrowdInterestOf(wire), { shown: crowdShown }),
    turnOrder: turnOrderFor(wire),
    teams: Object.freeze(teams.map((team) => {
      const style = teamStyleFor(team.id);
      const rows = [...team.combatants]
        .sort((left, right) => left.slotIndex - right.slotIndex)
        .map((combatant) => rowOf(combatant, { style, actingId, seats }));
      return Object.freeze({
        teamId: style.teamId,
        name: style.name,
        colour: style.colour,
        standing: rows.filter((row) => row.alive).length,
        rows: Object.freeze(rows)
      });
    }))
  });
}

/** Where a side's panel stands: red, blue, then the rest in the wire's order. */
function panelRank(teamId) {
  const at = PANEL_ORDER.indexOf(teamId);
  return at === -1 ? PANEL_ORDER.length : at;
}

function rowOf(combatant, { style, actingId, seats }) {
  const armourclass = resourceValue(combatant, "armourclass", null);
  const seat = seatTagFor(seats, combatant.id);
  return Object.freeze({
    id: combatant.id,
    name: combatant.name,
    teamId: style.teamId,
    colour: style.colour,
    acting: combatant.id === actingId,
    alive: combatant.alive !== false,
    seat,
    you: seat === "you",
    health: readingOf(combatant.health, combatant.maxHealth),
    energy: readingOf(resourceValue(combatant, "staminaleft", null), resourceValue(combatant, "staminamax", null)),
    armour: readingOf(armourclass, resourceValue(combatant, "armourclass_max", armourclass), armourclass > 0),
    conditions: conditionsFor(combatant.status)
  });
}

/* ------------------------------------------------------------------ */
/* H3: the turn-order strip                                            */
/* ------------------------------------------------------------------ */

/**
 * THE TURN-ORDER STRIP (H3; the owner's Q3c, Q10a): every fighter in the
 * ENGINE's initiative order, each in his side's colour, the one whose turn it
 * is marked, the fallen marked too.
 *
 * ► **THE ORDER IS THE ENGINE'S, NEVER RE-DERIVED HERE.** `wire.initiative`
 *   is the battle's own list — `rules.initiativeOrder` at construction
 *   (`ss2InitiativeOrder`: the build's `changeCombatants` alternates the
 *   sides, it does not sort) — and `wire.turnCursor` is where the turn loop
 *   stands in it; `advanceTurn` walks it and skips the fallen. So the strip
 *   is that list as it stands, and whose turn it is, is
 *   `initiative[turnCursor]` — nobody's once the bout is decided.
 *
 * @param {object} wire `host.wire()`
 * @returns {{id: string, name: string, teamId: string, colour: string, current: boolean, alive: boolean}[]}
 */
export function turnOrderFor(wire) {
  const byId = new Map((wire?.teams ?? []).flatMap((team) => team.combatants.map((combatant) => [combatant.id, { combatant, teamId: team.id }])));
  const cursor = wire?.result ? -1 : wire?.turnCursor;
  return Object.freeze((wire?.initiative ?? []).flatMap((id, index) => {
    const found = byId.get(id);
    if (!found) return [];
    const style = teamStyleFor(found.combatant.teamId ?? found.teamId);
    return [Object.freeze({
      id,
      name: found.combatant.name,
      teamId: style.teamId,
      colour: style.colour,
      current: index === cursor,
      alive: found.combatant.alive !== false
    })];
  }));
}
