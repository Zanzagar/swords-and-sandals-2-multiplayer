/**
 * `aiPlaysToCrowd` — the AI that values the purse.
 *
 * OWNER'S DECISION 2026-09-23 (HANDOFF.md living head): *"The AI weighs the
 * crowd's purse gain against the turn it spends, so it plays to the crowd when
 * it is safely out of range and ahead. No build roll is invented; it is authored
 * AI behaviour, tunable, measured over seeded bouts."* Rejected: a 5% band
 * emulating the build's villain (a new AI random sample), and never.
 *
 * WHAT IS THE BUILD'S: the verb, its `round(charisma / 2)` crowd delta
 * (`+0x4fdb`, the ACTOR's by the owner's decision (f)), the 1..100 clamp
 * (`nextphase` `+0x3541`-`+0x35a3`), and the purse the crowd scales,
 * `round(share * (100 + crowd) / 100)` (`sprite:2249/frame:88` `+0x078c`).
 * WHAT IS THIS ENGINE'S, and invented: the whole valuation — see `SS2_AI_CROWD`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, legalActions, rngJournal, suggestAction
} from "../src/team/index.js";
import {
  SS2_ARENA, SS2_FACING_LEFT, Ss2ActionType, createSs2TeamRules, ss2Combatant, ss2CrowdPleaserValue,
  ss2SideHitpointShare, ss2TeamRules
} from "../src/team/ss2-rules.js";

const WINCROWD = Ss2ActionType.WINCROWD;

const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 5, character_level: 5, weapon: 1, ...o
});

function face(battle, id, left) {
  const combatant = combatantById(battle, id);
  combatant.status = combatant.status.filter((token) => token !== SS2_FACING_LEFT);
  if (left) combatant.status.push(SS2_FACING_LEFT);
}

/**
 * Hero at 0 facing right, foe `gap` away facing left, both AI, the hero to act.
 * Both 170 max health (`herolevel 5 * 10 + vitality 6 * 20`), so `foeHealth`
 * alone decides who is ahead.
 */
function staged({ hero = {}, foe = {}, gap = 500, foeHealth, heroHealth, rules = ss2TeamRules } = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rules,
    teams: [
      { id: "red", combatants: [ss2Combatant(fields({ speed: 21, ...hero }), { id: "hero", name: "hero", controller: "ai" })] },
      { id: "blue", combatants: [ss2Combatant(fields({ speed: 19, ...foe }), { id: "foe", name: "foe", controller: "ai" })] }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: 0, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: gap, y: 200 });
  if (foeHealth !== undefined) combatantById(battle, "foe").health = foeHealth;
  if (heroHealth !== undefined) combatantById(battle, "hero").health = heroHealth;
  face(battle, "hero", false);
  face(battle, "foe", true);
  return battle;
}

const picks = (battle) => suggestAction(battle, "hero").type;
const ATTACKS = new Set([Ss2ActionType.QUICK_ATTACK, Ss2ActionType.NORMAL_ATTACK, Ss2ActionType.POWER_ATTACK]);

/* ------------------------------------------------------------------ *
 * The behaviour the owner chose                                       *
 * ------------------------------------------------------------------ */

test("safely out of range and well ahead, a charismatic AI plays to the crowd — and draws nothing to decide it", () => {
  // Hero 170/170, foe 50/170: the hero's side holds 170 / 220 = 77% of the living hitpoints.
  // 500 apart, both reaching 130: nobody can strike anybody this round.
  // charisma 16 moves the crowd round(16 / 2) = 8, from the opening 5 + 5 = 10 to 18.
  const battle = staged({ hero: { charisma: 16 }, foeHealth: 50 });
  const draws = rngJournal(battle).length;
  assert.equal(picks(battle), WINCROWD);
  assert.equal(rngJournal(battle).length, draws, "the valuation takes no sample");
});

test("NOT AHEAD, it closes: two equal sides are at exactly half the hitpoints, so the opening approach never plays to the crowd", () => {
  // The same charismatic hero, both at 170/170: share 0.5.
  assert.equal(picks(staged({ hero: { charisma: 16 } })), Ss2ActionType.WALK_RIGHT);
  // Behind (hero 50/170, foe full): share 50 / 220. Wounded at range it TAUNTS — the
  // taunt's heal term, `ss2TauntValue`, unchanged — and never plays to the crowd.
  assert.equal(picks(staged({ hero: { charisma: 16 }, heroHealth: 50 })), Ss2ActionType.TAUNT);
});

