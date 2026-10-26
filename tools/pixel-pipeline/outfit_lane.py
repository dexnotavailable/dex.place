"""Outfit lane driver (art round 1): build outfit variants to lane files, render the stills set,
measure the outfit pixels, and make part crops and blind A/B sheets against the finish-bar refs.

Never writes the canonical rosace.blend: every variant builds to
  D:/Dex/Projects/dex-place-art/rosace/build/lanes/outfit/outfit_<variant>.blend
and renders to  .../build/renders/lanes/outfit/<variant>/<still>/px<N>.
The variant is picked by the ROSACE_OUTFIT environment variable, which rosace/outfit.py reads
(outfit_art.VARIANTS holds what each one changes).

  python tools/pixel-pipeline/outfit_lane.py build r0 r1a ...      # build (one Blender at a time)
  python tools/pixel-pipeline/outfit_lane.py stills r0 r1a ...     # the stills set at 144 + 80 (+640 beauty)
  python tools/pixel-pipeline/outfit_lane.py metrics r0 r1a ...    # outfit pixel metrics -> stdout + json
  python tools/pixel-pipeline/outfit_lane.py crops r0 r1a ...      # part crops side by side (not blind)
  python tools/pixel-pipeline/outfit_lane.py ab <ours> [--control r0] --round round-1   # blind A/B sheets
  python tools/pixel-pipeline/outfit_lane.py promote <variant>      # copy a variant to lanes/outfit.blend

Round 2: a render name '<variant>@<patch>+<patch>' renders with the drape patches of
art/rosace/overrides/global/outfit/pose_patches.json merged into the pose files (copies in
<renders>/<name>/_poses; the pose files are not edited); 'px2' runs outfit_px2.py (still_ofx ->
still_o2: window, rose, sleeve crosses, stocking welt/squeeze/clips, V underside, 80 px hem);
'ab ... --tag still_o2 --ctag still_ofx' sets the control's image tag. The round-2 pick:
  build R2P; stills R2P@qtab+hair+tabn2; px ...; px2 ...; promote R2P@qtab+hair+tabn2
Round 3 (critique 6/10): R3K3 = R2Q + strap part, back-cross anchors, the K-ramp stocking with a
glossy near-black boot, the front straps further out (gar4); 'r3' renders then runs px, px2 without
the passes px3 replaces (PX2_R3), then outfit_px3.py (still_o3). The pick:
  build R3K3; r3 R3K3@qtab+hair4+tabn2; ab ... --round round-3 --tag still_o3 --ctag still_o2
  --control R2Q@qtab+hair+tabn2; promote R3K3@qtab+hair4+tabn2
Round 2b (the second critique of round 2): R2Q = R2P + the cross at the throat on a taller collar
(ccol, col2), the thong as a 1 px string (str), the tabard cross as a stamp (tabx) and the body
anchors (anc2); px2 runs the round-2b passes too (string, glute, ubust, folds, colsh, tabx, sheen,
tabsolid). The pick:
  build R2Q; stills R2Q@qtab+hair+tabn2; px ...; px2 ...; promote R2Q@qtab+hair+tabn2
"""
import argparse
import json
import os
import random
import shutil
import subprocess
import sys
import time

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
BUILD = r"D:\Dex\Projects\dex-place-art\rosace\build"
LANE = os.path.join(BUILD, "lanes", "outfit")
RENDERS = os.path.join(BUILD, "renders", "lanes", "outfit")
CANON = os.path.join(BUILD, "rosace.blend")
REVIEW = os.path.join(REPO, "review", "rosace", "art", "outfit")
NATIVE = os.path.join(REPO, "review", "refs", "character", "native")
STILLS = ["idle_hero", "n1_contact", "q_stamp", "n2_pivot_black"]
OUTFIT_MATS = ("white", "gold", "stocking", "boot", "lining", "thong", "indigo")
BACKDROP = (104, 102, 98)

sys.path.insert(0, os.path.join(REPO, "tools", "art-construct"))


