/**
 * THE COMBAT PROPS — the build's own arrow, its trail, its blood and its
 * sparks, out of the player's own install and into gitignored `assets/props/`.
 *
 * ## Why this is a third extractor rather than an option on one of the two
 *
 * `extract-figure.mjs` cuts a clip at its `FrameLabel` tags, because the
 * fighter's 2,222 frames are 101 NAMED animations and the name is the join with
 * everything else in this repository. `extract-wardrobe.mjs` takes frame 1 of
 * each of 387 exports, because a wardrobe piece is a static item.
 *
 * **A prop is neither, and the arrow proves it: `bullet` carries no
 * `FrameLabel` at all.** The build reaches its frames by number —
 * `bullet.gotoAndStop(game_attacker.secondary_weapon - 60)` (`+0x6dd4`) — so
 * frame N is not a moment in an animation, it is **a lookup keyed on which bow
 * loosed it**. `extract-figure.mjs` says so plainly when pointed at it: *"Clip
 * 47 carries no FrameLabel tags, so it has no named animations."* That is the
 * correct answer, and it is why this file exists rather than a `--frames` flag
 * that would have made the figure extractor mean two things.
 *
 * So: every frame of a named export, indexed by number, and the caller decides
 * what the number means.
 *
 * ## What was found by extracting it, and it is not what the map implies
 *
 * ► **THE BUILD HAS FIVE ARROWS FOR TWENTY BOWS.** `bullet` declares 50 frames;
 *   they resolve to exactly **five distinct shapes** — characters 42, 43, 44,
 *   45, 46 on frames 1-5 — and **every frame from 6 to 50 draws shape 46
 *   again**. The ranged band is ids 61-80 and the lookup is `id - 60`, so bows
 *   61-65 each have their own arrow and bows 66-80 all share one.
 *
 *   Nothing in the corpus said this. It reads from the `gotoAndStop` as though
 *   there were twenty arts, and there are five.
 *
 * ► **EVERY FILTER THIS PACK CAN DRAW IS ON AN ENCLOSING SPRITE — AND THE TWO
 *   THAT ARE NOT ARE REFUSED BY NAME, WHICH IS NOT THE SAME AS ABSENT.** This
 *   tool used to read the matrix, the colour transform and the mask off each
 *   drawable and drop `filters`, `blendMode` and `ancestorEffects` — all three
 *   of which `flattenFrame` returns — so the arena page reported *"props: NO
 *   filter data in the pack"* and was right. Carrying them measures: **0 of the
 *   ~~3,345~~ 3,574 placements this tool EMITS carries a filter or a blend mode
 *   of its own**, while ~~3,209~~ 3,258 of them sit inside one of **~~363~~ 366
 *   effect groups holding ~~570~~ 573 filters** (~~150~~ 151 colourMatrix, 208
 *   blur, ~~212~~ 214 glow) and one blend mode.
 *
 *   **CORRECTED 2026-09-24: THE STRUCK NUMBERS ARE THE 12-PROP PACK'S.** The
 *   three spell props joined after they were measured — `lightning_bolt_combat`
 *   and `fireball_combat` on 2026-09-22, `boulder_combat` on 2026-09-23 — and
 *   their CLOCKS are placements this tool emits too: 3,356 in `frames` and 218
 *   in `clock.framesByParent` (the bolt 36, the fireball 91, the boulder 91).
 *   Of the 3,258 grouped, 3,212 are in `frames` and 46 in the clocks (the bolt
 *   2 + 24 under its two glow groups, the boulder 1 + 22 under its one
 *   colourMatrix), which is the manifest's `placementsUnderAGroup` — it counts
 *   the clocks as this tool does. Still 0 own, clocks included. Re-derived from
 *   the player's own pack by walking every placement in `frames` and in each
 *   clock and every `effectGroups` record; the same walk with the three spell
 *   props left out gives every struck number exactly.
 *
 *   ~~*and that zero is the whole finding*~~ — **IT WAS NOT, AND SAYING SO
 *   COST THIS FILE ITS HEADLINE.** A verifier re-derived it and found the zero
 *   was produced by a `continue`, not by the build: the flatten returns **3,436
 *   drawables, of which exactly 2 are `unsupported`, and BOTH of those carry
 *   their own glow** (`panel` frame 1, the two `DefineEditText` children 1527
 *   and 1528: colour 0,0,0,255, blurX/blurY 1.5, strength 10, 1 pass). They
 *   were dropped above `ownEffectsOf` and counted nowhere, so the build's ONLY
 *   two own-filtered placements were 100% of what the measurement could not
 *   see. `0 own` is now printed beside `2 refused with an unsupported
 *   drawable`, and `notCarried.unsupportedDrawableFilters` holds the 2. A zero
 *   meaning "none exist" and a zero meaning "I dropped them before looking"
 *   must never look the same again.
 *
 *   (**Dated 2026-09-24: 3,436 is the 12-PROP pack's flatten** — its 3,345
 *   emitted placements, these 2, and the sky's 89 masks, one on each of frames
 *   112-200, which sum to it exactly. It is not re-counted here: masks are not
 *   emitted as placements (each rides as a `clip` on the placement it cuts:
 *   89 clip records, one per sky frame 112-200), and this correction did not
 *   run the flatten. Since
 *   2026-09-22 a morph also comes back `unsupported` and is BAKED rather than
 *   refused — 38 placements in `fireball_combat` and `boulder_combat` — so read
 *   "2 unsupported" as "2 refused". The refused are still exactly these two:
 *   they are the manifest's only two `failures`.)
 *
 *   **The own/inherited difference is still the point, and it is not
 *   bookkeeping.** The groups are stored ONCE each and the leaves point at them
 *   by index. A filter on a sprite applies to the
 *   group; stamping the sky's blur onto each of the 200 leaves inside it would
 *   blur each cloud separately and apply its colour matrix two hundred times
 *   where the build applies it once — a picture that is wrong in a way that
 *   looks deliberate. An ancestor's blur on a leaf is worse than a dropped one.
 *
 * ► **AND THE SKY'S COLOUR MATRIX IS TWEENED, which is why the groups are not
 *   seven.** `sky` has 7 enclosing sprites and 362 group RECORDS, because
 *   `cloud_patterns` and its neighbours carry a colour matrix whose twenty
 *   cells change frame by frame — 79 distinct matrices on character 1680 alone,
 *   climbing from `0.381, 0.228, 0.391 … -58` at frame 1 to `0.544, 0.402,
 *   0.054 … -79` at frame 200. That IS the day/night cycle. A census that
 *   ignores the filter's NUMBERS reports 7 groups and 10 filters on the sky and
 *   reads as a tidy answer; this session wrote that census first and it was
 *   wrong by **52x** (362 records against 7), which is the reason the dedupe
 *   key below is the whole record. The measured table for every key is at
 *   `inheritedEffectsFor`, because that is where a maintainer changes it.
 *
 * ► **AND `bullet_trail`'s FRAME NUMBER WAS DECLARED AS THE WRONG THING, which
 *   is the same class of mistake one level up.** Its entry read
 *   `indexedBy: "secondary_weapon - 60"` under a docstring quoting
 *   `trail.bullet.gotoAndStop(secondary_weapon - 60)` — and `trail.bullet` is a
 *   CHILD of the trail, not the trail. Sprite 48 has **seven** frames, each
 *   placing character 47 under the instance name `bullet` at alpha 0.699,
 *   0.582, 0.465, 0.352, 0.234, 0.117, 0. The frame is the puff's AGE. Seven
 *   slots could never have addressed twenty bows, and `src/render/props.js`
 *   trusted the field and drew NO trail for 14 of 20 of them. The arrow inside
 *   the puff is now measured into `nestedLookup` by re-flattening — 50 frames,
 *   the same five arrows — rather than frozen at frame 1 and unremarked.
 *
 * ## The rule every extractor here obeys
 *
 * **Assets come out of the player's own install and never into the repository.**
 * `assets/` is gitignored AND `test/asset-attestation.test.js` fails if
 * anything under it is tracked — two lines of defence, because the ignore rule
 * alone has already failed once. Doom/WAD model: clone this repo and you still
 * need your own licensed copy.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { parseShape, shapeToPaths } from "./swf-shapes.mjs";
import { indexCharacters, resolveTimeline, flattenFrame } from "./swf-display-list.mjs";
// The morph parser `extract-figure.mjs` and `extract-screens.mjs` already bake
// with. Imported rather than copied: a morph read two ways is two chances to
// pair the edge streams differently.
import { parseMorphShape, morphShapeAt, morphToPaths, ratioOf } from "./swf-morph-shapes.mjs";
// THE READER, IMPORTED SO THE INVOICE IS THE READER'S OWN VERDICT. What this
// pack can say about a filter is exactly what `canvasFilterFor` does with it —
// applied, deferred to `applyColourMatrix`, measured no-op, or refused by name.
// A second opinion computed here would be a second thing to drift, and
// `tools/extract-figure.mjs` already imports from this module for the same
// reason. It costs this tool nothing: `src/render/` has no DOM and no canvas.
import { blendModeFor, canvasFilterFor, summariseFilterUse } from "../src/render/filters.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The same default every other tool that reads the build uses. */
const DEFAULT_SWF =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";

/** The oracle's sha256. Recorded and REPORTED — never enforced. */
const ORACLE_SHA256 = "77cb545c2061ab41246251467a4edf5926ab6fd1ddd95dc9527d7ba9c45bb8ca";

const TWIPS_PER_PIXEL = 20;

/**
 * THE PROPS THIS TOOL TAKES, by the build's own linkage name.
 *
 * ► **A CLOSED LIST RATHER THAN A PATTERN, and that is the same decision
 *   `UNMAPPED_CLIP_LABELS` records.** The build exports 502 names; 387 are the
 *   wardrobe and ~60 more are UI, screens, spell effects and the AS2 runtime.
 *   A pattern that swept them all would extract a `saving_movie` and a
 *   `charsheet` nothing can use and call it coverage. Each entry here names
 *   what reads it, and an entry with no reader does not belong.
 */
