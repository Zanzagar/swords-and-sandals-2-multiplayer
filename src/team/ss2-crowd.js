/**
 * SS2's CROWD ECONOMY — one `crowd_interest` per bout, what every completed
 * phase adds to it, and the victory purse it scales. MAP-DERIVED.
 *
 * Re-derived 2026-09-22 from the oracle's byte dumps (`all-actions.txt`), the
 * derivation `derive:crowd-economy` and its independent refuters (four
 * CONFIRMED, one PARTIAL whose corrected reading is the one used here).
 * Offsets are into `sprite:862[overlay]/frame:52/DoAction@0x240c7f`, base
 * `0x240c85`, unless another block is named. Every `crowd_action` and
 * `crowd_interest` write lands on `_global`: `attacker.onEnterFrame`
 * (`+0x36ae`) and `nextphase` (`+0x3193`) preload `r3 = _global` (flags
 * `0x169`), and `magic_damage_character`, `knockback` and `defender_blocked`
 * preload `r1 = _global` (`0x12a`).
 *
 * ```text
 *   THE OPENING   sprite:751[combat_panel] crowd_bar clip-action:0  +0x011f-+0x0158
 *                 _global.crowd_interest = hero.herolevel + villain.herolevel   (Add2)
 *                 (sprite:2224/frame:1's ceil(herolevel / 5) at +0x0f5c is overwritten by it)
 *   EVERY PHASE   nextphase                                          +0x3541-+0x35b4
 *                 crowd_interest = crowd_interest + crowd_action
 *                 if (crowd_interest < 1) crowd_interest = 1         +0x3557-+0x357b
 *                 else if (crowd_interest > 100) crowd_interest = 100 +0x3580-+0x35a3
 *                 crowd_action = 0                                   +0x35a4-+0x35b4
 *   A KILL        death() deletes nextphase and both onEnterFrames   +0x1e99-+0x204f
 *                 — so the phase that kills never adds its delta
 *   THE PURSE     sprite:2249/frame:88                               +0x078c-+0x07ff
 *                 hero.goldpieces = hero.goldpieces
 *                   + Number(round(villain.character_xp * (100 + crowd_interest) / 100))
 *                 if (hero.herolevel == 1) hero.goldpieces = 2500    +0x0867-+0x08b8
 * ```
 *
 * `crowd_interest` has no other game-state reader: not experience, not the
 * loss frame, not the AI, not psyche. Its only other reader is the
 * `crowd_bar` display (clip-action:1: the bar, the label and two 1-in-1000
 * crowd sounds, all only at `hero.herolevel > 1`).
 *
 * ## ONE crowd per battle — the owner's decisions of 2026-09-22
 *
 * - The crowd is ONE battle-wide pool (`EffectKind.BATTLE_RESOURCE`), opening
 *   at the SUM of every combatant's `herolevel`. In 1v1 that is the build's
 *   `hero.herolevel + villain.herolevel` exactly.
 * - Every completed phase of ANYONE adds its effective delta and is clamped
 *   1..100 — in 1v1 exactly the build's `nextphase`.
 * - It scales the purse of every member of the winning side. **How much each
 *   member is paid ON is NOT decided** — see `ss2TeamVictoryPurses`.
 *
 * ## `SS2_CROWD` is something else
 *
 * `SS2_CROWD` in `ss2-rules.js` is an AUTHORED anti-stall toll that damages
 * both sides past `patience` turns. It shares a word with this and nothing
 * else: it is a pure function of `turnNumber`, never reads `crowd_interest`,
 * and no number in it is the build's. This module is the build's crowd.
 */

import { EffectKind } from "./rule-set.js";
import { resourceValue } from "./resources.js";

/**
 * The battle resource's name and the clamp `nextphase` applies to it.
 *
 * The name is the build's `_global.crowd_interest`. The clamp is a RULE
 * (`nextphase` step 10), not a rail, so it is applied by `ss2CrowdStep` at the
 * build's moment and the pool is declared UNBOUNDED: a rail would clamp the
 * opening on the way in, where the build leaves a sum above 100 standing until
 * the first completed phase.
 */
export const SS2_CROWD_INTEREST = Object.freeze({
  resource: "crowd_interest",
  /** `if (crowd_interest < 1) crowd_interest = 1`, `+0x355f` / `+0x356e`. */
  floor: 1,
  /** `else if (crowd_interest > 100) crowd_interest = 100`, `+0x3588` / `+0x3597`. */
  ceiling: 100
});

