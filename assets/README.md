# Extracted SS2 assets — local only, never committed

This directory is where **your own** extracted Swords & Sandals II assets live.
It is gitignored except for this file, and a test fails if anything else in it
is ever tracked.

## Filling it: one command

    node tools/extract-all.mjs

That finds your install, checks it is the build this project knows, and runs
every extractor below in order. Re-running it is safe: a pack already extracted
from the same build by the same extractor is skipped. It ends by saying what the
arena can now use. Then:

    node tools/arena-server.mjs
    # open http://127.0.0.1:8123/

**If it cannot find your install**, give it the path, either the `.swf` or the
collection's folder:

    node tools/extract-all.mjs "<path to swords_sandals2_download.swf>"
    node tools/extract-all.mjs "<path to Swords and Sandals Classic Collection>"

or set `SS2_SWF` to the `.swf`. A relative path, in either, is relative to the
directory you run the command from. With no path it tries these in order, and
prints every one it tried when it finds none:

1. `SS2_SWF` from the environment. If it is set and the file is not there, it
   stops rather than reading some other build.
2. Steam's default library for your platform, under
   `steamapps/common/Swords and Sandals Classic Collection/swf/`:
   - WSL: `/mnt/c/Program Files (x86)/Steam`, then `/mnt/c/Program Files/Steam`.
     This is the one location that has been measured on this project.
   - Windows: `%ProgramFiles(x86)%\Steam`, then `%ProgramFiles%\Steam`.
   - macOS: `~/Library/Application Support/Steam`.
   - Linux: `~/.local/share/Steam`, `~/.steam/steam`,
     `~/.steam/debian-installation`, Flatpak
     (`~/.var/app/com.valvesoftware.Steam/.local/share/Steam`), Snap
     (`~/snap/steam/common/.local/share/Steam`).

   The Windows, macOS and Linux locations are Steam's usual defaults. Nobody on
   this project has checked them against a real install of the collection.
3. Any other Steam library listed in those installs' own
   `steamapps/libraryfolders.vdf`, which covers a library on a second drive. On
   WSL a `D:\SteamLibrary` there is read as `/mnt/d/SteamLibrary`.

It never searches a disk. Every path it probes comes from that list.

### Options

| flag | what it does |
|---|---|
| `--force` | re-extract every pack, even ones that would be skipped |
| `--only figure,sound` | just those packs (still in dependency order) |
| `--verbose` | show each extractor's own report as it runs |
| `--allow-other-build` | extract from a SWF whose sha256 is not the known one (below) |

Exit status: `0` means every pack is ok or skipped; `1` means a pack failed or
the SWF changed during the run (and then the ledger stops vouching for every
pack that run extracted); `2` means nothing ran (a bad flag, no SWF found,
the build was refused, a destination was refused — below — or another
`extract-all` is already running: a run holds `assets/extract-all.lock`). A run
stopped with Ctrl-C or a crash leaves that lock behind, and the next run
refuses, saying the process that left it is no longer running. Delete the file
and run again. It is never cleared automatically, because two runs clearing
the same lock at once could each remove the other's. A failed pack prints the command that redoes just that
pack, e.g. `node tools/extract-all.mjs --only icons --verbose "<swf>"`.
A pack that fails for any reason fails alone, and the run goes on to the next
pack. That includes an unexpected error, such as a file where its folder
should be or a permission error; the message names the step and the error.
Each extractor writes into a fresh staging folder
(`assets/.extract-all-staging-<pid>-<pack>`), and every check below reads
the staged files. A pack is moved into `assets/<dir>/` only when every check has
passed. **A failure leaves the previous pack exactly as it was, MP3s and images
included** (or nothing, if there was none), and deletes the staging folder.
That includes a failure while installing: each old file is moved aside before
its replacement goes in, and on an error every step is undone.