test("NOT SAFE, it closes: a foe that can strike this round — a longer reach, or a drawn bow — keeps it honest", () => {
  // strength 30: physical_size 80 + round(30 / 1.5) = 100, reach 100 + 44 = 144, against
  // the hero's 86 + 44 = 130. At 140 the hero cannot reach the foe and the foe CAN reach the hero.
  const longer = staged({ hero: { charisma: 16 }, foe: { strength: 30 }, foeHealth: 50, gap: 140 });
  assert.ok(!legalActions(longer, "hero").some((option) => ATTACKS.has(option.type)), "the hero is out of its own reach");
  assert.notEqual(picks(longer), WINCROWD);
  // The same foe 150 away is out of ITS reach too: safe again, and the hero plays to the crowd.
  assert.equal(picks(staged({ hero: { charisma: 16 }, foe: { strength: 30 }, foeHealth: 50, gap: 150 })), WINCROWD);
  // A drawn bow reaches everything beyond its floor — even from ANOTHER RANK, where no melee
  // reach counts (`ss2SameLane`). Staged so that ONLY the bow can refuse: the archer is heading
  // for the hero's partner (200 away, against ~800), so `ss2NoFoeWalksPast` has nothing to say,
  // and the lob is offered against the hero, so the threat is real.
  const archer = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      {
        id: "red",
        combatants: [
          ss2Combatant(fields({ speed: 30, charisma: 16 }), { id: "hero", name: "hero", controller: "ai" }),
          ss2Combatant(fields({ speed: 25 }), { id: "mate", name: "mate", controller: "ai" })
        ]
      },
      {
        id: "blue",
        combatants: [ss2Combatant(
          fields({ speed: 10, secondary_weapon: 61, equipped_weapon: 2, using_bow: true, ammo_left: 5 }),
          { id: "foe", name: "foe", controller: "ai" }
        )]
      }
    ]
  });
  for (const [id, x, y] of [["hero", 0, SS2_ARENA.frontY - SS2_ARENA.rankStride], ["mate", 600, SS2_ARENA.frontY], ["foe", 800, SS2_ARENA.frontY]]) {
    Object.assign(combatantById(archer, id), { x, y });
    face(archer, id, id === "foe");
  }
  combatantById(archer, "foe").health = 50;
  assert.ok(legalActions(archer, "foe").some((option) =>
    option.type === Ss2ActionType.BOMBARD && option.targetId === "hero"), "the archer can shoot the hero");
  assert.notEqual(picks(archer), WINCROWD);
  // Put the bow away and the same foe cannot touch the hero this round: it poses.
  combatantById(archer, "foe").resources.equipped_weapon.value = 1;
  assert.equal(picks(archer), WINCROWD);
  // A foe CARRYING a damage spell (34, the lightning bolt — no range test) can hit from anywhere.
  const caster = staged({ hero: { charisma: 16 }, foe: { inventory1: 34 }, foeHealth: 50 });
  assert.ok(legalActions(caster, "foe").some((option) => option.type === Ss2ActionType.CAST_LIGHTNING_BOLT));
  assert.notEqual(picks(caster), WINCROWD);
  // A READY psyche charge discharges out to reach + 50 (`ss2PsycheDischargeInRange`): at 150 the
  // foe's swing (130) cannot reach the hero, and its charge can.
  assert.notEqual(picks(staged({ hero: { charisma: 16 }, foe: { psyche_up: 3 }, foeHealth: 50, gap: 150 })), WINCROWD);
  assert.equal(picks(staged({ hero: { charisma: 16 }, foe: { psyche_up: 2 }, foeHealth: 50, gap: 150 })), WINCROWD,
    "a charge not yet ready is no threat this round");
});

/**
 * One hero against two foes placed where the test says, all AI, acting hero -> `a` -> `b`
 * (speeds 30 / 20 / 10). Hero 170/170 against two 40s: 170 / 250 = 0.68, ahead.
 */
