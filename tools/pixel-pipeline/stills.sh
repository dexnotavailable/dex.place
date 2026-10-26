#!/usr/bin/env sh
# Key stills for a review round: rebuild rosace.blend from scripts (build_rosace_v2.py since the Adopt step), render the four key poses
# at 96/128/144, pixel post-process (no face), then face stamp + override layer + rim.
#   sh tools/pixel-pipeline/stills.sh --round r2 [--no-build] [--no-render] [--px 96,128,144]
# Output (not in the repo): $ROSACE_BUILD/renders/<round>/<still>/px<N>/{noface,still}.png
# Review sheets: python tools/pixel-pipeline/stills_sheets.py --renders <build>/renders/<round> --out review/rosace/<dir>
# Override patches painted on an older render are skipped as STALE (overrides.py); the
# face stamp and the rim still apply.
# Round 4 (current): sh stills.sh --round r4. Authoring records (not run here): author_faces.py
# (+ author_faces_small.py) -> art/rosace/faces, author_hands.py -> art/rosace/hands,
# author_overrides.py (+ author_overrides_data.py) -> art/rosace/overrides/*.json on the r4 renders.
# Round 4 layers carry a "preface" (bang profile, face-window clean-up, jaw / profile contour)
# that overrides.py draws BEFORE the face stamp.
set -e
here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/../.." && pwd)
build=${ROSACE_BUILD:-D:/Dex/Projects/dex-place-art/rosace/build}
round=r1
pxs=96,128,144
do_build=1
do_render=1
while [ $# -gt 0 ]; do
  case "$1" in
    --round) round=$2; shift ;;
    --px) pxs=$2; shift ;;
    --no-build) do_build=0 ;;
    --no-render) do_render=0 ;;
  esac
  shift
done
out="$build/renders/$round"
if [ $do_build = 1 ]; then
  sh "$here/blender.sh" --python "$here/build_rosace_v2.py"
fi
# still name | pose file | extra render args
stills="idle_hero:idle_hero:
n1_contact:n1_contact:
q_stamp:q_stamp:
n2_pivot_black:n2_pivot:--thong black
n2_pivot_white:n2_pivot:--thong white"
if [ $do_render = 1 ]; then
  echo "$stills" | while IFS=: read -r name pose extra; do
    # shellcheck disable=SC2086
    sh "$here/blender.sh" --python "$here/render_rosace.py" -- \
      --blend "$build/rosace.blend" --pose "$repo/art/rosace/poses/$pose.json" \
      --px "$pxs" --ss 4 --out "$out/$name" $extra
  done
fi
echo "$stills" | while IFS=: read -r name pose extra; do
  for px in $(echo "$pxs" | tr , ' '); do
    python "$here/rosace_post.py" --raw "$out/$name/px$px" --no-face --tag noface
    # one layer per pose and height; the thong variants share it (built from the black one)
    [ "$name" = n2_pivot_white ] || python "$here/overrides.py" build --still "$out/$name/px$px" --layer "${pose}_$px"
    python "$here/overrides.py" apply --still "$out/$name/px$px" --layer "${pose}_$px"
  done
done
