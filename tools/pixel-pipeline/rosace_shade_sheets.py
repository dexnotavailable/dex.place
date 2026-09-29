"""Shading lane review sheets: blind A/B of the lane's stills and part crops against the finish-bar refs.

  python tools/pixel-pipeline/rosace_shade_sheets.py --root <lane>/r1 --pick k --control ctl --alts i \
      --out review/rosace/art/shading/round-1 [--seed 20261101]

Writes (git-ignored review/, third-party pixels never leave it):
  ab_<still>_<px>_vs_<ref>_x3.png / _x1.png   ours (the picked variant) vs the ref crop, panels A / B,
                                              order shuffled per sheet
  pick_<still>_<px>_x3.png / _x1.png           the whole-figure pick (WF-P11): the candidates (control
                                              among them) shuffled as A / B / C..., the ref labelled R
  part_<material>_x6.png / _x3.png             144 px crops of one material: ours (pick), the control,
                                              and ref crops of the same material, shuffled A / B / ...
  key.json                                     which letter is which, per sheet
Every panel keeps its native pixel grid; one integer zoom per sheet; our sprites sit on the ref
crop's own border colour so the backdrop does not give the blind away. Round 2: a still's
still_ground.png (the figure over its contact shadow) is used when the variant made one, since the
refs all stand on one; the control has none (today's pipeline draws none).
"""
import argparse
import json
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
NAT = os.path.join(REPO, "review", "refs", "character", "native")
B07 = "07-anim-amberowl-wrench_bonus-originalsize_1x.png"
B08 = "08-anim-amberowl-lys-lightning_bonus-originalsize_1x.png"
R09 = "09-anim-amberowl-katana-cats_1x.png"
G04 = "04-style-grid9_native-p2.158.png"
REFS = {   # same boxes as stills_sheets.py / art-construct sheets.py
    "ref07_idle": (B07, (64, 14, 178, 196)),
    "ref08_idle": (B08, (180, 40, 340, 222)),
    "ref09_idle": (R09, (60, 32, 205, 215)),
    "ref04_centre": (G04, (114, 168, 230, 342)),
    "ref08_attack": (B08, (362, 12, 560, 218)),
    "ref09_away": (R09, (250, 20, 400, 215)),
}
COMPARE = [("idle_hero", "ref07_idle"), ("idle_hero", "ref09_idle"), ("idle_hero", "ref08_idle"),
           ("idle_hero", "ref04_centre"), ("n1_contact", "ref08_attack"), ("q_stamp", "ref08_attack"),
           ("n2_pivot_black", "ref09_away")]
PICK_REF = {"idle_hero": "ref09_idle", "n1_contact": "ref08_attack", "q_stamp": "ref08_attack",
            "n2_pivot_black": "ref09_away"}
# material crops on the refs (native 1x), located on gridded crops in round 1
REF_PARTS = {
    "skin": [("ref08_thigh", B08, (268, 138, 302, 168)), ("ref07_arm", B07, (126, 72, 152, 102)),
             ("ref04_thigh", G04, (162, 252, 202, 292))],
    "white": [("ref08_top", B08, (276, 96, 304, 132)), ("ref04_skirt", G04, (160, 232, 208, 264)),
              ("ref09_hair", R09, (132, 46, 178, 100))],
    "stocking": [("ref08_stocking", B08, (264, 160, 302, 198)), ("ref04_stocking", G04, (166, 288, 214, 336))],
    "gold": [("ref07_pad", B07, (88, 142, 112, 162)), ("ref09_guard", R09, (92, 104, 118, 124))],
}
MAT_ID = {"skin": 1, "white": 2, "stocking": 3, "gold": 4}
PART_WIN = {"skin": (34, 34), "white": (34, 34), "stocking": (34, 38), "gold": (28, 24)}
try:
    FONT = ImageFont.load_default(size=22)
except TypeError:
    FONT = ImageFont.load_default()


def ref_crop(key):
    f, box = REFS[key]
    return Image.open(os.path.join(NAT, f)).convert("RGBA").crop(box)


def border_bg(im):
    a = np.asarray(im.convert("RGB"))
    edge = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    return tuple(int(v) for v in np.median(edge, 0))


def on_bg(sprite, bg):
    out = Image.new("RGBA", sprite.size, bg + (255,))
    out.alpha_composite(sprite)
    return out


def sheet(panels, labels, z, path, title=""):
    pad = 8
    W = sum(p.width for p in panels) * z + pad * (len(panels) + 1)
    H = max(p.height for p in panels) * z + pad * 2 + 30
    s = Image.new("RGBA", (W, H), (40, 40, 44, 255))
    d = ImageDraw.Draw(s)
    x = pad
    for p, lab in zip(panels, labels):
        pz = p.resize((p.width * z, p.height * z), Image.NEAREST)
        s.paste(pz, (x, H - pad - pz.height))
        d.text((x + 2, 4), lab, fill=(235, 235, 235), font=FONT)
        x += pz.width + pad
    if title:
        d.text((W - 10 - 8 * len(title), 6), title, fill=(150, 150, 150))
    s.save(path)


