"""Shading lane: re-band Rosace's body materials like a pixel artist, from the render's light pass.

Called by rosace_post.py --shade <preset.json> after the downsample and cleanup, before the gold,
trim and orphan passes and before the lines. It only rewrites palette codes of pixels whose
material the preset lists; silhouette, materials, parts, the head's face zone and the hair stay
the render's (other lanes own them). Without --shade nothing here runs.

Why (ART-RULES PX-P02, PX-P03, PX-P13, PX-N01, PX-N02, PX-N11; pixel.md 1.10): the toon render
bands each material by the mesh's own N.L, so every facet and every crease of the source mesh
becomes a tone step (the "3D render look": thin parallel bands, 1 px shadow strips along
outlines, specks where normals wobble). An artist instead picks one light, puts one terminator
per form where it explains the form, adds designed cast shadows, and keeps clusters big.

Per material (preset "materials"):
  1. designed light: value = max(0, n . L) * ao^ao_pow, with the material's own L (camera space,
     x right, y up, z to the viewer); normals smoothed inside one (material, part) region first
     (Gaussian, sigma px at 144, scaled by px/144), so facets and creases do not make bands
  2. the terminator per region: the shadow threshold is the region's `share` quantile of value,
     clamped to [t_min, t_max] (so a form is never all-lit or all-shadow unless it really faces
     away), then optional highlight above `hi` (only the top `hi_share` of lit pixels)
  3. cast shadows: screen-space rays toward the light over the fine depth pass; a pixel whose ray
     passes behind a nearer surface within `cast_px` px is in cast shadow (under the bust, the
     tabard on the thighs, the chin on the neck, the hair on the shoulders)
  4. deep: occlusion (ao < ao_deep) and the first `contact_px` of a cast shadow next to its
     occluder take the deep tone
  5. clusters: a 3x3 majority filter inside the region, then islands smaller than `min_px`
     merge into their neighbours, then 1 px shadow strips (no 2x2 block of shadow) go back to lit
     (no pillow rim, PX-P13)
Tone codes per material: "tones": [deep, shadow, lit, highlight]; any may repeat.

Round 2 (all opt-in by preset key; the r1 presets run as before):
  * "split_limb": forms are (material, part, limb) regions, the limb id coming from the depth2 pass
    (rosace_shade_lane.py writes each face's dominant bone); pieces under "min_limb_px" merge into
    the neighbouring form of the same (material, part). Per-limb overrides: cfg["limbs"][name].
  * "fit": "plane" | "quad": the value is replaced (by "fit_mix") with its least-squares plane (or
    quadric) over the form, so the terminator is one straight (or one curved) designed edge instead of
    the mesh's N.L contour; "tilt" leans it (negative: the lower part of the form darker, a diagonal
    edge down a thigh instead of a vertical stripe along it).
  * "deep_thick": deep pixels not in a 2x2 all-deep block of their form go up to shadow (S4 only in
    contact and cast shapes >= 2 px, never a 1 px strip along an outline, PX-P13).
  * "hi_inset": the highlight keeps >= this many px from the form's edge (no S1 edge on the outline).
  * P["head"]: the head's skin stays flat lit except a fringe cast band (fringe_px rows under the hair,
    shifted away from the light, FC-P16) and a chin shadow on the neck (chin_px rows, PX-P03).
  * P["folds"]: pipe folds hanging from an anchor part (the bell sleeve from its armband): shadow
    strokes >= 2 px wide, fanning out, of different lengths.
  * gold "mode": "trim2": by thickness across the run: 1 px lines one tone (G2), 2 px bands lit over
    shade, 3+ lit / mid / shade (PX-P27); P["gold_drop"] turns thin gold of the listed parts on the
    listed limbs (the garter straps on the thighs) into the material beside it at small sizes.

Round 2b (the round-1 critique, params 14a-e, 15, 16; all opt-in by preset key):
  * "fit": "cyl" (+ "lens", "bow"): a limb shaded as a cylinder along its own axis, one short
    highlight lens at the half-vector (cyl_fit, PX-P35)
  * material "hem": occlusion bands under a nearer part straight above (min_run: horizontal hems only;
    limbs: the underbust); stocking "welt": the dark top band and the skin lip over it
  * fold "core_tone": a crease line inside a fold (kept off in the pick: it read as scratches)
  * gold "glint_fallback" (one G0 per trim piece) and "small" (at <= max_px: bridge 1 px gaps between
    two different pieces, drop pieces under min_piece)
  * P["cast"]["occluders"] / "ignore_mats" / "min_px": designed casts only, no specks
  * P["by_size"]["80"]: per-size overrides merged over the preset
  Line policy (rosace_post.py, P["lines"]): inner_same, no_inner_under / no_inner_on, lit_drop.
  The value map itself is the preset's "colors" (final hex remap in rosace_shade_stills.py).

Round 3 (the round-2 critique, params 14-17; all opt-in by preset key):
  * material "bands" (sub_bands): the shadow side of a form splits into a soft terminator band next to
    the lit side ("trans", 1 px at 144), a core shadow ("core", >= 2 px thick, >= reflect px off the
    form's edge) and a reflected-light edge (the rest of the shadow tone): lit / terminator / core /
    bounce, the refs' four skin values (ref 04 thigh: 181 / 110 / 154 / 147 px in four clusters)
    instead of two flat cel bands. On a cylinder limb the core is a spindle along the axis ("spindle":
    [s0, s1]), so it tapers to both ends and never runs as a stripe down the whole thigh.
  * gold "glint_convex": the G0 glint only on a convex end or corner of a trim piece (<= glint_nb gold
    neighbours of 8), the most lit such pixel.
  * post_face (run by rosace_shade_stills.py after the face stamp): the fringe's and the sidelocks' cast
    shadow on the face skin (S2 -> S3 only, never on or beside a feature pixel).
"""
import os

import numpy as np

DEBUG = os.environ.get("ROSACE_SHADE_DEBUG")      # a folder: per-material value maps and the cast mask

CYL_DBG = {}
N4 = [(-1, 0), (1, 0), (0, -1), (0, 1)]
N8 = N4 + [(-1, -1), (-1, 1), (1, -1), (1, 1)]


def shift(a, dy, dx, fill=0):
    out = np.full_like(a, fill)
    h, w = a.shape[:2]
    ys0, ys1 = max(0, -dy), min(h, h - dy)
    xs0, xs1 = max(0, -dx), min(w, w - dx)
    out[ys0:ys1, xs0:xs1] = a[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx]
    return out


def region_blur(val, lab, sel, sigma):
    """Gaussian blur of val (H, W[, C]) restricted to pixels of the same label, inside sel"""
    if sigma <= 0:
        return val.copy()
    r = max(1, int(np.ceil(2 * sigma)))
    acc = np.zeros_like(val, dtype=np.float64)
    wsum = np.zeros(lab.shape, np.float64)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            w = np.exp(-(dy * dy + dx * dx) / (2 * sigma * sigma))
            same = (shift(lab, dy, dx, -1) == lab) & shift(sel, dy, dx, False) & sel
            nb = shift(val, dy, dx, 0)
            if val.ndim == 3:
                acc += w * same[..., None] * nb
            else:
                acc += w * same * nb
            wsum += w * same
    wsum = np.maximum(wsum, 1e-9)
    return acc / (wsum[..., None] if val.ndim == 3 else wsum)


def components(mask, conn=N4):
    H, W = mask.shape
    lab = np.full((H, W), -1, np.int32)
    comps = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0] >= 0:
            continue
        k = len(comps)
        st, pix = [(y0, x0)], []
        lab[y0, x0] = k
        while st:
            y, x = st.pop()
            pix.append((y, x))
            for dy, dx in conn:
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and lab[yy, xx] < 0:
                    lab[yy, xx] = k
                    st.append((yy, xx))
        comps.append(pix)
    return lab, comps


def cast_shadow(alpha, dfine, recv, ppm, L, max_px, bias, lab=None, occ_ok=None):
    """screen-space shadow rays toward the light. dfine: view depth in metres (bigger = farther).
    L: camera-space light (x right, y up, z to the viewer). Returns (shadow mask, steps to the
    occluder). lab (round 2): a form label map; an occluder must be another form, so a limb does not
    shadow itself (its own turn is the terminator's job: self-cast put OL / S4 / S4 / S3 ladders along
    the thighs' outlines)."""
    H, W = alpha.shape
    lx, ly, lz = L
    sxy = np.hypot(lx, ly)
    if sxy < 1e-6:
        return np.zeros((H, W), bool), np.zeros((H, W), np.int32)
    ux, uy = lx / sxy, -ly / sxy                 # screen direction toward the light (y down)
    rise = lz / sxy / ppm                          # metres toward the camera per px along the ray
    sh = np.zeros((H, W), bool)
    dist = np.zeros((H, W), np.int32)
    ys, xs = np.nonzero(recv)
    for y, x in zip(ys, xs):
        d0 = dfine[y, x]
        for s in range(1, max_px + 1):
            qx, qy = int(round(x + ux * s)), int(round(y + uy * s))
            if not (0 <= qx < W and 0 <= qy < H) or not alpha[qy, qx]:
                break
            if dfine[qy, qx] < d0 - s * rise - bias and (lab is None or lab[qy, qx] != lab[y, x])                     and (occ_ok is None or occ_ok[qy, qx]):
                sh[y, x] = True
                dist[y, x] = s
                break
    return sh, dist


def majority(idx, sel, lab, passes=1):
    """3x3 majority inside the same region: a pixel takes the most common tone of its 8
    same-region neighbours when that tone has >= 5 of them"""
    H, W = idx.shape
    for _ in range(passes):
        new = idx.copy()
        for y, x in zip(*np.nonzero(sel)):
            votes = {}
            for dy, dx in N8:
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and sel[yy, xx] and lab[yy, xx] == lab[y, x]:
                    votes[idx[yy, xx]] = votes.get(idx[yy, xx], 0) + 1
            if not votes:
                continue
            t, nb = max(sorted(votes.items()), key=lambda kv: kv[1])
            if t != idx[y, x] and nb >= 5:
                new[y, x] = t
        idx[:] = new


