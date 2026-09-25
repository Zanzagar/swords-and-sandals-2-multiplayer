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
  frozenNestedSpriteCensus,
  labelKey,
  parseArguments,
  pathApproximations,
  effectTally,
  poseBounds,
  previewHtml,
  previewTints
} from "../tools/extract-figure.mjs";
import { extractEnchantments } from "../tools/extract-enchantments.mjs";
// The OWNER of the colour transform, imported so this file compares the
// preview against it rather than against a second copy of the arithmetic.
import {
  applyColourTransform,
  applyColourTransformAlpha,
  canvasFilterFor,
  summariseFilterUse
} from "../src/render/filters.js";

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
  /** FIXED is 16.16 and FIXED8 is 8.8 — the two a filter's fields are written in. */
  fixed(value) { this.align(); const buffer = Buffer.alloc(4); buffer.writeInt32LE(Math.round(value * 65536)); return this.raw(buffer); }
  fixed8(value) { this.align(); const buffer = Buffer.alloc(2); buffer.writeInt16LE(Math.round(value * 256)); return this.raw(buffer); }
  string(value) {
    this.align();
    for (const byte of Buffer.from(value, "utf8")) this.bytes.push(byte);
    this.bytes.push(0);
    return this;
  }
  raw(bytes) { this.align(); for (const byte of bytes) this.bytes.push(byte); return this; }
  rgba(red, green, blue, alpha) { return this.u8(red).u8(green).u8(blue).u8(alpha); }

  /**
   * ONE filter, field for field. Only the three kinds these tests need — a
   * GLOW that `canvasFilterFor` applies, a BLUR whose two radii differ so that
   * it applies as an APPROXIMATION with a name, and a BEVEL, which is the one
   * filter kind the renderer refuses outright.
   *
   * ► **Every field is distinct and none is zero unless asked for**, so a
   *   decoder that reads the right NUMBER of bytes from the wrong offsets
   *   fails here rather than looking plausible. `flags` 0x21 is
   *   composite-source with one pass, which is what 881 of the build's 884
   *   glows and shadows carry.
   */
  filter({ id, colour = { red: 0, green: 255, blue: 255, alpha: 255 }, blurX = 22, blurY = 22, strength = 2.5, flags = 0x21 }) {
    this.u8(id);
    if (id === 1) this.fixed(blurX).fixed(blurY).u8(flags);
    else if (id === 2) this.rgba(colour.red, colour.green, colour.blue, colour.alpha).fixed(blurX).fixed(blurY).fixed8(strength).u8(flags);
    else if (id === 3) {
      this.rgba(255, 255, 255, 255).rgba(160, 96, 1, 255)
        .fixed(blurX).fixed(blurY).fixed(0.75).fixed(-6).fixed8(strength).u8(flags);
    } else throw new Error(`this test writer has no filter ${id}`);
    return this;
  }

  /** A FILTERLIST. A list of COUNT ZERO is legal and means "cleared". */
  filterList(filters) {
    this.align();
    this.u8(filters.length);
    for (const filter of filters) this.filter(filter);
    return this;
  }

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

/**
 * A `PlaceObject3` body, in the SPECIFICATION's order and not the flag order:
 * the FILTERLIST sits between ClipDepth and BlendMode, which is the seam a
 * parser that guesses a filter list's length desynchronises on.
 *
 * `filters: []` is a real and different thing from `filters: undefined` — the
 * flag is set and the count is zero, which means "this instance has had its
 * filters CLEARED". The extractor refuses that by name rather than writing
 * `filters: []`, and this is the only way to produce the bytes for it.
 */
