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
import { seatControllersFrom } from "../tools/arena/seats.js";
import { NAME_PLATE_OUTLINE, conditionsFor, crowdMeterFor, namePlateFor, namePlateLayout, teamHudFor, teamStyleFor } from "../tools/arena/team-hud.js";

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
  assert.deepEqual(hud.teams.map((team) => [team.teamId, team.name, team.colour, team.initial]),
    [["red", "Red", "#e0584f", "R"], ["blue", "Blue", "#4c8fe0", "B"]]);
  assert.deepEqual(hud.teams.map((team) => team.rows.map((row) => row.id)), [["red-1", "red-2"], ["blue-1", "blue-2"]]);
  assert.deepEqual(hud.teams.map((team) => team.standing), [1, 2], "how many of each side still stand");
  assert.deepEqual(hud.teams[0].rows.map((row) => [row.name, row.colour, row.initial]), [["RED-1", "#e0584f", "R"], ["RED-2", "#e0584f", "R"]]);
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
