"""Stills round 1: blind A/B sheets, the three-heights sheet and in-context frames.

  python tools/pixel-pipeline/round1_sheets.py [--renders <build>/renders/r1] [--seed 20260929]
      [--out review/rosace/round-1] [--label "round 1"]   (later rounds: point both at that round)

Reads the composited key stills (<renders>/<still>/px<N>/still.png, from stills_round1.sh) and
reference crops from the git-ignored review/refs folder. Writes everything to the git-ignored
review/rosace/round-1/ (third-party pixels never leave review/):
  ab_<comparison>_<N>_x3.png / _x6.png   one comparison per sheet, panels labelled only A / B,
                                         left/right order randomised per sheet (seeded)
  key.json                               which side is ours, per sheet
  heights_x3.png                         our 96 / 128 / 144 px stills side by side, per pose
  incontext_<W>x<H>_px<N>.png            1x game size on a plain canvas
Every panel keeps its native pixel grid; all panels on a sheet share one integer zoom.
"""
import argparse
import json
import os
import random

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
NATIVE = os.path.join(REPO, "review", "refs", "character", "native")

ap = argparse.ArgumentParser()
ap.add_argument("--renders", default=r"D:\Dex\Projects\dex-place-art\rosace\build\renders\r1")
ap.add_argument("--seed", type=int, default=20260929)
ap.add_argument("--out", default=os.path.join(REPO, "review", "rosace", "round-1"))
ap.add_argument("--label", default="round 1")
a = ap.parse_args()
OUT = a.out
LABEL = a.label
os.makedirs(OUT, exist_ok=True)
rng = random.Random(a.seed)
HEIGHTS = (96, 128, 144)
BACKDROP = (104, 102, 98)      # neutral grey near ref 09's ground, for our transparent sprites

# reference crops (native 1x grids, measured in docs/character/REF-BREAKDOWN.md)
B07 = "07-anim-amberowl-wrench_bonus-originalsize_1x.png"
B08 = "08-anim-amberowl-lys-lightning_bonus-originalsize_1x.png"
R09 = "09-anim-amberowl-katana-cats_1x.png"
REFS = {
    "ref07_idle": (B07, (64, 14, 178, 196), "07 bonus panel (1x), idle / carry stance"),
    "ref07_attack": (B07, (180, 14, 340, 200), "07 bonus panel (1x), overhead wrench strike with smear"),
    "ref08_idle": (B08, (180, 40, 340, 222), "08 bonus panel (1x), idle stance"),
    "ref08_attack": (B08, (362, 12, 560, 218), "08 bonus panel (1x), leaping spear strike (skill key pose)"),
    "ref09_idle": (R09, (60, 32, 205, 215), "09 (1x), frame 1 idle"),
    "ref09_attack": (R09, (420, 20, 650, 215), "09 (1x), frame 3 slash with thorn trail"),
    "ref09_away": (R09, (250, 20, 400, 215), "09 (1x), frame 2 wind-up turned three-quarters away (no ref "
                                             "07-09 shows a true back view; this is the closest)"),
}
# comparisons: (name, our still, reference)
COMPARE = [
    ("idle_vs_ref07", "idle_hero", "ref07_idle"),
    ("idle_vs_ref09", "idle_hero", "ref09_idle"),
    ("attack_vs_ref07", "n1_contact", "ref07_attack"),
    ("attack_vs_ref08", "n1_contact", "ref08_attack"),
    ("skill_vs_ref08", "q_stamp", "ref08_attack"),
    ("back_black_vs_ref09", "n2_pivot_black", "ref09_away"),
    ("back_white_vs_ref09", "n2_pivot_white", "ref09_away"),
]
try:
    FONT = ImageFont.load_default(size=26)
    FONT_S = ImageFont.load_default(size=16)
except TypeError:
    FONT = FONT_S = ImageFont.load_default()


def ref_img(k):
    f, box, _ = REFS[k]
    return Image.open(os.path.join(NATIVE, f)).convert("RGB").crop(box)


def ours(still, px, margin=8):
    im = Image.open(os.path.join(a.renders, still, f"px{px}", "still.png")).convert("RGBA")
    x0, y0, x1, y1 = im.getbbox()
    im = im.crop((x0 - margin, y0 - margin, x1 + margin, y1 + margin))
    bg = Image.new("RGBA", im.size, BACKDROP + (255,))
    bg.alpha_composite(im)
    return bg.convert("RGB")


