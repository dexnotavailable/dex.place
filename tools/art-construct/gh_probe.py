"""Glaive-hands lane: pose thumbnails for the grip (WF-P03 for the weapon and arms).

  python tools/art-construct/gh_probe.py VARIANTS.json [--style l2] [--px 144] [--out DIR] [--sheet PNG]

VARIANTS.json: {"base": "<pose file>", "variants": {"name": {<deep-merged into the pose>}, ...}}
("__del__": [keys] removes keys at that level.) Each variant is written to <out>/<name>.json, rendered
from the lane build (gh_render.py), post-processed, and measured from landmarks.json:
  screen haft angle from vertical, lean away from the torso (GR-P09), each grip's 3D gap (GR-N01),
  grip spacing in px along the haft (GR-P01), the rear hand's distance to the near hip (GR-P04),
  the haft's angle from horizontal and whether its line crosses the pelvis box (GR-N05).
"""
import argparse
import copy
import json
import math
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
PIPE = os.path.join(REPO, "tools", "pixel-pipeline")
LANES = r"D:\Dex\Projects\dex-place-art\rosace\build\lanes"
sys.path.insert(0, HERE)
import gh_view  # noqa: E402


def merge(a, b):
    out = copy.deepcopy(a)
    for k, v in b.items():
        if k == "__del__":
            for kk in v:
                out.pop(kk, None)
        elif isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = merge(out[k], v)
        else:
            out[k] = copy.deepcopy(v)
    return out


def measure(lm):
    J, hf = lm["joints"], lm["haft"]
    b, t = hf["butt"], hf["tip"]
    dx, dy = t[0] - b[0], t[1] - b[1]
    ang_v = math.degrees(math.atan2(abs(dx), abs(dy)))
    ux, uy = dx / math.hypot(dx, dy), dy / math.hypot(dx, dy)
    cl = (J["pit_neck"][0] + J["pelvis_c"][0]) / 2
    away = abs(t[0] - cl) > abs(b[0] - cl)
    g = lm.get("grips", {})
    m = {"ang_v": round(ang_v, 1), "ang_h": round(90 - ang_v, 1), "away": away,
         "gaps": {s: v["gap_cm"] for s, v in g.items()},
         "reach": {s: f'{v["shoulder_to_target_m"]:.2f}/{v["reach_m"]:.2f} (nearest {v["nearest_slide_m"]:+.2f} at {v["nearest_dist_m"]:.2f})' for s, v in g.items()}}
    if len(g) == 2:
        (s1, a1), (s2, a2) = g.items()
        p1, p2 = a1["target"], a2["target"]
        m["spacing_px"] = round(abs((p2[0] - p1[0]) * ux + (p2[1] - p1[1]) * uy), 1)
        near = lm["near"]
        rear = min(g, key=lambda s: (g[s]["target"][0] - b[0]) * ux + (g[s]["target"][1] - b[1]) * uy)
        hip = J[f"hip_{near}"]
        m["rear"] = rear
        m["rear_to_near_hip_px"] = round(math.hypot(g[rear]["target"][0] - hip[0], g[rear]["target"][1] - hip[1]), 1)
    # does the haft line cross the pelvis box (hips +- 4 px, pelvis to the hip joints)?
    xs = [J["hip_L"][0], J["hip_R"][0]]
    ys = [J["hip_L"][1], J["hip_R"][1], J["pelvis_c"][1]]
    x0, x1, y0, y1 = min(xs) - 4, max(xs) + 4, min(ys) - 3, max(ys) + 6
    cross = 0
    L = math.hypot(dx, dy)
    for i in range(int(L)):
        x, y = b[0] + ux * i, b[1] + uy * i
        cross += x0 <= x <= x1 and y0 <= y <= y1
    m["pelvis_px"] = cross
    m["disc_facing"] = hf.get("disc_facing")
    # the torso axis on screen (pelvis -> neck pit) and the haft's angle off it (round 2: Q read as a pole hang)
    tx, ty = J["pit_neck"][0] - J["pelvis_c"][0], J["pit_neck"][1] - J["pelvis_c"][1]
    m["torso_v"] = round(math.degrees(math.atan2(tx, -ty)), 1)
    m["haft_v"] = round(math.degrees(math.atan2(dx if dy < 0 else -dx, abs(dy))), 1)
    m["haft_off_torso"] = round(abs(((m["haft_v"] - m["torso_v"]) + 90) % 180 - 90), 1)
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("variants")
    ap.add_argument("--style", default="l2")
    ap.add_argument("--px", default="144")
    ap.add_argument("--out", default=None)
    ap.add_argument("--sheet", default=None)
    ap.add_argument("--thong", default=None)
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    V = json.load(open(a.variants, encoding="utf-8"))
    base = json.load(open(os.path.join(REPO, V["base"]), encoding="utf-8"))
    tag = os.path.splitext(os.path.basename(a.variants))[0]
    out = a.out or os.path.join(LANES, "work", "probe", tag)
    os.makedirs(out, exist_ok=True)
    blend = os.path.join(LANES, f"glaive-hands_{a.style}.blend")
    res = {}
    imgs = []
    for name, patch in V["variants"].items():
        if a.only and name not in a.only.split(","):
            continue
        P = merge(base, patch)
        pf = os.path.join(out, name + ".json")
        json.dump(P, open(pf, "w", encoding="utf-8"), indent=1)
        cmd = [sys.executable, os.path.join(PIPE, "blender_env.py"), "run", "--python-exit-code", "1", "--python",
               os.path.join(HERE, "gh_render.py"), "--", "--blend", blend, "--pose", pf, "--px", a.px, "--ss", "4",
               "--out", os.path.join(out, name)] + (["--thong", a.thong] if a.thong else [])
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode:
            print(r.stdout[-2000:], r.stderr[-2000:])
            raise SystemExit(name)
        px = a.px.split(",")[0]
        still = os.path.join(out, name, f"px{px}")
        subprocess.run([sys.executable, os.path.join(PIPE, "rosace_post.py"), "--raw", still, "--no-face", "--tag", "noface"],
                       capture_output=True)
        lm = json.load(open(os.path.join(still, "landmarks.json")))
        res[name] = measure(lm)
        print(f"{name:14}", json.dumps(res[name]))
        imgs.append((os.path.join(still, "noface.png"), name))
    json.dump(res, open(os.path.join(out, "_measure.json"), "w"), indent=1)
    if a.sheet and imgs:
        gh_view.tile([p for p, _ in imgs], 3, labels=[n for _, n in imgs]).save(a.sheet)


if __name__ == "__main__":
    main()