def merge_small(idx, sel, lab, min_px, keep=()):
    """islands (4-connected, one tone, one region) under min_px take their most common
    neighbouring tone in the region. Tones in keep (highlights) are exempt."""
    H, W = idx.shape
    for t in np.unique(idx[sel]):
        if t in keep:
            continue
        m = sel & (idx == t)
        clab, comps = components(m)
        for pix in comps:
            if len(pix) >= min_px:
                continue
            votes = {}
            for y, x in pix:
                for dy, dx in N4:
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and sel[yy, xx] and idx[yy, xx] != t \
                            and lab[yy, xx] == lab[y, x]:
                        votes[idx[yy, xx]] = votes.get(idx[yy, xx], 0) + 1
            if votes:
                v = max(sorted(votes.items()), key=lambda kv: kv[1])[0]
                for y, x in pix:
                    idx[y, x] = v


def thin_to_lit(idx, sel, lab, dark_max):
    """shadow pixels (tone index <= dark_max) not in any 2x2 all-shadow block of their region go
    up one tone: no 1 px shadow strips along an outline (PX-P13, PX-N01)"""
    dark = sel & (idx <= dark_max)
    thick = np.zeros_like(dark)
    for oy in (0, -1):
        for ox in (0, -1):
            blk = np.ones_like(dark)
            for dy in (0, 1):
                for dx in (0, 1):
                    blk &= shift(dark, oy + dy, ox + dx, False) & (shift(lab, oy + dy, ox + dx, -1) == lab)
            thick |= blk
    thin = dark & ~thick
    idx[thin] = np.minimum(idx[thin] + 1, dark_max + 1)
    return int(thin.sum())


TONE_IDX = {"deep": 0, "shadow": 1, "lit": 2, "hi": 3}
LIMB_NAMES = {0: "", 1: "torso", 2: "neck", 3: "head", 4: "thigh_L", 5: "thigh_R", 6: "shin_L", 7: "shin_R",
              8: "foot_L", 9: "foot_R", 10: "uarm_L", 11: "uarm_R", 12: "farm_L", 13: "farm_R", 14: "hand_L",
              15: "hand_R", 16: "bust_L", 17: "bust_R", 18: "glute_L", 19: "glute_R", 20: "sleeve_L",
              21: "sleeve_R", 22: "tabard", 23: "stole", 24: "hair", 25: "glaive"}
LIMB_ID = {v: k for k, v in LIMB_NAMES.items() if v}


def limb_match(name, pats):
    return any(name == p or (p.endswith("*") and name.startswith(p[:-1])) for p in pats)


def merge_small_regions(lab, sel, base, min_px):
    """(material, part, limb) regions under min_px take the most common neighbouring label with the
    same (material, part) base; returns the new label map"""
    lab = lab.copy()
    for r in np.unique(lab[sel]):
        m = sel & (lab == r)
        if m.sum() >= min_px:
            continue
        votes = {}
        for dy, dx in N8:
            nb = shift(lab, dy, dx, -1)
            ok = m & shift(sel, dy, dx, False) & (nb != r) & (shift(base, dy, dx, -1) == base)
            for v in nb[ok]:
                votes[int(v)] = votes.get(int(v), 0) + 1
        if votes:
            lab[m] = max(sorted(votes), key=lambda v: votes[v])
    return lab


def fit_value(val, rs, kind, tilt=0.0, lean=0.0):
    """least-squares plane (or quadric) of val over the region rs; the fitted field, plus tilt * the
    region's value spread per standard deviation along y (negative: lower rows darker). lean (degrees,
    plane only): the plane's gradient turns that far toward screen-up, so the terminator (its iso-line)
    leans by the same angle and the shadow side widens toward the bottom of the form: one diagonal edge
    down a thigh instead of a stripe along it."""
    ys, xs = np.nonzero(rs)
    v = val[rs]
    if len(v) < 6:
        return val
    cy, cx = ys.mean(), xs.mean()
    sy, sx = max(1.0, ys.std()), max(1.0, xs.std())
    Y, X = (ys - cy) / sy, (xs - cx) / sx
    cols = [np.ones_like(X), X, Y]
    if kind == "quad":
        cols += [X * X, Y * Y, X * Y]
    A = np.stack(cols, 1)
    coef, *_ = np.linalg.lstsq(A, v, rcond=None)
    out = val.copy()
    if lean and kind == "plane":
        g = np.array([coef[1] / sx, coef[2] / sy])          # value per px along x, y (y down)
        gm = np.linalg.norm(g)
        if gm > 1e-9:
            th = np.radians(lean)
            ca, sa = np.cos(th), np.sin(th)
            r1 = np.array([ca * g[0] - sa * g[1], sa * g[0] + ca * g[1]])
            r2 = np.array([ca * g[0] + sa * g[1], -sa * g[0] + ca * g[1]])
            g = r1 if r1[1] < r2[1] else r2                    # the turn that points more up
            coef = np.array([coef[0], g[0] * sx, g[1] * sy])
    fit = A[:, :3] @ coef[:3] if (lean and kind == "plane") else A @ coef
    if tilt:
        fit = fit + tilt * max(float(v.std()), 0.05) * Y
    out[rs] = fit
    return out


def bfs_dist(src, within, cap=12):
    """4-step distance from src, walking only inside `within` (src itself is 0); cap+1 where unreached"""
    dist = np.full(src.shape, cap + 1, np.int32)
    dist[src] = 0
    cur = src.copy()
    for s in range(1, cap + 1):
        grow = np.zeros_like(cur)
        for dy, dx in N4:
            grow |= shift(cur, dy, dx, False)
        new = grow & within & (dist > s)
        if not new.any():
            break
        dist[new] = s
        cur = new
    return dist


def sub_bands(B, idx, rs, lab, k, sfield=None, frozen=None):
    """round 3: split one form's shadow side (idx == 1) into a terminator band beside the lit side, a core
    shadow and a reflected-light edge. Returns (trans mask, core mask). B = the material's "bands" dict:
    term_px (terminator band width at 144, default 1), reflect_px (bounce band at the form's edge, 1),
    core_min (core thickness floor, 2: PX-P13), spindle [s0, s1] (cylinder limbs: the core only between
    those fractions of the limb's length, its allowed depth tapering as a sine toward both ends),
    min_px (a form narrower than this in its shadow side gets no core, just the band)."""
    trans = np.zeros(rs.shape, bool)
    core = np.zeros(rs.shape, bool)
    sh = rs & (idx == 1)
    if frozen is not None:
        sh &= ~frozen
    lit = rs & (idx >= 2)
    if not sh.any() or not lit.any():
        return trans, core
    tp = max(1, int(round(B.get("term_px", 1) * max(k, B.get("min_k", 0.75)))))
    rp = int(round(B.get("reflect_px", 1) * max(k, B.get("min_k", 0.75))))
    dl = bfs_dist(lit, sh, cap=24)
    outside = ~rs
    edge_src = rs & np.zeros_like(rs)
    for dy, dx in N4:
        edge_src |= rs & shift(outside, dy, dx, True)
    de = bfs_dist(edge_src, rs, cap=24)
    if B.get("trans", True):
        trans = sh & (dl <= tp)
    cm = sh & (dl > tp) & (de >= rp)
    if sfield is not None and B.get("spindle"):
        s0, s1 = B["spindle"]
        sp = np.clip((sfield - s0) / max(1e-3, s1 - s0), 0, 1)
        prof = np.sin(np.pi * sp) ** B.get("spindle_pow", 0.7)
        # allowed core depth past the band: its share of the local shadow depth, tapering at the ends
        depth = dl - tp
        room = np.maximum(1, dl + de - tp - rp)
        cm &= (sfield >= s0) & (sfield <= s1) & (depth <= np.ceil(prof * room))
    thick = thick_mask(cm, lab)
    core = cm & thick
    if B.get("min_px"):
        _, comps = components(core)
        for pix in comps:
            if len(pix) < B["min_px"] * max(1.0, k * k):
                for y, x in pix:
                    core[y, x] = False
    return trans, core


