# Brief — RANGED COMBAT, for the next session

► **CLOSED 2026-09-13. RANGED IS BUILT.** Commit `7310583`. Every question
  below is answered, every "what is needed" is done, and the refusal this brief
  warned against lifting is gone — replaced by the vocabulary, which is what it
  said it was waiting for.

  **This file is now HISTORY. Read it to check a claim about how ranged got
  here; do not read it to learn what ranged IS.** That lives in the code:
  `Ss2ActionType`'s archer block, `legalActions`' two archer frames,
  `ss2ShotBlocked`, `ss2MaximumAmmo`, and `test/ss2-ranged.test.js`, which
  executes every branch of it.

  **What the owner decided, 2026-09-13**, against the four questions below:
  the swap costs a turn (the build's answer), an archer closed on inside
  `100 + physical_size` loses the bow and bashes (the build's answer),
  ammunition is finite and tiered (the build's answer), and a body between you
  and your target DOES block the shot (authored — the build cannot answer).

  **One premise in this brief was WRONG and it mattered.** It says a bow's
  `weapon_range` is ">= 4480". Two of the twenty ranged rows carry a range
  multiplier of 4 rather than 100 — ids 65 and 75 — so their reach is about
  262, and they walked straight past the construction refusal this brief called
  correct. Reproduced: `secondary_weapon: 65` with `equipped_weapon: 2` built a
  battle and was offered all three melee verbs at 262 units. The refusal was
  keyed on a consequence with an exception nobody had counted; see the commit.

---

**This is not a handoff.** It is the one ranked item the owner deliberately kept
for a session he is awake for, written while its ground was fresh so the next
agent does not re-derive it. The session handoff is the newest dated file in
this directory; read that first, then this.

**Owner, 2026-09-13:** *"We will hand off to next agent for ranged."*

---

## THE ONE THING TO READ BEFORE WRITING ANY CODE

**The module REFUSES a bow at construction today, and that refusal is CORRECT.**

`src/team/ss2-rules.js:2680`:

```js
const reach = declaredResourceValue(carrier, "weapon_range");
const arenaWidth = SS2_ARENA.clamp.max - SS2_ARENA.clamp.min;   // 4200
if (Number.isFinite(reach) && reach > arenaWidth) throw new TeamRuleSetError(...)
```

A bow's `weapon_range` is >= 4480 against a 4,200-unit arena, so
`fightdistance < weapon_range` **can never be shut** and the archer would be
offered MELEE verbs against every foe from the opening separation of 500. That
was reproduced, not theorised: strength 9 with `secondary_weapon: 63` and
`equipped_weapon: 2` got all three melee verbs at 500 units.

► **DO NOT CLAMP THE RANGE TO SILENCE IT.** The refusal is a placeholder for a
  missing VOCABULARY, not a bad number. Lift it *after* a ranged verb exists, or
  the first bow that constructs grants melee at 4,400 units. The refusal is
  stated in terms this rule set owns — a reach wider than its own arena — so any
  future route to an arena-spanning reach trips the same guard.

---

## THE BUILD'S OWN GATES, and the two sides DO NOT SHARE ONE

This is the fact most likely to be assumed wrong, and it is derived:

| who | gate | where |
|---|---|---|
| **hero**, frame-4 selector | `using_bow ? (fightdistance < 100 + hero.physical_size) : …` | it never reads `weapon_range` at all |
| **villain** AI | `(equipped_weapon == 1 && fightdistance < villain.weapon_range) \|\| (equipped_weapon == 2 && fightdistance < 200)` | `sprite:862/frame:52/DoAction@0x23f835` `+0x0356`, bow arm `+0x03ca` |

**So `fightdistance < 200` is the villain's bow gate and `100 + physical_size`
is the hero's.** A single shared gate would be an invention.

`using_bow` is forced false at battle construction (map `:111`), which is why
none of this has ever fired.

---

## WHAT IS ALREADY BUILT, so nobody rebuilds it

**The whole presentation layer for ranged is extracted and working.** Measured
on the shipped build this session:

```text
  bombard   23-frame animation (clip frames 1567-1589)   sound 1192.mp3
  snipe     19-frame animation (clip frames 1590-1608)   sound 1193.mp3
```

- `src/render/clip-labels.js` already maps `ranged -> ["bombard", "snipe"]`, so
  both the figure and the sound resolve the moment a `ranged` family exists.
- **Nine bow art ids are extracted**: weapon 201-207, 210, 220 — the `[5]`
  range-multiplier-100 rows. `assets/figure/wardrobe.json` holds them.
- `ammo_left` and `maximum_ammo` are already in the wire projection.
- `bombard_percentage` and `snipe_percentage` are already combatant resources.

**So the work is the RESOLVER's, and only the resolver's.** Nothing needs
drawing, extracting or binding.

---

## WHAT THE MAP SAYS IS NEEDED, untested

`src/team/ss2-rules.js:44` — `bombard`/`snipe` need `using_bow`, **a
`swap_weapons` turn**, and ammunition. The swap being a TURN is the interesting
part: it makes range a commitment rather than a mode, which is a real design
lever and is the owner's call.

---

## DECIDED BY THE OWNER — do not reopen

**2026-09-13: range WILL interact with the second axis.** See question 3 below
for what that does and does not settle.

## THE QUESTIONS THAT ARE THE OWNER'S, not an agent's

These are game feel and no measurement settles them. **Ask before building:**

1. **Does swapping to a bow cost a turn?** The map says the build does it that
   way. Keeping it makes archery a commitment; dropping it makes it a mode.
2. **What happens when an archer is closed on?** Vanilla's hero gate is
   `100 + physical_size` — roughly "you may only shoot what is NOT on top of
   you". Is that the game you want, or should an archer be able to fire into
   melee at a penalty?
3. ~~**Does the second axis interact with range?**~~ **ANSWERED BY THE OWNER,
   2026-09-13: "yes, range will interact with the second axis."**

   ► **AND IT IS CHEAPER THAN IT SOUNDS, because the metric already does half
     of it.** `getfightdistance` returns
     `round(sqrt(xdist^2 + ydist^2))` — the build's own distance is EUCLIDEAN
     over both axes, derived 2026-09-12 — and `ss2FightDistance` already
     implements it. **So a foe two ranks back is ALREADY further away**, and a
     range gate expressed as `fightdistance < N` is already a 2-D gate. Nothing
     needs adding for that much.

     What is NOT settled by it: whether a rank between you and your target
     BLOCKS the shot. The build cannot answer — vanilla has one gladiator a
     side, so there is never a body in the way — which puts line-of-sight
     squarely inside `MAP_SILENCE.multi-slot-arena-geometry` and makes it
     authored. **`ss2BodyBlocks` is the existing precedent** for that shape of
     rule: it gates the walk clamp on `|dy| < physical_size(foe)` and is
     authored inside the same silence.
4. **Ammunition: finite or not?** The resources exist. Nothing consumes them.

---

## THE TRAP THIS PROJECT ALREADY KNOWS ABOUT

**The AI arm is where ranged will go wrong.** `chooseAiAction` recognises verbs
by VOCABULARY, never by re-deriving geometry — `legalActions` offers a
toward-walk if and only if nothing is in reach, so the AI takes one whenever no
melee verb is on offer. **An archer breaks that invariant**: it will have a
ranged verb on offer while no melee verb is, and the existing arm would walk it
into melee anyway.

Read `chooseAiAction`'s comments before touching it. The rank-change arm beside
it carries the measured story of the pile-up machine, and the flanking arm added
2026-09-13 carries why it is narrow.

---

## HOW TO CHECK YOURSELF

```
node tools/engagement-census.mjs                 # defaults to the SHIPPED stride
node tools/engagement-census.mjs --rank-stride 0 # the 1-D before-picture
```

**If strides 97 and 150 ever return IDENTICAL censuses, you have rebuilt the
pile-up.** That is the tell, and it is cheaper than reading the AI.

And run the arena: `node tools/arena-server.mjs --host 0.0.0.0`, then the
address the banner prints. **Not `127.0.0.1` — WSL localhost forwarding on this
machine is intermittent**, which cost three sessions a false "healthy" reading
because every check was `curl` from inside WSL.
