# SS2 first integration checkpoint

Status: read-only static map, first recorded 2026-08-29, last revised
**2026-09-07** *(corrected 2026-09-07: the header said 2026-08-31 while the body
already carried blocks dated `ADDED 2026-09-02`, `CORRECTED 2026-09-02`,
`byte-read 2026-09-02` and `CORRECTED 2026-09-07`, so it contradicted itself as
well as git. Prefer `git log -1 --format=%ad -- <this file>` to this line.)* This is interoperability research for the locally licensed Steam
build identified in
[`ss2-build-fingerprint.json`](ss2-build-fingerprint.json). It contains no game
code, artwork, audio, exported scripts, or game binaries.

## Inspection boundary

- The canonical input was the installed `swf/swords_sandals2_download.swf`.
- The installed SWFs were read in place and were not launched, copied, exported,
  decompiled to files, patched, or uploaded.
- The project-local inspector reads a SWF into memory and prints structural AVM1
  metadata and action opcodes. Portable FFDec is installed only under ignored
  `.tools/`, with its profile redirected there.
- The third-party SWF found in Downloads was not used as evidence.
- All future distributable output must remain independently authored source,
  metadata, or patches. Original and extracted game assets are out of scope.

## Licensed build identity

| Item | Verified value |
| --- | --- |
| Steam app | `1055430`, Swords and Sandals Classic Collection |
| Steam build | **corpus pin `24807725`; current install `25046632`** — see the note below the table |
| Depot manifest | ~~`1055432 / 8233185473219625516`~~ **`1055432 / 433190280864947326`** *(corrected 2026-09-07; the old manifest is the superseded build's and now lives in the fingerprint's `priorBuilds[0]`)* |
| AIR application | `com.game.whiskeybarrelstudios.swordsandsandalsclassic`, version `1.7.2` |
| Collection shell | `swords_and_sandals_classic.swf`, SHA-256 ~~`6A58E0843967AF5B781133E878A8E8DEB66F0D9EA265D0AAC8A0A4E53712D397`~~ **`7E15456500E41E930D5046D1853AC1CCFBB1E69A9EBF08FAD11DF0C0B91B8A4C`** (99,256,433 bytes) *(corrected 2026-09-07 — see below: the old hash is one the repo's own install verifier REJECTS)* |
| Vanilla SS2 | `swf/swords_sandals2_download.swf`, 7,586,504 bytes |
| Vanilla SS2 SHA-256 | `77CB545C2061AB41246251467A4EDF5926AB6FD1DDD95DC9527D7BA9C45BB8CA` |
| SWF format | uncompressed `FWS`, version 11, AVM1/ActionScript 2 |
| Movie | 30 fps, 270 root frames |
| Static inventory | 644 `DoAction`, 63 `DoInitAction`, 0 `DoABC`; 740 sprites, 502 exports, 1,049 decoded action blocks |

These identifiers are the compatibility key. Formula fixtures must name this
build and hash instead of claiming to describe every SS2 release.

► **CORRECTED 2026-09-07, and the correction is a DISTINCTION, not a
substitution. Read this before changing any number above.**

The Steam install moved on 2026-09-01 (`98482b6`) from build `24807725` to
`25046632`, and **only the AVM2 launcher changed**: the AVM1 SS2 SWF was
byte-identical across the transition (`ss2-build-fingerprint.json`,
`priorBuilds[0].ss2Unchanged: true`), which is why every golden, divergence
fixture and observation measured under the old build remains valid. That
transition updated the fingerprint and nothing else — this table was left behind
by omission, not by decision.

So the three rows are **three different kinds of fact**, and they were being
treated as one:

- **Steam build is BOTH, and both are stated above.** `24807725` is
  `SS2_STEAM_BUILD_ID` (`src/golden/run-1v1-fixture.js:7`), the corpus
  COMPATIBILITY key — **four throwing equality gates** enforce it
  (`run-1v1-fixture.js:559`, `observation.js:333`,
  `promote-1v1-golden.js:120` and `:238`), one test asserts it
  (`test/ss2-golden.test.js:179`), and **262 tracked files under `src/` and
  `test/` carry the literal**. **DO NOT change it anywhere in code, tests,
  fixtures, observations or manifests: that is not a documentation edit, it is
  an invalidation of the corpus.** `25046632` is what is installed today.
- **Depot manifest and collection-shell hash are install facts with no
  compatibility-key cover.** Nothing in the codebase reads a depot manifest, and
  the only machine-checked launcher hash is the fingerprint's current one:
  `verifyInstallAgainstFingerprint` (`tools/capture-session.mjs:69-96`) hashes
  the installed launcher against `fingerprint.collection.launcher.sha256`.
  **The old `6A58E08…` in this table is therefore a value this repository's own
  verifier REJECTS** — a reader checking their install against it would be told
  their licensed copy was wrong. Those two rows are simply corrected.

*(Also settled while re-deriving this, so it is not re-opened later:
`ss2-golden-harness.md`'s "Steam build `24807725`" is **correct where it
stands** — that section describes fixture classification, i.e. the corpus pin,
not the install.)*

## Battle entry and timeline ownership

The concrete battle construction point is the root `arena` label at frame 221,
action block `DoAction@0x671acd`. A preceding button action on button 1777 calls
`this.gotoAndPlay("beginfight")` on sprite 1788. Its `beginfight` label is frame
75; the frame-78 action sets `_global.current_arena = 1` and
`_global.fight_mode = "misc"`, then sends the root timeline to `arena_intro` at
frame 214. `initbattle`, `beginfight`, `combatwon`, and `combatlost` are
timeline labels/state values, not callable
functions, so an adapter must not invent function boundaries for them.

Root frame 221 does the following:

1. Creates `_root.arena.gladiators` as an empty movie clip.
2. Attaches the `overlay` linkage at depth 40000 and an `overlay_villain`
   linkage at depth 40001 — both as children of `_root.arena.gladiators`
   with instance names `overlay` and `overlay_villain` (byte-verified
   2026-08-30 at block `+0x04cf`/`+0x04f6`: `_root.arena.gladiators
   .attachMovie("overlay", "overlay", 40000)`), so the live controller path
   is `_root.arena.gladiators.overlay`.
3. Attaches two `hero_battle` linkage instances beneath
   `_root.arena.gladiators`: `hero` at depth 301 and `villain` at depth 300.
4. Calls `skincharacter` with `_root.game.hero` and `_root.game.villain`.
5. Places the runtime clips at `(-250, 200)` and `(250, 200)`, faces them right
   and left, and sets scale to `80 + round(strength / 1.5)` (the villain's
   horizontal scale is mirrored).
6. Attaches `hero_shadow` and `villain_shadow` instances at depths 298 and 299.
   Their frame, weapon frame, position, and scale are mirrored from the fighter
   clips by `onEnterFrame` handlers.
7. Sets `_global.battle_started = true`.

Before skinning, the same construction action forces the hero to
`equipped_weapon = 1` and `using_bow = false`.

The main battle controller is export `overlay`, sprite 862:

| Location | Responsibility |
| --- | --- |
| frame 1, `DoAction@0x236941` | `getphase`, `attack_chances`, early turn/phase selection |
| frame 52, `DoAction@0x23d7fe` | `remove_armour`, `destroy_armour` |
| frame 52, `DoAction@0x23e7cf` | inventory use and `villain_cast_spells` |
| frame 52, `DoAction@0x23f835` | `randomBetween` and `villainChooseAction` |
| frame 52, `DoAction@0x240c7f` | hit roll, damage, death, spells, status checks, animation dispatch |
| frames 62–77 | additional action/animation phase scripts referencing the two gladiators |

`getphase(whatsdoing)` writes `decisionA`, advances `turnphase`, sets
`this.battle_action = 1`, removes the inventory overlay, and jumps to the
`heroactions` timeline label. The action loop is therefore a timeline state
machine, not a standalone battle class.

Verified controller labels on sprite 862 are `initialise` frame 1,
`longrange_warrior` 5, `closerange_warrior` 13, `longrange_archer` 20,
`closerange_archer` 28, `heroactions` 52, `combatwon` 62, and `combatlost` 74.

## Controller frames and the hero action vocabulary

Byte-verified 2026-08-30 on sprite 862. The four hero controllers are not
interchangeable: which labels a gladiator can reach depends entirely on which
controller frame is in scope, and that choice is made once per turn.

### Selection and spans

`initialise` never rests. Its frame-4 action `DoAction@0x238bbf` is the
controller selector and is the only site that gotoAndPlays a controller label:

```text
if (_root.game.hero.using_bow != true) {              // +0x00b9..+0x00c7
  fightdistance < hero.weapon_range                   // +0x00f6
    ? this.gotoAndPlay("closerange_warrior")          // +0x00fd
    : this.gotoAndPlay("longrange_warrior");          // +0x0116
} else {
  fightdistance < 100 + hero.physical_size            // +0x015f
    ? this.gotoAndPlay("closerange_archer")           // +0x0166
    : this.gotoAndPlay("longrange_archer");           // +0x017f
}
```

`_root.arena.fightdistance` and `_root.game.hero.using_bow` are therefore the
only two inputs that gate the archer controllers. Because `physical_size =
80 + round(strength / 1.5)`, the archer close-range threshold resolves to
`180 + round(strength / 1.5)`, while the warrior threshold is the hero's own
`weapon_range`.

Each label plays through a span and holds on its last frame:

| Label | Frame | Span | How the span holds |
| --- | --- | --- | --- |
| `initialise` | 1 | 1–4 | never holds; frame 4 dispatches |
| `longrange_warrior` | 5 | 5–12 | `Stop`, frame 12 `DoAction@0x23a0fd` |
| `closerange_warrior` | 13 | 13–19 | `Stop`, frame 19 `DoAction@0x23b152` |
| `longrange_archer` | 20 | 20–27 | `Stop`, frame 27 `DoAction@0x23c4dc` |
| `closerange_archer` | 28 | 28–37 | `Stop`, frame 37 `DoAction@0x23d687` |
| `heroactions` | 52 | 52–61 | frame 61 `DoAction@0x24a1a4` runs `gotoAndPlay(_currentframe - 1)` at `+0x0014`, so it oscillates 60↔61 |
| `combatwon` | 62 | 62–73 | `Stop`, frame 73 `DoAction@0x24a8b0` |
| `combatlost` | 74 | 74–84 | `Stop`, frame 84 `DoAction@0x24aefe` |

An autopilot that reads `_currentframe` must expect the resting frame, not the
label frame. `heroactions` is the one span that never stops; it idles on a
two-frame loop while `attacker.onEnterFrame` runs the phase machine.

A further `Stop` sits at frame 51 (`DoAction@0x23d773`), immediately before
`heroactions`. No label was verified between 28 and 52, so frames 38–51 are
not reachable from any mapped path. This map previously left open whether a
ninth label might hide in that gap, because the project inspector did not then
decode `FrameLabel` (tag 43).

**Closed 2026-08-30, and reproduced with the project's own tool.** The
inspector now has a `--labels` mode with a `--timeline <regex>` filter, so the
decode no longer depends on the throwaway out-of-repo reader the
[arena route](ss2-arena-route.md) §Method note first used. Re-run here against
the same installed SWF and fingerprint:

```powershell
node tools/inspect-swf.mjs "$ss2Install\swf\swords_sandals2_download.swf" `
  --labels --timeline 'sprite:862'
```

It reports `8 across 1 of 24 timelines` for `sprite:862[overlay]`, 84 frames
declared, at frames **1, 5, 13, 20, 28, 52, 62 and 74** — the same eight
already verified here from the action stream, in the same order. There is no
ninth label, and frames 38–51 carry none: `closerange_archer` owns the whole
28–51 range outright. The caveat is closed, and the "cannot be excluded from
the action stream alone" wording no longer applies to anything in this map.

One convention difference matters when comparing the two tables. `--labels`
prints the **label-ownership** span (frames a label owns until the next label
begins), while the Span column above is the **play** span, which ends at the
`Stop` the playhead actually rests on. They differ only for
`closerange_archer`: owned 28–51, rests at 37. The frame-51 `Stop` sits inside
the owned range and no mapped path reaches it.

### Buttons wired per controller frame

Every controller frame opens by recomputing the hero's chance cache with
`attack_chances(_root.game.hero, _root.game.villain)` — frame 5 `+0x0908`,
frame 13 `+0x072f`, frame 20 `+0x08d2`, frame 28 `+0x08fb` — then branches once
on `_root.arena.gladiators.hero.gladiator_dir == "right"` (frame 5 `+0x093a`,
frame 13 `+0x0761`, frame 20 `+0x0904`, frame 28 `+0x092d`). Both facings wire
the same eight `optionA`–`optionH` slots with `onRelease` handlers whose whole
body is a single `getphase("<label>")` call. The label set is facing-invariant
apart from the charge/ranged handedness; only the slot assignment rotates.

| Controller | Facing | Handler range | `optionA`…`optionH` labels |
| --- | --- | --- | --- |
| `longrange_warrior` | right | `+0x0c97`–`+0x0dec` | `jumpleft`, `walkleft`, `taunt`/`rest`, `jumpright`, `walkright`, `chargeright`, `wincrowd`, `psyche_up` |
| `longrange_warrior` | left | `+0x1134`–`+0x12a0` | `jumpleft`, `walkleft`, `chargeleft`, `jumpright`, `walkright`, `taunt`/`rest`, `psyche_up`, `wincrowd` |
| `closerange_warrior` | right | `+0x0a90`–`+0x0b8b` | `jumpleft`, `walkleft`, `shove`, `power_attack`, `normal_attack`, `quick_attack`, `wincrowd`, `psyche_up` |
| `closerange_warrior` | left | `+0x0ebc`–`+0x0fb7` | `power_attack`, `normal_attack`, `quick_attack`, `jumpright`, `walkright`, `shove`, `psyche_up`, `wincrowd` |
| `longrange_archer` | right | `+0x0ca2`–`+0x0df7` | `jumpleft`, `walkleft`, `taunt`/`rest`, `bombardright`, `walkright`, `sniperight`, `wincrowd`, `psyche_up` |
| `longrange_archer` | left | `+0x1197`–`+0x12ec` | `bombardleft`, `walkleft`, `snipeleft`, `jumpright`, `walkright`, `taunt`/`rest`, `psyche_up`, `wincrowd` |
| `closerange_archer` | right | `+0x0c19`–`+0x0d14` | `jumpleft`, `walkleft`, `shove`, `jumpright`, `bash_attack`, `taunt`, `wincrowd`, `psyche_up` |
| `closerange_archer` | left | `+0x1002`–`+0x10fd` | `jumpleft`, `bash_attack`, `taunt`, `jumpright`, `walkright`, `shove`, `psyche_up`, `wincrowd` |

Consequences a capture campaign has to respect:

- `power_attack`, `normal_attack` and `quick_attack` are wired **only** by
  `closerange_warrior`; `shove` only by the two close-range controllers.
- `bombardleft/right` and `snipeleft/right` are wired **only** by
  `longrange_archer`; `bash_attack` **only** by `closerange_archer`. All four
  therefore require `using_bow == true` to be offered at all.
- `rest` is never wired by either close-range controller, and `taunt` is never
  wired by `closerange_warrior`.
- On frames 5 and 20 the taunt and rest buttons share one slot, selected by
  `staminaleft / staminamax * 100 >= 50` — frame 5 `+0x0c0a`/`+0x0c3d` facing
  right and `+0x10a2`/`+0x10d5` facing left, frame 20 `+0x0c15`/`+0x0c48` and
  `+0x110a`/`+0x113d`. Below 50% stamina the taunt button does not exist; at or
  above it the rest button does not. `closerange_archer` has no stamina test at
  all and always wires `taunt`.
- `wincrowd` is hidden below `herolevel` 3 on every controller. `psyche_up` is
  hidden below `herolevel` 7 on the warrior controllers (frame 5 `+0x0999`,
  frame 13 `+0x07c0`) but below `herolevel` 3 on the archer controllers, where
  a single test hides both slots (frame 20 `+0x092e`/`+0x0e23`, frame 28
  `+0x0957`/`+0x0d40`).

### The ammunition-visibility defect

On `longrange_archer` the ranged slots are frame-selected when
`_root.game.hero.ammo_left > 0` (`+0x099f`, mirrored `+0x0e66`). The zero-ammo
branch instead assigns `visible` — not `_visible` — on both slots
(`+0x09eb`/`+0x09f9` facing right, `+0x0eb2`/`+0x0ec0` facing left). `visible`
is not a MovieClip property, so the buttons are **not** hidden, and their
`onRelease` handlers are wired unconditionally further down the same branch.
Nothing in the ranged phase re-checks ammunition either: the ranged branch of
`attacker.onEnterFrame` decrements `game_attacker.ammo_left` by one at
`+0x6bf5`–`+0x6c13` with no guard, so a zero-ammo shot drives the counter
negative. In ordinary play the auto-swap below fires first; a capture harness
that drives `getphase` directly can reach the defect.

### The weapon enchantment selector is `itemglow`, and it keys on TYPE (2026-09-13, ~~POTENCY~~ CORRECTED 2026-09-15)

**Found, after four sessions of being recorded as a gap.** The standing note
said `updatecharacter` contains no `gotoAndStop` at all and told the next reader
to start from the other readers of `weapon_enchantment_type`. That was the right
instruction and this is where it leads.

`skincharacter` (root frame 35 `DoAction@0x40bf76`) picks the slot and calls it:

```text
  if (equipped_weapon == 1)                                        +0x1ae7
    itemglow(weapon, weapon_enchantment_type,
                     weapon_enchantment_potency)                   +0x1b16
  else if (equipped_weapon == 2)                                   +0x1b29
    itemglow(weapon, secondary_weapon_enchantment_type,
                     secondary_weapon_enchantment_potency)         +0x1b58
```

`itemglow(whichitem, enchant_type, enchant_potency)` is defined at
`root/frame:35/DoAction@0x3fa76f` `+0x0011`, and its body is a two-level chain
of `gotoAndStop` on the weapon clip:

```text
  type < 2                        gotoAndStop(1)     no glow      @0x3fa7d4
  type == 2 && potency == 1/2/3   gotoAndStop(2/3/4)              @0x3fa809…
  type == 3 && potency == 1/2/3   gotoAndStop(5/6/7)              @0x3fa886…
  type == 4 && potency == 1/2/3   gotoAndStop(8/9/10)             @0x3fa903…
  type == 5 && potency == 1/2/3   gotoAndStop(11/12/13)           @0x3fa980…
```

which is `frame = 3 * (type - 2) + potency + 1`, and 1 below type 2.

► ~~**The outer test is on `register:3` and the inner on `register:2` … so the
  outer, coarse selector is POTENCY.**~~ **THE TWO PREMISES ARE RIGHT AND THE
  CONCLUSION INVERTS THEM. Corrected 2026-09-15; the table above is rewritten,
  not annotated, because a reader who copies a code block does not read the
  paragraph under it.**

  The outer test really is on `register:3` — and `itemglow`'s own
  `DefineFunction2` binds its parameters to registers explicitly:
  `[{register: 3, name: "enchant_type"}, {register: 2, name: "enchant_potency"}]`.
  **So `register:3` IS `enchant_type`**, and the outer, coarse selector is
  **TYPE**. The old sentence read the register numbers off the body correctly,
  read the parameter names off the header correctly, and then paired them the
  wrong way round.

  **Seven independent witnesses agree, and the first of them is the author's
  own name table:**

  1. `weaponenchantments = new Array("", "", "Flame", "Frost", "Poison", "Wraith")`
     at `0x3fe79c`, and `weaponenchantments_potency = new Array("", "Weak",
     "Medium", "Strong")` at `0x3fe786` — both inside
     `root/frame:35/DoAction@0x3fa9dc`'s `With` block at `0x3fe769`.
     `battlevalues` reads
     `weapon_enchantment_type_name = weaponenchantments[weapon_enchantment_type]`
     (`0x3fdbd8`). **The ELEMENTS are indexed by type; the three STRENGTHS are
     indexed by potency.** Nothing survives this one.
  2. **Arity.** The magic shop has FOUR element buttons (2006-2009 write
     `enchant_type` 2/3/4/5) and THREE gem buttons (2010-2012 write
     `enchant_potency` 3/2/1, captioned "Strong/Medium/Weak … 30%/20%/10%
     chance"). Three gems cannot select among four elements.
  3. **Sprite 703's own FrameLabels**: `flame` 2, `frost` 5, `poison` 8,
     `wraith` 11 — each spanning exactly three frames. The ELEMENT names the
     label; the three frames inside it are the three potencies.
  4. **The glow parameters.** Within a label the colour is constant and the blur
     RAMPS (3/5/11 inner, 6/10/15 outer); between labels the colour changes.
     Strength grows with potency, which is what potency means.
  5. **`damagecharacter`** tests `weapon_enchantment_type == 2/3/4/5` for
     `burning`/`frozen`/`poison`/`life_stolen` and gates the proc on
     `randomBetween(1,100) < weapon_enchantment_potency * 10`.
  6. **`randomise_gladiator`** draws `weapon_enchantment_type =
     randomBetween(2, 5)` (`0x4048ed`) and ~~`weapon_enchantment_potency` from
     1..3 banded by `herolevel` (`0x404906`/`0x404962`/`0x404998`).~~
     **`weapon_enchantment_potency = randomBetween(1, 3)`, UNIFORM AT EVERY
     LEVEL — corrected 2026-09-22 by a write-nothing verifier re-deriving the
     region from the bytes (block base `0x401994`).** The three level-banded
     arms are DEAD STORES: arm 1 (`herolevel <= 10`) writes a constant 1 at
     `0x404912` (`+0x2f7e`), arm 2 (`10 < herolevel <= 25`) writes
     `randomBetween(1, 2)` at `0x404962`, arm 3 (`> 25`) `randomBetween(1, 3)`
     at `0x404998` — and all three join at `+0x3005` (`0x404999`), which
     UNCONDITIONALLY overwrites the field with `randomBetween(1, 3)`.
     **`0x404906` was never a write:** it is arm 1's `Push` (`+0x2f72`). The
     region runs only for a non-hero (`+0x27e8`) with `weapon != 0`
     (`0x404892`), and only when `enchanted_possibility =
     randomBetween(herolevel * 10, 500)` exceeds 450 (`+0x2f3b`). The witness
     still stands for what it is cited for: the TYPE draw is the element.
  7. **Every call site pushes the same pair in the same order** — potency, then
     type, then `argCount` — at all nine `enchant_weapon` sites and all four
     `itemglow` sites, popping to `(…, type, potency)`.

#### The "tension with the damage path" below was an artefact of the inversion, and there is none

**This section used to say a capture was the only thing that could settle it.
That was wrong and it would have spent a capture session on a question the bytes
answer.** `itemglow` and `damagecharacter` key the element on the SAME field
over the SAME range — `enchant_type` ∈ 2..5 — and the four glow colours line up
with the four statuses one-for-one. The paragraph is kept below as the record of
how the wrong reading was reached.

#### Three things the corrected reading exposes, none of them recorded before 2026-09-15

► **`else frame 1` IS NOT WHAT THE FUNCTION DOES, and this is the half that
  matters for a reimplementation.** The only frame-1 arm is `enchant_type < 2`.
  The body ends at the `Pop` at `0x3fa9da` with **no trailing default**
  (`codeStart 0x3fa7c3 + codeSize 536 = 0x3fa9db`, which holds the outer
  `End`). So for a type ≥ 6, for a type in 2..5 whose potency is not in
  `{1,2,3}` — **potency 0 included, which is exactly what `randomise_gladiator`
  zeroes to** — and for a non-numeric type, `gotoAndStop` is called ZERO times
  and **the clip keeps whatever frame it was already on.** Model it as twelve
  cells plus a `< 2` cell plus an unwritten no-op, never as twelve cells plus a
  default.

► **THE NaN POLARITY IS THE NEGATED FORM, and it is reachable from the save.**
  The default arm compiles to `Less2` (`0x3fa7cd`) then `Not` (`0x3fa7ce`), and
  this file's own § "AVM1 has ONE comparison opcode" records that `Less2; Not`
  returns TRUE for NaN. A NaN `enchant_type` therefore SKIPS `gotoAndStop(1)`
  and then fails all four `Equals2` tests — a no-op. `weapon_enchantment_type =
  Number(characterDNA[33])` (`0x40c869`) coerces a serialised field, so a short
  or hand-edited DNA leaves the weapon wearing the PREVIOUS fighter's glow.

► **OPPONENTS CAN BE ENCHANTED, so the glow is reachable in ordinary play.**
  `randomise_gladiator` (`DefineFunction2 @0x403d57`) computes
  `enchanted_possibility = randomBetween(herolevel * 10, 500)` (`0x404897`) and,
  when it exceeds 450, enchants — gated at `0x404892` on `weapon != 0`, so only
  an armed gladiator. Six call sites, five on `game.villain`.
  ► **AND THE PRIMARY'S LEVEL-BANDED POTENCY LADDER IS ~~DEAD CODE~~ DEAD
    STORES** *(corrected 2026-09-22: the arms are not dead — arms 2 and 3 still
    RUN and still DRAW; only their writes are dead).* All three
    arms (`0x404912`, `0x404962`, `0x404998`) fall into an UNCONDITIONAL
    `weapon_enchantment_potency = randomBetween(1, 3)` at `0x404999`. So
    opponent PRIMARY potency is uniform 1..3 at every level, while the SECONDARY
    ladder (joining at `0x404ad1`) is genuinely level-banded. ~~**It also costs a
    second RNG draw**, which any replay reproducing the build's stream must
    make.~~ **THE SECOND DRAW HAPPENS ONLY WHEN `herolevel > 10` — corrected
    2026-09-22 by a write-nothing verifier re-deriving the arms from the
    bytes.** Arm 1 (`herolevel <= 10`; its `If` at `+0x2f6d` is taken when
    `> 10`) writes the constant 1 at `0x404912` with NO draw; arms 2 and 3 each
    call `randomBetween` (`+0x2fcd`, `+0x3003`) before `+0x3005`'s own call at
    `+0x301d`. So an opponent at level 10 or below draws once here, and a
    replay that always draws twice drifts the stream for exactly those
    opponents.

#### And that puts it in tension with the damage path, which is recorded and NOT resolved

Character 703 (`weapon0`) carries thirteen frames and four labels, each spanning
exactly the three frames one potency tier uses:

```text
  flame    frames  2-4        poison   frames  8-10
  frost    frames  5-7        wraith   frames 11-13
```

~~So by `itemglow`, **potency 2 is a flaming weapon, 3 a frosted one, 4 poisoned,
5 wraith** — and `enchant_type` 1-3 chooses a variant within the tier.~~
**INVERTED; struck 2026-09-15. TYPE 2 is flame, 3 frost, 4 poison, 5 wraith, and
POTENCY 1-3 chooses Weak/Medium/Strong within the element.** The labels do span
three frames each — that observation was right — but the three frames are the
three POTENCIES, which is why the blur ramps across them while the colour does
not.

► **BUT `damagecharacter`'S ENCHANTMENT PROC KEYS THE CONDITION ON *TYPE*, with
  values 2-5**: type 2 -> `burning`, 3 -> `frozen`, 4 -> `poison`, 5 ->
  `life_stolen` (§"The enchantment effect is a SKIPPED TURN"). Those four
  conditions line up with the four labels one-for-one — flame/burning,
  frost/frozen, poison/poison, wraith/life_stolen — but they are selected by a
  **different field, over a different range**, from the one the glow uses.

  ~~**Both readings are byte-verified and this document does not pick between
  them.** … **A capture of a gladiator with a known enchantment settles it and
  nothing else does.**~~ **RESOLVED 2026-09-15 FROM THE BYTES, AND NO CAPTURE IS
  NEEDED.** There was never a tension: BOTH key the element on `enchant_type`
  over 2..5. The appearance of one came entirely from reading `itemglow`'s outer
  register as potency. See the seven witnesses above.

  **The lesson is worth more than the correction.** This document had the right
  registers, the right parameter names and the right frame labels, paired two of
  them wrongly, and then wrote the contradiction that followed as an OPEN
  QUESTION FOR A CAPTURE. An inconsistency between two readings of the same build
  is first evidence that one reading is wrong — the instrument before the world.

### The arena screen: a timeline backdrop PLUS a construction script (2026-09-13)

► **CORRECTED THE SAME EVENING. THIS SECTION FIRST SAID "root frame 221's
  display list is EMPTY", AND THAT WAS A BUG IN THE READING, NOT A FACT ABOUT
  THE BUILD.** `resolveTimeline` returns ONE ENTRY PER FRAME OF THE TIMELINE,
  not one per frame requested — so `resolveTimeline(root, {frames: [221]})`
  puts frame 221's snapshot at `frames[220]` and `frames[0]` is frame 1, which
  is `null` because it was not asked for. **I read `frames[0]`, got null, and
  reported an empty arena.** The same mistake would have been caught by asking
  for any two frames and noticing they were both empty.

  Two conclusions that were built on it are withdrawn: that "there is no
  backdrop asset" and that the arena is *only* a recipe. Both halves are real.

**Root frame 221 is labelled `arena` and its display list holds SIX objects**,
and it then runs **488 instructions** of `DoAction@0x671acd` that attach more
into one of them. (Frame 221's own tag stream places only `arena` and `rain`;
the other four persist from earlier root frames — `sky` from frame 96. What a
renderer needs is the CUMULATIVE list, which is what this table is.)

```text
  depth    1  char  643   640 x 420 px  at (  0.00,   0.00)  THE BACKDROP — the
                                                             stage, to the pixel
  depth    3  char 1729   640 x 211 px  at (315.70, 216.85)  `sky` — scale 1.04,
                                        200 frames           NOT the crowd
  depth   59  char 2249  1363 x 422 px  at (319.95, 166.75)  `arena`, 334 frames,
                                                             which the script fills
  depth   80  char 1816    17 frames    at (-310.35, -66.35) `rain`; frames 1-9
                                                             draw NOTHING
  depth  438  char 1531   641 x  27 px  at ( -0.50, 401.00)  `fiz_info_panel`
                                                             (carries text)
  depth 1193  char  646   732 x 505 px  at (-25.55, -33.00)  the frame/border
```

► ~~`depth 3 char 1729 8417 x 1032 px, the crowd`~~ ~~`depth 59 char 2249
  24177 x 2489`~~ ~~`depth 438 char 1531 1919 x 210`~~ **— THREE OF THESE SIX
  ROWS WERE OUT BY A FACTOR OF TWENTY, CORRECTED 2026-09-14, AND THE CAUSE IS A
  UNITS SEAM.** A matrix out of `tools/swf-display-list.mjs` carries `tx`/`ty`
  in TWIPS — `readMatrix`'s own docstring says so — while `shapeToPaths` and
  every `px()` helper emit PIXELS. Compose a pixel bound with a twips
  translation and the OFFSET inflates twentyfold while the size does not, so the
  error is invisible on anything placed at the origin and enormous on anything
  else. **The two rows that were right (643 and 646) are exactly the two whose
  contents sit at the origin**, which is how a table that the bug could not
  reach read as a table that had been checked. Re-measured off `77cb545c…` and
  independently reproduced by two agents on separate routes.

► **AND `char 1729` IS `sky`, NOT THE CROWD.** The build names it three ways:
  the `PlaceObject2` instance name, `_root.sky.gotoAndStop(time_of_day)` in
  `day_night_cycle`, and its own child sprite `cloud_patterns`. **The crowd is
  character 2112**, inside the arena clip at depth 3. That misnaming reached
  `tools/extract-props.mjs`, where the sky shipped under the key `crowd` —
  which a renderer that looks layers up by key would have drawn as a sky where
  the stands belong, silently.

#### The mapping this settles, and it is the one the scale question needed

The stage is **640 x 420**. `_root.arena` sits at **(319.95, 166.75)** and is
UNSCALED. Its `gladiators` child is created at `(0, 0)` of it, and the fighters
are constructed at `_x = ±250`, `_y = 200` inside that.

```text
  one arena unit          = one stage pixel      (the ARENA's transform is 1.00)
  arena origin            = (319.95, 166.75) on stage
  the GROUND LINE         = stage y 166.75 + 200 = 366.75   at full zoom
  a fighter at _x ±250    = stage x 69.95 and 569.95
```

*(“every transform on that frame is 1.00” was also wrong: `sky` is scaled 1.04.
What is 1.00 is the arena's own placement, which is the transform the 1:1 claim
actually rests on.)*

**So the backdrop does set the scale, and the scale is 1:1.** The arena content
is wider than the stage and the camera follows the fight across it, which is
what `midway_focus` and `maxscale` are for.

#### THE CAMERA: `combatscale` is LIVE and `combatCamera` is a `return;`

`sprite:2249/frame:1/DoAction@0x6e421b` defines `getfightdistance`,
`combatCamera` and `combatscale`, and installs `crowd.onEnterFrame` (`+0x0d54`)
and `gladiators.onEnterFrame` (`+0x0e68`).

```text
  gladiators.onEnterFrame:
    getfightdistance()                                       +0x0e73
    if (_global.phasecomplete != false) combatscale()        +0x0e98   <- LIVE
```

► **`combatCamera`'s BODY IS `return;`.** Its `DefineFunction2` header at
  `+0x048a` gives CodeSize 476 and a body starting at file `0x6e46c2`
  (`+0x04a1`), and its first five bytes are `96 01 00 03 3e` — `Push undefined;
  Return`. The 470 bytes after it are unreachable, including
  `maxscale = 1500 - midwaypoint` clamped `[15, 100]`. It is still CALLED every
  tick, from `nextphase` (`sprite:862[overlay]/frame:52` `+0x31af`), and does
  nothing. **It is the only one of the build's function bodies that begins that
  way**, so it is a deliberate disable rather than a compiler artefact.

  So `maxscale` is set ONLY by `combatscale`'s band chain and takes the values
  80/50/30/20/15 — which is what makes the arrow's `== 80` / `< 80` / `<= 60` /
  `<= 40` banding below meaningful.

► **`maxscale` AND `zoomscale` ARE ON `_global`, NOT ON THE ARENA.** Both
  functions carry flags `0x016a`, which preloads `_root` into register 1 and
  `_global` into register 2, so every `register:2, "maxscale"` is
  `_global.maxscale`. This document called it `arena.maxscale`; harmless to the
  arithmetic, corrected here.

► **`_global.zoomscale = 5`** at `+0x0c7c`, on the arena clip's own frame 1 —
  so a bout OPENS at a twentieth of full size and rushes in over about sixteen
  frames. That is the build's establishing shot.

```text
  combatscale(), +0x0693..+0x0ad8
    midway_focus._x = leftmost(hero, villain)._x + midwaypoint
    p = {x: round(midway_focus._x), y: round(midway_focus._y)}
    gladiators.localToGlobal(p)
    if (p.x < 300) gladiators._x += (300 - p.x) / 16              PAN
    if (p.x > 340) gladiators._x -= (p.x - 340) / 16
    maxscale: mp<240 -> 80; >240&&<=300 -> 70; >300&&<=400 -> 60;
              >200&&<=400 -> 50; >400&&<=700 -> 30;
              >700&&<=1500 -> 20; >1500 -> 15
    zoomscale eases toward maxscale by /5, snapping inside ±4
    gladiators._xscale = _yscale = ceil(zoomscale)                ZOOM
    crowd._y = -200 + ceil(zoomscale)
```

► **THE BANDS ARE SEQUENTIAL `if`s, SO THE LAST MATCH WINS — AND THE FOURTH ARM
  EATS THREE OF THEM.** `> 200 && !(> 400)` swallows the 70 and 60 arms whole
  and takes a slice out of the 80 arm. Seven declared bands, five reachable
  values: `mp <= 200 -> 80`, `200 < mp <= 400 -> 50`, `400 < mp <= 700 -> 30`,
  `700 < mp <= 1500 -> 20`, `mp > 1500 -> 15`.

► **`midwaypoint = round(fightdistance / 2)`**, set inside `getfightdistance` at
  `+0x0467` — so the camera keys on the build's own EUCLIDEAN distance, which
  this engine already computes as `ss2FightDistance`.

► **THE CROWD'S HORIZONTAL PARALLAX IS AUTHORED AND INERT.**
  `crowd.onEnterFrame` tracks `arena.gladiators.camPoint.x` against the same
  300..340 dead zone — and **`camPoint` is never assigned anywhere in the
  build**: the string occurs exactly once in 7,586,504 bytes, at `0x6e4430`, as
  one constant-pool entry read four times inside that handler. So both tests
  compare against `undefined` and neither fires. Its VERTICAL parallax, from
  `combatscale`, is live.

► **SIX ARENAS AND TWENTY-THREE HOURS.** `sand.gotoAndStop(current_arena)`
  (`+0x0d0f`) and `crowd.gotoAndStop(current_arena)` (`+0x0c99`) — six frames
  each, one index for both. `_root.sky.gotoAndStop(time_of_day)` (`+0x0d33`)
  with `_global.time_of_day = 1 + random(23)`; the clip declares 200 frames and
  they resolve to six distinct drawings. **The count of SLOTS is not the count
  of MEANINGS** — the same lesson `bullet`'s fifty frames and five arrows
  taught, in a second place.

```text
  _root.arena.gladiators = createEmptyMovieClip(...)
  ….gladiators.attachMovie("midway_focus", "midway_focus", 6)
  ….gladiators.attachMovie("rockMC", "rockLeft",  200)
  ….gladiators.attachMovie("rockMC", "rockRight", 201)
  ….gladiators.attachMovie("hero_battle", "arena_hero",    …)
  ….gladiators.attachMovie("hero_battle", "arena_villain", …)
  then skincharacter, _xscale/_yscale from strength, gladiator_dir, shadows
```

► **THE SCRIPT'S HALF is the two `rockMC`, a `midway_focus`, and the two
  `hero_battle` clips positioned and scaled by the same `physical_size`
  arithmetic this repository already reproduces. The TIMELINE's half is the
  backdrop, the crowd, the border and the arena clip itself.** Neither alone is
  the arena.

  **Much of this frame is already modelled**: "Battle entry" step 5 above is
  these same instructions, `ss2PhysicalSize` is the `_xscale`/`_yscale` term,
  and `src/adapter/slot-layout.js` is the placement. What is NOT yet read out is
  the scenery — the two rocks, their coordinates, and the crowd.

► **AND IT IS STATIC, like the fighter clip's effect calls.** Every
  `attachMovie` above pushes a literal linkage name, instance name and depth. So
  the same technique `tools/extract-clip-effects.mjs` uses — read the call
  sites, refuse anything that is not a literal — reaches it, and an AVM1
  interpreter is not what stands between this engine and the arena's scenery.

### The arrow itself: launch, flight, trail and impact (byte-read 2026-09-13)

**The build models the projectile, and none of it was in this document.** All
125 `bullet` references live in one block — `sprite:862[overlay]/frame:52/
DoAction@0x240c7f`, the `phase_decision` state machine — and `maxscale`, which
half of it keys on, appears nowhere else in this corpus. Read off `77cb545c…`
with `tools/inspect-swf.mjs --references bullet --around 400`.

The ranged phase branch runs every tick while `phase_decision` is one of the
four ranged labels, and does four things in this order:

1. `staminacost = round(strength * 3)` (`+0x6bb5`).
2. **Once**, guarded on `attacker.struck == null`: `ammo_left -= 1`
   (`+0x6bf5`), `bullet_in_air = true` (`+0x6c23`), `gotoAndPlay("bombard")` or
   `("snipe")`, and `attack_direction = 21` / `22`.
3. **The impact test** (`+0x6c97`-`+0x6d24`), every tick:

   ```text
   bullet._y > 160
   || (bullet._x > defender._x && attacker.gladiator_dir == "right")
   || (bullet._x < defender._x && attacker.gladiator_dir == "left")
   ```

   On impact: `checkattackroll()`, `bullet_in_air = false`,
   `bullet.removeMovieClip()`. **So a ranged attack resolves when the arrow
   ARRIVES, not when it is loosed** — and `bullet._y > 160` is the arrow
   falling short and striking the ground, which resolves the attack all the
   same.
4. **The launch**, guarded on `attacker.fired == true` (`+0x6d59`) — a flag the
   fighter ANIMATION sets at its release frame, so the arrow appears when the
   bow is actually drawn and not when the phase starts.

#### Launch

```text
  bulletdepth = 45000                                          +0x6d81
  bullet = arena.gladiators.attachMovie("bullet", ...)          +0x6da2
  bullet.gotoAndStop(game_attacker.secondary_weapon - 60)       +0x6dd4
  bullet._x = attacker._x ± 30       (+ facing right)           +0x6dff / +0x6e23
  bullet._y = attacker._y - (attacker._yscale * 2 + 30)         +0x6e42
    SNIPE ONLY:
  bullet._y = attacker._y - (attacker._yscale * 1.5 + 5)        +0x6e9e
```

**The arrow's art is the bow's id minus 60**, so the twenty ranged rows 61-80
index frames 1-20 of character 47 — the same `- 60` the trail uses at `+0x7255`.
And **a snipe is loosed lower than a bombard**: `1.5 * _yscale + 5` against
`2 * _yscale + 30`, which is the flat shot against the lobbed one, set up before
either has moved.

#### Flight constants

```text
  bullet.bulletlife        = 1                                  +0x6ede
  bullet.bulletcounter     = 1                                  +0x6ef1
  bullet.gravity           = 2                                  +0x6efd
  bullet.distance_to_enemy = abs(attacker._x - defender._x)     +0x6f28 / +0x6f63
  bullet.Yvelocity         = ceil(distance_to_enemy / Xvelocity) +0x7139
```

`Xvelocity` and the arrow's own scale are banded on **`_global.maxscale`** (this
document called it `arena.maxscale`; see the camera section above), and
the whole table is **BOMBARD ONLY** — the four tests are sequential `if`s rather
than an else-if chain, so the last matching arm wins:

| test | `_xscale` = `_yscale` | `Xvelocity` | site |
| --- | --- | --- | --- |
| `maxscale == 80` | *(unset; stays 100)* | `randomBetween(8, 18)` | `+0x6fd7` |
| `maxscale < 80` | 100 | `randomBetween(16, 24)` | `+0x700e`, `+0x7033` |
| `maxscale <= 60` | 130 | `randomBetween(20, 30)` | `+0x706b`, `+0x7090` |
| `maxscale <= 40` | 160 | `randomBetween(30, 36)` | `+0x70c8`, `+0x70ed` |
| **snipe** (the else of the bombard test at `+0x6fbb`) | *(unset)* | `randomBetween(60, 60)` = **60** | `+0x7112` |

► **THE SCALE GOES UP AS `maxscale` GOES DOWN, which is the wrong way round for
  perspective and the right way round for a CAMERA.** SS2 zooms the arena out as
  the fighters separate; a zoomed-out view needs the arrow drawn larger to stay
  visible and moving faster to cross the gap in a watchable time. **This is zoom
  compensation, not depth perspective.**

  ► **AND THE CAMERA IT COMPENSATES FOR IS REAL, which was checked the hard
    way.** The paragraph here used to end "a fixed camera has nothing to
    compensate for" as a caution to a reimplementation; on 2026-09-14 a session
    read `combatCamera` — the disabled one — concluded the shipped arena was
    fixed, and started removing this table's reason for existing. It is not
    fixed: `combatscale` runs every enterFrame. **Reachable `maxscale` values
    are 80/50/30/20/15**, so the `== 80` arm fires when the fighters are close
    (`midwaypoint <= 200`) and the `<= 40` arm at long range, exactly as the
    table implies. `src/render/arena-backdrop.js` reproduces the camera; the
    scale table itself is still NOT ported, because this engine's camera is the
    renderer's own and its arrow rides `figureScaleFor` instead.

#### Per frame — `bullet.onEnterFrame` (`+0x7177`)

```text
  bulletcounter += 1                                            +0x7189
  if (bulletcounter >= 3) {                                     +0x71aa
    bulletcounter = 1
    attach `bullet_trail` at the bullet's _x, _y and _rotation  +0x71ee
    trail.bullet.gotoAndStop(secondary_weapon - 60)             +0x7255
  }
  Yvelocity -= gravity                                          +0x727f
  BOMBARD ONLY:  _y -= Yvelocity                                +0x72c7
  _x += Xvelocity   (facing right; -= facing left)              +0x7314 / +0x7379
```

► **A BOMBARD ARCS AND A SNIPE FLIES FLAT.** The `_y` integration at `+0x72c7`
  is inside a test for `bombardright`/`bombardleft` only, so a snipe never
  changes `_y` at all: it is loosed lower, travels at a constant 60, and hits or
  passes. The bombard starts with `Yvelocity = ceil(distance / Xvelocity)`,
  loses 2 a frame, and therefore rises, stalls and falls — **the arc is aimed by
  the range**, which is why a bombard's `_y > 160` ground-strike arm is
  reachable and a snipe's is not.

► **THE TRAIL IS ONE PUFF EVERY THREE FRAMES**, at the arrow's own position and
  rotation, drawn from the same art. At 30 fps that is ten a second.

**A typo in the build, harmless:** `+0x733a` reads `phase_decsion` — not
`phase_decision` — so that test is always false and the `sniperight` arm below
it never runs. The arm it guards is a duplicate of the one above, so nothing
observable changes.

### Weapon mode and `swap_weapons`

No controller frame wires `swap_weapons`. The only manual route is the battle
inventory overlay: `swap_inventory.onRelease` in sprite 862 frame 1
`DoAction@0x2378cc`, defined at `+0x1015`, whose body calls
`getphase("swap_weapons")` at `+0x1067`. That button is correctly hidden with
`_visible = false` when the hero has no secondary weapon (`+0x0e77`–`+0x0e96`),
and its icon frame is selected by `using_bow` at `+0x0eb5`.

The `swap_weapons` phase itself is a plain toggle in overlay frame 52
`DoAction@0x240c7f` (`+0x4d23`): `using_bow != true` sets
`game_attacker.equipped_weapon = 2` and `using_bow = true` (`+0x4dbd`,
`+0x4dce`); otherwise it sets `equipped_weapon = 1` and `using_bow = false`
(`+0x4eba`, `+0x4ecb`). It sets `staminacost = 1` (`+0x4d35`) and never checks
that the secondary weapon is a bow. Since root frame 221 forces
`equipped_weapon = 1` and `using_bow = false` at battle construction, a hero
always starts on a warrior controller and must spend one turn on
`swap_weapons` before either archer controller can be selected.

### Turn gating, forced phases, and per-turn re-entry

`getphase(whatsdoing)` runs its body only when `turnphase == 1`
(`+0x0355`–`+0x0365`); the whole body, including the jump to `heroactions`, is
skipped otherwise. On success it sets `turnphase = 2` (`+0x0372`) and
`inv_struck = false` (`+0x03a0`). `turnphase` is written back to `1` at exactly
one site in the build: overlay frame 1 timeline `+0x0a8f`. Therefore **at most
one `getphase` call takes effect per pass through frame 1**, and every later
call in that turn is a silent no-op.

Frame 1's timeline then runs a fixed chain of forced phases, all after the
`turnphase = 1` reset, in this order:

| Order | Condition | Forced call | Offsets |
| --- | --- | --- | --- |
| 1 | `ammo_left <= 0` and `using_bow == true` | `getphase("swap_weapons")` | `+0x0cce`–`+0x0d0e` |
| 2 | `staminaleft <= 0` | `getphase("rest")` | `+0x0d2e`–`+0x0d48` |
| 3 | `taunted1 == true` or `taunted2 == true` | facing right → `getphase("runleft")`, facing left → `getphase("runright")` | `+0x0d68`–`+0x0e35` |
| 4 | `frozen == true` | `getphase("frozen")` | clear `+0x0e79`, call `+0x0e81` |
| 5 | `burning == true` | `getphase("burning")` | read `+0x0ea1`, clear `+0x0ec5`, call `+0x0ecd` |
| 6 | `poison == true` | `getphase("poisoned")` | clear `+0x0f11`, call `+0x0f19` |
| 7 | `life_stolen == true` | `getphase("life_stolen")` | read `+0x0f39`, clear `+0x0f5d`, call `+0x0f65` |

These are sequential statements, not an if/else chain, and each one clears its
own flag *before* calling `getphase`. Combined with the `turnphase` gate this
means a lower-priority condition can have its flag consumed by a call that does
nothing — for example a forced rest at zero stamina clears and discards a
pending `burning` phase in the same pass.

**Row 3 is one of them, and that is easy to miss because it is the only row
whose clear sits inside a nested `if`.** Re-read in full off overlay frame 1 on
2026-09-17:

```text
if (hero.taunted1 == true || hero.taunted2 == true) {
  if (gladiators.hero.gladiator_dir == "right") { hero.taunted1 = false; getphase("runleft")  }
  if (gladiators.hero.gladiator_dir == "left")  { hero.taunted1 = false; getphase("runright") }
}
```

The write is inside the facing arm and before the call, exactly as rows 4-7
place theirs. So **a forced swap (row 1) or a forced rest (row 2) spends a
pending flee as surely as it spends a pending burn** — the gladiator is charged
for a run he never makes. `src/team/ss2-rules.js` models this as
`SS2_CHAIN_CLEAR_FLAGS`, which is also the list `forcedStatusFlag` ranks, since
in the build they are the same statements. Note also that the field is `poison`
while the phase label is `poisoned`.

The taunted-run rule is mirrored, not shared. The hero runs **against** its
facing (`gladiator_dir == "right"` → `runleft` at `+0x0dc2`/`+0x0de3`), whereas
`villainChooseAction` in frame 52 `DoAction@0x23f835` runs the villain **with**
its facing (`right` → `villaindecisionA = "runright"` at `+0x1224`/`+0x1246`,
`left` → `runleft` at `+0x1268`/`+0x128a`). The hero path clears only
`taunted1` in both branches (`+0x0ddb`, `+0x0e2d`) even though the entry
condition also tests `taunted2`; `villainChooseAction` clears each flag in its
own block (`+0x123e`, `+0x1282`, `+0x12e6`, `+0x132a`). `taunted1` is set true
at exactly one site in the build — the taunt phase at `+0x6ad9`, on
`game_defender` — and `taunted2` is **never** assigned `true` anywhere, so the
hero-side `taunted2` term and its missing clear are latent in this build.

Re-entry is per turn, not per action. `nextphase` (overlay frame 52
`DoAction@0x240c7f`, anonymous function at `+0x3193`) advances
`battle_action` while it is below 3 (`+0x3613`–`+0x3637`), and when it reaches
3 it calls `changeCombatants`, nulls `battle_action`, deletes both fighters'
`onEnterFrame` handlers and calls `this.gotoAndPlay("initialise")`
(`+0x3648`–`+0x3692`). So the selector, the `turnphase` reset and the forced
chain all re-run once per completed turn. `nextphase` also resets
`game_attacker.psyche_up = 1` whenever `phase_decision != "psyche_up"`
(`+0x35c7`–`+0x35ea`), and `damagecharacter` resets the defender's counter the
same way at `+0x1be4`.

### `getphase` does not validate its argument (byte-verified 2026-08-30)

The function is seven statements long and has been decoded in full. Its entire
body, in order:

```text
if (turnphase != 1) return;                    // +0x0355..+0x0365
decisionA = whatsdoing;                        // +0x036a  (the parameter, register:2)
turnphase = 2;                                 // +0x0372
this.battle_action = 1;                        // +0x037d
inventory_overlay.removeMovieClip();           // +0x038a..+0x039f
inv_struck = false;                            // +0x03a0
this.gotoAndPlay("heroactions");               // +0x03a8, +0x03b7 Play
```

There is **no label table, no membership test, and no read of `_currentframe`
or of any controller-frame state**. `whatsdoing` is stored verbatim. Downstream,
`phase_decision` is assigned at exactly five sites, all inside the
`attacker.onEnterFrame` machine and all selected by `battle_action`, not by
frame: `decisionA` at `+0x3a9b` (`battle_action == 1`), `villaindecisionA` at
`+0x3ac0`, `decisionB` at `+0x3ae5`, `villaindecisionB` at `+0x3b0a`, and `null`
at `+0x3b18`. All 75 `phase_decision` references in the build live in overlay
frame 52 `DoAction@0x240c7f`, and the dispatch from `+0x3b1f` onward is a flat
chain of string comparisons. The only two `_currentframe` reads anywhere in
that block are on other objects entirely — `damage_icon.damage_splat`
(`+0x18ad`) and `bullet` (`+0x9185`).

**This settles a disagreement with
[the runtime-capture workflow](ss2-runtime-capture.md) §Hero action
vocabulary**, which states that "`getphase(whatsdoing)` accepts only the labels
defined by the controller frame currently in scope". At the byte level that is
not a property of `getphase`; the table there is an accurate record of which
labels each controller frame **wires to buttons** (§Buttons wired per
controller frame above), which is a different claim. Nothing in the decode
implements "accepts only": there is no rejection path, no failure return, and
no state the function could consult to build one.

Two structural points make the same case without appealing to the decode alone.
The frame-1 row of that table is not a button set — those eight labels are the
forced phases frame 1 issues to *itself* (the table above), and seven of them
(`swap_weapons`, `runleft`, `runright`, `frozen`, `burning`, `poisoned`,
`life_stolen`) are wired by no controller frame anywhere, `rest` being the lone
exception. And frames 1–4 carry no `Stop`, so the playhead never rests on
`initialise`: by the time a label its forced call issued is dispatched at frame
52, the frame that "owned" it is long gone and nothing re-checks. The scope the
table describes is real for *what the player can press*, and has no
representation inside the dispatch path.

~~The consequence for the capture wrapper is that its availability gate
(`ss2-capture-wrapper.as`, `CONTROLLERS` / `stepAutopilot`, which refuses a step
the resting controller does not offer) is **stricter than the build requires**.
That is the safe direction and the gate should stay — an unattended run that
issues an unreachable label burns its one effective `getphase` for the turn and
stalls with no trace — but the restriction is the wrapper's, not the game's, and
neither this map nor the bytes should be cited as evidence for it.~~

► **CORRECTED 2026-09-07, verified independently, and the defect is worse than a
mis-description: this paragraph used the gate to underwrite a safety argument
the gate does not provide.**

The gate does **not** refuse "a step the resting controller does not offer". At
`ss2-capture-wrapper.as:1664-1665` it reads:

```
if (knownAutopilotAction[step] == true &&
    (controller == undefined || controller.actions[step] != true)) {
```

`knownAutopilotAction` is built once (`:345-347`) from the union of every
`CONTROLLERS` row. So the refusal fires only for a label that **appears in some
row but not the resting one**. A label in **no** row short-circuits the `&&`,
is merely logged as `autopilot-unknown:<step>` (`:1684-1687`), and reaches
`ov.getphase(step)` at `:1697` regardless of which controller is resting. The
wrapper says so itself at `:342-344`: *"An unknown label is passed through
rather than blocked: this table is a map of what the build offers, not a
whitelist the wrapper enforces."* There is no second gate — `launch-capture.ps1`
declares `$Autopilot` with no `ValidateSet`, and the `getphase` instrumentation
wrapper has no rejection path.

**And that inverts the hazard argument.** The labels this section itself names
unreachable — `swap_weapons`, `runleft`, `runright`, `frozen`, `burning`,
`poisoned`, `life_stolen` — are exactly the labels that appear in **no**
`CONTROLLERS` row (`swap_weapons` has one mention in the whole wrapper, the
comment at `:271-272` saying it is deliberately absent). They are therefore
exactly the set the gate lets straight through. **The gate protects against
labels that ARE offered somewhere; this paragraph's own hazard list is its blind
spot.** The gate is still worth keeping and the restriction is still the
wrapper's rather than the game's — but it is narrower than described, and it is
not evidence that an unreachable label cannot be issued.

*(Not a stale description: `git log -S knownAutopilotAction` gives one commit,
`7855015`, 2026-08-30 18:09, whose FIRST version already carries the
pass-through; this paragraph landed in `0a3076c` five hours later. It was never
true of any committed revision.)*

What is *not* settled is whether such a cross-controller call completes
end-to-end at runtime. Nothing above has been observed live, because every
capture so far issued only labels its resting controller offered. **The
experiment that would settle it** is one bout that calls
`getphase("power_attack")` while the overlay rests on frame 12
(`longrange_warrior`, which wires no melee attack) and shows a `checkattackroll`
draw plus a `defender-hurt` or `defender-blocked` event in the trace — a
melee attack takes no distance or range test (§Where `attack_direction` is
assigned), so nothing else should stand in the way. A single such capture would
confirm it; a stall with no roll would refute it and mean some gate exists that
this decode missed.

## Combatant state objects

Persistent combat data lives in `_root.game.hero` and `_root.game.villain`.
Display and animation state lives in `_root.arena.gladiators.hero` and
`_root.arena.gladiators.villain`. The combat controller repeatedly binds the
current pair into four globals:

- `attacker` and `defender`: movie clips;
- `game_attacker` and `game_defender`: persistent combat objects.

This split is the first adapter seam. Team mode should use combatant IDs and
keep `clipByCombatantId` outside deterministic state; it should not multiply
the existing hero/villain globals.

Runtime-observed 2026-08-30 (second capture, a charge collision): charge
impacts are dispatched through `checkattackroll` with `attack_direction`
still **undefined** — the applied damage equals the attacker's `min_damage`,
a −20..20 critical sample is drawn, and the standard deflection/removal/
damage path follows. The same capture observed the first-blood duel defeat
end-to-end (hp 30 of 40 in `duel` mode → `death` → `combatwon`), the
post-death knockback and enchantment rolls in the mapped order, the
overflow mutation order with `armourclass` left negative until the clamp,
and the byte-decoded death status-clear order, all live. A future schema
revision may model direction-undefined charge attacks as fixtures.

Runtime-observed 2026-08-30: the persistent combat objects leave the status
flags (`burning`, `frozen`, `poison`, `life_stolen`, `taunted1`, `taunted2`)
**undefined** until something sets them, and do not carry `gladiator_dir` at
action time — the facing lives on the fighter clips. The capture wrapper
normalizes undefined status flags to `false` and reads the facing from the
clip. Live captures also confirmed the `battlevalues` armour sums three
times over (boot 4 + greaves 4 → 20; helmet 2 + shield 2 → 44; breastplate 1
+ gauntlet 1 → 21), the full physical roll order of a normal attack, the
`attack_chances` normal formula (attack 3 vs defence 1 → chance 60, and a hit
against the derived `rollneeded` 40), the deflection threshold with helmet 2
(97), the armour-first damage path, and the unconditional breastplate-stamina
write.

**What a capture can and cannot confirm.** Every claim above rests on the
observed channels: the ordered mutation trace, the semantic events, the result
event, the state dumps, `attack_direction`, `fight_mode`, and the *number* of
draws in the armed window. A capture never observes a roll's bounds or value —
the wrapper's tap sits on `Math.random`, which takes no arguments, so each
`roll` line is echoed from the injected tape, which was generated from the
fixture under test (runtime-capture §What a match actually establishes). So
where a runtime note in this map names a roll value, that value was *supplied*
to the build; what the run measured is the outcome the build reached with it.
Only the draw count constrains the roll stream itself.

Observed data fields include:

| Group | Fields |
| --- | --- |
| Identity/progression | `character_name`, `herolevel`, `character_level`, `experience`, `experienceneeded`, `current_tournament`, `tournament_ranking` |
| Base stats | `strength`, `speed`, `attack`, `defence`, `vitality`, `stamina`, `charisma`, `magicka` |
| Live resources | `hitpoints`, `hitpointsmax`, `staminaleft`, `staminamax`, `armourclass`, `armourclass_max`, `ammo_left`, `maximum_ammo` |
| Primary weapon | `weapon`, `weapon_type`, `weapon_weight`, `weapon_range`, `weapon_min_damage`, `weapon_max_damage`, `weapon_enchantment_type`, `weapon_enchantment_potency`, `equipped_weapon`, `using_bow` |
| Secondary weapon | `secondary_weapon` plus the corresponding type, weight, range, min/max damage, and enchantment fields |
| Armour | `breastplate`, `helmet`, `shinguard`, `greaves`, `shoulderguard`, `gauntlet`, `boot`, `shield` and per-piece `_defence` fields |
| Derived combat | `physical_size`, `min_damage`, `max_damage`, `secondary_min_damage`, `secondary_max_damage`, `movement_speed`, `attack_type`, `attack_speed`, `weapon_enchantment_damage`, `secondary_weapon_enchantment_damage` |
| Chance cache | `power_percentage`, `normal_percentage`, `quick_percentage`, `bash_percentage`, `taunt_percentage`, `bombard_percentage`, `snipe_percentage`, `magicka_percentage` |
| Conditions | `psyche_up`, `taunted1`, `taunted2`, `burning`, `frozen`, `poison`, `life_stolen`, ~~and timed `spell_*` fields~~ — **the timed `spell_*` counters are NOT on this object** (corrected 2026-09-22): `check_spells` keeps every one on the fighter CLIP (r1, `which_avatar`), so a read of `_root.game.<side>.spell_*` sees nothing (§"Five more phases") |
| Inventory | `inventory1` through `inventory6`; and `inventory_maxslots` — **BYTE-DERIVED, NOT OBSERVED** (added 2026-09-22): read at `sprite:492[inventory_overlay]/frame:1` `+0x024f` and written by `initcharacter` `+0x098e`, it has never been observed by a capture and no committed observation record carries it, so it does not belong under this table's heading on the same footing as the rest |

`battlevalues(whichcharacter)` is `DefineFunction2` at `+0x3062` of root frame
35 `DoAction@0x3fa9dc`. Register bindings, read off the operands: `register:1`
is `_root`, `register:2` is `_global`, `register:3` is the `whichcharacter`
argument. Every offset below was re-read from the bytes on 2026-08-30 rather
than carried over.

### `battlevalues`: the unconditional derivations

These run on **every** call, in battle or out of it:

```text
physical_size        = 80 + round(strength / 1.5)                     // +0x30f1
breastplate_defence  = round(breastplate * _global.breastplate_dval)  // +0x3480
helmet_defence       = helmet > 25 ? round(herolevel * 0.5 * 10)      // +0x34eb
                                   : round(helmet * 10)               // +0x34bf
  (…the other six pieces likewise, +0x351f onward)
weapon_min_damage    = _root["weapon" + <char>.weapon][3]              // +0x31be
weapon_max_damage    = _root["weapon" + <char>.weapon][4]              // +0x31da
  (…and the secondary pair likewise from `secondary_weapon`, +0x32f4 onward.
   `_root.weapon<N>` is a STATIC literal table declared in this same root
   frame-35 block — e.g. `weapon24 = Array(3, "Hatchet", 4, 8, 32, 1)` at
   +0x41c6 — so the damage pair IS derivable from a character record plus a
   transcription of that table. ADDED 2026-09-02: the block below recorded
   `min_damage` while never saying where `weapon_min_damage` came from, which
   read as "it is an input" and was repeated as such in
   `src/team/ss2-rules.js`. That is the table-omits-what-the-derivation-needs
   failure again.)
weapon_enchantment_damage = ceil(weapon_max_damage / 3 * weapon_enchantment_potency)
                                                                       // +0x320c
secondary_weapon_enchantment_damage
                     = ceil(secondary_weapon_max_damage / 3
                            * secondary_weapon_enchantment_potency)     // +0x3326
  (This is the ONLY reader of `secondary_weapon_enchantment_potency` on this
   path; the enchantment PROC in `damagecharacter` reads the PRIMARY potency
   for both weapons — see the `damagecharacter` bullet below.)
min_damage           = round(strength * 2) + weapon_min_damage        // +0x3356
max_damage           = round(strength * 2) + weapon_max_damage        // +0x3386
secondary_min_damage = round(strength * 1) + secondary_weapon_min_damage  // +0x33b6
secondary_max_damage = round(strength * 1) + secondary_weapon_max_damage  // +0x33e6
if (using_bow) { min_damage = secondary_min_damage;                   // +0x3416
                 max_damage = secondary_max_damage; }
hitpointsmax         = herolevel * 10 + vitality * 20                 // +0x378e
staminamax           = 100 + stamina * 10                             // +0x37b6
movement_speed       = clamp(round(speed * 1.5), 4, 60)               // +0x37d2
_root.game.hero.experiencelast   = round((L-1)*(L-1)*((L-1)/5)*300)   // +0x3845
_root.game.hero.experienceneeded = round(L*L*(L/5)*300)               // +0x38d3
if (_root.game.hero.experienceneeded < 125) … = 125                   // +0x398c
```

#### The eight `<piece>_defence` fields, named (byte-verified 2026-08-31)

The `(…the other six pieces likewise)` shorthand above hid the fact a fixture
author needs, so the eight fields are enumerated here with their own assignment
sites. Every one of them is assigned on **every** `battlevalues` call, and
`nextphase` runs `battlevalues` for both combatants at every phase transition
(overlay frame 52 `+0x35f1` attacker, `+0x3605` defender). A fixture that states
piece ids but no `<piece>_defence` is not under-specified — it is describing a
state the build cannot hold, because the derived field is rewritten from the
piece id before the first roll. Staging the derived field alone is worse: it is
overwritten and the piece id it disagrees with wins.

| Field | Source id | `_global` multiplier | Assignment |
| --- | --- | --- | --- |
| `breastplate_defence` | `breastplate` | `breastplate_dval` 16 (`+0x3089`) | `+0x3480` |
| `helmet_defence` | `helmet` | `helmet_dval` 10 (`+0x3096`) | `+0x34bf` when `helmet <= 25`, `+0x34eb` when `helmet > 25` |
| `shinguard_defence` | `shinguard` | `shinguard_dval` 6 (`+0x30a3`) | `+0x351f` |
| `greaves_defence` | `greaves` | `greaves_dval` 3 (`+0x30b0`) | `+0x3546` |
| `shoulderguard_defence` | `shoulderguard` | `shoulderguard_dval` 8 (`+0x30bd`) | `+0x356d` |
| `gauntlet_defence` | `gauntlet` | `gauntlet_dval` 5 (`+0x30ca`) | `+0x3594` |
| `boot_defence` | `boot` | `boot_dval` 2 (`+0x30d7`) | `+0x35bb` |
| `shield_defence` | `shield` | `shield_dval` 12 (`+0x30e4`) | `+0x35f7`, or the flat `0` at `+0x3623` while `using_bow == true` (test `+0x35e2`) |

Two corrections to the way this range has been quoted elsewhere in the project.
**The span `+0x3480`–`+0x35e1` covers only seven of the eight.** It ends at the
`boot_defence` `SetMember`; `shield_defence` is a separate `using_bow` branch
beginning at `+0x35e2`, and it is the one piece whose contribution can be zero
while its id is non-zero. And **`helmet_defence` is branched, not flat** — both
arms assign the field, so "all eight are assigned on every call" stands, but the
value is `round(herolevel * 0.5 * helmet_dval)` above id 25 and
`round(helmet * helmet_dval)` at or below it.

The `using_bow` override at `+0x3416` was not previously recorded here, and the
map's earlier formula list implied the two pairs were independent. They are not:
it is a plain `if (using_bow)` (`GetMember`, `Not`, `If` past the block), so in
bow mode `min_damage`/`max_damage` are **overwritten by the secondary pair** —
carrying the `round(strength * 1)` scaling, not `round(strength * 2)`. Every
damage row in the `attack_direction` dispatcher (below) reads
`min_damage`/`max_damage`, so all of them silently follow the weapon mode.
Because `swap_weapons` writes only `using_bow` and `equipped_weapon`
(§Weapon mode and `swap_weapons`) and derives nothing itself, the damage pair
does not move at the instant of the swap: it moves at the next `battlevalues`,
which `nextphase` runs for both combatants at every phase transition.

**Hazard: the two experience writes are on `_root.game.hero` unconditionally.**
`L` above is `_root.game.hero.herolevel`, not `whichcharacter.herolevel`, and
both `SetMember` targets are `_root.game.hero` — `register:1`, never
`register:3`. They are not inside any branch. So **calling `battlevalues` for a
villain rewrites the hero's progression fields**, and `nextphase` calls it for
both combatants at every phase transition (`+0x35f1` attacker, `+0x3605`
defender). In vanilla this is invisible because the values are pure functions of
`herolevel` and so are idempotent; it becomes a real hazard for anything that
stages `experienceneeded`/`experiencelast`, or that calls `battlevalues` on a
scratch object and expects the hero untouched. The floor at `+0x398c` also
explains a correction the project made from observation: at `herolevel` 1 the
formula gives `round(1 * 1 * 0.2 * 300) = 60`, and the floor immediately
replaces it with **125** — which is the value the arena route measured live,
and 60 is what an audit reading the formula without the floor would report.

### `battlevalues`: the block skipped during a battle

`+0x3a90` reads `_global.battle_started`; if it is `true` the `If` at `+0x3aa0`
jumps 360 bytes to `+0x3c0d`, skipping this whole block:

```text
hitpoints       = round(hitpointsmax)                                 // +0x3aa5
armourclass_max = breastplate_defence + helmet_defence + shinguard_defence
                + greaves_defence + shoulderguard_defence
                + gauntlet_defence + boot_defence + shield_defence    // +0x3ac3
armourclass     = armourclass_max                                     // +0x3b0f
if (!(staminaleft > 0)) staminaleft = staminamax                      // +0x3b1c
if (!(ammo_left  > 0) || ammo_left == undefined)
                        ammo_left  = maximum_ammo                     // +0x3b45
character_xp    = secondary_min_damage + secondary_max_damage * 10
                + min_damage + max_damage * 20
                + weapon_enchantment_damage * 10
                + secondary_weapon_enchantment_damage * 10
                + herolevel^2 + armourclass * 10 + 150                // +0x3b82..+0x3c0c
```

Three consequences follow directly, and they are the reason staged fields
behave differently from one another:

- **`armourclass_max` is summed only outside a battle.** The eight per-piece
  `*_defence` fields are recomputed unconditionally at `+0x3480` onward, but
  nothing re-sums them into `armourclass_max` while `battle_started` is true,
  and `armourclass` is not reset either. Once a battle starts the only writer of
  `armourclass_max` in the whole build is `remove_armour`, which subtracts a
  destroyed piece's defence from it (`+0x0352`, `+0x048d`, `+0x064d`, `+0x072f`,
  `+0x087e`, `+0x0a1a`, `+0x0b69`, `+0x0cb8`) and zero-clamps it at `+0x0d94`;
  `armourclass` additionally takes the two damage ingresses' subtractions and
  `check_stats`'s clamps. This is the byte-level reason staged armour survives a
  bout where staged `hitpoints` does not — but see the sharper form below,
  because *which* armour field is staged decides the answer.
- **`hitpointsmax` is recomputed unconditionally** (`+0x378e`), while the full
  heal that would raise `hitpoints` to match is inside the skip. Combined with
  `check_stats` clamping `hitpoints` down to `hitpointsmax` (next section),
  a staged `hitpoints` above maximum cannot survive one phase transition, and a
  staged `hitpointsmax` cannot survive one `battlevalues` call.
- **`character_xp` is not recomputed during a battle.** It is the win reward's
  input (§Battle result and reward callbacks), and it is frozen at the value
  computed the last time `battlevalues` ran with `battle_started` false — i.e.
  at generation, when `armourclass` still equalled `armourclass_max`. The reward
  therefore reflects the loser's *undamaged* armour, whatever the bout did to it.

### `check_stats` is a pure clamp

`check_stats(whichcharacter)` is `DefineFunction2` at `+0x10e4` of overlay frame
52 `DoAction@0x240c7f`, and its body (`+0x110a`–`+0x11ff`) is three clamped
pairs and nothing else:

| Field | Upper clamp | Lower clamp |
| --- | --- | --- |
| `staminaleft` | to `staminamax` `+0x1122` | to `0` `+0x114b` |
| `hitpoints` | to `hitpointsmax` `+0x1174` | to `0` `+0x119d` |
| `armourclass` | to `armourclass_max` `+0x11c6` | to `0` `+0x11ef` |

No other member is written, nothing is derived, and there is no RNG. The lower
clamps are `if (!(x > 0)) x = 0`, so they also convert `undefined` and `NaN` to
zero.

It has exactly **11 call sites** (12 references including the definition):
`magic_damage_character` `+0x14e0`, `damagecharacter` `+0x193c`, six inside
`nextphase` (`+0x334d`, `+0x33b1`, `+0x346a`, `+0x3523`, `+0x3535`, `+0x35bb`),
and three in the `attacker.onEnterFrame` machine (`+0x525c`, `+0x5d6d`,
`+0x68d3`). Both damage ingresses call it **one instruction before the defeat
gate** — `+0x1948 CallFunction`, `+0x1949 Pop`, `+0x194a` first opcode of the
gate — so the gate always tests clamped values.

**The sharp form of "staged armour survives".** `check_stats` clamps
`armourclass` to `armourclass_max`, and in battle `armourclass_max` is whatever
it was when the fight began. So:

| Staged field | Survives a phase transition? |
| --- | --- |
| `helmet`, `greaves`, … (piece ids) | yes — never written by `battlevalues` |
| `<piece>_defence` | **no** — recomputed from the piece id at `+0x3480` onward |
| `armourclass_max` | yes — its only writers in battle are `remove_armour` |
| `armourclass` | yes, but clamped to the current `armourclass_max` |
| `hitpoints`, `hitpointsmax`, `min_damage`, `max_damage`, `staminamax`, `physical_size`, `movement_speed` | no — recomputed unconditionally |

This is a static reading of the writers, not a runtime measurement. The two
rows that matter for the `candidate-armoured-*` family are the second and
third: staging a `<piece>_defence` name alone is overwritten before the first
roll, and staging piece ids alone changes the deflection threshold and
`remove_armour`'s piece selection without moving `armourclass_max`. Confirming
which of those a capture actually produces needs a bout, not a decode.

Back in `battlevalues`: the armour piece multipliers are written to `_global` at
the top of that function (`+0x3089`–`+0x30f0`) as `<piece>_dval` —
breastplate 16, helmet 10,
shinguard 6, greaves 3, shoulderguard 8, gauntlet 5, boot 2, and shield 12.
Helmet normally contributes `round(helmet * helmet_dval)`, but a helmet value
above 25 instead contributes `round(herolevel * 0.5 * helmet_dval)`
(`+0x34a7`–`+0x351e`). Shield defence is zero while `using_bow`; otherwise it
contributes `round(shield * 12)`. Thus `armourclass_max` does not always include
the shield. These are verified static calculations, but they are not yet a
complete save-schema map.

Maximum ammunition is tiered by character level: 5 below level 9, 10 for levels
9–22, 15 for 23–27, 20 for 28–34, 25 for 35–44, and 30 at level 45 or above
(the chain runs `+0x3634`–`+0x378d`, with the assignments at `+0x364b`,
`+0x368e`, `+0x36d1`, `+0x3714`, `+0x3757` and `+0x3781`; the level-45 arm
re-tests `herolevel >= 35` redundantly at `+0x3769`, which changes nothing).
The tier assignment is unconditional, but the `ammo_left` refill that consumes
it is inside the `battle_started` skip above.

## Stamina: every reader, every writer, and the `staminacost` table

Byte-verified 2026-08-31 against the same installed SWF and fingerprint.
Reproduce the inventory with:

```powershell
node tools/inspect-swf.mjs "$ss2Install\swf\swords_sandals2_download.swf" `
  --references 'staminaleft' --max-actions 200
```

It reports **42 reference lines**. Those resolve to **20 read statements and 15
write statements**: seven of the writes spend two reference lines each, because
they read the field they update.

Two claims about `staminaleft` have circulated in this project and they are not
the same claim. Stated separately:

- **Narrow, and TRUE.** No formula in the attack-resolution chain reads
  `staminaleft`. `attack_chances`, `checkattackroll` (`+0x2c30`–`+0x3192`), the
  deflection block (`+0x3030`–`+0x3095`), `remove_armour` and `destroy_armour`
  contain **zero** references of any kind; the two damage ingresses touch the
  field only to *add* to it, and the defeat gate reads `hitpoints`. A staged
  `staminaleft` cannot move a hit chance, a roll, a damage number, a deflection
  threshold or a death.
- **Broad, and FALSE.** `staminaleft` is read at twenty sites in the build, and
  they decide *which phase runs at all* — which buttons exist, whether a forced
  rest pre-empts the turn, and what the villain chooses. The field is upstream
  of the chain, not absent from it.

### The twenty readers

| Site | Offsets | What the read decides |
| --- | --- | --- |
| `combat_panel` `hero_stamina_potion` clip-action | `+0x0087`, `+0x00c7` | meter text and percentage — presentation only, and note the members it writes are named `hitpoints` and `hitpointpercentage` on the stamina clip too, because both meters are the same component |
| `combat_panel` `villain_stamina_potion` clip-action | `+0x008a`, `+0x00ca` | same, villain side |
| overlay frame 1 timeline | `+0x0d2e` | `staminaleft <= 0` forces `getphase("rest")` (§Turn gating, order 2) |
| overlay frame 5 `DoAction@0x238de2` | `+0x0c0a`, `+0x10a2` | `staminaleft / staminamax * 100 >= 50` wires `taunt` into the shared `longrange_warrior` slot and below it `rest`, one site per facing (§Buttons wired per controller frame) |
| overlay frame 20 `DoAction@0x23b16b` | `+0x0c15`, `+0x110a` | the same test on `longrange_archer` |
| `villain_cast_spells` | `+0x0a5a`, `+0x0acf` | `villain.staminaleft < villain.staminamax / 2` rewrites the decision to `drink_potion` and calls `use_item` |
| `villainChooseAction` | `+0x03e8` | `staminaleft > 10` gates ~~the **entire** action-choice block~~ **the IN-RANGE action-choice block only** (the false arm jumps 1,209 bytes past it, to the `rest` write at `+0x08b6`) — *corrected 2026-09-22 by a write-nothing verifier: the gate sits inside the in-range test at `+0x03d5`, whose failure jumps to `+0x08c3`, so an out-of-range villain at 10 stamina or less is never sent to rest by it; and the function's LAST statement, `villain_cast_spells()` at `+0x1432`, is unconditional and can replace the rest (§"The spell ladder runs LAST")* |
| `villainChooseAction` | `+0x0b33`, `+0x0e22` | `staminaleft / staminamax * 100 < 40` picks `rest`, at or above it `taunt` |
| `villainChooseAction` | `+0x0b9f`, `+0x0e8e` | `staminaleft / staminamax * 100 < 30` picks `rest`, at or above it **`wincrowd`** |

► **CORRECTED 2026-09-02, re-read from the bytes.** The two rows above were ONE
  row, reading "`+0x0b33`, `+0x0b9f`, `+0x0e22`, `+0x0e8e` | on the
  `choices > 95` arm of both facings, `staminaleft / staminamax * 100 >= 40`
  picks `taunt` and below it `rest`". That conflates two different thresholds
  selecting two different actions: `+0x0b9f` and `+0x0e8e` push **30**
  (`+0x0bc3`, `+0x0eb2`) and assign **`wincrowd`** (`+0x0bd3`, `+0x0ec2`), not
  40 and `taunt`. Found by an adversarial verifier and confirmed directly.

  **This row was the cited evidence for a rest gate in `src/team/ss2-rules.js`,
  and the gate has been removed as unsupported.** Both tests are reached only
  inside a `choices` band arm, so neither licenses a threshold applied to every
  villain decision; the only unconditional villain stamina gate is
  `staminaleft > 10` at `+0x03e8`. Which band arm each belongs to, and whether
  the 30/`wincrowd` block sequentially overwrites the 40/`taunt` one within a
  facing, is NOT settled here — it needs a full decode of `+0x0b00`-`+0x0c00`.
| `villainChooseAction` | `+0x1173` | after a movement label is written, `staminaleft > 0` failing replaces it with `rest` |
| `check_stats` | `+0x110a`, `+0x112f` | the two clamp tests (§`check_stats` is a pure clamp) |
| `battlevalues` (root frame 35) | `+0x3b1c` | `staminaleft > 0` failing triggers the refill below — inside the `battle_started` skip, so out of battle only |

Note the two AI thresholds differ from the hero's: the villain needs 40% to
prefer `taunt` and any value above 10 to act normally, while the hero's
long-range button swap is at 50%.

### The fifteen writers

| Site | Offset | Effect |
| --- | --- | --- |
| `nextphase` | `+0x32a7` | `game_attacker.staminaleft -= game_attacker.staminacost` |
| `nextphase` | `+0x32c9` | `game_attacker.staminaleft += 1 + round(game_attacker.stamina / 3)` |
| `nextphase` | `+0x349b` | `+= round(game_attacker.staminamax / 4)`, only while `attacker.spell_boundless_energy > 0` (test `+0x347c`) |
| `damagecharacter` | `+0x1928` | `game_defender.staminaleft += stamina_bonus` (§Attack roll dispatcher for the `ceil(breastplate * damage / 100)` join) |
| `magic_damage_character` | `+0x14cc` | the same unconditional join on the spell ingress |
| `check_stats` | `+0x1122` | ceiling at `staminamax` |
| `check_stats` | `+0x114b` | floor at `0`, which also converts `undefined` and `NaN` to zero |
| `rest` branch | `+0x521d` | `+= game_attacker.stamina` (`bonus` bound at `+0x5208`) |

► **CORRECTED 2026-09-02, and the omission cost a session. The `rest` branch
  ALSO writes hitpoints, at `+0x51d5`**: `game_attacker.hitpoints += 3 +
  ceil(game_attacker.stamina)`, inside the same `attacker.struck == null` guard
  (`+0x51a2`) as the `+0x521d` stamina write above it, three statements earlier
  in the same arm. It is missing from every writers table in this document,
  while the PROSE at § "Battle result and reward callbacks" states it correctly.
  A reader who trusts the tables over the prose — which is what a table is for —
  concludes the only site for that expression is `+0x684c` in the taunt branch,
  and the taunt table below says exactly that. **`+0x684c` is the copy.** This
  is what happened: `src/team/ss2-rules.js` was written asserting that
  `+0x684c` was the sole site, the map was overruled, and a test was written to
  pin the resulting wrong number. Two adversarial verifiers broke it
  independently and the bytes were then read directly.

  A rest therefore heals `3 + ceil(stamina)` from the branch AND
  `1 + ceil(stamina / 2)` from `nextphase` — `4 + ceil(stamina) +
  ceil(stamina / 2)` in total, clamped by `check_stats` at `+0x5266` and again
  at `+0x334d`.
| `drink_potion`, `inventory_action == 6` (test `+0x5aaf`) | `+0x5af7` | `+= round(staminamax * 0.5)` |
| `drink_potion`, `inventory_action == 7` (test `+0x5b5f`) | `+0x5b9a` | `+= round(staminamax)` |
| `taunt` branch | `+0x6894` | `+= game_attacker.stamina` |
| `cast_rejuvinate` | `+0x8e1d` | `= game_attacker.staminamax`, beside the matching `hitpoints` and `armourclass` restores at `+0x8e08` and `+0x8e32` |
| overlay frame 62 `combatwon` `DoAction@0x24a1c5` | `+0x01a4` | `_root.game.hero.staminaleft = staminamax` on every won bout |
| `battlevalues` | `+0x3b38` | `= staminamax`, only when the `+0x3b1c` test fails **and** `battle_started` is false |
| sprite 2249 `initbattle` frame 1 `DoAction@0x6e421b` | `+0x0b9c` | `_root.game.villain.staminaleft = _root.game.villain.staminamax` |

The last two rows and frame 62 together settle where a bout *starts*: the
villain is refilled unconditionally at `initbattle` (`+0x0b9c`), and the hero is
refilled on every victory (`+0x01a4`). There is no hero counterpart to
`+0x0b9c` — the 42-line inventory contains exactly one `staminaleft` write in
sprite 2249, and it is the villain's. So a mid-ladder hero arrives full because
it *won*, not because the arena set it, and a first bout depends on whatever
`battlevalues` last did out of battle.

### `staminacost` by phase

The cost is set inside the phase branch and spent later, in `nextphase`
(`+0x32a7`). It is therefore **path-determined**: the value of `staminaleft` at
any `checkattackroll` reflects the actions already taken, not the scenario.
`--references 'staminacost'` reports **43 lines**: the single read at `+0x32bb`
and **42 assignment sites**, every one of them below. All 42 are inside overlay
frame 52 `DoAction@0x240c7f` and all 42 write `game_attacker.staminacost` — no
phase writes the defender's. This is the table that lets a fixture *derive* a
`staminaleft` instead of copying one.

| Phase label(s) | Site | `staminacost` |
| --- | --- | --- |
| `walkleft` | `+0x3b37` | `round(movement_speed / 2)` |
| `walkright` | `+0x3d16` | `round(movement_speed / 2)` |
| `runleft` | `+0x3ef5` | `round(movement_speed / 2)` |
| `runright` | `+0x407e` | `round(movement_speed / 2)` |
| `chargeright` | `+0x4214` | `round(movement_speed * 2)` |
| `chargeleft` | `+0x4480` | `round(movement_speed * 2)` |
| `jumpright` | `+0x46ec` | `round(movement_speed)` |
| `jumpleft` | `+0x49c4` | `round(movement_speed)` |
| `block` | `+0x4ca4` | `7` |
| `swap_weapons` | `+0x4d35` | `1` |
| `wincrowd` | `+0x5014` | `3` |
| `rest` | `+0x5163` | `0 - round(stamina * 15)` — **negative** |
| `frozen` | `+0x52c6` | `0` |
| `life_stolen` | `+0x53fa` | `0` |
| `poisoned` | `+0x552e` | `0` |
| `burning` | `+0x5662` | `0` |
| `drink_potion` | `+0x5792` | `0` |
| `shove` | `+0x5dd3` | `round(strength * 1.5)` |
| `power_attack` | `+0x603c` | `round(strength * 3)` |
| `normal_attack` | `+0x61a3` | `round(strength * 2)` |
| `quick_attack` | `+0x6317` | `round(strength)` |
| `bash_attack` | `+0x6475` | `round(strength * 2)` |
| `psyche_up` | `+0x653f` | `round(strength)` |
| `taunt` | `+0x67bb` | `round(charisma * 2)` |
| `bombardright` \| `bombardleft` \| `sniperight` \| `snipeleft` | `+0x6bb5` | `round(strength * 3)` — one shared branch (`+0x6b53`–`+0x6b9d`) |
| `cast_teleport` | `+0x7567` | `round(magicka)` |
| `cast_adulation` | `+0x76d4` | `round(magicka)` |
| `cast_weaken_armour` | `+0x77a2` | `round(magicka)` |
| `cast_whirlwind` | `+0x7900` | `round(magicka)` |
| `cast_gale` | `+0x7ad0` | `round(magicka)` |
| `cast_command` | `+0x7c0c` | `round(magicka)` |
| `cast_ghost_strike` | `+0x7ddd` | `round(magicka)` |
| `cast_colossus` | `+0x8011` | `round(magicka)` |
| `cast_little_fat_kid` | `+0x822f` | `round(magicka)` |
| `cast_lightning_bolt` \| `cast_frightning_bolt` | `+0x842f` | `round(magicka)` — one shared branch |
| `cast_death_from_above` | `+0x8655` | `round(magicka)` |
| `cast_swiftsandals` | `+0x8994` | `round(magicka)` |
| `cast_bloodlust` | `+0x8a97` | `round(magicka)` |
| `cast_regenerate` | `+0x8be2` | `round(magicka)` |
| `cast_boundless_energy` | `+0x8cc1` | `round(magicka)` |
| `cast_rejuvinate` | `+0x8d8f` | `round(magicka)` |
| `cast_fireball` \| `cast_hell_fireball` \| `cast_dire_fireball` | `+0x8fa7` | `round(magicka)` — one shared branch |

Every `strength`, `charisma`, `magicka`, `stamina` and `movement_speed` above is
read off `game_attacker` at the moment the branch runs, and `movement_speed` is
itself `clamp(round(speed * 1.5), 4, 60)` recomputed by `battlevalues` at
`+0x37d2`.

Five rows of this table contradict figures that have circulated in project
notes, and the bytes are the arbiter:

| Phase | Circulated | Byte-verified |
| --- | --- | --- |
| `bash_attack` | `20` | `round(strength * 2)` |
| `psyche_up` | `10` | `round(strength)` |
| snipe | `30` | `round(strength * 3)`, shared with bombard |
| `rest` | `0` | `0 - round(stamina * 15)` |
| `shove`, `wincrowd` | absent | `round(strength * 1.5)`, `3` |

The `rest` row is the one that changes arithmetic elsewhere. Because
`nextphase` spends the cost by subtraction, a negative cost is a **gain**: a
completed rest adds `round(stamina * 15)` on top of the baseline
`1 + round(stamina / 3)`, which is why the rest phase can refill a bar in one
turn rather than trickling it back.

### Movement DISPLACEMENT by phase — added 2026-09-11, and the gap it closes

**This document carried the eight movement phases' stamina COST for twelve days
and no phase's DISTANCE, and that omission became a `MAP_SILENCE` entry, an
authored constant, and a ranked next step that sent a session to the capture
archive.** The distance is in the same eight branches as the cost, a handful of
instructions below it. Read 2026-09-11 off `77cb545c…`; every offset below is
relative to the same block as the cost table above
(`sprite:862/frame:52/DoAction@0x240c7f`, action data at `0x240c85`), and
`tools/walk-displacement-derivation.mjs` re-reads all of it from the installed
build on demand.

A movement phase does not move a gladiator. It sets a **destination** and then
eases toward it over several frames:

```text
if (attacker.destination == null) {                 // once per phase
  attacker.gotoAndPlay(<clip>)
  attacker.destination = attacker._x -/+ <step>
  // clamped, per phase — see below
}
attacker._x -/+= Math.ceil((attacker._x - attacker.destination) / 8)   // every frame
if (!(attacker._x >/< attacker.destination +/- 20)) {                  // within 20: done
  attacker.destination = null
  nextphase()
}
```

| Phase | clip | `<step>` | `Push <factor>` | bonus | stop |
| --- | --- | --- | --- | --- | --- |
| `walkleft` | `StepBack` | `movement_speed * 16` | `+0x3b99` | `boot` `+0x3bb5` | 20 `+0x3cd0` |
| `walkright` | `StepForward` | `movement_speed * 16` | `+0x3d78` | `boot` `+0x3d94` | 20 `+0x3eaf` |
| `runleft` | `RunBack` | `movement_speed * 40` | `+0x3f69` | none | **10** `+0x4038` |
| `runright` | `RunForward` | `movement_speed * 40` | `+0x40f2` | none | **10** `+0x41c1` |
| `chargeleft` | — | `movement_speed * 20` | `+0x44f4` | none | none — see below |
| `chargeright` | — | `movement_speed * 20` | `+0x4288` | none | none — see below |
| `jumpleft` | `Superjump` | `round(movement_speed * 0.6)` **per frame** | `+0x4a3d` | `shinguard` `+0x4a6f` | n/a |
| `jumpright` | `Superjump` | `round(movement_speed * 0.6)` **per frame** | `+0x476e` | `shinguard` `+0x47a1` | n/a |

**The `stop` column is per phase and the first version of this table omitted it**,
which invites reading a run's realised step as `40 * movement_speed - 20`. It is
`- 10`. The offsets in the factor column are the `Push <factor>` literal itself;
the `Push "destination", "attacker"` that opens each assignment is a second, also
correct set (`+0x3f4f`, `+0x40d8`, `+0x44da`, `+0x426e`, `+0x4b69`, `+0x487c`) and
naming both conventions here is deliberate, because three were in play at once.

The bonus, where a phase takes one, is

```text
bonus = get_percentage(100 + <piece> * 2, 100)        // = 100 + 2 * piece
step  = add_percentage(step, bonus)                   // = ceil(step * bonus / 100)
```

with both helpers defined in the same block (`+0x1089`, `+0x10ba`). **Their
parameters sit in registers 2 and 1 respectively**, so reading the bodies
without the `DefineFunction2` headers inverts both and turns a boot bonus into a
boot penalty. Heavier boots make a walk LONGER; heavier shinguards make a jump
longer.

Three consequences worth stating separately, because each was got wrong once:

1. **The realised displacement is the step MINUS the gap the phase stopped
   with.** At the `movement_speed` clamp floor of 4 with no boots the step is 64
   and the easing runs `64 -> 56 -> 49 -> 42 -> 36 -> 31 -> 27 -> 23 -> 20`,
   stopping with 20 to run: **44**. That is where the repository's uncited
   *"one walk is 44 px"* came from, and it is the floor case, not the rule.
   Two things that look like details and are not: the per-frame update is
   UNCONDITIONAL and runs BEFORE the stop test (the init block falls through with
   no `Jump`), so the loop is a do/while and a step inside the tolerance still
   moves the gladiator once; and `add_percentage` DIVIDES BEFORE MULTIPLYING
   (`+0x10c5`) while `get_percentage` round-trips `/100*100`, so the bonus path is
   lossy in IEEE-754 doubles and collapsing it into `ceil(step * bonus / 100)`
   changes the answer by +1 at six reachable `(movement_speed, boot)` pairs.
2. **A walk CLIPS its destination against the opponent; a charge GATES its
   advance, and those are different structures.** The walk clips to
   `defender._x -/+ game_defender.physical_size` (`+0x3de6` / `+0x3c07`), guarded
   on the attacker's `gladiator_dir` so it binds only forwards, and it is computed
   ONCE inside the `destination == null` init block — never recomputed while the
   gladiator eases, so a model that re-clips every step is stricter than the
   build. The charge's destination (`+0x4288`) is **never clipped**: `+0x4293`..
   `+0x42cc` is `if (!(attacker._x > round(defender._x - game_attacker.weapon_range)))
   { _x += ceil((destination - _x) / 8) }`, a per-frame advance gate, with the
   same threshold re-tested at `+0x431a` to fire `Chargeattack` (`+0x437e`).
   *(This entry said a charge "clips to" that threshold; the quantity and the
   offset were right and the structure word was wrong. The two readings diverge
   the moment the defender moves mid-charge.)*
3. **A RUN ABORTS WHERE A WALK CLIPS, and the flee can reach neither.** Derived
   2026-09-17, and it belongs beside item 2 rather than inside it because it is
   a THIRD structure. Both run arms carry a body test, and it is not the walk's:

   ```text
   runleft  +0x3fbd  if (attacker.gladiator_dir == "left"
                         && attacker._x < defender._x + attacker.physical_size)
                       { attacker.destination = null; nextphase() }
   runright +0x4146  if (attacker.gladiator_dir == "right"
                         && attacker._x > defender._x - attacker.physical_size)
                       { attacker.destination = null; nextphase() }
   ```

   Three differences from the walk's clip, every one of them load-bearing: it
   tests the LIVE `_x` every frame rather than the destination once; it ends the
   phase outright rather than shortening it; and it measures against the
   ATTACKER's `physical_size` where the walk measures against
   `game_defender.physical_size`. The `&&` is AVM1's short-circuit form
   (`Equals2`/`Duplicate`/`Not`/`If`, joining at the shared `Not` before the
   branch), so the facing test is evaluated first and the body test is not
   evaluated at all when it fails.

   ► **AND THE TAUNTED FLEE INVERTS THE GUARD, so a fleeing gladiator runs
     THROUGH the man who taunted him.** Frame 1 row 3 sends
     `gladiator_dir == "right"` to `runleft` and `== "left"` to `runright`
     (re-read off overlay frame 1 on 2026-09-17), so the arm that runs is always
     the arm whose guard is false. Nothing in the run arm bounds a flee; only
     `nextphase` step 1's `[-2100, 2100]` does. An external review of `cbaf406`
     called the engine's missing collision check a bug, which it would have been
     had the guard read the other way — `test/ss2-taunt.test.js` now pins the
     crossing, and the walk in the same geometry beside it, so that "adding the
     clamp" fails loudly rather than looking like a tidy-up.

4. **A jump may be determined after all, and this entry said it is not.** It adds
   to `_x` every frame of the `Superjump` clip instead of setting a destination
   (`+0x487c`, with `_y += attacker.leap` at `+0x4913`). An investigating agent
   reports the add runs `(2L + 1)` times, with `L` the clamped `|leap|` in
   `[8, 36]`, which would make the total
   `(2L + 1) * ceil(round(movement_speed * 0.6) * (100 + 2 * shinguard) / 100)`.
   **One agent's reading, no verifier aimed at it — a lead, not a derivation.**

### The per-turn mutation is attacker-only

`nextphase` `+0x32a1`–`+0x3304` is two consecutive statements on
`game_attacker.staminaleft` — the cost subtraction and the regeneration — with
**no `game_defender` counterpart anywhere in the function**. The only defender
touch in that neighbourhood is ~~`check_spells(defender, game_defender)`~~
`check_spells(game_defender, defender)` at `+0x3289` *(argument order corrected
2026-09-22: the last value pushed is the first argument, and `check_spells`'s
header binds the clip to r1, where every counter lives — see §"Five more
phases")*. The hitpoint regeneration immediately after (`+0x3305`–`+0x3346`,
`+= 1 + ceil(stamina / 2)`) is attacker-only for the same reason.

Neither statement is inside a branch. The enclosing function begins at `+0x3193`;
the four `_x` clamps before them (`If` at `+0x31cc`, `+0x31f8`, `+0x3224`,
`+0x3250`) all close by `+0x3266`, and the next conditional in the function is
the `spell_regenerate` test at `+0x33c3` (`If` at `+0x33d7`). So the attacker
pays and regenerates on **every** phase transition, and a combatant standing
still as defender neither pays nor recovers until the sides swap. Any simulation
that regenerates both sides per turn will drift from the build.

### The `taunt` branch restores inline

The `rest` restoration is not the only one. The `taunt` branch carries its own
copy, and it fires on a completed taunt rather than on a rest:

| Step | Offset | Effect |
| --- | --- | --- |
| cost | `+0x67bb` | `staminacost = round(charisma * 2)` |
| watchdog | `+0x67e4` | `taunttimer++`; at `> 60` (`+0x67ee`) it zeroes the timer, nulls `attacker.struck` (`+0x6812`) and calls `nextphase` (`+0x681f`) |
| guard | `+0x6835`–`+0x6841` | the restoration runs only while `attacker.struck == null` |
| hitpoints | `+0x684c` | `game_attacker.hitpoints += 3 + ceil(game_attacker.stamina)` — **a COPY. The original is the rest branch's own `+0x51d5`; see the correction in § "The fifteen writers"** |
| stamina | `+0x6894` | `game_attacker.staminaleft += game_attacker.stamina` (`bonus` bound at `+0x687f`) |
| clamp | `+0x68d3` | `check_stats(game_attacker)` |
| re-arm | `+0x68f0` | `attacker.struck = false` |

Two things about that guard are worth stating precisely, because a note
elsewhere in the project records the opposite polarity. The decoded test is
`attacker.struck == null` — the `If` at `+0x6841` jumps **past** the
restoration when `struck != null`. And the re-arm at `+0x68f0` writes `false`,
not `null`, which under AVM1 abstract equality is *not* equal to `null`; so the
block self-disarms after one pass and is re-armed only by the `+0x6812` write
the 60-tick watchdog performs. A fresh clip whose `struck` is still `undefined`
also satisfies the guard, because `undefined == null` is true. How many times
this fires across one taunt is therefore a runtime question, not a decode one,
and it is not settled here.

## RNG surface

Combat is not seeded in vanilla. Identical `randomBetween(a, b)` functions are
defined three times—overlay frame 52 blocks `0x23f835` and `0x240c7f`, and root
frame 35 block `0x40198e`—and are inclusive:

```text
floor(Math.random() * (b - a + 1)) + a
```

The battle code also uses AVM1's direct `RandomNumber` opcode. Some direct uses
are cosmetic (`destroy_armour` consumes three direction-dependent debris rolls
after a piece is selected, and crowd movement consumes others), while some
choose `attack_direction` and therefore affect combat. Exact deterministic parity
cannot be achieved by replacing only `randomBetween`; both sources must be
routed through one ordered roll stream, with cosmetic rolls either represented
in that stream or removed from authoritative simulation.

The overlay's complete `RandomNumber` inventory is small enough to enumerate
(byte-verified 2026-08-30; ~~nine~~ **ten** opcode sites on sprite 862 —
*corrected 2026-09-07: the table below enumerates ten offsets (2 + 2 + 1 + 3 +
2), and excluding the frame-74 `combatlost` pair as "outside the turn loop"
gives eight. No reading of the table produces nine. The per-site conclusions are
unaffected*):

| Site | Use | Draws per invocation |
| --- | --- | --- |
| `destroy_armour` `+0x0dfb`, `+0x0e28` | `xspeed`, `-30 + RandomNumber(20)` facing right or `10 + RandomNumber(30)` facing left | exactly one of the two |
| `destroy_armour` `+0x0e5b`, `+0x0e6f` | `dy = -40 + RandomNumber(20)`, `rotationspeed = -5 + RandomNumber(5)` | both, unconditionally |
| `attacker.onEnterFrame` `+0x5091` | `attacker.wincrowd_move = 1 + RandomNumber(6)`, only while the member is `undefined` (`+0x5071`) | at most one per battle |
| `attacker.onEnterFrame` `+0x7815`, `+0x7845`, `+0x7875` | `attack_direction = 1 + RandomNumber(9)` on the `cast_weaken_armour` path | three |
| frame 74 `DoAction@0x24a8ba` `+0x0149`, `+0x039b` | `combatlost` presentation, outside the turn loop | — |

So `destroy_armour` consumes exactly three rolls per call, of which only the
first is facing-selected — and if `gladiator_dir` matches neither `"right"` nor
`"left"`, that first roll is instead `randomBetween(-30, 60)` at `+0x0e30`,
which *would* consume a tape slot. Only the `cast_weaken_armour` trio is
authoritative; the rest is presentation, but the fallback above shows the
cosmetic path can still perturb tape position.

Two `randomBetween` draws on the taunt path also precede `checkattackroll` and
must be budgeted before its own `diceroll`: `diceroll = randomBetween(1, 100)`
at `+0x6921`, which succeeds when `diceroll < game_attacker.taunt_percentage`
(`+0x694b` — note the polarity is the direct comparison, not the dispatcher's
`100 - chance` form), and then `taunt_effect = randomBetween(1, 2)` at
`+0x6952`. Only `taunt_effect == 1` sets `attack_direction = 20` and calls
`checkattackroll`; `taunt_effect == 2` runs a charisma-scaled knockback or sets
`game_defender.taunted1 = true` (`+0x6ad9`) and never reaches the dispatcher.
The taunt phase also carries a 60-tick watchdog (`taunttimer`, `+0x67e4`) that
calls `nextphase` and abandons the phase if the animation never reports back.

Recommended adapter boundary: rules accept explicit samples (or an injected,
versioned RNG) and emit outcomes. Movie clips consume outcomes and may use a
separate cosmetic RNG that never changes state hashes.

## Hit and damage path

### Chance calculation

`attack_chances(game_attacker, game_defender)` writes the following rounded
percentages. `ratio` is `(attacker.attack + 9) / (defender.defence + 9)`.

| Action | Vanilla calculation |
| --- | --- |
| power | `round(ratio * 100 * 0.33)` |
| normal | `round(ratio * 100 * 0.50)` |
| quick | `round(ratio * 100 * 0.66)` |
| bash | `round(ratio * 100 * 0.20)` |
| taunt | `round(((attacker.charisma + 9) / (defender.charisma + 9)) * 100 * 0.40)` |
| bombard | `round(ratio * 100 * 0.60)`, then a shield percentage adjustment |
| snipe | `round(ratio * 100 * 0.90)`, then the same shield adjustment |
| magicka | `round(((attacker.magicka + 9) / (defender.magicka + 9)) * 100 * 0.50)` |

Power, normal, quick, bash, taunt, bombard, and snipe are clamped to 1–99.
No magicka clamp occurs in this function.

The shield adjustment reconstructs as
`ceil(base * (100 + attacker.shield * 1.5) / 100)`. The bytecode explicitly
reads `game_attacker.shield`, so a larger attacker shield increases bombard and
snipe chance. This is counterintuitive; treat it as a statically mapped build
behavior or possible vanilla bug and confirm it with golden runs before
encoding measured rules.

### Where `attack_direction` is assigned (byte-verified 2026-08-30)

The dispatcher table below records what each direction band *means*; this
records where the value comes from. Across the whole build `attack_direction`
is assigned at seventeen sites — fifteen to the overlay timeline variable, and
two to a same-named member on the fighter clip — all inside overlay frame 52
`DoAction@0x240c7f`, and all inside the one anonymous function assigned to
`attacker.onEnterFrame` at `+0x36ae` (the `phase_decision` state machine).
Everything else that mentions the name is a read, or the shadowing parameter of
`remove_armour(whichcharacter, whichavatar, attack_direction)` and
`damagecharacter(..., attack_direction)`.

| Phase branch | Site | Expression | RNG kind |
| --- | --- | --- | --- |
| `power_attack` (`+0x601d`) | `+0x608a` | `randomBetween(9, 12)` | `randomBetween` |
| `normal_attack` (`+0x6191`) | `+0x61f1` | `randomBetween(5, 8)` | `randomBetween` |
| `quick_attack` (`+0x62f8`) | `+0x635c` | `randomBetween(1, 4)` | `randomBetween` |
| `bash_attack` (`+0x6463`) | `+0x64c3` | `23` | none |
| `psyche_up` (`+0x652d`), facing right | `+0x669e` | `30` | none |
| `psyche_up`, facing left | `+0x6717` | `30` | none |
| `taunt` (`+0x679c`) | `+0x6981` | `20` | none |
| `bombardright`/`bombardleft` | `+0x6c67` | `21` | none |
| `sniperight`/`snipeleft` | `+0x6c8c` | `22` | none |
| `cast_weaken_armour` (`+0x7782`) ×3 | `+0x7815`, `+0x7845`, `+0x7875` | `1 + RandomNumber(9)` | `RandomNumber` opcode |
| `cast_whirlwind` (`+0x78e0`), facing right | `+0x79d0` | `30` | none |
| `cast_whirlwind`, facing left | `+0x7a49` | `30` | none |
| `cast_ghost_strike` (`+0x7dbd`) | `+0x7ebb` | `randomBetween(9, 12)` | `randomBetween` |

Only the four `randomBetween` draws — power, normal, quick and ghost strike —
are interceptable and recordable by the capture wrapper. The three
`cast_weaken_armour` draws use the AVM1 `RandomNumber` opcode directly and can
be neither observed nor injected by a wrapper that only replaces
`randomBetween`; the remaining eight sites are fixed constants and need no
sample at all. This is the boundary that decides what a capture campaign can
ever control on the direction input.

The two charge sites are the exception that explains an earlier runtime
observation. `chargeright` (`+0x41f5`) at `+0x4398` and `chargeleft`
(`+0x4461`) at `+0x4604` both execute
`attacker.attack_direction = 9` as a **`SetMember` on the fighter clip**, then
call `checkattackroll()` at `+0x43a3`/`+0x460f`. `checkattackroll` reads the
overlay timeline variable with `GetVariable` (`+0x2c68`, `+0x2c80`, `+0x2cd7`,
…) and never reads the clip member, so the charge write is invisible to it.
That is why the 2026-08-30 charge capture saw `attack_direction` **undefined**
inside `checkattackroll`: not a missing assignment, but an assignment to the
wrong object. Reconstructions must not "fix" this by treating a charge as
direction 9.

Note also that `power_attack`, `normal_attack` and `quick_attack` draw their
direction and call `checkattackroll()` with **no distance or range test**
(`power_attack` runs straight from `+0x607c` to the call at `+0x6146`). Only
`psyche_up` and `cast_whirlwind` gate on range, comparing `attacker._x` against
`defender._x -/+ round(game_attacker.weapon_range + 50)` by facing
(`+0x6658`–`+0x6699` and `+0x66d1`–`+0x6712`). Out of range those two decide
nothing at all — no roll, no damage, no death — while a melee attack issued
from any distance still resolves. The phase machine itself never consults the
controller frame, so a driver that calls `getphase` directly can reach a label
the current controller does not wire — byte-verified in
§`getphase` does not validate its argument, which also records why the capture
wrapper nonetheless refuses to do it and what would settle the question live.

Direction 30 has exactly two producers in the table above: the `psyche_up`
counter and `cast_whirlwind`. Only the first is a player action with a
`getphase` label — `cast_*` labels are consumed by the phase machine and have
no callable entry point (§Spell and vanilla AI surface) — so `psyche_up` is the
only route a capture can drive, and every controller wires it (above:
`herolevel >= 7` on the warrior frames, `>= 3` on the archer frames).

The `psyche_up` counter's full lifecycle is: the phase plays
`psyche_up`, `psyche_up2` or
`psyche_up3` for counter values 1, 2 and >= 3 (`+0x658a`, `+0x65b9`, `+0x65ef`);
at 3 it fires the range-gated grievous and then writes
`game_attacker.psyche_up = 1` at `+0x6738`; when the animation reports back
(`attacker.struck == true`) it adds one at `+0x6761`. Statically the counter
therefore lands on 2, not 1, after a discharge, which would let the next
`psyche_up` press discharge again. Recorded as a static candidate — the two
writes are in different ticks of the same phase, so a runtime capture of two
consecutive `psyche_up` presses would settle it. Every non-`psyche_up`
decision resets the counter through `nextphase` (`+0x35e0`), and taking damage
resets the defender's through `damagecharacter` (`+0x1be4`).

**Runtime-resolved 2026-08-31 — the three melee bands, and what a live 1–12
spread does *not* mean.** Twenty-two `run-arena.ps1` rounds
(`captures/session-adc1` … `session-adc22`) produced twenty-one armed actions,
each carrying a direction. The split below is derived from which combatant the
first `damagecharacter` write landed on — the defender takes the damage — and
not from the traces' own `attackerSide`, which is an operator-declared launcher
string that reads `hero` on all twenty:

| Who actually swung | n | `attack_direction` values observed |
| --- | ---: | --- |
| hero | 11 | 8, 8, 7, 8, 7, 6, 8, 8, 6, 7, 7 |
| villain | 9 | 4, 10, 11, **20**, 3, 2, **5**, **20**, 10 |

The twenty-first armed round, `session-adc21`, also drew 20 but has no
`damagecharacter` write at all, so it is not attributed above. The
twenty-second, `session-adc15`, aborted on a special-event screen and never
armed.

Every hero swing on that route is a `normal_attack` — the capture wrapper's
arena autopilot issues that verb and no other attack, its only other steps
being `walkright` and `walkleft` — and **all eleven landed inside
`randomBetween(5, 8)`, none outside**. That confirms the `+0x61f1` row of the
table above from a source with no freedom to be fitted to it: the range was
read off the opcode and written down here before this route existed, and
nothing in a run can select the direction.

It also retires a reading the archive's 1–12 spread previously invited. **The
out-of-band values are not a wider hero range; they are the villain's
attacks**, drawn by the same three sites in the same phase machine, which
serves whoever is swinging. A direction therefore never identifies the
combatant on its own — `session-adc18` is a villain swing at direction 5,
inside the hero's own band.

**Runtime-resolved 2026-08-31 — direction 5 is attainable, and eleven hero
swings without one are not evidence otherwise.** This is the most
operationally load-bearing number in the table: 26 of the 60 committed 1v1
candidates stage direction 5. `randomBetween` is inclusive at *both* bounds,
byte-verified at the definition rather than inferred from behaviour. The
overlay's copy at `sprite:862/frame:52/DoAction@0x23f835` `+0x026a` is

```text
DefineFunction2 randomBetween(a, b)
  +0x0288  Push register:1                       // a  — the addend
  +0x028e  Math.random()
  +0x029f  Push register:2, register:1; Subtract // b - a
  +0x02a7  Push 1; Add2                          // b - a + 1
  +0x02b0  Multiply
  +0x02b1  Math.floor(...)
  +0x02c2  Add2                                  // a + floor(...)
  +0x02c3  Return
```

`register:1` is the low bound and the addend, `register:2` the high bound, and
`Math.random()` is bounded above by 1, so the floor spans `0 … b - a` and the
result spans `a … b` inclusive. The call at `+0x61f1` pushes `numArgs 2,
arg1 5, arg2 8`, so **`P(direction 5) = 0.25` exactly**. The build agrees with
itself: the instruction right after each band's draw tests that band's *low*
bound first — `== 5` → `Attack5` at `+0x6209`, `== 9` → `Attack9` at `+0x60a2`,
`== 1` → `Attack1` at `+0x6374` — so any reading that excluded the low bound
would leave the first animation branch of every band unreachable.

Eleven consecutive hero swings without a 5 is a `0.75^11 = 4.2%` event, which
is unremarkable; and the archive settles it directly. **~~Eighteen~~ Twenty
committed observation records carry `scenario.attackDirection` 5**
(`test/observations/ss2-1v1/`), and ~~sixteen~~ **eighteen** of them put their
first mutation on `/villain/…` — the defender took the damage, so the hero
swung. *(Re-derived 2026-09-07: 16 on `/villain/hitpoints` plus 2 on
`/villain/armourclass`; the two additions are `obs-onx1405-a1` and
`obs-onx1521-a1`. The remaining two are still the empty-trace misses. The
conclusion is unchanged and better supported.)* The other two
are misses with an empty mutation trace and carry no evidence either way;
`scenario.attackerSide` is an operator-declared string and settles nothing
here. Those eighteen are genuine live draws even though the runs were
tape-injected, because the direction is assigned *before* the branch's own
`checkattackroll()` call in every band — `+0x6208` before `+0x62ad` for normal,
`+0x608a` before `+0x6146` for power, `+0x635c` before `+0x6418` for quick —
and `checkattackroll` is where the capture window opens. No tape slot can reach
the direction. It is recorded, never dictated.

**THE `psyche_up` COUNTER'S COMPLETE WRITE CENSUS (derived 2026-09-17; this
document and the engine between them had three of the eight).** Every write in
the battle overlay's frame-52 block sets the counter to 1; the only increment is
`+0x6761`. Enumerated rather than accumulated, because three sessions have each
added one site and none of them asked how many there were:

| site | function | whose counter | fires when |
| --- | --- | --- | --- |
| `+0x148e` | `magic_damage_character` | defender | any magic damage lands (the write sits directly after `hitpoints -= damage`) |
| `+0x16b5` | `damagecharacter`, grievous arm | defender | a grievous blow lands |
| `+0x16c2` | `damagecharacter`, grievous arm | attacker | a grievous blow lands |
| `+0x1be4` | `damagecharacter`, knockback arm | defender | a landed blow with force |
| `+0x35e0` | `nextphase` | actor | any decision that is not `psyche_up` |
| `+0x6738` | `psyche_up` discharge | attacker | the discharge writes back |
| `+0x6ac8` | `taunt`, `taunt_effect == 2` against a bow-mode defender | defender | a landed taunt |
| `+0x7a6a` | `cast_whirlwind` write-back | attacker | after its own `checkattackroll` |

Three of those are recorded nowhere else: `+0x148e`, `+0x6ac8` and `+0x7a6a`.
**None of the three changes shipped behaviour**, because this engine has no
magic-damage, taunt or whirlwind verb — but each becomes live the moment one is
built, and `cast_whirlwind`'s `+0x7a6a` has NO matching increment, so a
whirlwind caster is left at 1 where a psych-up discharger is left at 2.

### The taunt phase, in full (byte-derived 2026-09-17)

The reason `taunt` has stayed deferred is that the candidate implements only the
post-`checkattackroll` arm. Here is the half it is missing, from
`sprite:862[overlay]/frame:52/DoAction@0x240c7f`:

```text
  attacker.gotoAndPlay("taunt")                                    +0x6905
  defender.gotoAndPlay("taunted")                                  +0x690c
  diceroll = randomBetween(1, 100)                                 +0x6921
  if (diceroll < game_attacker.taunt_percentage) {                 +0x694b
      taunt_effect = randomBetween(1, 2)                           +0x6952
      if (taunt_effect == 1) {                                     +0x6972
          attack_direction = 20; checkattackroll()                 +0x6981, +0x698c
      } else if (game_defender.equipped_weapon == 1) {             +0x69a7
          // a MELEE defender is shoved
          force = +/- game_attacker.charisma * 25                  +0x69d4 / +0x6a3a
          clamp |force| to at least 20                             +0x69f2 / +0x6a62
          if (|force| > 100) defender.gotoAndPlay("knockback")     +0x6a21 / +0x6a91
          knockback(defender, force)                               +0x6ab1
      } else {
          // a BOW-mode defender is made to flee
          game_defender.psyche_up = 1                              +0x6ac8
          game_defender.taunted1 = true                            +0x6ad9
      }
  }
```

Four things a builder needs that the prose did not say:

- **BOTH CLIPS FIRE BEFORE THE ROLL.** `taunt` on the actor and `taunted` on the
  target play unconditionally, so a FAILED taunt still animates both.
- **THE COMPARISON IS DIRECT** — `diceroll < taunt_percentage` — and not the
  dispatcher's `100 - chance` form. Getting that backwards inverts the whole
  action.
- **`taunt_effect == 2` SPLITS ON THE DEFENDER'S WEAPON MODE**, which is the
  discriminator this document previously left as "a charisma-scaled knockback
  or sets `taunted1`". `equipped_weapon == 1` is melee and gets the shove;
  anything else is the bow and gets the flee.
- **THE DISPLACEMENT IS UNCONDITIONAL AND THE ANIMATION IS NOT.**
  `knockback(defender, force)` is called whenever the shove arm is entered;
  `defender.gotoAndPlay("knockback")` only when `|force| > 100`. That is the
  same shape `damagecharacter` has, where the fighter is always displaced and
  only the clip is gated.

So the sample budget is **one draw always, a second only on success, and the
dispatcher's own draws only on `taunt_effect == 1`** — which is exactly what a
candidate implementing only the dispatcher would get wrong.

### Direction 20 is the taunt path (byte-verified; runtime-resolved 2026-08-31)

Direction 20 has exactly one producer in the assignment table above, and the
arena rounds now put a live trace behind it. It is not a special, a spell, a
bow or a critical path.

*The producer.* Inside the `taunt` branch (`+0x679c`) the phase rolls
`diceroll = randomBetween(1, 100)` at `+0x6921` and succeeds when
`diceroll < game_attacker.taunt_percentage` (`+0x694b`), then draws
`taunt_effect = randomBetween(1, 2)` at `+0x6952`. **Only `taunt_effect == 1`
reaches `+0x6981`**, which sets `attack_direction = 20` and calls
`checkattackroll` at `+0x698c`; `taunt_effect == 2` takes the charisma-scaled
knockback / `taunted1` arm and never reaches the dispatcher. Both draws precede
`checkattackroll`, so neither can be observed or injected inside the capture
window — but note that both are `randomBetween`, **not** the `RandomNumber`
opcode, and a successful taunt does **not** skip `checkattackroll`. Its
`+0x698c` call is one of the build's thirteen `checkattackroll` calls (fourteen
references in all: the `DefineFunction2` at `+0x2c2b` plus thirteen calls), and
three arena rounds armed on it. Any capture-side note that describes taunts as
opcode-driven and therefore uncapturable is contradicted by both the bytes and
the traces; that note lives outside this document and is flagged here rather
than corrected.

*Who can issue it.* `taunt` is a `getphase` label three of the four hero
controllers wire — every one but `closerange_warrior`, and on the two long-range
frames only while `staminaleft / staminamax * 100 >= 50` (§Buttons wired per
controller frame) — and `villainChooseAction` writes it from two arms
(byte-verified in that function's own block,
`sprite:862/frame:52/DoAction@0x23f835`):

- in the in-position attack chain, `choices` in `80 … 89` picks `shove` when the
  villain's `equipped_weapon == 1` and `taunt` otherwise (`+0x0746` selecting
  between `+0x074b` and `+0x0758`);
