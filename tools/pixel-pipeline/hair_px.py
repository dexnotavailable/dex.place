"""Hair pixel pass (hair lane, round 2): the pixel-exact hair a render at sprite size cannot hold,
placed by rule on the id map, the depth pass and the face pass, never on authored pixel
coordinates, so a re-pose or a re-render moves it with the head (no STALE patches).

Runs on <still>/px<N> after rosace_post.py (--no-face --tag noface) and BEFORE overrides.py, so the
face lane's composer (faces.v2_face -> face_f2) sees the windows and the cleaned framing. It rewrites
noface.png and noface_id.png and keeps the post output as noface_post.png / noface_post_id.png
(a rerun starts from those, so the pass is idempotent).

Steps (ART-RULES HR rules; the round-1 critique's items in brackets):
  veil     veil islands inside the hair (a few px of white between clumps) become the hair behind
           them; the veil reads as one shape behind the head [critique 7]
  dangle   dark 1 px strands standing out of the silhouette (5+ of 8 neighbours empty): deleted on
           the shadow side, lifted to I2 on the lit side (HR-N05) [critique 2]
  tone     the value structure moves onto the clumps: every I0/I1 of the render becomes I2 (the
           broad lit plates go), and I4 survives only where a nearer part or material overlaps it
           (the separators and the under-overlap shadow, HR-P06, HR-P12, HR-N03) [critiques 4, 8]
  sep      fringe clump separators: where two fringe clumps meet side by side (same depth, so the
           post drew no line), the farther clump's edge px goes one step under the shadow (I4),
           from the root to 1 px above the shorter tip (HR-P06, HR-P11) [critique 3]
  ridge    one lit ridge per clump: on each row, a clump run 3+ px wide gets I1 at its centre moved
           a quarter of its width toward the key light, where the render lit it (I2 or lighter);
           long clumps only (side locks, back masses, tail), the crown takes the dashes [critique 4]
  dash     the angel ring as tapering dashes: a path 3 px (144) under the head's hair silhouette,
           so it follows the skull's curve; one dash per crown clump crossing it on the lit half,
           I0 core with I1 ends, 3-5 px (144) / 2 px (80), on rows jittered per clump; at most 6
           (144) / 2 (80) (HR-P08) [critique 4]
  tips     fringe tips over the face: the last px A4 and the one above A3 at 144, the last px A3 at
           80 (HR-P09) [critique 5]
  far      the far jaw: hair px touching the far cheek below the eye row step up to I2, so the far
           jaw and chin contour read against the hair [critique 6]
  window   brow windows: the brow's projected px (facepass ref_eyeblow) and the row over them,
           1 px wider each side, become skin where they lie on the face window, so the brows sit
           in skin (FC-P27, FC-P29) [critique 6]
  stamp    the rose pin (3x3 at 144, 2x2 at 80) on the gold_hair cluster at the crown and a 3x3
           cross clasp (1 px at 80) on each sidelock's cluster, with an I4 backing where they sit
           on hair [critique 7]
  outline  the outline ring recomputed where the silhouette changed (OL for hair, as the post does)

  python tools/pixel-pipeline/hair_px.py --still <render>/<still>/px<N> [--preset p0] [--only a,b]
"""
import argparse
import json
import os
import shutil

import numpy as np
from PIL import Image

N4 = ((0, 1), (1, 0), (0, -1), (-1, 0))
N8 = N4 + ((1, 1), (1, -1), (-1, 1), (-1, -1))
ALL = ("veil", "dangle", "tone", "ribbon", "sep", "ridge", "dash", "tips", "far", "window", "stamp")
# 'window' (pre-face, on the MMD brow px) was round 2's first try; the face lane draws its brows over the
# fringe at its own eye-relative place, so the kept route is 'fwin' (face_window, after the face step)
# presets: steps + parameters (the lane's variants; 'none' in hair_lane2.py skips the pass)
PRESETS = {
    "p0": {"steps": tuple(s for s in ALL if s not in ("window", "ribbon")) + ("fwin",)},
    "p0_mmdwin": {"steps": ALL},
    "p1": {"steps": tuple(s for s in ALL if s != "window") + ("fwin",)},
    "p1h": {"steps": tuple(s for s in ALL if s != "window") + ("fwin", "hue")},
    # the face lane's F2b brows sit over the fringe with no window (ART-RULES O-28): the same pass
    # without the brow windows, for the Integrate step to take if O-28 keeps the brows over the fringe
    "p1h_nowin": {"steps": tuple(s for s in ALL if s != "window") + ("hue",)},
    "p0_nowin": {"steps": tuple(s for s in ALL if s != "window")},
    "p0_noridge": {"steps": tuple(s for s in ALL if s != "ridge")},
    "p0_notone": {"steps": tuple(s for s in ALL if s not in ("tone", "ridge", "dash"))},
}


