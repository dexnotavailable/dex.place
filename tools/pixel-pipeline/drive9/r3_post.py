"""Drive 9 whole-character round 3, pixel side: a library for d9_post.py, used only when the finish json has an 'r3'
block (drive9/r3_finish.json). Every step is numpy on our own render passes, the rig's anchors and authored numbers;
nothing is generated. Each step answers a round-2 blind critic's fix (review/rosace/art/drive9/round-2/verdicts/):

  noise_blur      materials 14 / pixel craft 16: 'speckle noise reads as dither grit' -> the brush and strand noise
                  passes are box-blurred at the render scale to 2-3 px clusters (amplitude restored), before the ramp
  despeckle       16: 'min cluster 2 px' -> a fill pixel with no same-colour 4-neighbour in its own material takes its
                  material's most common 8-neighbour colour (face stamps, lines, rim and effects are kept)
  rim_outline     17: 'a dashed cyan line inset 1 px from the outline: a double outline' -> the rim moves ONTO the
                  outline pixel on the rim-facing side of curved forms (DESIGN revision 2 did this for the white
                  cloth), continuous (1 px gaps bridged, runs < 3 dropped); the inset rim is off
  face_extras     face 2 / attractiveness 3: a 2 px blush under each eye's outer half, a soft jaw step, the head's
                  cast shadow on the neck
  hair            head and hair 4: a sheen arc that follows the skull (zigzag segments, lit side brighter) instead
                  of the spec-band patch; the fringe cut into unequal clumps from an off-centre parting (a notch of
                  forehead shadow under each gap, a dark separator above it); azure tips as a 3-step taper;
                  flyaway strands breaking the silhouette
  bust_r3         body 5: 'two grey spheres, not a lifted bodice form; keep the bodice lit white' -> the lit side of
                  the bust span is lifted toward the white ramp's light, one designed highlight on the lit apex
  belly           sex appeal 12: 'shade the lower belly into the tabard' -> skin beside the tabard takes an occlusion
                  step (2 px falloff)
  fx_n1 / fx_q    stylisation 11 / first impression: N1's contact is inside the 'leaded' window of the glass decay
                  (MOVESET 0.6: full f8, leaded f9-14): a crescent behind the blade tip about the front fist, A4
                  leading edge, A3/A2 body, A1 tail, 1 px A0 leading cutting it into cells, a G1 sliver outside.
                  Q5's contact (MOVESET Q: 'butt strikes the floor; local flash; crack'): a 4-point glass flash at the
                  butt and a leaded crack along the floor line. Both are drawn on the background only.
"""
import math

import numpy as np

import f1_post as F1

N4, N8 = F1.N4, F1.N8
hexrgb, oklab = F1.hexrgb, F1.oklab
CTX = {}


def bind(**kw):
    CTX.update(kw)


def lut_t(stops, t, chroma=1.0):
    lut = CTX["ramp_lut"](stops, chroma=chroma)
    return np.clip(lut[int(np.clip(t, 0, 1) * 255)], 0, 255)


# ---------------------------------------------------------------------------- noise
def _box(a, r, axis):
    if r <= 0:
        return a
    pad = [(0, 0)] * a.ndim
    pad[axis] = (r, r)
    p = np.pad(a, pad, mode="edge")
    c = np.cumsum(p, axis=axis)
    c = np.concatenate([np.zeros_like(np.take(c, [0], axis=axis)), c], axis=axis)
    n = a.shape[axis]
    hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return (hi - lo) / (2 * r + 1)


def noise_blur(nz, ss, cfg):
    """nz: the noise pass (H, W, 3) in 0..1 at ss x. R (brush) is blurred to about cfg['iso_px'] sprite px, G (strand)
    to cfg['strand_px'] across and cfg['strand_px_y'] along; each channel's spread is restored to its original std
    x cfg['gain'] so the tex/strand amplitudes keep their meaning"""
    out = nz.copy()
    for ch, (rx, ry) in ((0, (cfg.get("iso_px", 1.5), cfg.get("iso_px", 1.5))),
                         (1, (cfg.get("strand_px", 0.5), cfg.get("strand_px_y", 1.5)))):
        a = nz[..., ch]
        s0 = a.std() + 1e-9
        b = _box(_box(a, int(round(rx * ss)), 1), int(round(ry * ss)), 0)
        b = (b - b.mean()) * (s0 / (b.std() + 1e-9)) * cfg.get("gain", 1.0) + 0.5
        out[..., ch] = np.clip(b, 0, 1)
    return out