export const PROP_EXPORTS = Object.freeze([
  {
    linkage: "bullet",
    /** `bullet.gotoAndStop(secondary_weapon - 60)` (`+0x6dd4`). */
    indexedBy: "secondary_weapon - 60",
    reader: "src/render/projectile.js — the arrow in flight"
  },
  {
    /**
     * ► **THIS ENTRY'S `indexedBy` WAS WRONG, AND THE DOCSTRING BESIDE IT
     *   QUOTED THE BYTES THAT SAY SO.** It used to read
     *   ~~`indexedBy: "secondary_weapon - 60"`~~ under the note
     *   `trail.bullet.gotoAndStop(secondary_weapon - 60)` (`+0x7255`) — and
     *   **`trail.bullet` is a CHILD of the trail, not the trail**. Seven slots
     *   could never have addressed twenty bows.
     *
     *   Re-derived from the display list on the oracle, which is stronger
     *   evidence than the AS2 line and does not need an interpreter: sprite 48
     *   has **seven frames, and every one of them places character 47 at depth
     *   1 under the instance name `bullet`**, blend mode 5 (`lighten`), with
     *   `alphaMultiplier` running **0.699, 0.582, 0.465, 0.352, 0.234, 0.117,
     *   0**. That is a monotonic fade to nothing: the frame is the puff's AGE,
     *   played from 1 each time `bulletcounter >= 3` attaches one (`+0x71aa`).
     *   The WEAPON picks the arrow drawing carried INSIDE the puff, on char 47
     *   — which is `bullet` itself, the same fifty-frame lookup.
     *
     *   Reproduce: resolve character 48's timeline and print each frame's
     *   placements; the name, the character id and the alpha ramp are all
     *   there. `tools/extract-icons.mjs` already spells this shape three times
     *   (*"the SPELL is chosen on the nested strip"*), so the house style for
     *   "my frame is time and the variant is a child's" predates this fix.
     *
     * ► **THE COST OF THE WRONG FIELD WAS REAL.** `src/render/props.js`
     *   trusted it and indexed the seven-frame fade with the weapon's art
     *   frame, clamped: bows 67-80 all landed on frame 7, whose placement
     *   carries `alphaMultiplier: 0`, so the arena drew NO trail at all for 14
     *   of 20 bows.
     */
    linkage: "bullet_trail",
    indexedBy: "frame, as the puff's AGE — a seven-step alpha fade played from 1; the ARROW is chosen on the nested `bullet` child",
    /**
     * THE LOOKUP THIS PROP'S OWN FRAMES DO NOT HOLD, declared so the extractor
     * measures it instead of freezing it silently.
     *
     * `flattenFrame` stops every nested sprite on frame 1, which is right for
     * scenery and wrong here: the puff's arrow is a fifty-frame lookup and
     * frame 1 is bow 61's. Without this block the pack says "one shape, seven
     * alphas" and a reader has no way to learn that the shape is a variable.
     */
    nested: {
      instance: "bullet",
      character: 47,
      indexedBy: "secondary_weapon - 60",
      reader: "src/render/projectile.js — the arrow carried inside the puff"
    },
    reader: "src/render/projectile.js — one puff every third frame"
  },
  {
    linkage: "blood",
    indexedBy: "frame, as an animation",
    reader: "unread today; the death morphs already carry the fighter's own blood"
  },
  {
    linkage: "sparks",
    indexedBy: "frame, as an animation",
    reader: "unread today"
  },
  {
    /**
     * ► **THE BOLT A CAST ATTACHES AT THE VICTIM — added 2026-09-22, two days
     *   after the verbs that attach it.** The bolt phase runs
     *   `bolt = arena.gladiators.attachMovie("lightning_bolt_combat", ...,
     *   {_x: defender._x, _y: 50})` at `+0x852a`, then
     *   `bolt.gotoAndStop(lightning_frame)` at `+0x85c2`, and removes it when
     *   the victim's hurt clip reports back (`+0x85ed`).
     *
     *   Measured on the oracle: character 12, **two frames** — frame 1 is the
     *   child alone and carries `stop()`; frame 2 moves the child and ADDS
     *   shape 11 at depth 4 — so the frame IS the spell. The child, sprite 10,
     *   is **twelve frames of flicker with no `Stop`**: shapes 6, 7, 8 three
     *   frames each, then 9. It loops while the bolt is up, which is why it is
     *   a `clock` and not a `nested` lookup.
     */
    linkage: "lightning_bolt_combat",
    indexedBy: "frame: 1 is cast_lightning_bolt, 2 is cast_frightning_bolt (`bolt.gotoAndStop(lightning_frame)`, `+0x85c2`)",
    clock: {
      character: 10,
      indexedBy: "the bolt's AGE in frames; sprite 10 has no Stop and loops its twelve frames while the bolt is attached",
      reader: "src/render/props.js — boltOpsFor, the flicker"
    },
    reader: "src/render/props.js — boltOpsFor, the bolt a cast attaches at the victim's x"
  },
  {
    /**
     * ► **THE FIREBALL A CAST LAUNCHES — added 2026-09-22 with the three
     *   fireball verbs.** The arm runs `bullet = arena.gladiators.attachMovie(
     *   "fireball_combat", "fireball_combat45000", 45000)` (`+0x9231`-`+0x9262`),
     *   then `bullet.gotondStop(fireball_frame)` (`+0x9276`) — a TYPO in the
     *   build, a method that does not exist — and on impact
     *   `bullet.gotoAndStop(4)` (`+0x91cd`).
     *
     *   Measured on the oracle (main session, read-only): character 28, **four
     *   frames**. Frame 1 runs `stop()` and places sprite 14 (one static
     *   shape), so ALL THREE spells fly showing frame 1; frames 2 and 3 (sprites
     *   16, 18) are never shown; frame 4 runs `stop()` and places sprite 27, a
     *   **23-frame explosion with no `Stop` of its own until its last frame,
     *   which runs `_parent.removeMovieClip()`** — so it is a `clock`, the
     *   explosion's AGE, and not a nested lookup.
     */
    linkage: "fireball_combat",
    indexedBy: "frame: 1 in flight for every spell (the build's `gotondStop` typo never applies `fireball_frame`), 4 from impact (`bullet.gotoAndStop(4)`, `+0x91cd`)",
    clock: {
      character: 27,
      indexedBy: "the explosion's AGE in frames on parent frame 4; sprite 27's last frame removes the fireball",
      reader: "src/render/props.js — fireballOpsFor, the explosion"
    },
    reader: "src/render/props.js — fireballOpsFor, the fireball in flight"
  },
  {
    /**
     * ► **MOLTEN DEATH'S BOULDER — added 2026-09-23, a day after the verb that
     *   drops it**, when a Codex review found the arena drawing an INVENTED
     *   landing because this pack had no rock. The arm runs
     *   `boulder = arena.gladiators.attachMovie("boulder_combat", ...)` once
     *   per boulder (`+0x870f`) and, when one lands, `gotoAndStop(4)`
     *   (`+0x88c0`).
     *
     *   Sprite 33, **four frames, a `Stop` on frame 1 (`DoAction@0xcb53`) and
     *   on frame 4 (`DoAction@0xcb6d`) and nothing else in its frame scripts**
     *   — the main session's reading of the oracle. So the rock falls showing
     *   frame 1, frames 2 and 3 are never shown, and frame 4 is the landing.
     *
     * ► **THE CLOCK IS DISCOVERED, NOT DECLARED, AND THAT IS AN ADMISSION.**
     *   The bolt and the fireball name their clock child because somebody read
     *   which sprite their frame places. Nobody writing this entry read sprite
     *   33's frame 4 — the install was off limits to that agent — so it names
     *   the FRAME, and `extractProps` looks for the one animated sprite placed
     *   there (at any depth of nesting), walks it as the clock if there is
     *   exactly one, refuses by name if there are several, and writes what it
     *   found into `clockDiscovery` either way. Once the child is read, naming
     *   it as `character` here is the better declaration.
     *
     * ► **WHAT THIS CANNOT CARRY: HOW LONG THE LANDING LASTS.** That is the
     *   landing child's own frame scripts — a `Stop`, a loop, or a
     *   `_parent.removeMovieClip()` like the fireball's explosion — and this
     *   tool reads display lists, not actions. See `BOULDER_LANDED_FRAMES` in
     *   `src/render/props.js`.
     *
     * ► **DATED 2026-09-24: THE CHILD IS READ NOW, BY THIS TOOL, AND THE
     *   LANDING'S LENGTH BY THE MAIN SESSION.** The player's own pack records
     *   `clockDiscovery.byFrame` as `[[], [], [], [27]]`: frames 1-3 place no
     *   animated sprite and frame 4 places exactly one, character 27 — the same
     *   23-frame sprite `fireball_combat`'s clock walks. The length was read
     *   from the actions on 2026-09-23 and is recorded in the docstring of
     *   `BOULDER_LANDED_FRAMES`, which stays `null` because
     *   `boulderLandedFramesFor` already derives 22 from the pack's 23-frame
     *   clock; that action reading is cited, not re-derived here. The entry still names the FRAME: declaring
     *   `character: 27` would drop `clockDiscovery` from the pack, which is a
     *   change to the extraction and not to this comment.
     */
    linkage: "boulder_combat",
    indexedBy: "frame: 1 while the rock falls (its own Stop), 4 from the landing (`gotoAndStop(4)`, `+0x88c0`); 2 and 3 are never shown",
    clock: {
      discoverOnFrame: 4,
      indexedBy: "the landing's AGE in frames on parent frame 4 — whichever animated sprite frame 4 places; its own scripts, which this tool does not read, decide whether it holds, loops or removes the rock",
      reader: "src/render/props.js — boulderOpsFor, the landing"
    },
    reader: "src/render/props.js — boulderOpsFor, molten death's rock"
  },
  {
    /**
     * ► **THE ARENA'S EDGES, and they are the only scenery the build attaches.**
     *   Root frame 221 puts one `rockMC` at each end of the ground:
     *
     *   ```text
     *     rockLeft._x  = -2160     rockRight._x = 2160
     *     both        ._y  =   210
     *     arena.gladiators is at (0, 0)
     *   ```
     *
     *   **They sit just outside the walk clamp.** `SS2_ARENA.clamp` is ±2100 —
     *   derived from `nextphase` step 1 long before anybody looked at the
     *   scenery — and the rocks are at ±2160, sixty units further out. So the
     *   build marks the edge of the ground a gladiator can reach with a rock at
     *   each end, and two independent derivations agree about where the arena
     *   stops.
     *
     *   `_y` 210 against the fighters' 200 puts them ten units NEARER the
     *   viewer, which is a depth cue rather than a mistake.
     */
    linkage: "rockMC",
    indexedBy: "frame 1; the build never advances it",
    reader: "tools/arena/main.js — the arena's two edges"
  },
  {
    /**
     * ► **THE ARENA SCREEN'S BACKDROP, and it is EXACTLY THE STAGE.** Root
     *   frame 221 places character 643 at depth 1, `(0, 0)`, unscaled, and it
     *   measures **640 x 420 px** — the SWF's declared `FrameSize` RECT, to the
     *   pixel. So this is the sky and ground the whole fight happens against.
     */
    character: 643,
    name: "backdrop",
    framesWanted: 1,
    indexedBy: "frame 1; it has only one",
    reader: "src/render/arena-backdrop.js — the stage-locked backdrop layer"
  },
  {
    /**
     * ► **CHARACTER 1729 IS THE `sky`, AND THIS ENTRY USED TO CALL IT THE
     *   CROWD.** Root frame 221 places it at depth 3 under the instance name
     *   `sky`, scaled 1.04 — the only scaled placement on the frame. The build
     *   names it three independent ways: the `PlaceObject2` name, `_root.sky`
     *   in `day_night_cycle` (root frame 35), and its own child sprite
     *   `cloud_patterns` (char 1690). **The real crowd is character 2112**,
     *   which is a different clip in a different coordinate space.
     *
     * ► **AND ITS 200 FRAMES ARE A LOOKUP, NOT AN ANIMATION** — the same shape
     *   as `bullet`'s. `_root.sky.gotoAndStop(time_of_day)` (`+0x0d33`), and
     *   `_root.sky.cacheAsBitmap = true` immediately after, which a clip that
     *   played could not be. The old entry said "frame 1 of 200; the rest is
     *   its animation" and was wrong on both halves.
     *
     * ► **AND `time_of_day` IS A CLOCK, NOT A DIE ROLL — I HAD THAT WRONG
     *   TOO.** `_global.time_of_day = 1 + random(23)` is only where it STARTS.
     *   `day_night_cycle` runs on a 1500ms `setInterval` (`+0x0a9d`) and, while
     *   a battle is on, does `if (time_of_day < 200 && special_event_happening
     *   != true) { time_of_day++; townsquare.gotoAndStop(time_of_day);
     *   sky.gotoAndStop(time_of_day); }` (`+0x0bd0`..`+0x0c44`). A new day
     *   resets it to 25 (`+0x0a50`). **So the whole 1..200 range is reachable,
     *   and the sky moves while you fight.**
     *
     *   That matters because it nearly cost the masks: I had read the bound as
     *   1..23, noticed every masked frame was 112..200, and was one sentence
     *   from recording "the masks are unreachable, so this is not a defect."
     *   **Frames 112-200 are the night**, and dropping their masks dropped the
     *   moon's glow on 89 of 200 frames.
     */
    character: 1729,
    name: "sky",
    indexedBy: "time_of_day, a CLOCK that starts at 1 + random(23) and climbs to 200",
    reader: "src/render/arena-backdrop.js — the stage-locked sky layer"
  },
  {
    /**
     * ► **THE GROUND, and it is INSIDE the arena clip** — sprite 2249 depth 1,
     *   instance `sand`, at arena-local `(-323.95, -56.75)`. Its own art spans
     *   local y -56.75..256.2, which is the range that decides how far back a
     *   rank may stand before it is off the painted sand.
     *
     * ► **SIX FRAMES, ONE PER ARENA.** `sand.gotoAndStop(current_arena)`
     *   (`+0x0d0f`). So the game has six grounds, not one, and taking frame 1
     *   would ship a sixth of what was measured.
     */
    character: 673,
    name: "sand",
    indexedBy: "current_arena, 1..6",
    reader: "src/render/arena-backdrop.js — the ground, in the arena's own space"
  },
  {
    /**
     * ► **THE ACTUAL CROWD: character 2112**, sprite 2249 depth 3, instance
     *   `crowd`, at arena-local `(1.05, -110.50)`. Eight tiled stands (char
     *   1774 at half scale) and three animated crowd blocks (char 2098).
     *
     * ► **`crowd.gotoAndStop(current_arena)`** (`+0x0c99`) — six again, and the
     *   same index as the sand, so a renderer picks one arena and both agree.
     *
     * ► **IT IS THE ONE PIECE OF SCENERY THE CAMERA MOVES**: `combatscale` ends
     *   `crowd._y = -200 + ceil(zoomscale)` (`+0x0ab1`), so the stands rise as
     *   the camera pulls back.
     */
    character: 2112,
    name: "crowd",
    indexedBy: "current_arena, 1..6",
    reader: "src/render/arena-backdrop.js — the stands, and the build's one parallax"
  },
  {
    /**
     * ► **THE WEATHER, AND ITS FIRST NINE FRAMES ARE EMPTY.** Root frame 221
     *   depth 80, instance `rain`. Frames 1-9 place nothing at all; 10-17 carry
     *   characters 1812-1815. **A `framesWanted: 1` entry here would emit an
     *   empty prop and look like a failed read** — which is exactly what the
     *   first version of the arena-screen table assumed it was.
     */
    character: 1816,
    name: "rain",
    indexedBy: "frame; 1-9 are empty and 10-17 carry the weather",
    reader: "src/render/arena-backdrop.js — the stage-locked weather layer"
  },
  {
    /**
     * ► **THE BOTTOM UI BAR**, root frame 221 depth 438, instance
     *   `fiz_info_panel`, 641 x 26.55 px at `(-0.5, 401)` — so it hangs five
     *   pixels below the stage. It carries two `DefineEditText` children, which
     *   are REPORTED as unsupported rather than dropped; this renderer draws
     *   its own text over the bar.
     */
    character: 1531,
    name: "panel",
    framesWanted: 1,
    indexedBy: "frame 1",
    reader: "src/render/arena-backdrop.js — the UI bar, painted over the fighters"
  },
  {
    /**
     * ► **THE ORNAMENTAL FRAME**, root frame 221 depth 1193 — the highest depth
     *   on the screen, so it paints over everything including the arrows. 732 x
     *   505 px at `(-25.55, -33)`: larger than the 640 x 420 stage on every
     *   side, which is what lets it frame the picture rather than sit inside it.
     */
    character: 646,
    name: "border",
    framesWanted: 1,
    indexedBy: "frame 1",
    reader: "src/render/arena-backdrop.js — the frame, painted last"
  }
]);

