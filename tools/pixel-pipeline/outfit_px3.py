"""Outfit pixel pass, round 3 (art lane): answers the round-3 critique (6/10) on the pieces a render
at sprite size cannot hold. Like outfit_px2.py it places everything by rule on the id map, the
normal pass and projected 3D anchors (outfit_art 'anc', 'anc2', 'tabx', 'ykx', 'strp'), never on
authored pixel coordinates, so a re-pose or a re-render moves it with the body.

Runs after outfit_px2.py (still_o2 -> still_o3). Run px2 WITHOUT win, tabx, sheen and glute: the
round-3 passes below replace them.

  win3    the chest window as cleavage (critique 12a): the authored window3 stamp (a Y-fork at the
          top of a 1 px S4 cleavage line, a lit S1 pixel on each inner curve, S2 between, S3 under
          the curves, the line running on past the frame tip); rotated with the torso's roll (the
          line across the breasts), never foreshortened into a sliver (critique: Q's gold sliver)
  bust    the bust as a form on the bodice (critique 12a, 13g): per breast, a W1 highlight
          cluster toward the key light, a mid ring (W2, or B1 with opts bust_mid), W3 on the turn,
          and a 1 px W4 crescent along the underside
  tabx3   the tabard's fleur-cross at the control's weight (critique 13c): 2 px strokes on a 1 px G4
          backing so it survives at 80 as a 3x3 plus (tabard_cross3 in stamps.json)
  tabfold two fold lines (a W3 valley with a W2 soft side) from the hip band toward the V-notch,
          converging, and a W3 shadow plane down the side away from the key light (critique 13c)
  sheen3  one continuous 1 px I1 sheen line down the front of each stocking from over the knee to
          the boot cuff (critique 12b: 'the single sheen line down the shin' of ref 04)
  band3   the stocking top squeezes the thigh: the skin contact row over the gold band S4 on the
          outer third (under the px2 bulge), S3 elsewhere (critique 12b)
  thsel   the bare inner thigh's silhouette (the leg-gap side) in S4 instead of OL: a selective
          outline, so the thighs stop reading as cut-outs (critique 12b)
  glute3  each glute as its own form (critique 12c): a lit S1 cap on the upper outer quarter, an S2
          mid band, S3 on the underside, and a 2 px S4 gluteal fold under the cheek that meets the
          string at the cleft
  strap   gold budget (critique 13e): at 144 the garter straps thinned to a 1 px 8-connected line
          (the doubled stair pixels read as two straps); at 80 dropped (the skin or stocking beside
          them fills in), the back harness (midback strap, halter) a single G3 line
  ykx     the back yoke cross, 3x5 (144) / 3x3 (80), on the anchors outfit_art 'ykx' places, when
          the yoke faces us and the hair leaves it clear (critique 12c)
  boot3   the boot's own finish (critique 13f): a short I0 gloss streak down the front of the shaft
          and one I0 glint over the toe cap, from the normal pass (N.H); the stocking has none

  python tools/pixel-pipeline/outfit_px3.py --still <render>/<still>/px<N> [--in still_o2]
      [--out still_o3] [--only ...] [--opts JSON] [--layer-dir DIR]
"""
import argparse
import json
import math
import os

import numpy as np
from PIL import Image

from outfit_px2 import N4, N8, STAMPS, Still, _back_view, _normals, _skin_near, cross_guard, stamp

ALL3 = ("win3", "bust", "tabx3", "tabfold", "sheen3", "band3", "thsel", "glute3", "strap", "ykx", "boot3", "sleeve3", "tabgold80")


def light(S):
    L = np.array(S.lc, float)
    return L / np.linalg.norm(L)


# ---------------------------------------------------------------------------- window
def _torso_roll(S):
    """screen angle (deg) of the torso's down axis from the line across the breasts (the ubust
    anchors); None when either breast is missing or edge-on"""
    a, b = S.anchor("outfit_ubust_L"), S.anchor("outfit_ubust_R")
    if not a or not b or a["facing"] < 0.25:
        return None
    ax, ay = a["x"] - b["x"], a["y"] - b["y"]
    if np.hypot(ax, ay) < 2:
        return None
    # across vector points from R to L; down = across rotated 90 deg so it points down the screen
    d = np.array([-ay, ax]) if ax > 0 else np.array([ay, -ax])
    if d[1] < 0:
        d = -d
    return math.degrees(math.atan2(d[0], d[1]))      # 0 = upright, + = the down axis leans right


def _sternum_x(S, y):
    """the sternum's screen x at row y, from the window anchors (outfit_win_t / _b), or None"""
    t, b = S.anchor("outfit_win_t"), S.anchor("outfit_win_b")
    if not t or not b:
        return None
    if abs(b["y"] - t["y"]) < 0.5:
        return (t["x"] + b["x"]) / 2
    k = (y - t["y"]) / (b["y"] - t["y"])
    return t["x"] + k * (b["x"] - t["x"])


