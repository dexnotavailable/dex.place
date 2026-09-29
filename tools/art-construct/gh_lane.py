"""Glaive-hands lane: the stills loop on a lane build (idle hero, N1 contact, Q stamp, N2 back view; 144 + 80 px).

  python tools/art-construct/gh_lane.py --style l2 [--build] [--poses art/rosace/hands/poses] \
      [--out D:/Dex/Projects/dex-place-art/rosace/build/lanes/work/<tag>] [--only idle_hero] [--no-render] [--no-hands]

Steps per still, one Blender at a time:
  0. (--build) build_rosace_v2.py with ROSACE_GLAIVE=<style> -> build/lanes/glaive-hands_<style>.blend
     (never rosace.blend: the lane never writes the canonical file)
  1. gh_render.py: passes + meta.json + landmarks.json from the lane pose file
  2. rosace_post.py --no-face --tag noface
  3. overrides.py build/apply with the canonical ops (face choice, rim, collar-cross glyph) into
     <out>/_layers (art/rosace/overrides is never written; its hand patches are STALE on these renders)
  4. author_hands.py apply: the constructed hands + weapon pixels -> still.png (+ _x3, _x6) and
     hands_layer.png / hands.json (what the lane painted) next to it
"""
import argparse
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
PIPE = os.path.join(REPO, "tools", "pixel-pipeline")
BUILD = r"D:\Dex\Projects\dex-place-art\rosace\build"
LANES = os.path.join(BUILD, "lanes")
STILLS = [
    ("idle_hero", "idle_hero", []),
    ("n1_contact", "n1_contact", []),
    ("q_stamp", "q_stamp", []),
    ("n2_pivot_black", "n2_pivot", ["--thong", "black"]),
]


def run(cmd, label, env=None, quiet=False):
    t = time.time()
    e = dict(os.environ)
    e.update(env or {})
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, encoding="utf-8", errors="replace", env=e)
    out = (r.stdout or "") + (r.stderr or "")
    if r.returncode != 0:
        print(out[-3000:])
        raise SystemExit(f"{label} failed ({r.returncode})")
    keep = [ln for ln in out.splitlines() if any(k in ln for k in ("RENDERED", "STALE", "glyph", "face ", "HANDS", "WARN"))]
    if not quiet:
        print(f"  {label}: {time.time() - t:5.1f} s" + ("".join("\n    " + k for k in keep[:6])))
    return out


def blender(args, label, env=None):
    return run([sys.executable, os.path.join(PIPE, "blender_env.py"), "run", "--python-exit-code", "1"] + args, label, env)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--style", default="l2")
    ap.add_argument("--blend", default=None, help="render this .blend instead of the lane build (read-only)")
    ap.add_argument("--poses", default=os.path.join(REPO, "art", "rosace", "hands", "poses"))
    ap.add_argument("--out", default=None)
    ap.add_argument("--px", default="144,80")
    ap.add_argument("--only", default="")
    ap.add_argument("--build", action="store_true")
    ap.add_argument("--no-render", action="store_true")
    ap.add_argument("--no-hands", action="store_true")
    ap.add_argument("--hands", default=os.path.join(REPO, "art", "rosace", "hands", "poses"),
                    help="folder of hand specs <pose>_<px>.json")
    a = ap.parse_args()
    blend = a.blend or os.path.join(LANES, f"glaive-hands_{a.style}.blend")
    assert os.path.basename(blend) not in ("rosace.blend", "rosace_v1.blend") or not a.build, "lane never builds canon"
    out = os.path.abspath(a.out or os.path.join(LANES, "work", a.style))
    if a.build:
        blender(["--python", os.path.join(PIPE, "build_rosace_v2.py"), "--", "--out", blend], "build",
                {"ROSACE_GLAIVE": a.style})
    stills = [s for s in STILLS if not a.only or s[0] in a.only.split(",")]
    layers = os.path.join(out, "_layers")
    for name, pose, extra in stills:
        pf = os.path.join(a.poses, pose + ".json")
        if not a.no_render:
            blender(["--python", os.path.join(HERE, "gh_render.py"), "--", "--blend", blend, "--pose", pf, "--px", a.px,
                     "--ss", "4", "--out", os.path.join(out, name)] + extra, f"render {name}")
        for px in [int(x) for x in a.px.split(",")]:
            still = os.path.join(out, name, f"px{px}")
            run([sys.executable, os.path.join(PIPE, "rosace_post.py"), "--raw", still, "--no-face", "--tag", "noface"],
                f"post {name} {px}", quiet=True)
            layer = f"{pose}_{px}"
            ops = [] if os.path.exists(os.path.join(REPO, "art", "rosace", "overrides", layer + ".json")) \
                else ["--ops", f"{pose}_144"]
            common = ["--still", still, "--layer", layer, "--layer-dir", layers] + ops
            run([sys.executable, os.path.join(PIPE, "overrides.py"), "build"] + common, f"layer {layer}", quiet=True)
            run([sys.executable, os.path.join(PIPE, "overrides.py"), "apply"] + common + ["--tag", "base"],
                f"apply {name} {px}", quiet=True)
            if not a.no_hands:
                spec = os.path.join(a.hands, f"{pose}_{px}.json")
                run([sys.executable, os.path.join(PIPE, "author_hands.py"), "apply", "--still", still, "--spec", spec],
                    f"hands {name} {px}")
    json.dump({"blend": blend, "style": a.style, "poses": a.poses, "hands": a.hands}, open(os.path.join(out, "_lane.json"), "w"),
              indent=1)
    print("stills in", out)


if __name__ == "__main__":
    main()
