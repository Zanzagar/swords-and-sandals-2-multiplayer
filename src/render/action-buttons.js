/**
 * THE BUILD'S OWN ACTION BUTTONS — the eight round buttons the overlay puts
 * around the acting gladiator, what each one MEANS, where it sits, and the
 * draw operations for one of them in each of its states.
 *
 * Every offset below is relative to a DoAction BODY, re-derived on 2026-09-24
 * from the session's `all-actions.txt` action dump (sha256 77cb545c…, the
 * oracle). **Cite bodies, never the `DoAction@` tag offsets** (`popups.js`
 * says why). The bodies:
 *
 * ```text
 *   overlay 862 frame 1   0x236947   getphase, attack_chances, the slots' rollover
 *   overlay 862 frame 1   0x2378d2   the items row, the swap slot
 *   overlay 862 frame 4   0x238bc5   the controller selector
 *   overlay 862 frame 5   0x238de8   longrange_warrior
 *   overlay 862 frame 13  0x23a11c   closerange_warrior
 *   overlay 862 frame 20  0x23b171   longrange_archer
 *   overlay 862 frame 28  0x23c4fb   closerange_archer
 *   sprite 2249 frame 1   0x6e4221   gladiators.onEnterFrame — where the overlay goes
 *   root frame 221        0x671ad3   attachMovie("overlay", "overlay", 40000)
 * ```
 *
 * ## What a button IS
 *
 * ► **ONE UNEXPORTED SPRITE, 860, AT EIGHT NAMED SLOTS.** The overlay places
 *   `optionD`/`E`/`F`/`H`/`G`/`A`/`B`/`C` at depths 37/45/53/61/69/77/85/93 on
 *   its frame 1, all character 860, and `swap_inventory` — an instance of
 *   `inventory_buttons` (116) — at 101 (the dump's named-instance table,
 *   `sprite:862/frame:1`).
 *
 * ► **THE ICON IS 860's OWN FRAME, CHOSEN ON THE SLOT, AND IT DEPENDS ON THE
 *   FACING.** Each controller frame writes `optionX.gotoAndStop(N)` straight
 *   on the slot (`+0x09b6` on frame 5: `optionA.gotoAndStop(7)`). The same
 *   verb takes a DIFFERENT frame when the hero faces left for every verb that
 *   points at the foe — `power_attack` is 2 facing right and 13 facing left,
 *   `taunt` 18 and 19, `wincrowd` 29 and 30 — while the absolute moves keep
 *   one (`walkleft` is 6 either way). `SS2_BUTTON_WIRING` is the whole map,
 *   one row per slot per facing per controller, every frame and handler with
 *   its offset.
 *
 * ► **THE BACKGROUND IS A CHILD WITH TWO STATES.** Depth 1 of 860 is
 *   `battlebutton` (826, named-instance table `sprite:860/frame:1`), and the
 *   overlay's one shared rollover sends it to frame 2 and its rollout back to
 *   1 (frame 1 body 0x236947, `+0x0b08` and `+0x0c2e`). Up and over. **There
 *   is no disabled state**: the build HIDES a button it will not offer
 *   (`_visible = false`). The disabled look below is AUTHORED.
 *
 * ► **THE BOW'S FOUR FRAMES CARRY THE AMMUNITION.** 860's frames 20, 22, 23
 *   and 25 — `snipeleft`, `bombardleft`, `sniperight`, `bombardright` — each
 *   place a text field named `ammo_left` and run `ammo_left.text =
 *   _root.game.hero.ammo_left` on entry (860 frame 20 body 0x2364d3, 22
 *   0x2365d1, 23 0x236683, 25 0x236779). The painter fills it from `ammo`.
 *
 * ► **THE ATTACK AND BOW FRAMES CARRY A WORD.** Twelve of 860's frames place
 *   one static text run over the icon under a dark red glow — measured in the
 *   player's own packs (icons `buttons.clips[860]`, text `statics`), not in a
 *   dump: 829 `POWER` on 2 and 13, 830 `NORMAL` on 3 and 14, 831 `QUICK` on 4
 *   and 15, 849 `SNIPE` on 20 and 23, 851 `BASH` on 21 and 24, 852 `BOMBARD`
 *   on 22 and 25. The painter draws the run in the build's own glyphs, with
 *   the placement's glow, when a text pack is handed in; without one it is
 *   counted (`textsNotDrawn`), never guessed at.
 *
 * ## Findings the wiring carries (each is in the table, with its offset)
 *
 * - `closerange_warrior` facing right sends the third psyche frame to
 *   **`optionHG`** (frame 13 `+0x0923`), which is not an instance; at that
 *   counter the psyche button keeps whatever frame it had. `SS2_BUTTON_STRAYS`.
 * - The ranged controller's zero-ammo arm writes **`visible`, not
 *   `_visible`** (frame 20 `+0x09e5`/`+0x09f3`, `+0x0eac`/`+0x0eba`), so the
 *   shots are never hidden — the battle map's "ammunition-visibility defect".
 * - The psyche counter's three tests are `!(c > 1)` → 26, `c == 2` → 27,
 *   `c >= 3` → 28 on every controller (frame 5 `+0x0a63`, `+0x0aa1`,
 *   `+0x0ae0`). The counter's floor is 1 (`SS2_PSYCHE_UP` in the rules), so a
 *   fresh gladiator shows 26.
 * - Frames of 860 that NO controller selects: 1 and 5 below 31, and every
 *   frame from 31 to the clip's end. `unselectedButtonFrames()` is
 *   computed from the table, never typed.
 *
 * ## Where the ring sits (`ss2OverlayPlacement`)
 *
 * `gladiators.onEnterFrame` (sprite 2249 frame 1 body 0x6e4221, the handler
 * at `+0x0e68`) moves the overlay EVERY frame:
 *
 * ```text
 *   gDistance = |hero._x - villain._x|                              +0x0ebf
 *   gDistance < 1600 ? overlay._x = hero._x                         +0x0f08 / +0x0f0d
 *                    : closeUpOverlay = true; overlay._x = midpoint  +0x0f33 / +0x0fbd
 *   overlay.hero._visible = closeUpOverlay                          +0x0fd2
 *   overlay._y = hero._y - 180                                      +0x1028..+0x1051
 *   flipoverlay = {maxscale < 20: 600, 20: 500, 30: 320, 50: 240,
 *                  60: 220, 70: 200, 80: 160}; closeUp -> 600      +0x109d..+0x11a1
 *   overlay._xscale = overlay._yscale = flipoverlay                 +0x11c8 / +0x1224
 * ```
 *
 * ► **"flipoverlay" FLIPS NOTHING.** Both facing arms write the SAME positive
 *   scale (`+0x11c8`..`+0x11f1` and `+0x1224`..`+0x1250`), and the one
 *   negative write in the file — `getfightdistance`'s `overlay._xscale = -100`
 *   (`+0x0385`) — runs at `+0x0e73` of this same handler, its only call site,
 *   and is overwritten before the frame is drawn. The ring is never mirrored;
 *   the facing lives entirely in which frame each slot shows.
 *
 * ► **THE SCALE CANCELS THE CAMERA.** `gladiators` is drawn at
 *   `ceil(zoomscale)`% (`arena-backdrop.js`), and `flipoverlay × maxscale` is
 *   9,000..14,000 across the table, so the ring stays roughly one size on
 *   screen while the fighters shrink. When the fighters stand 1,600 or more
 *   apart the ring moves to the MIDPOINT and shows the overlay's own copy of
 *   the hero, large, at the centre — a close-up, whatever its name says.
 *
 * ## What is NOT established here, named
 *
 * - **The slot positions are relayed, not re-derived.** No dump holds 862's
 *   display list and no agent may open the build. `SS2_OVERLAY_SLOTS` carries
 *   the main session's probe of overlay frame 4; the extractor now writes the
 *   measured matrices for EVERY frame into the pack
 *   (`buttons.layout`), and `test/render-action-buttons.test.js` compares the
 *   two at each controller's resting frame once a pack exists.
 * - **Where the overlay's own `hero` copy sits** is in the same pack field
 *   and nowhere else.
 * - **What 860's unselected frames draw**, and whether any 860 placement
 *   carries a filter, are the extraction's to say.
 *
 * Pure: no canvas, no clock, no battle. A pack is an argument; a missing or
 * hand-edited pack returns `null` and the caller draws
 * `actionButtonFallbackOpsFor`.
 */

import {
  applyColourMatrix,
  applyColourTransformAlpha,
  canvasFilterFor,
  colourTransformFrom,
  concatColourTransforms,
  glowAmplificationFor
} from "./filters.js";
import { propOpsFor } from "./props.js";
import { fieldOpsFor, staticTextOpsFor } from "./text.js";

