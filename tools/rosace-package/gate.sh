#!/usr/bin/env bash
# gate.sh [-x] <program> [args...]: run through the shared resource gate (owner claude-rosace); -x = exclusive.
HERE="$(cd "$(dirname "$0")" && pwd -W 2>/dev/null || pwd)"
EX=""
if [ "$1" = "-x" ]; then EX="-Exclusive"; shift; fi
F="$(mktemp -t rosacegate.XXXXXX)"
for a in "$@"; do printf '%s\n' "$a" >> "$F"; done
powershell -NoProfile -ExecutionPolicy Bypass -File "$HERE/gated.ps1" $EX -ArgFile "$(cygpath -w "$F" 2>/dev/null || echo "$F")" -TimeoutSeconds "${GATE_TIMEOUT:-900}"
rc=$?
rm -f "$F"
exit $rc
