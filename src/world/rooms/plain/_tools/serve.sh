#!/usr/bin/env sh
# Restart lane R-B's capture server (ports 24300-24399; default 24301) after your own edits.
#   sh src/world/rooms/plain/_tools/serve.sh [port]
PORT="${1:-24301}"
for pid in $(netstat -ano 2>/dev/null | grep "127.0.0.1:$PORT " | grep LISTENING | awk '{print $NF}' | sort -u); do
  taskkill //PID "$pid" //F >/dev/null 2>&1 || kill "$pid" 2>/dev/null
done
sleep 1
nohup npx vite --config src/world/rooms/plain/_tools/vite.rb.config.mjs --port "$PORT" --strictPort --host 127.0.0.1 > "${TMPDIR:-/tmp}/rb-capture-$PORT.log" 2>&1 &
sleep 3
echo "R-B capture server on $PORT"