def blend_of(v):
    """a render name 'variant@patch+patch' builds from the variant's blend"""
    return os.path.join(LANE, f"outfit_{v.split('@')[0]}.blend")


PATCHES = os.path.join(REPO, "art", "rosace", "overrides", "global", "outfit", "pose_patches.json")


def merge(a, b):
    out = dict(a)
    for k, v in b.items():
        out[k] = merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def patched_poses(v):
    """round 2: the pose files with the lane's drape patches (the part of v after '@') merged in,
    written to <renders>/<v>/_poses; returns that dir, or None for no patches"""
    if "@" not in v:
        return None
    names = v.split("@")[1].split("+")
    P = json.load(open(PATCHES, encoding="utf-8"))
    src = os.path.join(REPO, "art", "rosace", "poses")
    dst = os.path.join(RENDERS, v, "_poses")
    os.makedirs(dst, exist_ok=True)
    for f in os.listdir(src):
        if not f.endswith(".json"):
            continue
        pose = json.load(open(os.path.join(src, f), encoding="utf-8"))
        for n in names:
            pose = merge(pose, P[n].get(f[:-5], {}))
        json.dump(pose, open(os.path.join(dst, f), "w", encoding="utf-8"), indent=1)
    return dst


def run(cmd, env=None):
    t = time.time()
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, encoding="utf-8",
                       errors="replace", env=env)
    out = (r.stdout or "") + (r.stderr or "")
    if r.returncode != 0:
        print(out[-4000:])
        raise SystemExit(f"failed ({r.returncode}): {' '.join(map(str, cmd))[:200]}")
    return out, time.time() - t


def build(v):
    out = blend_of(v)
    assert os.path.abspath(out) != os.path.abspath(CANON)
    os.makedirs(LANE, exist_ok=True)
    env = dict(os.environ, ROSACE_OUTFIT=v)
    log, s = run([sys.executable, os.path.join(HERE, "blender_env.py"), "run", "--python-exit-code", "1",
                  "--python", os.path.join(HERE, "build_rosace_v2.py"), "--", "--out", out], env)
    lines = [ln for ln in log.splitlines() if "[outfit" in ln or "saved" in ln]
    print(f"build {v}: {s:.0f} s", *lines[-12:], sep="\n  ")


def stills(v, hi=640):
    out = os.path.join(RENDERS, v)
    poses = patched_poses(v)
    if poses:
        # stills_v2 with its pose dir swapped for the patched copies (same steps otherwise)
        code = ("import sys, runpy; sys.path.insert(0, %r); import stills_v2; stills_v2.POSES = %r; "
                "sys.argv = ['stills_v2.py'] + %r; stills_v2.main()") % (
            HERE, poses, ["--blend", blend_of(v), "--out", out, "--only", ",".join(STILLS), "--hi", str(hi), "--plain"])
        log, s = run([sys.executable, "-c", code])
    else:
        log, s = run([sys.executable, os.path.join(HERE, "stills_v2.py"), "--blend", blend_of(v), "--out", out,
                      "--only", ",".join(STILLS), "--hi", str(hi), "--plain"])
    print(f"stills {v}: {s:.0f} s -> {out}")


# ------------------------------------------------------------------------------ metrics
def load(v, still, px, tag="still"):
    d = os.path.join(RENDERS, v, still, f"px{px}")
    meta = json.load(open(os.path.join(d, "meta.json")))
    img = np.array(Image.open(os.path.join(d, tag + ".png")).convert("RGBA"))
    ids = np.array(Image.open(os.path.join(d, "noface_id.png")))
    return meta, img, ids


def codes_of(meta, img):
    cols = {k: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for k, h in meta["colors"].items()}
    names = list(cols)
    lut = {c: i for i, c in enumerate(cols.values())}
    H, W = img.shape[:2]
    lab = np.full((H, W), -1, int)
    for y in range(H):
        for x in range(W):
            if img[y, x, 3] > 0:
                lab[y, x] = lut.get(tuple(img[y, x, :3]), -2)
    return names, lab


