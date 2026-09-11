# Reference patch — position in the resolver (UNBUILT, DO NOT APPLY BLIND)

**This is not shipped code and must not be applied as-is.** It is a working
prototype, preserved because it was measured and because rebuilding it costs a
session. Written 2026-09-10 against **`2c047b9`**; `src/team/ss2-rules.js` has
moved a long way since (the crowd toll and the swing-cost model both landed in
it), so the `ss2-rules.js` hunks will not apply cleanly and are here to be READ.

## Why it is not in `src/`

**Applying it deadlocks the animation gate.** A walk emits `clip-goto
Standing` — the idle clip — plus a spurious `unmapped`, because
`SS2_STATIC_MAP_BINDINGS` has no movement case and falls through to the attack
branch. That is the identical defect the owner found by watching the arena on
2026-09-10. Measured with this patch applied: the suite goes from green to
**72 failures and two files that hang** (`action-animation-gate`,
`render-arena-host`).

**So the order is presentation first, resolver second**, and this patch is the
second half. See the newest handoff's ranked list.

## What it does, and what it is evidence of

- `x` is born in `roster.js` from a new optional rule-set hook
  `startingPosition({ teamIndex, slotIndex })`, and carried on both
  `combatantView` and `combatantProjection` — so it enters `combatStateHash`.
- `EffectKind.POSITION` is absolute, never a delta, for the same reason
  `RESOURCE` writes `to` and not `by`.
- `ss2TeamRules` gains vanilla start geometry (hero `-(250 + 130*slot)`,
  villain `+(250 + 130*slot)`), `walk-left` / `walk-right` with the map's own
  stamina costs, and the controller-frame gate.
- **`fixtureReplay` models no position**, which is how all 23 goldens stayed
  green — the same seam the crowd toll and the swing cost later used.

**Measured when it ran:** ±250 start, **five walks a side**, ±30, then combat.
Five walks a side independently reproduces the archive statistic in
`docs/handoffs/2026-09-02-1659--three-waves-cut-at-the-usage-limit.md:194`
("only 26.6% of rounds reached range in FEWER than five walks"), from the
weapon table and the construction geometry, neither of which knows about it.
In range the vocabulary was three melee verbs plus **only the retreat walk**,
which is the map's `closerange_warrior` row reproduced.

## Things it gets wrong that a rebuild should not repeat

1. It adds `movement_speed` to `SS2_RESOURCE_NAMES`. That was never ported and
   is a second wire-vocabulary change — decide it deliberately rather than
   inheriting it.
2. Its reach is `physical_size` for everyone, because the weapon id is outside
   the projected vocabulary. That is a NARROWING of the build, documented in
   the hunk, not a derivation.
3. It never implements the taunted-run row, deliberately: nothing in this
   engine sets `taunted1`, so the branch would be unreachable.

