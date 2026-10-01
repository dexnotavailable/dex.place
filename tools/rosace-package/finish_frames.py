"""Rosace packaging, pixel side: run the promoted drive-9 round-2 finish on every rendered frame, and write the
normal map the dex.sprite/1 contract wants next to each albedo.

  python tools/rosace-package/finish_frames.py --raw <dir of <key>/px<N>/> [--px 144,80] [--keys a,b] [--tag R2]

The finish is tools/pixel-pipeline/drive9/d9_post.py `process` (read-only, run with art/rosace/drive9.json 'promoted'
finish = drive9/r2_finish.json, preset D1 -- exactly stills_v2.py's step 3), unchanged: its own source is patched at
import time only to hand back the arrays it already computes (downsampled normals, the outline ring, inner lines), so
the pixels are the promoted chain's pixels. Outputs per frame, in <raw>/<key>/px<N>/:
  frame.png         the finished sprite (RGBA, figure only; the still without the ground shadow)
  frame_n.png       normals: r = x right, g = y down, b = toward the viewer, alpha 255 on lit surface and 0 on ink
                    (the outline ring and inner lines), as docs/character/RUNTIME-CONTRACT.md asks
  frame_meta.json   pivot (px, from the top-left of frame.png), export anchors, canvas, stats
No image generation anywhere: numpy on our own render passes.
"""
import argparse
import inspect
import json
import os
import re
import sys

import numpy as np
from PIL import Image

PIPE = os.environ.get("ROSACE_PIPE", r"D:\Dex\Projects\dex.place\tools\pixel-pipeline")
SRC_REPO = os.path.dirname(os.path.dirname(PIPE))
D9DIR = os.path.join(PIPE, "drive9")
sys.path.insert(0, D9DIR)
sys.dont_write_bytecode = True
import d9_post as D9  # noqa: E402

CAPTURE = {}


def patched_process():
    """d9_post.process with one added line that copies out the arrays the normal map needs."""
    src = inspect.getsource(D9.process)
    marker = "    o8 = np.clip(np.round(out), 0, 255).astype(np.uint8)\n"
    assert src.count(marker) == 1, "d9_post.process changed shape; update the capture hook"
    hook = "    _CAPTURE.update(n2=n2, ring=ring, ln=ln, alpha=alpha, rsel=rsel, mat=mat, keep=keep, byid=byid)\n"
    src = src.replace(marker, hook + marker)
    ns = D9.__dict__
    ns["_CAPTURE"] = CAPTURE
    exec(compile(src, D9.__file__ + "#process", "exec"), ns)
    return ns["process"]


def finish_one(process, FIN, raw, tag):
    CAPTURE.clear()
    rep = process(raw, FIN, "D1", tag, True)
    still = np.asarray(Image.open(os.path.join(raw, tag, "still.png")).convert("RGBA"))
    n2, ring, ln = CAPTURE["n2"], CAPTURE["ring"], CAPTURE["ln"]
    H, W = still.shape[:2]
    a = still[..., 3] > 0
    n = np.array(n2, dtype=np.float64)
    L = np.linalg.norm(n, axis=-1, keepdims=True)
    flat = L[..., 0] < 1e-6
    n = np.where(L > 1e-6, n / np.maximum(L, 1e-6), np.array([0.0, 0.0, 1.0]))
    n[..., 1] *= -1.0                                  # Blender camera y is up; the contract's g is y DOWN
    enc = np.clip(np.round((n * 0.5 + 0.5) * 255), 0, 255).astype(np.uint8)
    ink = (ring | ln) | flat
    lit = a & ~ink
    nrm = np.zeros((H, W, 4), np.uint8)
    nrm[lit, :3] = enc[lit]
    nrm[lit, 3] = 255
    np.savez_compressed(os.path.join(raw, "frame_layers.npz"), mat=CAPTURE["mat"].astype(np.uint8),
                        protect=(CAPTURE["keep"] | ring | ln | CAPTURE["rsel"]))
    json.dump({str(k): v for k, v in CAPTURE["byid"].items()}, open(os.path.join(raw, "frame_materials.json"), "w"))
    Image.fromarray(still, "RGBA").save(os.path.join(raw, "frame.png"))
    Image.fromarray(nrm, "RGBA").save(os.path.join(raw, "frame_n.png"))
    meta = json.load(open(os.path.join(raw, "meta.json")))
    ss = int(meta["ss"])
    info = {"pivot": meta["anchor"], "canvas": [W, H], "anchors": meta.get("export_anchors", {}),
            "stand_in_key": meta.get("stand_in_key"), "px": meta["px"], "yaw": meta["yaw"], "elev": meta["elev"],
            "colours": rep["colours"], "expr": rep["expr"], "ink_px": int((a & ink).sum()), "lit_px": int(lit.sum())}
    json.dump(info, open(os.path.join(raw, "frame_meta.json"), "w"), indent=1)
    return info


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True)
    ap.add_argument("--px", default="144,80")
    ap.add_argument("--keys", default="")
    ap.add_argument("--tag", default="R2")
    a = ap.parse_args()
    promoted = json.load(open(os.path.join(SRC_REPO, "art", "rosace", "drive9.json"), encoding="utf-8"))["promoted"]
    FIN = D9.load_finish(os.path.join(SRC_REPO, promoted["finish"]))
    process = patched_process()
    want = set(k for k in a.keys.split(",") if k)
    for key in sorted(os.listdir(a.raw)):
        kd = os.path.join(a.raw, key)
        if not os.path.isdir(kd) or (want and key not in want):
            continue
        for px in a.px.split(","):
            raw = os.path.join(kd, f"px{px}")
            if not os.path.exists(os.path.join(raw, "meta.json")):
                continue
            info = finish_one(process, FIN, raw, a.tag)
            print(f"finished {key} {px}: colours {info['colours']} lit {info['lit_px']} ink {info['ink_px']}", flush=True)


if __name__ == "__main__":
    main()
