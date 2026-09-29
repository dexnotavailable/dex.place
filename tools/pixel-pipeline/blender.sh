#!/usr/bin/env sh
# Headless Blender in the isolated dex.place environment (Git Bash / sh).
# Same arguments as blender.exe; see blender_env.py for what it isolates.
#   tools/pixel-pipeline/blender.sh --python script.py -- --out dir
here=$(cd "$(dirname "$0")" && pwd)
exec python "$here/blender_env.py" run "$@"