```diff
--- a/src/team/roster.js	2026-09-11 15:16:05.332843826 -0400
+++ b/src/team/roster.js	2026-09-10 16:17:44.937321675 -0400
@@ -130,7 +130,7 @@
  * Normalises one combatant source. This is the only combatant constructor in
  * the codebase; AI fill goes through it too.
  */
-export function normaliseCombatant(source, teamId, index, rules) {
+export function normaliseCombatant(source, teamId, index, rules, teamIndex = 0) {
   const stats = {
     strength: source.stats?.strength ?? DEFAULT_STATS.strength,
     agility: source.stats?.agility ?? DEFAULT_STATS.agility,
@@ -162,8 +162,32 @@
     maxHealth: source.maxHealth,
     health: source.health,
     alive: true,
-    status: normaliseStatus(source.status)
+    status: normaliseStatus(source.status),
+    /**
+     * Where this gladiator stands, in the build's own arena coordinates.
+     *
+     * `null` for a rule set that models no position — which is every rule set
+     * that declares no `startingPosition`, the placeholder included — and a
+     * finite number for one that does. It is NOT optional-and-absent: the key
+     * is always present so `combatStateHash` commits to the same shape for
+     * every rule set, and a `null` says "this battle has no geometry" rather
+     * than leaving two peers to disagree about whether the field exists.
+     *
+     * A blueprint may state it outright; that wins, exactly as a declared
+     * `maxHealth` overrules the derived one.
+     */
+    x: null
   };
+  combatant.x = Number.isFinite(source.x)
+    ? source.x
+    : (typeof rules.startingPosition === "function"
+      ? rules.startingPosition({ teamIndex, slotIndex: index, combatant })
+      : null);
+  if (combatant.x !== null && !Number.isFinite(combatant.x)) {
+    throw new BattleError(
+      `Rule set ${rules.id} returned a non-finite starting position for ${combatant.id}.`
+    );
+  }
   combatant.maxHealth = rules.maximumHealth(combatant);
   combatant.health = clamp(combatant.health ?? combatant.maxHealth, 0, combatant.maxHealth);
   combatant.alive = combatant.health > 0;
@@ -323,7 +347,7 @@
       // The marker itself is this slot's nearest fill source, so it is passed
       // through rather than discarded once `isEmptySlot` has read it.
       const source = filled ? aiFillSource({ ...team, id, name }, index, entry) : entry;
-      const combatant = normaliseCombatant(source, id, index, rules);
+      const combatant = normaliseCombatant(source, id, index, rules, teamIndex);
       combatant.aiFilled = filled;
       combatants.push(combatant);
       // A filled slot's seat is the AI's by construction; `assertFillTemplate`
--- a/src/team/resolver.js	2026-09-11 15:16:05.359243826 -0400
+++ b/src/team/resolver.js	2026-09-10 16:19:06.171115354 -0400
@@ -195,7 +195,8 @@
     maxHealth: combatant.maxHealth,
     health: combatant.health,
     alive: combatant.alive,
-    status: Object.freeze([...combatant.status])
+    status: Object.freeze([...combatant.status]),
+    x: combatant.x
   });
 }
 
@@ -261,6 +262,19 @@
       target.health = clamp(target.health + effect.amount, 0, target.maxHealth);
     } else if (effect.kind === EffectKind.RESOURCE) {
       writeResource(target, effect.resource, effect.to, { ruleSetId: battle.rules.id });
+    } else if (effect.kind === EffectKind.POSITION) {
+      if (!Number.isFinite(effect.to)) {
+        throw new BattleError(
+          `Rule set ${battle.rules.id} moved ${effect.targetId} to a non-finite position.`
+        );
+      }
+      if (target.x === null) {
+        throw new BattleError(
+          `Rule set ${battle.rules.id} moved ${effect.targetId}, which models no position. ` +
+          "A rule set that emits POSITION effects must also declare startingPosition()."
+        );
+      }
+      target.x = effect.to;
     } else if (effect.kind === EffectKind.STATUS) {
       const present = target.status.includes(effect.status);
       if (effect.active === false && present) {
@@ -491,7 +505,8 @@
     maxHealth: combatant.maxHealth,
     health: combatant.health,
     alive: combatant.alive,
-    status: [...combatant.status]
+    status: [...combatant.status],
+    x: combatant.x
   };
 }
 
--- a/src/team/rule-set.js	2026-09-11 15:16:05.390043823 -0400
+++ b/src/team/rule-set.js	2026-09-10 16:23:04.670669661 -0400
@@ -68,7 +68,16 @@
   DAMAGE: "damage",
   HEAL: "heal",
   STATUS: "status",
-  RESOURCE: "resource"
+  RESOURCE: "resource",
+  /**
+   * Move a combatant to an absolute arena x.
+   *
+   * Absolute rather than a delta, for the same reason `RESOURCE` writes `to`
+   * and not `by`: an effect log has to be replayable out of order without
+   * accumulating drift, and a rule set that already clamped is entitled to
+   * have its clamped value survive the resolver.
+   */
+  POSITION: "position"
 });
 
 const REQUIRED_FUNCTIONS = Object.freeze([
@@ -277,6 +286,16 @@
           `Rule set ${ruleSetId} produced a resource effect without a finite absolute \`to\` value.`
         );
       }