export class ActionButtonError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/* ------------------------------------------------------------------ */
/* The wiring — which art and which verb, per controller, facing, slot */
/* ------------------------------------------------------------------ */

/** The eight slots, in the build's own names, and the ninth. */
export const SS2_OPTION_SLOTS = Object.freeze([
  "optionA", "optionB", "optionC", "optionD", "optionE", "optionF", "optionG", "optionH"
]);
export const SS2_SWAP_SLOT = "swap_inventory";

/**
 * One wired verb on one slot: the `getphase` label its `onRelease` calls, the
 * 860 frames the slot is sent to before it (several only for the psyche
 * counter), and where. `when` names a guard the pairing does not decide.
 */
function wire(verb, frames, gotoAt, releaseAt, when = null) {
  return Object.freeze({
    verb,
    frames: Object.freeze(frames),
    gotoAt: Object.freeze(gotoAt),
    releaseAt,
    ...(when ? { when: Object.freeze(when) } : {})
  });
}

/** A slot hidden under a test — or, for `visible`, NOT hidden. */
function hide(slot, property, at, rule, test = null) {
  return Object.freeze({ slot, property, at, rule, ...(test ? { test } : {}) });
}

const STAMINA_TAUNT = (test) => ({ test, rule: "staminaleft / staminamax * 100 >= 50" });
const STAMINA_REST = (test) => ({ test, rule: "staminaleft / staminamax * 100 < 50" });
const AMMO = (test) => ({ test, rule: "ammo_left > 0; else `visible = false`, which hides nothing" });

/**
 * THE WHOLE MAP, as `deriveOptionWiring` in `tools/extract-icons.mjs`
 * produces it from the bytes: per controller label, the facing test, and per
 * facing the slots with their wires, plus the hides. Offsets are relative to
 * each controller frame's DoAction body (see the module header).
 *
 * Re-derived 2026-09-24 twice from the action dump — once by a line-regex
 * compaction and once by rebuilding the dump into instruction lists and
 * running `deriveOptionWiring` over them — agreeing on all 84 `gotoAndStop`s
 * and 68 handlers; and agreeing verb for verb with the battle map's "Buttons
 * wired per controller frame". A pack extracted after this date carries the
 * same derivation from the build itself, and the test compares.
 */
export const SS2_BUTTON_WIRING = Object.freeze({
  longrange_warrior: Object.freeze({
    frame: 5, body: 0x238de8, facingTest: "+0x0947", leftFrom: "+0x0e00",
    right: Object.freeze({
      optionA: Object.freeze([wire("jumpleft", [7], ["+0x09b6"], "+0x0d0d")]),
      optionB: Object.freeze([wire("walkleft", [6], ["+0x09cd"], "+0x0d2f")]),
      optionC: Object.freeze([
        wire("taunt", [18], ["+0x0c6c"], "+0x0c91", STAMINA_TAUNT("+0x0c3d")),
        wire("rest", [11], ["+0x0cc6"], "+0x0ceb", STAMINA_REST("+0x0c3d"))
      ]),
      optionD: Object.freeze([wire("jumpright", [8], ["+0x09e4"], "+0x0d51")]),
      optionE: Object.freeze([wire("walkright", [9], ["+0x09fb"], "+0x0d73")]),
      optionF: Object.freeze([wire("chargeright", [12], ["+0x0a12"], "+0x0d95")]),
      optionG: Object.freeze([wire("wincrowd", [29], ["+0x0a29"], "+0x0db7")]),
      optionH: Object.freeze([wire("psyche_up", [26, 27, 28], ["+0x0a68", "+0x0aa6", "+0x0ae5"], "+0x0dd9")])
    }),
    left: Object.freeze({
      optionA: Object.freeze([wire("jumpleft", [7], ["+0x0e6a"], "+0x11c1")]),
      optionB: Object.freeze([wire("walkleft", [6], ["+0x0e81"], "+0x11e3")]),
      optionC: Object.freeze([wire("chargeleft", [17], ["+0x0e98"], "+0x1205")]),
      optionD: Object.freeze([wire("jumpright", [8], ["+0x0eaf"], "+0x1227")]),
      optionE: Object.freeze([wire("walkright", [9], ["+0x0ec6"], "+0x1249")]),
      optionF: Object.freeze([
        wire("taunt", [19], ["+0x1104"], "+0x1129", STAMINA_TAUNT("+0x10d5")),
        wire("rest", [11], ["+0x115e"], "+0x1183", STAMINA_REST("+0x10d5"))
      ]),
      optionG: Object.freeze([wire("psyche_up", [26, 27, 28], ["+0x0f05", "+0x0f43", "+0x0f82"], "+0x126b")]),
      optionH: Object.freeze([wire("wincrowd", [30], ["+0x0f99"], "+0x128d")])
    }),
    hides: Object.freeze({
      right: Object.freeze([
        hide("optionG", "_visible", "+0x0973", "herolevel < 3", "+0x096e"),
        hide("optionH", "_visible", "+0x09a8", "herolevel < 7", "+0x09a3")
      ]),
      left: Object.freeze([
        hide("optionH", "_visible", "+0x0e27", "herolevel < 3", "+0x0e22"),
        hide("optionG", "_visible", "+0x0e5c", "herolevel < 7", "+0x0e57")
      ])
    })
  }),
  closerange_warrior: Object.freeze({
    frame: 13, body: 0x23a11c, facingTest: "+0x076e", leftFrom: "+0x0b9f",
    right: Object.freeze({
      optionA: Object.freeze([wire("jumpleft", [7], ["+0x07dd"], "+0x0a8a")]),
      optionB: Object.freeze([wire("walkleft", [6], ["+0x07f4"], "+0x0aac")]),
      optionC: Object.freeze([wire("shove", [16], ["+0x080b"], "+0x0ace")]),
      optionD: Object.freeze([wire("power_attack", [2], ["+0x0822"], "+0x0af0")]),
      optionE: Object.freeze([wire("normal_attack", [3], ["+0x0839"], "+0x0b12")]),
      optionF: Object.freeze([wire("quick_attack", [4], ["+0x0850"], "+0x0b34")]),
      optionG: Object.freeze([wire("wincrowd", [29], ["+0x0867"], "+0x0b56")]),
      // The third frame went to `optionHG` (+0x0923): see SS2_BUTTON_STRAYS.
      optionH: Object.freeze([wire("psyche_up", [26, 27], ["+0x08a6", "+0x08e4"], "+0x0b78")])
    }),
    left: Object.freeze({
      optionA: Object.freeze([wire("power_attack", [13], ["+0x0c09"], "+0x0eb6")]),
      optionB: Object.freeze([wire("normal_attack", [14], ["+0x0c20"], "+0x0ed8")]),
      optionC: Object.freeze([wire("quick_attack", [15], ["+0x0c37"], "+0x0efa")]),
      optionD: Object.freeze([wire("jumpright", [8], ["+0x0c4e"], "+0x0f1c")]),
      optionE: Object.freeze([wire("walkright", [9], ["+0x0c65"], "+0x0f3e")]),
      optionF: Object.freeze([wire("shove", [10], ["+0x0c7c"], "+0x0f60")]),
      optionG: Object.freeze([wire("psyche_up", [26, 27, 28], ["+0x0cbb", "+0x0cf9", "+0x0d38"], "+0x0f82")]),
      optionH: Object.freeze([wire("wincrowd", [30], ["+0x0d4f"], "+0x0fa4")])
    }),
    hides: Object.freeze({
      right: Object.freeze([
        hide("optionG", "_visible", "+0x079a", "herolevel < 3", "+0x0795"),
        hide("optionH", "_visible", "+0x07cf", "herolevel < 7", "+0x07ca")
      ]),
      left: Object.freeze([
        hide("optionH", "_visible", "+0x0bc6", "herolevel < 3", "+0x0bc1"),
        hide("optionG", "_visible", "+0x0bfb", "herolevel < 7", "+0x0bf6")
      ])
    })
  }),
  longrange_archer: Object.freeze({
    frame: 20, body: 0x23b171, facingTest: "+0x0911", leftFrom: "+0x0e0b",
    right: Object.freeze({
      optionA: Object.freeze([wire("jumpleft", [7], ["+0x0959"], "+0x0d18")]),
      optionB: Object.freeze([wire("walkleft", [6], ["+0x0970"], "+0x0d3a")]),
      optionC: Object.freeze([
        wire("taunt", [18], ["+0x0c77"], "+0x0c9c", STAMINA_TAUNT("+0x0c48")),
        wire("rest", [11], ["+0x0cd1"], "+0x0cf6", STAMINA_REST("+0x0c48"))
      ]),
      optionD: Object.freeze([wire("bombardright", [25], ["+0x09b2"], "+0x0d5c", AMMO("+0x09ad"))]),
      optionE: Object.freeze([wire("walkright", [9], ["+0x0a01"], "+0x0d7e")]),
      optionF: Object.freeze([wire("sniperight", [23], ["+0x09c9"], "+0x0da0", AMMO("+0x09ad"))]),
      optionG: Object.freeze([wire("wincrowd", [29], ["+0x0a18"], "+0x0dc2")]),
      optionH: Object.freeze([wire("psyche_up", [26, 27, 28], ["+0x0a57", "+0x0a95", "+0x0ad4"], "+0x0de4")])
    }),
    left: Object.freeze({
      optionA: Object.freeze([wire("bombardleft", [22], ["+0x0e79"], "+0x120d", AMMO("+0x0e74"))]),
      optionB: Object.freeze([wire("walkleft", [6], ["+0x0ec8"], "+0x122f")]),
      optionC: Object.freeze([wire("snipeleft", [20], ["+0x0e90"], "+0x1251", AMMO("+0x0e74"))]),
      optionD: Object.freeze([wire("jumpright", [8], ["+0x0edf"], "+0x1273")]),
      optionE: Object.freeze([wire("walkright", [9], ["+0x0ef6"], "+0x1295")]),
      optionF: Object.freeze([
        wire("taunt", [19], ["+0x116c"], "+0x1191", STAMINA_TAUNT("+0x113d")),
        wire("rest", [11], ["+0x11c6"], "+0x11eb", STAMINA_REST("+0x113d"))
      ]),
      optionG: Object.freeze([wire("psyche_up", [26, 27, 28], ["+0x0f35", "+0x0f73", "+0x0fb2"], "+0x12b7")]),
      optionH: Object.freeze([wire("wincrowd", [30], ["+0x0fc9"], "+0x12d9")])
    }),
    hides: Object.freeze({
      // ► ONE level test per facing and it skips ONE hide; the psyche hide
      //   after it is unconditional (battle map, corrected 2026-09-23).
      right: Object.freeze([
        hide("optionG", "_visible", "+0x093d", "herolevel < 3", "+0x0938"),
        hide("optionH", "_visible", "+0x094b", "always"),
        hide("optionD", "visible", "+0x09e5", "ammo_left <= 0 — NOT a hide: `visible` is no MovieClip property", "+0x09ad"),
        hide("optionF", "visible", "+0x09f3", "ammo_left <= 0 — NOT a hide: `visible` is no MovieClip property", "+0x09ad")
      ]),
      left: Object.freeze([
        hide("optionH", "_visible", "+0x0e32", "herolevel < 3", "+0x0e2d"),
        hide("optionG", "_visible", "+0x0e40", "always"),
        hide("optionA", "visible", "+0x0eac", "ammo_left <= 0 — NOT a hide: `visible` is no MovieClip property", "+0x0e74"),
        hide("optionC", "visible", "+0x0eba", "ammo_left <= 0 — NOT a hide: `visible` is no MovieClip property", "+0x0e74")
      ])
    })
  }),
  closerange_archer: Object.freeze({
    frame: 28, body: 0x23c4fb, facingTest: "+0x093a", leftFrom: "+0x0d28",
    right: Object.freeze({
      optionA: Object.freeze([wire("jumpleft", [7], ["+0x0982"], "+0x0c13")]),
      optionB: Object.freeze([wire("walkleft", [6], ["+0x0999"], "+0x0c35")]),
      optionC: Object.freeze([wire("shove", [16], ["+0x09b0"], "+0x0c57")]),
      optionD: Object.freeze([wire("jumpright", [8], ["+0x09c7"], "+0x0c79")]),
      optionE: Object.freeze([wire("bash_attack", [24], ["+0x09de"], "+0x0c9b")]),
      // No stamina test on this controller: taunt is always wired.
      optionF: Object.freeze([wire("taunt", [18], ["+0x09f5"], "+0x0cbd")]),
      optionG: Object.freeze([wire("wincrowd", [29], ["+0x0a0c"], "+0x0cdf")]),
      optionH: Object.freeze([wire("psyche_up", [26, 27, 28], ["+0x0a4b", "+0x0a89", "+0x0ac8"], "+0x0d01")])
    }),
    left: Object.freeze({
      optionA: Object.freeze([wire("jumpleft", [7], ["+0x0d6b"], "+0x0ffc")]),
      optionB: Object.freeze([wire("bash_attack", [21], ["+0x0d82"], "+0x101e")]),
      optionC: Object.freeze([wire("taunt", [19], ["+0x0d99"], "+0x1040")]),
      optionD: Object.freeze([wire("jumpright", [8], ["+0x0db0"], "+0x1062")]),
      optionE: Object.freeze([wire("walkright", [9], ["+0x0dc7"], "+0x1084")]),
      optionF: Object.freeze([wire("shove", [10], ["+0x0dde"], "+0x10a6")]),
      optionG: Object.freeze([wire("psyche_up", [26, 27, 28], ["+0x0e1d", "+0x0e5b", "+0x0e9a"], "+0x10c8")]),
      optionH: Object.freeze([wire("wincrowd", [30], ["+0x0eb1"], "+0x10ea")])
    }),
    hides: Object.freeze({
      right: Object.freeze([
        hide("optionG", "_visible", "+0x0966", "herolevel < 3", "+0x0961"),
        hide("optionH", "_visible", "+0x0974", "always")
      ]),
      left: Object.freeze([
        hide("optionH", "_visible", "+0x0d4f", "herolevel < 3", "+0x0d4a"),
        hide("optionG", "_visible", "+0x0d5d", "always")
      ])
    })
  })
});

