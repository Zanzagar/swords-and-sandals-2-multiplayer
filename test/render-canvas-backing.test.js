/**
 * `canvasBackingFor` — how large the arena's backing store should be.
 *
 * ## WHY THIS FILE EXISTS, and the claim that sent me here was wrong
 *
 * The handoffs of 2026-09-18 and 2026-09-19 both say `tools/arena/main.js` is
 * *"4,110 lines and not one is executed by a test"*, and both rank fixing that
 * second. **Measured 2026-09-19 before acting on it: 13 of the shell's 70
 * top-level functions ARE executed by the suite**, through `liftFromShell` in
 * `test/render-arena-shell.test.js`, which cuts a function out of the source and
 * `new Function`s it — real calls with real assertions. `src/render/arena-shell.js`
 * has also existed since 2026-09-12 to hold exactly these decisions, and carried
 * eight of them before this one.
 *
 * **"No test executes it" was the wrong diagnosis of a real problem.** What is
 * genuinely unreachable is the ~28 shell functions that touch `document`,
 * `window`, a canvas context or `Audio`, because `liftFromShell` evaluates a
 * body with no DOM around it. `sizeCanvasToStage` is one of them — and it is the
 * function whose ABSENCE cost this project every pixel number it published
 * before 2026-09-18, when `<canvas id="arena">` with no width or height was
 * silently 300x150 and the shell only ever read those fields.
 *
 * So the fix is not "make the file importable". It is **take the decision out of
 * the DOM access**, which is what `canvasBackingFor` is: four values in, a size
 * and a `changed` flag out. The shell keeps two reads and two writes.
 *
 * ## WHAT IS THE BUILD'S AND WHAT IS THIS ENGINE'S
 *
 * **None of this is the build's.** Vanilla SS2 is a Flash stage with a fixed
 * 550x400 coordinate space and no backing store at all; `devicePixelRatio` and
 * `getBoundingClientRect` are browser concerns this port has and the game never
 * did. Nothing here is measured against the oracle and nothing may be.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  SS2_GROUP_PAINT_APPROXIMATIONS, canvasBackingFor, groupPaintReadout, settlementReadiness
} from "../src/render/arena-shell.js";

test("A LAID-OUT STAGE IS SIZED IN DEVICE PIXELS, which is the whole point of the function", () => {
  // ► **THE REGRESSION THIS FILE EXISTS FOR.** 300x150 is what a canvas with no
  //   width/height attribute is, and it is what this arena drew through for
  //   weeks. A stage of 1280x720 at ratio 2 is 2560x1440 and nothing else.
  const at = canvasBackingFor({
    rectWidth: 1280, rectHeight: 720, devicePixelRatio: 2,
    currentWidth: 300, currentHeight: 150
  });
  assert.deepEqual(
    { width: at.width, height: at.height, changed: at.changed },
    { width: 2560, height: 1440, changed: true }
  );
});

test("AN UNLAID STAGE KEEPS THE SIZE IT HAS, rather than collapsing for a frame", () => {
  // A stage that has not been laid out reports a 0x0 rect. Dividing the CURRENT
  // backing store by the ratio recovers the CSS size it was last given, so the
  // answer is "no change" and the arena does not blink.
  const at = canvasBackingFor({
    rectWidth: 0, rectHeight: 0, devicePixelRatio: 2,
    currentWidth: 2560, currentHeight: 1440
  });
  assert.equal(at.changed, false, "an unlaid stage must not report a change");
  assert.deepEqual({ width: at.width, height: at.height }, { width: 2560, height: 1440 });
});

test("`changed` IS THE CONTRACT, because assigning a dimension CLEARS the canvas", () => {
  // ► **THE ASSERTION THAT COULD HAVE VARIED, and it is the reason this returns
  //   a flag rather than a size.** Writing `canvas.width` resets the whole 2d
  //   state — transform, clip, composite, every path. A caller that assigned
  //   every frame would wipe the arena every frame, so "already correct" has to
  //   be distinguishable from "resize to the same number".
  const same = canvasBackingFor({
    rectWidth: 1280, rectHeight: 720, devicePixelRatio: 2,
    currentWidth: 2560, currentHeight: 1440
  });
  assert.equal(same.changed, false);

  const moved = canvasBackingFor({
    rectWidth: 1281, rectHeight: 720, devicePixelRatio: 2,
    currentWidth: 2560, currentHeight: 1440
  });
  assert.equal(moved.changed, true, "one CSS pixel of width is two device pixels and is a change");
  assert.equal(moved.width, 2562);
});

test("A MISSING OR ZERO RATIO IS ONE, not a zero-sized canvas", () => {
  // `window.devicePixelRatio` is `undefined` where there is no window and 0 in
  // some headless contexts. The shell's own `|| 1` said both mean "one device
  // pixel per CSS pixel"; this preserves that exactly rather than improving it.
  for (const ratio of [undefined, null, 0, Number.NaN, -2]) {
    const at = canvasBackingFor({ rectWidth: 800, rectHeight: 600, devicePixelRatio: ratio });
    assert.deepEqual(
      { width: at.width, height: at.height, ratio: at.ratio },
      { width: 800, height: 600, ratio: 1 },
      `ratio ${String(ratio)} must fall back to 1`
    );
  }
});

test("A FRACTIONAL RATIO ROUNDS, and rounds the PRODUCT rather than the ratio", () => {
  // 1.5 and 2.25 are real values on Windows display scaling, and rounding the
  // ratio first would lose a whole row of pixels on a tall stage.
  assert.equal(canvasBackingFor({ rectWidth: 1000, rectHeight: 1000, devicePixelRatio: 1.5 }).width, 1500);
  assert.equal(canvasBackingFor({ rectWidth: 1001, rectHeight: 1000, devicePixelRatio: 1.5 }).width, 1502);
  assert.equal(canvasBackingFor({ rectWidth: 1000, rectHeight: 1000, devicePixelRatio: 2.25 }).height, 2250);
});

test("IT NEVER RETURNS A ZERO DIMENSION, because a 0-wide canvas throws on getContext use", () => {
  const nothing = canvasBackingFor({});
  assert.deepEqual({ width: nothing.width, height: nothing.height }, { width: 1, height: 1 });

  const tiny = canvasBackingFor({ rectWidth: 0.2, rectHeight: 0.2, devicePixelRatio: 1 });
  assert.deepEqual({ width: tiny.width, height: tiny.height }, { width: 1, height: 1 },
    "a sub-pixel stage floors at one device pixel, not at zero");
});

test("IT IS A DECISION AND TOUCHES NOTHING — no DOM, no window, no canvas", () => {
  // ► **THE PROPERTY THAT MAKES THIS TESTABLE AT ALL**, and the one the ~28
  //   unreachable shell functions lack. Asserted structurally rather than by
  //   inspection: the function runs to completion in a Node process where
  //   `document`, `window` and `Audio` are all undefined, and this test is
  //   itself the proof. Stated because a later edit reaching for
  //   `window.devicePixelRatio` directly would look harmless and would put this
  //   decision back in the set the suite cannot see.
  assert.equal(typeof globalThis.document, "undefined");
  assert.equal(typeof globalThis.window, "undefined");
  assert.doesNotThrow(() => canvasBackingFor({ rectWidth: 640, rectHeight: 480, devicePixelRatio: 1 }));
});

/* ------------------------------------------------------------------ *
 * settlementReadiness — the second decision lifted out of the DOM set
 * ------------------------------------------------------------------ */

