"""The fall's cloud library (the fall loop, round 2; Dex 10-19 20:00Z: "simulate clouds in a way where it has volume and
good contrast, not just flat patches ... produce a sky that feels rich").

Each cloud is BUILT as a 3D distance field and RENDERED, then snapped to the pixel grid and the cloud palette:

- the form: an envelope of big billows blended smoothly (turrets rising from a flat-ish belly), its surface covered
  with cells, the cells on the lit top and sun side sprouting smaller cells (three nested scales, each grown out of the
  one under it: the sky ref's cauliflower), a fine noise on every surface (lumpy, never a smooth ellipse); a base that
  undulates and tears (never ruled);
- the light: one sun from the upper left; its light carried THROUGH the cloud by the density (soft self-shadow:
  half-tones at the terminator, soft shadow edges), the cells' own cast shadows (crisp, short, on their far side
  only), the sky's light over upward faces, occlusion in the crevices where cells meet (the darkest darks), a lit rim
  along every edge that faces the sun (the sky ref's scalloped silver edges, also on shaded cells), a little bounce
  from below on the bellies;
- the colours: one ramp from Dex's two sky refs (warm cream tops, peach and lilac half-tones at the terminator, the
  sky's cool blue in the shade, deep blue crevices), compressed toward the sky with distance (`far`);
- pixel art: one value per art px, cleaned of lone specks, binary alpha (crisp lit outlines; the shaded outline
  broken by a torn one-px fringe).

Rendered natively at each density the game draws it at (level 1, 0.5, 0.25): a small copy is a render, not a
decimation. Output (tools/clouds/build.py): public/tesu/clouds/<id>/l<level>/00.webp + manifest.json (the "frames"
sprite kind) and public/tesu/clouds/library.json.
"""

from __future__ import annotations

import math

import numpy as np
from scipy import ndimage
from scipy.spatial import cKDTree

# toward the sun: left (x-), up (y-, screen y runs down), toward the viewer (z+)
import os as _os
SUN_DIR = [float(v) for v in _os.environ.get("CLOUD_SUN", "-0.66,-0.72,-0.1").split(",")]
SUN = np.array(SUN_DIR, dtype=np.float32)
SUN /= np.linalg.norm(SUN)
LIGHT_TAG = {"sun": [round(float(v), 3) for v in SUN], "from": "upper left", "flip": False}

# ---------------------------------------------------------------------------------------------------------------
# colour: the near ramp, lightest first (Dex's sky ref + painterly cumulus ref; luminance in the comments)
NEAR = [
    "#fffcf4",  # 251 the sun's crown
    "#f9f1e6",  # 241 lit cream
    "#f1e3d9",  # 229 peach half-tone
    "#e0d6dc",  # 216 lilac-grey half-tone
    "#c9cadb",  # 203 lilac-blue half-tone (the terminator)
    "#aebfd6",  # 189 cool light shade
    "#95aecb",  # 172 shade
    "#7f9cbf",  # 155 shade
    "#6a89b1",  # 137 deep shade
    "#5776a1",  # 119 crevice
    "#46648f",  # 101 the deepest crevice
]


def hexrgb(h: str) -> tuple[int, int, int]:
    v = int(h[1:], 16)
    return (v >> 16) & 255, (v >> 8) & 255, v & 255


def ramp_far(far: float, sky=(150, 196, 222)) -> list[tuple[int, int, int]]:
    """The near ramp compressed toward the sky (distance: values close up, cooler, the shade lighter)."""
    out = []
    for i, h in enumerate(NEAR):
        c = np.array(hexrgb(h), float)
        k = far * (0.18 + 0.62 * i / (len(NEAR) - 1))
        c = c + (np.array(sky, float) - c) * k
        out.append(tuple(int(round(v)) for v in c))
    return out


# ---------------------------------------------------------------------------------------------------------------
# noise


class Noise:
    def __init__(self, seed: int):
        r = np.random.default_rng(seed)
        self.perm = np.concatenate([r.permutation(256)] * 2).astype(np.int64)
        self.vals = r.random(512).astype(np.float32)

    def __call__(self, x, y, z=None):
        x = np.asarray(x, np.float32)
        y = np.asarray(y, np.float32)
        z = np.zeros_like(x) if z is None else np.asarray(z, np.float32)
        xi = np.floor(x).astype(np.int64)
        yi = np.floor(y).astype(np.int64)
        zi = np.floor(z).astype(np.int64)
        xf, yf, zf = x - xi, y - yi, z - zi
        u = xf * xf * (3 - 2 * xf)
        v = yf * yf * (3 - 2 * yf)
        w = zf * zf * (3 - 2 * zf)
        p = self.perm
        xi &= 255
        yi &= 255
        zi &= 255

        def h(i, j, k):
            return self.vals[p[p[p[i] + j] + k]]

        x0 = h(xi, yi, zi) * (1 - u) + h(xi + 1, yi, zi) * u
        x1 = h(xi, yi + 1, zi) * (1 - u) + h(xi + 1, yi + 1, zi) * u
        x2 = h(xi, yi, zi + 1) * (1 - u) + h(xi + 1, yi, zi + 1) * u
        x3 = h(xi, yi + 1, zi + 1) * (1 - u) + h(xi + 1, yi + 1, zi + 1) * u
        return (x0 * (1 - v) + x1 * v) * (1 - w) + (x2 * (1 - v) + x3 * v) * w

    def fbm(self, x, y, z=None, oct=4, lac=2.03, gain=0.5):
        s, a, t, tot = 1.0, 1.0, 0.0, 0.0
        for o in range(oct):
            t = t + a * self(np.asarray(x) * s + o * 17.3, np.asarray(y) * s - o * 9.1, None if z is None else np.asarray(z) * s + o * 5.7)
            tot += a
            s *= lac
            a *= gain
        return t / tot


# ---------------------------------------------------------------------------------------------------------------
# the distance field: ellipsoids [x, y, z, r, q, k] (px; y down; q squashes the height; k the blend radius)

BIG = 1e4