/**
 * WHAT EACH PHASE ARM WRITES TO `crowd_action` AT ITS TOP — the effective
 * delta of every arm that has one, because the write re-runs on EVERY tick of
 * `attacker.onEnterFrame` and `nextphase` runs on a later tick than the damage
 * path, after that tick's top write. Last writer wins, so the arm's constant
 * is what `nextphase` adds and the damage path's own writes are discarded.
 *
 * Keyed by the build's phase label (`phase_decision`). Offsets are the Push of
 * each write. Re-read 2026-09-22 arm by arm off the dump, with each arm's
 * helper calls, `struck` gates and `nextphase` sites listed beside it: no arm
 * below calls a `crowd_action`-writing helper on its completion tick.
 *
 * **Not here, because they have no top write** (map; re-read): `walkleft`,
 * `walkright`, `runleft`, `runright`, `block`, `swap_weapons`,
 * `normal_attack` and `bash_attack` — the first six add 0, the last two what
 * the damage path left (`ss2StrikeCrowdAction`). `psyche_up` writes only on
 * its level-3 press and only on the first tick, so its damage path wins when
 * it reaches one (`SS2_PSYCHE_DISCHARGE_CROWD`).
 *
 * **Named edges, NOT reproduced** (both timing-dependent, both need a runtime
 * check): the bombard/snipe arm and the fireball arm never call `nextphase`
 * themselves — only the stall watchdog (`+0x37c9`-`+0x38a0`) ends them — and
 * their impact runs AFTER the top write on the impact tick, so an impact on
 * the tick before the watchdog fires adds the hit's `-2`/`2`/`8` (archery) or
 * `2` (fireball, `magic_damage_character` `+0x13cb`) instead. Death from
 * above's boulders call `magic_damage_character` from their OWN
 * `onEnterFrame` (`+0x882f`), so a boulder landing after the caster's
 * completion in the same frame writes `2` past the reset into the NEXT phase.
 * And the taunt's `taunttimer` watchdog (`+0x67fe`-`+0x681f`) calls
 * `nextphase` and falls through into its own first-tick block.
 */
export const SS2_CROWD_ACTION = Object.freeze({
  chargeright: Object.freeze({ value: 2, offset: "+0x4201" }),
  chargeleft: Object.freeze({ value: 2, offset: "+0x446d" }),
  jumpright: Object.freeze({ value: -2, offset: "+0x46d9" }),
  jumpleft: Object.freeze({ value: -2, offset: "+0x49b1" }),
  rest: Object.freeze({ value: -2, offset: "+0x5150" }),
  frozen: Object.freeze({ value: 0, offset: "+0x52af" }),
  life_stolen: Object.freeze({ value: 0, offset: "+0x53e3" }),
  poisoned: Object.freeze({ value: 0, offset: "+0x5517" }),
  burning: Object.freeze({ value: 0, offset: "+0x564b" }),
  drink_potion: Object.freeze({ value: -3, offset: "+0x577f" }),
  shove: Object.freeze({ value: 2, offset: "+0x5dc0" }),
  power_attack: Object.freeze({ value: 2, offset: "+0x6029" }),
  quick_attack: Object.freeze({ value: -1, offset: "+0x6304" }),
  taunt: Object.freeze({ value: -2, offset: "+0x67a8" }),
  /** One arm for `bombardright`/`bombardleft`/`sniperight`/`snipeleft`. */
  bombard: Object.freeze({ value: -1, offset: "+0x6ba2" }),
  snipe: Object.freeze({ value: -1, offset: "+0x6ba2" }),
  cast_teleport: Object.freeze({ value: 3, offset: "+0x7554" }),
  cast_adulation: Object.freeze({ value: 50, offset: "+0x76c1" }),
  cast_weaken_armour: Object.freeze({ value: 4, offset: "+0x778f" }),
  cast_whirlwind: Object.freeze({ value: 3, offset: "+0x78ed" }),
  cast_gale: Object.freeze({ value: 2, offset: "+0x7abd" }),
  cast_command: Object.freeze({ value: 2, offset: "+0x7bf9" }),
  cast_ghost_strike: Object.freeze({ value: 5, offset: "+0x7dca" }),
  cast_colossus: Object.freeze({ value: 15, offset: "+0x7ffe" }),
  cast_little_fat_kid: Object.freeze({ value: 10, offset: "+0x821c" }),
  /** One arm for both bolts. */
  cast_lightning_bolt: Object.freeze({ value: 5, offset: "+0x841c" }),
  cast_frightning_bolt: Object.freeze({ value: 5, offset: "+0x841c" }),
  cast_death_from_above: Object.freeze({ value: 20, offset: "+0x8642" }),
  cast_swiftsandals: Object.freeze({ value: 3, offset: "+0x8981" }),
  cast_bloodlust: Object.freeze({ value: 3, offset: "+0x8a84" }),
  cast_regenerate: Object.freeze({ value: 3, offset: "+0x8bcf" }),
  cast_boundless_energy: Object.freeze({ value: 3, offset: "+0x8cae" }),
  cast_rejuvinate: Object.freeze({ value: 3, offset: "+0x8d7c" }),
  /** One arm for the three fireballs. */
  cast_fireball: Object.freeze({ value: 5, offset: "+0x8f94" }),
  cast_hell_fireball: Object.freeze({ value: 5, offset: "+0x8f94" }),
  cast_dire_fireball: Object.freeze({ value: 5, offset: "+0x8f94" })
});

