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
ap.add_argument("--shade", default=None,
                help="shading lane: a preset JSON (art/rosace/overrides/global/shading_*.json) that re-bands the "
                     "materials from the light pass (rosace_shade.py). Off by default: the output is unchanged")
args = ap.parse_args()
OUT = args.out or args.raw
os.makedirs(OUT, exist_ok=True)
SHADE = json.load(open(args.shade, encoding="utf-8")) if args.shade else None
meta = json.load(open(os.path.join(args.raw, "meta.json")))
SS = meta.get("ss", 1)
_COLS = dict(meta["colors"])
if SHADE:
    # shading lane round 2: codes the palette gained after this render (K1-K3, the stocking ramp) are
    # appended after the render's own, so every existing code keeps its index; a code no render ramp
    # uses takes palette.json's current hex (it cannot matter to classify(), and a stale meta must not
    # pin a retuned colour)
    _used = {c for m in meta["materials"].values()
             for c in list(m.get("ramp", [])) + [m["spec"]["code"] if isinstance(m.get("spec"), dict) else m.get("spec")]}
    for k, v in json.load(open(os.path.join(REPO, "art", "rosace", "palette.json"), encoding="utf-8"))["colors"].items():
        if k not in _COLS or k not in _used:
            _COLS[k] = v
COL = {k: np.array([int(v[i:i + 2], 16) for i in (1, 3, 5)], np.uint8) for k, v in _COLS.items()}
CODES = list(_COLS.keys())
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
EX = None           # shading-lane passes (load_ex), carried through downsample and cleanup


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


