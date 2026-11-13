"""Hair lane review sheets: the WF-P11 pick and the blind A/B pairs against the finish-bar refs.

  python tools/pixel-pipeline/hair_lane_sheets.py --round 1 --ours v3 --pick control,v3,v3_big,...

Writes review/rosace/art/hair/round-<n>/ (git-ignored):
  pick_<still>_px<N>_x3.png / _x1.png   whole figures, the candidates shuffled (seed 20260929) and lettered,
                                        refs 07/08/09 idle on the same backdrop at the same integer zoom
  pick_heads_px<N>_x6.png               the same candidates, head-and-hair crops, beside the ref heads
  ab_<still>_px<N>_vs_<ref>_x3.png      blind A/B: our hair crop (head, or the whole hair for the back
                                        view) against the matching ref crop, sides shuffled
  parts_<variant>_x6.png                part crops of the kept variant (every still, both sizes)
  key.json                              which letter / side is which (open after the verdicts)
Native pixels only; every panel on a sheet shares one integer zoom (PIPELINE 5.2).
"""
import argparse
import json
import os
import random
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, "tools", "art-construct"))
import hair_lane as L  # noqa: E402
from sheets import HEADS, NATIVE, REFS  # noqa: E402

SEED = 20260929
# ref hair crop for the back / long-hair pair: 09 frame 1, the head and the long hair to the waist
HAIR = {"ref09_hair": ("09-anim-amberowl-katana-cats_1x.png", (116, 32, 184, 132))}
BACK = (104, 102, 98, 255)          # art-construct sheets' backdrop
LABEL = (236, 232, 222, 255)


def on_back(im):
    im = im.convert("RGBA")
    bg = Image.new("RGBA", im.size, BACK)
    bg.alpha_composite(im)
    return bg


def ref(key, table):
    f, box = table[key][0], table[key][1]
    return on_back(Image.open(os.path.join(NATIVE, f)).convert("RGBA").crop(box))


def still(v, st, px, kind=None):
    m, im, ids = L.load(v, st, px)
    if kind is None:
        return on_back(im)
    return on_back(L.crop(im, L.head_box(m, ids, px, kind)))


def row_sheet(panels, zoom, title, out, pad=8):
    """panels: [(label, image)] in one row, one integer zoom, labels above"""
    ims = [(lab, p.resize((p.width * zoom, p.height * zoom), Image.NEAREST)) for lab, p in panels]
    W = sum(i.width for _, i in ims) + pad * (len(ims) + 1)
    H = max(i.height for _, i in ims) + 40
    S = Image.new("RGBA", (W, H), (46, 45, 50, 255))
    d = ImageDraw.Draw(S)
    d.text((pad, 4), title, fill=LABEL)
    x = pad
    for lab, i in ims:
        d.text((x, 20), lab, fill=LABEL)
        S.paste(i, (x, 36))
        x += i.width + pad
    S.save(out)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--round", type=int, default=1)
    ap.add_argument("--ours", default="v3", help="the variant the A/B pairs show")
    ap.add_argument("--pick", default="control,v3", help="candidates for the WF-P11 pick (control first)")
    a = ap.parse_args()
    out = os.path.join(REPO, "review", "rosace", "art", "hair", f"round-{a.round}")
    os.makedirs(out, exist_ok=True)
    rnd = random.Random(SEED)
    key = {"_doc": "Open only after writing the verdicts. pick_*: letter -> variant. ab_*: which side is ours. "
                   "Variants are rosace/hair_v3.VARIANTS names; 'control' is the v2 hair (rosace/hair.py + the "
                   "refit veil) built the same day through the same script.",
           "seed": SEED, "pick": {}, "ab": {}}
    # ---- WF-P11 pick: whole figures and heads, shuffled and lettered
    cands = a.pick.split(",")
    order = cands[:]
    rnd.shuffle(order)
    letters = {chr(65 + i): v for i, v in enumerate(order)}
    key["pick"] = letters
    refs = [("ref 07", ref("ref07_idle", REFS)), ("ref 08", ref("ref08_idle", REFS)), ("ref 09", ref("ref09_idle", REFS))]
    heads = [("ref 07", ref("ref07", HEADS)), ("ref 08", ref("ref08", HEADS)), ("ref 09", ref("ref09", HEADS))]
    for px in (144, 80):
        for st in ("idle_hero", "n1_contact"):
            panels = [(k, still(v, st, px)) for k, v in letters.items()] + (refs if st == "idle_hero" else [])
            for z in (3, 1):
                row_sheet(panels, z, f"WF-P11 pick: {st} at {px} px, x{z} (which one would you pull for?)",
                          os.path.join(out, f"pick_{st}_px{px}_x{z}.png"))
        panels = [(k, still(v, "idle_hero", px, "head")) for k, v in letters.items()] + heads
        row_sheet(panels, 6 if px == 144 else 8, f"heads, idle at {px} px", os.path.join(out, f"pick_heads_px{px}_x6.png"))
    # ---- blind A/B: our hair against the matching ref crop
    # our crop framed like the ref head crops (40 x 42 at 144: head and hair, no torso)
    pairs = [("idle_hero", "ref07", HEADS, "face"), ("idle_hero", "ref08", HEADS, "face"),
             ("n1_contact", "ref08", HEADS, "face"), ("q_stamp", "ref09", HEADS, "face"),
             ("n2_pivot_black", "ref09_hair", HAIR, "hair")]
    for px in (144, 80):
        for st, rk, table, kind in pairs:
            ours = still(a.ours, st, px, kind)
            theirs = ref(rk, table)
            ab = [ours, theirs]
            flip = rnd.random() < 0.5
            if flip:
                ab.reverse()
            name = f"ab_{st}_px{px}_vs_{rk}_x3.png"
            row_sheet([("A", ab[0]), ("B", ab[1])], 3, f"blind A/B: hair ({st}, {px} px) - which reads as finished art?",
                      os.path.join(out, name))
            key["ab"][name] = {"ours": "B" if flip else "A", "variant": a.ours, "ref": rk}
    # ---- part crops of the kept variant
    tiles = []
    for px in (144, 80):
        for st in L.STILLS:
            for kind in ("head", "hair"):
                tiles.append((f"{st} {px} {kind}", still(a.ours, st, px, kind)))
    for i in range(0, len(tiles), 4):
        row_sheet(tiles[i:i + 4], 6 if i < 8 else 8, f"part crops: {a.ours}",
                  os.path.join(out, f"parts_{a.ours}_{i // 4}_x6.png"))
    json.dump(key, open(os.path.join(out, "key.json"), "w"), indent=1)
    print("sheets in", out)


if __name__ == "__main__":
    main()
