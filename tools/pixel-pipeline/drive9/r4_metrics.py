"""Drive 9 round 4 measures on the figure only (sil.png; round 3's effects left out): colours, mean HSV S, HSV p90
value, the V < 0.35 share, and the round-2 materials critic's horizontal-step shares (flat = equal neighbours, hard =
RGB-sum step > 120), for any set of (raw, tag) stills. Round 3's table (PIPELINE 3.6o) used the same definitions.

  python tools/pixel-pipeline/drive9/r4_metrics.py --set R3=<raw>/R3:R3 --set R4u=<raw>/R4:R4u --set R4=<raw>/R4:R4
      [--out <json>]
"""
import argparse
import colorsys
import json
import os

import numpy as np
from PIL import Image


def measure(d):
    im = np.asarray(Image.open(os.path.join(d, "still.png")).convert("RGBA")).astype(int)
    sil = np.asarray(Image.open(os.path.join(d, "sil.png")).convert("RGBA"))[..., 3] > 0
    px = im[sil][:, :3]
    hsv = np.array([colorsys.rgb_to_hsv(*(p / 255.0)) for p in px])
    s = im[..., :3].sum(-1)
    pair = sil[:, 1:] & sil[:, :-1]
    step = np.abs(s[:, 1:] - s[:, :-1])[pair]
    return {"colours": int(len(np.unique(px, axis=0))), "S_mean": round(float(hsv[:, 1].mean()), 3),
            "p90_value": round(float(np.percentile(hsv[:, 2], 90)), 3),
            "V_lt_035": round(float((hsv[:, 2] < 0.35).mean()), 3),
            "flat_steps": round(float((step == 0).mean()), 3), "hard_steps": round(float((step > 120).mean()), 3)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", action="append", required=True, help="name=<raw>:<tag>")
    ap.add_argument("--shots", default="idle,n1,q,back")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    res = {"_doc": __doc__.strip().splitlines()[0]}
    for st in a.set:
        name, rest = st.split("=", 1)
        raw, tag = rest.rsplit(":", 1)
        res[name] = {}
        for shot in a.shots.split(","):
            for px in (144, 80):
                d = os.path.join(raw, shot, f"px{px}", tag)
                if os.path.exists(os.path.join(d, "still.png")):
                    res[name][f"{shot}_{px}"] = measure(d)
    if a.out:
        json.dump(res, open(a.out, "w"), indent=1)
    for name in res:
        if name.startswith("_"):
            continue
        for k, v in res[name].items():
            print(name, k, v)


if __name__ == "__main__":
    main()
