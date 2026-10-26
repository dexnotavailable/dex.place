"""Outfit pixel pass, round 2 (art lane): the pixel-exact outfit details a render at sprite size
cannot hold, placed by rule on the id map and on projected 3D anchors, never on authored pixel
coordinates, so a re-pose or a re-render moves them with the body (no STALE patches).

Runs after outfit_px.py (round 1: gold tones, white contact lines) on <still>/px<N>:

  win    the chest window: the authored diamond (art/rosace/overrides/global/outfit/stamps.json)
         on the centre line directly under the collar cross; the front or the three-quarter rows
         by the chest's facing, the short rows when the chest is foreshortened (critique 12)
  rose   the hip-band medallion: a 3x3 rose with one azure pixel on the band (critique 13)
  slvx   the 3x5 corner cross on each sleeve's lowest corner, when that corner faces us
  welt   the stocking top: an I1 welt row on the stocking under the gold thigh band; the skin
         squeezing over the band (an S3 contact row, a lit row above it, a 1 px bulge where the
         band meets the thigh's outline); each garter strap pulls a 1 px dip in the skin where
         it attaches and ends in a 1 px clip dot (critique 12, 13)
  vund   the tabard's V point gets a 1 px lavender (W3) underside (critique 13)
  thigh  (proposal for the shading lane) the bare thigh band re-banded into 3 planes from the
         normal pass: a lit core toward the key light, a mid plane, a shadow side (critique 12)

Round 2b (the second round-2 critique, 5/10), on the anchors of outfit_art 'anc2' / 'tabx':
  string the thong's back strap as one continuous 1 px OL line from the back medallion down the
         cleft into the leg gap (DESIGN rev 5 item 5); the rest of the thong mesh there takes the
         skin beside it
  glute  each glute shaded as a form inside the ellipse its four anchors span (top under the hip
         band, fold, cleft, outer side): lit toward the key light, a shadow crescent on the
         underside, a 1 px S4 fold crease from the cleft outward (DESIGN 3 row 10)
  tabx   the tabard's fleur-cross as DESIGN's 5x7 (3x5 at 80) with a dark centre pixel, on the
         anchors riding the tabard chain; never drawn upside down (the iconography rule)
  ubust  a 2 px cast shadow under each breast onto the bodice / midriff (from the normal pass:
         the first forward-facing pixels under the down-facing underside)
  folds  two 1 px tension folds from under each breast toward the waist, on the white only
  colsh  a 1 px shadow on the neck/chin skin directly over the stand collar (it reads raised)
  sheen  the stocking's knee highlight and shin sheen: I1 on the most lit interior pixel per row
         near each knee anchor (critique 13e, ref 08)
  tabsolid  a tabard seen nearly edge-on in a motion frame (a hollow gold ghost) filled as one
         solid white flag with gold on its lower edge only (critique 13c)

  python tools/pixel-pipeline/outfit_px2.py --still <render>/<still>/px<N> [--in still_ofx]
      [--out still_o2] [--only win,rose,slvx,welt,vund] [--layer-dir DIR]
"""
import argparse
import json
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
STAMPS = os.path.join(REPO, "art", "rosace", "overrides", "global", "outfit", "stamps.json")
ALL = ("win", "rose", "slvx", "welt", "vund", "hem80")
R2B = ("glute", "string", "ubust", "folds", "colsh", "tabx", "sheen", "tabsolid")
N4 = ((0, 1), (1, 0), (0, -1), (-1, 0))
N8 = N4 + ((1, 1), (1, -1), (-1, 1), (-1, -1))


def rel_lum(hexc):
    c = np.array([int(hexc[i:i + 2], 16) for i in (1, 3, 5)]) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return float(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2])