def load_ex(f, alpha):
    """shading-lane passes when the render has them: v (continuous ramp input), ao, spec flag, and a
    fine depth (metres). Missing passes -> v from nothing (NaN) and the 8-bit depth."""
    H, W = alpha.shape
    ex = np.full((H, W, 5), np.nan, np.float32)      # v, ao, spec, fine depth, limb id (round 2)
    lp = os.path.join(args.raw, "light", f"{f:04d}.png") if f is not None else os.path.join(args.raw, "light.png")
    if os.path.exists(lp):
        li = load("light", f).astype(np.float32) / 255.0
        ex[..., 0], ex[..., 1], ex[..., 2] = li[..., 0], li[..., 1], li[..., 2]
    dp = os.path.join(args.raw, "depth2", f"{f:04d}.png") if f is not None else os.path.join(args.raw, "depth2.png")
    if os.path.exists(dp):
        d2 = load("depth2", f).astype(np.float64)
        t = d2[..., 0] / 255.0 + d2[..., 1] / 255.0 / 255.0
        ex[..., 3] = D0 + t * (D1 - D0)
        ex[..., 4] = d2[..., 2]                      # limb id (rosace_shade_lane.py LIMBS), 0 = none
    return ex


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
    global EX
    EX = load_ex(f, alpha) if args.shade else None
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
    global EX
    if EX is not None:
        # shading lane: the light pass averages over the winning label's sub-pixels (as the normals);
        # the spec flag is the share of them it fired on; the fine depth takes the nearest, like d
        C = EX.shape[-1]
        eb = EX[:h * k, :w * k].reshape(h, k, w, k, C).transpose(0, 2, 1, 3, 4).reshape(h, w, k * k, C)
        cnt = np.maximum(same.sum(-1), 1)
        e2 = np.full((h, w, C), np.nan, np.float32)
        for ch in range(3):
            e2[..., ch] = np.nansum(np.where(same, eb[..., ch], 0), -1) / cnt
        dsub = np.where(same, np.nan_to_num(eb[..., 3], nan=1e9), 1e9)
        e2[..., 3] = dsub.min(-1)
        if C > 4:
            # limb id: the winning label's nearest sub-pixel (an id, never averaged)
            e2[..., 4] = np.take_along_axis(np.nan_to_num(eb[..., 4]), dsub.argmin(-1)[..., None], -1)[..., 0]
        EX = e2
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
        if EX is not None:
            EX[y, x] = EX[best]
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
INNER_SAME, LIT_DROP, LIT_DROP_THR = {}, {}, 0.6
OL_CORNER = None
NO_INNER_UNDER, NO_INNER_ON = [], []
KEEP_SINGLE = {CIDX[c] for c in ("G0", "A5", "A4", "S1", "W1") if c in CIDX}   # glints / hot spots
NO_ORPHAN = {MID[n] for n in ("glass", "glass2", "glasscore", "edge") if n in MID}
if SHADE and SHADE.get("lines"):
    # shading lane: the preset may set the outline policy (sel-out arc, bottom cut-off, the
    # shadow-side line per material, e.g. {"skin": "S4"}); unset keys keep the values above
    _ln = SHADE["lines"]
    SELOUT_LIT = _ln.get("selout_lit", SELOUT_LIT)
    SELOUT_DOWN = _ln.get("selout_down", SELOUT_DOWN)
    SHADOW_LINE = _ln.get("shadow_line", SHADOW_LINE)
    # round 2: per-material sel-out / inner-line tones (the dark stockings: a W4 lavender sel-out
    # would ring them in a light line), and materials that count as dark for the occluder rule
    for _n, _c in _ln.get("selout", {}).items():
        if _n in MATS:
            MATS[_n] = dict(MATS[_n], selout=_c)
    for _n, _c in _ln.get("inner", {}).items():
        if _n in MATS:
            MATS[_n] = dict(MATS[_n], inner=_c)
    for _n in _ln.get("dark", []):
        if _n in MID:
            DARK.add(MID[_n])
    # round 2b (critique 16 / 14a): an inner line where a form crosses its own material (thigh over
    # thigh) takes this tone instead of the material's dark inner line, so value separates the forms,
    # not a contour; and the outline's most lit arc takes a light tone of the material (the line drops
    # out on the lit edge, as the refs' do)
    INNER_SAME = {MID[_n]: CIDX[_c] for _n, _c in _ln.get("inner_same", {}).items() if _n in MID and _c in CIDX}
    LIT_DROP = {_n: _c for _n, _c in _ln.get("lit_drop", {}).items() if _c in CIDX}
    LIT_DROP_THR = _ln.get("lit_drop_thr", 0.6)
    NO_INNER_UNDER = [MID[_n] for _n in _ln.get("no_inner_under", []) if _n in MID]
    NO_INNER_ON = [MID[_n] for _n in _ln.get("no_inner_on", ["skin"]) if _n in MID]
    # round 3 (critique 16): the outline takes the darkest shade of the fill it borders on the whole
    # contour (skin red-umber, white slate-lavender, gold umber), and the near-black OL stays only on the
    # outer corners of the shadow side (a ring pixel with <= ol_corner_nb figure pixels of its 8 on the
    # side facing away from the key light) and where she meets the ground
    OL_CORNER = _ln.get("ol_corner")


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
    occ_same = np.zeros((H, W), bool)
    occ_other = np.zeros((H, W), bool)
    occ_flush = np.zeros((H, W), bool)
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
        occ_same |= cand & (qm == mat)
        occ_other |= cand & (qm != mat) & ~np.isin(qm, NO_INNER_UNDER)
        occ_flush |= cand & np.isin(qm, NO_INNER_UNDER)
        if HEAD_PART is not None:
            # the collar's dark trim line against the chin read as jowls / stubble (round 2)
            under_face |= cand & (qp == HEAD_PART) & (qm == MID.get("skin"))
        # hair clump separation: a nearer, different clump next to this one
        hl = alpha & qa & np.isin(mat, HAIR) & np.isin(qm, HAIR) & (qp != part) & (qd + 0.012 < d)   # 0.004 in round 1: crown noise
        ln |= hl
    if SHADE and SHADE.get("lines", {}).get("no_edge_inner"):
        # shading lane round 2: an inner line pixel that also touches the silhouette (a 1 px sliver
        # between an occluder and the outline) keeps its fill: OL + inner line + trim read as a
        # double line along the outline (the far thigh beside its garter strap)
        # only a true sliver: the outline on one side and the occluding part straight across on the
        # other (an inner line that merely ends at the outline stays; dropping those made equal runs
        # along the outline, +8 hugging pairs on the idle)
        out_ = ~alpha
        other = lambda dy, dx: alpha & shift(alpha, dy, dx, False) & ((shift(mat, dy, dx, -1) != mat) | (shift(part, dy, dx, -1) != part))
        sliver = np.zeros_like(alpha)
        for dy, dx in ((0, 1), (1, 0)):
            sliver |= (shift(out_, dy, dx, True) & other(-dy, -dx)) | (shift(out_, -dy, -dx, True) & other(dy, dx))
        ln &= ~(alpha & sliver)
    if NO_INNER_UNDER:
        # round 2b: a flush strap (gold harness, garter chains) reads by its own value against the skin;
        # its inner line on the skin beside it drew a dotted stair-step along every strap
        ln &= ~(occ_flush & ~occ_other & np.isin(mat, NO_INNER_ON))
    inner_code = {MATS[n]["id"]: CIDX[MATS[n]["inner"]] for n in MATS}
    for mid, ci in inner_code.items():
        sel = ln & (mat == mid)
        out[sel, :3] = PALARR[ci]
    for mid, ci in INNER_SAME.items():
        out[ln & (mat == mid) & occ_same & ~occ_other, :3] = PALARR[ci]
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
            if name in LIT_DROP and float(o @ LS) > LIT_DROP_THR:
                ci = CIDX[LIT_DROP[name]]
            elif float(o @ LS) > SELOUT_LIT:
                ci = CIDX[MATS[name]["selout"]]
            elif name in SHADOW_LINE:
                ci = CIDX[SHADOW_LINE[name]]
                if OL_CORNER is not None and float(o @ LS) < OL_CORNER.get("thr", -0.35):
                    nb8 = sum(1 for dy, dx in N8 if 0 <= y + dy < H and 0 <= x + dx < W and alpha[y + dy, x + dx])
                    if nb8 <= OL_CORNER.get("nb", 2):
                        ci = ol
        out[y, x, :3] = PALARR[ci]
        out[y, x, 3] = 255
    if not args.no_selout:
        # a lone outline colour between two runs of another (the sel-out switching over on a
        # jaggy contour) reads as a speck: it takes its outline neighbours' colour
        ry, rx = np.nonzero(ring)
        cur = {(y, x): tuple(out[y, x, :3]) for y, x in zip(ry, rx)}
        olc = tuple(int(v) for v in PALARR[CIDX["OL"]])
        for (y, x), c in cur.items():
            if OL_CORNER is not None and tuple(int(v) for v in c) == olc:
                continue                  # round 3: a shadow-side corner keeps its OL accent
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
    if args.shade:
        # shading lane: re-band the body materials from the light pass (form light, cast shadows,
        # clean clusters). Runs before the gold / trim / orphan passes so they tidy its result too
        import rosace_shade
        rosace_shade.apply(SHADE, meta, alpha, mat, code, part, n, d, EX, CIDX, MID, BYID)
        if SHADE.get("dejag"):
            print("shade: dejag changed", rosace_shade.dejag(SHADE, meta, alpha, mat, code, part, n, d, EX, MID), "rows")
    if not args.no_clean:
        gold_fragments(alpha, mat, code, part)
    trim_edges(alpha, mat, code)
    if not args.no_clean:
        orphan_kill(alpha, mat, code)
    img = colour(alpha, code)
    img, ring, ln = lines(img, alpha, mat, code, part, d)
    if args.shade and SHADE.get("final_antihug"):
        import rosace_shade
        nh = rosace_shade.final_antihug(SHADE, img, alpha, mat, part, ln, MID, PARTS, SHADE.get("final_antihug", 2))
        print("shade: final anti-hug changed", nh, "px")
    if args.shade and SHADE.get("final_clusters"):
        import rosace_shade
        print("shade: final clusters changed", rosace_shade.final_clusters(SHADE, img, alpha, mat, part, ln, MID, PARTS), "px")
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
    global LIMBS_OUT
    LIMBS_OUT = None
    if EX is not None and EX.shape[-1] > 4:
        # shading lane round 2: B = limb id (rosace_shade_lane.py LIMBS), and each limb's mean view
        # depth, so the rule checker's adapter can tell the near leg / arm / sleeve from the far one
        lb = np.nan_to_num(EX[..., 4]).astype(np.int32)
        idm[alpha, 2] = lb[alpha]
        LIMBS_OUT = {int(l): round(float(d[alpha & (lb == l)].mean()), 4) for l in np.unique(lb[alpha]) if l > 0}
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


LIMBS_OUT = None


def save_set(tag, img, alb, nm, idm):
    if LIMBS_OUT is not None:
        json.dump({"_doc": "limb id -> mean view depth (m) of its pixels; ids in rosace_shade.LIMB_NAMES",
                   "depth": LIMBS_OUT}, open(os.path.join(OUT, f"{tag}_limbs.json"), "w"))
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
