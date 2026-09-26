/**
 * THE ARENA SCREEN — the six things root frame 221 puts on the stage, where
 * they go, and the camera the build wrote for them.
 *
 * ## What this is, and why it is not part of `props.js`
 *
 * `props.js` draws things that stand IN the arena — an arrow, a rock, a spray
 * of blood — each at a coordinate the resolver hands it. This file is the
 * arena ITSELF: a fixed stage, a layer order, and the mapping from arena units
 * to stage pixels that every one of those coordinates is expressed in. It is
 * the datum the rest of the renderer has been implying.
 *
 * ## THE MAPPING IS 1:1, and it is measured rather than chosen
 *
 * Root frame 221 places six objects. Read off the oracle (`77cb545c…`) by
 * resolving the ROOT timeline — a pseudo-sprite spanning `tagStreamStart` to
 * the end of the file — and taking `frames[220]`:
 *
 * ```text
 *   depth     char  instance          at (stage px)      scale
 *       1      643  (unnamed)         (   0.00,   0.00)   1.00   the backdrop
 *       3     1729  sky               ( 315.70, 216.85)   1.04   sky + clouds
 *      59     2249  arena             ( 319.95, 166.75)   1.00   sand + crowd
 *      80     1816  rain              (-310.35, -66.35)   1.00   weather
 *     438     1531  fiz_info_panel    (  -0.50, 401.00)   1.00   the UI bar
 *    1193      646  (unnamed)         ( -25.55, -33.00)   1.00   the border
 * ```
 *
 * The backdrop measures **640 x 420 px — the declared stage, to the pixel** —
 * and is placed unscaled at the origin. `arena` is placed UNSCALED. Its
 * `gladiators` child is created at `(0, 0)` of it and the fighters are
 * constructed at `_x = ±250`, `_y = 200` inside that. So:
 *
 * ```text
 *   one arena unit       = one stage pixel
 *   the arena origin     = (319.95, 166.75) on stage
 *   THE GROUND LINE      = 166.75 + 200      = 366.75
 *   a fighter at _x ±250 = stage x 69.95 and 569.95
 * ```
 *
 * ► **THREE ROWS OF THE COMMITTED SIZE TABLE WERE OUT BY A FACTOR OF TWENTY,
 *   AND THE CAUSE IS A UNITS SEAM THIS REPOSITORY DOCUMENTS ELSEWHERE.** A
 *   matrix out of `tools/swf-display-list.mjs` carries `tx`/`ty` in TWIPS
 *   (`readMatrix`'s own docstring says so, and `composeMatrix` keeps them
 *   there because composing in twips is exact); `shapeToPaths` and every `px()`
 *   helper emit PIXELS. Compose a pixel bound with a twips translation and the
 *   offset — not the size — inflates twentyfold, so the error is invisible on
 *   anything placed at the origin and enormous on anything that is not.
 *   Measured here, against what `docs/integration/ss2-battle-map.md` carried:
 *
 * ```text
 *                    committed            measured        placed at
 *     char  643    640 x  420 px       640 x 420 px       (0, 0)        RIGHT
 *     char 1729   8417 x 1032 px       640 x 211 px       offset        WRONG
 *     char 2249  24177 x 2489 px      1363 x 422 px       offset        WRONG
 *     char 1531   1919 x  210 px       641 x  27 px       offset        WRONG
 *     char  646    732 x  505 px       732 x 505 px       ~origin       RIGHT
 * ```
 *
 *   The two that were right are the two whose contents sit at the origin. **A
 *   table that is correct wherever the bug cannot bite reads as a table that
 *   was checked.**
 *
 * ## THE CAMERA: the build has one, it is LIVE, and reading it cost a retraction
 *
 * `sprite:2249/frame:1/DoAction@0x6e421b` defines `getfightdistance`,
 * `combatCamera` and `combatscale`, and installs two anonymous handlers —
 * `crowd.onEnterFrame` (`+0x0d54`) and `gladiators.onEnterFrame` (`+0x0e68`).
 *
 * ► **`combatscale` IS THE CAMERA AND IT RUNS EVERY FRAME.**
 *   `gladiators.onEnterFrame` calls `getfightdistance()` and then, guarded on
 *   `_global.phasecomplete != false`, calls `combatscale()` at `+0x0e98`. The
 *   name resolves because the handler's closure carries sprite 2249's own
 *   timeline on its scope chain, which is where `combatscale` is defined.
 *   **So the shipped arena PANS and ZOOMS.**
 *
 * ► **`combatCamera` IS THE DEAD ONE, AND IT IS DEAD IN THE MOST LITERAL WAY:
 *   ITS BODY IS `return;`.** Decoded from the `DefineFunction2` header at
 *   `+0x048a` — payload 20, name `combatCamera`, 0 params, 9 registers, flags
 *   `0x016a`, CodeSize 476 — the body starts at file `0x6e46c2` (`+0x04a1`) and
 *   its first five bytes are `96 01 00 03 3e`: **`Push undefined; Return`.** The
 *   470 bytes after it — the `midway_focus` move, two registers stored and
 *   never read, a `localToGlobal` whose result is discarded, `maxscale = 1500 −
 *   midwaypoint` clamped to `[15, 100]`, and a Tween on `whichcharacter._x` —
 *   are unreachable. It is still CALLED, live, from `nextphase`
 *   (`sprite:862[overlay]/frame:52` `+0x31af`), and it does nothing.
 *
 * ► **THIS FILE FIRST SAID THE EXACT OPPOSITE, AND THE RETRACTION IS THE POINT.**
 *   The first version of this comment stated that `combatCamera` was the live
 *   camera and `combatscale` was dead code, and concluded that "the shipped
 *   arena is a FIXED camera" and that the repository's standing claim that the
 *   arena pans was wrong. **Every part of that was backwards.** Two failures
 *   produced it, both mine and both avoidable:
 *
 *   1. **I read `Push undefined; Return` at the top of my own disassembly and
 *      explained it away** as the tail of the preceding function. It was the
 *      whole function. The evidence that settles the question was the first two
 *      lines of the dump, and I wrote a reason for it not to count.
 *   2. **I searched for `combatscale`'s call sites, was told there were five
 *      references, and read two.** The live call is the third. A count that
 *      does not match the number of things you looked at is the cheapest
 *      possible tell, and it was printed.
 *
 *   **Eighth instance of this project's signature failure**, and the first
 *   where the refuted claim was mine and fresh rather than inherited. It was
 *   caught by a six-agent wave aimed at questions rather than at confirming the
 *   premise — two independent investigators broke it by different routes within
 *   twenty minutes, and the header, the constants and the call sites above were
 *   then re-derived here rather than relayed.
 *
 * ## SO THIS IS A REPRODUCTION, NOT A DIVERGENCE
 *
 * Every constant below is read off `combatscale` (`+0x0693`..`+0x0ad8`) and
 * none is chosen here. The build pans `gladiators._x` to keep the fight's
 * midpoint inside a dead zone of stage x 300..340, eases by a sixteenth of the
 * overshoot a frame, bands a zoom target on the separation, eases
 * `_global.zoomscale` toward it by a fifth with a snap inside ±4, and applies
 * it as `gladiators._xscale = _yscale = ceil(zoomscale)`.
 *
 * ► **`maxscale` AND `zoomscale` LIVE ON `_global`, NOT ON THE ARENA.**
 *   `combatscale`'s flags `0x016a` preload `_root` into register 1 and
 *   `_global` into register 2, so every `register:2, "maxscale"` in the
 *   disassembly is `_global.maxscale`. The map calls it `arena.maxscale`; that
 *   is a naming error, harmless to the arithmetic and worth not repeating.
 *
 * ► **AND THE BOUT OPENS AT A ZOOM OF FIVE.** `_global.zoomscale = 5` at
 *   `+0x0c7c`, on the arena clip's own frame 1 — so the arena does not open
 *   framed, it RUSHES IN, easing 5 → 20 → 32 → 42 → … → 80 and snapping, about
 *   sixteen frames at 30fps. That is the build's opening shot and it is
 *   reproduced. (The first version of this file asserted that `zoomscale` was
 *   never initialised anywhere in the build and "repaired" it by opening
 *   settled — a repair for a defect the build does not have, and it would have
 *   thrown the opening shot away.)
 *
 * ► **WHAT IS STILL OURS IS THE GENERALISATION TO MORE THAN TWO GLADIATORS**,
 *   and it is named at `midwaypointFor`. Vanilla has one pair, so "half the
 *   separation" and "half the spread of everybody on the field" are the same
 *   number and the bytes cannot distinguish them. With six on the field they
 *   are not, and the camera has to frame all six.
 *
 * ► **ONE MORE DEAD LIMB, RECORDED BECAUSE IT LOOKS LIKE A FEATURE.**
 *   `crowd.onEnterFrame` moves `crowd._x` to track
 *   `arena.gladiators.camPoint.x` against the same 300..340 dead zone, with a
 *   wrap at −600/200. **`camPoint` is never assigned anywhere in the build** —
 *   the string occurs exactly once in 7,586,504 bytes, at `0x6e4430`, as one
 *   constant-pool entry read four times inside that handler. So both tests
 *   compare against `undefined`, both are false, and the crowd's HORIZONTAL
 *   parallax never fires. Its vertical one does, from `combatscale`. Not
 *   reproduced, because reproducing it would be inventing the `camPoint` the
 *   build forgot to write.
 *
 * ## HOW MUCH OF THE STAGE THE BUILD'S BANDS ACTUALLY USE, measured
 *
 * The bands were written for a fight where the two gladiators ARE the picture.
 * Given to a spread of six they are conservative — everything stays on stage
 * with room to spare, which is the safe direction to be wrong in, but it is
 * not free:
 *
 * ```text
 *   spread   mp    zoom   drawn width   of a 640px stage
 *      130    65     80      104 px          16%     two fighters at reach
 *      500   250     50      250 px          39%     a vanilla 1v1 opening
 *     1020   510     30      306 px          48%     a 3v3 opening
 * ```
 *
 * **That is a tuning question, it is the owner's, and it is deliberately not
 * pre-empted here.** The alternative is choosing our own band boundaries, which
 * is the invention this whole file exists to avoid; if the frame reads as too
 * empty when somebody looks at it, the lever is `SS2_CAMERA.bands` and the
 * change should be recorded as authored rather than folded in as derived.
 *
 * ## THE UI BAR, AND THE SENTENCE THAT WAS FALSE FOR AS LONG AS IT EXISTED
 *
 * The panel layer's note used to read *"the bottom UI bar, 641 x 27, and it
 * carries live text this renderer draws itself"*. **This renderer has never
 * drawn a glyph.** Not one file under `src/render/` CALLS `fillText` — grep it
 * and every hit, in `text.js` and in this comment, is prose — and `text.js`
 * emits path operations rather than calling it at all. The whole arena path has
 * exactly one real `fillText`, at `tools/arena/main.js:1498`, and it draws a
 * combatant's NAME above their head. The bar has always rendered as its plate
 * art and two empty boxes.
 *
 *   **Re-derive that with `grep -n`, not `grep -c`**, which is the mistake this
 *   paragraph made in its first draft: a COUNT does not distinguish a call from
 *   a sentence about one, and the first version of this very note cited a count
 *   of 0 for a file that mentions `fillText` three times.
 *
 * ► **WHAT THE BAR ACTUALLY PLACES IS SIX THINGS, AND FOUR OF THEM DRAW.**
 *   Sprite 1531's only frame, resolved with `resolveTimeline` and flattened:
 *
 * ```text
 *   depth  char  instance         kind    at (bar px)     what it is
 *       1   488  myFootprint      sprite  (  0.00, -1.00)  plate, x6.41 y0.140
 *       3   488  myFootprint      sprite  (  0.00, -2.55)  plate, x6.41 y0.0155
 *       5  1527  soundvar         text    ( 91.00,  3.00)  the sound readout
 *       6  1528  tooltips_text    text    (  2.00,  3.00)  the tooltips readout
 *       7  1529  (unnamed)        sprite  ( 92.95, -3.60)  the sound BUTTON
 *       9  1530  (unnamed)        sprite  (  2.45, -2.50)  the tooltips BUTTON
 * ```
 *
 *   All four sprites bottom out on the same shape, char 487 (a 100 x 178.55px
 *   rectangle), so the bar is one plate and two inset boxes drawn four times at
 *   four scales. **The two boxes are the buttons, not the text** — the fields
 *   sit UNDER them at depths 5 and 6.
 *
 * ► **AND `flattenFrame` SAYS SO ITSELF.** Both text placements come back with
 *   `unsupported: "text"`, so `extract-props.mjs` honestly reports them and
 *   drops them — `assets/props/props.json`'s `panel` holds four shape ops and
 *   nothing else. Nothing lied; the note did.
 *
 * ► **THE BAR IS NOT THE ARENA'S, IT IS THE WHOLE GAME'S.** Depth 438 carries
 *   char 1531 on root frames **10 through 270** — 261 of the movie's 270 — so
 *   every screen in the build wears it, and frame 221 is only where this file
 *   meets it. Its `tx` is -20 twips on frame 10 and -10 on 11..270, which is
 *   why the table above says -0.50 and why that number is stated per-frame
 *   rather than as "the bar's x".
 *
 * ## WHAT THE BUILD WRITES INTO THE TWO FIELDS, and it is not what they hold
 *
 * Both fields are addressed by INSTANCE name and `.text`; the `DefineEditText`
 * `variable` field is the empty string on both, so nothing is bound by
 * variable. Measured with `--references` against the oracle:
 *
 * ```text
 *   1527 soundvar        baked "sound:ON\r"    written "sound:on" / "sound:off"
 *   1528 tooltips_text   baked "tooltips:off"  written "Tooltips:on" / "Tooltips:off"
 * ```
 *
 * ► **EVERY RUNTIME WRITE DISAGREES WITH THE BAKED STRING IN CASE**, in both
 *   fields and in opposite directions — the sound field is baked upper and
 *   written lower, the tooltips field baked lower and written capitalised. So
 *   "the bar reads `sound:ON` / `tooltips:off`", which is what the living head
 *   has recorded, is true of the SHIPPED FRAME and false of every state the
 *   player can reach. A renderer that hard-coded either pair would be right
 *   about exactly one moment of the game.
 *
 * ► **`soundvar` IS A FUNCTION OF `_root.pSound`.** `sprite:1531/frame:1/
 *   DoAction@0x3d3686` sets `_root.pSound = "on"` (`+0x0109`) and defines
 *   `_root.toggleSound` (`+0x0117`), whose two arms set `setVolume(0)` +
 *   `pSound = "off"` + `soundvar.text` (`+0x0170`) and `setVolume(100)` +
 *   `pSound = "on"` + `soundvar.text` (`+0x01a0`). It is called from the
 *   depth-7 button's own clip action (`instance:7/clip-action:0 +0x0023`).
 *
 * ► **`tooltips_text` IS A FUNCTION OF A BOOLEAN, AND IT IS NOT THE TOOLTIP
 *   LINE.** The depth-9 button's clip action flips `tooltips`, then writes
 *   `"Tooltips:on"` (`+0x00bd`) or `"Tooltips:off"` (`+0x00e2`). The actual
 *   tooltip text goes somewhere else entirely: `_root.tooltips(tooltip_text,
 *   tool_dur, toolx, tooly)` (defined at `root/frame:10/DoAction@0x3c3178`)
 *   writes `tooltip_box.tooltip` (`+0x020f`) and moves `tooltip_box` to the
 *   cursor. **So this field is a toggle LABEL, and reading it as "the tooltip
 *   line" — which is
 *   what a name like `tooltips_text` invites — would put every hint in the game
 *   on the wrong object.**
 *
 * ## TWO MORE READOUTS ARE WRITTEN AND THE BUILD PLACES NEITHER
 *
 * The same frame-1 script writes `gfxvar.text = "graphics:high"` (`+0x00e7`)
 * and `_root.fiz_info_panel.fullscreenvar.text` (`+0x01ea`, `+0x0209`), and
 * `_root.toggleFS` (`+0x021d`) writes `fullscreenvar` twice more.
 *
 * ► **NEITHER NAME IS AN INSTANCE ANYWHERE IN THE BUILD.** Byte-scanned over
 *   all 7,586,504 bytes: `gfxvar` occurs ONCE, at `0x3d3691`, and
 *   `fullscreenvar` ONCE, at `0x3d3734` — both inside that one script's
 *   constant pool. Walking every sprite's and the root's display list for a
 *   placement named either finds none. So `GetVariable`/`GetMember` yields
 *   `undefined` and every one of those writes lands on `undefined.text`.
 *   `toggleFS` occurs once — its own definition — so it is never called either,
 *   and `gfxvar` has no OFF state to be written: scanning the whole file for
 *   `graphics:` followed by letters returns ONE hit, `graphics:high` at
 *   `0x3d369d`. (That scan was first written into this comment as a regexp
 *   literal, whose closing delimiter ended the block comment and broke the
 *   module — a one-character reminder that a docstring is still code.)
 *
 * ► **THE WHOLE SET, SCANNED RATHER THAN LISTED FROM MEMORY.** Exactly NINE
 *   colon-joined readout strings exist in the oracle: `sound:ON` (baked, and
 *   the only one with a trailing `\r`), `sound:off`, `sound:on`;
 *   `tooltips:off` (baked), `Tooltips:on`, `Tooltips:off`; and
 *   `graphics:high`, `fullscreen:on`, `fullscreen:off`. **Six of the nine can
 *   reach a screen and three cannot**, because the three belong to the two
 *   readouts the build never places.
 *
 * ► **THIS IS WHERE "FOUR FIELDS" CAME FROM, AND IT IS WHY THE COUNT MATTERS.**
 *   The panel the build's code was written against has four readouts; the panel
 *   it ships has two. Anyone reading the script rather than the display list
 *   counts four and is wrong about the picture. They are declared below as
 *   `SS2_UI_BAR_UNPLACED` and counted, rather than omitted — an absence nobody
 *   counted is the failure this project has now recorded six times.
 *
 * ## SO THE SEAM IS: IDENTITY AND PLACEMENT HERE, GLYPHS IN `text.js`
 *
 * `uiBarReadoutsFor` deliberately draws nothing and imports nothing.
 *
 * ► **THIS FILE IS THE ARENA'S GEOMETRY AND ITS LAYER STACK**, which is exactly
 *   what "which field, at what stage coordinate, whose value is a function of
 *   what" is; it is NOT a type renderer, and `text.js` already is one. Importing
 *   `text.js` here would put the only edge in the wrong direction — the text
 *   renderer is a leaf that knows nothing about arenas, and it should stay one.
 *   So `fieldsPlacedIn` is INJECTED, the way `propOpsFor` already is in
 *   `arenaScreenLayersFor`, and for the same stated reason: the pack format
 *   lives in exactly one file. A caller composes the two:
 *
 * ```js
 *   const bar = uiBarReadoutsFor(pack, fieldsPlacedIn, { sound: "sound:on" });
 *   for (const readout of bar.readouts) {
 *     const ops = fieldOpsFor(pack, readout.field,
 *       { matrix: readout.matrix, text: readout.text ?? undefined });
 *   }
 * ```
 *
 * ► **AND NO STRING THE BUILD DISPLAYS IS A CONSTANT IN THIS FILE.** All nine
 *   above are quoted in this comment as MEASUREMENTS, with the offsets they
 *   were read at, and `test/render-arena-backdrop.test.js` asserts that none of
 *   them has drifted down into the declarations. A readout's live value comes from the caller; passing `text:
 *   undefined` to `fieldOpsFor` makes the PACK's baked string the fallback,
 *   which is the game's own opening frame and is the pack's business, not this
 *   module's. A clone with no licensed copy gets an empty readout list and a
 *   tally that says two are missing, never a throw and never a picture of a bar
 *   with nothing owed on it.
 */