def rel_lum(hexc):
    c = np.array([int(hexc[i:i + 2], 16) for i in (1, 3, 5)]) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return float(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2])


def metrics_one(v, still, px):
    import pixel_metrics as PM
    meta, img, ids = load(v, still, px)
    names, lab = codes_of(meta, img)
    mats = {m["id"]: n for n, m in meta["materials"].items()}
    mid = ids[..., 0]
    fig = lab >= 0
    res = {"px": int(fig.sum())}
    for n in OUTFIT_MATS + ("skin",):
        if n not in meta["materials"]:
            continue
        m = (mid == meta["materials"][n]["id"]) & fig
        if not m.any():
            continue
        cnt = {}
        for k in np.unique(lab[m]):
            if k >= 0:
                cnt[names[k]] = round(float((lab[m] == k).sum()) / m.sum(), 3)
        sub = np.where(m, lab, -1)
        pairs, _ = PM.hug_bands(sub)
        res[n] = {"px": int(m.sum()), "codes": cnt, "hug_per_1k": round(1000 * pairs / max(1, m.sum()), 2)}
    # outfit-wide banding (outfit materials only, lines excluded)
    om = np.isin(mid, [meta["materials"][n]["id"] for n in OUTFIT_MATS if n in meta["materials"]]) & fig
    pairs, _ = PM.hug_bands(np.where(om, lab, -1))
    res["outfit_hug_per_1k"] = round(1000 * pairs / max(1, om.sum()), 2)
    # white-on-white and gold/white border contrast: share of 4-neighbour pairs under 1.5:1
    lum = {k: rel_lum(h) for k, h in meta["colors"].items()}
    L = np.full(lab.shape, np.nan)
    for i, k in enumerate(names):
        L[lab == i] = lum[k]
    wid, gid, sid = (meta["materials"][n]["id"] for n in ("white", "gold", "skin"))
    low = {"gold|white": [0, 0], "skin|white": [0, 0]}
    for dy, dx in ((0, 1), (1, 0)):
        a_m, b_m = mid[:-dy or None, :-dx or None], mid[dy:, dx:]
        a_l, b_l = L[:-dy or None, :-dx or None], L[dy:, dx:]
        for key, (p, q) in (("gold|white", (gid, wid)), ("skin|white", (sid, wid))):
            sel = ((a_m == p) & (b_m == q)) | ((a_m == q) & (b_m == p))
            sel &= ~np.isnan(a_l) & ~np.isnan(b_l)
            hi, lo = np.maximum(a_l[sel], b_l[sel]), np.minimum(a_l[sel], b_l[sel])
            ratio = (hi + 0.05) / (lo + 0.05)
            low[key][0] += int((ratio < 1.5).sum())
            low[key][1] += int(sel.sum())
    res["border_under_1.5"] = {k: (round(a / b, 3) if b else None) for k, (a, b) in low.items()}
    res["colours"] = int(len(np.unique(lab[fig])))
    return res


def metrics(vs):
    allres = {}
    for v in vs:
        allres[v] = {}
        for s in STILLS:
            for px in (144, 80):
                try:
                    allres[v][f"{s}_{px}"] = metrics_one(v, s, px)
                except FileNotFoundError:
                    continue
    os.makedirs(REVIEW, exist_ok=True)
    json.dump(allres, open(os.path.join(REVIEW, "_metrics.json"), "w"), indent=1)
    # compact table
    keys = ["outfit_hug_per_1k"]
    print("variant still px | outfit hug/1k | white W1/W2/W3/W4 | gold G0/G1/G2/G3/G4 | gold|white<1.5 | skin|white<1.5")
    for v, d in allres.items():
        for k, r in d.items():
            w = r.get("white", {}).get("codes", {})
            g = r.get("gold", {}).get("codes", {})
            print(f"{v:6s} {k:20s} | {r['outfit_hug_per_1k']:5.1f} | "
                  + "/".join(f"{w.get(c, 0):.2f}" for c in ("W1", "W2", "W3", "W4")) + " | "
                  + "/".join(f"{g.get(c, 0):.2f}" for c in ("G0", "G1", "G2", "G3", "G4")) + " | "
                  + f"{r['border_under_1.5']['gold|white']} | {r['border_under_1.5']['skin|white']}")
    return allres