class Still:
    def __init__(self, d, tag):
        self.d = d
        self.meta = json.load(open(os.path.join(d, "meta.json")))
        self.img = np.array(Image.open(os.path.join(d, tag + ".png")).convert("RGBA"))
        ids = np.array(Image.open(os.path.join(d, "noface_id.png")))
        self.mat = ids[..., 0].astype(int)
        self.part = ids[..., 1].astype(int)
        self.H, self.W = self.img.shape[:2]
        m = self.meta
        self.cols = {k: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for k, h in m["colors"].items()}
        self.lum = {k: rel_lum(h) for k, h in m["colors"].items()}
        by = {v: k for k, v in self.cols.items()}
        self.code = np.empty((self.H, self.W), object)
        for y in range(self.H):
            for x in range(self.W):
                self.code[y, x] = by.get(tuple(self.img[y, x, :3])) if self.img[y, x, 3] else None
        self.M = {n: v["id"] for n, v in m["materials"].items()}
        self.P = m.get("parts", {})
        self.alpha = self.img[..., 3] > 0
        # outline / sel-out pixels: drawn by the post outside the render's own coverage
        self.ring = self.alpha & (self.mat == 0)
        self.touched = {}
        self.new = self.code.copy()
        self.lc = m.get("light_cam", [0.6, 0.8, 0.5])

    def pid(self, *names):
        return [self.P[n] for n in names if n in self.P]

    def ok(self, y, x):
        return 0 <= y < self.H and 0 <= x < self.W

    def put(self, y, x, code, why):
        if not self.ok(y, x) or code is None:
            return
        if self.new[y, x] != code:
            self.new[y, x] = code
            self.touched.setdefault(why, []).append([int(x), int(y)])

    def anchor(self, name):
        a = (self.meta.get("anchors") or {}).get("glyph_" + name)
        if not a:
            return None
        ss = self.meta.get("ss", 1)
        return {"x": a[0] / ss, "y": a[1] / ss, "facing": a[3], "fsx": a[4]}

    def save(self, tag_out, layer_dir=None, layer_name=None):
        out = self.img.copy()
        layer = np.zeros_like(out)
        for y in range(self.H):
            for x in range(self.W):
                c = self.new[y, x]
                if c != self.code[y, x]:
                    if c is None:
                        out[y, x] = 0
                    else:
                        out[y, x, :3] = self.cols[c]
                        out[y, x, 3] = 255
                        layer[y, x] = list(self.cols[c]) + [255]
        Image.fromarray(out).save(os.path.join(self.d, tag_out + ".png"))
        for z in (3, 6):
            Image.fromarray(out).resize((self.W * z, self.H * z), Image.NEAREST).save(
                os.path.join(self.d, f"{tag_out}_x{z}.png"))
        if layer_dir:
            os.makedirs(layer_dir, exist_ok=True)
            nm = layer_name or os.path.basename(os.path.dirname(self.d)) + "_" + os.path.basename(self.d)
            Image.fromarray(layer).save(os.path.join(layer_dir, nm + "_outfit2.png"))
            json.dump(self.touched, open(os.path.join(layer_dir, nm + "_outfit2.touched.json"), "w"))


# ---------------------------------------------------------------------------- stamps
def stamp(S, spec, rows, origin, cx, cy, flip, why, on_parts, on_mats=None, min_visible=0.7, guard=None):
    on = set(S.pid(*on_parts))
    onm = {S.M[n] for n in (on_mats or []) if n in S.M}
    pix = []
    n = max(len(r) for r in rows)
    ox, oy = origin
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in ". ":
                continue
            x = cx + ((n - 1 - i) - (n - 1 - ox) if flip else i - ox)
            y = cy + j - oy
            pix.append((y, x, ch))
    if not pix:
        return 0

    def paintable(y, x):
        if not S.ok(y, x) or not S.alpha[y, x] or S.part[y, x] not in on:
            return False
        if onm and S.mat[y, x] not in onm:
            return False
        return not (guard is not None and guard[y, x])
    vis = sum(1 for y, x, _ in pix if paintable(y, x))
    if vis < min_visible * len(pix):
        return 0
    for y, x, ch in pix:
        if paintable(y, x):
            S.put(y, x, spec["key"][ch], why)
    return vis


def cross_guard(S):
    """the collar-cross glyph's pixels (glyphs.py stamps them on the bodice): never painted over"""
    g = np.zeros((S.H, S.W), bool)
    a = S.anchor("collar_cross")
    if not a:
        return g, None
    p = os.path.join(REPO, "art", "rosace", "glyphs", f"collar_cross_{S.meta['px']}.json")
    if not os.path.exists(p):
        return g, None
    G = json.load(open(p, encoding="utf-8"))
    cx, cy = int(np.floor(a["x"])), int(np.floor(a["y"]))
    ox, oy = G["origin"]
    bottom = None
    for j, row in enumerate(G["rows"]):
        n = len(row)
        for i, ch in enumerate(row):
            if ch in ". ":
                continue
            x = cx + ((n - 1 - i) - (n - 1 - ox) if a["fsx"] < 0 else i - ox)
            y = cy + j - oy
            if S.ok(y, x):
                g[y, x] = True
                bottom = y if bottom is None else max(bottom, y)
    return g, (cx, bottom)


def do_window(S, ST, opts=None):
    opts = opts or {}
    spec = ST["window"]
    t, b = S.anchor("outfit_win_t"), S.anchor("outfit_win_b")
    if not t or not b or t["facing"] < 0.25:
        return
    guard, cross = cross_guard(S)
    table = spec[str(S.meta["px"])]
    view = "front" if abs(t["fsx"]) < opts.get("win_q34_at", 0.9) else "q34"
    L = abs(b["y"] - t["y"])
    full = len(table[view]["rows"])
    if L < 0.6 * full:
        view += "_s"
    st = table[view]
    flip = t["fsx"] < 0
    if cross and abs(cross[0] - t["x"]) <= 4:
        cx, cy = cross[0], cross[1] + 1           # directly under the pendant, on its centre line
    else:
        cx, cy = int(round(t["x"])), int(round(t["y"]))
    stamp(S, spec, st["rows"], st["origin"], cx, cy, flip, "window", spec["on_parts"],
          min_visible=spec["min_visible"], guard=guard)