/** `gotoAndStop` calls on names that are NOT slots. One, and it is a typo in the build. */
export const SS2_BUTTON_STRAYS = Object.freeze([
  Object.freeze({ controller: "closerange_warrior", facing: "right", target: "optionHG", frame: 28, at: "+0x0923", test: "+0x091e" })
]);

/**
 * THE PSYCHE BUTTON'S FRAME FOR A COUNTER, as all four controllers compute it:
 * `if (!(c > 1)) 26; if (c == 2) 27; if (!(c < 3)) 28` (frame 5 `+0x0a63`,
 * `+0x0aa1`, `+0x0ae0`). The counter's floor is 1, so 1 and 2 are the two
 * charges and 3 is the discharge press.
 */
export function psycheButtonFrame(counter) {
  const c = Number.isFinite(counter) ? counter : 1;
  if (!(c > 1)) return 26;
  if (c === 2) return 27;
  if (!(c < 3)) return 28;
  // A non-integer between 2 and 3: none of the three tests fires, and the
  // button keeps its last frame. No write in the build produces one.
  return null;
}

/* ------------------------------------------------------------------ */
/* Per verb: the art, derived from the wiring (never a second table)   */
/* ------------------------------------------------------------------ */

/** Every citation of one verb's frame, by facing, collected from `SS2_BUTTON_WIRING`. */
function collectVerbArt(wiring) {
  const verbs = {};
  for (const [controller, record] of Object.entries(wiring)) {
    for (const facing of ["right", "left"]) {
      for (const [slot, wires] of Object.entries(record[facing])) {
        for (const one of wires) {
          if (!verbs[one.verb]) verbs[one.verb] = { right: new Map(), left: new Map() };
          one.frames.forEach((frame, index) => {
            const seen = verbs[one.verb][facing];
            if (!seen.has(frame)) seen.set(frame, []);
            seen.get(frame).push(Object.freeze({ controller, slot, at: one.gotoAt[index] }));
          });
        }
      }
    }
  }
  const out = {};
  for (const [verb, byFacing] of Object.entries(verbs)) {
    const side = (map) => Object.freeze(Object.fromEntries(
      [...map].sort(([left], [right]) => left - right).map(([frame, cites]) => [frame, Object.freeze(cites)])));
    out[verb] = Object.freeze({ right: side(byFacing.right), left: side(byFacing.left) });
  }
  return Object.freeze(out);
}

/**
 * VERB -> 860 FRAME(S) PER FACING, each with every site that selects it —
 * `SS2_BUTTON_ART.power_attack.right` is `{ 2: [{controller, slot, at}] }`.
 *
 * ► **A VERB ONE FACING NEVER WIRES HAS AN EMPTY SIDE.** `chargeright`,
 *   `bombardright` and `sniperight` are wired facing right only, their `left`
 *   counterparts facing left only. `actionButtonArtFor` then borrows the
 *   other side's frame and SAYS it did (`extrapolated: true`); the icon is the
 *   verb's own art, drawn in a facing the build never shows it in.
 */
export const SS2_BUTTON_ART = collectVerbArt(SS2_BUTTON_WIRING);