/**
 * ► **CHARACTER 2249, THE ARENA CLIP, IS DELIBERATELY NOT DECLARED, AND IT
 *   USED TO BE.** Taking it whole gave one FUSED frame: the sand and the crowd
 *   flattened into nine placements with no way to tell them apart, plus the
 *   `about_fight_mov` text field that showed up as this tool's only failure.
 *   That is strictly worse than taking `sand` and `crowd` separately, because
 *   **the camera moves one of them and not the other** — `crowd._y` tracks the
 *   zoom and the sand does not — and a fused blob cannot express that. It also
 *   lost the six arenas, since the fused frame 1 is arena 1 of 6.
 *
 *   The arena clip's other 333 frames are `combat_won`, `combat_lost`,
 *   `combat_exp` and the intro — bout STATES, a different asset and a different
 *   question from the ground a fight happens on.
 */

export class ExtractPropsError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

export function parseArguments(argv) {
  const options = { file: null, out: path.join(REPO_ROOT, "assets", "props"), report: false };
  const rest = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") {
      const next = argv[index + 1];
      if (typeof next !== "string" || next.startsWith("--")) {
        throw new ExtractPropsError("--out needs a directory path.");
      }
      options.out = next;
      index += 1;
    } else if (value === "--report") {
      options.report = true;
    } else if (value.startsWith("--")) {
      throw new ExtractPropsError(`Unknown option ${value}.`);
    } else {
      rest.push(value);
    }
  }
  options.file = rest[0] ?? DEFAULT_SWF;
  return options;
}

const px = (twips) => Math.round((twips / TWIPS_PER_PIXEL) * 100) / 100;

/**
 * The same rounding `extract-wardrobe.mjs` uses, and deliberately the same
 * numbers: a matrix is `{a, b, c, d, tx, ty}` from the display list and reaches
 * JSON as a six-element array, scale terms to 5 places and translations to 1.
 * Duplicated rather than imported so this file stays
 * runnable on its own, which is the convention every tool here follows.
 *
 * ► **THE TRANSLATIONS ARE TWIPS AND THIS COMMENT USED TO SAY THEY WERE
 *   PIXELS.** `readMatrix` leaves `tx`/`ty` in twips and `composeMatrix` keeps
 *   them there, deliberately, because composing in twips is exact; only the
 *   path data and the bounds go through `px()`. A consumer must divide by 20.
 *   Latent until now because every prop declared here had an identity matrix
 *   with a zero translation — the arena screen is the first with real offsets.
 *
 * ► **`-0` IS NORMALISED TO `0`.** It round-trips through JSON as `-0` and
 *   compares unequal under `Object.is`, which is how a byte-identical
 *   re-extraction can look like a changed one.
 */
function roundMatrix(matrix) {
  const r = (value, places) => {
    const factor = 10 ** places;
    const rounded = Math.round(value * factor) / factor;
    return Object.is(rounded, -0) ? 0 : rounded;
  };
  return [r(matrix.a, 5), r(matrix.b, 5), r(matrix.c, 5), r(matrix.d, 5), r(matrix.tx, 1), r(matrix.ty, 1)];
}

/**
 * COUNT SOMETHING THIS EXTRACTION COULD NOT CARRY, BY NAME.
 *
 * Every drop in this file goes through here, so `notCarried` in the manifest is
 * the complete list of what the pack knows about and does not say — which is
 * the only version of dropping this project allows.
 *
 * ► **THAT SENTENCE WAS FALSE WHEN IT WAS WRITTEN, AND IT IS THE REASON
 *   `refusedEffectsOf` EXISTS.** Two drops went round it: the `unsupported`
 *   and mask skips in the placement loop discarded a drawable whole, own
 *   filters and all, and reported only the KIND — `frame 1 carries text
 *   (character 1527)`, with no mention of the glow on it. `panel`'s invoice
 *   said `notCarried: {}` for the one prop in the build that lost something.
 *   The claim holds again only because those two skips now invoice what they
 *   throw away; if you add a third skip, it goes through here or the sentence
 *   goes back to being a lie.
 */
function refuse(notCarried, kind, howMany = 1) {
  notCarried[kind] = (notCarried[kind] ?? 0) + howMany;
}

/**
 * ONE PLACEMENT'S OWN EFFECTS — its own, and on no account its ancestors'.
 *
 * ► **MEASURED ON THE ORACLE, AND IT IS THE REASON THIS FUNCTION IS SEPARATE
 *   FROM THE ONE BELOW: ZERO of the ~~3,345~~ 3,574 placements this tool EMITS
 *   carries a filter or a blend mode of its own.** Every effect this pack can
 *   draw lives on an ENCLOSING SPRITE. So a fix that spread `drawable.filters`
 *   onto the placement and stopped there would write an empty object ~~3,345~~
 *   3,574 times and report success, and the arena would still have no filter
 *   data. (**Corrected 2026-09-24**: 3,345 was the 12-prop pack's; 3,574 is
 *   3,356 in `frames` and 218 in the spell props' clocks — see the header.)
 *
 * ► **WHAT THAT ZERO IS NOT.** ~~*Every effect in the props pack lives on an
 *   enclosing sprite — 7 groups, 10 filters, 1 blend mode. Reproduce with
 *   `--report`: the line reads `0 own` and it is not a rounding of something
 *   small.*~~ **Both halves of that were wrong and the second one was the
 *   dangerous half.**
 *
 *   - The counts were a SKY-ONLY census under a key that ignores a filter's
 *     numbers. The pack holds **~~363~~ 366 groups and ~~570~~ 573 filters**
 *     (corrected 2026-09-24: +2 glow groups on `lightning_bolt_combat`, +1
 *     colourMatrix group on `boulder_combat`); see `inheritedEffectsFor` for
 *     the whole table. One blend mode is right.
 *   - `--report` reading `0 own` proved nothing about the build, because the
 *     sweep ran only over drawables that survived the `unsupported` skip
 *     upstream — and the build's **only two own-filtered placements are exactly
 *     the two that skip removes**: `panel` frame 1's `DefineEditText` children
 *     1527 and 1528, each carrying its own glow. 3,436 drawables (the 12-prop
 *     pack's flatten; dated in the header), 2 refused as unsupported, 2
 *     own-filtered, and the intersection is both of them. The
 *     number could not have come back non-zero for any input in this build.
 *
 *   `refusedEffectsOf` now invoices those two where they are dropped, `--report`
 *   prints the refusal on the same line as the zero, and
 *   `effects.own.dropped` carries it per prop. The code path here is kept
 *   because it is one spread and because a modded build in a second install
 *   lane is where it fires first — but a reader who sees "filters are carried
 *   now" must be able to find BOTH numbers in one look.
 *
 * `hasFilters` with an EMPTY list is a real distinction and is refused by name
 * rather than written as `filters: []`: a `PlaceObject3` can carry a filter
 * list of count zero, which means "this instance has had its filters cleared",
 * not "nobody asked".
 */
function ownEffectsOf(drawable, notCarried) {
  const effects = {};
  const filters = Array.isArray(drawable.filters) && drawable.filters.length > 0 ? drawable.filters : null;
  if (filters) {
    effects.filters = filters;
    // Carried, and flagged: `parseFilterList` marks the three filter kinds that
    // occur ZERO times in the shipped build, so a record with this flag reached
    // a code path no capture has ever exercised.
    for (const filter of filters) if (filter.measured === false) refuse(notCarried, "unmeasuredFilterRecord");
  } else if (drawable.hasFilters) {
    refuse(notCarried, "emptyFilterList");
  }
  if (drawable.blendMode !== undefined && drawable.blendMode !== null) effects.blendMode = drawable.blendMode;
  return effects;
}

