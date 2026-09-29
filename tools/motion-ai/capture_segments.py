"""Cut GEM-X captures into attack segments, face them the same way as our moves, and (optionally)
re-in-between them with Kimodo from automatically picked key poses. Run in the Kimodo venv.

  D:/Dex/Tools/venvs/kimodo/Scripts/python.exe tools/motion-ai/capture_segments.py cut
  D:/Dex/Tools/venvs/kimodo/Scripts/python.exe tools/motion-ai/capture_segments.py rekey [--samples 2]

cut    for every SEGMENTS entry: take frames [a, b) of review/motion/_runs/gemx_<clip>/motion_soma.npz,
       rotate about the vertical so the performer faces +Z (our side view's "right") at the first
       frame, move the start to the origin, scale the hips path to Kimodo's body, and write
       <raw>/video/<name>_gemx.bvh (+ .npz). This is GEM-X's motion as captured.
rekey  pick key poses in each cut segment (frames where both wrists slow to a local minimum,
       i.e. the extremes / holds a pose-to-pose animator would draw) and hand them to Kimodo as
       full-body keyframes, with the performer's path as a root2d path:
         x1.0   same timing: Kimodo only redraws the in-betweens (cleans jitter and foot slide)
         x0.6   every gap between keys shrunk to 60%: snappier, closer to game timing
       -> <raw>/video/<name>_kimodo_x1.0_s<seed>_NN.bvh etc.

Rights: these clips are Motion Actor Inc's "Long Weapon" videos (free to trace and rearrange,
no profit use, no redistribution; see VIDEO-TO-MOTION.md). Motion derived from them is study
material until Dex rules on the non-profit question; never commit it or ship it.
"""
import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
import torch

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
RUNS = Path(r"D:\Dex\Projects\dex.place\review\motion\_runs")
RAW = Path(r"D:\Dex\Projects\dex-place-art\rosace\motion-ai\raw")
KIMODO_PY = r"D:\Dex\Tools\venvs\kimodo\Scripts\python.exe"

# name: (clip id, first frame, end frame (30 fps), what it feeds, note)
SEGMENTS = {
    "thrustmow_full": ("thrustmow_H9C2IemTkzM", 0, 270, "dash_attack, n1", "retreat, thrust, low mow, recoil"),
    "thrustmow_thrust_mow": ("thrustmow_H9C2IemTkzM", 15, 165, "dash_attack (pass-through), n1 (low sweep)", "thrust into the wide low mow"),
    "bigsweep_overhead": ("bigsweep_yeOMbxdKv6o", 0, 120, "n5 (sweep), n1", "big overhead swings into a low lunge sweep"),
    "bigsweep_sweep_kneel": ("bigsweep_yeOMbxdKv6o", 255, 345, "n5 (sweep into a kneel)", "turning sweep, drops to one knee at ~10 s"),
    "whirlpool_wheels": ("whirlpool_-iJ_d5z5m3o", 0, 150, "n3, q (twirl)", "vertical wheels at the side, lunges"),
    "whirlpool_twirl_plant": ("whirlpool_-iJ_d5z5m3o", 240, 390, "q (overhead twirl, stamp), n3", "upright pole twirls around the body"),
    "windmill_overhead": ("windmill_F2nStU9Wqck", 30, 150, "q (overhead twirl), n3", "two-handed windmills overhead and behind"),
    "windmill_kneelift": ("windmill_F2nStU9Wqck", 300, 420, "n5 coil, q", "windmills with knee-lift pivots at ~11 s and ~12.5 s"),
}


def fk77(rots, root):
    from kimodo.skeleton import SOMASkeleton77
    sk = SOMASkeleton77()
    g, p, _ = sk.fk(torch.from_numpy(rots).float(), torch.from_numpy(root).float())
    return p.numpy(), list(sk.bone_order_names), sk


def heading_deg(P, names):
    r, l = P[..., names.index("RightLeg"), :], P[..., names.index("LeftLeg"), :]
    d = r - l
    return np.degrees(np.arctan2(d[..., 2], -d[..., 0]))


def ry_np(deg):
    a = math.radians(deg)
    return np.array([[math.cos(a), 0, math.sin(a)], [0, 1, 0], [-math.sin(a), 0, math.cos(a)]], np.float32)


