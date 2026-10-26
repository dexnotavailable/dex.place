#!/usr/bin/env bash
# Restart the capture-only Vite server (no watching, so it must restart to see edits).
#   PORT=24101 src/pixel/tools/restart-capture-server.sh     (default 24101, the P0 block)
cd "$(dirname "$0")/../../.."
PORT="${PORT:-24101}"
LOG="review/world/phase2/P0/capture-$PORT.log"
mkdir -p "$(dirname "$LOG")"
pid=$(netstat -ano 2>/dev/null | grep "127.0.0.1:$PORT .*LISTENING" | awk '{print $NF}' | head -1)
[ -n "$pid" ] && taskkill //PID "$pid" //F >/dev/null 2>&1
rm -f "$LOG"
nohup npx vite --config src/pixel/tools/vite.capture.config.mjs --port "$PORT" --strictPort --host 127.0.0.1 > "$LOG" 2>&1 &
for i in $(seq 1 40); do sleep 0.5; grep -q "ready in" "$LOG" 2>/dev/null && break; done
echo "capture server up on $PORT"