/**
 * THE OWN EFFECTS ON A DRAWABLE THIS TOOL IS ABOUT TO THROW AWAY, INVOICED
 * WHERE THE THROWING AWAY HAPPENS.
 *
 * ► **THIS IS THE DEFECT THAT ATE THIS FILE'S HEADLINE, so it is worth saying
 *   plainly.** The placement loop skips two kinds of drawable — one that is
 *   `unsupported` (a `DefineEditText`, a button; ~~a morph~~ — a morph is
 *   BAKED since 2026-09-22 and skipped only when it will not parse or sits
 *   under a mask this tool cannot resolve, see `bakeMorph`) and a mask that
 *   could not be resolved. Both skips reported the KIND into `failures` and said
 *   nothing about effects, which was survivable right up until somebody counted
 *   own filters across the build, got `0`, and published it. The build has
 *   exactly two own-filtered placements and they are exactly two of these
 *   skips, so the sweep measured its own skip list.
 *
 * ► **IT REFUSES RATHER THAN CARRIES, AND THAT IS NOT A DODGE.** A skipped
 *   drawable has no geometry in this pack — `panel`'s two are edit-text fields
 *   this renderer draws itself — so there is nothing for the glow to sit on.
 *   What is owed is a number with a name, not a placement: `--report` prints it
 *   on the same line as the zero, and a reader can no longer confuse "none
 *   exist" with "I dropped them before looking".
 *
 * Returns a one-line reason suffix for the `failures` entry, so the human-
 * readable list names the loss too — `failures` used to say `carries text
 * (character 1527)` about a drawable that was also carrying a glow.
 */
function refusedEffectsOf(drawable, refusedOwn, notCarried) {
  const filters = Array.isArray(drawable.filters) && drawable.filters.length > 0 ? drawable.filters : null;
  const blend = drawable.blendMode !== undefined && drawable.blendMode !== null ? drawable.blendMode : null;
  if (filters) {
    refusedOwn.filterLists.push(filters);
    refuse(notCarried, "unsupportedDrawableFilters", filters.length);
  } else if (drawable.hasFilters) {
    // The same distinction `ownEffectsOf` draws, on a drawable that is leaving:
    // a CLEARED filter list is a fact about the instance, and losing it
    // silently alongside the drawable would make it look like nobody asked.
    refuse(notCarried, "unsupportedDrawableEmptyFilterList");
  }
  if (blend !== null) {
    refusedOwn.blendModes.push(blend);
    refuse(notCarried, "unsupportedDrawableBlendMode");
  }
  const parts = [];
  if (filters) parts.push(`${filters.length} own ${filters.map((filter) => filter.type).join("+")}`);
  else if (drawable.hasFilters) parts.push("an own filter list of COUNT ZERO");
  if (blend !== null) parts.push(`own blend mode ${blend}`);
  return parts.length ? `, dropping ${parts.join(" and ")}` : "";
}

/**
 * A LOOKUP THIS PROP'S FRAMES DO NOT HOLD, BECAUSE IT BELONGS TO A NESTED CLIP
 * — measured by re-flattening, never declared from the map.
 *
 * ► **WHY THIS EXISTS: A PROP'S FRAME NUMBER IS NOT ALWAYS ITS ONLY INDEX.**
 *   `flattenFrame` stops every nested sprite on frame 1, which is what the
 *   scenery wants. `bullet_trail` is the counter-example and it is the one the
 *   arena draws: its seven frames are the puff's AGE, and the ARROW inside it
 *   is character 47 — `bullet` itself, a fifty-frame lookup on
 *   `secondary_weapon - 60`. Frozen at frame 1, the pack says "seven alphas of
 *   ONE shape", and it is bow 61's shape for all twenty bows.
 *
 * ► **IT IS MEASURED AND IT CAN FAIL.** `spriteFrames` is `flattenFrame`'s own
 *   option for stopping a nested sprite elsewhere, so this re-flattens every
 *   frame of the prop against every frame of the child and CHECKS that the only
 *   thing that moved is one shape id. Anything else — a matrix that shifts, a
 *   placement that appears, two slots moving at once — and this refuses by name
 *   and emits nothing, because a lookup table that is right for most bows is
 *   worse than no table. Measured on the oracle: `bullet_trail` x `bullet`
 *   passes, and the fifty frames resolve to the same five arrows 42, 43, 44,
 *   45, 46 that `bullet`'s own extraction finds, at the same identity matrix.
 *
 * ► **WHY A TABLE AND NOT 350 MORE PLACEMENTS.** The substitution is exact and
 *   one-dimensional, so seven frames plus a fifty-long shape table says
 *   everything 350 emitted placements would, and leaves `frames` the shape
 *   every existing reader already indexes. The renderer's join is: take frame
 *   `age`, replace shape `replaces` with `shapeByFrame[index - 1]`.
 */
/**
 * EVERY ANIMATED SPRITE ONE FRAME PLACES, at any depth of nesting, as sorted
 * character ids — the search behind a clock declared by FRAME
 * (`clock.discoverOnFrame`, `boulder_combat`).
 *
 * "Animated" is more than one frame. It looks INSIDE each sprite it meets on
 * that sprite's frame 1, because that is the frame `flattenFrame` draws a
 * nested sprite on, so a clock wrapped in a one-frame container is still
 * found. A sprite already visited is not re-entered, and the depth is capped as
 * `flattenFrame` caps its own recursion. It reads display lists only: whether
 * a found sprite loops, holds or removes its parent is in its ACTIONS, which
 * this tool does not read.
 */
function animatedSpritesIn(buffer, characters, displayList, depth = 0, seen = new Set()) {
  const found = new Set();
  for (const entry of displayList) {
    const character = characters.get(entry.characterId);
    if (!character || character.kind !== "sprite") continue;
    if (character.frames > 1) found.add(entry.characterId);
    if (depth >= 8 || seen.has(entry.characterId)) continue;
    seen.add(entry.characterId);
    const inner = resolveTimeline(buffer, character, { frames: [1] }).frames[0] ?? [];
    for (const nested of animatedSpritesIn(buffer, characters, inner, depth + 1, seen)) found.add(nested);
  }
  return [...found].sort((left, right) => left - right);
}

function nestedLookupFor(buffer, characters, resolved, frameCount, declared, cache, notCarried) {
  const child = characters.get(declared.character);
  if (!child || child.kind !== "sprite") {
    refuse(notCarried, "nestedLookupCharacterMissing");
    return null;
  }
  // Everything about a drawable EXCEPT which shape it is. If any of this moves
  // when the child's frame moves, the substitution is not one-dimensional and
  // a shape table would be a lie about the other fields.
  const signature = (drawables) => drawables.map((drawable) => JSON.stringify({
    unsupported: drawable.unsupported ?? null, isMask: drawable.isMask ?? false,
    matrix: drawable.matrix, colour: drawable.colourTransform, path: drawable.path,
    blendMode: drawable.blendMode ?? null, filters: drawable.filters ?? null
  }));
  const flattenAt = (displayList, nestedFrame) => flattenFrame(buffer, characters, displayList, {
    cache, resolveMasks: true, spriteFrames: { [declared.character]: nestedFrame }
  });

  // The prop's own frames as this tool already emits them — child on frame 1.
  const bases = [];
  try {
    for (let index = 0; index < frameCount; index += 1) {
      const displayList = resolved.frames[index];
      if (!displayList) { bases.push(null); continue; }
      const drawables = flattenAt(displayList, 1);
      bases.push({ shapes: drawables.map((drawable) => drawable.characterId), sig: signature(drawables) });
    }
  } catch (error) {
    refuse(notCarried, "nestedLookupUnflattenable");
    return null;
  }
  const slots = new Set(bases.filter(Boolean).flatMap((base) => base.shapes));
  if (slots.size !== 1) {
    // More than one distinct shape in the prop means "the shape that moved"
    // is ambiguous. Refused rather than guessed: a table that is right for
    // most bows is worse than no table.
    refuse(notCarried, "nestedLookupSlotNotUnique");
    return null;
  }
  const replaces = [...slots][0];

  const table = [];
  for (let nestedFrame = 1; nestedFrame <= child.frames; nestedFrame += 1) {
    let moved = null;
    for (let index = 0; index < frameCount; index += 1) {
      const displayList = resolved.frames[index];
      if (!displayList) continue;
      const base = bases[index];
      let drawables;
      try {
        drawables = flattenAt(displayList, nestedFrame);
      } catch (error) {
        refuse(notCarried, "nestedLookupUnflattenable");
        return null;
      }
      const sig = signature(drawables);
      if (sig.length !== base.sig.length || sig.some((value, at) => value !== base.sig[at])) {
        refuse(notCarried, "nestedLookupMovesMoreThanAShape");
        return null;
      }
      const shapes = drawables.map((drawable) => drawable.characterId);
      const distinct = new Set(shapes);
      if (distinct.size !== 1) {
        refuse(notCarried, "nestedLookupSlotNotUnique");
        return null;
      }
      const next = [...distinct][0];
      // Every frame of the prop must resolve the child's frame N to the SAME
      // shape, or the table has two answers for one index.
      if (moved !== null && moved !== next) {
        refuse(notCarried, "nestedLookupSlotNotUniform");
        return null;
      }
      moved = next;
    }
    if (moved === null) {
      refuse(notCarried, "nestedLookupNothingToSubstitute");
      return null;
    }
    table.push(moved);
  }

  return {
    instance: declared.instance,
    character: declared.character,
    indexedBy: declared.indexedBy,
    reader: declared.reader,
    frameCount: child.frames,
    // The shape every emitted placement of this prop holds, and therefore the
    // one a renderer swaps out. Named rather than assumed, so a pack whose
    // frame 1 art changes cannot quietly redirect the substitution.
    replaces,
    // ► **THE SAME FINDING `bullet` MAKES, FROM THE TRAIL'S SIDE.** Fifty slots
    //   and five distinct arrows: bows 61-65 each have their own and 66-80 all
    //   share one. A table whose distinct count equals its length would be the
    //   surprise here, not this.
    distinctShapes: new Set(table).size,
    shapeByFrame: table
  };
}

