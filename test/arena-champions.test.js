/**
 * THE ARENA'S CHAMPIONS: `?red=2,4,16&blue=1,3,10` builds each side from the
 * build's own `unleash_hell` DNA, out of the player's extracted pack
 * (`tools/extract-champions.mjs` -> gitignored `assets/champions/`).
 *
 * Three seams, each the arena's own: `championRequestFrom` (the query
 * string), `championSide` (one side, from a pack), and the host those sides
 * go into (`createVanillaBattleHost`, exactly as `tools/arena/main.js` builds
 * it).
 *
 * ► **EVERY CHAMPION HERE IS SYNTHETIC.** The pack below is invented — names,
 *   quotes and DNA — and has the shape the extractor writes. The repository
 *   ships no champion of the build's. Weapon ids are table rows the
 *   repository already carries (`src/team/ss2-weapon-table.js`), and every
 *   expected number is worked from `battlevalues`' formulas at the assertion,
 *   never read back out of the engine. (One test at the foot, added
 *   2026-09-24, READS the player's own pack when there is one and stores
 *   nothing of it; it names champions by `which_boss` number only.)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { resolveRequestPath } from "../tools/arena-server.mjs";
import { parseArguments } from "../tools/extract-champions.mjs";

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { citationFor } from "../src/adapter/vanilla-fields.js";
import { combatantById } from "../src/team/index.js";
import {
  ss2ActiveDamagePair, ss2BattleValues, ss2Combatant, ss2InBowMode, ss2Reach, ss2TeamRules
} from "../src/team/ss2-rules.js";
import { CHAMPION_PACK_URL, arenaRequestFrom, championRequestFrom, championSide } from "../tools/arena/roster.js";
import { colourTransformForLook, featuresForSkin } from "../src/render/appearance.js";

/* ───────────────────────────  a synthetic pack  ──────────────────────────── */

/** `initcharacter`'s indices for the fields these champions vary. */
const AT = Object.freeze({
  skincolor: 1, haircolor: 2, features: 3, hairstyle: 4, facehair: 5,
  weapon: 13, shield: 14, strength: 16, speed: 17, attack: 18, defence: 19, vitality: 20, charisma: 21,
  stamina: 22, magicka: 23, herolevel: 24, inventory1: 34, maxslots: 40, secondary: 45, ammo: 48, equipped: 49
});

/**
 * Fifty split fields, as the extractor writes them: strings. One armour point
 * per piece, weapon 2, no shield, bare secondary slot (id 0), sword drawn.
 */
function dna(name, overrides = {}) {
  const fields = Array.from({ length: 50 }, () => "0");
  fields[0] = name;
  fields[28] = "nobody";
  for (let index = 6; index <= 12; index += 1) fields[index] = "1";
  const base = {
    weapon: 2, shield: 0, strength: 6, speed: 8, attack: 7, defence: 6, vitality: 5, charisma: 6,
    stamina: 6, magicka: 0, herolevel: 10, maxslots: 2, secondary: 0, ammo: 5, equipped: 1
  };
  for (const [field, value] of Object.entries({ ...base, ...overrides })) fields[AT[field]] = String(value);
  for (let slot = 0; slot < 6; slot += 1) fields[AT.inventory1 + slot] = "1";
  return fields;
}

const PACK = Object.freeze({
  champions: [
    { whichBoss: 0, dnaFrom: "literal", dna: dna("Lesser Oaf"), name: "Lesser Oaf", quote: "Invented." },
    // Bow drawn from the first turn — the owner's NORMALISED case.
    { whichBoss: 2, dnaFrom: "literal", dna: dna("Quiver Cousin", { secondary: 64, equipped: 2 }), name: "Quiver Cousin" },
    { whichBoss: 5, dnaFrom: "literal", dna: dna("Iron Aunt", { vitality: 20, herolevel: 20 }), name: "Iron Aunt" },
    // A ranged row in the PRIMARY slot, which `ss2Combatant` refuses whatever the route.
    { whichBoss: 6, dnaFrom: "literal", dna: dna("Wrong Hands", { weapon: 64 }), name: "Wrong Hands" },
    // The branch that copies the hero: no DNA of its own.
    { whichBoss: 17, dnaFrom: "_global.heroDNA", dna: null, name: null },
    // A literal the extractor could not split into fifty fields.
    { whichBoss: 18, dnaFrom: "literal", dna: null, name: "Comma, Esq." }
  ]
});