+    } else if (effect.kind === EffectKind.POSITION) {
+      // Absolute, for the same reason RESOURCE is: a replayed effect must land
+      // a combatant on the same coordinate whatever the peer thought it held.
+      // Signed, unlike an amount — walking left is a negative coordinate, not
+      // a negative distance.
+      if (!Number.isFinite(effect.to)) {
+        throw new TeamRuleSetError(
+          `Rule set ${ruleSetId} produced a position effect without a finite absolute \`to\` value.`
+        );
+      }
     } else if (!Number.isFinite(effect.amount) || effect.amount < 0) {
       throw new TeamRuleSetError(
         `Rule set ${ruleSetId} produced a ${effect.kind} effect without a non-negative finite amount.`
--- a/src/team/ss2-rules.js	2026-09-11 15:16:05.416443825 -0400
+++ b/src/team/ss2-rules.js	2026-09-10 16:22:38.177695277 -0400
@@ -242,6 +242,14 @@
   NORMAL_ATTACK: "normal-attack",
   POWER_ATTACK: "power-attack",
   REST: "rest",
+  // MOVEMENT. Direction-ABSOLUTE, because the build's buttons are: every
+  // controller frame wires `walkleft` and/or `walkright` by name and the
+  // player picks a direction, not a relationship to the opponent. A
+  // "walk-toward" token would be this engine inventing a decision the build
+  // does not offer, and would lose the case the map is explicit about — that
+  // `closerange_warrior` wires only the AWAY direction in both facings.
+  WALK_LEFT: "walk-left",
+  WALK_RIGHT: "walk-right",
   // The four status phases. FOUR types rather than one `status-phase`, because
   // the build's decision IS the specific label — `getphase("frozen")` and
   // `getphase("poisoned")` are different decisions reaching different arms of
@@ -256,12 +264,129 @@
   LIFE_STOLEN_PHASE: "life-stolen-phase"
 });
 