/**
 * THE EFFECT GROUPS A PLACEMENT SITS INSIDE, as indices into the prop's own
 * `effectGroups` list, OUTERMOST FIRST — or `null` when it sits inside none.
 *
 * ► **NOTHING IN THE SHIPPED BUILD CAN TELL THAT ORDER FROM ITS REVERSE, AND
 *   THIS COMMENT USED TO STATE IT AS THOUGH MEASURED.** Every one of the
 *   ~~3,209~~ 3,258 chains here has length 1 and every one of the ~~363~~ 366
 *   group paths has length 1 (corrected 2026-09-24: the spell props added 49
 *   chains, 46 of them in their clocks, and 3 groups, all one deep — re-measured over every
 *   placement's `inheritedEffects`, clocks included, and every
 *   `effectGroups[].path`), so reversing the loop below changes nothing about
 *   this pack. It is a
 *   guarantee to the RENDERER, not a finding about the game: a caller that
 *   nests buffers composites the outermost group first. It is pinned by a
 *   fixture that nests two filtered sprites (`test/extract-props.test.js`,
 *   "A TWO-DEEP CHAIN"), because a guarantee no input can violate is a
 *   guarantee nothing is checking.
 *
 * ► **A FILTER ON A SPRITE IS NOT A FILTER ON THE LEAF, and writing it onto the
 *   leaf would be worse than dropping it.** The sky's `cloud_patterns` carries
 *   one blur and one colour matrix over its whole group; stamping them onto
 *   each of the 200 leaves would blur each cloud separately and apply the
 *   matrix 200 times where the build applies it once. So the group is stored
 *   ONCE, the leaves point at it, and a renderer that can composite to a buffer
 *   draws what the build draws — while one that cannot at least knows what it
 *   is not doing.
 *
 * ► **THE DEDUPE KEY IS THE WHOLE RECORD AND IT USED TO BE THE PATH, which
 *   loses the moon.** `summariseDrawables` in `tools/swf-display-list.mjs`
 *   dedupes ancestor groups by `group.path.join("/")` alone. That is right for
 *   ONE frame, where a path is unique — and wrong the moment a caller
 *   accumulates across frames, which is what this loop does. Measured on the
 *   oracle: `sky` has TWO different groups at depth 3, character 1692 on frames
 *   25-110 and character 1728 on frames 112-200, and keying on the path alone
 *   silently merges them and drops the second one's glow and blur — frames
 *   112-200 being the night, and character 1728 being the moon.
 *
 * ► **AND HERE IS WHAT EACH KEY ACTUALLY COUNTS.** This docstring used to end
 *   ~~*"7 groups and 10 filters by the whole record; 6 and 8 by the path"*~~,
 *   which named the wrong key for the big number: **7/10 is not the whole
 *   record, it is the discredited small census** the header calls wrong by 52x,
 *   and it is SKY-ONLY. Re-derived from a pack written by this file
 *   (`--out <scratch> --report`, then count `props[*].effectGroups` under each
 *   key):
 *
 *   ```text
 *     key                       sky            whole pack: 12 props -> 15
 *     path                      6 groups /  8    7 /   8  ->   9 groups / 10 filters
 *     path + character          7 / 10           8 /  10  ->  10 / 12
 *     path + filter types       7 / 10           8 /  10  ->  10 / 12
 *     THE WHOLE RECORD        362 / 570        363 / 570  -> 366 / 573   <- what this writes
 *   ```
 *
 *   (**The 15-prop column added 2026-09-24**; the 12-prop column is as first
 *   measured. Recomputed from the player's own pack's `effectGroups`, per prop:
 *   a coarser key's distinct values over the distinct whole records are its
 *   distinct values over every occurrence, and `effectGroups` is in
 *   first-occurrence order, so the filters counted are the first occurrence's.
 *   The same recount over the old twelve gives the 12-prop column exactly. The
 *   spell props add the bolt's two glow groups — one path, one character — and
 *   the boulder's one colourMatrix group; the sky's column does not move.)
 *
 *   The three small keys agree with each other and disagree with the build by
 *   fifty times, because every one of them throws away the twenty numbers in a
 *   tweened colour matrix. That is the day/night cycle, and losing it is the
 *   reason `key` below is `JSON.stringify(record)` and not something tidier.
 */
function inheritedEffectsFor(drawable, groups, groupIndex, notCarried) {
  const chain = drawable.ancestorEffects;
  if (!Array.isArray(chain) || chain.length === 0) return null;
  const indices = [];
  for (const group of chain) {
    const filters = Array.isArray(group.filters) && group.filters.length > 0 ? group.filters : null;
    const record = {
      // The chain of depths that reaches the group, so a reader can find it in
      // the same frame's placements without re-deriving which level it was on.
      path: [...(group.path ?? [])],
      character: group.characterId,
      ...(group.blendMode !== undefined && group.blendMode !== null ? { blendMode: group.blendMode } : {}),
      ...(filters ? { filters } : {})
    };
    const key = JSON.stringify(record);
    let at = groupIndex.get(key);
    if (at === undefined) {
      at = groups.length;
      groups.push(record);
      groupIndex.set(key, at);
      if (!filters && group.hasFilters) refuse(notCarried, "emptyFilterList");
      for (const filter of filters ?? []) if (filter.measured === false) refuse(notCarried, "unmeasuredFilterRecord");
      // ► **A GROUP HAS NO MATRIX HERE, AND A BLUR RADIUS IS IN PIXELS.**
      //   `flattenFrame`'s ancestor record is `{path, characterId, blendMode,
      //   hasFilters, filters}` — no matrix — so a renderer scaling `blur(11)`
      //   by the group's own transform cannot, and must fall back to the stage
      //   scale `canvasFilterFor` already takes. Composing it here would mean a
      //   second copy of that recursion in this file, which is the seam this
      //   project keeps paying for. Counted instead, once per group.
      refuse(notCarried, "effectGroupMatrix");
    }
    indices.push(at);
  }
  return indices;
}

/**
 * ONE PROP'S EFFECT INVOICE: what it carries, what encloses it, WHAT A
 * RENDERER WOULD ACTUALLY DO WITH EACH — applied, deferred to the
 * colour-matrix path, measured no-op, or refused by name — and what could not
 * be carried at all.
 *
 * ► **The verdicts come from `src/render/filters.js` and not from a table
 *   here**, so "the pack carries it" and "the renderer can draw it" cannot
 *   drift apart while both stay green — which is exactly the arrangement
 *   `test/extraction-honesty.test.js` was written to force for approximations.
 *
 * ► **`scale` IS DELIBERATELY LEFT AT 1.** The invoice is about which filters
 *   can be expressed at all; the stage-to-canvas scale is the renderer's and
 *   changes the NUMBERS in the string, never the four buckets. A scale baked in
 *   here would be a measurement of a choice this file does not get to make.
 */
function effectSummaryFor(groups, ownFilterLists, ownBlendModes, underGroup, notCarried, refusedOwn) {
  const byType = (lists) => {
    const counts = {};
    for (const list of lists) for (const filter of list) counts[filter.type] = (counts[filter.type] ?? 0) + 1;
    return counts;
  };
  const groupFilterLists = groups.map((group) => group.filters ?? []);
  const groupBlendModes = groups.map((group) => group.blendMode).filter((id) => id !== undefined && id !== null);

  const blend = { exact: {}, refused: {} };
  for (const id of [...groupBlendModes, ...ownBlendModes]) {
    const verdict = blendModeFor(id);
    const key = verdict.composite && verdict.exact ? "exact" : "refused";
    const label = key === "exact" ? verdict.name : `${verdict.name ?? id}:${verdict.refused}`;
    blend[key][label] = (blend[key][label] ?? 0) + 1;
  }

  return {
    // What this prop's OWN placements carry. Zero everywhere in the shipped
    // build; see `ownEffectsOf` for why that zero is the headline and not a
    // footnote.
    own: {
      filteredPlacements: ownFilterLists.length,
      filters: ownFilterLists.reduce((sum, list) => sum + list.length, 0),
      filtersByType: byType(ownFilterLists),
      blendModePlacements: ownBlendModes.length,
      // ► **THE FOUR ZEROES ABOVE ARE ONLY HONEST NEXT TO THIS.** They count
      //   drawables this tool EMITTED. `dropped` counts own effects on
      //   drawables it SKIPPED — and in the shipped build that is where 100% of
      //   the own filters are, so a reader who sees `filteredPlacements: 0` and
      //   stops has been told the opposite of the truth. Always present, even
      //   when empty, for the reason `effectGroups` is always present.
      dropped: {
        placements: refusedOwn.filterLists.length,
        filters: refusedOwn.filterLists.reduce((sum, list) => sum + list.length, 0),
        filtersByType: byType(refusedOwn.filterLists),
        blendModePlacements: refusedOwn.blendModes.length
      }
    },
    // What ENCLOSES them. `groups` counts the sprites; `placements` counts the
    // leaves inside them, and reporting only the second would report the sky's
    // one colour matrix as 3,202 colour matrices.
    inherited: {
      groups: groups.length,
      placements: underGroup,
      filters: groupFilterLists.reduce((sum, list) => sum + list.length, 0),
      filtersByType: byType(groupFilterLists),
      blendModes: groupBlendModes.length
    },
    // ► **THE TWO ARE COUNTED ON DIFFERENT UNITS, ON PURPOSE.** A group's
    //   filters are counted ONCE however many leaves are inside it, because the
    //   build applies them once to the group; a placement's own are counted per
    //   placement, because each placement really does get its own. Adding them
    //   on one unit would either inflate the sky's colour matrix by its 3,202
    //   leaves or deflate an own-filtered prop to one.
    use: {
      filters: summariseFilterUse([...groupFilterLists, ...ownFilterLists].map((list) => canvasFilterFor(list))),
      blendModes: blend
    },
    notCarried
  };
}

/**
 * ONE SHAPE'S OWN INVOICE: how many of its paths are drawn as something simpler
 * than the build draws them, and of which kinds.
 *
 * ► **DERIVED FROM THE PATHS EVERY TIME, never accumulated beside them**, so a
 *   caller cannot build the list and forget the count. This is the third copy
 *   of this five-line function in the tree — `tools/extract-figure.mjs`
 *   exports one and `test/extraction-honesty.test.js` has its own — and the
 *   duplication is deliberate for the reason `roundMatrix` above is duplicated:
 *   each tool stays runnable on its own. The drift that duplication invites is
 *   the one thing that cannot go unnoticed here, because the honesty test
 *   RECOMPUTES this from the pack's own data on every run and fails by name if
 *   the two disagree.
 *
 * ► **ALL ~~56~~ 87 SHAPES OR NONE.** That test's own note: *"A pack that invoices
 *   some of its entries is worse than one that invoices none"*, because a
 *   reader who checks one entry concludes the pack has invoices. This pack had
 *   0 of 56 before today, which was uniform and honest; it now has ~~56~~ 87
 *   (**corrected 2026-09-24**: 69 characters and 18 baked morphs, every one
 *   carrying `approximated` and `approximatedByKind`, in the player's own
 *   pack; the shapes the old twelve props reach are exactly the 56).
 */
function pathApproximations(paths) {
  const approximatedByKind = {};
  for (const entry of paths ?? []) {
    if (entry.approximated) {
      approximatedByKind[entry.approximated] = (approximatedByKind[entry.approximated] ?? 0) + 1;
    }
  }
  return {
    approximated: Object.values(approximatedByKind).reduce((sum, count) => sum + count, 0),
    approximatedByKind
  };
}

/**
 * Every frame of every declared prop, plus the shapes they reach.
 *
 * **Frames are 1-BASED, matching the build's own `gotoAndStop`.** A zero-based
 * array here would put an off-by-one between this data and every offset in the
 * map that indexes it, which is the kind of seam that goes wrong silently.
 */
/**
 * HOW MANY REGIONS THIS EXTRACTION COULD NOT READ EXACTLY, BY KIND.
 *
 * ► **THE RULE THIS PROJECT LEARNED THE EXPENSIVE WAY.** The arena's walls were
 *   invisible for months because `shapeToPaths` emitted `approximated: "bitmap"`
 *   with `fill: "none"`, the field died at the next seam, and this tool's own
 *   report said ZERO failures. Fixing the seam was necessary and not
 *   sufficient: the REPORT a human reads still said zero while the data carried
 *   eleven. **An approximation that is not counted is indistinguishable from a
 *   correct read**, and a count that is never printed is not a count.
 *
 *   `failures` remains what it always was — things that could not be PARSED.
 *   This is the other list: things that parsed and are drawn as something
 *   simpler than the build draws them.
 */
