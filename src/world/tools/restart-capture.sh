#!/usr/bin/env sh
# Restart the capture-only /world/ server (no HMR, no watching) after your own edits.
#   sh src/world/tools/restart-capture.sh [port]     (default 24001; W0's block is 24000-24099)
PORT="${1:-24001}"
for pid in $(netstat -ano 2>/dev/null | grep "127.0.0.1:$PORT " | grep LISTENING | awk '{print $NF}' | sort -u); do
  taskkill //PID "$pid" //F >/dev/null 2>&1 || kill "$pid" 2>/dev/null
done
sleep 1
nohup npx vite --config src/world/tools/vite.capture.config.mjs --port "$PORT" --strictPort --host 127.0.0.1 > "${TMPDIR:-/tmp}/world-capture-$PORT.log" 2>&1 &
sleep 3
echo "capture server on $PORT"