/**
 * The top write's value for a build label — throws for a label with no top
 * write, so a branch cannot quietly pass `undefined` into the clamp.
 */
export function ss2CrowdActionOf(label) {
  const row = SS2_CROWD_ACTION[label];
  if (row === undefined) {
    throw new RangeError(`The ${String(label)} arm writes no crowd_action at its top; its delta is its outcome's.`);
  }
  return row.value;
}

/**
 * What the four damage-path helpers leave in `crowd_action` for ONE call of
 * `checkattackroll` — the delta of an arm WITHOUT a top write:
 *
 * ```text
 *   a miss                 defender_blocked      -2   +0x2153 (r1 = _global)
 *   a hit, "critical"      damagecharacter        8   +0x162e
 *   a hit, anything else   damagecharacter        2   +0x17c0 (taunt's 3 at +0x1666 and
 *                                                     grievous's 20 at +0x168b are both
 *                                                     overwritten by it: they are dead)
 *   then, if knockback()   knockback              1   +0x1dfe (SetMember +0x1e0a) — gated on
 *     fires                                           ((5..12) || 30) && (randosmash > 3 || 30)
 * ```
 *
 * Read off the candidate's own outcome, never recomputed: `calculation.hit`,
 * `calculation.dispatchedMethod` (the method `defender_hurt` was handed,
 * `+0x30d7`-`+0x315a`) and `mutation.knockback.force` (finite only when the
 * displacement fired). So a normal attack adds -2, 2, 8 or 1; a bash (23,
 * never knocked back) -2, 2 or 8; a level-3 discharge (30, always knocked
 * back) -2 or 1.
 */
export function ss2StrikeCrowdAction(outcome) {
  const { calculation, mutation } = outcome ?? {};
  if (!calculation || typeof calculation.hit !== "boolean") {
    throw new TypeError("ss2StrikeCrowdAction needs a resolved attack candidate's outcome.");
  }
  if (!calculation.hit) return -2;
  if (Number.isFinite(mutation?.knockback?.force)) return 1;
  return calculation.dispatchedMethod === "critical" ? 8 : 2;
}

/**
 * The level-3 `psyche_up` press that gates OUT of range: its only write,
 * `crowd_action = 3` (`+0x6604`), is inside the first-tick block and nothing
 * overwrites it, so 3 survives to `nextphase`. In range, `checkattackroll`
 * follows it on the same tick and `ss2StrikeCrowdAction` decides. The two
 * charging presses write nothing: 0.
 */
export const SS2_PSYCHE_DISCHARGE_CROWD = Object.freeze({ outOfRange: 3, offset: "+0x6604" });

/**
 * `nextphase` step 10 (`+0x3541`-`+0x35a3`): add, then clamp to 1..100 —
 * `< 1` first, and only when it fails, `> 100`.
 */
export function ss2CrowdStep(interest, crowdAction) {
  const sum = interest + crowdAction;
  if (sum < SS2_CROWD_INTEREST.floor) return SS2_CROWD_INTEREST.floor;
  if (sum > SS2_CROWD_INTEREST.ceiling) return SS2_CROWD_INTEREST.ceiling;
  return sum;
}

