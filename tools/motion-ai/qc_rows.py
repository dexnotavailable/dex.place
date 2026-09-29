"""Print QC rows from previews/<move>/summary.json for stems matching any given substring."""
import json, sys
from pathlib import Path
PREV = Path(r"D:\Dex\Projects\dex.place\review\motion\previews")
mv, pats = sys.argv[1], sys.argv[2:]
for r in json.loads((PREV / mv / "summary.json").read_text(encoding="utf-8")):
    if pats and not any(p in r["stem"] for p in pats):
        continue
    wr = max((v[1] for v in r["wrist_deg_max_p95"].values()), default=0)
    print(f"{r['score']:6.1f} {r['stem']:38s} {r['frames']:3d}f key {r['key_err_cm_mean_max']} slide {r['foot_slide_cm_s']} "
          f"jit {r['jitter_cm']:.2f} pops {r.get('pops')}@{r.get('pop_frames')[:4]} w95 {wr:.0f} 2h {r.get('two_hand_share')} "
          f"yawR {r.get('yaw_deg_range')} floor {r['floor_cm']} hipsY {r['hips_y_cm_min_max']}")