def shift(a, dy, dx, fill=False):
    out = np.full_like(a, fill)
    H, W = a.shape[:2]
    ys, yd = (slice(0, H - dy), slice(dy, H)) if dy >= 0 else (slice(-dy, H), slice(0, H + dy))
    xs, xd = (slice(0, W - dx), slice(dx, W)) if dx >= 0 else (slice(-dx, W), slice(0, W + dx))
    out[yd, xd] = a[ys, xs]
    return out


def components(mask, conn=N8):
    H, W = mask.shape
    lab = np.zeros((H, W), int)
    comps = []
    n = 0
    for y, x in zip(*np.nonzero(mask)):
        if lab[y, x]:
            continue
        n += 1
        st = [(y, x)]
        lab[y, x] = n
        px = []
        while st:
            cy, cx = st.pop()
            px.append((cy, cx))
            for dy, dx in conn:
                yy, xx = cy + dy, cx + dx
                if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n
                    st.append((yy, xx))
        comps.append(px)
    return lab, comps


class Still:
    def __init__(self, d):
        self.d = d
        m = self.meta = json.load(open(os.path.join(d, "meta.json")))
        src = "noface_post" if os.path.exists(os.path.join(d, "noface_post.png")) else "noface"
        if src == "noface":
            shutil.copyfile(os.path.join(d, "noface.png"), os.path.join(d, "noface_post.png"))
            shutil.copyfile(os.path.join(d, "noface_id.png"), os.path.join(d, "noface_post_id.png"))
        self.img = np.array(Image.open(os.path.join(d, "noface_post.png")).convert("RGBA"))
        self.ids = np.array(Image.open(os.path.join(d, "noface_post_id.png")).convert("RGBA"))
        self.H, self.W = self.img.shape[:2]
        self.px = m["px"]
        self.k = m["px"] / 144.0
        self.codes = list(m["colors"].keys())
        self.col = {c: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for c, h in m["colors"].items()}
        by = {self.col[c]: i for i, c in enumerate(self.codes)}
        rgb = self.img[..., :3]
        key = (rgb[..., 0].astype(int) << 16) | (rgb[..., 1].astype(int) << 8) | rgb[..., 2]
        self.code = np.full((self.H, self.W), -1, int)
        for c, i in by.items():
            self.code[key == ((c[0] << 16) | (c[1] << 8) | c[2])] = i
        self.code[self.img[..., 3] == 0] = -1
        self.mats = {n: v["id"] for n, v in m["materials"].items()}
        self.parts = m["parts"]
        self.pname = {v: k for k, v in m["parts"].items()}
        self.log = []
        self.fp = None
        fpp = os.path.join(d, "facepass.json")
        if os.path.exists(fpp):
            self.fp = json.load(open(fpp))
        self.depth = self._depth()
        self.facewin = self._facewin()

    # ---- ids
    @property
    def a(self):
        return self.ids[..., 3] > 0

    @property
    def mat(self):
        return np.where(self.a, self.ids[..., 0].astype(int), 0)

    @property
    def part(self):
        return np.where(self.a, self.ids[..., 1].astype(int), -1)

    def ci(self, c):
        return self.codes.index(c)

    def hair(self):
        return self.a & np.isin(self.mat, [self.mats["hair"], self.mats["hairtip"]])

    def is_code(self, *cs):
        return np.isin(self.code, [self.ci(c) for c in cs])

    def set(self, y, x, c, mat=None, part=None):
        self.img[y, x, :3] = self.col[c]
        self.img[y, x, 3] = 255
        self.code[y, x] = self.ci(c)
        if mat is not None:
            self.ids[y, x, 0] = self.mats[mat] if isinstance(mat, str) else mat
            self.ids[y, x, 3] = 255
        if part is not None:
            self.ids[y, x, 1] = part

    def clear(self, y, x):
        self.img[y, x] = 0
        self.ids[y, x] = 0
        self.code[y, x] = -1

    def names(self, prefix):
        return [pid for n, pid in self.parts.items() if n.startswith(prefix)]

    # ---- passes at sprite resolution
    def _depth(self):
        """per sprite px: the nearest sub-pixel depth (m) of the sprite px's own material and part"""
        p = os.path.join(self.d, "depth.png")
        ip = os.path.join(self.d, "id.png")
        if not (os.path.exists(p) and os.path.exists(ip)):
            return None
        D0, D1 = self.meta["depth_range"]
        ss = self.meta["ss"]
        dep = np.asarray(Image.open(p))[..., 0].astype(np.float32) / 255.0 * (D1 - D0) + D0
        idp = np.asarray(Image.open(ip))
        H, W = self.H, self.W
        dep = dep[:H * ss, :W * ss].reshape(H, ss, W, ss).transpose(0, 2, 1, 3).reshape(H, W, ss * ss)
        im = idp[:H * ss, :W * ss, 0].reshape(H, ss, W, ss).transpose(0, 2, 1, 3).reshape(H, W, ss * ss)
        ip_ = idp[:H * ss, :W * ss, 1].reshape(H, ss, W, ss).transpose(0, 2, 1, 3).reshape(H, W, ss * ss)
        ia = idp[:H * ss, :W * ss, 3].reshape(H, ss, W, ss).transpose(0, 2, 1, 3).reshape(H, W, ss * ss) > 127
        same = ia & (im == self.mat[..., None]) & (ip_ == self.ids[..., 1:2].astype(int))
        d = np.where(same, dep, 1e9).min(-1)
        d = np.where(same.any(-1), d, np.where(ia, dep, 1e9).min(-1))
        return d

    def _facewin(self):
        p = os.path.join(self.d, "facewin.png")
        if not os.path.exists(p):
            return None
        f = np.asarray(Image.open(p))[..., 3] > 0
        ss = self.meta["ss"]
        H, W = self.H, self.W
        f = f[:H * ss, :W * ss].reshape(H, ss, W, ss).transpose(0, 2, 1, 3).reshape(H, W, ss * ss)
        return f.mean(-1) >= 0.5

    def anchor(self, k):
        a = self.meta["anchors"].get(k)
        return None if a is None else (a[0] / self.meta["ss"], a[1] / self.meta["ss"])

    def light_sign(self):
        return 1 if self.meta["light_cam"][0] >= 0 else -1

    def head_skin(self):
        return self.a & (self.mat == self.mats["skin"]) & (self.part == self.parts.get("head", -9))

    def eye_row(self):
        es = [self.anchor(k) for k in ("eye_L", "eye_R") if self.anchor(k)]
        return int(round(sum(e[1] for e in es) / len(es))) if es else None

    def far_sign(self):
        """screen side of the far cheek: the head's left axis against its facing (facepass axes)"""
        if self.fp:
            ax = self.fp["axes"]
            s = ax["fwd"][0] * ax["left"][0]
            if abs(ax["fwd"][0]) > 0.08:
                return 1 if ax["fwd"][0] > 0 else -1
        e = [self.anchor(k) for k in ("eye_L", "eye_R")]
        return 1 if e[0] and e[1] and e[0][0] > e[1][0] else -1

    def save(self):
        Image.fromarray(self.img).save(os.path.join(self.d, "noface.png"))
        Image.fromarray(self.ids).save(os.path.join(self.d, "noface_id.png"))
        im = Image.fromarray(self.img)
        for z in (3, 6):
            im.resize((im.width * z, im.height * z), Image.NEAREST).save(os.path.join(self.d, f"noface_x{z}.png"))


