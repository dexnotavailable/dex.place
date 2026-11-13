"""Review sheets for the Integrate step (2026-09-29): the integrated stills beside each lane's own pick,
the pre-integration canonical still and the finish-bar refs.

  python tools/pixel-pipeline/integrated_sheets.py [--renders <build>/renders/integrated]
      [--review review/rosace/art/integrated] [--seed 20261201]

Writes into --review (git-ignored; the refs are third-party and never committed):
  look/<still>_<px>_x<z>.png   NOT blind: pre-integration canonical | each lane's pick | integrated, labelled,
                               so a merge that lost a lane's change shows next to the lane's own drawing
  ab/<sheet>_px<N>_x<z>.png    blind A/B/C: integrated, the pre-integration canonical still and the ref
                               crop, shuffled per sheet (x3 and x1 at 144, x3 at 80); key.json says which is which
  stills_<px>_x<z>.png         every integrated still in one row (x3 and x1)
  heads_<px>_x<z>.png          the heads of every integrated still (x8 at 144, x10 at 80)
"""
import argparse
import json
import os
import random
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import outfit_lane as OL  # noqa: E402  (on_bg, zoom, label, hstack, vstack, ref crops)

BUILD = r"D:\Dex\Projects\dex-place-art\rosace\build"
PRE = os.path.join(BUILD, "renders", "final_v2")          # rosace_pre_artistry.blend, the last canonical stills
STILLS = ["idle_hero", "n1_contact", "q_stamp", "n2_pivot_black", "n2_pivot_white"]
# each lane's own pick still: label -> path pattern (<s> still, <px>); a lane that did not render a still is skipped
LANES = [
    ("face F2b", os.path.join(BUILD, "lanes", "face", "stills", "{s}", "px{px}", "still.png")),
    ("hair r2f@p1h", os.path.join(BUILD, "lanes", "hair", "renders", "r2f@p1h", "{s}", "px{px}", "still.png")),
    ("outfit R2Q", os.path.join(BUILD, "renders", "lanes", "outfit", "R2Q@qtab+hair+tabn2", "{s}", "px{px}",
                                "still_o2.png")),
    ("glaive-hands l5", os.path.join(BUILD, "lanes", "work", "l5_r3", "{s}", "px{px}", "still.png")),
    ("shading r3g", os.path.join(BUILD, "lanes", "shading", "r3", "g", "{s}", "px{px}", "still.png")),
]


def img(p):
    return Image.open(p).convert("RGBA")


def head_box(still_dir, px, pad=None):
    """a box round the head from the face anchors in meta.json (falls back to the top quarter)"""
    meta = json.load(open(os.path.join(still_dir, "meta.json")))
    W, H = meta.get("canvas", img(os.path.join(still_dir, "still.png")).size)
    an = meta.get("anchors") or {}
    r = pad or max(10, int(px * 0.16))
    if an.get("eye_L") and an.get("eye_R"):      # anchors are in supersampled px
        ss = meta.get("ss", 1)
        x = int((an["eye_L"][0] + an["eye_R"][0]) / 2 / ss)
        y = int((an["eye_L"][1] + an["eye_R"][1]) / 2 / ss)
        return (max(0, x - r), max(0, y - r), min(W, x + r), min(H, y + r))
    return (0, 0, W, H // 4)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--renders", default=os.path.join(BUILD, "renders", "integrated"))
    ap.add_argument("--review", default=os.path.join(REPO, "review", "rosace", "art", "integrated"))
    ap.add_argument("--seed", type=int, default=20261201)
    a = ap.parse_args()
    R, out = a.renders, a.review
    for d in ("look", "ab"):
        os.makedirs(os.path.join(out, d), exist_ok=True)

    def ours(s, px):
        return img(os.path.join(R, s, f"px{px}", "still.png"))

    # ---- look: not blind
    for s in STILLS:
        for px in (144, 80):
            cols = []
            pre = os.path.join(PRE, s, f"px{px}", "still.png")
            if os.path.exists(pre):
                cols.append(("pre-integration", img(pre)))
            for name, pat in LANES:
                p = pat.format(s=s, px=px)
                if os.path.exists(p):
                    cols.append((name, img(p)))
            cols.append(("INTEGRATED", ours(s, px)))
            for z in ((3, 1) if px == 144 else (4, 1)):
                OL.hstack([OL.label(OL.zoom(OL.on_bg(im), z), n) for n, im in cols], gap=8).save(
                    os.path.join(out, "look", f"{s}_{px}_x{z}.png"))
    # ---- every integrated still in a row, and the heads
    for px, zs in ((144, (3, 1)), (80, (4, 1))):
        for z in zs:
            OL.hstack([OL.label(OL.zoom(OL.on_bg(ours(s, px)), z), s) for s in STILLS], gap=8).save(
                os.path.join(out, f"stills_{px}_x{z}.png"))
        z = 8 if px == 144 else 10
        heads = []
        for s in STILLS:
            b = head_box(os.path.join(R, s, f"px{px}"), px)
            heads.append(OL.label(OL.zoom(OL.on_bg(ours(s, px).crop(b)), z), s))
        OL.hstack(heads, gap=8).save(os.path.join(out, f"heads_{px}_x{z}.png"))
    # ---- blind A/B/C: integrated vs the pre-integration canonical vs the ref
    rng = random.Random(a.seed)
    key = {"_doc": "Blind sheets for the Integrate step. 'ours' = the integrated canonical still (rosace.blend + "
                   "stills_v2.py), 'control' = the pre-integration canonical still (rosace_pre_artistry.blend, "
                   "renders/final_v2), 'ref' = the finish-bar crop. Panels shuffled per sheet (seed %d). Open only "
                   "after writing the verdicts." % a.seed, "renders": R, "control": PRE, "sheets": {}}
    for name, s, rk, _ in OL.AB:
        cands = ["ours", "control", "ref"]
        rng.shuffle(cands)
        for z, px in ((3, 144), (1, 144), (3, 80)):
            panels = []
            for i, who in enumerate(cands):
                if who == "ref":
                    im = OL.ref_img(rk)
                elif who == "ours":
                    im = OL.on_bg(ours(s, px))
                else:
                    im = OL.on_bg(img(os.path.join(PRE, s, f"px{px}", "still.png")))
                panels.append(OL.label(OL.zoom(im, z), "ABC"[i]))
            p = f"{name}_px{px}_x{z}.png"
            OL.hstack(panels, gap=10).save(os.path.join(out, "ab", p))
            key["sheets"][p] = {"ABC"[i]: who for i, who in enumerate(cands)}
    json.dump(key, open(os.path.join(out, "ab", "key.json"), "w"), indent=1)
    print("sheets in", out)


if __name__ == "__main__":
    main()