def do_win3(S, ST, opts):
    """the cleavage window: the window3 stamp laid on the torso. win_axis (opts):
      shift    (default) upright, moved sideways so its lower half sits on the sternum: upright beat
               every rotation by eye (x12, idle/N1/Q): a 7 px diamond turned by nearest-neighbour
               breaks its frame into a leaf or a 'q'
      sternum  the stamp's top under the collar cross, its axis toward the lower sternum
               anchor (the line from the throat to the cleavage), clamped to +-30 deg; a chest
               foreshortened under 75% (Q) takes the short stamp instead of a squashed one
      roll     the axis perpendicular to the line across the breasts (the torso's roll)
      upright  upright under the cross (round 2's placement)"""
    spec = ST["window3"]
    t = S.anchor("outfit_win_t")
    b = S.anchor("outfit_win_b")
    if not t or t["facing"] < 0.25:
        return
    guard, cross = cross_guard(S)
    px = S.meta["px"]
    ppm = S.meta.get("ppm") or px / 1.8956
    table = spec[str(px)]
    view = "front" if abs(t["fsx"]) < opts.get("win_q34_at", 0.9) else "q34"
    if cross and abs(cross[0] - t["x"]) <= 4:
        top = (cross[0] + 0.5, cross[1] + 1.0)
    else:
        top = (t["x"], t["y"])
    mode = opts.get("win_axis", "shift")
    ang, fore = 0.0, 1.0
    if b:
        fore = float(np.hypot(b["x"] - t["x"], b["y"] - t["y"])) / (0.118 * ppm)
        if mode == "sternum":
            ang = math.degrees(math.atan2(b["x"] - top[0], b["y"] - top[1]))
        elif mode == "roll":
            ang = _torso_roll(S) or 0.0
    if abs(ang) < opts.get("win_upright_below", 8.0):
        ang = 0.0
    ang = max(-30.0, min(30.0, ang))
    if fore < opts.get("win_short_below", 0.75) and view + "_s" in table:
        view += "_s"
    st = table[view]
    rows = st["rows"]
    tail = opts.get("win_tail", spec.get("tail", "cw"))
    rows = [r.replace("1", tail[0]).replace("2", tail[1] if len(tail) > 1 else tail[0]) for r in rows]
    flip_shape = t["fsx"] < 0
    lit_right = S.lc[0] > 0
    # the stamp's pixels in its own frame: (col, row) -> letter; mirrored for a left-facing chest,
    # its lighting letters swapped for a light from the left (authored lit from the right)
    n = max(len(r) for r in rows)
    ox, oy = st["origin"]
    src = {}
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch in ". ":
                continue
            ii = (n - 1 - i) if flip_shape else i
            src[(ii, j)] = ch
    if flip_shape:
        ox = n - 1 - ox
    if not lit_right:
        sw = {}
        for (i, j), ch in src.items():
            m = (2 * ox - i, j)
            sw[(i, j)] = src.get(m, ch) if ch in "hLT" and src.get(m, "") in "hLT" else ch
        src = sw
    cx, cy = int(np.floor(top[0])), int(np.floor(top[1]))
    if mode == "shift" and b:
        sx = _sternum_x(S, top[1] + 0.6 * len(rows))
        if sx is not None:
            cx = int(np.floor(sx))
    out = {}
    if ang == 0.0:
        for (i, j), ch in src.items():
            out[(cy + j - oy, cx + i - ox)] = ch
    else:
        # rotate about the stamp's top point: screen offset (x, y) -> source (u, v) by the inverse
        # rotation (nearest), then redraw the frame as the rotated shape's edge (1 px)
        a = math.radians(ang)
        ca, sa = math.cos(a), math.sin(a)
        body = {}
        for y in range(-2, len(rows) + 4):
            for x in range(-n - 6, n + 6):
                u = ca * x - sa * y
                v = sa * x + ca * y
                k = (int(round(u + ox)), int(round(v)))
                if k in src:
                    body[(y, x)] = src[k]
        inside = {q for q, ch in body.items() if ch != "w"}
        for (y, x), ch in body.items():
            if ch != "w" and any((y + dy, x + dx) not in inside for dy, dx in N4):
                if ch != "c" or (y + 1, x) in inside:
                    ch = "g"
            elif ch == "g":
                nbs = [body.get((y + dy, x + dx)) for dy, dx in N8]
                nbs = [c for c in nbs if c and c in "hLT"]
                ch = max(set(nbs), key=nbs.count) if nbs else "L"
            out[(cy + y, cx + x)] = ch
    on = set(S.pid(*spec["on_parts"]))
    vis = [q for q in out if S.ok(*q) and S.alpha[q] and S.part[q] in on and not guard[q]]
    if len(vis) < spec["min_visible"] * len(out):
        return
    for q in vis:
        ch = out[q]
        code = spec["key"][ch]
        if ch == "w" and S.mat[q] != S.M["white"]:
            continue            # the tail is a cloth valley: only on the bodice's white
        S.put(q[0], q[1], code, "win3")