function trio({ a = {}, b = {}, ax, bx, rules = ss2TeamRules }) {
  const battle = createTeamBattle({
    seed: 3,
    rules,
    teams: [
      { id: "red", combatants: [ss2Combatant(fields({ speed: 30 }), { id: "hero", name: "hero", controller: "ai" })] },
      {
        id: "blue",
        combatants: [
          ss2Combatant(fields({ speed: 20, ...a }), { id: "a", name: "a", controller: "ai" }),
          ss2Combatant(fields({ speed: 10, ...b }), { id: "b", name: "b", controller: "ai" })
        ]
      }
    ]
  });
  for (const [id, x, health] of [["hero", 0, 170], ["a", ax, 40], ["b", bx, 40]]) {
    Object.assign(combatantById(battle, id), { x, y: 200, health });
    face(battle, id, x > 0);
  }
  return battle;
}

test("REGRESSION (Codex, 2026-09-23): a foe holding COMMAND can pull the poser into a second foe's reach, so it is not safe", () => {
  // Reproduced before the fix: the hero posed, `a` cast command and pulled it to 440, and `b`
  // at 480 took quick-attack against it — a legal strike before the hero's next turn.
  const risky = () => trio({ a: { inventory1: 39 }, ax: 500, bx: 480 });
  assert.notEqual(picks(risky()), WINCROWD);
  // The threat is real: pose anyway, and the sequence plays out.
  const battle = risky();
  applyAction(battle, { actorId: "hero", type: WINCROWD, targetId: "hero" });
  const pull = suggestAction(battle, "a");
  assert.equal(pull.type, Ss2ActionType.CAST_COMMAND);
  applyAction(battle, { ...pull, actorId: "a" });
  assert.ok(legalActions(battle, "b").some((option) => ATTACKS.has(option.type) && option.targetId === "hero"),
    `pulled to ${combatantById(battle, "hero").x}, the hero is in b's reach`);
  // Without the item the same two foes are no threat this round, and the hero plays to the crowd.
  assert.equal(picks(trio({ ax: 500, bx: 480 })), WINCROWD);
  // And a LONE caster is no risk: a pull spends its only turn, and the next swing is the hero's.
  assert.equal(picks(staged({ hero: { charisma: 16 }, foe: { inventory1: 39 }, foeHealth: 50 })), WINCROWD);
});

test("GALE and the TAUNT'S SHOVE move the poser too: a push that lands it in another foe's reach is a risk", () => {
  // Gale: possession, any distance, a flat 1000 — refused whenever a second foe could exploit it.
  assert.notEqual(picks(trio({ a: { inventory1: 38 }, ax: 500, bx: 480 })), WINCROWD);
  // The taunt's effect 2 shoves a melee target charisma * 25 (+0x69d4): `a` at 400 with charisma 6
  // pushes the hero 150 either way, and `b` at -250 is then 100 away, inside its 130.
  const shoved = trio({ ax: 400, bx: -250 });
  assert.notEqual(picks(shoved), WINCROWD);
  // With `b` at -300 the landing is 150 away, outside its reach: safe, and it poses.
  assert.equal(picks(trio({ ax: 400, bx: -300 })), WINCROWD);
});