- in **both** out-of-position movement chains — the arm taken while the
  opponent is still closing the distance — `choices` in `85 … 95` picks `taunt`
  when the villain's `staminaleft / staminamax * 100 >= 40` and `rest` below
  that (`+0x0b0f`–`+0x0b74` for one facing, `+0x0e0f`–`+0x0e63` for the other).
  This arm carries **no weapon test**, so a melee villain reaches `taunt` here.

`choices` is itself a `randomBetween(1, 100)` drawn before the phase is
dispatched, so **which arm fired in any given round is not recorded and is not
established here.** The out-of-position arm is the one consistent with the
observed rounds — the hero was still walking in — but that is an inference, not
a measurement, and must not be promoted.

Note the two gates differ: the villain's out-of-position arm needs 40% stamina,
the hero's long-range button 50%. Because the hero can issue `taunt` at all,
direction 20 discriminates the combatant no better than direction 5 does. On
the arena route it happens to be villain-only, but only because the capture
wrapper's arena autopilot never issues the verb — a property of the capture
vehicle, not of the build.

*The live trace.* Three armed rounds recorded direction 20: `session-adc7`,
`session-adc20` and `session-adc21`. In adc7 and adc20 the hero's last
`phase_action` was `walkright`, never an attack verb, and the villain took the
turn; both dispatched `{"t":"event","type":"defender-hurt","method":"taunt"}`
and both wrote `/hero/hitpoints 300 → 297`. Villain `charisma` 1 against hero
`charisma` 1 gives `round(1 * 4) - 1 = 3`, exactly the damage observed. adc21
additionally emitted the forced `criticalhit` sentinel **21** as a raw value.
Between them the three cells of the dispatcher table's direction-20 row —
charisma damage, sentinel 21, `taunt_percentage` — are each corroborated live.

