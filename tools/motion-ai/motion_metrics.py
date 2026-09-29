"""Pixel-level motion metrics on rendered clips (system Python: numpy + Pillow).

  python tools/motion-ai/motion_metrics.py            # N1 and N5: round-1 retimed, round 2, spike -> JSON

Definitions (the same code measures every clip, so the numbers compare):
  pixel change   pixels whose RGBA differs between two consecutive shown images of one clip (same
                 canvas and anchor within a clip; transparent vs transparent counts as equal)
  anticipation   the changes at each new BODY drawing in the anticipation phase (cloth-only redraws on
                 holds are secondary motion, reported apart). N1: A1, A2, A3 (f1, f3, f6). N5: A1, A2,
                 A3, A4 (f1, f5, f9, f23). Spike (on ones): f1-f9.
  strike         the changes at the strike drawings, contact included. N1: S1, C1 (f8, f9). N5: S1, S2,
                 S3, C1 (f27-f30). Spike: f10-f12.
  ratio          mean(strike) / mean(anticipation)                      ("phase ratio")
  entry_ratio    change at the first strike drawing / change at the last shown step before it. This is
                 the round-1 critics' measure: it reproduces their spike 5.4:1 (8855 / 1642 px) and
                 round-1 retimed N1 ~1.2:1. entry_ratio_body uses the last BODY drawing step (cloth-only
                 redraws skipped), the stricter form.
  silhouette_*   the same ratios on the silhouette only (alpha XOR), which does not saturate on shading
  span_contact_H the contact image's opaque horizontal extent / 144 px (H at the 144 px render)
  body_only      round 3: the same on the body-only images (smear.py keeps sprite_####_body.png), so
                 the smear's own pixels can be told apart from the body's spacing
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
REN = Path(r"D:\Dex\Projects\dex-place-art\rosace\motion-ai\renders")
SPIKE = REPO / "review" / "motion" / "ab" / "_c_spike"
H_PX = 144

PHASES = {
    "n1": {"anticipation": [1, 3, 6], "strike": [8, 9], "contact": 9},
    "n5": {"anticipation": [1, 5, 9, 23], "strike": [27, 28, 29, 30], "contact": 30},
    "spike": {"anticipation": list(range(1, 10)), "strike": [10, 11, 12], "contact": 12},
}


def load_rosace(name, px=144, body_only=False):
    """body_only: use smear.py's body-only copies (sprite_####_body.png) where a drawing has a smear"""
    d = REN / name / f"px{px}"
    meta = json.loads((d / "meta.json").read_text())
    disp = meta["motion"]["sample_frame"]
    body = meta["motion"].get("body_sample_frame", disp)
    cache = {}
    for s in set(disp):
        p = d / f"sprite_{s:04d}_body.png"
        cache[s] = np.array(Image.open(p if body_only and p.exists() else d / f"sprite_{s:04d}.png").convert("RGBA"))
    return {"disp": disp, "body": body, "img": cache, "meta": meta}


def load_spike():
    meta = json.loads((SPIKE / "meta_px144_ss4.json").read_text())
    fr = meta["frames"]
    img = {f: np.array(Image.open(SPIKE / "out" / f"final_{f:04d}.png").convert("RGBA")) for f in fr}
    return {"disp": fr, "body": fr, "img": img, "meta": meta}


def change(a, b):
    ta, tb = a[..., 3] == 0, b[..., 3] == 0
    diff = np.any(a != b, axis=-1) & ~(ta & tb)
    return int(diff.sum())


def span(im):
    cols = np.where(im[..., 3].max(0) > 0)[0]
    return (int(cols.max() - cols.min() + 1) if len(cols) else 0)


def silhouette_change(a, b):
    return int(((a[..., 3] > 0) != (b[..., 3] > 0)).sum())


def clip_metrics(c, ph, fn=None):
    fn = fn or change
    disp, body, img = c["disp"], c["body"], c["img"]
    F = len(disp)
    per = {}
    for f in range(1, F):
        if disp[f] != disp[f - 1]:
            per[f] = {"px": fn(img[disp[f - 1]], img[disp[f]]), "body": body[f] != body[f - 1]}
    ant = [per[f]["px"] for f in ph["anticipation"] if f in per]
    stk = [per[f]["px"] for f in ph["strike"] if f in per]
    cloth = [v["px"] for f, v in per.items() if not v["body"]]
    s0 = ph["strike"][0]
    before = [f for f in per if f < s0]
    before_body = [f for f in before if per[f]["body"]]
    entry = round(per[s0]["px"] / max(1, per[before[-1]]["px"]), 2) if before and s0 in per else None
    entry_b = round(per[s0]["px"] / max(1, per[before_body[-1]]["px"]), 2) if before_body and s0 in per else None
    sc = span(img[disp[ph["contact"]]])
    peak = max(span(img[disp[f]]) for f in ph["strike"])
    return {
        "anticipation_px": ant, "strike_px": stk,
        "ratio": round(float(np.mean(stk)) / max(1.0, float(np.mean(ant))), 2) if ant and stk else None,
        "ratio_max_strike_vs_mean_ant": round(max(stk) / max(1.0, float(np.mean(ant))), 2) if ant and stk else None,
        "entry_ratio": entry, "entry_step": before[-1] if before else None,
        "entry_ratio_body": entry_b, "entry_step_body": before_body[-1] if before_body else None,
        "span_contact_px": sc, "span_contact_H": round(sc / H_PX, 2),
        "span_strike_peak_H": round(peak / H_PX, 2),
        "cloth_only_redraws": len(cloth), "cloth_only_px_median": int(np.median(cloth)) if cloth else 0,
        "changes": {str(f): v for f, v in per.items()},
    }


def main(moves=None):
    moves = moves or [a for a in sys.argv[1:] if not a.startswith("-")] or ["n1", "n5"]
    out = {}
    for m in moves:
        out[m] = {}
        for label, name in (("r1_retimed", m), ("r2", f"{m}_r2")):
            if (REN / name / "px144" / "meta.json").exists():
                c = load_rosace(name)
                out[m][label] = clip_metrics(c, PHASES[m])
                out[m][label]["silhouette"] = clip_metrics(c, PHASES[m], silhouette_change)
        c = load_spike()
        out[m]["spike"] = clip_metrics(c, PHASES["spike"])
        out[m]["spike"]["silhouette"] = clip_metrics(c, PHASES["spike"], silhouette_change)
        for k, v in out[m].items():
            sv = v["silhouette"]
            print(f"{m} {k:10s} entry {v['entry_ratio']} (body {v['entry_ratio_body']}) phase {v['ratio']} | "
                  f"silhouette entry {sv['entry_ratio']} (body {sv['entry_ratio_body']}) phase {sv['ratio']} | "
                  f"span@contact {v['span_contact_H']} H | ant {v['anticipation_px']} strike {v['strike_px']}")
    return out


if __name__ == "__main__":
    res = main()
    p = REPO / "review" / "motion" / "r2" / "_authoring" / "metrics_latest.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(res, indent=1))
