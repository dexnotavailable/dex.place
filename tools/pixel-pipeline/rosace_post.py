"""Pixel post-process for Rosace renders (numpy + Pillow, outside Blender).

  python rosace_post.py --raw <render>/px128 [--out <dir>] [--no-face] [--no-selout] [--tag sprite]
                        [--frames]  (raw holds <pass>/####.png instead of <pass>.png)

Per frame (generalised from postprocess.py, the spike's proven steps):
 1. read beauty / id / normal / depth; each pixel -> (material id, palette code) by exact
    match against that material's ramp + spec colour (the render writes palette bytes)
 2. supersampled input: weighted-mode downsample (thin gold / edge / glass win ties)
 3. cleanup: floating singletons, 1 px holes, material orphans, 1-2 px band specks (1-3 px in
    the hair: round 1's salt-and-pepper hair), band-boundary smoothing on skin and cloth
    (notches and 1 px spurs of a tone merge into their neighbour, so terminators read as
    curves instead of stair-stepped rectangles), 1 px stocking stripes merged
 4. lines: 1 px outline outside the silhouette (OL; on the lit side the material's selout
    tone), inner lines where one part occludes another (depth step), drawn on the farther
    pixel in that material's 'inner' tone
 5. face stamp (authored pixels, art/rosace/faces/<facing>_<expression>_<size>.json, see
    faces.py) placed from the projected eye anchors, masked to visible skin
Outputs: <tag>.png (final), <tag>_albedo.png, <tag>_normal.png, <tag>_id.png (material id in
R, part id in G), <tag>_x3.png / _x6.png previews, <tag>_stats.json (colour counts, palette
check).
"""
import argparse
import glob
import json
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))

ap = argparse.ArgumentParser()
ap.add_argument("--raw", required=True)
ap.add_argument("--out", default=None)
ap.add_argument("--tag", default="sprite")
ap.add_argument("--no-face", action="store_true")
ap.add_argument("--no-clean", action="store_true")
ap.add_argument("--no-selout", action="store_true")
ap.add_argument("--frames", action="store_true")
ap.add_argument("--rim", default=None, help="bake the lit outline: 'cool:half' | 'cool:full' | 'warm:half' ...")
args = ap.parse_args()
OUT = args.out or args.raw
os.makedirs(OUT, exist_ok=True)
meta = json.load(open(os.path.join(args.raw, "meta.json")))
SS = meta.get("ss", 1)
COL = {k: np.array([int(v[i:i + 2], 16) for i in (1, 3, 5)], np.uint8) for k, v in meta["colors"].items()}
CODES = list(meta["colors"].keys())
CIDX = {c: i for i, c in enumerate(CODES)}
PALARR = np.array([COL[c] for c in CODES], np.uint8)
MATS = meta["materials"]
MID = {name: m["id"] for name, m in MATS.items()}
BYID = {m["id"]: name for name, m in MATS.items()}
# priority for the supersample vote: thin bright details survive
PRIO = np.ones(64)
for n, p in (("gold", 2.4), ("edge", 1.8), ("glass", 1.6), ("glass2", 1.6), ("glasscore", 2.5),
             ("haft", 1.7), ("hairtip", 1.3), ("thong", 1.5), ("boot", 1.1)):
    if n in MID:
        PRIO[MID[n]] = p
DARK = {MID[n] for n in ("hair", "haft", "boot", "lining", "thong", "hairtip") if n in MID}
HAIR = [MID[n] for n in ("hair", "hairtip") if n in MID]
D0, D1 = meta["depth_range"]
LC = np.array(meta["light_cam"], float)
LS = np.array([LC[0], -LC[1]])
LS /= np.linalg.norm(LS) + 1e-9
N4 = [(-1, 0), (1, 0), (0, -1), (0, 1)]
N8 = N4 + [(-1, -1), (-1, 1), (1, -1), (1, 1)]


def shift(a, dy, dx, fill=0):
    out = np.full_like(a, fill)
    h, w = a.shape[:2]
    ys0, ys1 = max(0, -dy), min(h, h - dy)
    xs0, xs1 = max(0, -dx), min(w, w - dx)
    out[ys0:ys1, xs0:xs1] = a[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx]
    return out