*What the arm draws, which is what a taunt fixture needs.* The dispatcher arm
is short enough to read out in full (`DoAction@0x240c7f`, inside
`checkattackroll`):

```text
+0x2dcc  if (attack_direction == 20) {
+0x2de1    criticalhit = 21;                                   // constant, no draw
+0x2dec    damage = Math.round(game_attacker.charisma * 4)
                      - game_defender.charisma;
+0x2e22    if (damage < 1)
+0x2e37      damage = randomBetween(1, 3);                     // CONDITIONAL draw
+0x2e4f    rollneeded = 100 - game_attacker.taunt_percentage;
         }
```

So the taunt band's arm draws **nothing** when the charisma term lands at 1 or
above and **exactly one** `randomBetween(1, 3)` when it does not — unlike the
5–8 band, whose arm always draws two, and the 1–4 and 9–12 bands, whose arms
draw one. The armed windows measured that: each dispatched direction-20 round
consumed **four** samples against the normal band's seven, and every one of the
three missing draws is separately byte-accounted (§Attack roll dispatcher, the
runtime draw ledger) — the damage draw was skipped because the charisma term
was 3, the critical draw does not exist on this arm, and the knockback block
excludes direction 20 outright. The deflection draw survives because
`deflect_critical = randomBetween(1, 100)` at `+0x3030` sits on the hit branch
unconditionally, ahead of any test of `criticalhit`; and `remove_armour` is
called on this path yet draws nothing, because direction 20 matches none of its
three piece groups.