/** No pack, or a pack with nothing this file can draw, is not an error. */
export class ArenaBackdropError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * The SWF's declared stage. Every coordinate in this file is in these units,
 * and a surface fits this rectangle into its canvas rather than scaling the
 * arena to its roster.
 */
export const SS2_STAGE = Object.freeze({ width: 640, height: 420 });

/**
 * Where `_root.arena` sits on that stage, measured off root frame 221's
 * placement matrix: `tx` 6399 twips, `ty` 3335 twips.
 *
 * **Not rounded to (320, 167).** The build's own number is 319.95 / 166.75 and
 * a renderer that rounds it is a quarter-pixel out at every zoom level for no
 * gain; the table in the map rounds for readability and this does not.
 */
export const SS2_ARENA_ORIGIN = Object.freeze({ x: 319.95, y: 166.75 });

/**
 * The stage y a gladiator's feet rest on AT FULL ZOOM — the arena origin plus
 * the `_y = 200` both vanilla fighters are constructed at, which is
 * `SS2_ARENA.frontY`.
 *
 * **This is the number a previous session called "the unknown that would put
 * gladiators in the sky if guessed", and it was never unknown**: it is the
 * front rank's own datum, which this engine has shipped since position landed.
 *
 * ► **AND IT IS NOT A CONSTANT ONCE THE CAMERA MOVES.** `combatscale` scales
 *   `gladiators` and NOTHING ELSE — the sand is a sibling of `gladiators`
 *   inside the arena clip, not a parent of it — so zooming out does not shrink
 *   the ground, it walks the fighters UP the ground toward the horizon. Use
 *   `groundLineAt(camera)`; this constant is the `zoomscale === 100` case and
 *   is exported because it is the number the map and the handoffs quote.
 *   (That walk is the build's, and a PAIR still takes it. A team camera does
 *   not — see `SS2_TEAM_FRAMING`, authored.)
 */
export const SS2_GROUND_LINE = SS2_ARENA_ORIGIN.y + 200;

/**
 * HOW MUCH OF A RANK'S DEPTH IS DRAWN AS STAGE HEIGHT — **0.5, AUTHORED, and
 * only BEHIND the front rank.** `arenaToStage` draws depth `y` at
 *
 * ```text
 *   y_eff = y + max(0, 200 − y) × (1 − RANK_DEPTH_FACTOR)
 * ```
 *
 * so the three ranks at stride 97 (y 200, 103, 6) draw at 200, 151.5 and 103,
 * and **every position the build can reach — `y >= 200`, any zoom, any lift:
 * both vanilla fighters, the rocks at 210 — is drawn exactly where the build
 * draws it.**
 *
 * ► **BEHIND THE FRONT RANK IT APPLIES IN EVERY CAMERA, A PAIR'S INCLUDED, BY
 *   DESIGN.** The build has no rear ranks, so any fighter behind 200 is an
 *   authored position whatever the roster size, and the reason for the squash
 *   — the crowd's wall — does not care how many fighters the camera frames: a
 *   duellist at rank 2 on a pair's camera stood in arena 1's wall above zoom
 *   ~37 exactly as a 3v3's did. Only `SS2_TEAM_FRAMING` is team-only.
 *
 * ► **THIS SAID 1, "BECAUSE THE SAND IS PAINTED FOR ITS RANGE", AND THE CHECK
 *   BEHIND THAT WAS MADE AGAINST ART THAT IS NOT THE FLOOR.** It was measured
 *   (1d72c85) against char 673, the sand rectangle, which spans arena-local
 *   y −56.75..256.2 and holds all three ranks at factor 1. The same day,
 *   00eac13 began drawing the crowd's JPEG wall, which paints over the top of
 *   that sand — so the floor a figure is SEEN on starts at the wall's foot
 *   (`SS2_ARENA_WALL_BASE`), and at factor 1 the back rank stood inside arena
 *   1's wall at every zoom above ~37 and inside arena 5's above 9. The owner
 *   saw it: *"the gladiators appear too high ... up into the background"*.
 *   Nothing failed, because the test checked the sand.
 *
 * ► **THE RANKS ARE THIS ENGINE'S, NOT THE BUILD'S, SO THIS IS OURS TO CHOOSE.**
 *   Vanilla stands both clips at `_y` 200 and spends `_y` on the jump arc. At
 *   factor 1 a rank back drew as a rise of a whole stride — the same picture as
 *   a 97-unit jump. Halved, it reads as depth.
 *
 * ► **WHY 0.5 AND NOT MORE.** With the team framing (`SS2_TEAM_FRAMING`), the
 *   back rank's clearance above the foot of the wall is smallest in arena 5 at
 *   zoom 80, the tightest band: 0.56 puts its feet ON the line, and 0.5 leaves
 *   9.3px. ~~"Pinned for every arena at every zoom a camera reaches"~~ — **it
 *   was pinned for zooms 5..80, and the survivors' close-up reaches 100**: a
 *   back-ranker there stood 17.39px inside arena 5's wall at 97 (found
 *   2026-09-24). Past 80 the wall is now part of the close-up's own fit
 *   (`fitsVerticallyAt`), which holds the team framing's back rank to 82, and
 *   the pin covers every zoom the close-up can take each rank to.
 *
 * `1.7` remains in the authored-bowl path in the shell, where the "ground" is
 * a rectangle from the horizon down and any factor lands on it.
 */
export const RANK_DEPTH_FACTOR = 0.5;

/**
 * The front rank's depth, `SS2_ARENA.frontY` — restated rather than imported,
 * because this file imports nothing and the build fixes the number: both
 * vanilla fighters are constructed at `_y` 200 (root frame 221 `+0x06b9` /
 * `+0x0792`).
 */
const FRONT_RANK_Y = 200;

/**
 * WHERE EACH ARENA'S PAINTED WALL ENDS AND ITS FLOOR BEGINS — the line a
 * gladiator's feet have to stay below, in the CROWD clip's own units.
 *
 * ► **THE SAND IS NOT THE FLOOR, BECAUSE THE CROWD PAINTS OVER IT.** Char 673
 *   (`sand`) spans arena-local y −56.75..256.2, but char 2112 (`crowd`) sits
 *   above it in the arena clip and its tiles reach crowd-local 172..230,
 *   depending on the arena: the stands, the wall and a strip of painted floor,
 *   opaque wherever the wall is. So the floor a figure can be SEEN standing on
 *   starts where each crowd bitmap's wall ends, not where the sand rectangle
 *   starts.
 *
 * ► **MEASURED, AND HOW.** `row` is the first row of the bitmap below the
 *   wall's bottom edge: the row-mean colour of the decoded JPEG (with its alpha
 *   plane where it has one) jumps there, and a crop of each bitmap confirms it
 *   by eye. `crowdY` converts that row through the tile placements
 *   `assets/props/props.json` carries for the arena's frame of `crowd` —
 *   `ty / 20` (twips) plus the tile's own scale (0.5; 1 for arena 6's dais)
 *   times the fill's `bitmap.matrix.d / 20` shape units per pixel — and keeps
 *   the LOWEST over every tile, because a figure can stand in front of any of
 *   them. The test re-derives `crowdY` from `row` and the pack whenever there
 *   is one.
 *
 * ► **THE THRONE'S RECTANGLE IS NOT ITS FOOT.** Arena 6's dais is a 235x164
 *   bitmap whose bottom 38 rows are transparent, so reading its rectangle
 *   rather than its alpha plane puts that arena's floor 38 units too low.
 *
 * ► **THE STAGE LINE MOVES WITH THE CAMERA**, because `crowd._y = −200 +
 *   ceil(zoomscale)`: on stage it is `166.75 − 200 + ceil(zoomscale) +
 *   crowdY`. **Arena 5's is the lowest by 22 units**, and arena 6's is set by
 *   the throne dais (bitmap 2107) drawn over the middle of its wall rather than
 *   by the wall itself, which ends at crowd-local 93.04 (bitmap 717, row 244).
 */
export const SS2_ARENA_WALL_BASE = Object.freeze([
  Object.freeze({ arena: 1, bitmap: 1773, row: 437, crowdY: 165.45 }),
  Object.freeze({ arena: 2, bitmap: 2099, row: 270, crowdY: 162.96 }),
  Object.freeze({ arena: 3, bitmap: 2101, row: 298, crowdY: 157.04 }),
  Object.freeze({ arena: 4, bitmap: 2103, row: 334, crowdY: 169.61 }),
  Object.freeze({ arena: 5, bitmap: 2105, row: 404, crowdY: 191.83 }),
  Object.freeze({ arena: 6, bitmap: 2107, row: 126, crowdY: 134 })
]);

/**
 * Twips per stage pixel — the SWF format's own constant, applied to the `tx`
 * and `ty` a placement matrix carries.
 *
 * ► **RESTATED RATHER THAN IMPORTED FROM `text.js`, ON PURPOSE.** That module
 *   exports the same 20 under its own name because it needs it for four
 *   different unit conversions. Importing it here would create the one edge
 *   this file's UI-bar seam exists to avoid — see the header — for a number
 *   that is fixed by the file format and cannot drift. It is private, so there
 *   are not two exported spellings of one constant for a caller to choose
 *   between.
 */
const TWIPS_PER_STAGE_PIXEL = 20;

/**
 * THE UI BAR'S READOUTS: which text characters sprite 1531 places, and what
 * each one's value is a function of in the build.
 *
 * **No string the bar displays is here.** `valueOf` names the key a caller
 * supplies a value under; `drivenBy` and `site` name where the build computes
 * it, so the claim is checkable against the oracle rather than believed. The
 * four strings themselves are quoted in this file's header, as measurements
 * with their offsets.
 *
 * ► **`tooltips_text` IS THE TOGGLE'S LABEL, NOT THE TOOLTIP LINE**, and the
 *   name says otherwise, which is why it is written down. The hint text goes to
 *   `tooltip_box.tooltip` via `_root.tooltips(text, dur, x, y)`, a different
 *   object on a different timeline.
 *
 * `x` and `y` are the placement the build gives each field INSIDE the bar, in
 * pixels, stated here so a clone with no pack still knows the layout. They are
 * re-derived from the pack whenever there is one — `uiBarReadoutsFor` prefers
 * the pack's own matrix and says which it used.
 */
export const SS2_UI_BAR_READOUTS = Object.freeze([
  Object.freeze({
    field: 1527, instance: "soundvar", depth: 5, valueOf: "sound",
    x: 91, y: 3,
    drivenBy: "_root.pSound, through _root.toggleSound",
    site: "sprite:1531/frame:1/DoAction@0x3d3686 +0x0170 / +0x01a0",
    button: 1529
  }),
  Object.freeze({
    field: 1528, instance: "tooltips_text", depth: 6, valueOf: "tooltips",
    x: 2, y: 3,
    drivenBy: "the tooltips flag the depth-9 button flips",
    site: "sprite:1531/frame:1/instance:9/clip-action:0 +0x00bd / +0x00e2",
    button: 1530
  })
]);

/**
 * THE TWO READOUTS THE BUILD'S OWN SCRIPT WRITES AND THE BUILD NEVER PLACES.
 *
 * ► **AN ABSENCE NOBODY COUNTED IS THIS PROJECT'S SIGNATURE DEFECT**, so these
 *   are declared rather than omitted. Each name occurs exactly ONCE in the
 *   oracle's 7,586,504 bytes, inside sprite 1531's frame-1 constant pool, and
 *   walking every sprite's and the root's display list finds no placement named
 *   either. So each write lands on `undefined.text` and changes nothing on the
 *   screen.
 *
 * **This is where a count of FOUR fields comes from.** Read the script and the
 * bar has four readouts; read the display list and it has two. The script is
 * the older document.
 */
export const SS2_UI_BAR_UNPLACED = Object.freeze([
  Object.freeze({
    instance: "gfxvar", valueOf: "graphics",
    site: "sprite:1531/frame:1/DoAction@0x3d3686 +0x00e7",
    byteOffset: 0x3d3691, occurrences: 1,
    note: "written once, unconditionally; scanning the file for graphics:* finds one string, not two"
  }),
  Object.freeze({
    instance: "fullscreenvar", valueOf: "fullscreen",
    site: "sprite:1531/frame:1/DoAction@0x3d3686 +0x01ea / +0x0209, and _root.toggleFS +0x025b / +0x0284",
    byteOffset: 0x3d3734, occurrences: 1,
    note: "toggleFS is defined at +0x021d and its name occurs once, so it is never called either"
  })
]);

/**
 * THE SIX OBJECTS OF ROOT FRAME 221, in the build's own depth order.
 *
 * `space` is the load-bearing field and it is the thing a renderer gets wrong:
 *
 * - **`stage`** — placed on the ROOT, so the camera does not touch it. The
 *   backdrop, the sky, the rain, the UI bar and the border are all painted at
 *   fixed stage coordinates however far the arena has panned or zoomed.
 * - **`arena`** — placed inside `_root.arena`, whose `gladiators` child is what
 *   `combatscale` pans and scales. Everything that is part of the FIGHT lives
 *   here: the sand, the crowd, the rocks, the fighters, the arrows.
 *
 * ► **Getting that split wrong is the same class of error as the blood-versus-
 *   rocks trap already recorded in `props.js`**: which object something is
 *   attached to decides its coordinate space, and both look like a coordinate
 *   until the camera moves.
 *
 * `prop` is the key in an extracted pack. An entry whose prop is absent is
 * skipped, never faked — a clone with a partial extraction gets a partial arena
 * and a whole stack trace is a worse outcome than a missing rain layer.
 */
export const SS2_ARENA_SCREEN_LAYERS = Object.freeze([
  Object.freeze({
    order: 1, depth: 1, character: 643, instance: null, prop: "backdrop",
    space: "stage", behindFighters: true, x: 0, y: 0, scale: 1,
    note: "640 x 420 — the declared stage to the pixel; the sky and ground the fight happens against"
  }),
  Object.freeze({
    order: 2, depth: 3, character: 1729, instance: "sky", prop: "sky",
    space: "stage", behindFighters: true, x: 315.7, y: 216.85, scale: 1.04,
    // ► 200 frames, and they are a LOOKUP: `_root.sky.gotoAndStop(time_of_day)`
    //   with `_global.time_of_day = 1 + random(23)`, followed immediately by
    //   `cacheAsBitmap = true` — which a clip that played could not be. They
    //   resolve to six distinct skies.
    frameFrom: "timeOfDay",
    note: "the sky and its clouds; the ONE object on this frame that is not unscaled"
  }),
  Object.freeze({
    // ► **INSIDE the arena clip, at ITS depth 1** — so its placement is in
    //   arena-local units and `arenaOffset` is what turns it into a stage
    //   coordinate. The arena clip is placed UNSCALED, so nothing else changes.
    order: 3, depth: 1, character: 673, instance: "sand", prop: "sand",
    space: "arena", behindFighters: true, x: -323.95, y: -56.75, scale: 1,
    // `sand.gotoAndStop(current_arena)` (`+0x0d0f`) — SIX grounds, not one.
    frameFrom: "arena",
    // ► **THIS NOTE USED TO CALL THAT RANGE "the range that set
    //   RANK_DEPTH_FACTOR", AND IT WAS THE WRONG ART TO SET IT BY.** The crowd
    //   (order 4) paints its wall over the top of this sand, so the floor a
    //   figure is SEEN standing on begins at `SS2_ARENA_WALL_BASE`, not at -56.75.
    note: "the ground, arena-local y -56.75..256.2 — the crowd's wall paints over its top; the visible floor starts at SS2_ARENA_WALL_BASE"
  }),
  Object.freeze({
    // ► **THE ONE THING ON THIS SCREEN THE CAMERA MOVES BESIDES THE FIGHTERS.**
    //   `combatscale` ends `crowd._y = -200 + ceil(zoomscale)` (`+0x0ab1`), so
    //   the stands RISE as the camera pulls back. `y` here is the placement the
    //   timeline gives it; `cameraY` says the camera overwrites it, and note
    //   that the two disagree by 10.5 units — **the build's first camera frame
    //   moves the crowd whether or not the fight has started.**
    order: 4, depth: 3, character: 2112, instance: "crowd", prop: "crowd",
    space: "arena", behindFighters: true, cameraY: true, x: 1.05, y: -110.5, scale: 1,
    // `crowd.gotoAndStop(current_arena)` (`+0x0c99`) — the SAME index as the
    // sand, so one choice dresses both and they cannot disagree.
    frameFrom: "arena",
    note: "eight tiled stands; the one piece of scenery the camera moves"
  }),
  Object.freeze({
    order: 6, depth: 80, character: 1816, instance: "rain", prop: "rain",
    space: "stage", behindFighters: false, x: -310.35, y: -66.35, scale: 1,
    // ► **FRAMES 1-9 DRAW NOTHING; 10-17 CARRY THE WEATHER.** So frame 1 is
    //   "dry", and the default below lands there deliberately — a clear arena
    //   is the resting state, not a failed read. Ask for 10..17 to make it
    //   rain.
    frameFrom: "weather",
    note: "weather; frames 1-9 are empty and that is the clip at rest"
  }),
  Object.freeze({
    // ► **THE NOTE HERE USED TO SAY THE RENDERER DREW THE BAR'S TEXT. IT NEVER
    //   HAS.** What draws is the plate: four placements of shape 487 at four
    //   scales, 641 x 27 of art, plus two BUTTONS — which is what the empty
    //   boxes are. The two `DefineEditText` fields under them come back from
    //   `flattenFrame` as `unsupported: "text"` and are dropped, so the bar has
    //   always rendered wordless. `readouts` is the description that replaces
    //   the claim; `uiBarReadoutsFor` resolves it against a pack.
    order: 7, depth: 438, character: 1531, instance: "fiz_info_panel", prop: "panel",
    space: "stage", behindFighters: false, x: -0.5, y: 401, scale: 1,
    readouts: SS2_UI_BAR_READOUTS,
    note: "the bottom UI bar: 641 x 27 of plate and buttons, plus two text fields NOTHING here draws"
  }),
  Object.freeze({
    order: 8, depth: 1193, character: 646, instance: null, prop: "border",
    space: "stage", behindFighters: false, x: -25.55, y: -33, scale: 1,
    note: "the ornamental frame, 732 x 505 — larger than the stage on every side, and painted over everything"
  })
]);

/**
 * Where the fighters, the rocks, the arrows and the blood are painted, in the
 * same `order` the layers use — **`order` 5, between the crowd and the rain.**
 *
 * A number rather than a comment because the split is the thing a renderer gets
 * wrong: the border and the UI bar must paint OVER a gladiator, and the sand
 * and the crowd must paint UNDER one. Drawing all six layers first and the
 * fighters last looks right until an arrow flies over the frame.
 */
export const SS2_GLADIATORS_ORDER = 5;

/**
 * The arena clip's own origin as an offset a caller adds to an `arena`-space
 * layer. Named so that the two spaces are never mixed by accident.
 */
export const SS2_ARENA_OFFSET = SS2_ARENA_ORIGIN;

