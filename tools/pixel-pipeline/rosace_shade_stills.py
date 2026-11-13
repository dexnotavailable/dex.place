"""Shading lane stills: the four key stills at 144 and 80 px through the post-process with a shading
preset, then the other lanes' layers (face stamp, glyphs, hand patches, rim) exactly as stills_v2.py
composites them, then the preset's palette remap last.

  python tools/pixel-pipeline/rosace_shade_stills.py --render            # lane blend -> raw passes
  python tools/pixel-pipeline/rosace_shade_stills.py --variants a,b,c    # post + layers per variant
      [--root D:/Dex/Projects/dex-place-art/rosace/build/lanes/shading/r1] [--px 144,80] [--only idle_hero]

Variant <v> reads art/rosace/overrides/global/shading_r1<v>.json; variant "ctl" is the current
post-process with no shading stage (the control). Outputs <root>/<v>/<still>/px<N>/still.png
(+ _x3 / _x6, noface*, meta.json). The raw passes come from the lane's own blend
(build/lanes/shading.blend, made by rosace_shade_lane.py), never the canonical rosace.blend.

Compositing order (the shading lane owns it; the order the stills get today, made explicit):
  1. render passes (lane blend) -> rosace_post.py: classify, downsample, cleanup, face_flat,
     **shading stage (--shade)**, gold fragments, trim edges, orphans, colour, lines
  2. overrides.py: preface -> face stamp -> glyphs -> per-pose patches (hands, folds, hair) -> rim
  3. **palette remap** (preset "colors"): codes keep their identity through every layer, and only
     the final pixels change hex, so no lane's stamp goes off-palette mid-way
  2b. (round 3) **post_face** (preset "post_face"): the hair's cast shadow on the face skin, after the
     face stamp so the stamp's flat face cannot erase it (rosace_shade.post_face)
  4. (round 2) **ground contact shadow** (preset "ground"): an OL ellipse at ~35% alpha, 1:4, under the
     feet at the render's ground anchor, composited UNDER the figure into still_ground.png. still.png
     stays figure-only (the checkers count its opaque pixels as the figure); the review sheets use
     still_ground.png when it exists.
The preset's "rim_style" (a rim policy JSON, rim.py) is passed to step 2 as $ROSACE_RIM_STYLE, so the
override layer's world rim is drawn the lane's way; without it the rim is today's.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
BUILD = os.environ.get("ROSACE_BUILD", r"D:\Dex\Projects\dex-place-art\rosace\build")
LANE_BLEND = os.path.join(BUILD, "lanes", "shading.blend")
POSES = os.path.join(REPO, "art", "rosace", "poses")
ODIR = os.path.join(REPO, "art", "rosace", "overrides")
GDIR = os.path.join(ODIR, "global")
PALETTE = os.path.join(REPO, "art", "rosace", "palette.json")
STILLS = [
    ("idle_hero", "idle_hero", []),
    ("n1_contact", "n1_contact", []),
    ("q_stamp", "q_stamp", []),
    ("n2_pivot_black", "n2_pivot", ["--thong", "black"]),
]
PASSES = "beauty,albedo,id,normal,depth,light,depth2"


def run(cmd, env=None):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, encoding="utf-8", errors="replace",
                       env=env)
    if r.returncode != 0:
        print((r.stdout or "")[-2000:], (r.stderr or "")[-2000:])
        raise SystemExit(f"failed: {cmd[:3]}")
    return r.stdout


def preset_path(v, rnd):
    return os.path.join(GDIR, f"shading_{rnd}{v}.json")


def remap(path, colors):
    """final palette remap: every pixel of code C takes the preset's hex for C"""
    if not colors:
        return
    pal = json.load(open(PALETTE, encoding="utf-8"))["colors"]
    im = np.array(Image.open(path).convert("RGBA"))
    for code, new in colors.items():
        old = tuple(int(pal[code][i:i + 2], 16) for i in (1, 3, 5))
        nw = [int(new[i:i + 2], 16) for i in (1, 3, 5)]
        m = (im[..., 3] > 0) & (im[..., 0] == old[0]) & (im[..., 1] == old[1]) & (im[..., 2] == old[2])
        im[m, :3] = nw
    Image.fromarray(im).save(path)


