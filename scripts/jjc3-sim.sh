#!/bin/bash
# JJC3 re-encode survival simulator.
# Encrypts a seeded payload, re-encodes the carrier the way sharing platforms
# do (H.264/VP9 at several bitrates, downscale), and verifies byte-perfect
# decryption of each. Exits 0 when all required profiles pass.
#
# Usage: scripts/jjc3-sim.sh [payload-kb]   (default 32)

set -uo pipefail

PORT=8080
KB="${1:-32}"
URL="http://localhost:$PORT/tests/jjc3-sim.html?kb=$KB"
LOG="$(mktemp)"
VITE_PID=""

cleanup() {
    [ -n "${BPID:-}" ] && kill "$BPID" 2>/dev/null
    [ -n "$VITE_PID" ] && kill "$VITE_PID" 2>/dev/null
    rm -f "$LOG"
}
trap cleanup EXIT

if ! curl -sf "http://localhost:$PORT/player.html" >/dev/null 2>&1; then
    echo "Starting vite dev server on :$PORT..."
    npx vite --port "$PORT" >/dev/null 2>&1 &
    VITE_PID=$!
    for _ in $(seq 1 30); do
        curl -sf "http://localhost:$PORT/player.html" >/dev/null 2>&1 && break
        sleep 1
    done
fi

BROWSER="$(command -v chromium || command -v chromium-browser || command -v google-chrome || true)"
if [ -z "$BROWSER" ]; then
    echo "ERROR: no chromium/chrome binary found" >&2
    exit 2
fi

echo "Running JJC3 channel simulation (payload ${KB} KB — takes a few minutes)..."
"$BROWSER" --headless=new --no-sandbox --disable-gpu --enable-logging=stderr "$URL" >/dev/null 2>"$LOG" &
BPID=$!

SECONDS=0
while kill -0 "$BPID" 2>/dev/null; do
    grep -q "JJC3SIM-RESULT:" "$LOG" && break
    if [ "$SECONDS" -gt 1200 ]; then
        echo "ERROR: simulation timed out after 20 minutes" >&2
        exit 3
    fi
    sleep 2
done
kill "$BPID" 2>/dev/null
BPID=""

echo ""
grep -o 'JJC3SIM: [^"]*' "$LOG" | sed 's/^JJC3SIM: //'
echo ""

if grep -q "JJC3SIM-RESULT: ALL-PASS" "$LOG"; then
    echo "RESULT: PASS (all profiles, including stress)"
    exit 0
elif grep -q "JJC3SIM-RESULT: REQUIRED-PASS" "$LOG"; then
    echo "RESULT: PASS (required profiles; see stress failures above — these map the format's margins)"
    exit 0
else
    echo "RESULT: FAIL"
    grep -o 'JJC3SIM-RESULT: [^"]*' "$LOG"
    exit 1
fi