test("A BOUT SETTLES ONLY WHEN ALL FIVE TERMS ARE MET, and the order is not arbitrary", () => {
  const ready = {
    alreadySettled: false, hasResult: true, pendingTokens: 0, playingCount: 0, completionToken: "t"
  };
  assert.deepEqual(settlementReadiness(ready), { ready: true, waitingOn: null });

  // ► **`alreadySettled` IS ASKED FIRST ON PURPOSE.**
  //   `acknowledgeResultAnimations` is not idempotent and the shell latches
  //   `settled` precisely so a second call cannot happen. If that term were
  //   asked last, a settled bout with a fresh token would acknowledge twice.
  assert.deepEqual(
    settlementReadiness({ ...ready, alreadySettled: true }),
    { ready: false, waitingOn: "already-settled" }
  );
});

test("IT NAMES THE FIRST UNMET TERM, because they are not independent", () => {
  // No result means the queues are irrelevant; reporting four reasons would
  // read as four problems when there is one.
  const blocked = {
    alreadySettled: false, hasResult: false, pendingTokens: 4, playingCount: 2, completionToken: null
  };
  assert.equal(settlementReadiness(blocked).waitingOn, "result");

  assert.equal(
    settlementReadiness({ ...blocked, hasResult: true }).waitingOn,
    "action-animations:4",
    "and it carries the COUNT, so the log panel can show progress rather than a boolean"
  );
  assert.equal(
    settlementReadiness({ ...blocked, hasResult: true, pendingTokens: 0 }).waitingOn,
    "figures-playing:2"
  );
  assert.equal(
    settlementReadiness({ ...blocked, hasResult: true, pendingTokens: 0, playingCount: 0 }).waitingOn,
    "completion-token"
  );
});

