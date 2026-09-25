/**
 * THE IN-FRAME TEAM HUD'S WIRING in `tools/arena/main.js` and
 * `tools/arena/index.html` (wave 3), read as TEXT: the shell cannot be
 * imported by node (it needs a canvas and a DOM), so what it draws is pinned by
 * what it calls, and in what order — the pattern of
 * `test/arena-team-hud-wiring.test.js` and `test/arena-layer-clip.test.js`.
 * Every decision is `tools/arena/combat-hud.js`'s, under
 * `test/arena-combat-hud.test.js`; this pins only that the shell asks it and
 * paints the answer where the build paints its panel.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const raw = fs.readFileSync(new URL("../tools/arena/main.js", import.meta.url), "utf8");
/** Comments out, strings blanked, so a word in prose cannot match. */
const code = raw
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ")
  .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, '""');
const page = fs.readFileSync(new URL("../tools/arena/index.html", import.meta.url), "utf8");

/** A function's body in `code` (comments out, strings blanked), sliced by its braces. */
function functionBody(name) {
  const start = code.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is not defined in tools/arena/main.js`);
  let depth = 0;
  for (let index = code.indexOf("{", start); index < code.length; index += 1) {
    if (code[index] === "{") depth += 1;
    else if (code[index] === "}") { depth -= 1; if (depth === 0) return code.slice(start, index + 1); }
  }
  throw new Error(`${name}'s braces do not balance`);
}

/** One top-level function as WRITTEN, to the first closing brace that starts a line. */
function lift(name) {
  const start = raw.indexOf(`\nfunction ${name}(`);
  assert.ok(start >= 0, `${name} is not a top-level function in tools/arena/main.js`);
  const end = raw.indexOf("\n}\n", start);
  assert.ok(end > start, `${name} has no closing brace at the start of a line`);
  return raw.slice(start + 1, end + 2);
}

/** Where `needle` first appears in `haystack`, refusing a miss by name. */
function at(haystack, needle, where) {
  const index = haystack.indexOf(needle);
  assert.ok(index >= 0, `${where} has \`${needle}\``);
  return index;
}

test("LOAD: the icons pack's gauges are read where the pack is used, said in the log, and a pack the gate skipped is said too", () => {
  const icons = functionBody("useIconPack");
  assert.match(icons, /gaugeArt = combatHudArtFor\(data\);\s*log\(gaugeArt\.log\.message, \{ warn: gaugeArt\.log\.warn \}\);/,
    "the renderer's reader, and the case it found, in the log panel");
  assert.match(code, /let gaugeArt = combatHudArtFor\(undefined\);/, "until the gate hands the pack over: not used");
  const open = functionBody("openArena");
  assert.ok(open.indexOf("useArenaPacks(verdict);") < open.indexOf('if (gaugeArt.state === "") log(gaugeArt.log.message, { warn: gaugeArt.log.warn });'),
    "a late or failed icons pack never reaches useIconPack: the gauges' line is said at the open instead");
  assert.ok(raw.includes('if (gaugeArt.state === "unused") log(gaugeArt.log.message, { warn: gaugeArt.log.warn });'));
});