function tallyApproximations(shapes) {
  const byKind = {};
  let paths = 0;
  for (const shape of Object.values(shapes)) {
    for (const path of shape.paths ?? []) {
      paths += 1;
      if (path.approximated) byKind[path.approximated] = (byKind[path.approximated] ?? 0) + 1;
    }
  }
  const total = Object.values(byKind).reduce((sum, count) => sum + count, 0);
  return { paths, total, byKind };
}

/**
 * THE WHOLE PACK'S EFFECTS, added up from the props' OWN invoices.
 *
 * ► **Summed from what was written, never counted alongside it.** The figure
 *   extractor's manifest once summed a per-entry field that 83% of its pack did
 *   not have, and reported zero against data holding two. Every number below
 *   comes from `props[*].effects`, which is in the pack a reader can check.
 */
export function tallyEffects(props) {
  const add = (into, from) => {
    for (const [key, count] of Object.entries(from ?? {})) into[key] = (into[key] ?? 0) + count;
    return into;
  };
  const totals = {
    groups: 0, placementsUnderAGroup: 0, inheritedFilters: 0, inheritedBlendModes: 0,
    ownFilteredPlacements: 0, ownFilters: 0, ownBlendModePlacements: 0,
    // Never folded into the three above them. The pack does not hold these; it
    // knows they exist and says so, which is a different claim.
    droppedOwnFilteredPlacements: 0, droppedOwnFilters: 0, droppedOwnBlendModePlacements: 0
  };
  const inheritedByType = {};
  const ownByType = {};
  const droppedOwnByType = {};
  const notCarried = {};
  const use = { total: 0, applied: 0, deferred: 0, noOp: 0, refused: 0, approximated: 0 };
  const refusedByReason = {};
  const approximatedByKind = {};
  const blend = { exact: {}, refused: {} };

  for (const prop of Object.values(props)) {
    const effects = prop.effects;
    if (!effects) continue;
    totals.groups += effects.inherited.groups;
    totals.placementsUnderAGroup += effects.inherited.placements;
    totals.inheritedFilters += effects.inherited.filters;
    totals.inheritedBlendModes += effects.inherited.blendModes;
    totals.ownFilteredPlacements += effects.own.filteredPlacements;
    totals.ownFilters += effects.own.filters;
    totals.ownBlendModePlacements += effects.own.blendModePlacements;
    totals.droppedOwnFilteredPlacements += effects.own.dropped?.placements ?? 0;
    totals.droppedOwnFilters += effects.own.dropped?.filters ?? 0;
    totals.droppedOwnBlendModePlacements += effects.own.dropped?.blendModePlacements ?? 0;
    add(inheritedByType, effects.inherited.filtersByType);
    add(ownByType, effects.own.filtersByType);
    add(droppedOwnByType, effects.own.dropped?.filtersByType);
    add(notCarried, effects.notCarried);
    for (const key of Object.keys(use)) use[key] += effects.use.filters[key] ?? 0;
    add(refusedByReason, effects.use.filters.refusedByReason);
    add(approximatedByKind, effects.use.filters.approximatedByKind);
    add(blend.exact, effects.use.blendModes.exact);
    add(blend.refused, effects.use.blendModes.refused);
  }

  return {
    ...totals, inheritedByType, ownByType, droppedOwnByType,
    use: { ...use, refusedByReason, approximatedByKind },
    blendModes: blend,
    notCarried,
    // ► **WHAT THIS PACK CANNOT SEE AT ALL, said once in words because it is a
    //   SCOPE and not a measurement.** A prop is flattened as a clip in
    //   isolation, so an effect on the ROOT's placement of that clip is outside
    //   this extraction by construction — and one is real: root frames 96-226,
    //   the arena screen's own frame 221 among them, place character 1729
    //   (`sky`) under `blur(5, 5, 1 pass)`. That belongs to the screen the clip
    //   is placed on, is `tools/extract-screens.mjs`'s to carry, and would be
    //   an invention here, because `bullet` is attached by ActionScript and
    //   sits on no root frame at all. Reproduce: resolve the root timeline and
    //   read the `filters` on the placement of 1729.
    scope: "a prop is flattened as a clip in isolation; effects on the ROOT's placement of it are not here",
    // ► **AND THE OTHER SCOPE, WHICH IS ABOUT FRAMES RATHER THAN EFFECTS.**
    //   `flattenFrame` stops every nested sprite on frame 1. That is right for
    //   scenery and wrong wherever the build indexes a child by script —
    //   `bullet_trail`'s arrow is the case that bit, and it is measured now
    //   (`nestedLookup`), but ONLY where `PROP_EXPORTS` declares the child.
    //   Nothing here sweeps for undeclared ones, so a nested lookup nobody has
    //   noticed is still frozen at frame 1 and reads as a single drawing. Said
    //   in words because it is a scope: a count would need a second copy of
    //   `flattenFrame`'s recursion, which is the seam this file refuses to
    //   duplicate.
    nestedScope: "nested sprites are frozen on frame 1 except where PROP_EXPORTS declares the child's own index"
  };
}

