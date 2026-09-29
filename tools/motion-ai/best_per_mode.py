"""Print the best-scored BVH per (tempo, mode) for a move, from previews/<move>/summary.json."""
import json, re, sys
from pathlib import Path
PREV = Path(r"D:\Dex\Projects\dex.place\review\motion\previews")
mv = sys.argv[1]
rows = json.loads((PREV / mv / "summary.json").read_text(encoding="utf-8"))
best = {}
for r in rows:
    m = re.match(r".*_(study|game)_(\w+?)_s\d", r["stem"]) or re.match(r"(.*?)_(gemx|kimodo_x[\d.]+)", r["stem"])
    best.setdefault(m.group(1) + "_" + m.group(2) if m else r["stem"], r)
for k, r in best.items():
    print(r["bvh"])