test("D2 + D3: the frame is worked out BEFORE the camera steps — from the wire, held for the blow (D6) — and the camera stands to its top in a team bout only", () => {
  const render = functionBody("render");
  const frame = at(render, "hudFrame = combatHudNow(now);", "render");
  assert.ok(frame < at(render, "stepCamera(now);", "render"), "the camera is handed this frame's band, not the last one's");
  assert.ok(frame < at(render, "const view = viewport(now);", "render"), "and so is the fitted view");
  // The wave-3 verifier: one clock — the camera and the fitted view read the drawn size at the frame's `now`.
  // Mutation: `stepCamera();` (a later arenaNow()) -> red.
  assert.match(render, /stepCamera\(now\);/);
  assert.match(render, /const view = viewport\(now\);/);
  const now = functionBody("combatHudNow");
  assert.match(now, /const shown = heldHudFor\(teamHudFor\(\{ wire: host\.wire\(\), seats \}\), hudHold, \{ now, pendingTokens \}\);/);
  assert.match(now, /return combatHudFrameFor\(\{ hud: shown, pack: gaugeArt\.pack \}\);/, "laid out with the art it is drawn with");
  assert.match(now, /catch \(error\) \{\s*hudFailed\(/, "a layout that throws is said, not silent");
  assert.match(functionBody("stepCamera"),
    /stepFramedCamera\(cameraFrame, placedActors\(now\), \{ result: host\?\.battle\?\.result \?\? null, hudTop: hudFrame\?\.cameraHudTop \?\? null \}\)/,
    "the frame's cameraHudTop — null in a 1v1 (combatHudFrameFor)");
  assert.match(functionBody("stepCamera"), /camera = cameraFrame\.camera;/, "never stripped of hudTop, inkSize or inkLift");
});

test("THE CAMERA'S SIZE FEED: every placed fighter is handed to the camera at the size on screen, not the scene's alone", () => {
  const placed = functionBody("placedActors");
  assert.match(placed, /yscale: cameraYscaleFor\(actor\.yscale, drawnYscaleOf\(id, now\)\),/);
  assert.doesNotMatch(placed, /yscale: actor\.yscale,/);
});

test("D6: the step's hold is made where the step is begun — the model before and after it, the pop-ups it spawned and its tokens", () => {
  const begin = functionBody("beginStep");
  const spawned = at(begin, "const spawned = spawnPopups(step, started, delays);", "beginStep");
  const hold = at(begin, "hudHold = gaugeHoldFor({ before: hudAtStep, after: hudAfter, popups: spawned, tokens: step.actionTokens });", "beginStep");
  assert.ok(spawned < hold, "after the pop-ups are stamped");
  assert.match(begin, /const hudAfter = teamHudFor\(\{ wire: host\.wire\(\), seats \}\);/);
  assert.ok(hold < at(begin, "hudAtStep = hudAfter;", "beginStep"), "and the next step starts from this one's end");
  assert.ok(hold < begin.lastIndexOf("render("), "before the step's first draw");
  assert.match(code, /let hudAtStep = teamHudFor\(\{ wire: host\.wire\(\), seats \}\);/, "the bout's first step starts from the opening wire");
  const spawn = functionBody("spawnPopups");
  assert.match(spawn, /if \(!Number\.isFinite\(boundary\)\) return \[\];/);
  assert.match(spawn, /const spawned = \[\];[^]*spawned\.push\(entry\);[^]*popups\.push\(entry\);[^]*return spawned;/,
    "it hands back exactly what it put on the stage");
});

test("D2: THE HUD IS PAINTED OVER THE FIGHTERS AND ALL THEY THROW, UNDER THE RAIN, THE UI BAR AND THE BORDER — and the ring over it (D4)", () => {
  const stage = functionBody("renderStage");
  const fighters = at(stage, "for (const combatantId of paintOrder) {", "renderStage");
  const drops = at(stage, "drawDrops(view, now);", "renderStage");
  const hud = at(stage, "paintCombatHud(fit);", "renderStage");
  const ring = at(stage, "paintRing(view, fit);", "renderStage");
  const inFront = at(stage, "for (const layer of screen.inFront) {", "renderStage");
  // The build: `gladiators` (the fighters, the arrows, the bolts, the rocks, the blood) is arena depth 5;
  // the panel is arena depth 200000; the rain, the UI bar and the border are root depths 80, 438, 1193.
  assert.ok(fighters < drops && drops < hud, "over everything drawn with the fighters");
  assert.ok(hud < ring, "D4: the ring over the HUD");
  assert.ok(ring < inFront, "and both under the rain, the UI bar and the border");
  assert.equal((stage.match(/paintCombatHud\(/g) ?? []).length, 1, "once a frame, in either view");
});

test("D2: each cluster is painted IN STAGE SPACE under the stage fit, in its ops' own order — paths through the group compositor, words in the page font with their own alignment", () => {
  const paint = functionBody("paintCombatHud");
  assert.match(paint, /for \(const \{ cluster, reading \} of frame\?\.clusters \?\? \[\]\) \{/, "every cluster of this frame's HUD, none when it could not be laid out");
  assert.match(paint, /context\.save\(\);\s*try \{\s*context\.translate\(fit\.offsetX, fit\.offsetY\);\s*context\.scale\(fit\.scale, fit\.scale\);/,
    "the stage fit, like paintArenaLayer: every op is in stage px");
  assert.match(paint, /const ops = combatHudOps\(\{ art: gaugeArt, textPack, cluster, reading, stageScale: fit\.scale \}\);/,
    "the pack's ops or the fallback's, glows built at the stage fit's scale");
  assert.match(paint, /paintGroupRuns\(run, \{ translationDivisor: TWIPS_PER_PIXEL, filtersScaled: true \}, paintLayerOperation\);/,
    "paths as the pop-ups' are: twips translations, the clip in force (D7), each glow composited");
  assert.match(paint, /if \(op\.kind === ""\) \{\s*run\.push\(op\);\s*continue;\s*\}\s*flush\(\);\s*paintHudWord\(op\);/,
    "a word between two runs keeps its place in the paint order");
  assert.ok(raw.includes('if (op.kind === "path") {'));
  assert.match(paint, /catch \(error\) \{\s*failed \+= 1;\s*hudFailed\(/, "a cluster that cannot be drawn is counted and said in the log, and the rest are still drawn");
  assert.match(paint, /finally \{\s*context\.restore\(\);/);
});

test("D2: a page-font word is painted exactly as the layout measured it — em box on a middle baseline, a max(1, size / 7) outline — and anchored at its own alignment", () => {
  // Lifted and run against a recording context: `paintHudWord` reads the module's `context` binding.
  const calls = [];
  const state = {};
  const context = new Proxy(state, {
    get(target, name) {
      if (name in target) return target[name];
      return (...args) => calls.push([name, ...args, { ...target }]);
    },
    set(target, name, value) { target[name] = value; return true; }
  });
  const paintHudWord = new Function("context", `${lift("paintHudWord")}\nreturn paintHudWord;`)(context);
  paintHudWord({ kind: "text", text: "Vasso", x: 60, y: 380, size: 14, fill: "#e0584f", outline: "#000000", alpha: 0.4, align: "left" });
  assert.deepEqual(calls.map(([name, text, x, y]) => [name, text, x, y]), [["strokeText", "Vasso", 60, 380], ["fillText", "Vasso", 60, 380]],
    "the outline under the word, then the word");
  const [, , , , stroked] = calls[0];
  assert.equal(stroked.textAlign, "left", "a name anchors at its field's inner edge, not its centre");
  assert.equal(stroked.textBaseline, "middle");
  assert.equal(stroked.lineWidth, 2, "max(1, 14 / 7): the outline combat-panel.js measures the top with");
  assert.equal(stroked.strokeStyle, "#000000");
  assert.equal(stroked.globalAlpha, 0.4, "a fallen fighter's words fade with his cluster");
  assert.equal(stroked.font, "bold 14px ui-sans-serif, system-ui, sans-serif");
  assert.equal(calls[1][4].fillStyle, "#e0584f", "in his side's colour");
  calls.length = 0;
  paintHudWord({ kind: "text", text: "60 / 60", x: 100, y: 330, size: 7 });
  assert.equal(calls.length, 1, "no outline, no stroke");
  assert.equal(calls[0][4].textAlign, "center", "a number is centred in its box");
  assert.equal(calls[0][4].fillStyle, "#ffffff");
});

test("A FAILURE TO DRAW IS LOUD: said once per cause in the log panel as a warning, and the frame's HUD is a value a headless run reads", () => {
  const failed = functionBody("hudFailed");
  assert.match(failed, /if \(hudFailures\.has\(key\)\) return;\s*hudFailures\.add\(key\);/, "once per cause, not once a frame");
  assert.ok(lift("hudFailed").includes("{ warn: true }"), "a warning");
  const paint = functionBody("paintCombatHud");
  assert.match(paint, /window\.__combatHud = \{/, "the frame's HUD as a value, as `window.__stageFit` is");
  for (const field of ["art: gaugeArt.state", "mode: frame?.layout.mode ?? null", "hudTop: frame?.layout.hudTop ?? null",
    "cameraHudTop: frame?.cameraHudTop ?? null", "clusters: frame?.clusters.length ?? 0", "drawn", "failed"]) {
    assert.ok(paint.includes(field), `window.__combatHud carries ${field}`);
  }
});

test("D4: the ring is kept on the VISIBLE stage — above the UI bar where the build's bar is drawn — for its buttons, labels, arrows and caption", () => {
  const ring = functionBody("paintRing");
  assert.match(ring, /const stage = ringBoundsFor\(fit, \{ barred: arenaScreenAvailable\(\) \}\);/);
  assert.doesNotMatch(ring, /stageClipRectFor/, "~~the whole 0..420 stage the frame is clipped to~~");
  // Every consumer reads that one rectangle.
  assert.match(ring, /bounds: \{ top: stage\.y, bottom: stage\.y \+ stage\.height \}[^]*bounds: \{ top: stage\.y, bottom: stage\.y \+ stage\.height \}/);
  assert.match(ring, /\], stage, \{ fighterX: placement\.x \}\);/);
  assert.match(ring, /ringLabelAt\(button, drawn, size, \{ stage, taken: labelled \}\)/);
  assert.match(ring, /paintRingCaption\(hovered, stage\);/);
  assert.match(ring, /ringButtons = buttons;/, "the click is tested where the buttons were DRAWN");
});

test("THE FITTED VIEW: the band is reserved in a team bout, inside the stage the frame is clipped to — the projection is fittedViewFor's, and the shell holds no arithmetic of its own", () => {
  const view = functionBody("viewport");
  // CODEX PASS 3: each actor at the size he is DRAWN at, as the camera is fed (`placedActors`).
  assert.match(view, /const actors = scene\.drawOrder\.map\(\(combatantId\) => \{\s*const actor = scene\.actors\[combatantId\];\s*return actor \? \{ \.\.\.actor, yscale: cameraYscaleFor\(actor\.yscale, drawnYscaleOf\(combatantId, now\)\) \} : actor;\s*\}\);/);
  assert.match(view, /return fittedViewFor\(\{\s*width,\s*height,\s*fit: stageFitFor\(\{ width, height \}\),\s*frame: hudFrame,\s*actors,\s*frontY: ARENA_FRONT_Y,\s*rankStride: SS2_ARENA\.rankStride,\s*clipped: STAGE_CLIP\s*\}\);/,
    "this frame's band, the clip the frame is drawn under (Codex review of wave 3, pass 1), and the stride `rankOf` sizes a fighter by (pass 2)");
  assert.match(code, /const rankOf = \(drawnY, slotIndex\) =>\s*rankOfDepth\(drawnY, slotIndex, \{ frontY: ARENA_FRONT_Y, rankStride: SS2_ARENA\.rankStride \}\);/,
    "the same stride the figures are drawn at");
  assert.doesNotMatch(view, /toY: \(y, lift\) =>/, "~~the shell's own toY~~: fittedViewFor's");
  assert.doesNotMatch(view, /horizon \+ \(height - horizon\) \* 0\.62/);
  // The stage view is untouched: the build's camera, through the projector.
  assert.match(view, /if \(arenaScreenAvailable\(\)\) \{\s*return stageProjectorFor\(camera, stageFitFor\(\{ width, height \}\)\);\s*\}/);
});

test("PROVENANCE: \"What you are looking at\" carries the gauges' line, derived from the art drawn and its invoice", () => {
  const provenance = functionBody("renderProvenance");
  assert.match(provenance, /combatHudProvenanceFor\(\{ art: gaugeArt, invoice: hudInvoice, open: assetGateOpen \}\)/);
  assert.match(provenance, /const hudInvoice = assetGateOpen \? combatHudInvoiceFor\(gaugeArt, textPack, combatHudNow\(arenaNow\(\)\)\) : null;/,
    "counted over the clusters on the stage, with the text pack they are drawn with");
});

test("D5: the side panel's three readings are no longer SEEN — each is a visually hidden meter with its value in words, the only screen-reader form of the readings", () => {
  const reading = lift("readingNode");
  assert.match(reading, /const meter = hudNode\("span", `visually-hidden reading-\$\{kind\}`\);/, "the page's own visually-hidden class");
  assert.match(reading, /meter\.setAttribute\("role", "meter"\);/);
  assert.match(reading, /meter\.setAttribute\("aria-label", label\);/);
  assert.match(reading, /meter\.setAttribute\("aria-valuenow", String\(reading\.percent\)\);/);
  assert.match(reading, /meter\.setAttribute\("aria-valuetext", reading\.shown \? `\$\{reading\.value\} of \$\{reading\.max\}` : "none"\);/);
  assert.match(reading, /return meter;/);
  assert.doesNotMatch(reading, /style\.width|"num"|"label"|hurt/, "no bar, no number, no label on screen");
  // Names, tags, chips, "N of M standing", the crowd meter and the strip stay (pinned in test/arena-team-hud-wiring.test.js).
  assert.doesNotMatch(page, /\n\s*\.reading[ .]/, "and no style for a visible reading");
  assert.match(page, /\.visually-hidden \{[^}]*position: absolute;[^}]*clip: rect\(0 0 0 0\);/);
});
