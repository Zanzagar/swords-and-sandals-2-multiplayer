#!/usr/bin/env bash
# A REAL-TIME screenshot, frozen at a deterministic frame. See tools/shot-live.mjs
# for why this exists beside tools/shot.sh — in one line: shot.sh's
# --virtual-time-budget never completes on a page that composites a filter, and
# its FAILED reads as a page defect when it is a screenshot-mode limit.
#
#   tools/shot-live.sh <name> "<query>" [width] [height] [freezeAtFrame] [page-path]
#
# Runs the driver under the WINDOWS node, because Chrome binds its debugging
# port to the Windows loopback and ignores --remote-debugging-address, so a WSL
# process cannot reach it. The WSL address is computed HERE, where `hostname -I`
# means what it says, and handed over in SS2_HOST.
set -eu
NAME="${1:?name}"; QUERY="${2-}"; W="${3:-1200}"; H="${4:-800}"; FREEZE="${5:-120}"; PAGE="${6:-/tools/arena/index.html}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE="$(node -e 'import("./tools/shot-live.mjs").then((m)=>console.log(m.resolveWindowsNode()||""))' --input-type=module 2>/dev/null || true)"
if [ -z "${NODE}" ] || [ ! -x "${NODE}" ]; then
  echo "No Windows node found under /mnt/c/Users/corey/.cache/codex-runtimes/*/dependencies/node/bin/node.exe" >&2
  echo "AGENTS.md records where it lives; the directory moves on update, so this resolves rather than pins." >&2
  exit 1
fi
HOST="$(hostname -I | awk '{print $1}')"
exec "${NODE}" "$(wslpath -w "${HERE}/tools/shot-live.mjs")" \
  "${HOST}" "${NAME}" "${QUERY}" "${W}" "${H}" "${FREEZE}" "${PAGE}"