# ------------------------------------------------------------------------------ sheets
def on_bg(im, bg=BACKDROP):
    b = Image.new("RGBA", im.size, bg + (255,))
    b.alpha_composite(im.convert("RGBA"))
    return b.convert("RGB")


def zoom(im, z):
    return im.resize((im.width * z, im.height * z), Image.NEAREST)


def label(im, text, h=14):
    out = Image.new("RGB", (im.width, im.height + h), (40, 38, 36))
    out.paste(im, (0, h))
    ImageDraw.Draw(out).text((3, 1), text, fill=(235, 230, 220))
    return out


def hstack(ims, gap=6, bg=(40, 38, 36)):
    W = sum(i.width for i in ims) + gap * (len(ims) - 1)
    H = max(i.height for i in ims)
    out = Image.new("RGB", (W, H), bg)
    x = 0
    for i in ims:
        out.paste(i, (x, 0))
        x += i.width + gap
    return out


def vstack(ims, gap=6, bg=(40, 38, 36)):
    W = max(i.width for i in ims)
    H = sum(i.height for i in ims) + gap * (len(ims) - 1)
    out = Image.new("RGB", (W, H), bg)
    y = 0
    for i in ims:
        out.paste(i, (0, y))
        y += i.height + gap
    return out


def still_img(v, s, px, tag="still"):
    return Image.open(os.path.join(RENDERS, v, s, f"px{px}", tag + ".png")).convert("RGBA")


def part_box(v, s, px, mats, pad=2):
    """bbox of the pixels of the given materials (from the id map)"""
    meta, img, ids = load(v, s, px)
    want = [meta["materials"][n]["id"] for n in mats if n in meta["materials"]]
    m = np.isin(ids[..., 0], want) & (img[..., 3] > 0)
    ys, xs = np.nonzero(m)
    if not len(xs):
        return None
    H, W = m.shape
    return (max(0, xs.min() - pad), max(0, ys.min() - pad), min(W, xs.max() + pad + 1), min(H, ys.max() + pad + 1))


# part crops: name -> (still, how to find the box: fraction box of the canvas (x0,y0,x1,y1))
PARTS = {
    "torso_idle": ("idle_hero", (0.10, 0.18, 0.95, 0.52)),
    "legs_idle": ("idle_hero", (0.10, 0.45, 0.95, 1.0)),
    "torso_q": ("q_stamp", (0.05, 0.40, 0.95, 0.80)),
    "back_n2": ("n2_pivot_black", (0.45, 0.10, 0.95, 0.80)),
    "n1_body": ("n1_contact", (0.0, 0.0, 0.60, 1.0)),
}


def crops(vs, px_list=(144, 80), z=6):
    os.makedirs(os.path.join(REVIEW, "crops"), exist_ok=True)
    for name, (s, fb) in PARTS.items():
        for px in px_list:
            row = []
            for v in vs:
                im = on_bg(still_img(v, s, px))
                W, H = im.size
                box = (int(fb[0] * W), int(fb[1] * H), int(fb[2] * W), int(fb[3] * H))
                zz = z if px == 144 else z + 3
                row.append(label(zoom(im.crop(box), zz), f"{v} {s} {px}"))
            p = os.path.join(REVIEW, "crops", f"{name}_{px}.png")
            hstack(row).save(p)
            print(p)