# ---------------------------------------------------------------------------- despeckle
def despeckle(out, alpha, mat, protect, passes=2):
    H, W = alpha.shape
    n = 0
    for _ in range(passes):
        rgb = np.round(out[..., :3]).astype(np.int64)
        code = rgb[..., 0] * 65536 + rgb[..., 1] * 256 + rgb[..., 2]
        same = np.zeros((H, W), bool)
        for dy, dx in N4:
            same |= (F1.shift(code, dy, dx, -1) == code) & (F1.shift(mat, dy, dx, -1) == mat) & F1.shift(alpha, dy, dx, False)
        single = alpha & ~protect & ~same
        ys, xs = np.nonzero(single)
        if not len(ys):
            break
        new = {}
        for y, x in zip(ys, xs):
            cnt = {}
            for dy, dx in N8:
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and alpha[yy, xx] and mat[yy, xx] == mat[y, x] and not protect[yy, xx]:
                    c = int(code[yy, xx])
                    cnt[c] = cnt.get(c, 0) + 1
            if not cnt:
                continue
            best = max(cnt.values())
            if best < 2:
                continue
            cands = [c for c, v in cnt.items() if v == best]
            c0 = out[y, x, :3]
            cc = min(cands, key=lambda c: float(((np.array([c >> 16, (c >> 8) & 255, c & 255]) - c0) ** 2).sum()))
            new[(y, x)] = (cc >> 16, (cc >> 8) & 255, cc & 255)
        for (y, x), c in new.items():
            out[y, x, :3] = c
        n += len(new)
    return n


# ---------------------------------------------------------------------------- rim on the outline
def rim_outline(out, alpha, ring, mat, part, d, byid, FIN, n2):
    cfg = FIN["r3"]["rim_outline"]
    H, W = alpha.shape
    R = np.array(FIN["rim_dir"], float)
    R /= np.linalg.norm(R)
    mats = set(cfg.get("materials", []))
    cool, warm = hexrgb(FIN["rim_color"]), hexrgb(FIN["rim_color_warm"])
    sel = np.zeros((H, W), bool)
    col = np.zeros((H, W, 3))
    face_id = None
    ys, xs = np.nonzero(ring)
    info = {}
    for y, x in zip(ys, xs):
        best, ox, oy = None, 0.0, 0.0
        for dy, dx in N4:
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and alpha[yy, xx]:
                ox -= dx
                oy -= dy
                if best is None or d[yy, xx] < d[best]:
                    best = (yy, xx)
        if best is None:
            continue
        o = np.array([ox, oy], float)
        if np.linalg.norm(o) < 1e-6:
            continue
        o /= np.linalg.norm(o)
        f = float(o @ R)
        name = byid.get(int(mat[best]))
        info[(y, x)] = (f, name, best)
        if f < cfg.get("thr", 0.4) or name not in mats:
            continue
        nn = np.array([n2[best][0], -n2[best][1]])
        if float(nn @ R) / (np.linalg.norm(nn) + 1e-6) < cfg.get("normal_thr", -0.1):
            continue
        sel[y, x] = True
    # bridge 1 px gaps along the ring, then drop short runs
    for y, x in zip(ys, xs):
        if sel[y, x] or (y, x) not in info:
            continue
        f, name, best = info[(y, x)]
        if name not in mats or f < cfg.get("thr", 0.4) - 0.3:
            continue
        nb = sum(1 for dy, dx in N8 if 0 <= y + dy < H and 0 <= x + dx < W and sel[y + dy, x + dx])
        if nb >= 2:
            sel[y, x] = True
    lab, n = F1.clusters(sel)
    for k in range(1, n + 1):
        if (lab == k).sum() < cfg.get("min_run", 3):
            sel[lab == k] = False
    cnt = 0
    for y, x in zip(*np.nonzero(sel)):
        f, name, best = info[(y, x)]
        mc = FIN["materials"].get(name, {})
        base = lut_t(mc["stops"], cfg.get("t", 0.72), mc.get("chroma", 1.0)) if mc.get("stops") else out[best][:3]
        rc = hexrgb(mc["rim_col"]) if mc.get("rim_col") else (warm if mc.get("rim_warm") else cool)
        k = cfg.get("k", 0.5) * min(1.0, 0.55 + 0.6 * f)
        c = base * (1 - k) + rc * k
        # never brighter than the material's own lit tone + the rim (no white line)
        out[y, x, :3] = np.minimum(c, cfg.get("max", 236))
        out[y, x, 3] = 255
        cnt += 1
    return cnt, sel