That is the first runtime evidence bearing on `candidate-taunt-charisma-floor`,
which models the *other* case — hero `charisma` 5 against villain `charisma`
30, so `20 - 30 < 1` and the floor draw fires — with a five-sample tape ordered
hit, taunt-floor damage, deflection, armour-removal, enchantment potency.
Remove the second of those and what is left is exactly the four-sample order
the live rounds consumed.

*Reading those traces.* Every `roll` line in the direction-20 rounds is
labelled `normal-damage-roll [21..23]` and `normal-critical-roll [1..20]`.
**Those are the fixture's tape entries, not the game's arguments**
(§What a capture can and cannot confirm) — the direction-20 arm asked for
neither. Only the *count*, four against the normal band's seven, is an
observation, and the slot-to-call-site mapping in that ledger is read off
emission order, not off any recorded call site.

*Still unresolved.* `session-adc21` carries direction 20, the sentinel 21 and
four served samples, but no `defender_hurt` or `defender_blocked` event, no
`damagecharacter` call and no `remove_armour` call; its four state writes land
on `/villain/…` and are recorded as `"hook":"unattributed"`. It is the one
round of the twenty-one whose draw count is not reconstructed by the ledger
above, and it is not counted as a taunt confirmation here.

Two further things this section does **not** settle. The `taunt_effect == 2`
arm — the charisma-scaled knockback and the `taunted1` write — has no live
trace at all, because it never reaches `checkattackroll` and so never arms.
And the charisma-floor case is still unobserved: every round here had the
attacker's `round(charisma * 4) - defender.charisma` land at 3, so the
`randomBetween(1, 3)` at `+0x2e37` has never actually been drawn in a capture.

### Spell-path reuse of `attack_direction` (byte-verified 2026-08-30)

`cast_weaken_armour` is the only cast path that reuses `attack_direction` as an
armour-piece selector. Its body repeats the pair

```text
attack_direction = 1 + RandomNumber(9);           // +0x7815 / +0x7845 / +0x7875
remove_armour(game_defender, defender, attack_direction);
                                                  // +0x7839 / +0x7869 / +0x7899
```

three times in a row, immediately after `attacker.gotoAndPlay("Cast1")` at
`+0x7800`. Argument binding is verified against the `remove_armour`
`DefineFunction2` header in overlay frame 52 `DoAction@0x23d7fe` `+0x0265`, and
matches the physical-path call in `damagecharacter` (`+0x176a`, `+0x1791`,
pushing `register:3`, `register:5`, `register:6`).

Three boundaries must not be blurred:

- This value is **not** a physical attack direction. It is drawn on a cast
  path, it never reaches `checkattackroll`, and it feeds only the piece-group
  selection inside `remove_armour`. Its `1..9` range also means directions
  10–12, and the group memberships they carry, are unreachable from this path.
- It is a `RandomNumber` opcode draw, so unlike the physical bands it cannot be
  recorded or injected. A `cast_weaken_armour` fixture can only be an
  observation of the outcome, never a controlled sample.
- `magic_damage_character` remains, as byte-verified in its own section below,
  entirely free of any armour-removal call. `remove_armour` has exactly five
  call sites in the build — two in `damagecharacter` and these three — so no
  spell *damage* ingress removes armour; only this one spell *effect* path
  does.
  `cast_whirlwind` and `cast_ghost_strike` write `attack_direction` for the
  physical dispatcher instead and call `checkattackroll` — at `+0x79db` and
  `+0x7a54` for whirlwind (after the same `weapon_range + 50` range gate as
  `psyche_up`, `+0x79a8`/`+0x79c9`) and at `+0x7f77` for ghost strike, which
  first plays `Attack9`–`Attack12` from its drawn band. Neither calls
  `remove_armour`.

The direction-to-piece mapping inside `remove_armour` is fully determined and
applies to both call families (overlay frame 52 `DoAction@0x23d7fe`):

| Directions | Selector | Pieces in selector order |
| --- | --- | --- |
| 1, 5, 8, 9 (`+0x02ac`–`+0x02e2`) | `armour_to_remove = randomBetween(1, 2)` (`+0x02f3`) | helmet (`+0x0320`), shoulderguard (`+0x050a`) |
| 2, 4, 6, 10, 12 (`+0x0595`–`+0x05dd`) | `randomBetween(1, 3)` (`+0x05ee`) | breastplate (`+0x0694`), gauntlet (`+0x07ac`), greaves (`+0x08fb`) |
| 3, 7, 11 (`+0x0986`–`+0x09aa`) | `randomBetween(1, 3)` (`+0x09bb`) | shinguard (`+0x0a97`), boot (`+0x0be6`), shield (`+0x0d35`) |

Every `remove_armour` call therefore consumes exactly one interceptable
`randomBetween` sample, and it is drawn *before* the per-piece
`piece != 0` test (`+0x0328` for helmet, and the matching tests in the other
groups), so the sample is consumed even when the selected piece is not
equipped and nothing is destroyed. A `cast_weaken_armour` cast consumes three
of them.

Directions outside 1–12 fall through all three group tests and
consume nothing; the unmatched path reaches only the trailing
`armourclass` / `armourclass_max` zero-clamp (`+0x0d4d`–`+0x0da4`). That is the
byte-level reason the direction-30 grievous's unconditional `remove_armour`
call cannot destroy equipment, as the earlier section suspected.

**Runtime-resolved 2026-08-30.** The draw-before-the-equipped-test ordering
above, and the physical path's `> 66` removal gate, are now measured — by the
one probe pair whose arms are separated by the **draw count alone**. The pair
`golden-probe-armour-removal-gate-{below,above}` stages a direction-5 hit
against the unarmoured tutorial prisoner and moves only the injected removal
roll, 66 against 67. Events, mutation trace and final state are identical; the
67 arm draws one extra `randomBetween(1, 2)` in the mapped position. So 66 does
not clear the gate and 67 does, and the group selection is drawn even against a
defender who wears nothing in the selected group. Because that defender wears
no armour, the extra draw is the *only* trace the call leaves — which is
exactly why the pair is evidence where a repeated kill capture would not be.

### Attack roll dispatcher

`checkattackroll` is an anonymous function assigned in overlay frame 52. It
calls `attack_chances`, rolls `diceroll = randomBetween(1, 100)`, derives damage
and a critical sample from `attack_direction`, then computes
`rollneeded = 100 - chance`. A hit runs when `diceroll >= rollneeded`; the miss
branch runs only when `diceroll < rollneeded`.

**Runtime-resolved 2026-08-30.** That comparison used to be recorded here as
only *consistent with* the control flow. Three promoted probe pairs settle it.
Each pair stages one fight (attacker attack 1 against defender defence 0, so
`ratio = 10/9`) twice and moves the injected `diceroll` by one, and the arms
separate in an observed channel — `defender-blocked` against `defender-hurt`:

| Band | Direction | `chance` | Miss at | Hit at | Goldens |
| --- | --- | --- | --- | --- | --- |
| quick | 1 | 73 | 26 | 27 | `golden-probe-quick-rollneeded-{miss,hit}` |
| normal | 5 | 56 | 43 | 44 | `golden-probe-normal-rollneeded-{miss,hit}` |
| power | 9 | 37 | 62 | 63 | `golden-probe-power-rollneeded-{miss,hit}` |

The three smallest hitting rolls are exactly `100 - chance`, which is the
inclusive reading. A strict `diceroll > rollneeded` would require chances
74 / 57 / 38, and none of the factors in the table above yields any of them at
this ratio — so the three pairs together decide the comparison's *polarity*,
not merely three thresholds. The miss arms are also evidence for the ordering
in the sentence above — a miss still consumes its band's damage and critical
draws and nothing after them — but only to the strength of the draw count,
which catches a run that drew *fewer* samples than the fixture models more
readily than one that drew more (runtime-capture §Reading divergent traces).
Note what these pairs do **not** establish: the injected dicerolls themselves
are echoed back from the tape, never measured. What the capture measured is
which side of the bracket each arm landed on.

| `attack_direction` | Damage | Critical sample | Chance field |
| --- | --- | --- | --- |
| 1–4 | `min_damage` | `randomBetween(-20, 20)` | `quick_percentage` |
| 5–8 | `randomBetween(min_damage, max_damage)` | `randomBetween(1, 20)` | `normal_percentage` |
| 9–12 | `max_damage` | `randomBetween(5, 20)` | `power_percentage` |
| 20 | `round(attacker.charisma * 4) - defender.charisma`, floored to a random 1–3 | forced sentinel 21 | `taunt_percentage` |
| 21 | `randomBetween(min_damage, max_damage)` | `randomBetween(-20, 20)` | `bombard_percentage` |
| 22 | `min_damage` | 0 | `snipe_percentage` |
| 23 | `ceil(min_damage / 2)` | unchanged; inherits the prior transient value | `bash_percentage` |
| 30 | `ceil(max_damage * 1.5)` with a level-based fallback | forced 20 | `normal_percentage` |

The direction-20 row is the one row of this table now corroborated by a live
trace on all three of its cells, and its damage draw turns out to be
conditional rather than unconditional — see §Direction 20 is the taunt path,
which also reads the arm out opcode by opcode and settles its tape length.

On a hit, direction 30 dispatches `defender_hurt("grievous")`, direction 20
dispatches `defender_hurt("taunt")`, a surviving critical sample of 20
dispatches `defender_hurt("critical")`, and all other hits dispatch
`defender_hurt("normal")`. A separate helmet/greaves roll can deflect a
critical. Its threshold simplifies to
`(100 - 1.5 * game_defender.helmet) + game_defender.greaves`; an inclusive
1–100 roll at or above that threshold clears the critical, except that direction
30 remains grievous. A miss calls `defender_blocked()`.

**Runtime-resolved 2026-08-30 — the comparison, not the formula.** The
inclusive "at or above" reading is now measured. The pair
`golden-probe-deflection-threshold-{critical,cleared}` stages one fight against
a defender wearing neither helmet nor greaves, so the threshold is
`100 - 0 + 0` — the largest
value the roll can take — and move only the deflection roll, 99 against 100.
The arms are identical in mutations, final state and draw count; the single
channel that moves is the dispatched method, `critical` against `normal`. A
strictly-above reading would have predicted `critical` on both. This settles
the boundary and nothing else: the operand mix in the threshold formula is
still unobserved, and `candidate-deflection-threshold-discriminator`, whose
injected roll 85 sits between the rival readings 83 < 85 < 87 against helmet 10
and greaves 2, is still the fixture that would settle it.

`defender_hurt` selects an animation label (`hurtN`, adjusted for ranged
directions, or `knockback`), calls
`damagecharacter(defender, attacker, game_defender, game_attacker,
damage_method, attack_direction)`, then plays the defender animation. The
animation label is `"hurt" + attack_direction` (`+0x2086`), rewritten to
`"hurt" + (attack_direction - 20)` for directions 21–23 (`+0x2093`–`+0x20d6`)
and replaced by `knockback` when the direction is 30 (`+0x20dd`–`+0x20ec`).

**Knockback dispatch gate (byte-verified 2026-08-30).** Knockback is not
dispatched on every hit, and the map previously documented only the force.
Inside `damagecharacter`, with `register:6 = attack_direction`, the whole
knockback block is guarded by a short-circuit chain at `+0x1a72`–`+0x1aa5`:
`attack_direction >= 5` (`+0x1a7c`) **and** `attack_direction <= 12`
(`+0x1a90`), **or** `attack_direction == 30` (`+0x1aa3`). Any other direction
jumps to `+0x1be4` and the block is skipped entirely. Directions 1–4 (quick),
20 (taunt), 21 (bombard), 22 (snipe) and 23 (bash) therefore never enter it.

Inside the gate the first statement is
`randosmash = randomBetween(1, 4)` (`+0x1aaa`). The force is applied when
`randosmash > 3` (`+0x1ac8`–`+0x1ad2`), and otherwise only when
`attack_direction == 30` (`+0x1ad8`–`+0x1ae4`); direction 30 always applies it.
Both rules match the isolated resolver's `knockback` block. Two consequences
for tape alignment: the `randomBetween(1, 4)` sample exists only on the 5–12
and 30 paths, so a quick-band fixture's tape is genuinely one sample shorter
than a power-band or normal-band fixture's; and the sample is still **drawn**
on direction 30 even though its value cannot change the outcome, so it must
still occupy a tape slot there.

