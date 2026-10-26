"""Review sheets for the v2 refit stills (plain Python + Pillow).

  python tools/pixel-pipeline/rosace_v2/refit_sheets.py --v2 <renders/v2refit> [--v1 <renders/v1cmp>]
      --out review/rosace/base-v2/refit [--px 144,80] [--tag still]

Reads <dir>/<still>/px<N>/<tag>.png from stills_v2.py and writes (not blind; this is the lane's
own look, not a critic set):
  compare_px<N>_x<z>.png    per still, v1 | v2 at N px, integer zoom z (x3 at 144, x4 at 80)
  heights_v2_x3.png         v2 at 144 and at 80 side by side, each on its own native grid, x3
  lineup_1x.png             true size: v1 row and v2 row at every px, on the game's mid grey
  hires_v2.png              the hi-res beauty passes (px640), when present
  noface_vs_still_px<N>_x3.png   v2 before and after the face stamp + override layer
"""
import argparse
import os

from PIL import Image, ImageDraw

BG = (24, 22, 34, 255)
MID = (104, 102, 98, 255)          # stills_sheets.py's backdrop (near ref 09's ground)
INK = (235, 232, 245, 255)
STILLS = ["idle_hero", "n1_contact", "q_stamp", "n2_pivot_black", "n2_pivot_white"]


def load(d, still, px, tag):
    p = os.path.join(d, still, f"px{px}", f"{tag}.png")
    return Image.open(p).convert("RGBA") if os.path.exists(p) else None


def on(img, bg=MID, pad=4):
    c = Image.new("RGBA", (img.width + 2 * pad, img.height + 2 * pad), bg)
    c.alpha_composite(img, (pad, pad))
    return c


def zoom(img, z):
    return img.resize((img.width * z, img.height * z), Image.NEAREST)


def label(img, text, h=18):
    c = Image.new("RGBA", (img.width, img.height + h), BG)
    c.alpha_composite(img, (0, h))
    ImageDraw.Draw(c).text((4, 3), text, fill=INK)
    return c


def hrow(tiles, gap=8):
    tiles = [t for t in tiles if t is not None]
    W = sum(t.width for t in tiles) + gap * (len(tiles) - 1)
    H = max(t.height for t in tiles)
    r = Image.new("RGBA", (W, H), BG)
    x = 0
    for t in tiles:
        r.alpha_composite(t, (x, H - t.height))
        x += t.width + gap
    return r


def vstack(rows, gap=8):
    W = max(r.width for r in rows)
    H = sum(r.height for r in rows) + gap * (len(rows) - 1)
    s = Image.new("RGBA", (W, H), BG)
    y = 0
    for r in rows:
        s.alpha_composite(r, (0, y))
        y += r.height + gap
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--v2", required=True)
    ap.add_argument("--v1", default=None)
    ap.add_argument("--out", required=True)
    ap.add_argument("--px", default="144,80")
    ap.add_argument("--tag", default="still")
    ap.add_argument("--label", default="v2 refit")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    pxs = [int(x) for x in a.px.split(",")]
    zs = {144: 3, 80: 4}
    for px in pxs:
        z = zs.get(px, 3)
        rows = []
        for s in STILLS:
            t = [label(zoom(on(im), z), f"{who} {s} {px}px x{z}")
                 for who, d in (("v1", a.v1), ("v2", a.v2)) if d for im in [load(d, s, px, a.tag)] if im]
            if t:
                rows.append(hrow(t))
        vstack(rows).save(os.path.join(a.out, f"compare_px{px}_x{z}.png"))
        rows = []
        for s in STILLS:
            t = [label(zoom(on(im), 3), f"v2 {s} {px}px {tag} x3")
                 for tag in ("noface", a.tag) for im in [load(a.v2, s, px, tag)] if im]
            if t:
                rows.append(hrow(t))
        vstack(rows).save(os.path.join(a.out, f"noface_vs_still_px{px}_x3.png"))
    rows = []
    for s in STILLS:
        t = [label(zoom(on(im), 3), f"v2 {s} {px}px x3") for px in pxs for im in [load(a.v2, s, px, a.tag)] if im]
        if t:
            rows.append(hrow(t))
    vstack(rows).save(os.path.join(a.out, "heights_v2_x3.png"))
    # true size, the way a player sees it
    lines = []
    for who, d in (("v1", a.v1), ("v2", a.v2)):
        if not d:
            continue
        for px in pxs:
            ims = [load(d, s, px, a.tag) for s in STILLS[:4]]
            ims = [im for im in ims if im]
            H = max(im.height for im in ims) + 8
            W = sum(im.width for im in ims) + 12 * len(ims) + 60
            c = Image.new("RGBA", (W, H + 14), MID)
            ImageDraw.Draw(c).text((3, 2), f"{who} {px}px 1x", fill=INK)
            x = 6
            for im in ims:
                c.alpha_composite(im, (x, 14 + H - 4 - im.height))
                x += im.width + 12
            lines.append(c)
    one = vstack(lines, gap=4)
    one.save(os.path.join(a.out, "lineup_1x.png"))
    zoom(one, 2).save(os.path.join(a.out, "lineup_x2.png"))
    his = [label(on(im, BG), f"v2 {s} hi") for s in STILLS[:4] for im in [load(a.v2, s, 640, "beauty")] if im]
    if his:
        hrow(his).save(os.path.join(a.out, "hires_v2.png"))
    print("sheets in", a.out)


if __name__ == "__main__":
    main()