/**
 * THE CAMERA'S CONSTANTS, every one read off `combatscale`.
 *
 * The offsets are into `sprite:2249/frame:1/DoAction@0x6e421b`.
 */
export const SS2_CAMERA = Object.freeze({
  /**
   * The focus is kept between these two STAGE x positions, easing by
   * `1 / panEase` of the overshoot a frame (`+0x07b1`, `+0x07f2`).
   *
   * It straddles the arena origin: 300..340 is 320 ± 20, so "centred" for this
   * camera means the midpoint of the fight sits on the arena's own origin.
   */
  deadZoneLeft: 300,
  deadZoneRight: 340,
  /** `+0x0730` — stored into register 4 and divided by at `+0x07e2`/`+0x082b`. */
  panEase: 16,
  /** `+0x0723` — stored into register 5 and divided by at `+0x09cd`/`+0x0a1a`. */
  zoomEase: 5,
  /** `+0x0a3e`/`+0x0a60` — inside ±4 of the target, snap to it and stop easing. */
  zoomSnap: 4,
  /**
   * The zoom bands, in the build's own order, applied in that order with the
   * LAST match winning — which is what makes the 70 and 60 arms dead. See the
   * header. `test` is written as the bytes test it, not as the band it looks
   * like.
   */
  bands: Object.freeze([
    Object.freeze({ scale: 80, min: null, max: 240, site: "+0x083c" }), // midwaypoint < 240
    Object.freeze({ scale: 70, min: 240, max: 300, site: "+0x085e" }), // > 240 && !(> 300)  DEAD
    Object.freeze({ scale: 60, min: 300, max: 400, site: "+0x0898" }), // > 300 && !(> 400)  DEAD
    Object.freeze({ scale: 50, min: 200, max: 400, site: "+0x08d2" }), // > 200 && !(> 400)  eats both, and part of 80
    Object.freeze({ scale: 30, min: 400, max: 700, site: "+0x090c" }),
    Object.freeze({ scale: 20, min: 700, max: 1500, site: "+0x0946" }),
    Object.freeze({ scale: 15, min: 1500, max: null, site: "+0x097c" })
  ]),
  /**
   * `crowd._y = -200 + ceil(zoomscale)` (`+0x0ab1`). The crowd RISES as the
   * camera pulls back, which is the one parallax the build actually runs.
   */
  crowdBaseY: -200,
  /**
   * `_global.zoomscale = 5` (`+0x0c7c`), on the arena clip's own frame 1.
   *
   * ► **THE ARENA OPENS AT A TWENTIETH OF ITS SIZE AND RUSHES IN.** Five is not
   *   a floor or a sentinel — it is the first frame's zoom, and the ease then
   *   takes about sixteen frames to reach the target. Opening settled instead
   *   would be smoother, would look deliberate, and would delete the build's
   *   own establishing shot.
   */
  zoomStart: 5,
  /**
   * The floor the fit clamp will not go below — the build's own smallest band.
   * A roster wide enough to need less than this is one the arena cannot frame
   * at all, and drawing it at 15 with the flanks off the edge is a better
   * answer than drawing six specks.
   */
  zoomMinimum: 15
});

/**
 * WHERE A TEAM FIGHT STANDS ON THE STAGE — **AUTHORED, because the build never
 * shows one.** A camera framing more than two placed actors (`camera.team`)
 * keeps the front rank's feet `frontFraction` of the way down the VISIBLE
 * FLOOR — from the foot of arena 1's wall to the top of the UI bar — at every
 * zoom, and scales everything else about that line:
 *
 * ```text
 *   floor(z) = 166.75 + (−200 + ceil z) + 165.45     = 132.2 + z
 *   front(z) = floor(z) + 0.6 × (401 − floor(z))     = 293.48 + 0.4 z
 *   stage y  = front(z) + (y_eff − 200 − lift) × z/100
 * ```
 *
 * ► **WHY IT EXISTS: THE BUILD'S PIVOT WALKS A ZOOMED-OUT GROUP INTO THE WALL.**
 *   `combatscale` scales `gladiators` about the arena origin, stage y 166.75,
 *   so the front rank stands at `166.75 + 2z` — and the crowd's wall comes
 *   down only at `+z`. For a pair at the build's bands that is the build's own
 *   picture. A 3v3 is pulled back to fit — seed 7's with kits settled between
 *   zoom 18 and 52 — which shrinks the group up toward the wall and leaves
 *   130..200px of empty sand beneath it: at zoom 27 the front rank stood a
 *   quarter of the way down the visible floor. Here it stands at 60% at every
 *   zoom.
 *
 * ► **AND IT MEETS THE BUILD AT THE TIGHTEST BAND.** At zoom 80 the team's
 *   front line is 325.48, 1.27px above where the build's own pair stands
 *   (326.75) — so a team fight that closes to the build's closest band stands
 *   where a vanilla fight would. Below 80 the two part company, and that is the
 *   point.
 *
 * ► **ONE ARENA'S FLOOR FOR ALL SIX, AND THAT IS CHECKED RATHER THAN HOPED.**
 *   The band is measured from arena 1's wall foot, the default dressing. The
 *   other five sit between 31.45 units higher (arena 6) and 26.38 lower (arena
 *   5) — `SS2_ARENA_WALL_BASE` — and
 *   with `RANK_DEPTH_FACTOR` 0.5 every rank clears every arena's wall at every
 *   zoom from 5 to 80 — least in arena 5 at zoom 80, by 9.3px. A per-arena band
 *   would need the dressing inside the projection and buys nothing the test
 *   does not already guarantee. **Past 80 only the survivors' close-up goes,
 *   and it checks the wall itself** — the back rank to 82 (`SS2_CLOSE_UP`).
 *
 * ► **UNDER THE IN-FRAME TEAM HUD THE LINE IS LIFTED, NEVER LOWERED**, until
 *   the lowest ink of its front rank clears the HUD's top — see
 *   `SS2_TEAM_HUD`, which also caps the zoom where the lift would cost a
 *   framed back-ranker the floor.
 *
 * ► **A 1v1 NEVER READS THIS.** `team` is false for two placed actors, and
 *   `arenaToStage` then pivots about the arena origin exactly as the build
 *   does. (The depth squash is a separate thing and is NOT team-only — see
 *   `RANK_DEPTH_FACTOR`.)
 *
 * ► **AND A TEAM FIGHT CAN BECOME A PAIR MID-BOUT, SO THE FRAMING HANDS OVER
 *   RATHER THAN SWITCHING** (2026-09-24, AUTHORED like the rest of this). The
 *   camera frames only the fighters still standing (`framedActors`), so a 3v3
 *   whittled to one a side stops being `team` on the frame the fourth fall
 *   finishes. Switched outright, that frame moves the front line from the
 *   framing's `293.48 + 0.4z` to the build's `166.75 + 2z` — 46.73px at zoom
 *   50 and 78.73 at 30, the whole fight jumping up the sand. So the camera
 *   carries a `teamWeight` that eases between the two lines by `1/handoverEase`
 *   of the gap a frame — the zoom's own fifth, so the lift reads as the same
 *   camera move as the zoom it arrives with — and snaps inside `handoverSnap`.
 *   At zoom 80, where the two lines are 1.27px apart, the hand-over is
 *   invisible; elsewhere it is a glide.
 */
export const SS2_TEAM_FRAMING = Object.freeze({
  /** Whose wall foot the visible floor is measured from: the default dressing. */
  floorArena: 1,
  /** How far down the visible floor the front rank's feet stand. */
  frontFraction: 0.6,
  /** The team/pair hand-over eases by this fraction of the gap a frame: the zoom's `zoomEase`. */
  handoverEase: SS2_CAMERA.zoomEase,
  /** Inside this much of its target the hand-over snaps: under 1.2px at any zoom 5..80. */
  handoverSnap: 0.01
});

/** The stage y a TEAM camera stands its front rank on — see `SS2_TEAM_FRAMING`. */
function teamFrontLineAt(zoomscale) {
  const wall = SS2_ARENA_WALL_BASE.find((entry) => entry.arena === SS2_TEAM_FRAMING.floorArena);
  // The bottom of the visible floor is the top of the UI bar, which the build
  // paints over the fighters (`fiz_info_panel`, depth 438, stage y 401).
  const floorBottom = SS2_ARENA_SCREEN_LAYERS.find((layer) => layer.prop === "panel").y;
  // `crowd._y = -200 + ceil(zoomscale)`, exactly as `cameraStep` writes it.
  const floorTop = SS2_ARENA_ORIGIN.y + SS2_CAMERA.crowdBaseY + Math.ceil(zoomscale) + wall.crowdY;
  return floorTop + SS2_TEAM_FRAMING.frontFraction * (floorBottom - floorTop);
}

/**
 * The team line a camera actually stands its front rank on: the framing's
 * own, lifted — only ever lifted — until the lowest ink a front-ranker of the
 * camera's `inkSize` puts on the stage (`inkDepthAt`: his plate or his shadow)
 * is no lower than `camera.hudTop`. See `SS2_TEAM_HUD`. A camera carrying no
 * `hudTop` — every camera without a HUD — stands where it always has.
 */
function teamLineOf(camera) {
  const zoomscale = camera?.zoomscale ?? 100;
  const line = teamFrontLineAt(zoomscale);
  if (!Number.isFinite(camera?.hudTop)) return line;
  const size = Number.isFinite(camera.inkSize) ? camera.inkSize : 1;
  return Math.min(line, camera.hudTop - inkDepthAt(zoomscale / 100, size));
}

/**
 * Whether a set of FRAMED actors is a TEAM fight — more than the two
 * gladiators vanilla ever places. It chooses the projection's framing only;
 * the camera's own arithmetic is the build's for every roster size.
 */
function isTeamFight(input) {
  return actorsFrom(input).length > 2;
}

/**
 * How far a camera stands on the TEAM framing, 0 (the build's pair) to 1.
 *
 * A camera that carries no `teamWeight` — every camera written before the
 * hand-over existed, and every literal a test builds — reads its `team` flag
 * exactly as `arenaToStage` always has.
 */
function teamWeightOf(camera) {
  if (Number.isFinite(camera?.teamWeight)) return Math.min(1, Math.max(0, camera.teamWeight));
  return camera?.team === true ? 1 : 0;
}

/**
 * One frame of the team/pair hand-over — see `SS2_TEAM_FRAMING`. AUTHORED:
 * the build never frames a team, so it never hands one over.
 */
export function easeTeamWeight(weight, target) {
  if (!Number.isFinite(weight)) return target;
  const next = weight + (target - weight) / SS2_TEAM_FRAMING.handoverEase;
  return Math.abs(target - next) < SS2_TEAM_FRAMING.handoverSnap ? target : next;
}

/**
 * Every placed actor as `{x, side}`, from either shape a caller may hand in.
 *
 * A bare number is an actor with NO side, which is how the one-dimensional
 * callers and the tests express "just these positions".
 */
function actorsFrom(input) {
  const out = [];
  for (const entry of input ?? []) {
    if (Number.isFinite(entry)) out.push({ x: entry, side: null });
    else if (entry && Number.isFinite(entry.x)) out.push({ x: entry.x, side: entry.side ?? null });
  }
  return out;
}

/**
 * `midwaypoint`, the single number the build's zoom bands key on.
 *
 * `getfightdistance` sets it at `+0x0467`: `Math.round(fightdistance / 2)`,
 * where `fightdistance` is the build's own EUCLIDEAN distance between THE HERO
 * AND THE VILLAIN. So it is half the separation of **the two gladiators who are
 * fighting each other** — not half the width of the scene.
 *
 * ► **AND CONFLATING THOSE TWO WAS A REAL DEFECT, FOUND BY LOOKING AT IT.**
 *   The first version of this function took the SPREAD of every placed actor,
 *   on the reasoning that vanilla has one pair so the bytes cannot distinguish
 *   the two readings. True, and it picked the wrong one. Measured at the
 *   default 3v3 with `rankStride` 97:
 *
 * ```text
 *                 spread   midwaypoint   zoom   stage used   figure height
 *     1v1            500          250      50         55%         75 px
 *     2v2            760          380      50         76%         75 px
 *     3v3           1020          510      30         58%         45 px
 * ```
 *
 *   **The 3v3 was both smaller AND using less of the screen than the 2v2**,
 *   which is not perspective, it is a band cliff: crossing `midwaypoint` 400
 *   drops the zoom from 50 to 30, a 40% shrink for a 34% wider fight. The
 *   spread at a 3v3 opening is dominated by the outermost ALLIES, who are not
 *   fighting anybody — so the camera was pulling back to frame a formation
 *   while the fight happened in the middle of it. The owner saw it immediately:
 *   *"the zoom appears to be way too far out"*.
 *
 * ► **SO THIS IS THE CLOSEST ENGAGEMENT, which IS the build's meaning.** The
 *   minimum separation over opposing pairs: at one pair it is exactly
 *   `fightdistance`, and at six it is "how close is the closest fight", which
 *   is the question the bands were calibrated against. **Keeping everybody on
 *   stage is a separate job and is done separately**, by `fitZoomFor` — because
 *   a camera has two duties and giving one number both of them is what went
 *   wrong here.
 *
 * @param {Array<number|{x:number, side:*}>} input  every PLACED actor
 */
export function midwaypointFor(input) {
  const placed = actorsFrom(input);
  if (placed.length < 2) return 0;
  const sides = new Set(placed.map((actor) => actor.side).filter((side) => side !== null));
  if (sides.size < 2) {
    // No sides to oppose — the whole field is the fight, which is also the
    // vanilla case and reduces to `fightdistance / 2` at two actors.
    const xs = placed.map((actor) => actor.x);
    return Math.round((Math.max(...xs) - Math.min(...xs)) / 2);
  }
  let closest = Infinity;
  for (const actor of placed) {
    for (const other of placed) {
      if (other.side === actor.side) continue;
      closest = Math.min(closest, Math.abs(actor.x - other.x));
    }
  }
  return Number.isFinite(closest) ? Math.round(closest / 2) : 0;
}

/**
 * A gladiator's own half-width in arena units, for the fit below.
 *
 * AUTHORED: about 105 units of reach and body either side of where a gladiator
 * stands. It is a margin, not a measurement — being ten units out moves the fit
 * by under two percent.
 *
 * ► ~~"it is the same figure `viewportFor` has carried since the arena was
 *   first drawn"~~ — **not since 2026-09-23**, when the fitted view's margin
 *   was rescaled with the authored figure to `0.7 * SS2_FIGURE_HEIGHT` (155.9).
 *   This one was deliberately LEFT, because it frames the build's own rig,
 *   and measured against that rig it is already right: at `_yscale` 100 the
 *   rig reaches -118.9 to +120.9 across its walks, attacks, hurts, shots, taunt
 *   and defend (±44-48 standing; the death clips spread to ±390 and are not
 *   framed for), so ~104 at the demo roster's `_yscale` 86. A strength-50
 *   gladiator (`_yscale` 113) reaches ~137, 32 past this margin, and only when
 *   the fit rather than a zoom band is what binds.
 */
export const FIGURE_HALF_WIDTH = 105;

/**
 * THE ZOOM AT WHICH EVERY PLACED ACTOR STILL FITS THE STAGE.
 *
 * ► **THIS IS OURS, AND IT IS THE HALF OF THE CAMERA VANILLA NEVER NEEDED.**
 *   Two gladiators who start 500 apart and only close never threaten the edge
 *   of a 640px stage, so the build's bands never had to care. Six do: a 3v3
 *   opens 1020 wide and the rank verbs can spread it further.
 *
 * It is a CEILING, never a floor — `cameraStep` takes the smaller of this and
 * the band, so it can only ever pull the camera BACK. That ordering is what
 * keeps the build's own 1v1 byte-for-byte unchanged: at two gladiators this
 * number is ~90 and the band is 50, so the band wins and nothing here applies.
 */
export function fitZoomFor(input) {
  const placed = actorsFrom(input);
  if (placed.length === 0) return SS2_CAMERA.bands[0].scale;
  const xs = placed.map((actor) => actor.x);
  const needed = (Math.max(...xs) - Math.min(...xs)) + FIGURE_HALF_WIDTH * 2;
  if (needed <= 0) return SS2_CAMERA.bands[0].scale;
  // Floored, not rounded: rounding up is the direction that puts a shoulder
  // off the edge, and the whole point of this number is that it does not.
  return Math.max(SS2_CAMERA.zoomMinimum, Math.floor((SS2_STAGE.width / needed) * 100));
}

/**
 * Where the camera is looking, in ARENA units.
 *
 * The build writes `midway_focus._x = leftmost._x + midwaypoint` in both
 * `combatCamera` (`+0x0501` / `+0x052e`) and `combatscale` (`+0x06ee` /
 * `+0x0721`) — the leftmost of the two, never the hero specifically.
 *
 * ► **AND IT IS NOT QUITE THE MIDPOINT IN THE BUILD, WHICH IS REPRODUCED.**
 *   `midwaypoint` is half the EUCLIDEAN distance, so two gladiators at
 *   different `_y` put the focus slightly RIGHT of the true x-midpoint. Here
 *   `midwaypointFor` takes the x-spread, so the focus IS the midpoint — the
 *   divergence is the same one named above and is stated in both places rather
 *   than in neither.
 */
export function focusXFor(input) {
  const placed = actorsFrom(input).map((actor) => actor.x);
  if (placed.length === 0) return 0;
  // ► **THE FOCUS IS THE MIDDLE OF EVERYBODY, NOT THE MIDDLE OF THE CLOSEST
  //   FIGHT**, and that is deliberate now that the two differ. The zoom's job
  //   is to follow the drama; the focus's job is to keep the scene centred, and
  //   pointing the camera at one duel would slide the rest of the roster off
  //   the opposite edge. At vanilla's single pair the two are the same point.
  return (Math.min(...placed) + Math.max(...placed)) / 2;
}

/**
 * The zoom the camera is easing TOWARD, from the separation.
 *
 * Applied in the build's order with the last match winning, which is the build's
 * own semantics for a run of `if`s. See `SS2_CAMERA.bands`.
 */
export function zoomTargetFor(midwaypoint) {
  if (!Number.isFinite(midwaypoint)) return SS2_CAMERA.bands[0].scale;
  let scale = SS2_CAMERA.bands[0].scale;
  for (const band of SS2_CAMERA.bands) {
    const overMin = band.min === null ? true : midwaypoint > band.min;
    const underMax = band.max === null ? true : !(midwaypoint > band.max);
    // The first band is the only one written as a strict `<`, at `+0x083c`.
    const matches = band.min === null ? midwaypoint < band.max : overMin && underMax;
    if (matches) scale = band.scale;
  }
  return scale;
}

/**
 * One frame of the zoom ease — `+0x0994`..`+0x0a7c`.
 *
 * `Math.round` is the build's, and it is why this converges rather than
 * crawling: a gap of 1 to 4 rounds to 0 or 1 and the snap below catches the
 * rest.
 *
 * A non-finite input takes the target. That is a GUARD here and not a model of
 * anything — the build initialises `_global.zoomscale` to 5 and never leaves it
 * undefined. It exists so a caller that has not seeded a camera draws an arena
 * rather than a blank canvas.
 */
export function easeZoom(zoomscale, target) {
  if (!Number.isFinite(zoomscale)) return target;
  let next = zoomscale;
  if (next > target) next -= Math.round((next - target) / SS2_CAMERA.zoomEase);
  if (next < target) next += Math.round((target - next) / SS2_CAMERA.zoomEase);
  // The snap is written as a two-sided test rather than an `abs`, so it is
  // written that way here: it fires on the frame the ease lands inside ±4.
  if (next > target - SS2_CAMERA.zoomSnap && next < target + SS2_CAMERA.zoomSnap) next = target;
  return next;
}