# ---------------------------------------------------------------------------- bust
def do_bust(S, opts):
    """each breast as a sphere on the bodice: its extent is the bodice's own white between the
    sternum line and the silhouette, from under the collar to the underbust anchor; tones from the
    sphere's normal against the key light: one W1 highlight cluster, a mid (W2 or opts bust_mid),
    W3 on the turn, a 1 px W4 crescent along the underside"""
    A = [(s, S.anchor(f"outfit_ubust_{s}")) for s in "LR"]
    A = [(s, a) for s, a in A if a and a["facing"] > 0.25]
    if not A:
        return
    L = light(S)
    px = S.meta["px"]
    bod = S.P.get("bodice", -1)
    mid = opts.get("bust_mid", "W2")
    guard, cross = cross_guard(S)
    t = S.anchor("outfit_win_t")
    ytop = (cross[1] + 1) if cross else (int(t["y"]) if t else None)
    if ytop is None:
        return
    for side, a in A:
        sx = _sternum_x(S, a["y"])
        if sx is None:
            continue
        sgn = np.sign(a["x"] - sx)
        if sgn == 0 or abs(a["x"] - sx) < 0.8:
            other = [o for s2, o in A if s2 != side]
            if not other:
                continue
            sgn = np.sign(a["x"] - other[0]["x"])
        reg = []
        for y in range(int(ytop), int(np.floor(a["y"])) + 1):
            s_x = _sternum_x(S, y)
            for x in range(S.W):
                if (x + 0.5 - s_x) * sgn < 0.8:
                    continue
                if not S.ok(y, x) or not S.alpha[y, x] or S.ring[y, x] or guard[y, x]:
                    continue
                if S.part[y, x] != bod or S.mat[y, x] != S.M["white"]:
                    continue
                if S.new[y, x] != S.code[y, x]:
                    continue            # the window, the cross: drawn already
                reg.append((y, x))
        if len(reg) < 8:
            continue
        ys = np.array([q[0] for q in reg])
        xs = np.array([q[1] for q in reg])
        cx, rx = (xs.min() + xs.max() + 1) / 2, max(1.5, (xs.max() - xs.min() + 1) / 2)
        y0, y1 = ys.min(), ys.max() + 1
        cy = y0 + 0.55 * (y1 - y0)
        ry = max(1.5, 0.55 * (y1 - y0))
        val, U, Vv = {}, {}, {}
        for y, x in reg:
            u, v = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            nz = math.sqrt(max(0.0, 1 - min(1.0, u * u + v * v)))
            ns = np.array([u, -v, nz + opts.get("bust_flat", 0.3)])
            ns /= np.linalg.norm(ns)
            val[(y, x)] = float(ns @ L)
            U[(y, x)], Vv[(y, x)] = u, v
        dl = np.array(list(val.values()))
        hi_q = np.quantile(dl, 1 - opts.get("bust_hi", 0.50))
        mid_q = np.quantile(dl, 1 - opts.get("bust_lit", 0.70))
        tone = {q: ("W1" if d >= hi_q else mid if d >= mid_q else "W3") for q, d in val.items()}
        hl = {q for q, c in tone.items() if c == "W1"}
        best, seen = [], set()
        for q in hl:
            if q in seen:
                continue
            cl, stk = [], [q]
            seen.add(q)
            while stk:
                p = stk.pop()
                cl.append(p)
                for dy, dx in N8:
                    w = (p[0] + dy, p[1] + dx)
                    if w in hl and w not in seen:
                        seen.add(w)
                        stk.append(w)
            if len(cl) > len(best):
                best = cl
        cap = opts.get("bust_hi_cap", 40 if px >= 144 else 12)
        best = set(sorted(best, key=lambda p: -val[p])[:cap])
        for q in hl:
            if q not in best:
                tone[q] = mid
        # the crescent: the lowest region pixel in each column in the lower half
        cols = {}
        for y, x in reg:
            cols[x] = max(cols.get(x, -1), y)
        for x, y in cols.items():
            if Vv[(y, x)] > 0.35 and abs(U[(y, x)]) < 0.92:
                tone[(y, x)] = "W4"
        for q, c in tone.items():
            S.put(q[0], q[1], c, "bust")


# ---------------------------------------------------------------------------- tabard
def _tabard_axis(S):
    c, t = S.anchor("outfit_tabx_c"), S.anchor("outfit_tabx_t")
    if c is None or t is None:
        return None, None, None
    d = np.array([c["x"] - t["x"], c["y"] - t["y"]])
    if np.hypot(*d) < 0.8:
        return None, None, None
    d /= np.linalg.norm(d)
    return c, t, d


def do_tabx3(S, ST, opts=None):
    opts = opts or {}
    c, t, d = _tabard_axis(S)
    if c is None or c["facing"] < 0.25:
        return
    ang = math.degrees(math.atan2(-d[0], d[1]))
    if abs(ang) > 24:
        return                                     # tilted or inverted: no cross (iconography)
    spec = ST["tabard_cross3"]
    st = spec[str(S.meta["px"]) + ("_ring" if opts.get("tabx3_ring") else "")]
    tp = S.P.get("tabard", -1)
    cx, cy = int(np.floor(c["x"])), int(np.floor(c["y"]))
    k = 2 if S.meta["px"] >= 144 else 1
    best = None
    for yy in range(cy - 3, cy + 4):
        for xx in range(cx - 3, cx + 4):
            ok = all(S.ok(yy + a, xx + b) and S.part[yy + a, xx + b] == tp and S.mat[yy + a, xx + b] == S.M["white"]
                     and not S.ring[yy + a, xx + b] for a in range(-k, k + 1) for b in range(-k + 1, k))
            if ok:
                dd = (yy - cy) ** 2 + (xx - cx) ** 2
                if best is None or dd < best[0]:
                    best = (dd, yy, xx)
    if best is None:
        return
    _, cy, cx = best
    stamp(S, spec, st["rows"], st["origin"], cx, cy, S.lc[0] > 0, "tabard_cross3", spec["on_parts"],
          spec.get("on_mats"), min_visible=spec["min_visible"])


