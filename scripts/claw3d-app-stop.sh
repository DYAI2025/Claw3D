#!/usr/bin/env bash
# claw3d-app-stop — stop the Claw3D dev server started by claw3d-app.sh.
set -uo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
REPO="$(cd -- "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"

pids="$(lsof -ti tcp:3000 -sTCP:LISTEN 2>/dev/null || true)"
[ -n "$pids" ] && kill $pids 2>/dev/null || true
rm -f "$REPO/.next/dev/lock"
command -v notify-send >/dev/null 2>&1 && notify-send "Claw3D" "gestoppt" || true