test("AN EMPTY CALL IS NOT READY, so a caller that forgets a field cannot settle by accident", () => {
  // ► **THE DEFAULTS LEAN THE SAFE WAY.** Acknowledging a bout that has not
  //   finished is worse than failing to acknowledge one that has: the second is
  //   a page that sits there, the first writes an outcome that never happened.
  assert.deepEqual(settlementReadiness(), { ready: false, waitingOn: "result" });
  assert.deepEqual(settlementReadiness({}), { ready: false, waitingOn: "result" });
});

/* ------------------------------------------------------------------ *
 * groupPaintReadout — the panel's claim that nothing was approximated
 * ------------------------------------------------------------------ */

const census = (fields = {}) => ({ groups: 5, ...fields });

test("ALL SIX APPROXIMATION TERMS COUNT, and a dropped one hides the warning", () => {
  // ► **THE ASSERTION THAT MATTERS, and the reason this function was chosen
  //   over the arithmetic-heavy ones.** The panel prints each term AND a
  //   warning keyed on the sum. A term dropped from the sum makes the warning
  //   disappear while the number is still printed beside it — a readout that
  //   contradicts itself, which is worse than either failure alone.
  for (const key of SS2_GROUP_PAINT_APPROXIMATIONS) {
    const at = groupPaintReadout(census({ [key]: 1 }));
    assert.equal(at.approximated, 1, `${key} must count toward the tally`);
    assert.equal(at.anyApproximated, true, `${key} must raise the warning`);
  }
  assert.equal(SS2_GROUP_PAINT_APPROXIMATIONS.length, 6, "six ways a group can be drawn wrong");
  assert.equal(groupPaintReadout(census()).approximated, 0, "and a clean frame tallies zero");
});

test("A MISSING OR NON-NUMERIC COUNTER IS ZERO, not NaN", () => {
  // A NaN sum compares false against `> 0`, so a renderer that stopped
  // reporting a counter would silently stop warning. `Number(...) || 0` is the
  // difference between "no approximations" and "we lost count".
  const at = groupPaintReadout({ groups: 3, groupsSplit: undefined, boxUnknown: "2" });
  assert.equal(at.approximated, 2);
  assert.equal(at.anyApproximated, true);
});

test("THE GATE IS A HIGH-WATER MARK, and asking cannot advance the cap", () => {
  // Nothing drawn, or nothing NEW drawn, says nothing — and hands the state
  // back unchanged, so a caller polling every frame cannot burn the three
  // reports without the census ever growing.
  assert.equal(groupPaintReadout(census({ groups: 0 })).report, false);

  const quiet = groupPaintReadout(census({ groups: 4 }), { seenHigh: 4, reportsMade: 1 });
  assert.equal(quiet.report, false);
  assert.deepEqual([quiet.seenHigh, quiet.reportsMade], [4, 1], "state is handed back untouched");

  const grown = groupPaintReadout(census({ groups: 9 }), { seenHigh: 4, reportsMade: 1 });
  assert.equal(grown.report, true);
  assert.deepEqual([grown.seenHigh, grown.reportsMade], [9, 2]);
});

test("IT STOPS AFTER THREE GROWTHS, because a trail builds up one puff at a time", () => {
  // An arrow attaches its groups over several frames, so the census grows on
  // every one of them and an ungated panel would print the same three lines
  // for the length of the flight.
  let state = { seenHigh: 0, reportsMade: 0 };
  const reported = [];
  for (const groups of [1, 2, 3, 4, 5]) {
    const at = groupPaintReadout(census({ groups }), state);
    state = { seenHigh: at.seenHigh, reportsMade: at.reportsMade };
    reported.push(at.report);
  }
  assert.deepEqual(reported, [true, true, true, false, false]);
});