# refs for the blind sheets: the finish bar (sheets.py boxes) + ref 14 costume views
REFS = {
    "ref07": ("07-anim-amberowl-wrench_bonus-originalsize_1x.png", (64, 14, 178, 196)),
    "ref08": ("08-anim-amberowl-lys-lightning_bonus-originalsize_1x.png", (180, 40, 340, 222)),
    "ref09": ("09-anim-amberowl-katana-cats_1x.png", (60, 32, 205, 215)),
    "ref04": ("04-style-grid9_native-p2.158.png", (114, 168, 230, 342)),
    "ref09_back": (None, os.path.join(REPO, "review", "rosace", "_refcrops", "r1", "r09_back.png")),
}
# (sheet, our still, ref, crop box of ours as a fraction of the canvas or None for the whole still)
AB = [
    ("idle_vs_ref09", "idle_hero", "ref09", None),
    ("idle_vs_ref04", "idle_hero", "ref04", None),
    ("idle_vs_ref08", "idle_hero", "ref08", None),
    ("n1_vs_ref07", "n1_contact", "ref07", None),
    ("back_vs_ref09back", "n2_pivot_black", "ref09_back", None),
    ("q_vs_ref09", "q_stamp", "ref09", None),
]


def ref_img(key):
    f, box = REFS[key]
    if f is None:
        return Image.open(box).convert("RGB")
    return Image.open(os.path.join(NATIVE, f)).convert("RGB").crop(box)


def ab(ours, control, rnd, seed=20261101, tag="still", ctag="still"):
    """blind sheets: per sheet, panels A/B(/C) = ours, the control (last round's drawing) and the
    ref, shuffled; key.json records which is which. x3 and x1 of the 144 still, plus x3 of the
    80 px still beside the ref at x3 (the world size), outfit crop sheets at x6."""
    out = os.path.join(REVIEW, rnd)
    os.makedirs(out, exist_ok=True)
    rng = random.Random(seed)
    key = {"_doc": "blind outfit A/B, art lane %s. 'ours' = the lane's pick, 'control' = the last "
                   "round's drawing (round 1: the canonical v2 outfit; round 2: the round-1 lane pick), "
                   "'ref' = the finish-bar crop. Panels shuffled per sheet (seed %d)." % (rnd, seed),
           "ours": ours, "control": control, "ours_tag": tag, "control_tag": ctag, "sheets": {}}
    for name, s, rk, _ in AB:
        cands = [("ours", ours), ("control", control), ("ref", None)]
        rng.shuffle(cands)
        for z, px in ((3, 144), (1, 144), (3, 80)):
            panels = []
            for i, (who, v) in enumerate(cands):
                im = ref_img(rk) if who == "ref" else on_bg(still_img(v, s, px, tag if who == "ours" else ctag))
                if who == "ref" and px == 80:
                    im = im   # the ref stays at its native grid; the 80 row shows the world size
                panels.append(label(zoom(im, z), "ABC"[i]))
            p = f"{name}_px{px}_x{z}.png"
            hstack(panels, gap=10).save(os.path.join(out, p))
            key["sheets"][p] = {"ABC"[i]: who for i, (who, v) in enumerate(cands)}
    key["ours_tag"] = tag
    json.dump(key, open(os.path.join(out, "key.json"), "w"), indent=1)
    print("sheets in", out)


# render part names -> tools/art-construct PART names (rules_check's zones and part masks)
PARTMAP = {"bodice": "torso", "collar": "collar", "tabard": "tabard", "sleeves": "sleeve_near",
           "stockings": "leg_near", "boots": "boot_near", "collar_cross": "cross", "collar_plate": "cross",
           "veil": "veil", "head": "head", "body": "torso", "gold_harness": "pelvis", "thong": "pelvis",
           "gold_arm": "arm_near", "glaive": "weapon", "glaive_glass": "weapon", "stole": "weapon",
           "gold_hair": "hair_back"}


OUTFIT_RULES = ("CL-P03", "CL-P04", "PX-P08", "PX-N05", "PX-P25", "PX-P27", "PX-P14", "PX-N08", "PX-P13",
                "PX-P16", "PX-N02")