def do_window_construct(S, ST, opts=None):
    """the window built on the torso's own axis instead of screen rows: a kite from the pendant's
    lower tip down the projected sternum (anchors outfit_win_t -> _b), its length the DESIGN rows
    times the foreshortening, its width compressed by the chest's turn; 1 px G2 frame on its edge,
    a 1 px S4 cleavage on the axis from a quarter of the way down, S2 on the side whose surface
    faces the key light and S3 on the other. Used when the torso leans or foreshortens (N1, Q),
    where upright authored rows would sit across the body."""
    opts = opts or {}
    spec = ST["window"]
    t, b = S.anchor("outfit_win_t"), S.anchor("outfit_win_b")
    if not t or not b or t["facing"] < 0.25:
        return
    guard, cross = cross_guard(S)
    px = S.meta["px"]
    ppm = S.meta.get("ppm") or px / 1.8956
    d = np.array([b["x"] - t["x"], b["y"] - t["y"]])
    Lp = float(np.hypot(*d))
    if Lp < 0.5:
        return
    u = d / Lp
    n = np.array([-u[1], u[0]])            # screen-right of the axis when it points down
    fore = min(1.0, Lp / (0.118 * ppm))
    rows = len(spec[str(px)]["front"]["rows"])
    L = max(3.0, rows * fore)
    half = (3.5 if px >= 144 else 2.2) * float(np.sqrt(max(0.2, 1 - t["fsx"] ** 2)))
    # round 2b: a short (foreshortened) chest takes a narrower kite; a 3.5 px half-width on Q's
    # 6 px axis tilted 51 deg read as a gold 'D', not a window (x12)
    half = min(half, opts.get("win_kite_w", 0.40) * Lp)
    top = np.array([cross[0] + 0.5, cross[1] + 1.0]) if cross and abs(cross[0] - t["x"]) <= 4 else np.array([t["x"], t["y"]])
    kpos = opts.get("win_kite", 0.32)
    inside = np.zeros((S.H, S.W), bool)
    rr = np.zeros((S.H, S.W))
    ssm = np.zeros((S.H, S.W))
    x0, x1 = int(top[0] - L - 4), int(top[0] + L + 4)
    y0, y1 = int(top[1] - 2), int(top[1] + L + 4)
    for y in range(max(0, y0), min(S.H, y1)):
        for x in range(max(0, x0), min(S.W, x1)):
            q = np.array([x + 0.5, y + 0.5]) - top
            sv, rv = float(q @ u), float(q @ n)
            if sv < 0 or sv > L:
                continue
            w = half * (sv / (kpos * L) if sv < kpos * L else (L - sv) / ((1 - kpos) * L))
            if abs(rv) <= w + 0.35:
                inside[y, x] = True
                rr[y, x], ssm[y, x] = rv, sv
    on = set(S.pid(*spec["on_parts"]))
    ok = inside & S.alpha & np.isin(S.part, list(on)) & ~guard
    if inside.sum() == 0 or ok.sum() < spec["min_visible"] * inside.sum():
        return
    lit_right = S.lc[0] > 0
    ys, xs = np.nonzero(inside)
    # the cleavage: per step along the axis, the one pixel nearest the axis
    cleave = set()
    for sv_i in range(int(L) + 1):
        sel = [(abs(rr[y, x]), y, x) for y, x in zip(ys, xs) if int(ssm[y, x]) == sv_i]
        if sel and sv_i >= 0.25 * L:
            _, y, x = min(sel)
            cleave.add((y, x))
    for y, x in zip(ys, xs):
        if not ok[y, x]:
            continue
        edge = any(not (S.ok(y + dy, x + dx) and inside[y + dy, x + dx]) for dy, dx in N4)
        if edge:
            c = spec["key"]["g"]
        elif (y, x) in cleave:
            c = spec["key"]["c"]
        else:
            left = rr[y, x] < 0
            c = spec["key"]["L"] if left == lit_right else spec["key"]["T"]
        S.put(y, x, c, "window")


def do_rose(S, ST):
    spec = ST["rose"]
    st = spec[str(S.meta["px"])]
    need = set(S.pid(*spec.get("need_parts", [])))
    for nm, sgn in (("outfit_rose_f", 1), ("outfit_rose_b", -1)):
        a = S.anchor(nm)
        if not a or a["facing"] * sgn < 0.2:
            continue
        cx, cy = int(np.floor(a["x"])), int(np.floor(a["y"]))
        # snap to the band: the nearest gold_harness pixel within 2 px
        best = None
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                y, x = cy + dy, cx + dx
                if S.ok(y, x) and S.part[y, x] in need and S.mat[y, x] == S.M["gold"]:
                    d = dy * dy + dx * dx
                    if best is None or d < best[0]:
                        best = (d, y, x)
        if best is None:
            continue
        _, cy, cx = best
        flip = S.lc[0] > 0          # authored lit from the left
        stamp(S, spec, st["rows"], st["origin"], cx, cy, flip, "rose", spec["on_parts"],
              min_visible=spec["min_visible"])