# ---------------------------------------------------------------------------- steps
def step_veil(S, P):
    """veil islands inside the hair: small veil components mostly bordered by hair -> the hair
    behind them (the most common neighbouring hair part, in the shadow tone)"""
    vm = S.a & (S.mat == S.mats.get("veil", -9))
    hair = S.hair()
    _, comps = components(vm)
    maxn = P.get("veil_max", 10 if S.px >= 120 else 4)
    n = 0
    for c in comps:
        if len(c) > maxn:
            continue
        border, hp = 0, {}
        cs = set(c)
        for y, x in c:
            for dy, dx in N4:
                yy, xx = y + dy, x + dx
                if (yy, xx) in cs or not (0 <= yy < S.H and 0 <= xx < S.W):
                    continue
                border += 1
                if hair[yy, xx]:
                    p = int(S.ids[yy, xx, 1])
                    hp[p] = hp.get(p, 0) + 1
        if border and sum(hp.values()) / border >= P.get("veil_hair_share", 0.75):
            p = max(hp, key=hp.get)
            for y, x in c:
                S.set(y, x, "I3", mat="hair", part=p)
            n += len(c)
    S.log.append(f"veil {n}")


def empties(S):
    body = S.a
    return sum(shift(~body, dy, dx, True).astype(int) for dy, dx in N8)


