/**
 * `taunt` — the last deferred vanilla action, and the sample budget that
 * deferred it.
 *
 * WHY THIS FILE EXISTS: the reason `taunt` stayed unbuilt for a month was
 * exact and was still true when it was built. `resolveSs2PhysicalAttackCandidate`
 * implements direction 20's profile and NOTHING BEFORE IT, so resolving a taunt
 * through the ordinary attack path would take the dispatcher's samples on every
 * press — where the build takes them on one outcome in four. An engine that got
 * that wrong would agree with a peer on every number and desynchronise the tape.
 *
 * WHAT IS THE BUILD'S AND WHAT IS THIS ENGINE'S:
 *
 * - **The build's, every one byte-cited at its assertion**: the two draws and
 *   their order (`+0x6921`, `+0x6952`), the DIRECT comparison against
 *   `taunt_percentage` (`+0x694b`), the `taunt_effect == 1` dispatch to
 *   direction 20 (`+0x6981`), the weapon-mode split (`+0x69a7`), the
 *   `charisma * 25` force and its floor of 20 (`+0x69d4`-`+0x6a7b`), the
 *   knockback ANIMATION gate at 100 (`+0x6a21`) against the unconditional
 *   displacement (`+0x6ab1`), `taunted1` and the psyche reset (`+0x6ad9`,
 *   `+0x6ac8`), the stamina cost `round(charisma * 2)` (`+0x67bb`), the
 *   `+= stamina` (`+0x6894`) and the `3 + ceil(stamina)` heal (`+0x684c`), and
 *   which controller frames wire the button.
 * - **This engine's**: nothing. Every number here is the build's, which is
 *   unusual for an action in this file and is why it could be built at all.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, legalActions, rngJournal, toTeamWireState
} from "../src/team/index.js";
import {
  SS2_FACING_LEFT, SS2_TAUNT, Ss2ActionType, createSs2TeamRules, ss2Combatant
} from "../src/team/ss2-rules.js";
import { LabelProvenance, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";

const gladiator = (overrides = {}) => ss2Combatant({
  strength: 9, speed: 40, attack: 9, defence: 5, vitality: 60, stamina: 12,
  magicka: 0, charisma: 9, herolevel: 9, character_level: 9, weapon: 1, ...overrides
});

function duel({ seed = 2, hero = {}, villain = {} } = {}) {
  return createTeamBattle({
    rules: createSs2TeamRules(), seed,
    teams: [
      { id: "red", combatants: [{ id: "hero", ...gladiator(hero) }] },
      { id: "blue", combatants: [{ id: "villain", ...gladiator(villain) }] }
    ]
  });
}

/** Give the hero the turn, then taunt, and hand back the event and the draws. */
function taunt(battle) {
  for (let guard = 0; guard < 8 && currentCombatant(battle)?.id !== "hero"; guard += 1) {
    const who = currentCombatant(battle);
    const legal = legalActions(battle);
    applyAction(battle, { actorId: who.id, ...(legal.find((o) => o.type === Ss2ActionType.REST) ?? legal[0]) });
  }
  assert.equal(currentCombatant(battle)?.id, "hero", "the turn cursor must have reached the hero");
  const option = legalActions(battle).find((o) => o.type === Ss2ActionType.TAUNT);
  assert.ok(option, "the taunt must be on offer or the test measures nothing");
  const before = rngJournal(battle).length;
  applyAction(battle, { actorId: "hero", ...option });
  const drew = rngJournal(battle).slice(before);
  return { event: battle.events.filter((e) => e.type === Ss2ActionType.TAUNT).pop(), drew };
}

/* ------------------------------------------------------------------ *
 * THE SAMPLE BUDGET — the reason this action was deferred
 * ------------------------------------------------------------------ */