**Runtime-resolved 2026-08-31 — the whole physical draw ledger, reconstructed
with no free parameter.** Draw count is one of the very few things a capture
observes directly rather than echoes (§What a capture can and cannot confirm),
and the twenty-two arena rounds of 2026-08-31 supply an unusually clean sample:
**every one of them ran the same seven-entry normal-band tape**
(`candidate-armoured-deflection-threshold-cleared`) while the game drew the
direction itself, so the direction varied and the input did not. Twenty rounds
reached a dispatch, and their `roll` counts are a perfect function of the band:

| Band | Directions seen | Rounds | `roll` lines | `remove_armour` called |
| --- | --- | ---: | ---: | --- |
| quick | 2, 3, 4 | 3 | **6** | 3 of 3 |
| normal | 5, 6, 7, 8 | 12 | **7** | 0 of 12 |
| power | 10, 11 | 3 | **7** | 3 of 3 |
| taunt | 20 | 2 | **4** | 2 of 2 |

Each count is reproduced exactly by the opcodes, with the served fraction
`(value - min + 0.5) / (max - min + 1)` re-scaled into whatever range the game
actually asked for:

| # | Draw | quick | normal | power | taunt |
| --- | --- | :---: | :---: | :---: | :---: |
| 1 | `diceroll = randomBetween(1, 100)` | ✔ | ✔ | ✔ | ✔ |
| 2 | band damage draw | — (`min_damage`) | ✔ `(min, max)` | — (`max_damage`) | — (charisma) |
| 3 | band critical draw | ✔ `(-20, 20)` | ✔ `(1, 20)` | ✔ `(5, 20)` | — (const 21) |
| 4 | `deflect_critical` (`+0x3030`, hit branch, unconditional) | ✔ | ✔ | ✔ | ✔ |
| 5 | armour-removal chance in `damagecharacter` | ✔ → **93** | ✔ → **12** | ✔ → **93** | ✔ → **98** |
| 6 | `remove_armour` group selector | ✔ (93 > 66) | — (12 ≤ 66) | ✔ (93 > 66) | — (dir 20 maps to no group) |
| 7 | `randosmash = randomBetween(1, 4)` (`+0x1aaa`) | — (gate) | ✔ | ✔ | — (gate) |
| 8 | enchantment potency | ✔ | ✔ | ✔ | ✔ |
| | **total** | **6** | **7** | **7** | **4** |

Three static claims are settled by that arithmetic, each because changing it
alone would move a count that was measured:

- **The knockback gate is confirmed live.** If `randosmash` were drawn for
  directions 1–4 the quick rounds would read 7, and for direction 20 the taunt
  rounds would read 5. They read 6 and 4.
- **The `> 66` removal gate is confirmed at both ends, in the same tape.**
  Because the band's draw count shifts the tape position, the armour-removal
  chance lands on a different fixture entry per band — 93 for quick and power,
  12 for normal, 98 for taunt — and `called:remove-armour` appears in exactly
  the rounds where that value exceeds 66, in all twenty.
- **"Directions outside 1–12 consume nothing in `remove_armour`" is confirmed**
  — at direction 20 rather than the direction-30 case the map flagged as
  needing runtime confirmation. The taunt rounds call `remove_armour` (98 > 66)
  and still draw no group selector, which is the only reason their total is 4
  and not 5.

What this does *not* establish is which served slot belongs to which call site:
the `label`, `min` and `max` on every one of those lines are the fixture's tape
entries, so the row assignment above is read off emission order and off the
re-scaled value, never off a recorded call site.

`session-adc21` is excluded from the table. It drew direction 20 and consumed
four samples but dispatched no `defender_hurt` / `defender_blocked` event and
called neither `damagecharacter` nor `remove_armour`; see §Direction 20 is the
taunt path.

Physical knockback force is signed
`damage + game_attacker.strength * 6` and forced to a minimum magnitude of
20 — where `damage` is read AFTER the armour-overflow rewrite, so an
armour-overflowing hit knocks back with the overflow remainder, not the
selected damage.

**Three offsets and one mechanism word in that sentence were wrong; corrected
2026-09-17 and the FORMULA is untouched.** It read "the timeline-aliased
register read ... the force reads `this.damage` at `+0x1afd`/`+0x1b60`, the same
storage rewritten to the overflow remainder at `+0x1848`".

- `+0x1b60` **is not an instruction.** The raw bytes there are `99 02 00 6c 00`
  — a five-byte `Jump` occupying `+0x1b5f..+0x1b63` — so `+0x1b60` is its length
  field. The negative-branch statement starts at `+0x1b64` and its
  `GetMember "damage"` is at `+0x1b76`.
- **It is not a REGISTER read.** The byte at `+0x1b06` is `4e` = `GetMember`, on
  register 1 — and register 1 holds `this` (the function's flags set
  `preloadThis`), not a damage value. The aliasing is real and comes from `this`
  being the sprite-862 timeline with no `DefineLocal "damage"` anywhere in
  `+0x157d..+0x1dd3`; it does not come from register storage. Anyone re-deriving
  this from the words "register read" would look for a `StoreRegister` that is
  not there. The alias is firmer than the old wording claimed, too:
  `damagecharacter` has exactly one call site in the file (`+0x211e`, a bare
  `CallFunction` from `defender_hurt`), so `this` cannot vary.
- `+0x1848` **is the READ, not the rewrite** — `1c` = `GetVariable`, fetching the
  old damage. The statement spans `+0x1841..+0x1852` and the WRITE is
  `1d` = `SetVariable` at `+0x1852`.
A defender facing left receives the positive force; other mapped facing values
receive the negative force.
A magnitude above 80 selects the knockback animation, but the unbounded force is
still passed to `knockback`; 80 is not a force clamp.

### `knockback(whichcharacter, force)`, decoded — and its four call sites

**Decoded in full 2026-09-17**, having been cited for a month as a black box.
`DefineFunction2` at `+0x1dd3`, parameters in registers 2 and 3, body 155 bytes:

```text
this.crowd_action  = 1                                            +0x1e0a
this.phasecomplete = true                                         +0x1e14
defender_smashed   = true                                         +0x1e1c
knock_defender = new mx.transitions.Tween(                        +0x1e74 NewMethod, 7 args
    whichcharacter, "_x", mx.transitions.easing.Regular.easeOut,
    whichcharacter._x, whichcharacter._x + force, 1, true)
knock_defender.onMotionFinished = function () {                   +0x1e81
    knock_defender = null; defender_smashed = false }              +0x1e89, +0x1e90
```

So **the displacement is exactly `_x + force`**, eased over one real second, and
there is **no clamp, no arena edge and no body check anywhere inside the
function** — the 155 bytes contain no comparison, no branch and no reference to
the other gladiator. What bounds it is the clip clamp in `attacker.onEnterFrame`
(see `nextphase` step 1 above for why it is not `nextphase`).

Two side effects this engine models nowhere, recorded rather than built:
`phasecomplete` and `crowd_action`, written on the function's `this`. And
`knock_defender` is declared with `DefineLocal` (`+0x1e75`), which is why the
`onEnterFrame` clamp's guard on it never closes.

**Four call sites in the whole SWF, and they are not four variations on one
shape:**

| Site | Phase | Force | Floor | Animation gate | Sign from |
| --- | --- | --- | --- | --- | --- |
| `+0x1bd6` | `damagecharacter` | `damage + strength * 6` | 20 | `\|force\| > 80` `+0x1b40` | **defender**`.gladiator_dir == "left"` `+0x1ae9` |
| `+0x5fc9` | `shove` | `strength * 12`, boosted by `gauntlet` `+0x5e6b`–`+0x5e98` | 20 | `\|force\| > 100` `+0x5ed9` | attacker `+0x5e41` |
| `+0x6ab1` | `taunt` | `charisma * 25` | 20 | `\|force\| > 100` `+0x6a12` | attacker `+0x69c8` |
| `+0x7b98` | `cast_gale` | **flat ±1000** `+0x7b5d`/`+0x7b6d` | **none** | **unconditional** `+0x7b78` | attacker |

`damagecharacter` is the only one that signs on the DEFENDER's facing, and
`cast_gale` is the only one with no floor and no animation gate — so a
"knockback force model" generalised from any single site is wrong for at least
one other. The 80/100 split is real and is not a transcription error.

**And `damagecharacter`'s animation is unobservable.** `defender_hurt` computes
`animstate` (`+0x2086`, rewritten at `+0x20c1`, set to `"knockback"` for
direction 30 at `+0x20ec`), calls `damagecharacter` at `+0x211e`, and then calls
`defender.gotoAndPlay(animstate)` at `+0x2120`–`+0x2136` — the same clip, the
same frame. So the `gotoAndPlay("knockback")` at `+0x1b4f`/`+0x1bc0` is
overwritten by `"hurt5"`..`"hurt12"` before a frame is drawn, and at direction 30
`animstate` is `"knockback"` regardless of the force. The 80 threshold is a
byte-exact condition on an effect nothing can see; nothing may build a
presentation on it.

`damagecharacter`:

- rounds damage upward;
- uses different damage-splat/crowd cues for critical, taunt, and grievous;
- makes every physical damage invocation roll an inclusive 1–100 armour-removal
  chance and call `remove_armour` when the roll is greater than 66; grievous
  also calls it once unconditionally. The removal function only maps directions
  1–12 into piece groups, so the direction-30 grievous calls appear to be
  no-ops for equipment in this build and require runtime confirmation;
- subtracts normal/grievous damage from `armourclass` first, carrying only
  overflow into `hitpoints`; critical damage bypasses that armour-class branch
  even though its separate removal roll can still destroy a piece;
- runs the breastplate stamina block as an unconditional join on every
  invocation (byte-verified 2026-08-30: the absorbed-armour skip branch
  `+0x189c If` jumps directly to the stamina block at `+0x18f3`), granting
  `ceil(game_defender.breastplate * damage / 100)` stamina where `damage` is
  the current register — the full rounded-up damage when armour fully
  absorbed the hit or on non-armour paths, and the overflow remainder after
  an overflow rewrite; helper semantics: `get_percentage(a, b) = (a / b) *
  100` and `add_percentage(a, b) = ceil(a * b / 100)`;
- when `damage_method` is `taunt`, sets crowd action 3 and then overwrites
  the method register to `normal`, so taunt damage takes the normal
  armour-first path (and the crowd value is immediately overwritten to 2 in
  the armour block);
- can set `burning`, `frozen`, `poison`, or `life_stolen` from weapon
  enchantment types 2–5 after a potency roll. When the secondary weapon is
  active, the type comes from its secondary field but the comparison still
  reads the primary weapon potency field in this build.

  **Offsets added 2026-09-02.** This bullet was the map's whole account of the
  enchantment arithmetic and it carried no offset, no formula and no comparison
  direction, so an implementer had nothing to check against. The block is
  `+0x1bf1..+0x1dd2`:

  ```text
  magicweapon_percentage = randomBetween(1, 100)                    // +0x1bf1
  if (magicweapon_percentage < game_attacker.weapon_enchantment_potency * 10) {
                                                    // +0x1c09..+0x1c22, strict <
    // PRIMARY potency, unconditionally: the gate is hoisted OUT of and
    // evaluated BEFORE the first equipped_weapon test at +0x1c27, and
    // secondary_weapon_enchantment_potency is read NOWHERE in damagecharacter.
    // Census: `magicweapon_percentage` occurs exactly twice in the build,
    // one write and one read, so there is exactly one enchantment roll.
    if ((equipped_weapon == 1 && weapon_enchantment_type           == N)
     || (equipped_weapon == 2 && secondary_weapon_enchantment_type == N))
        game_defender.<status> = true;
    // N = 2 burning +0x1c88, 3 frozen +0x1cf3, 4 poison +0x1d5e,
    //     5 life_stolen +0x1dc9
  }
  ```

  **Both arms test an explicit value, so an `equipped_weapon` outside {1, 2}
  applies NO status.** `src/golden/ss2-attack-candidate.js` treated "not 2" as
  "primary" until 2026-09-02 and so applied one; corrected there, with these
  offsets quoted at the site.
- **ends with the enchantment write at `+0x1dd2`, not with the defeat gate.**
  (Corrected 2026-09-02; this bullet and the section below both said the
  function "ends with" the gate at `+0x194a..+0x1a71`. The gate is not last —
  the knockback miss-path at `+0x1aa5` jumps forward to `+0x1be4`, which is
  what makes the enchantment roll run on every call.) The defeat gate is
  described below and is byte-verified; only its POSITION was mis-stated.

### Defeat gate and death dispatch (byte-verified 2026-08-30)

Both damage ingresses end with the same gate, decoded opcode-by-opcode from
`damagecharacter` (`+0x194a..+0x1a71`) and `magic_damage_character`
(`+0x14ee..+0x157c`) in overlay block `DoAction@0x240c7f`.

**Independently re-decoded 2026-08-30.** This gate had been read by one agent
only, and it is load-bearing for the three `candidate-tournament-*` fixtures, so
it was decoded a second time from scratch. The condition reproduces exactly.
`damagecharacter`, with `register:2 = _global` and `register:3 = game_defender`:

```text
+0x194a  hitpoints                       ; push
+0x1952  0                               ; push
+0x195e  Greater      -> hitpoints > 0
+0x195f  Not          -> hitpoints <= 0                        [A]
+0x1960  Duplicate
+0x1961  If  -> +0x198f                  ; short-circuit ||, A stays on the stack
+0x1966  Pop
+0x1967  hitpoints
+0x196f  hitpointsmax
+0x1977  Less2        -> hitpoints < hitpointsmax              [B]
+0x1978  Duplicate
+0x1979  Not
+0x197a  If  -> +0x198f                  ; short-circuit &&, false stays
+0x197f  Pop
+0x1980  _global.fight_mode
+0x1988  "tournament"
+0x198d  Equals2
+0x198e  Not          -> fight_mode != "tournament"            [C]
+0x198f  Not                             ; merge: value = A || (B && C)
+0x1990  If {delta 221} -> +0x1a72       ; skip the block when !value
```

- The defeat block is entered iff `hitpoints <= 0` **or** (`hitpoints <
  hitpointsmax` **and** `_global.fight_mode != "tournament"`). The second
  term is a first-blood-style condition the earlier map wording did not
  record: statically, any post-`check_stats` damage below maximum enters the
  block in every non-tournament mode. The `+0x1990` jump target `+0x1a72` is
  the first opcode of the knockback gate, so the defeat block is exactly
  `+0x1995`–`+0x1a71`.
- The dispatch offsets reproduce too: `phasecomplete` at `+0x1995`, the duel
  test at `+0x199f` branching to `death(clip, "yield")` at `+0x1a62`, then
  `<= 12` → `slain` `+0x19c6`, `== 20` → `taunt` `+0x19ec`, `21..23` → `arrow`
  `+0x1a27`, `== 30` → `grievous` `+0x1a4d`, and the fall-through `Jump` at
  `+0x1a5d` for every other direction — which reaches `+0x1a72` with
  `phasecomplete` set and no `death` call, as recorded below.
- `magic_damage_character` matches statement for statement with no direction
  chain: condition `+0x14ee`–`+0x1534`, `phasecomplete` `+0x1539`, duel test
  `+0x1543`, `slain` `+0x1558`, `yield` `+0x156d`.
- On entry, `_global.phasecomplete = true` is set first, unconditionally,
  before any `death` call.
- `fight_mode == "duel"` always calls `death(defenderClip, "yield")`,
  including genuine kills; duel kills never route to `slain`.
- Otherwise `damagecharacter` dispatches by `attack_direction`:
  `<= 12` → `slain`, `== 20` → `taunt`, `21–23` → `arrow`, `== 30` →
  `grievous`; directions 13–19, 24–29, and 31+ set `phasecomplete` without
  any `death` call (statically unreachable from the mapped dispatcher).
  `magic_damage_character` has no direction chain and always uses `slain`
  outside duels.
- `death(whichcharacter, how_died)` itself contains no hitpoint or
  `fight_mode` reads (verified: its only branches are the two clip
  comparisons).
- **Runtime-resolved 2026-08-30** (first live captures): ordinary arena
  duels run with `_global.fight_mode = "duel"`, so the non-tournament
  `hitpoints < hitpointsmax` term is simply the **first-blood duel rule** —
  the fight ends via `death(clip, "yield")` on the first hitpoint damage,
  and a fully armour-absorbed hit does not trigger it (observed directly:
  44 armour absorbed a 23-damage hit with no defeat). The candidate
  resolver now models the full verified gate via the optional
  `scenario.fightMode` field (absent means tournament, the earlier implicit
  assumption): first-blood defeats carry `reason: "first-blood"`, duels die
  by `howDied: "yield"`, and other modes dispatch the death string by
  direction. A third live capture (a first-blood duel kill) matched the
  modeled gate formally. ~~The live `fight_mode` of tournament/campaign
  battles is still to be observed (every capture records it for free).~~
  ► **CORRECTED 2026-09-07: tournament `fight_mode` IS observed.** Two committed
  observation records carry it — `obs-onx1405-a1` and `obs-onx1521-a1`
  (2026-09-02) — and they are the two sources of
  `golden-armoured-deflection-threshold-cleared`. What remains unobserved is the
  **campaign** mode, not the tournament one.

### Spell ingress `magic_damage_character` (byte-verified 2026-08-30)

`magic_damage_character(defender, attacker, game_defender, game_attacker,
damage_method, bonus_frame, damage)` — DefineFunction2 at `+0x1313..+0x157c`
of the same block; register bindings byte-verified from the header param
table (`r1=_global` via PreloadGlobal, `r2=game_defender`, `r3=damage`,
`r4=defender` clip, `r5=damage_method`, `r6=bonus_frame`; `attacker` and
`game_attacker` are not register-bound). Verified order:

1. Attaches `bonus_icon` at depth 25005, offset ±100 by the defender's
   facing, splat frame from `bonus_frame`, displayed bonus
   `Math.ceil(damage)`, `check_flipping`, crowd action 2, then
   `defenderClip.gotoAndPlay(damage_method)` — i.e. for this ingress the
   `damage_method` argument is the defender's animation label and
   `bonus_frame` selects the splat.
2. Armour-first algorithm identical to the physical path, including the
   exact-armour-equality quirk (equality skips the overflow rewrite, so the
   full original damage also reaches hitpoints) and the strict-overflow
   rewrite `damage -= originalArmour` with `armourclass_temp` zeroed only on
   strict overflow; `armourclass` is left negative until `check_stats`
   clamps it.
3. The hitpoints subtraction is gated on post-decrement `armourclass <= 0`;
   the **applied** damage is the raw `damage` argument (possibly
   overflow-rewritten) — unlike the physical path there is **no**
   `Math.ceil` before the armour/hitpoint math; the ceil at step 1 is
   display-only.
4. `game_defender.psyche_up = 1` unconditionally at the join.
5. The same unconditional breastplate stamina join as the physical path.
6. `check_stats(game_defender)`, then the shared defeat gate above.

The function contains **no** RNG call, no `RandomNumber` opcode, and no
armour-removal call — its complete call inventory is the UI attach/goto
calls, `Math.ceil`, `check_flipping`, `get_percentage`, `add_percentage`,
`check_stats`, and the two `death` sites. Spell damage rolls therefore all
happen in the callers (the mapped `randomBetween` ranges), and a future
spell-ingress candidate needs no removal or knockback samples.

Two transient/boundary behaviors need explicit runtime fixtures. Direction 23
does not assign `criticalhit`, so bash can inherit the previous action's value.
When incoming normal/grievous damage exactly equals remaining armour, bytecode
sets armour to zero but does not rewrite the local damage register to overflow;
the subsequent non-positive-armour branch therefore appears to apply the full
original damage to hitpoints. Both are recorded as static candidates, not
promoted vanilla rules.

`magic_damage_character` is the parallel spell/effect ingress. It receives an
already calculated `damage` argument, applies armour then hitpoint overflow,
updates stamina, clamps state, and follows the same phase/death boundary. Full
direct-damage observations are:

► **THIS TABLE HAD THE WRONG SHAPE UNTIL 2026-09-20, AND THE SHAPE IS WHAT
  PRODUCED A THREE-WEEK ERROR IN THE CODE.** It carried one row per SPELL, as
  though each had its own `magic_damage_character` call. It does not. **There
  are three spell call sites for eleven spells**, one per ARM, and the
  arguments that are not the damage — `damage_method` and `bonus_frame` — are
  pushed ONCE for the whole family, before the per-spell arms converge. A
  row-per-spell table structurally cannot record that, so three rows below
  looked as though the build recorded no label for them, and
  `SS2_DIRECT_DAMAGE_SPELLS` faithfully wrote down `damageMethod: null` three
  times. **It is grouped by arm now.**

| Arm | Members | `damage_method` | `bonus_frame` | Damage |
| --- | --- | --- | ---: | --- |
| fireball, `+0x8f59`–`+0x94ff`, ingress `+0x91c1` | fireball (30) | `burning` | 4 | inclusive `randomBetween(80, 160)` `+0x9012` |
| | hell fireball (31) | `burning` | 4 | inclusive `randomBetween(150, 450)` `+0x9062` |
| | dire fireball (32) | `burning` | 4 | inclusive `randomBetween(300, 600)` `+0x90b2` |
| bolts, `+0x83f5`–`+0x862e`, ingress `+0x85af` | lightning bolt (34) | `lightning` | 8 | inclusive `randomBetween(100, 200)` `+0x8492` |
| | `frightning_bolt` (35) | `lightning` | 8 | inclusive `randomBetween(200, 400)` `+0x84e2` |
| molten death, `+0x862f`–`+0x895c`, ingress `+0x88e5` | death from above (49) | `burning` | 4 | a FIXED 40 per boulder, `+0x88c1`; `randomBetween(10, 20)` boulders `+0x86a5` |

**So a frightning bolt plays the `lightning` hurt clip, and a dire fireball the
`burning` one, because they share their arm's single call.** `damage_method` is
`defenderClip.gotoAndPlay`'s argument and `bonus_frame` selects the floating
splat; neither moves a number. **They are not cosmetic anyway**: the capture
wrapper emits the build's real `arguments[4]`, `src/golden/observation.js`
derives a `magic-damage` event's `method` from the candidate's own value and
deep-compares `/events`, so a wrong label diverges loudly against a live
capture — and `candidate-spell-lethal-slain`, which carried one of the three
nulls, is an active staged capture target.

*(And the repository already held this measurement.
`tools/runtime-capture/ss2-capture-wrapper.as` has named these literals at these
offsets — "burning" (fireball **group** `+0x91c1`, death-from-above boulders
`+0x88e5`), "lightning" (bolt **group** `+0x85af`) — since `7601888`, five hours
after `8c3fc0a` wrote the nulls. It even says group. Nobody propagated it. This
was an internal contradiction for three weeks, not an unread byte.)*

The boulder total is therefore 400–800 only if every scheduled impact resolves.
All of these enter the armour-to-hitpoint overflow path; the same
breastplate-based stamina gain applies to hitpoint-applicable damage.


### The enchantment effect is a SKIPPED TURN, not an on-hit bonus (byte-read 2026-09-02)

`damagecharacter`'s enchantment proc — gated on
`randomBetween(1,100) < game_attacker.weapon_enchantment_potency * 10` at
`+0x1bf1`, `+0x1c09..+0x1c22` — writes **one boolean on `game_defender`**
(register 3: the same object `check_stats` is called on at `+0x193c` and whose
`hitpoints` the death gate reads at `+0x194a`). **The block `+0x1bf1..+0x1dd2`
contains no call to `magic_damage_character`** — its only writes are four
`SetMember`s of `true`. Types map 2 → `burning`, 3 → `frozen`, 4 → `poison`,
5 → `life_stolen`.

*(An earlier draft of this paragraph said the block "contains no damage
arithmetic … it is four `SetMember`s of `true`", and a verifier broke it the
same night. The block DOES contain arithmetic: `magicweapon_percentage =
randomBetween(1,100)` is a real `CallFunction` at `+0x1c07`, the proc gate
multiplies at `+0x1c1f` and compares at `+0x1c20`, and each of the four arms is
a two-limb test on `equipped_weapon` and the matching type field. What is true
is the narrower claim now written above: **no damage is computed or applied
here**, and the only thing that leaves the block is a boolean.)*

The damage arrives on the AFFLICTED COMBATANT'S NEXT TURN, and costs them the
turn.

**Where the flag is consumed.** Both sides clear the flag in the same statement
that turns it into the turn's decision, in the order frozen, burning, poison,
life_stolen, as four SEQUENTIAL `if`s rather than an `else if` chain:

| side | block | flag test / clear | decision written |
| --- | --- | --- | --- |
| hero | `sprite:862[overlay]/frame:1/DoAction@0x236941` | `+0x0e79`, `+0x0ec5`, `+0x0f11`, `+0x0f5d` | `getphase("frozen")` `+0x0e81`, `("burning")` `+0x0ecd`, `("poisoned")` `+0x0f19`, `("life_stolen")` `+0x0f65` |
| villain | `sprite:862[overlay]/frame:52/DoAction@0x23f835` | `+0x1348`, `+0x1386`, `+0x13c4`, `+0x1402` | `villaindecisionA =` `+0x1370`, `+0x13ae`, `+0x13ec`, `+0x142a` |

`getphase` (`+0x36a` of the frame-1 block) assigns `decisionA` and jumps to the
`heroactions` label.

**Because the tests are sequential, a combatant carrying two statuses loses
one.** Every set flag is cleared, but which match SURVIVES is not the same on
the two sides, and the table above is why.

► **CORRECTED 2026-09-07, after an independent verifier confirmed it. This
  paragraph read "only the LAST match sets the decision — so frozen + burning
  consumes the frozen flag and never plays a frozen phase", for BOTH sides.
  That is the villain's rule generalised to the hero, and for the hero it is
  backwards.**

- **HERO: the FIRST match wins.** The hero writes its decision by CALLING
  `getphase(...)` (`+0x0e81`, `+0x0ecd`, `+0x0f19`, `+0x0f65`), and `getphase`
  runs its body only at `turnphase == 1` and sets `turnphase = 2` on success —
  see §"Turn gating, forced phases, and per-turn re-entry", which states the
  consequence in general terms already: *"at most one `getphase` call takes
  effect per pass through frame 1"*. So the first matching status takes the
  turn and every later one is a silent no-op **that still cleared its flag**.
  frozen + burning plays FROZEN and silently loses the burning.
- **VILLAIN: the last match wins — within the status chain only.** The villain
  ASSIGNS `villaindecisionA` directly (`+0x1370`, `+0x13ae`, `+0x13ec`,
  `+0x142a`) with no equivalent gate, so each match overwrites the previous.
  But that is not the villain's final word either: `villainChooseAction` ends
  by calling `villain_cast_spells()`, which **can replace the decision with a
  spell label** (see §"Spell and vanilla AI surface"). "Last status wins" is
  therefore the rule for that chain, not for the turn.
- **And the status arms are rows 4-7 of a chain whose rows 1-3 are
  `swap_weapons`, `rest` and the taunted run.** Under first-match-wins those
  outrank every status for the hero: a BURNING HERO AT ZERO STAMINA rests, and
  the burning flag is cleared with its phase never played. §"Turn gating"
  already gives exactly this example — *"a forced rest at zero stamina clears
  and discards a pending `burning` phase in the same pass"* — which is the
  clearest sign the two sections were describing different rules while sitting
  in the same document.

*(How it survived: §"Turn gating" and this section were byte-read on different
days and never reconciled, and each is correct about the offsets it cites. The
contradiction is between two accurate readings, which is the kind a
single-section review cannot catch. Found while implementing the status phase,
confirmed by an independent verifier before this edit was made, per the standing
rule that the map is corrected only after one.)*

**Three spellings for one effect, and they are not interchangeable.** The FIELD
is `poison`; the DECISION label is `"poisoned"`. `life_stolen` keeps its
spelling as a decision but reaches `magic_damage_character` as `"lifesteal"`.

**The status phase itself** — `sprite:862[overlay]/frame:52/DoAction@0x240c7f`,
inside the `attacker.onEnterFrame` closure (`DefineFunction2` at `+0x36ae`),
four arms gated on `phase_decision`:

| `phase_decision` | guard | `damage_method` | `bonus_frame` | primary read | secondary read |
| --- | --- | --- | ---: | --- | --- |
| `frozen` | `+0x529d` | `"frozen"` | 5 | `+0x532f` | `+0x536b` |
| `life_stolen` | `+0x53d1` | `"lifesteal"` | 6 | `+0x5463` | `+0x549f` |
| `poisoned` | `+0x5505` | `"poisoned"` | 7 | `+0x5597` | `+0x55d3` |
| `burning` | `+0x5639` | `"burning"` | 4 | `+0x56cb` | `+0x5707` |

Each arm, taking `frozen` as the worked example:

```text
if (phase_decision != "frozen") skip the arm                       // +0x529d
attacker_clip.crowd_action = 0                                     // +0x52af
game_attacker.staminacost = 0                                      // +0x52c0  <- no stamina cost
if (attacker.struck == null) {                                     // +0x52d5  <- was "!= null"; see below
    attacker.struck = false                                        // +0x52ec
    attacker.gotoAndPlay("frozen")                                 // +0x52fa
    if (game_attacker.equipped_weapon == 1)                        // +0x530e
        magic_damage_character(<swapped roles>, "frozen", 5,
                               game_defender.weapon_enchantment_damage)   // +0x532f
    else
        magic_damage_character(<swapped roles>, "frozen", 5,
                               game_defender.secondary_weapon_enchantment_damage)  // +0x536b
}
if (attacker.struck == true) { attacker.struck = null; nextphase() } // +0x539c / +0x53b4  <- was "!= true"
```