/**
 * One frame of the pan — `+0x07a9`..`+0x082d`.
 *
 * The build tests the focus's STAGE x, which it gets by calling
 * `gladiators.localToGlobal` on the focus point. That composition is done by
 * the caller here and handed in, because doing it inside would need this pure
 * module to know the whole display tree.
 *
 * Returns the NEW `gladiators._x`, in arena units.
 */
export function panStep(gladiatorsX, focusStageX) {
  if (!Number.isFinite(focusStageX)) return gladiatorsX;
  let next = gladiatorsX;
  if (focusStageX < SS2_CAMERA.deadZoneLeft) {
    next += (SS2_CAMERA.deadZoneLeft - focusStageX) / SS2_CAMERA.panEase;
  }
  if (focusStageX > SS2_CAMERA.deadZoneRight) {
    next -= (focusStageX - SS2_CAMERA.deadZoneRight) / SS2_CAMERA.panEase;
  }
  return next;
}

/**
 * The camera's opening state for a set of actors — the build's own first frame.
 *
 * ► **IT OPENS AT `zoomscale` 5 AND RUSHES IN**, because `_global.zoomscale = 5`
 *   is what the arena clip's frame 1 sets (`+0x0c7c`) and `combatscale` then
 *   eases toward the band target by a fifth a frame. `gladiators._x` opens at 0
 *   because root frame 221 sets it there explicitly (`+0x04ad` / `+0x04ce`).
 *
 *   **An earlier version of this function opened SETTLED**, on the mistaken
 *   ground that the build never initialised `zoomscale` at all. It does, and
 *   the value it chooses is the establishing shot.
 */
export function cameraFor(xs) {
  const midwaypoint = midwaypointFor(xs);
  return Object.freeze({
    midwaypoint,
    focusX: focusXFor(xs),
    zoomscale: SS2_CAMERA.zoomStart,
    maxscale: targetZoomFor(midwaypoint, xs),
    gladiatorsX: 0,
    crowdY: SS2_CAMERA.crowdBaseY + Math.ceil(SS2_CAMERA.zoomStart),
    team: isTeamFight(xs),
    // A new bout opens ON its framing, never easing into it.
    teamWeight: isTeamFight(xs) ? 1 : 0
  });
}

/**
 * The zoom the camera is easing toward: **the build's band, pulled back only as
 * far as fitting everybody requires.**
 *
 * ► **THE `min` IS THE WHOLE DESIGN.** The band is the build's own drama and it
 *   wins whenever it can; the fit can only ever OVERRIDE IT DOWNWARD, never
 *   raise it. So a vanilla 1v1 — where the fit is around 90 and the band is 50
 *   — is exactly what it was before this function existed, and a 3v3 that would
 *   have its flanks off the edge gets pulled back by the smallest amount that
 *   puts them on.
 */
export function targetZoomFor(midwaypoint, input) {
  return Math.min(zoomTargetFor(midwaypoint), fitZoomFor(input));
}

/**
 * One frame of the camera, in the build's own order: focus, then pan, then
 * zoom target, then zoom ease, then the crowd.
 *
 * **Order matters and is the build's.** `combatscale` pans against the focus's
 * stage position computed at the OLD zoom, then re-targets the zoom — so a
 * frame that both pans and zooms lags the zoom by one frame. Reproducing that
 * costs nothing and inventing a "corrected" order would be a change nobody
 * asked for.
 *
 * ► **`targetFor` REPLACES ONLY THE TARGET**, and only for the authored team
 *   close-up and, under the in-frame team HUD, the cap that keeps a team bout's
 *   cameras above it (`stepFramedCamera`, `SS2_TEAM_HUD`). It is handed this
 *   frame's pan and `midwaypoint`, so a target can respect where the camera
 *   actually is; the order, the ease, the snap and the crowd stay the build's.
 *   Absent, this is `combatscale` unchanged.
 *
 * @param {object}   camera  the previous frame's camera, from `cameraFor`
 * @param {number[]} xs      arena x of every placed actor
 * @param {{targetFor?: function({midwaypoint:number, focusX:number, gladiatorsX:number}): number}} [options]
 */
export function cameraStep(camera, xs, { targetFor = null } = {}) {
  const midwaypoint = midwaypointFor(xs);
  const focusX = focusXFor(xs);
  const zoom = camera.zoomscale;
  // `localToGlobal` on the focus: the arena's own origin, plus the pan, plus
  // the focus scaled by the zoom the gladiators layer is CURRENTLY at.
  const focusStageX = SS2_ARENA_ORIGIN.x + camera.gladiatorsX + focusX * (zoom / 100);
  const gladiatorsX = panStep(camera.gladiatorsX, focusStageX);
  const maxscale = typeof targetFor === "function"
    ? targetFor({ midwaypoint, focusX, gladiatorsX })
    : targetZoomFor(midwaypoint, xs);
  const zoomscale = easeZoom(zoom, maxscale);
  return Object.freeze({
    midwaypoint,
    focusX,
    zoomscale,
    maxscale,
    gladiatorsX,
    crowdY: SS2_CAMERA.crowdBaseY + Math.ceil(zoomscale),
    team: isTeamFight(xs),
    // `team` is where the framing is GOING; `teamWeight` is where it is. They
    // differ only for the few frames after a team is whittled to a pair.
    teamWeight: easeTeamWeight(teamWeightOf(camera), isTeamFight(xs) ? 1 : 0)
  });
}

/**
 * WHO THE CAMERA FRAMES — **AUTHORED for team play; a vanilla pair never reads
 * it.** Owner, 2026-09-24: *"If a fighter dies, the arena cam can zoom in on
 * the remaining fighters."*
 *
 * The build is 1v1 and a death there ENDS the bout, so `combatscale` never had
 * a fallen gladiator to leave out: `getfightdistance` measures `hero` to
 * `villain`, always. A team bout goes on past its first death, and until this
 * rule the camera went on framing every body as a combatant. For a roster of
 * MORE than two the camera frames:
 *
 * 1. **Every fighter still standing.**
 * 2. **Plus every fallen fighter whose clips are still being DRAWN** — the
 *    reaction to the killing blow and the death queued behind it
 *    (`timelinesForStep`), or a victim still waiting on the arrow or fireball
 *    that kills it. `drawing` is the shell's `playing.has(id)`, and an entry
 *    leaves `playing` on the frame `animationCursor` expires its last link —
 *    the frame the body comes to rest. So the camera never moves off a fall
 *    that is still being drawn; it moves once the body is at rest.
 * 3. **Once the bout has a result, only its WINNERS are framed** among the
 *    living, while they celebrate. Every result is an elimination today
 *    (`battleStanding`), so rule 1 already leaves each loser out; the filter
 *    states the intent rather than leaning on that. **One winner is framed
 *    alone**: the focus is his own x, the projection is the pair's, and the
 *    close-up below takes him to at most 100.
 * 4. **Nobody left to frame** — a draw, once its last fall is drawn — frames
 *    the whole roster, bodies included, rather than handing the camera an empty
 *    set, which it would read as a close-up on arena x 0.
 *
 * A roster of TWO or fewer is the build's and comes back whole, bodies
 * included, so a 1v1 is `combatscale` through its death and its celebration
 * exactly as before.
 *
 * Who is framed moves the camera by its own rules — the focus moves and the
 * pan follows by its sixteenth, and a team whittled to one a side hands its
 * framing over to the pair's by `SS2_TEAM_FRAMING`'s ease. HOW CLOSE it goes
 * once somebody has fallen is `SS2_CLOSE_UP`'s, below: framing the living
 * alone was measured to never close in at all.
 *
 * @param {Array<{x:number, side?:*, teamId?:*, alive?:boolean, drawing?:boolean}>} roster
 *   every PLACED actor, living or fallen
 * @param {{result?: {winnerTeamId?: *}|null}} [options]  the bout's result, once it has one
 */
export function framedActors(roster, { result = null } = {}) {
  const placed = placedIn(roster);
  if (placed.length <= 2) return placed;
  const winner = result?.winnerTeamId ?? null;
  const framed = placed.filter((actor) => {
    if (actor?.alive === false) return actor.drawing === true;
    return winner === null || actor?.teamId === winner;
  });
  return framed.length > 0 ? framed : placed;
}

/** Every roster entry with a position — a bare number, or an object with a finite `x`. */
function placedIn(roster) {
  return [...(roster ?? [])].filter((entry) => Number.isFinite(entry) || Number.isFinite(entry?.x));
}

/** The roster's identity: its placed ids, SORTED, so a lane change is not a new roster. */
function rosterKeyOf(roster) {
  return JSON.stringify([...(roster ?? [])].map((entry, index) => String(entry?.id ?? `#${index}`)).sort());
}

/**
 * THE SURVIVORS' CLOSE-UP — **AUTHORED, at the owner's request (2026-09-24):
 * *"If a fighter dies, the arena cam can zoom in on the remaining fighters."***
 * The build has no such shot: its 1v1 ends at the first death, and its
 * tightest band is 80. None of this is `combatscale`, and a 1v1 never reads it.
 *
 * ► **WHY IT EXISTS: FRAMING THE LIVING ALONE NEVER CLOSED IN.** Measured
 *   2026-09-24 over 20 default spectated bouts (3v3 seeds 1-12, 2v2 seeds 1-8,
 *   101,167 frames at 60fps): `framedActors` with the build's own band and fit
 *   was tighter than the old camera in 0 frames and LOOSER in 3,197. The first
 *   to fall are front-rankers standing inside the living formation, so leaving
 *   them out narrows nothing; and a body within reach of a living enemy had
 *   been holding the band at 80, so without it two archers 760 apart fell to
 *   the band's 50.
 *
 * ► **THE RULE, in a team bout (more than two placed) once a fall has
 *   finished being drawn:**
 *   1. **A death never lowers the zoom target.** The floor is the OLD camera's
 *      target — the build's band and fit over every placed actor, bodies
 *      included — which a death cannot move, because a body stays placed
 *      where it fell. So the target is at least what it was just before each
 *      death, and at least what the old camera wanted on every frame after.
 *   2. **Above the floor, the tightest zoom — capped at `zoomCap` — at which
 *      every FRAMED fighter fits the visible stage in every pose he can
 *      strike** (`closeUpZoomFor`). ~~max(band, fit)~~ collapses to this: a
 *      band tighter than the fit would crop somebody, and a band looser than
 *      it is beaten by it.
 *   3. **One winner alone gets the same close-up**, at most 100.
 *   4. **When the floor beats what fits, the frame is the OLD camera's** — its
 *      pan and its framing, not only its zoom (`heldByFloor`). "What fits" is
 *      the settled fit AND the fit at the pan this camera actually has, so the
 *      camera follows the survivors only once it can hold them at the floor.
 *      Keeping the old zoom but panning to the survivors moved a crop from one
 *      fighter onto another: Codex's review, 2026-09-24, four front-rankers at
 *      -420, -100, 150 and 220, `_yscale` 86, the one at 220 falls — the floor
 *      held 75 over a fit of 56, the pan went from 55.05 to 81.30, and the
 *      survivor at 150's measured reach went from 615.92 to 642.17, past the
 *      stage's 639. No pan fits those three at 75 (their measured extent is
 *      684px), so a clamped pan is not an option; the old pan is the only one
 *      that leaves nobody worse off than the camera did before this rule.
 *      ► **"THE OLD PAN" MEANS THE OLD CAMERA, CARRIED ALONGSIDE.** The first
 *        fix stepped the old RULE from this camera's own state instead, and the
 *        build's dead zone kept the two pans up to 40px apart for good — inside
 *        300..340 the pan does not move — which a randomised sweep measured as
 *        crops 60+ frames after a switch. `stepFramedCamera` now steps 2c075df's
 *        camera beside this one every frame, and a held frame is that camera.
 *      ► **SWITCHING IS A BLEND, NOT A CUT**, eased by the zoom's fifth. Stage x
 *        is linear in the pan and the zoom, so a blended frame crops nobody more
 *        than the worse of its two ends — it is the one place the rule can crop
 *        more than the old camera, for the length of the blend. Measured, not
 *        guessed: cutting instead roughly halves those frames, and is a jump.
 *        ► **STAGE y IS NOT LINEAR IN IT**: the zoom and the framing weight are
 *          lerped separately, so a foot's y is bilinear in the blend's weight,
 *          and a blend between two cameras that each kept a back-ranker off the
 *          wall stood him 1.59px from it (the verifier, verify:camera-r1,
 *          2026-09-24; in 808f6da too). Every blend is now brought down onto
 *          the floor at its own weight (`groundedBlend`).
 *   5. **Never looser than the old camera is right now** — its zoom, not only
 *      its target: this camera must not settle on its own target while the old
 *      one is still easing down from above it.
 *   6. **The zoom DRAWN fits, not only the target** (Codex's review, pass 3,
 *      2026-09-24). The target is fitted but the zoom only EASES to it, so a
 *      fit that falls faster than a fifth a frame left the drawn zoom cropping
 *      with nothing held: the centre pair of a tight 3v3 at ±65, close-up 96,
 *      and the one at +65 walks out to 190 — what fits at the pan fell to 73,
 *      the zoom went 91, 88, 85 ..., and his measured swing reached 714.21
 *      against the old camera's 638.23 for seven frames. So every frame the
 *      drawn zoom is brought inside what fits at the pan it HAS and no looser
 *      than the old camera (`closeUpZoomRangeAt`), and where no zoom is both,
 *      the frame is held. **The cost is a cut:** a fit that falls at once — a
 *      walk's span is taken whole from its first frame — takes the zoom with
 *      it in one frame (96 to 73 there), where the ease took seven.
 *      ► **WHAT FITS AT A PAN IS A RANGE, NOT A CEILING.** Once the pan has put
 *        arena x 0 off the stage — a lone winner out on a flank — zooming out
 *        slides a swing TOWARD that origin and so off the edge, and the fit has
 *        a floor too. Found the same day by a targeted search, not by the
 *        sweep: the default 3v3's flank at -510 walking in to -260 was cropped
 *        145px while the ceiling-only fit called 100 safe.
 *      ► **THE CHECK FEEDS NOTHING BACK.** This camera's own ease and pan run
 *        unchecked; only what is drawn is brought inside. Fed back, the floor
 *        dragged the zoom up, the pan chased a focus that moves with the zoom,
 *        the floor rose again, and the hold caught it 38 times in four seconds.
 *   The target moves; the zoom still eases to it by the build's fifth.
 *
 * ► **"FITS" IS MEASURED, NOT GUESSED** — against the player's own rig
 *   (`assets/figure/`, READ-ONLY), across all 88 non-death clips of the pack's
 *   101, every pose, and the 72 loadout+look combinations of the demo rosters
 *   of those 20 bouts (and six 1v1 seeds), at `_yscale` 100:
 *   - `reach` **200**: the widest pose either side of the feet is 199.1 units
 *     (`wincrowd5`, a crowd celebration; `hurt11` 197, `attack8` 176).
 *   - `crown` **367**: the highest point above the feet is 366.8 (`wincrowd2`).
 *   - `lunge` **74**: `timeline.js`'s `ADVANCE_UNITS`, the most a pose's
 *     `advance` moves the drawn figure on top of the rig's own clip.
 *   Each is scaled by the fighter's `|_yscale| / 100` and not by the rank's
 *   perspective (which only shrinks him), so the margin is a ceiling.
 *   - **The name plate** is drawn `namePlateDrop` (22) units BELOW the feet
 *     (`tools/arena/main.js`, `view.toY(origin.y, -22)`) at
 *     `max(10, 15 * zoom/100)` px, centred; its descent and its outline are
 *     allowed for below (`namePlateDepthAt`).
 *   - **The feet stay on the floor**: `wallMargin` (5) px below the foot of
 *     the lowest arena's painted wall, `SS2_ARENA_WALL_BASE` (2026-09-24; until
 *     then a back-ranker could be framed inside it — see `fitsVerticallyAt`).
 *     Horizontally the swing margin covers it — 172 units at the demo roster's
 *     `_yscale` 86 is a name of about 38 characters at 0.6 em a character, and
 *     the demo names are 5.
 *   - **The DEATH clips are NOT fitted**, and that is a decision: `death2`
 *     flings the body 619.7 units behind the feet (`death3` 483), which no
 *     zoom of 50 or tighter holds anywhere but mid-stage, and the build frames
 *     none of it either. A dying fighter is framed by where he stands.
 *   - **Nor is an arrow's arc**, also a decision: framing a lob would pull
 *     the camera out and back on every shot. The arrow outlives the zoom by
 *     at most its flight, and its landing is inside the fighters' own frame.
 *
 * ► **THE VISIBLE STAGE, measured by painting only the border (char 646) and
 *   the UI bar (char 1531) and scanning out from (320, 200):** the border
 *   covers row 0 and column 639 and nothing else; the bar's plate covers from
 *   row 398 (it hangs 2.55px above its own y of 401). So x 0..639, y 1..398.
 *   At the cap a front-rank pair's feet are at 366.75 — 34.25px above the
 *   bar's y and 31.25 above the plate — and its name plate's baseline at
 *   388.75, 9px of room below it at a 15px font.
 *
 * ► **PAST 90 THE CROWD'S TOP EDGE COMES ONTO THE STAGE in arenas 1, 5 and 6**
 *   (measured: the crowd layer's top at zoom 80/90/100 is -8.3/1.7/11.7 in
 *   arena 1), because `crowd._y = -200 + ceil(zoom)` keeps lowering it, and up
 *   to ~12px of sky shows above the stands. **Not treated as a defect:** arenas
 *   2, 3 and 4 already show sky above their crowd at the build's own zooms —
 *   from 37, 60 and 69 — so it is a picture the build draws, not one it hides.
 *
 * ► **THE FLOOR CAN HOLD A CROP, AND THAT IS THE ORDER OF THE RULES.** Where
 *   the old camera crops a fighter — a walk stepping past the edge, a pair of
 *   winners celebrating at 80 — rule 1 keeps the frame there. ~~"every one of
 *   the 433 is a frame the old camera also crops ... The close-up itself never
 *   crops"~~ **was true only of what that measurement could see, and Codex's
 *   review broke it (2026-09-24).** It checked the DRAWN pose in the 20 demo
 *   bouts, whose formations are symmetric and whose fighters were rarely in
 *   their widest pose at the wrong moment; the rule promises the measured
 *   swing, and an asymmetric fall broke that promise with no drawn pose to
 *   show it. So the sweep is now two:
 *   - **the 20 demo bouts, drawn pose, frame by frame** (101,167 frames at
 *     60fps): 461 frames with a framed fighter off the stage with either
 *     camera and none that the old one does not also crop; tighter in 13,172,
 *     looser in 0, at most 100. The six 1v1 seeds: identical in every frame.
 *   - **2,000 random layouts on each of two seeds** (4.0M frames: asymmetric
 *     positions, sizes 70..130, all three ranks, falls, walks, a result),
 *     measured swing, per fighter per frame against 2c075df's own module:
 *     looser in 0 frames; a new crop in 240 and 161 frames (129 and 90 by the
 *     reach alone, Codex's geometry), ~~"every one a blend or a close-up easing
 *     down after a walk"~~ — **the second kind was rule 6's defect, not an
 *     allowance** — the worst 40px; against 1,897 and 418 before the fix.
 *     The old camera crops somebody's measured swing in ~80% of those frames.
 *     **With rule 6, re-measured on the same seeds:** looser in 0; a new crop
 *     in 127 and 83 frames (67 and 60 by the reach alone), EVERY ONE inside a
 *     blend into a hold, the worst 6.86 and 21.36px; and none at all while no
 *     switch is under way, where there had been 96 and 62 (the walker's whole
 *     span, as the camera is handed it: 199 and 206, the worst 118.68px, now
 *     0). The price, on the same frames: one-frame zoom drops over 10 went
 *     from 7 and 6 to 30 and 26, the largest from 15.6 to 38 and 24. The 20
 *     demo bouts and the six 1v1 seeds are frame-for-frame unchanged by it.
 *
 * ► **AND THE CAMERA HAS TO GET THERE WITHOUT CROPPING ON THE WAY.** The fit is
 *   taken twice: once for wherever the pan settles inside the build's dead zone
 *   (300..340), and once for THIS frame's pan, which lags the focus by a
 *   sixteenth a frame. The smaller wins, so the zoom only rises as fast as the
 *   pan brings the fighters in. A fighter's x is widened to every place he is
 *   drawn during his current clip — the walk's `from` and `to`, a blink's
 *   `blink` — and his depth to both ends of a lane change (`actorSpanFor`),
 *   because the scene holds the DESTINATION and the figure is drawn on the way.
 */