def check(vs, tag="still", only="PX,CL"):
    """rules_check on the render stills: a sprite dir per still (sprite.png = the still, ids = the
    render's material ids, which are palette.json's = artlib MAT; parts mapped by PARTMAP). No
    pose.json, so the pose rules SKIP: this is the pixel and cloth half of the checker."""
    import artlib as A
    res = {}
    for v in vs:
        res[v] = {}
        for s in STILLS:
            for px in (144, 80):
                d = os.path.join(RENDERS, v, s, f"px{px}")
                if not os.path.exists(os.path.join(d, tag + ".png")):
                    continue
                meta = json.load(open(os.path.join(d, "meta.json")))
                ids = np.array(Image.open(os.path.join(d, "noface_id.png")))
                sd = os.path.join(RENDERS, v, "_check", f"{s}_{px}_{tag}")
                os.makedirs(sd, exist_ok=True)
                shutil.copy2(os.path.join(d, tag + ".png"), os.path.join(sd, "sprite.png"))
                mid = ids[..., 0].astype(np.uint8)
                Image.fromarray(mid, "L").save(os.path.join(sd, "sprite_ids.png"))
                pmap = np.zeros(ids.shape[:2], np.uint8)
                byid = {i: n for n, i in meta["parts"].items()}
                for pid in np.unique(ids[..., 1]):
                    n = byid.get(int(pid), "")
                    key = PARTMAP.get(n) or ("hair_back" if n.startswith("hair") else None)
                    if key:
                        pmap[ids[..., 1] == pid] = A.PART[key]
                Image.fromarray(pmap, "L").save(os.path.join(sd, "sprite_parts.png"))
                lc = meta.get("light_cam", [0.6, 0.8, 0.5])
                ln = max(1e-6, (lc[0] ** 2 + lc[1] ** 2) ** 0.5)
                json.dump({"_doc": "render still: no wireframe (pose rules error out and are ignored here)",
                           "light": [lc[0] / ln, -lc[1] / ln]}, open(os.path.join(sd, "pose.json"), "w"))
                jp = os.path.join(sd, "rules.json")
                subprocess.run([sys.executable, os.path.join(REPO, "tools", "art-construct", "rules_check.py"),
                                "--sprite", sd, "--only", only, "--json", jp], capture_output=True, text=True)
                try:
                    r = json.load(open(jp, encoding="utf-8"))
                except Exception:
                    continue
                rows = r["rules"]
                rows = rows if isinstance(rows, list) else [dict(x, id=k) for k, x in rows.items()]
                keep = {}
                for row in rows:
                    rid = row.get("id")
                    if rid in OUTFIT_RULES and "ERROR" not in str(row.get("value", row.get("measured", ""))):
                        keep[rid] = {k: row.get(k) for k in ("status", "value", "measured", "passed") if k in row}
                res[v][f"{s}_{px}"] = keep
    json.dump(res, open(os.path.join(REVIEW, f"_rules_{tag}.json"), "w"), indent=1)
    # table: status of each outfit rule per variant (144 and 80, all four stills)
    for rid in OUTFIT_RULES:
        line = []
        for v in vs:
            st = [res[v].get(k, {}).get(rid, {}) for k in res[v]]
            npass = sum(1 for x in st if str(x.get("status", "")).startswith("PASS"))
            line.append(f"{v}:{npass}/{len([x for x in st if x])}")
        print(f"{rid:7s}", "  ".join(line))
    json.dump(res, open(os.path.join(REVIEW, f"_rules_{tag}.json"), "w"), indent=1)
    return res