def cyl_fit(rs, L, rc, k, sout=None):
    """round 2b: a limb shaded as a cylinder along its own axis (the round-1 critique, param 14a: "shade
    the thigh as a cylinder ... the terminator following the leg's curve, not a vertical line").
    The region's principal axis a (PCA of its pixels) and the across direction b; per 1 px slice along
    a, u runs 0..1 across the slice's width (the slice edges smoothed over 5 slices, so a jaggy outline
    does not wobble the terminator). The cylinder's normal across the form is 2u - 1 (screen, along b)
    with its z = sqrt(1 - (2u - 1)^2); value = n . L. A terminator at one value is one u, so it runs
    parallel to both contours and bends with the leg. "bow" bends it further (the middle of the limb's
    length turns a little more toward the light, as the thigh's belly does).
    Returns (value field over rs, lens mask): the lens is the highlight (rc "lens": {at, len, w}): a
    short spindle centred on the brightest u, at `at` (0..1 along the axis from the limb's top), `len`
    of the length, at most `w` px wide at 144, tapering to its ends, >= hi_inset px inside the form."""
    ys, xs = np.nonzero(rs)
    val = np.zeros(rs.shape, np.float64)
    lens = np.zeros(rs.shape, bool)
    if len(ys) < 8:
        return val, lens
    P = np.stack([xs, ys], 1).astype(np.float64)
    c = P.mean(0)
    w_, V = np.linalg.eigh(np.cov((P - c).T))
    a = V[:, 1]
    if a[1] < 0:
        a = -a                                  # the axis points down the screen (top of the limb = s min)
    b = np.array([-a[1], a[0]])
    s = (P - c) @ a
    t = (P - c) @ b
    si = np.round(s - s.min()).astype(int)
    n = si.max() + 1
    tmin = np.full(n, np.nan)
    tmax = np.full(n, np.nan)
    for i in range(n):
        m = si == i
        if m.any():
            tmin[i], tmax[i] = t[m].min(), t[m].max()
    ok = ~np.isnan(tmin)
    idx_ = np.arange(n)
    tmin = np.interp(idx_, idx_[ok], tmin[ok])
    tmax = np.interp(idx_, idx_[ok], tmax[ok])
    kern = np.ones(5) / 5
    pad = lambda v: np.concatenate([np.full(2, v[0]), v, np.full(2, v[-1])])
    tmin_s = np.convolve(pad(tmin), kern, "valid")
    tmax_s = np.convolve(pad(tmax), kern, "valid")
    wid = np.maximum(tmax_s[si] - tmin_s[si], 1.0)
    u = np.clip((t - tmin_s[si] + 0.5) / (wid + 1.0), 0, 1)
    sn = si / max(1, n - 1)
    Ls = np.array([L[0], -L[1]])               # screen light (y down)
    lb = float(Ls @ b)
    lz = float(L[2])
    bow = rc.get("bow", 0.0)
    u2 = np.clip(u + bow * np.sign(lb) * (4 * sn * (1 - sn) - 0.66) * 0.5, 0, 1)
    nx = 2 * u2 - 1
    nz = np.sqrt(np.clip(1 - nx * nx, 0, 1))
    v = np.clip(nx * lb + nz * lz, 0, 1)
    if rc.get("taper"):
        # round 3 (critique 14: stripes down the thighs): the shadow side is wider at the limb's root (the form
        # turns under the hip band and the crotch) and narrows toward the knee, so the terminator runs across
        # the axis at a slant instead of parallel to both contours
        v = v + rc["taper"] * (sn - 0.5)
    val[ys, xs] = v
    if sout is not None:
        sout[ys, xs] = sn
    ln = rc.get("lens")
    if ln:
        if ln.get("half", True):
            # a shine sits where the surface faces the half-vector of light and eye (a specular), not
            # at the diffuse peak: with a side key the diffuse peak is on the rim, the shine further in
            hv = np.array([L[0], L[1], L[2] + 1.0])
            hv /= np.linalg.norm(hv)
            hb, hz = float(np.array([hv[0], -hv[1]]) @ b), float(hv[2])
        else:
            hb, hz = lb, lz
        mag = np.hypot(hb, hz) + 1e-9
        upk = (hb / mag + 1) / 2                # the brightest u
        at, half = ln.get("at", 0.4), ln.get("len", 0.4) / 2
        dz = (sn - at) / max(half, 1e-3)
        hw = ln.get("w", 2.0) * max(k, ln.get("w_min_k", 0.75)) / 2 * np.sqrt(np.clip(1 - dz * dz, 0, 1))
        on = (np.abs((u - upk) * (wid + 1)) <= hw) & (np.abs(dz) < 1)
        lens[ys[on], xs[on]] = True
    return val, lens


def hem_bands(H_, sel, idx, alpha, mat, part, d, MID, k, occ_mask=None, limb=None):
    """round 2b: occlusion bands under a hem (the round-1 critique, param 14a: "an occlusion band 1-2 px
    darker under the tabard, garter and bodice hem"). A receiver pixel whose pixel `j` rows straight
    above (j = 1..px) belongs to another part that is nearer the camera (by > bias m), or to one of the
    listed materials, goes to the shadow tone; the first `deep_px` rows under a thick occluder go deep.
    Returns the mask painted."""
    H, W = sel.shape
    px = max(1, int(round(H_.get("px", 2) * k)))
    dpx = int(round(H_.get("deep_px", 0) * k))
    bias = H_.get("bias", 0.01)
    mats = [MID[m] for m in H_.get("from", []) if m in MID]
    out = np.zeros(sel.shape, bool)
    deep = np.zeros(sel.shape, bool)
    for j in range(1, px + 1):
        qa = shift(alpha, -j, 0, False)
        qd = shift(d, -j, 0, 1e9)
        qp = shift(part, -j, 0, -1)
        qm = shift(mat, -j, 0, -1)
        other = (qp != part) | (qm != mat)
        if H_.get("limbs") and limb is not None:
            other |= shift(limb, -j, 0, -1) != limb       # bust over torso: the underbust
        occ = qa & other & ((qd + bias < d) | np.isin(qm, mats))
        if H_.get("min_run"):
            # a hem is a horizontal edge: the occluder pixel's horizontal run (same material) must be
            # >= min_run px, so a 1 px diagonal strap across the skin makes no band under itself
            om = alpha & (mat >= 0)
            runs_ = np.zeros(sel.shape, np.int32)
            for mm in np.unique(mat[alpha]):
                r_, _ = _runlen(alpha & (mat == mm), 0)
                runs_ = np.where(mat == mm, r_, runs_)
            occ &= shift(runs_, -j, 0, 0) >= max(2, int(round(H_["min_run"] * k)))
        if occ_mask is not None:
            occ &= shift(occ_mask, -j, 0, False)
        # the pixels between the occluder and this one must be the receiver's own (a band, not a jump)
        between = np.ones_like(sel)
        for i in range(1, j):
            between &= shift(sel, -i, 0, False)
        hit = sel & occ & between
        out |= hit
        if j <= dpx:
            deep |= hit
    idx[out & (idx >= 1)] = 1
    idx[deep] = 0
    return out


def thick_mask(m, lab):
    """pixels of m inside some 2x2 block of m whose 4 pixels share one label"""
    thick = np.zeros_like(m)
    for oy in (0, -1):
        for ox in (0, -1):
            blk = np.ones_like(m)
            for dy in (0, 1):
                for dx in (0, 1):
                    blk &= shift(m, oy + dy, ox + dx, False) & (shift(lab, oy + dy, ox + dx, -1) == lab)
            thick |= blk
    return thick


def edge_dist(sel, lab, n):
    """pixels of sel within n px (4-steps) of their region's edge"""
    near = np.zeros_like(sel)
    cur = sel.copy()
    for _ in range(n):
        inner = cur.copy()
        for dy, dx in N4:
            inner &= shift(cur, dy, dx, False) & (shift(lab, dy, dx, -1) == lab)
        near |= cur & ~inner
        cur = inner
    return near


def gold_drop(P, meta, alpha, mat, code, part, limb, MID):
    """small sizes: thin gold of the listed parts on the listed limbs (the garter straps across the
    thighs, 1 px chains that read as scribble at 80 px, round-1 critique params 15/16) becomes the
    material beside it (its mat, part, limb and tone), so the skin's own shading covers it"""
    gd = P.get("gold_drop")
    if not gd or meta["px"] > gd.get("max_px", 96) or "gold" not in MID:
        return 0
    parts = meta.get("parts", {})
    pids = [parts[p] for p in gd.get("parts", []) if p in parts]
    lids = [LIMB_ID[x] for x in gd.get("limbs", []) if x in LIMB_ID]
    g = alpha & (mat == MID["gold"]) & np.isin(part, pids) & np.isin(limb, lids)
    if gd.get("strap_only", True):
        # straps: runs at most 1 px wide across (a horizontal band on the thigh stays)
        gall = alpha & (mat == MID["gold"])
        g &= _runlen(gall, 0)[0] <= gd.get("max_width", 1)
    H, W = alpha.shape
    n = 0
    for _ in range(4):
        todo = list(zip(*np.nonzero(g)))
        if not todo:
            break
        for y, x in todo:
            votes = {}
            for dy, dx in N8:
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and alpha[yy, xx] and not g[yy, xx] and mat[yy, xx] != MID["gold"]:
                    kk = (int(mat[yy, xx]), int(code[yy, xx]), int(part[yy, xx]), int(limb[yy, xx]))
                    votes[kk] = votes.get(kk, 0) + (2 if (dy == 0 or dx == 0) else 1)
            if votes:
                mm, cc, pp, ll = max(sorted(votes), key=lambda kk: votes[kk])
                mat[y, x], code[y, x], part[y, x], limb[y, x] = mm, cc, pp, ll
                g[y, x] = False
                n += 1
    return n


def _runlen(sel, axis):
    """run length of sel through each pixel along rows (axis 0) or columns (axis 1), and the pixel's
    position in its run"""
    a = sel if axis == 0 else sel.T
    out = np.zeros(a.shape, np.int32)
    pos = np.zeros(a.shape, np.int32)
    for i in range(a.shape[0]):
        row = a[i]
        j = 0
        n = a.shape[1]
        while j < n:
            if not row[j]:
                j += 1
                continue
            e = j
            while e + 1 < n and row[e + 1]:
                e += 1
            out[i, j:e + 1] = e - j + 1
            pos[i, j:e + 1] = np.arange(e - j + 1)
            j = e + 1
    return (out, pos) if axis == 0 else (out.T, pos.T)


