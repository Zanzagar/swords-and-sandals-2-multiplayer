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

import { applyAction, combatantById, createTeamBattle, legalActions } from "../src/team/resolver.js";
import { SS2_FACING_LEFT, SS2_STATUS_FLAGS, createSs2TeamRules, ss2Combatant, ss2StatusToken } from "../src/team/ss2-rules.js";
import { SS2_CLOSE_UP } from "../src/render/arena-backdrop.js";
import { seatControllersFrom } from "../tools/arena/seats.js";
import {
  CROWD_MOODS, NAME_PLATE_OUTLINE, conditionsFor, crowdMeterFor, namePlateFor, namePlateLayout, teamHudFor, teamStyleFor, turnOrderFor
} from "../tools/arena/team-hud.js";
import { SS2_CROWD_MOODS, crowdBarDriveFor } from "../src/render/crowd-bar.js";

/* ------------------------------------------------------------------ */
/* H1: the team colours                                                */
/* ------------------------------------------------------------------ */

// ~~Each side also had an INITIAL ("R", "B") — "a cue that is not colour alone" —
// drawn on a disc beside every name, with a coloured underline on the stage~~
// until the owner, 2026-09-24: "the team names dont need the R and B icons next
// to them and underlined. Colors suffice." (D1 of the in-frame team HUD.)
test("H1: red is #e0584f and blue #4c8fe0 (the owner's Q4) — and the colour is the side's only cue: no initial (D1)", () => {
  assert.deepEqual(
    { ...teamStyleFor("red") },
    { teamId: "red", colour: "#e0584f", name: "Red" }
  );
  assert.deepEqual(
    { ...teamStyleFor("blue") },
    { teamId: "blue", colour: "#4c8fe0", name: "Blue" }
  );
});

test("H1: a side the arena has no colour for is drawn in the page's dim ink, never a crash", () => {
  assert.deepEqual({ ...teamStyleFor("green") }, { teamId: "green", colour: "#9a9287", name: "green" });
  assert.deepEqual({ ...teamStyleFor(null) }, { teamId: null, colour: "#9a9287", name: "?" });
});

test("H1: a name plate is his name in his side's colour over a dark outline, and nothing else (D1); the dead are faint", () => {
  const living = namePlateFor({ id: "red-1", name: "Tarn", teamId: "red", alive: true });
  // Opaque while he stands (~~0.85, the light plate's~~ until the Codex review of H1: see below).
  assert.deepEqual({ ...living }, { fill: "#e0584f", outline: NAME_PLATE_OUTLINE, alpha: 1 });
  const dead = namePlateFor({ id: "blue-2", name: "Nym", teamId: "blue", alive: false });
  assert.deepEqual({ ...dead }, { fill: "#4c8fe0", outline: NAME_PLATE_OUTLINE, alpha: 0.4 }, "the alpha the plate always had for the fallen");
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
  // A turn-strip chip names its side by its name's colour alone (D1), so it is on --ground too —
  // and the chip whose turn it is keeps it: its mark is an outline, never a fill the names were not measured on.
  assert.match(page, /\n\s*\.turn-chip \{[^}]*background: var\(--ground\)/, "a strip chip is drawn on --ground");
  const current = /\n\s*\.turn-chip\.current \{([^}]*)\}/.exec(page);
  assert.ok(current, "index.html has a .turn-chip.current rule");
  assert.doesNotMatch(current[1], /background/, "the current chip is not refilled");
});