test("REGRESSION (Codex, second pass): SUCCESSIVE shoves by different foes are chained, each landing feeding the next", () => {
  // Seed 8, one lane, charisma 6 everywhere: hero at 0 (170), foes a 600, b 800, c -400 (20 each),
  // acting hero -> a -> b -> c. Either taunt ALONE pushes the hero 150, to -150, still 250 from c;
  // the two together push it to -300, 100 from c — inside c's 130. Reproduced before the fix: the
  // hero posed, a and b's legal effect-2 taunts moved it to -150 then -300, and c struck it.
  const quartet = () => {
    const battle = createTeamBattle({
      seed: 8,
      rules: ss2TeamRules,
      teams: [
        { id: "red", combatants: [ss2Combatant(fields({ speed: 40 }), { id: "hero", name: "hero", controller: "ai" })] },
        {
          id: "blue",
          combatants: [
            ss2Combatant(fields({ speed: 30 }), { id: "a", name: "a", controller: "ai" }),
            ss2Combatant(fields({ speed: 20 }), { id: "b", name: "b", controller: "ai" }),
            ss2Combatant(fields({ speed: 10 }), { id: "c", name: "c", controller: "ai" })
          ]
        }
      ]
    });
    for (const [id, x, health] of [["hero", 0, 170], ["a", 600, 20], ["b", 800, 20], ["c", -400, 20]]) {
      Object.assign(combatantById(battle, id), { x, y: 200, health });
      face(battle, id, id !== "hero" && x > 0);
    }
    return battle;
  };
  assert.notEqual(picks(quartet()), WINCROWD);
  // The threat is real: pose anyway, let a and b taunt, and c has the hero in reach.
  const battle = quartet();
  applyAction(battle, { actorId: "hero", type: WINCROWD, targetId: "hero" });
  for (const id of ["a", "b"]) applyAction(battle, { actorId: id, type: Ss2ActionType.TAUNT, targetId: "hero" });
  assert.equal(combatantById(battle, "hero").x, -300, "two effect-2 shoves of 150");
  assert.ok(legalActions(battle, "c").some((option) => ATTACKS.has(option.type) && option.targetId === "hero"));
  // One pusher fewer (b gone), and a single 150 cannot reach c: the hero poses.
  const pair = quartet();
  combatantById(pair, "b").alive = false;
  combatantById(pair, "b").health = 0;
  assert.equal(picks(pair), WINCROWD);
  // A shover spends its turn shoving: `a` at 250 can push the hero to 150, inside its OWN 130,
  // but it cannot then swing. `b` at 900 has charisma 0, so its shove is the 20-unit minimum
  // and cannot bring the hero into `a`'s reach either (at 170 or 230 from it) — so the hero poses.
  // (With `b` at charisma 6, b's 150 toward `a` WOULD land the hero in a's reach, and it refuses:
  // both directions are tried, since facing is re-derived before each shover acts.)
  assert.equal(picks(trio({ ax: 250, bx: 900, b: { charisma: 0 } })), WINCROWD);
  assert.notEqual(picks(trio({ ax: 250, bx: 900 })), WINCROWD);
});

test("NO FOE WALKS PAST A POSER: a foe coming for it from ANOTHER RANK could, so it does not pose (the owner's crossings)", () => {
  // Across ranks no body blocks a walk (`ss2BodyBlocks`), so a foe heading for a poser in the
  // next rank can walk straight past it — the crossing the owner saw on screen. Measured on the
  // demo roster before this gate: 2v2 crossings 34 -> 1,220 turns of 96 bouts; with it, 34.
  const FRONT = SS2_ARENA.frontY;
  const BACK = SS2_ARENA.frontY - SS2_ARENA.rankStride;
  const ranked = (foeY) => {
    const battle = staged({ hero: { charisma: 16 }, foeHealth: 50 });
    combatantById(battle, "hero").y = BACK;
    combatantById(battle, "foe").y = foeY;
    return battle;
  };
  // The foe's only enemy is the hero, one rank over: it is coming for the hero and can pass it.
  assert.notEqual(picks(ranked(FRONT)), WINCROWD);
  // In the hero's own rank it would be stopped by the hero's body and fight it: pose.
  assert.equal(picks(ranked(BACK)), WINCROWD);
});

test("...but a foe coming for SOMEBODY ELSE from another rank does not stop the pose", () => {
  // Hero in the back rank at 0, its partner in the front at 400, the foe in the front at 600:
  // the foe's nearest enemy is the partner (200 against ~608), so it walks at the partner.
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      {
        id: "red",
        combatants: [
          ss2Combatant(fields({ speed: 30, charisma: 16 }), { id: "hero", name: "hero", controller: "ai" }),
          ss2Combatant(fields({ speed: 25 }), { id: "mate", name: "mate", controller: "ai" })
        ]
      },
      { id: "blue", combatants: [ss2Combatant(fields({ speed: 10 }), { id: "foe", name: "foe", controller: "ai" })] }
    ]
  });
  for (const [id, x, y] of [["hero", 0, SS2_ARENA.frontY - SS2_ARENA.rankStride], ["mate", 400, SS2_ARENA.frontY], ["foe", 600, SS2_ARENA.frontY]]) {
    Object.assign(combatantById(battle, id), { x, y });
    face(battle, id, id === "foe");
  }
  combatantById(battle, "foe").health = 50;
  assert.equal(picks(battle), WINCROWD);
});

test("IN RANGE, it fights: however far ahead, a gladiator with a swing on offer never plays to the crowd", () => {
  const chosen = picks(staged({ hero: { charisma: 16 }, foeHealth: 20, gap: 100 }));
  assert.ok(ATTACKS.has(chosen), chosen);
});

