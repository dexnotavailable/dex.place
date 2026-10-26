"""Rosace face library: hand-authored pixel stamps, placement from the render's head anchors.

The stamps are authored pixels (DESIGN.md section 5 and 12), never a downsampled 3D face and
never generated. Source of truth: art/rosace/faces/<facing>_<expr>_<px>.json

  facing  front | q34 | profile        (authored facing screen-right; mirrored for screen-left)
  expr    serene   neutral-confident, the hero face (default): open eyes, soft closed smile
                   (round 1 was half-lidded; the stills-round-2 face critique read that as sleepy)
          resolute focus / attack: lids lowered at the inner end, brows angled in, small open mouth
          radiant  smile: eyes closed into arcs, open smile
          (round 3's "rapt" skill face is retired in round 4; the skill uses radiant)
  px      96 | 128 | 144               sprite height the stamp is drawn for

A stamp file holds "rows" (one string per pixel row, '.' = leave the render alone), "origin"
([column, row] that lands on the anchor), optionally "flat" (a box, in stamp columns/rows, where
the render's S3/S4 skin shading is flattened to S2 so the face below the lash line reads as flat
anime skin, plus an optional far-jaw S3 line) and extra "key" entries. The shared key is KEY
below. Stamps are drawn after lighting and lines, masked to visible skin: a stamp pixel only
lands on a pixel whose material is skin, except the characters in REACH: lashes, brows and the
bang notch may also land on hair next to skin (refs 07-09 draw lashes and brows over the
fringe), and the contour characters (cheek bump, chin, profile nose and lips) may land on any
pixel next to skin.

Placement (anchor tracking from the spike, extended): the projected midpoint of the two eye
bones, pushed along the head's screen-space forward vector by SURFACE_M (bone -> face surface
depth), plus an optional per-still nudge (overrides/<still>.json "face": {"dx", "dy"}).

CLI
  python faces.py png [--review <dir>]         write faces/png/<name>.png + library sheets
  python faces.py preview --still <dir> --facing q34 --expr serene [--dx 0 --dy 0]
                          [--tag noface] --out <png> [--z 16]
"""
import argparse
import glob
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
FACES = os.path.join(REPO, "art", "rosace", "faces")
PALETTE = os.path.join(REPO, "art", "rosace", "palette.json")
REVIEW = os.path.join(REPO, "review", "rosace", "round-1")

KEY = {
    "O": "OL",   # lash line, dark contour
    "d": "I4",   # lash inner / pupil-dark
    "i": "I3",   # iris top (shadow under the lid), brows
    "a": "A2",   # iris
    "b": "A3",   # iris lower (light)
    "c": "A4",   # iris glow / lower bounce
    "h": "A5",   # catch-light
    "w": "W1",   # sclera
    "e": "W2",   # sclera in shade
    "r": "I3",   # brow (round 2: I3, drawn on skin under the bangs or through a bang notch)
    "R": "OL",   # brow drawn OVER the bangs (round 3: anime see-through brows; the bangs hid round 2's;
    #              OL because I4 vanished on the I2 fringe)
    "s": "S3",   # nose / skin shade
    "m": "S4",   # mouth, lower lash
    "p": "SB",   # blush
    "k": "S2",   # skin (clears render pixels)
    "l": "S1",   # skin highlight
    "g": "S2",   # skin notch cut into the bang edge above an eye (may land on hair near skin)
    "j": "S3",   # jaw / contour shade line
    "t": "A4",   # hair-tip azure or iris glow that may sit on hair (profile eye under the fringe)
    "n": "S2",   # skin past the rendered skin edge (3/4 cheek bump, chin point, profile nose / lips)
    "o": "OL",   # contour line past the skin edge (chin, profile nose / lips)
    "u": "S3",   # contour shade on skin (jaw / chin underside), same colour as j
    "x": None,   # erase to transparent (profile contour notches: under the nose, between the lips)
    "v": "I2",   # hair drawn over skin (a lock crossing the cheek; narrows the jaw)
}
# where a stamp character may land. Default: visible skin only. ("hair", r): also a hair pixel
# within r px of skin (lashes over the fringe tips, brows and the bang notch that makes room for
# them; refs 07-09 draw lashes over the fringe). ("any", r): any pixel, transparent included,
# within r px of skin (the face contour: cheek bump, chin point, profile nose and lips).
REACH = {"R": ("hair", 2), "O": ("hair", 1), "d": ("hair", 1), "r": ("hair", 2), "g": ("hair", 2), "t": ("hair", 1),
         "i": ("hair", 1), "v": ("any", 1),
         "n": ("any", 1), "o": ("any", 2), "x": ("any", 2)}