const deps = (extra = {}) => ({ ss2Combatant, ss2BattleValues, pack: PACK, admitResource: citationFor, ...extra });
const query = (text) => new URLSearchParams(text);

/* ──────────────────────────────  the query string  ───────────────────────── */

test("no red= and no blue= is today's arena, untouched", () => {
  assert.equal(championRequestFrom(query("")), null);
  assert.equal(championRequestFrom(query("teams=3&seed=4&items=buffs&spectate=1")), null);
});

test("red= and blue= are which_boss lists, one to three a side, in order, repeats allowed", () => {
  assert.deepEqual(championRequestFrom(query("red=2,4,16&blue=1,3,10&spectate=1")), { red: [2, 4, 16], blue: [1, 3, 10] });
  assert.deepEqual(championRequestFrom(query("red=5&blue=0,0")), { red: [5], blue: [0, 0] });
  assert.deepEqual(championRequestFrom(query("red= 2 , 4&blue=16")), { red: [2, 4], blue: [16] });
});

test("a malformed champion request is refused loudly, by the parameter at fault", () => {
  const refusals = [
    ["red=2,4", /blue=/],
    ["blue=2", /red=/],
    ["red=&blue=1", /red=/],
    ["red=1,,2&blue=1", /red=1,,2/],
    ["red=1,2,3,4&blue=1", /at most 3/],
    ["red=two&blue=1", /"two"/],
    ["red=1.5&blue=1", /"1\.5"/],
    ["red=-1&blue=1", /"-1"/],
    // A kit is the demo roster's; a champion carries its own inventory.
    ["red=1&blue=2&items=buffs", /items=/]
  ];
  for (const [text, message] of refusals) {
    assert.throws(() => championRequestFrom(query(text)), message, text);
  }
});

/**
 * ► **THE SHELL PARSED `items=` BEFORE IT LOOKED FOR CHAMPIONS, AT MODULE
 *   INITIALISATION** — found by a Codex review, reproduced before it was
 *   fixed. `?red=1&blue=2&items=typo` threw from `demoItemsFrom` at the top
 *   level of `main.js`, so the champion refusal of `items=` never ran and the
 *   page sat on "loading…" with the reason in a console nobody watching opens.
 *   A malformed kit with no champions did the same. `arenaRequestFrom` is now
 *   the ONE reader of the roster parameters, champions first, and the shell
 *   calls it where a refusal reaches the page.
 */
test("the roster request reads champions FIRST, so a bad kit beside them gets the champion refusal", () => {
  assert.throws(() => arenaRequestFrom(query("red=1&blue=2&items=typo")), /items=typo gives the DEMO roster a kit/);
  assert.throws(() => arenaRequestFrom(query("items=typo")), /"typo" is neither a kit/);
  assert.deepEqual(arenaRequestFrom(query("red=1&blue=2&spectate=1")), { kind: "champions", red: [1], blue: [2] });
  assert.deepEqual(arenaRequestFrom(query("items=43&teams=3")), { kind: "demo", items: [43] });
  assert.deepEqual(arenaRequestFrom(query("")), { kind: "demo", items: [] });
});

