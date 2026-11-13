#!/usr/bin/env bash
# Restart the capture-only Vite server (no watching, so it must restart to see edits).
cd "$(dirname "$0")/../../.."
pid=$(netstat -ano 2>/dev/null | grep "127.0.0.1:22418 .*LISTENING" | awk '{print $NF}' | head -1)
[ -n "$pid" ] && taskkill //PID "$pid" //F >/dev/null 2>&1
nohup npx vite --config src/pixel/tools/vite.capture.config.mjs --port 22418 --strictPort --host 127.0.0.1 > review/world/props-capture-dev.log 2>&1 &
for i in $(seq 1 30); do sleep 0.5; grep -q "ready in" review/world/props-capture-dev.log 2>/dev/null && break; done
echo "capture server up"
