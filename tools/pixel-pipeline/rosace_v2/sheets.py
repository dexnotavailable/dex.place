"""v1 vs v2 bare-base review sheets from two base_search.py output folders (plain Python).

    python tools/pixel-pipeline/rosace_v2/sheets.py --a <base_v1 dir> --b <base_v2 dir> --out <dir>

Writes compare_hires.png (front / 3q / side, both bases on one scale), compare_px144_x4.png,
compare_px80_x4.png (the 1x pixel frames at 4x, DESIGN.md guides drawn), compare_px_1x.png
(true size, the way a player sees it) and compare_measure.md (the numbers side by side).
"""
import argparse
import json
import os

from PIL import Image, ImageDraw

BG = (24, 22, 34, 255)
INK = (235, 232, 245, 255)
VIEWS = ("front", "3q", "side")


def label(img, text, pad=22):
    c = Image.new("RGBA", (img.width, img.height + pad), BG)
    c.alpha_composite(img, (0, pad))
    ImageDraw.Draw(c).text((6, 5), text, fill=INK)
    return c


def on_bg(img):
    c = Image.new("RGBA", img.size, BG)
    c.alpha_composite(img.convert("RGBA"))
    return c


def row(tiles):
    W = sum(t.width for t in tiles)
    H = max(t.height for t in tiles)
    r = Image.new("RGBA", (W, H), BG)
    x = 0
    for t in tiles:
        r.alpha_composite(t, (x, H - t.height))
        x += t.width
    return r


def stack(rows):
    W = max(r.width for r in rows)
    H = sum(r.height for r in rows)
    s = Image.new("RGBA", (W, H), BG)
    y = 0
    for r in rows:
        s.alpha_composite(r, (0, y))
        y += r.height
    return s


def meta(d):
    return json.load(open(os.path.join(d, "measure.json"), encoding="utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--a", required=True)
    ap.add_argument("--b", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    sets = [(meta(d), d) for d in (a.a, a.b)]
    # hi-res: same pixels per metre for both (both renders frame height/0.92 in 1600 px)
    rows = []
    for m, d in sets:
        tiles = [label(on_bg(Image.open(os.path.join(d, "raw", f"hi_{v}.png"))).resize((600, 800), Image.LANCZOS), f"{m['name']} {v}")
                 for v in VIEWS]
        rows.append(row(tiles))
    stack(rows).save(os.path.join(a.out, "compare_hires.png"))
    # pixel sheets
    ones = []
    for ph in (144, 80):
        rows = []
        for m, d in sets:
            p = os.path.join(d, f"{m['name']}_px{ph}_x4.png")
            if os.path.exists(p):
                rows.append(Image.open(p).convert("RGBA"))
        if rows:
            stack(rows).save(os.path.join(a.out, f"compare_px{ph}_x4.png"))
        for m, d in sets:
            ims = [Image.open(os.path.join(d, f"{m['name']}_px{ph}_{v}.png")).convert("RGBA") for v in VIEWS
                   if os.path.exists(os.path.join(d, f"{m['name']}_px{ph}_{v}.png"))]
            if ims:
                ones.append(label(row([on_bg(i) for i in ims]), f"{m['name']} {ph}px 1x", pad=14))
    if ones:
        s = stack(ones)
        s.resize((s.width * 2, s.height * 2), Image.NEAREST).save(os.path.join(a.out, "compare_px_1x_x2.png"))
    # numbers
    keys = [("heads_tall", "heads tall", 2), ("leg_ratio", "crotch / height", 3), ("waist_to_hip", "waist / hip (front)", 3),
            ("waist_to_shoulder", "waist / shoulder (front)", 3)]
    px = ["head_len", "crotch_to_sole", "shoulder_width", "bust_width", "bust_depth", "waist_width", "hip_width",
          "thigh_top_width", "calf_width"]
    lines = ["| measure | " + " | ".join(m["name"] for m, _ in sets) + " |", "|---|" + "---|" * len(sets)]
    for k, name, nd in keys:
        lines.append(f"| {name} | " + " | ".join(str(round(m["measure"].get(k) or 0, nd)) for m, _ in sets) + " |")
    for ph in (144, 80):
        for k in px:
            lines.append(f"| {k} at {ph} px | " + " | ".join(str(m["measure"].get(f"at_{ph}px", {}).get(k, "-")) for m, _ in sets) + " |")
    open(os.path.join(a.out, "compare_measure.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