def do_tabfold(S, opts):
    """two fold lines from the hip band toward the V-notch and a shadow plane on the unlit side;
    only when the panel's front faces us and hangs within 30 deg of the screen's vertical"""
    c, t, d = _tabard_axis(S)
    if c is None or c["facing"] < 0.35 or S.meta["px"] < 100:
        return
    if abs(math.degrees(math.atan2(-d[0], d[1]))) > 30:
        return
    tp = S.P.get("tabard", -1)
    tab = (S.part == tp) & S.alpha & ~S.ring
    white = tab & (S.mat == S.M["white"])
    ys, xs = np.nonzero(tab)
    if not len(ys):
        return
    nrm = np.array([d[1], -d[0]])                  # across the panel
    lit_sign = 1 if (nrm[0] * S.lc[0]) > 0 else -1  # which across-direction faces the light
    sv = {}
    for y, x in zip(ys, xs):
        p = np.array([x + 0.5, y + 0.5])
        s = int(np.floor(p @ d))
        rv = float(p @ nrm)
        lo, hi = sv.get(s, (1e9, -1e9))
        sv[s] = (min(lo, rv), max(hi, rv))
    smin, smax = min(sv), max(sv)
    # the V hem starts where the panel's gold closes in: stop 5 rows (144) above the lowest row
    stop = smax - opts.get("fold_stop", 7)
    start = smin + opts.get("fold_start", 2)
    guard = np.zeros((S.H, S.W), bool)
    for why in ("tabard_cross3", "tabard_cross"):
        for x, y in S.touched.get(why, []):
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if S.ok(y + dy, x + dx):
                        guard[y + dy, x + dx] = True
    fr = opts.get("fold_at", (0.30, 0.72))
    fr_end = opts.get("fold_to", (0.40, 0.62))
    # each fold starts at the hip band (its tension point) and dies out part of the way down: a
    # full-length line read as a stripe down the panel (x12), so fold_len of the run, the last
    # 2 px a W2 fade
    run = max(1, stop - start)
    flen = opts.get("fold_len", (0.55, 0.40))
    for f0, f1, fl in zip(fr, fr_end, flen):
        end = start + int(round(fl * run))
        for s in range(start, end + 1):
            if s not in sv:
                continue
            lo, hi = sv[s]
            if hi - lo < 5:
                continue
            k = (s - start) / run
            f = f0 + (f1 - f0) * k
            rv = lo + f * (hi - lo)
            cand = [(abs(float(np.array([x + 0.5, y + 0.5]) @ nrm) - rv), y, x) for y, x in zip(ys, xs)
                    if int(np.floor(np.array([x + 0.5, y + 0.5]) @ d)) == s]
            if not cand:
                continue
            _, y, x = min(cand)
            if not white[y, x] or guard[y, x]:
                continue
            S.put(y, x, "W3" if end - s >= 2 else "W2", "tabfold")
    if opts.get("tab_shadow_side", True):
        # the side plane away from the key light: its inner 1 px W3 (the panel turning away)
        for s in range(start, smax + 1):
            if s not in sv:
                continue
            lo, hi = sv[s]
            if hi - lo < 6:
                continue
            edge = lo if lit_sign > 0 else hi
            for y, x in zip(ys, xs):
                p = np.array([x + 0.5, y + 0.5])
                if int(np.floor(p @ d)) != s or not white[y, x] or guard[y, x]:
                    continue
                if abs(float(p @ nrm) - edge) <= 1.6 and S.new[y, x] in ("W1", "W2"):
                    S.put(y, x, "W3", "tabshade")