~~`if (attacker.struck != null) {` … `if (attacker.struck != true) {
attacker.struck = null; nextphase() }`~~ **BOTH TESTS WERE INVERTED, and the
block above is rewritten rather than annotated because a reader who copies a
code block does not read the paragraph under it — corrected 2026-09-22 by a
write-nothing verifier re-reading the arm from the bytes.** The entry body runs
when `attacker.struck == null`: `+0x52db`–`+0x52e7` is `Push "struck";
GetMember; Push null; Equals2; Not; If`, and the `If` SKIPS the body when the
field is not null. The teardown runs when it is `== true`: `+0x53a2`–`+0x53af`
is the same shape against `true`. **The other three arms have the same
polarity** — `life_stolen` `+0x540f`/`+0x54d6`, `poisoned` `+0x5543`/`+0x560a`,
`burning` `+0x5677`/`+0x573e` — which is the latch every other phase in this
block uses (the bolt arm's `if (attacker.struck == null)` at `+0x8456`): start
the clip once while the latch is null, set it `false`, and hand the phase back
once the clip's own frame script has written `true`.

**THE ROLE OPERANDS ARE DELIBERATELY CROSSED, and reading them as a wrong-side
bug is the trap here.** There are eleven `magic_damage_character` call sites:
eight enchantment (`+0x5354`, `+0x5390`, `+0x5488`, `+0x54c4`, `+0x55bc`,
`+0x55f8`, `+0x56f0`, `+0x572c`) and three spell (`+0x85af`, `+0x88e5`,
`+0x91c1`). `CallFunction` pops the name, then the count, then the arguments, so
the LAST value pushed is argument one:

| | spell, `+0x85af` | enchantment, all eight |
| --- | --- | --- |
| `defender` | `defender` clip | **`attacker` clip** |
| `attacker` | `attacker` clip | **`defender` clip** |
| `game_defender` | `game_defender` | **`game_attacker`** |
| `game_attacker` | `game_attacker` | **`game_defender`** |

The spell calls match this section's signature exactly; the enchantment calls
invert all four. **That is required, not broken.** The callee damages its own
`game_defender` PARAMETER, so a spell hits the victim and an enchantment hits
the phase's ACTOR — and in a status phase the actor *is* the victim. Anyone who
"fixes" the ordering moves the damage onto the wrong gladiator.

**And only HALF the inversion is live, which is the more precise statement.**
`magic_damage_character`'s parameters `attacker` and `game_attacker` are bound
to **register 0** — name-only, no register allocated — and the body reads
neither: it touches only R1-R6, and its complete string set contains neither
`"attacker"` nor `"game_attacker"`. So slots 2 and 4 are INERT, and what the
inversion actually does is redirect the victim (`game_defender`, R2, the object
that takes `armourclass -= damage`, `hitpoints -= damage` and `check_stats`)
and the animated clip (`defender`, R4) onto the current attacker. Reading it as
a four-way exchange overstates it; two of the four crossings are dead operands.
**No attacker stat can influence any number this function produces.**

**What IS odd, and survives that explanation:** the primary/secondary SELECTOR
at `+0x530e` reads `game_attacker.equipped_weapon` — the VICTIM's slot — while
the value it selects is a field of `game_defender`, the INFLICTOR. Which of the
inflictor's two weapons afflicted you cannot depend on which weapon you are
holding. Same family as the proc gate reading the primary potency for both
slots. Reproduce it; do not correct it.

`staminacost` is forced to 0 but `nextphase()` still runs, so the
phase-transition stamina gain and heal both apply: **a status turn is net
positive on stamina and hitpoints except for the tick itself.**

`weapon_enchantment_damage = ceil(weapon_max_damage / 3 *
weapon_enchantment_potency)` (`battlevalues` `+0x320c`); the secondary is the
same from `secondary_weapon_max_damage` and
`secondary_weapon_enchantment_potency` (`+0x3326`).

**Runtime backing, and its exact limit.** The four status phases DO occur in
this project's own archive: 67 `{"t":"var","name":"phase_action","value":"…"}`
entries — poisoned 33, frozen 19, burning 14, life_stolen 1 — across 14
rufflelogs in five session families (`arena-staged-1/2`, `arena-tourn-2`,
`session-champ-n1`, `arena-champ-2`). **None of those traces armed a capture
window and none records any other variable**, so the phases are observed and no
value from them is measured.

*(Re-derived 2026-09-07. Scoped to the five named families the figures reproduce
EXACTLY — 67 entries, 33/19/14/1, across 14 rufflelogs. Archive-wide it is now
**91 entries across 32 rufflelogs**; a 2026-09-07 survey proposed 79 across 23
and that does not reproduce, so do not carry it. **The load-bearing half is
unchanged in either scope: zero of them armed a capture window**, so the status
phase still has no runtime backing beyond its own occurrence.)* The wrapper's `DEFAULT_WATCH_FIELDS` already
carries `burning`, `frozen`, `poison`, `life_stolen` and `hitpoints`, so
capturing one needs no new flag — only a window armed while a status phase is
the decision.

## Spell and vanilla AI surface

`villainChooseAction` is another anonymous overlay-frame-52 function. It binds
hero/villain chances, evaluates distance, stamina, ammunition, weapon mode,
taunts, and damage-over-time flags, and writes `villaindecisionA` labels such as
`quick_attack`, `normal_attack`, `power_attack`, `bombardleft/right`,
`snipeleft/right`, `shove`, `taunt`, movement/charge/jump, `rest`,
`swap_weapons`, and `psyche_up`. The two arms that write `taunt` — and so the
only routes by which a villain reaches `attack_direction` 20 — are byte-read in
§Direction 20 is the taunt path.

It uses multiple random rolls and ends by calling `villain_cast_spells()`.
That function searches `inventory1`–`inventory6`, calls `use_item`, and can
replace the decision with spell labels. It rolls inclusive 1–100 and enters its
fixed-priority item chain only when the roll is greater than 10, creating a 90%
opportunity before health, armour, stamina, distance, and inventory checks.
Observed inventory ID mappings include:

| IDs | Decision labels |
| --- | --- |
| 30–35 | fireball, hell fireball, dire fireball, little fat kid, lightning bolt, `frightning_bolt` (vanilla spelling) |
| 36–42 | ghost strike, whirlwind, gale, command, swift sandals, bloodlust, colossus |
| 43–49 | `rejuvinate` (vanilla spelling), weaken armour, boundless energy, regenerate, adulation, teleport, death from above |

### The `cast_gale` phase, in full (derived 2026-09-19)

Read out of the oracle at `sprite:862[overlay]/frame:52/DoAction@0x240c7f`, the
same 38,146-byte block the melee phases live in. The map carried two rows about
this phase — the stamina cost (§"`staminacost` by phase") and the force
(§"`knockback(whichcharacter, force)`, decoded") — and not the phase; this is
the rest of it. *(The two rows were cited as `:1357` and `:2296` until
2026-09-22, when corrections above them shifted both by 22 lines; cited by
section now, because line numbers in this file rot.)*

```text
  phase_decision == "cast_gale"                              +0x7aaa
    game_attacker.staminacost = round(game_attacker.magicka)  +0x7ad0
    if (attacker.shove != true) {                             +0x7af1
      cast_spell_icon(attacker, 38)                           +0x7b0a
      attacker.shove = true                                   +0x7b22
      attacker.gotoAndPlay("Cast1")                           +0x7b30
      if (attacker.gladiator_dir == "right") force = 1000     +0x7b5d
      else                                   force = -1000    +0x7b6d
      defender.gotoAndPlay("knockback")   — UNCONDITIONAL      +0x7b78
      knockback(defender, force)                              +0x7b98
    }
    if (attacker.struck == true) {                            +0x7ba4
      attacker.struck = null
      attacker.shove  = null
      nextphase()                                             +0x7bd6
    }
```

**Four things that were not in the prose:**

- **IT TAKES NO SAMPLE AND DEALS NO DAMAGE.** Counted over `+0x7aaa`…`+0x7be5`:
  zero `randomBetween`, zero `checkattackroll`, zero `hitpoints`. Like `shove`
  and unlike `taunt`, it is a pure displacement and has no tape hazard.
- **THE COST IS `round(magicka)`, THE STAT** — not strength, and not a spell
  price. ~~It is the only phase in the block whose `staminacost` reads
  `magicka`.~~ **EVERY CAST ARM'S `staminacost` READS `magicka` — corrected
  2026-09-22 by a write-nothing verifier re-reading two other arms from the
  bytes:** the bolt arm at `+0x842f`–`+0x8437` and the fireball arm at
  `+0x8fa7`–`+0x8faf` are both `game_attacker.staminacost =
  Math.round(game_attacker.magicka)`, and this file's own table (§"`staminacost`
  by phase") already listed every `cast_*` row, `+0x7567` to `+0x8fa7`, at
  `round(magicka)`. What is particular to gale is the `shove` latch below, not
  the cost.
- **IT REUSES `attacker.shove` AS ITS IN-PROGRESS LATCH** (`+0x7af1`, `+0x7b22`,
  `+0x7bcf`), the same field the `shove` phase uses. So `shove` is not that
  verb's own flag but the state machine's generic "this displacement phase has
  started" bit, and two displacement phases can never be in flight at once.
- **THE ICON NUMBER IS THE INVENTORY ID.** `cast_spell_icon(attacker, 38)` and
  the inventory table above both give gale 38, which is what ties the phase to
  the item that offers it.

**HOW A SPELL IS OFFERED AND CONSUMED — `use_item`, derived 2026-09-19.** Spells
are INVENTORY ITEMS: `villain_cast_spells` searches `inventory1`–`inventory6`
and calls `use_item`. ~~"so the gate on casting a gale is carrying id 38 in one
of six slots"~~ — **WRONG BY FOUR CONDITIONS, and withdrawn the same day it was
written.** See §"The gale gate is five conditions, not one" below: carrying the
id is one term of five. The correction came from a question-diverse wave
(`wf_1ee83aec-a10`, VERIFIED, 4 questions + 5 verifiers, 9 started 9 returned)
whose verifier re-derived the chain from raw bytes rather than from the tool's
printed targets. **The paragraph was published, then checked, and the check is
what found it** — which is the order this file keeps having to learn.

`use_item(which_item)` is at `DoAction@0x23e7cf`, `+0x0369`:

```text
  use_item(which_item):
    spell_selected = true                                   +0x0388
    for (i = 1; i <= 6; i++):                               +0x0390
      if (inventory_array[i] == which_item):                +0x03b1
        if (which_item != 1):                               +0x03cc
          game.villain.inventory_action = which_item        +0x03de
          item_used = null                                  +0x03f4
          game.villain["inventory" + i] = 1                 +0x0409
          inventory_array = [0, inventory1 .. inventory6]   +0x041b
          spell_selected = false                            +0x04aa
```

► **1 IS THE EMPTY MARKER FOR AN INVENTORY SLOT, AND THREE INDEPENDENT SITES
  SAY SO.** This mattered enough to defer the verb over, because 1 is a
  perfectly good id in the EQUIPMENT columns and reading it as one here would
  have made a consumed spell look like a different spell:

  1. **`use_item` REFUSES `which_item == 1`** (`+0x03cc` skips the whole body).
     An id that cannot be used is not an item.
  2. **`use_item` WRITES 1 to the slot it just consumed** (`+0x0409`). Using
     something empties its slot.
  3. ~~**A character-initialisation block writes 1 to EVERY inventory slot at
     once** (`+0x330a`–, `inventory1` through `inventory6`), beside
     `shield = 0`. A fresh gladiator carries nothing.~~ **WRONG IN EVERY CLAUSE
     BUT THE OFFSET — corrected 2026-09-19 by the same wave, with the branch
     arithmetic done three ways.** `+0x330a` is in `randomise_gladiator`
     (`root/frame:35/DoAction@0x40198e`, block base `0x401994` = 4200852):
     - **It is not a character-initialisation block. It is OPPONENT
       generation.** The whole equipment/inventory/maxslots body sits inside
       `if (whichcharacter != _root.game.hero)` (`+0x27e8`, `If` delta 3615 →
       `+0x360C`, taken when EQUAL). **And it is the first of THREE identical
       hero tests (added 2026-09-22, re-derived from the bytes by a
       write-nothing verifier):** `+0x361f` (`If` delta 841 → `+0x396D`)
       guards the spell-pool build and the random-spell fill of the inventory
       slots, and `+0x3980` (delta 27723 → `+0xA5D0`) guards `goldpieces`,
       `statpoints` and the generated name. Each is the same
       `whichcharacter == _root.game.hero; Not; Not; If`, taken when EQUAL, so
       the random spells land outside `+0x27e8`'s body but behind the same
       test. The player's own gladiator never reaches
       these writes; his slots come from `characterDNA[34..39]` via
       `initcharacter` `+0x0904`. So "a fresh gladiator carries nothing" is true
       of every generated opponent and **false for the player**.
     - **It is not "beside `shield = 0`".** `shield = 0` is the last statement
       of the `if (herolevel == 1)` arm, and that `if`'s branch TARGET is
       `+0x330a` itself (`+0x328e`, delta 119, target 4213918; 4213918 − 4200852
       = 13066 = `0x330A`). The equipment zeroes are inside a conditional arm;
       the six `= 1` writes are its join. Adjacent in address order, different
       basic blocks, different conditions.

  ~~**And the empty marker DIFFERS BY COLUMN** — `0` for equipment, `1` for
  inventory, in the same initialisation block.~~ **The conclusion survives; its
  stated evidence does not, and the framing was wrong twice over.** There is no
  "same initialisation block" (above), and `0` is not equipment convention
  leaking in — it is inventory's OWN second nothing-row.

  ► **THE REAL SHAPE, MEASURED OVER THE WHOLE 7.5 MB ORACLE (wave
    `wf_1ee83aec-a10`, VERIFIED; the verifier re-derived it from raw bytes with
    a python reader, not from the tool's printed targets):**

    - **`1` IS THE MARKER THE CODE WRITES AND TESTS FOR.** Fourteen emptiness
      tests, **every one `Equals2` against `1`, and not one against `0`** —
      `sprite:492[inventory_overlay]/frame:1` `+0x02af`/`+0x02fe`/`+0x034d`/
      `+0x039c`/`+0x03eb`/`+0x043a` for slots 1–6, and the two charsheets
      (`sprite:1332[charsheet]/frame:14` `+0x029c`…, `sprite:2218/frame:4`
      `+0x01b5`…) for slots 3–6 only. **Every literal write to a slot is 1** —
      `randomise_gladiator` `+0x330a`–`+0x334b`, `use_item` `+0x0409`, and the
      hero's own six consume handlers at `sprite:862[overlay]/frame:1`
      (`+0x0626`, `+0x0695`, `+0x0704`, `+0x0773`, `+0x07e2`, `+0x0851`).
      **Zero writes of `0` anywhere.** The grep's positive control is the same
      windows finding `"breastplate", 0` and `"shield", 0`, so an
      `"inventoryN", 0` would have been caught.
    - **`0` IS A DEFINED NOTHING ROW, WHICH IS WHY AUTHORED DATA GETS AWAY WITH
      IT.** `_root.inventory0` and `_root.inventory1` are the same five-element
      row, **byte-identical after the name operand**: file offsets `0x3FF6C8`
      and `0x3FF6E9` share a 25-byte tail, differing only in `09 70 01`
      (const16 368) versus `08 25` (const8 37). Both resolve through
      `_root["inventory" + slotValue]` to the same display row.
    - **SO 0 AND 1 ARE THE SAME ROW AND NOT THE SAME VALUE.** Three display
      sites diverge: the charsheets blank a slot only on `== 1`, so a `0` slot
      renders a "nothing" line where a `1` slot renders blank; and
      `inventory_buttonN.gotoAndStop(hero.inventoryN)` passes the raw value as a
      1-indexed FRAME number, where `0` is out of range.
    - **`0` CAN ONLY ENTER A SLOT THROUGH AN AUTHORED OR SAVED DNA STRING**, and
      that is exactly where it does: of the champion literals in `unleash_hell`,
      seventeen spell an empty slot `0`, two spell it `1`, and one row mixes
      both. `constructDNA`/`constructvillainDNA` serialise the raw value with no
      substitution, so the DNA the ENGINE emits for an empty slot is `1`.
      **This is why `docs/integration/ss2-champion-dna.md`'s rank-1 decode
      (`inventory2` 1, `inventory3`–`6` 0) is not a contradiction** — it is one
      hand-typed row using both conventions.

  ► **A FOURTH AND FIFTH SITE THIS SECTION NEVER CITED.** `check_inventory` is
    undocumented here and is the function the offer ladder actually calls; and
    `is_that_virtuous` holds the build's only `> 0` emptiness test
    (`inventory3..6 > 0` → `inventory_maxslots = 2`), a **third** predicate that
    would read the engine's own empty marker `1` as occupied. It is DEAD in the
    installed build: its sole caller is gated on `fizMode != "fizzle"` and
    `root/frame:1/DoAction@0x5b66c` `+0x0026` writes `"fizzle"` unconditionally,
    the only write among sixteen `fizMode` references.

  ► ~~**`inventory_maxslots` GATES NOTHING IN COMBAT.** Both `use_item`
    (`+0x0390`) and `check_inventory` (`+0x02f8`) loop a hard `i = 1..6`. Its
    only read-gate anywhere is hero button `_visible` in `sprite:492`. **An
    engine that made a verb respect `maxslots` would be modelling behaviour the
    build does not have.**~~ **TWO OF THOSE THREE SENTENCES ARE WRONG, AND THE
    LAST ONE IS BACKWARDS — corrected 2026-09-20, one day after it was written,
    by a verifier that read `sprite:492` end to end and swept all 21 references
    to the field.**

    - **The VERB half survives, and it is the only half that does.**
      `use_item` `+0x0390` really is a hard `i = 1..6` with no `maxslots` read.
      So *nothing the villain's consumption does* respects the field.
    - **"Its only read-gate anywhere" is FALSE.** There is a second live one:
      `randomise_gladiator` `+0x3914`–`+0x3968` runs
      `while (!(i > inventory_maxslots)) { spell_choice = random(spells_array.length);
      character["inventory" + i] = spells_array[spell_choice]; i++ }`. ~~**The field
      decides how many of a generated opponent's six slots receive a random
      spell.**~~ **THE FIELD DECIDES HOW MANY SLOTS RECEIVE A DRAW FROM THE
      POOL, AND A DRAW CAN BE "EMPTY" — corrected 2026-09-22 by a write-nothing
      verifier re-deriving the pool from the bytes.** Slots 1..`maxslots` are
      written from `spells_array`, which ALWAYS holds the empty marker 1 twice
      (`new Array(1, 1)` at `+0x3624`); below `magicka` 4 the pool is only
      `[1, 1]`, so every slot the loop fills is written empty. An engine
      ignoring it generates the wrong opponents. ~~*(Whether
      that loop is inside `randomise_gladiator`'s
      `if (whichcharacter != _root.game.hero)` guard is NOT settled — the
      verifier had no window over `+0x27e8` and declined to relay this file's
      own delta arithmetic as re-derived. Dump `+0x27e0`–`+0x3980` before
      relying on it either way.)*~~ **SETTLED 2026-09-22, by a write-nothing
      verifier over a dump of the whole function (`+0x2409`–`+0xa5e0`).** The
      fill loop (`+0x3914`–`+0x3968`) sits inside a SECOND, identical hero
      test, `+0x361f` (`If` delta 841 → `+0x396D`, taken when
      `whichcharacter == _root.game.hero`) — not inside `+0x27e8`'s body,
      which ends at `+0x360C`. No branch outside `+0x3624`–`+0x3968` targets
      into it (all 1,046 `If`/`Jump`s in the function checked), and register 3
      is never written (the only `StoreRegister`s are to r4 and r0). Register 3
      IS `whichcharacter`: the `DefineFunction2` header has flags `0x16a` and
      binds `whichcharacter` → r3 and `herolevel` → r4, with `_root` preloaded
      into r1. **So the object that IS `_root.game.hero` never receives random
      spells here.** `Equals2` on two objects is identity, so a COPY of the
      hero passed in would.

      **The pool, as the bytes build it.** Fourteen CUMULATIVE tests on
      `whichcharacter.magicka` — each `magicka < T; Not; Not; If` skips only
      its own block — push onto the two empty markers:

      ```text
        spells_array = new Array(1, 1)                        +0x3624
        if (magicka >=  4) spells_array.push(2, 6, 48)        +0x3654
        if (magicka >=  6) spells_array.push(5, 40)           +0x368d
        if (magicka >=  8) spells_array.push(3, 34, 39, 47)   +0x36c1
        if (magicka >= 10) spells_array.push(7, 30, 37)       +0x36ff
        if (magicka >= 12) spells_array.push(9, 44)           +0x3738
        if (magicka >= 15) spells_array.push(41, 45, 46)      +0x376c
        if (magicka >= 16) spells_array.push(4, 36)           +0x37a5
        if (magicka >= 20) spells_array.push(8, 31)           +0x37d9
        if (magicka >= 24) spells_array.push(5, 35)           +0x380d
        if (magicka >= 25) spells_array.push(33)              +0x3841
        if (magicka >= 30) spells_array.push(32)              +0x3870
        if (magicka >= 40) spells_array.push(43)              +0x389f
        if (magicka >= 50) spells_array.push(42)              +0x38ce
        if (magicka >= 60) spells_array.push(49)              +0x38fd
        for (i = 1; !(i > inventory_maxslots); i++)           +0x3914
          inventory[i] = spells_array[RandomNumber(length)]   +0x3943
      ```

      **30 entries at full magicka, ids 1 and 5 twice each, and id 38 (gale)
      NEVER — so the random-opponent generator never hands anyone gale.** The
      pool also carries 2–9, the ids the villain ladder below dispatches as
      `drink_potion`. The fill draws with the one-byte `RandomNumber` opcode
      (`+0x3943`), not `randomBetween`, and does no de-duplication: one id can
      fill two slots.
    - **"An engine that made a verb respect `maxslots` would be modelling
      behaviour the build does not have" is backwards FOR THE OFFER.** A button
      the build refuses to draw is behaviour the build has, in combat. See the
      hero's own gate below.

  ► **THE HERO'S IN-BATTLE OFFER GATE IS TWO CONDITIONS PER SLOT (derived
    2026-09-20).** `sprite:492[inventory_overlay]/frame:1/DoAction@0x50e4f`, the
    panel the battle overlay attaches at `sprite:862[overlay]/frame:1` `+0x02fe`
    and whose six buttons that same block wires with `onRollOver`, `onRollOut`
    and `onRelease`:

    ```text
      // ungated prelude
      inventory_buttonI.gotoAndStop(_root.game.hero.inventoryI)   +0x011a..+0x0215
      // gate 1 — top-level, unguarded
      for (i = 1; !(i > 6); i++)                                  +0x0216
        if (i > _root.game.hero.inventory_maxslots)               +0x024f
          inventory_buttonI._visible = false                      +0x026c
      // gate 2 — six separate two-term tests
      if (_global.battle_started == true                          +0x0289
          && _root.game.hero.inventoryI == 1)                     +0x02af
        inventory_buttonI._visible = false                        +0x02ca
    ```

    The block is 270 instructions, `+0x0000`–`+0x045d`, and **the first branch
    instruction in it is at `+0x0232`** — after the loop's init — so nothing
    encloses the loop. There is no `_visible = true` anywhere in it. Final
    visibility is `i <= maxslots AND NOT(battle_started AND inventoryI == 1)`.

    - **`> ` and not `>=`, and the loop is inclusive 1..6.**
    - **THE GATE FAILS OPEN when `inventory_maxslots` is undefined.** `Greater`
      is ECMA abstract relational comparison, so `i > undefined` is `i > NaN`,
      false for every `i`, and nothing is hidden.
    - **The `onRelease` dispatcher has NO gate of its own** — no `maxslots`
      test, no `!= 1` test, only the `inv_struck` one-press-per-turn latch. So
      `_visible` is the whole of the gate, and it rests on an invisible AVM1
      MovieClip not being clickable. That is Flash/Ruffle runtime semantics
      rather than something these bytes state; **it is the one link in this
      chain nobody here has measured.**
    - **There is NO default of 6.** `initcharacter` takes the value from
      `characterDNA[40]` (`+0x098e`) and then walks a band chain: 2/3/4/5/6 at
      `herolevel >= 6/15/20/30/40` (`+0x0aa5`, `+0x0aca`, `+0x0aef`, `+0x0b14`,
      `+0x0b39`); `randomise_gladiator` writes the same chain with a `< 6 -> 1`
      arm (`+0x336f`–`+0x34a5`). **Six needs level 40**, and this repository's
      own decoded rank-1 champion carries 1 at `herolevel` 5. Across levels
      6–14 the hero's `maxslots` is 2 and **the build hides buttons 3, 4, 5 and
      6 during a battle**.
    - **The loop reads `_root.game.hero` hard-coded**, so this panel says
      nothing about the villain's offer — consistent with "the offer gate
      differs by side".

► **SO CONSUMPTION IS: SET THE SLOT TO 1.** `magic_damage_character`
  (`+0x148e`) sat behind the same unread column and is unblocked by the same
  reading.

► **THE SIX SLOTS ARE DECLARED RESOURCES SINCE 2026-09-19, AND NO GOLDEN
  MOVED.** They were absent from `SS2_RESOURCE_NAMES`, so they did not reach the
  resolver at all. They are in it now, with **no `SS2_RESOURCE_DEFAULTS`
  entry** — the `psyche_up` shape, so only a record that STATES a slot declares
  the key. The 23 golden replay hashes were taken before and after and **all 23
  are byte-identical**; the suite is 2098 / fail 0 / skipped 1 either side.

  Two of that decision's costs turned out not to exist, and saying so is
  cheaper than the next session re-costing them:
  - **`CANONICAL_RESOURCE_SOURCES` is untouched, deliberately.** Nothing writes
    a slot yet, and `emitResource` returns early for a resource that does not
    MOVE, so mirroring would be a write-allowlist entry with no driver. It goes
    in with the verb, which is where `psyche_up`'s went (`b201486`, not the
    vocabulary commit `a89601c`).
  - **The campaign record needs nothing.** `restoredResources` is returned by
    `advanceCircuit`, never persisted, and the vanilla field-name screen already
    refuses `inventory1`–`inventory6` because `VANILLA_FIELD_GROUPS` has
    carried them all along.

  **The demo roster's six slots went `0` → `1` in the same commit**, because 1
  is what the code writes and what all fourteen emptiness tests look for. It was
  inert for exactly as long as nothing read the field — the fifth time
  `tools/arena/roster.js` has taught that a stated field is harmless right up
  until something reads it.

### The two bolt phases, in full (derived 2026-09-20)

Read out of `sprite:862[overlay]/frame:52/DoAction@0x240c7f`, the same
38,146-byte block every other phase lives in. **Block base = `0x240C85` = the
tag offset `0x240c7f` + 6** (the long-form `RECORDHEADER`), so an absolute
`target` minus 2362501 is a relative `+0x` offset. *(Derive this per block. It
does NOT hold for `sprite:862[overlay]/frame:1/DoAction@0x2378cc`, where four
independent branches imply a base 506 bytes BEFORE the printed tag offset.)*

The arm is `+0x83f5`–`+0x862e`, 138 instructions, six `If`s and **zero
`Jump`s**:

```text
  phase_decision == "cast_lightning_bolt"                         +0x83fb
    || phase_decision == "cast_frightning_bolt"                   +0x840f
    register:3.crowd_action = 5                                   +0x841c
    game_attacker.staminacost = Math.round(game_attacker.magicka)  +0x842f
    if (attacker.struck == null) {                                +0x8456
      if (phase_decision == "cast_lightning_bolt") {              +0x846d
        cast_spell_icon(attacker, 34)                             +0x8485
        lightning_damage = randomBetween(100, 200)                +0x8492
        lightning_frame  = 1                                      +0x84ab
      }
      if (phase_decision == "cast_frightning_bolt") {             +0x84bd
        cast_spell_icon(attacker, 35)                             +0x84d5
        lightning_damage = randomBetween(200, 400)                +0x84e2
        lightning_frame  = 2                                      +0x84fb
      }
      attacker.struck = false                                     +0x850d
      attacker.gotoAndPlay("Cast2")                               +0x8515
      bolt = arena.gladiators.attachMovie("lightning_bolt_combat",
               "lightning_bolt_combat", getNextHighestDepth(),
               { _x: defender._x, _y: 50 })                       +0x852a
      magic_damage_character(defender, attacker, game_defender,
               game_attacker, "lightning", 8, lightning_damage)   +0x85af
      bolt.gotoAndStop(lightning_frame)                           +0x85c2
    }
    if (defender.struck == true) {                                +0x85db
      bolt.removeMovieClip()                                      +0x85ed
      attacker.struck = null                                      +0x860b
      defender.struck = null                                      +0x8618
      nextphase()                                                 +0x861f
    }
```

**Seven things that were not in the prose:**

- **ONE SAMPLE PER CAST, AND IT IS THE DAMAGE.** Two `randomBetween` sites in
  mutually exclusive arms, so exactly one fires. Zero `checkattackroll`, zero
  `RandomNumber`, zero direction draws over all 138 instructions. **A bolt
  cannot miss and cannot crit**, and no caster stat reaches the number.
- **THE COST IS `round(magicka)`, THE STAT** — the same shape `cast_gale` has,
  and **there is no affordability check anywhere**. The item table prices a
  lightning bolt at 15; the phase does not read that number.
- **THE TWO INNER TESTS ARE SEQUENTIAL `if`s, NOT AN ELSE-IF.** The
  `cast_lightning_bolt` body ends at `+0x84b6` with no `Jump` and falls into
  `+0x84b7`, which re-reads `phase_decision` and re-tests it.
- **THE `nextphase` GATE READS `defender.struck`, NOT `attacker.struck`**
  (`+0x85db`), unlike `cast_gale` (`+0x7ba4`) and the melee phases — **and
  nothing in the arm ever writes `defender.struck = true`.** The arm's only
  writes to it are `= null`. It is a two-party handshake whose other half is
  outside the arm, so a port that models this as one atomic turn must supply
  that write or the phase deadlocks. `cast_death_from_above` carries the
  identical gate at `+0x8903`–`+0x8916`, so this is not unique to the bolts.
- **`bolt`, `lightning_damage` and `lightning_frame` ARE TIMELINE-SCOPE**
  (`SetVariable` at `+0x8587`, `+0x84aa`/`+0x84fa`, `+0x84b6`/`+0x8506`), and
  they have to be: `bolt.removeMovieClip()` runs on a LATER frame than the one
  that created the clip.
- **THE ARM HAS NO `Jump`, so after `nextphase()` execution FALLS THROUGH into
  the `cast_death_from_above` test and every later arm in the same frame**, each
  re-reading `phase_decision`. If `nextphase()` reassigns it to a label tested
  later in the chain, a second phase body runs on the same frame. The arm before
  this one does the same thing.
- **NO `fightdistance` READ OF ANY KIND**, and the clip is attached at the
  DEFENDER's own `_x`. The item table calls a lightning bolt "close-ranged";
  the bytes impose no range at all.

### Five more phases, in full, and the timed buffs `nextphase` applies (derived and verified 2026-09-22)

Every arm below is in `sprite:862[overlay]/frame:52/DoAction@0x240c7f` (block
base `0x240c85`), each was derived by one agent from byte dumps of the oracle
and re-derived by a SEPARATE write-nothing verifier aimed at one claim. What a
verifier broke is said where it broke. Villain-ladder offsets are
`villain_cast_spells` (`DoAction@0x23e7cf`, base `0x23e7d5`).

**`drink_potion`, `+0x576d`–`+0x5dad` — one label for ids 2–9; the id rides in
`game_attacker.inventory_action`.** HOLDS. Every tick `crowd_action = -3`
(`+0x577f`) and `staminacost = 0` (`+0x578c`); once, inside `struck == null`
(`+0x57a1`): `gotoAndPlay("drink_potion")`, `potions.gotoAndPlay(inventory_action
- 1)`, then EIGHT INDEPENDENT ifs (no `Jump` in the arm), each `game_attacker.<f>
= <f> + bonus`:

| id | test | `bonus` | field | splat |
| --- | --- | --- | --- | --- |
| 2 | `+0x5813` | `round(hitpointsmax * 0.25)` | `hitpoints` | 1 |
| 3 | `+0x58c3` | `round(hitpointsmax * 0.5)` | `hitpoints` | 1 |
| 4 | `+0x5973` | `round(hitpointsmax * 0.75)` | `hitpoints` | 1 |
| 5 | `+0x5a23` | `hitpointsmax`, unrounded | `hitpoints` | 1 |
| 6 | `+0x5ab5` | `round(staminamax * 0.5)` | `staminaleft` | 2 |
| 7 | `+0x5b65` | `round(staminamax)` | `staminaleft` | 2 |
| 8 | `+0x5c08` | `round(armourclass * 0.5)` — the CURRENT value | `armourclass` | 3 |
| 9 | `+0x5cb8` | `round(armourclass_max)` | `armourclass` | 3 |

then `check_flipping(bonus_icon, attacker)` and `check_stats(game_attacker)`
(`+0x5d67`), which caps then floors `staminaleft`, `hitpoints` and `armourclass`
to `[0, max]`. The "+ N" icon shows the UNCLAMPED bonus. No draw, no slot write,
no defender reference. The phase ends on the drinker's own `struck == true`
(`+0x5d79`), written by the fighter clip's frame 1910, the last of
`drink_potion` 1887–1910. The potion is spent before the effect on both sides:
the hero's click empties the slot, the villain's `use_item` empties it at the
decision.

**`cast_teleport`, `+0x7541`–`+0x76ad`.** The arm HOLDS; the AI framing BROKE.
Entry (`struck == null`): `cast_spell_icon(attacker, 48)`, `circlets` attached
at the STARTING `_x` with `_y` 200, `Cast2`. Completion (`struck == true`, so
never on the entry tick): `attacker._x = randomBetween(-2000, 2000)` — EXACTLY
ONE draw, absolute, unclamped, no `_y` or facing write — then a second `Cast2`
and `nextphase()`. No `defender` reference anywhere. The villain's arm 26 guard
is `check_inventory(48) && fightdistance < 250 && hitpoints < hitpointsmax / 2`
(`+0x0f1c`–`+0x0f8c`, both strict) — **but that is the arm's LOCAL guard, not
"when the villain teleports"**: the ladder's `randomBetween(1, 100) > 10`
(`+0x056f`) comes first, and 25 earlier arms pre-empt it, two on possession
alone (49 death from above, 45 boundless energy).

**`cast_weaken_armour`, `+0x777c`–`+0x78d9`.** HOLDS. Once, inside
`struck == null`: `cast_spell_icon(attacker, 44)`, `Cast1`, then THREE rounds of
`attack_direction = 1 + RandomNumber(9)` (`+0x7815`/`+0x7845`/`+0x7875` — the
one-byte opcode, so directions 1–9 only) and `remove_armour(game_defender,
defender, attack_direction)`. Directions 1–9 fall in exactly one group each —
{1,5,8,9} `randomBetween(1, 2)` over helmet, shoulderguard; {2,4,6}
`randomBetween(1, 3)` over breastplate, gauntlet, greaves; {3,7}
`randomBetween(1, 3)` over shinguard, boot, shield — and the selector is drawn
BEFORE the piece test, so an unarmoured victim still costs it. No clip on the
victim; no damage; ends on the caster's own `struck`. Villain arm 19:
`check_inventory(44) && fightdistance < 300` (`+0x0c3f`–`+0x0c75`), no armour
test on either side.

**`destroy_armour` is three draws per CALL, and a paired piece makes two calls.**
HOLDS, and it convicts shipped code. `remove_armour` calls it twice,
unconditionally, for shoulderguard, gauntlet, greaves, shinguard and boot (one
per side; `+0x0500`/`+0x056e`, `+0x07a2`/`+0x0810`, `+0x08f1`/`+0x095f`,
`+0x0a8d`/`+0x0afb`, `+0x0bdc`/`+0x0c4a`) and once for helmet (`+0x03c5`),
breastplate (`+0x06c1`) and shield (`+0x0d2b`). Each call draws, at call time,
the horizontal speed (facing "right" `-30 + RandomNumber(20)`, "left"
`10 + RandomNumber(30)`, otherwise `randomBetween(-30, 60)`), then
`-40 + RandomNumber(20)`, then `-5 + RandomNumber(5)`; its per-frame closure
draws nothing. **`removeArmourCandidate` takes one triple per removed piece, so
it was three draws short for every paired piece.** No golden can move: debris
feeds presentation only, and for right/left facing the draws are opcodes the
pipeline cannot capture. Two build quirks: the second gauntlet's debris is
named `"shoulderguard"` (`+0x07de`), and the left boot's uses the
`"shinguard" + boot` linkage (`+0x0baa`).

**`cast_rejuvinate`, `+0x8d69`–`+0x8f58`.** The arm HOLDS. No draw, no timed
counter. Once, inside `struck == null`: `cast_spell_icon(attacker, 43)`,
`gotoAndPlay("Rejuvinate")` (capital R; the clip's label is lowercase
`rejuvinate`, 2169–2199), `hitpoints = hitpointsmax` (`+0x8e02`), `staminaleft
= staminamax` (`+0x8e17`), `armourclass = armourclass_max` (`+0x8e2c`), then
nine piece restores — **`shoulderguard = whichcharacter.backup_shoulderguard`,
read through `GetVariable "whichcharacter"` (`+0x8e50`)**, and gauntlet,
breastplate, helmet, greaves, shinguard, boot, weapon and shield from
`game_attacker.backup_<piece>` — then `updatecharacter(game_attacker,
attacker)`, which only attaches art. `armourclass_max` is read, never written,
so a caster who lost pieces refills only to the LOWERED maximum; `_defence`
fields are untouched.
- **`whichcharacter` is never assigned anywhere in the build** (main session,
  static search of every push of the string: four sites, all `GetVariable`
  reads — this one and three in `combatCamera`). So the rejuvenated
  `shoulderguard` is `undefined`, which `remove_armour`'s `piece == 0` test
  (`Equals2`) treats as EQUIPPED. A runtime read of `game_attacker.shoulderguard`
  after a cast would confirm it.
- `backup_char` runs for the hero AND the villain at `sprite:2249/frame:1`
  (`+0x010a`, `+0x012e`; one deriver, not yet verified).
- Villain arm 1: `check_inventory(43) && hitpoints < hitpointsmax / 1.5`.

