"""One blind judging set for the three finish routes (F1 finish, F2 proportion, F3 mass) and the current
integrated build, all in the figure-pose lane's appeal poses (plain Python, no Blender).

  python tools/pixel-pipeline/finish_judge/judge_sheets.py [--seed 20261029]

Entries (each route's kept pick, from its own lane renders; nothing is re-rendered here):
  F1       route F1 pick P4 (painterly finish, 40 colours): lanes/finish-F1/renders/<still>/px<N>/P4/still.png
           (rosace.blend + f1_blender.py + f1_post.py). It has no chain contact shadow, so this script
           draws the integrated chain's own ground (rosace_shade_stills.ground's ellipse, shading_r3g.json
           'ground' spec, boots from the F1 id pass) so all four stand on the same shadow (WF-P16).
  F2       route F2 pick H110E (head x1.10 + 144 eye stamps): lanes/finish-F2/v/H110E/.../still_ground.png
  F3       route F3 pick L (ref-14 bells, mid tabard, hair volume, drape p5): renders/finish-F3/L/...
  current  the integrated build (integrated.json 'build' + 'stills', no route overrides) in the same
           appeal poses: renders/finish-F3/control/... (run_f3.py's control)
Refs (third-party, review only): 07, 09, 04 crops from review/rosace/art/finish-gap at their native grid
for 144; for 80, resampled so the ref figure is 80 px tall (box filter, snapped to the crop's own
32-colour median-cut palette, no dither; WF-P15), via finish_f3/sheets_f3.ref().

One letter mapping on every sheet (WF-P13), panels ordered by letter, letters only on panels. The shuffle
moves every entry off its listed place and keeps each route off the panel next to 'current' (WF-P15).
Writes review/rosace/art/finish/judge/ (git-ignored: the sheets hold third-party refs) with key.json.
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
sys.path.insert(0, os.path.join(PIPE, "finish_f3"))
import sheets_f3 as F3S  # noqa: E402  (ref crops, world-scale refs, sheet layout: used as a library)

BUILD = os.environ.get("ROSACE_BUILD", r"D:\Dex\Projects\dex-place-art\rosace\build")
OUT = os.path.join(REPO, "review", "rosace", "art", "finish", "judge")
POSES = os.path.join(REPO, "art", "rosace", "poses")
PALETTE = os.path.join(REPO, "art", "rosace", "palette.json")
SHADING = os.path.join(REPO, "art", "rosace", "overrides", "global", "shading_r3g.json")
BG = F3S.BG
SIL_BG = (228, 226, 220)
STILLS = {"idle": "idle_appeal", "n1": "n1_contact", "back": "back_appeal"}
# ref slot -> crop per still (F1's table: pose-matched where a matching crop exists)
REFS = {"idle": {"ref07": "07_idle", "ref09": "09_idle", "ref04": "04_c"},
        "n1": {"ref07": "07_attack", "ref09": "09_attack", "ref04": "04_l"},
        "back": {"ref07": "07_idle", "ref09": "09_raise", "ref04": "04_c"}}
ENTRIES = ["F1", "F2", "F3", "current"]
LISTED = ENTRIES + ["ref07", "ref09", "ref04"]


def still_dir(e, s, px):
    return {"F1": os.path.join(BUILD, "lanes", "finish-F1", "renders", s, f"px{px}", "P4"),
            "F2": os.path.join(BUILD, "lanes", "finish-F2", "v", "H110E", s, f"px{px}"),
            "F3": os.path.join(BUILD, "renders", "finish-F3", "L", s, f"px{px}"),
            "current": os.path.join(BUILD, "renders", "finish-F3", "control", s, f"px{px}")}[e]


def sha(p, n=12):
    return hashlib.sha1(open(p, "rb").read()).hexdigest()[:n]


def chain_ground(still_png, boot_mask, meta):
    """rosace_shade_stills.ground() on an in-memory still: the same ellipse, spec and colour"""
    spec = json.load(open(SHADING, encoding="utf-8"))["ground"]
    im = Image.open(still_png).convert("RGBA")
    ys, xs = np.nonzero(boot_mask)
    gx, gy = meta["anchor"]
    px = meta["px"]
    if len(xs):
        low = ys >= ys.max() - max(2, int(0.06 * px))
        x0, x1 = xs[low].min(), xs[low].max()
    else:
        x0 = x1 = gx
    pad = spec.get("pad", 0.08) * px
    w = (x1 - x0) + 2 * pad
    h = min(max(2.0, w * spec.get("aspect", 0.25)), spec.get("h_max", 0.075) * px)
    cx, cy = (x0 + x1) / 2, gy + spec.get("dy", 0)
    pal = json.load(open(PALETTE, encoding="utf-8"))["colors"]
    c = tuple(int(pal[spec.get("code", "OL")][i:i + 2], 16) for i in (1, 3, 5))
    lay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(lay).ellipse((round(cx - w / 2), round(cy - h / 2), round(cx + w / 2) - 1, round(cy + h / 2) - 1),
                                fill=c + (int(round(255 * spec.get("alpha", 0.35))),))
    lay.alpha_composite(im)
    return lay


def f1_grounded(d):
    meta = json.load(open(os.path.join(d, "meta.json"), encoding="utf-8"))
    sp = os.path.join(d, "still.png")
    im = Image.open(sp).convert("RGBA")
    ids = np.asarray(Image.open(os.path.join(d, "id.png")).convert("RGBA"))
    k = ids.shape[0] // im.height
    boot = meta["materials"].get("boot", {}).get("id", 9)
    blk = (ids[:im.height * k, :im.width * k, 0] == boot) & (ids[:im.height * k, :im.width * k, 3] > 0)
    share = blk.reshape(im.height, k, im.width, k).mean((1, 3))
    mask = (share >= 0.5) & (np.asarray(im)[..., 3] > 0)
    return chain_ground(sp, mask, meta)


def crop(im, margin=3):
    b = im.getchannel("A").getbbox()
    return im.crop((max(0, b[0] - margin), max(0, b[1] - margin), min(im.width, b[2] + margin), min(im.height, b[3] + margin)))


def ours(e, s, px):
    d = still_dir(e, s, px)
    if e == "F1":
        return crop(f1_grounded(d)), {"still": os.path.join(d, "still.png"), "sha1": sha(os.path.join(d, "still.png")),
                                     "ground": "drawn here: the chain's ground ellipse (shading_r3g.json spec)"}
    p = os.path.join(d, "still_ground.png")
    return crop(Image.open(p).convert("RGBA")), {"still": p, "sha1": sha(p), "ground": "the chain's still_ground.png"}


def ours_sil(e, s, px):
    im = crop(Image.open(os.path.join(still_dir(e, s, px), "still.png")).convert("RGBA"))
    a = np.asarray(im.getchannel("A")) > 0
    o = np.zeros(a.shape + (4,), np.uint8)
    o[a] = (0, 0, 0, 255)
    return Image.fromarray(o, "RGBA")


def shuffle(rng):
    for _ in range(50000):
        o = list(LISTED)
        rng.shuffle(o)
        if any(a == b for a, b in zip(o, LISTED)):
            continue
        i = o.index("current")
        if any(0 <= j < len(o) and o[j] in ("F1", "F2", "F3") for j in (i - 1, i + 1)):
            continue
        return o
    raise SystemExit("no shuffle meets WF-P15")


def sheet(title, panels, zoom, bg=BG):
    S = F3S.sheet(title, panels, zoom, bg=bg)
    return S


def pose_record(e, s, px):
    meta = json.load(open(os.path.join(still_dir(e, s, px), "meta.json"), encoding="utf-8"))
    pf = os.path.join(POSES, STILLS[s] + ".json")
    return {"pose": STILLS[s], "meta_pose_sha1": meta.get("pose_sha1"), "pose_file_sha1_now": sha(pf),
            "yaw": meta.get("yaw"), "elev": meta.get("elev"), "px": meta.get("px")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=20261029)
    a = ap.parse_args()
    rng = random.Random(a.seed)
    order = shuffle(rng)
    letters = "ABCDEFG"
    m = {letters[i]: n for i, n in enumerate(order)}
    os.makedirs(OUT, exist_ok=True)
    key = {"_doc": "Finish-routes blind judging set (one set for F1, F2, F3 and the current build). One letter "
                   "mapping on every sheet (WF-P13); panels left to right in letter order; letters only on panels. "
                   "Every build entry is in the figure-pose lane's appeal poses (idle_appeal, back_appeal) and "
                   "n1_contact, same camera (yaw/elev in 'sources'), bust S7. Open only after writing the verdicts.",
           "question": "Which one would you pull for? Rank every letter per sheet at x3 and at x1. Which build "
                       "panels read closest to the refs' finish, head and mass at 144, and which reads best in the "
                       "world at 80? On the silhouette sheets, which is the biggest, clearest shape while the "
                       "figure still shows? Which still reads as pixel art at x1?",
           "seed": a.seed, "letters": m,
           "entries": {
               "F1": "route F1 pick P4: hi-bit painterly finish (6-tone painterly ramps, brush texture, 40-colour "
                     "per-group palette, light interior AA) on the canonical rosace.blend; PIPELINE 3.6i",
               "F2": "route F2 pick H110E: head (skull, face, hair) x1.10 about the neck-top joint + 144 eye stamps "
                     "+1 col/row, through the integrated chain; PIPELINE 3.6i (F2)",
               "F3": "route F3 pick L: ref-14 bells with the lining turned out, mid tabard with pipe folds, hair "
                     "volume, drape p5, through the integrated chain; PIPELINE 3.6j",
               "current": "control: the integrated build (art/rosace/integrated.json build + stills, no route "
                          "overrides) in the same poses: run_f3.py's control render",
               "ref07": "ref 07 crop (third-party)", "ref09": "ref 09 crop (third-party)",
               "ref04": "ref 04 crop (third-party)"},
           "confounds": [
               "Each route changes one axis on the current build, so F1 keeps current's head and cloth, F2 keeps its "
               "finish and cloth, F3 keeps its finish and head.",
               "F1 has no chain contact shadow of its own; its shadow is drawn here with the chain's ground spec, so "
               "all four stand on the same kind of shadow (WF-P16).",
               "F1 and F2 ran before author_hands' weapon pass reached the appeal stills: on the idle and back their "
               "glaive rose and blade are the 3D render's, while F3 and current carry the constructed ones "
               "(F2's H100 vs current differs only on glaive parts: 132+50 px idle, 232+58 px back at 144). N1 is "
               "identical between F2's H100 and current.",
               "F3's pose sha1 differs from the pose file by its drape patch only (drape_f3.json p5), as intended."],
           "refs": {"144": "native 1x crop", "80": "box-resampled to an 80 px figure, snapped to the crop's own "
                    "32-colour median-cut palette, no dither (WF-P15); read an 80 px 'ours is better' against "
                    "ref 05 before it counts", "crops": REFS},
           "shuffle": "WF-P15: every entry off its listed place " + str(LISTED) + "; no route next to 'current'",
           "sources": {}, "sheets": []}

    def panels(s, px, sil=False):
        P = []
        for L, n in m.items():
            if n.startswith("ref"):
                crop_name = REFS[s][n]
                im, rsil, how = F3S.ref(crop_name, px)
                key["sources"].setdefault(f"{s}_{px}", {})[L] = {"ref": crop_name, "how": how}
                if sil:
                    if rsil is not None:
                        P.append((L, rsil))
                else:
                    P.append((L, im))
            else:
                if sil:
                    P.append((L, ours_sil(n, s, px)))
                else:
                    im, src = ours(n, s, px)
                    src.update(pose_record(n, s, px))
                    key["sources"].setdefault(f"{s}_{px}", {})[L] = dict(entry=n, **src)
                    P.append((L, im))
        return P

    jobs = [("idle", 144, 3), ("idle", 144, 1), ("idle", 80, 3), ("idle", 80, 1),
            ("n1", 144, 3), ("n1", 80, 3), ("back", 144, 3), ("back", 80, 3)]
    for s, px, z in jobs:
        name = f"{s}_{px}_x{z}.png"
        sheet(f"{s} {px} px, x{z}", panels(s, px), z).save(os.path.join(OUT, name))
        key["sheets"].append(name)
    for s, px in (("idle", 144), ("idle", 80), ("n1", 144), ("back", 144)):
        name = f"sil_{s}_{px}_x3.png"
        sheet(f"silhouettes: {s} {px} px, x3 (refs with a figure mask only)", panels(s, px, sil=True), 3,
              bg=SIL_BG).save(os.path.join(OUT, name))
        key["sheets"].append(name)
    json.dump(key, open(os.path.join(OUT, "key.json"), "w", encoding="utf-8"), indent=1)
    print("order", " ".join(f"{L}" for L in m), "->", len(key["sheets"]), "sheets in", OUT)


if __name__ == "__main__":
    main()