def best_window(ids, mid, w, h):
    m = (ids == mid).astype(np.int32)
    H, W = m.shape
    ii = np.pad(m.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    best, bxy = -1, (0, 0)
    for y in range(0, max(1, H - h)):
        for x in range(0, max(1, W - w)):
            c = ii[y + h, x + w] - ii[y, x + w] - ii[y + h, x] + ii[y, x]
            if c > best:
                best, bxy = c, (x, y)
    return (bxy[0], bxy[1], bxy[0] + w, bxy[1] + h)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--pick", required=True)
    ap.add_argument("--control", default="ctl")
    ap.add_argument("--alts", default="")
    ap.add_argument("--out", required=True)
    ap.add_argument("--seed", type=int, default=20261101)
    ap.add_argument("--round", default="r1")
    a = ap.parse_args()
    rng = random.Random(a.seed)
    os.makedirs(a.out, exist_ok=True)
    key = {"_doc": f"Blind key for the shading lane {a.round} sheets (tools/pixel-pipeline/rosace_shade_sheets.py). "
                   f"'{a.pick}' = the lane's pick (preset art/rosace/overrides/global/shading_{a.round}{a.pick}.json), "
                   f"'{a.control}' = the control (today's post-process, no shading stage), others = alternates. "
                   "Renders: build/lanes/shading.blend (canonical geometry, light pass added).", "sheets": {}}

    def still(v, s, px, ground=True):
        d = os.path.join(a.root, v, s, f"px{px}")
        f = os.path.join(d, "still_ground.png")
        if not (ground and os.path.exists(f)):
            f = os.path.join(d, "still.png")
        return Image.open(f).convert("RGBA")
    # 1. ours vs the ref, blind A / B
    for s, ref in COMPARE:
        for px in (144, 80):
            r = ref_crop(ref)
            ours = on_bg(still(a.pick, s, px), border_bg(r))
            order = [("ours", ours), ("ref", r)]
            rng.shuffle(order)
            name = f"ab_{s}_{px}_vs_{ref}"
            for z in (3, 1):
                sheet([p for _, p in order], ["A", "B"], z, os.path.join(a.out, f"{name}_x{z}.png"))
            key["sheets"][name] = {"A": order[0][0], "B": order[1][0], "ref": ref, "ours_still": f"{a.pick}/{s}/px{px}"}
    # 2. the whole-figure pick among candidates
    cands = [a.pick, a.control] + [v for v in a.alts.split(",") if v]
    for s, ref in PICK_REF.items():
        for px in (144, 80):
            r = ref_crop(ref)
            bg = border_bg(r)
            order = cands[:]
            rng.shuffle(order)
            labels = [chr(65 + i) for i in range(len(order))]
            name = f"pick_{s}_{px}"
            for z in (3, 1):
                sheet([on_bg(still(v, s, px), bg) for v in order] + [r], labels + ["R (ref)"], z,
                      os.path.join(a.out, f"{name}_x{z}.png"))
            key["sheets"][name] = {**{lab: v for lab, v in zip(labels, order)}, "R": ref}
    # 3. part crops (144 idle for the figure materials; n1 contact for the stockings too)
    for mat, refs in REF_PARTS.items():
        w, h = PART_WIN[mat]
        panels = []
        for v in (a.pick, a.control):
            sd = os.path.join(a.root, v, "idle_hero", "px144")
            ids = np.asarray(Image.open(os.path.join(sd, "noface_id.png")).convert("RGBA"))[..., 0]
            box = best_window(ids, MAT_ID[mat], w, h)
            panels.append((v, still(v, "idle_hero", 144, ground=False).crop(box), box))
        for rn, f, box in refs:
            panels.append((rn, Image.open(os.path.join(NAT, f)).convert("RGBA").crop(box), box))
        bg = border_bg(panels[-1][1])
        order = panels[:]
        rng.shuffle(order)
        labels = [chr(65 + i) for i in range(len(order))]
        name = f"part_{mat}"
        for z in (6, 3):
            sheet([on_bg(p, bg) if n in (a.pick, a.control) else p for n, p, _ in order], labels, z,
                  os.path.join(a.out, f"{name}_x{z}.png"))
        key["sheets"][name] = {lab: {"what": n, "box": list(b)} for lab, (n, _, b) in zip(labels, order)}
    json.dump(key, open(os.path.join(a.out, "key.json"), "w"), indent=1)
    print("sheets in", a.out, len(key["sheets"]))


if __name__ == "__main__":
    main()