test("H1: the plate is the name's own outline and nothing else (D1) — and it stays inside what the ring reads as the name", () => {
  // The ring's rank arrows stand off `below: nameY + namePx * 0.5` (renderStage; pinned in
  // test/arena-ring-movement.test.js). Under the baseline the plate now inks only a descender and
  // half of the name's outline; the camera budgets the descender at `namePlateFont.descent` of the
  // font, so the two together must stay above that line. The shell's font is never under 10 px.
  const { descent } = SS2_CLOSE_UP.namePlateFont;
  // Worked by hand: 0.24 of the font, never under 2 px.
  for (const [px, width] of [[10, 2.4], [15, 3.6], [22.5, 5.4], [40, 9.6]]) {
    const plate = namePlateLayout({ px });
    assert.deepEqual(Object.keys(plate), ["outlineWidth"], `px ${px}: no underline, no disc — nothing but the outline`);
    assert.ok(Math.abs(plate.outlineWidth - width) < 1e-9, `px ${px}: an outline ${plate.outlineWidth} px wide, not ${width}`);
    assert.ok(plate.outlineWidth / 2 + px * descent <= px * 0.5, `px ${px}: a descender and half the outline reach ${plate.outlineWidth / 2 + px * descent} under the baseline, past ${px * 0.5}`);
  }
  assert.equal(namePlateLayout({ px: 5 }).outlineWidth, 2, "never thinner than 2 px");
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

/* ------------------------------------------------------------------ */
/* H2: the crowd meter                                                 */
/* ------------------------------------------------------------------ */

test("H2: the crowd meter says the build's own mood — crowd_interest_array[ceil(interest / 10)] — and draws the bar at the interest", () => {
  // The array, in the build's order: `sprite:751[combat_panel]` `crowd_bar` clip-action 0, `+0x01c7`
  // (eleven operands pushed last-first for `new Array`, so index 0 is the "" pushed last) — and the
  // label `"crowd: " + crowd_interest_array[Math.ceil(crowd_interest / 10)]`, clip-action 1 `+0x01fa`-`+0x0232`.
  const moods = [
    [1, "bored to tears"], [10, "bored to tears"], [11, "bored silly"], [20, "bored silly"], [21, "restless"],
    [35, "indifferent"], [41, "interested"], [55, "entertained"], [60, "entertained"], [61, "enthusiastic"], [70, "enthusiastic"],
    [71, "wildly entertained"], [81, "Tranfixed"], [90, "Tranfixed"], [91, "Fanatical"], [100, "Fanatical"]
  ];
  for (const [interest, mood] of moods) {
    const meter = crowdMeterFor(interest);
    assert.equal(meter.mood, mood, `${interest}`);
    assert.equal(meter.text, `crowd: ${mood}`, `${interest}: the build's own label`);
    assert.equal(meter.value, interest);
    assert.equal(meter.percent, interest, `${interest}: the bar's _xscale is round(crowd_interest)`);
    assert.equal(meter.shown, true);
  }
  assert.equal(crowdMeterFor(54.6).percent, 55, "rounded, as _xscale is");
  // The two lines the build's cheers and boos wait on (clip-action 1: > 70 at +0x014a, < 20 at +0x01a8).
  assert.deepEqual([crowdMeterFor(19).band, crowdMeterFor(20).band, crowdMeterFor(70).band, crowdMeterFor(71).band],
    ["boo", null, null, "cheer"]);
  assert.equal(crowdMeterFor(50).booBelow, 20);
  assert.equal(crowdMeterFor(50).cheerAbove, 70);
});

test("H2: an opening above 100 (six high-level fighters) keeps the top mood and a full bar — authored; the build would print 'undefined'", () => {
  const meter = crowdMeterFor(124);
  assert.equal(meter.value, 124, "the number is the engine's, unclamped");
  assert.equal(meter.mood, "Fanatical");
  assert.equal(meter.percent, 100);
});

test("D8: ONE TABLE OF MOODS — the side panel's meter and the crowd bar in the frame say the same words for every crowd", () => {
  // Two hand-cited copies of the build's eleven moods could drift apart silently; the meter's IS the renderer's,
  // which the extractor re-derives from the bytes (`test/extract-icons.test.js`, "THE CROWD'S DRIVE, FROM THE BYTES").
  assert.equal(CROWD_MOODS, SS2_CROWD_MOODS);
  for (const crowd of [-15, 0, 0.4, 1, 10, 11, 50, 54.6, 99, 100, 100.3, 101, 124, 250]) {
    const meter = crowdMeterFor(crowd);
    const bar = crowdBarDriveFor(crowd);
    assert.deepEqual([meter.mood, meter.text, meter.percent], [bar.mood, bar.text, bar.xscale], `${crowd}`);
  }
});

test("H2: no crowd — a rule set with none, or a bout where every fighter is level 1, whose crowd the build hides — is no meter", () => {
  assert.equal(crowdMeterFor(null).shown, false);
  assert.equal(crowdMeterFor(undefined).shown, false);
  assert.equal(crowdMeterFor(40, { shown: false }).shown, false, "the build hides crowd_bar while hero.herolevel is 1");
});

/* ------------------------------------------------------------------ */
/* H2: the condition chips                                             */
/* ------------------------------------------------------------------ */

test("H2: a condition chip is in plain words — the build's own splat word for each — and never a raw token", () => {
  // The four conditions' words are the bonus splat's (sprite 151) frames 4-7, the ones a tick shows
  // over the sufferer: BURNING, FROZEN, WRAITH (life stolen), POISONED. Taunted has no splat: authored.
  const words = (status) => conditionsFor(status).map((chip) => chip.words);
  assert.deepEqual(words(["facing-left"]), [], "a facing is not a condition");
  assert.deepEqual(words([]), []);
  assert.deepEqual(words(["burning:from=blue-1", "facing-left"]), ["Burning"], "the source is not shown");
  assert.deepEqual(
    words(["taunted1:from=red-3", "life_stolen:from=red-2", "poison:from=red-1", "burning", "frozen:from=red-1"]),
    ["Frozen", "Burning", "Poisoned", "Wraith", "Taunted"],
    "in the engine's own order, whatever order he gained them in"
  );
  assert.deepEqual(words(["taunted1", "taunted2"]), ["Taunted"], "two flags, one condition");
  assert.deepEqual(words(["burning:from=blue-1", "burning:from=blue-2"]), ["Burning"], "one chip per condition");
  assert.deepEqual(words(["something-new"]), [], "an unknown token is not shown raw");
  for (const chip of conditionsFor(["frozen", "burning", "poison", "life_stolen", "taunted1"])) {
    assert.ok(chip.title.length > chip.words.length, `${chip.words} says what it does`);
  }
});

test("H2: every status token the engine can carry is either a condition with words or deliberately not one", () => {
  for (const flag of SS2_STATUS_FLAGS) {
    assert.equal(conditionsFor([flag]).length, 1, `${flag} has a chip`);
    assert.equal(conditionsFor([ss2StatusToken(flag, "someone")]).length, 1, `${flag} with a source has a chip`);
  }
  assert.equal(conditionsFor([SS2_FACING_LEFT]).length, 0, "the facing is the only status that is not a condition");
});

/* ------------------------------------------------------------------ */
/* H2: the team panels                                                 */
/* ------------------------------------------------------------------ */

/** A wire combatant, as `toTeamWireState` projects one (resources as `{value, min, max}`). */
function fighter(id, teamId, slotIndex, { health = 60, maxHealth = 60, alive = true, status = [], resources = {} } = {}) {
  const bag = Object.fromEntries(Object.entries(resources).map(([name, value]) => [name, { value, min: 0, max: null }]));
  return { id, name: id.toUpperCase(), teamId, slotIndex, health, maxHealth, alive, status, resources: bag };
}

/** A wire state: blue listed FIRST, and each side's fighters out of slot order. */
function wireOf({ result = null, turnCursor = 0, crowd = 42 } = {}) {
  return {
    battleResources: { crowd_interest: { value: crowd, min: 0, max: null } },
    teams: [
      { id: "blue", combatants: [fighter("blue-2", "blue", 1), fighter("blue-1", "blue", 0)] },
      {
        id: "red",
        combatants: [
          fighter("red-2", "red", 1, { health: 0, alive: false }),
          fighter("red-1", "red", 0, {
            health: 45,
            status: ["facing-left", "burning:from=blue-1"],
            resources: { staminaleft: 80, staminamax: 140, armourclass: 0, armourclass_max: 38 }
          })
        ]
      }
    ],
    initiative: ["red-1", "blue-1", "red-2", "blue-2"],
    turnCursor,
    result
  };
}

test("H2: two panels, red then blue, a row per fighter in slot order — whatever order the wire lists them in", () => {
  const hud = teamHudFor({ wire: wireOf() });
  assert.deepEqual(hud.teams.map((team) => [team.teamId, team.name, team.colour]),
    [["red", "Red", "#e0584f"], ["blue", "Blue", "#4c8fe0"]]);
  assert.deepEqual(hud.teams.map((team) => team.rows.map((row) => row.id)), [["red-1", "red-2"], ["blue-1", "blue-2"]]);
  assert.deepEqual(hud.teams.map((team) => team.standing), [1, 2], "how many of each side still stand");
  assert.deepEqual(hud.teams[0].rows.map((row) => [row.name, row.colour]), [["RED-1", "#e0584f"], ["RED-2", "#e0584f"]]);
});

test("D1: nothing in the HUD model carries an initial or an underline — the side's colour is its only cue, everywhere", () => {
  const keysOf = (value, into = new Set()) => {
    if (value && typeof value === "object") {
      for (const [key, inner] of Object.entries(value)) { into.add(key); keysOf(inner, into); }
    }
    return into;
  };
  const wire = wireOf({ turnCursor: 1 });
  const models = {
    teamHudFor: teamHudFor({ wire }),
    turnOrderFor: turnOrderFor(wire),
    teamStyleFor: ["red", "blue", "green", null].map(teamStyleFor),
    namePlateFor: [namePlateFor({ teamId: "red", alive: true }), namePlateFor({ teamId: "blue", alive: false })],
    namePlateLayout: namePlateLayout({ px: 15 })
  };
  for (const [name, model] of Object.entries(models)) {
    const keys = keysOf(model);
    assert.ok(keys.size > 0, `${name} was read`);
    for (const gone of ["initial", "underline", "line", "lineOutline", "disc"]) {
      assert.ok(!keys.has(gone), `${name} still carries "${gone}", which nothing draws`);
    }
  }
  // The walk reaches the rows and the strip's entries, where the initial used to be.
  assert.ok(keysOf(models.teamHudFor).has("colour") && keysOf(models.teamHudFor).has("current"));
});

test("H2: a row's three readings are the build's — health, energy (stamina) and armour, value / max and the bar's rounded percent", () => {
  const [red1, red2] = teamHudFor({ wire: wireOf() }).teams[0].rows;
  // Worked by hand: 45 / 60 = 75%; 80 / 140 = 57.1 -> 57; armour 0 of 38 — the build hides its gauge at 0.
  assert.deepEqual({ ...red1.health }, { value: 45, max: 60, percent: 75, shown: true });
  assert.deepEqual({ ...red1.energy }, { value: 80, max: 140, percent: 57, shown: true });
  assert.deepEqual({ ...red1.armour }, { value: 0, max: 38, percent: 0, shown: false });
  assert.equal(red1.alive, true);
  assert.deepEqual(red1.conditions.map((chip) => chip.words), ["Burning"], "never 'facing-left'");
  // The fallen: 0 of 60, dimmed by the shell; no stamina or armour declared at all: nothing to show.
  assert.deepEqual({ ...red2.health }, { value: 0, max: 60, percent: 0, shown: true });
  assert.equal(red2.alive, false);
  assert.equal(red2.energy.shown, false);
  assert.equal(red2.armour.shown, false);
});

test("H2: armour's maximum falls back to armourclass when none is declared, as vanillaRecordOf does; a bar never leaves 0-100", () => {
  const wire = wireOf();
  wire.teams[0].combatants[0] = fighter("blue-2", "blue", 1, { health: 70, maxHealth: 60, resources: { armourclass: 12, staminaleft: 5, staminamax: 0 } });
  const blue2 = teamHudFor({ wire }).teams[1].rows[1];
  assert.deepEqual({ ...blue2.armour }, { value: 12, max: 12, percent: 100, shown: true });
  assert.equal(blue2.health.percent, 100, "117% is drawn full");
  assert.equal(blue2.energy.percent, 0, "a zero maximum is an empty bar, not a division by zero");
});

test("H2: the turn highlight is the engine's own — initiative[turnCursor] — and nobody's once the bout is decided", () => {
  const rowsActing = (hud) => hud.teams.flatMap((team) => team.rows.filter((row) => row.acting).map((row) => row.id));
  assert.equal(teamHudFor({ wire: wireOf({ turnCursor: 1 }) }).actingId, "blue-1");
  assert.deepEqual(rowsActing(teamHudFor({ wire: wireOf({ turnCursor: 1 }) })), ["blue-1"]);
  assert.deepEqual(rowsActing(teamHudFor({ wire: wireOf({ turnCursor: 3 }) })), ["blue-2"]);
  const decided = teamHudFor({ wire: wireOf({ turnCursor: 1, result: { winnerTeamId: "blue" } }) });
  assert.equal(decided.actingId, null);
  assert.deepEqual(rowsActing(decided), []);
});

test("H2: 'you' on every seat a person plays in a play= bout, 'AI' on the rest; no tag with no seats or when spectating", () => {
  const roster = [{ id: "red", members: [{ id: "red-1" }, { id: "red-2" }] }, { id: "blue", members: [{ id: "blue-1" }, { id: "blue-2" }] }];
  const tags = (query) => teamHudFor({ wire: wireOf(), seats: seatControllersFrom(new URLSearchParams(query), roster) })
    .teams.flatMap((team) => team.rows.map((row) => `${row.id}:${row.seat}:${row.you}`));
  assert.deepEqual(tags("play=red-1,blue-2"), ["red-1:you:true", "red-2:AI:false", "blue-1:AI:false", "blue-2:you:true"]);
  assert.deepEqual(tags("spectate=1"), ["red-1:null:false", "red-2:null:false", "blue-1:null:false", "blue-2:null:false"]);
  assert.deepEqual(tags(""), ["red-1:null:false", "red-2:null:false", "blue-1:null:false", "blue-2:null:false"]);
});

test("H2: the crowd meter in the model is the battle's own crowd_interest, hidden when the crowd is not heard", () => {
  assert.equal(teamHudFor({ wire: wireOf({ crowd: 73 }) }).crowd.text, "crowd: wildly entertained");
  assert.equal(teamHudFor({ wire: wireOf({ crowd: 73 }) }).crowd.value, 73);
  assert.equal(teamHudFor({ wire: wireOf({ crowd: 73 }), crowdShown: false }).crowd.shown, false);
  const none = wireOf();
  delete none.battleResources;
  assert.equal(teamHudFor({ wire: none }).crowd.shown, false, "a rule set with no crowd has no meter");
});

test("H2 (Codex review of H2, pass 2): a chip's words never promise a turn the engine can discard — a forced rest clears every condition unplayed", () => {
  // The engine's side, measured: at zero stamina the only offer is the forced rest, and it clears the
  // condition without its damage or its flee (`statusConsumptionEffects` over `SS2_CHAIN_CLEAR_FLAGS`).
  const gladiator = (overrides) => ({
    strength: 5, speed: 5, attack: 5, defence: 5, vitality: 8, stamina: 4, magicka: 0, charisma: 3,
    herolevel: 3, character_level: 3, weapon_min_damage: 3, weapon_max_damage: 6, ...overrides
  });
  for (const flag of ["burning", "taunted1"]) {
    const battle = createTeamBattle({
      seed: 5,
      rules: createSs2TeamRules(),
      teams: [
        { id: "red", combatants: [ss2Combatant(gladiator({ speed: 9 }), { id: "hero", name: "Hero", x: -30 })] },
        { id: "blue", combatants: [ss2Combatant(gladiator({ weapon_enchantment_type: 2, weapon_enchantment_potency: 3, weapon_max_damage: 9 }), { id: "villain", name: "Villain", x: 30 })] }
      ]
    });
    const hero = combatantById(battle, "hero");
    hero.resources.staminaleft.value = 0;
    hero.status = [...hero.status, ss2StatusToken(flag, "villain")];
    const offer = legalActions(battle);
    assert.deepEqual(offer.map((action) => action.type), ["rest"], `${flag}: an exhausted fighter is forced to rest`);
    const before = { health: hero.health, x: hero.x };
    applyAction(battle, { actorId: "hero", ...offer[0] });
    const after = combatantById(battle, "hero");
    assert.deepEqual(after.status, [], `${flag}: cleared by the rest`);
    assert.deepEqual({ health: after.health, x: after.x }, before, `${flag}: neither hurt nor fled`);
    // The chip's side: its description says what happens WHEN it plays, and that it can be lost this way.
    const [chip] = conditionsFor([ss2StatusToken(flag, "villain")]);
    assert.match(chip.title, /\bwhen it plays\b/, `${chip.words}: "${chip.title}"`);
    assert.match(chip.title, /forced rest/, `${chip.words}: "${chip.title}"`);
    assert.match(chip.title, /weapon swap/, `${chip.words}: the forced swap clears it too`);
    assert.doesNotMatch(chip.title, /next turn/, `${chip.words}: it does not promise the turn`);
  }
});

test("H2 (Codex review of H2, pass 3): nor damage the engine may not deal — a condition whose inflictor has fallen plays and hurts nobody", () => {
  const gladiator = (overrides) => ({
    strength: 5, speed: 5, attack: 5, defence: 5, vitality: 8, stamina: 4, magicka: 0, charisma: 3,
    herolevel: 3, character_level: 3, weapon_min_damage: 3, weapon_max_damage: 6, ...overrides
  });
  const battle = createTeamBattle({
    seed: 5,
    rules: createSs2TeamRules(),
    teams: [
      { id: "red", combatants: [ss2Combatant(gladiator({ speed: 9 }), { id: "hero", name: "Hero", x: -30 })] },
      {
        id: "blue",
        combatants: [
          ss2Combatant(gladiator({ weapon_enchantment_type: 2, weapon_enchantment_potency: 3, weapon_max_damage: 9 }), { id: "villain", name: "Villain", x: 30 }),
          ss2Combatant(gladiator({}), { id: "other", name: "Other", x: 60 })
        ]
      }
    ]
  });
  const villain = combatantById(battle, "villain");
  villain.alive = false;
  villain.health = 0;
  const hero = combatantById(battle, "hero");
  hero.status = [...hero.status, ss2StatusToken("burning", "villain")];
  const offer = legalActions(battle);
  assert.deepEqual(offer.map((action) => action.type), ["burning-phase"], "the condition still plays");
  const before = hero.health;
  applyAction(battle, { actorId: "hero", ...offer[0] });
  assert.equal(combatantById(battle, "hero").health, before, "and hurts nobody");
  for (const flag of ["frozen", "burning", "poison", "life_stolen"]) {
    const [chip] = conditionsFor([flag]);
    assert.match(chip.title, /none once that fighter has fallen/, `${chip.words}: "${chip.title}"`);
  }
});

/* ------------------------------------------------------------------ */
/* H3: the turn-order strip                                            */
/* ------------------------------------------------------------------ */

test("H3: the strip is the engine's own initiative, in its order, each in his side's colour; whose turn it is marked, the fallen too", () => {
  // `wireOf`'s initiative is red-1, blue-1, red-2, blue-2 — NOT the panels' order — and red-2 has fallen.
  const entries = (order) => order.map((entry) => [entry.id, entry.name, entry.colour, entry.current, entry.alive]);
  assert.deepEqual(entries(turnOrderFor(wireOf({ turnCursor: 1 }))), [
    ["red-1", "RED-1", "#e0584f", false, true],
    ["blue-1", "BLUE-1", "#4c8fe0", true, true],
    ["red-2", "RED-2", "#e0584f", false, false],
    ["blue-2", "BLUE-2", "#4c8fe0", false, true]
  ]);
  assert.deepEqual(turnOrderFor(wireOf({ turnCursor: 3 })).map((entry) => entry.current), [false, false, false, true]);
  assert.deepEqual(turnOrderFor(wireOf({ turnCursor: 1, result: { winnerTeamId: "blue" } })).map((entry) => entry.current),
    [false, false, false, false], "nobody's turn once the bout is decided");
  // The same strip is in the whole HUD model, so the panels and the strip are read from one wire.
  assert.deepEqual(teamHudFor({ wire: wireOf({ turnCursor: 1 }) }).turnOrder, turnOrderFor(wireOf({ turnCursor: 1 })));
});