def trim2(cfg, alpha, mat, code, part, sel, ex, CIDX, k, light):
    """gold trim by thickness across the run (PX-P27): a 1 px line is one tone (mid), a 2 px band lit
    on the side facing the light over shade, 3+ lit / mid / shade; one glint per cluster (>= glint_min
    px) on a lit pixel where the render's spec fired"""
    shade, mid_, lit = (CIDX[c] for c in cfg["tones"][:3])
    H, W = sel.shape
    th_h, pos_h = _runlen(sel, 0)
    th_v, pos_v = _runlen(sel, 1)
    vert_thin = th_v <= th_h          # thin vertically: a horizontal band, lit on top
    t = np.where(vert_thin, th_v, th_h)
    pos = np.where(vert_thin, pos_v, pos_h)
    from_lit = np.where(vert_thin, pos, np.where(light[0] >= 0, t - 1 - pos, pos))
    out = np.full((H, W), mid_, np.int32)
    two = t == 2
    many = t >= 3
    out[two & (from_lit == 0)] = lit
    out[two & (from_lit == 1)] = shade
    out[many & (from_lit == 0)] = lit
    out[many & (from_lit == t - 1)] = shade
    if cfg.get("lit_share") and not np.isnan(ex[..., 0]).all():
        # the lit row only where the trim turns toward the light (its top lit_share by the light pass);
        # elsewhere mid over shade, so lit and shade rows differ in length (PX-N02)
        v = np.nan_to_num(ex[..., 0])
        lm = sel & (out == lit)
        if lm.any():
            th = float(np.quantile(v[lm], 1 - cfg["lit_share"]))
            out[lm & (v < th)] = mid_
    code[sel] = out[sel]
    n_cut = 0
    if cfg.get("max_thick"):
        # value plan (round-1 critique param 15: ~18% of the figure gold): a trim that runs along an edge
        # (>= along_min px) and is thicker than max_thick across keeps its lit and shade rows; the rest
        # becomes the material on its far side (fewer, cleaner 2 px lit-over-shade bands, PX-P27)
        along = np.where(vert_thin, th_h, th_v)
        cut = sel & (t > cfg["max_thick"]) & (along >= cfg.get("along_min", 5)) & (from_lit >= cfg["max_thick"])
        gid = mat[sel][0] if sel.any() else -1
        for _ in range(3):
            todo = list(zip(*np.nonzero(cut)))
            if not todo:
                break
            for y, x in todo:
                votes = {}
                for dy, dx in N8:
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and alpha[yy, xx] and mat[yy, xx] != gid:
                        kk = (int(mat[yy, xx]), int(code[yy, xx]), int(part[yy, xx]))
                        votes[kk] = votes.get(kk, 0) + (2 if (dy == 0 or dx == 0) else 1)
                if votes:
                    mm, cc, pp = max(sorted(votes), key=lambda kk: votes[kk])
                    mat[y, x], code[y, x], part[y, x] = mm, cc, pp
                    cut[y, x] = False
                    sel[y, x] = False
                    n_cut += 1
    n_glint = 0
    if cfg.get("spec") and not np.isnan(ex[..., 2]).all():
        _, comps = components(sel, N8)
        spf = np.nan_to_num(ex[..., 2])
        lv = np.nan_to_num(ex[..., 0])
        gsel = sel.copy()
        nbc = sum(shift(gsel, dy, dx, False).astype(np.int32) for dy, dx in N8)
        for pix in comps:
            cand = [(spf[y, x], -y, x) for y, x in pix if code[y, x] == lit and spf[y, x] > 0.5]
            if cfg.get("glint_convex"):
                # round 3 (critique 14): a glint sits on a convex end or corner of the piece (few gold
                # neighbours), where a real metal edge catches the light, the most lit such pixel; a piece
                # with no convex lit pixel gets none (a glint mid-run read as a speck on a flat band)
                conv = [(lv[y, x], -y, x) for y, x in pix
                        if code[y, x] in (lit, mid_) and nbc[y, x] <= cfg.get("glint_nb", 3)]
                cand = sorted(conv)[-1:] if conv else []
            if not cand and cfg.get("glint_fallback") and not cfg.get("glint_convex"):
                # round 2b (critique 14d): every trim piece gets its one hot specular, on its most lit
                # pixel on the lit row, even where the render's spec band missed it
                cand = [(lv[y, x], -y, x) for y, x in pix if code[y, x] == lit]
            if len(pix) >= cfg.get("glint_min", 4) * max(1.0, k if cfg.get("glint_scale") else 1.0) and cand:
                _, ny, x = max(cand)
                code[-ny, x] = CIDX[cfg["spec"]]
                n_glint += 1
    n_bridge = n_drop = 0
    sm = cfg.get("small")
    if sm and k * 144 <= sm.get("max_px", 96):
        # round 2b (critique 14d, at 80 px): a 1 px gap in a gold run (gold on both sides, straight or
        # diagonal) is filled with the run's own tone, then pieces under min_piece px become the material
        # around them, so the waist stops sparkling
        gid = int(mat[sel][0]) if sel.any() else -1
        for _ in range(sm.get("bridge_passes", 1)):
            gm = alpha & (mat == gid)
            glab, _ = components(gm, N8)
            fill = np.zeros_like(gm)
            for (dy, dx) in ((0, 1), (1, 0), (1, 1), (1, -1)):
                la, lb_ = shift(glab, dy, dx, -1), shift(glab, -dy, -dx, -1)
                # only a gap between two different pieces (a broken run), never a pixel inside a pattern
                fill |= (la >= 0) & (lb_ >= 0) & (la != lb_)
            fill &= alpha & ~gm & np.isin(mat, sm.get("_on_mats", []))
            fill &= ~np.isin(part, sm.get("_never_parts", []))
            for y, x in zip(*np.nonzero(fill)):
                nb = [code[y + dy, x + dx] for dy, dx in N8
                      if 0 <= y + dy < H and 0 <= x + dx < W and gm[y + dy, x + dx]]
                pp = [part[y + dy, x + dx] for dy, dx in N8
                      if 0 <= y + dy < H and 0 <= x + dx < W and gm[y + dy, x + dx]]
                mat[y, x] = gid
                code[y, x] = max(set(nb), key=nb.count)
                part[y, x] = max(set(pp), key=pp.count)
                sel[y, x] = True
                n_bridge += 1
        _, comps = components(sel, N8)
        for pix in comps:
            if len(pix) >= sm.get("min_piece", 2):
                continue
            votes = {}
            for y, x in pix:
                for dy, dx in N8:
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and alpha[yy, xx] and not sel[yy, xx]:
                        kk = (int(mat[yy, xx]), int(code[yy, xx]), int(part[yy, xx]))
                        votes[kk] = votes.get(kk, 0) + 1
            if votes:
                mm, cc, pp_ = max(sorted(votes), key=lambda kk: votes[kk])
                for y, x in pix:
                    mat[y, x], code[y, x], part[y, x] = mm, cc, pp_
                    sel[y, x] = False
                    n_drop += 1
    return {"px": int(sel.sum()), "t1": int((sel & (t == 1)).sum()), "t2": int((sel & two).sum()),
            "t3+": int((sel & many).sum()), "cut": n_cut, "glints": n_glint, "bridged": n_bridge,
            "dropped": n_drop}


def head_pass(H_, meta, alpha, mat, code, part, limb, CIDX, MID, light):
    """the head's skin: flat lit (the face lane's stamp draws the features), a fringe cast band under
    the hair (FC-P16: >= 2 px, shifted away from the light, no single px) and a chin shadow on the neck
    (PX-P03). Returns pixel counts."""
    parts = meta.get("parts", {})
    if "skin" not in MID or "head" not in parts:
        return {}
    k = meta["px"] / 144.0
    skin = alpha & (mat == MID["skin"])
    face = skin & (part == parts["head"])
    hair = alpha & np.isin(mat, [MID[n] for n in ("hair", "hairtip") if n in MID])
    lit, sh, deep = CIDX[H_.get("lit", "S2")], CIDX[H_.get("fringe_tone", "S3")], CIDX[H_.get("chin_tone", "S4")]
    code[face] = lit
    fp = max(1, int(round(H_.get("fringe_px", 2) * max(k, H_.get("fringe_min_k", 0.75)))))
    sx = -1 if light[0] > 0 else 1          # the cast falls away from the light
    fr = np.zeros_like(face)
    for d in range(1, fp + 1):
        fr |= shift(hair, -d, 0, False)
        if H_.get("fringe_shift", 1):
            fr |= shift(hair, -d, -sx, False)
    fr &= face
    if H_.get("fringe_rows_max"):
        ys, _ = np.nonzero(face)
        if len(ys):
            fr &= np.arange(fr.shape[0])[:, None] <= ys.min() + H_["fringe_rows_max"] * k
    _, comps = components(fr)
    for pix in comps:
        if len(pix) < H_.get("fringe_min_px", 3):
            for y, x in pix:
                fr[y, x] = False
    code[fr] = sh
    out = {"face": int(face.sum()), "fringe": int(fr.sum())}
    cp = H_.get("chin_px", 2)
    if cp:
        cpx = max(1, int(round(cp * max(k, 0.75))))
        neck = skin & ~face & np.isin(limb, [LIMB_ID["neck"], LIMB_ID["torso"], 0])
        ch = np.zeros_like(face)
        for d in range(1, cpx + 1):
            ch |= shift(face, -d, 0, False)
        ch &= neck
        code[ch] = deep
        npx = int(round(H_.get("neck_px", 0) * k))
        if npx:
            nk = np.zeros_like(face)
            for d in range(cpx + 1, cpx + npx + 1):
                nk |= shift(face, -d, 0, False)
            nk &= neck & ~ch & (limb == LIMB_ID["neck"])
            code[nk] = CIDX[H_.get("neck_tone", "S3")]
            out["neck"] = int(nk.sum())
        out["chin"] = int(ch.sum())
    return out