test("THE SAMPLE BUDGET IS ONE DRAW, TWO, OR THE DISPATCHER'S — never the same each time", () => {
  // ► **THE ASSERTION THE WHOLE DEFERRAL WAS ABOUT.** The build draws
  //   `diceroll` always (`+0x6921`), `taunt_effect` only on success
  //   (`+0x6952`), and the dispatcher's own samples only when that comes up 1.
  //   An implementation that routed every taunt through the attack path would
  //   take the dispatcher's draws four times in four — agreeing on every
  //   number and desynchronising every peer replaying the same tape.
  const seen = new Map();
  for (let seed = 1; seed <= 40; seed += 1) {
    for (const [heroCharisma, foeCharisma] of [[30, 1], [1, 30], [9, 9]]) {
      const battle = duel({ seed, hero: { charisma: heroCharisma }, villain: { charisma: foeCharisma } });
      let outcome;
      try {
        outcome = taunt(battle);
      } catch {
        continue;
      }
      const key = `${outcome.event.landed}:${outcome.event.effect ?? "-"}`;
      if (!seen.has(key)) seen.set(key, outcome);
    }
  }
  const labels = (outcome) => outcome.drew.map((entry) => entry.label);

  const failed = seen.get("false:-");
  assert.ok(failed, "a failed taunt must be reachable across 120 trials");
  assert.deepEqual(labels(failed), ["taunt-roll"], "a failed taunt takes ONE sample and no more");

  const shoved = seen.get("true:2");
  assert.ok(shoved, "effect 2 must be reachable");
  assert.deepEqual(labels(shoved), ["taunt-roll", "taunt-effect-roll"],
    "effect 2 takes the two pre-draws and never reaches the dispatcher");

  const struck = seen.get("true:1");
  assert.ok(struck, "effect 1 must be reachable");
  assert.deepEqual(labels(struck).slice(0, 2), ["taunt-roll", "taunt-effect-roll"],
    "and effect 1 takes them FIRST, in the build's order, before the dispatcher's");
  assert.ok(labels(struck).length > 2, "then the dispatcher's own");
  assert.ok(labels(struck).includes("hit-roll"), "which include the attack roll");
});

test("THE COMPARISON IS DIRECT, not the dispatcher's `100 - chance` form", () => {
  // ► **THE MAP FLAGS THIS AT THE SITE BECAUSE THE TWO ARE EASY TO CONFLATE**,
  //   and getting it backwards inverts the action: a charismatic gladiator
  //   would fail where a dull one succeeded. So the test is a POPULATION and
  //   not a single roll — one roll cannot tell the two rules apart.
  const landRate = (heroCharisma, foeCharisma) => {
    let landed = 0;
    let tried = 0;
    for (let seed = 1; seed <= 60; seed += 1) {
      const battle = duel({ seed, hero: { charisma: heroCharisma }, villain: { charisma: foeCharisma } });
      try {
        const { event } = taunt(battle);
        tried += 1;
        if (event.landed) landed += 1;
      } catch {
        continue;
      }
    }
    return tried === 0 ? null : landed / tried;
  };
  const charismatic = landRate(30, 1);
  const dull = landRate(1, 30);
  assert.ok(charismatic !== null && dull !== null, "both populations must be non-empty");
  assert.ok(charismatic > dull,
    `a charismatic taunter must land more often: ${charismatic} vs ${dull}`);
});

/* ------------------------------------------------------------------ *
 * THE THREE ARMS
 * ------------------------------------------------------------------ */

test("EFFECT 2 SPLITS ON THE DEFENDER'S WEAPON MODE, which the map had left open", () => {
  // ► **THE DISCRIMINATOR, derived 2026-09-17 at `+0x69a7`.** The map said "a
  //   charisma-scaled knockback OR sets `taunted1`" and named no condition for
  //   a year. It is `game_defender.equipped_weapon == 1`: melee is shoved,
  //   bow-mode is made to flee.
  const arms = new Map();
  for (const equipped of [1, 2]) {
    for (let seed = 1; seed <= 60 && !arms.has(equipped); seed += 1) {
      const battle = duel({ seed, hero: { charisma: 30 }, villain: { charisma: 1, ...(equipped === 2 ? { secondary_weapon: 61, equipped_weapon: 2 } : {}) } });
      try {
        const { event } = taunt(battle);
        if (event.landed && event.effect === 2) arms.set(equipped, event);
      } catch {
        continue;
      }
    }
  }
  const melee = arms.get(1);
  const bow = arms.get(2);
  assert.ok(melee, "a melee defender must reach effect 2 across 60 seeds");
  assert.ok(bow, "and so must a bow-mode one");

  assert.ok(Number.isFinite(melee.force), "a melee defender is SHOVED and the event carries the force");
  assert.equal(melee.flag, undefined, "and is not taunted");
  assert.equal(bow.flag, SS2_TAUNT.flag, "a bow-mode defender is made to FLEE");
  assert.equal(bow.force, undefined, "and is not shoved");
});