class Field:
    def __init__(self, lo, hi, vs):
        self.vs = float(vs)
        self.o = np.array(lo, np.float32)
        n = np.ceil((np.array(hi, np.float32) - self.o) / self.vs).astype(int) + 1
        self.nx, self.ny, self.nz = int(n[0]), int(n[1]), int(n[2])
        self.d = np.full((self.nz, self.ny, self.nx), BIG, np.float32)

    def add(self, prims):
        vs, o = self.vs, self.o
        for x, y, z, r, q, k in prims:
            e = r + k + vs * 2
            ex, ey, ez = e, e * max(q, 0.2) + k, e
            i0, i1 = max(0, int((x - ex - o[0]) / vs)), min(self.nx, int((x + ex - o[0]) / vs) + 2)
            j0, j1 = max(0, int((y - ey - o[1]) / vs)), min(self.ny, int((y + ey - o[1]) / vs) + 2)
            k0, k1 = max(0, int((z - ez - o[2]) / vs)), min(self.nz, int((z + ez - o[2]) / vs) + 2)
            if i0 >= i1 or j0 >= j1 or k0 >= k1:
                continue
            gz = (np.arange(k0, k1, dtype=np.float32) * vs + o[2] - z)[:, None, None]
            gy = (np.arange(j0, j1, dtype=np.float32) * vs + o[1] - y)[None, :, None]
            gx = (np.arange(i0, i1, dtype=np.float32) * vs + o[0] - x)[None, None, :]
            sd = (np.sqrt(gx * gx + (gy / q) ** 2 + gz * gz) - r) * min(1.0, q)
            a = self.d[k0:k1, j0:j1, i0:i1]
            if k <= 0:
                np.minimum(a, sd, out=a)
            else:
                h = np.clip(0.5 + 0.5 * (a - sd) / k, 0, 1)
                a[:] = a * (1 - h) + sd * h - k * h * (1 - h)

    def at(self, P, arr=None):
        arr = self.d if arr is None else arr
        c = np.stack([(P[:, 2] - self.o[2]) / self.vs, (P[:, 1] - self.o[1]) / self.vs, (P[:, 0] - self.o[0]) / self.vs])
        return ndimage.map_coordinates(arr, c, order=1, mode="nearest")

    def points(self):
        """Voxel centres (z, y, x order flattened) as px."""
        zz, yy, xx = np.meshgrid(np.arange(self.nz), np.arange(self.ny), np.arange(self.nx), indexing="ij")
        return np.stack([xx.ravel() * self.vs + self.o[0], yy.ravel() * self.vs + self.o[1], zz.ravel() * self.vs + self.o[2]], 1).astype(np.float32)


def bounds_of(prims, pad):
    p = np.asarray(prims, np.float32)
    ex = p[:, 3] + p[:, 5]
    ey = p[:, 3] * p[:, 4] + p[:, 5]
    lo = [float(np.min(p[:, 0] - ex)) - pad, float(np.min(p[:, 1] - ey)) - pad, float(np.min(p[:, 2] - ex)) - pad]
    hi = [float(np.max(p[:, 0] + ex)) + pad, float(np.max(p[:, 1] + ey)) + pad, float(np.max(p[:, 2] + ex)) + pad]
    return lo, hi


def grow(rng, prims, *, spacing, radius, keep, inset=0.45, blend=0.32, vs=4.0, jitter=0.3, limit=None):
    """New cells grown out of the surface of `prims`' field: candidates on its surface, one per `spacing` cube,
    each kept with probability keep(p, n) (p, n arrays), radius radius*(1 +- jitter), centred inset*r inside."""
    lo, hi = bounds_of(prims, radius * 2 + vs * 2)
    F = Field(lo, hi, vs)
    F.add(prims)
    d = F.d
    gz, gy, gx = np.gradient(d)
    surf = np.abs(d) < vs * 0.6
    kk, jj, ii = np.nonzero(surf)
    if not len(kk):
        return []
    P = np.stack([ii * vs + F.o[0], jj * vs + F.o[1], kk * vs + F.o[2]], 1).astype(np.float32)
    N = np.stack([gx[kk, jj, ii], gy[kk, jj, ii], gz[kk, jj, ii]], 1)
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-6)
    # one candidate per spacing cube (jittered: the cube grid is offset at random)
    off = rng.random(3) * spacing
    key = np.floor((P + off) / spacing).astype(np.int64)
    h = (key[:, 0] * 73856093) ^ (key[:, 1] * 19349663) ^ (key[:, 2] * 83492791)
    order = rng.permutation(len(P))
    _, first = np.unique(h[order], return_index=True)
    sel = order[first]
    P, N = P[sel], N[sel]
    w = keep(P, N)
    pick = rng.random(len(P)) < w
    P, N = P[pick], N[pick]
    if limit is not None and len(P) > limit:
        idx = rng.choice(len(P), limit, replace=False)
        P, N = P[idx], N[idx]
    out = []
    for p, n in zip(P, N):
        r = radius * (1 + (rng.random() * 2 - 1) * jitter)
        c = p - n * r * inset
        out.append([float(c[0]), float(c[1]), float(c[2]), r, 1.0, r * blend])
    return out


# ---------------------------------------------------------------------------------------------------------------
# forms (level-1 px; the anchor (0, 0) is the middle of the base)