# ---------------------------------------------------------------------------- legs
def do_sheen3(S, opts):
    sp = S.P.get("stockings", -1)
    st = (S.part == sp) & S.alpha & ~S.ring & (S.mat == S.M["stocking"])
    if st.sum() < 10:
        return
    n = _normals(S)
    L = light(S)
    Hh = L + np.array([0, 0, 1.0])
    Hh /= np.linalg.norm(Hh)
    # the sheen sits where the shin faces between the light and the eye (N.H): N.L put it on the
    # lit edge, where it read as a rim, not a sheen down the front of the shin (x6)
    ndl = (n * (Hh if opts.get("sheen_nh", True) else L)).sum(-1)
    px = S.meta["px"]
    ss = S.meta.get("ss", 1)
    boots = (S.part == S.P.get("boots", -1)) & S.alpha
    code = opts.get("sheen_code", "I1")
    for k in ("knee_L", "knee_R"):
        a = (S.meta.get("anchors") or {}).get(k)
        if not a:
            continue
        kx, ky = a[0] / ss, a[1] / ss
        y0 = int(ky) - (4 if px >= 144 else 2)
        # down to the boot cuff under this knee
        y1 = None
        for y in range(int(ky), S.H):
            if any(boots[y, x] for x in range(max(0, int(kx) - 7), min(S.W, int(kx) + 8))):
                y1 = y - 1
                break
        if y1 is None:
            y1 = int(ky) + (14 if px >= 144 else 8)
        path = []
        lastx = None
        for y in range(y0, y1 + 1):
            inset = opts.get("sheen_inset", 2 if px >= 144 else 1)
            xs = [x for x in range(int(kx) - 7, int(kx) + 8)
                  if all(S.ok(y, x + k) and st[y, x + k] for k in range(-inset, inset + 1))]
            if lastx is not None:
                xs = [x for x in xs if abs(x - lastx) <= 1]
            if not xs:
                if lastx is None:
                    continue
                break
            best = max(xs, key=lambda x: ndl[y, x] - (0.02 * abs(x - lastx) if lastx is not None else 0))
            path.append((y, best))
            lastx = best
        if len(path) < 3:
            continue
        if px < 100:
            # at 80 a knee-to-cuff line on a 4-5 px leg runs parallel to both edges: banding
            # (PX-P14 on the idle 23 -> 32 pairs with it, 23 -> 24 without); a 3 px knee glint
            path = path[:opts.get("sheen80_len", 3)]
        for y, x in path:
            if S.code[y, x] and S.code[y, x][0] in "IK":
                S.put(y, x, code, "sheen3")
        # the top of the knee: a second lit pixel beside the line on the knee rows (144)
        if px >= 144:
            for y, x in path:
                if abs(y - ky) <= 1:
                    xx = x + (1 if S.lc[0] > 0 else -1)
                    if S.ok(y, xx) and st[y, xx]:
                        S.put(y, xx, code, "sheen3")


