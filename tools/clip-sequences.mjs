#!/usr/bin/env node

/**
 * Read-only: WHERE PLAYBACK STOPS on one sprite's timeline.
 *
 * This is the instrument behind `src/render/clip-sequences.js`. Like
 * `tools/inspect-swf.mjs` it exports no asset — it reads a local SWF in memory
 * and prints frame numbers, frame labels and the terminating action of each
 * label's run, which is the one thing `FrameLabel` tags alone cannot tell you.
 *
 * In AVM1 a `gotoAndPlay("x")` runs forward from `x`'s frame until an action
 * stops it or jumps away. A label whose span carries no such action therefore
 * runs on into the next label, and the build plays two clips where the pack
 * lists one.
 *
 *   node tools/clip-sequences.mjs <file.swf> [--sprite 1241] [--all] [--json]
 *
 * `--all` lists every label and its terminator; the default prints only the
 * labels that run past their own span, which is the table worth committing.
 *
 * WHAT COUNTS AS A TERMINATOR, and each one cost a wrong table before it was
 * counted:
 *
 * - `Stop`.
 * - `GotoFrame` / `GotoLabel` — a jump ends the linear run. A `GotoLabel` back
 *   to the label's OWN name is a self-loop; it still terminates, and treating
 *   it as a run-on concatenates `Standing` with three gaits.
 * - `gotoAndPlay` / `gotoAndStop` called as a METHOD, which is how a
 *   conditional jump is written. `flame_repeat`'s frame 1963 is one, and
 *   missing it makes a burning gladiator appear to play the lifesteal clip.
 */

import fs from "node:fs";
import zlib from "node:zlib";
import process from "node:process";

/** The fighter clip. Every animation label this project cares about is on it. */
const DEFAULT_SPRITE = 1241;

const TAG_DEFINE_SPRITE = 39;
const TAG_FRAME_LABEL = 43;
const TAG_DO_ACTION = 12;
const TAG_SHOW_FRAME = 1;
const TAG_END = 0;

const ACTION_CONSTANT_POOL = 0x88;
const ACTION_STOP = 0x07;
const ACTION_GOTO_FRAME = 0x81;
const ACTION_GOTO_LABEL = 0x8c;
const ACTION_GOTO_FRAME2 = 0x9f;
const ACTION_PUSH = 0x96;
const ACTION_CALL_METHOD = 0x52;
const ACTION_GET_VARIABLE = 0x1c;
const ACTION_GET_MEMBER = 0x4e;

export class ClipSequenceToolError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

export function parseArguments(argv) {
  const options = { file: null, sprite: DEFAULT_SPRITE, all: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--sprite") options.sprite = Number(argv[++index]);
    else if (value === "--all") options.all = true;
    else if (value === "--json") options.json = true;
    else if (!options.file) options.file = value;
    else throw new ClipSequenceToolError(`Unexpected argument: ${value}`);
  }
  if (!options.file) return null;
  if (!Number.isInteger(options.sprite) || options.sprite < 0) {
    throw new ClipSequenceToolError("--sprite must be a non-negative integer character id.");
  }
  return options;
}

/** FWS/CWS -> an uncompressed body, with the header rect skipped. */
export function openSwf(buffer) {
  const signature = buffer.toString("latin1", 0, 3);
  let body = buffer;
  if (signature === "CWS") {
    body = Buffer.concat([Buffer.from("FWS"), buffer.subarray(3, 8), zlib.inflateSync(buffer.subarray(8))]);
  } else if (signature === "ZWS") {
    throw new ClipSequenceToolError("LZMA-compressed SWFs are not handled; this build is not one.");
  } else if (signature !== "FWS") {
    throw new ClipSequenceToolError(`Not a SWF: signature ${JSON.stringify(signature)}.`);
  }
  // signature(3) version(1) fileLength(4), then the stage RECT, frameRate(2),
  // frameCount(2).
  let cursor = 8;
  const rectBits = body[cursor] >> 3;
  cursor += Math.ceil((5 + rectBits * 4) / 8);
  cursor += 4;
  return { body, firstTag: cursor };
}

