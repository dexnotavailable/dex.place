"""Route F2 review sheets: blind A/B of the head-scale variants beside refs 07, 09 and 04 (review/ only: the sheets
hold third-party refs), plus black-fill silhouettes and a face-crop sheet.

  python tools/pixel-pipeline/finish_f2/sheets_f2.py [--root <lane>/v] [--out review/rosace/art/finish/F2]
      [--set H100,H110E,H115E,H120E,H115] [--labelled]

Per still (idle 3/4, N1 contact, back) and size (144, 80): <still>_<px>_x3.png / _x1.png (ours on the contact
shadow, one ground line, refs at their native grid at 144; at 80 each ref crop is box-filtered to 80 px tall and
snapped to its own 32-colour median-cut palette, no dither, as figure-pose round 2 did), <still>_silhouette_<px>_x*.png
(black fill), heads_<px>_x6.png (the head crops, same letters). Letters are shuffled per still with SEED so no
variant sits at its listed place; key.json maps them. Don't show key.json or this file to a blind critic.
"""
import argparse
import hashlib
import json
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PIPE))
sys.path.insert(0, os.path.join(PIPE, "rosace_v2"))
import figure_shape as fs  # noqa: E402  (REFS, REF_DIR, _font; plain python, read-only)

ROOT = r"D:\Dex\Projects\dex-place-art\rosace\build\lanes\finish-F2\v"
OUT = os.path.join(REPO, "review", "rosace", "art", "finish", "F2")
SEED = 20260929 + 0xF2
BG, SIL_BG = (104, 102, 98), (228, 226, 220)
REFS = [r for r in fs.REFS if r[0] in ("ref 07", "ref 09", "ref 04a")]
STILLS = {"idle": "idle 3/4 (figure-pose idle_appeal)", "n1": "N1 contact", "back": "back (figure-pose back_appeal)"}
LETTERS = "BDGKMPRTVX"


def load(root, v, s, px, margin=3):
    p = os.path.join(root, v, s, f"px{px}", "still_ground.png")
    im = Image.open(p).convert("RGBA")
    ax, ay = json.load(open(os.path.join(os.path.dirname(p), "meta.json")))["anchor"]
    b = im.getchannel("A").getbbox()
    box = (max(0, b[0] - margin), max(0, b[1] - margin), min(im.width, b[2] + margin), min(im.height, b[3] + margin))
    return im.crop(box), p, (ax - box[0], ay - box[1])


def body_only(root, v, s, px):
    """the still without the contact shadow (for silhouettes)"""
    p = os.path.join(root, v, s, f"px{px}", "still.png")
    im = Image.open(p).convert("RGBA")
    b = im.getchannel("A").getbbox()
    return im.crop((max(0, b[0] - 3), max(0, b[1] - 3), min(im.width, b[2] + 3), min(im.height, b[3] + 3)))


def sil(im):
    a = im.getchannel("A").point(lambda x: 255 if x > 0 else 0)
    s = Image.new("RGBA", im.size, (0, 0, 0, 0))
    s.paste(Image.new("RGBA", im.size, (0, 0, 0, 255)), (0, 0), a)
    return s


def refs(px=144):
    out = []
    for n, f, b in REFS:
        im = Image.open(os.path.join(fs.REF_DIR, f)).convert("RGB").crop(b)
        if px == 80:
            k = 80 / im.height
            sm = im.resize((max(1, round(im.width * k)), 80), Image.BOX)
            q = im.quantize(32, method=Image.Quantize.MEDIANCUT)
            pa = np.array([q.getpalette()[i * 3:i * 3 + 3] for i in range(32)], float)
            a = np.asarray(sm, float)
            idx = ((a[:, :, None, :] - pa[None, None]) ** 2).sum(-1).argmin(-1)
            im = Image.fromarray(pa[idx].astype(np.uint8), "RGB")
            n = f"{n} @80"
        out.append((n, im))
    return out


def sheet(title, sub, panels, zoom, bg):
    gap, lab, pad = 18, 28, 14
    H = max(im.height for _, im in panels) * zoom
    Wd = pad * 2 + sum(im.width * zoom for _, im in panels) + gap * (len(panels) - 1)
    hdr = 56 if zoom > 1 else 44
    S = Image.new("RGB", (max(Wd, 520 if zoom > 1 else 360), hdr + lab + H + pad), (24, 22, 30))
    d = ImageDraw.Draw(S)
    d.text((pad, 6), title, fill=(232, 228, 220), font=fs._font(20 if zoom > 1 else 13))
    d.text((pad, 30 if zoom > 1 else 24), sub, fill=(190, 184, 170), font=fs._font(14 if zoom > 1 else 10))
    x = pad
    for l, t in panels:
        if t.mode == "RGBA":
            c = Image.new("RGBA", t.size, bg + (255,))
            c.alpha_composite(t)
            t = c
        t = t.convert("RGB").resize((t.width * zoom, t.height * zoom), Image.NEAREST)
        S.paste(t, (x, hdr + lab + H - t.height))
        d.text((x, hdr + 4), l, fill=(232, 228, 220), font=fs._font(14 if zoom > 1 else 10))
        x += t.width + gap
    return S