def do_slvx(S, ST):
    spec = ST["sleeve_cross"]
    st = spec[str(S.meta["px"])]
    for s in "LR":
        a = S.anchor(f"outfit_slvx_{s}")
        if not a:
            continue
        cx, cy = int(np.floor(a["x"])), int(np.floor(a["y"]))
        # the anchor sits 4 mm off the cloth: take the nearest outer-sleeve pixel within 2 px
        best = None
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                y, x = cy + dy, cx + dx
                if S.ok(y, x) and S.part[y, x] in S.pid("sleeves") and S.mat[y, x] in (S.M["white"], S.M["gold"]):
                    d = dy * dy + dx * dx
                    if best is None or d < best[0]:
                        best = (d, y, x)
        if best is None:
            continue
        _, cy, cx = best
        # keep the cross inside the cloth: step up (toward the cuff) off the gold hem
        for _ in range(3):
            if S.ok(cy + 2, cx) and S.mat[cy + 2, cx] == S.M["white"] and S.part[cy + 2, cx] in S.pid("sleeves"):
                break
            cy -= 1
        stamp(S, spec, st["rows"], st["origin"], cx, cy, False, "sleeve_cross", spec["on_parts"],
              spec.get("on_mats"), min_visible=spec["min_visible"])


# ---------------------------------------------------------------------------- thigh band
def do_welt(S, opts):
    band_p = S.pid("gold_thigh")
    if not band_p:
        return
    band = np.isin(S.part, band_p) & S.alpha & (S.mat == S.M["gold"])
    stock_top = (S.part == S.P.get("stockings", -1)) & (S.mat == S.M["gold"])
    skin = (S.mat == S.M["skin"]) & S.alpha & (S.part == S.P.get("body", -1))
    stock = (S.mat == S.M["stocking"]) & S.alpha
    strap = np.isin(S.part, S.pid("gold_harness", "gold_strap")) & (S.mat == S.M["gold"]) & S.alpha
    goldband = band | stock_top
    H, W = S.H, S.W

    def nb(mask, y, x, dirs=N4):
        return [(y + dy, x + dx) for dy, dx in dirs if S.ok(y + dy, x + dx) and mask[y + dy, x + dx]]
    # 1. welt: stocking pixels touching the band -> I1 (one row)
    for y, x in zip(*np.nonzero(stock)):
        if nb(goldband, y, x) and S.code[y, x] in ("I2", "I3", "I4"):
            S.put(y, x, "I1" if S.code[y, x] == "I2" else "I2", "welt")
    # 2. squeeze: skin touching the band -> S3 contact; the skin next to that (not touching the
    #    band) one step lighter: the flesh bulging over the band
    contact = np.zeros((H, W), bool)
    for y, x in zip(*np.nonzero(skin)):
        if nb(band, y, x):
            contact[y, x] = True
            if S.code[y, x] in ("S1", "S2"):
                S.put(y, x, "S3", "squeeze_contact")
    if opts.get("lit_row", True):
        # S3 -> S2 only: an S1 row over the whole band read as a pale glow, not flesh (x12)
        lift = {"S3": "S2"}
        for y, x in zip(*np.nonzero(skin & ~contact)):
            if nb(contact, y, x) and not nb(band, y, x, N8):
                c = S.code[y, x]
                if c in lift and S.new[y, x] == c:
                    S.put(y, x, lift[c], "squeeze_lit")
    # 3. the bulge: where a contact pixel sits on the figure's outline, the outline steps out 1 px
    if opts.get("bulge", True):
        for y, x in zip(*np.nonzero(contact)):
            for dy, dx in N4:
                yy, xx = y + dy, x + dx
                if not S.ok(yy, xx) or not S.ring[yy, xx]:
                    continue
                # only sideways (across the leg), and only where the band continues beside it
                if dy != 0:
                    continue
                y3, x3 = yy + dy, xx + dx
                if S.ok(y3, x3) and not S.alpha[y3, x3]:
                    S.put(yy, xx, "S3", "bulge")
                    S.put(y3, x3, S.code[yy, xx], "bulge")
    # 4. straps: where a garter strap meets the band, a clip dot on the strap's last pixel and a
    #    1 px dip (S3) in the skin beside it
    ends = np.zeros((H, W), bool)
    for y, x in zip(*np.nonzero(strap & ~goldband)):
        if nb(band, y, x, N8):
            ends[y, x] = True
    # one clip per strap end: each 8-connected cluster of end pixels keeps the pixel farthest
    # from the band's centre line (the strap's last pixel), the others stay strap gold
    seen = np.zeros((H, W), bool)
    for y0, x0 in zip(*np.nonzero(ends)):
        if seen[y0, x0]:
            continue
        cl, st = [], [(y0, x0)]
        seen[y0, x0] = True
        while st:
            y, x = st.pop()
            cl.append((y, x))
            for yy, xx in nb(ends, y, x, N8):
                if not seen[yy, xx]:
                    seen[yy, xx] = True
                    st.append((yy, xx))
        # the strap pixel with the most band neighbours is where it attaches
        y, x = max(cl, key=lambda p: (len(nb(band, p[0], p[1], N8)), -p[0]))
        S.put(y, x, opts.get("clip", "G0"), "clip")
        for yy, xx in nb(skin, y, x):
            if S.code[yy, xx] in ("S1", "S2"):
                S.put(yy, xx, "S3", "strap_dip")