/** Every frame of 860 the build selects, ascending. */
export const SS2_SELECTED_BUTTON_FRAMES = Object.freeze([...new Set(
  Object.values(SS2_BUTTON_ART).flatMap((art) => [...Object.keys(art.right), ...Object.keys(art.left)].map(Number))
)].sort((left, right) => left - right));

/**
 * The button clip. `declaredFramesReported` is the main session's probe (41)
 * and is NOT re-derived here; the pack's own `declaredFrames` is the
 * measurement, and `unselectedButtonFrames(n)` works from whichever is given.
 */
export const SS2_ACTION_BUTTON = Object.freeze({
  character: 860,
  declaredFramesReported: 41,
  background: Object.freeze({ instance: "battlebutton", character: 826, frames: Object.freeze({ up: 1, over: 2 }) }),
  /** 860 frames with an `ammo_left` field and a frame script that fills it. */
  ammoFrames: Object.freeze([20, 22, 23, 25]),
  ammoField: "ammo_left"
});

/** The frames of an N-frame button clip that no controller selects. */
export function unselectedButtonFrames(declaredFrames = SS2_ACTION_BUTTON.declaredFramesReported) {
  const selected = new Set(SS2_SELECTED_BUTTON_FRAMES);
  const out = [];
  for (let frame = 1; frame <= declaredFrames; frame += 1) if (!selected.has(frame)) out.push(frame);
  return out;
}

/**
 * THE SWAP BUTTON AND THE ITEMS ROW, both drawn from `inventory_buttons` (116),
 * which the icon pack already holds.
 *
 * - The swap slot shows THE WEAPON IT SWAPS TO: frame 11 (a sword) when
 *   `using_bow == true`, frame 10 (a bow and arrow) otherwise (frame 1 body
 *   0x2378d2: `using_bow == true` at `+0x0eb5`..`+0x0ec0`, `Not`, `Not`, `If`
 *   to `+0x0ee4` = `gotoAndStop(11)`; the fall-through `+0x0ec8` =
 *   `gotoAndStop(10)`). The rollover's words agree: "Switch to melee weapon"
 *   with the bow drawn (`+0x0f5e`), "Switch to ranged weapon" otherwise
 *   (`+0x0f7f`). ~~frame 10 when `using_bow`, 11 otherwise~~ — INVERTED from
 *   ab5feb5 until slice S6 re-read the branch (ring / s6-swap, 2026-09-24),
 *   and the pack's own art agrees: 116 frame 10 holds a two-frame clip (a bow
 *   and its string) and a long thin shape (an arrow), frame 11 one shape (a
 *   sword). Hidden when
 *   `(ammo_left <= 0 && secondary_weapon != 0) || secondary_weapon == 0`
 *   (`+0x0e0a`..`+0x0e9d`) — the first arm hides it at NO ARROWS LEFT too,
 *   bow drawn or not, which the engine's swap offer does not do (see
 *   `docs/design/battle-ui.md`, S6); `onRelease` is `getphase("swap_weapons")`
 *   (`+0x1067`). Both frames place the background under Flash's greyscale
 *   matrix — that is the swap button's normal look, not a disabled one.
 * - Every frame of 116 places its background, `battlebutton` (58), at
 *   (18.25, 18.25) of its own pixels — 365 twips each way, measured in the
 *   player's pack on all 49 frames — so the disc's CENTRE is there, where
 *   860's is at its origin. `backgroundAt` carries it for a layout with no
 *   pack; `test/render-action-buttons.test.js` compares it with a real one.
 * - The items row: `inventory_buttonN.gotoAndStop(hero.inventoryN)`, the item
 *   or spell ID as the frame (sprite 492 frame 1 body 0x50e55, `+0x0132`), in
 *   `inventory_overlay`, attached to the overlay at (0, -80), scale 60
 *   (frame 1 body 0x2378d2, `+0x02fe`..`+0x0365`). Frame 1 is the empty slot
 *   and the build hides it (`+0x02c4`), and a slot above the hero's
 *   `inventory_maxslots` too (`+0x0216`..`+0x027e`).
 * - WHERE THE SIX STAND IN 492 (slice S5, `slots`): 492 is a five-frame clip
 *   whose six instances start stacked at x -17 (-340 twips) on frame 1 and
 *   spread out to frame 5, where it STOPS (492 frame 5 body 0x514b8: `Stop`,
 *   the clip's only other DoAction) — `restsAt`. At rest they stand in one
 *   row at y 0, 42 px apart, and NOT in slot order: left to right the slots
 *   are 5, 4, 1, 2, 3, 6 (x -122, -80, -38, 4, 46, 88), the row growing out
 *   from its middle. Measured in the player's pack (`buttons.inventory.layout`,
 *   each track's matrix at frame 5, scale 1) for a layout with no pack;
 *   `test/render-action-buttons.test.js` compares them with a real one. (The
 *   pack's own `stops` for 492 is EMPTY only because the extractor never
 *   passes 492's stops to `summariseOverlayLayout`; the dump has the `Stop`.)
 * - What each says on rollover is the item's NAME, `_root["inventory" +
 *   hero.inventoryN][1]` (overlay frame 1 body 0x2378d2, `optiontext` at
 *   `+0x0954`..`+0x0aaf`, `tooltip` from `+0x0ab6`), from the item table root
 *   frame 35 builds (body 0x3fa9e2, `+0x4ce6`..`+0x50b8`: `new Array(label,
 *   name, 1, price, description)` per id). `tools/arena/ring.js` carries the
 *   names the engine can use (`RING_ITEM_WORDS`).
 */
export const SS2_STRIP = Object.freeze({
  character: 116,
  linkage: "inventory_buttons",
  swap: Object.freeze({ usingBow: 11, melee: 10, at: Object.freeze(["+0x0ec8", "+0x0ee4"]), verb: "swap_weapons" }),
  backgroundAt: Object.freeze({ x: 18.25, y: 18.25 }),
  items: Object.freeze({
    emptyFrame: 1,
    row: "inventory_overlay",
    rowAt: Object.freeze({ x: 0, y: -80, scale: 0.6 }),
    restsAt: 5,
    slots: Object.freeze({
      inventory_button1: Object.freeze({ x: -38, y: 0, scale: 1 }),
      inventory_button2: Object.freeze({ x: 4, y: 0, scale: 1 }),
      inventory_button3: Object.freeze({ x: 46, y: 0, scale: 1 }),
      inventory_button4: Object.freeze({ x: -80, y: 0, scale: 1 }),
      inventory_button5: Object.freeze({ x: -122, y: 0, scale: 1 }),
      inventory_button6: Object.freeze({ x: 88, y: 0, scale: 1 })
    })
  })
});

/* ------------------------------------------------------------------ */
/* Engine actions -> button verbs                                      */
/* ------------------------------------------------------------------ */

/**
 * The button verb for an engine action type (`Ss2ActionType`'s values, spelled
 * here as strings because `src/render` never imports the rules), or null.
 *
 * - Attacks, shove, bash, taunt, rest, win the crowd, psyche, swap: the
 *   build's own `getphase` label.
 * - `bombard`/`snipe` are unhanded in the engine and handed on the button:
 *   the FACING picks the hand, as the controllers do.
 * - Rank changes are team play's own: `rank_front`/`rank_back`, drawn only by
 *   the authored fallback.
 * - Potions and spells are `item`, drawn from 116 by `itemId`.
 */
export function actionButtonVerbFor(actionType, { facing = "right" } = {}) {
  const hand = facing === "left" ? "left" : "right";
  switch (actionType) {
    case "quick-attack": return "quick_attack";
    case "normal-attack": return "normal_attack";
    case "power-attack": return "power_attack";
    case "shove": return "shove";
    case "bash-attack": return "bash_attack";
    case "walk-left": return "walkleft";
    case "walk-right": return "walkright";
    case "taunt": return "taunt";
    case "rest": return "rest";
    case "wincrowd": return "wincrowd";
    case "psyche-up": return "psyche_up";
    case "bombard": return `bombard${hand}`;
    case "snipe": return `snipe${hand}`;
    case "swap-weapons": return "swap_weapons";
    case "rank-front": return "rank_front";
    case "rank-back": return "rank_back";
    default:
      if (actionType === "drink-potion" || (typeof actionType === "string" && actionType.startsWith("cast-"))) return "item";
      return null;
  }
}

/** Verbs with no art in the build at all; the fallback is their only look. */
export const SS2_AUTHORED_ONLY_VERBS = Object.freeze(["rank_front", "rank_back"]);