def folds(F, meta, alpha, part, idx, sel, lab):
    """pipe folds hanging from an anchor part (the bell sleeve from its gold armband): per region of
    the material in the part, s runs from the anchor (0) to the far end (1) and u across the region's
    width (0..1); each fold is a stroke at u = at_i (fanning out with s) from s0 to len_i, w0 -> w1
    px wide, painted in the shadow tone on lit pixels. Returns the painted mask."""
    parts = meta.get("parts", {})
    k = meta["px"] / 144.0
    done = np.zeros(idx.shape, bool)
    pid = parts.get(F["part"])
    aid = parts.get(F.get("anchor_part", ""), -1)
    if pid is None:
        return done
    anchor = alpha & (part == aid)
    for r in np.unique(lab[sel & (part == pid)]):
        rs = sel & (lab == r)
        if rs.sum() < F.get("min_px", 60) * k * k:
            continue
        ys, xs = np.nonzero(rs)
        grow = rs.copy()
        for _ in range(3):
            grow = grow | shift(grow, 1, 0, False) | shift(grow, -1, 0, False) | shift(grow, 0, 1, False) | shift(grow, 0, -1, False)
        near = anchor & grow
        if near.any():
            ay, ax = [float(v) for v in np.argwhere(near).mean(0)]
        else:
            i = ys.argmin()
            ay, ax = float(ys[i]), float(xs[i])
        d2 = (ys - ay) ** 2 + (xs - ax) ** 2
        by, bx = float(ys[d2.argmax()]), float(xs[d2.argmax()])
        L = np.hypot(by - ay, bx - ax)
        if L < 6:
            continue
        uy, ux = (by - ay) / L, (bx - ax) / L
        if uy < np.cos(np.radians(F.get("max_angle", 50))):
            continue                 # pipe folds hang: none on a sleeve flung sideways or up
        S = ((ys - ay) * uy + (xs - ax) * ux) / L
        T = -(ys - ay) * ux + (xs - ax) * uy
        sb = np.clip((S * 12).astype(int), 0, 12)
        tmin = np.full(13, np.inf)
        tmax = np.full(13, -np.inf)
        np.minimum.at(tmin, sb, T)
        np.maximum.at(tmax, sb, T)
        wid = np.maximum(tmax[sb] - tmin[sb], 1)
        U = (T - tmin[sb]) / wid
        f0 = F.get("fan0", 0.6)
        for i, at in enumerate(F.get("at", [0.35, 0.68])):
            ln = F.get("len", [0.9, 0.7])[i]
            fan = 0.5 + (at - 0.5) * (f0 + (1 - f0) * np.clip(S, 0, 1))
            w = (F.get("w0", 2) + (F.get("w1", 3) - F.get("w0", 2)) * np.clip(S, 0, 1)) * max(k, F.get("w_min_k", 0.75))
            w = np.maximum(w, F.get("w_floor", 2))
            on = (S >= F.get("s0", 0.08)) & (S <= ln) & (np.abs((U - fan) * wid) <= w / 2)
            m = np.zeros(idx.shape, bool)
            m[ys[on], xs[on]] = True
            if F.get("only_lit", True):
                m &= idx >= 2
            idx[m] = TONE_IDX[F.get("tone", "shadow")]
            done |= m
            if F.get("core_tone") and (meta["px"] >= F.get("core_min_size", 0)):
                # round 2b (critique 14b): the fold's crease, a much darker cool line in its middle
                # (ref 04 skirt / 08 top: white anchored by near-black folds), shorter than the fold
                cw = F.get("core_w", 1.0) * max(k, 0.75)
                cl = F.get("core_len", 0.8)
                s1 = F.get("s0", 0.08) + (ln - F.get("s0", 0.08)) * cl
                core = (S >= F.get("s0", 0.08) + 0.05) & (S <= s1) & (np.abs((U - fan) * wid) <= cw / 2)
                cm = np.zeros(idx.shape, bool)
                cm[ys[core], xs[core]] = True
                cm &= m | (idx <= 1)
                idx[cm] = TONE_IDX[F["core_tone"]]
                done |= cm
    return done
PAINT_CACHE = {}


def paint_ops(P, meta):
    """the painted override for this still, if the preset names a paint_dir and one exists:
    <paint_dir>/<pose>_<px>.json. Returns (ops, why) with ops None when absent or STALE."""
    pdir = P.get("paint_dir")
    if not pdir:
        return None, "no paint_dir"
    if not os.path.isabs(pdir):
        pdir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), pdir)
    f = os.path.join(pdir, f"{meta.get('pose')}_{meta['px']}.json")
    if f in PAINT_CACHE:
        return PAINT_CACHE[f]
    if not os.path.exists(f):
        PAINT_CACHE[f] = (None, "none for this still")
        return PAINT_CACHE[f]
    import json
    ops = json.load(open(f, encoding="utf-8"))
    ao = ops.get("authored_on", {})
    here = {"canvas": meta.get("canvas"), "anchor": meta.get("anchor"), "pose_sha1": meta.get("pose_sha1")}
    if any(ao.get(k) != here[k] for k in here):
        print(f"shade: paint {os.path.basename(f)} STALE (authored on {ao}, this render {here}); skipped")
        PAINT_CACHE[f] = (None, "STALE")
    else:
        PAINT_CACHE[f] = (ops, os.path.basename(f))
    return PAINT_CACHE[f]


def paint(P, meta, name, idx, sel):
    """painted override for key frames: authored shapes in TONE space (deep / shadow / lit / hi),
    applied after the automatic terminator, cast shadows and cluster clean-up, masked to one
    material (and optionally to pixels currently in some tones). Because they name a tone, not a
    colour, they follow any preset or palette change; because they are masked by material, a
    shape that overlaps its neighbour cannot paint it. Staleness as overrides.py: the file keeps
    the render it was authored on and is skipped when the canvas, anchor or pose change."""
    done = np.zeros(idx.shape, bool)
    ops, _ = paint_ops(P, meta)
    if not ops:
        return done
    from PIL import Image, ImageDraw
    H, W = idx.shape
    for st in ops.get("strokes", []):
        if st.get("mat") != name:
            continue
        m = Image.new("L", (W, H), 0)
        dr = ImageDraw.Draw(m)
        for pts in st.get("polys", []):
            dr.polygon([tuple(p) for p in pts], fill=255)
        for box in st.get("ellipses", []):
            dr.ellipse(box, fill=255)
        for x, y in st.get("px", []):
            dr.point((x, y), fill=255)
        mk = (np.asarray(m) > 0) & sel
        if st.get("only"):
            mk &= np.isin(idx, [TONE_IDX[t] for t in st["only"]])
        idx[mk] = TONE_IDX[st["tone"]]
        done |= mk
    return done


def anti_hug(idx, sel, lab, passes=2, frozen=None):
    """break banding (PX-N02, Pixel Logic's hugging runs): where a run of >= 3 px of one tone lies
    against a run of another tone with the same start and end in the next row (or column) of the
    same region, one end pixel of the second run takes the first run's tone, so the terminator
    steps at a different place than its neighbour and the two stop hugging. The end alternates
    so the fix does not lean every edge one way. Returns the number of pixels changed."""
    changed = 0
    for _ in range(passes):
        for T in (False, True):
            I = idx.T if T else idx
            S = sel.T if T else sel
            Lb = lab.T if T else lab
            Fz = None if frozen is None else (frozen.T if T else frozen)
            n_lines, n = I.shape

            def runs(k):
                out, i = {}, 0
                row, srow, lrow = I[k], S[k], Lb[k]
                while i < n:
                    j = i
                    while j + 1 < n and srow[j + 1] and srow[i] and row[j + 1] == row[i] and lrow[j + 1] == lrow[i]:
                        j += 1
                    if srow[i] and j - i + 1 >= 3:
                        out[(i, j)] = (row[i], lrow[i])
                    i = j + 1
                return out
            prev = runs(0)
            for k in range(n_lines - 1):
                nxt = runs(k + 1)
                for (a, b), (t1, r1) in prev.items():
                    v = nxt.get((a, b))
                    if v is None or v[0] == t1 or v[1] != r1:
                        continue
                    e = b if (k + a) % 2 == 0 else a
                    if Fz is not None and Fz[k + 1, e]:
                        continue
                    I[k + 1, e] = t1
                    changed += 1
                prev = runs(k + 1)
    return changed


def final_antihug(P, img, alpha, mat, part, ln, MID, parts, passes=2):
    """after the lines: the same hug-breaking on the finished colours, where a shaded material's
    run hugs a line or outline run (a shadow strip parallel to the silhouette, a panel's shadow
    column beside its edge line). Lines, the outline ring and gold stay fixed; only a pixel of a
    re-banded material changes, and only to the tone on its own other side (the run gets shorter,
    never a new colour). Returns the number of pixels changed."""
    skip = {parts[p] for p in P.get("skip_parts", []) if p in parts}
    mids = [MID[m] for m, c in P["materials"].items() if m in MID and c.get("mode") != "trim"]
    mod = alpha & np.isin(mat, mids) & ~ln & ~np.isin(part, list(skip))
    key = (img[..., 0].astype(np.int64) << 16) | (img[..., 1].astype(np.int64) << 8) | img[..., 2]
    key = np.where(img[..., 3] > 0, key, -1)
    changed = 0
    for _ in range(passes):
        for T in (False, True):
            K = key.T if T else key
            M = mod.T if T else mod
            Mt = mat.T if T else mat
            n_lines, n = K.shape

            def runs(k):
                out, i = {}, 0
                row = K[k]
                while i < n:
                    j = i
                    while j + 1 < n and row[j + 1] == row[i]:
                        j += 1
                    if row[i] >= 0 and j - i + 1 >= 3:
                        out[(i, j)] = row[i]
                    i = j + 1
                return out
            R = [runs(k) for k in range(n_lines)]
            for k in range(n_lines - 1):
                for (a, b), v in R[k].items():
                    w = R[k + 1].get((a, b))
                    if w is None or w == v:
                        continue
                    done = False
                    # both runs are one re-banded material: an end pixel of the k+1 run takes the k run's tone
                    for e in ((b, a) if (k + a) % 2 == 0 else (a, b)):
                        if M[k + 1, e] and M[k, e] and Mt[k + 1, e] == Mt[k, e]:
                            K[k + 1, e] = K[k, e]
                            changed += 1
                            done = True
                            break
                    # else the run in k+1 (its other side is k+2), then the run in k (other side k-1)
                    for kk, far in ((k + 1, k + 2), (k, k - 1)):
                        if done or not (0 <= far < n_lines):
                            continue
                        for e in ((b, a) if (k + a) % 2 == 0 else (a, b)):
                            if M[kk, e] and K[far, e] >= 0 and K[far, e] != K[kk, e] and Mt[far, e] == Mt[kk, e]                                     and M[far, e]:
                                K[kk, e] = K[far, e]
                                changed += 1
                                done = True
                                break
    img[..., 0] = np.where(key >= 0, (key >> 16) & 255, img[..., 0])
    img[..., 1] = np.where(key >= 0, (key >> 8) & 255, img[..., 1])
    img[..., 2] = np.where(key >= 0, key & 255, img[..., 2])
    return changed