def do_vund(S):
    a = S.anchor("outfit_rose_f")
    if a is None or a["facing"] < 0.2:
        return          # only when the tabard's front faces us (the back view shows its lining)
    tab = (S.part == S.P.get("tabard", -1)) & S.alpha & ~S.ring
    ys, xs = np.nonzero(tab)
    if not len(ys):
        return
    ymax = ys.max()
    tips = [(y, x) for y, x in zip(ys, xs) if y >= ymax - 1]
    for y, x in tips:
        below = (y + 1, x)
        if not S.ok(*below) or not S.ring[below]:
            continue
        b2 = (y + 2, x)
        if S.ok(*b2) and not S.alpha[b2]:
            S.put(*b2, S.code[below], "vund")
            S.put(*below, "W3", "vund")


def do_hem80(S):
    """at 80 px the tabard's second hem line (hem2) sits 1 px over the hem and reads as gold dirt:
    interior tabard gold within 3 px above the tabard's lowest pixel in its column takes the white
    around it (the hem line itself, on the tabard's edge, stays)"""
    if S.meta["px"] >= 100:
        return
    tp = S.P.get("tabard", -1)
    tab = (S.part == tp) & S.alpha & ~S.ring
    ys, xs = np.nonzero(tab)
    if not len(ys):
        return
    low = {}
    for y, x in zip(ys, xs):
        low[x] = max(low.get(x, -1), y)
    for y, x in zip(ys, xs):
        c = S.code[y, x]
        if not c or not c.startswith("G") or low[x] - y > 3 or low[x] - y < 1:
            continue
        nbs = [(y + dy, x + dx) for dy, dx in N4 if S.ok(y + dy, x + dx)]
        if any(not tab[q] for q in nbs):
            continue            # on the tabard's edge: the hem itself
        whites = [S.code[q] for q in nbs if S.code[q] and S.code[q].startswith("W")]
        if len(whites) >= 2:
            S.put(y, x, max(set(whites), key=whites.count), "hem80")