def load(p, f):
    path = os.path.join(args.raw, p, f"{f:04d}.png") if f is not None else os.path.join(args.raw, f"{p}.png")
    return np.asarray(Image.open(path).convert("RGBA"))


def classify(rgb, mat):
    """palette code index per pixel, matched within the material's ramp + spec colour"""
    code = np.full(mat.shape, -1, np.int32)
    for mid, name in BYID.items():
        sel = mat == mid
        if not sel.any():
            continue
        cand = list(dict.fromkeys(MATS[name]["ramp"] + ([MATS[name]["spec"]] if MATS[name].get("spec") else [])))
        pal = np.array([COL[c] for c in cand], int)
        c = rgb[sel].astype(int)
        d = ((c[:, None, :] - pal[None, :, :]) ** 2).sum(-1)
        code[sel] = np.array([CIDX[x] for x in cand])[d.argmin(1)]
    return code


def read_frame(f):
    b = load("beauty", f)
    idp = load("id", f)
    nrm = load("normal", f)
    dep = load("depth", f)
    alpha = b[..., 3] > 127
    mat = np.where(alpha, idp[..., 0], 0).astype(np.int32)
    part = np.where(alpha, idp[..., 1], 0).astype(np.int32)
    code = np.where(alpha, classify(b[..., :3], mat), -1)
    n = nrm[..., :3].astype(np.float32) / 255.0 * 2 - 1
    d = D0 + dep[..., 0].astype(np.float32) / 255.0 * (D1 - D0)
    d = np.where(alpha, d, 1e9)
    return alpha, mat, code, part, n, d