def final_clusters(P, img, alpha, mat, part, ln, MID, parts):
    """after the lines (round 2, PX-P33): a pixel of a re-banded material whose colour none of its 8
    neighbours shares, with >= 5 same-material non-line neighbours, takes their most common colour;
    lines, the outline ring and the head (the face lane's) stay. Returns the number changed."""
    names = P.get("final_clusters") or []
    mids = [MID[m] for m in names if m in MID]
    if not mids:
        return 0
    skip = parts.get("head", -1)
    key = (img[..., 0].astype(np.int64) << 16) | (img[..., 1].astype(np.int64) << 8) | img[..., 2]
    H, W = alpha.shape
    mod = alpha & np.isin(mat, mids) & ~ln & (part != skip)
    if P.get("final_keep"):
        # round 3 (critique 16: despeckle cloth and hair unless specular): these codes keep their singles
        import json
        pal = json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                                          "art", "rosace", "palette.json"), encoding="utf-8"))["colors"]
        kk = [(int(pal[c][1:3], 16) << 16) | (int(pal[c][3:5], 16) << 8) | int(pal[c][5:7], 16)
              for c in P["final_keep"] if c in pal]
        mod &= ~np.isin(key, kk)
    new = key.copy()
    n = 0
    for y, x in zip(*np.nonzero(mod)):
        same, votes = False, {}
        for dy, dx in N8:
            yy, xx = y + dy, x + dx
            if not (0 <= yy < H and 0 <= xx < W) or not alpha[yy, xx]:
                continue
            if key[yy, xx] == key[y, x]:
                same = True
                break
            if mat[yy, xx] == mat[y, x] and not ln[yy, xx]:
                votes[int(key[yy, xx])] = votes.get(int(key[yy, xx]), 0) + 1
        if same or sum(votes.values()) < 5:
            continue
        new[y, x] = max(sorted(votes), key=lambda v: votes[v])
        n += 1
    img[..., 0] = np.where(mod, (new >> 16) & 255, img[..., 0])
    img[..., 1] = np.where(mod, (new >> 8) & 255, img[..., 1])
    img[..., 2] = np.where(mod, new & 255, img[..., 2])
    return n


def trim(cfg, alpha, mat, code, part, sel, ex, CIDX, MID, k, nrm=None, light=(0.5, 0.62, 0.6)):
    """metal trim (PX-P27): a band reads as metal when it is lit on the edge that faces the light
    and shaded on the other, not when its tone cycles along it. Per pixel: count the open sides
    (no pixel of the material there) toward the light (up, right) and away (down, left); more open
    toward the light -> lit, more away -> shade, equal -> mid. So a 2 px band is lit over shade, a
    1 px line is mid, a 3 px band lit / mid / shade. One glint (spec code) per cluster, where the
    render's spec fired, on a lit pixel."""
    shade, mid_, lit = (CIDX[c] for c in cfg["tones"][:3])      # trim tones: [shade, mid, lit]
    g = sel
    up = ~shift(g, -1, 0, False)
    right = ~shift(g, 0, 1, False)
    down = ~shift(g, 1, 0, False)
    left = ~shift(g, 0, -1, False)
    sc = up.astype(int) + right.astype(int) - down.astype(int) - left.astype(int)
    litm = sel & (sc > 0)
    if cfg.get("lit_share") and nrm is not None:
        # the lit edge only where the trim turns toward the light (its top lit_share by n . L), so a
        # band's lit row and shade row have different lengths (no hugging pair, PX-N02) and the
        # trim reads as wrapping round the form
        L = np.array(cfg.get("light", light), float)
        L /= np.linalg.norm(L)
        v = (nrm * L).sum(-1)
        if litm.any():
            t = float(np.quantile(v[litm], 1 - cfg["lit_share"]))
            litm &= v >= t
    code[sel & (sc > 0)] = mid_
    code[litm] = lit
    code[sel & (sc == 0)] = mid_
    code[sel & (sc < 0)] = shade
    n_glint = 0
    if cfg.get("spec") and not np.isnan(ex[..., 2]).all():
        _, comps = components(sel, N8)
        spf = np.nan_to_num(ex[..., 2])
        for pix in comps:
            cand = [(spf[y, x], -y, x) for y, x in pix if code[y, x] == lit and spf[y, x] > 0.5]
            if len(pix) >= cfg.get("glint_min", 4) and cand:
                _, ny, x = max(cand)
                code[-ny, x] = CIDX[cfg["spec"]]
                n_glint += 1
    return {"px": int(sel.sum()), "lit": int((sel & (sc > 0)).sum()), "mid": int((sel & (sc == 0)).sum()),
            "shade": int((sel & (sc < 0)).sum()), "glints": n_glint}