Only two cases can leave a pack mixing old and new files:
- the process is killed part-way through installing a pack;
- that undo itself fails. The message then names every path that may be mixed
  and where its previous copy is: `.previous/` inside that pack's staging folder,
  which is kept until the next run.

Either way the pack has no ledger entry, so the next run redoes it. The next
run also clears any staging folder left behind.

One more case: a pack that installs completely but then fails to be recorded
is the new pack, whole, with no ledger entry. The next run redoes it.

A pack FAILS, even when its extractor exits 0, if it did not write its files,
if its manifest names another build, if a file its manifest names is missing
or the wrong size, or if it records a failure of its own that `extract-all`
does not expect. Only one pack has expected failures: the known build's props
extraction records two, `panel`'s two text fields (characters 1527 and 1528),
which the arena draws from the text pack instead. They are matched one by one
(`tolerated` in `tools/extract-all.mjs`), shown beside that pack's `ok`, and
anything else a pack records fails it.

### A link under `assets/` is refused

Packs are installed into their folders under `assets/`, and a folder that is a
link would put them somewhere else, possibly next to or over the SWF itself.
So before anything is written, `extract-all` refuses (exit `2`, naming each
path) if `assets/` or a pack folder it is about to write is a symbolic link or
resolves outside this tree's `assets/`. It also refuses if a file in one of
those folders is a symbolic link, is the SWF itself, or is hard-linked to
anything else. An SWF kept anywhere inside
`assets/` is refused too. A git worktree whose
`assets/<pack>` folders link to another checkout is refused for the same
reason: its run would overwrite the other tree's packs. Give such a worktree
its own real `assets/` folders.

### A different build is refused unless you say otherwise

The SWF's sha256 is checked against
`docs/integration/ss2-build-fingerprint.json`. If it does not match, nothing is
extracted and the command says why. Run it again with `--allow-other-build` if
the other build is deliberate: a modded copy, or a newer release. This is
stricter than the individual extractors, which accept any build and print a
note. The arena's readers are keyed to the known build's character ids, export
names and bytecode, so packs from another build can load and draw something that
looks right but is wrong, and nothing on screen would say so. Every pack records
the sha256 it was read from either way.

### How skipping works

`assets/extract-all.json` is a ledger that records which build and which version
of each extractor wrote each pack. A pack is recorded there only after the
run's closing hash shows the SWF did not change, so a run that stops part-way
records nothing it extracted, and the next run redoes those packs. A pack is
skipped only if all of these hold:

- the ledger names this SWF's sha256;
- the ledger names this version of the extractor (its source and every local
  module it imports, hashed), so pulling a changed extractor re-extracts its pack;
- the pack's own manifest names the same sha256, if the pack records one, and
  records no failure `extract-all` does not expect;
- every file the arena reads from the pack is present, and unchanged (same size
  and modification time) since the ledger recorded it. For the sound and
  bitmaps packs that includes every MP3, JPEG, PNG and alpha plane their
  manifest names, which must also be the size the manifest records. Copying
  `assets/` without keeping modification times makes the next run redo every
  pack;
- what the pack reads from another pack is unchanged since it was extracted.
  Today that only applies to the figure, whose preview reads the sound pack's
  manifest: the ledger remembers what that manifest held, so `--only sound`
  today redoes the figure on the next full run.

## The packs

Every extractor is READ-ONLY on the SWF and writes only here. Each one can also
be run by itself as `node tools/extract-<name>.mjs "<swf>"`, which is how you get
its full report. `extract-all` runs them in this order:

