"""Turn raw Blender passes into cleaned pixel-art frames + normal maps + VFX.

usage: python postprocess.py --raw <raw_dir> --meta <meta.json> --out <dir> [--no-vfx] [--no-face]
       [--no-clean] [--no-lines] [--tag name]

Steps per frame
 1. read beauty/id/normal/depth; label every pixel with (material, band) using exact palette match
 2. supersampled input (ss>1): weighted-mode downsample to the native grid (thin gold wins ties)
 3. cleanup: orphan pixels, tiny band specks, silhouette holes/singletons
 4. lines: 1px outer outline (colour picked from the neighbour material, lighter on the lit side),
    inner lines where parts overlap (depth step), drawn on the farther pixel
 5. hand-authored face stamp placed from projected 3D eye anchors (depth-tested)
 6. 2D VFX from tracked blade samples: crescent smear with age bands + deterministic sparks
Only numpy + Pillow.
"""
import argparse
import json
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument("--raw", required=True)
ap.add_argument("--meta", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--tag", default="final")
ap.add_argument("--no-vfx", action="store_true")
ap.add_argument("--no-face", action="store_true")
ap.add_argument("--no-clean", action="store_true")
ap.add_argument("--no-lines", action="store_true")
ap.add_argument("--no-selout", action="store_true")
args = ap.parse_args()

meta = json.load(open(args.meta))
SS = meta["ss"]
W, H = meta["canvas"]
PAL = {int(meta["mat_ids"][k]): np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in v], np.uint8)
       for k, v in meta["palettes"].items()}
MID = {k: int(v) for k, v in meta["mat_ids"].items()}
NAME = {v: k for k, v in MID.items()}
DETAIL = {MID["gold"]}                         # thin trims that should survive downsampling
DARK = {MID["hair"], MID["shaft"], MID["shoe"]}  # dark parts need no inner line around them
PRIORITY = np.ones(32)
PRIORITY[MID["gold"]] = 2.2
PRIORITY[MID["blade"]] = 1.3
PRIORITY[MID["edge"]] = 1.8
PRIORITY[MID["shaft"]] = 1.6
PRIORITY[MID["hair"]] = 1.15
DEPTH0, DEPTH1 = meta["depth_range"]
LC = np.array(meta["light_cam"], float)
LS = np.array([LC[0], -LC[1]])                 # screen space light dir (y down)
LS /= np.linalg.norm(LS) + 1e-9
os.makedirs(args.out, exist_ok=True)

N4 = [(-1, 0), (1, 0), (0, -1), (0, 1)]
N8 = N4 + [(-1, -1), (-1, 1), (1, -1), (1, 1)]


def shift(a, dy, dx, fill=0):
    """out[y, x] = a[y + dy, x + dx] (neighbour lookup), padded with fill"""
    out = np.full_like(a, fill)
    h, w = a.shape[:2]
    ys0, ys1 = max(0, -dy), min(h, h - dy)
    xs0, xs1 = max(0, -dx), min(w, w - dx)
    out[ys0:ys1, xs0:xs1] = a[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx]
    return out


def load(pass_name, f):
    p = os.path.join(args.raw, pass_name, f"{f:04d}.png")
    return np.asarray(Image.open(p).convert("RGBA"))


def band_index(rgb, mat):
    """index into palette (1..4) by exact/nearest colour within that material"""
    out = np.zeros(mat.shape, np.uint8)
    for m, pal in PAL.items():
        sel = mat == m
        if not sel.any():
            continue
        c = rgb[sel].astype(int)
        d = ((c[:, None, :] - pal[None, 1:5, :].astype(int)) ** 2).sum(-1)
        out[sel] = d.argmin(1) + 1
    return out