def apply(P, meta, alpha, mat, code, part, n, d, ex, CIDX, MID, BYID):
    """P = the preset. Rewrites code in place for the preset's materials."""
    if ex is None or np.isnan(ex[..., 0][alpha]).all():
        print("shade: no light pass in this render (render with --passes ...,light,depth2); skipped")
        return
    px = meta["px"]
    k = px / 144.0
    if P.get("by_size", {}).get(str(px)):
        # round 2b: per-size overrides (the 80 px world render reads a smaller share of shadow on white
        # as grey), deep-merged over the preset
        def _merge(a_, b_):
            out = dict(a_)
            for kk, vv in b_.items():
                out[kk] = _merge(out[kk], vv) if isinstance(vv, dict) and isinstance(out.get(kk), dict) else vv
            return out
        P = _merge(P, P["by_size"][str(px)])
    ppm = meta["ppm"]          # sprite px per metre (render.setup_shot: ppm = px / H_rest)
    parts = meta.get("parts", {})
    skip_parts = {parts[p] for p in P.get("skip_parts", []) if p in parts}
    limb = np.nan_to_num(ex[..., 4]).astype(np.int32) if ex.shape[-1] > 4 else np.zeros(alpha.shape, np.int32)
    report = {}
    nd = gold_drop(P, meta, alpha, mat, code, part, limb, MID)
    if nd:
        report["gold_drop"] = nd
    ao = np.nan_to_num(ex[..., 1], nan=1.0)
    dfine = ex[..., 3]
    dfine = np.where(np.isnan(dfine) | (dfine > 1e8), d, dfine)
    base = mat * 256 + part
    lab = base * 32 + limb if P.get("split_limb") else base
    if P.get("split_limb"):
        allsel = alpha & np.isin(mat, [MID[nm] for nm in P["materials"] if nm in MID])
        lab = merge_small_regions(lab, allsel, base, max(4, int(round(P.get("min_limb_px", 24) * k * k))))
    Lk = np.array(P.get("light", meta["light_cam"]), float)
    # cast shadows once for all receivers (any opaque pixel can occlude)
    cs = P.get("cast", {})
    recv_all = np.zeros(alpha.shape, bool)
    for name in P["materials"]:
        if name in MID:
            recv_all |= alpha & (mat == MID[name])
    recv_all &= ~np.isin(part, list(skip_parts))
    Lc = np.array(cs.get("light", P.get("light", meta["light_cam"])), float)
    Lc /= np.linalg.norm(Lc)
    if cs.get("on", True):
        # an occluder is any opaque pixel; with "other_form" it must be another form (not self-shadow)
        olab = None
        if cs.get("other_form"):
            olab = np.where(alpha, lab, -1)
        occ_ok = None
        if cs.get("ignore_mats"):
            # round 2b: thin flush straps (the gold harness on the glutes) cast no shadow: their casts
            # cut the skin into blotches beside every strap
            occ_ok = alpha & ~np.isin(mat, [MID[m] for m in cs["ignore_mats"] if m in MID])
        if cs.get("occluders"):
            # round 2b (critique 14e): designed casts only, from the listed materials and limbs (hair on
            # the face, the bodice and bust on the midriff, arms on the torso, the tabard on the thighs);
            # a thigh on the other thigh or a glute on a thigh (the back view) made blotches, not form
            oc = cs["occluders"]
            ok = alpha & (np.isin(mat, [MID[m] for m in oc.get("mats", []) if m in MID])
                          | np.isin(limb, [LIMB_ID[x] for x in oc.get("limbs", []) if x in LIMB_ID]))
            occ_ok = ok if occ_ok is None else (occ_ok & ok)
        csh, cdist = cast_shadow(alpha, dfine, recv_all, ppm, Lc, max(1, int(round(cs.get("max_px", 8) * k))),
                                 cs.get("bias", 0.012), olab, occ_ok)
        if cs.get("min_px"):
            # a cast smaller than min_px (at 144) is a speck, not a shape
            _, comps = components(csh)
            for pix in comps:
                if len(pix) < max(2, int(round(cs["min_px"] * k * k))):
                    for y, x in pix:
                        csh[y, x] = False
    else:
        csh, cdist = np.zeros(alpha.shape, bool), np.zeros(alpha.shape, np.int32)
    for name, cfg in P["materials"].items():
        if name not in MID:
            continue
        sel = alpha & (mat == MID[name]) & ~np.isin(part, list(skip_parts))
        own_skip = {v for pn, v in parts.items() for pat in cfg.get("skip_parts", [])
                    if pn == pat or (pat.endswith("*") and pn.startswith(pat[:-1]))}
        sel &= ~np.isin(part, list(own_skip))
        if not sel.any():
            continue
        if cfg.get("mode") == "trim":
            report[name] = trim(cfg, alpha, mat, code, part, sel, ex, CIDX, MID, k, n, P.get("light", meta["light_cam"]))
            continue
        if cfg.get("mode") == "trim2":
            if cfg.get("small"):
                sm = dict(cfg["small"])
                sm["_on_mats"] = [MID[m] for m in sm.get("on", ["skin", "white", "stocking"]) if m in MID]
                sm["_never_parts"] = [v for pn, v in parts.items()
                                      if any(pn == q or (q.endswith("*") and pn.startswith(q[:-1]))
                                             for q in sm.get("never_parts", ["head", "glaive*"]))]
                cfg = dict(cfg, small=sm)
            report[name] = trim2(cfg, alpha, mat, code, part, sel, ex, CIDX, k, Lk)
            continue
        tones = cfg["tones"]                      # [deep, shadow, lit, highlight]
        L = np.array(cfg.get("light", P.get("light", meta["light_cam"])), float)
        L /= np.linalg.norm(L)
        nn = region_blur(n.astype(np.float64), lab, sel, cfg.get("sigma", 1.5) * k)
        nn /= np.linalg.norm(nn, axis=-1, keepdims=True) + 1e-9
        val = np.clip((nn * L).sum(-1), 0, 1) * np.power(np.clip(ao, 0, 1), cfg.get("ao_pow", 1.0))
        val = region_blur(val, lab, sel, cfg.get("val_sigma", 0.0) * k)
        if DEBUG:
            from PIL import Image
            os.makedirs(DEBUG, exist_ok=True)
            Image.fromarray((np.clip(val, 0, 1) * 255 * sel).astype(np.uint8)).save(os.path.join(DEBUG, f"val_{name}.png"))
            Image.fromarray((csh * 255).astype(np.uint8)).save(os.path.join(DEBUG, "cast.png"))
        idx = np.full(alpha.shape, 2, np.int32)   # 0 deep, 1 shadow, 2 lit, 3 highlight
        no_cast = np.zeros(alpha.shape, bool)     # forms whose limb override says "cast": false
        shares = []
        forms = []                                # round 3: (region mask, its settings) for sub_bands
        sfield = np.full(alpha.shape, np.nan)     # round 3: cylinder limbs' position along their axis
        pname = {v: k_ for k_, v in parts.items()}
        split = bool(P.get("split_limb"))
        far_limbs = set()
        if cfg.get("far") and split:
            # round 3 (ref 04: the far thigh sits a whole step darker than the near one; critique 14: thigh on
            # thigh): of each limb pair, the one farther from the camera (mean fine depth of its pixels in this
            # material) takes the "far" overrides (a bigger shadow share), so value separates the overlap
            lbm = {}
            for a_, b_ in ((4, 5), (6, 7), (10, 11), (12, 13), (16, 17), (18, 19)):
                dd = {}
                for l_ in (a_, b_):
                    mm = sel & (limb == l_)
                    if mm.sum() >= 8:
                        dd[l_] = float(np.median(dfine[mm]))
                if len(dd) == 2 and abs(dd[a_] - dd[b_]) > cfg["far"].get("min_dz", 0.02):
                    far_limbs.add(a_ if dd[a_] > dd[b_] else b_)
        for r in np.unique(lab[sel]):
            rs = sel & (lab == r)
            rc = dict(cfg)
            rb = int(r) // 32 if split else int(r)
            rc.update(cfg.get("parts", {}).get(pname.get(rb % 256, ""), {}))
            if split:
                lname = LIMB_NAMES.get(int(r) % 32, "")
                for pat, o in cfg.get("limbs", {}).items():
                    if limb_match(lname, [pat]):
                        rc.update(o)
                if int(r) % 32 in far_limbs:
                    rc.update({kk: vv for kk, vv in cfg["far"].items() if kk != "min_dz"})
                    rc.update(rc.get("far_limb", {}))
            if rs.sum() < rc.get("min_region", 6):
                continue
            vr = val
            lens_m = None
            if rc.get("fit") == "cyl":
                f, lens_m = cyl_fit(rs, L, rc, k, sout=sfield)
                if DEBUG:
                    CYL_DBG.setdefault(name, np.zeros(rs.shape))[rs] = f[rs]
                mix = rc.get("fit_mix", 1.0)
                vr = val * (1 - mix) + f * mix
            if rc.get("fit") in ("plane", "quad"):
                f = fit_value(val, rs, rc["fit"], rc.get("tilt", 0.0), rc.get("lean", 0.0))
                mix = rc.get("fit_mix", 1.0)
                vr = val * (1 - mix) + f * mix
            v = vr[rs]
            t = float(np.quantile(v, rc.get("share", 0.35)))
            t = min(max(t, rc.get("t_min", 0.2)), rc.get("t_max", 0.6))
            if rc.get("max_share"):
                # a form that mostly faces away still keeps its lit side (the refs' skin is a lit mass
                # with shadow shapes, not the reverse): the terminator never passes this quantile
                t = min(t, float(np.quantile(v, rc["max_share"])))
            if rc.get("min_share"):
                # round 2: a form that the designed light hits everywhere (the veil's back in N2) still
                # turns: at least min_share of it sits in shadow, so it never reads as a flat slab
                t = max(t, float(np.quantile(v, rc["min_share"])))
            ri = np.where(vr >= t, 2, 1)
            if lens_m is not None and rc.get("lens"):
                hm = lens_m & rs & (ri == 2)
                if rc.get("hi_inset"):
                    hm &= ~edge_dist(rs, lab, int(rc["hi_inset"]))
                ri = np.where(hm, 3, ri)
            elif rc.get("hi") is not None:
                lit = val[rs][v >= t]
                # the highlight is the top hi_share of the region's lit pixels, at least hi_gap over the
                # terminator; hi_abs also keeps it above the absolute value hi (a glint, not a plane)
                th = max(float(np.quantile(lit, 1 - rc.get("hi_share", 0.1))), t + rc.get("hi_gap", 0.08))                     if lit.size else 9
                if rc.get("hi_abs"):
                    th = max(th, rc["hi"])
                hm = (val >= th) & (ri == 2)
                if rc.get("hi_inset"):
                    hm &= ~edge_dist(rs, lab, int(rc["hi_inset"]))
                ri = np.where(hm, 3, ri)
            idx[rs] = ri[rs]
            if rc.get("bands"):
                forms.append((rs, rc))
            shares.append(float((ri[rs] <= 1).mean()))
            if rc.get("cast") is False:
                no_cast |= rs
        # cast shadow (receivers of this material); the first contact_px next to the occluder go deep
        if cfg.get("cast", True):
            c = sel & csh & ~no_cast
            if cfg.get("cast_max_px"):
                c &= cdist <= max(1, int(round(cfg["cast_max_px"] * k)))
            idx[c & (idx >= 2)] = 1
            cp = cfg.get("contact_px", 1)
            if cp > 0:
                idx[c & (cdist > 0) & (cdist <= max(1, int(round(cp * k))))] = 0
        if cfg.get("ao_deep") is not None:
            idx[sel & (ao < cfg["ao_deep"])] = 0
        if cfg.get("deep_thick"):
            # the deep tone only as shapes >= 2 px thick (contact and cast), never a 1 px strip (PX-P13)
            dm = sel & (idx == 0)
            idx[dm & ~thick_mask(dm, lab)] = 1
        # clusters
        majority(idx, sel, lab, cfg.get("majority", 1))
        merge_small(idx, sel, lab, max(2, int(round(cfg.get("min_px", 4) * k * k))), keep=(3,))
        thin = thin_to_lit(idx, sel, lab, 1) if cfg.get("no_thin", True) else 0
        merge_small(idx, sel, lab, max(2, int(round(cfg.get("min_px", 4) * k * k))), keep=(3,))
        # highlight clusters: at most hi_max px each (a glint, not a band)
        if cfg.get("hi_max") or cfg.get("hi_min"):
            hl, comps = components(sel & (idx == 3), N8)
            for pix in comps:
                if (cfg.get("hi_max") and len(pix) > cfg["hi_max"] * max(1, k * k)) or len(pix) < cfg.get("hi_min", 1):
                    for y, x in pix:
                        idx[y, x] = 2
        if cfg.get("deep_thick"):
            dm = sel & (idx == 0)
            idx[dm & ~thick_mask(dm, lab)] = 1
        if cfg.get("thin_tone"):
            # 1 px slivers of the material (a veil seen edge-on beside the hair, >= 3 px long) take one
            # tone: a lit 1 px sliver of a light material beside a dark one reads as a halo (PX-N08)
            # a sliver: pixels in no 2x2 block of their form, in 8-connected runs of >= 3 (straight or
            # diagonal)
            sl = sel & ~thick_mask(sel, lab)
            _, comps = components(sl, N8)
            tt = cfg["thin_tone"]
            on_edge = sel & (shift(~alpha, 0, 1, True) | shift(~alpha, 0, -1, True) | shift(~alpha, 1, 0, True) | shift(~alpha, -1, 0, True))
            for pix in comps:
                if len(pix) >= 3:
                    for y, x in pix:
                        if cfg.get("thin_edge_erase") and on_edge[y, x]:
                            # a 1 px sliver on the silhouette (the veil's edge beside the hair) goes: the
                            # outline then sits on the hair; kept, it doubled the outline (PX-N13)
                            alpha[y, x] = False
                            sel[y, x] = False
                        else:
                            idx[y, x] = TONE_IDX[tt]
        fold_m = np.zeros(idx.shape, bool)
        for F in P.get("folds", []):
            if F.get("mat") == name and meta["px"] >= F.get("min_size", 0):
                fold_m |= folds(F, meta, alpha, part, idx, sel, lab)
        hem_m = np.zeros(idx.shape, bool)
        if cfg.get("hem"):
            hem_m = hem_bands(cfg["hem"], sel, idx, alpha, mat, part, d, MID, k, limb=limb)
        welt_m = np.zeros(idx.shape, bool)
        if cfg.get("welt") and "skin" in MID:
            # round 2b (critique 14c): the stocking's top band is darker where it grips the thigh, and the
            # skin just over it catches a 1 px lip of light (the flesh overhang)
            W_ = cfg["welt"]
            skin_m = alpha & (mat == MID["skin"])
            above = alpha & np.isin(mat, [MID[m] for m in W_.get("from", ["skin"]) if m in MID])
            wp = max(1, int(round(W_.get("px", 2) * k)))
            for j in range(1, wp + 1):
                run = np.ones_like(sel)
                for i in range(1, j):
                    run &= shift(sel, -i, 0, False)
                welt_m |= sel & run & shift(above, -j, 0, False)
            idx[welt_m] = TONE_IDX[W_.get("tone", "deep")]
            if W_.get("lip") and (meta["px"] >= W_.get("lip_min_size", 0)):
                lip = skin_m & shift(sel, 1, 0, False) & (part != parts.get("head", -1))
                lip &= np.isin(code, [CIDX[c] for c in W_.get("lip_on", ["S2", "S3"]) if c in CIDX])
                code[lip] = CIDX[W_["lip"]]
        painted = paint(P, meta, name, idx, sel) | fold_m | hem_m | welt_m
        if cfg.get("anti_hug", True):
            hugs = anti_hug(idx, sel, lab, cfg.get("anti_hug_passes", 2), frozen=painted)
        else:
            hugs = 0
        codes = np.array([CIDX[t] for t in tones])
        code[sel] = codes[idx[sel]]
        n_trans = n_core = 0
        if forms:
            # round 3: lit / terminator / core / bounce on the shadow side of each form (sub_bands); casts
            # keep their sharp edge (no band beside a cast), painted strokes stay as painted
            keep = painted | (sel & csh) if cfg.get("cast", True) else painted
            for rs, rc in forms:
                B = rc["bands"]
                tr, co = sub_bands(B, idx, rs, lab, k, sfield if rc.get("fit") == "cyl" else None, keep)
                if B.get("trans_tone") and tr.any():
                    code[tr] = CIDX[B["trans_tone"]]
                    n_trans += int(tr.sum())
                if B.get("core_tone") and co.any():
                    code[co] = CIDX[B["core_tone"]]
                    n_core += int(co.sum())
        if DEBUG:
            from PIL import Image
            Image.fromarray(((idx + 1) * 60 * sel).astype(np.uint8)).save(os.path.join(DEBUG, f"idx_{name}.png"))
        # the render's spec band (gold glint, stocking sheen, boot gloss) survives on lit pixels, in
        # the material's spec code, as clusters of at most spec_max px (a streak, not a band)
        if cfg.get("spec") and not np.isnan(ex[..., 2]).all():
            sp = sel & (np.nan_to_num(ex[..., 2]) > 0.5) & (idx >= 2)
            _, comps = components(sp, N8)
            smax = cfg.get("spec_max", 0)
            for pix in comps:
                if len(pix) < cfg.get("spec_min", 1):
                    continue                     # a lone spec pixel reads as a speck, not a gloss
                if smax and len(pix) > smax * max(1, k):
                    # keep the part of the streak nearest the light (the top of it)
                    pix = sorted(pix)[:int(smax * max(1, k))]
                for y, x in pix:
                    code[y, x] = CIDX[cfg["spec"]]
        if name == "skin" and P.get("head"):
            report["head"] = head_pass(P["head"], meta, alpha, mat, code, part, limb, CIDX, MID, Lk)
        report[name] = {"px": int(sel.sum()), "shadow_share": round(float(np.mean(shares)), 2) if shares else None,
                        "folds": int(fold_m.sum()),
                        "cast": int((sel & csh).sum()), "thin_lifted": thin, "hugs_broken": hugs,
                        "painted": int(painted.sum()), "trans": n_trans, "core": n_core,
                        "tones": {t: int((code[sel] == CIDX[t]).sum()) for t in dict.fromkeys(tones)}}
    print("shade:", report)
    return report