export const SS2_CLOSE_UP = Object.freeze({
  /** The owner's cap: 100, past the build's own tightest band of 80. */
  zoomCap: 100,
  /** Widest non-death pose either side of the feet at `_yscale` 100: measured 199.1. */
  reach: 200,
  /** Highest non-death pose above the feet at `_yscale` 100: measured 366.8. */
  crown: 367,
  /** `ADVANCE_UNITS` in `timeline.js`: the most a lunge moves the drawn figure. */
  lunge: 74,
  /** The name plate's baseline, in arena units below the feet (`main.js`). */
  namePlateDrop: 22,
  /**
   * The name plate's font: `max(10, 15 * zoom / 100)` px; the glyph's descent
   * budgeted as a fraction of it; and the stroke the name is outlined with,
   * `max(2, 0.24 * px)` wide (`namePlateLayout` in `tools/arena/team-hud.js`),
   * half of which lies outside the glyph. See `namePlateDepthAt`, the ONE place
   * these are added up.
   */
  namePlateFont: Object.freeze({ units: 15, minimumPx: 10, descent: 0.3, outline: 0.24, outlineMinimumPx: 2 }),
  /**
   * The authored shadow's lowest point below the feet, in arena units at
   * `_yscale` 100: `paintShadow`'s `ry` at the widest build (bulk 1.19) and the
   * widest stance a pose declares (`legSpread` 1) is 33.79. Every fighter is
   * drawn with it, the extracted rig included.
   */
  shadowDepth: 33.8,
  /** How far above the foot of the painted wall a framed fighter's feet must stay, stage px. */
  wallMargin: 5,
  /** What the border and the UI bar leave visible, in stage px. Measured; see above. */
  visible: Object.freeze({ left: 0, right: 639, top: 1, bottom: 398 })
});

/**
 * HOW FAR BELOW A FIGHTER'S FEET HIS NAME PLATE'S INK REACHES, in px, at `k` px
 * per arena unit (`zoomscale / 100` on the stage; the fitted view's `scale`).
 * **The one place the plate's depth is added up**: the drop to the baseline,
 * the glyph's descent and the half of the outline stroke outside the glyph.
 *
 * ► ~~`descent: 0.3`, and nothing else~~ UNDER-BUDGETED THE PLATE IT MEASURED
 *   (found 2026-09-24 by the HUD's camera study): the underline the plate then
 *   carried reached 0.34..0.41 px below the baseline. D1 took the underline
 *   away and kept the stroke, which alone adds 0.12 px to the glyph.
 * ► **THE FONT'S 10px FLOOR IS IN CANVAS PIXELS** (`tools/arena/main.js`
 *   draws `max(10, view.scale * 15)`), so in stage pixels this is exact at a
 *   fit scale of 1 and generous above it — every canvas at least 640x420. A
 *   smaller canvas draws the plate a little deeper than this says.
 */
export function namePlateDepthAt(k) {
  const { namePlateDrop, namePlateFont } = SS2_CLOSE_UP;
  const px = Math.max(namePlateFont.minimumPx, namePlateFont.units * k);
  const outside = Math.max(namePlateFont.outlineMinimumPx, namePlateFont.outline * px) / 2;
  return namePlateDrop * k + namePlateFont.descent * px + outside;
}

/**
 * HOW FAR BELOW A FIGHTER'S FEET ANYTHING OF HIS IS DRAWN, at `k` px per unit
 * and his `size` (`|_yscale| / 100`): his plate or his shadow, whichever
 * reaches lower. A rank's own perspective only shrinks the shadow, so `size`
 * unshrunk is a ceiling.
 */
export function inkDepthAt(k, size = 1) {
  return Math.max(namePlateDepthAt(k), SS2_CLOSE_UP.shadowDepth * size * k);
}

/**
 * Where a fighter is drawn during his current clip, as a span: his resting x
 * and y widened by the running entry's travel (`from`/`to`), blink and lane
 * change. The scene holds the DESTINATION of every move from the moment it is
 * folded, so without this a camera frames a walker where he is going while he
 * is drawn where he was.
 *
 * @param {{x:number, y?:number}} actor  the scene actor
 * @param {object|null} entry  his `playing` entry, if any
 */
export function actorSpanFor(actor, entry = null) {
  const xs = [actor?.x, entry?.motion?.from, entry?.motion?.to, entry?.motion?.blink].filter(Number.isFinite);
  const ys = [actor?.y, entry?.depthMotion?.from, entry?.depthMotion?.to].filter(Number.isFinite);
  return Object.freeze({
    xMin: xs.length ? Math.min(...xs) : null,
    xMax: xs.length ? Math.max(...xs) : null,
    yMin: ys.length ? Math.min(...ys) : null,
    yMax: ys.length ? Math.max(...ys) : null
  });
}

/** A framed actor's geometry for the close-up: its span, its depth span and its scale. */
function closeUpGeometryOf(entry) {
  const x = Number.isFinite(entry) ? entry : entry.x;
  const y = Number.isFinite(entry?.y) ? entry.y : FRONT_RANK_Y;
  const stated = Math.abs(Number(entry?.yscale));
  return {
    xMin: Math.min(x, Number.isFinite(entry?.xMin) ? entry.xMin : x),
    xMax: Math.max(x, Number.isFinite(entry?.xMax) ? entry.xMax : x),
    yMin: Math.min(y, Number.isFinite(entry?.yMin) ? entry.yMin : y),
    yMax: Math.max(y, Number.isFinite(entry?.yMax) ? entry.yMax : y),
    size: Number.isFinite(stated) && stated > 0 ? stated / 100 : 1
  };
}

/**
 * The stage y of the LOWEST foot of any arena's painted wall at this zoom —
 * the line every framed fighter's feet must stay `wallMargin` below, whichever
 * of the six arenas is dressed. Reached the painter's way: the crowd layer's
 * placement, which the camera lowers by `ceil(zoomscale)`, plus the deepest
 * measured foot (`SS2_ARENA_WALL_BASE`, arena 5's).
 */
function lowestWallFootAt(zoomscale) {
  const crowd = SS2_ARENA_SCREEN_LAYERS.find((layer) => layer.prop === "crowd");
  const deepest = Math.max(...SS2_ARENA_WALL_BASE.map((wall) => wall.crowdY));
  return layerPlacementFor(crowd, { crowdY: SS2_CAMERA.crowdBaseY + Math.ceil(zoomscale) }).y + deepest;
}

/**
 * Whether every framed fighter's crown, name plate and feet fit, at this zoom
 * and every framing weight: the crown below the top of the visible stage, the
 * plate above its bottom, and the feet on the floor — `wallMargin` below the
 * foot of the painted wall in every arena.
 *
 * ► **THE FEET WERE NOT CHECKED UNTIL 2026-09-24, AND THE CLOSE-UP WALKED A
 *   BACK-RANKER INTO THE WALL.** `RANK_DEPTH_FACTOR` was pinned against the
 *   wall for zooms 5..80, the build's bands; the close-up goes to 100. On the
 *   team framing the back rank (y 6) clears arena 5's wall by 5px only to zoom
 *   82, and a back-ranker small enough that his crown did not bind (little fat
 *   kid's `_yscale` 50) was framed at 97, 17.39px inside it. A pair's framing
 *   never reaches the wall: its back rank gains on the wall at every zoom.
 */
function fitsVerticallyAt(geometry, zoomscale, teamWeights, hud = null, wallWeights = teamWeights) {
  const { visible, crown } = SS2_CLOSE_UP;
  for (const teamWeight of teamWeights) {
    const camera = fitCameraAt(zoomscale, teamWeight, hud);
    for (const actor of geometry) {
      if (arenaToStage(camera, { x: 0, y: actor.yMin, lift: crown * actor.size }).y < visible.top) return false;
    }
  }
  return standsFitAt(geometry, zoomscale, teamWeights, hud, wallWeights);
}

/**
 * THE GROUND HALF OF THE FIT: every fighter's feet on the floor, `wallMargin`
 * below the lowest arena's wall foot, and everything he draws below them (his
 * plate — and under a HUD, his shadow too: `inkDepthAt`) no lower than the
 * visible stage's bottom, or the HUD's top where that is higher. The
 * survivors' close-up asks it with the crowns (`fitsVerticallyAt`); under a
 * HUD, every other camera of a team bout asks it alone (`hudZoomCapFor`); and
 * every BLEND between two cameras asks it at its own weight (`groundedBlend`).
 *
 * ► **THE INK IS CHECKED AT `teamWeights`, THE WALL AT `wallWeights`** (by
 *   default the same). A stage y is linear in the framing weight, so the ink
 *   checked at both ends of a hand-over bounds every frame of it. The wall
 *   does not need that: it is a fact about the frame a fighter IS drawn in,
 *   so the survivors' close-up checks it at the weight it will SETTLE at (its
 *   target) and at the weight it is DRAWN at (rule 6), never at the one it is
 *   leaving. ~~Both ends~~ — the verifier (verify:camera-r1, 2026-09-24) found
 *   the first version held a team-to-pair hand-over's target to the team
 *   line's 82 for the frames it took the weight to leave 1, zooming in slower
 *   than 808f6da with nobody near the wall.
 *
 * ► **WITH NO HUD THE BOTTOM IS THE PLATE ALONE, AS IT WAS**: the UI bar paints
 *   over a shadow exactly as the build's does, and the plate never reaches 398
 *   at a zoom the camera can take (395.05 at the pair's line at 100).
 *
 * `hud` is the HUD the camera is standing to THIS frame — `{hudTop, inkSize}`,
 * eased (`hudStateFor`), or null. A fighter's shadow is budgeted at his own
 * size, and at no more than the camera's `inkSize`: while a size eases, the
 * fit moves with the line rather than ahead of it.
 */
function standsFitAt(geometry, zoomscale, teamWeights, hud = null, wallWeights = teamWeights) {
  // A tolerance for doubles only: under a HUD the team line is set so the
  // largest fighter's ink lands EXACTLY on the HUD's top.
  for (const teamWeight of teamWeights) {
    if (inkOverAt(geometry, fitCameraAt(zoomscale, teamWeight, hud), hud) > 1e-9) return false;
  }
  for (const teamWeight of wallWeights) {
    if (wallRoomAt(geometry, fitCameraAt(zoomscale, teamWeight, hud)) < 0) return false;
  }
  return true;
}

/**
 * How far the lowest ink any fighter in `geometry` draws at this camera — his
 * plate at his front-most depth, and under a HUD his shadow too, budgeted at
 * no more than the HUD's `inkSize` — lies BELOW the bottom it must stay above:
 * the visible stage's, or the HUD's top where that is higher. Zero or less
 * when it all fits. The ink half of `standsFitAt`, and what a blend is lifted
 * by (`groundedBlend`).
 */
function inkOverAt(geometry, camera, hud) {
  const { visible } = SS2_CLOSE_UP;
  const k = camera.zoomscale / 100;
  const bottom = hud === null ? visible.bottom : Math.min(visible.bottom, hud.hudTop);
  let over = -Infinity;
  for (const actor of geometry) {
    const below = hud === null ? namePlateDepthAt(k) : inkDepthAt(k, Math.min(actor.size, hud.inkSize));
    over = Math.max(over, arenaToStage(camera, { x: 0, y: actor.yMax }).y + below - bottom);
  }
  return over;
}

/**
 * How far the highest foot of any fighter in `geometry` — his back-most depth
 * — stands BELOW the line `wallMargin` under the lowest arena's wall foot at
 * this camera. Negative when somebody is framed on the wall. The wall half of
 * `standsFitAt`.
 */
function wallRoomAt(geometry, camera) {
  const floor = lowestWallFootAt(camera.zoomscale) + SS2_CLOSE_UP.wallMargin;
  let room = Infinity;
  for (const actor of geometry) room = Math.min(room, arenaToStage(camera, { x: 0, y: actor.yMin }).y - floor);
  return room;
}

/** The camera a fit is checked at: this zoom and framing, and — under a HUD — the line that HUD lifts it to. */
function fitCameraAt(zoomscale, teamWeight, hud) {
  if (hud === null) return { zoomscale, teamWeight };
  return { zoomscale, teamWeight, hudTop: hud.hudTop, inkSize: hud.inkSize };
}

/** A caller's `hudTop` and `inkSize` as a fit's HUD: null without a top; the set's largest size by default. */
function fitHudOf(geometry, hudTop, inkSize) {
  if (!Number.isFinite(hudTop)) return null;
  return { hudTop, inkSize: Number.isFinite(inkSize) ? inkSize : largestSizeOf(geometry) };
}

/** The largest fighter's size (`|_yscale| / 100`) in a close-up geometry; 1 for nobody. */
function largestSizeOf(geometry) {
  return geometry.length > 0 ? Math.max(...geometry.map((actor) => actor.size)) : 1;
}

/**
 * The tightest zoom, at most `SS2_CLOSE_UP.zoomCap`, at which every framed
 * fighter fits the visible stage in every non-death pose — see `SS2_CLOSE_UP`.
 *
 * With `gladiatorsX` it is the fit at THAT pan; without, the fit for any pan
 * that puts the focus inside the build's dead zone, which is where the pan
 * settles. `teamWeights` are the framings to check the crowns and the name
 * plates against — the camera's current weight and its target, which bound
 * the whole hand-over, because a stage y is linear in the weight.
 * `wallWeights` (by default `teamWeights`) are the framings to check the feet
 * against the wall at: the weight the camera will be DRAWN at, not the one it
 * is leaving (see `standsFitAt`).
 *
 * Never below the build's `zoomMinimum`; an integer, as the build's zoom is.
 *
 * `hudTop`, when there is a HUD in the frame (`SS2_TEAM_HUD`): the stage y
 * nothing a framed fighter draws may reach below, in place of the visible
 * stage's bottom where it is higher; `inkSize`, the size the team line is
 * lifted for (by default the largest framed fighter's).
 *
 * ► **AT A PAN IT IS A CEILING, NOT A GUARANTEE** — the most the zoom may rise
 *   to while the pan brings the fighters in, which is what the close-up's
 *   TARGET needs. Every zoom under it fits only while arena x 0 is drawn on
 *   the stage; where the pan has put it off, zooming out can crop too, and
 *   what the DRAWN camera is checked against is `closeUpZoomRangeAt`.
 */
export function closeUpZoomFor(framed, {
  gladiatorsX = null, teamWeights = [0, 1], wallWeights = teamWeights, hudTop = null, inkSize = null
} = {}) {
  const geometry = placedIn(framed).map(closeUpGeometryOf);
  const { visible, reach, lunge, zoomCap } = SS2_CLOSE_UP;
  if (geometry.length === 0) return zoomCap;
  const focusX = focusXFor(placedIn(framed));
  let zoom = zoomCap;
  for (const actor of geometry) {
    const margin = reach * actor.size + lunge;
    const lo = actor.xMin - margin;
    const hi = actor.xMax + margin;
    if (gladiatorsX === null) {
      // The focus may rest anywhere in 300..340: fit each side from its far edge.
      if (hi > focusX) zoom = Math.min(zoom, (100 * (visible.right - SS2_CAMERA.deadZoneRight)) / (hi - focusX));
      if (lo < focusX) zoom = Math.min(zoom, (100 * (SS2_CAMERA.deadZoneLeft - visible.left)) / (focusX - lo));
    } else {
      const origin = SS2_ARENA_ORIGIN.x + gladiatorsX;
      if (hi > 0) zoom = Math.min(zoom, (100 * (visible.right - origin)) / hi);
      if (lo < 0) zoom = Math.min(zoom, (100 * (origin - visible.left)) / -lo);
    }
  }
  zoom = Math.floor(zoom);
  const hud = fitHudOf(geometry, hudTop, inkSize);
  while (zoom > SS2_CAMERA.zoomMinimum && !fitsVerticallyAt(geometry, zoom, teamWeights, hud, wallWeights)) zoom -= 1;
  return Math.max(SS2_CAMERA.zoomMinimum, zoom);
}

/**
 * EVERY zoom at which each framed fighter fits the visible stage AT THIS PAN,
 * as the integer range `{min, max}` (`max` at most `zoomCap`), or `null` when
 * there is none.
 *
 * ► **A RANGE, NOT A CEILING, because the pan can put arena x 0 off the
 *   stage.** A stage x is `origin + x·z/100`, so zooming out slides every
 *   point TOWARD the origin. While the origin is on the stage that only ever
 *   helps, and the fit is a ceiling. But a close-up on a lone winner at -510
 *   pans the origin to ~810: then a swing whose right end is still left of
 *   arena 0 is pulled OFF the right edge by zooming out, and the only fits are
 *   zooms at least some `min`. The first version kept the ceilings alone and
 *   called 100 safe there while the zoom eased down past 145px of crop (found
 *   2026-09-24, after Codex's pass 3). The crowns and name plates stay
 *   ceilings: their pivot, 166.75 or the team's front line, is on the stage.
 */
export function closeUpZoomRangeAt(framed, {
  gladiatorsX, teamWeights = [0, 1], wallWeights = teamWeights, hudTop = null, inkSize = null
}) {
  const geometry = placedIn(framed).map(closeUpGeometryOf);
  const { visible, reach, lunge, zoomCap } = SS2_CLOSE_UP;
  const origin = SS2_ARENA_ORIGIN.x + gladiatorsX;
  let lowest = 0;
  let highest = zoomCap;
  // Each edge is `slope * z <= room`: a ceiling when the slope is positive, a
  // floor when it is negative (dividing by it turns the inequality round).
  const bound = (slope, room) => {
    if (slope > 0) highest = Math.min(highest, room / slope);
    else if (slope < 0) lowest = Math.max(lowest, room / slope);
    else if (room < 0) highest = -Infinity;
  };
  for (const actor of geometry) {
    const margin = reach * actor.size + lunge;
    bound((actor.xMax + margin) / 100, visible.right - origin); // the right end on or left of the edge
    bound(-(actor.xMin - margin) / 100, origin - visible.left); // the left end on or right of it
  }
  const min = Math.ceil(lowest);
  let max = Math.floor(highest);
  const hud = fitHudOf(geometry, hudTop, inkSize);
  while (max >= min && !fitsVerticallyAt(geometry, max, teamWeights, hud, wallWeights)) max -= 1;
  return max >= min ? Object.freeze({ min, max }) : null;
}

