# Extracted SS2 assets — local only, never committed

This directory is where **your own** extracted Swords & Sandals II assets live.
It is gitignored except for this file, and a test fails if anything else in it
is ever tracked.

## Why it works this way

`AGENTS.md` states the project's distribution rule:

> **Ship no SS2 asset.** The project is intended to be shared, so the repo is a
> distribution channel: someone who clones it must still need their own licensed
> copy to play. Same model as a Doom source port shipping no WAD. **This is
> about what leaves the repo, never about what you may build in it.**

So: extracting from the copy you own, onto your own machine, is building in it.
Committing the result is not. That is the whole boundary, and it is the same one
a source port draws — the port ships no WAD and reads yours.

## Filling it

    node tools/extract-sounds.mjs "<path to your swords_sandals2_download.swf>"
    node tools/extract-figure.mjs "<same path>"          # or no path: it knows the default

The first writes `sound/`: every `DefineSound` in the build, repacked as MP3,
bound to the animation label it fires under.

The second writes `figure/`: the fighter clip resolved into shapes and poses —
`shapes.json` (each shape once, as SVG path data), `animations.json` (101
labelled animations, 2,222 poses of thirteen named limbs) and `preview.html`,
which plays them.

**Look at the preview.** It is the only check this extraction has — a suite
cannot tell a correct rig from a plausible one. It fetches the JSON beside it,
so it needs an origin:

    node tools/arena-server.mjs
    # then open http://127.0.0.1:8123/assets/figure/preview.html

Both extractors are READ-ONLY on the SWF. That matters beyond politeness: the
installed build is this project's MEASUREMENT ORACLE, and all 23 promoted
goldens, 69 observation records and every capture manifest cite its sha256.

Each run writes a `manifest.json` beside its output, recording the sha256 of the
SWF the assets came from. If that hash is not the oracle's, the assets came from
a different build — a modded copy, a different release — and anything you
conclude from them is about that build instead.

## What a fresh clone does

Nothing breaks. `src/render/figure.js` draws original vector art from
arithmetic, and that stays the fallback whenever this directory is empty.