/**
 * WHICH CLIP AND FRAME DRAW A VERB, or null when the build has none.
 *
 * @param {string} verb   a `getphase` label, `swap_weapons`, `item`, or an authored verb
 * @param {object} [options]
 * @param {"right"|"left"} [options.facing="right"]  `gladiator_dir`
 * @param {number} [options.psyche=1]   the psyche counter
 * @param {boolean} [options.usingBow=false]  for the swap button
 * @param {number} [options.itemId]     for `item`: the item or spell id, which IS the frame
 * @returns {{clip: "button"|"strip", frame: number, wired: boolean, extrapolated: boolean}|null}
 */
export function actionButtonArtFor(verb, { facing = "right", psyche = 1, usingBow = false, itemId = null } = {}) {
  if (verb === "swap_weapons") {
    return Object.freeze({ clip: "strip", frame: usingBow ? SS2_STRIP.swap.usingBow : SS2_STRIP.swap.melee, wired: true, extrapolated: false });
  }
  if (verb === "item") {
    if (!Number.isInteger(itemId) || itemId <= SS2_STRIP.items.emptyFrame) return null;
    return Object.freeze({ clip: "strip", frame: itemId, wired: true, extrapolated: false });
  }
  const art = SS2_BUTTON_ART[verb];
  if (!art) return null;
  const side = facing === "left" ? "left" : "right";
  const other = side === "left" ? "right" : "left";
  if (verb === "psyche_up") {
    const frame = psycheButtonFrame(psyche);
    if (frame === null) return null;
    return Object.freeze({ clip: "button", frame, wired: Boolean(art[side][frame]), extrapolated: false });
  }
  const own = Object.keys(art[side]).map(Number);
  if (own.length > 0) return Object.freeze({ clip: "button", frame: own[0], wired: true, extrapolated: false });
  const borrowed = Object.keys(art[other]).map(Number);
  if (borrowed.length > 0) return Object.freeze({ clip: "button", frame: borrowed[0], wired: false, extrapolated: true });
  return null;
}

/* ------------------------------------------------------------------ */
/* Where the ring sits                                                 */
/* ------------------------------------------------------------------ */

/**
 * THE SLOTS' OVERLAY-LOCAL POSITIONS — RELAYED, NOT RE-DERIVED.
 *
 * The main session's display-list probe of overlay 862 frame 4 (scratchpad
 * `ui/dump-overlay2.mjs`), as stated in this work's brief; pixels, in the
 * overlay's own unscaled space. Depths are re-derived (the dump's named-
 * instance table). **No agent could check the positions**: `buttons.layout`
 * in a pack extracted after 2026-09-24 holds the measured matrix of every
 * slot on every frame, and `test/render-action-buttons.test.js` compares this
 * table with it at each controller's RESTING frame — which is what a player
 * sees, and may not be frame 4.
 */
export const SS2_OVERLAY_SLOTS_PROVENANCE =
  "relayed probe of overlay frame 4; unverified until a pack carries buttons.layout";
export const SS2_OVERLAY_SLOTS = Object.freeze({
  optionA: Object.freeze({ x: -53.5, y: -38.0, scale: 0.8, depth: 77 }),
  optionB: Object.freeze({ x: -64.2, y: -8.1, scale: 0.8, depth: 85 }),
  optionC: Object.freeze({ x: -64.2, y: 23.4, scale: 0.8, depth: 93 }),
  optionG: Object.freeze({ x: -53.5, y: 53.4, scale: 0.8, depth: 69 }),
  optionD: Object.freeze({ x: 55.0, y: -38.0, scale: 0.8, depth: 37 }),
  optionE: Object.freeze({ x: 66.1, y: -8.1, scale: 0.8, depth: 45 }),
  optionF: Object.freeze({ x: 66.1, y: 23.4, scale: 0.8, depth: 53 }),
  optionH: Object.freeze({ x: 55.0, y: 53.4, scale: 0.8, depth: 61 }),
  swap_inventory: Object.freeze({ x: -93.4, y: 40.4, scale: 0.6, depth: 101 })
});

/**
 * A slot's position from a pack's measured layout at a frame, else the
 * relayed table. `{ x, y, scale, source }`; x/y in overlay pixels.
 */
export function overlaySlotPosition(slot, { layout = null, frame = null } = {}) {
  if (layout && Number.isInteger(frame)) {
    const run = (layout.tracks?.[slot] ?? []).find((candidate) => candidate.from <= frame && frame <= candidate.to);
    const m = run?.matrix;
    if (Array.isArray(m) && m.length === 6 && m.every(Number.isFinite)) {
      return Object.freeze({ x: m[4] / 20, y: m[5] / 20, scale: Math.hypot(m[0], m[1]), source: "pack" });
    }
  }
  const relayed = Object.hasOwn(SS2_OVERLAY_SLOTS, slot) ? SS2_OVERLAY_SLOTS[slot] : null;
  if (!relayed) return null;
  return Object.freeze({ x: relayed.x, y: relayed.y, scale: relayed.scale, source: "relayed" });
}

/**
 * `flipoverlay` per `_global.maxscale` (sprite 2249 frame 1 `+0x109d`..
 * `+0x1180`). `combatscale` only ever writes 80/70/60/50/30/20/15, all of which
 * match; anything else leaves the variable at its PREVIOUS value, which is
 * `null` here and the caller's to keep.
 */
export function ss2FlipOverlayFor(maxscale) {
  if (!Number.isFinite(maxscale)) return null;
  if (maxscale < 20) return 600;
  switch (maxscale) {
    case 20: return 500;
    case 30: return 320;
    case 50: return 240;
    case 60: return 220;
    case 70: return 200;
    case 80: return 160;
    default: return null;
  }
}

/** The numbers `gladiators.onEnterFrame` places the overlay with. */
export const SS2_OVERLAY_PLACEMENT = Object.freeze({
  parent: "_root.arena.gladiators",
  depth: 40000,
  closeUpDistance: 1600,
  aboveFeet: 180,
  closeUpScale: 600
});

/**
 * WHERE THE OVERLAY IS, in the `gladiators` clip's space, this frame.
 *
 * @param {object} at
 * @param {number} at.actorX  the acting fighter's `_x`
 * @param {number} at.actorY  its `_y`
 * @param {number} at.foeX    the other fighter's `_x` (the build's villain)
 * @param {number} at.maxscale  `_global.maxscale`
 * @param {number|null} [at.previousScale]  kept when `maxscale` matches no arm
 * @returns {{x: number, y: number, scalePercent: number|null, closeUp: boolean, showsOwnHero: boolean}}
 */
export function ss2OverlayPlacement({ actorX, actorY, foeX, maxscale, previousScale = null }) {
  const numbers = [actorX, actorY, foeX];
  if (!numbers.every(Number.isFinite)) throw new ActionButtonError("ss2OverlayPlacement needs finite actorX, actorY and foeX.");
  const distance = Math.abs(actorX - foeX);
  const closeUp = !(distance < SS2_OVERLAY_PLACEMENT.closeUpDistance);
  const x = !closeUp ? actorX : (actorX < foeX ? actorX + distance * 0.5 : actorX - distance * 0.5);
  let scalePercent = ss2FlipOverlayFor(maxscale) ?? previousScale;
  if (closeUp) scalePercent = SS2_OVERLAY_PLACEMENT.closeUpScale;
  return Object.freeze({
    x,
    y: actorY - SS2_OVERLAY_PLACEMENT.aboveFeet,
    scalePercent,
    closeUp,
    showsOwnHero: closeUp
  });
}

/* ------------------------------------------------------------------ */
/* The pack                                                            */
/* ------------------------------------------------------------------ */

/**
 * The button half of `assets/icons/icons.json`, or null.
 *
 * Total, like every pack reader here. **A pack extracted before 2026-09-24 has
 * no `buttons` section and still draws the swap button and the items** from
 * `icons.inventory_buttons`; `hasActionButtonArt` says which verbs it can do.
 */
export function actionButtonPackFrom(data) {
  if (!data || typeof data !== "object") return null;
  const shapes = data.shapes;
  if (!shapes || typeof shapes !== "object") return null;
  const buttons = data.buttons && typeof data.buttons === "object" ? data.buttons : null;
  const id = buttons?.button;
  const button = buttons?.clips?.[id] ?? buttons?.clips?.[String(id)] ?? null;
  const strip = data.icons?.inventory_buttons ?? null;
  const usable = (entry) => Boolean(entry && Array.isArray(entry.frames) && entry.frames.length > 0);
  if (!usable(button) && !usable(strip)) return null;
  const children = {};
  for (const source of [data.nested, buttons?.nested]) {
    if (!source || typeof source !== "object") continue;
    for (const [key, entry] of Object.entries(source)) if (usable(entry)) children[key] = entry;
  }
  return Object.freeze({
    button: usable(button) ? button : null,
    strip: usable(strip) ? strip : null,
    children: Object.freeze(children),
    shapes: Object.freeze(shapes),
    texts: Object.freeze(data.texts && typeof data.texts === "object" ? data.texts : {}),
    layout: buttons?.layout ?? null,
    wiring: buttons?.wiring ?? null,
    handlers: buttons?.handlers ?? null,
    inventory: buttons?.inventory ?? null
  });
}