/**
 * Whether the close-up is on: a TEAM roster, and at least one fall already
 * finished being drawn. Before that the camera is the build's over everybody.
 */
function closeUpActive(placed) {
  return placed.length > 2 && placed.some((actor) => actor?.alive === false && actor.drawing !== true);
}

/**
 * THE CAMERA UNDER THE IN-FRAME TEAM HUD — **AUTHORED (D3, 2026-09-24)**, at
 * the owner's request: *"the team health, energy, and aramor should be in the
 * game frame as UI elements ... Make camera adjustments necessary to fit these
 * assets."* In a team bout the HUD is drawn across the bottom of the stage and
 * `hudTop` is the stage y of its highest ink. A 1v1 is the build's own panel
 * under the build's own camera and never passes one.
 *
 * ► **WHAT IT PROMISES: at a settled frame, no framed fighter's feet, shadow
 *   or name-plate ink lies below the HUD the camera stands to, and every
 *   framed rank's feet stay `wallMargin` below the foot of every arena's
 *   painted wall. At every frame drawn as a BLEND between two cameras the
 *   wall half holds too, and the ink half as far as the wall allows**
 *   (`groundedBlend`: where a lane change's span is taller than the band
 *   between the two, its back end stands exactly on the margin). Three
 *   levers, all the team bout's own, none of them the build's:
 *   1. **The team line is lifted, only as far as it must be**: to
 *      `min(the framing's line, hudTop - inkDepthAt(zoom, inkSize))`, where
 *      `inkSize` is the largest framed fighter's size — his shadow is the
 *      lowest ink he draws above zoom ~60 (at `_yscale` 86: 29.07k against
 *      22k + 4.2), his plate below. At zoom 80 the 3v3's HUD (~352) lifts
 *      nothing for fighters up to `_yscale` 98 (27.04 x 0.98 <= 352 - 325.48);
 *      the 2v2's (~326) lifts the line 22.73px at `_yscale` 86.
 *   2. **The zoom is capped where that costs the floor**: every camera of a
 *      team bout — the build's bands and fit, the old camera the floor holds
 *      to, the close-up — targets at most the highest zoom at which every
 *      fighter it frames keeps his ink above the HUD and his feet 5px under the
 *      wall (`standsFitAt`). A lifted line takes the back rank toward the
 *      crowd, which does not follow it; only a fighter actually standing back
 *      costs zoom. So rule 1's floor, the old camera's target, is capped by the
 *      same fit, and a held frame cannot sit below the HUD.
 *   3. **The close-up's bottom becomes the HUD's top** where it is higher than
 *      the visible stage's 398, with the shadow counted: a pair's line is the
 *      build's and is never lifted, so a pair framed in a team bout is held
 *      above the HUD by its zoom.
 *
 * ► **NO JUMPS.** The camera carries the HUD it is standing to (`hudTop`, a
 *   stage y) and the size it budgets for (`inkSize`), and both EASE, by the
 *   zoom's fifth, snapping inside `snapPx`/`snapSize`. The eased HUD is worked
 *   out BEFORE the camera steps (`hudStateFor`) and EVERY fit that frame uses
 *   it — the target, the close-up's, the zoom drawn — as does the line:
 *   - **the frame a bout starts** (a fresh roster) opens ON the HUD, as it
 *     opens on its framing — at zoom 5 the HUD binds nothing, and the rush-in
 *     is already aimed at the capped target;
 *   - **a HUD that appears mid-bout** starts at the top that binds nothing for
 *     the camera as it stands (its team line's ink, or on a pair's line its
 *     fighters' own), so its first frame moves nothing, then eases down to the
 *     requested top, the fits relaxing with it;
 *   - **a HUD that changes** eases from the old top to the new;
 *   - **a HUD withdrawn** (`hudTop` null after a number) eases back out — never
 *     in — until it binds nothing, then the camera drops it and is the camera
 *     without one; on a pair's line, which a HUD holds by its zoom alone, that
 *     is at once, and the zoom rises by the build's own ease;
 *   - **a size that changes** — a colossus, a death — eases the same way; a
 *     fighter's shadow is budgeted at no more than the eased size meanwhile.
 *   While either eases, the promise is the settled frame's, not this one's.
 *   MEASURED (fix-round verifier, 2026-09-25): after a colossus GROWS a
 *   fighter his shadow sits under the HUD's top for ~24-27 frames, worst
 *   ~11-18px — under the HUD, which is drawn over the fighters as the build's
 *   panel is. Snapping the size up at once would cost a ~17px one-frame jump
 *   of the line on every cast; the main session kept the ease. The drawn
 *   size's overshoot (175% on the way to 150%) is the caller's to feed.
 *
 * ► **`hudTop` NULL OR ABSENT IS THE CAMERA BEFORE THE HUD, TO THE BYTE**: no
 *   cap, no lift, and no new field on any camera. Pinned frame by frame against
 *   808f6da's module over the demo bouts.
 *
 * ► **WHAT IT DOES NOT PROMISE.** A body the close-up does not frame can stand
 *   anywhere, as before. The crowns of a lifted team framing are not fitted
 *   outside the close-up, as they were not before. ~~A blend between two
 *   cameras (a hold engaging or releasing) keeps each end's promise at its
 *   ends, not in between~~ — the verifier (verify:camera-r1) measured a blend
 *   under 326 standing a back-ranker 1.68px INSIDE arena 5's wall; blends are
 *   grounded now (`groundedBlend`). A blend's crowns are not fitted, as they
 *   were not before, and its lift can raise one further off the top (3,000
 *   random bouts under 326: 5 more such blend frames on one seed, 3 fewer on
 *   the other, the worst crop unchanged). **A camera that is not a blend and is still
 *   EASING keeps the promise only once it settles**: the held old camera, or
 *   the team camera before any fall, whose target drops the moment a lane
 *   change's span takes in the back rank, eases down to it by a fifth a frame
 *   rather than cutting — so for those first frames the SPAN's back end is
 *   framed past the wall under a lifted line (measured under 326 ~~, never under
 *   352 or with no HUD~~ — and under 352 too: the fix-round verifier found 10
 *   such span frames, worst 2.263px past the margin), while the figure, drawn
 *   walking back through that span, is not. The plate's 10px floor is in canvas pixels
 *   (`namePlateDepthAt`).
 */
export const SS2_TEAM_HUD = Object.freeze({
  /** The HUD's top and the ink size ease by this fraction of the gap a frame: the zoom's own. */
  ease: SS2_CAMERA.zoomEase,
  /** Inside this many stage px of its target, the eased HUD top snaps to it. */
  snapPx: 0.1,
  /** Inside this much of its target, the eased ink size snaps to it. */
  snapSize: 0.002
});

/** One frame of an ease toward `target`, by `SS2_TEAM_HUD.ease`, snapping inside `snap`. */
function easeHudValue(value, target, snap) {
  if (!Number.isFinite(value)) return target;
  const next = value + (target - value) / SS2_TEAM_HUD.ease;
  return Math.abs(target - next) < snap ? target : next;
}

/**
 * The HUD top that binds NOTHING for this camera as it stands: the lowest ink
 * its fighters put on the stage with no HUD — on a team framing, the line's own
 * front rank at `inkSize`; on any framing, each fighter at his front-most depth
 * with his shadow at no more than `inkSize`.
 */
function unboundHudTopFor(camera, set, inkSize) {
  const zoomscale = camera.zoomscale;
  const k = zoomscale / 100;
  const teamWeight = teamWeightOf(camera);
  const bare = { zoomscale, teamWeight };
  let lowest = teamWeight > 0 ? teamFrontLineAt(zoomscale) + inkDepthAt(k, inkSize) : -Infinity;
  for (const actor of placedIn(set).map(closeUpGeometryOf)) {
    lowest = Math.max(lowest, arenaToStage(bare, { x: 0, y: actor.yMax }).y + inkDepthAt(k, Math.min(actor.size, inkSize)));
  }
  return lowest;
}

/**
 * The zoom a camera over `set` may target under a HUD: `target`, lowered one
 * zoom at a time until every fighter in the set stands on the floor with his
 * ink above the HUD at every framing weight given (`standsFitAt`). Never below
 * the build's `zoomMinimum`.
 */
function hudZoomCapFor(target, set, teamWeights, hud) {
  const geometry = placedIn(set).map(closeUpGeometryOf);
  let zoom = Math.floor(target);
  while (zoom > SS2_CAMERA.zoomMinimum && !standsFitAt(geometry, zoom, teamWeights, hud)) zoom -= 1;
  return Math.max(SS2_CAMERA.zoomMinimum, zoom);
}

/** The framing weights a camera stepping over `set` is checked at: where it is and where it is going. */
function stepWeightsOf(camera, set) {
  return [teamWeightOf(camera), isTeamFight(set) ? 1 : 0];
}

/** `cameraStep`'s options for a camera over `set`: under a HUD, its target capped by the ground fit. */
function hudStepOptions(before, set, hud) {
  if (hud === null) return {};
  const weights = stepWeightsOf(before, set);
  return { targetFor: ({ midwaypoint }) => hudZoomCapFor(targetZoomFor(midwaypoint, set), set, weights, hud) };
}

/** A fresh camera's opening target, capped the same way. */
function hudOpening(camera, set, hud) {
  if (hud === null) return camera;
  return Object.freeze({ ...camera, maxscale: hudZoomCapFor(camera.maxscale, set, [teamWeightOf(camera)], hud) });
}

/**
 * THE HUD A CAMERA OVER `set` STANDS TO THIS FRAME — `{hudTop, inkSize}`, or
 * null — worked out BEFORE the camera steps, so that every fit this frame (its
 * target, the close-up's, the zoom drawn) and the line it draws agree on one
 * HUD. `before` is the same tween's last frame, null on a fresh roster.
 *
 * ► ~~Worked out AFTER the step, and every fit given the REQUESTED top~~ —
 *   Codex's review, pass 1 (2026-09-24): the line eased, but the close-up's
 *   draw-time fit bound at once, and a HUD appearing over a lone survivor
 *   framed at 100 cut the frame to 69, 62px of line, in one frame. Now the
 *   HUD that first appears starts at the top that binds nothing for the
 *   camera AS IT STANDS — its pair's line included, not only the team's — and
 *   every fit relaxes with the ease.
 */
function hudStateFor(before, set, hudTop) {
  const had = Number.isFinite(before?.hudTop);
  if (hudTop === null && !had) return null;
  const size = largestSizeOf(placedIn(set).map(closeUpGeometryOf));
  if (!had) {
    // A new bout opens ON the HUD; one that appears mid-bout starts where it binds nothing.
    if (before === null) return { hudTop, inkSize: size };
    return { hudTop: Math.max(hudTop, unboundHudTopFor(before, set, size)), inkSize: size };
  }
  const inkSize = easeHudValue(before.inkSize, size, SS2_TEAM_HUD.snapSize);
  if (hudTop === null) {
    // Withdrawn: ease OUT, never in — toward the top that binds nothing, or
    // stay put where the top already binds nothing (a pair's line, which a HUD
    // holds by its zoom alone); `withHud` drops it once it binds nothing.
    const unbound = Math.max(before.hudTop, unboundHudTopFor(before, set, inkSize));
    return { hudTop: easeHudValue(before.hudTop, unbound, SS2_TEAM_HUD.snapPx), inkSize, releasing: true };
  }
  return { hudTop: easeHudValue(before.hudTop, hudTop, SS2_TEAM_HUD.snapPx), inkSize };
}

/**
 * The stepped camera, carrying the HUD it stands to as `hudTop` and `inkSize`
 * — or neither: no HUD, or one withdrawn that no longer binds anything at the
 * zoom the camera has now reached, which is dropped.
 */
function withHud(camera, hud, set) {
  if (hud === null) return camera;
  if (hud.releasing && hud.hudTop >= unboundHudTopFor(camera, set, hud.inkSize)) return camera;
  return Object.freeze({ ...camera, hudTop: hud.hudTop, inkSize: hud.inkSize });
}

/**
 * One frame of the arena's camera from the whole roster: `framedActors`, then
 * the build's camera over whoever it frames — and, in a team bout once a fall
 * has finished, the survivors' close-up (`SS2_CLOSE_UP`) as its target — kept
 * above the in-frame HUD when there is one (`SS2_TEAM_HUD`).
 *
 * ► **A DEATH EASES THE CAMERA; IT NEVER RE-SEEDS IT.** `cameraFor` is the
 *   build's opening shot — zoom 5, rushing in — and it is taken only when the
 *   ROSTER changes: a new bout, or a different set of placed fighters. The
 *   shell used to key it on how many actors the camera was handed, which was
 *   harmless while that was the roster's count and would have replayed the
 *   opening shot on every death the moment it was not.
 *
 * @param {{camera: object, rosterKey: string}|null} previous  the last frame's result, or null
 * @param {Array<object>} roster  every PLACED actor — see `framedActors` and `actorSpanFor`
 * @param {{result?: object|null, hudTop?: number|null}} [options]  the bout's result, once it has one;
 *   and the stage y of the in-frame HUD's highest ink in a TEAM bout (null or absent: no HUD — a 1v1)
 * @returns {{camera: object, own: object, old: object, hold: number, rosterKey: string, framed: object[],
 *   closeUp: boolean, heldByFloor: boolean}}  `camera` is what to draw; `own`, `old` and `hold` are
 *   the two tweens and the blend between them, carried to the next frame. `own` is the close-up's
 *   tween BEFORE rule 6 brings its zoom inside what fits, so it can differ from an unheld `camera`.
 *   Under a HUD every camera also carries `hudTop` and `inkSize` (see `SS2_TEAM_HUD`); a `camera`
 *   drawn as a blend whose ink would pass its bottom carries `inkLift` (see `groundedBlend`).
 */
export function stepFramedCamera(previous, roster, { result = null, hudTop = null } = {}) {
  const hud = Number.isFinite(hudTop) ? hudTop : null;
  const rosterKey = rosterKeyOf(roster);
  const placed = placedIn(roster);
  const framed = framedActors(roster, { result });
  const fresh = !previous?.camera || previous.rosterKey !== rosterKey;
  // THE OLD CAMERA, stepped beside this one every frame: 2c075df's, exactly —
  // the build's camera over every placed actor, bodies included. It is what a
  // held frame IS, and what "never looser" and "never cropped more" are
  // measured against. Under a HUD it is capped by the same ground fit.
  const oldBefore = fresh || !previous.old ? null : previous.old;
  const oldHud = hudStateFor(oldBefore, placed, hud);
  const old = withHud(oldBefore === null
    ? hudOpening(cameraFor(placed), placed, oldHud)
    : cameraStep(oldBefore, placed, hudStepOptions(oldBefore, placed, oldHud)), oldHud, placed);
  const done = (camera, own, hold, closeUp, heldByFloor) => Object.freeze({
    camera, own, old, hold, rosterKey, framed: Object.freeze(framed), closeUp, heldByFloor
  });
  if (fresh) {
    const opening = hudStateFor(null, framed, hud);
    const camera = withHud(hudOpening(cameraFor(framed), framed, opening), opening, framed);
    return done(camera, camera, 0, false, false);
  }
  const ownBefore = previous.own ?? previous.camera;
  const ownHud = hudStateFor(ownBefore, framed, hud);
  if (!closeUpActive(placed)) {
    const own = withHud(cameraStep(ownBefore, framed, hudStepOptions(ownBefore, framed, ownHud)), ownHud, framed);
    return done(own, own, 0, false, false);
  }
  // (1) The floor: the old camera's own target, bodies included — which, under
  //     a HUD, is already capped by the same ground fit. (`old.maxscale` IS
  //     `targetZoomFor(midwaypointFor(placed), placed)` when there is none.)
  const floor = old.maxscale;
  // (2) The close-up: its crowns and plates checked against both ends of any
  //     framing hand-over; its feet against the wall at the weight it
  //     SETTLES at, the target's (see `standsFitAt`).
  const toward = isTeamFight(framed) ? 1 : 0;
  const teamWeights = [teamWeightOf(ownBefore), toward];
  const fit = ownHud === null ? {} : { hudTop: ownHud.hudTop, inkSize: ownHud.inkSize };
  const settled = closeUpZoomFor(framed, { teamWeights, wallWeights: [toward], ...fit });
  // No `max(floor, …)` here: when the frame is not held, what fits at this pan
  // is at least the floor by the definition of `held` below, and when it is
  // held this camera is not the one drawn — the clamp keeps it from lagging.
  let own = withHud(cameraStep(ownBefore, framed, {
    targetFor: ({ gladiatorsX }) => Math.min(settled,
      closeUpZoomFor(framed, { gladiatorsX, teamWeights, wallWeights: [toward], ...fit }))
  }), ownHud, framed);
  // Never looser than the old camera is RIGHT NOW — its zoom, not only its target.
  if (own.zoomscale < old.zoomscale) {
    own = Object.freeze({ ...own, zoomscale: old.zoomscale, crowdY: SS2_CAMERA.crowdBaseY + Math.ceil(old.zoomscale) });
  }
  // (3) THE ZOOM DRAWN, not only the target (rule 6). Every zoom that fits at
  //     the pan this camera has NOW, after this frame's pan step, and that is
  //     no looser than the old camera: the drawn zoom is this camera's own,
  //     brought inside that. `own` itself is carried on UNCHANGED, so its
  //     ease and its pan run exactly as they did — the check is on what is
  //     drawn and feeds nothing back. The wall is checked at the weight
  //     this frame is DRAWN at.
  const here = closeUpZoomRangeAt(framed, { gladiatorsX: own.gladiatorsX, teamWeights, wallWeights: [teamWeightOf(own)], ...fit });
  const lowest = here === null ? Infinity : Math.max(old.zoomscale, here.min);
  const fits = here !== null && lowest <= here.max;
  const drawn = fits ? withZoom(own, Math.min(here.max, Math.max(lowest, own.zoomscale))) : own;
  // (4) HELD: no zoom here keeps both promises, or the floor beats what fits —
  //     settled, or at this pan. Then the frame is the OLD camera's: its pan
  //     and framing as well as its zoom (see `SS2_CLOSE_UP`, rule 4).
  const held = !fits || floor > Math.min(settled, here.max);
  // Entering the rule the two cameras are one camera — nobody has fallen out of
  // the frame until now — so the hold starts where it is going. After that it
  // eases, by the zoom's fifth, so neither switch is a jump.
  const wasEngaged = previous.closeUp === true || previous.heldByFloor === true;
  const hold = wasEngaged ? easeTeamWeight(previous.hold ?? 0, held ? 1 : 0) : (held ? 1 : 0);
  const camera = hold === 0 ? drawn : hold === 1 ? old : groundedBlend(blendCameras(drawn, old, hold), framed);
  return done(camera, own, hold, !held, held);
}

/** The same camera at another zoom, with the crowd the build hangs from it. */
function withZoom(camera, zoomscale) {
  if (zoomscale === camera.zoomscale) return camera;
  return Object.freeze({ ...camera, zoomscale, crowdY: SS2_CAMERA.crowdBaseY + Math.ceil(zoomscale) });
}