# ---------------------------------------------------------------------------- face extras
def face_extras(out, alpha, mat, part, meta, byid, FIN, frep, S, keep):
    import wh2_px as W2
    cfg = FIN["r3"].get("face", {})
    px = int(meta["px"])
    big = px >= 110
    hid = meta["parts"].get("head")
    bid = meta["parts"].get("body")
    skin_id = meta["materials"]["skin"]["id"]
    sk = FIN["materials"]["skin"]
    face = alpha & (part == hid) & (mat == skin_id)
    H, W = alpha.shape
    rep = {}
    # 1. the head's cast shadow on the neck (ao-shade-face: 'a large shadow cast by the head' on the neck)
    neck_c = hexrgb(cfg.get("neck_col", "#c98580"))
    body_skin = alpha & (part == bid) & (mat == skin_id) & ~keep
    nn = 0
    rows = cfg.get("neck_rows", [0.75, 0.4]) if big else cfg.get("neck_rows80", [0.6])
    for x in range(W):
        yh = np.nonzero(face[:, x])[0]
        if not len(yh):
            continue
        y0 = yh.max() + 1
        for i, k in enumerate(rows):
            y = y0 + i
            if y < H and body_skin[y, x]:
                out[y, x, :3] = out[y, x, :3] * (1 - k) + neck_c * k
                nn += 1
    rep["neck_shadow"] = nn
    # 2. the jaw: face skin whose pixel below is not face skin takes a soft step toward the skin's mid shadow
    jaw_c = lut_t(sk["stops"], cfg.get("jaw_t", 0.4), sk.get("chroma", 1.0))
    below_not = face & ~F1.shift(face, -1, 0, False)
    jaw = below_not & ~keep
    k = cfg.get("jaw_k", 0.4)
    out[jaw, :3] = out[jaw, :3] * (1 - k) + jaw_c * k
    rep["jaw"] = int(jaw.sum())
    # 3. blush: 2 px (1 at 80) under each eye's outer half, a soft 1 px ring beside it
    nb = 0
    if frep and S is not None and cfg.get("blush", True):
        G = W2.face_geometry(S)
        prof = frep.get("profile") or frep.get("forced_profile")
        near = frep.get("near", G["near"])
        roles = [("eye", near, -1)] if prof else [("eye_near", near, -1), ("eye_far", "R" if near == "L" else "L", 1)]
        dirx = frep.get("dir", G["dir"])
        B = hexrgb(cfg.get("blush_col", "#e3898a"))
        core_k, ring_k = cfg.get("blush_k", [0.62, 0.26])
        for name, eye, side in roles:
            e = G["eyes"][eye]
            dx, dy = frep.get("eye_shifts", {}).get(name, (0, 0))
            outer = side * dirx          # the near eye's outer corner lies away from the nose
            ex = int(math.floor(e[0] + dx))
            ey = int(math.floor(e[1] + dy)) + (cfg.get("blush_dy", 4) if big else 2)
            xs = [ex + outer, ex] if big else [ex + outer]
            core = [(ey, x) for x in xs]
            ring = [(ey, x) for x in (min(xs) - 1, max(xs) + 1)] + ([(ey + 1, x) for x in xs] if big else [])
            for (y, x), kk in [(c, core_k) for c in core] + [(r, ring_k) for r in ring]:
                if 0 <= y < H and 0 <= x < W and face[y, x] and not keep[y, x]:
                    out[y, x, :3] = out[y, x, :3] * (1 - kk) + B * kk
                    keep[y, x] = True
                    nb += 1
    rep["blush"] = nb
    return rep