OVER_HAIR = {k: r for k, (m, r) in REACH.items() if m == "hair"}   # round-1 name, kept for readers
FACINGS = ("front", "q34", "profile")
EXPRS = ("serene", "resolute", "radiant")   # round 4: the round-3 "rapt" skill face is retired
SIZES = (96, 128, 144)
EXPR_ALIAS = {"neutral": "serene", "confident": "serene", "focus": "resolute", "attack": "resolute",
              "smile": "radiant", "happy": "radiant", "ecstatic": "radiant", "skill": "radiant"}
SURFACE_M = 0.045          # eye bone -> face surface, metres of the model


def palette():
    return {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in json.load(open(PALETTE))["colors"].items()}


def load(facing, expr, px):
    expr = EXPR_ALIAS.get(expr, expr)
    for f, e in ((facing, expr), (facing, "serene")):
        p = os.path.join(FACES, f"{f}_{e}_{px}.json")
        if os.path.exists(p):
            st = json.load(open(p, encoding="utf-8"))
            st["_name"] = f"{f}_{e}_{px}"
            return st
    return None


def facing_of(anchors):
    """yaw bucket from the head's forward vector: front < 20 deg < q34 < 55 deg < profile < 115"""
    dot = anchors.get("head_fwd_dot_cam", 1.0)
    fx = anchors.get("head_fwd_screen", [0, 0])[0]
    yaw = math.degrees(math.atan2(abs(fx), dot))
    if yaw < 20:
        return "front", yaw
    if yaw < 55:
        return "q34", yaw
    if yaw < 115:
        return "profile", yaw
    return None, yaw


def anchor_px(meta, anchors, dx=0, dy=0):
    ss = meta.get("ss", 1)
    ex = (anchors["eye_L"][0] + anchors["eye_R"][0]) / 2 / ss
    ey = (anchors["eye_L"][1] + anchors["eye_R"][1]) / 2 / ss
    fs = anchors.get("head_fwd_screen", [0, 0])
    d = SURFACE_M * meta["ppm"]
    return int(math.floor(ex + fs[0] * d)) + dx, int(math.floor(ey + fs[1] * d)) + dy


def stamp_pixels(st, at, flip):
    """yield (x, y, char) in sprite pixels"""
    ox, oy = st["origin"]
    fd = st.get("far_dx", 0)   # round 3: per-still 3/4 compression (yaw ~45: the far half of the
    #                            face slides toward the near half; columns right of the origin move)
    for j, row in enumerate(st["rows"]):
        n = len(row)
        for i, ch in enumerate(row):
            if ch in ". ":
                continue
            if fd and i > ox:
                i += fd
            if flip:
                x = at[0] + (n - 1 - i) - (n - 1 - ox)
            else:
                x = at[0] + i - ox
            yield x, at[1] + j - oy, ch


def _grow(m, r):
    out = m.copy()
    for _ in range(r):
        g = out.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                g |= np.roll(np.roll(out, dy, 0), dx, 1)
        out = g
    return out


def apply(img, mat, st, at, flip, skin_id, hair_ids, pal=None, keep=None):
    """paint the stamp into img (H, W, 4 uint8) in place; returns the touched mask. keep: bool mask
    of pixels flatten() must not touch (round 4: hand-painted preface contour shading)"""
    pal = pal or palette()
    key = dict(KEY)
    key.update(st.get("key", {}))
    H, W = mat.shape
    skin = mat == skin_id
    near = {r: _grow(skin, r) for r in (1, 2)}
    hair = np.isin(mat, list(hair_ids))
    touched = np.zeros((H, W), bool)
    flat = st.get("flat")
    if flat:
        touched |= flatten(img, skin, st, at, flip, flat, pal, keep)
    for x, y, ch in stamp_pixels(st, at, flip):
        if not (0 <= x < W and 0 <= y < H):
            continue
        ok = skin[y, x]
        if not ok and ch in REACH:
            where, r = REACH[ch]
            ok = near[r][y, x] and (where == "any" or hair[y, x])
        if ok:
            if key[ch] is None:
                img[y, x] = 0
            else:
                img[y, x, :3] = pal[key[ch]]
                img[y, x, 3] = 255
            touched[y, x] = True
    return touched


