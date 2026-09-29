"""Drive 9 measures: the combined build against the current build and the three route picks, on the numbers the
finish-routes judges named (colour count, HSV saturation, the low-key share V < 0.35, outline ring, tones per
material, mass = body area / H^2 with the glaive out, head / H).

  python tools/pixel-pipeline/drive9/d9_metrics.py [--d9 <raw>/<key>] [--tag D1] [--out <json>]
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PIPE))
sys.path.insert(0, os.path.join(PIPE, "finish_judge"))
sys.path.insert(0, os.path.join(PIPE, "finish_f3"))
import judge_sheets as JS  # noqa: E402
import sheets_f3 as F3S  # noqa: E402
FM = F3S.FM

BUILD = JS.BUILD


def entry_dir(e, s, px, d9root, tag):
    if e == "d9":
        return os.path.join(d9root, s, f"px{px}", tag)
    return JS.still_dir(e, s, px)


def hsv(rgb):
    r, g, b = [rgb[:, i] / 255.0 for i in range(3)]
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    return np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-9), 0), mx


def measure(d):
    rgb, fg, mat, part = FM.load(d)
    px = rgb[fg].astype(float)
    S, V = hsv(px)
    m = F3S.measure(d)
    meta = json.load(open(os.path.join(d, "meta.json")))
    byid = {v["id"]: k for k, v in meta["materials"].items()}
    tones = {}
    for mid in np.unique(mat[fg]):
        sel = fg & (mat == mid)
        if sel.sum() >= 20:
            tones[byid.get(int(mid), str(mid))] = int(len(np.unique(rgb[sel], axis=0)))
    ring = np.zeros_like(fg)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        ring |= ~np.roll(np.roll(fg, dy, 0), dx, 1)
    ring &= fg
    rv = hsv(rgb[ring].astype(float))[1]
    return {"colours": int(len(np.unique(px, axis=0))), "S_mean": round(float(S.mean()), 3),
            "S_median": round(float(np.median(S)), 3), "V_lt_035": round(float((V < 0.35).mean()), 3),
            "chromatic": round(float(((S > 0.15) & (V > 0.15)).mean()), 3),
            "edge_dark": round(float((rv < 0.2).mean()), 3), "mass": m["mass"], "bbox_fill": m["bbox_fill"],
            "tones": tones}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--d9", default=os.path.join(BUILD, "lanes", "drive9", "raw", "H110"))
    ap.add_argument("--tag", default="D1")
    ap.add_argument("--out", default=os.path.join(BUILD, "lanes", "drive9", "metrics.json"))
    a = ap.parse_args()
    res = {"_doc": __doc__.strip().splitlines()[0], "d9_root": a.d9, "tag": a.tag}
    print(f"{'entry':8}{'still':6}{'px':>4}{'cols':>6}{'S_mean':>8}{'S_med':>7}{'V<.35':>7}{'chrom':>7}{'edgeD':>7}{'mass':>7}")
    for s in ("idle", "n1", "back"):
        for px in (144, 80):
            for e in ("current", "F1", "F2", "F3", "d9"):
                d = entry_dir(e, s, px, a.d9, a.tag)
                if not os.path.exists(os.path.join(d, "still.png")):
                    continue
                r = measure(d)
                res.setdefault(e, {})[f"{s}_{px}"] = r
                print(f"{e:8}{s:6}{px:>4}{r['colours']:>6}{r['S_mean']:>8}{r['S_median']:>7}{r['V_lt_035']:>7}"
                      f"{r['chromatic']:>7}{r['edge_dark']:>7}{r['mass']:>7}")
    for px in (144, 80):
        d = entry_dir("d9", "q", px, a.d9, a.tag)
        if os.path.exists(os.path.join(d, "still.png")):
            res.setdefault("d9", {})[f"q_{px}"] = measure(d)
    json.dump(res, open(a.out, "w"), indent=1)
    print("tones d9 idle 144:", res["d9"]["idle_144"]["tones"])
    print("tones current idle 144:", res["current"]["idle_144"]["tones"])


if __name__ == "__main__":
    main()