test("A CROWD AT 100 HAS NOTHING TO GIVE: the clamp leaves no gain, so the turn goes to the approach", () => {
  const battle = staged({ hero: { charisma: 16 }, foeHealth: 50 });
  battle.battleResources.crowd_interest.value = 100;
  assert.equal(picks(battle), Ss2ActionType.WALK_RIGHT);
  // At 95 there are 5 points left of the 8, and that is still worth the turn.
  battle.battleResources.crowd_interest.value = 95;
  assert.equal(picks(battle), WINCROWD);
});

test("AFFORDABLE: at 3 stamina or less the spend alone would floor it and cost the next turn too, so it closes", () => {
  const tired = staged({ hero: { charisma: 16 }, foeHealth: 50 });
  combatantById(tired, "hero").resources.staminaleft.value = 3;
  assert.equal(picks(tired), Ss2ActionType.WALK_RIGHT);
  combatantById(tired, "hero").resources.staminaleft.value = 4;
  assert.equal(picks(tired), WINCROWD);
});

test("CHARISMA DECIDES WHO BOTHERS: a crowd point at full confidence is worth one swing, so a delta of 1 never clears it", () => {
  // charisma 2 moves the crowd round(2 / 2) = 1. Even with the foe at 1 hitpoint (share
  // 170 / 171) that is 1 * 0.994 < 1 swing: the approach wins.
  assert.equal(picks(staged({ hero: { charisma: 2 }, foeHealth: 1 })), Ss2ActionType.WALK_RIGHT);
  // charisma 6 moves it 3, which clears at any share over 1/3 — so the AHEAD gate binds:
  // foe 113 is 170 / 283 = 0.6007, ahead; foe 114 is 170 / 284 = 0.5986, not.
  assert.equal(picks(staged({ foeHealth: 113 })), WINCROWD);
  assert.equal(picks(staged({ foeHealth: 114 })), Ss2ActionType.WALK_RIGHT);
});

test("THE TAUNT IS A RIVAL TOO: a wounded gladiator whose taunt heals more than the crowd pays takes the taunt", () => {
  // Hero 130/170 with stamina 30 — a taunt heals 3 + 30 = 33 of the 40 missing — and
  // charisma 16, foe at 30: share 130 / 160. With the crowd at 98 only 2 points are left, worth
  // 100 * 2 / 100 * 0.8125 = 1.625 swings; the taunt is worth more, and it is taken.
  const wounded = staged({ hero: { charisma: 16, stamina: 30 }, heroHealth: 130, foeHealth: 30 });
  wounded.battleResources.crowd_interest.value = 98;
  assert.equal(picks(wounded), Ss2ActionType.TAUNT);
  // The same gladiator with all 8 points to gain (6.5 swings) plays to the crowd.
  wounded.battleResources.crowd_interest.value = 10;
  assert.equal(picks(wounded), WINCROWD);
});

test("...AND THE RIVAL IS THE TAUNT AT THE FOE IN ITS OWN RANK, not at a nearer one a rank over it may not taunt", () => {
  // RED before 2026-09-23's fix: the rival was priced at the NEAREST foe, and
  // a foe a rank over is never offered a taunt (the owner's own-rank rule), so
  // with the nearest foe in another rank the rival read 0 and the pose won
  // against a taunt worth more. The wounded hero above, now in the back rank:
  // `near` is a rank over and nearer, walking at `mate` (200 against ~608, so
  // it walks past nobody); `rival` is in the hero's rank, far off. Crowd at 98,
  // so the pose is worth the same 2 points as above and the taunt at `rival`
  // — heal 33 of the 40 missing — outprices it.
  const BACK = SS2_ARENA.frontY - SS2_ARENA.rankStride;
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      {
        id: "red",
        combatants: [
          ss2Combatant(fields({ speed: 30, charisma: 16, stamina: 30 }), { id: "hero", name: "hero", controller: "ai" }),
          ss2Combatant(fields({ speed: 25 }), { id: "mate", name: "mate", controller: "ai" })
        ]
      },
      {
        id: "blue",
        combatants: [
          ss2Combatant(fields({ speed: 10 }), { id: "near", name: "near", controller: "ai" }),
          ss2Combatant(fields({ speed: 9 }), { id: "rival", name: "rival", controller: "ai" })
        ]
      }
    ]
  });
  for (const [id, x, y] of [["hero", 0, BACK], ["mate", 400, SS2_ARENA.frontY], ["near", 600, SS2_ARENA.frontY], ["rival", 1500, BACK]]) {
    Object.assign(combatantById(battle, id), { x, y });
    face(battle, id, id === "near" || id === "rival");
  }
  combatantById(battle, "hero").health = 130;
  combatantById(battle, "near").health = 30;
  combatantById(battle, "rival").health = 30;
  battle.battleResources.crowd_interest.value = 98;

  const offered = legalActions(battle, "hero");
  assert.deepEqual(
    offered.filter((option) => option.type === Ss2ActionType.TAUNT).map((option) => option.targetId),
    ["rival"],
    "the staging must offer the taunt at `rival` alone"
  );
  assert.ok(offered.some((option) => option.type === WINCROWD), "and the pose");
  const chosen = suggestAction(battle, "hero");
  assert.deepEqual({ type: chosen.type, targetId: chosen.targetId }, { type: Ss2ActionType.TAUNT, targetId: "rival" });

  // With all 8 points to gain the pose outprices that taunt, so the gates did pass.
  battle.battleResources.crowd_interest.value = 10;
  assert.equal(picks(battle), WINCROWD);
});