def do_band3(S, opts):
    band_p = S.pid("gold_thigh")
    if not band_p:
        return
    band = np.isin(S.part, band_p) & S.alpha & (S.mat == S.M["gold"])
    skin = (S.mat == S.M["skin"]) & S.alpha & (S.part == S.P.get("body", -1))
    ys, xs = np.nonzero(band)
    if not len(ys):
        return
    # each thigh band: 8-connected clusters of band pixels
    lab = np.zeros(band.shape, int)
    nlab = 0
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]:
            continue
        nlab += 1
        stk = [(y0, x0)]
        lab[y0, x0] = nlab
        while stk:
            y, x = stk.pop()
            for dy, dx in N8:
                yy, xx = y + dy, x + dx
                if S.ok(yy, xx) and band[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = nlab
                    stk.append((yy, xx))
    cxs = {}
    fig_c = np.nonzero(S.alpha)[1].mean()
    for i in range(1, nlab + 1):
        by, bx = np.nonzero(lab == i)
        if len(bx) < 3:
            continue
        x0, x1 = bx.min(), bx.max()
        outer_right = (bx.mean() > fig_c)
        cxs[i] = (x0, x1, outer_right)
        for y, x in zip(by, bx):
            yy = y - 1
            if not (S.ok(yy, x) and skin[yy, x]):
                continue
            third = (x - x0) / max(1, x1 - x0)
            outer = third > 0.62 if outer_right else third < 0.38
            c = "S4" if outer else "S3"
            if S.new[yy, x] in ("S1", "S2", "S3"):
                S.put(yy, x, c, "band3")


def do_thsel(S, opts):
    """the bare thigh's leg-gap silhouette: ring pixels between the thigh bands and the hip band
    whose far side (away from the skin) reaches the other leg within a gap -> S4"""
    band_p = S.pid("gold_thigh")
    if not band_p:
        return
    body = S.P.get("body", -1)
    skin = (S.mat == S.M["skin"]) & S.alpha & (S.part == body) & ~S.ring
    band = np.isin(S.part, band_p) & S.alpha
    by = np.nonzero(band)[0]
    if not len(by):
        return
    ytop = by.min() - (26 if S.meta["px"] >= 144 else 14)
    ybot = by.max()
    gap = 16 if S.meta["px"] >= 144 else 9
    for y in range(max(0, ytop), min(S.H, ybot + 1)):
        for x in range(S.W):
            if not S.ring[y, x] or S.code[y, x] != "OL":
                continue
            for dx in (-1, 1):
                if not (S.ok(y, x - dx) and skin[y, x - dx]):
                    continue            # the skin must be on the other side of this ring pixel
                # beyond the ring: background, then another part of the figure within the gap
                xx = x + dx
                k = 0
                while S.ok(y, xx) and not S.alpha[y, xx] and k <= gap:
                    xx += dx
                    k += 1
                if 1 <= k <= gap and S.ok(y, xx) and S.alpha[y, xx]:
                    S.put(y, x, opts.get("thsel_code", "S4"), "thsel")
                    break


def do_glute3(S, opts, line=frozenset()):
    back, _ = _back_view(S)
    if not back:
        return
    body = S.P.get("body", -1)
    L = light(S)
    string = {(y, x) for y, x in zip(*np.nonzero(S.new == "OL")) if S.part[y, x] == S.P.get("thong", -2)}
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
        inner_sign = np.sign(A["I"]["x"] - cx) or 1
        reg, U, Vv = [], {}, {}
        for y in range(int(cy - ry - 1), int(cy + ry + 3)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                if not S.ok(y, x) or (y, x) in line or (y, x) in string:
                    continue
                u, v = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                if u * u + v * v > 1.08:
                    continue
                if S.part[y, x] != body or S.mat[y, x] != S.M["skin"] or S.ring[y, x] or not S.alpha[y, x]:
                    continue
                if S.new[y, x] != S.code[y, x] and S.new[y, x] not in ("S1", "S2", "S3"):
                    continue
                reg.append((y, x))
                U[(y, x)], Vv[(y, x)] = u, v
        if len(reg) < 8:
            continue
        # which cheek faces the light: the outer side toward the key light is the lit one
        lit_cheek = (-inner_sign * S.lc[0]) > 0
        lowest = {}
        for y, x in reg:
            lowest[x] = max(lowest.get(x, -1), y)
        for q in reg:
            y, x = q
            u, v = U[q], Vv[q]
            uo = -u * inner_sign            # + toward the outer side
            if v < -0.15 and uo > 0.05 and (u * u + v * v) < 0.85:
                c = "S1" if lit_cheek else "S2"          # the lit cap, upper outer quarter
            elif v > 0.5 or (uo < -0.55 and v > 0.0):
                c = "S3"                                 # the underside and the turn into the cleft
            else:
                c = "S2" if lit_cheek else ("S2" if v < 0.1 else "S3")
            S.put(y, x, c, "glute3")
        # the gluteal fold: 2 px S4 under the cheek, from the cleft to 70% of the way out
        fold_w = opts.get("fold_px", 2 if S.meta["px"] >= 144 else 1)
        for x, y in lowest.items():
            u = (x + 0.5 - cx) / rx
            uo = -u * inner_sign
            if uo > 0.7:
                continue
            for k in range(fold_w):
                yy = y - k
                if (yy, x) in U and Vv[(yy, x)] > 0.2:
                    S.put(yy, x, "S4", "glute_fold")
        # join the fold to the string at the cleft: the string's lowest pixel's neighbours
    return


# ---------------------------------------------------------------------------- straps and harness
def _thin(mask):
    """Zhang-Suen thinning of a boolean mask to an 8-connected 1 px skeleton"""
    m = mask.copy().astype(np.uint8)
    H, W = m.shape
    changed = True
    while changed:
        changed = False
        for step in (0, 1):
            rm = []
            for y in range(1, H - 1):
                for x in range(1, W - 1):
                    if not m[y, x]:
                        continue
                    p = [m[y - 1, x], m[y - 1, x + 1], m[y, x + 1], m[y + 1, x + 1], m[y + 1, x], m[y + 1, x - 1],
                         m[y, x - 1], m[y - 1, x - 1]]
                    b = sum(p)
                    if b < 2 or b > 6:
                        continue
                    a = sum(1 for i in range(8) if p[i] == 0 and p[(i + 1) % 8] == 1)
                    if a != 1:
                        continue
                    if step == 0 and (p[0] * p[2] * p[4] or p[2] * p[4] * p[6]):
                        continue
                    if step == 1 and (p[0] * p[2] * p[6] or p[0] * p[4] * p[6]):
                        continue
                    rm.append((y, x))
            for y, x in rm:
                m[y, x] = 0
            changed = changed or bool(rm)
    return m.astype(bool)


def _fill_from_neighbours(S, y, x, allowed_parts, why):
    """repaint a removed strap pixel with what lies beside it (skin, stocking, white)"""
    cand = []
    for r in (1, 2):
        for dy, dx in ((0, -r), (0, r), (-r, 0), (r, 0), (-r, -r), (r, r), (-r, r), (r, -r)):
            yy, xx = y + dy, x + dx
            if S.ok(yy, xx) and S.alpha[yy, xx] and not S.ring[yy, xx] and S.part[yy, xx] in allowed_parts:
                c = S.new[yy, xx]
                if c and not c.startswith("G") and c != "OL":
                    cand.append(c)
        if cand:
            break
    if cand:
        S.put(y, x, max(set(cand), key=cand.count), why)
        return True
    return False


def _strap_edges(S, strap, why):
    """the render draws each 1 px strap with an S4 inner line on both sides (skin's 'inner'): a
    strap flush on the skin reads as a 3 px dark line (critique 12b: 'hard dark inner-thigh
    outlines'); those S4 pixels take the skin tone around them"""
    body = S.P.get("body", -1)
    for y, x in zip(*np.nonzero(strap)):
        for dy, dx in N4:
            yy, xx = y + dy, x + dx
            if not S.ok(yy, xx) or S.ring[yy, xx] or S.part[yy, xx] != body or S.new[yy, xx] != "S4":
                continue
            nb = [S.new[yy + a, xx + b] for a, b in N8 if S.ok(yy + a, xx + b) and S.part[yy + a, xx + b] == body
                  and not S.ring[yy + a, xx + b] and S.new[yy + a, xx + b] in ("S1", "S2", "S3")]
            if len(nb) >= 2:
                S.put(yy, xx, max(set(nb), key=nb.count), why)


def do_strap(S, opts):
    sp = S.pid("gold_strap")
    if not sp:
        return
    strap = np.isin(S.part, sp) & S.alpha & ~S.ring
    if not strap.any():
        return
    fill_parts = set(S.pid("body", "stockings", "bodice", "thong"))
    if S.meta["px"] >= 100:
        sk = _thin(strap)
        for y, x in zip(*np.nonzero(strap & ~sk)):
            if S.code[y, x] and S.code[y, x].startswith("G"):
                _fill_from_neighbours(S, y, x, fill_parts, "strap_thin")
        if opts.get("strap_edges", True):
            _strap_edges(S, strap, "strap_edge")
        return
    if opts.get("strap_edges", True):
        _strap_edges(S, strap, "strap_edge")
    # 80: the straps go (hip band + string stay); the ring pixels they left keep the outline
    for y, x in zip(*np.nonzero(strap)):
        _fill_from_neighbours(S, y, x, fill_parts, "strap80")
    # clips and O-rings: the px2 clip dots (G0) on a removed strap go with it
    for y, x in zip(*np.nonzero(np.isin(S.part, sp) & S.ring)):
        pass
    if opts.get("harness80", "G3"):
        hp = S.P.get("gold_harness", -1)
        yb = None
        rb = S.anchor("outfit_rose_b") or S.anchor("outfit_rose_f")
        if rb:
            yb = rb["y"]
        for y, x in zip(*np.nonzero((S.part == hp) & S.alpha & ~S.ring & (S.mat == S.M["gold"]))):
            # the back harness over the hip band (midback strap, halter): one darker line
            if yb is not None and y < yb - 3 and S.new[y, x] and S.new[y, x].startswith("G"):
                S.put(y, x, opts.get("harness80", "G3"), "harness80")


def do_ykx(S, ST, opts):
    c, t = S.anchor("outfit_ykx_c"), S.anchor("outfit_ykx_t")
    if c is None or t is None or c["facing"] > -0.3:
        return                                  # the yoke is on her back: only in back views
    dx, dy = t["x"] - c["x"], t["y"] - c["y"]
    if np.hypot(dx, dy) > 0.6 and abs(math.degrees(math.atan2(dx, -dy))) > 24:
        return
    spec = ST["yoke_cross"]
    st = spec[str(S.meta["px"])]
    cx, cy = int(np.floor(c["x"])), int(np.floor(c["y"]))
    on = set(S.pid(*spec["on_parts"]))
    best = None
    for yy in range(cy - 2, cy + 3):
        for xx in range(cx - 2, cx + 3):
            ok = all(S.ok(yy + a, xx + b) and S.part[yy + a, xx + b] in on and not S.ring[yy + a, xx + b]
                     for a in (-1, 0, 1) for b in (-1, 0, 1))
            if ok:
                d = (yy - cy) ** 2 + (xx - cx) ** 2
                if best is None or d < best[0]:
                    best = (d, yy, xx)
    if best is None:
        return
    _, cy, cx = best
    stamp(S, spec, st["rows"], st["origin"], cx, cy, S.lc[0] > 0, "yoke_cross", spec["on_parts"],
          min_visible=spec["min_visible"])


def do_boot3(S, opts):
    bp = S.P.get("boots", -1)
    boot = (S.part == bp) & S.alpha & ~S.ring & (S.mat == S.M["boot"])
    gold = (S.part == bp) & S.alpha & (S.mat == S.M["gold"])
    if boot.sum() < 10:
        return
    n = _normals(S)
    L = light(S)
    Hh = L + np.array([0, 0, 1.0])
    Hh /= np.linalg.norm(Hh)
    ndh = (n * Hh).sum(-1)
    px = S.meta["px"]
    code = opts.get("boot_gloss", "I0")
    # each boot: 8-connected clusters of boot pixels
    lab = np.zeros(boot.shape, int)
    k = 0
    for y0, x0 in zip(*np.nonzero(boot)):
        if lab[y0, x0]:
            continue
        k += 1
        stk = [(y0, x0)]
        lab[y0, x0] = k
        while stk:
            y, x = stk.pop()
            for dy, dx in N8:
                yy, xx = y + dy, x + dx
                if S.ok(yy, xx) and boot[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = k
                    stk.append((yy, xx))
    for i in range(1, k + 1):
        by, bx = np.nonzero(lab == i)
        if len(by) < 12:
            continue
        top, bot = by.min(), by.max()
        # the shaft streak: rows from 2 under the cuff, the interior pixel with the best N.H per
        # row, kept where it clears a threshold; at most 4 px (144) / 2 px (80), one run
        run = []
        maxlen = 4 if px >= 144 else 2
        for y in range(top + (2 if px >= 144 else 1), top + int(0.55 * (bot - top)) + 1):
            xs = [x for x in bx[by == y] if all(S.ok(y, x + d) and boot[y, x + d] for d in (-1, 1))]
            if not xs:
                continue
            x = max(xs, key=lambda x: ndh[y, x])
            if ndh[y, x] < opts.get("boot_nh", 0.70):
                if run:
                    break
                continue
            if run and abs(x - run[-1][1]) > 1:
                break
            run.append((y, x))
            if len(run) >= maxlen:
                break
        for y, x in run:
            S.put(y, x, code, "boot_gloss")
        # the toe glint: the boot pixel just over the gold toe cap with the best N.H
        toe = [(y, x) for y, x in zip(by, bx) if S.ok(y + 1, x) and gold[y + 1, x] and y > top + 0.6 * (bot - top)]
        if toe:
            y, x = max(toe, key=lambda q: ndh[q])
            if ndh[y, x] > 0.5:
                S.put(y, x, code, "boot_toe")



# ---------------------------------------------------------------------------- sleeves
def do_sleeve3(S, opts):
    """the detached sleeves' white in three planes (critique 13g: 'two flat bands ... reads as
    plastic'; the far bell in the idle is 13 px of W1): per sleeve, from the render's normals,
    W1 on the planes facing the key light (top share), W2 the turning mid, W3 the side turned
    away, cleaned by a 3x3 majority so no 1 px speck is left; W4 lines and the gold stay"""
    sp = S.P.get("sleeves", -1)
    wm = (S.part == sp) & S.alpha & ~S.ring & (S.mat == S.M["white"])
    if wm.sum() < 20 or S.meta["px"] < opts.get("slv_min_px", 100):
        return          # at 80 the three planes banded (PX-P14 14.4 -> 18.1 per 1,000 px on the idle)
    n = _normals(S)
    L = light(S)
    ndl = (n * L).sum(-1)
    lab = np.zeros(wm.shape, int)
    k = 0
    for y0, x0 in zip(*np.nonzero(wm)):
        if lab[y0, x0]:
            continue
        k += 1
        stk = [(y0, x0)]
        lab[y0, x0] = k
        while stk:
            y, x = stk.pop()
            for dy, dx in N4:
                yy, xx = y + dy, x + dx
                if S.ok(yy, xx) and wm[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = k
                    stk.append((yy, xx))
    hi_share, mid_share = opts.get("slv_w1", 0.55), opts.get("slv_w2", 0.20)
    for i in range(1, k + 1):
        m = lab == i
        if m.sum() < (30 if S.meta["px"] >= 144 else 12):
            continue
        v = ndl[m]
        q1 = np.quantile(v, 1 - hi_share)
        q2 = np.quantile(v, 1 - hi_share - mid_share)
        t = np.full(wm.shape, -1, int)
        t[m & (ndl >= q1)] = 2
        t[m & (ndl < q1) & (ndl >= q2)] = 1
        t[m & (ndl < q2)] = 0
        for _ in range(2):
            t2 = t.copy()
            for y, x in zip(*np.nonzero(m)):
                vals = [t[y + a, x + b] for a in (-1, 0, 1) for b in (-1, 0, 1)
                        if S.ok(y + a, x + b) and t[y + a, x + b] >= 0]
                t2[y, x] = max(set(vals), key=vals.count)
            t = t2
        code = {2: "W1", 1: "W2", 0: "W3"}
        for y, x in zip(*np.nonzero(m)):
            if S.new[y, x] != S.code[y, x] or S.code[y, x] == "W4":
                continue
            S.put(y, x, code[t[y, x]], "sleeve3")


def do_tabgold80(S, opts):
    """gold budget at 80 (critique 13e: collar cross, window frame, hip band, stocking tops, boot
    cuffs and sleeve hems only): the tabard's long side borders at 80 take the panel's edge shade
    (W3 on the lit side, W4 on the shadow side); its hem (the lowest 3 rows of each column) and
    its cross keep their gold"""
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
    keep = set()
    for why in ("tabard_cross3", "tabard_cross"):
        keep |= {(y, x) for x, y in S.touched.get(why, [])}
    cx = xs.mean()
    for y, x in zip(ys, xs):
        c = S.new[y, x]
        if not c or not c.startswith("G") or (y, x) in keep or low[x] - y < 3:
            continue
        lit = (x - cx) * S.lc[0] > 0
        S.put(y, x, opts.get("tabgold80_lit", "W3") if lit else "W4", "tabgold80")

def run(still, tag_in="still_o2", tag_out="still_o3", only=ALL3, layer_dir=None, opts=None):
    opts = opts or {}
    S = Still(still, tag_in)
    ST = json.load(open(STAMPS, encoding="utf-8"))
    if "strap" in only:
        do_strap(S, opts)
    if "thsel" in only:
        do_thsel(S, opts)
    if "band3" in only:
        do_band3(S, opts)
    if "glute3" in only:
        do_glute3(S, opts)
    if "sheen3" in only:
        do_sheen3(S, opts)
    if "boot3" in only:
        do_boot3(S, opts)
    if "win3" in only:
        do_win3(S, ST, opts)
    if "bust" in only:
        do_bust(S, opts)
    if "tabx3" in only:
        do_tabx3(S, ST, opts)
    if "tabfold" in only:
        do_tabfold(S, opts)
    if "ykx" in only:
        do_ykx(S, ST, opts)
    if "sleeve3" in only:
        do_sleeve3(S, opts)
    if "tabgold80" in only:
        do_tabgold80(S, opts)
    S.save(tag_out, layer_dir, None if layer_dir is None else
           os.path.basename(os.path.dirname(still)) + "_" + os.path.basename(still) + "_r3")
    return {k: len(v) for k, v in S.touched.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--opts", default="{}")
    ap.add_argument("--still", required=True)
    ap.add_argument("--in", dest="tag_in", default="still_o2")
    ap.add_argument("--out", dest="tag_out", default="still_o3")
    ap.add_argument("--only", default=",".join(ALL3))
    ap.add_argument("--layer-dir", default=None)
    a = ap.parse_args()
    print(a.still, run(a.still, a.tag_in, a.tag_out, a.only.split(","), a.layer_dir, json.loads(a.opts)))


if __name__ == "__main__":
    main()