**The timed buffs live on the CLIP and tick for both fighters on every phase.**
HOLDS, by two verifiers and the function headers read from the bytes:
`check_spells` binds `which_character` → r2 and `which_avatar` → r1 (flags
`0x2a`), its counters are all on r1, and `nextphase` calls
`check_spells(game_attacker, attacker)` then `check_spells(game_defender,
defender)` (`+0x3271`, `+0x3289`). For `spell_regenerate` and
`spell_boundless_energy` it only decrements while `> 0`, with no expiry. Each
cast arm writes `attacker.spell_X = 20` on EVERY tick, outside its `struck`
gate (`+0x8bbe`, `+0x8c9d`), so the completion pass that calls `nextphase()`
leaves it at 20, which `nextphase` decrements to 19 before its effect test. In
strict alternation the bearer gains on its own phases at 19, 17, …, 1: **ten
applications, the first on the cast phase itself**; a recast resets, never
stacks. Colossus and little fat kid start at 16, not 20 (`+0x7fed`, `+0x820b`,
the latter on the DEFENDER).

**The four stat spells, command and adulation** (derived 2026-09-22 by one
deriver each from byte dumps of their arms; **NOT YET RE-DERIVED BY A
VERIFIER** except where a line says so — treat as leads with offsets).
- **`cast_colossus` (item 42, `+0x7fda`-`+0x81f7`)**: counter 16 on the
  caster's clip, crowd 15, cost `round(magicka)`; once: `oldscale = _yscale`,
  `newscale = 450`, `strength = backup_strength * 3`, `attack = backup_attack *
  2`. **Its growth is a BUILD BUG**: each tick ASSIGNS `_yscale = ceil((newscale
  − _yscale) / 2)` (`+0x80e7`-`+0x8123`, no `Add2`), which converges to 150, so
  the finish test (`_yscale >= newscale`) never passes and the phase ends only
  through the `demand_move` watchdog (~58 ticks); the fighter is left at 150%,
  not 450%, and drifts ~2 px a tick toward its facing (`+0x813f`-`+0x8191`).
- **`cast_little_fat_kid` (item 33, `+0x81f8`-`+0x83f4`)**: a DEBUFF written on
  the DEFENDER: counter 16 on the victim's clip, `strength = round(backup /
  2)`, `attack = round(backup / 2)`, scale toward 50; it completes on its first
  tick.
- **`cast_swiftsandals` (item 40, `+0x895d`-`+0x8a5f`)**: counter 20; once
  `speed = 10 + backup_speed * 2` — not a doubling. **`cast_bloodlust` (item 41,
  `+0x8a60`-`+0x8baa`)**: counter 20; once `strength = 10 + round(backup_strength
  * 1.5)` and `defence = round(backup_defence * 0.5)` — it HALVES defence, and
  the item text's "reduces your agility" names a field the arm never touches.
- **All four restore at expiry from the pre-battle `backup_*`** (written only by
  `backup_char`, at initbattle), in `check_spells`' `== 0` test, which runs
  OUTSIDE its `> 0` block (`+0x256b` → `+0x25c6`, `+0x2651` → `+0x26ac`): **a
  counter entering at 0 restores**, so this engine's 0-as-inactive convention
  is unsafe for these four (-1 is the build's inert value). Strength is ONE
  slot: the last writer wins and ANY expiry resets it, cancelling another
  spell still running. `battlevalues` recomputes reach (`physical_size`) and
  damage from strength every phase; `attack_chances` reads defence live.
- **With the per-round re-skin, the hero gains nothing from colossus or swift
  sandals** (its stats are rewritten from DNA before its next decision), and a
  villain's little fat kid on the hero is erased before the hero acts; the
  villain keeps its buffs. The engine has no mutable-stat effect kind, so all
  four wait on the owner's decision about the re-skin.
- **`cast_command` (item 39, `+0x7be6`-`+0x7db6`)**: no draw; latched on
  `attacker.shove`, it plays `knockback_mov` on the defender and PULLS it 40 px
  a tick toward the caster's facing side until `defender._x <= attacker._x +
  game_defender.physical_size` (mirror for left), at least one step — so a
  target already close ends BEHIND the caster. Villain arm 25: `check_inventory
  (39) && fightdistance > 300`. (Being verified as this is written.)
- **`cast_adulation` (item 47, `+0x76ae`-`+0x777b`)**: no draw, no defender
  reference; plays `wincrowd1`; its whole effect is `crowd_action = 50`.
  **`crowd_action` is NOT a presentation cue**, as this repository's code
  comments call it: `nextphase` adds it into `crowd_interest`, clamped 1..100
  (`+0x3541`-`+0x35a3`), and `crowd_interest` scales the victory purse. This
  engine models neither; its `SS2_CROWD` toll is authored and unrelated.
  Villain arm 28: `check_inventory(47) && fightdistance > 300`.

**The spell ladder runs LAST, and overrides the rest and the status phases**
(verified 2026-09-22; the main session's reading, re-derived by a write-nothing
verifier: HOLDS, with the stamina-gate premise corrected in the `staminacost`
table above). The villain's decision function (the anonymous function in
`sprite:862[overlay]/frame:52/DoAction@0x23f835`, base `0x23f83b`) has 122
branches, none backward, none past `+0x1432`, and no `Return`; its last
statement is `villain_cast_spells()` (`+0x1432`-`+0x1441`), unconditional.
It runs AFTER the four status blocks (`+0x133a`-`+0x1431`: each `if
(villain.<flag> == true) { <flag> = false; villaindecisionA = "<status>" }`,
last write winning) and after every rest, taunt, walk, swap and psyche
decision. `villain_cast_spells` never reads `villaindecisionA` or any status
flag; `spell_selected` is false whenever it starts. `villainChooseAction` is
called from `changeCombatants` only when `villaindecisionA == null`
(`+0x2bb4`), and `phase_decision = villaindecisionA` when `battle_action == 2`
(`+0x3ac0`). So, about 90% of the time (the ladder's own roll):
- **a tired villain in range still drinks a stamina vial or casts** (bolts on
  possession, gale on its gate, ...) instead of resting;
- **a frozen, burning, poisoned or life-stolen villain holding a qualifying
  item CASTS**, and the status phase is LOST, not delayed — its flag was
  already cleared.
This engine's `chooseAiAction` does the opposite: the forced status phase
first, then the rest at `staminaleft <= 10`, then the ladder emulation. The
statuses are a legality question too (the engine forces the status phase for
every combatant; the build forces it for the hero through `getphase` and lets
the villain's ladder override it), so reproducing it is an owner's decision
recorded in the handoff; the tired-villain order is an AI fix.

**The per-round re-skin gives the HERO's removed armour back, and not the
armour class** (derived and verified 2026-09-22; one deriver, one write-nothing
verifier, the main session's header decode; HOLDS for the hero, one clause
broken for the villain). Overlay frame 1 (`initialise`, frames 1-4,
`DoAction@0x236941`) runs `_root.skincharacter(_root.game.hero, this.hero)`
unconditionally at `+0x0a2e`-`+0x0a5c`, then `turnphase = 1` (`+0x0a8f`), the
only place `turnphase` becomes 1, which `getphase` requires. `nextphase` (flags
`0x169`: `this` in r1, `_root` r2, `_global` r3, read from the header bytes)
ends a round with `register:1.gotoAndPlay("initialise")` (`+0x3692`) once
`battle_action` reaches 3, i.e. after the hero's action and the villain's.
`skincharacter` calls `initcharacter(hero, avatar, hero.charDNA)`, which writes
every DNA field back onto `_root.game.hero` — the ten equipment ids from
indices 6-14 and 45, and also strength, defence, herolevel, the inventory
slots and `equipped_weapon`. `charDNA` was built at initbattle
(`backup_char(hero)` → `constructDNA()`); `remove_armour` never rebuilds it;
only the hero's inventory and swap click handlers do (after the re-skin, so
they carry the restored piece forward).
- `battlevalues`, at the end of EVERY `nextphase` for both fighters,
  recomputes each `<piece>_defence` from the piece id UNGATED, but writes
  `armourclass_max`, `armourclass` (and refills hitpoints, stamina, ammo)
  only inside `if (_global.battle_started != true)` (`+0x3a90`-`+0x3aa0`).
- So for the hero, with helmet h worth d and armour A of max M: a removal
  leaves helmet 0 and armour `max(A−d, 0)` / `max(M−d, 0)`; the next re-skin
  gives back helmet h, and `battlevalues` its defence d, while the armour stays
  at A−d / M−d; a second removal of the same helmet takes d AGAIN. The arena
  figure is not redrawn by the re-skin (it redraws the overlay's portrait), so
  the fighter stays visibly bare while the data says otherwise.
- The villain is never re-skinned here, so its removed pieces stay removed —
  **except through its own `cast_rejuvinate`**, which restores its pieces from
  `backup_*` (the verifier broke the claim's "stays removed" on that).
- **This engine zeroes a removed piece for the rest of the battle, for both
  sides.** No golden removes a piece, so nothing measured moves; it is a
  fidelity divergence for the hero, and the same re-skin also reverts any
  mid-battle stat change on the hero (colossus, bloodlust, swift sandals) at
  the round's end. Unverified at runtime: that `this` in `nextphase` is the
  overlay, and that `battle_started` is true mid-battle (both are implied by
  every capture in which hitpoints stay down between turns).

**`nextphase`, in the order that matters** (`+0x319e`–`+0x36a1`; one deriver,
with the stamina and buff steps re-derived by both verifiers):

| step | offsets | statement |
| --- | --- | --- |
| 1 | `+0x31b6`–`+0x3265` | clamp `game_attacker._x`, `game_defender._x` to ±2100 — the STAT objects |
| 2 | `+0x3266` | `demand_move = 1` |
| 3 | `+0x3271`, `+0x3289` | `check_spells` for attacker, then defender |
| 4 | `+0x32a1` | `staminaleft -= staminacost` |
| 5 | `+0x32c3` | `staminaleft += 1 + round(stamina / 3)` |
| 6 | `+0x3305` | `hitpoints += 1 + ceil(stamina / 2)` |
| 7 | `+0x3347` | `check_stats(game_attacker)` — the floor |
| 8 | `+0x33bd`–`+0x3475` | if `attacker.spell_regenerate > 0`: `hitpoints += round(hitpointsmax / 4)`, `check_stats` |
| 9 | `+0x3476`–`+0x3540` | if `attacker.spell_boundless_energy > 0`: `staminaleft += round(staminamax / 4)`, `check_stats` ×2 |
| 10 | `+0x3541`–`+0x35b4` | `crowd_interest += crowd_action`, clamped 1..100; `crowd_action = 0` |
| 11 | `+0x35c7` | `if (phase_decision != "psyche_up") psyche_up = 1` |
| 12 | `+0x35eb`, `+0x35ff` | `battlevalues` for attacker, then defender |
| 13 | `+0x3613`–`+0x36a1` | the `battle_action` cycle and `changeCombatants` |

**Boundless energy's gain comes AFTER the floor**, so it cannot be folded into
one clamp: staminaleft 5, cost 30, stamina 6, max 160 ends at 40 in the build
and at 18 under a single clamp. Regenerate's terms are all non-negative, so a
single clamp happens to agree. The boundless icon shows `round(stamina / 4)`
(`+0x34d1`), not the `round(staminamax / 4)` it adds. `add_stats_icon`, called
between these steps, is a `DefineFunction` with an EMPTY body (`+0x23bf`,
codeSize 0).

### The fireball family and molten death, and why ~~neither is~~ only molten death is not a turn (2026-09-20; corrected 2026-09-22)

Derived beside the bolts and recorded because the DIFFERENCE is the finding.

- **`cast_fireball` / `cast_hell_fireball` / `cast_dire_fireball`,
  `+0x8f59`–`+0x94ff`, ingress `+0x91c1`.** One sample per cast, exactly like a
  bolt — the three `randomBetween` sites are mutually exclusive arms of one
  three-way `||`. ~~What differs is that the damage is applied from a per-frame
  handler after a ballistic flight: `bullet.Xvelocity` 50/70/90
  (`+0x940f`/`+0x9435`/`+0x945b`), `gravity` 2 (`+0x9360`), `bulletlife` 1
  (`+0x933a`), `onEnterFrame` (`+0x946e`).~~ **THE FLIGHT IS FLAT AND THE
  DAMAGE IS APPLIED BY THE PHASE ARM, NOT BY THE BULLET — corrected 2026-09-22
  by a deriver and a write-nothing verifier over a dump of `+0x68df`–`+0x94ff`,
  and the main session over the sprite itself.**
  - The bullet's `onEnterFrame` (`+0x947b`–`+0x94fe`) reads only `flying`,
    `attacker.gladiator_dir`, `_x` and `Xvelocity` (50/70/90 at
    `+0x940f`/`+0x9435`/`+0x945b`): `if (flying != false) _x += Xvelocity`
    facing right, `-=` otherwise. `gravity`, `bulletlife`, `bulletcounter` and
    `distance_to_enemy` are WRITTEN (`+0x9333`–`+0x93bf`) and never read; there
    is no `Yvelocity` in the arm. `flying` is only ever set `false`
    (`+0x91ec`), so in flight it is undefined and the bullet moves.
  - The IMPACT test is the arm's, run every tick BEFORE the launch code
    (`+0x9109`–`+0x9196`): `((bullet._x > defender._x && dir == "right") ||
    (bullet._x < defender._x && dir == "left")) && bullet._currentframe != 4`,
    then `magic_damage_character(defender, attacker, game_defender,
    game_attacker, "burning", 4, fireball_damage)` (`+0x919b`–`+0x91cb`),
    `gotoAndStop(4)`, `flying = false`, `bullet_in_air = false`. **No ground,
    lifetime or offscreen clause: a fireball cannot miss**, and it tests only
    the TARGET's x, so in a team fight it passes through bystanders.
  - **A typo in the build: `bullet.gotondStop(fireball_frame)` (`+0x9276`,
    constant `"gotondStop"`).** The method does not exist, so `fireball_frame`
    1/2/3 is never applied. `fireball_combat` is sprite 28, four frames: frame 1
    runs `stop()`, so ALL THREE spells fly showing frame 1; frames 2 and 3 are
    never shown; frame 4 runs `stop()` and places sprite 27, a 23-frame
    explosion whose last frame runs `_parent.removeMovieClip()`. So the damage
    lands exactly once and the bullet is gone about 23 frames after impact.
  - Nothing in the arm ends the phase. The only end is the stall watchdog
    (`+0x37ef`–`+0x38a0`, read by the verifier): `(demand_move >= 60 &&
    attacker._y >= attacker.grounded && bullet_in_air != true) || demand_move
    >= 200`. The 200 cap cannot bind inside the ±2100 clamp (at most ~84 ticks
    of flight at 50 px).
  ► **AND ITS FRAME TEST IS AN IDEMPOTENCE GUARD, NOT AN IMPACT TRIGGER.**
    `+0x9194 Not; +0x9195 Not; +0x9196 If` is a DOUBLED `Not`, so the gate reads
    `if (bullet._currentframe != 4)`: the block applies damage once, then
    `gotoAndStop(4)` parks the clip so every later frame skips it. Reading it as
    "damage fires when the bullet reaches frame 4" inverts the mechanism and
    would build a fireball that damages on every frame but one. *(This document
    nearly recorded the inverted version; an adversarial verifier broke it
    before it was written down.)*
- **`cast_death_from_above`, `+0x862f`–`+0x895c`, ingress `+0x88e5`.**
  `randomBetween(10, 20)` boulders (`+0x86a5`), then a loop
  (`+0x86f9`–`+0x88fe`) that for EACH boulder draws four more samples —
  `randomBetween(-300, 300)` for `_x` (`+0x878b`), `(-800, -600)` for `_y`
  (`+0x87a9`), `(50, 150)` for `yspeed` (`+0x87c8`), `(50, 100)` for the scale
  (`+0x87f1`) — and gives it its own `onEnterFrame` (`+0x882f`) that calls
  `magic_damage_character(..., "burning", 4, 40)`. **41 to 81 samples per cast**,
  and the 40 is a literal, not a roll.
  ► **A COPY-PASTE LEFTOVER WORTH KNOWING BEFORE ANYONE "FIXES" IT.** The
    molten-death teardown calls `bolt.removeMovieClip()` at `+0x892b` on the
    same timeline-scope `bolt` the LIGHTNING arm creates. That arm only ever
    creates clips named `boulder`. So a molten death removes whatever bolt clip
    the last lightning cast left behind.

~~**So only the bolts are expressible as a discrete turn**, and that is the whole
reason `src/team/ss2-rules.js` builds those two and not the other nine spells
that reach this ingress.~~ **THE FIREBALL FAMILY IS A DISCRETE TURN TOO —
corrected 2026-09-22, and the "ballistic" premise above was what made it look
otherwise.** One draw, no hit roll, damage certain; the flight is cosmetic and
decides only WHEN the victim's `burning` clip starts. **Built as three verbs the
same day** (`SS2_FIREBALL_SPELLS` in `src/team/ss2-rules.js`; the flight and the
victim's reaction waiting for impact are `fireballImpact` in
`src/render/projectile.js` and `reactionDelaysFor` in `src/render/cursor.js`). Molten death stays out: its
damage comes from each boulder's own `onEnterFrame`, so how many land is a
question of flight geometry per boulder.

### The gale gate is five conditions, not one (derived 2026-09-19)

Read out of `villain_cast_spells` (`sprite:862[overlay]/frame:52/DoAction@0x23e7cf`,
block base `0x23e7d5` = 2353109). **Carrying id 38 is one term of five**, and
the sentence this section opened with named only that one.

1. **A single top-of-function roll**, `+0x056f`: `randomBetween(1, 100) > 10`,
   and the failing branch targets the function End at `+0x105f` — so a failed
   roll does NOT fall through to a melee decision from here, it leaves the
   function having chosen nothing. Inclusive 1–100, so 90% proceed. **It is
   rolled ONCE, before every per-item check, not per item.**
2. **Twenty-three preceding arms must all fail.** The ladder is 28 arms in a
   STRICT else-if chain — each arm's failing `If` targets the next arm's first
   instruction, and all 27 bodies `Jump` to `+0x105f` — in FIXED source order,
   not rolled: `randomBetween` appears exactly once in the whole function and
   there is no shuffle. Gale is **arm 24 of 28**.
3. `check_inventory(38) == true` (`+0x0e2e`).
4. `_root.arena.fightdistance < 400` (`+0x0e4c`–`+0x0e62`).
5. `villain.armourclass < villain.armourclass_max / 2` (`+0x0e6b`–`+0x0e9c`).

The three `Duplicate; Not; If` sites resolve to the next test rather than past
the body, which is what proves 3–5 are one left-associated conjunction and not
three statements.

**A consequence worth stating: a villain carrying both 41 and 38 can never cast
gale.** Arm 22 (id 41) has `fightdistance < 400` as its only extra condition,
which strictly dominates gale's `fightdistance < 400 && armourclass <
armourclass_max / 2`.

#### The whole ladder, and the SEVEN arms that fire on possession alone (2026-09-20)

Re-derived instruction by instruction by an adversarial verifier: 28 arm heads,
28 distinct ids, 28 `villaindecisionA` writes, 27 `Jump`s all sharing one target
(`+0x105f`, the function end), and **all 82 branch instructions self-consistent
with `target == next_instruction + delta`**, none landing inside another arm.

| # | id | decision | extra conditions |
| ---: | ---: | --- | ---: |
| 1 | 43 | `cast_rejuvinate` | `hitpoints < hitpointsmax / 1.5` |
| 2 | 5 | `drink_potion` | `hitpoints < hitpointsmax / 2` |
| 3 | 46 | `cast_regenerate` | 1 |
| 4 | 4 | `drink_potion` | 1 |
| 5 | 3 | `drink_potion` | 1 |
| 6 | 2 | `drink_potion` | 1 |
| **7** | **49** | **`cast_death_from_above`** | **NONE** |
| 8 | 42 | `cast_colossus` | 1 |
| 9 | 33 | `cast_little_fat_kid` | 1 |
| 10 | 9 | `drink_potion` | 1 |
| 11 | 8 | `drink_potion` | 1 |
| 12 | 7 | `drink_potion` | 1 |
| 13 | 6 | `drink_potion` | 1 |
| **14** | **32** | **`cast_dire_fireball`** | **NONE** |
| **15** | **35** | **`cast_frightning_bolt`** | **NONE** |
| **16** | **31** | **`cast_hell_fireball`** | **NONE** |
| **17** | **34** | **`cast_lightning_bolt`** | **NONE** |
| **18** | **30** | **`cast_fireball`** | **NONE** |
| 19 | 44 | `cast_weaken_armour` | 1 |
| 20 | 37 | `cast_whirlwind` | 2 |
| 21 | 36 | `cast_ghost_strike` | 2 |
| 22 | 41 | `cast_bloodlust` | `fightdistance < 400` |
| **23** | **45** | **`cast_boundless_energy`** | **NONE** |
| 24 | 38 | `cast_gale` | 2 |
| 25 | 39 | `cast_command` | 1 |
| 26 | 48 | `cast_teleport` | 2 |
| 27 | 40 | `cast_swiftsandals` | 1 |
| 28 | 47 | `cast_adulation` | 1 |

► **AN ARM WITH NO EXTRA CONDITION IS AN ABSORBING SINK, and there are SEVEN of
  them, not six.** ~~The direct-damage arms are the unconditional set.~~ **Arm
  23, id 45 `cast_boundless_energy`, has the identical single-test shape and
  sits IMMEDIATELY BEFORE GALE** — so a villain carrying 45 can never cast gale,
  command, teleport, swift sandals or adulation, whatever else is true. That is
  a sharper reason than the one this section gave for gale being hard to reach,
  and it was missed by the reading that produced the id-41 note above.

► **NO ARM STRICTLY DOMINATES ANOTHER and there is no dead arm** — all 28 ids
  are distinct and each arm's first conjunct is possession of its own id. What
  the seven do is PRE-EMPT: holding id 49 makes arms 8–28 unreachable, so a
  villain with molten death casts nothing else from this function ever. Within
  the direct-damage set the priority on simultaneous possession is strictly
  **49 > 32 > 35 > 31 > 34 > 30**.

► **AND THE SIX DIRECT-DAMAGE ARMS ARE NOT CONTIGUOUS.** Arm 7 is separated
  from arms 14–18 by six unrelated arms.

► **`use_item` IS NOT PASSED THE MATCHED ID.** Every one of the 28 bodies calls
  `use_item(item_used)` — the global `check_inventory` set — and `item_used` is
  read 28 times in this function and **written zero times**. The only two
  variables it writes are `inventory_array` (once, `+0x056e`) and
  `villaindecisionA`. An engine that passes the arm's own literal id is
  modelling a data path the build does not have.

► **`inventory_array` is `new Array(1, inventory1 … inventory6)`** (`+0x055e`,
  7 args), the leading literal making it 1-indexed with `[0] = 1` as inert
  padding. It is rebuilt on EVERY call, before the roll, whatever the roll does.

► **THE LADDER HAS A THIRD `If` IDIOM the two-case rule does not cover.**
  `Equals2; Not; Not; If` appears at `+0x0cf3`/`+0x0cf4` (whirlwind) and
  `+0x0d73`/`+0x0d74` (ghost strike) — that is a source-level `!=` plus the
  ladder's own inversion, and it is still ONE test. The `Duplicate` count is
  always *conjuncts − 1*, so gale's three conjuncts show as TWO `Duplicate`
  sites and one plain `Not; If`, not three.

**What an engine must read per combatant to decide gale:** the six inventory
slots, `armourclass` and `armourclass_max` for gale's own term, plus `hitpoints`/
`hitpointsmax` (arms 1–6), `staminaleft`/`staminamax` (arms 12–13) and
`equipped_weapon` (arms 20–21) for the arms that pre-empt it. **NOT** `magicka`
and **NOT** `inventory_maxslots` — zero references to either fall inside this
block. Magicka enters only at execution, as `staminacost = round(magicka)`
(`DoAction@0x240c7f` `+0x7ad0`), spent unconditionally at `+0x32a7` with **no
affordability check anywhere**: a villain at zero stamina still casts and goes
negative. An engine must not invent one.

`_root.arena.fightdistance` is an ARENA field, not a combatant field, and this
repository has no combatant-level home for it — **which is what `cast_gale` is
blocked on now that the resource declaration has landed.** The blocker has moved
twice: from "a byte nobody has read", to "a schema decision with a measured
blast radius", to "four conditions the offer gate has that the engine cannot
express yet".

`check_inventory(which_item)` — `DefineFunction2` at `+0x02a7`, body `+0x02cd`,
and undocumented here until 2026-09-19 — is what the ladder actually calls:

```text
  check_inventory(which_item):
    if (spell_selected == true) return false;               +0x02cd
    for (i = 1; !(i > 6); i++)                              +0x02f8
      if (inventory_array[i] == which_item                  +0x0319
          && which_item != 1):                              +0x0334
        item_used = Number(which_item)                      +0x0346
        return true                                         +0x034f
    // falls off the end -> returns undefined
```

It sets the global `item_used`, which is why the call at each arm reads
`use_item(item_used)` and looks argument-free. **Both it and `use_item` are
hardcoded to `_root.game.villain`** — all 28 call sites of each are inside
`villain_cast_spells`. The hero's inventory is consumed by a separate handler
(`sprite:862[overlay]/frame:1`, `+0x0601`–`+0x0630` and five more) which neither
rolls, nor tests `!= 1`, nor applies any extra condition. **The offer gate
differs by side, and only the villain's is a decision at all.**

`cast_spell_icon(which_avatar, spell_number)` attaches export 120
(`cast_spell_image`) to `arena.combat_panel`, positions it at the hero or villain
side, selects the inventory icon frame, hides its battle button, and displays
the inventory name. There is no callable `cast_spell` function: `cast_*`
strings are `phase_decision` labels consumed by the attacker's `onEnterFrame`
state machine.

`check_spells(which_character, which_avatar)` decrements timed fields and
restores backed-up stats/appearance when colossus, little-fat-kid, swift-sandals,
or bloodlust expires; it also decrements regenerate and boundless-energy
counters. Those six buff counters are initialized to 20. One-shot frozen,
burning, poison, and life-stolen phases use the opposing weapon's active
enchantment-damage field, then clear or advance.

`nextphase` is an anonymous function stored in overlay frame 52. Its verified
mutation order is:

1. Clamp `game_attacker._x` and `game_defender._x` to `[-2100, 2100]`. The
   literals are pushed at `+0x31c2`/`+0x31d7` and `+0x31ee`/`+0x3203` for
   `game_attacker`, and `+0x321a`/`+0x322f` and `+0x3246`/`+0x325b` for
   `game_defender`. **THIS STEP IS DEAD CODE, and the sentence that used to
   stand here — "since it lives in `nextphase` it bounds every gait, and it is
   the ONLY thing that bounds a taunted flee" — is retracted, 2026-09-17, the
   same day it was written.**

   `game_attacker` / `game_defender` are `_root.game.villain` / `_root.game.hero`
   and the swap (`+0x2b92`, `+0x2ba3`, `+0x2c08`, `+0x2c19`); the gladiators that
   MOVE are the clips `attacker` / `defender` = `_root.arena.gladiators.hero` /
   `.villain` (`+0x2b64`, `+0x2b7b`, `+0x2bda`, `+0x2bf1`). `_root.game.hero` and
   `_root.game.villain` are plain `new Object()`s (`root/frame:35`
   `DoAction@0x3ffdcf` `+0x07fc`/`+0x0814`, and again on the load path at
   `root/frame:84`), never placed on the display list and never given an `_x` by
   anything. Across the whole file those four comparisons are the ONLY reads of
   `game_*._x` and those four assignments the only writes — against 50 reads of
   `attacker._x` and 32 of `defender._x`. The property is self-sealingly
   undefined, both comparisons are false, and nothing would read the result if
   they fired.

   **The live clamp is a near-identical copy in `attacker.onEnterFrame`** (the
   anonymous function at `+0x36ae`), acting on the clips: `attacker._x` at
   `+0x38fd` / `+0x3988`, `defender._x` at `+0x3a13` / `+0x3a3f`. That is what
   bounds a walk, a run, a taunted flee and a knockback. It also nulls
   `destination` and calls `nextphase()` in the attacker arm, so **touching the
   arena wall ENDS the phase** — a consequence the dead copy could never have
   had. It is guarded on `knock_defender == null || undefined` at `+0x38ce`, and
   that guard is always open, because `knockback` declares `knock_defender` with
   **DefineLocal** (`+0x1e75`): the timeline variable the handler reads is never
   assigned, so the suspension the author evidently intended never happens.

   **How the error was made**, because it is a repeatable one: an earlier caveat
   said the bound lived in this document's prose with no byte offset, and it was
   retracted for a good reason — the decoder in use printed opcodes without
   their operands, so the literals looked absent. Finding them proved THE
   LITERALS. It did not prove the EFFECT, and nobody checked the receiver. A
   read-only wave of twelve agents checked it the next day.
2. Run `check_spells` for attacker, then defender.
3. Apply `staminaleft -= staminacost`.
4. Add `1 + round(stamina / 3)` stamina and `1 + ceil(stamina / 2)` hitpoints,
   then clamp.
5. If active, add `round(hitpointsmax / 4)` regeneration and
   `round(staminamax / 4)` boundless energy, then clamp.
6. Update and clamp crowd state, rerun `battlevalues` for both combatants, and
   advance/swap the three-phase `battle_action` cycle.

The rest decision first sets `staminacost = -round(stamina * 15)` and adds
`3 + ceil(stamina)` hitpoints plus `stamina` stamina; `nextphase` then applies
the baseline additions and cost accounting above.

## Battle result and reward callbacks

`death(whichcharacter, how_died)` in overlay frame 52 is the immediate combat
result boundary. It clears the status flags on both vanilla objects in the
byte-verified order frozen, burning, poison, life_stolen — the hero's group
first, then the villain's — followed by taunted1 (hero, villain) and
taunted2 (hero, villain), assigns the death sequence, then compares the
defeated clip with `arena.gladiators.villain` or `.hero`:

- defeated villain -> `this.gotoAndPlay("combatwon")` on the overlay controller;
- defeated hero -> `this.gotoAndPlay("combatlost")` on the overlay controller.

It then removes the attacker/defender `onEnterFrame` handlers and deletes
`nextphase`. Overlay frames 62 and 74 bridge those labels to
`_root.arena.gotoAndPlay("combat_won")` and `"combat_lost"`, respectively.
There is no generic team-result callback.

The root `arena` instance is sprite 2249. Its result timeline includes:

- exactly seven labels, confirmed with `--labels --timeline 'sprite:2249'` on
  334 declared frames: `initbattle` frame 1 (span 1–70), `combat` 71 (71–80),
  `combat_won` 81 (81–93), `combat_wonitem` 94 (94–188), `combat_delay` 189
  (189–221), `combat_exp` 222 (222–249), and `combat_lost` 250 (250–334);
- frame 88: attaches export 777, `fight_win_stuff`, and settles the win —
  gold, battle counters, and the branch below;
- frames 94–188 (`combat_wonitem`): the **tournament**-victory screen, not the
  ordinary one; frame 182 attaches the `won_tournament` linkage at depth
  100005 and the span stops at 188;
- frames 189–221 (`combat_delay`): animation only; frame 222 removes
  `won_tournament` and reveals `fight_win_stuff`; frame 231 awards experience
  and detects a level-up; frame 249 stops on the reward panel;
- frame 315: increments fights and losses, restores the hero, clears
  `battle_started`, sends tournament losses to game-over, or otherwise deducts
  `ceil(herolevel^2 * 50)` gold (clamped at zero) and displays
  `fight_over_lost` (character 2247);
- button 775 release handles final win, level-up, tournament, foyer/daybreak,
  and town-square transitions; button 778 is tournament-win progression;
- the non-tournament loss panel embeds button 2244, whose release returns the
  root timeline to the town square.

**Correction: the reward is not `ceil(herolevel^2 * 50)`.** An earlier revision
of this map recorded that figure as the fight reward. It is the **loss
deduction** — `goldlost = ceil(herolevel * herolevel * 50)`, clamped at zero,
computed on the loss frame 315 (`+0x041d`–`+0x046a`). The win reward is a
different formula on a different frame, and this map did not record it at all:

```text
_root.game.hero.goldpieces += round(_root.game.villain.character_xp
                    * (100 + _global.crowd_interest) / 100);  // 2249/frame:88 +0x078c..+0x07ff
if (_root.game.hero.herolevel == 1)                           // test +0x0867..+0x0889
    _root.game.hero.goldpieces = 2500;                        // flat SetMember +0x08ae