def heap(rng, w, h, *, turrets=None, lead=-0.22, depth=0.75, belly=0.36, cells=1.0, sprouts=1.0, lean=0.0, cell_px=None, sprout_px=None, crowns=1.0, look_k=0.16, front_cells=0.35, cell_space=0.8, cauli=False, florets=1.0, floret_px=None, tw=None, gaps=(), rolls=0.0, roll_px=None, taper=0.0, cut=True, roll_drop=0.0):
    """A cumulus heap (tall and narrow: a tower): an envelope of billows (a flat-ish belly of lying billows, turrets
    of billows rising from it, the tallest a little sunward, crowns of smaller billows on each), cells grown over its
    surface (denser up and sunward), sprouts grown along the lit top (three scales)."""
    n = turrets or max(2, int(round(1.0 + w / max(h, 1) * 1.5)))
    E = []
    hb = h * belly
    G = [(gx * w, gw * w) for gx, gw in gaps]

    def in_gap(x, R):
        # how much a form at x (radius R) must shrink to keep a gap clear (1: untouched, 0: drop it)
        k = 1.0
        for gx, gw in G:
            d = abs(x - gx) - gw / 2
            if d < R:
                k = min(k, max(0.0, d / R))
        return k

    def thin(x):
        # the ends of a long layer thin out (taper: the share of its width over which they do)
        if taper <= 0:
            return 1.0
        u = (x + w / 2) / w
        return float(np.clip(min(u, 1 - u) / taper, 0.0, 1.0)) ** 0.7

    # the belly: lying billows along the base (the base cut later slices them: a flat-ish, cool belly)
    xs = -w / 2
    while xs < w / 2:
        R = hb * (0.8 + 0.4 * rng.random())
        g = in_gap(xs + R * 0.7, R) * thin(xs + R * 0.7)
        if g > 0.3:
            Rg = R * (0.5 + 0.5 * g)
            E.append([xs + R * 0.7, -Rg * 0.15, (rng.random() - 0.5) * Rg * depth * 0.6, Rg, 0.55 + 0.1 * rng.random(), Rg * 0.45])
        xs += R * (0.8 + 0.5 * rng.random())
    # turrets: their heights fall away from the lead
    T = []
    lead_k = int(round((0.5 + lead * 0.5) * (n - 1)))
    for k in range(0 if tw else n):
        u = ((k + 0.5) / n - 0.5) + (rng.random() - 0.5) * 0.4 / n
        d = abs(u - lead * 0.5) * 2
        th = h * (0.93 + 0.07 * rng.random()) if k == lead_k else h * max(0.42, 1.0 - 0.7 * d ** 1.1) * (0.72 + 0.26 * rng.random())
        hw = w / n * (0.42 + 0.2 * rng.random())
        T.append((u * w * 0.78, hw, max(th, hb * 1.5)))
    for (u, hs, ws) in (tw or []):
        # (an art-directed turret: x share, height share, half-width share)
        T.append((u * w, ws * w, max(hs * h, hb * 1.2)))
    T = [(x, hw * min(1.0, 0.4 + in_gap(x, hw)), th * (0.35 + 0.65 * min(in_gap(x, hw), thin(x)))) for (x, hw, th) in T if in_gap(x, hw * 0.6) > 0.2 and thin(x) > 0.05]
    for (x, hw, th) in T:
        R = max(hw * 0.95, hb * 0.7)
        cy = -hb * 0.4
        top = -th + R * 0.7
        while True:
            u = min(1.0, -cy / th)
            xx = x + lean * (-cy) + (rng.random() - 0.5) * hw * 0.35
            rr = R * (0.9 + 0.2 * rng.random())
            E.append([xx, cy, (rng.random() - 0.5) * rr * depth * 0.5, rr, 0.92 + 0.12 * rng.random(), rr * look_k])
            if cy <= top + 1e-3:
                break
            cy = max(cy - R * (0.55 + 0.25 * rng.random()), top)
            R *= 0.88 + 0.08 * rng.random()
            top = -th + R * 0.7
        # the crown: a few billows heaped on the top, the sun side's the biggest
        for j in range(int(round((2 + 2.5 * rng.random()) * crowns))):
            a = (rng.random() - 0.6) * 2.2
            r2 = R * (0.48 + 0.3 * rng.random())
            E.append([x + lean * th + math.sin(a) * R * 0.85, top - math.cos(a) * R * 0.35 + r2 * 0.1, (rng.random() - 0.4) * R * 0.5 * depth, r2, 1.0, r2 * look_k])
    # rolls hanging along the base (a deck seen from under it: dark bellies, a lighter lower edge, the base undulating)
    if rolls > 0:
        rp = roll_px or h * 0.12
        x = -w / 2 + rp
        while x < w / 2 - rp:
            R = rp * (0.7 + 0.6 * rng.random()) * thin(x)
            g = in_gap(x, R * 1.2)
            if R > rp * 0.3 and g > 0.5 and rng.random() < rolls:
                for zz in (-0.45, 0.05, 0.5):
                    E.append([x + (rng.random() - 0.5) * R * 0.5, -R * (0.35 + 0.3 * rng.random()) + roll_drop * R * (0.4 + 1.2 * rng.random()), zz * hb * depth + (rng.random() - 0.5) * R, R * (0.85 + 0.3 * rng.random()), 0.72 + 0.1 * rng.random(), R * 0.3])
            x += rp * (1.1 + 0.9 * rng.random())
    hmax = max(t[2] for t in T) if T else h
    cell_px = cell_px or max(10.0, min(w, h) * 0.1)
    sprout_px = sprout_px or max(4.0, cell_px * 0.42)

    def keep_cells(P, N):
        u = np.clip(-P[:, 1] / hmax, 0, 1)
        vis = np.clip(N[:, 2] + 0.55, 0, 1) * (1 - (1 - front_cells) * np.clip(N[:, 2], 0, 1) ** 2)
        return np.clip((0.25 + 0.85 * u) * vis * (0.75 + 0.35 * np.clip(-N[:, 1] - N[:, 0] * 0.4, 0, 1)), 0, 1) * cells

    if cauli:
        return {"prims": E, "base": 0.0, "w": w, "h": h, "hmax": hmax,
                "cauli": [{"px": cell_px, "amp": 0.5 * cells, "up": 0.35, "sun": 0.25, "front": front_cells, "low": 0.3},
                          {"px": sprout_px, "amp": 0.5 * sprouts, "up": 0.9, "sun": 0.5, "front": 0.15, "low": 0.0}]}
    C = grow(rng, E, spacing=cell_px * cell_space, radius=cell_px, keep=keep_cells, inset=0.55, blend=0.25, vs=max(3.0, cell_px / 4))
    EC = E + C

    def keep_sprouts(P, N):
        up = np.clip(-N[:, 1] * 0.9 - N[:, 0] * 0.45, 0, 1)
        side = np.clip(1 - np.abs(N[:, 2]) * 0.6, 0, 1)
        u = np.clip(-P[:, 1] / hmax, 0, 1)
        return np.clip(up * side * (0.3 + 0.8 * u) * 1.4, 0, 1) * sprouts

    D = grow(rng, EC, spacing=sprout_px * cell_space, radius=sprout_px, keep=keep_sprouts, inset=0.5, blend=0.25, vs=max(2.0, sprout_px / 3)) if sprouts > 0 else []
    # florets: the smallest cells, on the outline of the top and the sun side (seen edge-on), crisp cauliflower
    fl_px = floret_px or max(3.0, sprout_px * 0.42)

    def keep_florets(P, N):
        edge = np.clip(1 - np.abs(N[:, 2]) * 1.4, 0, 1)
        up = np.clip(-N[:, 1] * 0.8 - N[:, 0] * 0.6 + 0.15, 0, 1)
        return np.clip(edge * up * 1.6, 0, 1) * florets

    Fl = grow(rng, EC + D, spacing=fl_px * 1.0, radius=fl_px, keep=keep_florets, inset=0.45, blend=0.2, vs=max(1.5, fl_px / 2.5)) if florets > 0 else []
    return {"prims": EC + D + Fl, "base": 0.0, "w": w, "h": h, "hmax": hmax, "cut": cut}


# ---------------------------------------------------------------------------------------------------------------
# the cauliflower: cells as a cellular displacement of the envelope's field (Worley F1 domes over feature points
# scattered on its surface: packed florets, creases between them, never a dimple of bare envelope); the amount of
# each octave by where the surface faces (up, the sun, the viewer) and how high it is


