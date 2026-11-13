"""Blind A/B sheets: the v2 base vs the current base, both in the same (v2 refit) outfit.

  python tools/pixel-pipeline/rosace_v2/compare_sheets.py [--seed N]
      [--v1 <build>/renders/v1match] [--v2 <build>/renders/v2refit]
      [--motion D:/Dex/Projects/dex-place-art/rosace/motion-ai/renders] [--out review/rosace/base-v2/compare]

Inputs (same poses, cameras, px, ss 4, post-process, face stamps and glyphs on both sides):
  stills  stills_v2.py on rosace_v2.blend (v2refit) and on the v1-match build (v1match,
          rosace_v2/build_v1_match.py: rosace.blend's base with the v2 refit outfit)
  motion  rosace_v2/motion_v2.py --tag v2refit / --tag v1match (round-3c N1 timing sheet)
Every sheet shows the two sides as "A" and "B" in an order drawn per sheet from --seed (random if
not given); the answer is in <out>/key.json only. Panels share one ground line (the render anchor)
and one zoom, on one background; the left block of a still sheet is native 1x, the right block
zoomed. Sheet 09 puts v2 (144) next to reference sprites 07 and 09 at their native pixel size,
positions shuffled the same way (review/ is git-ignored: the refs are third-party images).
"""
import argparse
import json
import os
import random
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
BUILD = Path(os.environ.get("ROSACE_BUILD", r"D:\Dex\Projects\dex-place-art\rosace\build"))
MOTION = Path(r"D:\Dex\Projects\dex-place-art\rosace\motion-ai\renders")
REFS = REPO / "review" / "refs" / "character" / "native"
BG = (104, 102, 98, 255)       # the motion strips' mid grey, close to the refs' own backgrounds
INK = (24, 22, 30)
PAPER = (232, 228, 220)
NAMES = {"v1": "CURRENT base (rosace.blend body+head: HairSample_Female.vrm) in the v2 refit outfit "
               "[build/scratch/rosace_v1_outfitv2.blend]",
         "v2": "v2 base (SiroinoSotai body + MMD用女性素体 head) [build/rosace_v2.blend]"}


def font(n):
    try:
        return ImageFont.load_default(size=n)
    except TypeError:
        return ImageFont.load_default()


def still(root, name, px):
    d = Path(root) / name / f"px{px}"
    meta = json.loads((d / "meta.json").read_text())
    return Image.open(d / "still.png").convert("RGBA"), tuple(meta["anchor"])


def on_ground(items, margin=3):
    """[(img, anchor)] -> same-size RGBA panels, anchors coincide, cropped to the union of content"""
    L = max(a[0] for _, a in items)
    T = max(a[1] for _, a in items)
    R = max(im.width - a[0] for im, a in items)
    B = max(im.height - a[1] for im, a in items)
    out = []
    for im, a in items:
        c = Image.new("RGBA", (L + R, T + B), (0, 0, 0, 0))
        c.alpha_composite(im, (L - a[0], T - a[1]))
        out.append(c)
    box = None
    for c in out:
        b = c.getchannel("A").getbbox()
        if b:
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    box = (max(0, box[0] - margin), max(0, box[1] - margin), min(L + R, box[2] + margin), min(T + B, box[3] + margin))
    return [c.crop(box) for c in out]


def flat(im, z=1):
    c = Image.new("RGBA", im.size, BG)
    c.alpha_composite(im)
    return c.resize((im.width * z, im.height * z), Image.NEAREST) if z != 1 else c


def header(W, title, sub):
    h = Image.new("RGB", (W, 58), INK)
    d = ImageDraw.Draw(h)
    d.text((12, 6), title, fill=PAPER, font=font(22))
    d.text((12, 34), sub, fill=(190, 184, 170), font=font(15))
    return h