test("ADULATION STAYS THE LADDER'S: arm 28 casts it on possession beyond 300 before the valuation is read", () => {
  const battle = staged({ hero: { charisma: 16, inventory1: 47 }, foeHealth: 50 });
  assert.equal(picks(battle), Ss2ActionType.CAST_ADULATION);
});

/* ------------------------------------------------------------------ *
 * The valuation, as numbers                                           *
 * ------------------------------------------------------------------ */

test("the valuation is purse-in-swings x best swing x gain / 100 x share, and the clamp decides the gain", () => {
  const coefficients = { purseInSwings: 50, aheadShare: 0.6 };
  const view = (crowd) => ({
    battleResources: crowd === null ? {} : { crowd_interest: { value: crowd, min: null, max: null } },
    actor: { id: "a", health: 150 },
    allies: [{ id: "a", health: 150 }],
    foes: [{ id: "b", health: 50 }]
  });
  // share 150 / 200 = 0.75; 50 * 10 * 8 / 100 * 0.75 = 30.
  assert.equal(ss2CrowdPleaserValue(view(10), 8, 10, coefficients), 30);
  // At 96 the ceiling leaves 4 of the 8: half.
  assert.equal(ss2CrowdPleaserValue(view(96), 8, 10, coefficients), 15);
  assert.equal(ss2CrowdPleaserValue(view(100), 8, 10, coefficients), 0);
  // A battle that declares no crowd pays no purse on it.
  assert.equal(ss2CrowdPleaserValue(view(null), 8, 10, coefficients), 0);
  // The shipped coefficients: 100 * 10 * 0.08 * 0.75 = 60.
  assert.equal(ss2CrowdPleaserValue(view(10), 8, 10), 60);
});

test("the side's share counts LIVING hitpoints on both sides, the actor included once", () => {
  const actor = { id: "a", health: 150 };
  assert.equal(ss2SideHitpointShare({ actor, allies: [actor, { id: "c", health: 30 }], foes: [{ id: "b", health: 60 }] }), 0.75);
  // A view whose allies leave the actor out still counts it.
  assert.equal(ss2SideHitpointShare({ actor, allies: [{ id: "c", health: 30 }], foes: [{ id: "b", health: 60 }] }), 0.75);
  // Two equal sides: exactly half.
  assert.equal(ss2SideHitpointShare({ actor, allies: [actor], foes: [{ id: "b", health: 150 }] }), 0.5);
});

/* ------------------------------------------------------------------ *
 * The dial                                                            *
 * ------------------------------------------------------------------ */

test("`aiPlaysToCrowd: false` restores the old choice exactly, and SAYS SO IN THE ID; on is the shipped default", () => {
  const off = createSs2TeamRules({ aiPlaysToCrowd: false });
  assert.equal(off.id, "ss2-map-derived-tournament-no-crowd-play");
  assert.equal(createSs2TeamRules().id, "ss2-map-derived-tournament", "the default keeps the id every pin was taken against");
  assert.equal(createSs2TeamRules({ aiPlaysToCrowd: true }).id, ss2TeamRules.id);
  // The state the first test plays to the crowd in.
  assert.equal(picks(staged({ hero: { charisma: 16 }, foeHealth: 50, rules: off })), Ss2ActionType.WALK_RIGHT);
  assert.equal(picks(staged({ hero: { charisma: 16 }, foeHealth: 50 })), WINCROWD);
});
