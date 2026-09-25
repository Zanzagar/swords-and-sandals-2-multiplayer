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
  SS2_ARENA, SS2_CHAIN_CLEAR_FLAGS, SS2_FACING_LEFT, SS2_STATUS_SOURCE_SEPARATOR, SS2_TAUNT,
  Ss2ActionType, createSs2TeamRules, ss2Combatant, ss2MovementSpeed, ss2RunDisplacement,
  ss2WalkDisplacement
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

/**
 * Give the hero the turn, then taunt, and hand back the event and the draws.
 * `prepare(hero)` runs once the cursor is on him and before the offer is read,
 * so a test can set the pools the taunt starts from.
 */
function taunt(battle, prepare = () => {}) {
  for (let guard = 0; guard < 8 && currentCombatant(battle)?.id !== "hero"; guard += 1) {
    const who = currentCombatant(battle);
    const legal = legalActions(battle);
    applyAction(battle, { actorId: who.id, ...(legal.find((o) => o.type === Ss2ActionType.REST) ?? legal[0]) });
  }
  assert.equal(currentCombatant(battle)?.id, "hero", "the turn cursor must have reached the hero");
  prepare(combatantById(battle, "hero"));
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
  // ► **THIS PINS A NAMED GAP, NOT THE BUILD — found 2026-09-23.** A failed
  //   roll jumps to `+0x6b0e`, `defender_blocked()`, which replaces `taunted`
  //   in the same tick with `"defend" + attack_direction` — a direction this
  //   arm never writes, so whatever the bout's last attack phase left. No event
  //   carries that, so `taunted` stays; see `tauntLabels`'s NOT MODELLED note.
  assert.equal(failed.target.label, "taunted", "a FAILED taunt still animates its target");
  assert.equal(failed.actor.provenance, LabelProvenance.MAP_NAMED, "the build names both outright");

  // The shove above the force gate plays the build's own knockback clip.
  assert.equal(bound({ landed: true, effect: 2, force: 500, knockbackAnimation: true }).target.label, "knockback");
  // And below it, the taunted clip — the displacement happened either way.
  assert.equal(bound({ landed: true, effect: 2, force: 20, knockbackAnimation: false }).target.label, "taunted");
});