def step_dangle(S, P):
    n_del = n_lit = 0
    for _ in range(2):
        hair = S.hair()
        e = empties(S)
        dark = S.is_code("I3", "I4", "OL")
        cand = hair & dark & (e >= 5)
        if not cand.any():
            break
        hx = S.anchor("head")[0]
        ls = S.light_sign()
        for y, x in zip(*np.nonzero(cand)):
            # a root of 2+ hair px in front of it keeps a lit tip; alone, it goes
            nb = sum(1 for dy, dx in N8 if 0 <= y + dy < S.H and 0 <= x + dx < S.W and hair[y + dy, x + dx])
            if (x - hx) * ls > 2 * S.k and nb >= 2:
                S.set(y, x, "I2")
                n_lit += 1
            else:
                S.clear(y, x)
                n_del += 1
    S.log.append(f"dangle del {n_del} lit {n_lit}")


def nearer_neighbour(S, strict=0.008):
    """px with a 4-neighbour of a different part or material that is nearer by 'strict' m (an
    overlap: this px lies under or behind it)"""
    if S.depth is None:
        return np.zeros((S.H, S.W), bool)
    d = np.where(S.a, S.depth, 1e9)
    out = np.zeros((S.H, S.W), bool)
    for dy, dx in N4:
        qd = shift(d, dy, dx, 1e9)
        qa = shift(S.a, dy, dx, False)
        qp = shift(S.part, dy, dx, -1)
        qm = shift(S.mat, dy, dx, -1)
        out |= S.a & qa & ((qp != S.part) | (qm != S.mat)) & (qd + strict < d)
    return out


def crown_rows(S, P):
    """rows of the crown: from the hair top to 2 rows under the dash path (the ring), per column"""
    allh = S.hair()
    er = S.eye_row()
    lim = np.zeros((S.H, S.W), bool)
    if er is None:
        return lim
    depth = P.get("dash_depth", 5 if S.px >= 120 else 3)
    for x in range(S.W):
        ys = np.nonzero(allh[:er, x])[0]
        if len(ys):
            lim[ys.min(): min(er, ys.min() + depth + 3), x] = True
    return lim


def step_tone(S, P):
    hair = S.a & (S.mat == S.mats["hair"])
    lit = hair & S.is_code("I0", "I1") & (crown_rows(S, P) if P.get("plates", "crown") == "crown" else True)
    for y, x in zip(*np.nonzero(lit)):
        S.set(y, x, "I2")
    over = nearer_neighbour(S, P.get("i4_step", 0.008))
    i4 = hair & S.is_code("I4") & ~over
    for y, x in zip(*np.nonzero(i4)):
        S.set(y, x, "I3")
    S.log.append(f"tone lit->I2 {int(lit.sum())} I4->I3 {int(i4.sum())}")


RIBBON_PARTS = ("hair_tail", "hair_mantle", "hair_side_", "hair_sidemass")


def step_ribbon(S, P):
    """overlapping ribbons: the clump behind another (a nearer ribbon part on its 4-neighbour, then
    one px further into its own part) steps one tone darker, so the back hair reads as 2-3 ribbons
    lying over each other rather than one tube (critique 3; HR-P12 under the overlaps)"""
    rp = [pid for n, pid in S.parts.items() if n.startswith(RIBBON_PARTS)]
    hair = S.a & (S.mat == S.mats["hair"]) & np.isin(S.part, rp)
    # below the chin only: on the head the darker overlaps sank the hair under I1+I2 = 0.33 (HR-P07;
    # idle 0.32 -> 0.26), and the head's clumps are the fringe's and the dashes' job
    ys = np.nonzero(S.head_skin().any(1))[0]
    chin = ys.max() if len(ys) else 0
    hair[:chin + 1] = False
    seed = hair & nearer_neighbour(S, P.get("ribbon_step", 0.010))
    grow = seed.copy()
    for dy, dx in N4:
        grow |= shift(seed, dy, dx, False) & hair & (shift(S.part, dy, dx, -1) == S.part)
    down = {"I0": "I1", "I1": "I2", "I2": "I3"}
    n = 0
    for y, x in zip(*np.nonzero(grow)):
        c = S.codes[S.code[y, x]] if S.code[y, x] >= 0 else None
        if c in down:
            S.set(y, x, down[c])
            n += 1
    S.log.append(f"ribbon {n}")


