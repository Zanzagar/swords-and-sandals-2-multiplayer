#!/usr/bin/env bash
# Headless screenshot of a page served by tools/arena-server.mjs, via the
# WINDOWS Chrome — because WSL has no browser and the server's own reachability
# from Windows is the thing three sessions got wrong by curling from inside WSL.
#
#   tools/shot.sh <name> <query-string> [width] [height] [page-path] [cpu|gpu]
#
# ► **THE RASTERISER IS THE SIXTH ARGUMENT, AND IT EXISTS HERE BECAUSE THE TWO
#   TOOLS MUST NOT SHOOT DIFFERENT BROWSERS IN SILENCE.** `tools/shot-live.sh`
#   gained it first; leaving this one hardcoded would have meant two shots taken
#   with the two tools differed by 15.9% of the frame before anything under test
#   changed, with neither output saying so. Measured on the arena, same URL and
#   frame, varying only this: 152,530 pixels, max delta 105, against 0 for either
#   rasteriser compared with itself. `cpu` is the default and passes
#   --disable-gpu, which is what every pixel count in this repository was
#   measured under.
#
# `page-path` defaults to the arena, which is what every existing caller wants
# and is why the first four arguments are unchanged. It became a parameter when
# a SECOND page appeared: the arena was the only thing in this repository that
# could be looked at, the path was baked into the URL, and a screen viewer could
# not be screenshotted at all. Leading slash optional.
#
# ► **A RENDER TOO SMALL TO SHOW THE DEFECT IS NOT EVIDENCE OF ITS ABSENCE, and
#   it manufactures defects too.** A sword was called missing through four
#   screenshots and was there the whole time; an agent suspected missing hair
#   from a crop that had cut it off. The default 1000x760 is a glance. Pass a
#   size at which the thing you are looking for would actually be visible, and
#   read the pixels back with tools/sample-png.mjs rather than trusting an eye.
#
# ► **PREFER `tools/shot-live.sh` UNLESS YOU NEED THIS ONE.** That tool shoots in
#   REAL TIME over CDP, freezes at a frame number so two shots are comparable,
#   kills its own browser, and prints the page's own stage rectangle. This one
#   drives --virtual-time-budget, which NEVER COMPLETES on a page compositing a
#   filter, and it LEAKS A CHROME PROCESS PER INVOCATION — 73 were once alive,
#   after which working URLs start failing and it reads as a page defect. What
#   this one still does that the other cannot is shoot a page that never
#   animates: shot-live refuses a page that never reaches its frame.
#
# Writes /mnt/c/ss2-shots/<name>.png and prints its path and its rasteriser.
set -u
NAME="${1:?name}"; QUERY="${2-}"; W="${3:-1000}"; H="${4:-760}"
PAGE="${5:-/tools/arena/index.html}"
RASTER="${6:-cpu}"
case "$PAGE" in /*) ;; *) PAGE="/$PAGE" ;; esac
# Refused BY NAME rather than falling through to one of them: a typo silently
# selecting software rasterisation is how the weapon glow's "3.9x frame cost"
# came to be published as a property of the feature.
case "$RASTER" in
  cpu) GPU_FLAG="--disable-gpu" ;;
  gpu) GPU_FLAG="" ;;
  *) echo "Refusing the rasteriser \"$RASTER\": it is \"cpu\" (adds --disable-gpu) or \"gpu\" (omits it)." >&2; exit 2 ;;
esac
IP="$(hostname -I | awk '{print $1}')"
CHROME="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
OUT_WIN="C:\\ss2-shots\\${NAME}.png"
OUT_WSL="/mnt/c/ss2-shots/${NAME}.png"
PROFILE="C:\\ss2-shots\\profile-${NAME}"
rm -f "$OUT_WSL"
timeout 150 "$CHROME" --headless=new ${GPU_FLAG:+$GPU_FLAG} --no-sandbox --hide-scrollbars \
  --user-data-dir="$PROFILE" \
  --window-size="${W},${H}" --virtual-time-budget=30000 \
  --screenshot="$OUT_WIN" \
  "http://${IP}:8123${PAGE}?${QUERY}" >/dev/null 2>&1
# The rasteriser is on the output line because it cannot be recovered from the
# PNG, and two shots whose rasteriser nobody wrote down are a puzzle rather than
# a measurement.
if [ -s "$OUT_WSL" ]; then echo "$OUT_WSL  rasteriser $RASTER"; else echo "FAILED: $NAME" >&2; exit 1; fi
