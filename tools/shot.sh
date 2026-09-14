#!/usr/bin/env bash
# Headless screenshot of a page served by tools/arena-server.mjs, via the
# WINDOWS Chrome — because WSL has no browser and the server's own reachability
# from Windows is the thing three sessions got wrong by curling from inside WSL.
#
#   tools/shot.sh <name> <query-string> [width] [height] [page-path]
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
# Writes /mnt/c/ss2-shots/<name>.png and prints its path.
set -u
NAME="${1:?name}"; QUERY="${2-}"; W="${3:-1000}"; H="${4:-760}"
PAGE="${5:-/tools/arena/index.html}"
case "$PAGE" in /*) ;; *) PAGE="/$PAGE" ;; esac
IP="$(hostname -I | awk '{print $1}')"
CHROME="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
OUT_WIN="C:\\ss2-shots\\${NAME}.png"
OUT_WSL="/mnt/c/ss2-shots/${NAME}.png"
PROFILE="C:\\ss2-shots\\profile-${NAME}"
rm -f "$OUT_WSL"
timeout 150 "$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --user-data-dir="$PROFILE" \
  --window-size="${W},${H}" --virtual-time-budget=30000 \
  --screenshot="$OUT_WIN" \
  "http://${IP}:8123${PAGE}?${QUERY}" >/dev/null 2>&1
if [ -s "$OUT_WSL" ]; then echo "$OUT_WSL"; else echo "FAILED: $NAME" >&2; exit 1; fi