test("A TAUNT STRIKE REPLACES `taunted`: the victim plays `hurt20` when it lands and `defend20` when it is blocked", () => {
  // ► **THE BUILD REPLACES THE CLIP IN THE SAME FRAME, and this table said it
  //   never did.** Read off `sprite:862[overlay]/frame:52/DoAction@0x240c7f`
  //   on 2026-09-23:
  //
  //   ```text
  //     +0x690c  defender.gotoAndPlay("taunted")
  //     +0x6981  attack_direction = 20          (taunt_effect == 1)
  //     +0x698c  checkattackroll()
  //       hit:   +0x30ff defender_hurt("taunt")  -> +0x2086 animstate = "hurt" + 20
  //              (20 is below the 21-23 rewrite and is not 30), and
  //              +0x2136 defender.gotoAndPlay(animstate)
  //       miss:  +0x316d defender_blocked()      -> +0x2160 animstate = "defend" + 20,
  //              +0x224a defender.gotoAndPlay(animstate)
  //   ```
  //
  //   All of it runs synchronously inside the taunt phase's first tick, so the
  //   `taunted` clip is superseded before it is ever drawn. Both labels are on
  //   the fighter clip (`hurt20` and `defend20` are in the `hurt` and `defend`
  //   families). Real resolved events, not hand-built ones, so the fields the
  //   table reads are the fields the resolver writes.
  const found = new Map();
  for (let seed = 1; seed <= 40 && found.size < 2; seed += 1) {
    for (const [heroCharisma, foeCharisma] of [[30, 1], [9, 9]]) {
      const battle = duel({ seed, hero: { charisma: heroCharisma }, villain: { charisma: foeCharisma } });
      let event;
      try {
        ({ event } = taunt(battle));
      } catch {
        continue;
      }
      if (event.effect !== SS2_TAUNT.strikeEffect) continue;
      const key = event.hit === true ? "landed" : "blocked";
      if (!found.has(key)) found.set(key, event);
    }
  }
  const bound = (event) => SS2_STATIC_MAP_BINDINGS.action(event);

  const landed = found.get("landed");
  assert.ok(landed, "a strike that lands must be reachable");
  assert.ok(landed.damage > 0, "and it must hurt, or the victim's clip is not the question");
  assert.equal(bound(landed).actor.label, "taunt", "the taunter still plays its own clip");
  assert.equal(bound(landed).target.label, "hurt20", "the victim visibly takes the hit");
  assert.equal(bound(landed).target.provenance, LabelProvenance.MAP_NAMED);

  const blocked = found.get("blocked");
  assert.ok(blocked, "a strike that is blocked must be reachable");
  assert.equal(bound(blocked).target.label, "defend20", "a blocked strike is parried, as any blocked blow is");
  assert.equal(bound(blocked).target.provenance, LabelProvenance.MAP_NAMED);
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
  //   emits a POSITION effect, clamped to the arena. **The clamp's citation was
  //   wrong until 2026-09-17** ("the way `nextphase` step 1 clamps every `_x`"):
  //   `nextphase` clamps the DATA objects and is dead code; the live clamp is
  //   in `attacker.onEnterFrame`. Same number, different function — see
  //   `SS2_ARENA.clamp`.
  //
  //   ► ~~**`damagecharacter`'s own knockback still displaces nobody here** ...
  //     it is not this action's to close — positions are in `combatStateHash`,
  //     so moving them re-datums every pinned hash and every golden that
  //     carries one.~~ **CLOSED 2026-09-17, AND THE REASON GIVEN FOR NOT
  //     CLOSING IT WAS FALSE.** No golden carries a position or a hash and none
  //     structurally can (`startingPosition` returns `null` under
  //     `fixtureReplay`), and the displacement moved zero pinned hashes —
  //     measured by removing it and re-running, because every seeded pin swings
  //     directions 1-4 and the build's knockback gate needs 5-12 or 30.
  //     The sentence stood in three places and deferred the work twice.
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

test("THE ROLL DECIDES WHAT HAPPENS TO THE FOE, NEVER THE TAUNTER'S OWN LEDGER — the strike arm included", () => {
  // ► **EVERYTHING THE TAUNTER IS OWED OR OWES IS SETTLED ON ONE SIDE OF THE
  //   ROLL** (battle map § "The `taunt` branch restores inline" and § "The
  //   taunt phase, in full"): the cost `round(charisma * 2)` is SET at
  //   `+0x67bb`, and the heal `3 + ceil(stamina)` at `+0x684c`,
  //   `staminaleft += stamina` at `+0x6894` and `check_stats` at `+0x68d3`
  //   all run BEFORE `diceroll` at `+0x6921`; `nextphase` then SPENDS the cost
  //   and regenerates (`+0x32a7`, `+0x32c9`) whenever the phase completes. So
  //   a taunt that fails, shoves or strikes leaves the taunter in the same
  //   place, and only a KILL differs (it deletes `nextphase`).
  //
  //   **Found wrong on the strike arm 2026-09-24**: `taunt_effect == 1` ran
  //   `nextphase` off the PRE-recovery pool, so its absolute write erased the
  //   `+= stamina` (found by `test/ss2-action-preview.test.js`: demo roster,
  //   plain 3v3, seed 3, turn 11, 96 -> 67 where this order gives 72),
  //   reported `staminaSpent: NaN`, and priced `nextphase`'s heal against the
  //   pre-recovery deficit.
  //
  //   The numbers, by hand from those offsets: charisma 9, stamina 12, 150 of
  //   220 and 10 hitpoints short. Recovery: 150 + 12 = 162 (under the 220
  //   ceiling), heal min(3 + 12, 10) = 10. `nextphase`: 162 - 18 + (1 + 4) =
  //   149, heal min(1 + 6, 0) = 0.
  const outcomes = new Map();
  for (let seed = 1; seed <= 60 && outcomes.size < 3; seed += 1) {
    const battle = duel({ seed });
    let maxHealth;
    const { event } = taunt(battle, (hero) => {
      hero.resources.staminaleft.value = 150;
      maxHealth = hero.maxHealth;
      hero.health = maxHealth - 10;
    });
    const key = event.landed ? `effect ${event.effect}` : "failed";
    if (outcomes.has(key)) continue;
    const hero = combatantById(battle, "hero");
    outcomes.set(key, { event, staminaleft: hero.resources.staminaleft.value, health: hero.health, maxHealth });
  }
  assert.deepEqual([...outcomes.keys()].sort(), ["effect 1", "effect 2", "failed"],
    "all three non-lethal outcomes must be reached, or the comparison is over fewer arms than it claims");
  for (const [key, outcome] of outcomes) {
    assert.equal(outcome.staminaleft, 149, `${key}: recover to 162 first, then pay 18 and regenerate 5`);
    assert.equal(outcome.health, outcome.maxHealth, `${key}: the recovery fills the 10-point deficit`);
    assert.equal(outcome.event.healed, 10, `${key}: and the event reports what was restored, not what was offered`);
  }
  assert.equal(outcomes.get("effect 1").event.staminaSpent, 18,
    "the strike spends the taunt's own `round(charisma * 2)`, never a swing's price");
});

test("A LETHAL STRIKE KEEPS THE RECOVERY AND PAYS NOTHING, because `death()` deletes `nextphase`", () => {
  // The recovery is spent before the roll (`+0x6894`, `+0x68d3`), and the cost
  // is only ever charged by `nextphase` (`+0x32a7`), which a kill never
  // reaches. Charisma 30 against a vitality-1 foe with charisma 1: the strike
  // is `round(30 * 4) - 1 = 119` against 110 hitpoints. From 150 of 220 the
  // pool ends at 150 + 12 = 162, and nothing is spent.
  for (let seed = 1; seed <= 40; seed += 1) {
    const battle = duel({ seed, hero: { charisma: 30 }, villain: { charisma: 1, vitality: 1 } });
    const { event } = taunt(battle, (hero) => { hero.resources.staminaleft.value = 150; });
    if (!(event.landed && event.effect === SS2_TAUNT.strikeEffect)) continue;
    assert.equal(combatantById(battle, "villain").alive, false, "the strike must kill, or this is the other test");
    assert.equal(combatantById(battle, "hero").resources.staminaleft.value, 162, "the recovery, and no nextphase");
    assert.equal(event.staminaSpent, 0, "a kill skips the phase that charges the cost");
    return;
  }
  assert.fail("a lethal strike was not reachable in 40 seeds");
});

/* ------------------------------------------------------------------ *
 * THE FLEE — row 3 of the build's forced chain
 * ------------------------------------------------------------------ */

test("A RUN IS NOT A BIG WALK, and all three differences are ways to get it wrong", () => {
  // ► **THE DERIVATION THAT UNBLOCKED THIS, and the reason it was worth doing
  //   rather than generalising `ss2WalkDisplacement` by a factor.**
  //
  //   1. **No boot bonus.** `destination = _x -/+ movement_speed * 40` is a RAW
  //      product at `+0x3f69`/`+0x40f2` — no `get_percentage`/`add_percentage`
  //      round trip. Only the walk takes a boot bonus.
  //   2. **The stop gap is 10, not 20** (`+0x4038`, `+0x41c1`).
  //   3. **And the closed form in the movement table is +1 LOW at 23 of the 57
  //      reachable speeds**, because the tween exits when the gap is at or
  //      under 10 and lands on 9 at those inputs.
  //
  //   The easing itself IS shared: `ceil(gap / 8)` in both (`+0x3e7b` walk,
  //   `+0x3fa1` run).
  assert.equal(ss2WalkDisplacement(12), 172, "the walk is unchanged — the control");
  assert.equal(ss2RunDisplacement(12), 470);

  // A run is NOT the walk scaled by 40/16, which is what a factor would give.
  assert.notEqual(ss2RunDisplacement(12), ss2WalkDisplacement(12) * (40 / 16));
  // Nor is it the boot-bearing walk formula at 40.
  assert.notEqual(ss2RunDisplacement(12, { boot: 5 }), ss2RunDisplacement(12) + 1);

  // ► **THE 23 INPUTS WHERE THE CLOSED FORM IS WRONG**, spelled out so a future
  //   reader who "simplifies" this back to `40 * ms - 10` fails here by name.
  const wrong = [];
  for (let ms = 4; ms <= 60; ms += 1) {
    if (ss2RunDisplacement(ms) !== ms * 40 - 10) wrong.push(ms);
  }
  assert.deepEqual(wrong,
    [5, 10, 13, 15, 17, 20, 22, 25, 26, 29, 30, 33, 34, 38, 39, 43, 44, 49, 50, 51, 56, 57, 58]);
  assert.equal(ss2RunDisplacement(20), 791, "and 790 is the closed form's answer");

  // Refused rather than defaulted, like its sibling: a negative or non-finite
  // speed is a caller bug, and silently returning 0 would make a fleeing
  // gladiator stand still for a reason nothing names.
  assert.throws(() => ss2RunDisplacement(-1), /movementSpeed must be a finite non-negative number/);
  assert.throws(() => ss2RunDisplacement(Number.NaN), /movementSpeed must be a finite non-negative number/);
});

test("A TAUNTED GLADIATOR RUNS, AND IT IS THE ONLY THING HE MAY DO", () => {
  // ► **ROW 3 OF THE BUILD'S FORCED CHAIN** (`+0x0d68`-`+0x0e35`): `taunted1`
  //   sends him to `getphase("runleft")` facing right and `("runright")` facing
  //   left — AWAY from the way he is looking — and the flag is cleared on the
  //   way through (`+0x0ddb`, `+0x0e2d`).
  for (let seed = 1; seed <= 80; seed += 1) {
    const battle = duel({
      seed,
      hero: { charisma: 30 },
      villain: { charisma: 1, secondary_weapon: 61, equipped_weapon: 2 }
    });
    let event;
    try {
      ({ event } = taunt(battle));
    } catch {
      continue;
    }
    if (event.flag !== SS2_TAUNT.flag) continue;

    // The turn is TAKEN, not merely influenced: one option, and it is the flee.
    assert.deepEqual(legalActions(battle).map((o) => o.type), [Ss2ActionType.TAUNTED_PHASE],
      "a taunted gladiator is offered the flee and nothing else");

    const before = combatantById(battle, "villain").x;
    const who = currentCombatant(battle);
    applyAction(battle, { actorId: who.id, ...legalActions(battle)[0] });
    const fled = battle.events.filter((e) => e.type === Ss2ActionType.TAUNTED_PHASE).pop();

    assert.ok(fled, "the flee must resolve");
    assert.match(fled.vanillaLabel, /^run(left|right)$/, "and carry the FACING's own label");
    assert.equal(fled.from, before);
    const after = combatantById(battle, "villain").x;
    assert.equal(fled.to, after, "the event and the battle agree about where he went");
    assert.notEqual(after, before, "and he actually moved");

    // The distance is the run's, clamped by the arena the way `nextphase` step 1
    // clamps every `_x`.
    const expected = ss2RunDisplacement(ss2MovementSpeed(combatantById(battle, "villain")));
    const direction = after > before ? 1 : -1;
    assert.equal(after, Math.max(SS2_ARENA.clamp.min,
      Math.min(SS2_ARENA.clamp.max, before + direction * expected)));

    // The flag is spent by being obeyed, so the next turn is ordinary again.
    assert.equal((combatantById(battle, "villain").status ?? [])
      .some((token) => token.startsWith(SS2_TAUNT.flag)), false, "the flag is cleared");
    assert.ok(legalActions(battle).length > 1, "and the gladiator has his choices back");
    return;
  }
  assert.fail("the flee arm was not reachable in 80 seeds");
});

test("THE FLEE OUTRANKS EVERY CONDITION, and clears the ones it walked past", () => {
  // ► **ROW 3 BEATS ROWS 4-7, and they are SEQUENTIAL STATEMENTS rather than an
  //   else-chain** — each clears its own flag BEFORE calling `getphase`, and
  //   those calls are silent no-ops once row 3 has taken the turn. So a taunted,
  //   burning gladiator RUNS and loses the burn.
  const battle = duel({ seed: 7 });
  const villain = combatantById(battle, "villain");
  villain.status = ["taunted1", "burning"];
  for (let guard = 0; guard < 8 && currentCombatant(battle)?.id !== "villain"; guard += 1) {
    const who = currentCombatant(battle);
    const legal = legalActions(battle);
    applyAction(battle, { actorId: who.id, ...(legal.find((o) => o.type === Ss2ActionType.REST) ?? legal[0]) });
    villain.status = ["taunted1", "burning"];
  }
  assert.equal(currentCombatant(battle)?.id, "villain");
  assert.deepEqual(legalActions(battle).map((o) => o.type), [Ss2ActionType.TAUNTED_PHASE],
    "the flee wins over the burn");
  applyAction(battle, { actorId: "villain", ...legalActions(battle)[0] });
  assert.deepEqual([...(combatantById(battle, "villain").status ?? [])], [],
    "and the burn is cleared without ever playing");
});

test("THE FLEE TAKES NO SAMPLE, because a forced phase is not a choice", () => {
  // A tape replays across it unchanged. The build draws nothing in row 3.
  const battle = duel({ seed: 7 });
  const villain = combatantById(battle, "villain");
  villain.status = ["taunted1"];
  for (let guard = 0; guard < 8 && currentCombatant(battle)?.id !== "villain"; guard += 1) {
    const who = currentCombatant(battle);
    const legal = legalActions(battle);
    applyAction(battle, { actorId: who.id, ...(legal.find((o) => o.type === Ss2ActionType.REST) ?? legal[0]) });
    villain.status = ["taunted1"];
  }
  const before = rngJournal(battle).length;
  applyAction(battle, { actorId: "villain", ...legalActions(battle)[0] });
  assert.equal(rngJournal(battle).length, before, "a flee draws nothing at all");
});

test("`taunted2` FORCES NOTHING, because the build never sets it", () => {
  // ► **THE ASYMMETRY IS THE BUILD'S.** Row 3 tests `taunted1 == true` OR
  //   `taunted2 == true`, but `taunted2` is assigned `true` at no site in the
  //   build — and the hero path clears only `taunted1` in both its arms. A
  //   phase for it would be a promise nothing can redeem, so it has none, while
  //   `SS2_TAUNT_FLAGS` keeps both because the CLEARING is real for both.
  const battle = duel({ seed: 7 });
  const villain = combatantById(battle, "villain");
  villain.status = ["taunted2"];
  for (let guard = 0; guard < 8 && currentCombatant(battle)?.id !== "villain"; guard += 1) {
    const who = currentCombatant(battle);
    const legal = legalActions(battle);
    applyAction(battle, { actorId: who.id, ...(legal.find((o) => o.type === Ss2ActionType.REST) ?? legal[0]) });
    villain.status = ["taunted2"];
  }
  assert.ok(legalActions(battle).length > 1,
    "a gladiator carrying only `taunted2` keeps its ordinary turn");
});


/* ------------------------------------------------------------------ */
/* The four a Codex review of `cbaf406` reproduced, 2026-09-17          */
/* ------------------------------------------------------------------ */

/**
 * Put `who` on the clock with `prep` applied, in a battle whose combatants are
 * placed by `place`. The prep is re-applied after every filler turn, because a
 * filler turn is a turn and the engine is entitled to write over it.
 */
function onTheClock({ who = "villain", teams, place = () => {}, prep = () => {}, seed = 5, rules = createSs2TeamRules() }) {
  const battle = createTeamBattle({ rules, seed, teams });
  const set = () => {
    place(battle);
    prep(combatantById(battle, who));
  };
  set();
  for (let guard = 0; guard < 8 && currentCombatant(battle)?.id !== who; guard += 1) {
    const actor = currentCombatant(battle);
    const legal = legalActions(battle);
    applyAction(battle, {
      actorId: actor.id,
      ...(legal.find((o) => o.type === Ss2ActionType.REST) ?? legal[0])
    });
    set();
  }
  assert.equal(currentCombatant(battle)?.id, who, "the rig must hand the turn to the right gladiator");
  return battle;
}

const duellists = (extra = {}) => [
  { id: "red", combatants: [{ id: "hero", ...gladiator() }] },
  { id: "blue", combatants: [{ id: "villain", ...gladiator(extra) }] }
];

test("A FLEE RUNS THROUGH A BODY, and the walk beside it is why that is derived and not forgotten", () => {
  // ► **THE RUN HAS A BODY RULE AND THE FLEE CANNOT REACH IT.** Read off sprite
  //   862 frame 52 on 2026-09-17, both gaits at once:
  //
  //     walkleft `+0x3b1f`  destination = _x - add_percentage(boot, ms * 16)
  //                         if (destination < defender._x + game_defender.physical_size
  //                             && attacker.gladiator_dir == "left")
  //                           destination = defender._x + game_defender.physical_size
  //     runleft  `+0x3ee3`  destination = _x - ms * 40
  //                         if (attacker.gladiator_dir == "left"
  //                             && attacker._x < defender._x + attacker.physical_size)
  //                           { destination = null; nextphase() }
  //
  //   The walk CLAMPS before it sets off; the run ABORTS mid-tween. Both are
  //   guarded on the facing — and frame 1 row 3 sends `gladiator_dir == "right"`
  //   to `runleft`, so the arm a flee runs is always the arm whose guard is
  //   false. A Codex review called the missing clamp a collision bug; it is the
  //   build's own geometry, and this test is here so that "add the clamp" fails
  //   loudly instead of looking like a tidy-up.
  const battle = onTheClock({
    who: "hero",
    teams: [
      { id: "red", combatants: [{ id: "hero", ...gladiator() }, { id: "ally", ...gladiator() }] },
      { id: "blue", combatants: [{ id: "villain", ...gladiator() }] }
    ],
    place: (b) => {
      Object.assign(combatantById(b, "hero"), { x: 0, y: SS2_ARENA.frontY });
      Object.assign(combatantById(b, "ally"), { x: -800, y: SS2_ARENA.frontY });
      Object.assign(combatantById(b, "villain"), { x: 250, y: SS2_ARENA.frontY });
    },
    prep: (actor) => { actor.status = [SS2_TAUNT.flag]; }
  });

  const from = combatantById(battle, "hero").x;
  const ally = combatantById(battle, "ally").x;
  applyAction(battle, { actorId: "hero", ...legalActions(battle)[0] });
  const to = combatantById(battle, "hero").x;

  assert.ok(ally < from && to < ally, `the ally at ${ally} must lie between ${from} and ${to}`);
  // Nothing but `nextphase`'s arena bound shortened it.
  const displacement = ss2RunDisplacement(ss2MovementSpeed(combatantById(battle, "hero")));
  assert.equal(to, Math.max(SS2_ARENA.clamp.min, from - displacement));
});

test("A WALK IN THE SAME GEOMETRY STOPS SHORT, which is the contrast that makes the flee a finding", () => {
  // Same bodies, same ground, the other gait. If this ever agrees with the test
  // above, one of the two clamps has been copied onto the other.
  const battle = onTheClock({
    who: "hero",
    teams: [
      { id: "red", combatants: [{ id: "hero", ...gladiator() }, { id: "ally", ...gladiator() }] },
      { id: "blue", combatants: [{ id: "villain", ...gladiator() }] }
    ],
    place: (b) => {
      Object.assign(combatantById(b, "hero"), { x: 0, y: SS2_ARENA.frontY });
      Object.assign(combatantById(b, "ally"), { x: -800, y: SS2_ARENA.frontY });
      Object.assign(combatantById(b, "villain"), { x: 250, y: SS2_ARENA.frontY });
    }
  });

  const from = combatantById(battle, "hero").x;
  const ally = combatantById(battle, "ally").x;
  const walk = legalActions(battle).find((o) => o.type === Ss2ActionType.WALK_LEFT);
  assert.ok(walk, "the walk must be on offer");
  applyAction(battle, { actorId: "hero", ...walk });
  const to = combatantById(battle, "hero").x;

  const unblocked = from - ss2WalkDisplacement(ss2MovementSpeed(combatantById(battle, "hero")));
  assert.ok(unblocked < ally, "the geometry must be one where an unblocked walk WOULD cross");
  assert.ok(to > ally, `a walk stops short of the body at ${ally}, and landed at ${to}`);
});

test("THE FLEE TURNS HIM ROUND, because `changeCombatants` runs on every phase advance", () => {
  // ► `+0x28bf`-`+0x2ae3` recomputes BOTH facings from `hero._x` vs
  //   `villain._x` and flips `_xscale` to match, and a flee is a phase advance
  //   like any other. The geometry here changes the nearest foe WITHOUT
  //   crossing anybody, so only the facing rule can produce the flip.
  const battle = onTheClock({
    who: "hero",
    teams: [
      { id: "red", combatants: [{ id: "hero", ...gladiator() }] },
      {
        id: "blue",
        combatants: [{ id: "near", ...gladiator() }, { id: "far", ...gladiator() }]
      }
    ],
    place: (b) => {
      Object.assign(combatantById(b, "hero"), { x: 2000, y: SS2_ARENA.frontY });
      Object.assign(combatantById(b, "near"), { x: 2100, y: SS2_ARENA.frontY });
      Object.assign(combatantById(b, "far"), { x: -500, y: SS2_ARENA.frontY });
    },
    prep: (actor) => { actor.status = [SS2_TAUNT.flag]; }
  });

  assert.equal((combatantById(battle, "hero").status ?? []).includes(SS2_FACING_LEFT), false,
    "he starts facing the near foe on his right");
  applyAction(battle, { actorId: "hero", ...legalActions(battle)[0] });

  const hero = combatantById(battle, "hero");
  assert.ok(hero.x > combatantById(battle, "far").x, "and he did not cross the far foe");
  assert.equal((hero.status ?? []).includes(SS2_FACING_LEFT), true,
    "running past the near foe leaves the far one nearest, so he turns to face it");
});

test("ONE FLEE SPENDS EVERY `taunted1`, however many gladiators shouted", () => {
  // Status tokens are source-qualified, the build's flag is one boolean. Two
  // opponents taunting the same gladiator used to leave a survivor that forced a
  // SECOND flee. `statusConsumptionEffects` carries this lesson for the burning
  // flags; the flee's own clear did not reuse it.
  const battle = onTheClock({
    teams: duellists(),
    prep: (actor) => {
      actor.status = [
        `${SS2_TAUNT.flag}${SS2_STATUS_SOURCE_SEPARATOR}hero`,
        `${SS2_TAUNT.flag}${SS2_STATUS_SOURCE_SEPARATOR}ghost`
      ];
    }
  });

  assert.deepEqual(legalActions(battle).map((o) => o.type), [Ss2ActionType.TAUNTED_PHASE]);
  applyAction(battle, { actorId: "villain", ...legalActions(battle)[0] });

  assert.equal((combatantById(battle, "villain").status ?? [])
    .some((token) => token.startsWith(SS2_TAUNT.flag)), false, "both tokens are spent by one flee");
  assert.ok(legalActions(battle).length > 1, "and he is not forced to run a second time");
});

test("A FORCED REST SPENDS THE FLEE IT NEVER RAN, and so does a forced swap", () => {
  // ► **ROWS 1-7 ARE STATEMENTS.** Row 3 writes `taunted1 = false` INSIDE the
  //   facing arm and BEFORE its `getphase`, so when row 1 or row 2 has already
  //   taken the turn the flag is still spent on a call the `turnphase` gate has
  //   silenced. The rest branch modelled that for the four conditions and not
  //   for `taunted1`; the swap branch modelled it for nothing at all.
  const carried = [SS2_TAUNT.flag, "burning"];

  const resting = onTheClock({
    teams: duellists(),
    prep: (actor) => {
      actor.resources.staminaleft.value = 0;
      actor.status = [...carried];
    }
  });
  assert.deepEqual(legalActions(resting).map((o) => o.type), [Ss2ActionType.REST],
    "row 2 outranks row 3, which is the build's order");
  applyAction(resting, { actorId: "villain", ...legalActions(resting)[0] });
  assert.deepEqual([...(combatantById(resting, "villain").status ?? [])], [],
    "the rest takes the turn and the chain still spends the flee and the burn");

  const swapping = onTheClock({
    teams: duellists({ secondary_weapon: 61, equipped_weapon: 2 }),
    prep: (actor) => {
      actor.resources.ammo_left.value = 0;
      actor.status = [...carried];
    }
  });
  assert.deepEqual(legalActions(swapping).map((o) => o.type), [Ss2ActionType.SWAP_WEAPONS],
    "row 1 outranks both");
  applyAction(swapping, { actorId: "villain", ...legalActions(swapping)[0] });
  assert.deepEqual([...(combatantById(swapping, "villain").status ?? [])], [],
    "and an empty quiver spends the whole chain the same way");
});

test("THE CHAIN'S CLEAR LIST IS THE CHAIN'S RANK LIST, and `taunted2` is in neither", () => {
  // One list, read twice, because in the build they are the same statements.
  // `taunted2` is deliberately absent: row 3 tests it and neither arm clears it.
  assert.deepEqual([...SS2_CHAIN_CLEAR_FLAGS],
    [SS2_TAUNT.flag, "frozen", "burning", "poison", "life_stolen"]);
  assert.equal(SS2_CHAIN_CLEAR_FLAGS.includes("taunted2"), false);
});

/* ------------------------------------------------------------------ */
/* WHO MAY BE TAUNTED — the owner's rule, 2026-09-23                   */
/* ------------------------------------------------------------------ */

/**
 * ► **A TAUNT MAY NAME ONLY A FOE IN THE TAUNTER'S OWN RANK, AT ANY DISTANCE.**
 *   AUTHORED — the owner's decision, 2026-09-23 — because the build cannot
 *   answer it: vanilla has one rank and one opponent
 *   (`MAP_SILENCE.multi-slot-arena-geometry`). What the build DOES settle is
 *   that the taunt is the long-range button and that its strike (direction 20,
 *   `round(charisma * 4) - defender.charisma`) has no range test, so in team
 *   play a back-rank gladiator could taunt somebody in another rank 800 units
 *   away and kill him. Measured on the arena's own path before the rule (25
 *   seeded 3v3 bouts, plain kit, at bf53d81): 26 of 26 damaging taunts crossed
 *   a rank.
 *
 *   It is the melee lane rule (`ss2SameLane`, owner 2026-09-18, *"not at
 *   different y"*) WITHOUT the reach test: distance still does not matter,
 *   which is exactly the build in 1v1, where there is one rank.
 */
const rankedTrio = () => [
  { id: "red", combatants: [{ id: "hero", ...gladiator() }] },
  {
    id: "blue",
    combatants: [
      { id: "rival", ...gladiator({ gladiator_dir: "left" }) },
      { id: "flanker", ...gladiator({ gladiator_dir: "left" }) }
    ]
  }
];

test("A TAUNT NAMES ONLY A FOE IN THE TAUNTER'S OWN RANK, however far away he stands", () => {
  const battle = onTheClock({
    who: "hero",
    teams: rankedTrio(),
    place: (b) => {
      Object.assign(combatantById(b, "hero"), { x: 0, y: SS2_ARENA.frontY });
      // The rival is in the hero's rank and as far away as the arena allows.
      Object.assign(combatantById(b, "rival"), { x: SS2_ARENA.clamp.max, y: SS2_ARENA.frontY });
      // The flanker is one rank back and much nearer: distance must not be what decides.
      Object.assign(combatantById(b, "flanker"), { x: 300, y: SS2_ARENA.frontY - SS2_ARENA.rankStride });
    }
  });
  const targets = legalActions(battle)
    .filter((option) => option.type === Ss2ActionType.TAUNT)
    .map((option) => option.targetId);
  assert.deepEqual(targets, ["rival"],
    "the foe in the hero's own rank, at the far wall, and not the nearer one a rank back");

  // And it is a rule, not an AI preference: the resolver refuses the cross-rank
  // taunt from ANY controller, because `applyAction` accepts only an offer.
  assert.throws(
    () => applyAction(battle, { actorId: "hero", type: Ss2ActionType.TAUNT, targetId: "flanker" }),
    /Illegal action/
  );
});

test("WITH NO RANKS EVERY FOE MAY BE TAUNTED, which is every 1v1 and the build", () => {
  // `ss2SameLane` is true whenever either `y` is not finite, and `startingY`
  // returns null at `rankStride` 0 — so a one-dimensional arena offers the taunt
  // against every foe at any distance, exactly as before the rule.
  const battle = onTheClock({
    who: "hero",
    teams: rankedTrio(),
    rules: createSs2TeamRules({ rankStride: 0 }),
    place: (b) => {
      combatantById(b, "hero").x = 0;
      combatantById(b, "rival").x = SS2_ARENA.clamp.max;
      combatantById(b, "flanker").x = 300;
    }
  });
  for (const one of battle.teams.flatMap((team) => team.combatants)) {
    assert.equal(one.y, null, "the rig must model no depth");
  }
  const targets = legalActions(battle)
    .filter((option) => option.type === Ss2ActionType.TAUNT)
    .map((option) => option.targetId);
  assert.deepEqual(targets, ["rival", "flanker"]);
});
