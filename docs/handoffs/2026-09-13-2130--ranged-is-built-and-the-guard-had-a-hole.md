---
handoff:      2026-09-13-2130--ranged-is-built-and-the-guard-had-a-hole
written:      2026-09-13 21:30 -0400
sessionId:    b4ca2b15-791c-4a4f-bc62-ef21baf9e095 (https://claude.ai/code/session_011q5EGZx2wrjBBFpiGHRB6v)
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      de54749..HEAD: `7310583` builds ranged, `301277a` fixes what
              Codex found in it, `849ca06` fixes what the OWNER found by
              looking at it. **Re-measure; never copy.**
suite:        1129 / 1128 / 0 / 1 (fresh-clone profile — `captures/` holds only
              its manifest and README), measured after `849ca06` BY EXIT CODE.
              **Re-measure; never copy.**
agentRuns:    one Codex `/adversarial-review` on `HEAD~1..HEAD`, model pinned
              `gpt-6-astra`. No fan-out wave: ADR 0001 makes a wave the LAST
              resort and this was a diff, not a claim about the archive.
supersedes:   2026-09-13-1600--everything-but-ranged-is-closed, **whose one
              ranked item was ranged and is now done**, and
              `docs/handoffs/RANGED-BRIEF.md`, which is CLOSED and is now
              history.
next:         **Nothing is blocking.** The board is the ranked list below, and
              item 1 is the owner's and takes five minutes.
---
# Handoff — ranged is built, and the guard holding it shut had a hole

## The one-sentence version

The bow, both shots, the bash and the turn that arms one are built, measured and
playable; the refusal that had been standing in front of them turned out to miss
two of the twenty bows it was written for, and so did its replacement.

## What ranged IS, in one screen

```text
  bombard   direction 21   chance ratio*100*0.60   randomBetween(min, max)
  snipe     direction 22   chance ratio*100*0.90   flat min_damage
  bash      direction 23   chance ratio*100*0.20   ceil(min_damage / 2)
  swap      one turn, staminacost 1, no controller frame wires it
```

**An archer has a MINIMUM range and no maximum.** `fightdistance < 100 +
physical_size` selects `closerange_archer`, which wires `bash_attack` and no
shot at all — so closing on an archer shuts its bow down completely, and the
gate never reads `weapon_range`, which is why a bow's 4,480-unit reach never
mattered in vanilla. The controller is chosen **once per turn by the nearest
foe**, not per foe; a per-foe reading would let an archer bash the fighter on
top of it and shoot the one across the arena in the same turn, which makes
closing on it worth nothing.

**Almost all of it was already here.** The swing arithmetic for 21 and 22 has
been in `ss2-attack-candidate.js` the whole time, `bombard`/`snipe` were
extracted and bound to sound in September, and `ss2BattleValues` already carried
the bow override. What was missing was the vocabulary — which is exactly what
the construction refusal said it was waiting for.

## THE OWNER'S FOUR DECISIONS, 2026-09-13 — do not reopen

He took **the build's own answer to three of them**:

1. **The swap costs a turn**, and one stamina. Archery is a commitment.
2. **An archer closed on loses the bow and bashes.** No firing into melee.
3. **Ammunition is finite and tiered** — 5 / 10 / 15 / 20 / 25 / 30 by
   `herolevel` — and running dry FORCES a swap back to melee.
4. **A body between you and your target blocks the shot.** This one the build
   cannot answer and it is the single authored rule in the feature.
   **CORRECTED THE SAME EVENING, by the owner looking at it: only an ENEMY
   screens.** He asked whether an archer should be able to attack either enemy
   and the answer was no — it could reach exactly one, blocked by its OWN ALLY,
   structurally, because allies stagger diagonally and the rank-0 ally always
   lands just off the rank-1 archer's lane. See the block below.

## THE LESSON, and it is one lesson told THREE TIMES in one session

► **A GUARD KEYED ON A CONSEQUENCE HAS AN EXCEPTION NOBODY COUNTED.**

The refusal that held ranged shut fired on `weapon_range > arena width`,
reasoning that a type-4 row's range multiplier is 100 so a bow's reach is at
least 4,480 against a 4,200-unit arena. **Two of the twenty ranged rows carry 4,
not 100** — ids 65 and 75, item tables `:472` and `:482`. Their reach is about
262, comfortably inside the arena.

Reproduced before it was believed: strength 9 with `secondary_weapon: 65` and
`equipped_weapon: 2` **built a battle, walked in, and was offered all three
melee verbs at 262 units** — a longer reach than any sword in the game, swung
with a bow. That is precisely the defect the guard existed to prevent, and it
had been live since the guard was written.

► **AND I MADE THE SAME MISTAKE ONE REVISION LATER, with the correction to the
  first one written directly above it in the same comment block.** The
  replacement refused `equipped_weapon == 2` outright, because root frame 221
  forces melee mode at battle construction. True — and still keyed on the wrong
  thing: a state the build reaches on turn two is not impossible, it is one a
  capture can observe and a campaign can resume into. It now refuses the actual
  contradiction, bow mode with an EMPTY secondary slot, which is what the build
  hides its own swap button for.

► **AND THEN CODEX FOUND THE THIRD, WHICH WAS THE BACKSTOP I HAD LEFT IN
  PLACE.** `/adversarial-review` on `7310583` (model pinned `gpt-6-astra`, one
  finding, verified by reproduction before it was believed):
  `ss2Combatant(..., { battleStarted: true })` runs `ss2BattleValues` with
  `using_bow` true, the bow block overwrites the three melee fields in place,
  and **they never come back**. A restored archer that swapped to melee fought
  at 17-73 damage and reach 262 where its own sword says 21-27 and 130 — and
  the reach backstop did not fire, because it was still keyed on
  `weapon_range > arena width` and bow 65's 262 sails under it. **The same two
  rows, the same exception, in a guard sitting directly below the comment
  explaining why that criterion is wrong.**

  Fixed at the root rather than with a fourth guard: when a record states
  `using_bow`, derive a second time with the bow put away and take the three
  melee fields from that run. A legitimately-derived record can no longer carry
  an arena-spanning `weapon_range` at all, so the backstop now fires only on a
  hand-written bag, which is what it is kept for.

**WRITING DOWN WHY A CONSEQUENCE-KEYED GUARD IS WRONG DOES NOT STOP YOU LEAVING
ONE IN PLACE.** That is the transferable part, and it cost three rounds here.

**What actually closes the melee-verbs-with-a-bow defect is the VOCABULARY, not
a guard at all**: neither archer frame wires a melee verb, whatever the reach
says. A sweep over all twenty ranged rows pins it, so a fourth exception cannot
hide.

## THE SEVENTH INSTANCE, and this one had been audible for a day

► **THE SOUND WAS PICKING ITS OWN CLIP.** `animationFor` has always preferred
  the engine's own label over the family's first, with a comment explaining that
  drawing `attack1` for every attack throws away a choice the resolver already
  made. **`chooseSound` had no such rule**: it spread across every file bound to
  any label in the family, indexed by a counter. So the figure played `attack3`
  while the speaker played whichever of `1092`-`1095` the counter landed on.

  Two halves of one join disagreeing — with the correct rule written out in full
  on the other side of it.

  Ranged is what made it undeniable rather than merely wrong: `bombard` and
  `snipe` share one `ranged` family and have DIFFERENT sounds, so a snipe would
  have loosed a bombard the first time anyone drew a bow. **Caught before the
  feature shipped rather than after the owner heard it**, which is the only
  reason this one did not cost a session. `test/ss2-ranged.test.js` pins it
  across every sequence number, because the defect was a counter and one sample
  could have landed on the right file by luck.

## THE OWNER FOUND THE NEXT ONE IN A MINUTE, AND IT IS THE USUAL ROUTE

► **THE ARCHER HAD ONE TARGET.** Measured at the opening, before the fix: the
  archer at `(-380, 103)` and its own rank-0 ally at `(-250, 200)`, which sits
  **76.1 units off the lane** to the enemy's front against its own
  `physical_size` of 86. So `blue-1` was blocked by `red-1` and `blue-3` by
  `blue-2` — one legal target out of three, every seed, every size.

  **Only the ENEMY screens now.** The tactical idea survives and sharpens: the
  enemy's front rank screens the enemy's BACK rank, so a shot at their rear is
  still something you move for. What is gone is your own line standing in your
  way.

  ► **AND IT IS DELIBERATELY THE OPPOSITE OF `ss2WalkDestination`'s RULE**,
    which iterates every living body because `physical_size` "does not know
    whose side the body is on". That is right for a WALK — a body moving
    through space cannot pass through anyone. **A shot passes OVER a formation
    that is cooperating with the shooter.** Two questions, two answers; copying
    one into the other is what produced the one-target archer.

  `ss2ShotBlocked` is unchanged and still knows no sides — it is pure geometry
  and the policy is the caller's. **A test would have gone quiet over this**:
  the axis-off pin staged its blocker as an ALLY, so after the change it would
  have passed whatever the second axis was doing while still reading as a pin on
  it. Restaged with a foe.

  Bombards went 237 -> 240 and swaps 92 -> 96, which are the arithmetic maxima
  (2 archers x 5 arrows x 24 seeds, and 2 swaps each). **Every archer now finds
  a target every turn it has an arrow** rather than dying with arrows left
  because the only foe it could see was already dead.

## What was re-read off the installed build rather than taken from prose

`77cb545c…`, via `tools/inspect-swf.mjs`:

```text
  maximum_ammo tiers  +0x3634-+0x378d   <9 5, <23 10, <28 15, <35 20, <45 25, else 30
  ranged staminacost  +0x6bb5           round(strength * 3), ONE shared branch
  ammo decrement      +0x6bf5-+0x6c14   unguarded, -1 per shot
  bombard / snipe     +0x6c52 / +0x6c77 gotoAndPlay("bombard") / ("snipe")
  bash_attack         +0x6475 / +0x64ce round(strength * 2), gotoAndPlay("Attack2")
  swap_weapons        +0x4d35 / +0x4d65 staminacost 1, gotoAndPlay("Block")
```

► **`attack23` IS NOT A CLIP AND THE PRESENTATION WAS ABOUT TO EMIT ONE.** The
  fighter carries `attack1`-`attack12` and nothing higher. Direction 23 plays
  `Attack2`, named outright eleven bytes after the direction is assigned. Same
  failure as the `hurt21`/`hurt22`/`hurt23` correction: a label invented by
  arithmetic on a direction number while the build names one nearby.

► **`whichweapon` IS NEVER ASSIGNED ANYWHERE IN THE BUILD.** `battlevalues`
  reads `attack_type` and `attack_speed` off it at `+0x3450`/`+0x346a`, and
  those are the only four references to the name in the whole SWF. **So the
  build's own `attack_speed` is `undefined` in both weapon modes**, and this
  engine's derivation of it is authored in both. Recorded rather than acted on —
  but it means `SS2_SWING`'s `weaponweights` index has a weaker footing than its
  comment implies, and anybody re-deriving that should start here.

## Measured, 24 seeds a size, through the arena's own host path

```text
                   1v1      2v2      3v3
    settled       24/24    24/24    24/24
    bombards          0      237      237
    swaps             0       92       92
    arrows left       -    0 of 5   0 of 5
```

The 2v2 and 3v3 shot counts are identical because they are bounded by
**ammunition**, not team size: two archers, five arrows each, 24 seeds. **The
pile-up tell is absent** — strides 97 and 150 return clearly different censuses.

► **`snipe` WAS CHOSEN ZERO TIMES, AND THAT IS THE BUILD'S ARITHMETIC RATHER
  THAN A DEFECT.** Against the demo roster's attack 8 / defence 5 the expected
  damage is 13.1 for bombard against 11.9 for snipe. Swept across 1,600 stat
  combinations, **snipe wins 10.7% of them** — it favours low attack and weak
  bows. Recorded rather than tuned. **So snipe's resolution path is exercised
  only by tests today**, which is worth knowing before trusting it in play.

## A defect this session introduced, and what found it

The first version of the archer branch left a **position-blind archer mute** —
no shot, no bash, only a swap and a rest, which is a gladiator that can do
nothing but put its bow away. It needed the same widening the melee path has
always had and which I had read without applying. Found by the test measuring
the build's own stamina costs, which needs `fixtureReplay` and therefore needs a
position-blind archer to exist. **The test found it, not the sweep** — the
census never builds one.

## Pins that moved, every one by name

Six resources joined `SS2_RESOURCE_NAMES` — `ammo_left`, `maximum_ammo`,
`criticalhit`, and the three `secondary_weapon_*` numbers — so every combatant's
bag grew by six keys:

```text
    f122d207 -> 3698d1e3   canonical construction hash
    98689216 -> f2e862f9   six actions in
    31eabd22 -> f45930aa   settled 1v1
    da0edf09 -> 73b6a92d   vanilla-separation opening
    e9dbb913 -> e54cebb5   settled 3v3
```

**NO GOLDEN MOVED, for the sixth time**: a promoted golden states none of these
names and every one is built with `derive: false`. All four seeded-play pins
moving TOGETHER is itself the signature of a key-set change rather than a
gameplay one — a change to how these bouts play would have left the walking pin
alone, as the facing change did in September.

## Highest-value work, ranked

1. **LOOK AT IT AGAIN, AND LISTEN TO IT. This is the owner's and it is five
   minutes — and it has already paid once tonight**, in the block above: he
   watched one 3v3 and found that the archer had a single legal target.
   The arena has an archer in slot 2 of each side now, one rank back. Watch it
   draw the bow on turn one, shoot, run dry and be forced back to melee — and
   **listen**, because the sound fix means every clip now plays its own sound
   for the first time. `node tools/arena-server.mjs --host 0.0.0.0`, then the
   address the banner prints. **Not `127.0.0.1`.** Every defect the owner has
   found this week came from doing exactly this.
2. **Re-run the mutation audit.** It is the standing instruction after any
   substantial render change and this touched the renderer, the adapter and the
   rule set. It found two survivors last time in code no test had executed, and
   this diff added a lot of code.
3. **`snipe` is untested in play** (item above). Either accept it as the build's
   own arithmetic — it is — or find the roster where it bites and watch one.
4. **The weapon ENCHANTMENT selector has still not been found.** Unchanged from
   the last handoff: `weapon0` is character 703 with `flame`/`frost`/`poison`/
   `wraith` at frames 2/5/8/11, and `updatecharacter` contains no `gotoAndStop`
   at all. Start from the other readers of `weapon_enchantment_type`.
5. **`tools/arena/main.js` still has partial test reach** — the draw dispatch,
   the autoplay handling and the rAF loop. **It has given up SIX live defects in
   three days**, and this session added a line to it.
6. **The build has a DEFENCE SYSTEM nobody has built**: `defend1`-`defend12` and
   `defend20`, thirteen reactions mirroring the hurts and the attacks. Recorded
   in `UNMAPPED_CLIP_LABELS.unbuiltDefence` and deliberately unmapped, because
   which defend answers which attack is not derived.

## What is NOT verified

- **`criticalhit` is NARROWER THAN THE BUILD and it is stated at the field.**
  Vanilla keeps it on the overlay timeline, so a bash there can inherit the
  OTHER fighter's critical; here it is per-combatant. With six gladiators on the
  frame "the previous action" names nobody, and a battle-level transient is a
  resolver-contract change with its own decision. **It matters because a
  surviving critical BYPASSES ARMOUR.** The map itself records the inheritance
  as a static candidate no capture has promoted.
- **The villain's own bow gate is NOT modelled.** `villainChooseAction` tests
  `equipped_weapon == 2 && fightdistance < 200` — a maximum with no minimum,
  the opposite polarity to the hero's. This engine applies the hero's gate to
  everybody, exactly as it already does for the warrior gate.
- **Nothing about ranged is runtime-verified.** No capture has ever observed a
  bow in this build; every number above is map-derived or byte-read.
- **The attach offsets still come from ONE routine**, and **every asset number
  still came from ONE install.** Unchanged.

## Hard rules

- **A GREEN SUITE IS NOT COVERAGE.** The sound defect above was live, obvious
  once seen, and the whole suite was green over it.
- **`grep` IS NOT A GATE.** Use the exit code.
- **Do not reach for `git add -A` while agents are running.** Name the paths.
- **`ids 1..24` is a MIN AND A MAX, not a range** — and its cousin arrived this
  session: **"every ranged row has multiplier 100" was false for two of twenty.**
  Sweep the table; do not characterise it.
- **An empty slot may mean you are looking at the wrong slot.**
- **Every backtick inside `previewHtml` is live.**
- **Prefer "I looked here and it is not here" to a mapping that fits.**
- **LOOK AT IT**, and **`--host 0.0.0.0`, never `127.0.0.1`.**
- **Ship no SS2 asset.** `assets/` is gitignored AND
  `test/asset-attestation.test.js` fails if anything under it is tracked.
- **Push a feature branch without asking**; `main`/`master` and every force flag
  stay DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