/**
 * A camera `weight` of the way from `from` to `to`. Stage x is linear in the
 * pan and the zoom, so every edge a blend draws lies between where the two
 * cameras draw it — a blended frame crops nobody more than the worse of them.
 * Stage y is NOT: see `groundedBlend`, which every blend drawn goes through.
 */
function blendCameras(from, to, weight) {
  const lerp = (a, b) => a + (b - a) * weight;
  const zoomscale = lerp(from.zoomscale, to.zoomscale);
  const nearer = weight < 0.5 ? from : to;
  return Object.freeze({
    midwaypoint: nearer.midwaypoint,
    focusX: lerp(from.focusX, to.focusX),
    zoomscale,
    maxscale: nearer.maxscale,
    gladiatorsX: lerp(from.gladiatorsX, to.gladiatorsX),
    crowdY: SS2_CAMERA.crowdBaseY + Math.ceil(zoomscale),
    team: nearer.team,
    teamWeight: lerp(teamWeightOf(from), teamWeightOf(to)),
    ...blendHud(from, to, lerp)
  });
}

/**
 * A BLEND BROUGHT DOWN ONTO THE FLOOR: the blended camera, kept to the promise
 * its two ends keep, at the blend's OWN framing weight and HUD — and the blend
 * itself, to the byte, wherever it already keeps it. Two levers, one for each
 * half, and THE WALL COMES FIRST:
 * - **THE WALL, always: the zoom is LOWERED**, one whole zoom at a time, at
 *   the blend's own pan, as rule 6 brings a drawn zoom inside what fits
 *   (`withZoom`), until every framed fighter's back-most depth stands
 *   `wallMargin` under the lowest arena's wall foot (`wallRoomAt`). A lower
 *   zoom takes the back rank away from a wall that climbs with it.
 * - **THE INK, as far as the wall allows: the whole framing is LIFTED**
 *   (`inkLift`, stage px, which `arenaToStage` subtracts from every depth) by
 *   as much as its lowest ink lies under the bottom — the visible stage's, or
 *   the HUD's top (`inkOverAt`) — the team line's own lever under a HUD
 *   (`SS2_TEAM_HUD`), "only as far as it must be" the same way, and never
 *   past the room the wall leaves. **So a blend's ink clears the HUD unless
 *   its framed spans are taller than the band between the wall and the HUD
 *   at its zoom, and then its back-most depth stands exactly on the margin.**
 *   That happens where a lane change starts a hold's blend: the span runs
 *   from where the fighter stands to where he is going, and its two ends are
 *   held to the wall and the HUD at once. Measured over 3,000 random bouts
 *   (seeds 11 and 5) with the lane change drawn linearly over 10, 20 or 40
 *   frames — the game's is 10 beats, 1.2s: no frame of any camera, under no
 *   HUD, 326 or 352, drew a fighter's ink under the HUD or his feet within
 *   the margin WHERE HE WAS DRAWN.
 *
 * ► **WHY THE ENDS DO NOT BOUND IT.** `blendCameras` lerps the zoom and the
 *   framing weight separately, so a foot's stage y — the pair's line
 *   `166.75 + d·z/100` blended by the weight into the team's — is BILINEAR in
 *   the blend's weight, and a frame between two cameras that each keep the
 *   floor can leave it. Found by the verifier (verify:camera-r1, 2026-09-24):
 *   a lone `_yscale` 50 winner at the back rank, released from a hold, stood
 *   1.59px from arena 5's wall foot at zoom 94.02, framing weight 0.36 — in
 *   808f6da too — and under the 2v2's HUD (326), where the old camera's line
 *   is lifted for a colossus's body, 1.68px INSIDE it.
 * ► **WHY THE INK IS LIFTED, NOT ZOOMED OUT** — Codex's review of this fix,
 *   pass 1 (2026-09-24). ~~Lower the zoom until the whole ground fit holds~~:
 *   under a HUD the team end's largest fighter inks EXACTLY onto the HUD's
 *   top, so any pair weight left in a blend puts ink under it unless the PAIR
 *   part fits by itself — the zoom was held at the pair's fit (68) for the
 *   whole blend and jumped to the held camera's 80 the frame the hold reached
 *   1. The lift needed goes to nothing at both ends of the blend with the
 *   weight it comes from, so the blend reaches either end without a jump.
 * ► **WHY THE WALL COMES FIRST** — Codex's review of this fix, pass 2.
 *   ~~Lift for all the ink, then lower the zoom until the lifted back rank
 *   clears the wall~~: a lone winner at the back rank at 100 steps up to the
 *   front as he walks, and the blend's first frame, raw at 85.6 with his feet
 *   3.10px from arena 5's wall, had the ink of the span's FRONT end — where
 *   he will arrive, not where he is — 28.94px under the HUD. Lifting all of
 *   it put his feet in the wall, so the zoom fell until the lift fitted: 72,
 *   13.6 zooms more than the raw blend. Wall first, it is 82, his feet exactly
 *   on the margin, the span's front end 22.33px under. Over the 3,000 bouts no grounded
 *   blend's one-frame zoom move is more than 7.6 zooms larger than the raw
 *   blend's (it was 17.6), and the count of one-frame moves over 10 zooms is
 *   the raw blend's to within one.
 * ► **AT THE BLEND'S OWN PAN** the zoom only moves stage x toward the arena's
 *   origin, which can push a swing off an edge only while that origin is off
 *   the stage; the lift moves no stage x at all. Measured over 3,000 random
 *   bouts (seeds 11 and 5, no HUD, 326 and 352): 341 blend frames zoomed out,
 *   and against the same blend left where it was a framed swing cropped MORE
 *   in 2, by 1.04px at most, and LESS in 129. Zooming out about the framed
 *   group's middle instead was tried while the zoom was still the ink's lever
 *   too (718 frames zoomed out): it cropped more in none and less in 399
 *   against this one's 397, but by less than this in 309 of them; it was not
 *   kept — a pixel in two frames, and nothing outside this function could
 *   pin it.
 * ► **IT FEEDS NOTHING BACK**: the two tweens (`own`, `old`) and the hold are
 *   carried unchanged, as rule 6's check is — only what is drawn moves.
 */
function groundedBlend(blend, framed) {
  const geometry = placedIn(framed).map(closeUpGeometryOf);
  const hud = Number.isFinite(blend.hudTop) ? { hudTop: blend.hudTop, inkSize: blend.inkSize } : null;
  let camera = blend;
  while (wallRoomAt(geometry, camera) < 0 && camera.zoomscale > SS2_CAMERA.zoomMinimum) {
    camera = withZoom(blend, Math.max(SS2_CAMERA.zoomMinimum, Math.ceil(camera.zoomscale) - 1));
  }
  const over = inkOverAt(geometry, camera, hud);
  if (!(over > 1e-9)) return camera;
  const lift = Math.min(over, Math.max(0, wallRoomAt(geometry, camera)));
  return lift > 0 ? Object.freeze({ ...camera, inkLift: lift }) : camera;
}

/**
 * The HUD a blended camera stands to: both ends' eased, or the one end's that
 * has one (a HUD easing out on one tween before the other) — or none.
 */
function blendHud(from, to, lerp) {
  const hasFrom = Number.isFinite(from.hudTop);
  const hasTo = Number.isFinite(to.hudTop);
  if (hasFrom && hasTo) return { hudTop: lerp(from.hudTop, to.hudTop), inkSize: lerp(from.inkSize, to.inkSize) };
  if (hasFrom || hasTo) {
    const end = hasFrom ? from : to;
    return { hudTop: end.hudTop, inkSize: end.inkSize };
  }
  return {};
}

/**
 * ARENA UNITS -> STAGE PIXELS, for a camera.
 *
 * This is the whole of the projection, and it is the build's own display tree
 * written out: the arena sits at its origin, `gladiators` is panned inside it
 * and scaled by the zoom, and a fighter's `(_x, _y)` is a point in that child.
 *
 * ```text
 *   stage x = originX + gladiatorsX + arenaX * zoom/100
 *   stage y = originY + (y_eff - lift) * zoom/100                  a pair
 *   stage y = teamFront(zoom) + (y_eff - 200 - lift) * zoom/100     a team
 *   y_eff   = y + max(0, 200 - y) * (1 - RANK_DEPTH_FACTOR)
 * ```
 *
 * ► **IDENTICAL TO THE BUILD FOR EVERY POSITION THE BUILD CAN REACH** — any
 *   `y >= 200`, at any zoom and any lift, on a camera that is not `team`
 *   (two placed actors, no camera, or a camera object that does not say
 *   `team`). That is the build's own pair, and every rock: `y_eff` is `y`
 *   there and the first `stage y` line is the expression this function has
 *   always evaluated. The camera's own arithmetic (bands, ease, pan, crowd) is
 *   the build's for every roster.
 *
 * ► **AND IT IS NOT IDENTICAL BEHIND THE FRONT RANK, IN ANY CAMERA, BY
 *   DESIGN.** The build has no rear ranks, so a fighter at `y` 103 or 6 is
 *   authored whichever camera frames him — and the squash is what keeps him
 *   off the crowd's wall. **A pair's camera is not exempt:** without it, a
 *   duellist at rank 2 stands inside arena 1's wall above zoom ~37, which is
 *   the owner's bug in a 1v1. (Codex's review, 2026-09-23, read the first
 *   version of this note — "for a pair this is the build, expression for
 *   expression" — as a promise the code broke, and it was right about the
 *   words: y 103 at zoom 50 moved from 218.25 to 242.5. The words were
 *   wrong, not the squash.) In a duel the only rank change the rules offer is
 *   the one that CLOSES on the opponent (the `RANK_BACK`/`RANK_FRONT` offer in
 *   `src/team/ss2-rules.js`), so a 1v1 that opens with both at 200 has no rank
 *   move to make; one that opens split does, and is squashed.
 *
 * ► **UNDER THE IN-FRAME TEAM HUD THE TEAM LINE IS LIFTED** (`teamLineOf`,
 *   `SS2_TEAM_HUD`): a camera carrying `hudTop` and `inkSize` stands its team
 *   front line no lower than `hudTop - inkDepthAt(zoom, inkSize)`. Every depth
 *   moves with it; a pair's line never does.
 *
 * ► **A BLEND BROUGHT DOWN ONTO THE FLOOR CARRIES `inkLift`** (stage px,
 *   `groundedBlend`): every depth of it is drawn that much higher, pair and
 *   team parts alike, so its lowest ink clears the bottom it must. Only a
 *   blend drawn between the survivors' close-up and the held camera ever
 *   carries it, and only on a frame that needs it; stage x is untouched.
 *
 * ► **ONLY THE FRAMING IS TEAM-ONLY.** The second `stage y` line — the pivot
 *   of `SS2_TEAM_FRAMING` — is taken only when `camera.team === true`. See it
 *   and `RANK_DEPTH_FACTOR`, both authored. **A camera that carries a
 *   `teamWeight` strictly between 0 and 1 is mid-hand-over** — a team just
 *   whittled to a pair — and draws the straight blend of the two lines; at 0
 *   and 1 it draws the pair's and the team's expressions exactly, not a blend
 *   of them.
 *
 * ► **THE ZOOM IS ON BOTH TERMS BECAUSE IT IS ON THE CLIP.** The build sets
 *   `gladiators._xscale = _yscale`, so a zoom-out does not merely narrow the
 *   arena — it lifts the fighters up the sand, which is what a 2D camera
 *   pulling back looks like when the ground is a painting rather than a plane.
 *   A projection that pinned the ground line would slide every fighter off the
 *   sand the moment the camera moved.
 *
 * ► **DEPTH AND HEIGHT BOTH LAND ON STAGE y, AND THE BUILD HAS ONLY ONE OF
 *   THEM.** Vanilla spends `_y` on the jump arc and has no second rank to be
 *   behind, so this engine's depth axis borrows the same number. The signs are
 *   opposite and that is the point: arena `y` grows DOWNWARD (Flash's own
 *   convention, and why the front rank is 200 and the back rank is 6), while
 *   `lift` is a height above the ground and grows UPWARD.
 */
export function arenaToStage(camera, { x = 0, y = 200, lift = 0 } = {}) {
  const zoom = (camera?.zoomscale ?? 100) / 100;
  const pan = camera?.gladiatorsX ?? 0;
  // Only depth BEHIND the front rank is squashed. A non-number is passed
  // through untouched, so it coerces exactly as it always has.
  const depth = Number.isFinite(y) && y < FRONT_RANK_Y
    ? y + (FRONT_RANK_Y - y) * (1 - RANK_DEPTH_FACTOR)
    : y;
  const weight = teamWeightOf(camera);
  const pairY = () => SS2_ARENA_ORIGIN.y + (depth - lift) * zoom;
  const teamY = () => teamLineOf(camera) + (depth - FRONT_RANK_Y - lift) * zoom;
  const stageY = weight === 0 ? pairY() : weight === 1 ? teamY() : pairY() + weight * (teamY() - pairY());
  return {
    x: SS2_ARENA_ORIGIN.x + pan + x * zoom,
    // A blend brought down onto the floor stands its whole framing up this
    // far (`groundedBlend`); no other camera carries it.
    y: Number.isFinite(camera?.inkLift) ? stageY - camera.inkLift : stageY
  };
}

/**
 * Where a gladiator's feet rest at this camera — `arenaToStage` at the front
 * rank, named because it is the number every other layer is judged against.
 *
 * For a pair it is the build's `166.75 + 200 × zoom/100`; for a team camera it is
 * the authored front line of `SS2_TEAM_FRAMING`, which does not climb toward
 * the wall as the camera pulls back — lifted, under the in-frame team HUD,
 * until its ink clears it (`SS2_TEAM_HUD`).
 */
export function groundLineAt(camera) {
  return arenaToStage(camera, { x: 0, y: 200, lift: 0 }).y;
}

/**
 * THE STAGE FITTED INTO A CANVAS — letterboxed, never stretched.
 *
 * The build's stage has a fixed 640:420 aspect and its border art overhangs
 * every edge; stretching it to a canvas of another shape would distort the
 * gladiators with it. So the stage is scaled uniformly to fit and centred, and
 * the canvas outside it is the surface's own business.
 *
 * ► **THIS IS WHAT "THE BACKDROP SETS THE SCALE" MEANS IN CODE** — the owner's
 *   decision, 2026-09-13. Nothing is fitted to the roster any more: a 1v1 and a
 *   3v3 get the same frame, and what differs is how far the camera has pulled
 *   back inside it.
 */
export function stageFitFor({ width, height }) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : SS2_STAGE.width;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : SS2_STAGE.height;
  const scale = Math.min(safeWidth / SS2_STAGE.width, safeHeight / SS2_STAGE.height);
  return Object.freeze({
    scale,
    offsetX: (safeWidth - SS2_STAGE.width * scale) / 2,
    offsetY: (safeHeight - SS2_STAGE.height * scale) / 2
  });
}

/**
 * THE LETTERBOX, AS A RECTANGLE TO CLIP TO — the other half of `stageFitFor`,
 * which computed a letterbox and then let every painter draw through it.
 *
 * ► **THIS IS THE GREEN BAND, AND IT TOOK A RUNTIME ORACLE TO SETTLE.** A
 *   neon band above the top of the stage was recorded as "known, measured,
 *   unexplained" across five handoffs, and one session withdrew a diagnosis of
 *   it within the hour. It is not one layer misplaced: **the sky clip simply
 *   extends past the stage, and how far depends on the frame.** Measured over
 *   the pack, in stage pixels, with the placement applied:
 *
 * ```text
 *     sky frame    1      60      112     180      200
 *     top edge   -12.0  -164.8   -12.0   -50.9   -114.1
 *     ops above    1      17        1      42       57
 * ```
 *
 *   The extents table in `HANDOFF.md` that made this look like a 15-pixel
 *   disagreement was computed at frame 1 — **the one frame where the sky
 *   barely leaves the stage.** `crowd` leaves it on every frame and every
 *   arena, spanning x -289.5..1073.3 against a 640-wide stage.
 *
 * ► **AND THE PLAYER'S ANSWER IS A MASK, MEASURED RATHER THAN REASONED.**
 *   `tools/swf-probe.mjs` writes a 200x200 movie with one control rectangle
 *   inside the stage and four outside it, one past each edge;
 *   `tools/ruffle-shot.ps1` renders it. Varying ONLY Ruffle's `--letterbox`:
 *
 * ```text
 *     outside-stage edge   letterbox on   letterbox off
 *     above  (red)           #000000        #ff0000
 *     below  (green)         #000000        #00ff00
 *     left   (blue)          #000000        #0000ff
 *     right  (yellow)        #000000        #ffff00
 *     inside control         #ffffff        #ffffff      <- the null control
 * ```
 *
 *   So a player DOES rasterise display-list content outside its stage rect,
 *   and what decides whether anyone sees it is a mask over the stage — not
 *   clipping at draw time.
 *
 * ► **AND THE SCREENS PAGE ALREADY KNEW, WHICH I FOUND OUT BY NEARLY BREAKING
 *   IT.** `tools/screens/main.js` has clipped to the stage BY DEFAULT since
 *   2026-09-14, under its own `?clip=0` toggle, with a docstring reading *"THE
 *   STAGE CLIP IS ON BY DEFAULT BECAUSE THE PLAYER CLIPS"* and measurements
 *   beside it — `magicshop` reaches stage y 929, `dungeon` 926, `weaponshop`
 *   771, `arena_intro` x -1383..1026. **So the gap was the ARENA page alone,
 *   not "the renderer", and I wrote the broader claim before reading the file
 *   that contradicted it.** What is genuinely new here is the MEASUREMENT: that
 *   page asserts what a player does, and nothing had rendered one until now.
 *   ► **I ALSO ADDED A SECOND CLIP TO THAT PAGE AND TOOK IT BACK OUT.** It was
 *     unconditional, so it made the existing `clip` toggle inert — two halves
 *     of one join disagreeing, with the correct rule already written on the
 *     other side of it. The page keeps its own clip; what it took from here is
 *     `stageClipRectFor` for the rectangle it was spelling out by hand.
 *
 * ► **WHAT IS MEASURED AND WHAT IS NOT.** Measured: the four-edge table above,
 *   with its null control; that SS2's own header declares 0,0..640x420 and its
 *   backdrop art (char 643) is 640x420 to the pixel; that the build never sets
 *   `Stage.scaleMode` anywhere in its bytes, so it expresses no opinion and
 *   takes the player default. NOT measured: whether the shipped Adobe AIR host
 *   (`swords_and_sandals_classic.swf`, a 640x480 stage around this 640x420
 *   one) masks its child. That link is reasoned, not measured, and whoever
 *   next runs the real game should look at the 60-pixel band and say.
 *
 *   The case for clipping does not rest on that link: the build's own border
 *   art is 732x505 on a 640x420 stage — **oversized on every edge on purpose**,
 *   which is a thing you draw only when you know the overhang is cut off.
 *
 * Returned in CANVAS pixels, ready for `ctx.rect(...)` then `ctx.clip()`, and
 * computed here rather than in a shell for the reason every decision in this
 * module is: `tools/arena/main.js` cannot be imported by node, so arithmetic
 * that lives there is unreachable by the suite, and that arrangement has
 * produced five live defects in a day.
 */
