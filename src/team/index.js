/**
 * The team seam: one shared resolver for 1v1, 2v2 and 3v3.
 *
 * Module layout, one responsibility each:
 *
 * | module              | owns                                                    |
 * | ------------------- | ------------------------------------------------------- |
 * | `rule-set.js`       | the injection contract and the verified/placeholder gate |
 * | `placeholder-rules.js` | the only formulas in the tree, all placeholder        |
 * | `rng.js`            | the ordered authoritative RNG channel                    |
 * | `resources.js`      | the open, clamped, hashed numeric bag, per combatant and (since 2026-09-22) per battle |
 * | `roster.js`         | teams, slots, combatant identity, AI fill                |
 * | `controllers.js`    | seat -> controller identity, independent of combatants   |
 * | `elimination.js`    | knockouts, combatant-defeated, team elimination          |
 * | `settlement.js`     | once-only campaign settlement behind two gates           |
 * | `resolver.js`       | turn order, legality, effect application, events         |
 *
 * One module in this directory is deliberately NOT re-exported here:
 * `ss2-rules.js`, the map-derived SS2 rule set. It is the only file under
 * `src/team/` that imports from `src/golden/`, and making every consumer name
 * that import at its own call site is the honest signal for a dependency the
 * rest of the seam does not have. Import it directly:
 * `import { ss2TeamRules } from "./team/ss2-rules.js"`. Its SS2 siblings are not
 * re-exported either, for the same reason: `ss2-weapon-table.js`, and
 * `ss2-crowd.js` (the build's `crowd_interest`, its per-phase deltas and the
 * victory purse, 2026-09-22).
 *
 * Node builtins only; no assets, no game data, no third-party dependencies.
 */

export * from "./errors.js";
export * from "./rule-set.js";
export * from "./placeholder-rules.js";
export * from "./rng.js";
export * from "./resources.js";
export * from "./controllers.js";
export * from "./roster.js";
export * from "./elimination.js";
export * from "./settlement.js";
export * from "./resolver.js";
