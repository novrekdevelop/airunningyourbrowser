#!/usr/bin/env sh
# ============================================================
#  AI Running in Your Browser — macOS / Linux launcher
#  Double-click this file (or run it from a terminal).
#  It starts the app and opens your browser automatically.
#  Press Ctrl+C in the terminal to stop.
# ============================================================
set -e
cd "$(dirname "$0")"

echo "============================================================"
echo "  Please wait... starting the app and opening your browser."
echo "============================================================"

# Prefer python3, fall back to python.
PY=""
if command -v python3 >/dev/null 2>&1; then
    PY="python3"
elif command -v python >/dev/null 2>&1; then
    PY="python"
else
    echo ""
    echo "  [!] Python 3 is required. Install it from https://python.org"
    echo "      …or use:  brew install python   (macOS)"
    echo "      …or use:  sudo apt install python3   (Linux)"
    echo ""
    exit 1
fi

exec "$PY" start.py