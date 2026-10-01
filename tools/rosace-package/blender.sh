#!/usr/bin/env bash
# blender.sh <script.py> [args after --]: one headless, isolated Blender process through the exclusive gate.
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$1"; shift
GATE_TIMEOUT="${GATE_TIMEOUT:-900}" bash "$HERE/gate.sh" -x python "D:/Dex/Projects/dex.place/tools/pixel-pipeline/blender_env.py" run --python-exit-code 1 --python "$(cygpath -m "$SCRIPT")" -- "$@"