def step_sep(S, P):
    fr = S.names("hair_fringe")
    hair = S.hair()
    part = S.part
    isf = hair & np.isin(part, fr)
    n = 0
    for y, x in zip(*np.nonzero(isf & shift(isf, 0, -1, False) & (shift(part, 0, -1, -1) != part))):
        # px (y, x) and its right neighbour (y, x+1) belong to two fringe clumps
        a, b = (y, x), (y, x + 1)
        if S.depth is not None:
            far = a if S.depth[a] > S.depth[b] else b
        else:
            far = b
        if S.code[far] != S.ci("I4") and S.code[far] != S.ci("OL"):
            # never on the clump's last 1 px above the face (the tip notch stays the clump's own)
            below = (far[0] + 1, far[1])
            if below[0] < S.H and not hair[below]:
                continue
            S.set(far[0], far[1], "I4")
            n += 1
    S.log.append(f"sep {n}")


RIDGE_PARTS = ("hair_side_", "hair_mantle", "hair_tail")


def step_ridge(S, P):
    er = S.eye_row() or 0
    top = np.nonzero(S.hair().any(1))[0]
    crown_end = (top.min() if len(top) else 0) + int(round(P.get("crown_rows", 6) * S.k))
    ls = S.light_sign()
    hair = S.a & (S.mat == S.mats["hair"])
    ok = S.is_code("I2")
    ids = [pid for n, pid in S.parts.items() if n.startswith(RIDGE_PARTS)]
    fr = set(S.names("hair_fringe"))
    n = 0
    for pid in ids:
        m = hair & (S.part == pid)
        # one lit ridge per clump: the locks and the tail from the eye row down; the back masses
        # only where they run wide (the back view), never the crown (the dashes are its light)
        minw = P.get("ridge_minw", 3) if not S.pname[pid].startswith("hair_mantle") else P.get("ridge_minw_mantle", 6)
        for y in range(max(crown_end, er), S.H):
            xs = np.nonzero(m[y])[0]
            if len(xs) == 0:
                continue
            # runs of this part on the row
            runs = np.split(xs, np.nonzero(np.diff(xs) > 1)[0] + 1)
            for r in runs:
                if len(r) < minw or (pid in fr and y > er):
                    continue
                c = (r[0] + r[-1]) / 2 + ls * len(r) * 0.25
                x = int(round(c))
                x = min(max(x, r[0] + 1), r[-1] - 1)
                if ok[y, x]:
                    S.set(y, x, "I1")
                    n += 1
    S.log.append(f"ridge {n}")