# part A/B: (sheet, our still, our crop as canvas fractions, ref key, ref crop as fractions of the ref box)
REFS_PART = {
    "ref09": ("09-anim-amberowl-katana-cats_1x.png", (60, 32, 205, 215)),
    "ref04p": ("04-style-grid9_native-p2.158.png", (150, 178, 215, 342)),     # the pink-haired figure: white skirt, dark thigh-highs
    "ref08": ("08-anim-amberowl-lys-lightning_bonus-originalsize_1x.png", (180, 40, 340, 222)),
    "ref09_back": (None, os.path.join(REPO, "review", "rosace", "_refcrops", "r1", "r09_back.png")),
}
AB_PARTS = [
    ("torso_vs_ref09", "idle_hero", (0.25, 0.18, 0.98, 0.50), "ref09", (0.12, 0.20, 0.92, 0.62)),
    ("torso_vs_ref04", "idle_hero", (0.25, 0.18, 0.98, 0.50), "ref04p", (0.0, 0.15, 1.0, 0.55)),
    ("legs_vs_ref04", "idle_hero", (0.25, 0.45, 0.98, 1.0), "ref04p", (0.0, 0.45, 1.0, 1.0)),
    ("legs_vs_ref08", "idle_hero", (0.25, 0.45, 0.98, 1.0), "ref08", (0.35, 0.45, 1.0, 1.0)),
    ("tabard_vs_ref09", "idle_hero", (0.25, 0.40, 0.98, 0.95), "ref09", (0.10, 0.40, 0.95, 0.95)),
    ("back_vs_ref09back", "n2_pivot_black", (0.45, 0.12, 0.95, 0.80), "ref09_back", (0.0, 0.10, 1.0, 0.85)),
    ("q_torso_vs_ref09", "q_stamp", (0.05, 0.38, 0.95, 0.80), "ref09", (0.05, 0.20, 0.95, 0.70)),
]


def frac_crop(im, fb):
    W, H = im.size
    return im.crop((int(fb[0] * W), int(fb[1] * H), int(fb[2] * W), int(fb[3] * H)))


def ab_parts(ours, control, rnd, seed=20261102, tag="still", ctag="still"):
    """blind part sheets: the same part of ours, the control and the matching ref crop, shuffled,
    at x3 and x1 (144) and x3 (80 beside the ref at x3); key.json gets a 'parts' entry"""
    out = os.path.join(REVIEW, rnd, "parts")
    os.makedirs(out, exist_ok=True)
    rng = random.Random(seed)
    kp = os.path.join(REVIEW, rnd, "key.json")
    key = json.load(open(kp)) if os.path.exists(kp) else {"ours": ours, "control": control, "sheets": {}}
    key.setdefault("parts", {})
    for name, s, fb, rk, rfb in AB_PARTS:
        cands = [("ours", ours), ("control", control), ("ref", None)]
        rng.shuffle(cands)
        f, box = REFS_PART[rk]
        rim = Image.open(box).convert("RGB") if f is None else Image.open(os.path.join(NATIVE, f)).convert("RGB").crop(box)
        rim = frac_crop(rim, rfb)
        for z, px in ((3, 144), (1, 144), (3, 80)):
            panels = []
            for i, (who, v) in enumerate(cands):
                im = rim if who == "ref" else frac_crop(on_bg(Image.open(os.path.join(
                    RENDERS, v, s, f"px{px}", (tag if who == "ours" else ctag) + ".png"))), fb)
                panels.append(label(zoom(im, z), "ABC"[i]))
            p = f"{name}_px{px}_x{z}.png"
            hstack(panels, gap=10).save(os.path.join(out, p))
            key["parts"][p] = {"ABC"[i]: who for i, (who, v) in enumerate(cands)}
    key["parts_tag"] = tag
    json.dump(key, open(kp, "w"), indent=1)
    print("part sheets in", out)


def promote(v):
    dst = os.path.join(BUILD, "lanes", "outfit.blend")
    shutil.copy2(blend_of(v), dst)
    j = os.path.splitext(blend_of(v))[0] + "_build.json"
    json.dump({"variant": v.split("@")[0], "pose_patches": v.split("@")[1].split("+") if "@" in v else [],
               "post": ["outfit_px.py", "outfit_px2.py --only " + PX2_R3, "outfit_px3.py --only " + ",".join(PX3_ALL)]
               if v.split("@")[0].startswith("R3") else ["outfit_px.py", "outfit_px2.py"]},
              open(os.path.join(BUILD, "lanes", "outfit_pick.json"), "w"), indent=1)
    if os.path.exists(j):
        shutil.copy2(j, os.path.join(BUILD, "lanes", "outfit_build.json"))
    print("promoted", v, "->", dst)