def deck(rng, w, h, *, crowns=1.0, crown_h=0.55, rolls=1.0, gaps=(), depth=0.8, cell_px=None, florets=1.0, taper=0.12):
    """The cloud deck the camera falls onto and breaks out under, seen side-on: a long layer (a body of lying billows),
    cumulus crowns along its top (lit, the gust's hero), rolls hanging along its base (from below: dark bellies with a
    lighter lower edge, the base undulating and tearing), torn gaps right through it (x share -0.5..0.5, width share),
    its ends thinning and tearing. Base at y 0, top at about -h."""
    E = []
    G = [(gx * w, gw * w) for gx, gw in gaps]

    def in_gap(x, R):
        # how much a form at x (radius R) must shrink to keep a gap clear (1: untouched, 0: drop it)
        k = 1.0
        for gx, gw in G:
            d = abs(x - gx) - gw / 2
            if d < R:
                k = min(k, max(0.0, d / R))
        return k

    # the body: lying billows end to end, thinner toward the ends
    x = -w / 2
    while x < w / 2:
        u = (x + w / 2) / w
        th = min(1.0, min(u, 1 - u) / max(taper, 1e-3))
        R = h * (0.42 + 0.12 * rng.random()) * (0.45 + 0.55 * th)
        g = in_gap(x + R * 0.6, R)
        if g < 0.35:
            x += R * 0.5
            continue
        R *= 0.55 + 0.45 * g
        E.append([x + R * 0.6, -h * 0.42 + (rng.random() - 0.5) * h * 0.08, (rng.random() - 0.5) * R * depth, R, 0.62 + 0.12 * rng.random(), R * 0.5])
        x += R * (0.7 + 0.4 * rng.random())
    # crowns: cumulus heads along the top (a few big, many small), the sunward ones taller
    x = -w / 2 + h * 0.4
    while x < w / 2 - h * 0.3 and crowns > 0:
        u = (x + w / 2) / w
        th = min(1.0, min(u, 1 - u) / max(taper * 1.6, 1e-3))
        big = rng.random() < 0.3
        R = h * (0.3 + (0.2 if big else 0.0) + 0.12 * rng.random()) * th * in_gap(x, h * 0.4)
        if R > h * 0.08 and rng.random() < crowns:
            cy = -h * 0.72 - R * (0.2 + crown_h * rng.random() * (1.4 if big else 0.8))
            E.append([x, cy, (rng.random() - 0.4) * R * depth * 0.6, R, 0.9 + 0.15 * rng.random(), R * 0.3])
            if big:
                r2 = R * 0.62
                E.append([x + (rng.random() - 0.6) * R * 0.9, cy - R * 0.55, (rng.random() - 0.4) * R * 0.4, r2, 1.0, r2 * 0.3])
        x += h * (0.35 + 0.5 * rng.random())
    # rolls: hanging along the base, seen end-on, front to back
    x = -w / 2 + h * 0.2
    while x < w / 2 and rolls > 0:
        u = (x + w / 2) / w
        th = min(1.0, min(u, 1 - u) / max(taper, 1e-3))
        R = h * (0.16 + 0.1 * rng.random()) * (0.5 + 0.5 * th) * in_gap(x, h * 0.3)
        if R > h * 0.05 and rng.random() < rolls:
            for zz in (-0.5, 0.0, 0.45):
                E.append([x + (rng.random() - 0.5) * R * 0.4, -R * (0.55 + 0.35 * rng.random()), zz * h * depth * 0.8 + (rng.random() - 0.5) * R, R * (0.85 + 0.3 * rng.random()), 0.78, R * 0.35])
        x += max(R, h * 0.12) * (1.3 + 0.9 * rng.random())
    hmax = h * 1.3
    cell_px = cell_px or max(8.0, h * 0.075)
    sprout_px = max(4.0, cell_px * 0.45)

    def keep_cells(P, N):
        up = np.clip(-N[:, 1] * 0.8 - N[:, 0] * 0.3 + 0.35, 0, 1)
        vis = np.clip(N[:, 2] + 0.55, 0, 1)
        return np.clip(up * vis * 1.2, 0, 1)

    C = grow(rng, E, spacing=cell_px * 0.8, radius=cell_px, keep=keep_cells, inset=0.55, blend=0.25, vs=max(3.0, cell_px / 4))

    def keep_sprouts(P, N):
        up = np.clip(-N[:, 1] * 0.9 - N[:, 0] * 0.45, 0, 1)
        side = np.clip(1 - np.abs(N[:, 2]) * 0.6, 0, 1)
        return np.clip(up * side * 1.3, 0, 1)

    D = grow(rng, E + C, spacing=sprout_px * 0.8, radius=sprout_px, keep=keep_sprouts, inset=0.5, blend=0.25, vs=max(2.0, sprout_px / 3))
    fl_px = max(3.0, sprout_px * 0.42)

    def keep_florets(P, N):
        edge = np.clip(1 - np.abs(N[:, 2]) * 1.4, 0, 1)
        up = np.clip(-N[:, 1] * 0.8 - N[:, 0] * 0.6 + 0.15, 0, 1)
        return np.clip(edge * up * 1.6, 0, 1) * florets

    Fl = grow(rng, E + C + D, spacing=fl_px, radius=fl_px, keep=keep_florets, inset=0.45, blend=0.2, vs=max(1.5, fl_px / 2.5)) if florets > 0 else []
    return {"prims": E + C + D + Fl, "base": 2.0, "w": w, "h": h, "hmax": hmax, "deck": True}


def slab(rng, w, h, *, rows=3, roll_px=None, rolls=1.0, gaps=(), taper=0.06, depth=0.8, top_lumps=1.0):
    """The cloud deck's body seen side-on from beside and under it: a thick layer of lying billows (no crowns: the
    crowns are heaps placed on its top), rolls hanging along its base (from below: their lower edges catch the light
    from the haze below, their bellies dark where they meet the layer), the base undulating and torn; gaps right
    through it keep a clear sky. Base at y 0, top about -h."""
    E = []
    G = [(gx * w, gw * w) for gx, gw in gaps]

    def gapk(x, R):
        k = 1.0
        for gx, gw in G:
            d = abs(x - gx) - gw / 2
            if d < R:
                k = min(k, max(0.0, d / R))
        u = (x + w / 2) / w
        if taper > 0:
            k = min(k, float(np.clip(min(u, 1 - u) / taper, 0, 1)) ** 0.6)
        return k

    for r in range(rows):
        yc = -h * (0.26 + 0.6 * r / max(rows - 1, 1)) if rows > 1 else -h * 0.5
        x = -w / 2 + rng.random() * h * 0.2
        while x < w / 2:
            R = h * (0.36 + 0.14 * rng.random()) * (0.85 if r == rows - 1 else 1.0)
            g = gapk(x, R)
            if g > 0.25:
                Rg = R * (0.45 + 0.55 * g)
                q = 0.66 + 0.14 * rng.random()
                E.append([x, yc + (rng.random() - 0.5) * h * 0.08 + (1 - g) * Rg * 0.4 * (1 if r == 0 else -1), (rng.random() - 0.5) * Rg * depth, Rg, q, Rg * 0.45])
            x += R * (0.75 + 0.45 * rng.random())
    # the top: low lumps (the crowns are separate heaps; this only keeps the top from being ruled where it shows)
    x = -w / 2
    while x < w / 2 and top_lumps > 0:
        R = h * (0.14 + 0.12 * rng.random())
        g = gapk(x, R)
        if g > 0.4:
            E.append([x, -h * 0.98 + R * 0.4, (rng.random() - 0.3) * R * depth, R * g, 0.8, R * 0.3])
        x += R * (1.0 + 0.8 * rng.random())
    # rolls along the base
    rp = roll_px or h * 0.13
    x = -w / 2 + rp
    while x < w / 2 - rp and rolls > 0:
        R = rp * (0.65 + 0.7 * rng.random())
        g = gapk(x, R * 1.3)
        if g > 0.5 and rng.random() < rolls:
            for zz in (-0.4, 0.1, 0.55):
                E.append([x + (rng.random() - 0.5) * R * 0.6, R * (0.05 + 0.35 * rng.random()), zz * h * depth * 0.6 + (rng.random() - 0.5) * R, R * g * (0.85 + 0.3 * rng.random()), 0.7 + 0.12 * rng.random(), R * 0.3])
        x += rp * (1.0 + 1.0 * rng.random())
    cell = max(6.0, h * 0.06)

    def keep_cells(P, N):
        # cells over the front and the underside (what is seen from beside and below)
        return np.clip((N[:, 2] + 0.3) * 0.8 + np.clip(N[:, 1], 0, 1) * 0.6, 0, 1)

    C = grow(rng, E, spacing=cell * 0.85, radius=cell, keep=keep_cells, inset=0.55, blend=0.28, vs=max(2.5, cell / 3.5))
    fl = max(3.0, cell * 0.4)

    def keep_fl(P, N):
        # small florets on the rolls' lower outlines and the gaps' walls (seen edge-on)
        edge = np.clip(1 - np.abs(N[:, 2]) * 1.3, 0, 1)
        return np.clip(edge * (np.clip(N[:, 1], 0, 1) + np.clip(np.abs(N[:, 0]) - 0.3, 0, 1)) * 1.4, 0, 1)

    Fl = grow(rng, E + C, spacing=fl, radius=fl, keep=keep_fl, inset=0.45, blend=0.2, vs=max(1.5, fl / 2.5))
    return {"prims": E + C + Fl, "base": None, "w": w, "h": h, "hmax": h}