def read_frame(f):
    b = load("beauty", f)
    idp = load("id", f)
    nrm = load("normal", f)
    dep = load("depth", f)
    alpha = b[..., 3] > 127
    mat = np.where(alpha, idp[..., 0], 0).astype(np.int32)
    part = np.where(alpha, idp[..., 1], 0).astype(np.int32)
    band = np.where(alpha, band_index(b[..., :3], mat), 0).astype(np.int32)
    n = nrm[..., :3].astype(np.float32) / 255.0 * 2 - 1
    d = DEPTH0 + dep[..., 0].astype(np.float32) / 255.0 * (DEPTH1 - DEPTH0)
    d = np.where(alpha, d, 1e9)
    return alpha, mat, band, part, n, d


def downsample(alpha, mat, band, part, n, d, k):
    """weighted mode over k x k blocks; returns native-res arrays"""
    h, w = alpha.shape[0] // k, alpha.shape[1] // k
    lab = (mat * 8 + band) * 256 + part  # full label
    lab = np.where(alpha, lab, -1)
    blk = lab[:h * k, :w * k].reshape(h, k, w, k).transpose(0, 2, 1, 3).reshape(h, w, k * k)
    wgt = np.where(blk >= 0, PRIORITY[np.clip(blk // 256 // 8, 0, 31)], 0.0)
    opaque_w = (blk >= 0).mean(-1)
    out_lab = np.full((h, w), -1, np.int64)
    best_s = np.zeros((h, w))
    for i in range(k * k):
        cand = blk[..., i]
        s = ((blk == cand[..., None]) * wgt).sum(-1)
        better = (cand >= 0) & (s > best_s)
        out_lab[better] = cand[better]
        best_s[better] = s[better]
    a2 = opaque_w >= 0.45
    # thin detail that is present but lost the vote: keep if dominant priority material covers >= 25%
    out_lab[~a2] = -1
    m2 = np.where(a2, out_lab // 256 // 8, 0)
    b2 = np.where(a2, (out_lab // 256) % 8, 0)
    p2 = np.where(a2, out_lab % 256, 0)
    nb = n[:h * k, :w * k].reshape(h, k, w, k, 3).transpose(0, 2, 1, 3, 4).reshape(h, w, k * k, 3)
    db = d[:h * k, :w * k].reshape(h, k, w, k).transpose(0, 2, 1, 3).reshape(h, w, k * k)
    same = (blk == out_lab[..., None])
    n2 = (nb * same[..., None]).sum(2) / np.maximum(same.sum(-1, keepdims=True), 1)
    n2 /= np.linalg.norm(n2, axis=-1, keepdims=True) + 1e-6
    d2 = np.where(same, db, 1e9).min(-1)
    d2 = np.where(a2, d2, 1e9)
    return a2, m2.astype(np.int32), b2.astype(np.int32), p2.astype(np.int32), n2, d2


def majority_neighbour(lab, mask_valid, y, x):
    vals = {}
    h, w = lab.shape
    for dy, dx in N8:
        yy, xx = y + dy, x + dx
        if 0 <= yy < h and 0 <= xx < w and mask_valid[yy, xx]:
            vals[lab[yy, xx]] = vals.get(lab[yy, xx], 0) + 1
    if not vals:
        return None, 0
    v, c = max(vals.items(), key=lambda t: t[1])
    return v, c


def components(lab, alpha):
    """4-connected components of equal label; returns list of (label, [pixels])"""
    h, w = lab.shape
    seen = np.zeros((h, w), bool)
    comps = []
    ys, xs = np.nonzero(alpha)
    for y0, x0 in zip(ys, xs):
        if seen[y0, x0]:
            continue
        L = lab[y0, x0]
        stack = [(y0, x0)]
        seen[y0, x0] = True
        pix = []
        while stack:
            y, x = stack.pop()
            pix.append((y, x))
            for dy, dx in N4:
                yy, xx = y + dy, x + dx
                if 0 <= yy < h and 0 <= xx < w and not seen[yy, xx] and alpha[yy, xx] and lab[yy, xx] == L:
                    seen[yy, xx] = True
                    stack.append((yy, xx))
        comps.append((L, pix))
    return comps


def cleanup(alpha, mat, band, part, n, d):
    alpha = alpha.copy()
    # silhouette: drop floating singletons, fill 1px holes
    cnt8 = sum(shift(alpha.astype(np.int8), dy, dx) for dy, dx in N8)
    alpha &= ~(alpha & (cnt8 == 0))
    cnt4 = sum(shift(alpha.astype(np.int8), dy, dx) for dy, dx in N4)
    holes = (~alpha) & (cnt4 == 4)
    for y, x in zip(*np.nonzero(holes)):
        best = None
        for dy, dx in N4:
            yy, xx = y + dy, x + dx
            if best is None or d[yy, xx] < d[best]:
                best = (yy, xx)
        alpha[y, x] = True
        mat[y, x], band[y, x], part[y, x], n[y, x], d[y, x] = mat[best], band[best], part[best], n[best], d[best]
    lab = np.where(alpha, mat * 8 + band, -1)
    # material orphans (not for thin detail materials)
    for _ in range(2):
        for y, x in zip(*np.nonzero(alpha)):
            m = mat[y, x]
            same_m = sum(1 for dy, dx in N8 if 0 <= y + dy < lab.shape[0] and 0 <= x + dx < lab.shape[1]
                         and alpha[y + dy, x + dx] and mat[y + dy, x + dx] == m)
            if same_m == 0 and m not in DETAIL:
                v, c = majority_neighbour(lab, alpha, y, x)
                if v is not None and v >= 0:
                    mat[y, x], band[y, x] = v // 8, v % 8
                    lab[y, x] = v
    # band specks: components of <= 2 px fully inside the same material -> surrounding majority band
    for L, pix in components(lab, alpha):
        if len(pix) > 2:
            continue
        m = L // 8
        border = {}
        ok = True
        for y, x in pix:
            for dy, dx in N4:
                yy, xx = y + dy, x + dx
                if not (0 <= yy < lab.shape[0] and 0 <= xx < lab.shape[1]) or not alpha[yy, xx]:
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
                lab[y, x] = v
                band[y, x] = v % 8
    return alpha, mat, band, part, n, d


def shade(alpha, mat, band):
    img = np.zeros(alpha.shape + (4,), np.uint8)
    for m, pal in PAL.items():
        sel = alpha & (mat == m)
        img[sel, :3] = pal[band[sel]]
    img[alpha, 3] = 255
    return img


def lines(img, alpha, mat, band, part, n, d, selout=True):
    h, w = alpha.shape
    out = img.copy()
    line_px = np.zeros((h, w), bool)
    # inner lines: farther pixel of an occlusion step gets the line
    for dy, dx in N4:
        qa = shift(alpha, dy, dx, False)
        qd = shift(d, dy, dx, 1e9)
        qp = shift(part, dy, dx, 0)
        qm = shift(mat, dy, dx, 0)
        step = qd + 0.035 < d
        diff_part = qp != part
        big_step = qd + 0.16 < d
        cand = alpha & qa & ((diff_part & step) | big_step)
        # dark occluders (hair, shaft, shoes) read on their own: no line on what's behind them
        dark_near = np.isin(qm, list(DARK))
        cand &= ~dark_near
        line_px |= cand
    for m, pal in PAL.items():
        sel = line_px & (mat == m)
        if not sel.any():
            continue
        # soft inner line: deep tone, or the line tone if already in the deep band
        col = np.where((band[sel] <= 1)[:, None], pal[0][None, :], pal[1][None, :])
        if m in DARK:
            col = np.repeat(pal[0][None, :], sel.sum(), 0)
        out[sel, :3] = col
    # outer outline (outside the silhouette, 4-neighbourhood -> clean 1px)
    ring = (~alpha) & (sum(shift(alpha.astype(np.int8), dy, dx) for dy, dx in N4) > 0)
    for y, x in zip(*np.nonzero(ring)):
        best, ox, oy = None, 0.0, 0.0
        for dy, dx in N4:
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and alpha[yy, xx]:
                ox -= dx
                oy -= dy
                if best is None or d[yy, xx] < d[best]:
                    best = (yy, xx)
        m = mat[best]
        pal = PAL[m]
        o = np.array([ox, oy], float)
        o /= np.linalg.norm(o) + 1e-9
        lit = float(o @ LS) > 0.35 and selout
        col = pal[1] if (lit and m not in DARK) else pal[0]
        out[y, x, :3] = col
        out[y, x, 3] = 255
    return out, ring


# ---------------------------------------------------------------------------- face
EYE_DARK = (28, 20, 38)
IRIS_D = (122, 64, 38)
IRIS_L = (234, 182, 76)
WHITE = (255, 255, 255)
if meta["px"] >= 150:  # bigger stamps for the ~176 px variant
    NEAR_EYE = [[EYE_DARK, EYE_DARK, EYE_DARK], [IRIS_D, WHITE, IRIS_D], [IRIS_D, IRIS_L, IRIS_L],
                [None, IRIS_L, None]]
    FAR_EYE = [[EYE_DARK, EYE_DARK], [IRIS_D, IRIS_L], [None, IRIS_L]]
else:
    NEAR_EYE = [[EYE_DARK, EYE_DARK], [IRIS_D, WHITE], [IRIS_L, IRIS_D]]
    FAR_EYE = [[EYE_DARK], [IRIS_D]]


MOUTH = (150, 72, 84)


def stamp_face(out, alpha, d, anchors, scale):
    fwd = anchors["head_fwd_screen"]
    mx, my, mz, mf = anchors["mouth"]
    if mf > 0.2:
        px_, py_ = int(math.floor(mx)), int(math.floor(my))
        pts = [(py_, px_)] + ([(py_, px_ - 1)] if meta["px"] >= 150 else [])
        for yy, xx in pts:
            if 0 <= yy < out.shape[0] and 0 <= xx < out.shape[1] and alpha[yy, xx] and d[yy, xx] + 0.06 >= mz:
                out[yy, xx, :3] = MOUTH
    for side in ("R", "L"):  # R is the near eye (her right faces the camera)
        x, y, z, facing = anchors[f"eye_{side}"]
        if facing < 0.15:
            continue
        px, py = int(math.floor(x / scale)), int(math.floor(y / scale))
        near = facing > 0.55
        st = NEAR_EYE if near else FAR_EYE
        sw = len(st[0])
        x0 = px - (sw // 2)
        y0 = py - 1
        cam_z = z
        for j, row in enumerate(st):
            for i, c in enumerate(row):
                if c is None:
                    continue
                yy, xx = y0 + j, x0 + i
                if not (0 <= yy < out.shape[0] and 0 <= xx < out.shape[1]):
                    continue
                if not alpha[yy, xx]:
                    continue
                if d[yy, xx] + 0.06 < cam_z:  # something (hair, arm) is in front
                    continue
                out[yy, xx, :3] = c


# ---------------------------------------------------------------------------- VFX
SMEAR_COLS = [(255, 255, 255), (255, 244, 196), (250, 214, 110), (228, 160, 58), (170, 96, 40)]
PPM = meta["ppm"]
CAMB = {k: np.array(v, float) for k, v in meta["cam"].items()}


def world_px(P):
    v = np.asarray(P, float) - CAMB["loc"]
    return (W / 2 + v @ CAMB["right"] * PPM, H / 2 - v @ CAMB["up"] * PPM, v @ CAMB["fwd"])


def smear_layer(f, scale=1):
    """swept-blade crescent: per-pixel age/radius buffers -> banded colours, taper, streaks"""
    if f < 10 or f > 16:
        return None
    t_now = float(min(f, 14))          # the trail stays attached to the blade
    linger = max(0, f - 12) * 0.9
    span = 1.7 if f <= 12 else 2.2
    ss = [q for q in meta["smear"][str(int(t_now))] if q["t"] >= t_now - span - 1e-6]
    age_img = Image.new("F", (W, H), 99.0)
    r_img = Image.new("F", (W, H), 0.0)
    d_img = Image.new("F", (W, H), 1e9)
    da, dr_, dd = ImageDraw.Draw(age_img), ImageDraw.Draw(r_img), ImageDraw.Draw(d_img)
    radial = np.linspace(0.18, 1.0, 15 if meta["px"] < 150 else 41)

    def P(q, r):
        tip, inn = q["tip"], q["inner"]
        return (inn[0] + (tip[0] - inn[0]) * r, inn[1] + (tip[1] - inn[1]) * r, inn[2] + (tip[2] - inn[2]) * r)

    for i in range(len(ss) - 1):  # oldest first, newer samples overwrite
        a, b = ss[i], ss[i + 1]
        age = (t_now - b["t"]) / span
        for r0, r1 in zip(radial, radial[1:]):
            q = [P(a, r0), P(a, r1), P(b, r1), P(b, r0)]
            poly = [(c[0], c[1]) for c in q]
            da.polygon(poly, fill=float(age))
            dr_.polygon(poly, fill=float((r0 + r1) / 2))
            dd.polygon(poly, fill=float(sum(c[2] for c in q) / 4))
    age = np.asarray(age_img).copy()
    r = np.asarray(r_img).copy()
    dep = np.asarray(d_img).copy()
    have = age < 90
    age = age + linger * 0.30
    valid = have & (age < 1.0)
    # taper: the older the sweep, the more only the outer rim survives -> crescent with a thin tail
    r_min = 0.22 + 0.70 * np.clip(age, 0, 1) ** 1.15
    valid &= r >= r_min
    k = age * 0.80 + (1.0 - r) * 0.60
    k -= np.where(r > 0.93, 0.18, 0.0)  # bright outer rim
    # speed streaks along the arc (constant radius lanes)
    lane = np.zeros_like(r, bool)
    for rc, hw in ((0.50, 0.022), (0.68, 0.018), (0.83, 0.016)):
        lane |= np.abs(r - rc) < hw
    k += np.where(lane & (age > 0.18), 0.22, 0.0)
    valid &= ~(lane & (age > 0.62))
    idx = np.digitize(k, [0.10, 0.30, 0.55, 0.80, 1.02])
    valid &= idx < 5
    arr = np.zeros((H, W, 4), np.uint8)
    cols = np.array(SMEAR_COLS, np.uint8)
    arr[valid, :3] = cols[np.clip(idx[valid], 0, 4)]
    arr[valid, 3] = 255
    # clean single-pixel noise in the vfx layer
    a8 = arr[..., 3] > 0
    cnt = sum(shift(a8.astype(np.int8), dy, dx) for dy, dx in N8)
    arr[a8 & (cnt <= 1), 3] = 0
    return arr, np.where(valid, dep, 1e9)


def shock_ring(f):
    """wide ground ring (the AOE read) expanding from the lunge foot position"""
    if f < 11 or f > 17:
        return None
    age = f - 11
    root = meta["anchors"]["11"]["root"]
    cx_w = 0.25
    rad = 0.9 + 0.48 * age
    thick = 2 if age < 3 else 1
    cols = [SMEAR_COLS[1], SMEAR_COLS[2], SMEAR_COLS[2], SMEAR_COLS[3], SMEAR_COLS[3], SMEAR_COLS[4], SMEAR_COLS[4]]
    col = cols[age]
    arr = np.zeros((H, W, 4), np.uint8)
    dep = np.full((H, W), 1e9, np.float32)
    n = 720
    for i in range(n):
        th = 2 * math.pi * i / n
        # broken arc: gaps grow with age
        g = (math.sin(th * 7 + age * 1.3) + math.sin(th * 13 - age)) * 0.5
        if g < -0.55 + age * 0.12:
            continue
        for tk in range(thick):
            rr = rad - tk * 0.035
            x, y, z = world_px((cx_w + rr * math.cos(th), rr * math.sin(th), 0.0))
            xi, yi = int(round(x)), int(round(y))
            if 0 <= xi < W and 0 <= yi < H:
                arr[yi, xi, :3] = col
                arr[yi, xi, 3] = 255
                dep[yi, xi] = z
    return arr, dep


def sparks(f, scale):
    """deterministic particle sparks emitted from the blade tip during the strike"""
    pts = []
    rng = random.Random(7)
    for fe in (10, 11, 12):
        ss = meta["smear"][str(fe)]
        for j in range(5):
            s = ss[-1 - 2 * j] if len(ss) > 2 * j + 1 else ss[-1]
            s_prev = ss[-2 - 2 * j] if len(ss) > 2 * j + 2 else ss[0]
            x0, y0 = s["tip"][0] / scale, s["tip"][1] / scale
            vx = (s["tip"][0] - s_prev["tip"][0]) / scale
            vy = (s["tip"][1] - s_prev["tip"][1]) / scale
            sp = math.hypot(vx, vy) + 1e-6
            ang = math.atan2(vy, vx) + rng.uniform(-0.6, 0.6)
            v = rng.uniform(2.0, 5.0) * meta["px"] / 96.0
            life = rng.randint(4, 9)
            pts.append((fe, x0, y0, math.cos(ang) * v, math.sin(ang) * v - rng.uniform(0.3, 1.2), life))
    out = []
    for fe, x0, y0, vx, vy, life in pts:
        age = f - fe
        if age < 0 or age > life:
            continue
        # drag + slight gravity
        x = x0 + vx * (1 - 0.8 ** (age + 1)) / 0.2
        y = y0 + vy * (1 - 0.8 ** (age + 1)) / 0.2 + 0.15 * age * age
        k = age / life
        col = SMEAR_COLS[0] if k < 0.3 else (SMEAR_COLS[2] if k < 0.7 else SMEAR_COLS[4])
        size = (2 if k < 0.4 else 1) * (2 if meta["px"] >= 150 else 1)
        out.append((int(round(x)), int(round(y)), col, size))
    return out


# ---------------------------------------------------------------------------- main loop
frames = meta["frames"]
results = []
for f in frames:
    alpha, mat, band, part, n, d = read_frame(f)
    if SS > 1:
        alpha, mat, band, part, n, d = downsample(alpha, mat, band, part, n, d, SS)
    if not args.no_clean:
        alpha, mat, band, part, n, d = cleanup(alpha, mat, band, part, n, d)
    img = shade(alpha, mat, band)
    ring = np.zeros_like(alpha)
    if not args.no_lines:
        img, ring = lines(img, alpha, mat, band, part, n, d, selout=not args.no_selout)
    if not args.no_face:
        stamp_face(img, alpha, d, meta["anchors"][str(f)], 1)
    char = img.copy()
    albedo = np.zeros_like(img)
    for m, pal in PAL.items():
        sel = alpha & (mat == m)
        albedo[sel, :3] = pal[3]
    albedo[alpha, 3] = 255
    albedo[ring] = img[ring]
    # normal map for the final silhouette (outline pixels get an outward-facing normal)
    nm = np.zeros(alpha.shape + (4,), np.uint8)
    nn = n.copy()
    for y, x in zip(*np.nonzero(ring)):
        ox = oy = 0.0
        for dy, dx in N4:
            yy, xx = y + dy, x + dx
            if 0 <= yy < alpha.shape[0] and 0 <= xx < alpha.shape[1] and alpha[yy, xx]:
                ox -= dx
                oy -= dy
        v = np.array([ox, -oy, 0.45])
        nn[y, x] = v / (np.linalg.norm(v) + 1e-9)
    full = alpha | ring
    nm[full, :3] = np.clip((nn[full] * 0.5 + 0.5) * 255 + 0.5, 0, 255).astype(np.uint8)
    nm[full, 3] = 255
    # vfx
    fx = np.zeros_like(img)
    if not args.no_vfx:
        for layer in (shock_ring(f), smear_layer(f, 1)):
            if layer is None:
                continue
            arr, darr = layer
            vis = (arr[..., 3] > 0) & ((~full) | (darr < np.where(full, d, 1e9) - 0.02))
            fx[vis] = arr[vis]
        for x, y, col, size in sparks(f, 1):
            for yy in range(y, y + size):
                for xx in range(x, x + size):
                    if 0 <= yy < H and 0 <= xx < W:
                        fx[yy, xx, :3] = col
                        fx[yy, xx, 3] = 255
    comp = img.copy()
    sel = fx[..., 3] > 0
    comp[sel] = fx[sel]
    results.append((f, comp, char, nm, fx, albedo))
    Image.fromarray(comp).save(os.path.join(args.out, f"{args.tag}_{f:04d}.png"))

# ---------------------------------------------------------------------------- strips + animations
union = np.zeros((H, W), bool)
for _, comp, char, nm, fx, _alb in results:
    union |= comp[..., 3] > 0
ys, xs = np.nonzero(union)
pad = 2
x0, x1 = max(0, xs.min() - pad), min(W, xs.max() + 1 + pad)
y0, y1 = max(0, ys.min() - pad), min(H, ys.max() + 1 + pad)
cw, chh = x1 - x0, y1 - y0


def strip(key):
    s = Image.new("RGBA", (cw * len(results), chh), (0, 0, 0, 0))
    for i, r in enumerate(results):
        s.paste(Image.fromarray(r[key][y0:y1, x0:x1]), (i * cw, 0))
    return s


strip(1).save(os.path.join(args.out, f"{args.tag}_sprite_strip.png"))
strip(2).save(os.path.join(args.out, f"{args.tag}_sprite_strip_charonly.png"))
strip(3).save(os.path.join(args.out, f"{args.tag}_normal_strip.png"))
strip(5).save(os.path.join(args.out, f"{args.tag}_albedo_strip.png"))

BG = (112, 112, 118, 255)
frames_rgba = []
for r in results:
    bg = Image.new("RGBA", (cw, chh), BG)
    bg.alpha_composite(Image.fromarray(r[1][y0:y1, x0:x1]))
    frames_rgba.append(bg)
# 60 fps: APNG gets exact-ish 16/17 ms; GIF delays below 20 ms get clamped by browsers, so GIF runs 50 fps
dur_apng = [17 if i % 3 != 2 else 16 for i in range(len(frames_rgba))]
dur_apng[0] += 120
dur_apng[-1] += 250
dur_gif = [20] * len(frames_rgba)
dur_gif[0] += 120
dur_gif[-1] += 250
for zoom in (1, 4):
    fr = [im.resize((cw * zoom, chh * zoom), Image.NEAREST) for im in frames_rgba]
    fr[0].save(os.path.join(args.out, f"{args.tag}_anim_{zoom}x.gif"), save_all=True, append_images=fr[1:],
               duration=dur_gif, loop=0, disposal=1, optimize=False)
    fr[0].save(os.path.join(args.out, f"{args.tag}_anim_{zoom}x.apng"), format="PNG", save_all=True,
               append_images=fr[1:], duration=dur_apng, loop=0, disposal=0, blend=0)
json.dump({"crop": [int(x0), int(y0), int(x1), int(y1)], "frame_size": [int(cw), int(chh)],
           "frames": frames}, open(os.path.join(args.out, f"{args.tag}_strip.json"), "w"))
print("done", args.out, "crop", (x0, y0, x1, y1))