test("THE FORCE IS `charisma * 25` WITH A FLOOR, and the ANIMATION is gated where the shove is not", () => {
  // ► **THE DISPLACEMENT IS UNCONDITIONAL AND THE CLIP IS NOT** — the same
  //   shape `damagecharacter` has. `knockback(defender, force)` is called
  //   whenever this arm is entered (`+0x6ab1`); `gotoAndPlay("knockback")` only
  //   above 100 (`+0x6a21`/`+0x6a91`). A reader who gated the shove on the
  //   animation threshold would silently drop every small one.
  const shove = (charisma) => {
    for (let seed = 1; seed <= 80; seed += 1) {
      const battle = duel({ seed, hero: { charisma }, villain: { charisma: 1, equipped_weapon: 1 } });
      try {
        const { event } = taunt(battle);
        if (event.landed && event.effect === 2) return event;
      } catch {
        continue;
      }
    }
    return null;
  };
  const strong = shove(30);
  assert.ok(strong, "a strong taunter must reach the shove");
  assert.equal(Math.abs(strong.force), 30 * SS2_TAUNT.forceFactor, "charisma * 25");
  assert.equal(strong.knockbackAnimation, true, "and above 100 the clip plays");

  // The floor: a charisma of 0 would give 0, and the build clamps to 20.
  const feeble = shove(0);
  if (feeble) {
    assert.equal(Math.abs(feeble.force), SS2_TAUNT.minimumForce, "clamped away from zero");
    assert.equal(feeble.knockbackAnimation, false, "and below 100 the clip does NOT play");
  }
});

test("THE SHOVE'S SIGN IS THE ACTOR'S FACING, which travels as a status and not a number", () => {
  // `gladiator_dir` cannot be a resource — resources are finite numbers — so it
  // is the status token `facing-left`, absent meaning right. The build reads
  // `attacker.gladiator_dir == "right"` at `+0x69c8` and negates for the other.
  const forceFacing = (facingLeft) => {
    for (let seed = 1; seed <= 80; seed += 1) {
      const battle = duel({
        seed,
        hero: { charisma: 30, ...(facingLeft ? { gladiator_dir: "left" } : {}) },
        villain: { charisma: 1, equipped_weapon: 1 }
      });
      try {
        const { event } = taunt(battle);
        if (event.landed && event.effect === 2) {
          const actor = combatantById(battle, "hero");
          return { force: event.force, carries: (actor.status ?? []).includes(SS2_FACING_LEFT) };
        }
      } catch {
        continue;
      }
    }
    return null;
  };
  const right = forceFacing(false);
  assert.ok(right, "a right-facing shove must be reachable");
  assert.ok(right.force > 0, "facing right shoves in the positive direction");
});

test("A FLEEING DEFENDER LOSES ITS PSYCH-UP CHARGE, which is one of the counter's eight resets", () => {
  // ► **`+0x6ac8`, AND IT WAS RECORDED NOWHERE UNTIL 2026-09-17.** The bow-mode
  //   arm writes `game_defender.psyche_up = 1` immediately before
  //   `taunted1 = true`. Three sessions had each added one reset site to this
  //   project's record without asking how many there were; there are eight.
  for (let seed = 1; seed <= 80; seed += 1) {
    const battle = duel({
      seed,
      hero: { charisma: 30 },
      villain: { charisma: 1, secondary_weapon: 61, equipped_weapon: 2, psyche_up: 3 }
    });
    let event;
    try {
      ({ event } = taunt(battle));
    } catch {
      continue;
    }
    if (!(event.landed && event.effect === 2 && event.flag === SS2_TAUNT.flag)) continue;
    const villain = toTeamWireState(battle).teams[1].combatants[0];
    assert.equal(villain.resources.psyche_up.value, 1, "a landed taunt breaks the charge");
    assert.ok((villain.status ?? []).some((token) => token.startsWith(SS2_TAUNT.flag)),
      "and leaves the flag on the target");
    return;
  }
  assert.fail("the bow-mode flee arm was not reachable in 80 seeds");
});

