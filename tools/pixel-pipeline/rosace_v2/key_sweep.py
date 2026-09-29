"""Body-key sweep for the v2 base (plain Python; runs Blender one variant at a time).

Each variant is a bare, AO-free, glaive-free build (build_rosace_v2.py --bare --keys --leg-stretch)
into <out>/<name>.blend, then base_search.py --no-render measures body + head_skin at 144 and 80 px.
Prints one table row per variant and writes <out>/sweep.json. Used for the Adopt fixes
(PIPELINE.md 3.6e): bust depth, waist/hip, thigh width, leg length.

  python tools/pixel-pipeline/rosace_v2/key_sweep.py --out D:/Dex/Projects/dex-place-art/rosace/build/scratch/sweep \
      --variants variants.json        # {"name": {"keys": {...}, "leg": 1.28}, ...}
"""
import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COLS = ("heads_tall", "leg_ratio", "waist_to_hip")
PX = ("crotch_to_sole", "shoulder_width", "bust_width", "bust_depth", "waist_width", "hip_width",
      "thigh_top_width")


def run(args):
    r = subprocess.run([sys.executable, os.path.join(HERE, "blender_env.py"), "run"] + args,
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        print(r.stdout[-3000:], r.stderr[-3000:])
        raise SystemExit(f"blender failed: {args[:3]}")
    return r.stdout


def measure(out, name, variant):
    blend = os.path.join(out, name + ".blend")
    b = ["--python", os.path.join(HERE, "build_rosace_v2.py"), "--", "--bare", "--no-ao", "--no-glaive",
         "--out", blend, "--keys", json.dumps(variant["keys"])]
    if variant.get("leg"):
        b += ["--leg-stretch", str(variant["leg"])]
    if variant.get("torso"):
        b += ["--torso-k", str(variant["torso"])]
    if variant.get("pinch"):
        b += ["--pinch", json.dumps(variant["pinch"])]
    run(b)
    mdir = os.path.join(out, name)
    run(["--python", os.path.join(HERE, "base_search.py"), "--", "--src", blend, "--name", name,
         "--out", mdir, "--keep", "^(body|head_skin)$", "--no-render", "--px-heights", "144,80"])
    m = json.load(open(os.path.join(mdir, "measure.json"), encoding="utf-8"))["measure"]
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--variants", required=True)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    variants = json.load(open(a.variants, encoding="utf-8"))
    path = os.path.join(a.out, "sweep.json")
    res = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    print("| name | " + " | ".join(COLS + PX) + " |")
    for name, v in variants.items():
        m = measure(a.out, name, v)
        p = m["at_144px"]
        res[name] = {"variant": v, "measure": {k: m.get(k) for k in COLS}, "at_144px": p, "at_80px": m["at_80px"]}
        row = [f"{m.get(k):.3f}" for k in COLS] + [str(p.get(k)) for k in PX]
        print(f"| {name} | " + " | ".join(row) + " |", flush=True)
        json.dump(res, open(path, "w", encoding="utf-8"), indent=1)


if __name__ == "__main__":
    main()
