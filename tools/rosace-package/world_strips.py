"""Assembles capture_world.mjs output into review strips and GIFs (plain python; review material, never shipped).

  python tools/rosace-package/world_strips.py --in review/world3 --out review/world3/strips
 clips80/<clip>_<frame>.png   -> strips/clips80_<clip>.png (every drawing as the game drew it, 80 px sprite, canvas crop)
 clips144/...                 -> strips/clips144_<clip>.png (the close-up sprite, combat zoom)
 rooms/<room>/<move>_*.png    -> strips/rooms_<room>_<move>.png and a GIF per move
"""
import argparse
import glob
import os
import re

from PIL import Image


def sheet(files, path, cols=8, scale=1):
    ims = [Image.open(f).convert("RGBA") for f in files]
    w, h = max(i.width for i in ims), max(i.height for i in ims)
    cols = min(cols, len(ims))
    rows = (len(ims) + cols - 1) // cols
    S = Image.new("RGBA", (w * cols, h * rows), (24, 24, 32, 255))
    for k, im in enumerate(ims):
        S.paste(im, ((k % cols) * w, (k // cols) * h))
    if scale != 1:
        S = S.resize((S.width * scale, S.height * scale), Image.NEAREST)
    S.save(path)


def gif(files, path, ms=100):
    ims = [Image.open(f).convert("RGB") for f in files]
    ims[0].save(path, save_all=True, append_images=ims[1:], duration=ms, loop=0)


def crop_set(files, frames, group, pad=10, scale=1):
    """crop every frame of a set to the union of the players' bounding boxes (found by capture_world.mjs)"""
    boxes = []
    for f in files:
        bb = frames[group][os.path.splitext(os.path.basename(f))[0]]["bbox"]
        if bb:
            boxes.append(bb)
    x0 = max(0, min(b[0] for b in boxes) - pad)
    y0 = max(0, min(b[1] for b in boxes) - pad)
    x1 = max(b[2] for b in boxes) + pad
    y1 = max(b[3] for b in boxes) + pad
    out = []
    for f in files:
        im = Image.open(f).convert("RGBA").crop((x0, y0, min(x1, Image.open(f).width), min(y1, Image.open(f).height)))
        if scale != 1:
            im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
        out.append(im)
    return out


def sheet_images(ims, path, cols=8):
    w, h = max(i.width for i in ims), max(i.height for i in ims)
    cols = min(cols, len(ims))
    rows = (len(ims) + cols - 1) // cols
    S = Image.new("RGBA", (w * cols, h * rows), (24, 24, 32, 255))
    for k, im in enumerate(ims):
        S.paste(im, ((k % cols) * w, (k // cols) * h))
    S.save(path)


def main():
    import json
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    frames = json.load(open(os.path.join(a.inp, "frames.json")))
    for group, scale in (("clips80", 2), ("clips144", 1)):
        clips = {}
        for f in sorted(glob.glob(os.path.join(a.inp, group, "*.png"))):
            m = re.match(r"(.+)_(\d+)\.png$", os.path.basename(f))
            clips.setdefault(m.group(1), []).append(f)
        for clip, files in clips.items():
            ims = crop_set(files, frames, group, scale=scale)
            sheet_images(ims, os.path.join(a.out, f"{group}_{clip}.png"), cols=8 if group == "clips80" else 6)
            if len(ims) > 1:
                ims[0].convert("RGB").save(os.path.join(a.out, f"{group}_{clip}.gif"), save_all=True,
                                           append_images=[i.convert("RGB") for i in ims[1:]], duration=120, loop=0)
        print(group, len(clips), "clips")
    for room in sorted(glob.glob(os.path.join(a.inp, "rooms", "*"))):
        tag = os.path.basename(room)
        moves = {}
        for f in sorted(glob.glob(os.path.join(room, "*.png"))):
            m = re.match(r"([a-z]+)_\d+_.+\.png$", os.path.basename(f))
            moves.setdefault(m.group(1), []).append(f)
        for mv, files in moves.items():
            ims = crop_set(files, frames, f"rooms/{tag}", pad=24, scale=2)
            sheet_images(ims, os.path.join(a.out, f"rooms_{tag}_{mv}.png"), cols=6)
            ims[0].convert("RGB").save(os.path.join(a.out, f"rooms_{tag}_{mv}.gif"), save_all=True,
                                       append_images=[i.convert("RGB") for i in ims[1:]], duration=100, loop=0)
        print(tag, {k: len(v) for k, v in moves.items()})


if __name__ == "__main__":
    main()
