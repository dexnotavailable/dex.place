"""Glaive-hands lane: run probe poses through the whole lane (render, post, overrides, constructed hands) and the
checker, one candidate at a time, so a pose pick is made on the finished still and the HD / GR rules, not on the
raw probe render.

  python tools/art-construct/gh_cands.py --still n1_contact --probe n1_r2d --names n_s22,o_s26 [--style l4]
      [--rules GR-P05,GR-N05,GR-N02] [--px 144,80]
Each candidate: <work>/cand/<probe>/<name>/ (a poses dir holding the candidate as <pose>.json plus the lane's other
poses, the lane stills, and check.json).
"""
import argparse
import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
LANES = r"D:\Dex\Projects\dex-place-art\rosace\build\lanes"
POSES = os.path.join(REPO, "art", "rosace", "hands", "poses")
POSE_OF = {"idle_hero": "idle_hero", "n1_contact": "n1_contact", "q_stamp": "q_stamp", "n2_pivot_black": "n2_pivot"}

ap = argparse.ArgumentParser()
ap.add_argument("--still", required=True)
ap.add_argument("--probe", required=True)
ap.add_argument("--names", required=True)
ap.add_argument("--style", default="l4")
ap.add_argument("--rules", default="")
ap.add_argument("--px", default="144,80")
a = ap.parse_args()
for name in a.names.split(","):
    d = os.path.join(LANES, "work", "cand", a.probe, name)
    pd = os.path.join(d, "_poses")
    os.makedirs(pd, exist_ok=True)
    for f in os.listdir(POSES):
        if f.endswith(".json"):
            shutil.copy(os.path.join(POSES, f), pd)
    shutil.copy(os.path.join(LANES, "work", "probe", a.probe, name + ".json"), os.path.join(pd, POSE_OF[a.still] + ".json"))
    r = subprocess.run([sys.executable, os.path.join(HERE, "gh_lane.py"), "--style", a.style, "--poses", pd, "--hands", POSES,
                        "--out", d, "--only", a.still, "--px", a.px], capture_output=True, text=True)
    if r.returncode:
        print(r.stdout[-1500:], r.stderr[-1500:])
        raise SystemExit(name)
    r = subprocess.run([sys.executable, os.path.join(HERE, "gh_check.py"), d, "--only", "HD,GR", "--json",
                        os.path.join(d, "check.json"), "--px", a.px], capture_output=True, text=True)
    res = json.load(open(os.path.join(d, "check.json")))
    for key, rr in res.items():
        fails = [r["id"] for r in rr["rules"] if r["status"].startswith("FAIL")
                 and (not a.rules or r["id"] in a.rules.split(","))]
        print(f"{name:12} {key:22} fails: {', '.join(fails) or '-'}")