| pack | extractor | writes | the arena gets | without it |
|---|---|---|---|---|
| sound | `tools/extract-sounds.mjs` | `sound/` (every `DefineSound` repacked as MP3, plus `manifest.json` binding each one to the animation label and frame it fires on) | the build's own sound effects and the crowd, timed to their frames | silence |
| figure | `tools/extract-figure.mjs` | `figure/shapes.json`, `animations.json`, `manifest.json`, `preview.html` | the build's own gladiator rig and animations | the authored vector figure (`src/render/figure.js`) |
| wardrobe | `tools/extract-wardrobe.mjs` | `figure/wardrobe.json` | armour, weapons, shields and hair on the gladiators | an undressed gladiator |
| enchantments | `tools/extract-enchantments.mjs` | `figure/enchantments.json` | the weapon-enchantment glows | unglowed weapons |
| props | `tools/extract-props.mjs` | `props/props.json`, `manifest.json` | the arena screen (backdrop, sky, sand, stands, UI bar, frame) and the arrows, bolts, fireballs and boulders | the authored arena and arrow |
| clip-effects | `tools/extract-clip-effects.mjs` | `props/clip-effects.json` | blood and sparks on the frames the build throws them | no blood or sparks |
| bitmaps | `tools/extract-bitmaps.mjs` | `bitmaps/` (JPEGs, PNGs, alpha planes, `manifest.json`) | the arena walls and crowds, which the build stores as bitmaps | the vector layer with no walls or crowds painted on it |
| icons | `tools/extract-icons.mjs` | `icons/icons.json`, `manifest.json` | the faces (eyes and mouth) and the damage, spell and BLOCK pop-up art | a blank face and plain-number pop-ups |
| text | `tools/extract-text.mjs` | `text/text.json`, `manifest.json` | the UI bar's words, in the build's own fonts | a wordless UI bar |
| champions | `tools/extract-champions.mjs` | `champions/champions.json`, `manifest.json` | the tournament champions, for `?red=&blue=` | `?red=`/`?blue=` refuse to start; the demo roster still plays |
| screens | `tools/extract-screens.mjs` | `screens/screens.json`, `manifest.json` | nothing in the arena. This pack is for the screens viewer (`tools/screens/`) | the screens viewer has nothing to draw |

`test/extract-all.test.js` checks this table's code side against the code: every
`tools/extract-*.mjs` is in `extract-all`'s list, and every `/assets/...` file
the arena fetches is written by one of the packs.

**Look at the figure's preview.** Nothing else checks that extraction: a test
suite cannot tell a correct rig from a plausible one. `figure/preview.html`
embeds its own data, so you can open it straight from disk, or serve it with
`node tools/arena-server.mjs` and go to
`http://127.0.0.1:8123/assets/figure/preview.html`.

## What a fresh clone does

It runs. A clone with nothing in this directory can still play: every pack above
is optional, and the arena falls back pack by pack (the right-hand column). With
no packs at all you get the authored vector figure on the authored arena, in
silence, and a `?red=`/`?blue=` champion bout tells you on the page to run the
one command. The arena's log panel says when the figure, wardrobe,
enchantments, props, text or sound pack is missing. The icons, bitmaps and
clip-effects packs fall back without a log line.

The test suite also skips the tests that need a pack. `AGENTS.md` has the exact
count for a fresh clone and says what each skipped test needs.

## Why it works this way

`AGENTS.md` states the project's distribution rule:

> **Ship no SS2 asset.** The project is intended to be shared, so the repo is a
> distribution channel: someone who clones it must still need their own licensed
> copy to play. Same model as a Doom source port shipping no WAD. **This is
> about what leaves the repo, never about what you may build in it.**

Extracting from your own copy onto your own machine counts as building in the
repo. Committing the result does not. A source port draws the same line: it
ships no WAD and reads yours.

Every extractor is READ-ONLY on the SWF, and `extract-all` hashes the SWF again
after its last pack and fails loudly if the hash changed. This matters beyond
politeness. The installed build is this project's MEASUREMENT ORACLE, and every
promoted golden, observation record and capture manifest cites its sha256.

Each pack records the sha256 of the SWF it came from (all except
`props/clip-effects.json`, where the ledger holds it instead). If that hash is
not the oracle's, the pack came from a different build, and anything you
conclude from it is about that build.