# ---------------------------------------------------------------------------- hair
def _hair_masks(alpha, mat, part, meta, byid):
    hm = [m for m, n in byid.items() if n == "hair"]
    tm = [m for m, n in byid.items() if n == "hairtip"]
    hparts = [v for k, v in meta["parts"].items() if k.startswith("hair_")]
    hair = alpha & np.isin(mat, hm) & np.isin(part, hparts)
    tip = alpha & np.isin(mat, tm)
    return hair, tip


def _eye_y(meta):
    an = meta.get("anchors", {})
    ss = meta["ss"]
    ys = [an[k][1] / ss for k in ("eye_L", "eye_R") if k in an]
    return float(np.mean(ys)) if ys else None


def _hair_tones(out, hair, keep):
    hs = np.unique(np.round(out[hair & ~keep, :3]).astype(int), axis=0)
    return hs[np.argsort(oklab(hs)[:, 0])] if len(hs) else hs


def hair_r3(out, alpha, mat, part, meta, byid, FIN, keep):
    cfg = FIN["r3"].get("hair", {})
    px = int(meta["px"])
    big = px >= 110
    H, W = alpha.shape
    hair, tip = _hair_masks(alpha, mat, part, meta, byid)
    ey = _eye_y(meta)
    rep = {}
    if ey is None or not hair.any():
        return rep
    tones = _hair_tones(out, hair, keep)
    sep = tones[int(len(tones) * 0.12)] if len(tones) else np.array([20, 20, 50])
    hid = meta["parts"].get("head")
    skin_id = meta["materials"]["skin"]["id"]
    face = alpha & (part == hid) & (mat == skin_id)
    # --- sheen arc
    sc = cfg.get("sheen")
    if sc:
        crown = hair & (np.arange(H)[:, None] < ey - 1)
        cols = np.nonzero(crown.any(0))[0]
        ytop = {}
        for x in cols:
            fy = np.nonzero(alpha[:, x])[0]
            hy = np.nonzero(crown[:, x])[0]
            if len(fy) and len(hy) and hy.min() <= fy.min() + 1:
                ytop[int(x)] = int(hy.min())
        if ytop:
            cy = min(ytop.values())
            Hh = max(4.0, ey - cy)
            lim = cy + sc.get("span", 0.4) * Hh
            xs = sorted(x for x, y in ytop.items() if y <= lim)
            if len(xs) >= 4:
                d = max(1, int(round(sc.get("depth", 0.3) * Hh)))
                segs = sc.get("segs", [4, 3, 4, 3, 4]) if big else sc.get("segs80", [3, 2, 3])
                kx = np.sign(FIN["key_dir"][0]) or 1
                order = xs if kx < 0 else xs[::-1]       # start on the key-lit side
                core_c, halo_c = hexrgb(sc["core"]), hexrgb(sc["halo"])
                i = 0
                si = 0
                pos = 0
                ncore = nhalo = 0
                span = len(order)
                while i < span:
                    L = segs[si % len(segs)]
                    off = (si % 2) * (1 if big else 0)
                    for j in range(L):
                        if i + j >= span:
                            break
                        x = order[i + j]
                        # the bow: the arc sinks toward the sides of the skull (a ring seen from a little above)
                        u = abs((i + j) / max(1, span - 1) * 2 - 1)
                        y = ytop[x] + d + off + int(round(sc.get("bow", 0) * (1 if big else 0.5) * u * u))
                        lit = (i + j) / span < sc.get("lit_frac", 0.6)
                        if 0 <= y < H and hair[y, x] and not keep[y, x]:
                            if lit:
                                out[y, x, :3] = core_c
                                ncore += 1
                            else:
                                out[y, x, :3] = out[y, x, :3] * 0.4 + halo_c * 0.6
                                nhalo += 1
                            keep[y, x] = True
                            if big:
                                yb = y + 1
                                if yb < H and hair[yb, x] and not keep[yb, x]:
                                    out[yb, x, :3] = out[yb, x, :3] * 0.5 + halo_c * 0.5
                                    keep[yb, x] = True
                                    nhalo += 1
                    i += L + 1
                    si += 1
                    pos += 1
                rep["sheen"] = {"core": ncore, "halo": nhalo, "depth_px": d, "cols": span}
    # --- fringe clumps from an off-centre parting
    fc = cfg.get("fringe")
    if fc and face.any():
        bottoms = {}
        for x in np.nonzero(face.any(0))[0]:
            for y in range(int(ey) - 1, 0, -1):
                if face[y, x] and y - 1 >= 0 and hair[y - 1, x]:
                    bottoms[int(x)] = y - 1
                    break
        xs = sorted(bottoms)
        n = 0
        if len(xs) >= 5:
            fr = fc.get("gaps", [0.2, 0.42, 0.66, 0.85]) if big else fc.get("gaps80", [0.33, 0.7])
            depth = fc.get("depth", 2) if big else 1
            shc = lut_t(FIN["materials"]["skin"]["stops"], fc.get("notch_t", 0.34))
            for f in fr:
                x = xs[min(len(xs) - 1, int(round(f * (len(xs) - 1))))]
                y = bottoms[x]
                if keep[y, x]:
                    continue
                if big:
                    out[y, x, :3] = shc
                    keep[y, x] = True
                    n += 1
                    ys_ = range(y - 1, y - 1 - depth, -1)
                else:
                    ys_ = range(y, y - depth, -1)
                for yy in ys_:
                    if 0 <= yy < H and hair[yy, x] and not keep[yy, x]:
                        out[yy, x, :3] = out[yy, x, :3] * 0.2 + sep * 0.8
                        keep[yy, x] = True
                        n += 1
        rep["fringe_px"] = n
    # --- azure tips: a 3-step taper by distance from the hair
    tc = cfg.get("tips")
    if tc and tip.any():
        st = FIN["materials"]["hairtip"]["stops"]
        dist = np.zeros((H, W), int)
        front = hair.copy()
        seen = hair.copy()
        for k in range(1, 5):
            grow = np.zeros_like(front)
            for dy, dx in N4:
                grow |= F1.shift(front, dy, dx, False)
            grow &= tip & ~seen
            dist[grow] = k
            seen |= grow
            front = grow
        dist[tip & ~seen] = 4
        ts = tc.get("t", [0.35, 0.6, 0.8, 0.92])
        nt = 0
        for k in range(1, 5):
            m = tip & (dist == k) & ~keep
            if m.any():
                c = lut_t(st, ts[k - 1], FIN["materials"]["hairtip"].get("chroma", 1.0))
                out[m, :3] = out[m, :3] * (1 - tc.get("k", 0.7)) + c * tc.get("k", 0.7)
                nt += int(m.sum())
        # the hair's last pixel before the tip steps toward deep azure
        tr = np.zeros_like(hair)
        for dy, dx in N4:
            tr |= F1.shift(tip, dy, dx, False)
        tr &= hair & ~keep
        c = lut_t(st, tc.get("t_join", 0.18))
        out[tr, :3] = out[tr, :3] * 0.55 + c * 0.45
        rep["tips"] = {"tip_px": nt, "join_px": int(tr.sum())}
    return rep