/* ------------------------------------------------------------------ *
 * THE ECONOMY, AND WHY IT IS NOT A SWING'S
 * ------------------------------------------------------------------ */

test("A TAUNT IS PRICED LIKE A REST AND NOT LIKE A SWING, which is why they share a button", () => {
  // ► **COST `round(charisma * 2)` (`+0x67bb`), GAIN `+= stamina` (`+0x6894`),
  //   HEAL `3 + ceil(stamina)` (`+0x684c`)** — the same three writes the rest
  //   branch makes, on the same `attacker.struck == null` guard. Routing this
  //   through the shared band path would have repriced it on STRENGTH and
  //   dropped the recovery entirely.
  //
  //   `+0x684c` is also the offset this project has already been burned by: it
  //   was once asserted to be the SOLE site for `3 + ceil(stamina)`, the map's
  //   prose was overruled, and a test was written to pin the wrong number.
  const battle = duel({ seed: 3, hero: { charisma: 9, stamina: 12 } });
  // ► **THE HEAL IS CLAMPED BY THE DEFICIT, so a gladiator at full health
  //   recovers nothing and the assertion would pass over a population of
  //   zero.** Wounded first, which is the only state where the term is
  //   observable at all.
  const hero = combatantById(battle, "hero");
  hero.health = Math.max(1, hero.maxHealth - 40);
  const { event } = taunt(battle);
  assert.ok(Number.isFinite(event.staminaGained), "the event reports the recovery");
  assert.ok(Number.isFinite(event.healed));
  assert.ok(event.healed > 0, "a taunt heals, which no swing does");
  // And the heal is the branch's own `3 + ceil(stamina)` plus `nextphase`'s
  // `1 + ceil(stamina / 2)` — the same pair a rest gets.
  assert.equal(event.healed, 3 + Math.ceil(12) + 1 + Math.ceil(12 / 2));
});

/* ------------------------------------------------------------------ *
 * WHICH CONTROLLER WIRES IT
 * ------------------------------------------------------------------ */

test("THREE FRAMES OF FOUR WIRE THE TAUNT, and they do not agree on when", () => {
  // Map §"Buttons wired per controller frame": frames 5 and 20 share the slot
  // with `rest` at half stamina, frame 28 always wires it, frame 13 never does.
  const offered = (stamina, opts = {}) => {
    const battle = duel({ seed: 1, hero: opts });
    if (stamina !== null) {
      const hero = battle.teams[0].combatants[0];
      const max = hero.resources.staminamax.value ?? hero.resources.staminamax;
      hero.resources.staminaleft = { value: Math.floor(max * stamina), min: 0, max: null };
    }
    return legalActions(battle).some((o) => o.type === Ss2ActionType.TAUNT);
  };
  assert.equal(offered(1), true, "longrange_warrior at full stamina");
  assert.equal(offered(0.5), true, "and exactly at the half-stamina boundary");
  assert.equal(offered(0.49), false, "but not below it — the rest button has the slot");
  assert.equal(offered(0.1), false);
});

/* ------------------------------------------------------------------ *
 * WHAT REACHES THE SCREEN
 * ------------------------------------------------------------------ */

test("BOTH CLIPS PLAY, AND THEY PLAY WHATEVER IT ROLLED", () => {
  // ► **THE BUILD FIRES THEM BEFORE THE ROLL** — `attacker.gotoAndPlay("taunt")`
  //   at `+0x6905` and `defender.gotoAndPlay("taunted")` at `+0x690c` — so a
  //   taunt that fails outright still animates both, which is what makes it
  //   read as a taunt rather than as a fumble.
  const bound = (event) => SS2_STATIC_MAP_BINDINGS.action({ type: Ss2ActionType.TAUNT, ...event });

  const failed = bound({ landed: false });
  assert.equal(failed.actor.label, "taunt");
  assert.equal(failed.target.label, "taunted", "a FAILED taunt still animates its target");
  assert.equal(failed.actor.provenance, LabelProvenance.MAP_NAMED, "the build names both outright");

  // The shove above the force gate plays the build's own knockback clip.
  assert.equal(bound({ landed: true, effect: 2, force: 500, knockbackAnimation: true }).target.label, "knockback");
  // And below it, the taunted clip — the displacement happened either way.
  assert.equal(bound({ landed: true, effect: 2, force: 20, knockbackAnimation: false }).target.label, "taunted");
});