def stack(parts, pad=0):
    W = max(p.width for p in parts)
    H = sum(p.height for p in parts) + pad * (len(parts) - 1)
    S = Image.new("RGB", (W, H), INK)
    y = 0
    for p in parts:
        S.paste(p, (0, y))
        y += p.height + pad
    return S


def pair_sheet(title, sub, panels, labels, zoom):
    """panels: two same-size RGBA images in display order; labels 'A','B'"""
    gap, lab = 24, 30
    w, h = panels[0].size
    nat_w = w * 2 + gap
    body_w = 16 + nat_w + 40 + (w * zoom) * 2 + gap + 16
    body_h = lab + h * zoom + 16
    S = Image.new("RGB", (body_w, body_h), INK)
    d = ImageDraw.Draw(S)
    x = 16
    for im, l in zip(panels, labels):          # native 1x
        S.paste(flat(im).convert("RGB"), (x, lab + h * zoom - h))
        d.text((x, 4), l, fill=PAPER, font=font(22))
        x += w + gap
    x = 16 + nat_w + 40
    d.text((16 + nat_w + 8, lab + h * zoom - 18), "1x|", fill=(150, 145, 135), font=font(13))
    for im, l in zip(panels, labels):          # zoomed
        S.paste(flat(im, zoom).convert("RGB"), (x, lab))
        d.text((x, 4), f"{l}   (x{zoom})", fill=PAPER, font=font(22))
        x += w * zoom + gap
    return stack([header(S.width, title, sub), S])


def motion_frames(tag, px, root):
    d = Path(root) / f"n1_r3c_{tag}" / f"px{px}"
    meta = json.loads((d / "meta.json").read_text())
    mo = meta["motion"]
    order, seen = [], set()
    for gf, lab in enumerate(mo["drawing"]):
        if lab not in seen:
            seen.add(lab)
            order.append((lab, gf, mo["sample_frame"][gf]))
    ims = {f: Image.open(d / f"sprite_{f:04d}.png").convert("RGBA") for f in set(mo["sample_frame"])}
    return meta, order, ims