def flyaways(out, alpha, mat, part, meta, byid, FIN, drawn):
    cfg = FIN["r3"].get("hair", {}).get("flyaways")
    if not cfg:
        return 0
    px = int(meta["px"])
    big = px >= 110
    H, W = alpha.shape
    hair, _ = _hair_masks(alpha, mat, part, meta, byid)
    ey = _eye_y(meta)
    if ey is None or not hair.any():
        return 0
    tones = _hair_tones(out, hair, np.zeros_like(hair))
    crown = hair & (np.arange(H)[:, None] < ey + 2)
    ys, xs = np.nonzero(crown)
    if not len(ys):
        return 0
    cx, cy = xs.mean() + 0.5, ys.mean() + 0.5
    bg = ~alpha & ~drawn
    edge = crown & (sum(F1.shift(bg, dy, dx, False).astype(np.int8) for dy, dx in N4) > 0)
    ey_, ex_ = np.nonzero(edge)
    if not len(ey_):
        return 0
    ang = np.degrees(np.arctan2(-(ey_ + 0.5 - cy), ex_ + 0.5 - cx))
    n = 0
    specs = cfg["strands"] if big else cfg["strands"][:cfg.get("n80", 2)]
    for sp in specs:
        a = sp["ang"]
        dang = np.abs((ang - a + 180) % 360 - 180)
        i = int(np.argmin(dang))
        if dang[i] > 35:
            continue
        p = np.array([ex_[i] + 0.5, ey_[i] + 0.5])
        d0 = p - np.array([cx, cy])
        d0 /= np.linalg.norm(d0) + 1e-9
        # launch along the silhouette (the tangent that points down), a little outward: a strand lifting off the
        # mass, not a spike standing out of it
        tg = np.array([-d0[1], d0[0]])
        if tg[1] < 0:
            tg = -tg
        d0 = d0 + tg * sp.get("tan", 0.0)
        d0 /= np.linalg.norm(d0) + 1e-9
        L = int(round(sp["len"] * (1.0 if big else cfg.get("scale80", 0.55))))
        curl = math.radians(sp.get("curl", 20))
        g = sp.get("g", 0.15)
        path = []
        pos = p.copy()
        dcur = d0.copy()
        for s in range(L * 3):
            th = curl / max(1, L)
            c_, s_ = math.cos(th), math.sin(th)
            dcur = np.array([c_ * dcur[0] - s_ * dcur[1], s_ * dcur[0] + c_ * dcur[1]])
            dcur = dcur + np.array([0.0, g / max(1, L)])
            dcur /= np.linalg.norm(dcur)
            pos = pos + dcur * 0.5
            q = (int(math.floor(pos[1])), int(math.floor(pos[0])))
            if not (0 <= q[0] < H and 0 <= q[1] < W):
                break
            if alpha[q] and q != (ey_[i], ex_[i]):
                if path:
                    break
                continue
            if not path or path[-1] != q:
                path.append(q)
            if len(path) >= L:
                break
        # thin to a 1 px 8-connected line (drop corner doubles)
        thin = []
        for q in path:
            if len(thin) >= 2 and abs(q[0] - thin[-2][0]) <= 1 and abs(q[1] - thin[-2][1]) <= 1:
                thin[-1] = q
            else:
                thin.append(q)
        for j, q in enumerate(thin):
            f = j / max(1, len(thin) - 1)
            c = tones[int(len(tones) * (sp.get("rank0", 0.18) + (sp.get("rank1", 0.42) - sp.get("rank0", 0.18)) * f))]
            out[q[0], q[1], :3] = c
            out[q[0], q[1], 3] = 255
            drawn[q] = True
            n += 1
    return n