/**
 * Decode one action block far enough to see its terminators.
 *
 * Deliberately NOT a full AVM1 disassembler — `tools/inspect-swf.mjs` is that.
 * It keeps a small operand STACK, which is the least that answers the one
 * question here: WHOSE playhead does this `gotoAndPlay` move?
 *
 * ► **PEEKING AT THE LAST PUSH IS NOT ENOUGH, AND THE FIRST VERSION OF THIS
 *   FUNCTION DID EXACTLY THAT.** Every animation frame on the fighter clip
 *   opens by driving the FACE — `head.eyes.gotoAndPlay("Left")`,
 *   `head.mouth.gotoAndPlay("Scared")` — which is the same opcode with the same
 *   method name on a different object. Counting those as terminators ended
 *   every label's run at its own first frame and reported 1 run-on where there
 *   are 7. A call terminates the run only when the object is `this`, reached
 *   with no `GetMember` in between.
 */
export function terminatorsIn(block) {
  const found = [];
  let pool = [];
  /** Operand stack. Strings and numbers are themselves; anything else is a marker. */
  let stack = [];
  const SELF = { self: true };
  const OTHER = { self: false };
  let cursor = 0;
  while (cursor < block.length) {
    const code = block[cursor];
    if (code === 0) break;
    let length = 0;
    let dataStart = cursor + 1;
    if (code >= 0x80) {
      length = block.readUInt16LE(cursor + 1);
      dataStart = cursor + 3;
    }
    const dataEnd = dataStart + length;

    if (code === ACTION_CONSTANT_POOL) {
      pool = [];
      const count = block.readUInt16LE(dataStart);
      let at = dataStart + 2;
      for (let n = 0; n < count; n += 1) {
        const end = block.indexOf(0, at);
        pool.push(block.toString("utf8", at, end));
        at = end + 1;
      }
    } else if (code === ACTION_PUSH) {
      let at = dataStart;
      while (at < dataEnd) {
        const type = block[at];
        at += 1;
        if (type === 0) { const end = block.indexOf(0, at); stack.push(block.toString("utf8", at, end)); at = end + 1; }
        else if (type === 1) { stack.push(block.readFloatLE(at)); at += 4; }
        else if (type === 2) { stack.push(null); }
        else if (type === 3) { stack.push(OTHER); }
        else if (type === 4) { stack.push(OTHER); at += 1; }
        else if (type === 5) { stack.push(Boolean(block[at])); at += 1; }
        // ► **A PUSHED DOUBLE IS NOT AN ORDINARY LITTLE-ENDIAN DOUBLE.**
        //   ActionPush type 6 stores its two 32-bit words SWAPPED, so a bare
        //   `readDoubleLE` turns an argument count of 1 into 5e-324-ish noise:
        //   `CallMethod` then consumes zero arguments and reports a perfectly
        //   ordinary `this.gotoAndPlay("Standing")` as `goto:computed`.
        //   `tools/inspect-swf.mjs` has always reordered them; this did not,
        //   and an adversarial review of `67dfc01` reproduced it. The fighter
        //   clip happens to push its argument counts as type 7 int32, so the
        //   seven runs were right anyway — which is exactly how a decoder bug
        //   survives a green table.
        else if (type === 6) {
          const reordered = Buffer.concat([block.subarray(at + 4, at + 8), block.subarray(at, at + 4)]);
          stack.push(reordered.readDoubleLE(0));
          at += 8;
        }
        else if (type === 7) { stack.push(block.readInt32LE(at)); at += 4; }
        else if (type === 8) { stack.push(pool[block[at]]); at += 1; }
        else if (type === 9) { stack.push(pool[block.readUInt16LE(at)]); at += 2; }
        else {
          // An operand type this tool does not model. The stack is no longer
          // trustworthy, so it says so rather than guessing the rest.
          stack = null;
          at = dataEnd;
        }
      }
    } else if (code === ACTION_GET_VARIABLE) {
      if (stack) {
        const name = stack.pop();
        stack.push(name === "this" ? SELF : OTHER);
      }
    } else if (code === ACTION_GET_MEMBER) {
      // `object.member` — whatever the object was, the result is not `this`.
      if (stack) { stack.pop(); stack.pop(); stack.push(OTHER); }
    } else if (code === ACTION_STOP) {
      found.push({ kind: "stop" });
    } else if (code === ACTION_GOTO_FRAME) {
      found.push({ kind: "goto", target: `frame ${block.readUInt16LE(dataStart)}` });
    } else if (code === ACTION_GOTO_LABEL) {
      const end = block.indexOf(0, dataStart);
      found.push({ kind: "goto", target: block.toString("utf8", dataStart, end) });
    } else if (code === ACTION_GOTO_FRAME2) {
      found.push({ kind: "goto", target: "computed" });
    } else if (code === ACTION_CALL_METHOD) {
      // Stack, top last: `<args...>, <argc>, <object>, <methodName>`.
      if (stack) {
        const name = stack.pop();
        const object = stack.pop();
        const argc = stack.pop();
        const args = [];
        for (let n = 0; n < (Number.isInteger(argc) ? argc : 0); n += 1) args.unshift(stack.pop());
        // ONLY a call on `this` moves this timeline's playhead. The face clips
        // are driven with the same method name on every animation frame.
        if ((name === "gotoAndPlay" || name === "gotoAndStop") && object === SELF) {
          found.push({ kind: "goto", target: typeof args[0] === "string" ? args[0] : "computed" });
        }
        stack.push(OTHER);
      }
    }
    cursor = dataEnd;
  }
  return found;
}