def strip_sheet(title, sub, rows, labels, zoom):
    """rows: per side, list of (drawing label, RGBA) with matching columns"""
    lab_w, top, gap = 40, 22, 6
    cols = [max(r[i][1].width for r in rows) for i in range(len(rows[0]))]
    ch = max(im.height for r in rows for _, im in r)
    W = lab_w + sum(c * zoom + gap for c in cols) + 10
    H = top + len(rows) * (ch * zoom + gap) + 6
    S = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(S)
    x = lab_w
    for i, c in enumerate(cols):
        d.text((x + 2, 3), f"{i + 1}. {rows[0][i][0]}", fill=(190, 184, 170), font=font(15))
        x += c * zoom + gap
    for r, (row, l) in enumerate(zip(rows, labels)):
        y = top + r * (ch * zoom + gap)
        d.text((10, y + ch * zoom // 2 - 12), l, fill=PAPER, font=font(24))
        x = lab_w
        for (_, im), c in zip(row, cols):
            S.paste(flat(im, zoom).convert("RGB"), (x, y))
            x += c * zoom + gap
    return stack([header(W, title, sub), S])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--v1", default=str(BUILD / "renders" / "v1match"))
    ap.add_argument("--v2", default=str(BUILD / "renders" / "v2refit"))
    ap.add_argument("--motion", default=str(MOTION))
    ap.add_argument("--out", default=str(REPO / "review" / "rosace" / "base-v2" / "compare"))
    ap.add_argument("--seed", type=int, default=None)
    a = ap.parse_args()
    seed = a.seed if a.seed is not None else int.from_bytes(os.urandom(4), "little")
    rng = random.Random(seed)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    src = {"v1": a.v1, "v2": a.v2}
    key = {"seed": seed, "made": time.strftime("%Y-%m-%d %H:%M"), "sides": NAMES, "sheets": {}}

    def order():
        o = ["v1", "v2"]
        rng.shuffle(o)
        return o

    def note(fname, o, **kw):
        key["sheets"][fname] = dict({"A": o[0], "B": o[1]}, **kw)

    n = 0
    for still_name, short, what in (("idle_hero", "idle", "idle (hero idle)"), ("n1_contact", "n1_contact", "N1 contact"),
                                    ("n2_pivot_black", "back", "back view (N2 pivot, black thong)")):
        for px, zoom in ((144, 3), (80, 4)):
            n += 1
            o = order()
            items = [still(src[s], still_name, px) for s in o]
            panels = on_ground(items)
            fname = f"{n:02d}_{short}_{px}.png"
            title = f"Sheet {n:02d}  ·  {what}  ·  {px} px player height  ·  blind A/B"
            sub = f"Same outfit, pose, camera, render and post-process on both. Left: native 1x.  Right: x{zoom}."
            pair_sheet(title, sub, panels, ["A", "B"], zoom).save(out / fname)
            note(fname, o, still=still_name, px=px, files=[str(Path(src[s]) / still_name / f"px{px}" / "still.png") for s in o])
            print(out / fname)
    # N1 motion strips (every distinct drawing, first game frame of each) + a side-by-side GIF
    for px, zoom in ((144, 2), (80, 3)):
        n += 1
        o = order()
        runs = {s: motion_frames(t, px, a.motion) for s, t in (("v1", "v1match"), ("v2", "v2refit"))}
        m1, order1, _ = runs["v1"]
        _, order2, _ = runs["v2"]
        assert [x[0] for x in order1] == [x[0] for x in order2], "the two runs have different drawings"
        # put both runs on one canvas with their anchors (ground point) at the same pixel
        L = max(runs[s][0]["anchor"][0] for s in runs)
        T = max(runs[s][0]["anchor"][1] for s in runs)
        R = max(runs[s][0]["canvas"][0] - runs[s][0]["anchor"][0] for s in runs)
        B = max(runs[s][0]["canvas"][1] - runs[s][0]["anchor"][1] for s in runs)
        for s in runs:
            ax, ay = runs[s][0]["anchor"]
            for f, im in list(runs[s][2].items()):
                c = Image.new("RGBA", (L + R, T + B), (0, 0, 0, 0))
                c.alpha_composite(im, (L - ax, T - ay))
                runs[s][2][f] = c
        # one crop for the whole sheet vertically (shared ground line), per column horizontally
        allbox = None
        for s in ("v1", "v2"):
            for im in runs[s][2].values():
                b = im.getchannel("A").getbbox()
                if b:
                    allbox = b if allbox is None else (min(allbox[0], b[0]), min(allbox[1], b[1]),
                                                       max(allbox[2], b[2]), max(allbox[3], b[3]))
        rows = {s: [] for s in o}
        for i, (lab, gf, f) in enumerate(order1):
            bx = None
            for s in ("v1", "v2"):
                b = runs[s][2][f].getchannel("A").getbbox()
                if b:
                    bx = b if bx is None else (min(bx[0], b[0]), min(bx[1], b[1]), max(bx[2], b[2]), max(bx[3], b[3]))
            box = (max(0, bx[0] - 2), max(0, allbox[1] - 2), bx[2] + 2, allbox[3] + 2)
            for s in o:
                rows[s].append((f"{lab} f{gf}", runs[s][2][f].crop(box)))
        fname = f"{n:02d}_n1_strip_{px}.png"
        title = f"Sheet {n:02d}  ·  N1 motion, every drawing  ·  {px} px player height  ·  blind A/B (rows)"
        sub = (f"Round-3c N1 timing on both rigs, same hero keys, cloth springs, post-process. x{zoom}. "
               f"Column = drawing and its first game frame. Motion GIF: {fname[:-4]}.gif (A left, B right).")
        strip_sheet(title, sub, [rows[s] for s in o], ["A", "B"], zoom).save(out / fname)
        # GIF at game timing, A | B side by side on the whole-sheet crop
        mo = m1["motion"]
        box = (max(0, allbox[0] - 2), max(0, allbox[1] - 2), allbox[2] + 2, allbox[3] + 2)
        frames = []
        for gf, f in enumerate(mo["sample_frame"]):
            w, h = box[2] - box[0], box[3] - box[1]
            g = Image.new("RGBA", (w * 2 + 8, h + 14), BG)
            ImageDraw.Draw(g).text((2, 0), "A", fill=INK)
            ImageDraw.Draw(g).text((w + 10, 0), "B", fill=INK)
            for k, s in enumerate(o):
                g.alpha_composite(runs[s][2][f].crop(box), (k * (w + 8), 14))
            frames.append(g.resize((g.width * zoom, g.height * zoom), Image.NEAREST).convert("RGB"))
        pal = [fr.quantize(colors=255, method=Image.MEDIANCUT) for fr in frames]
        pal[0].save(out / f"{fname[:-4]}.gif", save_all=True, append_images=pal[1:], duration=17, loop=0)
        note(fname, o, motion="n1_r3c", px=px, gif=f"{fname[:-4]}.gif",
             runs={s: str(Path(a.motion) / f"n1_r3c_{t}" / f"px{px}") for s, t in (("v1", "v1match"), ("v2", "v2refit"))},
             drawings=[x[0] for x in order1])
        print(out / fname)
    # v2 vs the reference sprites at their native size (not a base A/B: shuffled positions only)
    n += 1
    r07 = Image.open(REFS / "07-anim-amberowl-wrench_top_native-p2.png").convert("RGBA")
    r09 = Image.open(REFS / "09-anim-amberowl-katana-cats_1x.png").convert("RGBA")
    rows = [("idle", [("v2", still(a.v2, "idle_hero", 144)[0]), ("ref07", r07.crop((55, 5, 175, 196))),
                      ("ref09", r09.crop((70, 28, 236, 220)))]),
            ("attack / N1 contact", [("v2", still(a.v2, "n1_contact", 144)[0]), ("ref07", r07.crop((180, 5, 346, 200))),
                                     ("ref09", r09.crop((432, 28, 656, 220)))])]
    zoom = 3
    blocks, refkey = [], {}
    for title, panels in rows:
        rng.shuffle(panels)
        refkey[title] = {f"P{i + 1}": p[0] for i, p in enumerate(panels)}
        h = max(im.height for _, im in panels)
        W = 16 + sum(im.width * zoom + 24 for _, im in panels)
        S = Image.new("RGB", (W, h * zoom + 40), INK)
        d = ImageDraw.Draw(S)
        x = 16
        for i, (_, im) in enumerate(panels):
            S.paste(flat(im, zoom).convert("RGB"), (x, 34 + (h - im.height) * zoom))
            d.text((x, 6), f"P{i + 1}  [{im.width}x{im.height} native]", fill=PAPER, font=font(18))
            x += im.width * zoom + 24
        blocks.append(stack([header(W, title.upper(), "native pixels, all x3"), S]))
    fname = f"{n:02d}_v2_vs_refs_144.png"
    sheet = stack([header(max(b.width for b in blocks), f"Sheet {n:02d}  ·  v2 at 144 px vs reference sprites 07 / 09 (native)",
                          "Which panel is ours? Ref 07: top half, 2x->1x. Ref 09: the artist's original size (1:1)."),
                   ] + blocks, pad=10)
    sheet.save(out / fname)
    key["sheets"][fname] = {"positions": refkey, "refs": [str(REFS / "07-anim-amberowl-wrench_top_native-p2.png"),
                                                          str(REFS / "09-anim-amberowl-katana-cats_1x.png")]}
    print(out / fname)
    (out / "key.json").write_text(json.dumps(key, indent=1, ensure_ascii=False), encoding="utf-8")
    print("key:", out / "key.json", "seed", seed)


if __name__ == "__main__":
    main()