# ---------------------------------------------------------------------------- bust
def bust_r3(out, alpha, mat, part, n2, meta, FIN, raw, keep):
    import json
    import os
    cfg = FIN["r3"].get("bust")
    lp = os.path.join(raw, "landmarks.json")
    bid = meta["parts"].get("bodice")
    if not cfg or not os.path.exists(lp) or bid is None:
        return None
    Ls = json.load(open(lp))["screen"][str(meta["px"])]
    al, ar, pn = Ls["bust_apex_left"], Ls["bust_apex_right"], Ls["pit_neck"]
    H, W = alpha.shape
    big = int(meta["px"]) >= 110
    bod = alpha & (part == bid)
    ks = np.array(FIN["key_dir"], float)
    ks /= np.linalg.norm(ks)
    x0 = int(np.floor(min(al[0], ar[0]))) - 3
    x1 = int(np.ceil(max(al[0], ar[0]))) + 3
    y0 = int(round(pn[1])) + 1
    y1 = int(round(max(al[1], ar[1]))) + max(2, int(0.02 * meta["px"]))
    wm = FIN["materials"]["white"]
    lit_c = lut_t(wm["stops"], cfg.get("lit_t", 0.78), wm.get("chroma", 1.0))
    nl = 0
    for y in range(max(0, y0), min(H, y1 + 1)):
        for x in range(max(0, x0), min(W, x1 + 1)):
            if not bod[y, x] or keep[y, x]:
                continue
            f = float(np.array([n2[y, x, 0], -n2[y, x, 1]]) @ ks)
            if f > cfg.get("lit_thr", 0.05):
                c = out[y, x, :3]
                if oklab(c[None])[0, 0] < oklab(lit_c[None])[0, 0]:
                    k = cfg.get("lit_k", 0.55) * min(1.0, 0.4 + f)
                    out[y, x, :3] = c * (1 - k) + lit_c * k
                    nl += 1
    # one designed highlight on the apex that faces the key light (screen right for key_dir x > 0)
    ap = ar if (ar[0] - al[0]) * ks[0] > 0 else al
    hl = hexrgb(cfg.get("hl_col", "#f3f0f2"))
    cells = cfg.get("hl_cells", [[-1, -2], [0, -2], [1, -3], [-2, -1]]) if big else cfg.get("hl_cells80", [[0, -1], [1, -2]])
    nh = 0
    ax, ay = int(math.floor(ap[0])), int(math.floor(ap[1]))
    for dx, dy in cells:
        x, y = ax + dx, ay + dy
        if 0 <= y < H and 0 <= x < W and bod[y, x] and not keep[y, x]:
            out[y, x, :3] = hl
            keep[y, x] = True
            nh += 1
    return {"lit_px": nl, "highlight_px": nh, "apex": [round(ap[0], 1), round(ap[1], 1)]}