/** Whether a pack can draw a verb from the build's art (with the same options `actionButtonArtFor` takes). */
export function hasActionButtonArt(pack, verb, options = {}) {
  const art = actionButtonArtFor(verb, options);
  if (!art || !pack) return false;
  const entry = art.clip === "button" ? pack.button : pack.strip;
  return Boolean(entry) && art.frame <= entry.frames.length && !frameIsBlank(entry, art.frame);
}

/** A frame the pack itself calls a copy of frame 1 — the empty slot — or one with no placement. */
function frameIsBlank(entry, frame) {
  if (frame === 1) return true;
  const placements = entry.frames[frame - 1];
  if (!Array.isArray(placements) || placements.length === 0) return true;
  const duplicate = entry.duplicateOf?.[frame] ?? entry.duplicateOf?.[String(frame)];
  return duplicate === 1;
}

/* ------------------------------------------------------------------ */
/* Drawing one button                                                  */
/* ------------------------------------------------------------------ */

export const ACTION_BUTTON_STATES = Object.freeze(["normal", "hover", "disabled"]);

/**
 * Flash's greyscale colour matrix — the build's own, on `inventory_buttons`
 * frames 10 and 11 (`tools/extract-icons.mjs`, "THE STRIP'S TWO ARE A
 * GREY-OUT"). AUTHORED USE: the build has no disabled button; this module
 * borrows the build's own grey for one, plus `DISABLED_ALPHA`.
 */
export const SS2_GREYSCALE_MATRIX = Object.freeze([
  0.3086, 0.6094, 0.082, 0, 0,
  0.3086, 0.6094, 0.082, 0, 0,
  0.3086, 0.6094, 0.082, 0, 0,
  0, 0, 0, 1, 0
]);
const DISABLED_ALPHA = 0.55;

const IDENTITY = Object.freeze([1, 0, 0, 1, 0, 0]);
/** A disc centred on its clip's origin: 860's and the authored button's. */
const ORIGIN = Object.freeze({ x: 0, y: 0 });

/** `outer` then `inner`, both `[a, b, c, d, tx, ty]` with tx/ty in TWIPS. */
function compose(outer, inner) {
  const [a, b, c, d, tx, ty] = outer;
  const [e, f, g, h, ux, uy] = inner;
  return [
    a * e + c * f, b * e + d * f,
    a * g + c * h, b * g + d * h,
    a * ux + c * uy + tx, b * ux + d * uy + ty
  ];
}

function matrixOf(value) {
  return Array.isArray(value) && value.length >= 6 && value.slice(0, 6).every(Number.isFinite)
    ? value.slice(0, 6)
    : null;
}

function isBackground(placement, child) {
  return placement.name === SS2_ACTION_BUTTON.background.instance ||
    (Array.isArray(child?.instances) && child.instances.includes(SS2_ACTION_BUTTON.background.instance));
}

/**
 * One frame of an icon-pack entry, flattened into `propOpsFor`'s placement
 * shape (`{shape, matrix, colour, clip, inheritedEffects}`), with nested clips
 * resolved at the frame the STATE chooses and every enclosing effect carried
 * as a group. Text placements come back as `{text: …}` items in paint order.
 */
function flattenEntryFrame(pack, entry, frame, ctx, out) {
  const placements = entry.frames[frame - 1];
  if (!Array.isArray(placements)) return;
  // This entry's own group table, appended once per visit and re-based.
  const base = ctx.groups.length;
  for (const group of Array.isArray(entry.effectGroups) ? entry.effectGroups : []) ctx.groups.push(group);
  for (const placement of placements) {
    const local = matrixOf(placement?.matrix);
    if (!local) continue;
    const matrix = compose(ctx.matrix, local);
    const colour = concatColourTransforms(ctx.colour, colourTransformFrom(placement.colour ?? null));
    let chain = [...ctx.chain, ...(Array.isArray(placement.inheritedEffects)
      ? placement.inheritedEffects.filter(Number.isInteger).map((index) => base + index) : [])];
    if (Array.isArray(placement.filters) && placement.filters.length > 0) {
      // A leaf's or a clip's OWN filter applies to its own raster: a group of
      // exactly what it holds, innermost.
      ctx.groups.push({ filters: placement.filters, path: [], character: placement.character });
      chain = [...chain, ctx.groups.length - 1];
    }
    if (placement.kind === "shape") {
      if (!(pack.shapes[placement.character] ?? pack.shapes[String(placement.character)])) {
        // An icon or background SHAPE the pack does not hold: `propOpsFor`
        // would skip it; it is counted here, so the button is not called whole.
        ctx.counts.shapesMissing += 1;
        continue;
      }
      out.push({
        shape: placement.character,
        matrix,
        colour,
        ...(placement.mask ? { clip: { shape: placement.mask.shape, matrix: compose(ctx.matrix, matrixOf(placement.mask.matrix) ?? IDENTITY) } } : {}),
        ...(chain.length > 0 ? { inheritedEffects: chain } : {})
      });
    } else if (placement.kind === "text") {
      out.push({ text: placement, matrix, colour, chain });
    } else if (placement.kind === "clip") {
      const child = pack.children[placement.character] ?? pack.children[String(placement.character)];
      if (!child) {
        // A background or icon the pack does not hold: drawn WITHOUT it, and
        // counted, never silently.
        ctx.counts.missingChildren += 1;
        continue;
      }
      const background = isBackground(placement, child);
      if (!background && child.frames.length > 1) ctx.counts.childFrameAssumed += 1;
      const wanted = background ? ctx.backgroundFrame : 1;
      const childFrame = Math.min(child.frames.length, Math.max(1, wanted));
      flattenEntryFrame(pack, child, childFrame, { ...ctx, matrix, colour, chain }, out);
    } else {
      ctx.counts.unsupported += 1;
    }
  }
}

/**
 * The group one text placement's glyphs share when the placement carries its
 * own glow, built at the draw scale — `popups.js`'s rule for the pop-ups'
 * glowing numbers, which this is the same case of. Null when it has none.
 */
function glowGroupFor(filters, scale) {
  if (!Array.isArray(filters) || filters.length === 0) return null;
  const built = canvasFilterFor(filters, { scale });
  const amplify = glowAmplificationFor(filters, { scale });
  if (!built.filter && !amplify) return null;
  return Object.freeze({
    id: null, path: Object.freeze([]), character: null, enclosedBy: null,
    filter: built.filter, amplify, composite: null, blendModeRefused: null,
    colourMatricesFolded: 0, ops: 0, placements: 0, counts: built.counts
  });
}

/**
 * One text placement's ops, or none: the ammo count on a bow frame, or the
 * build's word (a static run) on an attack or bow frame — in the build's
 * glyphs when a text pack has them, under the placement's own glow. The
 * placement's colour transform — which carries the disabled state's alpha —
 * fades them, and `grey` folds the disabled state's matrix into their fill,
 * as the props painter does for the shapes.
 */
function textOpsFor(pack, textPack, item, ammo, grey, scale) {
  const placement = item.text;
  const character = placement.character;
  const fade = applyColourTransformAlpha(1, item.colour);
  const tint = (fill) => (grey && typeof fill === "string" ? applyColourMatrix(fill, grey, 1).fill : fill);
  const group = glowGroupFor(placement.filters, scale);
  const finish = (glyphs, role) => glyphs.map((op) => Object.freeze({
    ...op,
    fill: tint(op.fill),
    fillOpacity: (Number.isFinite(op.fillOpacity) ? op.fillOpacity : 1) * fade,
    strokeOpacity: (Number.isFinite(op.strokeOpacity) ? op.strokeOpacity : 1) * fade,
    ...(group ? { group } : {}),
    button: role
  }));
  if (placement.name !== SS2_ACTION_BUTTON.ammoField) {
    const run = textPack?.statics?.[character] ?? textPack?.statics?.[String(character)];
    if (!run) return [];
    // The run's own matrix inside the placement's, as `popups.js` composes a static.
    const glyphs = staticTextOpsFor(textPack, character, { matrix: compose(item.matrix, matrixOf(run.matrix) ?? IDENTITY) });
    return glyphs ? finish(glyphs, "label") : [];
  }
  if (!Number.isFinite(ammo)) return [];
  const text = String(Math.trunc(ammo));
  if (textPack?.fields?.[character] ?? textPack?.fields?.[String(character)]) {
    const glyphs = fieldOpsFor(textPack, character, { text, matrix: item.matrix });
    if (glyphs) return finish(glyphs, "ammo");
  }
  // No glyphs: the plain number at the centre of the field's own box.
  const record = pack.texts?.[character] ?? pack.texts?.[String(character)];
  const b = record?.bounds;
  const m = item.matrix;
  const cx = b && Number.isFinite(b.xMin) ? (b.xMin + b.xMax) / 2 : 0;
  const cy = b && Number.isFinite(b.yMin) ? (b.yMin + b.yMax) / 2 : 0;
  const colour = record?.colour && Number.isFinite(record.colour.red)
    ? `#${[record.colour.red, record.colour.green, record.colour.blue].map((v) => v.toString(16).padStart(2, "0")).join("")}`
    : "#ffffff";
  return [Object.freeze({
    kind: "text", text,
    x: m[0] * cx + m[2] * cy + m[4] / 20,
    y: m[1] * cx + m[3] * cy + m[5] / 20,
    size: Number.isFinite(record?.fontHeight) ? record.fontHeight : 12,
    fill: tint(colour), outline: "#000000", alpha: fade, role: "ammo", button: "ammo"
  })];
}

