/**
 * The figure extractor: its GUARDS, its pure helpers, and THE EXTRACTION
 * ITSELF against a synthetic build assembled at the bottom of this file.
 *
 * ► ~~The extraction itself needs a licensed build and is therefore not under
 *   the suite — `node tools/extract-figure.mjs --report` is how that is
 *   checked, and `preview.html` is how a person checks the result.~~
 *   **CORRECTED 2026-09-14, AND THE BELIEF COST A FIX ITS ONLY COVER.**
 *   `extractFigure` takes a BUFFER, so it needs bytes in the SWF format and
 *   not a licensed build — and because nobody had noticed that, `grep -rn
 *   "extractFigure" test/` returned one COMMENT and the headline fix of
 *   920e9b1 could be deleted with the whole suite still green. The bottom
 *   half of this file now builds those bytes.
 *
 *   What still needs the real build is the MEASUREMENT: how many animations,
 *   how many placements, how many approximations. `--report` remains how that
 *   is checked, and `preview.html` remains how a person checks the result,
 *   because a suite cannot tell a correct rig from a plausible one.
 *
 * What IS under the suite is everything that can go wrong without a licensed
 * build present: where the tool is allowed to write, what it refuses to write
 * through, the arithmetic that turns poses into a viewBox, the invoice every
 * pack entry must carry, and the colour the preview draws.
 *
 * ► **The write guards exist because of a Codex adversarial review, and they
 *   guard two different things.** One is licensing: `--out .` puts extracted
 *   art in the repository root where the ignore rule does not reach it, and on
 *   2026-09-01 exactly that lost 67 raw traces to a single `git add -A`. The
 *   other is evidence: `writeFileSync` follows a symlink and truncates its
 *   destination, and the destination most worth not truncating on this machine
 *   is the measurement oracle the same run is reading.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ExtractFigureError,
  approximationTally,
  assertReplaceableFile,
  assertWritableOutput,
  extractFigure,
  labelKey,
  parseArguments,
  pathApproximations,
  poseBounds,
  previewHtml,
  previewTints
} from "../tools/extract-figure.mjs";
// The OWNER of the colour transform, imported so this file compares the
// preview against it rather than against a second copy of the arithmetic.
import { applyColourTransform, applyColourTransformAlpha } from "../src/render/filters.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SWF = "/somewhere/else/swords_sandals2_download.swf";

/** A scratch directory outside the repository, removed by the caller. */
function scratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "extract-figure-test-"));
}