def head_crop(root, v, s, px):
    d = os.path.join(root, v, s, f"px{px}")
    fp = json.load(open(os.path.join(d, "facepass.json")))
    im = Image.open(os.path.join(d, "still.png")).convert("RGBA")
    cx, cy = fp["chin"][0], fp["chin"][1]
    r = 22 if px == 144 else 13
    return im.crop((int(cx - r), int(cy - 2.0 * r), int(cx + r), int(cy + 0.5 * r)))


def shuffle(names, rng):
    for _ in range(10000):
        o = list(names)
        rng.shuffle(o)
        if not any(a == b for a, b in zip(o, names)):
            return o
    return o


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=ROOT)
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--set", default="H100,H110E,H115E,H120E,H115")
    ap.add_argument("--labelled", action="store_true")
    ap.add_argument("--kept", default="", help="also write <out>/kept/ for this variant")
    a = ap.parse_args()
    names = a.set.split(",")
    rng = random.Random(SEED)
    out = os.path.join(a.out, "_labelled_not_for_blind") if a.labelled else a.out
    os.makedirs(out, exist_ok=True)
    key = {"_doc": "Route F2 blind A/B (head scale + eye stamps). Letters shuffled per still with the seed; refs 07, 09, "
                   "04a are labelled (third-party, review only). Hxxx = head scale x1.xx (skull, face and hair together "
                   "about the neck-top joint, neck width +40 % of the gain, figure height kept at 144 / 80); a trailing E = "
                   "the 144 eye stamps +1 column and +1 row (faces_f2.json eyes_big; 80 px eyes unchanged). H100 = the "
                   "control (the canonical build on the figure-pose appeal poses, same chain).",
           "seed": SEED, "sets": {}, "provenance": {},
           "refs_80": "80 px sheets: each ref crop box-filtered to 80 px tall and snapped to its native crop's own "
                      "32-colour median-cut palette, no dither; 144 px sheets: refs at their native grid"}
    for s, desc in STILLS.items():
        order = shuffle(names, rng)
        m = dict(zip(LETTERS, order))
        key["sets"][s] = m
        for px in (144, 80):
            ims, sils, heads = [], [], []
            for L, v in m.items():
                im, p, _ = load(a.root, v, s, px)
                lab = v if a.labelled else L
                ims.append((lab, im))
                sils.append((lab, sil(body_only(a.root, v, s, px))))
                heads.append((lab, head_crop(a.root, v, s, px)))
                key["provenance"].setdefault(v, {})[f"{s}_{px}"] = {
                    "still": p, "sha1": hashlib.sha1(open(p, "rb").read()).hexdigest()[:12]}
            for z in (3, 1):
                sub = f"x{z}; ours on the contact shadow; letters shuffled (key.json); refs " + \
                      ("resampled to 80 px" if px == 80 else "at their own native grid")
                sheet(f"{desc}, {px} px", sub, ims + refs(px), z, BG).save(f"{out}/{s}_{px}_x{z}.png")
                sheet(f"{desc} silhouettes, {px} px", f"x{z}; black fill, no shadow", sils, z, SIL_BG).save(
                    f"{out}/{s}_silhouette_{px}_x{z}.png")
            sheet(f"{desc} heads, {px} px", "x6 (x8 at 80); same letters", heads, 6 if px == 144 else 8, BG).save(
                f"{out}/{s}_heads_{px}.png")
    if not a.labelled:
        json.dump(key, open(os.path.join(a.out, "key.json"), "w", encoding="utf-8"), indent=1)
    if a.kept:
        # the kept variant: stills (on the contact shadow) and black-fill silhouettes, 144 and 80, x1 and x3
        kd = os.path.join(a.out, "kept")
        os.makedirs(kd, exist_ok=True)
        for s in STILLS:
            for px in (144, 80):
                im, _, _ = load(a.root, a.kept, s, px)
                for tag, x, bg in (("", im, BG), ("_sil", sil(body_only(a.root, a.kept, s, px)), SIL_BG)):
                    c = Image.new("RGBA", x.size, bg + (255,))
                    c.alpha_composite(x)
                    c = c.convert("RGB")
                    c.save(f"{kd}/{s}_{px}{tag}_x1.png")
                    c.resize((c.width * 3, c.height * 3), Image.NEAREST).save(f"{kd}/{s}_{px}{tag}_x3.png")
        json.dump({"kept": a.kept}, open(os.path.join(kd, "kept.json"), "w"), indent=1)
    print(sorted(os.listdir(out)))


if __name__ == "__main__":
    main()