def cut(name, raw):
    clip, a, b, feeds, note = SEGMENTS[name]
    d = np.load(RUNS / f"gemx_{clip}" / "motion_soma.npz")
    rots = d["local_rot_mats"][a:b].astype(np.float32)
    root = d["root_positions"][a:b].astype(np.float32)
    from kimodo.skeleton import SOMASkeleton77
    kimodo_hip = float(-SOMASkeleton77().neutral_joints[:, 1].min())
    root = root * (kimodo_hip / float(d["subject_hip_height"]))
    P, names, _ = fk77(rots[:1], root[:1])
    yaw0 = float(heading_deg(P[0], names))
    R = ry_np(-yaw0)
    rots = rots.copy()
    rots[:, 0] = np.einsum("ij,tjk->tik", R, rots[:, 0])
    root = (root - np.array([root[0, 0], 0, root[0, 2]], np.float32)) @ R.T
    # floor: lowest joint over the segment sits at 0
    P, names, _ = fk77(rots, root)
    root[:, 1] -= P[..., 1].min()
    outdir = raw / "video"
    outdir.mkdir(parents=True, exist_ok=True)
    npz = outdir / f"{name}_gemx.npz"
    np.savez(npz, local_rot_mats=rots, root_positions=root, fps=np.float32(30))
    from soma_to_bvh import convert
    info = convert(str(npz), str(outdir / f"{name}_gemx.bvh"), match_body=False)
    meta = {"segment": name, "clip": clip, "frames_30fps": [a, b], "seconds": [a / 30, b / 30],
            "feeds": feeds, "note": note, "start_yaw_removed_deg": round(yaw0, 1), **info}
    (outdir / f"{name}_gemx.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    print("CUT", json.dumps(meta))
    return npz


def pick_keys(P, names, min_gap=6):
    """Frames where the mean wrist speed hits a local minimum (pose extremes), plus first/last."""
    w = (P[:, names.index("LeftHand")] + P[:, names.index("RightHand")]) / 2
    sp = np.linalg.norm(np.gradient(w, axis=0), axis=-1)
    k = np.ones(5) / 5
    sp = np.convolve(np.pad(sp, 2, mode="edge"), k, mode="valid")
    cand = [i for i in range(2, len(sp) - 2) if sp[i] <= sp[i - 1] and sp[i] <= sp[i + 1]
            and sp[i] < np.percentile(sp, 60)]
    keys = [0]
    for c in cand:
        if c - keys[-1] >= min_gap:
            keys.append(c)
    if len(sp) - 1 - keys[-1] < min_gap:
        keys.pop()
    keys.append(len(sp) - 1)
    return keys


def rekey(name, raw, samples, seed, factors=(1.0, 0.6)):
    from kimodo.geometry import matrix_to_axis_angle
    from kimodo.skeleton import SOMASkeleton30
    npz = raw / "video" / f"{name}_gemx.npz"
    d = np.load(npz)
    rots, root = d["local_rot_mats"], d["root_positions"]
    P, names, _ = fk77(rots, root)
    keys = pick_keys(P, names)
    s30 = SOMASkeleton30()
    r30 = s30.from_SOMASkeleton77(torch.from_numpy(rots).float())
    aa = matrix_to_axis_angle(r30)
    results = []
    for fac in factors:
        new = [0]
        for i in range(1, len(keys)):
            new.append(new[-1] + max(2, int(round((keys[i] - keys[i - 1]) * fac))))
        total = new[-1] + 1
        if total > 300:
            print(f"SKIP {name} x{fac}: {total} frames > 300")
            continue
        # root path: resample the captured hips XZ onto the new timeline
        tt = np.interp(np.arange(total), new, keys)
        xz = np.stack([np.interp(tt, np.arange(len(root)), root[:, 0]), np.interp(tt, np.arange(len(root)), root[:, 2])], -1)
        keyed = set(new)
        entries = [{"type": "fullbody", "frame_indices": new, "local_joints_rot": aa[keys].tolist(),
                    "root_positions": root[keys].tolist()},
                   {"type": "root2d", "frame_indices": [i for i in range(total) if i not in keyed],
                    "smooth_root_2d": [xz[i].tolist() for i in range(total) if i not in keyed]}]
        cdir = raw / "_constraints"
        cdir.mkdir(parents=True, exist_ok=True)
        stem = f"{name}_kimodo_x{fac:.1f}"
        cpath = cdir / f"video_{stem}.json"
        cpath.write_text(json.dumps(entries), encoding="utf-8")
        (cdir / f"video_{stem}.meta.json").write_text(json.dumps(
            {"segment": name, "factor": fac, "source_key_frames": keys, "new_key_frames": new, "frames": total},
            indent=1), encoding="utf-8")
        out = raw / "video" / f"{stem}_s{seed}"
        cmd = [KIMODO_PY, str(HERE / "kimodo_gen.py"), "--constraints", str(cpath), "--frames", str(total),
               "--samples", str(samples), "--seed", str(seed), "--out", str(out)]
        r = subprocess.run(cmd, capture_output=True, text=True)
        line = [l for l in r.stdout.splitlines() if l.startswith("KIMODO_GEN")]
        if r.returncode or not line:
            print(f"FAIL {stem}\n{r.stdout[-800:]}\n{r.stderr[-2000:]}")
            continue
        rep = json.loads(line[0][len("KIMODO_GEN "):])
        print(f"REKEY {stem}: {len(keys)} keys, {total} frames, err {rep.get('constraint_error_cm')}")
        results.append(stem)
    return results


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("cmd", choices=("cut", "rekey"))
    p.add_argument("segments", nargs="*")
    p.add_argument("--raw", default=str(RAW))
    p.add_argument("--samples", type=int, default=2)
    p.add_argument("--seed", type=int, default=1)
    a = p.parse_args()
    raw = Path(a.raw)
    for n in a.segments or list(SEGMENTS):
        if a.cmd == "cut":
            cut(n, raw)
        else:
            rekey(n, raw, a.samples, a.seed)


if __name__ == "__main__":
    main()