def ground(still_dir, spec):
    """contact shadow under the feet (see the module doc): still_ground.png (+ _x3, _x6)"""
    from PIL import ImageDraw
    meta = json.load(open(os.path.join(still_dir, "meta.json")))
    im = Image.open(os.path.join(still_dir, "still.png")).convert("RGBA")
    ids = np.asarray(Image.open(os.path.join(still_dir, "noface_id.png")).convert("RGBA"))
    boot = meta["materials"].get("boot", {}).get("id", 9)
    ys, xs = np.nonzero((ids[..., 0] == boot) & (ids[..., 3] > 0))
    gx, gy = meta["anchor"]
    px = meta["px"]
    if len(xs):
        low = ys >= ys.max() - max(2, int(0.06 * px))       # the soles
        x0, x1 = xs[low].min(), xs[low].max()
    else:
        x0 = x1 = gx
    pad = spec.get("pad", 0.08) * px
    w = (x1 - x0) + 2 * pad
    # flat like the refs' (07/08/09: ~0.6 H wide, ~0.07 H tall): 1:aspect, capped for wide stances
    h = min(max(2.0, w * spec.get("aspect", 0.25)), spec.get("h_max", 0.075) * px)
    cx = (x0 + x1) / 2
    cy = gy + spec.get("dy", 0)
    pal = json.load(open(PALETTE, encoding="utf-8"))["colors"]
    c = tuple(int(pal[spec.get("code", "OL")][i:i + 2], 16) for i in (1, 3, 5))
    lay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(lay).ellipse((round(cx - w / 2), round(cy - h / 2), round(cx + w / 2) - 1, round(cy + h / 2) - 1),
                                fill=c + (int(round(255 * spec.get("alpha", 0.35))),))
    lay.alpha_composite(im)
    out = os.path.join(still_dir, "still_ground.png")
    lay.save(out)
    previews(out)


def previews(path):
    im = Image.open(path)
    base = path[:-4]
    for z in (3, 6):
        im.resize((im.width * z, im.height * z), Image.NEAREST).save(f"{base}_x{z}.png")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=os.path.join(BUILD, "lanes", "shading", "r1"))
    ap.add_argument("--round", default="r1")
    ap.add_argument("--render", action="store_true")
    ap.add_argument("--variants", default="")
    ap.add_argument("--px", default="144,80")
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    pxs = [int(x) for x in a.px.split(",")]
    stills = [s for s in STILLS if not a.only or s[0] in a.only.split(",")]
    raw = os.path.join(a.root, "raw")
    if a.render:
        for name, pose, extra in stills:
            run([sys.executable, os.path.join(HERE, "blender_env.py"), "run", "--python-exit-code", "1", "--python",
                 os.path.join(HERE, "render_rosace.py"), "--", "--blend", LANE_BLEND,
                 "--pose", os.path.join(POSES, pose + ".json"), "--px", ",".join(map(str, pxs)), "--ss", "4",
                 "--passes", PASSES, "--out", os.path.join(raw, name)] + extra)
            print("rendered", name)
    for v in [x for x in a.variants.split(",") if x]:
        preset = None if v == "ctl" else preset_path(v, a.round)
        P = json.load(open(preset, encoding="utf-8")) if preset else {}
        colors = P.get("colors")
        env = None
        if P.get("rim_style"):
            env = dict(os.environ, ROSACE_RIM_STYLE=os.path.join(REPO, P["rim_style"]))
        vdir = os.path.join(a.root, v)
        layers = os.path.join(vdir, "_layers")
        log = {}
        for name, pose, extra in stills:
            for px in pxs:
                src = os.path.join(raw, name, f"px{px}")
                still = os.path.join(vdir, name, f"px{px}")
                os.makedirs(still, exist_ok=True)
                shutil.copy(os.path.join(src, "meta.json"), os.path.join(still, "meta.json"))
                cmd = [sys.executable, os.path.join(HERE, "rosace_post.py"), "--raw", src, "--out", still,
                       "--no-face", "--tag", "noface"]
                if preset:
                    cmd += ["--shade", preset]
                out = run(cmd)
                log[f"{name}_{px}"] = [ln for ln in out.splitlines() if ln.startswith("shade:")]
                layer = f"{pose}_{px}"
                ops = [] if os.path.exists(os.path.join(ODIR, layer + ".json")) else ["--ops", f"{pose}_144"]
                common = ["--still", still, "--layer", layer, "--layer-dir", layers] + ops
                senv = env
                if P.get("rim_family", {}).get(name):
                    # round 3: the rim's colour is a per-frame input (rim.py tint_family)
                    senv = dict(env or os.environ, ROSACE_RIM_FAMILY=P["rim_family"][name])
                run([sys.executable, os.path.join(HERE, "overrides.py"), "build"] + common, senv)
                run([sys.executable, os.path.join(HERE, "overrides.py"), "apply"] + common, senv)
                sp = os.path.join(still, "still.png")
                if P.get("post_face"):
                    # round 3: global layer after the face stamp (the hair's cast on the face skin)
                    sys.path.insert(0, HERE)
                    import rosace_shade
                    log[f"{name}_{px}"].append(f"post_face: {rosace_shade.post_face(still, P['post_face'])} px")
                remap(sp, colors)
                previews(sp)
                if P.get("ground"):
                    ground(still, P["ground"])
        json.dump({"preset": preset, "log": log}, open(os.path.join(vdir, "_log.json"), "w"), indent=1)
        print("variant", v, "->", vdir)


if __name__ == "__main__":
    main()