/**
 * WHERE THE STAGE ACTUALLY IS, IN BOTH COORDINATE SYSTEMS — the arena's answer
 * to "report your own canvas rect".
 *
 * ► **THIS EXISTS BECAUSE EVERY "INSIDE THE STAGE" NUMBER SO FAR WAS DERIVED
 *   FROM A PAGE LAYOUT RATHER THAN ASKED OF THE PAGE.** The 2026-09-15 residual
 *   was reported as "392 of the 176,211 pixels inside the fitted stage"; the
 *   stage was 186,667 device pixels and the count was 399, and the error was in
 *   the rectangle the reader assumed rather than in anything measured. A first
 *   attempt at this check reported a false FAILURE for exactly that reason.
 *
 * ► **AND IT IS A VALUE, NOT A LOG LINE.** The previous attempt logged into the
 *   surface panel and its output was never seen — for reasons that turned out to
 *   be about the SHOT (the panel sits below the fold at every size the clip work
 *   was taken at), not about the page. A value hung on `window` is read back
 *   with one `Runtime.evaluate`, which `tools/shot-live.mjs` already does for
 *   `window.__frames`, and it comes back as a number rather than as a picture of
 *   a number.
 *
 * The shell supplies the three things no module here can see — `canvas.width`,
 * `canvas.height` and the CSS rect the canvas occupies — and everything else is
 * `stageFitFor` and `stageClipRectFor`, called rather than re-typed.
 *
 * @param {object} canvas   `{ width, height }` in DEVICE pixels — `canvas.width`.
 * @param {object} cssRect  `{ width, height }` in PAGE pixels — the element's own
 *                          `getBoundingClientRect()`. Optional; without it the
 *                          page half of the answer is reported as null rather
 *                          than guessed at.
 */
export function stageFitReportFor({ canvas, cssRect = null } = {}) {
  const width = Number.isFinite(canvas?.width) && canvas.width > 0 ? canvas.width : SS2_STAGE.width;
  const height = Number.isFinite(canvas?.height) && canvas.height > 0 ? canvas.height : SS2_STAGE.height;
  const fit = stageFitFor({ width, height });
  const device = stageClipRectFor(fit);
  // ► **THE RATIO IS DERIVED FROM THE TWO RECTANGLES, NOT READ FROM
  //   `devicePixelRatio`.** What matters to a reader turning a screenshot
  //   coordinate into a stage coordinate is the ratio the canvas ACTUALLY has,
  //   and a canvas whose backing store disagrees with its CSS box — which is
  //   every canvas mid-resize — would be described wrongly by the global.
  const ratio = Number.isFinite(cssRect?.width) && cssRect.width > 0 ? width / cssRect.width : null;
  return Object.freeze({
    canvas: Object.freeze({ width, height }),
    css: cssRect
      ? Object.freeze({ width: cssRect.width, height: cssRect.height })
      : null,
    ratio,
    scale: fit.scale,
    device,
    page: ratio
      ? Object.freeze({
        x: device.x / ratio, y: device.y / ratio,
        width: device.width / ratio, height: device.height / ratio
      })
      : null,
    // The bars are what is left, and they are reported rather than left to be
    // subtracted: "the stage is 870 wide on an 870 canvas" and "there are no
    // left and right bars" are the same fact, and only one of them is obvious.
    letterbox: Object.freeze({
      left: device.x,
      top: device.y,
      right: width - (device.x + device.width),
      bottom: height - (device.y + device.height)
    })
  });
}

export function stageClipRectFor(fit) {
  const scale = Number.isFinite(fit?.scale) && fit.scale > 0 ? fit.scale : 1;
  const offsetX = Number.isFinite(fit?.offsetX) ? fit.offsetX : 0;
  const offsetY = Number.isFinite(fit?.offsetY) ? fit.offsetY : 0;
  // ► **SNAPPED TO WHOLE DEVICE PIXELS, AND THAT IS THE WHOLE OF THE 2026-09-15
  //   RESIDUAL.** `stageFitFor` divides by two and multiplies by a float, so this
  //   rectangle lands on an integer only by accident — at the arena's 870x688 it
  //   was y 58.531, height 570.938. A FRACTIONAL clip rectangle makes Chrome clip
  //   through an antialiased mask instead of a whole-pixel scissor, and that mask
  //   perturbs every antialiased edge INSIDE the rectangle, hundreds of pixels
  //   from any boundary. Each edge moves by at most half a device pixel.
  //
  //   Measured in `tools/clip-probe/index.html`, which draws the same content on
  //   the same canvas and varies ONLY the rectangle, with a null control at 0 and
  //   a positive control at 19,911. At 870x688, in a 160x160 box ~200px clear of
  //   every edge:
  //
  //     clip rectangle                          differing px   in the centre box
  //     whole-pixel, cutting nothing                      0            0
  //     whole-pixel inset 20 / 39, CUTTING content   46,393 / 81,393   0
  //     fractional inset 20.37, cutting nothing       3,359 (99.6%     2,548 (max delta 6)
  //                                                    on edges)
  //     the arena's own 0, 58.531, 870 x 570.938     53,720            2,548
  //     the same rectangle snapped (0, 59, 870x570)  50,361            0
  //
  //   So it is the FRACTION and not the cutting: a whole-pixel clip that removes
  //   tens of thousands of pixels at the edges changes nothing in the middle.
  //   ► **AND THE ARENA CONFIRMED IT AT FULL SIZE** — see the handoff for the
  //     before/after counts against `?clip=0`.
  const left = Math.round(offsetX);
  const top = Math.round(offsetY);
  return Object.freeze({
    x: left,
    y: top,
    // Rounded as EDGES rather than as a width, so each side is within half a pixel
    // of the true letterbox. Rounding a width instead would let the right edge
    // drift by a whole pixel when the left one had already moved.
    width: Math.max(1, Math.round(offsetX + SS2_STAGE.width * scale) - left),
    height: Math.max(1, Math.round(offsetY + SS2_STAGE.height * scale) - top)
  });
}

/**
 * ARENA UNITS -> CANVAS PIXELS, as the two closures every drawing site in the
 * shell already calls.
 *
 * ► **THIS EXISTS SO THE SHELL HOLDS NO ARITHMETIC, and that is not tidiness.**
 *   `tools/arena/main.js` cannot be imported by node, so anything computed
 *   there is unreachable by the suite — and the file has given up five live
 *   defects in a day, every one a decision rather than a drawing. `toX`/`toY`
 *   were the last arithmetic left in it; they are composed here instead, out of
 *   `arenaToStage` and `stageFitFor`, both of which are pinned above.
 *
 * `scale` is arena units per canvas pixel and keeps its existing meaning at
 * every call site — line widths, font sizes and the figure's own `k = size *
 * view.scale` all stay correct, because a zoomed-out arena genuinely wants
 * thinner lines and smaller names.
 */
export function stageProjectorFor(camera, fit) {
  const zoom = (camera?.zoomscale ?? 100) / 100;
  return Object.freeze({
    scale: fit.scale * zoom,
    // The horizon is only read by the shell's AUTHORED bowl, which is not drawn
    // when there is extracted art. It is reported anyway, as the arena's own
    // origin in canvas space, so a caller that mixes the two gets a horizon on
    // the sand's own top edge rather than `undefined`.
    horizon: fit.offsetY + SS2_ARENA_ORIGIN.y * fit.scale,
    toX: (x) => fit.offsetX + arenaToStage(camera, { x, y: 200, lift: 0 }).x * fit.scale,
    toY: (y, lift = 0) => fit.offsetY + arenaToStage(camera, { x: 0, y, lift }).y * fit.scale
  });
}

/**
 * WHICH ARENA, WHICH SKY AND WHAT WEATHER — the build's own three dressing
 * choices, and their defaults.
 *
 * ► **THE GAME HAS SIX ARENAS AND THIS REPOSITORY HAD ONE.** `sand` and `crowd`
 *   are both `gotoAndStop(current_arena)` (`+0x0d0f`, `+0x0c99`) over six
 *   frames, and the same index dresses both — so a choice of arena changes the
 *   ground and the stands together and they cannot disagree. Taking frame 1 of
 *   each, as the first version of the extractor did, shipped one sixth of what
 *   was measured and called it "the arena".
 *
 * ► **AND THE SKY IS A CLOCK RUNNING 1..200, NOT A DIE ROLL.**
 *   `_root.sky.gotoAndStop(time_of_day)`; `_global.time_of_day = 1 +
 *   random(23)` is only where it STARTS. `day_night_cycle` runs on a 1500ms
 *   `setInterval` and, while a battle is on, increments it toward 200 and
 *   re-seeks the sky every tick — so **the sky moves while you fight**, and a
 *   new day resets it to 25. All 200 frames are reachable.
 *
 *   **This one nearly cost the night sky.** Reading the bound as 1..23 made
 *   every masked frame (112..200) look unreachable, and "the masks are not a
 *   defect" was one sentence from being written down. They are the night, and
 *   they carry the moon's glow.
 *
 * Defaults are arena 1, hour 1 and dry. **Dry is frame 1 of `rain`, which draws
 * nothing** — the clip's first nine frames are empty, so the resting state is a
 * clear sky rather than a missing layer.
 */
export const SS2_ARENA_DRESSING = Object.freeze({ arena: 1, timeOfDay: 1, weather: 1 });

/** Which frame of a layer's clip this dressing selects. */
export function frameForLayer(layer, dressing = SS2_ARENA_DRESSING) {
  if (!layer?.frameFrom) return 1;
  const wanted = dressing?.[layer.frameFrom];
  return Number.isFinite(wanted) && wanted >= 1 ? Math.trunc(wanted) : 1;
}

/**
 * WHERE A LAYER GOES ON THE STAGE, which is the whole of the `space` field
 * cashed out.
 *
 * A `stage` layer is placed on the root and its own coordinates ARE stage
 * coordinates. An `arena` layer is placed inside the arena clip, so its
 * coordinates are arena-local and the clip's origin is added — and because the
 * arena clip itself is placed UNSCALED, nothing else has to happen.
 *
 * ► **AND THE CAMERA TOUCHES EXACTLY ONE OF THEM.** `combatscale` scales
 *   `gladiators`, which is neither of these — it is the runtime-built child
 *   that holds the rocks and the fighters. The only piece of scenery it moves
 *   is the crowd's `_y`. So a pan or a zoom leaves the sand, the sky, the
 *   backdrop, the rain, the panel and the border exactly where they are.
 */
export function layerPlacementFor(layer, camera) {
  if (layer.space !== "arena") {
    return { x: layer.x, y: layer.y, scale: layer.scale };
  }
  const y = layer.cameraY && Number.isFinite(camera?.crowdY) ? camera.crowdY : layer.y;
  return { x: SS2_ARENA_OFFSET.x + layer.x, y: SS2_ARENA_OFFSET.y + y, scale: layer.scale };
}

/**
 * The layers a surface can actually draw, each with its ops resolved and its
 * stage placement worked out for this camera.
 *
 * Total rather than throwing, for the reason every reader in `props.js` is: a
 * clone with no extraction, or a partial one, must leave a playable arena. An
 * empty list is the honest answer and the caller falls back to its own art.
 *
 * `propOpsFor` is injected rather than imported so this module stays a pure
 * description of the arena and the pack format lives in exactly one file.
 */
export function arenaScreenLayersFor(pack, propOpsFor, camera = null, dressing = {}) {
  if (!pack || typeof propOpsFor !== "function") return Object.freeze([]);
  const chosen = { ...SS2_ARENA_DRESSING, ...dressing };
  const out = [];
  for (const layer of SS2_ARENA_SCREEN_LAYERS) {
    let ops = null;
    try {
      ops = propOpsFor(pack, { linkage: layer.prop, frame: frameForLayer(layer, chosen) });
    } catch {
      // A pack that throws on one linkage must not take the others with it.
      ops = null;
    }
    if (!ops || ops.length === 0) continue;
    out.push(Object.freeze({
      ...layer,
      ops,
      frame: frameForLayer(layer, chosen),
      placement: Object.freeze(layerPlacementFor(layer, camera))
    }));
  }
  // Sorted rather than trusted: the declaration above is already in order, and
  // a reordering edit there must not silently become a paint-order change.
  return Object.freeze(out.sort((left, right) => left.order - right.order));
}

/**
 * The layers that paint UNDER the fighters and the ones that paint OVER them.
 *
 * ► **THE SPLIT IS THE THING A RENDERER GETS WRONG.** Painting all the scenery
 *   and then all the bodies reads as correct on a still and is wrong the moment
 *   an arrow crosses the ornamental border, or a gladiator walks over the UI
 *   bar. The build's own depths say which side of the fighters each layer is
 *   on, and `SS2_GLADIATORS_ORDER` is where they sit in that order.
 */
export function splitArenaScreen(layers) {
  const all = layers ?? [];
  return {
    behind: Object.freeze(all.filter((layer) => layer.order < SS2_GLADIATORS_ORDER)),
    inFront: Object.freeze(all.filter((layer) => layer.order > SS2_GLADIATORS_ORDER))
  };
}

/** Whether a pack holds enough of the arena screen to be worth drawing. */
export function hasArenaScreen(pack, propOpsFor) {
  return arenaScreenLayersFor(pack, propOpsFor).length > 0;
}

/**
 * WHAT THE BOTTOM BAR SHOWS: every readout, where it sits on the STAGE, what
 * its value is a function of, and — counted, in the same record — what this
 * engine cannot supply.
 *
 * ► **IT DRAWS NOTHING AND IT IS NOT A TYPE RENDERER.** The whole of the
 *   glyph work lives in `src/render/text.js`; this returns the identity and the
 *   coordinates, which is this file's subject. See the header for the argument.
 *   `fieldsPlacedIn` is the function of that name from `text.js`, INJECTED the
 *   way `propOpsFor` is above so the pack format stays in one file and this one
 *   keeps no edge to the text renderer.
 *
 * ► **THE TALLY IS THE POINT, NOT A GARNISH.** A caller must not be able to
 *   take the picture without the invoice:
 *
 * ```text
 *   declared          how many readouts this module knows the bar to have
 *   placed            how many of those the pack actually places
 *   missing           declared - placed: a truncated or absent pack
 *   valued            how many the caller supplied live text for
 *   unvalued          placed - valued: drawable, with nothing to say
 *   unresolved        missing + unvalued, and it is the HEADLINE number
 *   undeclared        ids the pack places that this module has never heard of
 *   unplacedInBuild   readouts the build's own script writes into nothing
 * ```
 *
 *   **`unresolved` is deliberately `declared - valued` rather than a count over
 *   `readouts`.** A count over the returned list reads ZERO on a clone with no
 *   pack — nothing in the list, nothing unresolved — which is precisely the
 *   shape of "an approximation that is not counted", the most expensive lesson
 *   on this project. It cannot be zero while anything is absent.
 *   `test/render-arena-backdrop.test.js` recomputes every one of these from
 *   `readouts`, the way `test/extraction-honesty.test.js` recomputes a
 *   manifest's.
 *
 * ► **A READOUT WITH NO VALUE IS `text: null`, NEVER A PLACEHOLDER.** Defaulting
 *   it to the pack's baked string here would report a live readout where there
 *   is none, and the baked string is provably not what a running game shows —
 *   every runtime write in the build disagrees with it in case. A caller that
 *   deliberately wants the shipped opening frame gets it by passing `text:
 *   undefined` to `fieldOpsFor`, which falls back to the field's own tag; that
 *   is the pack's business and it stays there.
 *
 * Total, never throwing, for the reason `arenaScreenLayersFor` is: a clone with
 * no licensed copy must get an empty list and an honest tally rather than a
 * stack trace.
 *
 * @param {object|null} pack             a text pack, or null
 * @param {Function}    fieldsPlacedIn   `text.js`'s reader, injected
 * @param {object}      values           live text per `valueOf` key
 */
export function uiBarReadoutsFor(pack, fieldsPlacedIn, values = {}) {
  const layer = SS2_ARENA_SCREEN_LAYERS.find((entry) => entry.character === 1531) ?? null;
  const bar = Object.freeze({
    character: 1531,
    instance: "fiz_info_panel",
    depth: 438,
    x: layer ? layer.x : 0,
    y: layer ? layer.y : 0
  });

  let placed = [];
  if (pack && typeof fieldsPlacedIn === "function") {
    try {
      placed = fieldsPlacedIn(pack, bar.character) ?? [];
    } catch {
      // A pack that throws on this lookup is a pack with no bar, not a crash.
      placed = [];
    }
  }
  const byId = new Map();
  for (const entry of placed) {
    if (entry && Number.isFinite(entry.id)) byId.set(entry.id, entry);
  }

  const readouts = [];
  let missing = 0;
  let valued = 0;
  for (const declared of SS2_UI_BAR_READOUTS) {
    const found = byId.get(declared.field) ?? null;
    if (!found) { missing += 1; continue; }
    // The pack's matrix is the measurement; the declaration's x/y is the
    // fallback a clone reads, and the two are reported separately so a
    // disagreement is visible rather than averaged away.
    const matrix = Array.isArray(found.matrix) && found.matrix.length === 6 ? found.matrix : null;
    const x = matrix ? matrix[4] / TWIPS_PER_STAGE_PIXEL : declared.x;
    const y = matrix ? matrix[5] / TWIPS_PER_STAGE_PIXEL : declared.y;
    const supplied = values?.[declared.valueOf];
    const text = typeof supplied === "string" && supplied.length > 0 ? supplied : null;
    if (text !== null) valued += 1;
    readouts.push(Object.freeze({
      field: declared.field,
      instance: declared.instance,
      depth: declared.depth,
      valueOf: declared.valueOf,
      drivenBy: declared.drivenBy,
      site: declared.site,
      button: declared.button,
      matrix: matrix ? Object.freeze([...matrix]) : null,
      placedFrom: matrix ? "pack" : "declaration",
      // Inside the bar…
      x,
      y,
      // …and on the stage, which is where a surface actually paints it. The bar
      // is a `stage` layer, so no camera term appears here and none should.
      stageX: bar.x + x,
      stageY: bar.y + y,
      // The instance name the pack read off the PlaceObject, kept separate from
      // the declared one so a rename in the build shows up as a mismatch rather
      // than being silently overwritten by what this file expected.
      packName: found.name ?? null,
      nameMatches: found.name === declared.instance,
      text,
      source: text === null ? null : "caller"
    }));
  }

  const declaredIds = new Set(SS2_UI_BAR_READOUTS.map((entry) => entry.field));
  const undeclared = placed
    .filter((entry) => entry && Number.isFinite(entry.id) && !declaredIds.has(entry.id))
    .map((entry) => entry.id);

  const declared = SS2_UI_BAR_READOUTS.length;
  // Counted against what the bar HAS, not against what came back — see above.
  const unresolved = declared - valued;
  return Object.freeze({
    bar,
    readouts: Object.freeze(readouts),
    unresolved,
    unplaced: SS2_UI_BAR_UNPLACED,
    tally: Object.freeze({
      declared,
      placed: readouts.length,
      missing,
      valued,
      unvalued: readouts.length - valued,
      unresolved,
      undeclared: Object.freeze(undeclared),
      unplacedInBuild: SS2_UI_BAR_UNPLACED.length
    })
  });
}

/**
 * Whether a pack can place the bar's readouts at all — the `hasArenaScreen` of
 * the UI bar, so a caller can choose its own art without inspecting a tally.
 *
 * **It does NOT mean there is anything to say.** A pack can place both fields
 * while this engine has no value for either, which is the state today; that is
 * what `unresolved` is for.
 */
export function hasUiBarReadouts(pack, fieldsPlacedIn) {
  return uiBarReadoutsFor(pack, fieldsPlacedIn).readouts.length > 0;
}
