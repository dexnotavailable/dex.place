"""Convert a SOMA 77-joint motion NPZ to BVH with Kimodo's writer (run in the Kimodo venv).

  D:/Dex/Tools/venvs/kimodo/Scripts/python.exe tools/motion-ai/soma_to_bvh.py in.npz out.bvh [--tpose-rest]

Input NPZ keys (what gemx_capture.py writes; Kimodo's own NPZ also works):
  local_rot_mats  (T, 77, 3, 3)  local joint rotations in SOMA / Kimodo convention
                                 (the same matrices SOMA's pose() takes; identity = SOMA rest)
  root_positions  (T, 3)         Hips (pelvis) position in metres, Y-up
  fps             scalar         optional, default 30
  subject_hip_height scalar      optional (gemx_capture writes it): the filmed body's rest hip
                                 height in metres. The root path is scaled by
                                 kimodo_hip_height / subject_hip_height so Kimodo's longer or
                                 shorter legs still reach the floor (--no-match-body to skip).

Why Kimodo's writer: GEM-X's own exporter needs the SSH-only soma-retargeter submodule and has
a known rest-pose bug (GEM-X issue #17). Kimodo feeds exactly these local matrices into SOMA
(kimodo/viz/soma_layer_skin.py), so both models share one BVH skeleton: SETUP.md documents it.
Bone lengths come from Kimodo's neutral SOMA body, not the filmed person.
"""
import argparse
import json

import numpy as np
import torch


def convert(npz_path, bvh_path, tpose_rest=False, fps=None, match_body=True):
    from kimodo.exports.bvh import save_motion_bvh
    from kimodo.skeleton import SOMASkeleton77

    d = np.load(npz_path)
    rots = torch.from_numpy(d["local_rot_mats"]).float()
    root = torch.from_numpy(d["root_positions"]).float()
    if rots.ndim == 5:  # (1, T, 77, 3, 3)
        rots, root = rots[0], root[0]
    if rots.shape[1] != 77:
        raise SystemExit(f"expected 77 SOMA joints, got {rots.shape[1]}")
    if fps is None:
        fps = float(d["fps"]) if "fps" in d.files else 30.0
    skel = SOMASkeleton77()
    info = {}
    if match_body and "subject_hip_height" in d.files:
        kimodo_hip = float(-skel.neutral_joints[:, 1].min())  # hips sit at y=0 in the neutral pose
        k = kimodo_hip / float(d["subject_hip_height"])
        root = root * k
        info = {"root_scale": round(k, 4), "kimodo_hip_height_m": round(kimodo_hip, 4),
                "subject_hip_height_m": round(float(d["subject_hip_height"]), 4)}
    save_motion_bvh(bvh_path, rots, root, skeleton=skel, fps=fps, standard_tpose=tpose_rest)
    return {"bvh": bvh_path, "frames": int(rots.shape[0]), "fps": fps,
            "rest": "standard_tpose" if tpose_rest else "seed_rest", **info}


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("npz")
    p.add_argument("bvh")
    p.add_argument("--tpose-rest", action="store_true")
    p.add_argument("--fps", type=float, default=None)
    p.add_argument("--no-match-body", action="store_true", help="keep the filmed root path unscaled")
    a = p.parse_args()
    print("SOMA_TO_BVH " + json.dumps(convert(a.npz, a.bvh, a.tpose_rest, a.fps, not a.no_match_body)))


if __name__ == "__main__":
    main()