def stratus(rng, w, h, *, pieces=3, tilt=-0.04, shear=0.35, depth=0.5):
    """Low stratus: a few torn strokes of varied thickness on one west-rising tilt, tapered and broken at the ends, lit
    on top, their undersides cool and lost (the painterly cumulus ref's low streaks; never a ruled strip)."""
    E = []
    xs = np.sort(rng.random(pieces)) * w * 0.7 - w * 0.35
    for i, x0 in enumerate(xs):
        L = w * (0.25 + 0.3 * rng.random())
        th = h * (0.35 + 0.65 * rng.random())
        y0 = -h * 0.5 + (rng.random() - 0.5) * h * 1.2
        n = max(6, int(L / max(th * 0.8, 3)))
        for k in range(n):
            u = k / (n - 1)
            taper = math.sin(math.pi * u) ** 0.7
            r = th * 0.5 * (0.35 + 0.65 * taper) * (0.8 + 0.4 * rng.random())
            x = x0 + (u - 0.5) * L
            y = y0 + tilt * (x - x0) - shear * (u - 0.5) * th * 0.6
            E.append([x, y, (rng.random() - 0.5) * r * depth, r * 1.6, 0.42 + 0.2 * rng.random(), r * 0.6])
    cell = max(3.0, h * 0.12)

    def keep(P, N):
        return np.clip(-N[:, 1] * 1.2, 0, 1) * np.clip(1 - np.abs(N[:, 2]), 0, 1)

    C = grow(rng, E, spacing=cell * 0.9, radius=cell, keep=keep, inset=0.5, blend=0.3, vs=max(1.5, cell / 2.5))
    return {"prims": E + C, "base": None, "w": w, "h": h, "hmax": h}


def cirrus(rng, w, h, *, seed=1, tilt=-0.05, density=0.55, ramp=None):
    """High cirrus: thin torn filaments combed west, brighter in their middles, fading at their ends (2D; pixels)."""
    nz = Noise(seed * 5 + 9)
    W, H = int(w), int(h)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u = xx / W
    env = np.clip(np.sin(np.pi * u), 0, 1) ** 0.8 * np.clip(1 - np.abs((yy - H / 2 - tilt * (xx - W / 2)) / (H * 0.45)), 0, 1)
    # filaments: noise stretched along x and sheared with height (combed by the wind)
    f = nz.fbm((xx + yy * 3.0) / 70.0, yy / 2.2, oct=3)
    g = nz.fbm(xx / 160.0, yy / 18.0 + 4.0, oct=2)
    v = env * (0.55 * f + 0.45 * g)
    m = v > (1 - density) * 0.62
    q = np.full((H, W), -1, np.int16)
    lvl = np.clip((v - (1 - density) * 0.62) / 0.18, 0, 0.999)
    q[m] = (3 - (lvl[m] * 4).astype(np.int16)).clip(0, 3)
    q = majority(q)
    cols = np.array(ramp, np.uint8)
    rgba = np.zeros((H, W, 4), np.uint8)
    mm = q >= 0
    rgba[mm, :3] = cols[q[mm]]
    rgba[mm, 3] = 255
    return rgba


def streaks(rng, w, h, *, pieces=3, tilt=-0.035, seed=1, ramp=None, steps=(1, 2, 3, 4, 5, 6, 7), fiber=0.0, thick=(0.4, 1.0), lost=0.5):
    """Thin torn strokes (2D, painted, not modelled): low stratus (fiber 0) or high cirrus (fiber 1: combed, finer).
    Each stroke: a centre line rising west (tilt), a thickness that swells and tapers to nothing at both ends, torn
    edges from a noise stretched along the wind; lit on its top edge, cool below, its underside lost in broken px."""
    nz = Noise(seed * 5 + 9)
    W, H = int(w), int(h)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dens = np.full((H, W), -1.0, np.float32)
    shade = np.zeros((H, W), np.float32)
    starts = np.sort(rng.random(pieces)) * 0.55
    for i in range(pieces):
        L = W * (0.35 + 0.4 * rng.random())
        x0 = starts[i] * W + rng.random() * W * 0.1
        x1 = min(W - 2, x0 + L)
        yc0 = H * (0.25 + 0.5 * rng.random())
        t0 = H * 0.5 * (thick[0] + (thick[1] - thick[0]) * rng.random())
        u = np.clip((xx - x0) / max(x1 - x0, 1), 0, 1)
        inside = (xx >= x0) & (xx <= x1)
        prof = np.sin(np.pi * u) ** 0.9 * (0.7 + 0.6 * nz.fbm(xx / 120.0 + i * 7, np.full_like(xx, i * 3.1), oct=2))
        yc = yc0 + tilt * (xx - (x0 + x1) / 2) + (nz.fbm(xx / 200.0 + i, np.full_like(xx, 9.0 + i), oct=2) - 0.5) * H * 0.3
        t = t0 * prof
        # the top lumpy (a cumulus streak's small heads), the base flatter
        top = yc - t * (0.9 + 0.5 * (nz.fbm(xx / 18.0 + i * 3, np.full_like(xx, 2.0 + i), oct=2) - 0.5))
        bot = yc + t * (0.55 + 0.25 * (nz.fbm(xx / 60.0 + i * 5, np.full_like(xx, 5.0 + i), oct=2) - 0.5))
        torn = (nz.fbm((xx + yy * (2.5 + 3 * fiber)) / (40.0 - 25 * fiber), yy / (2.5 - fiber), oct=3) - 0.5) * (0.5 + 0.6 * fiber)
        d = np.minimum(yy - top, bot - yy) / np.maximum(t, 0.5) + torn
        d = np.where(inside, d, -1)
        sh = np.clip((yy - top) / np.maximum(bot - top, 1), 0, 1)
        better = d > dens
        dens = np.where(better, d, dens)
        shade = np.where(better, sh, shade)
    m = dens > 0
    # the underside lost: broken px along the lower part
    lostm = (shade > 0.62) & (nz(xx / 1.7, yy / 1.3 + 50) < lost * (shade - 0.62) / 0.38 * 1.6)
    m &= ~lostm
    k = np.clip(shade * len(steps) + (nz.fbm(xx / 7.0, yy / 3.0 + 30, oct=2) - 0.5) * 1.2, 0, len(steps) - 1).astype(np.int16)
    q = np.full((H, W), -1, np.int16)
    q[m] = np.array(steps, np.int16)[k[m]]
    q = majority(q)
    cols = np.array(ramp, np.uint8)
    rgba = np.zeros((H, W, 4), np.uint8)
    mm = q >= 0
    rgba[mm, :3] = cols[q[mm]]
    rgba[mm, 3] = 255
    return rgba


