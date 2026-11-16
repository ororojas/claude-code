#!/usr/bin/env bash
# Start the game on a local static server and open it in a browser.
# Works with Node or Python — whichever is installed.
set -euo pipefail

cd "$(dirname "$0")"
PORT="${PORT:-8080}"
URL="http://127.0.0.1:${PORT}"

open_browser() {
  # Give the server a moment to bind before opening a window.
  sleep 1
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
  elif command -v open    >/dev/null 2>&1; then open "$URL"
  elif command -v start   >/dev/null 2>&1; then start "$URL"
  fi
} 

echo "Voxel Survival -> ${URL}"
open_browser &

if command -v node >/dev/null 2>&1; then
  PORT="$PORT" exec node serve.js
elif command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT" --bind 127.0.0.1
else
  echo "Error: neither node nor python3 found. Install either one, or serve this directory with any static file server." >&2
  exit 1
fi