test("inside the repository, only assets/ may be written to", () => {
  assert.doesNotThrow(() => assertWritableOutput(path.join(REPO_ROOT, "assets", "figure"), SWF));
  assert.doesNotThrow(() => assertWritableOutput(path.join(REPO_ROOT, "assets", "anything", "deeper"), SWF));

  for (const bad of [REPO_ROOT, path.join(REPO_ROOT, "src"), path.join(REPO_ROOT, "docs", "handoffs")]) {
    assert.throws(() => assertWritableOutput(bad, SWF), (error) => {
      assert.ok(error instanceof ExtractFigureError);
      assert.match(error.message, /inside the repository but outside assets\//);
      return true;
    }, `${bad} must be refused`);
  }
});

test("outside the repository is free, because nothing out there can be committed by accident", () => {
  const directory = scratch();
  try {
    // `doesNotThrow` rather than a bare call: the suite's own meta-test is
    // right that a test body which only runs code reports green for any
    // behaviour, this guard turning into a no-op included.
    assert.doesNotThrow(() => assertWritableOutput(directory, SWF));
    assert.doesNotThrow(() => assertWritableOutput(path.join(directory, "one", "two"), SWF));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("the directory holding the build being read is refused outright", () => {
  const directory = scratch();
  try {
    const swf = path.join(directory, "swords_sandals2_download.swf");
    assert.throws(() => assertWritableOutput(directory, swf), /measurement oracle/);
    assert.throws(() => assertWritableOutput(path.dirname(swf), swf), /measurement oracle/);
    // A sibling directory is fine: it does not contain the build.
    assert.doesNotThrow(() => assertWritableOutput(path.join(directory, "out"), swf));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("a symlinked target is refused, because writing through it truncates what it points at", () => {
  const directory = scratch();
  try {
    const victim = path.join(directory, "pretend-build.swf");
    fs.writeFileSync(victim, "the oracle's bytes");
    const link = path.join(directory, "manifest.json");
    fs.symlinkSync(victim, link);

    assert.throws(() => assertReplaceableFile(link, victim), (error) => {
      assert.ok(error instanceof ExtractFigureError);
      assert.match(error.message, /is a symlink/);
      return true;
    });
    assert.equal(fs.readFileSync(victim, "utf8"), "the oracle's bytes", "the guard must not have touched it");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("a target that IS the build is refused even without a link in the way", () => {
  const directory = scratch();
  try {
    const swf = path.join(directory, "build.swf");
    fs.writeFileSync(swf, "bytes");
    assert.throws(() => assertReplaceableFile(swf, swf), /Refusing to write over the build/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("an ordinary file and a missing file are both replaceable", () => {
  const directory = scratch();
  try {
    const target = path.join(directory, "shapes.json");
    assert.doesNotThrow(() => assertReplaceableFile(target, SWF), "nothing there yet");
    fs.writeFileSync(target, "{}");
    assert.doesNotThrow(() => assertReplaceableFile(target, SWF), "a previous run's output");
    fs.mkdirSync(path.join(directory, "a-directory"));
    assert.throws(() => assertReplaceableFile(path.join(directory, "a-directory"), SWF), /not a regular file/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

/**
 * A shapes map shaped exactly the way `extractFigure` builds one: ordinary
 * `DefineShape` entries carrying their own per-shape counters, plus baked morph
 * entries keyed `"<id>@<ratio>"`.
 *
 * ► **The morph entry carrying NO counters is the bug, not a quirk of this
 *   fixture.** `morphKeyFor` wrote `{bounds, morph, ratio, paths}` and the
 *   manifest's tally summed each entry's `approximatedByKind` — which for all
 *   290 baked morphs was `undefined`, contributed nothing through `?? {}`, and
 *   left the paths in `shapes.json` uncounted in the file a human reads. Both
 *   halves are written here so the tally is checked against the pack it will
 *   actually meet.
 */
function mixedShapes() {
  return {
    59: {
      bounds: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
      approximated: 1,
      approximatedByKind: { gradient: 1 },
      paths: [
        { d: "M0 0Z", approximated: "gradient" },
        { d: "M0 0Z", approximated: null }
      ]
    },
    "1105@0": {
      bounds: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
      morph: 1105,
      ratio: 0,
      paths: [
        { d: "M0 0Z", approximated: "gradient" },
        { d: "M0 0Z", approximated: "bitmap" },
        { d: "M0 0Z", approximated: null }
      ]
    }
  };
}

test("THE MANIFEST'S TALLY COUNTS AN APPROXIMATED MORPH PATH, which it used not to", () => {
  // ► This summed `shape.approximatedByKind` and the 290 baked morph entries
  //   have no such field, so an approximated morph path reached `shapes.json`
  //   and reached no tally — a pack of morphs alone reported `total: 0` against
  //   data holding two. That is the arena-walls defect one shape-kind over, and
  //   it is the sixth recurrence on this project.
  //
  //   **DEAD against the installed build and fixed anyway:** re-counted with
  //   `parseMorphShape`, its 44 morphs carry 97 fills and every one is SOLID,
  //   so nothing there can be marked approximated today and the manifest's 8
  //   was right by luck. It stops being luck on any build with a gradient in a
  //   morph, and nothing would have said so.
  const tally = approximationTally(mixedShapes());
  assert.equal(tally.total, 3, "two gradients and a bitmap, one of each from the morph");
  assert.deepEqual(tally.byKind, { gradient: 2, bitmap: 1 });
  assert.equal(tally.paths, 5);
});

test("a pack of MORPHS ALONE tallies its approximations rather than reading zero", () => {
  // The sharpest form of the same defect, and the one worth a test of its own:
  // with no ordinary shape present to contribute a counter, the old sum had
  // nothing to add up and reported a clean pack.
  const shapes = mixedShapes();
  const morphsOnly = { "1105@0": shapes["1105@0"] };
  const tally = approximationTally(morphsOnly);
  assert.notEqual(tally.total, 0, "a tally of zero over approximated data is the whole defect");
  assert.equal(tally.total, 2);
  assert.deepEqual(tally.byKind, { gradient: 1, bitmap: 1 });
  assert.equal(tally.paths, 3);
});

test("the tally IGNORES a per-shape counter that disagrees with the shape's own paths", () => {
  // ► A number written beside the data is not the data. This is what makes the
  //   manifest recomputable rather than merely copied: a per-shape counter that
  //   has drifted — stale, hand-edited, or written by an older extractor —
  //   cannot move the manifest's total.
  const shapes = {
    7: {
      approximated: 99,
      approximatedByKind: { gradient: 99 },
      paths: [{ d: "M0 0Z", approximated: "bitmap" }]
    }
  };
  assert.deepEqual(approximationTally(shapes), { paths: 1, total: 1, byKind: { bitmap: 1 } });
});

test("an empty or absent pack tallies zero rather than throwing, because --report runs before anything is written", () => {
  assert.deepEqual(approximationTally({}), { paths: 0, total: 0, byKind: {} });
  assert.deepEqual(approximationTally(undefined), { paths: 0, total: 0, byKind: {} });
  assert.deepEqual(approximationTally({ 1: {} }), { paths: 0, total: 0, byKind: {} });
});

test("pathApproximations is the per-shape invoice, and it is derived rather than remembered", () => {
  assert.deepEqual(
    pathApproximations([
      { approximated: "gradient" },
      { approximated: "gradient" },
      { approximated: "bitmap" },
      { approximated: null },
      {}
    ]),
    { approximated: 3, approximatedByKind: { gradient: 2, bitmap: 1 } }
  );
  // A shape that approximates nothing still SAYS so, with an empty invoice
  // rather than a missing one — the distinction the morph entries lacked.
  assert.deepEqual(pathApproximations([{ approximated: null }]), { approximated: 0, approximatedByKind: {} });
  assert.deepEqual(pathApproximations([]), { approximated: 0, approximatedByKind: {} });
  assert.deepEqual(pathApproximations(undefined), { approximated: 0, approximatedByKind: {} });
});

test("an unknown flag THROWS rather than running a different job and reporting it as this one", () => {
  assert.deepEqual(parseArguments(["--report"]).report, true);
  assert.equal(parseArguments(["--clip", "703"]).clip, 703);
  assert.equal(parseArguments(["/some/build.swf"]).file, "/some/build.swf");
  assert.throws(() => parseArguments(["--frames", "1-30"]), /Unknown flag "--frames"/);
  assert.throws(() => parseArguments(["--out"]), /--out needs a directory path/);
  assert.throws(() => parseArguments(["--clip", "zero"]), /--clip needs a positive character id/);
  assert.throws(() => parseArguments(["a.swf", "b.swf"]), /Unexpected argument/);
});

test("a label becomes a key that is safe in a file name and in a URL", () => {
  assert.equal(labelKey("StepForward"), "stepforward");
  assert.equal(labelKey("Death_Poisoned"), "death_poisoned");
  assert.equal(labelKey("Attack 1 / left"), "attack-1-left");
  assert.equal(labelKey("--odd--"), "odd");
});

test("pose bounds transform all FOUR corners, because a rotated box is not two rotated corners", () => {
  const shapes = { 1: { bounds: { xMin: 0, xMax: 10, yMin: 0, yMax: 4 } } };
  // A quarter turn: the 10-wide, 4-tall box becomes 4 wide and 10 tall.
  const rotated = poseBounds(shapes, [[{ shape: 1, matrix: [0, 1, -1, 0, 0, 0] }]]);
  assert.deepEqual(rotated, { xMin: -4, xMax: 0, yMin: 0, yMax: 10 });

  // Translation is in TWIPS in the pose data and pixels in the bounds, which is
  // the one unit mismatch in this pipeline and the reason this is asserted.
  const moved = poseBounds(shapes, [[{ shape: 1, matrix: [1, 0, 0, 1, 200, -40] }]]);
  assert.deepEqual(moved, { xMin: 10, xMax: 20, yMin: -2, yMax: 2 });

  assert.deepEqual(poseBounds(shapes, []), { xMin: 0, xMax: 0, yMin: 0, yMax: 0 });
  assert.deepEqual(
    poseBounds(shapes, [[{ shape: 999, matrix: [1, 0, 0, 1, 0, 0] }]]),
    { xMin: 0, xMax: 0, yMin: 0, yMax: 0 },
    "a shape that failed to parse must not poison the viewBox with Infinity"
  );
});

/**
 * ============================================================================
 * `extractFigure` ITSELF, AGAINST A SYNTHETIC BUILD ASSEMBLED IN THIS FILE.
 * ============================================================================
 *
 * ► **THIS EXISTS BECAUSE THE HEADLINE FIX OF 920e9b1 HAD NO CODE-LEVEL COVER
 *   AT ALL.** `morphKeyFor` gained `...pathApproximations(paths)` — the line
 *   that invoices all 290 baked morph entries — and `grep -rn "extractFigure"
 *   test/` returned ONE COMMENT. Deleting the line left the suite green. Its
 *   only guard was `test/extraction-honesty.test.js` reading the gitignored
 *   `assets/figure/shapes.json`, which reflects the code only after somebody
 *   re-runs the extractor by hand: so the guard passed on stale output, and on
 *   a fresh clone `readJson` returned null and the test ran
 *   `assert.equal(null, null)` and returned — a vacuous pass on the very
 *   profile `AGENTS.md` calls expected. A fix nothing can break is a fix
 *   nobody can keep.
 *
 * ► **NOTHING HERE COMES FROM THE LICENSED BUILD**, for the reason
 *   `test/swf-shapes.test.js` and `test/swf-display-list.test.js` both give: a
 *   fixture of real bytes would put extracted art in the repository, which is
 *   the one thing `assets/` exists to prevent. `Swf` below assembles the
 *   specification's own encoding — three characters and a two-frame labelled
 *   timeline — so the extractor is checked against the FORMAT rather than
 *   against one file's contents. It is deliberately a SEPARATE writer from the
 *   two in those files, because importing one test's fixture builder into
 *   another makes a shared wrong assumption look like agreement.
 *
 * What the real build contributes is numbers, quoted and not stored: clip 1241
 * resolves to 101 animations, 2,222 poses, 37,077 placements, 351 shape entries
 * (61 ordinary and 290 baked morphs) and 8 approximated paths, all gradients.
 * Reproduce that with `node tools/extract-figure.mjs --report`, never by
 * committing a fixture.
 */
class Swf {
  constructor() { this.bytes = []; this.current = 0; this.bitCount = 0; }
  bit(value) {
    this.current = (this.current << 1) | (value ? 1 : 0);
    this.bitCount += 1;
    if (this.bitCount === 8) { this.bytes.push(this.current & 0xff); this.current = 0; this.bitCount = 0; }
    return this;
  }
  ub(value, bits) { for (let index = bits - 1; index >= 0; index -= 1) this.bit((value >>> index) & 1); return this; }
  sb(value, bits) { return this.ub(value < 0 ? (1 << bits) + value : value, bits); }
  align() { while (this.bitCount !== 0) this.bit(0); return this; }
  u8(value) { this.align(); this.bytes.push(value & 0xff); return this; }
  u16(value) { this.align(); this.bytes.push(value & 0xff, (value >>> 8) & 0xff); return this; }
  u32(value) {
    this.align();
    this.bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
    return this;
  }
  string(value) {
    this.align();
    for (const byte of Buffer.from(value, "utf8")) this.bytes.push(byte);
    this.bytes.push(0);
    return this;
  }
  raw(bytes) { this.align(); for (const byte of bytes) this.bytes.push(byte); return this; }
  rgba(red, green, blue, alpha) { return this.u8(red).u8(green).u8(blue).u8(alpha); }

  /** A RECT is as wide as its widest field says it is, which is why this measures. */
  rect(xMin = 0, xMax = 0, yMin = 0, yMax = 0) {
    this.align();
    const needed = Math.max(1, ...[xMin, xMax, yMin, yMax].map((value) => {
      let bits = 1;
      while (value < -(2 ** (bits - 1)) || value > 2 ** (bits - 1) - 1) bits += 1;
      return bits;
    }));
    this.ub(needed, 5);
    this.sb(xMin, needed).sb(xMax, needed).sb(yMin, needed).sb(yMax, needed);
    return this.align();
  }

  /** A MATRIX. `b` is RotateSkew0 and `c` is RotateSkew1 — the wire's order. */
  matrix({ a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0 } = {}) {
    this.align();
    const fixed = (value) => Math.round(value * 65536);
    const width = (...values) => Math.max(1, ...values.map((value) => {
      let bits = 1;
      while (value < -(2 ** (bits - 1)) || value > 2 ** (bits - 1) - 1) bits += 1;
      return bits;
    }));
    const hasScale = a !== 1 || d !== 1;
    this.bit(hasScale ? 1 : 0);
    if (hasScale) { const bits = width(fixed(a), fixed(d)); this.ub(bits, 5).sb(fixed(a), bits).sb(fixed(d), bits); }
    const hasRotate = b !== 0 || c !== 0;
    this.bit(hasRotate ? 1 : 0);
    if (hasRotate) { const bits = width(fixed(b), fixed(c)); this.ub(bits, 5).sb(fixed(b), bits).sb(fixed(c), bits); }
    const translate = width(tx, ty);
    this.ub(translate, 5).sb(tx, translate).sb(ty, translate);
    return this.align();
  }

  /**
   * A CXFORMWITHALPHA: the ADD flag first on the wire, the MULTIPLY block first
   * after it. The multiply terms are SIGNED 8.8 fixed point — which is the
   * whole reason the player's own arithmetic floors.
   */
  colourTransform({ multiply = null, add = null, bits = 12 } = {}) {
    this.align();
    this.bit(add ? 1 : 0);
    this.bit(multiply ? 1 : 0);
    this.ub(bits, 4);
    if (multiply) for (const value of multiply) this.sb(Math.round(value * 256), bits);
    if (add) for (const value of add) this.sb(value, bits);
    return this.align();
  }

  buffer() { this.align(); return Buffer.from(this.bytes); }
}

/** One tag: a 10-bit code and a length that grows to 32 bits past 62 bytes. */
function swfTag(code, body) {
  const writer = new Swf();
  const bytes = Buffer.isBuffer(body) ? body : body.buffer();
  if (bytes.length >= 0x3f) writer.u16((code << 6) | 0x3f).u32(bytes.length);
  else writer.u16((code << 6) | bytes.length);
  return writer.raw(bytes).buffer();
}

/** A whole uncompressed FWS file around a tag stream. */
function swfFile(tags) {
  const header = new Swf();
  header.raw(Buffer.from("FWS", "latin1")).u8(6).u32(0).rect(0, 11000, 0, 8000).u16(24 << 8).u16(1);
  return Buffer.concat([header.buffer(), ...tags, swfTag(0, Buffer.alloc(0))]);
}

/** A closed square, written as an edge stream with fill style 1 on its left. */
function squareEdges(writer, size) {
  writer.ub(1, 4).ub(0, 4);                 // fillBits 1, lineBits 0
  writer.bit(0).ub(0b00101, 5);             // StateMoveTo | StateFillStyle1
  writer.ub(10, 5).sb(0, 10).sb(0, 10);
  writer.ub(1, 1);
  const edge = (dx, dy) => writer.bit(1).bit(1).ub(10 - 2, 4).bit(1).sb(dx, 10).sb(dy, 10);
  edge(size, 0); edge(0, size); edge(-size, 0); edge(0, -size);
  writer.bit(0).ub(0, 5);                   // EndShapeRecord
}

/** DefineShape3 with ONE solid RGBA fill. */
function solidShape(id, [red, green, blue, alpha]) {
  const writer = new Swf();
  writer.u16(id).rect(0, 200, 0, 200);
  writer.u8(1).u8(0x00).rgba(red, green, blue, alpha);
  writer.u8(0);
  squareEdges(writer, 200);
  return swfTag(32, writer);
}

/**
 * DefineShape3 with a solid fill AND a line style, so the emitted paths carry a
 * `stroke` and a `strokeOpacity` as well as a fill.
 *
 * ► **A stroked path is a SECOND tinted value per path, and a second default.**
 *   The preview tints the stroke too, and defaults a missing `strokeOpacity` to
 *   1 — so a table built only from fills has a hole in it that only a stroked
 *   shape can find.
 */
function strokedShape(id) {
  const writer = new Swf();
  writer.u16(id).rect(0, 200, 0, 200);
  writer.u8(1).u8(0x00).rgba(0x40, 0x80, 0xc0, 0xff);   // FILLSTYLEARRAY
  writer.u8(1).u16(40).rgba(0xff, 0x00, 0x00, 0x80);    // LINESTYLEARRAY: 2px, half alpha
  writer.ub(1, 4).ub(1, 4);                             // fillBits 1, lineBits 1
  // StateMoveTo | StateFillStyle1 | StateLineStyle, and the fields arrive in
  // the record's own order: move, fill0, fill1, line.
  writer.bit(0).ub(0b01101, 5);
  writer.ub(10, 5).sb(0, 10).sb(0, 10);
  writer.ub(1, 1);
  writer.ub(1, 1);
  const edge = (dx, dy) => writer.bit(1).bit(1).ub(10 - 2, 4).bit(1).sb(dx, 10).sb(dy, 10);
  edge(200, 0); edge(0, 200); edge(-200, 0); edge(0, -200);
  writer.bit(0).ub(0, 5);
  return swfTag(32, writer);
}

/** DefineShape3 with ONE LINEAR GRADIENT fill, which `shapeToPaths` approximates. */
function gradientShape(id) {
  const writer = new Swf();
  writer.u16(id).rect(0, 200, 0, 200);
  writer.u8(1).u8(0x10);
  writer.align().bit(0).bit(0).ub(0, 5).align();   // identity fill MATRIX
  writer.u8(2);                                    // spread 0, interpolation 0, two stops
  writer.u8(0).rgba(0x10, 0x20, 0x30, 0xff);
  writer.u8(255).rgba(0x90, 0xa0, 0xb0, 0xff);
  writer.u8(0);
  squareEdges(writer, 200);
  return swfTag(32, writer);
}

/** A morph edge stream, on its own so the header's offset can be MEASURED. */
function morphEdges(size) {
  const writer = new Swf();
  squareEdges(writer, size);
  return writer.buffer();
}

/** A morph fill style's MATRIX, at fixed generous widths. */
function morphMatrix(writer, { a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0 }) {
  writer.align();
  writer.bit(1).ub(30, 5).sb(Math.round(a * 65536), 30).sb(Math.round(d * 65536), 30);
  writer.bit(1).ub(30, 5).sb(Math.round(b * 65536), 30).sb(Math.round(c * 65536), 30);
  writer.ub(20, 5).sb(tx, 20).sb(ty, 20);
  return writer.align();
}

/**
 * DefineMorphShape (tag 46) holding ONE GRADIENT fill, start and end.
 *
 * ► **A GRADIENT AND NOT A SOLID, ON PURPOSE.** All 44 morphs in the installed
 *   build carry 97 fills and every one is SOLID, so `morphToPaths` cannot mark
 *   anything approximated against that oracle and the missing invoice was a
 *   DEAD defect there — which is exactly why nothing caught it. A gradient
 *   morph is the case the second install lane, or any modded build, hits
 *   first, and its bytes exist nowhere but here.
 */
function gradientMorph(id) {
  const startStream = morphEdges(100);
  const endStream = morphEdges(200);
  const styles = new Swf();
  styles.u8(1).u8(0x10);
  morphMatrix(styles, { a: 2, d: 2, tx: 100, ty: 200 });
  morphMatrix(styles, { a: 4, d: 4, tx: 300, ty: 400 });
  styles.u8(2);
  styles.u8(0).rgba(0xcc, 0, 0, 0xff).u8(0).rgba(0, 0, 0xcc, 0xff);
  styles.u8(255).rgba(0xff, 0xff, 0xff, 0xff).u8(255).rgba(0, 0, 0, 0xff);
  styles.u8(0);
  const stylesBytes = styles.buffer();
  const head = new Swf();
  head.u16(id).rect(0, 100, 0, 100).rect(0, 200, 0, 200).u32(stylesBytes.length + startStream.length);
  return swfTag(46, Buffer.concat([head.buffer(), stylesBytes, startStream, endStream]));
}

/** A `PlaceObject2` body, field by field in the specification's order. */
function place2({ depth, characterId, matrix, colourTransform, ratio, name }) {
  const writer = new Swf();
  let flags = 0;
  if (characterId !== undefined) flags |= 0x02;
  if (matrix) flags |= 0x04;
  if (colourTransform) flags |= 0x08;
  if (ratio !== undefined) flags |= 0x10;
  if (name !== undefined) flags |= 0x20;
  writer.u8(flags).u16(depth);
  if (characterId !== undefined) writer.u16(characterId);
  if (matrix) writer.matrix(matrix);
  if (colourTransform) writer.colourTransform(colourTransform);
  if (ratio !== undefined) writer.u16(ratio);
  if (name !== undefined) writer.string(name);
  return swfTag(26, writer);
}

const showFrame = () => swfTag(1, Buffer.alloc(0));
const frameLabel = (name) => swfTag(43, new Swf().string(name));
const defineSprite = (id, frames, inner) =>
  swfTag(39, new Swf().u16(id).u16(frames).raw(Buffer.concat([...inner, swfTag(0, Buffer.alloc(0))])));
const exportAssets = (pairs) => {
  const writer = new Swf();
  writer.u16(pairs.length);
  for (const [id, name] of pairs) writer.u16(id).string(name);
  return swfTag(56, writer);
};

const RIG_CLIP = 1241;

/**
 * A two-frame rig: a white solid limb under a colour transform, a gradient
 * limb, and a gradient morph placed at ratio 32768 — half way.
 *
 * The transform on the white limb is `x0.5` on every channel with `+64` on
 * alpha, because that is the sharpest floor-versus-round case there is:
 * `255 x 0.5` is exactly 127.5, which floors to `#7f` and rounds to `#80`.
 */
function rigBuild() {
  return swfFile([
    solidShape(10, [0xff, 0xff, 0xff, 0xff]),
    gradientShape(11),
    strokedShape(12),
    gradientMorph(77),
    defineSprite(RIG_CLIP, 2, [
      frameLabel("Standing"),
      place2({
        depth: 1, characterId: 10, matrix: { tx: 20, ty: 40 }, name: "torso",
        colourTransform: { multiply: [0.5, 0.5, 0.5, 0.5], add: [0, 0, 0, 64] }
      }),
      place2({ depth: 2, characterId: 11, matrix: { tx: 60, ty: 0 }, name: "weapon" }),
      place2({
        depth: 4, characterId: 12, matrix: { tx: 0, ty: 80 }, name: "shield",
        colourTransform: { multiply: [0.5, 0.5, 0.5, 0.5], add: [0, 0, 0, 64] }
      }),
      place2({
        depth: 3, characterId: 77, matrix: { tx: 0, ty: 0 }, ratio: 32768, name: "blood",
        colourTransform: { multiply: [1, 1, 1, 1], add: [16, 0, 0, 0] }
      }),
      showFrame(),
      frameLabel("Attack 1"),
      showFrame()
    ]),
    exportAssets([[RIG_CLIP, "hero_battle"]])
  ]);
}

test("extractFigure turns a labelled timeline into animations, shapes and BAKED MORPHS", () => {
  const result = extractFigure(rigBuild(), { clip: RIG_CLIP });

  assert.equal(result.clip, RIG_CLIP);
  assert.equal(result.clipName, "hero_battle", "the ExportAssets name is what makes 1241 legible");
  assert.equal(result.frameCount, 2);
  assert.deepEqual(Object.keys(result.animations), ["standing", "attack-1"]);
  assert.equal(result.animations.standing.label, "Standing");
  assert.equal(result.animations["attack-1"].label, "Attack 1");
  assert.deepEqual(result.failures, [], "nothing here should fail to parse");
  assert.deepEqual(result.unsupported, {}, "a morph is BAKED, not reported unsupported");
  assert.equal(result.morphCount, 1);
  assert.equal(result.placementCount, 8, "four drawables on each of two frames");
  assert.deepEqual(result.colourTransformed, [10, 12], "the tinted ORDINARY shapes, by character id");

  // The morph is an ordinary entry whose key happens to carry its ratio, which
  // is the whole design: the renderer needs no morph parser in the browser.
  assert.deepEqual(Object.keys(result.shapes).sort(), ["10", "11", "12", "77@32768"]);
  assert.equal(result.shapes["77@32768"].morph, 77);
  assert.equal(result.shapes["77@32768"].ratio, 32768);

  const pose = result.animations.standing.poses[0];
  assert.deepEqual(pose.map((placement) => placement.shape), [10, 11, "77@32768", 12]);
  assert.deepEqual(pose.map((placement) => placement.limb), ["torso", "weapon", "blood", "shield"]);
  // A morph placement must reference the BAKED KEY, not the character id — a
  // renderer given 77 finds nothing in the pack and draws a hole.
  assert.equal(pose[2].shape, "77@32768");
  assert.deepEqual(pose[0].matrix, [1, 0, 0, 1, 20, 40]);
  assert.deepEqual(pose[0].colour, [0.5, 0.5, 0.5, 0.5, 0, 0, 0, 64]);
  assert.equal(pose[1].colour, undefined, "an identity transform is omitted, not written as ones");
});

test("A BAKED MORPH CARRIES ITS OWN INVOICE, and this is the test the fix did not have", () => {
  // ► **`morphKeyFor` wrote `{bounds, morph, ratio, paths}` and no invoice**,
  //   while every ordinary shape beside it carried one. 920e9b1 added
  //   `...pathApproximations(paths)` and NOTHING IN THIS REPOSITORY CALLED
  //   `extractFigure`, so deleting that line again left the suite green. The
  //   only guard was a test reading `assets/figure/shapes.json` off disk, which
  //   is gitignored, is refreshed by hand, and is absent on a fresh clone —
  //   where it asserted `null === null` and returned.
  //
  //   Delete the spread from `morphKeyFor` and this goes red without a
  //   licensed build, without `assets/`, and without anybody re-running
  //   anything.
  const shapes = extractFigure(rigBuild(), { clip: RIG_CLIP }).shapes;
  const morph = shapes["77@32768"];

  assert.equal(morph.paths.length, 1);
  assert.equal(morph.paths[0].approximated, "gradient",
    "the fixture is pointless if the morph approximates nothing");
  assert.equal(morph.approximated, 1, "the morph entry must invoice its own approximated path");
  assert.deepEqual(morph.approximatedByKind, { gradient: 1 });

  // THE ALL-OR-NONE RULE, AT THE SOURCE. `test/extraction-honesty.test.js`
  // checks this against a pack on disk; this checks it against the code that
  // writes one. A pack that invoices 61 of 351 entries reads as a pack that
  // invoices.
  for (const [id, shape] of Object.entries(shapes)) {
    assert.notEqual(shape.approximated, undefined, `entry ${id} carries no invoice total`);
    assert.notEqual(shape.approximatedByKind, undefined, `entry ${id} carries no invoice by kind`);
    assert.deepEqual(pathApproximations(shape.paths), {
      approximated: shape.approximated, approximatedByKind: shape.approximatedByKind
    }, `entry ${id}: its own invoice disagrees with its own paths`);
  }
});

test("the manifest's tally counts the morph's approximation, end to end from the bytes", () => {
  // The number `--report` prints and `manifest.json` carries, recounted from
  // the paths of a pack this test built out of a synthetic build. Two gradients
  // — one ordinary shape, one baked morph — and the morph is the half that was
  // uncounted.
  const tally = approximationTally(extractFigure(rigBuild(), { clip: RIG_CLIP }).shapes);
  assert.deepEqual(tally, { paths: 5, total: 2, byKind: { gradient: 2 } });
});

test("extractFigure REFUSES by name rather than returning an empty rig", () => {
  const build = rigBuild();
  assert.throws(() => extractFigure(build, { clip: 9999 }), /No character 9999 in this build/);
  assert.throws(() => extractFigure(build, { clip: 10 }), /is a shape, not a sprite with a timeline/);

  // A sprite with no FrameLabel has no named animations, and a pack of poses
  // nobody can address is worse than an error.
  const unlabelled = swfFile([
    solidShape(10, [0xff, 0, 0, 0xff]),
    defineSprite(RIG_CLIP, 1, [place2({ depth: 1, characterId: 10, matrix: {} }), showFrame()])
  ]);
  assert.throws(() => extractFigure(unlabelled, { clip: RIG_CLIP }), /carries no FrameLabel tags/);
});

/**
 * ---------------------------------------------------------------------------
 * THE PREVIEW'S COLOURS — the fifth copy of the colour transform, removed.
 * ---------------------------------------------------------------------------
 *
 * ► **The emitted page computed `Math.round(value * mul + off)`.** The player
 *   computes `(channel * multTerm) >> 8`, an arithmetic shift, which FLOORS —
 *   `src/render/filters.js` owns that and floors. So the artefact this tool's
 *   own header calls "the reason this tool writes HTML at all", the one a
 *   person compares against the running game, disagreed with the renderer.
 *   Measured on the pack before the change: 11,018 of 47,025 channel
 *   computations across the 4,544 tinted placements, and 1,765 of the 3,290
 *   distinct (fill, transform) pairs.
 *
 * The page cannot `import`: it is opened from `file://` with no server. So the
 * arithmetic runs once in Node, through filters.js, and the page looks it up.
 */
test("the preview's tints are computed BY filters.js, and they FLOOR", () => {
  const result = extractFigure(rigBuild(), { clip: RIG_CLIP });
  const tints = previewTints(result.shapes, result.animations);

  const key = "0.5,0.5,0.5,0.5,0,0,0,64";
  assert.deepEqual(Object.keys(tints.fills).sort(), [key, "1,1,1,1,16,0,0,0"].sort(),
    "one row per distinct transform the poses actually reach");

  // 255 x 0.5 is exactly 127.5: floor is 0x7f and round is 0x80. This is the
  // one-unit error, in the single sharpest case the format allows.
  assert.equal(tints.fills[key]["#ffffff"], "#7f7f7f");
  assert.notEqual(tints.fills[key]["#ffffff"], "#808080", "#808080 is the ROUNDED answer");
  // And it is filters.js's answer because filters.js computed it.
  assert.equal(tints.fills[key]["#ffffff"], applyColourTransform("#ffffff", [0.5, 0.5, 0.5, 0.5, 0, 0, 0, 64]));

  // The ALPHA half was already right and is routed through the same owner
  // anyway: the offset is divided by 255 and the multiplier is not.
  assert.equal(tints.alphas[key]["1"], 0.5 + 64 / 255);
  assert.equal(tints.alphas[key]["1"], applyColourTransformAlpha(1, [0.5, 0.5, 0.5, 0.5, 0, 0, 0, 64]));

  // THE STROKE IS TINTED TOO, and its opacity has its own default. A table
  // built from fills alone would draw this shape's outline at full strength.
  assert.equal(tints.fills[key]["#ff0000"], "#7f0000");
  assert.equal(tints.alphas[key]["0.502"], applyColourTransformAlpha(0.502, [0.5, 0.5, 0.5, 0.5, 0, 0, 0, 64]));

  // An offset-only transform still lands, and lands on the morph's own fill.
  const morphFill = result.shapes["77@32768"].paths[0].fill;
  assert.equal(tints.fills["1,1,1,1,16,0,0,0"][morphFill],
    applyColourTransform(morphFill, [1, 1, 1, 1, 16, 0, 0, 0]));
});

test("the preview's tint table has NO HOLES, because a lookup that misses draws a flat colour", () => {
  // Built by walking the same poses `draw()` walks, so every (colour, value)
  // pair the page can ask for is in the table. Replayed here exactly as the
  // page does it — including the `strokeOpacity ?? 1` default, which is the
  // kind of detail a table built from "all the fills" would miss.
  const result = extractFigure(rigBuild(), { clip: RIG_CLIP });
  const tints = previewTints(result.shapes, result.animations);

  let lookups = 0;
  let misses = 0;
  for (const animation of Object.values(result.animations)) {
    for (const pose of animation.poses) {
      for (const placement of pose) {
        if (!placement.colour) continue;
        const shape = result.shapes[placement.shape];
        const row = tints.fills[placement.colour.join(",")] ?? {};
        const alphaRow = tints.alphas[placement.colour.join(",")] ?? {};
        for (const entry of shape.paths) {
          for (const hex of [entry.fill, entry.stroke]) {
            if (!hex || hex === "none") continue;
            lookups += 1;
            if (!(hex in row)) misses += 1;
          }
          for (const alpha of [entry.fillOpacity, entry.strokeOpacity ?? 1]) {
            lookups += 1;
            if (!(String(alpha) in alphaRow)) misses += 1;
          }
        }
      }
    }
  }
  assert.ok(lookups > 0, "a replay that looks nothing up proves nothing");
  assert.equal(misses, 0, `${misses} of ${lookups} preview lookups would fall back to an untinted colour`);
});

test("the emitted page carries the table and NOT the arithmetic", () => {
  const result = extractFigure(rigBuild(), { clip: RIG_CLIP });
  const html = previewHtml({
    clip: result.clip, clipName: result.clipName, shapes: result.shapes,
    animations: result.animations, soundBindings: null, soundPath: null
  });

  // ► The exact expression that was wrong, named so that reintroducing it in
  //   this file fails here rather than in somebody's eyes six weeks later.
  assert.ok(!html.includes("Math.round(value * mul + off)"),
    "the fifth copy of the colour transform is back in the emitted page");
  assert.ok(!html.includes("* mul + off"),
    "the page must hold no channel arithmetic at all, not even a rewritten one");

  const open = '<script type="application/json" id="tints">';
  const start = html.indexOf(open);
  assert.ok(start > 0, "the page must carry its tint table as a JSON island");
  const island = JSON.parse(html.slice(start + open.length, html.indexOf("</script>", start))
    .replace(/\\u003c/g, "<"));
  assert.equal(island.fills["0.5,0.5,0.5,0.5,0,0,0,64"]["#ffffff"], "#7f7f7f",
    "the page's own island must hold the FLOORED colour");
  assert.equal(island.alphas["0.5,0.5,0.5,0.5,0,0,0,64"]["1"], 0.5 + 64 / 255);

  // ► **THE FOOTER ELEMENT THE SCRIPT WRITES TO MUST EXIST.** `draw()` sets
  //   `tintNote.textContent` on every frame; drop the span and the very first
  //   draw throws on null and the page is BLANK, with the reason in a console
  //   nobody was asked to open — which is the exact failure this preview was
  //   redesigned to stop having.
  assert.ok(html.includes('id="tintnote"'), "the tint invoice has nowhere to be shown");

  // The page is opened from file:// and inlines its data for that reason; a
  // fetch would give a blank page with the reason in a console nobody opens.
  assert.ok(!html.includes("fetch("), "the preview must stay self-contained");
});