def post_face(still_dir, spec):
    """round 3 (critique 14: "no hair shadow on the forehead or cheek"): run after the override layer's face
    stamp, on the composited still.png (palette.json hexes, before the preset's remap). On the head's skin,
    lit pixels (spec "lit", S2) take the cast tone ("tone", S3) when hair sits 1..fringe_px rows straight
    above them or one column toward the light above them (the fringe's cast, FC-P16), or 1..side_px columns
    toward the key light on the same row (a sidelock's cast on the cheek, falling away from the light).
    Never on or beside (8 directions) a feature pixel the stamp drew (any head-skin pixel whose colour is
    not a skin shading tone: lash, iris, brow, mouth, blush), and clusters under min_px are dropped (no
    speck, FC-N15). Returns the number of pixels changed."""
    import json
    from PIL import Image
    meta = json.load(open(os.path.join(still_dir, "meta.json")))
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    pal = json.load(open(os.path.join(root, "art", "rosace", "palette.json"), encoding="utf-8"))["colors"]
    rgb = {c: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for c, h in pal.items()}
    sp = os.path.join(still_dir, "still.png")
    im = np.array(Image.open(sp).convert("RGBA"))
    idm = np.asarray(Image.open(os.path.join(still_dir, "noface_id.png")).convert("RGBA"))
    H, W = im.shape[:2]
    a = im[..., 3] > 0
    fig = idm[..., 3] > 0
    mats = {n: m["id"] for n, m in meta["materials"].items()}
    parts = meta.get("parts", {})
    if "skin" not in mats or "head" not in parts:
        return 0

    def is_code(c):
        r, g, b = rgb[c]
        return a & (im[..., 0] == r) & (im[..., 1] == g) & (im[..., 2] == b)
    head = fig & (idm[..., 0] == mats["skin"]) & (idm[..., 1] == parts["head"])
    shading = np.zeros_like(head)
    for c in spec.get("skin_tones", ["S1", "S2", "S3"]):
        shading |= is_code(c)
    feature = head & ~shading
    near_feat = feature.copy()
    for dy, dx in N8:
        near_feat |= shift(feature, dy, dx, False)
    lit = head & is_code(spec.get("lit", "S2")) & ~near_feat
    hair = fig & np.isin(idm[..., 0], [mats[n] for n in ("hair", "hairtip") if n in mats])
    hair &= ~(is_code("OL"))                         # a lash drawn over the fringe is not hair
    sx = 1 if meta["light_cam"][0] > 0 else -1       # toward the key light (screen x)
    k = meta["px"] / 144.0
    fp = max(1, int(round(spec.get("fringe_px", 2) * max(k, 0.75))))
    cast = np.zeros_like(head)
    for d in range(1, fp + 1):
        cast |= shift(hair, -d, 0, False) | shift(hair, -d, sx, False)
    for d in range(1, max(0, int(round(spec.get("side_px", 1) * max(k, 0.75)))) + 1):
        cast |= shift(hair, 0, sx * d, False)
    if spec.get("rows_max") is not None:
        ys = np.nonzero(head)[0]
        if len(ys):
            cast &= np.arange(H)[:, None] <= ys.min() + spec["rows_max"] * k
    cast &= lit
    _, comps = components(cast, N8)
    for pix in comps:
        if len(pix) < spec.get("min_px", 2):
            for y, x in pix:
                cast[y, x] = False
    im[cast, :3] = rgb[spec.get("tone", "S3")]
    Image.fromarray(im).save(sp)
    return int(cast.sum())


def dejag(P, meta, alpha, mat, code, part, n, d, EX, MID):
    """both axes: near-vertical contours as they are, near-horizontal ones on the transposed arrays (views,
    so the edits land in place)"""
    c = _dejag_axis(P, meta, alpha, mat, code, part, n, d, EX, MID)
    if P.get("dejag", {}).get("both_axes", True) and EX is not None:
        c += _dejag_axis(P, meta, alpha.T, mat.T, code.T, part.T, n.transpose(1, 0, 2), d.T, EX.transpose(1, 0, 2), MID)
    return c


def _dejag_axis(P, meta, alpha, mat, code, part, n, d, EX, MID):
    """round 3 (critique 16, lospec-outlines / FC-N28's curve rule for the figure): on the long near-vertical
    contours of the legs (skin and stocking pixels of the thigh and shin limbs), a run of 1 row between two
    longer runs stepping the same way (2-1-3) is a jaggy: the longer neighbour gives it one row (2-2-2), so
    runs change steadily. The edge moves by one pixel on that row: outward copies the edge pixel's labels,
    inward clears it. Runs in place on alpha, mat, code, part, n, d and the lane passes. Returns the rows
    changed."""
    cfg = P.get("dejag")
    if not cfg or EX is None or EX.shape[-1] < 5:
        return 0
    mids = [MID[m] for m in cfg.get("mats", ["skin", "stocking"]) if m in MID]
    lids = [LIMB_ID[x] for x in cfg.get("limbs", ["thigh_L", "thigh_R", "shin_L", "shin_R"]) if x in LIMB_ID]
    limb = np.nan_to_num(EX[..., 4]).astype(np.int32)
    H, W = alpha.shape
    changed = 0
    for side in (-1, 1):                      # -1: left contours (outside is x - 1), 1: right
        edge = alpha & ~shift(alpha, 0, side, False)
        ok_edit = edge & np.isin(mat, mids) & np.isin(limb, lids)     # a strap crossing the edge keeps the chain
        used = np.zeros_like(edge)
        for y0, x0 in sorted(zip(*np.nonzero(edge))):
            if used[y0, x0]:
                continue
            chain, y, x = [], y0, x0
            while True:
                chain.append((y, x))
                used[y, x] = True
                nxt = [(y + 1, x + dx) for dx in (0, -1, 1) if 0 <= x + dx < W and y + 1 < H
                       and edge[y + 1, x + dx] and not used[y + 1, x + dx]]
                if not nxt:
                    break
                y, x = nxt[0]
            if len(chain) < cfg.get("min_rows", 8) or not any(ok_edit[c] for c in chain):
                continue
            xs = [c[1] for c in chain]
            runs = []
            for i, xv in enumerate(xs):
                if runs and runs[-1][0] == xv:
                    runs[-1][2] += 1
                else:
                    runs.append([xv, i, 1])
            for j in range(1, len(runs) - 1):
                a_, b_, c_ = runs[j - 1], runs[j], runs[j + 1]
                if b_[2] != 1 or a_[2] < 2 or c_[2] < 2:
                    continue
                s1, s2 = b_[0] - a_[0], c_[0] - b_[0]
                if abs(s1) != 1 or s1 != s2:
                    continue
                # the longer neighbour gives one row: its row next to the blip moves to the blip's x
                if c_[2] >= a_[2]:
                    ri, newx = c_[1], b_[0]
                else:
                    ri, newx = a_[1] + a_[2] - 1, b_[0]
                yy, oldx = chain[ri]
                if newx == oldx or not ok_edit[yy, oldx]:
                    continue
                outward = (newx - oldx) == side
                if outward:
                    if alpha[yy, newx]:
                        continue
                    for arr in (mat, code, part, n, d):
                        arr[yy, newx] = arr[yy, oldx]
                    EX[yy, newx] = EX[yy, oldx]
                    alpha[yy, newx] = True
                else:
                    if not alpha[yy, newx] or mat[yy, newx] != mat[yy, oldx]:
                        continue
                    alpha[yy, oldx] = False
                changed += 1
    return changed