# round 3: px (still -> still_ofx), px2 without the passes px3 replaces (still_ofx -> still_o2), then
# px3 (still_o2 -> still_o3); 'r3' renders the stills first
PX2_R3 = "rose,slvx,welt,vund,hem80,string,ubust,folds,colsh,tabsolid"
PX3_ALL = ("strap", "thsel", "band3", "glute3", "sheen3", "boot3", "win3", "bust", "tabx3", "tabfold", "ykx",
           "sleeve3", "tabgold80")


def post3(v, only3=PX3_ALL, opts=None, stills_=None):
    import outfit_px
    import outfit_px2
    import outfit_px3
    lay = os.path.join(RENDERS, v, "_outfit_layers")
    for s in stills_ or STILLS:
        for px in (144, 80):
            d = os.path.join(RENDERS, v, s, f"px{px}")
            if not os.path.exists(os.path.join(d, "still.png")):
                continue
            outfit_px.run(d, layer_dir=lay)
            outfit_px2.run(d, only=PX2_R3.split(","), layer_dir=lay)
            print(v, s, px, outfit_px3.run(d, only=only3, layer_dir=lay, opts=opts))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["build", "stills", "metrics", "crops", "ab", "promote", "all", "check", "px", "px2",
                                    "px3", "r3"])
    ap.add_argument("--opts", default="{}", help="px3: JSON options for outfit_px3.run")
    ap.add_argument("--only3", default=",".join(PX3_ALL))
    ap.add_argument("--only", default="win,rose,slvx,welt,vund,hem80,glute,string,ubust,folds,colsh,tabx,sheen,tabsolid")
    ap.add_argument("--tag", default="still")
    ap.add_argument("--ctag", default="still", help="the control's image tag (round 2: still_ofx)")
    ap.add_argument("variants", nargs="*")
    ap.add_argument("--control", default="r0")
    ap.add_argument("--round", default="round-1")
    ap.add_argument("--hi", type=int, default=640)
    a = ap.parse_args()
    if a.cmd in ("build", "all"):
        for v in a.variants:
            build(v)
    if a.cmd in ("stills", "all"):
        for v in a.variants:
            stills(v, a.hi)
    if a.cmd in ("metrics", "all"):
        metrics(a.variants)
    if a.cmd == "crops":
        crops(a.variants)
    if a.cmd == "ab":
        ab(a.variants[0], a.control, a.round, tag=a.tag, ctag=a.ctag)
        ab_parts(a.variants[0], a.control, a.round, tag=a.tag, ctag=a.ctag)
    if a.cmd == "check":
        check(a.variants, a.tag)
    if a.cmd == "px":
        import outfit_px
        for v in a.variants:
            for s in STILLS:
                for px in (144, 80):
                    d = os.path.join(RENDERS, v, s, f"px{px}")
                    print(v, s, px, outfit_px.run(d, layer_dir=os.path.join(RENDERS, v, "_outfit_layers")))
    if a.cmd == "px2":
        import outfit_px2
        for v in a.variants:
            for s in STILLS:
                for px in (144, 80):
                    d = os.path.join(RENDERS, v, s, f"px{px}")
                    print(v, s, px, outfit_px2.run(d, only=a.only.split(","),
                                                  layer_dir=os.path.join(RENDERS, v, "_outfit_layers")))
    if a.cmd in ("px3", "r3"):
        for v in a.variants:
            if a.cmd == "r3":
                stills(v, a.hi)
            post3(v, a.only3.split(","), json.loads(a.opts))
    if a.cmd == "promote":
        promote(a.variants[0])


if __name__ == "__main__":
    main()