/**
 * ONE BUTTON, FROM THE PLAYER'S OWN PACK: the background at the state's frame
 * (up, or over for `hover`), the verb's icon, the build's word on the attack
 * and bow frames, and — on the four bow frames — the ammunition count (both
 * only with a text pack). Ops are in the BUTTON's own pixels with `matrix` tx/ty
 * in TWIPS (`propOpsFor`'s convention); the caller composes the slot's matrix.
 *
 * `disabled` is AUTHORED (see `SS2_GREYSCALE_MATRIX`): the whole button inside
 * one group carrying the build's greyscale matrix, at `DISABLED_ALPHA`.
 *
 * Returns null when the pack cannot draw this verb — no pack, no clip, a frame
 * the pack calls blank, or a verb the build has no art for — and the caller
 * draws `actionButtonFallbackOpsFor`.
 *
 * @param {object} pack   from `actionButtonPackFrom`
 * @param {string} verb   see `actionButtonArtFor`
 * @param {object} [options]
 * @param {"normal"|"hover"|"disabled"} [options.state="normal"]
 * @param {"right"|"left"} [options.facing="right"]
 * @param {number} [options.psyche=1]
 * @param {boolean} [options.usingBow=false]
 * @param {number} [options.itemId]
 * @param {number} [options.ammo]      drawn into `ammo_left` where the frame has one
 * @param {object} [options.textPack]  from `textPackFrom`, for the ammo count and the word in the build's glyphs
 * @param {number} [options.scale=1]   device pixels per button pixel, for any filter
 */
export function actionButtonOpsFor(pack, verb, options = {}) {
  return buttonDrawingFor(pack, verb, options)?.ops ?? null;
}

/** The one walk behind the three readers: `{ops, counts, art}`, or null where the pack has no frame for the verb. */
function buttonDrawingFor(pack, verb, options) {
  const { state = "normal" } = options;
  if (!ACTION_BUTTON_STATES.includes(state)) throw new ActionButtonError(`No button state "${state}".`);
  if (!pack) return null;
  const art = actionButtonArtFor(verb, options);
  if (!art) return null;
  const entry = art.clip === "button" ? pack.button : pack.strip;
  if (!entry || art.frame > entry.frames.length || frameIsBlank(entry, art.frame)) return null;
  return { ...drawButton(pack, entry, art, options), art };
}

/**
 * WHAT ONE BUTTON'S DRAWING COULD NOT CARRY, counted: children the pack lacks
 * (`missingChildren` — a button drawn without its background), shapes it
 * lacks (`shapesMissing` — an icon or background drawn without them), multi-frame
 * children other than the background drawn at frame 1 (`childFrameAssumed`),
 * text placements that drew nothing — a word with no text pack to draw it, an
 * ammo field with no count — (`textsNotDrawn`), placements of a kind this
 * cannot draw (`unsupported`). Null where `actionButtonOpsFor` is.
 */
export function actionButtonInvoiceFor(pack, verb, options = {}) {
  const drawing = buttonDrawingFor(pack, verb, options);
  if (!drawing) return null;
  return Object.freeze({ ...drawing.counts, clip: drawing.art.clip, frame: drawing.art.frame });
}

function drawButton(pack, entry, art, options) {
  const { state = "normal", ammo = null, textPack = null, scale = 1 } = options;
  const disabled = state === "disabled";
  const groups = disabled ? [{ filters: [{ type: "colourMatrix", matrix: SS2_GREYSCALE_MATRIX }], path: [], character: null }] : [];
  const counts = { placements: 0, missingChildren: 0, shapesMissing: 0, childFrameAssumed: 0, textsNotDrawn: 0, unsupported: 0 };
  const ctx = {
    matrix: IDENTITY,
    colour: disabled ? Object.freeze([1, 1, 1, DISABLED_ALPHA, 0, 0, 0, 0]) : null,
    chain: disabled ? [0] : [],
    groups,
    backgroundFrame: state === "hover" ? SS2_ACTION_BUTTON.background.frames.over : SS2_ACTION_BUTTON.background.frames.up,
    counts
  };
  const items = [];
  flattenEntryFrame(pack, entry, art.frame, ctx, items);
  // Where this clip centres its disc: its top-level background's translation.
  const background = (entry.frames[art.frame - 1] ?? []).find((placement) => placement?.name === SS2_ACTION_BUTTON.background.instance);
  const at = matrixOf(background?.matrix);
  const centre = at ? Object.freeze({ x: at[4] / 20, y: at[5] / 20 }) : ORIGIN;

  // Shapes go through the props painter a RUN at a time, so a text placement
  // keeps its place in the paint order between them.
  const ops = [];
  let run = [];
  const flush = () => {
    if (run.length === 0) return;
    const drawn = propOpsFor(
      { props: { button: { frames: [run], effectGroups: groups } }, shapes: pack.shapes },
      { linkage: "button", frame: 1, scale });
    if (drawn) ops.push(...drawn);
    run = [];
  };
  for (const item of items) {
    counts.placements += 1;
    if (item.text) {
      flush();
      const drawn = textOpsFor(pack, textPack, item, ammo, disabled ? SS2_GREYSCALE_MATRIX : null, scale);
      if (drawn.length === 0) counts.textsNotDrawn += 1;
      ops.push(...drawn);
    } else {
      run.push(item);
    }
  }
  flush();
  return { ops: ops.length > 0 ? Object.freeze(ops) : null, counts: Object.freeze(counts), centre };
}

/* ------------------------------------------------------------------ */
/* The authored fallback                                               */
/* ------------------------------------------------------------------ */

/**
 * THE FALLBACK'S RADIUS, from the relayed layout: the tightest slot pitch is
 * B→C, 31.5 overlay px at scale 0.8, which is 39.4 button px — so a button of
 * radius 18 leaves a 3.4 px gap and never overlaps its neighbour.
 */
export const FALLBACK_BUTTON_RADIUS = 18;

/**
 * The fallback's colours, from the owner's design canvas ("Actions around the
 * fighter", Team Battle UI): bronze rim, gold on hover, dimmed when disabled.
 */
const FALLBACK_LOOK = Object.freeze({
  normal: Object.freeze({ fill: "#33291d", rim: "#c08a3e", glyph: "#f3e6c8", halo: null, alpha: 1 }),
  hover: Object.freeze({ fill: "#4a3d2a", rim: "#f2c14e", glyph: "#fff6e4", halo: "#f2c14e", alpha: 1 }),
  disabled: Object.freeze({ fill: "#221c14", rim: "#6b5e48", glyph: "#7d7462", halo: null, alpha: 0.8 })
});

/** A circle as eight quadratic segments — the same curve vocabulary the extracted shapes use. */
function circlePath(r, cx = 0, cy = 0) {
  const k = r / Math.cos(Math.PI / 8);
  const point = (radius, angle) => `${(cx + radius * Math.cos(angle)).toFixed(3)} ${(cy + radius * Math.sin(angle)).toFixed(3)}`;
  let d = `M${point(r, 0)}`;
  for (let step = 0; step < 8; step += 1) {
    const start = (step * Math.PI) / 4;
    d += `Q${point(k, start + Math.PI / 8)} ${point(r, start + Math.PI / 4)}`;
  }
  return `${d}Z`;
}

/**
 * The glyphs, pointing RIGHT, in a ±10 px box: stroke-only polylines as SVG
 * path data (M/L/Q only). `mirror` flips them for a left-pointing verb.
 */
