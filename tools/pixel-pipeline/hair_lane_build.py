"""Hair lane build: build_rosace_v2.py with the hair and veil swapped for rosace/hair_v3.py (runs in Blender).

  python tools/pixel-pipeline/blender_env.py run --python tools/pixel-pipeline/hair_lane_build.py -- \
      --variant v3a --out D:/Dex/Projects/dex-place-art/rosace/build/lanes/hair/v3a.blend

--variant is a name in rosace/hair_v3.VARIANTS ('control' = the v2 hair of rosace/hair.py and the
refit veil, untouched: the control for the A/B). Everything else is the canonical build script
unchanged. Never writes rosace.blend (asserted): the lane builds to its own file; the canonical file
is written only by the Integrate step.
"""
import os
import runpy
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from rosace import common  # noqa: E402

argv = common.args_after_dashes(sys.argv)
VARIANT = common.arg(argv, "--variant", "v3")
OUT = os.path.abspath(common.arg(argv, "--out"))
CANON = os.path.abspath(os.path.join(common.BUILD, "rosace.blend"))
assert OUT != CANON and os.path.basename(OUT) not in ("rosace.blend", "rosace_v1.blend", "rosace_v2.blend",
                                                     "rosace_pre_artistry.blend"), \
    "the hair lane never writes the canonical files"
extra = [a for a in argv if a in ("--no-ao", "--no-glaive")]

if VARIANT != "control":
    from rosace import hair, hair_v3  # noqa: E402
    from rosace_v2 import refit  # noqa: E402
    hair_v3.VARIANT = hair_v3.VARIANTS[VARIANT]
    S = hair_v3.spec()
    hair.build = hair_v3.build
    refit.build_veil_v2 = hair_v3.build_veil
    refit.build_pin_v2 = hair_v3.build_pin
    refit.build_veil_pins_v2 = hair_v3.build_veil_pins
    # hair materials (tones, the designed highlight) ride on the v2 scene's palette overrides, so the
    # render meta and the post-process see the same ramps as the Blender materials
    for name, cfg in S.get("materials", {}).items():
        refit.PALETTE_OVERRIDES[name] = cfg
    print("HAIR_LANE variant", VARIANT, "materials", sorted(S.get("materials", {})))

os.environ["ROSACE_HAIR"] = VARIANT     # build_rosace_v2.py's own hair swap (Integrate step) follows the lane
sys.argv = [os.path.join(HERE, "build_rosace_v2.py"), "--", "--out", OUT] + extra
runpy.run_path(os.path.join(HERE, "build_rosace_v2.py"), run_name="__main__")
import json  # noqa: E402
side = {"variant": VARIANT}
if VARIANT != "control":
    from rosace import hair_v3  # noqa: E402,F811
    print("HAIR_LANE info", hair_v3.INFO)
    side.update({"spec": hair_v3.spec(), "info": hair_v3.INFO})
json.dump(side, open(os.path.splitext(OUT)[0] + "_hair.json", "w"), indent=1, default=str)