export function extractProps(buffer) {
  const { characters, names } = indexCharacters(buffer);
  const byName = new Map([...names].map(([id, name]) => [name, id]));

  const props = {};
  const shapeIds = new Set();
  const failures = [];
  const cache = new Map();

  /**
   * A MORPH, BAKED AT THE RATIO ITS PLACEMENT CARRIES — added 2026-09-22 for
   * the fireball's explosion, and the convention is `extract-figure.mjs`'s.
   *
   * ► **WHAT THIS REPLACED WAS A SKIP.** A morph came out of `flattenFrame` as
   *   `unsupported: "morph"` and went down the same `continue` as a text
   *   field, into `failures`. REPORTED by the main session from its own
   *   extraction of the oracle, and not re-measured by this change, which was
   *   written where the install cannot be read: `fireball_combat` frame 4's
   *   explosion child, sprite 27, places a morph on its frames 1-18
   *   (characters 19-22) and MOVES it — a `PlaceObject2` with no character,
   *   carrying the ratio — so every one of those ages extracted as an empty
   *   frame and `fireballOpsFor` returned null for them.
   *
   * ► **THE KEY IS `"<id>@<raw ratio>"` AND THE ENTRY IS FIGURE'S, FIELD FOR
   *   FIELD** — `{bounds, morph, ratio, approximated, approximatedByKind,
   *   paths}` — so a baked morph is an ordinary entry in `shapes` and
   *   `propOpsFor` draws it with no second code path: it looks a placement's
   *   shape up by key, and a string key is a key. The RAW 0..65535 ratio rather
   *   than `extract-screens.mjs`'s normalised-and-rounded one, because the raw
   *   key is exact: rounding `ratio / 65535` to three places puts every raw
   *   ratio in a 65.5-wide bucket into one entry, baked at whichever came first.
   *
   * ► **NO RATIO IS RATIO 0, the start shape.** `PlaceFlagHasRatio` is
   *   optional, and a placement that never set one shows the morph's start —
   *   which is what `extract-figure.mjs` and `extract-screens.mjs` both bake.
   *   A MOVE that omits the ratio keeps the instance's last one: that is
   *   `resolveTimeline`'s field-by-field rule, the same one the matrix follows,
   *   so by the time a drawable reaches here `ratio` is already the one in
   *   force on that frame.
   *
   * ► **REFUSED, BY NAME, IN TWO CASES, and both keep the old skip's invoice.**
   *   A definition that will not parse (reported once per character, and once
   *   per placement it cost); and a morph under a mask this tool cannot turn
   *   into a clip. The second exists because `flattenFrame` marks a SHAPE under
   *   an unresolvable mask `unsupported: "masked"`, but a morph comes back
   *   `"morph"` either way — so carrying every morph would have lifted that
   *   refusal in silence and drawn the morph unclipped, larger than the build.
   *
   * @returns {{key: string|null, refused: string|null}}
   */
  const morphDefinitions = new Map();
  const morphShapes = new Map();
  const bakeMorph = (drawable, masks) => {
    if (drawable.maskPath && !masks.has(drawable.maskPath.join("/"))) {
      return { key: null, refused: "morph under a mask this tool cannot resolve" };
    }
    // ► **AND UNDER A MASK ON AN ENCLOSING SPRITE, WHICH THIS TOOL NEVER
    //   CLIPS** (added 2026-09-22 after a Codex adversarial review reproduced
    //   it: a morph inside a masked sprite came back with no `maskPath` and
    //   was baked whole). `flattenFrame` now stamps `ancestorMaskPath`; the
    //   old blanket refusal covered this case by accident, so lifting it for
    //   morphs must not lift it here.
    if (drawable.ancestorMaskPath) {
      return { key: null, refused: "morph inside a masked sprite this tool cannot clip" };
    }
    const ratio = Number.isFinite(drawable.ratio) ? drawable.ratio : 0;
    const morphKey = `${drawable.characterId}@${ratio}`;
    if (morphShapes.has(morphKey)) return { key: morphKey, refused: null };
    let definition = morphDefinitions.get(drawable.characterId);
    if (definition === undefined) {
      const character = characters.get(drawable.characterId);
      try {
        definition = parseMorphShape(buffer, character.bodyStart, character.bodyEnd, character.tagCode);
      } catch (error) {
        definition = null;
        failures.push({
          linkage: `morph ${drawable.characterId}`, id: drawable.characterId,
          message: String(error.message).slice(0, 120)
        });
      }
      morphDefinitions.set(drawable.characterId, definition);
    }
    if (!definition) return { key: null, refused: "morph whose definition would not parse" };
    const frame = morphShapeAt(definition, ratioOf(ratio));
    const paths = morphToPaths(frame);
    morphShapes.set(morphKey, {
      bounds: {
        xMin: px(frame.bounds.xMin), xMax: px(frame.bounds.xMax),
        yMin: px(frame.bounds.yMin), yMax: px(frame.bounds.yMax)
      },
      morph: drawable.characterId,
      ratio,
      // The invoice every shape in this pack carries, on the morphs too: "all
      // of them or none", and `test/extraction-honesty.test.js` fails by name
      // on a pack that invoices some.
      ...pathApproximations(paths),
      paths
    });
    return { key: morphKey, refused: null };
  };

  for (const declared of PROP_EXPORTS) {
    // ► **BY NAME WHERE THE BUILD EXPORTS ONE, BY CHARACTER ID WHERE IT DOES
    //   NOT.** Every wardrobe piece and every prop above is in `ExportAssets`;
    //   the arena is not — it is a named INSTANCE on a root frame, which is a
    //   different thing. An entry states which it is and this loop does not
    //   guess: a `character` with no matching id fails loudly rather than
    //   silently extracting nothing.
    const key = declared.linkage ?? declared.name;
    const id = declared.character ?? byName.get(declared.linkage);
    if (id === undefined) {
      failures.push({ linkage: key, message: "no export of that name in this build" });
      continue;
    }
    const character = characters.get(id);
    if (!character || character.kind !== "sprite") {
      failures.push({ linkage: key, id, message: `is a ${character?.kind ?? "nothing"}, not a sprite` });
      continue;
    }
    // **Frame 1 only when the entry says so** — the arena's other 333 frames
    // are `combatwon`, `combatlost` and the intro, which is a different asset
    // and a different question from the ground a fight happens on.
    const frameCount = declared.framesWanted === 1 ? 1 : character.frames;
    const wanted = Array.from({ length: frameCount }, (unused, index) => index + 1);
    let resolved;
    try {
      resolved = resolveTimeline(buffer, character, { frames: wanted });
    } catch (error) {
      failures.push({ linkage: key, id, message: String(error.message).slice(0, 120) });
      continue;
    }

    const frames = [];
    // THE PROP'S EFFECT GROUPS, ONCE EACH, and the placements point at them.
    // Per prop rather than per pack because an index into a list one prop away
    // is a join a reader has to make by hand, and `frames` is already per prop.
    const groups = [];
    const groupIndex = new Map();
    // Everything this prop's effects could not carry, by name. Per prop AND
    // summed for the manifest: "7 somewhere" and "7 on the sky" are different
    // problems and one total cannot tell a reader which one they have.
    const notCarried = {};
    const ownFilterLists = [];
    const ownBlendModes = [];
    // The same two lists for drawables this tool DROPS. Kept apart from the
    // carried ones on purpose: adding them would make `own.filters` count
    // things the pack does not hold, which is the opposite mistake.
    const refusedOwn = { filterLists: [], blendModes: [] };
    let underGroup = 0;
    // ► **ONE FRAME'S PLACEMENTS, AS A CLOSURE, so a CLOCK child can be walked
    //   with exactly the code that walks the prop's own frames.** Factored out
    //   2026-09-22 for `lightning_bolt_combat`; before that this body sat inline
    //   in the loop below. `where` names the frame in every failure message and
    //   `spriteFrames` is `flattenFrame`'s own option for stopping a nested
    //   sprite somewhere other than frame 1. Every invoice below is fed from
    //   here either way, so a clock frame's effects are counted as the emitted
    //   placements they are.
    const placementsFor = (displayList, where, spriteFrames = null) => {
      let drawables;
      try {
        // ► **CLIP PATHS ARE ASKED FOR HERE AND NOWHERE ELSE.** The sky's night
        //   frames put a shape mask over the moon's glow, and without this the
        //   extraction reported 178 failures and dropped both halves — a moon
        //   with no glow on 89 of 200 frames. The flag is opt-in precisely so
        //   that the figure and wardrobe extractions, which are pinned by tests
        //   and by a preview the owner has looked at, do not silently gain
        //   geometry they never had.
        drawables = flattenFrame(buffer, characters, displayList, {
          cache, resolveMasks: true, ...(spriteFrames ? { spriteFrames } : {})
        });
      } catch (error) {
        failures.push({ linkage: key, id, message: `${where}: ${String(error.message).slice(0, 90)}` });
        return [];
      }
      // THE MASKS ON THIS FRAME, by their own path — so a masked placement can
      // name its cutter without depth alone having to be unique across nesting.
      const masks = new Map();
      for (const drawable of drawables) {
        if (drawable.isMask && !drawable.unsupported) masks.set(drawable.path.join("/"), drawable);
      }

      const placements = [];
      for (const drawable of drawables) {
        // A MASK IS A CUTTER, NOT A DRAWING. Painting it would put the stencil
        // on the canvas instead of the thing it cuts, so it is carried on the
        // placements it clips and never emitted as one of its own.
        if (drawable.isMask) {
          if (drawable.unsupported) {
            // The mask's own effects go out with it, and are invoiced by name
            // for the same reason the unsupported branch below invoices its
            // own: a drop nobody counted is indistinguishable from an absence.
            const lost = refusedEffectsOf(drawable, refusedOwn, notCarried);
            failures.push({
              linkage: key, id,
              message: `${where} carries ${drawable.unsupported} (character ${drawable.characterId})${lost}`
            });
          }
          continue;
        }
        // An unsupported drawable is REPORTED and skipped, never silently
        // dropped — the three combat icons are mostly `DefineEditText`, which
        // is why they are not in `PROP_EXPORTS` at all.
        //
        // ► **AND ITS OWN EFFECTS ARE REPORTED TOO, WHICH THEY WERE NOT.** This
        //   `continue` sits ABOVE `ownEffectsOf`, so for as long as it invoiced
        //   nothing, the build's two own-filtered placements (`panel`'s two
        //   edit-text children, each with its own glow) left no trace anywhere
        //   — not in `notCarried`, not in the invoice, not in this message —
        //   and the pack-wide `0 own filters` was a measurement of this line.
        //
        // ► **A MORPH IS NO LONGER ONE OF THEM.** It is baked at its own ratio
        //   and continues below as an ordinary placement whose `shape` is a
        //   `"<id>@<ratio>"` key, so its colour, clip and effects are carried by
        //   the SAME literal as a shape's — `extract-figure.mjs` learned what two
        //   literals cost. Only a refused morph takes this skip, and names why.
        let shapeKey = drawable.characterId;
        let refusal = drawable.unsupported;
        if (drawable.unsupported === "morph") {
          const baked = bakeMorph(drawable, masks);
          shapeKey = baked.key;
          refusal = baked.refused;
        }
        if (refusal) {
          const lost = refusedEffectsOf(drawable, refusedOwn, notCarried);
          failures.push({
            linkage: key, id,
            message: `${where} carries ${refusal} (character ${drawable.characterId})${lost}`
          });
          continue;
        }
        const cutter = drawable.maskPath ? masks.get(drawable.maskPath.join("/")) : null;
        if (cutter) {
          shapeIds.add(cutter.characterId);
          // A CUTTER'S OWN EFFECTS ARE NOT CARRIED. `clip` is a shape and a
          // matrix — a region — and a blurred stencil is a soft-edged region
          // that a path clip cannot express at all. Zero of this build's 89
          // cutters carries one, so this is a counted zero rather than a
          // measured loss; it stops being zero the moment somebody mods a mask.
          if (cutter.hasFilters) refuse(notCarried, "clipFilters");
          if (cutter.blendMode !== undefined && cutter.blendMode !== null) refuse(notCarried, "clipBlendMode");
        }
        // A baked morph's entry is already in `morphShapes`; only a character
        // id goes on the list the shape parser walks.
        if (typeof shapeKey === "number") shapeIds.add(shapeKey);
        const own = ownEffectsOf(drawable, notCarried);
        if (own.filters) ownFilterLists.push(own.filters);
        if (own.blendMode !== undefined) ownBlendModes.push(own.blendMode);
        const inherited = inheritedEffectsFor(drawable, groups, groupIndex, notCarried);
        if (inherited) underGroup += 1;
        placements.push({
          shape: shapeKey,
          matrix: roundMatrix(drawable.matrix),
          ...(drawable.colourTransform ? { colour: drawable.colourTransform } : {}),
          // The clip travels WITH the thing it clips rather than as a sibling,
          // because a renderer has to set it before the fill and clear it after,
          // and a list of cutters somewhere else is an invitation to forget.
          ...(cutter ? { clip: { shape: cutter.characterId, matrix: roundMatrix(cutter.matrix) } } : {}),
          // THIS PLACEMENT'S OWN filter list and blend mode, spread the same
          // conditional way `colour` and `clip` are, and absent when it has
          // none. `filters` here means the placement's own and nothing else.
          ...own,
          // ► **AND ITS ANCESTORS' ARE A DIFFERENT KEY WITH A DIFFERENT NAME**,
          //   holding indices into this prop's `effectGroups` and NOT filter
          //   records, so no reader can take an enclosing sprite's blur for
          //   this leaf's. Outermost first, which is the order a renderer has
          //   to nest its buffers in — an unmeasurable guarantee on this build
          //   (every chain is length 1) and pinned by fixture instead.
          ...(inherited ? { inheritedEffects: inherited } : {})
        });
      }
      return placements;
    };
    for (let index = 0; index < frameCount; index += 1) {
      const displayList = resolved.frames[index];
      if (!displayList) { frames.push([]); continue; }
      frames.push(placementsFor(displayList, `frame ${index + 1}`));
    }

    // ► **THE DISTINCT-CONTENT TALLY IS THE POINT OF THE REPORT, not a
    //   statistic.** It is what found that `bullet`'s fifty frames are five
    //   arrows: a lookup clip whose frames mostly repeat is telling you the
    //   index has fewer meanings than it has slots.
    const signatures = frames.map((placements) => placements.map((p) => p.shape).sort().join(","));
    const nestedLookup = declared.nested
      ? nestedLookupFor(buffer, characters, resolved, frameCount, declared.nested, cache, notCarried)
      : null;
    // ► **A CLOCK CHILD, WALKED FRAME BY FRAME — added 2026-09-22.** Where
    //   `nestedLookup` measures a child whose frame is an INDEX into one shape,
    //   this is a child whose frame is TIME: it has no `Stop`, so in the build
    //   it loops for as long as its parent is attached, and freezing it on
    //   frame 1 draws a still picture of an animation. Emitted as every parent
    //   frame at every child frame, re-flattened through `placementsFor` so a
    //   clock frame is built — and invoiced — by exactly the code that builds
    //   the prop's own frames. Nothing here assembles a frame by hand.
    let clock = null;
    // ► **A CLOCK DECLARED BY FRAME IS FOUND, AND WHAT WAS FOUND IS WRITTEN
    //   DOWN — added 2026-09-23 for `boulder_combat`.** Every animated sprite
    //   each parent frame places, at any depth of nesting, per frame, so a
    //   reader can see what the search saw: the landing's child, and whether the
    //   FALLING frame carries one too (which would be frozen on its frame 1).
    let clockDiscovery = null;
    let clockCharacter = declared.clock?.character;
    if (declared.clock && clockCharacter === undefined && Number.isInteger(declared.clock.discoverOnFrame)) {
      const onFrame = declared.clock.discoverOnFrame;
      const byFrame = [];
      for (let index = 0; index < frameCount; index += 1) {
        byFrame.push(animatedSpritesIn(buffer, characters, resolved.frames[index] ?? []));
      }
      clockDiscovery = { onFrame, byFrame };
      const found = byFrame[onFrame - 1] ?? [];
      if (found.length === 1) {
        clockCharacter = found[0];
      } else if (found.length > 1) {
        refuse(notCarried, "clockAmbiguous");
        failures.push({
          linkage: key, id,
          message: `frame ${onFrame} places ${found.length} animated sprites (${found.join(", ")}); ` +
            "declare the one that is the clock as `clock.character`"
        });
      }
      // None: that frame is a still drawing, and a still drawing has no clock.
    }
    if (declared.clock && clockCharacter !== undefined) {
      const child = characters.get(clockCharacter);
      if (!child || child.kind !== "sprite") {
        refuse(notCarried, "clockCharacterMissing");
      } else {
        const framesByParent = [];
        for (let index = 0; index < frameCount; index += 1) {
          const displayList = resolved.frames[index];
          const ages = [];
          for (let age = 1; age <= child.frames; age += 1) {
            ages.push(displayList
              ? placementsFor(displayList, `frame ${index + 1} at clock frame ${age}`,
                { [clockCharacter]: age })
              : []);
          }
          framesByParent.push(ages);
        }
        clock = {
          character: clockCharacter,
          // Present only on a clock this tool FOUND, so a declared one reads
          // exactly as it always has.
          ...(clockDiscovery ? { discoveredOn: clockDiscovery.onFrame } : {}),
          indexedBy: declared.clock.indexedBy,
          reader: declared.clock.reader,
          frameCount: child.frames,
          framesByParent
        };
      }
    }
    props[key] = {
      linkage: key,
      character: id,
      frameCount,
      declaredFrames: character.frames,
      indexedBy: declared.indexedBy,
      reader: declared.reader,
      distinctFrames: new Set(signatures.filter((s) => s.length > 0)).size,
      // ALWAYS PRESENT, EMPTY WHERE THERE ARE NONE — ~~8 of the 12~~ 11 of the
      // 15 props have no effect groups at all. An absent key would make "this
      // prop has no groups" and "this pack predates groups" the same shape, and
      // telling those apart is the whole point of writing a count down.
      // (**Corrected 2026-09-24, and the 8 did not reproduce even before the
      // spell props:** in the player's own pack only `bullet_trail`, `sky`,
      // `lightning_bolt_combat` and `boulder_combat` hold a group, so the old
      // twelve count 10 with none, not 8. Whether 8 was ever right is not
      // recoverable from this pack. `panel`, one of the 11, is not empty of
      // effects: its 2 refused glows are in `effects.own.dropped`.)
      effectGroups: groups,
      // ► **PRESENT ONLY WHERE THE ENTRY DECLARES ONE, unlike `effectGroups`
      //   beside it, and the asymmetry is deliberate.** An always-present
      //   `nestedLookup: null` would claim this tool went looking on all ~~twelve~~
      //   fifteen props; it goes looking exactly where `PROP_EXPORTS` says the build
      //   indexes a child, and a refusal is in `notCarried` under its own name.
      ...(nestedLookup ? { nestedLookup } : {}),
      // Present only where `PROP_EXPORTS` declares a clock, for the reason
      // `nestedLookup` beside it is: an always-present `clock: null` would
      // claim this tool went looking on every prop.
      ...(clock ? { clock } : {}),
      // What a clock declared BY FRAME found, whether or not it became one:
      // "nothing animated there" and "two things animated there" are both
      // answers a reader needs, and neither leaves a `clock` behind.
      ...(clockDiscovery ? { clockDiscovery } : {}),
      effects: effectSummaryFor(groups, ownFilterLists, ownBlendModes, underGroup, notCarried, refusedOwn),
      frames
    };
  }

  const shapes = {};
  for (const id of [...shapeIds].sort((left, right) => left - right)) {
    const character = characters.get(id);
    try {
      const shape = parseShape(buffer, character.bodyStart, character.bodyEnd, character.tagCode);
      const paths = shapeToPaths(shape);
      shapes[id] = {
        bounds: {
          xMin: px(shape.bounds.xMin), xMax: px(shape.bounds.xMax),
          yMin: px(shape.bounds.yMin), yMax: px(shape.bounds.yMax)
        },
        // THE INVOICE TRAVELS WITH THE SHAPE. `tallyApproximations` below adds
        // the same numbers up for the manifest, but a reader holding one entry
        // should not have to walk the whole pack to learn that this shape is
        // the one drawn as a flat fill where the build draws a gradient.
        ...pathApproximations(paths),
        paths
      };
    } catch (error) {
      failures.push({ linkage: `shape ${id}`, id, message: String(error.message).slice(0, 120) });
    }
  }
  // ► **THE BAKED MORPHS JOIN AFTER THE CHARACTER IDS, sorted by id then
  //   ratio.** JSON keeps an object's integer-like keys first and in order
  //   whatever is inserted, so a pack with no morph writes exactly the shapes
  //   object it wrote before this existed; the sort makes the morph half as
  //   independent of walk order as the numeric half already was.
  const morphOrder = [...morphShapes].sort(([, left], [, right]) =>
    left.morph - right.morph || left.ratio - right.ratio);
  for (const [morphKey, entry] of morphOrder) shapes[morphKey] = entry;

  return {
    props, shapes, failures,
    approximated: tallyApproximations(shapes),
    effects: tallyEffects(props)
  };
}