const GLYPHS = Object.freeze({
  walk: "M-2 -7L5 0L-2 7",
  jump: "M-8 6Q0 -14 8 4M8 4L3 3M8 4L8 -1",
  charge: "M-7 -6L-1 0L-7 6M0 -6L6 0L0 6",
  quick: "M-7 5L5 -7M5 -7L1 -6.5M5 -7L4.5 -3",
  normal: "M-7 7L6 -6M-5 2L-2 5M6 -6L7 -7",
  power: "M-8 8L4 -4M-6 3L-3 6M4 -4L6 -6M6 -9L6 -6L9 -6M8 -2L6 -4",
  shove: "M-6 -7L-6 7M-3 0L7 0M3 -4L7 0L3 4",
  bash: "M-2 -8Q6 0 -2 8M-2 -8L-2 8M3 -3L7 -1M3 3L7 1",
  taunt: "M-7 -5L7 -5L7 3L0 3L-4 7L-4 3L-7 3Z",
  rest: "M-7 -6L-1 -6L-7 0L-1 0M1 1L6 1L1 6L6 6",
  wincrowd: "M0 -8L2.4 -2.5L8 -2.5L3.5 1L5 7L0 3.5L-5 7L-3.5 1L-8 -2.5L-2.4 -2.5Z",
  psyche: "M0 -8Q7 -1 3 5Q0 8 -3 5Q-6 1 0 -8M0 -1Q2 2 0 4",
  bombard: "M-8 6Q-2 -12 7 2M7 2L2 1M7 2L7 -3",
  snipe: "M-8 0L7 0M3 -3L7 0L3 3M-8 0L-6 -3M-8 0L-6 3",
  swap: "M-7 -3L6 -3M3 -6L6 -3L3 0M7 3L-6 3M-3 0L-6 3L-3 6",
  rankBack: "M-6 3L0 -3L6 3",
  rankFront: "M-6 -3L0 3L6 -3",
  potion: "M-2 -8L2 -8M-2 -8L-2 -4Q-7 -1 -6 4Q-5 8 0 8Q5 8 6 4Q7 -1 2 -4L2 -8",
  spell: "M0 -8L2 -2L8 0L2 2L0 8L-2 2L-8 0L-2 -2Z",
  item: "M0 -7L7 0L0 7L-7 0Z"
});

/**
 * Which glyph a verb takes and whether it points left. A verb aimed at the foe
 * follows the FACING (`facesLeft`); a handed or absolute verb keeps its own.
 */
function glyphFor(verb, { facing = "right", itemId = null } = {}) {
  const facesLeft = facing === "left";
  switch (verb) {
    case "walkleft": return { glyph: "walk", mirror: true };
    case "walkright": return { glyph: "walk", mirror: false };
    case "jumpleft": return { glyph: "jump", mirror: true };
    case "jumpright": return { glyph: "jump", mirror: false };
    case "chargeleft": return { glyph: "charge", mirror: true };
    case "chargeright": return { glyph: "charge", mirror: false };
    case "quick_attack": return { glyph: "quick", mirror: facesLeft };
    case "normal_attack": return { glyph: "normal", mirror: facesLeft };
    case "power_attack": return { glyph: "power", mirror: facesLeft };
    case "shove": return { glyph: "shove", mirror: facesLeft };
    case "bash_attack": return { glyph: "bash", mirror: facesLeft };
    case "taunt": return { glyph: "taunt", mirror: facesLeft };
    case "rest": return { glyph: "rest", mirror: false };
    case "wincrowd": return { glyph: "wincrowd", mirror: false };
    case "psyche_up": return { glyph: "psyche", mirror: false };
    case "bombardleft": return { glyph: "bombard", mirror: true };
    case "bombardright": return { glyph: "bombard", mirror: false };
    case "snipeleft": return { glyph: "snipe", mirror: true };
    case "sniperight": return { glyph: "snipe", mirror: false };
    case "swap_weapons": return { glyph: "swap", mirror: false };
    case "rank_back": return { glyph: "rankBack", mirror: false };
    case "rank_front": return { glyph: "rankFront", mirror: false };
    case "item":
      // 116's own ranges: potions are ids 2..9 and spells 30..49 (the strip's
      // art, `tools/extract-icons.mjs`); anything else is a plain rune.
      if (Number.isInteger(itemId) && itemId >= 2 && itemId <= 9) return { glyph: "potion", mirror: false };
      if (Number.isInteger(itemId) && itemId >= 30 && itemId <= 49) return { glyph: "spell", mirror: false };
      return { glyph: "item", mirror: false };
    default: return null;
  }
}

function pathOp(d, fields) {
  return Object.freeze({
    kind: "path",
    d,
    matrix: IDENTITY,
    fill: fields.fill ?? "none",
    fillRule: "nonzero",
    fillOpacity: fields.fillOpacity ?? 1,
    stroke: fields.stroke ?? null,
    strokeWidth: fields.strokeWidth ?? 0,
    strokeOpacity: fields.strokeOpacity ?? 1,
    authored: true,
    button: fields.button
  });
}

/**
 * THE AUTHORED BUTTON for a fresh clone, or for any verb the build has no art
 * for: a round bronze button of `FALLBACK_BUTTON_RADIUS` with a simple stroked
 * glyph, in the same op shape and space as `actionButtonOpsFor`'s, centred on
 * the button's origin. The psyche glyph carries one to three pips for the
 * counter. Throws on an unknown state; returns the disc alone for a verb with
 * no glyph (never nothing, so a slot is never invisible by accident).
 */
export function actionButtonFallbackOpsFor(verb, options = {}) {
  const { state = "normal", psyche = 1 } = options;
  const look = FALLBACK_LOOK[state];
  if (!look) throw new ActionButtonError(`No button state "${state}".`);
  const r = FALLBACK_BUTTON_RADIUS;
  const ops = [];
  if (look.halo) {
    ops.push(pathOp(circlePath(r + 3), { stroke: look.halo, strokeWidth: 3, strokeOpacity: 0.35 * look.alpha, button: "halo" }));
  }
  ops.push(pathOp(circlePath(r), {
    fill: look.fill, fillOpacity: look.alpha, stroke: look.rim, strokeWidth: 2, strokeOpacity: look.alpha, button: "disc"
  }));
  const chosen = glyphFor(verb, options);
  if (chosen) {
    const d = chosen.mirror ? mirrorPath(GLYPHS[chosen.glyph]) : GLYPHS[chosen.glyph];
    ops.push(pathOp(d, { stroke: look.glyph, strokeWidth: 2.2, strokeOpacity: look.alpha, button: "glyph" }));
    if (verb === "psyche_up") {
      const pips = Math.max(1, Math.min(3, Math.trunc(Number.isFinite(psyche) ? psyche : 1)));
      for (let pip = 0; pip < pips; pip += 1) {
        ops.push(pathOp(circlePath(1.4, -4 + pip * 4, 12), { fill: look.glyph, fillOpacity: look.alpha, button: "pip" }));
      }
    }
  }
  return Object.freeze(ops);
}

/** Negate every x in an M/L/Q path. */
function mirrorPath(d) {
  return d.replace(/([MLQ])([^MLQZ]*)/g, (whole, command, body) => {
    const numbers = body.trim().split(/[\s,]+/).filter((token) => token.length > 0).map(Number);
    const flipped = numbers.map((value, index) => (index % 2 === 0 ? -value : value));
    return `${command}${flipped.join(" ")}`;
  });
}

/**
 * The build's art when the pack has ALL of it, the authored button otherwise —
 * with the answer's source, so a surface can say which it drew, and `centre`:
 * the point of the button's own pixels its disc is centred on. 860 and the
 * authored disc are centred on their origin; `inventory_buttons` (116, the
 * swap and the items) puts its background at (18.25, 18.25) — read here off
 * the drawn frame's own `battlebutton` placement, so a caller can put the
 * disc, not the clip's corner, where it means the button to be.
 *
 * ► **WHOLE, NOT MERELY NON-EMPTY (S3, Codex review pass 2).** A frame whose
 *   icon or background the pack does not hold — a child clip or a shape
 *   missing, or a placement this cannot draw — would come back from
 *   `actionButtonOpsFor` as the rest of the button, and was called the
 *   build's: a bare disc, or an icon floating without its disc. Such a button
 *   is drawn authored instead. A word or count with no text pack to draw it
 *   (`textsNotDrawn`) does not count against it: the icon is whole.
 */
export function actionButtonOps(pack, verb, options = {}) {
  const drawing = buttonDrawingFor(pack, verb, options);
  const whole = drawing?.ops && drawing.counts.missingChildren === 0 && drawing.counts.shapesMissing === 0
    && drawing.counts.unsupported === 0;
  if (whole) return Object.freeze({ ops: drawing.ops, source: "build", centre: drawing.centre });
  return Object.freeze({ ops: actionButtonFallbackOpsFor(verb, options), source: "authored", centre: ORIGIN });
}
