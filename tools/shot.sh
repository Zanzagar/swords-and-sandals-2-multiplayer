#!/usr/bin/env bash
# Headless screenshot of a page served by tools/arena-server.mjs, via the
# WINDOWS Chrome — because WSL has no browser and the server's own reachability
# from Windows is the thing three sessions got wrong by curling from inside WSL.
#
#   tools/shot.sh <name> <query-string> [width] [height]
#
# Writes /mnt/c/ss2-shots/<name>.png and prints its path.
set -u
NAME="${1:?name}"; QUERY="${2-}"; W="${3:-1000}"; H="${4:-760}"
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
  "http://${IP}:8123/tools/arena/index.html?${QUERY}" >/dev/null 2>&1
if [ -s "$OUT_WSL" ]; then echo "$OUT_WSL"; else echo "FAILED: $NAME" >&2; exit 1; fi