/**
 * The crowd step as effects, for a completed phase whose effective delta is
 * `crowdAction`. `[]` when the battle declares no crowd (`battleResources`
 * without `crowd_interest` — see `ss2CrowdOpening`), and `[]` when the step
 * leaves the value where it was, so a phase that moves nothing adds no effect.
 *
 * @param {object} battleResources the request's frozen `battleResources`
 * @param {number} crowdAction the phase's effective `crowd_action`
 */
export function ss2CrowdStepEffects(battleResources, crowdAction) {
  if (!Number.isFinite(crowdAction)) {
    throw new TypeError(`A completed phase needs a finite crowd_action; got ${String(crowdAction)}.`);
  }
  const entry = battleResources?.[SS2_CROWD_INTEREST.resource];
  if (entry === undefined) return [];
  const to = ss2CrowdStep(entry.value, crowdAction);
  if (to === entry.value) return [];
  return [{ kind: EffectKind.BATTLE_RESOURCE, resource: SS2_CROWD_INTEREST.resource, to }];
}

/**
 * The opening declaration, for `rules.openingBattleResources`: the SUM of
 * every combatant's `herolevel` — the build's `hero.herolevel +
 * villain.herolevel` in 1v1, and the owner's rule above it — unbounded (see
 * `SS2_CROWD_INTEREST`).
 *
 * ► **NO CROWD, RATHER THAN AN INVENTED ONE, when any combatant declares no
 *   finite `herolevel`.** The build's `Add2` of `undefined` is `NaN`, which
 *   no number here can honestly stand for. Every gladiator `ss2Combatant`
 *   builds declares one (`SS2_RESOURCE_DEFAULTS.herolevel` is 1), so this is
 *   reached only by a raw blueprint; such a battle projects no crowd, its
 *   phases write none, and it has no purse.
 */
export function ss2CrowdOpening(combatants) {
  let sum = 0;
  for (const combatant of combatants) {
    const level = resourceValue(combatant, "herolevel", Number.NaN);
    if (!Number.isFinite(level)) return {};
    sum += level;
  }
  return { [SS2_CROWD_INTEREST.resource]: { value: sum, min: null, max: null } };
}

/**
 * `crowd_interest` off a projection (`toTeamWireState`), a live battle or a
 * request — or `null` when that battle declares no crowd.
 */
export function ss2CrowdInterestOf(state) {
  const entry = state?.battleResources?.[SS2_CROWD_INTEREST.resource];
  return entry === undefined ? null : entry.value;
}

/* ------------------------------------------------------------------ */
/* The purse                                                           */
/* ------------------------------------------------------------------ */

/**
 * The emperor's gift: `if (hero.herolevel == 1) hero.goldpieces = 2500`
 * (`+0x0867`-`+0x08b8`). **It SETS, it does not add** — the balance and the
 * reward just paid are both discarded — and it runs AFTER the reward, on the
 * level the hero had when the bout was won (frame 88 writes no `herolevel`
 * before `+0x0879`). The goldwon text becomes "'A gift from the emperor to
 * start you on your way.'  You receive 2500 gold pieces." (`+0x088e`).
 * Recorded as the BUILD'S behaviour: a level-1 winner's purse is always 2500.
 */
export const SS2_EMPERORS_GIFT = Object.freeze({ herolevel: 1, goldpieces: 2500 });

/**
 * The build's victory purse, 1v1 — `sprite:2249/frame:88` `+0x078c`-`+0x08b8`,
 * exactly:
 *
 * ```text
 *   won  = Math.round(villain.character_xp * (100 + crowd_interest) / 100)
 *   gold = hero.goldpieces + won
 *   if (hero.herolevel == 1) gold = 2500
 * ```
 *
 * The multiplier is 1.01x-2.00x once any phase has completed, and whatever
 * the unclamped opening gives if the bout was decided before one did.
 * `Math.round` rounds a half UP, the build's and JavaScript's alike.
 *
 * PURE: it takes numbers and returns numbers. Nothing in this engine holds
 * `goldpieces` or `character_xp` (the campaign record deliberately carries no
 * reward), so the caller supplies them.
 *
 * @param {object} params
 * @param {number} params.crowdInterest the battle's `crowd_interest` when it was won
 * @param {number} params.loserXp the defeated side's `character_xp` (the build's `villain.character_xp`)
 * @param {number} params.winnerLevel the winner's `herolevel`
 * @param {number} params.winnerGold the winner's `goldpieces` before the bout was paid
 * @returns {{ goldWon: number, goldpieces: number, emperorsGift: boolean }} `goldWon` is the crowd-scaled
 *   reward the build computes (and displays unless the gift overrides it); `goldpieces` the balance after.
 */
