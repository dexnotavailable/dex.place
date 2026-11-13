"""Drive 9, N1 motion: render the frames (d9_motion_bl.py in Blender), run d9_post.py on every drawing, then write
the strip and a GIF at game timing (plain Python; one Blender process at a time).

  python tools/pixel-pipeline/drive9/d9_motion.py [--px 144,80] [--no-render] [--review <dir>]

Inputs: the motion lane's integrated N1 (retimed/n1_r3c_integrated.npz and its hero sheet copy in motion-ai/work/),
used read-only. Output: lanes/drive9/motion/seq/px<N>/f####/D1/still.png and <review>/n1_d9_px<N>_strip.png,
n1_d9_px<N>.gif, n1_current_px<N>_strip.png (the integrated motion for comparison).
"""
import argparse
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PIPE))
sys.path.insert(0, HERE)
import d9_post  # noqa: E402

ART = r"D:\Dex\Projects\dex-place-art\rosace\motion-ai"
BUILD = r"D:\Dex\Projects\dex-place-art\rosace\build"
OUT = os.path.join(BUILD, "lanes", "drive9", "motion")
BG = (104, 102, 98, 255)


def render(px):
    cmd = [sys.executable, os.path.join(PIPE, "blender_env.py"), "run", "--python-exit-code", "1", "--python",
           os.path.join(HERE, "d9_motion_bl.py"), "--", "--npz", os.path.join(ART, "retimed", "n1_r3c_integrated.npz"),
           "--blend", os.path.join(BUILD, "lanes", "drive9.blend"), "--out", os.path.join(OUT, "seq"), "--px", str(px),
           "--hero", os.path.join(ART, "work", "n1_r3c_integrated.json"), "--pad", "12", "--ss", "4"]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    open(os.path.join(OUT, f"m{px}.log"), "w", encoding="utf-8").write((r.stdout or "") + (r.stderr or ""))
    if r.returncode:
        raise SystemExit(f"motion render {px} failed; see m{px}.log")


def frames_of(px):
    d = os.path.join(OUT, "seq", f"px{px}")
    return sorted(int(n[1:]) for n in os.listdir(d) if n.startswith("f") and os.path.isdir(os.path.join(d, n)))


def union_box(ims):
    bs = [im.getchannel("A").getbbox() for im in ims]
    return (min(b[0] for b in bs) - 2, min(b[1] for b in bs) - 2, max(b[2] for b in bs) + 2, max(b[3] for b in bs) + 2)


def strip(ims, labels, path, scale):
    box = union_box(ims)
    w, h = box[2] - box[0], box[3] - box[1]
    S = Image.new("RGBA", (w * len(ims), h + 12), (52, 52, 64, 255))
    d = ImageDraw.Draw(S)
    for i, (im, lb) in enumerate(zip(ims, labels)):
        tile = Image.new("RGBA", (w, h), BG)
        tile.alpha_composite(im.crop(box))
        S.paste(tile, (i * w, 12))
        d.text((i * w + 2, 0), lb, fill=(230, 230, 160, 255))
    S.resize((S.width * scale, S.height * scale), Image.NEAREST).save(path)
    return path


def grid(ims, path, scale, cols=5):
    box = union_box(ims)
    w, h = box[2] - box[0], box[3] - box[1]
    rows = (len(ims) + cols - 1) // cols
    S = Image.new("RGBA", (w * cols, h * rows), BG)
    for i, im in enumerate(ims):
        S.alpha_composite(im.crop(box), ((i % cols) * w, (i // cols) * h))
    S.resize((S.width * scale, S.height * scale), Image.NEAREST).save(path)
    return path


def gif(ims_by_frame, sample, path, scale):
    box = union_box(list(ims_by_frame.values()))
    seq = []
    for f in sample:
        tile = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), BG)
        tile.alpha_composite(ims_by_frame[f].crop(box))
        seq.append(tile.resize((tile.width * scale, tile.height * scale), Image.NEAREST).convert("P", palette=Image.ADAPTIVE))
    seq[0].save(path, save_all=True, append_images=seq[1:], duration=1000 // 60, loop=0, disposal=2)
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--px", default="144,80")
    ap.add_argument("--no-render", action="store_true")
    ap.add_argument("--review", default=os.path.join(REPO, "review", "rosace", "art", "drive9", "combined", "motion"))
    a = ap.parse_args()
    FIN = json.load(open(os.path.join(HERE, "d9_finish.json"), encoding="utf-8"))
    os.makedirs(a.review, exist_ok=True)
    rep = {}
    for px in [int(x) for x in a.px.split(",")]:
        if not a.no_render:
            render(px)
        fr = frames_of(px)
        ims = {}
        for f in fr:
            raw = os.path.join(OUT, "seq", f"px{px}", f"f{f:04d}")
            d9_post.process(raw, FIN, "D1", "D1", True)
            ims[f] = Image.open(os.path.join(raw, "D1", "still_ground.png")).convert("RGBA")
        meta = json.load(open(os.path.join(OUT, "seq", f"px{px}", "meta.json")))
        sample = meta["motion"]["sample_frame"]
        sc = 3 if px >= 144 else 4
        strip([ims[f] for f in fr], [f"f{f}" for f in fr], os.path.join(a.review, f"n1_d9_px{px}_strip.png"), sc)
        grid([ims[f] for f in fr], os.path.join(a.review, f"n1_d9_px{px}_grid.png"), 2 if px >= 144 else 3)
        gif(ims, sample, os.path.join(a.review, f"n1_d9_px{px}.gif"), sc)
        cur = os.path.join(ART, "renders", "n1_r3c_integrated", f"px{px}")
        if os.path.isdir(cur):
            cm = json.load(open(os.path.join(cur, "meta.json")))
            cims = [Image.open(os.path.join(cur, f"sprite_{f:04d}.png")).convert("RGBA") for f in cm["frames"]]
            strip(cims, [f"f{f}" for f in cm["frames"]], os.path.join(a.review, f"n1_current_px{px}_strip.png"), sc)
            grid(cims, os.path.join(a.review, f"n1_current_px{px}_grid.png"), 2 if px >= 144 else 3)
        rep[px] = {"frames": fr, "sample": sample}
        print("motion", px, len(fr), "drawings", flush=True)
    json.dump(rep, open(os.path.join(a.review, "motion.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