def hash01(G, salt):
    """A well-mixed hash of integer lattice points -> [0, 1) (splitmix64)."""
    with np.errstate(over="ignore"):
        g = G.astype(np.int64).astype(np.uint64)
        h = (g[:, 0] * np.uint64(0x9E3779B97F4A7C15)) ^ (g[:, 1] * np.uint64(0xC2B2AE3D27D4EB4F)) ^ (g[:, 2] * np.uint64(0x165667B19E3779F9)) ^ np.uint64(salt * 0x27D4EB2F165667C5 & 0xFFFFFFFFFFFFFFFF)
        h = (h ^ (h >> np.uint64(30))) * np.uint64(0xBF58476D1CE4E5B9)
        h = (h ^ (h >> np.uint64(27))) * np.uint64(0x94D049BB133111EB)
        h = h ^ (h >> np.uint64(31))
    return ((h >> np.uint64(40)).astype(np.float64) / float(1 << 24)).astype(np.float32)


def cauliflower(F, form, L, seed):
    vs = F.vs
    hmax = form.get("hmax", form.get("h", 400)) * L
    for o, spec in enumerate(form["cauli"]):
        cp = spec["px"] * L
        if cp < 1.6 or spec["amp"] <= 0:
            continue
        d = F.d
        # the envelope's normal (smoothed a little) where it may move
        band = cp * 0.7 + vs * 2
        kk, jj, ii = np.nonzero(np.abs(d) < band)
        if not len(kk):
            continue
        ds = ndimage.gaussian_filter(d, max(1.0, cp * 0.35 / vs))
        gz, gy, gx = np.gradient(ds)
        n = np.stack([gx[kk, jj, ii], gy[kk, jj, ii], gz[kk, jj, ii]], 1)
        n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-6)
        del gz, gy, gx, ds
        P = np.stack([ii * vs + F.o[0], jj * vs + F.o[1], kk * vs + F.o[2]], 1).astype(np.float32)
        # feature points: one per cp-cube near the surface (jittered; level-steady: drawn in level-1 px)
        rng = np.random.default_rng(seed * 31 + o)
        sp = spec["px"]
        lo = np.floor((P.min(0) / L - sp * 2) / sp).astype(int)
        hi = np.ceil((P.max(0) / L + sp * 2) / sp).astype(int)
        gxs, gys, gzs = [np.arange(lo[k], hi[k] + 1) for k in range(3)]
        G = np.stack(np.meshgrid(gxs, gys, gzs, indexing="ij"), -1).reshape(-1, 3).astype(np.float32)
        # (the jitter is a hash of the cube, so every level draws the same points)
        r3 = np.stack([hash01(G, seed * 7 + o * 101 + j) for j in range(3)], 1)
        feat = (G + 0.15 + 0.7 * r3) * sp * L
        fd = F.at(feat)
        feat = feat[np.abs(fd) < cp * 1.5]
        if not len(feat):
            continue
        f1, _ = cKDTree(feat).query(P, k=1)
        R = cp * 0.8
        dome = np.sqrt(np.clip(1 - (f1 / R) ** 2, 0, 1))
        u = np.clip(-P[:, 1] / max(hmax, 1), 0, 1)
        w = np.clip(spec["low"] + (1 - spec["low"]) * u, 0, 1)
        w *= np.clip(1 + spec["up"] * (-n[:, 1]) + spec["sun"] * (-n[:, 0]) - (1 - spec["front"]) * np.clip(n[:, 2], 0, 1) ** 2, 0, 1.4)
        F.d[kk, jj, ii] = d[kk, jj, ii] - dome * cp * spec["amp"] * np.clip(w, 0, 1.2)


# ---------------------------------------------------------------------------------------------------------------
# render