export function ss2VictoryPurse({ crowdInterest, loserXp, winnerLevel, winnerGold }) {
  for (const [name, value] of Object.entries({ crowdInterest, loserXp, winnerLevel, winnerGold })) {
    if (!Number.isFinite(value)) throw new TypeError(`ss2VictoryPurse needs a finite ${name}; got ${String(value)}.`);
  }
  const goldWon = Math.round(loserXp * (100 + crowdInterest) / 100);
  const emperorsGift = winnerLevel === SS2_EMPERORS_GIFT.herolevel;
  return {
    goldWon,
    goldpieces: emperorsGift ? SS2_EMPERORS_GIFT.goldpieces : winnerGold + goldWon,
    emperorsGift
  };
}

/**
 * ► **THE TEAM PURSE — ITS BASE IS AUTHORED, ~~AND IT IS AN OWNER QUESTION~~
 *   AND THE OWNER CHOSE IT (2026-09-22, HANDOFF.md living head): the equal
 *   share below.**
 *
 * What IS decided (owner, 2026-09-22): one crowd, and it scales the purse of
 * every member of the winning side; and the base each member is paid ON is the
 * equal share. The build has one winner and one loser, so its base is simply
 * "the villain's `character_xp`", and every generalisation below agrees with
 * it in 1v1. ~~This one is PROPOSED, and implemented so the question has a
 * working answer to argue with:~~ The owner was offered this, the whole pot
 * each, and kill credit, and chose this one:
 *
 * > **Each member of the winning side is paid on an EQUAL SHARE of the
 * > defeated side's total `character_xp`** — `sum(losers' xp) / winners`,
 * > then the build's own formula, `round(share * (100 + crowd) / 100)`, and
 * > the build's own emperor's gift, per member, on that member's level.
 *
 * Why this one: the gold minted by a bout is then the build's purse for the
 * whole defeated side, scaled by the one crowd, however it is split — so a
 * 3v3 pays each member what a 1v1 against one of those foes would, a 1v3
 * pays its lone winner for all three, and adding allies divides a purse
 * rather than multiplying it. The alternatives it was weighed against: every
 * member paid on the WHOLE pot (gold scales with team size); kill credit (a
 * support member earns nothing, and the build pays for winning, not for the
 * blow); the MEAN foe's xp to each (a 1v3 pays like a 1v1). **Every member of
 * the winning side is paid, fallen included**, which is the owner's wording
 * ("every member"); a fallen member is also AUTHORED, since a 1v1 winner
 * cannot have fallen.
 *
 * @param {object} params
 * @param {number} params.crowdInterest the battle's `crowd_interest` when it was won
 * @param {{ id: string, herolevel: number, goldpieces: number }[]} params.winners every member of the winning side
 * @param {{ id: string, character_xp: number }[]} params.losers every member of the defeated side
 * @returns {{ basis: number, payouts: { id: string, goldWon: number, goldpieces: number, emperorsGift: boolean }[] }}
 */
export function ss2TeamVictoryPurses({ crowdInterest, winners, losers }) {
  if (!Array.isArray(winners) || winners.length === 0) {
    throw new TypeError("ss2TeamVictoryPurses needs at least one winner; a draw pays nobody.");
  }
  if (!Array.isArray(losers) || losers.length === 0) {
    throw new TypeError("ss2TeamVictoryPurses needs the defeated side.");
  }
  let pot = 0;
  for (const loser of losers) {
    if (!Number.isFinite(loser?.character_xp)) {
      throw new TypeError(`Defeated ${String(loser?.id)} needs a finite character_xp.`);
    }
    pot += loser.character_xp;
  }
  // AUTHORED: an equal share of the defeated side's total. See above.
  const basis = pot / winners.length;
  return {
    basis,
    payouts: winners.map((winner) => ({
      id: winner.id,
      ...ss2VictoryPurse({
        crowdInterest,
        loserXp: basis,
        winnerLevel: winner.herolevel,
        winnerGold: winner.goldpieces
      })
    }))
  };
}