def step_dash(S, P):
    hair = S.a & (S.mat == S.mats["hair"])
    allh = S.hair()
    ls = S.light_sign()
    er = S.eye_row()
    if er is None:
        return
    cols = np.nonzero(allh[:er].any(0))[0]
    if len(cols) < 4:
        return
    x0, x1 = cols.min(), cols.max()
    xc = (x0 + x1) / 2
    w = x1 - x0 + 1
    depth = P.get("dash_depth", 5 if S.px >= 120 else 3)
    # the ring path: 'depth' rows under the first hair px of each column (the silhouette's curve)
    path = []
    for x in range(x0, x1 + 1):
        ys = np.nonzero(allh[:er, x])[0]
        if len(ys) == 0:
            continue
        y = ys.min() + depth
        if y < er - 2 and (x - xc) * ls >= -P.get("dash_back", 0.30) * w:
            path.append((y, x))
    by_part = {}
    for y, x in path:
        if hair[y, x]:
            by_part.setdefault(int(S.part[y, x]), []).append((y, x))
    L = P.get("dash_len", 4 if S.px >= 120 else 2)
    cap = P.get("dash_max", 6 if S.px >= 120 else 2)
    # the widest clumps first; the lit side first on a tie
    order = sorted(by_part.items(), key=lambda kv: (-len(kv[1]), -np.mean([x for _, x in kv[1]]) * ls))
    placed = 0
    jit = (0, 1, -1, 0, 1, 0)
    for i, (pid, pts) in enumerate(order):
        if placed >= cap or len(pts) < 3:
            continue
        pts.sort(key=lambda p: p[1])
        mid = len(pts) // 2
        seg = pts[max(0, mid - L // 2): max(0, mid - L // 2) + L]
        dj = jit[i % len(jit)] if S.px >= 120 else 0
        seg = [(y + dj, x) for y, x in seg]
        if any(not hair[y, x] or S.part[y, x] != pid or S.code[y, x] == S.ci("I4") for y, x in seg):
            seg = [(y - dj, x) for y, x in seg]
            if any(not hair[y, x] or S.part[y, x] != pid for y, x in seg):
                continue
        for j, (y, x) in enumerate(seg):
            end = j == 0 or j == len(seg) - 1
            S.set(y, x, "I1" if (end and len(seg) > 2) else "I0")
        placed += 1
    S.log.append(f"dash {placed}")


def step_tips(S, P):
    fr = S.names("hair_fringe")
    hair = S.hair()
    skin = S.head_skin()
    if S.facewin is not None:
        skin = skin | (S.facewin & S.a & (S.mat == S.mats["skin"]))
    n = 0
    lab, comps = components(hair & np.isin(S.part, fr), N4)
    for c in comps:
        # the clump's lowest px over the face (skin right under it)
        ends = [(y, x) for y, x in c if y + 1 < S.H and skin[y + 1, x]]
        if not ends:
            continue
        y, x = max(ends)
        er = S.eye_row() or S.H
        if y > er - 3 * S.k:
            continue                               # a tip at the eye line stays hair (no azure tear)
        if sum(1 for dy, dx in ((0, -1), (0, 1)) if hair[y + dy, x + dx]) > 1:
            continue                               # a flat run, not a tip (the face lane tapers it)
        if S.px >= 120:
            S.set(y, x, "A4", mat="hairtip")
            if y - 1 >= 0 and hair[y - 1, x] and S.code[y - 1, x] != S.ci("I4"):
                S.set(y - 1, x, "A3", mat="hairtip")
        else:
            S.set(y, x, "A3", mat="hairtip")
        n += 1
    S.log.append(f"tips {n}")


def step_far(S, P):
    er, fs = S.eye_row(), S.far_sign()
    skin = S.head_skin()
    hair = S.hair()
    ys = np.nonzero(skin.any(1))[0]
    if er is None or not len(ys):
        return
    chin = ys.max()
    hx = S.anchor("head")[0]
    n = 0
    for y in range(er, chin + 1):
        xs = np.nonzero(skin[y])[0]
        if not len(xs):
            continue
        xe = xs.max() if fs > 0 else xs.min()
        x = xe + fs
        # the post draws the jaw contour on the hair px beside the face in S3 (rosace_post.lines,
        # under_face): the hair proper starts one px further out
        if 0 <= x < S.W and hair[y, x] and S.is_code("S3", "S4")[y, x]:
            x += fs
        if 0 <= x < S.W and hair[y, x] and S.is_code("I3", "I4", "OL")[y, x] and (x - hx) * fs > 0:
            S.set(y, x, "I2")
            n += 1
    S.log.append(f"far {n}")


def step_window(S, P):
    if not S.fp or S.facewin is None:
        return
    br = S.fp["refs"].get("ref_eyeblow", {})
    hair = S.hair()
    n = 0
    for side, pts in br.items():
        if not pts:
            continue
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        cells = {(int(np.floor(y)), int(np.floor(x))) for x, y, *_ in pts}
        y0, y1 = int(np.floor(min(ys))), int(np.floor(max(ys)))
        x0, x1 = int(np.floor(min(xs))), int(np.floor(max(xs)))
        win = set()
        for y, x in cells:
            win |= {(y, x - 1), (y, x), (y, x + 1)}
            win.add((y - 1, x))                     # the row over the brow (FC-P27: no hair within 1 px)
        for y, x in sorted(win):
            if 0 <= y < S.H and 0 <= x < S.W and hair[y, x] and S.facewin[y, x]:
                S.set(y, x, "S2", mat="skin", part=S.parts["head"])
                n += 1
    S.log.append(f"window {n}")


ROSE = {144: ["hgg", "gGg", "ggh"], 80: ["Gg", "gh"]}
CROSS = {144: [".G.", "GGg", ".h."], 80: ["G"]}
GK = {"G": "G1", "g": "G2", "h": "G3", "0": "G0"}


def stamp(S, cy, cx, pat, back=True):
    h, w = len(pat), len(pat[0])
    y0, x0 = int(round(cy - (h - 1) / 2)), int(round(cx - (w - 1) / 2))
    face = S.head_skin()
    hair = S.hair()
    gid = S.parts.get("gold_hair")
    for j, row in enumerate(pat):
        for i, ch in enumerate(row):
            y, x = y0 + j, x0 + i
            if ch == "." or not (0 <= y < S.H and 0 <= x < S.W) or face[y, x]:
                continue
            S.set(y, x, GK[ch], mat="gold", part=gid)
    if back:
        for j in range(-1, h + 1):
            for i in range(-1, w + 1):
                y, x = y0 + j, x0 + i
                inside = 0 <= j < h and 0 <= i < w and pat[j][i] != "."
                if inside or not (0 <= y < S.H and 0 <= x < S.W):
                    continue
                if hair[y, x] and S.code[y, x] in (S.ci("I1"), S.ci("I2"), S.ci("I0")):
                    S.set(y, x, "I3")


def step_stamp(S, P):
    gid = S.parts.get("gold_hair")
    if gid is None:
        return
    g = S.a & (S.part == gid)
    er = S.eye_row() or 0
    skin = S.head_skin()
    ys = np.nonzero(skin.any(1))[0]
    chin = ys.max() if len(ys) else er
    _, comps = components(g)
    sz = 144 if S.px >= 120 else 80
    out = []
    pin = [c for c in comps if np.mean([y for y, _ in c]) < er - 1]
    if pin:
        c = min(pin, key=lambda c: np.mean([y for y, _ in c]))
        cy, cx = np.mean([y for y, _ in c]), np.mean([x for _, x in c])
        stamp(S, cy, cx, ROSE[sz])
        out.append("rose")
    # clasps: clusters on a sidelock, from the chin row down (the lock's lower third)
    side = S.names("hair_side_")
    hair = S.hair()
    for c in comps:
        cy, cx = np.mean([y for y, _ in c]), np.mean([x for _, x in c])
        if cy < chin - 2 * S.k or cy > chin + 30 * S.k:
            continue
        near_side = any(0 <= y + dy < S.H and 0 <= x + dx < S.W and hair[y + dy, x + dx]
                        and S.part[y + dy, x + dx] in side for y, x in c for dy, dx in N8)
        if near_side:
            stamp(S, cy, cx, CROSS[sz], back=sz == 144)
            out.append("clasp")
    S.log.append("stamp " + "+".join(out))


def step_outline(S):
    """the outline ring again: body px with an empty 4-neighbour get their ring; ring px that no
    longer touch the body go"""
    body = S.a
    touch = np.zeros_like(body)
    for dy, dx in N4:
        touch |= shift(body, dy, dx, False)
    ring_old = (S.img[..., 3] > 0) & ~body
    ring_new = ~body & touch
    gone = ring_old & ~ring_new
    add = ring_new & ~ring_old
    for y, x in zip(*np.nonzero(gone)):
        S.img[y, x] = 0
        S.code[y, x] = -1
    for y, x in zip(*np.nonzero(add)):
        S.img[y, x, :3] = S.col["OL"]
        S.img[y, x, 3] = 255
        S.code[y, x] = S.ci("OL")
    S.log.append(f"outline -{int(gone.sum())} +{int(add.sum())}")


def hue_shift(hexc, dh, ks):
    import colorsys
    r, g, b = (int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, l, s_ = colorsys.rgb_to_hls(r, g, b)
    r, g, b = colorsys.hls_to_rgb((h + dh) % 1.0, l, s_ * ks)
    return tuple(int(round(v * 255)) for v in (r, g, b))


def final_hue(still, dh=0.028, ks=0.90):
    """DESIGN 13 open question 3 as a trial: the hair's indigo one step toward violet (+10 degrees of
    hue) and 10% less saturated, on hair px only (by noface_id), after the face, so the boots, the
    stockings and the haft keep I0-I4 and the head separates from the legs. Adds 3 colours (I1-I3)."""
    S = Still(still)
    img = np.array(Image.open(os.path.join(still, "still.png")).convert("RGBA"))
    ids = np.array(Image.open(os.path.join(still, "noface_id.png")).convert("RGBA"))
    hair = (ids[..., 3] > 0) & np.isin(ids[..., 0], [S.mats["hair"]])
    n = 0
    # I1-I3 only: I0 (the dashes' 1 px core) and I4 (the separators, next to OL) stay shared, so the
    # sprite gains 3 colours (29 -> 32, rubric 6's cap) instead of 5
    for c in ("I1", "I2", "I3"):
        src = S.col[c]
        sel = hair & (img[..., :3] == src).all(-1)
        img[sel, :3] = hue_shift(S.meta["colors"][c], dh, ks)
        n += int(sel.sum())
    Image.fromarray(img).save(os.path.join(still, "still.png"))
    im = Image.fromarray(img)
    for z in (3, 6):
        im.resize((im.width * z, im.height * z), Image.NEAREST).save(os.path.join(still, f"still_x{z}.png"))
    return [f"hue {n} px"]


def face_window(still, P=None):
    P = P or {}
    """after the face (overrides.py apply): open a skin window in the fringe round each brow the face
    lane drew. The brow px are the face step's dark px on hair, over the face window, above the eye
    row; their 8-neighbours on hair become skin (S3 on the row over the brow: the fringe's cast
    shadow, a solid band; S2 beside and under it), so the brow sits in skin (FC-P27, FC-P29).
    Rewrites still.png (+ x3, x6); the pre-window still is kept as still_prewin.png."""
    S = Still(still)
    face = np.array(Image.open(os.path.join(still, "still.png")).convert("RGBA"))
    pre = np.array(Image.open(os.path.join(still, "noface.png")).convert("RGBA"))
    ids = np.array(Image.open(os.path.join(still, "noface_id.png")).convert("RGBA"))
    Image.fromarray(face).save(os.path.join(still, "still_prewin.png"))
    er = S.eye_row()
    if er is None or S.facewin is None:
        return ["window: no face"]
    hair = (ids[..., 3] > 0) & np.isin(ids[..., 0], [S.mats["hair"], S.mats["hairtip"]])
    changed = (face[..., :3] != pre[..., :3]).any(-1)
    lum = face[..., :3].astype(int).sum(-1)
    win = S.facewin | shift(S.facewin, 1, 0) | shift(S.facewin, 0, 1) | shift(S.facewin, 0, -1)
    brow = changed & hair & win & (lum < 330)
    # brows only: the lashes and flicks sit within ~4 rows over the eye anchors' row (144); the face
    # lane draws no brows at 80
    if S.px < 120:
        return ["window: none at 80"]
    brow[er - int(round(P.get("brow_above", 5) * S.k)) + 1:] = False
    lab, comps = components(brow)
    n = 0
    skin_code = {S.col[c] for c in ("S1", "S2", "S3", "S4", "SB")}
    for c in comps:
        if len(c) < 2:
            continue
        cs = set(c)
        xs = [x for _, x in c]
        x0, x1 = min(xs), max(xs)
        for x in range(x0 - 1, x1 + 2):
            col = [y for y, xx in c if xx == x]
            end = x < x0 or x > x1
            top = (min(col) if col else min(y for y, _ in c)) - (0 if end else 1)
            # the arch: from over the brow down to the first skin px (the forehead under the fringe)
            first = True
            for y in range(top, er + 1):
                if not (0 <= y < S.H and 0 <= x < S.W):
                    continue
                if tuple(face[y, x, :3]) in skin_code and not hair[y, x]:
                    break
                if (y, x) in cs or changed[y, x] or not hair[y, x] or not win[y, x]:
                    first = False
                    continue
                face[y, x, :3] = S.col["S3" if first else "S2"]
                first = False
                n += 1
    Image.fromarray(face).save(os.path.join(still, "still.png"))
    im = Image.fromarray(face)
    for z in (3, 6):
        im.resize((im.width * z, im.height * z), Image.NEAREST).save(os.path.join(still, f"still_x{z}.png"))
    return [f"face window {n} px round {len([c for c in comps if len(c) >= 2])} brows"]


STEPS = {"veil": step_veil, "dangle": step_dangle, "tone": step_tone, "ribbon": step_ribbon, "sep": step_sep, "ridge": step_ridge,
         "dash": step_dash, "tips": step_tips, "far": step_far, "window": step_window, "stamp": step_stamp}


def run(still, preset="p0", only=None):
    P = dict(PRESETS[preset])
    steps = only or P["steps"]
    S = Still(still)
    for s in ALL:
        if s in steps and s in STEPS:
            STEPS[s](S, P)
    step_outline(S)
    S.save()
    json.dump({"preset": preset, "steps": list(steps), "log": S.log},
              open(os.path.join(still, "hair_px.json"), "w"), indent=1)
    return S.log


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--still", required=True)
    ap.add_argument("--preset", default="p0")
    ap.add_argument("--only", default="")
    ap.add_argument("--face-window", action="store_true", help="the post-face step (after overrides.py apply)")
    ap.add_argument("--hue", action="store_true", help="the post-face hue trial (preset step 'hue')")
    a = ap.parse_args()
    if a.face_window:
        print("hair_px face", "; ".join(face_window(a.still)))
        raise SystemExit
    if a.hue:
        print("hair_px hue", "; ".join(final_hue(a.still)))
        raise SystemExit
    log = run(a.still, a.preset, a.only.split(",") if a.only else None)
    print("hair_px", a.preset, "; ".join(log))
