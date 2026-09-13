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

The extractor is READ-ONLY on the SWF. That matters beyond politeness: the
installed build is this project's MEASUREMENT ORACLE, and all 23 promoted
goldens, 69 observation records and every capture manifest cite its sha256.

Each run writes `manifest.json` beside the audio, recording the sha256 of the
SWF the assets came from. If that hash is not the oracle's, the assets came from
a different build — a modded copy, a different release — and anything you
conclude from them is about that build instead.

## What a fresh clone does

Nothing breaks. `src/render/figure.js` draws original vector art from
arithmetic, and that stays the fallback whenever this directory is empty.