# ---------------------------------------------------------------------------- belly into the tabard
def belly(out, alpha, mat, part, meta, FIN, keep):
    cfg = FIN["r3"].get("belly")
    tid = meta["parts"].get("tabard")
    bid = meta["parts"].get("body")
    if not cfg or tid is None:
        return 0
    skin_id = meta["materials"]["skin"]["id"]
    tab = alpha & (part == tid)
    sk = alpha & (part == bid) & (mat == skin_id) & ~keep
    c = lut_t(FIN["materials"]["skin"]["stops"], cfg.get("t", 0.3))
    near = np.zeros_like(tab)
    for dy, dx in N8:
        near |= F1.shift(tab, dy, dx, False)
    near2 = near.copy()
    for dy, dx in N4:
        near2 |= F1.shift(near, dy, dx, False)
    k1, k2 = cfg.get("k", [0.5, 0.22])
    m1 = sk & near
    m2 = sk & near2 & ~near
    out[m1, :3] = out[m1, :3] * (1 - k1) + c * k1
    out[m2, :3] = out[m2, :3] * (1 - k2) + c * k2
    return int(m1.sum() + m2.sum())


# ---------------------------------------------------------------------------- effects
A = {"A0": "#0d1240", "A1": "#1a2f8c", "A2": "#2a62d0", "A3": "#4aa8f0", "A4": "#a0e6ff", "A5": "#f0fcff", "G1": "#ecc96f"}


def _fx_col(code, FIN):
    pal = dict(A)
    pal.update(FIN["r3"].get("fx_rgb", {}))
    return hexrgb(pal[code])


