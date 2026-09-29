"""Read categorical limb IDs and grip diagnostics from the new hand trial.

This never paints pixels or attributes finished RGB to material families. Raw
projected skin/limb visibility is geometry evidence; finger anatomy and wrist
seams still require viewing the actual finished sprite.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

PIPE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPE / "finish_f1"))
import f1_post as F1  # noqa: E402


def measure(raw):
    raw = raw.resolve()
    if not (PIPE.parents[1] / "review/rosace/art/next").resolve() in raw.parents:
        raise ValueError("write diagnostics only in this lane's ignored trial tree")
    grips = json.loads((raw / "haft_grips.json").read_text(encoding="utf-8"))
    if "hand_trial" not in grips:
        raise ValueError("instrumented hand trial provenance is required")
    meta = json.loads((raw / "meta.json").read_text(encoding="utf-8"))
    ids = np.asarray(Image.open(raw / "id.png").convert("RGBA"))
    limb_hi = np.asarray(Image.open(raw / "depth2.png").convert("RGBA"))[..., 2]
    if limb_hi.shape != ids.shape[:2]:
        raise ValueError("limb and material pass dimensions differ")
    zero_color = np.zeros(ids.shape, float)
    zero_normal = np.zeros((*ids.shape[:2], 3), float)
    zero_depth = np.zeros(ids.shape[:2], float)
    alpha, mat, part = F1.downsample(meta, ids, zero_color, zero_normal, zero_depth, 0.0)[:3]
    height, width = alpha.shape
    ss = int(meta["ss"])
    limb = np.zeros_like(mat)
    valid_values = set(range(26))
    for y in range(height):
        for x in range(width):
            if not alpha[y, x]:
                continue
            block = ids[y * ss:(y + 1) * ss, x * ss:(x + 1) * ss]
            values = limb_hi[y * ss:(y + 1) * ss, x * ss:(x + 1) * ss]
            match = (block[..., 3] > 0) & (block[..., 0] == mat[y, x]) & (block[..., 1] == part[y, x])
            labels = values[match]
            if len(labels):
                unique, counts = np.unique(labels, return_counts=True)
                selected = int(unique[np.argmax(counts)])
                if selected not in valid_values:
                    raise ValueError(f"unexpected raw categorical limb ID {selected}")
                limb[y, x] = selected
    if not np.any(np.isin(limb, (14, 15))):
        raise ValueError("no hand limb IDs visible; missing limb attribute cannot count as hand proof")
    skin = meta["materials"]["skin"]["id"]
    hands = {}
    for side, label in (("L", 14), ("R", 15)):
        mask = alpha & (mat == skin) & (limb == label)
        ys, xs = np.nonzero(mask)
        bbox = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1] if len(xs) else None
        hands[side] = {"visible_raw_skin_px": int(mask.sum()), "bbox": bbox,
                       "bbox_size": [bbox[2] - bbox[0], bbox[3] - bbox[1]] if bbox else [0, 0]}
        Image.fromarray(mask.astype(np.uint8) * 255).save(raw / f"visible_hand_{side}.png")
    gaps = {side: row["gap_cm"] for side, row in grips.get("grips", {}).items()}
    result = {"px": meta["px"], "method": "categorical limb mode within chosen material+part; no averaged IDs or RGB inference",
              "hands": hands, "synthetic_grip_gaps_cm": gaps,
              "grip_gap_pass": bool(gaps) and all(value <= 1.5 for value in gaps.values()),
              "hand_trial": grips["hand_trial"],
              "limits": "raw visibility does not prove final anatomy, thumb opposition, seam integrity or haft overlap"}
    (raw / "hand_metrics.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--root", type=Path, required=True)
    p.add_argument("--shots", default="idle")
    args = p.parse_args()
    rows = [measure(args.root / shot / f"px{px}") for shot in args.shots.split(",") for px in (144, 80)]
    print(json.dumps(rows))
    if not all(row["grip_gap_pass"] for row in rows):
        raise SystemExit("synthetic grip gap exceeds1.5cm or no grip record; candidate cannot be accepted")
