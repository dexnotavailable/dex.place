#!/usr/bin/env sh
# Round-1 stills (kept for the record): stills.sh with --round r1. See stills.sh.
here=$(cd "$(dirname "$0")" && pwd)
exec sh "$here/stills.sh" --round r1 "$@"
