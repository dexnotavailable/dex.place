"""Measure a saved clip (blender_apply.py --save-blend) with rig_measure.py, frame by frame.

  python tools/motion-ai/measure_action.py n1 n5 n1_r2 n5_r2    # system Python; one headless Blender
      -> review/motion/r2/_authoring/rig_<name>.json

Used to put round-1 clips (which were rendered before rig_measure existed) on the same numbers as
round 2. Every rendered image frame of renders/<name>/px144/meta.json is measured (hand-to-shaft only
for hands whose IK grip is on, i.e. not a let-go left hand).
"""
import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
ART = Path(r"D:\Dex\Projects\dex-place-art\rosace\motion-ai")


def blender_main():
    import bpy
    from mathutils import Vector
    sys.path.insert(0, str(HERE))
    sys.path.insert(0, str(REPO / "tools" / "pixel-pipeline"))
    import rig_measure
    job = json.loads(sys.argv[sys.argv.index("--") + 1])
    res = {}
    for name in job["names"]:
        bpy.ops.wm.open_mainfile(filepath=str(ART / "actions" / f"{name}.blend"))
        sc = bpy.context.scene
        arm = bpy.data.objects["rosace_rig"]
        meta = json.loads((ART / "renders" / name / "px144" / "meta.json").read_text())
        mo = meta["motion"]
        rm = mo["root_motion_px"]
        ppm = meta["ppm"]
        # what in-place playback removed (blender_apply.ground_offset): the smoothed root's horizontal
        # travel, SOMA (x, z) -> Blender (x, -z), times the leg scale
        import numpy as np
        sr = np.load(mo["npz"])["smooth_root_pos"].astype(float)
        k = float(mo.get("leg_scale", 0.919))
        g = [Vector((k * sr[f][0], -k * sr[f][2], 0.0)) for f in range(len(sr))] if mo.get("in_place", True)             else [Vector((0, 0, 0))] * len(sr)
        rows = {}
        for f in meta["frames"]:
            sc.frame_set(f)
            grip_l = arm.pose.bones["J_Bip_L_LowerArm"].constraints["ik"]
            both = (not grip_l.mute) and grip_l.influence > 0.9
            m = rig_measure.measure(arm, grips=("R", "L") if both else ("R",), ground=g[f])
            rows[str(f)] = m
        res[name] = {"frames": meta["frames"], "display": mo["sample_frame"], "rig": rows}
        print("MEASURED", name, len(rows), flush=True)
    Path(job["out"]).write_text(json.dumps(res))


def main():
    names = sys.argv[1:] or ["n1", "n5"]
    out = REPO / "review" / "motion" / "r2" / "_authoring" / "rig_tmp.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    job = {"names": names, "out": str(out)}
    r = subprocess.run([sys.executable, str(REPO / "tools/pixel-pipeline/blender_env.py"), "run", "--python-exit-code", "1",
                        "--python", str(Path(__file__).resolve()), "--", json.dumps(job)], capture_output=True, text=True)
    if r.returncode:
        print((r.stdout or "")[-3000:], (r.stderr or "")[-3000:])
        raise SystemExit("blender failed")
    res = json.loads(out.read_text())
    out.unlink()
    for n, v in res.items():
        p = out.parent / f"rig_{n}.json"
        p.write_text(json.dumps(v, indent=1))
        print(p)


if __name__ == "__main__":
    try:
        import bpy  # noqa: F401
        blender_main()
    except ImportError:
        main()