/** Every FrameLabel and every terminating action on one sprite, by frame. */
export function readSpriteTimeline(body, firstTag, wantSprite) {
  const labels = [];
  const terminators = new Map();

  const walk = (start, end, spriteId) => {
    const inScope = spriteId === wantSprite;
    let cursor = start;
    let frame = 1;
    while (cursor < end) {
      const header = body.readUInt16LE(cursor);
      const code = header >> 6;
      let length = header & 0x3f;
      let tagStart = cursor + 2;
      if (length === 0x3f) {
        length = body.readUInt32LE(cursor + 2);
        tagStart = cursor + 6;
      }
      const next = tagStart + length;
      if (code === TAG_DEFINE_SPRITE) {
        walk(tagStart + 4, next, body.readUInt16LE(tagStart));
      } else if (inScope) {
        if (code === TAG_FRAME_LABEL) {
          const nul = body.indexOf(0, tagStart);
          labels.push({ frame, name: body.toString("utf8", tagStart, nul) });
        } else if (code === TAG_DO_ACTION) {
          const found = terminatorsIn(body.subarray(tagStart, next));
          if (found.length > 0 && !terminators.has(frame)) terminators.set(frame, found);
        } else if (code === TAG_SHOW_FRAME) {
          frame += 1;
        }
      }
      if (code === TAG_END) break;
      cursor = next;
    }
  };

  walk(firstTag, body.length, -1);
  labels.sort((a, b) => a.frame - b.frame);
  return { labels, terminators };
}

/**
 * Each label's run: where it ends, how it ends, and which labels it swallows.
 *
 * A label's OWN span ends at the frame before the next label. Its RUN ends at
 * the first terminator at or after its first frame. When the run ends later
 * than the span, every label in between is played as part of it.
 */