def render(form, *, level=1.0, seed=1, look=None, pad=8):
    """Render a form at a density level -> (value map V (-1 outside), ox, oy) in px of that level."""
    look = look or {}
    sun_ = np.array(look.get("sun", SUN), dtype=np.float32)
    sun_ /= np.linalg.norm(sun_)
    L = float(level)
    P = np.array(form["prims"], np.float32)
    P[:, [0, 1, 2, 3, 5]] *= L
    vs = max(1.0, look.get("vs", 2.0) * L)
    lo, hi = bounds_of(P, pad * L + vs * 3)
    F = Field(lo, hi, vs)
    F.add(P)
    if form.get("cauli"):
        cauliflower(F, form, L, seed)
    for gx, gw in form.get("carve", []):
        # a torn gap right through (its walls wander with height)
        nc = Noise(seed * 17 + int(abs(gx)) + 7)
        ys = np.arange(F.ny) * vs + F.o[1]
        xs = np.arange(F.nx) * vs + F.o[0]
        wob = (nc.fbm(ys / (60 * L), np.full_like(ys, 1.7), oct=3) - 0.5) * gw * 0.9 * L
        half = gw * 0.5 * L * (0.75 + 0.5 * nc.fbm(ys / (35 * L), np.full_like(ys, 5.1), oct=2))
        slot = np.abs(xs[None, :] - (gx * L + wob[:, None])) - half[:, None]
        np.maximum(F.d, -slot[None, :, :], out=F.d)
    # the surface's fine lumps (scale-steady: in level-1 px)
    nz = Noise(seed * 13 + 1)
    amp = look.get("lumps", 1.3) * L
    # (only near the surface: the lumps cannot move it further)
    near = np.abs(F.d) < amp * 2 + vs * 2
    kk, jj, ii = np.nonzero(near)
    gx_, gy_, gz_ = ii * vs + F.o[0], jj * vs + F.o[1], kk * vs + F.o[2]
    ls = look.get("lump_px", 16.0) * L
    lump = (nz.fbm(gx_ / ls, gy_ / ls, gz_ / ls, oct=3) - 0.5) * 2 * amp
    # the base: flat-ish, undulating and torn (never ruled): the field cut by a wavy floor, smoothly
    if form.get("base") is not None and form.get("cut", True):
        bw = look.get("base_wave", 16.0)
        bt = look.get("base_tear", 9.0)
        nb = Noise(seed * 7 + 3)
        xs = (np.arange(F.nx) * vs + F.o[0]) / L
        zs = (np.arange(F.nz) * vs + F.o[2]) / L
        X2, Z2 = np.meshgrid(xs, zs)
        by = (form["base"] + (nb.fbm(X2 / 110.0, np.full_like(X2, 3.3), oct=3) - 0.5) * 2 * bw + (nb.fbm(X2 / 19.0, np.full_like(X2, 9.1), Z2 / 40.0, oct=2) - 0.5) * 2 * bt) * L
        ys = np.arange(F.ny) * vs + F.o[1]
        cut = ys[None, :, None] - by[:, None, :]
        kc = 3.0 * L
    else:
        cut = None
        kc = 1.0

    def floor(a):
        if cut is None:
            return a
        h = np.clip(0.5 - 0.5 * (cut - a) / kc, 0, 1)
        return cut * (1 - h) + a * h + kc * h * (1 - h)
    # d0: the form (its light); d: the form with the fine lumps (its outline and where the eye meets it)
    d0 = floor(F.d)
    F.d[kk, jj, ii] += lump
    d = floor(F.d)
    F.d = d0
    # the image: px centres over the field's x, y
    ox, oy = math.floor(F.o[0]), math.floor(F.o[1])
    W = int(math.ceil(F.o[0] + (F.nx - 1) * vs)) - ox
    H = int(math.ceil(F.o[1] + (F.ny - 1) * vs)) - oy
    # which px see anything (the field's min along z, as an image)
    mn = d.min(axis=0)
    yy, xx = np.mgrid[0:H, 0:W]
    fx = (xx + 0.5 + ox - F.o[0]) / vs
    fy = (yy + 0.5 + oy - F.o[1]) / vs
    mn_px = ndimage.map_coordinates(mn, [fy.ravel(), fx.ravel()], order=1, mode="nearest").reshape(H, W)
    cand = mn_px < 0
    cy_, cx_ = np.nonzero(cand)
    qx = (cx_ + 0.5 + ox - F.o[0]) / vs
    qy = (cy_ + 0.5 + oy - F.o[1]) / vs
    # march from the front (high z) back to the first crossing
    hit = np.full(len(cx_), -1.0, np.float32)
    prev = None
    for k in range(F.nz - 1, -1, -1):
        cur = ndimage.map_coordinates(d[k], [qy, qx], order=1, mode="nearest")
        if prev is not None:
            m = (hit < 0) & (cur < 0) & (prev >= 0)
            if m.any():
                t = prev[m] / np.maximum(prev[m] - cur[m], 1e-6)
                hit[m] = (k + 1) - t
        else:
            m = cur < 0
            hit[m] = k
        prev = cur
    ok = hit >= 0
    cy_, cx_, qx, qy, hk = cy_[ok], cx_[ok], qx[ok], qy[ok], hit[ok]
    pz = hk * vs + F.o[2]
    px = cx_ + 0.5 + ox
    py = cy_ + 0.5 + oy
    Pt = np.stack([px, py, pz], 1).astype(np.float32)
    zb = np.full((H, W), -BIG, np.float32)
    zb[cy_, cx_] = pz
    # (the cast shadows and rims read a depth smoothed over the fine lumps: no lump casts a crescent)
    msk = (zb > -BIG / 2).astype(np.float32)
    zs = look.get("zs_px", 2.0) * L
    zsm = ndimage.gaussian_filter(np.where(msk > 0, zb, 0), zs) / np.maximum(ndimage.gaussian_filter(msk, zs), 1e-3)
    zsm = np.where(msk > 0, zsm, -BIG)
    # normals: the surface's own, and the FORM's (the field blurred: the billows' light first, the cells a breath on it)
    gzv, gyv, gxv = np.gradient(d0)
    nrm = np.stack([F.at(Pt, gxv), F.at(Pt, gyv), F.at(Pt, gzv)], 1)
    nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-6)
    db = ndimage.gaussian_filter(d0, look.get("form_px", 22) * L / vs)
    gzv, gyv, gxv = np.gradient(db)
    fn = np.stack([F.at(Pt, gxv), F.at(Pt, gyv), F.at(Pt, gzv)], 1)
    fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-6)
    del gzv, gyv, gxv, db
    fa = look.get("form", 0.6)
    N = nrm * (1 - fa) + fn * fa
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-6)
    # light through the cloud (soft self-shadow): density from the field, marched toward the sun on a coarser copy
    soft = look.get("soft_px", 7.0) * L
    dens = np.clip(-d / soft, 0, 1)
    step = vs * 1.5
    reach = look.get("reach", 360) * L
    tau = np.zeros(len(Pt), np.float32)
    Q = Pt + N * (2.0 * L)
    t = step
    while t < reach:
        tau += F.at(Q + sun_ * t, dens)
        t += step
    Tsun = np.exp(-look.get("sigma", 0.03) / L * tau * step)
    ndl = N @ sun_
    wrap = look.get("wrap", 0.3)
    # the cells' own cast shadows (screen space, from the depth: crisp, short, on their far side only)
    sxy = float(np.hypot(sun_[0], sun_[1]))
    sx, sy, sz = sun_[0] / sxy, sun_[1] / sxy, sun_[2] / sxy
    occ = np.zeros(len(Pt), np.float32)
    ssl = look.get("ss_len", 40) * L
    sss = look.get("ss_soft", 6.0) * L
    tt = 1.0
    while tt < ssl:
        ax = np.clip((cx_ + sx * tt).round().astype(np.int32), 0, W - 1)
        ay = np.clip((cy_ + sy * tt).round().astype(np.int32), 0, H - 1)
        ex = zsm[ay, ax] - (zsm[cy_, cx_] + sz * tt) - 1.0 * L
        fall = 1.0 - (tt / ssl) ** 1.3
        np.maximum(occ, np.clip(ex / sss, 0, 1) * fall, out=occ)
        tt += 1.0 if tt < 10 * L else 2.0
    direct = np.clip((ndl + wrap) / (1 + wrap), 0, 1) * Tsun * (1 - look.get("ss", 0.75) * occ)
    # occlusion from the field (crevices)
    ao = np.zeros(len(Pt), np.float32)
    for dd, wgt in ((3, 0.45), (7, 0.3), (14, 0.25)):
        e = dd * L
        ao += wgt * np.clip((e - F.at(Pt + nrm * e)) / e, 0, 1)
    ao = np.clip(1 - ao * look.get("ao", 1.1), 0, 1)
    skyl = (0.55 + 0.45 * np.clip(-N[:, 1], -1, 1)) * (0.7 + 0.3 * np.clip(N[:, 2], 0, 1)) * ao
    bounce = np.clip(N[:, 1], 0, 1) * ao
    # the lit rim: px on an edge that faces the sun (the next px toward the sun is sky, or a surface well behind)
    band = max(1.0, look.get("rim_px", 2.5) * L)
    rim = np.zeros(len(Pt), np.float32)
    tt = 1.0
    while tt <= band + 1e-3:
        ax = np.clip((cx_ + sx * tt).round().astype(np.int32), 0, W - 1)
        ay = np.clip((cy_ + sy * tt).round().astype(np.int32), 0, H - 1)
        gap = (pz - zb[ay, ax]) > look.get("rim_gap", 7.0) * L
        np.maximum(rim, gap * (1.0 - (tt - 1) / (band + 1)), out=rim)
        tt += 1.0
    V = (look.get("kd", 0.8) * direct * (0.6 + 0.4 * ao) + look.get("ks", 0.32) * skyl + look.get("kb", 0.08) * bounce
         + look.get("kr", 0.2) * rim * (0.6 + 0.4 * Tsun) * (0.6 + 0.4 * ao))
    # the belly: the lowest part of a heap darker and cooler (the shade under the mass, the ref's lavender bases)
    if form.get("base") is not None:
        bh = look.get("belly_px", 0.16 * form.get("h", 400)) * L
        above = (form["base"] * L - py) / max(bh, 1)
        V = V - look.get("kbelly", 0.16) * np.clip(1 - above, 0, 1) ** 1.5
    val = np.full((H, W), -1.0, np.float32)
    val[cy_, cx_] = V
    if look.get("debug"):
        comps = {}
        for name, arr in (("tsun", Tsun), ("occ", 1 - occ), ("ao", ao), ("ndl", np.clip((ndl + wrap) / (1 + wrap), 0, 1)), ("rim", rim), ("sky", skyl)):
            m_ = np.full((H, W), -1.0, np.float32)
            m_[cy_, cx_] = arr
            comps[name] = m_
        return val, ox, oy, comps
    return val, ox, oy


