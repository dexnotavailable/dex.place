"""Per-material palette statistics of a post-processed Rosace sprite (uses <tag>_id.png).

  python rosace_check.py <dir-with-sprite.png> [--tag sprite]
Prints, per material, how its pixels split over palette codes, and the DESIGN.md checks:
hair share in I1/I2 (>= 1/3), colours used (<= 29), off-palette pixels (0).
"""
import json
import os
import sys

import numpy as np
from PIL import Image

d = sys.argv[1]
tag = sys.argv[sys.argv.index("--tag") + 1] if "--tag" in sys.argv else "sprite"
meta = json.load(open(os.path.join(d, "meta.json")))
img = np.asarray(Image.open(os.path.join(d, f"{tag}.png")).convert("RGBA"))
idm = np.asarray(Image.open(os.path.join(d, f"{tag}_id.png")).convert("RGBA"))
inv = {tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)): k for k, v in meta["colors"].items()}
byid = {m["id"]: n for n, m in meta["materials"].items()}
out = {}
for mid, name in sorted(byid.items()):
    sel = (idm[..., 3] > 0) & (idm[..., 0] == mid)
    if not sel.any():
        continue
    cnt = {}
    for c in map(tuple, img[sel, :3]):
        k = inv.get(c, "off")
        cnt[k] = cnt.get(k, 0) + 1
    out[name] = dict(sorted(cnt.items(), key=lambda t: -t[1]))
    print(f"{name:10s} {int(sel.sum()):5d}  " + "  ".join(f"{k}:{v}" for k, v in out[name].items()))
hair = {}
for n in ("hair", "hairtip"):
    for k, v in out.get(n, {}).items():
        hair[k] = hair.get(k, 0) + v
tot = sum(hair.values()) or 1
light = (hair.get("I1", 0) + hair.get("I2", 0) + hair.get("I0", 0)) / tot
allc = {inv.get(tuple(c), "off") for c in img[img[..., 3] > 0, :3]}
print(f"hair share in I0-I2: {light:.2f} (DESIGN: >= 0.33)   colours used: {len(allc)}   off-palette: {'off' in allc}")