def fx_n1(out, alpha, meta, FIN, drawn):
    cfg = FIN["r3"].get("fx", {}).get("n1")
    an = meta.get("anchors", {})
    if not cfg or "glaive_tip" not in an:
        return 0
    ss = meta["ss"]
    H, W = alpha.shape
    s = int(meta["px"]) / 144.0
    t = np.array(an["glaive_tip"][:2], float) / ss
    p0 = np.array(an[cfg.get("pivot", "hand_L")][:2], float) / ss
    Rt = float(np.linalg.norm(t - p0)) + cfg.get("out", 0.0) * s
    th_t = math.atan2(t[1] - p0[1], t[0] - p0[0])
    sw = math.radians(cfg.get("sweep", 40))
    Wm = cfg.get("width", 14) * s
    dr = cfg.get("dir", 1)
    lead = cfg.get("lead", [0.2, 0.4, 0.62, 0.82])
    tap = cfg.get("taper", 1.4)
    n = 0
    for y in range(max(0, int(p0[1] - Rt - 3)), min(H, int(p0[1] + Rt + 3))):
        for x in range(max(0, int(p0[0] - Rt - 3)), min(W, int(p0[0] + Rt + 3))):
            if alpha[y, x] or drawn[y, x]:
                continue
            q = np.array([x + 0.5, y + 0.5]) - p0
            r = float(np.hypot(*q))
            dth = dr * (math.atan2(q[1], q[0]) - th_t)
            dth = (dth + math.pi) % (2 * math.pi) - math.pi
            if not (0.0 < dth < sw):
                continue
            f = dth / sw
            ro = Rt * (1 - cfg.get("curl", 0.04) * f)
            w = Wm * (1 - f) ** tap
            code = None
            if ro - w <= r < ro and w >= 0.7:
                depth = ro - r
                if any(abs(f - L) < 0.6 / (max(r, 1.0) * sw) for L in lead) and depth >= 1.0:
                    code = "A0"          # the leading between the cells (never around the smear)
                elif depth < 1.0 and f < 0.75:
                    code = "A4"
                elif f > 0.72:
                    code = "A1"
                elif depth < w * 0.5:
                    code = "A3"
                else:
                    code = "A2"
            elif ro + 1.0 <= r < ro + 2.0 and cfg.get("sliver", [0.08, 0.4])[0] < f < cfg.get("sliver", [0.08, 0.4])[1]:
                code = "G1"
            if code:
                out[y, x, :3] = _fx_col(code, FIN)
                out[y, x, 3] = 255
                drawn[y, x] = True
                n += 1
    return n


def fx_q(out, alpha, meta, FIN, drawn):
    cfg = FIN["r3"].get("fx", {}).get("q")
    an = meta.get("anchors", {})
    if not cfg or "glaive_butt" not in an:
        return 0
    ss = meta["ss"]
    H, W = alpha.shape
    big = int(meta["px"]) >= 110
    s = int(meta["px"]) / 144.0
    b = np.array(an["glaive_butt"][:2], float) / ss
    bx, by = int(math.floor(b[0])), int(math.floor(b[1]))
    # the floor line: the lowest figure row near the butt
    n = 0

    def put(x, y, code):
        nonlocal n
        if 0 <= y < H and 0 <= x < W and not alpha[y, x] and not drawn[y, x]:
            out[y, x, :3] = _fx_col(code, FIN)
            out[y, x, 3] = 255
            drawn[y, x] = True
            n += 1
    # 4-point flash: a 2x2 A5 core, A4 arms, A3 tips (up-arm longer, the stamp drives down)
    arms = cfg.get("arms", {"h": 6, "up": 5}) if big else cfg.get("arms80", {"h": 3, "up": 3})
    for dx in (0, 1):
        for dy in (-1, 0):
            put(bx + dx, by + dy, "A5")
    for i in range(1, arms["h"] + 1):
        c = "A4" if i < arms["h"] - 1 else "A3"
        put(bx - i, by, c)
        put(bx + 1 + i, by, c)
    for i in range(1, arms["up"] + 1):
        c = "A4" if i < arms["up"] - 1 else "A3"
        put(bx, by - 1 - i, c)
        if big and i <= 2:
            put(bx + 1, by - 1 - i, "A4")
    # a leaded glass crack along the floor line, both sides of the butt
    for side in (-1, 1):
        x = bx + (arms["h"] + 2 if side > 0 else -arms["h"] - 1)
        y = by
        L = int(round(cfg.get("crack", 12) * s))
        jit = cfg.get("jitter", [0, 0, -1, 0, 1, 0, 0, -1, 0, 1, 0, 0])
        for i in range(L):
            y2 = y + jit[i % len(jit)]
            put(x, y2, "A3" if i < L * 0.6 else "A2")
            if big:
                put(x, y2 + 1, "A0")
            x += side
    return n