/**
 * THE MANIFEST A HUMAN READS, as an object — built here rather than inline in
 * `main` so a test can hold it.
 *
 * ► **BECAUSE IT WAS DELETABLE WITH THE SUITE GREEN.** A verifier removed
 *   `effects: prop.effects` from this object and all fifteen tests still
 *   passed: `main()` was exercised by nothing, and the per-entry invoice — the
 *   ONLY place a reader sees what one prop lost — was guarded by no assertion
 *   anywhere in the repository. A number nothing can turn red is not published,
 *   it is stored. `test/extract-props.test.js` now writes this object from the
 *   synthetic build and checks each entry.
 */
export function manifestFor({ source, sha256, props, shapes, failures, approximated, effects }) {
  return {
    source,
    sha256,
    extractedFrom: "ExportAssets linkage names; frames are 1-based, as gotoAndStop indexes them",
    props: Object.fromEntries(Object.entries(props).map(([name, prop]) => [name, {
      character: prop.character,
      frameCount: prop.frameCount,
      distinctFrames: prop.distinctFrames,
      indexedBy: prop.indexedBy,
      reader: prop.reader,
      // A SECOND INDEX WHERE THERE IS ONE, so the manifest says what the pack
      // says: `bullet_trail`'s seven frames are an age and its arrow is a
      // fifty-frame lookup on a child. Absent where nothing was declared.
      ...(prop.nestedLookup ? { nestedLookup: prop.nestedLookup } : {}),
      // WHAT A CLOCK DECLARED BY FRAME FOUND, and which character it took.
      // Absent everywhere a clock was declared by character, as before.
      ...(prop.clockDiscovery ? {
        clockDiscovery: { ...prop.clockDiscovery, character: prop.clock?.character ?? null }
      } : {}),
      // THE PER-ENTRY INVOICE. Every prop carries one — including the eight
      // with nothing in it, for the reason `effectGroups` is always present.
      effects: prop.effects
    }])),
    shapeCount: Object.keys(shapes).length,
    // ► **HOW MANY OF THOSE ARE A MORPH BAKED AT ONE RATIO**, counted off the
    //   shapes themselves rather than carried beside them, for the reason
    //   `tallyEffects` is summed from what was written. Always present, a zero
    //   included: 0 and absent are different facts about a pack.
    morphCount: Object.values(shapes).filter((shape) => shape.morph !== undefined).length,
    // Printed AND stored, because a count that only exists in memory is the
    // same silence the `failures` list was built to break.
    approximated,
    effects,
    failures
  };
}

function main(argv) {
  const options = parseArguments(argv);
  if (!fs.existsSync(options.file)) {
    throw new ExtractPropsError(
      `No SWF at ${options.file}. Pass the path to YOUR OWN installed copy; this repository ships none.`
    );
  }
  const buffer = fs.readFileSync(options.file);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  if (sha256 !== ORACLE_SHA256) {
    process.stdout.write(
      `NOTE: this build is ${sha256.slice(0, 16)}…, not the oracle ${ORACLE_SHA256.slice(0, 16)}…\n` +
      "      That is legitimate; what is not is treating the output as evidence about the oracle.\n"
    );
  }

  const { props, shapes, failures, approximated, effects } = extractProps(buffer);

  fs.mkdirSync(options.out, { recursive: true });
  const payload = JSON.stringify({ props, shapes }, null, 1);
  fs.writeFileSync(path.join(options.out, "props.json"), payload);
  fs.writeFileSync(path.join(options.out, "manifest.json"), JSON.stringify(manifestFor({
    source: path.basename(options.file), sha256, props, shapes, failures, approximated, effects
  }), null, 1));

  const lines = [`props -> ${options.out}`];
  for (const prop of Object.values(props)) {
    lines.push(
      `  ${prop.linkage.padEnd(13)} char ${String(prop.character).padStart(4)}  ` +
      `${String(prop.frameCount).padStart(3)} frames, ${prop.distinctFrames} distinct  (${prop.indexedBy})`
    );
    // ► **THE SECOND INDEX, PRINTED WHERE THE FIRST ONE IS.** `bullet_trail`
    //   read as "7 frames, 1 distinct" for as long as this tool froze its child
    //   — a line that says "one drawing" about a clip with fifty. A reader of
    //   the report has to see both or the frozen one looks complete.
    if (prop.nestedLookup) {
      const nested = prop.nestedLookup;
      lines.push(
        `                 └ ${nested.instance} (char ${nested.character}): ` +
        `${nested.frameCount} frames, ${nested.distinctShapes} distinct shapes over shape ${nested.replaces}  ` +
        `(${nested.indexedBy})`
      );
    }
    // ► **A DISCOVERED CLOCK IS PRINTED WITH WHAT THE SEARCH SAW**, so the
    //   person re-extracting learns which sprite to read for the landing's
    //   lifetime without opening the JSON.
    if (prop.clockDiscovery) {
      const seen = prop.clockDiscovery.byFrame.map((ids, index) => `f${index + 1}:[${ids.join(",")}]`).join(" ");
      lines.push(
        `                 └ clock on frame ${prop.clockDiscovery.onFrame}: ` +
        `${prop.clock ? `char ${prop.clock.character}, ${prop.clock.frameCount} frames` : "NONE"}  ` +
        `(animated sprites by frame: ${seen})`
      );
    }
  }
  const approxParts = Object.entries(approximated.byKind).map(([kind, count]) => `${count} ${kind}`);
  const morphs = Object.values(shapes).filter((shape) => shape.morph !== undefined).length;
  lines.push(
    `  ${Object.keys(shapes).length} shapes (${morphs} a morph baked at one ratio), ${approximated.paths} paths, ` +
    `${failures.length} failures, ` +
    `${approximated.total} approximated${approxParts.length ? ` (${approxParts.join(", ")})` : ""}`
  );
  const named = (counts) => Object.entries(counts).map(([kind, count]) => `${count} ${kind}`).join(", ") || "none";
  // ► **THE OWN/INHERITED SPLIT IS THE FIRST THING PRINTED, because the whole
  //   finding is that one of them is zero.** A line reading "10 filters" would
  //   let a reader conclude the placements carry them. They carry none: every
  //   filter this pack can draw is on an enclosing sprite and is stored once,
  //   and the leaves point at it.
  //
  // ► **AND THE REFUSAL IS PRINTED ON THE SAME LINE, NOT UNDER `notCarried`
  //   TWELVE LINES DOWN.** For as long as it was not, the zero in front of it
  //   read as "the build has none" when it meant "the two that exist were
  //   skipped upstream of the counter". Whoever quotes this line quotes both
  //   halves or neither.
  const dropped = effects.droppedOwnFilters + effects.droppedOwnBlendModePlacements > 0
    ? `  [+ ${effects.droppedOwnFilters} own filter(s) and ${effects.droppedOwnBlendModePlacements} own blend mode(s) ` +
      `REFUSED on ${effects.droppedOwnFilteredPlacements} skipped drawable(s): ${named(effects.droppedOwnByType)}]`
    : "  [+ 0 refused on a skipped drawable]";
  lines.push(
    `  effects: ${effects.ownFilters} own filter(s) on ${effects.ownFilteredPlacements} placement(s), ` +
    `${effects.ownBlendModePlacements} own blend mode(s)${dropped}`
  );
  lines.push(
    `           ${effects.groups} enclosing group(s) over ${effects.placementsUnderAGroup} placement(s): ` +
    `${named(effects.inheritedByType)}, ${effects.inheritedBlendModes} blend mode(s)`
  );
  lines.push(
    `           a renderer: ${effects.use.applied} applied, ${effects.use.deferred} deferred, ` +
    `${effects.use.noOp} no-op, ${effects.use.refused} refused` +
    `${Object.keys(effects.use.refusedByReason).length ? ` (${named(effects.use.refusedByReason)})` : ""}`
  );
  lines.push(`           not carried: ${named(effects.notCarried)}`);
  if (options.report) for (const failure of failures.slice(0, 20)) lines.push(`    ! ${failure.linkage}: ${failure.message}`);
  process.stdout.write(`${lines.join("\n")}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