# the share of a sunlit cumulus' px on each step (lightest first): lit tops, a few half-tones at the terminator, a
# long cool shade, the deepest darks only in the crevices
SHARE = [0.12, 0.2, 0.07, 0.06, 0.06, 0.11, 0.12, 0.1, 0.08, 0.05, 0.03]


def to_pixels(val, ramp, *, share=SHARE, th=None, clean=2, seed=1, fringe=True, brush=0.02, bscale=1.0):
    H, W = val.shape
    m = val >= 0
    q = np.full((H, W), -1, np.int16)
    k = np.zeros((H, W), np.int16)
    if th is None:
        # the steps' thresholds at the quantiles of this cloud's own light: its value range matched to the refs'
        v = np.sort(val[m])
        cum = np.cumsum(share)[:-1]
        th = [float(v[int(np.clip(1 - c, 0, 1) * (len(v) - 1))]) for c in cum]
    if brush > 0:
        # the steps' edges broken like brush strokes (a noise a little wider than tall), never contour lines
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        nz = Noise(seed + 101)
        val = np.where(m, val + (nz.fbm(xx / (5.5 * bscale), yy / (3.5 * bscale), oct=2) - 0.5) * brush, val)
    for t in th:
        k += (val < t).astype(np.int16)
    q[m] = k[m]
    for _ in range(clean):
        q = majority(q)
    # specks of sky inside the cloud (a missed surface) take their neighbours' step
    holes = ndimage.binary_fill_holes(q >= 0) & (q < 0)
    if holes.any():
        lab, n = ndimage.label(holes)
        sizes = ndimage.sum(holes, lab, range(1, n + 1))
        small = np.isin(lab, np.nonzero(sizes <= 400)[0] + 1)
        if small.any():
            idx = ndimage.distance_transform_edt(q < 0, return_distances=False, return_indices=True)
            q = np.where(small, q[idx[0], idx[1]], q)
    rgba = np.zeros((H, W, 4), np.uint8)
    cols = np.array(ramp, np.uint8)
    mm = q >= 0
    rgba[mm, :3] = cols[q[mm]]
    rgba[mm, 3] = 255
    if fringe:
        # the shaded outline lost toward the sky: outline px of the deeper steps dropped along a noise (torn)
        edge = mm & ~ndimage.binary_erosion(mm)
        deep = q >= 6
        nz = Noise(seed + 77)
        yy, xx = np.nonzero(edge & deep)
        drop = nz(xx / 2.3, yy / 2.3) > 0.52
        rgba[yy[drop], xx[drop], 3] = 0
    return rgba, th


def rags(rgba, form, ox, oy, L, seed, depth=None, ramp=None, steps=(7, 8, 9), dens=0.5):
    """Torn rags under a heap's base: the belly breaking into wisps with lost edges, sheared west by the wind; drawn
    in the belly's cool steps, thinning out downward (never a ruled base, never vertical drips)."""
    if form.get("base") is None:
        return rgba
    H, W = rgba.shape[:2]
    a = rgba[:, :, 3] > 0
    depth = (depth or max(6.0, 0.06 * form.get("h", 300))) * L
    cols = np.array(ramp, np.uint8)
    nz = Noise(seed * 3 + 41)
    # each column's lowest opaque row (the base there)
    has = a.any(0)
    low = np.where(has, H - 1 - np.argmax(a[::-1, :], axis=0), -1)
    xs = np.arange(W)
    out = rgba.copy()
    for dy in range(1, int(depth) + 2):
        rows = low + dy
        ok = has & (rows < H)
        if not ok.any():
            break
        t = dy / depth
        xx = xs[ok].astype(np.float32)
        yy = rows[ok].astype(np.float32)
        # (stretched along x and sheared west as it falls away: the wind drags the rags)
        n = nz.fbm((xx + dy * 1.8 / L) / (26 * L), yy / (3.2 * L), oct=3)
        keep = n > 0.42 + 0.5 * t * (1 - dens * 0.3)
        # only where the column's base is a real base (not an overhang edge: the row above must be cloud)
        above = a[np.clip(low[ok], 0, H - 1), xx.astype(int)]
        keep &= above
        cx = xx[keep].astype(int)
        cy = yy[keep].astype(int)
        k = np.minimum(len(steps) - 1, (t * len(steps)).astype(int) if np.ndim(t) else int(t * len(steps)))
        out[cy, cx, :3] = cols[steps[k]]
        out[cy, cx, 3] = 255
    return out


def majority(q):
    """Each px whose value no 4-neighbour shares takes the most common of its 8 neighbours (no lone specks)."""
    H, W = q.shape
    P = np.pad(q, 1, constant_values=-2)
    nb = [P[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy, dx) != (0, 0)]
    four = [P[0:H, 1:W + 1], P[2:H + 2, 1:W + 1], P[1:H + 1, 0:W], P[1:H + 1, 2:W + 2]]
    alone = (q >= 0) & ~np.any([f == q for f in four], axis=0)
    if not alone.any():
        return q
    st = np.stack(nb)
    best = q.copy()
    yy, xx = np.nonzero(alone)
    vals = st[:, yy, xx]
    for j in range(len(yy)):
        v = vals[:, j]
        v = v[v >= 0]
        if len(v):
            u, c = np.unique(v, return_counts=True)
            best[yy[j], xx[j]] = u[np.argmax(c)]
    return best


# ---------------------------------------------------------------------------------------------------------------
# preview


def sky_bg(W, H, top=(20, 96, 160), bot=(150, 200, 222)):
    t = np.linspace(0, 1, H)[:, None, None]
    return (np.array(top) * (1 - t) + np.array(bot) * t).repeat(W, 1).astype(np.uint8)


def over(bg, rgba, x, y):
    h, w = rgba.shape[:2]
    sub = bg[y:y + h, x:x + w]
    a = rgba[:sub.shape[0], :sub.shape[1], 3:4] > 127
    sub[:] = np.where(a, rgba[:sub.shape[0], :sub.shape[1], :3], sub)
    return bg