+/**
+ * ARENA GEOMETRY — where gladiators stand, and how far a step carries them.
+ *
+ * Three of these four numbers are the build's, cited. The fourth is AUTHORED
+ * and is the only unmeasured number this rule set adds; see
+ * `MAP_SILENCE.movement-displacement` in `src/adapter/vanilla-fields.js` for
+ * the measurement that would settle it without a new capture.
+ */
+export const SS2_ARENA = Object.freeze({
+  /**
+   * Map, "Battle entry" step 5: the runtime clips are placed at `(-250, 200)`
+   * and `(250, 200)`, hero facing right and villain facing left. So the
+   * separation at construction is 500 — which
+   * `docs/integration/ss2-champion-dna.md:710-712` states independently, from
+   * `getfightdistance`, and which `src/adapter/slot-layout.js`'s
+   * `VANILLA_FRONT_X` already ships for the presentation side.
+   */
+  frontX: 250,
+  /**
+   * AUTHORED, and it matches the adapter's `ALLY_X_STRIDE` on purpose: vanilla
+   * has no second ally, so nothing can settle it (`MAP_SILENCE`,
+   * `multi-slot-arena-geometry`). Allies stand FURTHER OUT than slot 0, so
+   * slot 0 keeps the vanilla pair exactly and 1v1 stays the parity case.
+   */
+  allyStride: 130,
+  /**
+   * Map, `nextphase` step 1. **Read the caveat before citing this.** The map
+   * states the bound in PROSE with no byte offset anywhere in the repository,
+   * while the only line that carries offsets for the clamp — the four `_x`
+   * `If`s at `+0x31cc`, `+0x31f8`, `+0x3224`, `+0x3250` — states no literals
+   * at all. It is the build's number as far as this repository knows and no
+   * further.
+   */
+  clamp: Object.freeze({ min: -2100, max: 2100 }),
+  /**
+   * **AUTHORED. The one number here that no byte supports.**
+   *
+   * How far a completed `walkleft`/`walkright` phase carries a gladiator. The
+   * map gives every movement phase's stamina COST with an offset (`walkleft`
+   * `+0x3b37` and its siblings) and no phase's DISTANCE; the only `_x` writes
+   * it records anywhere are the four clamps above.
+   *
+   * 44 is not invented from nothing, and it is not measured either. It is the
+   * single figure in the whole repository —
+   * `docs/handoffs/2026-09-02-1659--three-waves-cut-at-the-usage-limit.md:194`,
+   * *"one walk is 44 px"*, uncited, in a frozen handoff. An adversarial reader
+   * proposed it is a conflation with the range multiplier in
+   * `weapon_range = physical_size + weapon[5] * 44`. It survives a check from
+   * the other direction: the same handoff line reports, from real rounds, that
+   * only 26.6% of them reached range in FEWER than five walks — and at 44px
+   * with both gladiators closing, four walks each leaves the champion staging
+   * at `fightdistance` 148 against its `weapon_range` 144 (out), five leaves
+   * 60 (in). It reproduces the archive's own five-walk boundary to within four
+   * pixels, from the weapon table and the construction geometry, neither of
+   * which knows about it.
+   *
+   * That is a CONSISTENCY CHECK, not a promotion. It may never be cited as
+   * evidence about the game.
+   */
+  walkDistance: 44
+});
+
+/** Rounded x-separation of two gladiators — `getfightdistance`, champion-dna:710-712. */
+export function ss2FightDistance(a, b) {
+  if (!Number.isFinite(a?.x) || !Number.isFinite(b?.x)) return null;
+  return Math.round(Math.abs(a.x - b.x));
+}
+
+
+/**
+ * How far this gladiator's swing reaches, in arena units.
+ *
+ * `weapon_range = physical_size + weapon[5] * 44` (`battlevalues` `+0x3190`,
+ * `docs/integration/ss2-item-tables.md:331`), and an UNARMED gladiator's
+ * `weapon_range` is exactly `physical_size` (`ss2-item-tables.md:58`,
+ * `c.weapon_range = c.physical_size`).
+ *
+ * This engine cannot see a weapon id: `weapon` is equipment identity and is
+ * deliberately outside `CANONICAL_RESOURCE_SOURCES` and `SS2_RESOURCE_NAMES`
+ * ("the piece *ids* are equipment identity, not a numeric pool"). So reach is
+ * the unarmed default — `physical_size = 80 + round(strength / 1.5)`
+ * (`+0x30f1`) — for everyone, and that is a NARROWING of the build rather than
+ * an invention: every real weapon reaches at least this far, so a gladiator
+ * here closes further than one in the build would need to. Declaring
+ * `weapon_range` as a resource is the opt-in that would fix it, and is the
+ * same shape as the `resources` override `toCanonicalCombatantSource` already
+ * takes; it is deliberately NOT added here, because it is a second wire-
+ * vocabulary change and one per commit is the rule this projection's shape
+ * pins exist to enforce.
+ */
+function ss2Reach(actor) {
+  return 80 + Math.round(actor.stats.strength / 1.5);
+}
+
+/** The living foe standing closest, or null. Ties break by id, deterministically. */
+function nearestFoe(view) {
+  let best = null;
+  let bestDistance = Infinity;
+  for (const foe of view.foes) {
+    const distance = ss2FightDistance(view.actor, foe);
+    if (distance === null) continue;
+    if (distance < bestDistance || (distance === bestDistance && best && foe.id < best.id)) {
+      best = foe;
+      bestDistance = distance;
+    }
+  }
+  return best;
+}
+
+/** Which way a walk carries its actor. Left is negative x, as in the build. */
+const SS2_WALK_DIRECTION = Object.freeze({
+  [Ss2ActionType.WALK_LEFT]: -1,
+  [Ss2ActionType.WALK_RIGHT]: 1
+});
+
 /** Action token -> the `getphase` label the build knows it by. */
 export const VANILLA_PHASE_LABEL = Object.freeze({
   [Ss2ActionType.QUICK_ATTACK]: "quick_attack",
   [Ss2ActionType.NORMAL_ATTACK]: "normal_attack",
   [Ss2ActionType.POWER_ATTACK]: "power_attack",
   [Ss2ActionType.REST]: "rest",
+  [Ss2ActionType.WALK_LEFT]: "walkleft",
+  [Ss2ActionType.WALK_RIGHT]: "walkright",
   // Three spellings for one effect, and the map is explicit that they are not
   // interchangeable: the FIELD is `poison`, the DECISION label is `poisoned`,
   // and `life_stolen` keeps its spelling as a decision but reaches
@@ -497,6 +622,11 @@
   "herolevel",
   "max_damage",
   "min_damage",
+  // `battlevalues` `+0x37d2` already derives this at `ss2BattleValues`; until
+  // 2026-09-10 the `SS2_RESOURCE_NAMES` filter in `ss2Combatant` then dropped
+  // it, so nothing downstream could read it. Movement costs it, so it is
+  // carried now.
+  "movement_speed",
   "secondary_weapon_enchantment_damage",
   "secondary_weapon_enchantment_potency",
   "secondary_weapon_enchantment_type",
@@ -595,6 +725,15 @@
   charisma: 0,
   equipped_weapon: 1,
   herolevel: 1,
+  /**
+   * The build's OWN FLOOR, not a convenience zero:
+   * `movement_speed = clamp(round(speed * 1.5), 4, 60)` (`+0x37d2`) cannot
+   * produce a smaller number however slow a gladiator is. A combatant that
+   * declares no `speed` therefore walks at the cheapest rate the build has,
+   * which is the honest reading of "unknown", and never at a rate the build
+   * could not produce.
+   */
+  movement_speed: 4,
   // Declared with a defensible zero: no enchantment means no tick damage. The
   // status phase reads these at TICK time off whoever inflicted the condition,
   // matching the build, which reads `game_defender.weapon_enchantment_damage`
@@ -1448,6 +1587,30 @@
     fightMode,
 
     /**
+     * Where slot `slotIndex` of team `teamIndex` starts.
+     *
+     * Team 0 is the hero side and stands at negative x, team 1 the villain
+     * side at positive x — map, "Battle entry" step 5, `(-250, 200)` and
+     * `(250, 200)`. Allies stand further out, which keeps slot 0 of each side
+     * byte-identical to the vanilla pair.
+     *
+     * **`fixtureReplay` returns `null` instead, and that is not a shortcut.**
+     * A promoted golden is a measurement of ONE resolved action, staged in the
+     * running game at whatever separation that capture had. Giving it a
+     * construction position this engine invented, and then gating its swing on
+     * that invention, would make 23 runtime-verified fixtures replay through a
+     * geometry no capture observed. A fixture models no position, so it has
+     * none, and `legalActions` below falls back to the position-blind
+     * vocabulary for exactly the callers that ask for it.
+     */
+    startingPosition({ teamIndex, slotIndex }) {
+      if (fixtureReplay) return null;
+      const side = teamIndex === 0 ? -1 : 1;
+      const magnitude = SS2_ARENA.frontX + SS2_ARENA.allyStride * slotIndex;
+      return clamp(side * magnitude, SS2_ARENA.clamp.min, SS2_ARENA.clamp.max);
+    },
+
+    /**
      * `hitpointsmax = herolevel * 10 + vitality * 20`, `battlevalues`
      * `+0x378e` — but ONLY as a fallback.
      *
@@ -1517,11 +1680,54 @@
       if (forced) return [{ type: SS2_STATUS_PHASE_FOR_FLAG[forced], targetId: actorId }];
 
       const actions = [];
+      const reach = ss2Reach(view.actor);
+      const positioned = Number.isFinite(view.actor.x);
+
+      // THE CONTROLLER FRAME, reproduced. The build picks one of four frames
+      // per turn and each wires a different eight buttons; for a melee hero
+      // that is `closerange_warrior` vs `longrange_warrior`, selected by
+      // `fightdistance < hero.weapon_range` (frame 4 `DoAction@0x238bbf`
+      // `+0x00f6`).
+      //
+      // A gladiator with NO position keeps the old position-blind vocabulary
+      // exactly — three melee verbs against every foe — which is what
+      // `fixtureReplay` asks for and what every rule set that declares no
+      // `startingPosition` gets.
+      let anyInReach = !positioned;
       for (const foe of view.foes) {
+        const distance = ss2FightDistance(view.actor, foe);
+        const inReach = distance === null || distance < reach;
+        if (!inReach) continue;
+        anyInReach = true;
         actions.push({ type: Ss2ActionType.QUICK_ATTACK, targetId: foe.id });
         actions.push({ type: Ss2ActionType.NORMAL_ATTACK, targetId: foe.id });
         actions.push({ type: Ss2ActionType.POWER_ATTACK, targetId: foe.id });
       }
+
+      if (positioned) {
+        // Which walk buttons the frame wires, from the map's own table
+        // (battle map, "Buttons wired per controller frame", `:223-230`).
+        //
+        // ► **THAT TABLE CONTRADICTS ITS OWN SUMMARY SENTENCE at `:219`**,
+        //   which says the label set is "facing-invariant apart from the
+        //   charge/ranged handedness". Compared as SETS, three of the four
+        //   controllers differ between facings in MOVEMENT labels too. Only
+        //   `longrange_warrior` matches the summary. Re-derived by hand
+        //   2026-09-10; the table wins, because it carries the offsets.
+        //
+        // The consequence is a real rule and not a nit: `closerange_warrior`
+        // wires NO toward-movement in either facing — facing right it wires
+        // `jumpleft`/`walkleft`, facing left `jumpright`/`walkright`, both of
+        // which are RETREAT. Once you are in range the build lets you back
+        // out and never further in. `longrange_warrior` wires both.
+        const nearest = nearestFoe(view);
+        const towardIsRight = nearest ? nearest.x > view.actor.x : true;
+        const away = towardIsRight ? Ss2ActionType.WALK_LEFT : Ss2ActionType.WALK_RIGHT;
+        const toward = towardIsRight ? Ss2ActionType.WALK_RIGHT : Ss2ActionType.WALK_LEFT;
+        actions.push({ type: away, targetId: actorId });
+        if (!anyInReach) actions.push({ type: toward, targetId: actorId });
+      }
+
       actions.push(rest);
       return actions;
     },
@@ -1583,6 +1789,50 @@
         };
       }
 
+      const walkDirection = SS2_WALK_DIRECTION[request.type];
+      if (walkDirection) {
+        if (!Number.isFinite(actor.x)) {
+          throw new TeamRuleSetError(
+            `${request.type} needs a position, and ${actor.id} has none. A rule set built with ` +
+            "fixtureReplay: true models no geometry and never offers a walk."
+          );
+        }
+        // `walkleft` `+0x3b37` / `walkright` `+0x3d16`:
+        // `staminacost = round(movement_speed / 2)`. Spent by `nextphase`'s
+        // subtraction like every other phase, so the same helper applies it
+        // and the transition's heal and regeneration still run — a walk is a
+        // completed phase, not a free step.
+        const movementSpeed = resourceValue(actor, "movement_speed", SS2_RESOURCE_DEFAULTS.movement_speed);
+        const transition = phaseTransitionEffects(actor, {
+          staminaCost: Math.round(movementSpeed / 2)
+        });
+        // `nextphase` step 1 clamps the active x before anything else it does.
+        const to = clamp(
+          actor.x + walkDirection * SS2_ARENA.walkDistance,
+          SS2_ARENA.clamp.min,
+          SS2_ARENA.clamp.max
+        );
+        return {
+          effects: [
+            { kind: EffectKind.POSITION, targetId: actor.id, to },
+            ...transition.effects
+          ],
+          events: [{
+            type: request.type,
+            actorId: actor.id,
+            targetId: actor.id,
+            from: actor.x,
+            to,
+            // Reported rather than left to be recomputed: the CLAMP can make
+            // this smaller than `SS2_ARENA.walkDistance`, and a presentation
+            // surface animating the step needs the distance actually travelled.
+            distance: Math.abs(to - actor.x),
+            staminaGained: transition.staminaGained,
+            healed: transition.healed
+          }]
+        };
+      }
+
       const band = ATTACK_BANDS[request.type];
       if (!band) {
         throw new TeamRuleSetError(`Rule set ${ruleSetId} was asked to resolve unknown action ${request.type}.`);
@@ -1764,6 +2014,31 @@
       const target = foes[0];
       if (!target) return restOption ?? options[0];
 
+      // OUT OF POSITION: close the distance. The build's own villain has
+      // "out-of-position movement chains — the arm taken while the opponent is
+      // still closing the distance" (battle map, § Direction 20 is the taunt
+      // path), so an AI that moves is the right SHAPE; the arm's `choices`
+      // bands are not decoded, so WHICH movement verb it picks is invented,
+      // like the rest of this policy.
+      //
+      // Recognised by the vocabulary rather than by re-deriving the geometry:
+      // `legalActions` already offered a toward-walk if and only if nothing
+      // was in reach, so taking it whenever no melee verb is on offer needs no
+      // second opinion about who is where — and cannot disagree with the one
+      // that gated the list.
+      const meleeOnOffer = options.some((option) => ATTACK_BANDS[option.type]);
+      if (!meleeOnOffer) {
+        const nearest = nearestFoe(view);
+        if (nearest) {
+          const towardType = nearest.x > view.actor.x ? Ss2ActionType.WALK_RIGHT : Ss2ActionType.WALK_LEFT;
+          const stride = options.find((option) => option.type === towardType);
+          // Stamina still outranks it: the forced-rest gate above already
+          // returned at <= 10, so reaching here means the walk is affordable
+          // in the only sense the build has — it does not refuse to spend.
+          if (stride) return stride;
+        }
+      }
+
       const attacker = vanillaRecordOf(actor, "attacker");
       const defender = vanillaRecordOf(target, "defender");
       const chances = calculateSs2AttackChances(attacker, defender);
```
