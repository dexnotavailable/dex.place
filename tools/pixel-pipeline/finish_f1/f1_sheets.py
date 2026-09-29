"""Route F1 (hi-bit painterly finish): measures and blind A/B sheets.

  python tools/pixel-pipeline/finish_f1/f1_sheets.py metrics [--root <renders>] [--presets P0,P1,P2,P3]
  python tools/pixel-pipeline/finish_f1/f1_sheets.py sheets  [--root <renders>] [--presets P0,P1,P2,P3] [--seed N]
  python tools/pixel-pipeline/finish_f1/f1_sheets.py pick    [--root <renders>] [--pick P4]   (labelled, not blind)

metrics: tools/art-construct/finish_metrics.py (the FG1 measures: chroma, value, ring, tones per material,
banding, clusters, mass) plus colour count, 2x2 checkers (PX-P23) and the 95% colour share (PX-P15) on every
preset, shot and size, beside the integrated canonical stills measured the same way -> metrics.json and a
markdown table (metrics.md) in the review folder.

sheets: per shot (idle 3/4, N1 contact, back) and size (144 at the refs' native grid; 80 beside the same ref
crops resampled to an 80 px figure, WF-P15), one letter mapping for every sheet (WF-P13): the F1 presets, the
integrated canonical still as the control (a different pose on idle and back: the canonical stills predate the
appeal poses) and refs 07, 09, 04. x3 and x1. Ours and the control stand on a contact shadow wherever the refs
show theirs (WF-P16). Black-fill silhouettes per shot (F1 and control; the refs' figure masks from the FG1
measurement where they exist). key.json records the letters, the seed, the sources and every pose sha1. The
refs are third-party: sheets go to the git-ignored review folder only.
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
sys.path.insert(0, PIPE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, "tools", "art-construct"))
import whole_sheets as ws  # noqa: E402   (ref crops, world-scale refs, sheet layout: used as a library)

BUILD = r"D:\Dex\Projects\dex-place-art\rosace\build"
ROOT = os.path.join(BUILD, "lanes", "finish-F1", "renders")
INTEGRATED = os.path.join(BUILD, "renders", "integrated")
REVIEW = os.path.join(REPO, "review", "rosace", "art", "finish", "F1")
FG = os.path.join(REPO, "review", "rosace", "art", "finish-gap")
# shot -> (integrated control still, ref crops for slots 07 / 09 / 04 and whether each matches the pose)
SHOTS = {
    "idle": ("idle_hero", {"ref07": ("07_idle", True), "ref09": ("09_idle", True), "ref04": ("04_c", True)}),
    "n1": ("n1_contact", {"ref07": ("07_attack", True), "ref09": ("09_attack", True), "ref04": ("04_l", False)}),
    "back": ("n2_pivot_black", {"ref07": ("07_idle", False), "ref09": ("09_raise", True), "ref04": ("04_c", False)}),
}
SHADOW = (82, 80, 80)       # the contact shadow on the sheet backdrop (the refs' painted ground shadow is darker grey)


def sha(p, n=12, algo="sha1"):
    return hashlib.new(algo, open(p, "rb").read()).hexdigest()[:n]


# ---------------------------------------------------------------------------- metrics
def checkers(im):
    a = np.asarray(im.convert("RGBA"))
    al = a[..., 3] > 0
    pk = (a[..., 0].astype(np.int64) << 16) | (a[..., 1].astype(np.int64) << 8) | a[..., 2]
    A, B, C, D = pk[:-1, :-1], pk[:-1, 1:], pk[1:, :-1], pk[1:, 1:]
    ok = al[:-1, :-1] & al[:-1, 1:] & al[1:, :-1] & al[1:, 1:]
    return int((ok & (A == D) & (B == C) & (A != B)).sum())


def dither_areas(im):
    """PX-P23 as rules_check.py measures it: 2x2 checker windows with a checker neighbour beside or below (two-way
    alternation; a 1:1 line only makes them along its diagonal), dilated 1 px; components of >= 12 px are
    dithered areas. Returns (two-way windows, dithered areas)."""
    from f1_post import clusters
    a = np.asarray(im.convert("RGBA"))
    al = a[..., 3] > 0
    pk = (a[..., 0].astype(np.int64) << 16) | (a[..., 1].astype(np.int64) << 8) | a[..., 2]
    A, B, C, D = pk[:-1, :-1], pk[:-1, 1:], pk[1:, :-1], pk[1:, 1:]
    ok = al[:-1, :-1] & al[:-1, 1:] & al[1:, :-1] & al[1:, 1:]
    m = np.zeros(pk.shape, bool)
    m[:-1, :-1] = ok & (A == D) & (B == C) & (A != B)
    nb = np.zeros_like(m)
    nb[1:] |= m[:-1]
    nb[:-1] |= m[1:]
    nb[:, 1:] |= m[:, :-1]
    nb[:, :-1] |= m[:, 1:]
    field = m & nb
    dil = field.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            dil |= np.roll(np.roll(field, dy, 0), dx, 1)
    lab, n = clusters(dil & al)
    sizes = np.bincount(lab.ravel())[1:] if n else []
    return int(field.sum()), int(sum(1 for z in sizes if z >= 12))


def colour_share(im):
    a = np.asarray(im.convert("RGBA"))
    px = a[a[..., 3] > 0][:, :3]
    _, cnt = np.unique(px, axis=0, return_counts=True)
    cnt = np.sort(cnt)[::-1]
    return int(len(cnt)), int(np.searchsorted(np.cumsum(cnt) / cnt.sum(), 0.95) + 1)


def metrics(root, presets):
    import finish_metrics as fm
    out = {}
    for shot, (ctl, _) in SHOTS.items():
        for px in (144, 80):
            dirs = {p: os.path.join(root, shot, f"px{px}", p) for p in presets}
            dirs["control"] = os.path.join(INTEGRATED, ctl, f"px{px}")
            for name, d in dirs.items():
                if not os.path.exists(os.path.join(d, "still.png")):
                    continue
                m = fm.measure(d)
                im = Image.open(os.path.join(d, "still.png"))
                n, n95 = colour_share(im)
                pj = os.path.join(d, "post.json")
                post = json.load(open(pj)) if os.path.exists(pj) else {}
                m.update({"colours": n, "colours_95pct": n95, "checkers_2x2": checkers(im),
                          "dither_2way_windows": dither_areas(im)[0], "dither_areas_PX-P23": dither_areas(im)[1],
                          "ring_darkest_L<0.03": post.get("ring_darkest")})
                out[f"{shot}/{px}/{name}"] = m
                print(shot, px, name, "S", m["chroma"]["median_S"], "chrom", m["chroma"]["chromatic_share"],
                      "ring", m.get("ring_near_black_L<0.06"), "band", m.get("banding_per_1000px"))
    os.makedirs(REVIEW, exist_ok=True)
    json.dump(out, open(os.path.join(REVIEW, "metrics.json"), "w"), indent=1)
    write_table(out, presets)
    return out


def write_table(M, presets):
    rows = ["| still | size | who | colours (95%) | median S | chromatic | accent | ring near-black | skin tones | "
            "dark tones | banding /1000 | cluster size | L* median | L* 20-35 | 2x2 checkers (2-way, dither areas) |",
            "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for k, m in M.items():
        shot, px, who = k.split("/")
        mat = m.get("materials", {})
        h = m["value"]["Lstar_hist_0-20_20-35_35-50_50-65_65-80_80-100"]
        rows.append(f"| {shot} | {px} | {who} | {m['colours']} ({m['colours_95pct']}) | {m['chroma']['median_S']} | "
                    f"{m['chroma']['chromatic_share']} | {m['chroma']['accent_share_S>0.6_V>0.3']} | "
                    f"{m.get('ring_near_black_L<0.06')} | {mat.get('skin', {}).get('tones90')} | "
                    f"{mat.get('dark cloth', {}).get('tones90')} | {m.get('banding_per_1000px')} | "
                    f"{m.get('cluster_px_weighted_mean')} | {m['value']['Lstar_median']} | {h[1]} | {m['checkers_2x2']} ({m['dither_2way_windows']}, {m['dither_areas_PX-P23']}) |")
    open(os.path.join(REVIEW, "metrics.md"), "w", encoding="utf-8").write(
        "# F1 metrics (finish_metrics.py + colour count + 2x2 checkers)\n\nTargets: PX-P39 median S <= 0.35, "
        "chromatic <= 0.70, accent <= 0.05; PX-P17 ring 0.50-0.75; PX-P41 skin >= 4 tones; PX-P40 dark 3-4 tones; "
        "PX-P14 banding <= 3.5; finish-gap rank 3 cluster size <= 30; PX-P23 0 checkers; PX-P15 <= 32 colours, "
        "95% in <= 20. Refs (finish-gap.md): median S 0.15-0.42, chromatic 0.35-0.67, ring 0.30-0.73, skin 5 tones, "
        "dark 3-4, banding 1.6-2.3 (despeckled), clusters 18-54.\n\n" + "\n".join(rows) + "\n")


# ---------------------------------------------------------------------------- sheets
def crop(im, pad=3):
    b = im.split()[3].getbbox()
    return im.crop((max(0, b[0] - pad), max(0, b[1] - pad), min(im.width, b[2] + pad), min(im.height, b[3] + pad)))


def grounded(still_path, px, ground_path=None):
    """ours on the sheet backdrop, standing on a contact shadow (WF-P16): the integrated chain's own
    still_ground.png when it exists, else an ellipse under the feet (weapon excluded) of 0.55 x the body
    width and 5 px (80: 3 px) tall"""
    if ground_path and os.path.exists(ground_path):
        return ws.on_bg(crop(Image.open(ground_path).convert("RGBA"), 3)), "still_ground.png"
    im = Image.open(still_path).convert("RGBA")
    a = np.asarray(im)[..., 3] > 0
    d = os.path.dirname(still_path)
    idp = os.path.join(d, "id.png")
    body = a
    if os.path.exists(idp):
        idm = np.asarray(Image.open(idp).convert("RGBA"))
        k = idm.shape[0] // a.shape[0]
        part = idm[::k, ::k, 1][:a.shape[0], :a.shape[1]]
        body = a & ~np.isin(part, (33, 34))
    ys, xs = np.nonzero(body)
    sole = ys.max()
    feet = xs[ys >= sole - max(4, px // 20)]
    cx = (feet.min() + feet.max()) / 2
    w = max(0.55 * (xs.max() - xs.min()), feet.max() - feet.min() + 6)
    h = 5 if px >= 110 else 3
    pad = int(w / 2) + 4
    canvas = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    g = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse((cx + pad - w / 2, sole + pad - h / 2 + 1, cx + pad + w / 2, sole + pad + h / 2 + 1),
                              fill=SHADOW + (255,))
    canvas.alpha_composite(g)
    canvas.alpha_composite(im, (pad, pad))
    return ws.on_bg(crop(canvas, 3)), "ellipse"


def silhouette(im):
    a = np.asarray(im.convert("RGBA"))[..., 3] > 0
    out = np.full(a.shape + (3,), 236, np.uint8)
    out[a] = 0
    return Image.fromarray(out)


def ref_sil(name, native):
    p = os.path.join(FG, f"m_{name}.npy")
    if not os.path.exists(p):
        return None
    m = np.load(p)
    if m.shape[::-1] != native.size:
        return None
    out = np.full(m.shape + (3,), 236, np.uint8)
    out[m] = 0
    return Image.fromarray(out)


def derange(items, seed, apart):
    """a shuffle that moves every entry off its listed place and never puts two of `apart` side by side"""
    rng = random.Random(seed)
    for _ in range(10000):
        p = items[:]
        rng.shuffle(p)
        if any(a == b for a, b in zip(p, items)):
            continue
        if any(p[i] in apart and p[i + 1] in apart for i in range(len(p) - 1)):
            continue
        return p
    return items


def sheets(root, presets, seed):
    slots = presets + ["control", "ref07", "ref09", "ref04"]
    # the presets and the control are "ours": keep the control apart from every preset, as WF-P15 asks for
    # ours vs control
    order = derange(slots, seed, {"control", presets[0]})
    letters = {s: chr(ord("A") + i) for i, s in enumerate(order)}
    os.makedirs(REVIEW, exist_ok=True)
    key = {"_doc": "F1 (hi-bit painterly finish) blind A/B. One letter mapping on every sheet (WF-P13). The F1 presets "
                   "are renders of the canonical build (rosace.blend) in the figure-pose lane's newest appeal pose "
                   "(idle_appeal / back_appeal) and N1 contact, through finish_f1 (f1_blender.py painterly material, "
                   "f1_post.py pixel pass); the control is the integrated canonical still (renders/integrated, the "
                   "round-2 whole-character stills), whose idle and back are the OLD poses (idle_hero, n2_pivot), so "
                   "the idle and back sheets compare finish, not pose, against it. 144 refs at their native grid; 80 "
                   "refs box-resampled to an 80 px figure and snapped to their own 48-colour palette (WF-P15). Ours "
                   "and the control stand on a contact shadow (WF-P16). Open only after writing the verdicts.",
           "question": "Which one would you pull for? Rank the letters per sheet at x3 and at 1x; at 80, which reads "
                       "best in the world? Which ones still read as pixel art at 1x (not a blurry downscale)?",
           "seed": seed, "letters": {v: k for k, v in letters.items()},
           "presets": {p: json.load(open(os.path.join(HERE, "f1.json"), encoding="utf-8"))["presets"][p] for p in presets},
           "sources": {"f1_renders": root, "control": INTEGRATED,
                       "f1_render": json.load(open(os.path.join(root, "_render.json")))},
           "ref_crops": {}, "sheets": []}
    for shot, (ctl, refs) in SHOTS.items():
        sil_panels = []
        for px in (144, 80):
            panels = {}
            for p in presets:
                sp = os.path.join(root, shot, f"px{px}", p, "still.png")
                panels[p], how = grounded(sp, px)
            cdir = os.path.join(INTEGRATED, ctl, f"px{px}")
            panels["control"], how_c = grounded(os.path.join(cdir, "still.png"), px, os.path.join(cdir, "still_ground.png"))
            for slot, (crop_name, match) in refs.items():
                panels[slot] = ws.ref_native(crop_name) if px == 144 else ws.ref_world(crop_name)[0]
                key["ref_crops"][f"{shot}_{px}_{slot}"] = {"crop": crop_name, "pose_match": match,
                                                           "file": ws.CROPS[crop_name][0], "box": ws.CROPS[crop_name][1]}
            ims = [panels[s] for s in order]
            labs = [letters[s] for s in order]
            for z in ((3, 1) if px == 144 else (3, 1)):
                sh = ws.sheet([ws.zoom(i, z) for i in ims], labs,
                              f"F1 {shot} {px}px x{z}  (letters shuffled, key.json; refs {'native' if px == 144 else 'resampled to an 80 px figure'})")
                fn = f"{shot}_{px}_x{z}.png"
                sh.save(os.path.join(REVIEW, fn))
                key["sheets"].append(fn)
            if px == 144:
                sil = [silhouette(crop(Image.open(os.path.join(root, shot, "px144", presets[0], "still.png")).convert("RGBA"))),
                       silhouette(crop(Image.open(os.path.join(cdir, "still.png")).convert("RGBA")))]
                labs_s = [letters[presets[0]] + " (all F1 presets share it)", letters["control"]]
                for slot, (crop_name, match) in refs.items():
                    rs = ref_sil(crop_name, ws.ref_native(crop_name))
                    if rs is not None:
                        sil.append(rs)
                        labs_s.append(letters[slot])
                sil_panels = (sil, labs_s)
        sh = ws.sheet([ws.zoom(i, 3) for i in sil_panels[0]], sil_panels[1], f"F1 {shot} 144 black-fill silhouettes x3")
        sh.save(os.path.join(REVIEW, f"{shot}_silhouette_144_x3.png"))
        sh = ws.sheet(sil_panels[0], sil_panels[1], f"F1 {shot} 144 silhouettes x1")
        sh.save(os.path.join(REVIEW, f"{shot}_silhouette_144_x1.png"))
        key["sheets"] += [f"{shot}_silhouette_144_x3.png", f"{shot}_silhouette_144_x1.png"]
    key["contact_shadow"] = "ours: an ellipse under the feet (0.55 x body width, 5 px at 144, 3 at 80); control: its still_ground.png"
    json.dump(key, open(os.path.join(REVIEW, "key.json"), "w"), indent=1)
    print("sheets", len(key["sheets"]), "->", REVIEW, "order", "".join(letters[s] for s in order))


def pick_sheets(root, pick):
    """labelled, NOT blind: the pick beside the control and refs 07/09/04 per shot and size, plus the pick's stills
    copied at x1 and x3, in <review>/_labelled_not_for_blind/ and <review>/pick/"""
    lab_dir = os.path.join(REVIEW, "_labelled_not_for_blind")
    pk_dir = os.path.join(REVIEW, "pick")
    os.makedirs(lab_dir, exist_ok=True)
    os.makedirs(pk_dir, exist_ok=True)
    for shot, (ctl, refs) in SHOTS.items():
        for px in (144, 80):
            sp = os.path.join(root, shot, f"px{px}", pick, "still.png")
            ours, _ = grounded(sp, px)
            cdir = os.path.join(INTEGRATED, ctl, f"px{px}")
            ctrl, _ = grounded(os.path.join(cdir, "still.png"), px, os.path.join(cdir, "still_ground.png"))
            rs = [ws.ref_native(c) if px == 144 else ws.ref_world(c)[0] for c, _ in refs.values()]
            names = [f"F1 {pick}", f"control ({ctl})"] + [f"ref {c}" for c, _ in refs.values()]
            z = 3 if px == 144 else 4
            ws.sheet([ws.zoom(i, z) for i in [ours, ctrl] + rs], names,
                     f"F1 pick {pick}, {shot} {px}px x{z} (labelled)").save(os.path.join(lab_dir, f"{shot}_{px}_x{z}.png"))
            im = Image.open(sp)
            im.save(os.path.join(pk_dir, f"{shot}_{px}.png"))
            im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(os.path.join(pk_dir, f"{shot}_{px}_x3.png"))
            Image.open(os.path.join(os.path.dirname(sp), "sil.png")).save(os.path.join(pk_dir, f"{shot}_{px}_sil.png"))
    print("pick sheets ->", lab_dir, pk_dir)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["metrics", "sheets", "pick"])
    ap.add_argument("--pick", default="P4")
    ap.add_argument("--root", default=ROOT)
    ap.add_argument("--presets", default="P0,P1,P2,P3")
    ap.add_argument("--seed", type=int, default=20261010)
    a = ap.parse_args()
    presets = a.presets.split(",")
    if a.cmd == "metrics":
        metrics(a.root, presets)
    elif a.cmd == "pick":
        pick_sheets(a.root, a.pick)
    else:
        sheets(a.root, presets, a.seed)


if __name__ == "__main__":
    main()
