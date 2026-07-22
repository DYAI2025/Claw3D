#!/usr/bin/env bash
# claw3d-app — one-click launcher.
#
# Starts the Claw3D dev server (only if it isn't already running) and opens the
# office in a dedicated Chrome app window — no terminal, no typing. Clears a
# stale dev lock automatically so it never fails with "Unable to acquire lock".
# Stop it again with claw3d-app-stop.sh.
set -uo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
REPO="$(cd -- "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"
URL="http://localhost:3000/office"
LOG="/tmp/claw3d-app.log"

cd "$REPO" || exit 1

is_up() { curl -s -o /dev/null --max-time 2 "http://localhost:3000/" 2>/dev/null; }

if ! is_up; then
  # Remove a stale lock left by a previous run so the start always succeeds.
  rm -f "$REPO/.next/dev/lock"
  # Start detached so the server keeps running after this launcher exits.
  setsid nohup npm run dev >"$LOG" 2>&1 </dev/null &
  # Turbopack cold start can take a bit — wait up to ~60s for the first response.
  for _ in $(seq 1 60); do is_up && break; sleep 1; done
fi

# Open a dedicated app window (no tabs, no address bar) so it feels like an app.
setsid nohup google-chrome --app="$URL" --new-window >/dev/null 2>&1 </dev/null &