test("the shell reads the roster request only where a refusal reaches the page", () => {
  // `main.js` cannot be imported by node (absolute URL imports, `document`), so
  // its call site is read as TEXT, as `test/render-arena-shell.test.js` does.
  const shell = fs.readFileSync(fileURLToPath(new URL("../tools/arena/main.js", import.meta.url)), "utf8");
  assert.equal(shell.split("demoItemsFrom(").length - 1, 0, "the kit is parsed by arenaRequestFrom, never at module init");
  assert.equal(shell.split("championRequestFrom(").length - 1, 0, "and so is the champion request");
  assert.equal(shell.split("arenaRequestFrom(").length - 1, 1, "one call site");
  assert.match(
    shell,
    /try \{\s*request = arenaRequestFrom\(params\);\s*\} catch \(error\) \{\s*refuseToStart\(/,
    "and it is inside a try whose catch puts the refusal on the page"
  );
});

/* ─────────────────────────────  one side, from a pack  ───────────────────── */

test("a champion is its DNA priced by battlevalues, entered as the build's own route", () => {
  const side = championSide("red", [0, 5], deps());
  assert.equal(side.id, "red");
  assert.deepEqual(side.members.map((member) => member.id), ["red-1", "red-2"]);
  assert.deepEqual(side.members.map((member) => member.whichBoss), [0, 5]);

  const [oaf, aunt] = side.members;
  assert.equal(oaf.vanilla.character_name, "Lesser Oaf", "the name comes from the player's pack");
  assert.equal(oaf.controller, "local", "a seat the spectator (and a person) can drive, like the demo roster's");
  assert.deepEqual(oaf.clip, { gladiator_dir: "right" });
  // strength 6: physical_size 80 + round(6 / 1.5) = 84 (+0x30f1).
  // weapon 2 is [min 4, max 16, range 1]: min/max round(6 * 2) + 4/16 = 16/28, reach 84 + 1 * 44 = 128.
  assert.equal(oaf.vanilla.physical_size, 84);
  assert.equal(oaf.resources.min_damage, 16);
  assert.equal(oaf.resources.max_damage, 28);
  assert.equal(oaf.resources.weapon_range, 128);
  // hitpointsmax = herolevel * 10 + vitality * 20: 10*10 + 5*20 = 200; 20*10 + 20*20 = 600.
  assert.equal(oaf.vanilla.hitpointsmax, 200);
  assert.equal(oaf.vanilla.hitpoints, 200, "a fresh champion enters at full health");
  assert.equal(aunt.vanilla.hitpointsmax, 600);
  // initcharacter's level raise: herolevel 10 -> 2 slots, 20 -> 4.
  assert.equal(oaf.resources.inventory_maxslots, 2);
  assert.equal(aunt.resources.inventory_maxslots, 4);
  // The mirror and the bag come from ONE derivation, so they cannot disagree.
  for (const field of ["min_damage", "max_damage", "weapon_range", "armourclass", "staminamax"]) {
    assert.equal(oaf.vanilla[field], oaf.resources[field], field);
  }
  assert.deepEqual(championSide("blue", [0], deps()).members[0].clip, { gladiator_dir: "left" });
});

/**
 * ► **THE DNA'S 0 NOW ENTERS AS STATED (2026-09-23).** Until the engine fix
 *   `731ef20` (`legalActions` asks `secondary_weapon !== 0` as well as the
 *   reach), `championSide` DELETED a stated 0 so the engine would not read row
 *   0's reach as a bow. That TEMPORARY workaround is gone; this test is what
 *   says the engine, not the roster, now keeps the phantom bow off the menu.
 *   `test/ss2-champion-dna.test.js` and `test/ss2-ranged.test.js` pin the
 *   engine side.
 */
test("a secondary slot of 0 is NO secondary weapon, as both of the build's readers test it", () => {
  // The hero's swap button hides on `secondary_weapon == 0` (sprite 862
  // `+0x0e77`-`+0x0e89`) and the villain's voluntary swap requires
  // `secondary_weapon != 0` (`+0x0f14`-`+0x0f27`).
  const red = championSide("red", [0], deps());
  const [oaf] = red.members;
  assert.equal(oaf.vanilla.secondary_weapon, 0, "the DNA's own id, index 45");
  assert.equal(oaf.resources.secondary_weapon, 0, "and the engine is told it");
  // `battlevalues` prices the slot unguarded (`+0x32aa`), so 0 reads weapon
  // ROW 0 — `[type 2, weight 5, 1-3, range multiplier 1]` — and the reach is
  // physical_size 84 + 1 * 44 = 128, faithfully. The id, not the reach, says "no bow".
  assert.equal(oaf.resources.secondary_weapon_range, 128);
  const host = createVanillaBattleHost({
    teams: [red, championSide("blue", [5], deps())],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed: 3
  });
  // Equal speeds, so blue-1 opens on the id tie-break; let it act, then ask red-1.
  host.submit({ ...host.suggestAction("blue-1"), actorId: "blue-1" });
  assert.equal(host.currentCombatantId(), "red-1");
  const offered = host.legalActions("red-1").map((option) => option.type);
  assert.ok(offered.length > 0, "red-1 has a turn to take");
  assert.equal(offered.includes("swap-weapons"), false, `no phantom bow: ${offered.join(", ")}`);
});

test("a champion whose DNA draws the bow enters as a proper archer (owner, 2026-09-23)", () => {
  const red = championSide("red", [2], deps());
  const [cousin] = red.members;
  assert.equal(cousin.resources.equipped_weapon, 2, "the engine's single bow flag, straight from index 49");
  assert.equal("using_bow" in cousin.vanilla, false, "nothing writes the build's second flag");
  // The melee numbers stay the sword's, for the swap back: 16-28, reach 128.
  assert.equal(cousin.resources.min_damage, 16);
  assert.equal(cousin.resources.weapon_range, 128);
  // weapon 64 is [min 7, max 49, range 100]: the bow pair is round(6 * 1) + 7/49 = 13/55
  // (+0x33b6, +0x33e6) and its reach 84 + 100 * 44 = 4484 (+0x32aa).
  assert.equal(cousin.resources.secondary_weapon_range, 4484);
  const host = createVanillaBattleHost({
    teams: [red, championSide("blue", [0], deps())],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed: 3
  });
  const inBattle = combatantById(host.battle, "red-1");
  assert.equal(ss2InBowMode(inBattle), true, "an archer from the first turn");
  assert.deepEqual(ss2ActiveDamagePair(inBattle), { min_damage: 13, max_damage: 55 });
  assert.equal(ss2Reach(inBattle), 4484);
});

/**
 * ► **A CHAMPION'S LOOK IS ITS OWN DNA's, AND IT IS NOT IN THE BATTLE
 *   (2026-09-24).** Indices 1-5, with the drawn `features` derived from the
 *   skin as `initcolour` derives it — this invented champion's DNA says
 *   features 23, and skin 11 draws 13. The look rides BESIDE `vanilla` and
 *   `resources`, and a bout played with it and without it is the same bout,
 *   hash for hash.
 */
test("a champion's LOOK comes from its own DNA, derived as the build derives it, and never enters the battle", () => {
  const painted = dna("Painted Uncle", { skincolor: 11, haircolor: 21, features: 23, hairstyle: 16, facehair: 16 });
  const pack = { champions: [...PACK.champions, { whichBoss: 4, dnaFrom: "literal", dna: painted, name: "Painted Uncle" }] };
  const red = championSide("red", [4, 0], deps({ pack }));
  const [uncle, oaf] = red.members;
  assert.deepEqual({ ...uncle.appearance }, { skincolor: 11, haircolor: 21, hairstyle: 16, facehairstyle: 16, features: 13 });
  // The synthetic DNA's zeros: skin 0 has no branch, so the DNA's own 0 stands.
  assert.deepEqual({ ...oaf.appearance }, { skincolor: 0, haircolor: 0, hairstyle: 0, facehairstyle: 0, features: 0 });
  for (const field of ["skincolor", "haircolor", "hairstyle", "facehairstyle", "features"]) {
    assert.equal(field in uncle.vanilla, false, `${field} is not on the vanilla mirror`);
    assert.equal(field in uncle.resources, false, `${field} is not a resource`);
  }

  const play = (sides) => {
    const host = createVanillaBattleHost({ teams: sides, rules: ss2TeamRules, bindings: SS2_STATIC_MAP_BINDINGS, seed: 5 });
    const hashes = [host.hash()];
    for (let turn = 0; turn < 40 && !host.battle.result; turn += 1) {
      host.submit({ actorId: host.currentCombatantId(), ...host.suggestAction() });
      hashes.push(host.hash());
    }
    return hashes;
  };
  const blue = championSide("blue", [5], deps());
  const withoutLook = (side) => ({ ...side, members: side.members.map(({ appearance, ...member }) => member) });
  const played = play([red, blue]);
  assert.ok(played.length > 2, "the bout actually runs");
  assert.deepEqual(play([withoutLook(red), withoutLook(blue)]), played, "the look moves no hash");
});

test("a champion that cannot be built, or cannot enter the host, is refused by its which_boss", () => {
  const refusals = [
    [[3], /which_boss 3 is not in the pack \(it has 0, 2, 5, 6, 17, 18\)/],
    [[17], /which_boss 17 has no DNA of its own: unleash_hell writes _global\.heroDNA/],
    [[18], /which_boss 18.*could not be decoded/],
    [[6], /which_boss 6.*ranged band/],
    [[0, 0, 0, 0], /at most 3/],
    [[], /at least one/]
  ];
  for (const [list, message] of refusals) {
    assert.throws(() => championSide("red", list, deps()), message, JSON.stringify(list));
  }
  // The host refuses a resource no battle-map section cites; the side says WHICH champion first.
  assert.throws(
    () => championSide("blue", [5], deps({ admitResource: (name) => name !== "inventory_maxslots" })),
    /which_boss 5 \(Iron Aunt\) cannot enter the arena host: .*inventory_maxslots/
  );
  assert.throws(() => championSide("red", [0], deps({ pack: null })), /run node tools\/extract-champions\.mjs/);
  assert.throws(() => championSide("red", [0], deps({ pack: { champions: "no" } })), /run node tools\/extract-champions\.mjs/);
});

test("the arena server serves the pack from the gitignored assets/, where the extractor writes it", () => {
  const repo = fileURLToPath(new URL("..", import.meta.url));
  assert.equal(resolveRequestPath(CHAMPION_PACK_URL), path.join(repo, "assets", "champions", "champions.json"));
  assert.match(parseArguments([]).out, /assets[\\/]champions$/);
});

/* ──────────────────────────────  into the host  ──────────────────────────── */

test("a 3v3 of champions constructs in the arena's host and plays 60 AI actions", () => {
  const host = createVanillaBattleHost({
    teams: [championSide("red", [0, 2, 5], deps()), championSide("blue", [5, 2, 0], deps())],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed: 11,
    awaitAnimations: false
  });
  const taken = {};
  let actions = 0;
  let bareSwapOffers = 0;
  while (!host.battle.result && actions < 60) {
    const actorId = host.currentCombatantId();
    const options = host.legalActions(actorId);
    // red-1 and blue-3 are which_boss 0, whose secondary slot is 0: never a swap.
    if ((actorId === "red-1" || actorId === "blue-3") && options.some((option) => option.type === "swap-weapons")) {
      bareSwapOffers += 1;
    }
    const action = host.suggestAction(actorId);
    host.submit({ ...action, actorId });
    taken[action.type] = (taken[action.type] ?? 0) + 1;
    actions += 1;
  }
  assert.equal(actions, 60, `the bout ran 60 actions (${JSON.stringify(taken)})`);
  assert.equal(bareSwapOffers, 0, "a bare secondary slot is never offered as a bow");
  assert.equal(host.battle.teams.flatMap((team) => team.combatants).length, 6);
});

/* ─────────────────────  the player's own pack, when present  ─────────────── */

/**
 * ► **THE ONE TEST HERE THAT READS THE PLAYER'S OWN `champions.json`**, and it
 *   stores nothing from it: no DNA, name or value is written in this file, and
 *   every message names a `which_boss` number only. On a clone it returns
 *   silently, as the real-pack checks in `test/render-extracted-figure.test.js`
 *   do. What it measures is that every buildable champion's LOOK decodes to
 *   colour indices `begincolouring` has a branch for (so no champion reaches
 *   the stale-transform case the renderer cannot draw), and that the derived
 *   features differ from the DNA's own index 3 for exactly three of them —
 *   the 2026-09-24 wave's finding, re-measured.
 */
const REAL_CHAMPIONS = (() => {
  const at = fileURLToPath(new URL("../assets/champions/champions.json", import.meta.url));
  return fs.existsSync(at) ? JSON.parse(fs.readFileSync(at, "utf8")) : null;
})();

test("REAL PACK: every buildable champion's look decodes, every colour it uses has a branch, and three wear derived features", () => {
  if (!REAL_CHAMPIONS) return;
  const literal = REAL_CHAMPIONS.champions.filter((champion) => Array.isArray(champion?.dna));
  assert.ok(literal.length > 0, "the pack holds champions with DNA of their own");
  let derivedDiffers = 0;
  for (const champion of literal) {
    const label = `which_boss ${champion.whichBoss}`;
    const [member] = championSide("red", [champion.whichBoss], deps({ pack: REAL_CHAMPIONS })).members;
    const look = member.appearance;
    assert.ok(colourTransformForLook(look.skincolor), `${label}: its skin index has a branch`);
    assert.ok(colourTransformForLook(look.haircolor), `${label}: its hair index has a branch`);
    assert.equal(look.features, featuresForSkin(look.skincolor), `${label}: features are the skin's`);
    if (look.features !== Number(champion.dna[3])) derivedDiffers += 1;
  }
  assert.equal(derivedDiffers, 3, "three champions' DNA states a features value the build never draws");
});