def flatten(img, skin, st, at, flip, flat, pal, keep=None):
    """round-2 face lens: no 3D shading on the face below the lash line. Inside the stamp's
    'flat' box (stamp columns/rows, [c0, r0, c1, r1] inclusive) every skin pixel in S3/S4 becomes
    S2 (S1 stays), then 'jaw' draws one S3 line along the far-side contour from row 'jaw' down
    (far side = the side she faces; profile stamps skip it)."""
    H, W = skin.shape
    ox, oy = st["origin"]
    n = max(len(r) for r in st["rows"])
    c0, r0, c1, r1 = flat["box"]
    if flip:
        c0, c1 = n - 1 - c1, n - 1 - c0
        ox = n - 1 - ox
    x0, x1 = at[0] + c0 - ox, at[0] + c1 - ox
    y0, y1 = at[1] + r0 - oy, at[1] + r1 - oy
    s3, s4, s2, s1 = pal["S3"], pal["S4"], pal["S2"], pal["S1"]
    t = np.zeros(skin.shape, bool)
    if keep is not None:
        skin = skin & ~keep
    # round 3 face critic: the 3D-lit S1 wedge between the eyes read as a pale mask, so 's1'
    # flattens S1 too (2-tone anime skin: S2 + drawn S3 shadows only)
    src = (s3, s4, s1) if flat.get("s1") else (s3, s4)
    for y in range(max(0, y0), min(H, y1 + 1)):
        for x in range(max(0, x0), min(W, x1 + 1)):
            if skin[y, x] and tuple(img[y, x, :3]) in src:
                img[y, x, :3] = s2
                t[y, x] = True
    if flat.get("bang"):
        # 1 px S3 shadow row the bangs cast: the first skin pixel under a non-skin pixel (hair)
        for y in range(max(1, y0), min(H, y1 + 1)):
            for x in range(max(0, x0), min(W, x1 + 1)):
                if skin[y, x] and not skin[y - 1, x] and img[y - 1, x, 3]:
                    img[y, x, :3] = s3
                    t[y, x] = True
    if "jaw" in flat:
        far = -1 if flip else 1
        for y in range(max(0, at[1] + flat["jaw"] - oy), min(H, y1 + 1)):
            xs = [x for x in range(max(0, x0), min(W, x1 + 1)) if skin[y, x]]
            if not xs:
                continue
            x = max(xs) if far > 0 else min(xs)
            if 0 <= x + far < W and not skin[y, x + far]:
                img[y, x, :3] = s3
                t[y, x] = True
    return t


def stamp_image(st, pal=None):
    pal = pal or palette()
    key = dict(KEY)
    key.update(st.get("key", {}))
    h, w = len(st["rows"]), max(len(r) for r in st["rows"])
    im = np.zeros((h, w, 4), np.uint8)
    for j, row in enumerate(st["rows"]):
        for i, ch in enumerate(row):
            if ch not in ". ":
                im[j, i, :3] = pal[key[ch]] if key[ch] else (255, 0, 255)
                im[j, i, 3] = 255
    return Image.fromarray(im)


def cmd_png(review=REVIEW):
    pal = palette()
    os.makedirs(os.path.join(FACES, "png"), exist_ok=True)
    os.makedirs(review, exist_ok=True)
    names = []
    for p in sorted(glob.glob(os.path.join(FACES, "*.json"))):
        st = json.load(open(p, encoding="utf-8"))
        n = os.path.splitext(os.path.basename(p))[0]
        stamp_image(st, pal).save(os.path.join(FACES, "png", n + ".png"))
        names.append(n)
    # library sheet per size: rows = facing, columns = expression, on a skin swatch
    for px in SIZES:
        Z, cell = 10, 24
        rowh = 16 + 20 + Z * max(len(json.load(open(p, encoding="utf-8"))["rows"]) + 4
                                 for p in glob.glob(os.path.join(FACES, f"*_{px}.json")))
        W = 110 + len(EXPRS) * cell * Z
        Hh = 30 + len(FACINGS) * rowh
        sheet = Image.new("RGB", (W, Hh), (40, 40, 46))
        d = ImageDraw.Draw(sheet)
        d.text((8, 8), f"Rosace face library, {px} px sprite height, x{Z} (authored pixels on an S2 skin swatch)", fill=(230, 230, 230))
        for fi, facing in enumerate(FACINGS):
            y0 = 30 + fi * rowh
            d.text((8, y0 + 4), facing, fill=(230, 220, 160))
            for ei, expr in enumerate(EXPRS):
                x0 = 110 + ei * cell * Z
                if fi == 0:
                    d.text((x0, 18), expr, fill=(230, 220, 160))
                p = os.path.join(FACES, f"{facing}_{expr}_{px}.json")
                if not os.path.exists(p):
                    continue
                st = json.load(open(p, encoding="utf-8"))
                im = stamp_image(st, pal)
                bgc = Image.new("RGBA", (im.width + 4, im.height + 4), pal["S2"] + (255,))
                bgc.alpha_composite(im, (2, 2))
                sheet.paste(bgc.resize((bgc.width * Z, bgc.height * Z), Image.NEAREST).convert("RGB"), (x0, y0 + 16))
        sheet.save(os.path.join(review, f"face_library_{px}_x{Z}.png"))
    print("stamps", len(names))