export function runsFrom({ labels, terminators }) {
  const frames = [...terminators.keys()].sort((a, b) => a - b);
  const firstTerminatorFrom = (frame) => frames.find((candidate) => candidate >= frame) ?? null;
  return labels.map((label, index) => {
    const next = labels[index + 1] ?? null;
    const ownLast = next ? next.frame - 1 : null;
    const endsAt = firstTerminatorFrom(label.frame);
    const ending = endsAt === null ? null : terminators.get(endsAt);
    const swallows = endsAt === null
      ? []
      : labels.filter((other) => other.frame > label.frame && other.frame <= endsAt).map((other) => other.name);
    return {
      label: label.name,
      firstFrame: label.frame,
      ownLast,
      endsAt,
      ending: ending === null ? null : ending.map((step) => (step.kind === "stop" ? "stop" : `goto:${step.target}`)).join(" "),
      swallows,
      // A self-loop reads as "runs past its own span" and is not one: the
      // playhead goes back to the label it is already inside.
      selfLoop: Boolean(ending && ending.some((step) => step.kind === "goto" && step.target === label.name)),
      /**
       * The run's last action jumps BACK to a label the run has already
       * played, so it does not simply end there.
       *
       * ► **FLAGGED RATHER THAN GUESSED, BECAUSE A REPEAT COUNT IS THE ONE
       *   NUMBER A READER TAKES ON TRUST.** `burning` ends at `flame_repeat`'s
       *   frame 1963, whose else-arm goes back to `flame_repeat`; the body runs
       *   TWICE, and that 2 comes from reading `burncycle = 1` against `>= 2`
       *   BY HAND. Printing 32 frames with no flag would make a hand-read
       *   number look exactly like the six this tool derived on its own.
       *
       * `bounded` splits the two kinds. A run with another terminator step that
       * LEAVES — a `Stop`, or a goto to a label outside the run — repeats a
       * counted number of times; one without is an endless idle, which is what
       * `Standing` and `celebrate1a` are.
       */
      loops: Boolean(ending && ending.some((step) => backInsideRun(step, label, endsAt))),
      bounded: Boolean(ending && ending.some((step) => !backInsideRun(step, label, endsAt))),
      runsOn: false
    };
  }).map((run) => ({
    ...run,
    runsOn: !run.selfLoop && run.endsAt !== null && run.ownLast !== null && run.endsAt > run.ownLast
  }));

  /** Does this terminator send the playhead back to a label the run has played? */
  function backInsideRun(step, label, endsAt) {
    if (step.kind !== "goto" || endsAt === null) return false;
    const target = labels.find((other) => other.name === step.target);
    return Boolean(target) && target.frame >= label.frame && target.frame <= endsAt;
  }
}

function report(runs, { all }) {
  const shown = all ? runs : runs.filter((run) => run.runsOn);
  const lines = [
    all
      ? `${runs.length} labels`
      : `${shown.length} of ${runs.length} labels run PAST their own span`,
    ""
  ];
  for (const run of shown) {
    const span = `${String(run.firstFrame).padStart(5)}..${String(run.ownLast ?? "end").padStart(5)}`;
    lines.push(
      `${run.label.padEnd(20)} ${span}  ends ${String(run.endsAt ?? "?").padStart(5)}  ` +
      `${(run.ending ?? "no terminator").padEnd(32)}  ` +
      `${run.swallows.length ? `plays on into: ${run.swallows.join(", ")}` : ""}` +
      `${run.loops
        ? run.bounded
          ? "   [REPEATS — the count is a counter this tool does not evaluate]"
          : "   [ENDLESS — it loops until something else moves the playhead]"
        : ""}`
    );
  }
  return lines.join("\n");
}

function main(argv) {
  const options = parseArguments(argv);
  if (!options) {
    process.stdout.write("usage: node tools/clip-sequences.mjs <file.swf> [--sprite 1241] [--all] [--json]\n");
    return 2;
  }
  const { body, firstTag } = openSwf(fs.readFileSync(options.file));
  const timeline = readSpriteTimeline(body, firstTag, options.sprite);
  if (timeline.labels.length === 0) {
    throw new ClipSequenceToolError(
      `Sprite ${options.sprite} carries no FrameLabel. Check the character id — the fighter clip is ${DEFAULT_SPRITE}.`
    );
  }
  const runs = runsFrom(timeline);
  process.stdout.write(options.json
    ? `${JSON.stringify({ file: options.file, sprite: options.sprite, runs }, null, 2)}\n`
    : `${report(runs, options)}\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main(process.argv.slice(2));
}
