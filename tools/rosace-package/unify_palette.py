"""Rosace packaging: one palette per material across every frame of a size.

The drive-9 finish quantises each still on its own (per-material k-means over that frame's colours), which is right for
a still but makes a material's tones drift from drawing to drawing, which reads as colour shimmer in motion. This
step takes every finished frame of a size, runs the same per-material k-means (same tone counts as r2_finish.json:
tones + 3 in-between colours, reps = real rendered colours) once over ALL frames' pixels, and snaps each frame's pixels
to that global set. Ink (outline ring, inner lines, face, rim selects) is left untouched. frame.png is overwritten;
the per-frame result is kept as frame_perframe.png.

  python tools/rosace-package/unify_palette.py --raw <dir> [--px 144,80]
"""
import argparse
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image

PIPE = os.environ.get("ROSACE_PIPE", r"D:\Dex\Projects\dex.place\tools\pixel-pipeline")
SRC_REPO = os.path.dirname(os.path.dirname(PIPE))
sys.path.insert(0, os.path.join(PIPE, "drive9"))
sys.dont_write_bytecode = True
import d9_post as D9  # noqa: E402

F1 = D9.F1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True)
    ap.add_argument("--px", default="144,80")
    ap.add_argument("--extra", type=int, default=3)
    a = ap.parse_args()
    promoted = json.load(open(os.path.join(SRC_REPO, "art", "rosace", "drive9.json"), encoding="utf-8"))["promoted"]
    FIN = D9.load_finish(os.path.join(SRC_REPO, promoted["finish"]))
    keys = sorted(k for k in os.listdir(a.raw) if os.path.isdir(os.path.join(a.raw, k)))
    for px in a.px.split(","):
        frames = []
        for k in keys:
            d = os.path.join(a.raw, k, f"px{px}")
            if not os.path.exists(os.path.join(d, "frame_layers.npz")):
                continue
            if os.path.exists(os.path.join(d, "frame_perframe.png")):
                shutil.copyfile(os.path.join(d, "frame_perframe.png"), os.path.join(d, "frame.png"))      # idempotent
            img = np.asarray(Image.open(os.path.join(d, "frame.png")).convert("RGBA")).copy()
            L = np.load(os.path.join(d, "frame_layers.npz"))
            names = {int(i): n for i, n in json.load(open(os.path.join(d, "frame_materials.json"))).items()}
            frames.append((d, img, L["mat"], L["protect"], names))
        if not frames:
            continue
        names = frames[0][4]
        changed = 0
        for mid, name in names.items():
            mc = FIN["materials"].get(name)
            if mc is None:
                continue
            cols = []
            for d, img, mat, prot, _ in frames:
                m = (img[..., 3] > 0) & (mat == mid) & ~prot
                if m.any():
                    cols.append(img[m][:, :3])
            if not cols:
                continue
            allc = np.concatenate(cols).astype(np.int32)
            uq, inv, cnt = np.unique(allc, axis=0, return_inverse=True, return_counts=True)
            kk = int(mc["tones"]) + a.extra
            if len(uq) <= kk:
                continue
            X = D9.oklab(uq)
            C = F1.kmeans(X, cnt.astype(np.float64), kk)
            lab = ((X[:, None, :] - C[None]) ** 2).sum(-1).argmin(1)
            reps = []
            for j in range(len(C)):
                mm = lab == j
                if mm.any():
                    reps.append(uq[mm][np.argmin(((X[mm] - C[j]) ** 2).sum(-1))])
            reps = np.array(reps, dtype=np.float64)
            RX = D9.oklab(reps)
            for d, img, mat, prot, _ in frames:
                m = (img[..., 3] > 0) & (mat == mid) & ~prot
                if not m.any():
                    continue
                px_ = img[m][:, :3].astype(np.int32)
                u, iv = np.unique(px_, axis=0, return_inverse=True)
                idx = ((D9.oklab(u)[:, None, :] - RX[None]) ** 2).sum(-1).argmin(1)
                new = np.round(reps[idx]).astype(np.uint8)[iv.ravel()]
                img[m, :3] = new
                changed += int((new != px_.astype(np.uint8)).any(-1).sum())
        tot = set()
        for d, img, mat, prot, _ in frames:
            shutil.copyfile(os.path.join(d, "frame.png"), os.path.join(d, "frame_perframe.png"))
            Image.fromarray(img, "RGBA").save(os.path.join(d, "frame.png"))
            tot |= set(map(tuple, np.unique(img[img[..., 3] > 0][:, :3], axis=0)))
        print(f"px{px}: {len(frames)} frames, {changed} pixels re-snapped, {len(tot)} distinct colours across the set", flush=True)


if __name__ == "__main__":
    main()