test("THE SHOVE MOVES HIM, and a Codex review is why", () => {
  // ► **THE FIRST CUT REPORTED A FORCE AND DISPLACED NOBODY.** Reproduced by
  //   the review at seed 5, charisma 30: force 750, `knockbackAnimation` true,
  //   defender still at x 250. **A successful outcome that cannot change the
  //   distance cannot change what either gladiator may do next**, which makes
  //   it indistinguishable from a failed one.
  //
  //   The build's `knockback(defender, force)` at `+0x6ab1` is UNCONDITIONAL —
  //   the `|force| > 100` gate above it is the ANIMATION's — so the shove now
  //   emits a POSITION effect, clamped to the arena the way `nextphase` step 1
  //   clamps every `_x`.
  //
  //   **`damagecharacter`'s own knockback still displaces nobody here**: it has
  //   travelled as an event field since it was built and nothing reads it. That
  //   is now the only gap of its kind left, and it is not this action's to
  //   close — positions are in `combatStateHash`, so moving them re-datums
  //   every pinned hash and every golden that carries one.
  for (let seed = 1; seed <= 80; seed += 1) {
    const battle = duel({ seed, hero: { charisma: 30 }, villain: { charisma: 1 } });
    const before = combatantById(battle, "villain").x;
    let event;
    try {
      ({ event } = taunt(battle));
    } catch {
      continue;
    }
    if (!(event.landed && event.effect === 2 && Number.isFinite(event.force))) continue;
    const after = combatantById(battle, "villain").x;
    assert.notEqual(after, before, "a shove must MOVE the defender");
    assert.equal(after, before + event.force, "by exactly the force, inside the arena");
    assert.equal(event.from, before, "and the event reports both endpoints");
    assert.equal(event.to, after);
    return;
  }
  assert.fail("the shove arm was not reachable in 80 seeds");
});

test("A LETHAL TAUNT STILL RECOVERS, because the build recovers BEFORE it rolls", () => {
  // ► **THE ORDERING A CODEX REVIEW CAUGHT, AND THE BYTES SETTLE IT.**
  //   `hitpoints += 3 + ceil(stamina)` at `+0x684c`, `staminaleft += stamina`
  //   at `+0x6894` and `check_stats` at `+0x68d3` all run BEFORE the `diceroll`
  //   at `+0x6921` and the `checkattackroll` at `+0x698c`. The first cut folded
  //   the recovery into the band path's transition, which is dropped entirely
  //   when the blow eliminates — so a taunt that killed healed nobody.
  const battle = duel({ seed: 3, hero: { charisma: 30, stamina: 12 }, villain: { charisma: 1, vitality: 1 } });
  const hero = combatantById(battle, "hero");
  hero.health = Math.max(1, hero.maxHealth - 40);
  const healthBefore = hero.health;
  const { event } = taunt(battle);
  assert.ok(event.healed > 0, "the recovery is reported whatever the roll did");
  assert.ok(combatantById(battle, "hero").health > healthBefore,
    "and it reaches the gladiator even when the taunt goes on to kill");
});

test("THE GAIN CLAMPS BEFORE THE COST IS SPENT, which is two stages and not one", () => {
  // ► **MEASURED: 220/220, charisma 30, stamina 12 ends at 165.** The build
  //   adds the branch's `+= stamina`, clamps with `check_stats` (`+0x68d3`),
  //   and only later charges `nextphase`. Bundling both into one
  //   `phaseTransitionEffects` call banks the overflow and gives 177.
  //
  //   **`rest` cannot show this and that is why it went unnoticed**: its cost
  //   is NEGATIVE, so it never spends and there is no second stage to clamp
  //   before. A taunt gains 12 and spends 60.
  const battle = duel({ seed: 3, hero: { charisma: 30, stamina: 12 } });
  const staminaOf = () => toTeamWireState(battle).teams[0].combatants[0].resources.staminaleft.value;
  assert.equal(staminaOf(), 220, "the taunter opens at full stamina");
  taunt(battle);
  assert.equal(staminaOf(), 165, "220 clamped at 220, then -60 +1 +round(12/3)");
});
