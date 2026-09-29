"""Review sheets for a stills round: blind A/B sheets, the three-heights sheet, in-context frames.

  python tools/pixel-pipeline/stills_sheets.py --renders <build>/renders/r2s --out review/rosace/round-2
      --label "stills round 2" [--seed 20260930] [--thong]

Generalised from round1_sheets.py (kept as the round-1 record). Reads the composited key stills
(<renders>/<still>/px<N>/still.png, from stills.sh) and reference crops from the git-ignored
review/refs folder. Writes everything to the --out folder under the git-ignored review/
(third-party pixels never leave review/). The back view uses the black thong (DESIGN.md s3,
locked after round 1); --thong adds the black/white variant sheets again.
  ab_<comparison>_<N>_x3.png / _x6.png   one comparison per sheet, panels labelled only A / B,
                                         left/right order randomised per sheet (seeded)
  key.json                               which side is ours, per sheet
  heights_x3.png                         our 96 / 128 / 144 px stills side by side, per pose
  incontext_<W>x<H>_px<N>.png            1x game size on a plain canvas (idle hero)
  incontext_<W>x<H>_lineup_px<N>.png     1x, all four key stills on one canvas
  before_after_<N>_x3.png                (--before) previous round vs this round, not blind
Round 3: python tools/pixel-pipeline/stills_sheets.py --renders <build>/renders/r3 --out review/rosace/round-3
      --label "stills round 3" --seed 20261003 --match-bg --before <build>/renders/r2s
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
ap.add_argument("--renders", default=r"D:\Dex\Projects\dex-place-art\rosace\build\renders\r2s")
ap.add_argument("--seed", type=int, default=20260930)
ap.add_argument("--out", default=os.path.join(REPO, "review", "rosace", "round-2"))
ap.add_argument("--label", default="stills round 2")
ap.add_argument("--thong", action="store_true", help="also the black / white thong variant sheets")
ap.add_argument("--before", help="renders dir of the previous round: adds a not-blind before/after sheet per height")
ap.add_argument("--match-bg", action="store_true",
                help="round 3: our A/B panel sits on the reference crop's own background colour (median of the "
                     "crop border) instead of one flat grey, so the backdrop alone does not give the blind away")
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
    ("back_vs_ref09", "n2_pivot_black", "ref09_away"),
]
try:
    FONT = ImageFont.load_default(size=26)
    FONT_S = ImageFont.load_default(size=16)
except TypeError:
    FONT = FONT_S = ImageFont.load_default()


def ref_img(k):
    f, box, _ = REFS[k]
    return Image.open(os.path.join(NATIVE, f)).convert("RGB").crop(box)


def ground_shadow(canvas, im, at, bg):
    """Round 2 craft critic: every ref stands on a soft ground ellipse, ours floated. The game
    draws the contact shadow under the sprite (it stays off the sprite so it can follow the
    floor); the sheets draw the same thing: a flat ellipse two values darker than the ground,
    ~60% of the width of whatever touches the floor, 3 px tall at 1x. at = sprite (x, y) on
    the canvas."""
    meta = im.info.get("meta")
    ax, ay = meta["anchor"]
    al = im.getchannel("A")
    x0 = x1 = None
    for y in range(max(0, ay - 10), min(im.height, ay + 1)):
        for x in range(im.width):
            if al.getpixel((x, y)) > 0:
                x0 = x if x0 is None else min(x0, x)
                x1 = x if x1 is None else max(x1, x)
    if x0 is None:
        return
    cx = at[0] + (x0 + x1) / 2
    w = max(14, 0.75 * (x1 - x0 + 1) + 10)
    fy = at[1] + ay
    # round 3 overall critic: the 3 px PIL ellipse read as two stacked bars (a UI bar). Now a
    # pixel ellipse with a solid core two values down and a checker-dithered outer ring one
    # value down, ~7 px tall at 1x, so it reads as a soft round contact shadow.
    core = tuple(max(0, int(c * 0.66)) for c in bg[:3]) + (255,)
    ring = tuple(max(0, int(c * 0.82)) for c in bg[:3]) + (255,)
    rx, ry = w / 2, 3.5
    px = canvas.load()
    for yy in range(int(fy - 4), int(fy + 4)):
        for xx in range(int(cx - rx - 1), int(cx + rx + 2)):
            if not (0 <= xx < canvas.width and 0 <= yy < canvas.height):
                continue
            e = ((xx + 0.5 - cx) / rx) ** 2 + ((yy + 0.5 - fy) / ry) ** 2
            if e <= 0.45:
                px[xx, yy] = core
            elif e <= 1.0 and (e <= 0.7 or (xx + yy) % 2 == 0):
                px[xx, yy] = ring


def load_still(still, px):
    im = Image.open(os.path.join(a.renders, still, f"px{px}", "still.png")).convert("RGBA")
    im.info["meta"] = json.load(open(os.path.join(a.renders, still, f"px{px}", "meta.json")))
    return im


def border_colour(im):
    """median colour of a crop's 2 px border (the reference's own ground / backdrop)"""
    px = []
    w, h = im.size
    for x in range(w):
        for y in (0, 1, h - 2, h - 1):
            px.append(im.getpixel((x, y)))
    for y in range(h):
        for x in (0, 1, w - 2, w - 1):
            px.append(im.getpixel((x, y)))
    return tuple(sorted(c[i] for c in px)[len(px) // 2] for i in range(3))


def ours(still, px, margin=8, backdrop=None, renders=None):
    backdrop = backdrop or BACKDROP
    if renders:
        im = Image.open(os.path.join(renders, still, f"px{px}", "still.png")).convert("RGBA")
        im.info["meta"] = json.load(open(os.path.join(renders, still, f"px{px}", "meta.json")))
    else:
        im = load_still(still, px)
    x0, y0, x1, y1 = im.getbbox()
    bg = Image.new("RGBA", (x1 - x0 + 2 * margin, y1 - y0 + 2 * margin + 3), backdrop + (255,))
    at = (margin - x0, margin - y0)
    ground_shadow(bg, im, at, backdrop)
    bg.paste(im, at, im)          # binary alpha: paste == composite, and it takes negative offsets
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
        r = ref_img(rk)
        o = ours(still, px, backdrop=border_colour(r) if a.match_bg else None)
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
    if not a.thong:
        continue
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

# before / after (not blind): previous round's composited still vs this round's, per pose
if a.before:
    for px in HEIGHTS:
        stills = ("idle_hero", "n1_contact", "q_stamp", "n2_pivot_black")
        rows = []
        for still in stills:
            try:
                b = ours(still, px, renders=a.before)
            except FileNotFoundError:
                continue
            rows.append(sheet([b, ours(still, px)], ["before", "round now"], 3, f"Rosace {LABEL}, {still} @ {px} px: before / now, x3"))
        W = max(r.width for r in rows)
        ba = Image.new("RGB", (W, sum(r.height for r in rows)), (22, 22, 26))
        y = 0
        for r in rows:
            ba.paste(r, (0, y))
            y += r.height
        fn = f"before_after_{px}_x3.png"
        ba.save(os.path.join(OUT, fn))
        sheets.append(fn)

# in-context: 1x game size, plain canvas, small centred character on a floor line
SKY, FLOOR, LINE = (46, 48, 62), (30, 30, 40), (84, 52, 58)
for cw, ch in ((640, 360), (960, 540)):
    for px in HEIGHTS:
        c = Image.new("RGBA", (cw, ch), SKY + (255,))
        d = ImageDraw.Draw(c)
        fy = int(ch * 0.78)
        d.rectangle([0, fy, cw, ch], fill=FLOOR + (255,))
        d.line([(cw // 2 + 40, fy), (cw, fy)], fill=LINE + (255,))     # the muted red 'go right' hint
        im = load_still("idle_hero", px)
        ax, ay = im.info["meta"]["anchor"]        # foot pivot on the sprite canvas
        ground_shadow(c, im, (cw // 2 - ax, fy - ay), FLOOR)
        c.alpha_composite(im, (cw // 2 - ax, fy - ay))
        fn = f"incontext_{cw}x{ch}_px{px}.png"
        c.convert("RGB").save(os.path.join(OUT, fn))
        sheets.append(fn)
        # lineup: the four key stills side by side on the same floor, 1x
        c = Image.new("RGBA", (cw, ch), SKY + (255,))
        d = ImageDraw.Draw(c)
        d.rectangle([0, fy, cw, ch], fill=FLOOR + (255,))
        stills = ("idle_hero", "n1_contact", "q_stamp", "n2_pivot_black")
        ims = []
        for st in stills:
            im = load_still(st, px)
            ims.append((im, im.info["meta"]["anchor"]))
        slot = cw // len(ims)
        for i, (im, (ax, ay)) in enumerate(ims):
            bx0, _, bx1, _ = im.getbbox()
            cx = slot * i + slot // 2 - (bx0 + bx1) // 2
            ground_shadow(c, im, (max(0, cx), fy - ay), FLOOR)
            c.alpha_composite(im, (max(0, cx), fy - ay))
        fn = f"incontext_{cw}x{ch}_lineup_px{px}.png"
        c.convert("RGB").save(os.path.join(OUT, fn))
        sheets.append(fn)
print("\n".join(os.path.join(OUT, s) for s in sheets))