```

`character_xp` is a `battlevalues` derivation on the *defeated opponent*, not a
stored field, and `crowd_interest` is derived from `herolevel` at
`sprite:2224/frame:1` `+0x0f48` with a `RandomNumber(899)` opcode draw. Four
consequences worth stating.

The reward is a function of the **defeated** combatant's damage, enchantments,
armour and level, not of the winner's — though generated opponents are built at
the hero's own level, so in ordinary play the two track each other.

Because `crowd_interest` comes from the opcode rather than `randomBetween`,
**the win gold is neither recordable nor injectable** by a capture wrapper.

The level-1 override is a flat set, not an addition, and it is a set of the
**whole purse**: `+0x08ae` pushes the literal 2500 straight onto
`_root.game.hero.goldpieces`, discarding both the prior balance and the reward
the `+=` at `+0x079e` just added. `+0x0894` — a nearby offset easy to mistake
for the money write — sets only the `fight_win_stuff.goldwon` display string
("a gift from the emperor…"); the same field is given the computed-reward text
at `+0x0806`–`+0x0866` on the ordinary arm.

And `villain.character_xp` is read **frozen**. Its only writer is
`battlevalues` at `+0x3b82`, which sits inside that function's
`battle_started == true` skip (§Combatant state objects), so it still holds the
value derived when the opponent was generated — computed while
`armourclass == armourclass_max`. A fight that strips the loser's armour to
nothing pays the same gold as one that does not.

**Correction: an ordinary win skips frames 94–188.** This map previously
described frames 94/189/222/231 as a single run of "win item/reward/transition
processing". Frame 88 branches instead:

```text
if (_global.tournament_in_progress == true) {                 // +0x0925
    hero.tournament_ranking -= 1;                             // +0x094f
    if (hero.tournament_ranking == 1)                         // +0x0973..+0x0995
        gotoAndPlay("combatwonitem");                         // +0x099a  (inert, below)
    else gotoAndPlay("combat_delay");                          // +0x09b1
} else gotoAndPlay("combat_delay");                            // +0x09c7
```

So with `tournament_in_progress` true and the post-win `tournament_ranking`
reaching 1 it heads for the tournament screen, and in every other case —
including every non-tournament win — it goes straight to `combat_delay` at 189.
The label written on the tournament arm is `combatwonitem`, while the label
defined on sprite 2249 is `combat_wonitem`, so that `gotoAndPlay` matches
nothing and is inert; the playhead simply runs on from 88 into 94, which is
where it was going. A reconstruction must not "fix" that into a real jump.

All three of the above were first decoded in [the leveled-gladiator arena
route](ss2-arena-route.md) §4 and §7. They have since been **re-read here from
the same installed SWF and fingerprint** — the win `+=` and its operands, the
level-1 flat set, the `goldlost` deduction and its zero clamp
(`+0x047d`–`+0x04ec`), the frame-88 branch above, and the sprite-2249 label
spans — and every offset reproduced.

Team mode must declare victory only when a team has no living combatants, wait
for the final defeat animation, and invoke a one-shot result bridge. It must not
run vanilla win settlement after the first individual knockout.

## Stat points, the `levelup` panel, and what levelling can change

Byte-verified 2026-08-31. This section exists because the project has been
operating on the premise that **no path can change the hero's `attack` or
`defence` — not `-StageHero`, not the shop, not levelling.** The first two are
not settled here. **The third is false**, and the mechanism is below.

### The eight `+` buttons

Root frame **227** is the label `levelup` (span 227–234; the root label table
reproduces with `--labels --timeline '^root$'`). It places character **2265** at
depth 357. Sprite 2265 places exactly eight buttons, one per base stat:

| Depth | Button id | Stat incremented | `++` site |
| --- | --- | --- | --- |
| 8 | 1596 | `strength` | `+0x00ad` |
| 11 | 1600 | `speed` | `+0x00aa` |
| 14 | 1602 | **`attack`** | `+0x00ab` |
| 17 | 2252 | **`defence`** | `+0x00ac` |
| 20 | 2253 | `vitality` | `+0x00ad` |
| 23 | 1608 | `charisma` | `+0x00ad` |
| 26 | 2254 | `stamina` | `+0x00ac` |
| 47 | 2264 | `magicka` | `+0x00ac` |

Every one of the eight is a `DefineButton2` with a single condition record
(`condition:0`) and the same four-statement body, whose offsets differ only by
the one or two bytes the stat name costs in the constant pool: a
`_root.game.hero.statpoints > 0` guard (the `GetMember` at `+0x004a`–`+0x004c`,
the `If` that skips the body at `+0x005e`–`+0x0060`), a
`_root.clicksound.start()`, the `Increment` tabulated above, and a
`statpoints - 1` write-back closing on a `Subtract`/`SetMember` pair at
`+0x00e1`–`+0x00e4`. There is no per-stat cap, no cost curve, and no exclusion
for `attack` or `defence`: all eight stats cost one point each.

Grant sites for `statpoints` are equally plain. Root frame 227
`DoAction@0x6e776b` sets `_root.game.hero.statpoints = 4` at `+0x01b4`; the
max-level arm of `DoAction@0x6e7945` sets both `_root.game.hero.statpoints` and
the `_root.statpoints` display mirror to `4` at `+0x1cc2` and `+0x1cd3`. So a
level-up is worth **four** points, freely assignable, `attack` and `defence`
included.

The unnamed clip-action on the depth-357 placement
(`root/frame:227/instance:357/clip-action:0`) copies `statpoints` and each stat
from `_root.game.hero` up to `_root` for display (`+0x0081` onward). It is a
mirror, not a source.

### The commit button

Character **2283**, placed on root frame 227 at depth 409, is the panel's
continue control. Its `condition:0` body reads the `_root.statpoints` mirror at
`+0x0156`; while any point is unspent it only writes an `inspirato_text`
warning at `+0x016f`. Once none remain it runs, in order:

| Step | Offset |
| --- | --- |
| `_root.backup_char(_root.game.hero)` | `+0x0199` |
| `_root.clicksound2.start()` | `+0x01af` |
| `_root.hero.removeMovieClip()` | `+0x01d1` |
| `_root.restore_char(_root.game.hero)` | `+0x01f5` |
| `herolevel == 2` → `_global.day = 1`, `_global.time_of_day = 24`, `gotoAndPlay("daybreak")` | `+0x020e`, `+0x0229`, `+0x0234`, `+0x0245` |
| else `_global.tournament_in_progress == true` → `_root.backup_character(hero)`, `gotoAndPlay("foyer")` | `+0x0264`, `+0x0293`, `+0x029a` |
| else `gotoAndPlay("townsquare")` | `+0x02b3` |

`backup_char` and `restore_char` are both `DefineFunction2` in root frame 35
`DoAction@0x3fa9dc` (`+0x2d5a` and `+0x2ed7`), and **each ends by calling
`constructDNA`** — `+0x2ec5` and `+0x3050`. That is the persistence step.

### Why the spent points survive the per-turn re-skin

Overlay frame 1 re-runs `skincharacter(_root.game.hero, this.hero)` once per
turn, and `skincharacter` calls `initcharacter(whichcharacter, whichavatar,
whichcharacter.charDNA)` at `+0x1aa9` of root frame 35 `DoAction@0x40bf76`.
`initcharacter` rewrites the whole stat block from the DNA string by index:

| DNA index | Field | Assignment |
| --- | --- | --- |
| 16 | `strength` | `+0x0766` |
| 17 | `speed` | `+0x077d` |
| 18 | **`attack`** | `+0x0794` |
| 19 | **`defence`** | `+0x07ab` |
| 20 | `vitality` | `+0x07c2` |

So anything written straight onto `_root.game.hero` and not carried into
`charDNA` is discarded at the next re-skin — which is the byte reason a
battle-time `-StageHero` write does not survive. `constructDNA` closes exactly
that gap. It is a `DefineFunction2` at `+0x1b66` of the same block; it appends
the live `_root.game.hero` fields in the same order — `attack` read at `+0x1e1b`
and `defence` at `+0x1e36`, matching indices 18 and 19 — and assigns the
finished string to `_root.game.hero.charDNA` at `+0x2176`–`+0x2180`.

The round trip is therefore closed: **button → live field → `constructDNA` →
`charDNA` → `initcharacter` → live field.**

### How the panel is entered

`gotoAndPlay("levelup")` has exactly one site in the build:
`root/button:775/condition:2` `+0x059e`. Button 775 sits at depth 15 of sprite
**777**, the `fight_win_stuff` reward overlay. The handler branches first on the
panel's own `nextleveltext` state (`+0x0469`), then on a `game_mode` /
`herolevel < 12` demo chain (`+0x0483`–`+0x04d3`), then on `herolevel < 50`
(`+0x04eb`–`+0x04fb`). Inside that gate it sets `experience` to
`experienceneeded + 1` (`+0x0512`), increments `herolevel` (`+0x0548`), calls
`battlevalues` (`+0x0576`) and `constructDNA` (`+0x0588`), and only then jumps
to the label. The panel is reached from winning a bout, not from a debug route.

### The sibling panel on `createchar`

Sprite **1630**, placed at depth 107 on root frame **65** (`createchar`), is the
character-creation twin. It carries sixteen buttons at depths 9–70 — the same
eight `+` handlers reusing ids 1596, 1600, 1602, 1608 plus 1604 (`defence`),
1606 (`vitality`), 1610 (`stamina`) and 1628 (`magicka`), each paired with a
refund button (1599, 1601, 1603, 1605, 1607, 1609, 1611, 1629) that is the
mirror image: guard `<stat> > 1` (`GetMember` at `+0x004c`, `If` at `+0x005c`
for id 1599), `clicksound.start()`, `<stat> - 1`, then `statpoints++` at
`+0x00df`. **The floor is the stat, not the point pool** — a refund is refused
at 1, so no creation path can drive a base stat below 1. The
creation allowance is `9`: root frame 71 `DoAction@0x4189ab` writes it at
`+0x033f` and `+0x035c`, and `initwarrior` (root frame 35 `DoAction@0x3ffdcf`)
carries a two-armed branch writing `0` at `+0x0b1f` and `9` at `+0x0b41` — the
arm selection is not read out here. Sprite 2265 substitutes ids 2252,
2253, 2254 and 2264 for four of the eight, which is why an id-only search finds
twelve `+` buttons in the build rather than eight.

### The premise, answered

**It falls.** `attack` and `defence` are ordinary level-up stats: buttons 1602
and 2252, one point each, four points per level, persisted to `charDNA` by the
same `constructDNA` call that persists every other stat, and restored from DNA
indices 18 and 19 on every re-skin. Any statement that "no tool path can change
attack or defence, not even levelling" is wrong about the build.

### The reachability arithmetic, done (2026-08-31)

This section previously stopped here, saying the arithmetic for any particular
fixture was a separate calculation it had not done. It is done now, by
`tools/stat-vector-reachability.mjs`, which derives every distinct
`scenario.hero` in `test/fixtures/ss2-1v1/` from `battlevalues`' own formulas
and the progression budget. Run it rather than trusting the table below.

**The budget.** `heroDNA` seeds all eight stats at 1 (indices 16-22),
`initwarrior` grants `statpoints = 9` to a new gladiator and `0` when a
`charDNA` is restored, and each level-up grants exactly 4 that the commit
button will not release until all are spent. So a character at `herolevel` L
carries stats summing to **13 + 4L** — 17 at level 1 — none below 1, and after
creation they only ever increase. Every reachable vector is pinned by:

```text
stamina   = (staminamax - 100) / 10
vitality  = (hitpointsmax - herolevel * 10) / 20
speed     = (13 + 4 * herolevel) - (the pinned stats + stamina + vitality)
weapon    = the id whose [3]/[4] equal (min_damage - 2*strength, max_damage - 2*strength)
```

speed is the only free stat once the fixture and a herolevel are fixed, so
"which herolevels work" is a one-line search, not a search over allocations.

**The answer for the 22 fixtures this project wrote off as unbuildable: seven
of them are reachable and fifteen are not.**

| Hero vector | Fixtures | Verdict |
| --- | ---: | --- |
| `atk 1 def 1 str 10`, hp 30, stam 110 | 22 | level 1, all 9 creation points into strength, `weapon0`. The committed baseline. |
| `atk 1 def 1 str 10`, hp 300, stam 110 | 8 | **herolevel 4**, vitality 13, speed 1 — 12 of the 12 points won go to vitality. Also 6, 8, … |
| `atk 3 def 3 str 30`, hp 250, stam 150 | 5 | **herolevel 11**, vitality 7, speed 7, stamina 5, weapon **24** (hacking, gate `strength >= 12`). Also 13, 15, … 23. |
| `atk 3 def 2 str 7`, hp 40, stam 130 | 2 | **herolevel 2**, vitality 1, speed 3, stamina 3, weapon **41** (bashing, gate `strength >= 3`), `greaves 4` + `boot 4` = 20. |
| `atk 11 def 11 str 5 cha 5`, hp 60, stam 100 | 15 | **Unreachable.** Three grounds, below. |
| spell family (magicka only) | ~~7~~ **8** | No `attack`/`defence` pinned; every `staminamax` derives. |

**Why the `attack 11 / defence 11` family cannot be built, in decreasing order
of how much it would take to overturn:**

1. **The weapon row does not exist, and this ground is absolute.**
   `min_damage 12 / max_damage 20` at `strength 5` requires a weapon whose
   `[3]/[4]` are `(2,10)`. None of the build's 90 weapon ids — 80 shop, plus
   `weapon0` and the nine off-shop — carries that pair. `grievous-knockback`
   needs the same `(2,10)` at `strength 9`, which is why it belongs to this
   family however its strength/damage signature reads. `battlevalues` derives
   `min_damage` from the weapon id on every call, so this holds for a created
   hero, a DNA-built one and a staged one alike: a staged `min_damage` is
   overwritten at the next phase transition.
2. **The point budget cannot cover the vector.** `hitpointsmax 60` admits only
   `(L 2, vitality 2)` and `(L 4, vitality 1)`, budgets of 21 and 29. The
   pinned stats alone — `attack 11 + defence 11 + strength 5 + charisma 5`, plus
   `magicka` at its floor because these fixtures omit it — need **33** before
   vitality, stamina or speed get anything.
3. **`staminamax 100` needs `stamina 0`**, below the created-gladiator floor.
   This one is NOT absolute and the distinction matters: the tutorial prisoner's
   `unleash_hell` literal carries `stamina 0`, and his `staminamax 100` is a
   value the promoted goldens measured. A DNA-built character clears this ground
   and still fails the first two.

**What this changes about the capture plan.** ~~The champion family needs a
gladiator at herolevel 11 holding weapon 24, which costs 4542 against a
`goldpieces` start of 2500 — so it needs won purses, not just won bouts.~~
► **CORRECTED 2026-09-07: the plan moved and the purchase is not needed.** The
committed `run-arena.ps1` reaches the champion vector by STAGING — `herolevel 5`,
`vitality 10`, and `weapon:24` as a **table id, not a purchase** — and it has
been run: `session-champ-n1` (2026-08-31) carries `hero.weapon=24` in the
`applied` string of every `{"at":"staged"}` line. The arithmetic above is still
correct for the *purchase* route; that route is simply no longer the plan. The
duel pair needs herolevel 2 and weapon 41 at 1714, which the starting purse
covers outright. The 15 unreachable fixtures are not a capture problem at all;
they are 15 fixtures asserting a weapon that is not in the game, and belong with
the other contradicted scalars.

► **CORRECTION, same day, and the error was mine.** This paragraph first said the
duel pair "is the cheapest unbuilt family in the corpus and should be captured
first." **That is wrong, and an adversarial pass caught it.** It ranked families
by the gold a hero costs to build from scratch and never asked which heroes are
ALREADY BUILT. Three independent grounds, each checked:

1. **The armoured family's hero already exists.** That family (8 fixtures) needs
   `L=4, vitality 13`, `weapon0`, no armour — and the committed snapshot
   `level4-vitality-tournament-gate` is a level-4 gladiator with vitality 13.
   `4*10 + 13*20 = 300`, exactly its `hitpointsmax`. Marginal cost: **zero gold,
   zero levels, no purchase.** The duel pair needs a NEW gladiator on a specific
   creation vector.
2. **The 1714 is weapon-only.** Both duel fixtures also pin `greaves 4` and
   `boot 4` (`armourclass_max` 20), which is unbudgeted armour on top.
3. **The duel vector needs a WRAPPER change.** The wrapper spends all four
   level-up points into `vitality` by policy; `attack 3 / defence 2` is
   unreachable under it, so capturing the pair means editing the wrapper and
   re-running `validate-vehicle.ps1`.

And a fourth reason not to lead with it: `candidate-duel-firstblood-normal-kill`
carries `provenance.kind: "transcribed-observation"` from `obs-20260830-e1`. It is
one of the five transcriptions, so the promotion gate refuses its own source
record as evidence — putting it first points a supervised window at a fixture
that cannot promote from the record it was copied from.

**The armoured family is the cheapest real evidence available.** Reachability
arithmetic ranks what is BUILDABLE; it does not rank what is CHEAP, because it
cannot see the snapshots. Do not read a "reachable" verdict from
`tools/stat-vector-reachability.mjs` as a capture priority — cross it against
the snapshot list in `HANDOFF.md` first.

**Two assumptions worth naming.** `initwarrior` has a two-armed branch writing
`0` at `+0x0b1f` and `9` at `+0x0b41`; the arm selection has not been read
out, and the budget above assumes the 9-arm for a new gladiator — which the
committed prisoner vector independently satisfies at sum 17. And the entry
handler on button 775 carries a `game_mode`/`herolevel < 12` demo chain whose
effect on progression past level 12 has not been read out; herolevel 11 is the
champion family's lowest solution and the only one below that boundary, which
is a reason to prefer it rather than a demonstration that the others fail.

## UI and movie-clip map

| Symbol/instance | ID/context | Role |
| --- | --- | --- |
| `arena` | character 2249, root frame 221 | battle scene/result timeline |
| `hero_battle` | export 1241 | fighter and shadow linkage used for both sides |
| `overlay` | export 862 | turn controller, actions, formulas, spell/status logic |
| `combat_panel` | export 751 | health/stamina/armour/potion/action panel |
| `inventory_overlay` | export 492 | battle inventory UI |
| `cast_spell_image` | export 120 | spell notification/icon |
| `damage_icon` | export 817 | damage splat container |
| `fight_win_stuff` | export 777 | reward/victory overlay |
| `hero`, `villain` | `_root.arena.gladiators` | runtime fighter clips |
| `hero_shadow`, `villain_shadow` | `_root.arena.gladiators` | synchronized shadow clips |
| `hero_potion`, `villain_potion` | combat-panel instances | health potion controls |
| `hero_stamina_potion`, `villain_stamina_potion` | combat-panel instances | stamina potion controls |
| `hero_armour`, `villain_armour` | combat-panel instances | armour display |

Key fighter animation labels on export 1241 are `Standing` (frame 2), movement
and charge (33–104), `Block` (118/179), attack directions 1–12 (190–360),
defence directions 1–12 (395–553), `Defend20` (572), death variants
(585–1083), hurt variants (1144–1362), `rest` (1380), `knockback` (1428),
`taunt`/`taunted` (1482/1512), `bombard` (1567), `snipe` (1590),
`psyche_up` (1609), condition effects (1911–2004), yield/cast frames
(2072–2126), and spell transformations (2147–2200). Animation labels are UI
effects, not authoritative state transitions.

**A LABEL IS NOT A CLIP: SEVEN OF THE 101 RUN ON PAST THEIR OWN SPAN (derived
2026-09-16 from the frame actions, reproducible with
`tools/clip-sequences.mjs`).** In AVM1 a `gotoAndPlay("x")` runs FORWARD from
`x`'s frame until an action stops it or jumps away. The paragraph above lists
the labels; it does not say where playback stops, and for seven of them it
stops later than the next label:

| entry | span | runs to | ending | runs on into |
| --- | --- | --- | --- | --- |
| `initialize` | 1 | 32 | `GotoLabel Standing` | `Standing` (then endless) |
| `Hurt8` | 1250–1265 | 1283 | `Stop` | `Hurt9` |
| `celebrate1` | 1400–1408 | 1426 | `GotoLabel celebrate1a` | `celebrate1a` (then endless) |
| `knockback` | 1428–1433 | 1446 | `Stop` | `knockback_mov` |
| `psyche_up` | 1609–1617 | 1626 | `Stop`, `struck = true` | `psyche_charging` |
| `psyche_up2` | 1627–1635 | 1643 | `Stop`, `struck = true` | `psyche_charging2` |
| `burning` | 1947–1948 | 1963 | `gotoAndPlay("Standing")`, `struck = true` | `flame_repeat` ×2 |

So `defender_hurt` with `attack_direction` 8 plays **34 frames** where direction
9 plays 18; `damagecharacter`'s knockback plays **19** and not the 13 of
`knockback_mov` alone; a first psych-up charge is **18 frames** and a second
**17**. The burn is a counted cycle: frame 1947 sets `this.burncycle = 1` and
frame 1963 — **the only conditional in the whole 2222-frame clip** — reads
`if (burncycle >= 2) { struck = true; gotoAndPlay("Standing") } else
{ burncycle++; gotoAndPlay("flame_repeat") }`, so the body runs twice, 2 + 15 +
15 frames. The repeat count of 2 is read by hand from those two sites; the tool
flags the run as looping and does not evaluate the counter.

Three things make this easy to get wrong, and each cost a wrong table:

- **A self-loop terminates the run.** `Standing`, `StepBack`, `StepForward`,
  `BlockForward`, `RunBack`, `RunForward` and `celebrate1a` end with
  `GotoLabel(<self>) | Play`. Counting those as run-ons joins `Standing` to
  three gaits and a charge.
- **The receiver decides.** Almost every animation frame opens by driving the
  face — `head.eyes.gotoAndPlay("blink")` on 1609 and 1627,
  `head.eyes.gotoAndPlay("Angry")` and `head.mouth.gotoAndPlay("Scared")` on
  1644. Same opcode, same method name, a child clip. A decoder that does not
  resolve the receiver ends every label's run at its own first frame.
- **`Hurt8` may be an authoring slip rather than a design.** Every one of the
  thirteen hurt labels is preceded by a `Stop` on the immediately preceding
  frame except `Hurt9`. The other six run-ons are entry-stub-plus-body pairs.
  The build plays 34 frames for direction 8 either way.

~~`this.struck = true` is written at 1626, 1643, 1656 and 1963~~ **Of the 38
frames that write `this.struck = true`, the four that matter here are 1626,
1643, 1656 and 1963** *(corrected 2026-09-22: the old wording read as the
complete list, and a write-nothing verifier sweeping every `"struck"` reference
in sprite 1241 found 38 — 37 closing a `Stop`-ended run, plus 1963)* — the END
of a run rather than the end of the named clip — so the `attacker.struck`
report-back the psyche counter waits on (`+0x6761`) fires after `psyche_charging` has
played, and a burn hands back after its second flame pass. Frame 1608, which
ends `snipe`, sets `this.fired = false` instead.

**`psyche_charging` AND `psyche_charging2` ARE ALSO A HELD STANCE, dispatched
with `gotoAndStop`.** `changeCombatants` resets both fighters with
`gotoAndPlay("Standing")` (`+0x27db`, `+0x27ef`) and then poses whichever holds
a charge — `+0x281e`
`if (game_attacker.psyche_up == 2) attacker.gotoAndStop("psyche_charging")`,
`+0x284d` the same at 3 for `psyche_charging2`, and `+0x287c` / `+0x28ab` for
the defender. A gladiator holding a charge therefore STANDS in the charged pose
instead of `Standing`, and the counter values line up: after one press it is 2,
after two it is 3. This is a different mechanism from a run — a persistent pose
between actions, not one performance within one.

`changeCombatants` runs **about four times a turn, not once**: `+0x317e` at top
level of the frame-52 script (every entry to `heroactions`), `+0x3638` inside
`nextphase`'s `battle_action < 3` arm (every phase advance) and `+0x365f` at the
`battle_action == 3` turn end. `battle_action` is the PHASE selector, not a turn
counter.

**THE CHARGED POSE IS NOT THE ONLY HELD FIGHTER POSE — it is the only one that
survives a turn boundary, and the distinction is the interesting part.** ~~86 of
the fighter clip's frame scripts end in `this.struck = true; Stop`~~ **86
distinct run-ends in the fighter clip end in `Stop`, and only 37 of them carry
`this.struck = true`** *(corrected 2026-09-22 by a write-nothing verifier over
the clip's 101-label run table and every `"struck"` reference in sprite 1241:
the clip writes `struck` at 38 frames in all, the 38th being 1963, the burn's
exit, which ends in `gotoAndPlay("Standing")`; NO `Hurt`, `Defend`, `Death`,
`Yield`, `knockback`, `knockback_mov`, `taunted`, `bombard` or `snipe` run
writes it)* and only 7 spans self-loop, so **the figure parks on the terminal
frame of nearly every action it plays** — every attack, defence, hurt, cast,
taunt and rest — until the next `changeCombatants`, ~~which `nextphase` gates
on `demand_move >= 60` enter-frames, about two seconds at 30 fps~~ **which
comes ONE enter-frame after a clip that reports, not two seconds** *(marked
here 2026-09-22; re-derived 2026-09-17 in `HANDOFF.md`'s living head, the "SIX
VERIFIERS ON THE STANCE" entry: an arm calls `nextphase()` on its own
`attacker.struck == true` test — e.g. `+0x510f`, `+0x53a2` — and `demand_move
>= 60` is a STALL WATCHDOG for animations that never report)*. The charged
pose differs in being re-asserted from PERSISTENT STATE rather than being
wherever the playhead happened to stop. Two consequences worth naming:

- **The same charged state has two held frames.** The `psyche_up` action runs on
  and stops at 1626, the charging clip's LAST frame; `changeCombatants` then
  re-asserts 1618, its FIRST. Which one is showing depends on when you look.
- **A surviving winner loops `celebrate1a` forever.** Overlay frame 65
  (`combatwon`) runs `hero.gotoAndPlay("celebrate1")` and frame 77 the same on
  `villain`; `celebrate1` has no `Stop`, runs into `celebrate1a`, which
  self-loops at 1426, and the overlay then stops. The corpse pose is held
  forever too, from `whichcharacter.deathsequence` at frame 62/74.

**The non-combat freezes are on a DIFFERENT CLIP.** `villain.gotoAndStop("standing")`
and `hero.gotoAndStop("Portrait")` target sprite 711 `[hero]` — labels
`Standing` 1-20, `Portrait` 21, `championpose` 22, `chained` 23-76,
`chained_lookup` 77-91, `unchained` 92-104, `overlay` 105 — not the arena's
sprite 1241 `[hero_battle]`. `championpose` is not a fighter-clip label at all.

**And the counter is INITIALISED, which retires a map silence.** Sprite 2249's
frame 1 is labelled `initbattle`, and `DoAction@0x6e421b` `+0x0bc9`-`+0x0bf1`
runs `_root.game.hero.psyche_up = _root.game.villain.psyche_up = 1` (a
`StoreRegister`/double-`SetMember` chained assignment) in the same block that
places both fighters at `_x -320 / _y 122`. `psyche_up` appears in exactly six
action blocks in the whole SWF — overlay frame 52, the four controller frames,
and this one — so **there is no other initialisation site and the value is
never undefined at battle time.** See `MAP_SILENCE`'s `psyche-up-initialisation`
entry, now narrowed to the between-battles persistent object alone.

**`knockback_mov` has exactly one dispatch site of its own**, `+0x7c5e` in
`attacker.onEnterFrame`, immediately after ~~`cast_spell_icon(attacker, 39, 2)`~~
**`cast_spell_icon(attacker, 39)`** *(corrected 2026-09-22 by a write-nothing
verifier re-reading `+0x7c46`–`+0x7c5c`: the 2 is the argument COUNT pushed for
`CallFunction`, not an argument)* — a spell path, the `cast_command` arm.
`damagecharacter`'s two sites (`+0x1b4f`, `+0x1bc0`) name `"knockback"`, **and
so does a third that is not `damagecharacter`'s** *(added 2026-09-22)*:
`defender.gotoAndPlay("knockback")` at `+0x7b78`, unconditional inside the
`cast_gale` arm (§"The `cast_gale` phase, in full"). Running off the end of
`knockback` is how all three reach `knockback_mov`.

The panel and timeline are hard-coded for two sides. The 2v2/3v3 adapter needs
a slot layout and per-combatant widgets; it cannot safely clone variables named
only hero/villain and expect the original callbacks to target the right unit.

## Collection launcher and mod-loading route

The Collection shell is AVM2 and embeds these relevant names:

- base prefix `swf/` and mod prefix `swf/mods/`;
- `GAME_SS2` -> `swords_sandals2_download`;
- `gameLoader`, `gameSWFBridge`, `prepareGame`, `setupAS2Connections`, and
  `gameLoadedComplete`;
- fixed SS2 mod stems:
  `ss2_champion_rush/swords_sandals2_download`,
  `ss2_extended/swords_sandals2_download`,
  `ss2_neomatons/swords_sandals2_download`, and
  `ss2_olis_mod/swords_sandals2_olis_mod`.

The installed folders and SWF names match that table. Evidence supports a
fixed menu/path registry, not automatic discovery of arbitrary directories.
Therefore dropping a new folder under `swf/mods` is not expected to add a menu
entry. A future integration must either add an independently authored launcher
entry/patch or stage against a known slot, and must do so outside the installed
tree until an explicit deployment step is approved.

## Foundation gaps exposed by the map

The current deterministic engine deliberately omits SS2-specific state. Before
claiming 1v1 parity, the adapter/rules layer needs:

- equipment identity and every armour piece, ammunition, stamina, magicka, and
  spell/item identity in canonical state;
- status duration/tick semantics and the precise action-to-animation phase;
- an injectable, versioned RNG whose call order covers all authoritative rolls;
- result events and a one-shot completion bridge after animation acknowledgement;
- rules/build identity in snapshots and golden fixtures;
- deep-copy/rehydration guarantees for wire state.

Do not replace `classicStyleRules` with partially reconstructed formulas. Keep
it explicitly provisional until a golden harness compares vanilla 1v1 and the
adapter with controlled samples.

## Golden-harness checkpoint

The asset-free [1v1 golden harness](ss2-golden-harness.md) now supplies the
fingerprint-keyed candidate schema, strict ordered `randomBetween` and
`RandomNumber` tape, isolated physical-attack reconstruction, and one-shot
result bridge. It does not change `classicStyleRules`, and its static candidates
do not yet count as vanilla parity.

**~~Twenty-two~~ Twenty-three goldens are promoted** as of 2026-09-02 — and the
23rd, `golden-armoured-deflection-threshold-cleared`, is the **first that is not
from the staged tutorial fight** (it is a tournament-mode armoured capture, from
`obs-onx1405-a1` / `obs-onx1521-a1`, commit `2341789`). Run
`ls test/fixtures/ss2-1v1-golden/*.json | wc -l` rather than reading this
number. The other twenty-two are all from the one staged tutorial fight: twelve kills covering all twelve melee directions
(`golden-prisoner-quick-kill-dir1..4`, `golden-prisoner-normal-kill*` at 5–8,
`golden-prisoner-power-kill-dir9..12` — all three bands now complete; an earlier
revision of this section said eighteen and "the quick band has no kill golden
yet", which the quick-band campaign has since overtaken) and ten
`golden-probe-*` in five pairs. The probes are
the reason four claims in this map moved from static reading to measurement:
the dispatcher's `>=` hit comparison and each melee band's `rollneeded`
(§Attack roll dispatcher), the inclusive critical-deflection boundary (same
section), and the `> 66` removal gate with its draw-before-the-equipped-test
ordering (§Spell-path reuse of `attack_direction`). Each pair moves one
injected value and is predicted to separate in a channel the capture genuinely
observes; the staging behind them is in
[the capture staging guide](ss2-capture-staging.md).

## Next checkpoint

The controlled capture, verification, and promotion pipeline for these steps
is specified in [the runtime-capture workflow](ss2-runtime-capture.md).

1. Observe the boundary, miss, armour overflow/equality, status, critical, and
   result candidates in controlled licensed 1v1 runs.
2. Finish unresolved spell/status duration and action-to-animation ordering.
3. Promote exact repeated observations to runtime goldens and correct any
   divergent candidates.
4. Add canonical SS2 equipment/status state and an event/UI adapter while
   preserving the generic 1–3 combatant engine.
5. Render two static ally slots using a `clipByCombatantId` registry, then move
   through 2v2 AI to 2v2 and 3v3 cooperative campaign support as tracked in the
   [roadmap](../roadmap.md).

## Reproduce the read-only inventory

With Node available and `$ss2Install` pointing to the Collection directory:

```powershell
$ss2Install = 'C:\Program Files (x86)\Steam\steamapps\common\Swords and Sandals Classic Collection'
node tools/inspect-swf.mjs "$ss2Install\swf\swords_sandals2_download.swf"
node tools/inspect-swf.mjs "$ss2Install\swf\swords_sandals2_download.swf" --function '^attack_chances$' --max-actions 900
node tools/inspect-swf.mjs "$ss2Install\swf\swords_sandals2_download.swf" --references 'fight_over_win|fight_over_lost|combatwon|combatlost'
```

The inspector also supports `--function-names`, `--references`, `--around`, and
`--labels [regex]` with an optional `--timeline <regex>`. The label tables in
this map are reproduced with:

```powershell
node tools/inspect-swf.mjs "$ss2Install\swf\swords_sandals2_download.swf" --labels --timeline 'sprite:862'
node tools/inspect-swf.mjs "$ss2Install\swf\swords_sandals2_download.swf" --labels --timeline 'sprite:2249'
node tools/inspect-swf.mjs "$ss2Install\swf\swords_sandals2_download.swf" --labels --timeline '^root$'
```

The 2026-08-31 stamina and stat-point sections reproduce with:

```powershell
node tools/inspect-swf.mjs "$ss2Install\swf\swords_sandals2_download.swf" --references 'staminaleft' --max-actions 200
node tools/inspect-swf.mjs "$ss2Install\swf\swords_sandals2_download.swf" --references 'staminacost' --max-actions 200
node tools/inspect-swf.mjs "$ss2Install\swf\swords_sandals2_download.swf" --references 'statpoints' --max-actions 400
node tools/inspect-swf.mjs "$ss2Install\swf\swords_sandals2_download.swf" --references 'charDNA|constructDNA|backup_char' --max-actions 80
```

**One method gap, stated rather than hidden.** Everything above reproduces with
the project inspector except the *placement* table in §Stat points — which
button character sits at which depth of sprite 2265 and sprite 1630, and that
sprite 2265 is what root frame 227 places at depth 357. The inspector records a
`PlaceObject2`/`PlaceObject3` only when it carries a name or class name
(`parsePlaceObject`, `if (name || className)`), and these placements carry
neither, so `--references` and `--labels` cannot show them. That grouping was
read directly from the tag stream. The button *bodies* and the stat each one
increments are fully covered by `--references 'statpoints'`, so the substantive
claim does not depend on the gap; the depth ordering does. A `--places` mode on
the inspector would close it.

These commands print analysis only; do not redirect decompiled game
code or assets into the repository.