function place3({ depth, characterId, matrix, name, filters, blendMode, move = false }) {
  const writer = new Swf();
  let flags = 0;
  let flags2 = 0;
  if (move) flags |= 0x01;
  if (characterId !== undefined) flags |= 0x02;
  if (matrix) flags |= 0x04;
  if (name !== undefined) flags |= 0x20;
  if (filters) flags2 |= 0x01;
  if (blendMode !== undefined) flags2 |= 0x02;
  writer.u8(flags).u8(flags2).u16(depth);
  if (characterId !== undefined) writer.u16(characterId);
  if (matrix) writer.matrix(matrix);
  if (name !== undefined) writer.string(name);
  if (filters) writer.filterList(filters);
  if (blendMode !== undefined) writer.u8(blendMode);
  return swfTag(70, writer);
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

/**
 * ---------------------------------------------------------------------------
 * THE EFFECTS THE FIGURE PACK USED TO DROP WITHOUT SAYING SO
 * ---------------------------------------------------------------------------
 *
 * ► **WHAT WAS WRONG.** `flattenFrame` hands every drawable a `blendMode`, a
 *   `hasFilters`, a `filters` list and an `ancestorEffects` chain. At HEAD
 *   this tool matched ZERO of `hasFilters|ancestorEffects|\.filters|blendMode`
 *   — re-derived with `grep -cE` before the change, against 52 in
 *   `tools/extract-props.mjs` and 38 in `tools/extract-screens.mjs`. So the
 *   fighter's only filtered sprite was discarded on every run, and `--report`
 *   had no line on which the loss could have appeared.
 *
 * ► **WHAT THE REAL BUILD SAYS, and it is quoted here, never stored.** Clip
 *   1241 flattens to 37,077 placements. **ZERO carry an own filter or blend
 *   mode**; **30 sit under an ancestor effect group**, all of them shape 856
 *   at path `43/1/1` under limb `guard_charge` — character 1195 at path `43`,
 *   carrying two glows, a constant `#000066` inner and an `#00ffff` outer
 *   whose blur tweens 22 → 13. Those 30 dedupe to **12 table entries across
 *   four labels, 10 distinct records, 24 filter records**, and the renderer
 *   applies all 24 as `shadowStrengthSaturated` — every one of their strengths clamps
 *   the alpha at 1, so the value is discarded rather than scaled. Reproduce with
 *   `node tools/extract-figure.mjs --report`.
 *
 * ► **AND THAT IS WHY THE FIXTURE BELOW EXISTS RATHER THAN A SECOND READING
 *   OF THE ORACLE.** Two of the numbers the real build reports — `own 0` and
 *   `dropped 0` — cannot fail for any input in this build, so asserting them
 *   against it would be asserting nothing. `effectBuild` puts BOTH code paths
 *   under load: placements with their own filters and their own blend modes, a
 *   filter list of COUNT ZERO, a drawable that is skipped while carrying a
 *   glow AND sitting inside a glowing group, and a morph, all in a rig whose
 *   enclosing glow TWEENS so that the dedup key is doing work.
 */

/** A `blur` whose two radii DIFFER, so `canvasFilterFor` applies it as a named approximation. */
const ANISOTROPIC_BLUR = { id: 1, blurX: 5.5, blurY: 6.25, flags: 0x08 };
/** A `bevel`. The one filter kind `src/render/filters.js` refuses outright. */
const BEVEL = { id: 3 };
/** `#00ffff` at a given blur, which is the shape of the real build's outer psych-up glow. */
const cyanGlow = (blur) => ({ id: 2, blurX: blur, blurY: blur, strength: 2.5 });

const GROUP_SPRITE = 500;
/** The OUTER and INNER halves of a nested pair, so one leaf sits under TWO groups. */
const OUTER_SPRITE = 501;
const INNER_SPRITE = 502;
/** A group whose ONLY effect is a blend mode, placed twice with two different ones. */
const BLEND_SPRITE = 503;
/** A group around the MORPH, so a baked morph is a leaf under a group and not only a denominator. */
const MORPH_SPRITE = 504;
/** A character id NOTHING defines, which is the cheapest drawable `flattenFrame` calls unsupported. */
const GHOST = 999;

/**
 * A rig that exercises EVERY effect path this tool has.
 *
 * ```text
 *   depth 1  shape 11   "torso"    nothing at all
 *   depth 2  sprite 500 "aura"     A GLOW THAT TWEENS: 22, 19, 13, 22, then 22
 *              inside: shape 10 (emitted, under the group)
 *                      character 999, WHICH DOES NOT EXIST (skipped, and it
 *                      carries its own glow as well as the group's)
 *   depth 3  shape 12   "shield"   own filters [anisotropic blur, bevel] + multiply
 *   depth 4  shape 11   "cleared"  a filter list of COUNT ZERO
 *   depth 5  shape 11   "erased"   blend mode 11, "alpha", which is REFUSED
 *   depth 6  sprite 504 "blood"    a glow around the BAKED MORPH, so the morph
 *                                  branch is a leaf under a group and not only
 *                                  a number in the denominator
 *   depth 7  sprite 501 "nest"     a glow OUTSIDE a glow: sprite 502 inside it
 *                                  carries its own, so the shape at the bottom
 *                                  sits under a chain of TWO
 *   depth 8  sprite 503 "tinted"   NO filters, a blend mode — and a DIFFERENT
 *                                  one on frame 2, so two records differ in
 *                                  the dedup key's third field and nothing else
 * ```
 *
 * Two labels, because the per-animation table is the design decision that
 * needs a test: `Glow` covers frames 1-4 and `Glow Again` covers 5-6, and both
 * hold the blur-22 record. That is 4 table entries over 3 distinct records —
 * the same 12-over-10 the real build shows, small enough to count by hand.
 */
function effectBuild() {
  const aura = (blur) => place3({ depth: 2, characterId: GROUP_SPRITE, name: "aura", filters: [cyanGlow(blur)] });
  return swfFile([
    solidShape(10, [0x20, 0x40, 0x60, 0xff]),
    solidShape(11, [0xff, 0xff, 0xff, 0xff]),
    strokedShape(12),
    gradientMorph(77),
    defineSprite(GROUP_SPRITE, 1, [
      place2({ depth: 1, characterId: 10, matrix: {} }),
      place3({ depth: 2, characterId: GHOST, matrix: {}, filters: [cyanGlow(5)] }),
      showFrame()
    ]),
    // ► **A CHAIN OF LENGTH TWO, because every chain in clip 1241 is length
    //   ONE and so the ORDER of a placement's `effects` is unmeasurable
    //   against the installed build.** A renderer has to nest its buffers
    //   outermost-first; without these bytes that guarantee is a sentence in a
    //   comment and nothing else. Blur 9 outside, blur 3 inside, so the order
    //   is readable rather than inferred.
    defineSprite(INNER_SPRITE, 1, [place2({ depth: 1, characterId: 10, matrix: {} }), showFrame()]),
    // ► **A GROUP CARRYING NO FILTERS AT ALL.** A blend mode alone makes an
    //   enclosing sprite a group, and it is part of the dedup key. Without
    //   this, deleting `blendMode` from that key changes nothing anywhere and
    //   the key's third field is untested — which is how it was, and the
    //   mutation that found it survived the whole suite.
    defineSprite(BLEND_SPRITE, 1, [place2({ depth: 1, characterId: 10, matrix: {} }), showFrame()]),
    // ► **AND A GROUP AROUND THE MORPH**, because a baked morph that is only
    //   ever in the DENOMINATOR proves nothing about whether the morph branch
    //   carries effects. Delete the effects from the morph placement and this
    //   is what goes red.
    defineSprite(MORPH_SPRITE, 1, [
      place2({ depth: 1, characterId: 77, matrix: {}, ratio: 32768 }),
      showFrame()
    ]),
    defineSprite(OUTER_SPRITE, 1, [
      place3({ depth: 1, characterId: INNER_SPRITE, matrix: {}, filters: [cyanGlow(3)] }),
      showFrame()
    ]),
    defineSprite(RIG_CLIP, 6, [
      frameLabel("Glow"),
      place2({ depth: 1, characterId: 11, matrix: { tx: 5 }, name: "torso" }),
      aura(22),
      place3({ depth: 3, characterId: 12, matrix: { tx: 80 }, name: "shield", filters: [ANISOTROPIC_BLUR, BEVEL], blendMode: 3 }),
      place3({ depth: 4, characterId: 11, matrix: { tx: 160 }, name: "cleared", filters: [] }),
      place3({ depth: 5, characterId: 11, matrix: { tx: 200 }, name: "erased", blendMode: 11 }),
      place3({ depth: 6, characterId: MORPH_SPRITE, matrix: {}, name: "blood", filters: [cyanGlow(7)] }),
      place3({ depth: 7, characterId: OUTER_SPRITE, matrix: { tx: 240 }, name: "nest", filters: [cyanGlow(9)] }),
      place3({ depth: 8, characterId: BLEND_SPRITE, matrix: { tx: 280 }, name: "tinted", blendMode: 4 }),
      showFrame(),
      aura(19),
      place3({ depth: 8, characterId: BLEND_SPRITE, matrix: { tx: 280 }, name: "tinted", blendMode: 5 }),
      showFrame(),
      aura(13), showFrame(),
      aura(22), showFrame(),
      frameLabel("Glow Again"),
      aura(22), showFrame(),
      showFrame()
    ]),
    exportAssets([[RIG_CLIP, "hero_battle"]])
  ]);
}

test("THE EFFECT-GROUP TABLE IS KEYED ON THE WHOLE RECORD, and the path-only key loses the tween", () => {
  const result = extractFigure(effectBuild(), { clip: RIG_CLIP });
  const glow = result.animations.glow;
  const again = result.animations["glow-again"];

  // The enclosing sprite is at ONE depth and is ONE character on every frame,
  // so path — and path+character, and path+filter-KINDS — collapse all of this
  // to a single record. Counted here rather than claimed:
  const pathKey = new Set();
  const wholeKey = new Set();
  for (const animation of Object.values(result.animations)) {
    for (const group of animation.effectGroups) {
      pathKey.add(JSON.stringify(group.path));
      wholeKey.add(JSON.stringify(group));
    }
  }
  assert.equal(pathKey.size, 5, "five enclosing depths: aura, morph, the nested pair, and the blend-only one");
  assert.equal(wholeKey.size, 8, "the whole record ALSO sees the aura's three blurs and the two blend modes");

  // ► **THE NUMBER THE PATH KEY WOULD HAVE COST, on the path where it costs
  //   anything.** The aura is ONE sprite at ONE depth, so a path key — and a
  //   path+character key, and a path+filter-KINDS key — collapses its three
  //   records to one. 3 → 1 here; on the installed build 10 → 1, and the
  //   discarded difference is the psych-up PULSE: blur 22 → 21.4 → 20.8 →
  //   20.2 → 19.6 → 19 → 17.5 → 16 → 14.5 → 13 with the strength swinging
  //   2.699 → 0.977 → 2.699. A path key reports ONE glow and the aura stops
  //   moving.
  const auraRecords = (animation) => animation.effectGroups.filter((group) => group.path.join("/") === "2");
  assert.deepEqual(auraRecords(glow).map((group) => group.filters[0].blurX), [22, 19, 13],
    "frames 1 and 4 share a record; 2 and 3 are their own");
  assert.equal(new Set(auraRecords(glow).map((group) => group.path.join("/"))).size, 1,
    "and all three sit on ONE path, which is what makes the path key wrong");
  assert.deepEqual(auraRecords(again).map((group) => group.filters[0].blurX), [22]);
  assert.equal(result.effects.inherited.groups, 13, "TABLE ENTRIES, summed over the labels");
  assert.equal(result.effects.inherited.distinctGroups, 8, "the records that are actually different");

  // ► **THE TWO SIDES OF THE INVOICE ARE COUNTED ON DIFFERENT UNITS, ON
  //   PURPOSE, and this is the assertion that pins it.** A GROUP's filters are
  //   counted ONCE however many leaves sit under it, because the build applies
  //   them once to the group. Count them per leaf instead and this rig's four
  //   glows become six — and on the installed build the props pack's single
  //   sky colour matrix became 3,202 colour matrices, which is how the unit
  //   error was found. `placements` and `groupInstances` are the per-leaf
  //   numbers and they live under their own names.
  assert.equal(result.effects.inherited.filters, 10, "one per TABLE ENTRY, not one per enclosed leaf");
  assert.deepEqual(result.effects.inherited.filtersByType, { glow: 10 });
  assert.equal(result.effects.inherited.placements, 24, "four enclosed leaves, over six frames");
  assert.equal(result.effects.inherited.groupInstances, 30,
    "three leaves are under ONE group each and the nested leaf is under TWO");
  assert.equal(result.effects.inherited.blendModes, 3,
    "a group's blend mode counts per TABLE ENTRY too: screen once, lighten in both labels");

  // A placement's `effects` are INDICES into its OWN animation's table, so
  // frame 1 and frame 4 point at the same entry and frames 2 and 3 do not.
  const auraOn = (animation) =>
    animation.poses.map((pose) => pose.find((placement) => placement.limb === "aura").effects);
  assert.deepEqual(auraOn(glow), [[0], [5], [7], [0]]);
  assert.deepEqual(auraOn(again), [[0], [0]], "a second label re-derives the record it shares");

  // ► **OUTERMOST FIRST, and this is the assertion that makes that a fact
  //   rather than a sentence.** A renderer nests its buffers in this order;
  //   reverse the chain and the inner glow is applied to the outer group's
  //   output instead of the other way round. **Every chain in clip 1241 is
  //   length ONE, so the installed build cannot tell the two orders apart** —
  //   the claim is unfalsifiable against the oracle and is pinned here or
  //   nowhere.
  const nested = glow.poses[0].find((placement) => placement.limb === "nest");
  assert.equal(nested.effects.length, 2, "one leaf, two enclosing groups");
  assert.deepEqual(nested.effects.map((index) => glow.effectGroups[index].path), [[7], [7, 1]],
    "the OUTER group first — its path is the prefix of the inner one's");
  assert.deepEqual(nested.effects.map((index) => glow.effectGroups[index].filters[0].blurX), [9, 3]);

  // ► **THE DEDUP KEY'S THIRD FIELD, which nothing else here can reach.** The
  //   sprite at depth 8 carries NO filters and two different blend modes on
  //   two frames, so these two records differ in `blendMode` and in nothing
  //   else. Drop `blendMode` from the key and they merge — a mutation that
  //   survived this whole file until this fixture existed.
  const blends = glow.effectGroups.filter((group) => group.path.join("/") === "8");
  assert.deepEqual(blends.map((group) => group.blendMode), [4, 5]);
  assert.deepEqual(blends.map((group) => group.filters), [undefined, undefined],
    "a blend mode ALONE makes an enclosing sprite a group");
  assert.deepEqual(
    glow.poses.map((pose) => pose.find((placement) => placement.limb === "tinted").effects),
    [[4], [6], [6], [6]], "frame 1 is screen; 2, 3 and 4 are lighten"
  );

  // And they index a table that is THERE — the bug this shape is chosen to
  // make impossible is a renderer looking up index 2 in a one-entry table.
  for (const animation of Object.values(result.animations)) {
    for (const pose of animation.poses) {
      for (const placement of pose) {
        for (const index of placement.effects ?? []) {
          assert.ok(animation.effectGroups[index], `${animation.label}: effects index ${index} reaches nothing`);
        }
      }
    }
  }
});

test("EVERY animation carries an effectGroups table, empty ones included", () => {
  // ► **ALL OR NONE, the rule `pathApproximations` already answers to.** A
  //   pack that carries the key on 4 of 101 labels reads as a pack that
  //   carries the key, and a renderer written against it breaks on the 97th.
  //   Measured on the installed build: 4 labels have a non-empty table and 97
  //   have an empty one; all 101 have the key.
  const result = extractFigure(effectBuild(), { clip: RIG_CLIP });
  for (const [key, animation] of Object.entries(result.animations)) {
    assert.ok(Array.isArray(animation.effectGroups), `${key} carries no effectGroups table`);
  }

  // The rig with no effects at all still carries empty tables, which is the
  // case that tells "this animation encloses nothing" from "this pack predates
  // the key".
  const plain = extractFigure(rigBuild(), { clip: RIG_CLIP });
  assert.deepEqual(Object.values(plain.animations).map((animation) => animation.effectGroups), [[], []]);
  assert.equal(plain.effects.inherited.groups, 0);
  assert.deepEqual(plain.effects.notCarried, {}, "a rig with no effects loses nothing");
});

test("A PLACEMENT'S OWN FILTERS AND BLEND MODE ARE CARRIED — the half that is DEAD on the oracle", () => {
  // ► **0 of the installed build's 37,077 placements carries either**, so this
  //   code path cannot be exercised by the real build at all and would sit
  //   unwritten-and-unnoticed exactly the way `ownEffectsOf`'s equivalent did
  //   in the props extractor — where the pack-wide `0 own filters` turned out
  //   to be a measurement of a skip list. These bytes are the only thing in
  //   this repository that can tell the two apart.
  const result = extractFigure(effectBuild(), { clip: RIG_CLIP });
  const frame = result.animations.glow.poses[0];

  const shield = frame.find((placement) => placement.limb === "shield");
  assert.deepEqual(shield.filters.map((filter) => filter.type), ["blur", "bevel"],
    "the placement's OWN list, in the order the wire carries it");
  assert.equal(shield.filters[0].blurX, 5.5);
  assert.equal(shield.filters[0].blurY, 6.25, "the two radii differ, and that difference must survive");
  assert.equal(shield.blendMode, 3);

  const erased = frame.find((placement) => placement.limb === "erased");
  assert.equal(erased.blendMode, 11, "a blend mode with no filters is still an effect");
  assert.equal(erased.filters, undefined, "and it must not gain an empty list on the way out");

  // ► **A FILTER LIST OF COUNT ZERO IS NOT AN ABSENT ONE.** It means the
  //   instance's filters were CLEARED. Writing it as `filters: []` would let a
  //   reader treat it as "nobody asked"; it is refused BY NAME instead.
  const cleared = frame.find((placement) => placement.limb === "cleared");
  assert.equal(cleared.filters, undefined, "an empty list must never be written as one");
  assert.equal(result.effects.notCarried.emptyFilterList, 6, "once per frame it is on the stage");

  assert.equal(result.effects.own.filteredPlacements, 6);
  assert.equal(result.effects.own.filters, 12);
  assert.deepEqual(result.effects.own.filtersByType, { blur: 6, bevel: 6 });
  assert.equal(result.effects.own.blendModePlacements, 12, "shield and erased, on each of six frames");
});

test("THE SKIP INVOICES WHAT LEAVES WITH IT — its own effects AND the group it was sitting in", () => {
  // ► **THIS IS THE DEFECT THAT ATE THE PROPS EXTRACTOR'S HEADLINE.** Its
  //   placement loop skipped unsupported drawables above the effect sweep, the
  //   build's only two own-filtered placements were two of those skips, and
  //   the pack reported `0 own filters` about a build that had two. This file
  //   has exactly one skip — an unsupported drawable, or a morph whose
  //   definition will not parse — and it fires 0 times out of 37,077 against
  //   the installed build, which is a fact about THAT BUILD and is
  //   indistinguishable from an uncounted drop unless something can make it
  //   fire.
  const result = extractFigure(effectBuild(), { clip: RIG_CLIP });

  assert.deepEqual(result.unsupported, { missing: [GHOST] }, "the ghost is still reported as a kind");
  assert.equal(result.effects.own.dropped.drawables, 6, "one per frame");
  assert.equal(result.effects.own.dropped.placements, 6);
  assert.equal(result.effects.own.dropped.filters, 6);
  assert.deepEqual(result.effects.own.dropped.filtersByType, { glow: 6 });
  assert.equal(result.effects.own.dropped.inheritedGroups, 6,
    "it was inside the aura, and that is a second loss with a second name");
  assert.deepEqual(result.effects.notCarried.unsupportedDrawableFilters, 6);
  assert.deepEqual(result.effects.notCarried.unsupportedDrawableInheritedFilters, 6);

  // Nothing from the ghost reaches the pack — refusing is not carrying, and
  // the point of the invoice is that the two are told apart in the manifest.
  for (const animation of Object.values(result.animations)) {
    for (const pose of animation.poses) {
      for (const placement of pose) assert.notEqual(placement.shape, GHOST);
    }
  }
});

test("notCarried IS A NAMED-REASON TALLY AND IT IS COMPLETE, never a boolean and never a subset", () => {
  // ► **ASSERTED AS A WHOLE OBJECT, on purpose.** Checking reasons one at a
  //   time lets a reason be DELETED without anything going red: removing the
  //   `effectGroupMatrix` refusal left this file green until this line existed,
  //   and that refusal is the pack's only record that a group's blur radius is
  //   in unscaled pixels with no matrix to scale it by.
  const result = extractFigure(effectBuild(), { clip: RIG_CLIP });
  assert.deepEqual(result.effects.notCarried, {
    // Once per TABLE ENTRY: `flattenFrame`'s ancestor record carries no matrix,
    // so a renderer cannot scale a group's blur by the group's own transform.
    effectGroupMatrix: 13,
    // The ghost's own glow, and the aura's glow that went with it.
    unsupportedDrawableFilters: 6,
    unsupportedDrawableInheritedFilters: 6,
    // A filter list of COUNT ZERO — "cleared", not "nobody asked".
    emptyFilterList: 6
  });

  // On the installed build the whole ledger is `{ effectGroupMatrix: 12 }`:
  // nothing is skipped, nothing carries an own list, and no instance has had
  // its filters cleared. Reproduce with `node tools/extract-figure.mjs --report`.
  assert.equal(Object.values(result.effects.notCarried).every((count) => Number.isInteger(count)), true,
    "a count, never a boolean");
});

test("THE MORPH PATH IS IN THE INVOICE, so a zero there is not a measurement of the skip list", () => {
  // `morphKeyFor`'s placements used to be built by a second literal that
  // already lagged the first one once — it carried no approximation invoice
  // while every shape beside it did. A baked morph is an ordinary placement
  // now, effects and all.
  const result = extractFigure(effectBuild(), { clip: RIG_CLIP });
  const blood = result.animations.glow.poses[0].find((placement) => placement.limb === "blood");
  assert.equal(blood.shape, "77@32768", "still the baked key, not the character id");
  // ► **AND IT CARRIES ITS ENCLOSING GROUP**, which is the assertion the first
  //   version of this fixture could not make: the morph sat under nothing, so
  //   deleting the effects from the morph branch changed no number anywhere.
  assert.deepEqual(blood.effects, [1]);
  assert.equal(result.animations.glow.effectGroups[1].filters[0].blurX, 7,
    "the glow that is on the morph and not on anything else");

  // ► **AND IT IS IN THE DENOMINATOR.** 48 emitted placements over 6 frames —
  //   torso, the aura's leaf, shield, cleared, erased, the morph, the nested
  //   leaf and the blend-only leaf — with the ghost's 6 skipped alongside. On
  //   the installed build the same reading is 37,077 placements, of which 290
  //   are baked morphs and 0 are skipped.
  assert.equal(result.effects.own.placements, 48);
  assert.equal(result.placementCount, 54, "the 48 emitted plus the 6 skipped");
  assert.equal(result.morphCount, 1);
});

test("THE INVOICE IS RECOUNTED FROM THE PACK, never accumulated beside it", () => {
  // ► **THE RULE THIS FILE ALREADY PAID FOR ONCE.** `approximationTally` used
  //   to sum a field written next to each shape; the 290 baked morphs had no
  //   such field, and the manifest a human reads counted an approximated morph
  //   path as zero. A counter kept beside the data is a second thing to drift.
  //   So `effectTally` walks the animations, `main` hands it the object it is
  //   about to WRITE, and this pins the two readings together.
  const result = extractFigure(effectBuild(), { clip: RIG_CLIP });
  assert.deepEqual(effectTally(result.animations, result.effectLoss), result.effects);

  // What `main` actually writes: the same animations with a `bounds` per
  // label. A field added on the way out must not move a number.
  const written = {};
  for (const [key, animation] of Object.entries(result.animations)) {
    written[key] = { ...animation, bounds: poseBounds(result.shapes, animation.poses) };
  }
  assert.deepEqual(effectTally(written, result.effectLoss), result.effects,
    "the manifest's invoice must describe the file on disk");

  // ► **AND THE SPLIT IS NAMED.** `own`, `inherited` and `use` are facts about
  //   the PACK and are recountable from it; `dropped` and `notCarried` describe
  //   what is NOT in the pack, so no walk can find them and they are carried.
  //   Drop the carried half and exactly those two fields empty out — which is
  //   what makes them the ones that can rot unnoticed.
  const withoutLosses = effectTally(result.animations);
  assert.deepEqual(withoutLosses.inherited, result.effects.inherited);
  assert.deepEqual(withoutLosses.use, result.effects.use);
  assert.deepEqual(withoutLosses.notCarried, {});
  assert.equal(withoutLosses.own.dropped.filters, 0);
  assert.equal(withoutLosses.own.placements, result.effects.own.placements);
});

test("`use` IS src/render/filters.js's VERDICT and not a table in the extractor", () => {
  // ► **The arrangement `tools/extract-props.mjs` set and the reason it is
  //   worth the import:** "the pack carries it" and "the renderer can draw it"
  //   cannot drift apart while both stay green. A filter kind the renderer
  //   learns to draw changes this number without anybody editing the extractor,
  //   and a filter kind it stops drawing turns this red.
  const result = extractFigure(effectBuild(), { clip: RIG_CLIP });
  const use = result.effects.use.filters;

  // Recomputed HERE from the pack's own filter lists, through the same owner.
  const lists = [];
  for (const animation of Object.values(result.animations)) {
    for (const group of animation.effectGroups) lists.push(group.filters ?? []);
    for (const pose of animation.poses) for (const placement of pose) if (placement.filters) lists.push(placement.filters);
  }
  assert.deepEqual(use, summariseFilterUse(lists.map((list) => canvasFilterFor(list))));

  assert.equal(use.total, 22, "10 group glows, and a blur and a bevel on each of six placements");
  assert.equal(use.applied, 16, "the glows and the blurs");
  assert.equal(use.refused, 6, "every bevel — the one kind canvas has no expression for");
  assert.deepEqual(use.approximatedByKind, { shadowStrengthSaturated: 10, anisotropicBlur: 6 },
    "a blur whose radii differ is applied AS AN APPROXIMATION, and it is named — and a glow "
    + "whose strength SATURATES the alpha is a different loss from one that scales it");
  assert.deepEqual(use.refusedByReason, { "bevel:filterHasNoCanvasEquivalent": 6 },
    "a refusal with no reason is not an invoice");

  // The blend modes go through `blendModeFor` for the same reason: `multiply`
  // is exact, `alpha` needs a group buffer no filter string can express.
  assert.deepEqual(result.effects.use.blendModes.exact, { screen: 1, lighten: 2, multiply: 6 },
    "a GROUP's blend mode is costed per table entry; a PLACEMENT's per placement");
  assert.deepEqual(result.effects.use.blendModes.refused, { "alpha:blendModeNeedsAGroupBuffer": 6 });
});

test("effectTally survives a pack that has none of this, because --report runs before anything is written", () => {
  assert.equal(effectTally({}).inherited.groups, 0);
  assert.equal(effectTally(undefined).own.placements, 0);
  assert.equal(effectTally({ glow: {} }).own.placements, 0);
  assert.deepEqual(effectTally({ glow: { poses: [[{ shape: 1 }]] } }).own, {
    placements: 1, filteredPlacements: 0, filters: 0, filtersByType: {}, blendModePlacements: 0,
    dropped: { drawables: 0, placements: 0, filters: 0, filtersByType: {}, blendModePlacements: 0, inheritedGroups: 0 }
  });
});


/* ------------------------------------------------------------------ */
/* THE FREEZE INVOICE — and it is checked AGAINST A SECOND TOOL         */
/* ------------------------------------------------------------------ */

/**
 * ► **THIS TEST EXISTS BECAUSE THE INVOICE ONE LINE ABOVE IT SHIPPED A CLEAN
 *   BILL OF HEALTH OVER TWENTY-FOUR GLOWS.** `--report` printed *"DROPPED 0
 *   filters and 0 inherited groups with 0 skipped drawables"* while sprite 703
 *   `weapon0` carried two glows on each of its frames 2..13 inside this very
 *   clip. Every drop counter in `tools/extract-figure.mjs` was telling the
 *   truth; `flattenFrame` pins a nested sprite to frame 1, so those filters
 *   were never READ, and a counter that counts drops cannot see a thing that
 *   was never looked at.
 *
 * ► **AND IT IS NOT ASSERTED AGAINST A CONSTANT, BECAUSE A CONSTANT HERE WOULD
 *   BE THIS FILE AGREEING WITH ITSELF.** The 24 is cross-checked against
 *   `tools/extract-enchantments.mjs`, which reaches the same number by a
 *   COMPLETELY different route: it disassembles `itemglow`'s twelve-arm ladder
 *   out of the AVM1 bytes, derives the art clip from the call sites' member
 *   name rather than being told `703`, and re-flattens that clip at each of its
 *   thirteen frames. Two tools, two routes, one number — and either one drifting
 *   turns this red.
 */
const ORACLE_BUILD =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";
const haveOracleBuild = fs.existsSync(ORACLE_BUILD);

test("the frame-1 freeze INVOICES what it never looked at, and a second tool agrees on the number",
  { skip: haveOracleBuild ? false : "no installed build on this machine" }, () => {
    const buffer = fs.readFileSync(ORACLE_BUILD);
    const figure = extractFigure(buffer, {});

    // The census names its children rather than counting them, because "24
    // filters behind a freeze" does not tell a reader they are the weapon
    // enchantment, and that is the whole value of the number.
    const frozen = figure.frozenNested;
    assert.equal(frozen.sprites, 3, "three multi-frame children are frozen on frame 1");
    assert.equal(frozen.frames, 30, "and 30 of their frames are never resolved");

    const carrying = frozen.byCharacter.filter((child) => child.filtersBehindTheFreeze > 0);
    assert.equal(carrying.length, 1, "exactly one of the three hides anything");
    assert.equal(carrying[0].character, 703);
    assert.equal(carrying[0].name, "weapon0");

    // ► THE CROSS-CHECK. `extractEnchantments` never reads this file and is
    //   never told 703; it derives the clip from `itemglow`'s call sites.
    const enchantments = extractEnchantments(buffer);
    const byRoute = enchantments.art.frames.reduce(
      (sum, frame) => sum + (frame.filters ?? []).length, 0);
    assert.equal(
      carrying[0].filtersBehindTheFreeze, byRoute,
      "the figure census and the enchantment ladder must agree about how many filters sit behind the freeze"
    );
    assert.equal(byRoute, 24, "and the build's number is 24 — two glows on each of frames 2..13");

    // The loss reaches the invoice under NAMED reasons, never as a bare zero
    // somewhere else. `nestedSpriteFrame1` is the name `src/render/screen.js`
    // already uses for the same freeze counted over screens.
    assert.equal(figure.effects.notCarried.nestedSpriteFrame1, 3);
    assert.equal(figure.effects.notCarried.nestedSpriteFramesNotResolved, 30);
    assert.equal(figure.effects.notCarried.filtersBehindNestedFreeze, 24);
  });

/**
 * The census over a build with NO multi-frame child says so with a zero that
 * has a denominator, rather than not appearing.
 *
 * ► **AND THIS IS THE HALF THE ORACLE CANNOT TEST.** Every number in the test
 *   above is a fact about one build; none of them can distinguish "the census
 *   works" from "the census happens to return the right constants". Here the
 *   input is built to have nothing behind any freeze, so a census that returned
 *   a hard-coded 24 fails.
 */
test("the freeze census reports an honest zero when nothing is frozen", () => {
  const census = frozenNestedSpriteCensus(
    Buffer.alloc(0), new Map(), [], [], new Map()
  );
  assert.deepEqual(census, { sprites: 0, frames: 0, filters: 0, byCharacter: [] });
});
