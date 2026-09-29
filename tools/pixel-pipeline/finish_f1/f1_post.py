"""Route F1 (hi-bit painterly finish), pixel side: hi-res painterly render -> a pixel sprite.

  python tools/pixel-pipeline/finish_f1/f1_post.py --raw <renders>/<shot>/px<N> --preset P1 [--out <dir>]
  python tools/pixel-pipeline/finish_f1/f1_post.py --root <renders> --preset P0,P1,P2,P3   (every shot and size)

Reads f1_blender.py's passes (id, normal, depth at ss x; f1_<look>.png) and writes <raw>/<preset>/:
still.png (the sprite), still_x3.png, sil.png (black fill), id.png + meta.json (copies, so
tools/art-construct/finish_metrics.py reads the folder), post.json (settings, palette, counts).

Steps (settings from finish_f1/f1.json 'presets'):
 1. downsample ss -> 1: alpha where >= 45% of the block is figure; each pixel's label (material, part) is the
    block's weighted mode (thin gold, edge, glass, thong and the azure tips win ties); its colour is the mean
    (linear light) of the winning label's sub-pixels, blended by `aa` toward the mean of all the block's figure
    sub-pixels where the block holds more than one label (interior anti-aliasing only: the background never
    enters, so the silhouette stays hard, PX-N04)
 2. adaptive palette: k-means in OKLab per material group (skin, white, dark, hair, haft, gold, steel,
    accent), the group budgets scaled to `palette` minus the colours the lines and the face add; then
    near-duplicates (OKLab distance < 0.02) merged
 3. cleanup: salt-and-pepper (a pixel with no same-colour 8-neighbour whose lightness sits > 0.09 OKLab L
    from its neighbours' median goes to the most common same-material neighbour colour), 2x2 checkers
    broken (PX-P23: no dithering), 1 px material orphans merged
 4. lines: a 1 px outline outside the silhouette, selective and coloured: the ground side and the side away
    from the key light in the tinted near-black line colour, the lit side in the material's own darkest
    tone (sel-out), skin in a warm umber (PX-P38); inner lines where a part occludes another with a depth
    step, on the farther pixel in that material's darkest tone (lighter than the silhouette, PX-P20)
 5. face: round WH2's authored stamps (art/rosace/faces/wh2.json via tools/art-construct/wh2_px.step_face,
    used as a library) placed on this render's own facepass, recoloured into the F1 palette
 6. thong: the string is the line colour, 1 px (DESIGN 3.5 item 5)
"""
import argparse
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PIPE))
CFG = json.load(open(os.path.join(HERE, "f1.json"), encoding="utf-8"))
sys.path.insert(0, os.path.join(REPO, "tools", "art-construct"))

N4 = ((0, 1), (0, -1), (1, 0), (-1, 0))
N8 = N4 + ((1, 1), (1, -1), (-1, 1), (-1, -1))
LINE = "#16131d"          # the silhouette line: tinted near-black, V 0.11 (PX-N03: never #000000)
SKIN_LINE = "#4a3036"     # the warm umber line beside skin (PX-P38)
GROUP_SHARE = {"skin": 0.17, "white": 0.20, "dark": 0.12, "hair": 0.16, "haft": 0.07, "gold": 0.12, "steel": 0.08,
               "accent": 0.08}
RESERVED = 8              # palette entries the lines and the face stamps add on top of the material groups
PRIO = {"gold": 1.7, "edge": 2.0, "glass": 1.5, "glass2": 1.5, "glasscore": 1.8, "thong": 2.2, "hairtip": 1.4,
        "haft": 1.25, "steel": 1.1}
LS = np.array([0.50, -0.62]) / np.hypot(0.50, 0.62)     # key light on screen (x right, y down)
FACE_RGB = {"OL": "#231826", "A2": "#2a62d0", "A3": "#4aa8f0", "A4": "#a0e6ff", "A5": "#f0fcff",
            "W1": "#faf8f2", "W2": "#e9e6e3", "SB": "#e3a29d"}


# ---------------------------------------------------------------------------- colour
def hexrgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float64)


def lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def delin(l):
    l = np.clip(l, 0, 1)
    return np.where(l <= 0.0031308, l * 12.92, 1.055 * l ** (1 / 2.4) - 0.055) * 255.0