def downsample(alpha, mat, code, part, n, d, k):
    h, w = alpha.shape[0] // k, alpha.shape[1] // k
    lab = (mat * 64 + (code + 1)) * 256 + part
    lab = np.where(alpha, lab, -1)
    blk = lab[:h * k, :w * k].reshape(h, k, w, k).transpose(0, 2, 1, 3).reshape(h, w, k * k)
    wgt = np.where(blk >= 0, PRIO[np.clip(blk // 256 // 64, 0, 63)], 0.0)
    cover = (blk >= 0).mean(-1)
    best, best_s = np.full((h, w), -1, np.int64), np.zeros((h, w))
    for i in range(k * k):
        cand = blk[..., i]
        s = ((blk == cand[..., None]) * wgt).sum(-1)
        better = (cand >= 0) & (s > best_s)
        best[better] = cand[better]
        best_s[better] = s[better]
    a2 = cover >= 0.45
    best[~a2] = -1
    m2 = np.where(a2, best // 256 // 64, 0)
    c2 = np.where(a2, (best // 256) % 64 - 1, -1)
    p2 = np.where(a2, best % 256, 0)
    nb = n[:h * k, :w * k].reshape(h, k, w, k, 3).transpose(0, 2, 1, 3, 4).reshape(h, w, k * k, 3)
    db = d[:h * k, :w * k].reshape(h, k, w, k).transpose(0, 2, 1, 3).reshape(h, w, k * k)
    same = blk == best[..., None]
    n2 = (nb * same[..., None]).sum(2) / np.maximum(same.sum(-1, keepdims=True), 1)
    n2 /= np.linalg.norm(n2, axis=-1, keepdims=True) + 1e-6
    d2 = np.where(a2, np.where(same, db, 1e9).min(-1), 1e9)
    return a2, m2.astype(np.int32), c2.astype(np.int32), p2.astype(np.int32), n2, d2


def components(lab, alpha):
    h, w = lab.shape
    seen = np.zeros((h, w), bool)
    out = []
    for y0, x0 in zip(*np.nonzero(alpha)):
        if seen[y0, x0]:
            continue
        L = lab[y0, x0]
        st, pix = [(y0, x0)], []
        seen[y0, x0] = True
        while st:
            y, x = st.pop()
            pix.append((y, x))
            for dy, dx in N4:
                yy, xx = y + dy, x + dx
                if 0 <= yy < h and 0 <= xx < w and not seen[yy, xx] and alpha[yy, xx] and lab[yy, xx] == L:
                    seen[yy, xx] = True
                    st.append((yy, xx))
        out.append((L, pix))
    return out


def cleanup(alpha, mat, code, part, n, d):
    alpha = alpha.copy()
    cnt8 = sum(shift(alpha.astype(np.int8), dy, dx) for dy, dx in N8)
    alpha &= ~(alpha & (cnt8 == 0))
    cnt4 = sum(shift(alpha.astype(np.int8), dy, dx) for dy, dx in N4)
    for y, x in zip(*np.nonzero((~alpha) & (cnt4 == 4))):
        best = min(((y + dy, x + dx) for dy, dx in N4), key=lambda q: d[q])
        alpha[y, x] = True
        mat[y, x], code[y, x], part[y, x], n[y, x], d[y, x] = mat[best], code[best], part[best], n[best], d[best]
    H, W = alpha.shape
    # material orphans (not thin gold)
    for y, x in zip(*np.nonzero(alpha)):
        m = mat[y, x]
        if m == MID.get("gold"):
            continue
        same = 0
        votes = {}
        for dy, dx in N8:
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and alpha[yy, xx]:
                if mat[yy, xx] == m:
                    same += 1
                votes[(mat[yy, xx], code[yy, xx])] = votes.get((mat[yy, xx], code[yy, xx]), 0) + 1
        if same == 0 and votes:
            (mm, cc), _ = max(votes.items(), key=lambda t: t[1])
            mat[y, x], code[y, x] = mm, cc
    # band specks: <=2 px components inside the same material -> surrounding majority code
    lab = np.where(alpha, mat * 64 + code + 1, -1)
    for L, pix in components(lab, alpha):
        if len(pix) > (3 if (L // 64) in HAIR else 2):
            continue
        m = L // 64
        border, ok = {}, True
        for y, x in pix:
            for dy, dx in N4:
                yy, xx = y + dy, x + dx
                if not (0 <= yy < H and 0 <= xx < W) or not alpha[yy, xx]:
                    ok = False
                    continue
                if lab[yy, xx] == L:
                    continue
                if mat[yy, xx] != m:
                    ok = False
                    continue
                border[lab[yy, xx]] = border.get(lab[yy, xx], 0) + 1
        if border and (ok or len(pix) == 1):
            v = max(border.items(), key=lambda t: t[1])[0]
            for y, x in pix:
                code[y, x] = v % 64 - 1
    smooth_bands(alpha, mat, code)
    return alpha, mat, code, part, n, d


SMOOTH = {MID[n] for n in ("skin", "white", "stocking", "veil", "hair") if n in MID}
STRIPE = {MID[n] for n in ("stocking", "skin") if n in MID}


def smooth_bands(alpha, mat, code, passes=2):
    """straighten tone boundaries inside a material: a pixel whose 8 same-material neighbours
    are mostly (>= 6) one other tone takes that tone; 1 px vertical stripes on stockings and
    skin (a quantised-normal barcode) merge into the tone on both sides"""
    H, W = alpha.shape
    for _ in range(passes):
        new = code.copy()
        for y, x in zip(*np.nonzero(alpha & np.isin(mat, list(SMOOTH)))):
            m, c = mat[y, x], code[y, x]
            votes = {}
            same = 0
            for dy, dx in N8:
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and alpha[yy, xx] and mat[yy, xx] == m:
                    same += 1
                    votes[code[yy, xx]] = votes.get(code[yy, xx], 0) + 1
            if same < 6:
                continue
            best, nb = max(votes.items(), key=lambda t: t[1])
            if best != c and nb >= 6 and votes.get(c, 0) <= 1:
                new[y, x] = best
            elif m in STRIPE and 0 < x < W - 1:
                l, r = (y, x - 1), (y, x + 1)
                if alpha[l] and alpha[r] and mat[l] == m and mat[r] == m and code[l] == code[r] != c:
                    new[y, x] = code[l]
        code[:] = new


def colour(alpha, code):
    img = np.zeros(alpha.shape + (4,), np.uint8)
    img[alpha, :3] = PALARR[np.clip(code[alpha], 0, len(CODES) - 1)]
    img[alpha, 3] = 255
    return img


PARTS = meta.get("parts", {})
HEAD_PART = PARTS.get("head")
HAFT = MID.get("haft")


def face_flat(alpha, mat, code, part):
    """round 2 face critic: the 3D light plane showed on the face as a hard cream wedge (a pale
    mask) and a mid-face shadow. The face is 2-tone like the refs: S2 base, S3 shadow; the
    shadow only as a 1 px row under the bangs (the face stamp adds the rest)."""
    if HEAD_PART is None or "skin" not in MID:
        return
    face = alpha & (mat == MID["skin"]) & (part == HEAD_PART)
    code[face & (code == CIDX["S1"])] = CIDX["S2"]
    code[face & (code == CIDX["S4"])] = CIDX["S3"]
    # keep the shadow only as a 1 px edge on the side away from the key light (far cheek)
    away = shift(face, 0, -1 if LS[0] > 0 else 1, False)
    code[face & (code == CIDX["S3"]) & away] = CIDX["S2"]
    above_hair = shift(np.isin(mat, HAIR) & alpha, -1, 0, False)
    code[face & above_hair] = CIDX["S3"]


SELOUT_LIT = -0.25     # outline normal . light (screen); round 1-3 used 0.35 (lit arc only)
SELOUT_DOWN = 0.6      # outline pixels whose outward normal points further down than this keep OL
WHITES = {MID[n] for n in ("white", "stocking", "veil", "beige") if n in MID}
# shadow-side outline for skin: warm dark brown instead of the near-black OL (craft critic:
# the refs' skin edges are coloured; OL stays for cloth shadow sides and bottom / contact edges)
SHADOW_LINE = {"skin": "G4"}
KEEP_SINGLE = {CIDX[c] for c in ("G0", "A5", "A4", "S1", "W1") if c in CIDX}   # glints / hot spots
NO_ORPHAN = {MID[n] for n in ("glass", "glass2", "glasscore", "edge") if n in MID}


def orphan_kill(alpha, mat, code):
    """round 3 craft critic: ~100 isolated pixels per frame. A pixel whose tone matches none
    of its 8 neighbours, with 4+ neighbours of its own material, takes their majority tone;
    glints and hot spots (G0, A5, A4, S1, W1) and the glass / edge details keep their singles."""
    H, W = alpha.shape
    new = code.copy()
    for y, x in zip(*np.nonzero(alpha)):
        m, c = mat[y, x], code[y, x]
        if m in NO_ORPHAN or c in KEEP_SINGLE:
            continue
        votes, same_tone = {}, False
        for dy, dx in N8:
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and alpha[yy, xx]:
                if mat[yy, xx] == m and code[yy, xx] == c:
                    same_tone = True
                    break
                if mat[yy, xx] == m:
                    votes[code[yy, xx]] = votes.get(code[yy, xx], 0) + 1
        if same_tone or sum(votes.values()) < 4:
            continue
        new[y, x] = max(sorted(votes.items()), key=lambda t: t[1])[0]
    code[:] = new


def trim_edges(alpha, mat, code):
    """round 3 craft critic (value plan): gold G1 on white W1 is only ~0.2 L apart, so the trim
    blurs at 1x. Every gold trim line gets a dark edge on the white it sits on: the cloth pixel
    just below a gold pixel, or on its side away from the key light, drops to the cloth's
    shadow tone (the raised trim's own cast shadow); where the trim is 2+ px thick in that
    direction its lower/away pixel takes G3 as a base instead, so the line reads G1-over-G3."""
    if "gold" not in MID:
        return
    g = alpha & (mat == MID["gold"])
    away = -1 if LS[0] > 0 else 1
    new = code.copy()
    for dy, dx in ((1, 0), (0, away)):
        nb = shift(g, -dy, -dx, False)                     # pixel whose (dy, dx) predecessor is gold
        cloth = alpha & np.isin(mat, list(WHITES)) & nb
        for mid in WHITES:
            name = BYID[mid]
            lo = CIDX[MATS[name]["ramp"][1]]
            sel = cloth & (mat == mid)
            light = sel & np.isin(code, [CIDX[c] for c in MATS[name]["ramp"][2:]])
            new[light] = lo
        # thick trim: gold pixel with gold before it and cloth after it -> G3
        before = shift(g, -dy, -dx, False)
        after_cloth = shift(alpha & np.isin(mat, list(WHITES)), dy, dx, False)
        thick = g & before & after_cloth & np.isin(code, [CIDX["G1"], CIDX["G2"]])
        new[thick] = CIDX["G3"]
    code[:] = new


LIMB = [MID[n] for n in ("skin", "stocking", "boot") if n in MID]
GLAIVE_PARTS = {v for k, v in PARTS.items() if k.startswith("glaive") or k == "stole"}


def gold_fragments(alpha, mat, code, part):
    """round 4 craft critic: the harness and chest trim leave orphan 1-2 px gold fragments that
    read as glitter. 8-connected gold clusters under 3 px (off the glaive) take the majority
    material / tone around them; glints (G0) stay."""
    if "gold" not in MID:
        return
    g = alpha & (mat == MID["gold"])
    H, W = alpha.shape
    lab = np.where(g, 1, -1)
    seen = np.zeros((H, W), bool)
    for y0, x0 in zip(*np.nonzero(g)):
        if seen[y0, x0]:
            continue
        st, pix = [(y0, x0)], []
        seen[y0, x0] = True
        while st:
            y, x = st.pop()
            pix.append((y, x))
            for dy, dx in N8:
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and g[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True
                    st.append((yy, xx))
        if len(pix) >= 3 or any(part[y, x] in GLAIVE_PARTS or code[y, x] == CIDX["G0"] for y, x in pix):
            continue
        votes = {}
        for y, x in pix:
            for dy, dx in N8:
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and alpha[yy, xx] and not g[yy, xx]:
                    k = (mat[yy, xx], code[yy, xx], part[yy, xx])
                    votes[k] = votes.get(k, 0) + 1
        if not votes:
            continue
        (m, c, pt), _ = max(sorted(votes.items()), key=lambda t: t[1])
        for y, x in pix:
            mat[y, x], code[y, x], part[y, x] = m, c, pt


def lines(img, alpha, mat, code, part, d):
    H, W = alpha.shape
    out = img.copy()
    ln = np.zeros((H, W), bool)
    under_face = np.zeros((H, W), bool)
    for dy, dx in N4:
        qa = shift(alpha, dy, dx, False)
        qd = shift(d, dy, dx, 1e9)
        qp = shift(part, dy, dx, 0)
        qm = shift(mat, dy, dx, 0)
        step = qd + 0.018 < d          # 0.03 in round 1: the tabard merged with the stocking behind it
        # round 4 craft critic: no inner line where a limb crosses its own part (thigh over thigh,
        # arm over torso in the attack), so the limbs merged; the same-part depth jump that
        # counts as an overlap drops 0.12 -> 0.07 m on the body (skin, stockings, boots)
        limb = np.isin(mat, LIMB) & np.isin(qm, LIMB)
        cand = alpha & qa & (((qp != part) & step) | (qd + 0.12 < d) | (limb & (qd + 0.07 < d)))
        # a dark occluder reads on its own against a light surface; over another dark
        # surface (haft over the sleeve lining, hair over a boot) it needs the line. Round 2:
        # the haft crossing skin or cloth gets its line too (a 1 px shadow gap either side, so
        # it layers in front instead of slicing through the body as one jaggy bar)
        cand &= ~(np.isin(qm, list(DARK)) & ~np.isin(mat, list(DARK)) & (qm != HAFT))
        ln |= cand
        if HEAD_PART is not None:
            # the collar's dark trim line against the chin read as jowls / stubble (round 2)
            under_face |= cand & (qp == HEAD_PART) & (qm == MID.get("skin"))
        # hair clump separation: a nearer, different clump next to this one
        hl = alpha & qa & np.isin(mat, HAIR) & np.isin(qm, HAIR) & (qp != part) & (qd + 0.012 < d)   # 0.004 in round 1: crown noise
        ln |= hl
    inner_code = {MATS[n]["id"]: CIDX[MATS[n]["inner"]] for n in MATS}
    for mid, ci in inner_code.items():
        sel = ln & (mat == mid)
        out[sel, :3] = PALARR[ci]
    out[ln & under_face, :3] = PALARR[CIDX["S3"]]
    ring = (~alpha) & (sum(shift(alpha.astype(np.int8), dy, dx) for dy, dx in N4) > 0)
    ol = CIDX["OL"]
    for y, x in zip(*np.nonzero(ring)):
        best, ox, oy = None, 0.0, 0.0
        for dy, dx in N4:
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and alpha[yy, xx]:
                ox -= dx
                oy -= dy
                if best is None or d[yy, xx] < d[best]:
                    best = (yy, xx)
        o = np.array([ox, oy], float)
        o /= np.linalg.norm(o) + 1e-9
        m = mat[best]
        name = BYID.get(int(m))
        ci = ol
        # round 3 craft critic: 62% of the silhouette was one near-black OL line, skin included,
        # a vector-sticker look next to the refs' coloured outlines. Sel-out now covers the whole
        # lit and side-lit contour in the material's own dark tone (skin S4, white W4, gold G4);
        # OL stays only on the shadow side (facing away from the key light) and on bottom edges,
        # where the figure sits on the ground and overlaps read as contact.
        if not args.no_selout and name and m not in DARK and oy < SELOUT_DOWN:
            if float(o @ LS) > SELOUT_LIT:
                ci = CIDX[MATS[name]["selout"]]
            elif name in SHADOW_LINE:
                ci = CIDX[SHADOW_LINE[name]]
        out[y, x, :3] = PALARR[ci]
        out[y, x, 3] = 255
    if not args.no_selout:
        # a lone outline colour between two runs of another (the sel-out switching over on a
        # jaggy contour) reads as a speck: it takes its outline neighbours' colour
        ry, rx = np.nonzero(ring)
        cur = {(y, x): tuple(out[y, x, :3]) for y, x in zip(ry, rx)}
        for (y, x), c in cur.items():
            nbs = [cur[(y + dy, x + dx)] for dy, dx in N8 if (y + dy, x + dx) in cur]
            if len(nbs) >= 2 and c not in nbs:
                vals, cnt = np.unique(np.array(nbs), axis=0, return_counts=True)
                out[y, x, :3] = vals[cnt.argmax()]
    return out, ring, ln


# ---------------------------------------------------------------------------- faces
def stamp_face(img, alpha, mat, anchors, expr):
    """default face (faces.py library, anchor tracking); key stills use overrides.py instead,
    which adds the per-still facing / expression / nudge from art/rosace/overrides/"""
    import faces
    if not anchors or "eye_L" not in anchors:
        return img
    facing = faces.facing_of(anchors)[0]
    st = faces.load(facing, expr, meta["px"]) if facing else None
    if not st:
        return img
    faces.apply(img, mat, st, faces.anchor_px(meta, anchors), anchors["head_fwd_screen"][0] < 0,
                MID["skin"], HAIR)
    return img


def rim_frame(anchors):
    """knee line and head box (sprite pixels) for the rim's falloff and crown limit"""
    out = {}
    if not anchors:
        return out
    px = meta["px"]
    ks = [anchors[k][1] for k in ("knee_L", "knee_R") if k in anchors]
    if ks:
        out["knee_y"] = sum(ks) / len(ks) / SS
    if "head" in anchors:
        hx, hy = anchors["head"][0] / SS, anchors["head"][1] / SS
        out["head_box"] = (hx - 0.13 * px, hy - 0.22 * px, hx + 0.13 * px, hy + 0.03 * px)
    return out


# ---------------------------------------------------------------------------- main
def process(f, anchors):
    alpha, mat, code, part, n, d = read_frame(f)
    if SS > 1:
        alpha, mat, code, part, n, d = downsample(alpha, mat, code, part, n, d, SS)
    if not args.no_clean:
        alpha, mat, code, part, n, d = cleanup(alpha, mat, code, part, n, d)
    face_flat(alpha, mat, code, part)
    if not args.no_clean:
        gold_fragments(alpha, mat, code, part)
    trim_edges(alpha, mat, code)
    if not args.no_clean:
        orphan_kill(alpha, mat, code)
    img = colour(alpha, code)
    img, ring, ln = lines(img, alpha, mat, code, part, d)
    if not args.no_face:
        img = stamp_face(img, alpha, mat, anchors, meta.get("expression") or "serene")
    if args.rim:
        import rim
        fam, lvl = (args.rim.split(":") + ["half"])[:2]
        pal = {c: tuple(int(v) for v in COL[c]) for c in CODES}
        rim.apply(img, np.where(alpha, mat, 0), pal, {"family": fam, "level": lvl},
                  mat_names=BYID, **rim_frame(anchors))
    # albedo: lit colour of each material + the outline
    alb = np.zeros_like(img)
    for name, m in MATS.items():
        sel = alpha & (mat == m["id"])
        alb[sel, :3] = COL[m["ramp"][2]]
    alb[alpha, 3] = 255
    alb[ring] = img[ring]
    # normals: camera space, outline texels point outward
    nm = np.zeros_like(img)
    nn = n.copy()
    H, W = alpha.shape
    for y, x in zip(*np.nonzero(ring)):
        ox = oy = 0.0
        for dy, dx in N4:
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and alpha[yy, xx]:
                ox -= dx
                oy -= dy
        v = np.array([ox, -oy, 0.45])
        nn[y, x] = v / (np.linalg.norm(v) + 1e-9)
    full = alpha | ring
    nm[full, :3] = np.clip((nn[full] * 0.5 + 0.5) * 255 + 0.5, 0, 255).astype(np.uint8)
    nm[full, 3] = 255
    idm = np.zeros_like(img)
    idm[alpha, 0] = mat[alpha]
    idm[alpha, 1] = part[alpha]
    idm[alpha, 3] = 255
    return img, alb, nm, idm


def stats(img):
    a = img[..., 3] > 0
    cols = {}
    for c in map(tuple, img[a, :3]):
        cols[c] = cols.get(c, 0) + 1
    inv = {tuple(v): k for k, v in COL.items()}
    named = {inv.get(c, "#%02x%02x%02x" % c): n for c, n in sorted(cols.items(), key=lambda t: -t[1])}
    off = [k for k in named if k.startswith("#")]
    return {"colours": len(named), "off_palette": off, "counts": named}


def save_set(tag, img, alb, nm, idm):
    Image.fromarray(img).save(os.path.join(OUT, f"{tag}.png"))
    Image.fromarray(alb).save(os.path.join(OUT, f"{tag}_albedo.png"))
    Image.fromarray(nm).save(os.path.join(OUT, f"{tag}_normal.png"))
    Image.fromarray(idm).save(os.path.join(OUT, f"{tag}_id.png"))


if args.frames:
    frames = sorted(int(os.path.basename(p)[:4]) for p in glob.glob(os.path.join(args.raw, "beauty", "*.png")))
    for f in frames:
        an = (meta.get("anchors") or {}).get(str(f), meta.get("anchors"))
        img, alb, nm, idm = process(f, an)
        save_set(f"{args.tag}_{f:04d}", img, alb, nm, idm)
    print("frames", len(frames))
else:
    img, alb, nm, idm = process(None, meta.get("anchors"))
    save_set(args.tag, img, alb, nm, idm)
    im = Image.fromarray(img)
    for z in (3, 6):
        im.resize((im.width * z, im.height * z), Image.NEAREST).save(os.path.join(OUT, f"{args.tag}_x{z}.png"))
    st = stats(img)
    json.dump(st, open(os.path.join(OUT, f"{args.tag}_stats.json"), "w"), indent=1)
    print(OUT, "colours", st["colours"], "off-palette", st["off_palette"])