def cmd_preview(a):
    import subprocess
    meta = json.load(open(os.path.join(a.still, "meta.json")))
    img = np.array(Image.open(os.path.join(a.still, a.tag + ".png")).convert("RGBA"))
    idm = np.asarray(Image.open(os.path.join(a.still, a.tag + "_id.png")).convert("RGBA"))
    mat = idm[..., 0].astype(int)
    mats = meta["materials"]
    an = meta["anchors"]
    facing = a.facing or facing_of(an)[0]
    st = load(facing, a.expr, meta["px"])
    at = anchor_px(meta, an, a.dx, a.dy)
    flip = an["head_fwd_screen"][0] < 0
    apply(img, mat, st, at, flip, mats["skin"]["id"], [mats[n]["id"] for n in ("hair", "hairtip")])
    tmp = a.out + ".tmp.png"
    Image.fromarray(img).save(tmp)
    r = int(meta["px"] / 11)
    subprocess.run(["python", os.path.join(HERE, "zoom.py"), tmp, str(at[0] - r), str(at[1] - r),
                    str(at[0] + r + 1), str(at[1] + r + 1), a.out, "--z", str(a.z)], check=True)
    os.remove(tmp)
    print(st["_name"], "at", at, "flip", flip)



# ------------------------------------------------------------------ v2 head (face lane, round F1)
# The v2 base (MMD head) gets construction-grid faces from tools/art-construct/face_v2.py, placed on
# the head's own projected features (author_faces_pass.py writes facepass.json + facewin.png next to
# the render). A still with no face pass keeps the stamp route above, unchanged. The face choice per
# pose lives in art/rosace/construct/faces/v2/stills.json; ROSACE_FACES=v1 forces the old stamps.
V2_DIR = os.path.join(REPO, "art", "rosace", "construct", "faces", "v2")
V2_EXPR = {"serene": "confident", "resolute": "focused", "radiant": "smile"}


F2_DIR = os.path.join(REPO, "art", "rosace", "construct", "faces", "f2")


def _route():
    """which v2 composer: ROSACE_FACES=f2 -> the face lane's round-F2 composer (face_f2.py, faces/f2/stills.json);
    anything else -> round F1 (face_v2.py, faces/v2/stills.json), the default until the Integrate step flips it"""
    return "f2" if os.environ.get("ROSACE_FACES") == "f2" else "v2"


def v2_choice(meta, ops):
    """(expr, params, facing) for this still: stills.json[pose][px] > stills.json[pose]['*'] > the ops face expr"""
    p = os.path.join(F2_DIR if _route() == "f2" else V2_DIR, "stills.json")
    table = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}
    pose = meta.get("pose") or ""
    row = table.get(pose, {})
    pick = dict(row.get("*", {}))
    pick.update(row.get(str(meta["px"]), {}))
    f = (ops or {}).get("face", {})
    expr = pick.get("expr") or V2_EXPR.get(f.get("expr") or meta.get("expression") or "serene", "confident")
    return expr, pick.get("params", {}), pick.get("facing")


def v2_face(meta, img, mat, ops, keep=None):
    """the v2 face for a still that has a face pass; None otherwise. Returns (image, touched, name)"""
    still = meta.get("_still")
    if os.environ.get("ROSACE_FACES") == "v1" or not still or not os.path.exists(os.path.join(still, "facepass.json")):
        return None
    import sys
    sys.path.insert(0, os.path.join(REPO, "tools", "art-construct"))
    if _route() == "f2":
        import face_f2 as composer
    else:
        import face_v2 as composer
    expr, params, facing = v2_choice(meta, ops)
    out, _mat, rec, log = composer.compose(still, expr, params=params, facing=facing, tag=meta.get("_tag", "noface"),
                                           base=(img, mat))
    touched = (out != img).any(-1)
    return out, touched, "v2:" + (rec.get("spec") or expr)

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["png", "preview"])
    ap.add_argument("--still")
    ap.add_argument("--facing")
    ap.add_argument("--expr", default="serene")
    ap.add_argument("--dx", type=int, default=0)
    ap.add_argument("--dy", type=int, default=0)
    ap.add_argument("--tag", default="noface")
    ap.add_argument("--out")
    ap.add_argument("--z", type=int, default=16)
    ap.add_argument("--review", default=REVIEW)
    a = ap.parse_args()
    cmd_png(a.review) if a.cmd == "png" else cmd_preview(a)