def oklab(rgb):
    l = lin(np.asarray(rgb, np.float64))
    M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566],
                   [0.0883024619, 0.2817188376, 0.6299787005]])
    M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099],
                   [0.0259040371, 0.7827717662, -0.8086757660]])
    lms = np.cbrt(l @ M1.T)
    return lms @ M2.T


# ---------------------------------------------------------------------------- io
def load(raw, look):
    meta = json.load(open(os.path.join(raw, "meta.json")))
    idm = np.asarray(Image.open(os.path.join(raw, "id.png")).convert("RGBA"))
    bea = np.asarray(Image.open(os.path.join(raw, f"f1_{look}.png")).convert("RGBA")).astype(np.float64)
    nrm = np.asarray(Image.open(os.path.join(raw, "normal.png")).convert("RGB")).astype(np.float64) / 255 * 2 - 1
    dep = np.asarray(Image.open(os.path.join(raw, "depth.png")).convert("RGB")).astype(np.float64)[..., 0] / 255
    fp = os.path.join(raw, "facepass.json")
    face = json.load(open(fp)) if os.path.exists(fp) else None
    return meta, idm, bea, nrm, dep, face


# ---------------------------------------------------------------------------- 1. downsample
def downsample(meta, idm, bea, nrm, dep, aa):
    k = int(meta["ss"])
    H, W = idm.shape[0] // k, idm.shape[1] // k
    byid = {m["id"]: n for n, m in meta["materials"].items()}
    a = idm[..., 3] > 0
    lab = np.where(a, idm[..., 0].astype(np.int64) * 256 + idm[..., 1], -1)

    def blocks(x, c=None):
        x = x[:H * k, :W * k]
        if c is None:
            return x.reshape(H, k, W, k).transpose(0, 2, 1, 3).reshape(H, W, k * k)
        return x.reshape(H, k, W, k, c).transpose(0, 2, 1, 3, 4).reshape(H, W, k * k, c)

    bl = blocks(lab)
    prio = np.ones(256)
    for mid, n in byid.items():
        prio[mid] = PRIO.get(n, 1.0)
    wgt = np.where(bl >= 0, prio[np.clip(bl // 256, 0, 255)], 0.0)
    best, best_s = np.full((H, W), -1, np.int64), np.zeros((H, W))
    for i in range(k * k):
        cand = bl[..., i]
        s = ((bl == cand[..., None]) * wgt).sum(-1)
        better = (cand >= 0) & (s > best_s)
        best[better] = cand[better]
        best_s[better] = s[better]
    fig = bl >= 0
    alpha = fig.mean(-1) >= 0.45
    same = bl == best[..., None]
    cb = lin(blocks(bea[..., :3], 3))
    crisp = (cb * same[..., None]).sum(2) / np.maximum(same.sum(-1, keepdims=True), 1)
    soft = (cb * fig[..., None]).sum(2) / np.maximum(fig.sum(-1, keepdims=True), 1)
    labs_in = np.array([[len(set(bl[y, x][fig[y, x]].tolist())) for x in range(W)] for y in range(H)])
    w = np.where(labs_in > 1, aa, 0.0)[..., None]
    col = delin(crisp * (1 - w) + soft * w)
    nb = blocks(nrm, 3)
    n2 = (nb * same[..., None]).sum(2) / np.maximum(same.sum(-1, keepdims=True), 1)
    d2 = np.where(same, blocks(dep), 9.0).min(-1)
    mat = np.where(alpha, best // 256, 0).astype(np.int32)
    part = np.where(alpha, best % 256, 0).astype(np.int32)
    return alpha, mat, part, col, n2, d2, byid


# ---------------------------------------------------------------------------- 2. palette
def kmeans(X, w, k, seed=7, iters=30):
    rng = np.random.default_rng(seed)
    k = min(k, len(X))
    C = [X[np.argmax(w)]]
    for _ in range(1, k):
        d = np.min(((X[:, None, :] - np.array(C)[None]) ** 2).sum(-1), 1) * w
        if d.sum() <= 0:
            break
        C.append(X[rng.choice(len(X), p=d / d.sum())])
    C = np.array(C)
    for _ in range(iters):
        lab = ((X[:, None, :] - C[None]) ** 2).sum(-1).argmin(1)
        for j in range(len(C)):
            m = lab == j
            if m.any():
                C[j] = (X[m] * w[m, None]).sum(0) / w[m].sum()
    return C


def palette(alpha, mat, col, byid, size):
    groups = {}
    for mid, n in byid.items():
        g = CFG["materials"].get(n, {}).get("group")
        if g:
            groups.setdefault(g, []).append(mid)
    budget = max(8, size - RESERVED)
    out = np.zeros_like(col)
    pal = []
    for g, mids in groups.items():
        m = alpha & np.isin(mat, mids)
        if not m.any():
            continue
        kg = max(1, int(round(GROUP_SHARE[g] * budget)))
        px = col[m]
        uq, inv, cnt = np.unique(np.round(px).astype(np.int32), axis=0, return_inverse=True, return_counts=True)
        X = oklab(uq)
        C = kmeans(X, cnt.astype(np.float64), kg)
        lab = ((X[:, None, :] - C[None]) ** 2).sum(-1).argmin(1)
        # the cluster's colour = its weighted mean in OKLab, back to sRGB via the nearest member (a real
        # rendered colour, so the ramp's hue shift is kept)
        reps = []
        for j in range(len(C)):
            mm = lab == j
            if not mm.any():
                reps.append(None)
                continue
            i = np.argmin(((X[mm] - C[j]) ** 2).sum(-1))
            reps.append(uq[mm][i].astype(np.float64))
        q = np.array([reps[j] if reps[j] is not None else [0, 0, 0] for j in lab[inv.ravel()]])
        out[m] = q
        pal += [r for r in reps if r is not None]
    # merge near-duplicates across groups
    pal = np.unique(np.array(pal), axis=0)
    P = oklab(pal)
    keep = []
    for i in range(len(pal)):
        if all(np.linalg.norm(P[i] - P[j]) >= 0.02 for j in keep):
            keep.append(i)
    kp = pal[keep]
    KP = P[keep]
    flat = out[alpha]
    idx = ((oklab(flat)[:, None, :] - KP[None]) ** 2).sum(-1).argmin(1)
    out[alpha] = kp[idx]
    return out, kp


# ---------------------------------------------------------------------------- 3. cleanup
def packed(img):
    c = np.round(img).astype(np.int64)
    return (c[..., 0] << 16) | (c[..., 1] << 8) | c[..., 2]


def cleanup(alpha, mat, img, keep=None):
    H, W = alpha.shape
    keep = np.zeros_like(alpha) if keep is None else keep
    L = oklab(img)[..., 0]
    changed = {"speckle": 0, "checker": 0, "orphan_mat": 0}
    # material orphans: no 8-neighbour of the same material
    for y, x in zip(*np.nonzero(alpha)):
        nb = [(y + dy, x + dx) for dy, dx in N8 if 0 <= y + dy < H and 0 <= x + dx < W and alpha[y + dy, x + dx]]
        if len(nb) >= 5 and not any(mat[p] == mat[y, x] for p in nb):
            vals, cnt = np.unique([mat[p] for p in nb], return_counts=True)
            m = vals[cnt.argmax()]
            src = [p for p in nb if mat[p] == m][0]
            mat[y, x] = m
            img[y, x] = img[src]
            changed["orphan_mat"] += 1
    pk = packed(img)
    for _ in range(2):
        for y, x in zip(*np.nonzero(alpha & ~keep)):
            nb = [(y + dy, x + dx) for dy, dx in N8 if 0 <= y + dy < H and 0 <= x + dx < W and alpha[y + dy, x + dx]]
            if len(nb) < 6 or any(pk[p] == pk[y, x] for p in nb):
                continue
            med = np.median([L[p] for p in nb])
            if abs(L[y, x] - med) <= 0.09:
                continue
            cand = [p for p in nb if mat[p] == mat[y, x]] or nb
            vals, cnt = np.unique([pk[p] for p in cand], return_counts=True)
            v = vals[cnt.argmax()]
            src = [p for p in cand if pk[p] == v][0]
            img[y, x] = img[src]
            pk[y, x] = v
            L[y, x] = L[src]
            changed["speckle"] += 1
    changed["checker"] = cleanup_checkers(alpha, img, keep, pk)
    return changed


def cleanup_checkers(alpha, img, keep=None, pk=None):
    """2x2 checkers (a b / b a): the top-right pixel takes the top-left colour, which breaks the alternation
    in both directions (PX-P23)"""
    keep = np.zeros_like(alpha) if keep is None else keep
    pk = packed(img) if pk is None else pk
    total = 0
    for _ in range(4):
        n = 0
        a_ = pk[:-1, :-1]
        b_ = pk[:-1, 1:]
        c_ = pk[1:, :-1]
        d_ = pk[1:, 1:]
        al = alpha[:-1, :-1] & alpha[:-1, 1:] & alpha[1:, :-1] & alpha[1:, 1:]
        chk = al & (a_ == d_) & (b_ == c_) & (a_ != b_)
        for y, x in zip(*np.nonzero(chk)):
            # the top-right pixel takes the top-left colour (breaks the alternation in both directions)
            if keep[y, x + 1]:
                continue
            img[y, x + 1] = img[y, x]
            pk[y, x + 1] = pk[y, x]
            n += 1
        total += n
        if not n:
            break
    return total


def clusters(mask, conn=N8):
    """connected components: label map (0 = none) and count"""
    lab = np.zeros(mask.shape, np.int32)
    n = 0
    H, W = mask.shape
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]:
            continue
        n += 1
        lab[y0, x0] = n
        st = [(y0, x0)]
        while st:
            y, x = st.pop()
            for dy, dx in conn:
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n
                    st.append((yy, xx))
    return lab, n


def face_clean(alpha, mat, part, img, meta, max_px=2):
    """the face skin keeps few, clean tones (the refs' faces are 2-3 flat tones): a same-colour cluster of
    <= max_px px on the head skin takes the most common neighbouring head-skin colour"""
    mats = {n: m["id"] for n, m in meta["materials"].items()}
    head = alpha & (mat == mats["skin"]) & (part == meta.get("parts", {}).get("head", -9))
    pk = packed(img)
    n_ch = 0
    for v in np.unique(pk[head]):
        lab, n = clusters(head & (pk == v), N4)
        for k in range(1, n + 1):
            cm = lab == k
            if cm.sum() > max_px:
                continue
            cnt = {}
            for y, x in zip(*np.nonzero(cm)):
                for dy, dx in N8:
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < alpha.shape[0] and 0 <= xx < alpha.shape[1] and head[yy, xx] and not cm[yy, xx]:
                        cnt[pk[yy, xx]] = cnt.get(pk[yy, xx], 0) + 1
            if not cnt:
                continue
            best = max(cnt, key=cnt.get)
            src = np.argwhere(head & (pk == best))[0]
            img[cm] = img[src[0], src[1]]
            pk[cm] = best
            n_ch += int(cm.sum())
    return n_ch


# ---------------------------------------------------------------------------- 4. lines
def shift(a, dy, dx, fill):
    out = np.full_like(a, fill)
    H, W = a.shape[:2]
    ys, yd = (slice(0, H - dy), slice(dy, H)) if dy >= 0 else (slice(-dy, H), slice(0, H + dy))
    xs, xd = (slice(0, W - dx), slice(dx, W)) if dx >= 0 else (slice(-dx, W), slice(0, W + dx))
    out[yd, xd] = a[ys, xs]
    return out


def darkest(img, alpha, mat, mid):
    m = alpha & (mat == mid)
    if not m.any():
        return None
    c = img[m]
    L = oklab(c)[:, 0]
    return c[np.argmin(L)]


def nth_tone(img, alpha, mat, mid, n):
    """the material's n-th darkest colour in use (clamped to the lightest)"""
    m = alpha & (mat == mid)
    if not m.any():
        return None
    c = np.unique(np.round(img[m]).astype(int), axis=0)
    c = c[np.argsort(oklab(c)[:, 0])]
    return c[min(n, len(c) - 1)].astype(np.float64)


def lines(alpha, mat, part, img, d, byid, lit_thr=0.0):
    H, W = alpha.shape
    out = np.zeros((H, W, 4))
    out[alpha, :3] = img[alpha]
    out[alpha, 3] = 255
    dk = {mid: darkest(img, alpha, mat, mid) for mid in byid}
    mid3 = {mid: nth_tone(img, alpha, mat, mid, 2) for mid in byid}
    group = {mid: CFG["materials"].get(n, {}).get("group") for mid, n in byid.items()}
    HAIRM = [m for m, n in byid.items() if n in ("hair", "hairtip")]
    line = hexrgb(LINE)
    # inner lines: the farther pixel where another part occludes it with a depth step
    ln = np.zeros((H, W), bool)
    lncol = np.zeros((H, W, 3))
    for dy, dx in N4:
        qa = shift(alpha, dy, dx, False)
        qd = shift(d, dy, dx, 9.0)
        qp = shift(part, dy, dx, 0)
        qm = shift(mat, dy, dx, 0)
        hairpair = np.isin(mat, HAIRM) & np.isin(qm, HAIRM)
        step = alpha & qa & (qp != part) & (qd + np.where(hairpair, 0.012, 0.018) < d)
        dark_occ = np.isin(qm, [m for m, g in group.items() if g in ("dark", "hair", "haft")])
        light_here = ~np.isin(mat, [m for m, g in group.items() if g in ("dark", "hair", "haft")])
        step &= ~(dark_occ & light_here)
        ln |= step
    # a line pixel with fewer than 2 line pixels among its 8 neighbours is a dot, not a line: dropped
    cnt = sum(shift(ln.astype(np.int8), dy, dx, 0) for dy, dx in N8)
    ln &= cnt >= 1
    lab, n = clusters(ln)
    for k in range(1, n + 1):
        if (lab == k).sum() < 3:
            ln[lab == k] = False
    for mid in byid:
        sel = ln & (mat == mid)
        if sel.any() and dk[mid] is not None:
            # the material's darkest tone, pulled a quarter toward the line colour
            lncol[sel] = dk[mid] * 0.75 + line * 0.25
    out[ln, :3] = lncol[ln]
    # outline ring
    ring = ~alpha & (sum(shift(alpha.astype(np.int8), dy, dx, 0) for dy, dx in N4) > 0)
    near_black = 0
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
        m = int(mat[best])
        g = group.get(m)
        c = line
        lit = float(o @ LS) > lit_thr
        if oy > 0.7:
            c = line                                        # the ground side
        elif byid.get(m) == "skin":
            # PX-P38: the skin's darkest shade as a warm umber line; the shadow side a step darker
            c = dk[m] * (0.8 if lit else 0.62) if dk.get(m) is not None else hexrgb(SKIN_LINE)
        elif lit and g in ("dark", "haft", "hair") and mid3.get(m) is not None:
            c = mid3[m]                                     # a dark material's lit edge: its own mid tone
        elif lit and dk.get(m) is not None:
            c = dk[m]                                       # sel-out: the material's own darkest tone
        out[y, x, :3] = c
        out[y, x, 3] = 255
    # a lone outline colour between two runs of another reads as a speck: it takes its neighbours' colour
    ry, rx = np.nonzero(ring)
    cur = {(y, x): tuple(out[y, x, :3]) for y, x in zip(ry, rx)}
    for (y, x), c in cur.items():
        nbs = [cur[(y + dy, x + dx)] for dy, dx in N8 if (y + dy, x + dx) in cur]
        if len(nbs) >= 2 and c not in nbs:
            vals, cnt = np.unique(np.array(nbs), axis=0, return_counts=True)
            out[y, x, :3] = vals[cnt.argmax()]
    return out, ring, ln


# ---------------------------------------------------------------------------- 5. face
class FaceCanvas:
    """the minimal wh2_px.Still the face step needs: palette codes on the head, nothing else"""

    def __init__(self, alpha, mat, part, meta, fp):
        import wh2_px as W2
        self.W2 = W2
        self.H, self.W = alpha.shape
        self.a = alpha.copy()
        mats = {n: m["id"] for n, m in meta["materials"].items()}
        parts = meta.get("parts", {})
        self.mats, self.parts = mats, parts
        self.px = int(meta["px"])
        self.fp = fp
        self.mat, self.part = mat, part
        self.skin = alpha & (mat == mats["skin"])
        self.head = self.skin & (part == parts.get("head", -9))
        self.hairid = alpha & np.isin(mat, [mats.get("hair", -9), mats.get("hairtip", -9)])
        self.limb = np.zeros_like(mat)
        self.c = np.full(alpha.shape, -1, np.int16)
        self.c[self.skin] = W2.CI["S2"]
        self.c[self.hairid] = W2.CI["I2"]
        self.notes = {}

    def code(self, x, y):
        if not (0 <= x < self.W and 0 <= y < self.H) or not self.a[y, x] or self.c[y, x] < 0:
            return None
        return self.W2.CODES[self.c[y, x]]

    def put(self, x, y, code):
        if 0 <= x < self.W and 0 <= y < self.H:
            self.c[y, x] = self.W2.CI[code]
            self.a[y, x] = True

    def is_code(self, codes):
        return np.isin(self.c, [self.W2.CI[k] for k in codes]) & self.a


def stamp_face(out, alpha, mat, part, meta, fp, expr_key):
    if not fp:
        return np.zeros(alpha.shape, bool), {"skip": "no facepass"}
    import wh2_px as W2
    F = json.load(open(os.path.join(REPO, "art", "rosace", "faces", "wh2.json"), encoding="utf-8"))
    S = FaceCanvas(alpha, mat, part, meta, fp)
    before = S.c.copy()
    rep = W2.step_face(S, F, expr_key)
    ch = (S.c != before) & alpha
    # skin codes -> the F1 skin tones present on the face, by lightness rank
    face_px = alpha & S.head
    skin_cols = np.unique(np.round(out[face_px, :3]).astype(int), axis=0) if face_px.any() else np.zeros((0, 3))
    order = skin_cols[np.argsort(oklab(skin_cols)[:, 0])] if len(skin_cols) else skin_cols
    allskin = np.unique(np.round(out[alpha & S.skin, :3]).astype(int), axis=0)
    allskin = allskin[np.argsort(oklab(allskin)[:, 0])]

    def skin(code):
        pool = allskin if len(allskin) else order
        i = {"S1": len(pool) - 1, "S2": max(0, len(pool) - 2), "S3": max(0, len(pool) // 2 - 1),
             "S4": 1 if len(pool) > 2 else 0}[code]
        return pool[i]

    hair = np.unique(np.round(out[S.hairid, :3]).astype(int), axis=0)
    hair = hair[np.argsort(oklab(hair)[:, 0])] if len(hair) else hair
    for y, x in zip(*np.nonzero(ch)):
        cd = W2.CODES[S.c[y, x]]
        if cd in FACE_RGB:
            c = hexrgb(FACE_RGB[cd])
        elif cd.startswith("S"):
            c = skin(cd)
        elif cd.startswith("I") and len(hair):
            c = hair[min(len(hair) - 1, {"I4": 0, "I3": 1, "I2": 2, "I1": 3, "I0": 4}.get(cd, 1))]
        else:
            c = hexrgb(LINE)
        out[y, x, :3] = c
    return ch, rep


# ---------------------------------------------------------------------------- 6. thong
def thong(out, alpha, mat, byid):
    """DESIGN 3.5 item 5: the string is 1 px and black. Each thong component is thinned to one pixel across its
    run direction (per row for a steep string, per column for a shallow one: the run's middle pixel stays), the
    removed pixels take their most common non-thong neighbour colour, and what stays takes the line colour"""
    tid = next((m for m, n in byid.items() if n == "thong"), None)
    if tid is None:
        return 0
    m = alpha & (mat == tid)
    if not m.any():
        return 0
    lab, n = clusters(m)
    keep = np.zeros_like(m)
    for k in range(1, n + 1):
        ys, xs = np.nonzero(lab == k)
        steep = (ys.max() - ys.min()) >= (xs.max() - xs.min())
        if steep:
            for y in np.unique(ys):
                row = np.sort(xs[ys == y])
                for run in np.split(row, np.nonzero(np.diff(row) > 1)[0] + 1):
                    keep[y, run[len(run) // 2]] = True
        else:
            for x in np.unique(xs):
                col = np.sort(ys[xs == x])
                for run in np.split(col, np.nonzero(np.diff(col) > 1)[0] + 1):
                    keep[run[len(run) // 2], x] = True
    drop = m & ~keep
    H, W = m.shape
    for y, x in zip(*np.nonzero(drop)):
        cnt = {}
        for dy, dx in N8:
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and alpha[yy, xx] and not m[yy, xx]:
                c = tuple(out[yy, xx, :3])
                cnt[c] = cnt.get(c, 0) + 1
        if cnt:
            out[y, x, :3] = max(cnt, key=cnt.get)
    out[keep, :3] = hexrgb(LINE)
    return int(keep.sum())


# ---------------------------------------------------------------------------- main
def process(raw, preset, out_dir=None):
    pr = CFG["presets"][preset]
    meta, idm, bea, nrm, dep, fp = load(raw, pr["look"])
    alpha, mat, part, col, n2, d2, byid = downsample(meta, idm, bea, nrm, dep, pr["aa"])
    img, pal = palette(alpha, mat, col, byid, pr["palette"])
    face_keep = np.zeros_like(alpha)
    cl = cleanup(alpha, mat, img, face_keep)
    cl["face_clean"] = face_clean(alpha, mat, part, img, meta)
    out, ring, ln = lines(alpha, mat, part, img, d2, byid)
    expr = meta.get("f1", {}).get("expr", "idle_hero")
    fch, frep = stamp_face(out, alpha, mat, part, meta, fp, expr)
    nth = thong(out, alpha, mat, byid)
    # the lines and the face can make new 2x2 checkers: one more pass on the fill (never the face or the ring)
    fill = alpha & ~fch
    rgb = out[..., :3].copy()
    cl["checker_final"] = cleanup_checkers(fill, rgb)
    out[..., :3] = rgb
    o8 = np.clip(np.round(out), 0, 255).astype(np.uint8)
    od = out_dir or os.path.join(raw, preset)
    os.makedirs(od, exist_ok=True)
    im = Image.fromarray(o8, "RGBA")
    im.save(os.path.join(od, "still.png"))
    im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(os.path.join(od, "still_x3.png"))
    sil = np.zeros_like(o8)
    fig = o8[..., 3] > 0
    sil[fig] = (0, 0, 0, 255)
    Image.fromarray(sil, "RGBA").save(os.path.join(od, "sil.png"))
    for f in ("id.png", "meta.json", "facepass.json", "landmarks.json"):
        if os.path.exists(os.path.join(raw, f)):
            shutil.copy(os.path.join(raw, f), os.path.join(od, f))
    cols = np.unique(o8[fig][:, :3], axis=0)
    ringc = o8[ring][:, :3].astype(float)
    Lr = lin(ringc) @ np.array([0.2126, 0.7152, 0.0722])
    rep = {"preset": preset, "settings": pr, "look": CFG["looks"][pr["look"]], "raw": raw,
           "colours": int(len(cols)), "palette_groups": int(len(pal)), "cleanup": cl,
           "ring_near_black": round(float((Lr < 0.06).mean()), 3) if len(Lr) else None,
           "ring_darkest": round(float((Lr < 0.03).mean()), 3) if len(Lr) else None,
           "inner_line_px": int(ln.sum()), "face": {k: v for k, v in frep.items() if k != "expr"} if frep else None,
           "face_px": int(fch.sum()), "thong_px": nth,
           "palette": ["#%02x%02x%02x" % tuple(int(v) for v in c) for c in cols]}
    json.dump(rep, open(os.path.join(od, "post.json"), "w"), indent=1, default=str)
    return rep


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw")
    ap.add_argument("--root")
    ap.add_argument("--preset", default="P1")
    ap.add_argument("--out")
    a = ap.parse_args()
    raws = [a.raw] if a.raw else [os.path.join(a.root, s, p) for s in sorted(os.listdir(a.root))
                                   if os.path.isdir(os.path.join(a.root, s))
                                   for p in sorted(os.listdir(os.path.join(a.root, s))) if p.startswith("px")]
    for raw in raws:
        for pr in a.preset.split(","):
            r = process(raw, pr, a.out if a.raw and len(a.preset.split(",")) == 1 else None)
            print(f"{os.path.relpath(raw, a.root) if a.root else raw} {pr}: colours {r['colours']}, ring near-black "
                  f"{r['ring_near_black']}, cleanup {r['cleanup']}, face px {r['face_px']}")


if __name__ == "__main__":
    main()