def do_thigh(S, opts):
    """proposal (shading lane owns skin): re-band the bare thigh skin within ~16 px (144) of a
    thigh band into 3 planes by N.L from the normal pass"""
    band_p = S.pid("gold_thigh")
    if not band_p:
        return
    nrm = np.array(Image.open(os.path.join(S.d, "noface_normal.png")).convert("RGB")).astype(float) / 255 * 2 - 1
    band = np.isin(S.part, band_p) & S.alpha
    skin = (S.mat == S.M["skin"]) & S.alpha & (S.part == S.P.get("body", -1)) & ~S.ring
    reach = 16 if S.meta["px"] >= 144 else 9
    # distance from the band through skin (BFS)
    dist = np.full((S.H, S.W), 999, int)
    q = []
    for y, x in zip(*np.nonzero(skin)):
        if any(S.ok(y + dy, x + dx) and band[y + dy, x + dx] for dy, dx in N4):
            dist[y, x] = 1
            q.append((y, x))
    i = 0
    while i < len(q):
        y, x = q[i]
        i += 1
        for dy, dx in N4:
            yy, xx = y + dy, x + dx
            if S.ok(yy, xx) and skin[yy, xx] and dist[yy, xx] > dist[y, x] + 1 and dist[y, x] + 1 <= reach:
                dist[yy, xx] = dist[y, x] + 1
                q.append((yy, xx))
    reg = (dist <= reach) & skin
    if reg.sum() < 20:
        return
    L = np.array(S.lc, float)
    L /= np.linalg.norm(L)
    ndl = (nrm[..., 0] * L[0] + nrm[..., 1] * L[1] + nrm[..., 2] * L[2])
    v = ndl[reg]
    lo, hi = np.quantile(v, 0.38), np.quantile(v, 0.80)
    lab = np.full((S.H, S.W), -1, int)
    lab[reg & (ndl < lo)] = 0
    lab[reg & (ndl >= lo) & (ndl < hi)] = 1
    lab[reg & (ndl >= hi)] = 2
    # 3x3 majority inside the region, twice (clean planes, no 1 px specks)
    for _ in range(2):
        nl = lab.copy()
        for y, x in zip(*np.nonzero(reg)):
            vals = [lab[y + dy, x + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                    if S.ok(y + dy, x + dx) and lab[y + dy, x + dx] >= 0]
            if vals:
                nl[y, x] = max(set(vals), key=vals.count)
        lab = nl
    tone = {0: "S3", 1: "S2", 2: opts.get("core", "S2")}
    for y, x in zip(*np.nonzero(reg)):
        if S.new[y, x] != S.code[y, x]:
            continue            # the welt/squeeze pass already drew this pixel
        if S.code[y, x] in ("S4",):
            continue            # creases and contact lines stay
        S.put(y, x, tone[lab[y, x]], "thigh")


# ---------------------------------------------------------------------------- round 2b
def _back_view(S):
    a = S.anchor("outfit_rose_b")
    return a is not None and a["facing"] <= -0.2, a


def _skin_near(S, y, x, reach=5, avoid=()):
    """the code of the nearest body-skin pixel in the same row (then the rows next to it)"""
    body = S.P.get("body", -1)
    for r in range(1, reach + 1):
        for dy in (0, -1, 1):
            for dx in (-r, r):
                yy, xx = y + dy, x + dx
                if S.ok(yy, xx) and S.part[yy, xx] == body and S.mat[yy, xx] == S.M["skin"] \
                        and not S.ring[yy, xx] and (yy, xx) not in avoid:
                    c = S.new[yy, xx]
                    if c and c.startswith("S") and c != "S4":
                        return c
    return "S3"


def do_string(S, opts):
    back, a = _back_view(S)
    if not back:
        return set()
    tp = S.P.get("thong", -1)
    body = S.P.get("body", -1)
    reach = 8 if S.meta["px"] >= 144 else 5
    ax, ay = a["x"], a["y"]
    th = (S.part == tp) & S.alpha & ~S.ring
    ys, xs = np.nonzero(th)
    sel = [(y, x) for y, x in zip(ys, xs) if y >= ay - 1 and abs(x - ax) <= reach]
    if not sel:
        return set()
    ymax = max(y for y, _ in sel)
    # the string ends where it enters the leg gap: the glute folds' level (below it the thong's
    # front panel shows through the gap, as rendered)
    folds = [S.anchor(f"outfit_glF_{s}") for s in "LR"]
    folds = [f["y"] for f in folds if f]
    if folds:
        ymax = min(ymax, int(np.floor(max(folds))) + opts.get("string_past_fold", 1))
    sel = [(y, x) for y, x in sel if y <= ymax]
    rows = {}
    for y, x in sel:
        rows.setdefault(y, []).append(x)
    # the line: start under the medallion (the first row whose pixel is not gold), then follow
    # the thong pixels (nearest to the last x, at most 1 px sideways per row)
    x = int(np.floor(ax))
    y = int(np.floor(ay)) + 1
    while S.ok(y, x) and S.mat[y, x] == S.M["gold"] and y < ymax:
        y += 1
    line = set()
    while y <= ymax and S.ok(y, x):
        cand = rows.get(y)
        if cand:
            nx = min(cand, key=lambda c: (abs(c - x), c))
            x += int(np.clip(nx - x, -1, 1))
        if not S.alpha[y, x] or S.part[y, x] not in (tp, body):
            break
        if S.mat[y, x] == S.M["gold"] and S.part[y, x] != tp:
            break
        line.add((y, x))
        y += 1
    code = opts.get("string_code", "OL")
    for y, x in line:
        S.put(y, x, code, "string")
    # the rest of the thong there becomes the skin beside it
    for y, x in sel:
        if (y, x) in line:
            continue
        S.put(y, x, _skin_near(S, y, x, avoid=line), "string_skin")
    return line


def do_glute(S, opts, line=frozenset()):
    back, _ = _back_view(S)
    if not back:
        return
    body = S.P.get("body", -1)
    L = np.array(S.lc, float)
    L /= np.linalg.norm(L)
    for side in "LR":
        A = {k: S.anchor(f"outfit_gl{k}_{side}") for k in "TFIO"}
        if any(v is None for v in A.values()):
            continue
        cx = (A["I"]["x"] + A["O"]["x"]) / 2
        cy = (A["T"]["y"] + A["F"]["y"]) / 2
        rx = abs(A["O"]["x"] - A["I"]["x"]) / 2 + 0.5
        ry = abs(A["F"]["y"] - A["T"]["y"]) / 2 + 0.5
        if rx < 2 or ry < 2:
            continue
        reg, U, Vv = [], {}, {}
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                if not S.ok(y, x) or (y, x) in line:
                    continue
                u, v = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                if u * u + v * v > 1.0:
                    continue
                if S.part[y, x] != body or S.mat[y, x] != S.M["skin"] or S.ring[y, x] or not S.alpha[y, x]:
                    continue
                reg.append((y, x))
                U[(y, x)], Vv[(y, x)] = u, v
        if len(reg) < 8:
            continue
        ndl = {}
        for q in reg:
            u, v = U[q], Vv[q]
            nz = np.sqrt(max(0.0, 1 - u * u - v * v))
            n = np.array([0.85 * u, -0.9 * v, nz + 0.35])
            n /= np.linalg.norm(n)
            ndl[q] = float(n @ L)
        vals = np.array(list(ndl.values()))
        hi = np.quantile(vals, 1 - opts.get("glute_lit", 0.18))
        lo = np.quantile(vals, opts.get("glute_shade", 0.30))
        # which side is the cleft: the fold crease runs from there outward
        inner_sign = np.sign(A["I"]["x"] - cx) or 1
        for q in reg:
            y, x = q
            u, v = U[q], Vv[q]
            if S.code[y, x] == "S4":
                continue                 # the render's creases stay
            if ndl[q] >= hi:
                c = "S1"
            elif ndl[q] < lo or v > opts.get("glute_crescent", 0.62):
                c = "S3"
            else:
                c = "S2"
            # the fold: the lowest skin pixel in the column inside the ellipse, from the cleft to
            # 60% of the way out
            last = (y + 1, x) not in U
            if last and v > 0.3 and (u * inner_sign) > -0.2:
                c = "S4"
            S.put(y, x, c, "glute")


def do_tabx(S, ST):
    c, t = S.anchor("outfit_tabx_c"), S.anchor("outfit_tabx_t")
    if c is None or t is None or c["facing"] < 0.25:
        return
    dx, dy = t["x"] - c["x"], t["y"] - c["y"]
    if np.hypot(dx, dy) < 0.8:
        return
    ang = np.degrees(np.arctan2(dx, -dy))          # 0 = the cross stands upright on screen
    if abs(ang) > 24:
        return                                     # tilted or inverted: no cross (iconography)
    spec = ST["tabard_cross"]
    st = spec[str(S.meta["px"])]
    tp = S.P.get("tabard", -1)
    cx, cy = int(np.floor(c["x"])), int(np.floor(c["y"]))
    # snap into the white panel: the nearest pixel whose 3x3 is all tabard white
    best = None
    for yy in range(cy - 2, cy + 3):
        for xx in range(cx - 2, cx + 3):
            ok = all(S.ok(yy + a, xx + b) and S.part[yy + a, xx + b] == tp and S.mat[yy + a, xx + b] == S.M["white"]
                     and not S.ring[yy + a, xx + b] for a in (-1, 0, 1) for b in (-1, 0, 1))
            if ok:
                d = (yy - cy) ** 2 + (xx - cx) ** 2
                if best is None or d < best[0]:
                    best = (d, yy, xx)
    if best is None:
        return
    _, cy, cx = best
    stamp(S, spec, st["rows"], st["origin"], cx, cy, S.lc[0] > 0, "tabard_cross", spec["on_parts"],
          spec.get("on_mats"), min_visible=spec["min_visible"])


def _normals(S):
    p = os.path.join(S.d, "noface_normal.png")
    return np.array(Image.open(p).convert("RGB")).astype(float) / 255 * 2 - 1


def do_ubust(S, opts):
    A = [S.anchor(f"outfit_ubust_{s}") for s in "LR"]
    A = [a for a in A if a and a["facing"] > 0.25]
    if not A:
        return
    n = _normals(S)
    body, bod = S.P.get("body", -1), S.P.get("bodice", -1)
    px = S.meta["px"]
    hw = 4 if px >= 144 else 2
    rows = 2 if px >= 144 else 1
    down = {"W1": "W3", "W2": "W3", "S1": "S3", "S2": "S3"}
    for a in A:
        ax, ay = int(np.floor(a["x"])), int(np.floor(a["y"]))
        for x in range(ax - hw, ax + hw + 1):
            was_under = False
            for y in range(ay - 4, ay + 8):
                if not S.ok(y, x) or not S.alpha[y, x] or S.ring[y, x]:
                    was_under = False
                    continue
                if S.part[y, x] not in (body, bod) or S.mat[y, x] not in (S.M["white"], S.M["skin"]):
                    was_under = False
                    continue
                ny = n[y, x, 1]
                if ny < opts.get("ubust_under", -0.35):
                    was_under = True
                    continue
                if was_under and ny > opts.get("ubust_front", -0.25):
                    for k in range(rows):
                        yy = y + k
                        if S.ok(yy, x) and S.part[yy, x] in (body, bod) and S.code[yy, x] in down:
                            S.put(yy, x, down[S.code[yy, x]], "ubust")
                    break


def _line(p0, p1):
    x0, y0 = int(round(p0[0])), int(round(p0[1]))
    x1, y1 = int(round(p1[0])), int(round(p1[1]))
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    out = []
    while True:
        out.append((y0, x0))
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy
    return out


def do_folds(S, opts):
    w = S.anchor("outfit_waist")
    if w is None or w["facing"] < 0.25 or S.meta["px"] < 100:
        return
    bod = S.P.get("bodice", -1)
    down = {"W1": "W2", "W2": "W3"}
    for s in "LR":
        a = S.anchor(f"outfit_ubust_{s}")
        if a is None or a["facing"] < 0.25:
            continue
        p0 = np.array([a["x"], a["y"]])
        p1 = np.array([w["x"], w["y"]])
        d = p1 - p0
        Ld = float(np.hypot(*d))
        if Ld < 4:
            continue
        # start past the cast shadow under the apex, run part of the way to the waist
        start = p0 + d / Ld * 2.5
        end = p0 + d * opts.get("fold_len", 0.6)
        for y, x in _line(start, end):
            if S.ok(y, x) and S.part[y, x] == bod and S.mat[y, x] == S.M["white"] and not S.ring[y, x] \
                    and S.new[y, x] in down and S.new[y, x] == S.code[y, x]:
                S.put(y, x, down[S.code[y, x]], "fold")


def do_colsh(S):
    a = S.anchor("collar_cross")
    if a is None or a["facing"] < 0.25:
        return
    cp = S.P.get("collar", -1)
    skinp = {S.P.get("body", -1), S.P.get("head", -1)}
    for y, x in zip(*np.nonzero((S.part == cp) & S.alpha & ~S.ring)):
        yy = y - 1
        if S.ok(yy, x) and S.part[yy, x] in skinp and S.mat[yy, x] == S.M["skin"] and S.code[yy, x] in ("S1", "S2"):
            S.put(yy, x, "S3", "collar_shadow")


def do_tabsolid(S, opts):
    """a motion frame's tabard seen nearly edge-on (N1: facing 0.12) rendered as W3 inside two gold
    borders: a hollow gold ghost (critique 13c). Fill it as one solid white flag: the gold stays
    only on its lower edge, the inside W2, its upper edge W1 (the lit plane)"""
    c = S.anchor("outfit_tabx_c")
    if c is None or abs(c["facing"]) > opts.get("tabsolid_facing", 0.35):
        return
    tp = S.P.get("tabard", -1)
    tab = (S.part == tp) & S.alpha & ~S.ring
    g = tab & (S.mat == S.M["gold"])
    w = tab & (S.mat == S.M["white"])
    if w.sum() == 0 or g.sum() < opts.get("tabsolid_ratio", 0.6) * w.sum():
        return
    for y, x in zip(*np.nonzero(tab)):
        code = S.new[y, x]
        below_out = not (S.ok(y + 1, x) and tab[y + 1, x])
        above_out = not (S.ok(y - 1, x) and tab[y - 1, x])
        if g[y, x]:
            if not below_out:
                S.put(y, x, "W1" if above_out else "W2", "tabsolid")
        elif w[y, x] and code in ("W3", "W4", "W2"):
            S.put(y, x, "W1" if above_out else "W2", "tabsolid")


def do_sheen(S, opts):
    """the stocking's knee and shin sheen (critique 13e, ref 08): per leg, the stocking pixel that
    faces the key light most in each row, within a few rows of the knee, takes I1 (a 2 px knee
    highlight at 144 tapering to a 1 px line down the shin); the rest of the stocking stays matte"""
    sp = S.P.get("stockings", -1)
    st = (S.part == sp) & S.alpha & ~S.ring & (S.mat == S.M["stocking"])
    if st.sum() < 10:
        return
    n = _normals(S)
    L = np.array(S.lc, float)
    L /= np.linalg.norm(L)
    ndl = (n * L).sum(-1)
    px = S.meta["px"]
    up, down = (3, 7) if px >= 144 else (2, 4)
    knees = [(k, (S.meta.get("anchors") or {}).get(k)) for k in ("knee_L", "knee_R")]
    ss = S.meta.get("ss", 1)
    for name, a in knees:
        if not a:
            continue
        kx, ky = a[0] / ss, a[1] / ss
        for y in range(int(ky) - up, int(ky) + down + 1):
            xs = [x for x in range(int(kx) - 6, int(kx) + 7) if S.ok(y, x) and st[y, x]]
            if len(xs) < 3:
                continue
            # interior pixels only (the sheen never sits on the outline side)
            xs = [x for x in xs if S.ok(y, x - 1) and st[y, x - 1] and S.ok(y, x + 1) and st[y, x + 1]]
            if not xs:
                continue
            best = max(xs, key=lambda x: ndl[y, x])
            if ndl[y, best] < opts.get("sheen_min", 0.35):
                continue
            wide = px >= 144 and abs(y - ky) <= 1.5
            for x in ([best, best + (1 if S.lc[0] < 0 else -1)] if wide else [best]):
                if S.ok(y, x) and st[y, x] and S.code[y, x] in ("I2", "I3"):
                    S.put(y, x, "I1", "sheen")


def run(still, tag_in="still_ofx", tag_out="still_o2", only=ALL, layer_dir=None, opts=None):
    opts = opts or {}
    S = Still(still, tag_in)
    ST = json.load(open(STAMPS, encoding="utf-8"))
    if "thigh" in only:
        do_thigh(S, opts)
    if "welt" in only:
        do_welt(S, opts)
    line = set()
    if "string" in only:
        line = do_string(S, opts)
    if "glute" in only:
        do_glute(S, opts, line)
    if "ubust" in only:
        do_ubust(S, opts)
    if "folds" in only:
        do_folds(S, opts)
    if "colsh" in only:
        do_colsh(S)
    if "sheen" in only:
        do_sheen(S, opts)
    if "tabsolid" in only:
        do_tabsolid(S, opts)
    if "win" in only:
        mode = opts.get("win_mode", "auto")
        t, b = S.anchor("outfit_win_t"), S.anchor("outfit_win_b")
        lean = bool(t and b and abs(b["x"] - t["x"]) > 0.35 * max(1e-6, abs(b["y"] - t["y"])))
        if mode == "construct" or (mode == "auto" and lean):
            do_window_construct(S, ST, opts)
        else:
            do_window(S, ST, opts)
    if "rose" in only:
        do_rose(S, ST)
    if "slvx" in only:
        do_slvx(S, ST)
    if "tabx" in only:
        do_tabx(S, ST)
    if "vund" in only:
        do_vund(S)
    if "hem80" in only:
        do_hem80(S)
    S.save(tag_out, layer_dir)
    return {k: len(v) for k, v in S.touched.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--opts", default="{}", help="JSON: win_q34_at, lit_row, bulge, clip, core")
    ap.add_argument("--still", required=True)
    ap.add_argument("--in", dest="tag_in", default="still_ofx")
    ap.add_argument("--out", dest="tag_out", default="still_o2")
    ap.add_argument("--only", default=",".join(ALL))
    ap.add_argument("--layer-dir", default=None)
    a = ap.parse_args()
    print(a.still, run(a.still, a.tag_in, a.tag_out, a.only.split(","), a.layer_dir, json.loads(a.opts)))


if __name__ == "__main__":
    main()