def sheet(panels, labels, z, header):
    ims = [p.resize((p.width * z, p.height * z), Image.NEAREST) for p in panels]
    pad, top = 24, 70
    W = sum(i.width for i in ims) + pad * (len(ims) + 1)
    H = max(i.height for i in ims) + top + pad
    s = Image.new("RGB", (W, H), (22, 22, 26))
    d = ImageDraw.Draw(s)
    d.text((pad, 8), header, fill=(200, 200, 200), font=FONT_S)
    x = pad
    for im, lab in zip(ims, labels):
        d.text((x, 30), lab, fill=(255, 235, 150), font=FONT)
        s.paste(im, (x, H - pad - im.height))
        x += im.width + pad
    return s


key = {"_doc": f"Blind A/B key for {LABEL}. 'ours' names the side (A or B) that is Rosace; 'ref' is the "
               "reference crop; both panels are on their native pixel grids at the sheet's zoom.",
       "seed": a.seed, "refs": {k: {"file": v[0], "crop": v[1], "what": v[2]} for k, v in REFS.items()},
       "sheets": {}}
sheets = []
for px in HEIGHTS:
    for name, still, rk in COMPARE:
        o, r = ours(still, px), ref_img(rk)
        ours_left = rng.random() < 0.5
        panels = [o, r] if ours_left else [r, o]
        for z in (3, 6):
            fn = f"ab_{name}_{px}_x{z}.png"
            sheet(panels, ["A", "B"], z,
                  f"{LABEL}  |  sheet {name.split('_vs_')[0]} / set {px}  |  x{z}, each panel on its own native grid").save(
                os.path.join(OUT, fn))
            sheets.append(fn)
        key["sheets"][f"ab_{name}_{px}"] = {"ours": "A" if ours_left else "B", "ours_still": f"{still} @ {px} px",
                                            "ref": rk, "files": [f"ab_{name}_{px}_x3.png", f"ab_{name}_{px}_x6.png"]}
    # thong variants, blind too (DESIGN.md section 3: pick at game size)
    b, w = ours("n2_pivot_black", px), ours("n2_pivot_white", px)
    black_left = rng.random() < 0.5
    for z in (3, 6):
        fn = f"ab_thong_black_vs_white_{px}_x{z}.png"
        sheet([b, w] if black_left else [w, b], ["A", "B"], z,
              f"{LABEL}  |  back view, two costume variants / set {px}  |  x{z}").save(os.path.join(OUT, fn))
        sheets.append(fn)
    key["sheets"][f"ab_thong_black_vs_white_{px}"] = {"black": "A" if black_left else "B",
                                                      "white": "B" if black_left else "A"}
json.dump(key, open(os.path.join(OUT, "key.json"), "w"), indent=1)

# our three heights side by side, per pose (not blind)
rows = []
for still in ("idle_hero", "n1_contact", "q_stamp", "n2_pivot_black"):
    panels = [ours(still, px) for px in HEIGHTS]
    rows.append(sheet(panels, [f"{px} px" for px in HEIGHTS], 3, f"Rosace {LABEL}, {still}: 96 / 128 / 144 px, x3"))
W = max(r.width for r in rows)
hs = Image.new("RGB", (W, sum(r.height for r in rows)), (22, 22, 26))
y = 0
for r in rows:
    hs.paste(r, (0, y))
    y += r.height
hs.save(os.path.join(OUT, "heights_x3.png"))
sheets.append("heights_x3.png")

# in-context: 1x game size, plain canvas, small centred character on a floor line
SKY, FLOOR, LINE = (46, 48, 62), (30, 30, 40), (84, 52, 58)
for cw, ch in ((640, 360), (960, 540)):
    for px in HEIGHTS:
        c = Image.new("RGBA", (cw, ch), SKY + (255,))
        d = ImageDraw.Draw(c)
        fy = int(ch * 0.78)
        d.rectangle([0, fy, cw, ch], fill=FLOOR + (255,))
        d.line([(cw // 2 + 40, fy), (cw, fy)], fill=LINE + (255,))     # the muted red 'go right' hint
        im = Image.open(os.path.join(a.renders, "idle_hero", f"px{px}", "still.png")).convert("RGBA")
        meta = json.load(open(os.path.join(a.renders, "idle_hero", f"px{px}", "meta.json")))
        ax, ay = meta["anchor"]        # foot pivot on the sprite canvas
        c.alpha_composite(im, (cw // 2 - ax, fy - ay))
        fn = f"incontext_{cw}x{ch}_px{px}.png"
        c.convert("RGB").save(os.path.join(OUT, fn))
        sheets.append(fn)
print("\n".join(os.path.join(OUT, s) for s in sheets))
