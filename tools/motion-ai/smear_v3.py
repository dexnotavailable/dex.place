"""Tracked blade smears, v3 (round 3c). smear.py dispatches here when a sheet's smear section has "_v": 3.

The r3b critics on v2: N1's J read as an L-shaped hockey stick (a hard ~90 deg corner, a stair-stepped vertical right
edge, four flat parallel stripe bands, a 56 px head where MOVESET asks 12 px at 96 = 18 px at 144, a belly dipping under
the ground line); N5's S2 was a straight-cut trapezoid slab that swallowed her legs; S3's crescent floated under the
glaive; the ellipse flickered (whole on S2, gone on S3, whole again on C1) and then hung as a static hoop for ~7 ticks.
Asked for: tapered crescents with a thin A5 leading edge, a 2-3 value body fading toward the tail, a pointed head, one
continuous curve, an inner speed line, a translucent body so hers reads through it (ref 10), and a decay over 2-3
drawings.

What v3 draws (every point comes from the blades blender_apply.py --hero recorded for each rendered image):

  path, 'J' (N1)   one curve in 3D: a straight run along the floor from the tail (the 'from' drawing's tracked tip,
                   behind her) to a belly point on the floor just in front of her feet (this drawing's hips, moved
                   toward the camera), then a quadratic that leaves the floor tangent to that run and rises into the
                   head ('lead' of the way from this drawing's tracked tip to the next drawing's). The control point
                   sits on the floor line past the head by 'hook' H, so the head curls back toward her: a J, no corner.
                   The outer (cutting) edge is clamped to the ground line (the pivot's screen row).
  path, 'flat'     the tip's circle round this drawing's hips: from 'start_yaw' (world azimuth, turning +) to the
                   head, 'lead' of the way on from this drawing's tracked tip toward the next one (0 = on the solid
                   blade's tip, N5 S3). Radius and height are the head's (the tracked tip there); 'follow' blends in
                   the from-drawing's reach toward the tail.
  band             the outer edge is the path; the inner edge is offset in screen space toward the curve's inside
                   (for the J toward her hips, for the ellipse toward its centre) by the profile below, so the edges
                   are smooth curves, not a slab between blade chords.
  profile          thickness(age) (age 0 = head, 1 = tail): rises from a 1.5 px point to 'thick' px at age 'peak',
                   then falls as ((1 - age) / (1 - peak))^1.5 to a 1 px tail. A crescent with a pointed head.
  colour           ALONG the stroke, not across it: A4 at the head, A3 to 50%, A2 to 80%, A1 at the tail; a thin A5
                   leading edge on the outer rim (1.2 px; 2 px 'bright') over the front 60%, A4 behind that; an inner
                   speed line (1 px A5 at 60% across) over the front half ('speed_line'). Behind her hips (camera
                   depth) one step dimmer (MOVESET 0.10); 'dim' darkens everything.
  translucency     where the band's body crosses her (depth-tested nearer than her), only every other pixel is
                   drawn (a 50% checker), so her legs read through; the rim and speed line stay solid.
  ring             'ring': a fraction of the tip's full circle (0-1), drawn back from the head: 2 px A3 on the front
                   half, 1 px A2 on the back half (MOVESET "whole ellipse"). N5: S2 1.0, S3 0.8, C1 0.55 -> 0.3.
  keep, same_as    'keep' < 1 draws only the head end of the path (the tail eaten; it re-tapers); 'same_as' draws another
                   smear drawing's path, so N1's C1 carries a thinner, dimmer remnant of S1's J (MOVESET 0.6: the full
                   smear, then a decaying one; the leaded cells themselves are VFX and not drawn).
  fade             per image of a held drawing, by frame offset from its first frame: {"0": {}, "2": {...}} overrides
                   (thick, ring, dim, start_yaw) or {"gone": true}, so C1 / C1b decay instead of holding a hoop.
  slivers          'slivers': two 1 px gold arcs (G1, G2) 3 and 6 px outside the head (MOVESET N1 slivers).
  glaive           'hide_glaive': the solid glaive is left out of the render (blender_apply.py) and drawn bent from
                   the hands into the head (smear_v2.bent_glaive).
  pixels           4x raster, downsampled by coverage (>= 50%) and the most common label; isolated pixels removed.
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from smear import A, H_PX, V, body_depth, clean, cyl, dang, drawing_frames, project, uncyl
from smear_v2 import bent_glaive

SS = 4
N_S = 240
RAMP = ["A1", "A2", "A3", "A4", "A5"]
GOLD = {"G1": (0xec, 0xc9, 0x6f), "G2": (0xd1, 0xa4, 0x52)}
FLOOR = 0.012


def prof(age, peak):
    a = np.clip(age, 0.0, 1.0)
    up = np.clip(a / max(peak, 1e-3), 0.0, 1.0) ** 0.55
    dn = np.clip((1.0 - a) / max(1.0 - peak, 1e-3), 0.0, 1.0) ** 1.5
    return np.where(a < peak, up, dn)


def resample(P, n):
    """evenly by 3D arc length"""
    P = np.asarray(P, float)
    s = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))])
    t = np.linspace(0.0, s[-1], n)
    return np.stack([np.interp(t, s, P[:, k]) for k in range(3)], 1)


def path_J(meta, Ab, Bb, Cb, sp, Hm):
    tail = V(Ab["tip"]).copy()
    tail[2] = FLOOR
    head = V(Bb["tip"]) + float(sp.get("lead", 0.9)) * (V(Cb["tip"]) - V(Bb["tip"]))
    cam_h = V(meta["cam"]["fwd"]).copy()
    cam_h[2] = 0.0
    cam_h /= np.linalg.norm(cam_h)
    belly = V(Bb["hips"]).copy()
    belly[2] = FLOOR
    belly = belly - cam_h * float(sp.get("belly_cam", 0.3))
    run = belly - tail
    run[2] = 0.0
    u = run / (np.linalg.norm(run) + 1e-9)
    hh = head - belly
    d = max(0.1, float(hh[:2] @ u[:2])) + float(sp.get("hook", 0.15)) * Hm
    q = belly + u * d
    q[2] = FLOOR
    seg1 = [tail + (belly - tail) * k / 60.0 for k in range(60)]
    seg2 = [(1 - t) ** 2 * belly + 2 * t * (1 - t) * q + t ** 2 * head for t in np.linspace(0, 1, 120)]
    P = resample(seg1 + seg2, N_S)
    P[:, 2] = np.maximum(P[:, 2], FLOOR)
    return P, V(Bb["hips"])


def path_flat(Ab, Bb, Cb, sp):
    c = V(Bb["hips"])
    ra, aa, za = cyl(V(Ab["tip"]), c)
    rb, ab, zb = cyl(V(Bb["tip"]), c)
    rc, ac, zc = cyl(V(Cb["tip"]), c)
    lead = float(sp.get("lead", 0.0))
    head_az = ab + lead * dang(ab, ac, 1)
    head_r, head_z = rb + lead * (rc - rb), zb + lead * (zc - zb)
    s0 = float(sp.get("start_yaw", aa))
    s0 = head_az - ((head_az - s0) % 360.0)          # unwrap below the head, turning +
    a_from = head_az - ((head_az - aa) % 360.0)
    azs = np.linspace(s0, head_az, N_S)
    pts = []
    for az in azs:
        # one circle at the head's reach and height (a tail at the from-drawing's shorter reach drew a second,
        # inner arc beside the ring); 'follow' > 0 lets the radius follow the tracked tips instead
        f = 0.0 if az <= a_from else (az - a_from) / max(1e-6, head_az - a_from)
        f = 1.0 - float(sp.get("follow", 0.0)) * (1.0 - min(1.0, f))
        r = ra + (head_r - ra) * f
        z = za + (head_z - za) * f
        pts.append(uncyl(r, az, z, c))
    return np.array(pts), c, (head_r, head_z)


def screen(meta, P):
    return np.array([project(meta, p) for p in P])


def band_quads(S, centre2, thick_px, peak, ground_y=None):
    """outer screen points S (N,3: x, y, depth), inner offset toward centre2 by the profile. Returns outer, inner (N,2),
    age (N,), thickness (N,)"""
    xy = S[:, :2].copy()
    if ground_y is not None:
        xy[:, 1] = np.minimum(xy[:, 1], ground_y)
    seg = np.linalg.norm(np.diff(xy, axis=0), axis=1)
    cum = np.concatenate([[0.0], np.cumsum(seg)])
    age = (cum[-1] - cum) / max(cum[-1], 1.0)
    tan = np.gradient(xy, axis=0)
    tan /= np.linalg.norm(tan, axis=1, keepdims=True) + 1e-9
    nrm = np.stack([-tan[:, 1], tan[:, 0]], 1)
    toc = centre2[None, :] - xy if centre2.ndim == 1 else centre2 - xy
    sgn = np.sign((nrm * toc).sum(1))
    sgn[sgn == 0] = 1
    # one side for the whole stroke where possible (the J's inside flips nowhere): smooth the sign
    k = 9
    sm = np.convolve(sgn, np.ones(k) / k, mode="same")
    sgn = np.where(sm >= 0, 1.0, -1.0)
    nrm = nrm * sgn[:, None]
    th = np.maximum(1.0, thick_px * prof(age, peak))
    inner = xy + nrm * th[:, None]
    return xy, inner, age, th


def raster(outer, inner, age, z, back, W, H, K=8):
    Ws, Hs = W * SS, H * SS
    imgs = {k: Image.new("F", (Ws, Hs), v) for k, v in (("age", 1e6), ("acr", -1.0), ("z", 1e9), ("back", 0.0))}
    dr = {k: ImageDraw.Draw(v) for k, v in imgs.items()}
    lanes = np.linspace(0.0, 1.0, K + 1)
    n = len(outer)
    order = np.argsort(-age)                         # oldest first; newer overwrite
    for i in order:
        if i >= n - 1:
            continue
        j = i + 1
        for L in range(K):
            r0, r1 = lanes[L], lanes[L + 1]
            q = [outer[i] + (inner[i] - outer[i]) * r0, outer[i] + (inner[i] - outer[i]) * r1,
                 outer[j] + (inner[j] - outer[j]) * r1, outer[j] + (inner[j] - outer[j]) * r0]
            poly = [(float(x) * SS, float(y) * SS) for x, y in q]
            dr["age"].polygon(poly, fill=float(0.5 * (age[i] + age[j])))
            dr["acr"].polygon(poly, fill=float(0.5 * (r0 + r1)))
            dr["z"].polygon(poly, fill=float(0.5 * (z[i] + z[j])))
            dr["back"].polygon(poly, fill=float(1.0 if (back[i] and back[j]) else 0.0))
    return {k: np.asarray(v).copy() for k, v in imgs.items()}


def labels(buf, thick, peak, dim=0, bright=False, speed=False):
    """-> (body labels, solid labels) at 4x; RAMP index, -1 empty"""
    age, acr, back = buf["age"], buf["acr"], buf["back"]
    have = (acr >= 0) & (age < 1e5)
    th = np.maximum(1.0, thick * prof(age, peak))
    body = np.full(age.shape, -1, np.int16)
    body[have] = 0
    body[have & (age < 0.8)] = 1
    body[have & (age < 0.5)] = 2
    body[have & (age < 0.2)] = 3
    solid = np.full(age.shape, -1, np.int16)
    rim = np.clip((2.0 if bright else 1.2) / th, 0.0, 0.7)
    r = have & (acr < rim) & (age < 0.85)
    solid[r] = 3
    solid[r & (age < 0.6)] = 4
    if speed:
        s = have & (np.abs(acr - 0.6) < 0.55 / th) & (age > 0.04) & (age < 0.5) & (th > 5)
        solid[s] = 4
    for L in (body, solid):
        m = L >= 0
        L[m] -= dim
        L[m & (back > 0.5)] -= 1
        L[m] = np.maximum(L[m], 0)
    return body, solid


def ring_labels(meta, c, r, z, head_az, frac, W, H, dim, z_hips, depth):
    if frac <= 0.0:
        return None
    n = 160
    azs = head_az - np.linspace(0.0, 360.0 * frac, n)
    P = np.array([uncyl(r, a, z, c) for a in azs])
    S = screen(meta, P)
    back = np.array([depth(p) > z_hips for p in P])
    th = np.where(back, 1.1, 2.1)
    ctr = np.array(project(meta, np.array([c[0], c[1], z]))[:2])
    xy = S[:, :2]
    tan = np.gradient(xy, axis=0)
    tan /= np.linalg.norm(tan, axis=1, keepdims=True) + 1e-9
    nrm = np.stack([-tan[:, 1], tan[:, 0]], 1)
    sgn = np.sign((nrm * (ctr[None, :] - xy)).sum(1))
    sgn[sgn == 0] = 1
    inner = xy + nrm * (sgn * th)[:, None]
    age = np.linspace(0.3, 1.0, n)
    buf = raster(xy, inner, age, S[:, 2], back, W, H, K=2)
    have = buf["acr"] >= 0
    lab = np.full(have.shape, -1, np.int16)
    lab[have] = 2 - dim
    lab[have & (buf["back"] > 0.5)] -= 1
    lab[have] = np.maximum(lab[have], 0)
    return lab, buf["z"]


def downsample(lab, z, n_labels=5):
    Hs, Ws = lab.shape
    H, W = Hs // SS, Ws // SS
    L4 = lab.reshape(H, SS, W, SS).transpose(0, 2, 1, 3).reshape(H, W, SS * SS)
    Z4 = z.reshape(H, SS, W, SS).transpose(0, 2, 1, 3).reshape(H, W, SS * SS)
    cov = (L4 >= 0).sum(-1)
    counts = np.stack([(L4 == k).sum(-1) for k in range(n_labels)], -1)
    out = np.full((H, W), -1, np.int16)
    ok = cov * 2 >= SS * SS
    out[ok] = counts.argmax(-1)[ok]
    zmin = np.where(L4 >= 0, Z4, np.inf).min(-1)
    return out, zmin


def thin_line(meta, S2d, off, a0, a1, age, nrm_out, W, H):
    """a 1 px line offset outward from the outer edge by off px, over ages a0..a1 -> 1x boolean mask"""
    m = (age >= a0) & (age <= a1)
    pts = S2d[m] + nrm_out[m] * off
    img = Image.new("L", (W * SS, H * SS), 0)
    d = ImageDraw.Draw(img)
    if len(pts) > 1:
        d.line([(float(x) * SS, float(y) * SS) for x, y in pts], fill=255, width=SS)
    a = np.asarray(img).reshape(H, SS, W, SS).transpose(0, 2, 1, 3).reshape(H, W, SS * SS)
    return (a > 0).sum(-1) * 2 >= SS * SS // 2


def render_smear(meta, sp, Ab, Bb, Cb, W, H, glaive_L, base_len):
    Hm = meta["height_m"]
    cam_fwd, cam_loc = V(meta["cam"]["fwd"]), V(meta["cam"]["loc"])

    def depth(p):
        return float((p - cam_loc) @ cam_fwd)
    style = sp.get("style", "flat")
    thick = float(sp.get("thick", 16))
    peak = float(sp.get("peak", 0.14))
    dim = int(sp.get("dim", 0))
    ground_y = float(meta["anchor"][1]) if style == "J" else None
    if style == "J":
        P, c = path_J(meta, Ab, Bb, Cb, sp, Hm)
        ctr = np.array(project(meta, c + np.array([0.0, 0.0, 0.25]))[:2])
    else:
        P, c, (hr, hz) = path_flat(Ab, Bb, Cb, sp)
        ctr = np.array(project(meta, np.array([c[0], c[1], hz]))[:2])
    keep = float(sp.get("keep", 1.0))
    if keep < 1.0:                                  # a remnant: the tail eaten, the head kept (it re-tapers)
        P = P[int(len(P) * (1.0 - keep)):]
    S = screen(meta, P)
    z_hips = depth(V(Bb["hips"]))
    back = np.array([bool(sp.get("dim_back", True)) and depth(p) > z_hips + 0.08 for p in P])
    outer, inner, age, th = band_quads(S, ctr, thick, peak, ground_y)
    buf = raster(outer, inner, age, S[:, 2], back, W, H)
    body4, solid4 = labels(buf, thick, peak, dim, bool(sp.get("bright")), bool(sp.get("speed_line")))
    body1, zb1 = downsample(body4, buf["z"])
    solid1, _ = downsample(solid4, buf["z"])
    ring1 = None
    if style == "flat" and float(sp.get("ring", 0.0)) > 0:
        hc = cyl(P[-1], c)
        rl = ring_labels(meta, c, hr, hz, hc[1], float(sp["ring"]), W, H, dim, z_hips, depth)
        if rl is not None:
            ring1 = downsample(rl[0], rl[1])
    extra = []
    if sp.get("slivers"):
        tan = np.gradient(outer, axis=0)
        tan /= np.linalg.norm(tan, axis=1, keepdims=True) + 1e-9
        nrm_in = (inner - outer) / (np.linalg.norm(inner - outer, axis=1, keepdims=True) + 1e-9)
        extra.append(("G1", thin_line(meta, outer, -3.0, 0.03, 0.30, age, nrm_in, W, H)))
        extra.append(("G2", thin_line(meta, outer, -6.0, 0.07, 0.20, age, nrm_in, W, H)))
    gl = None
    if sp.get("hide_glaive"):
        gl = bent_glaive(meta, P[-1], V(Bb["butt"]), V(Bb["grip_R"]), glaive_L, base_len, W, H,
                         bend=float(sp.get("bend", 0.45)), mix=float(sp.get("bend_mix", 0.5)))
    return {"body": body1, "solid": solid1, "z": zb1, "ring": ring1, "extra": extra, "glaive": gl,
            "tip_path_px": float(np.sum(np.linalg.norm(np.diff(outer, axis=0), axis=1))),
            "head_px": [round(float(outer[-1][0]), 1), round(float(outer[-1][1]), 1)],
            "max_thick_px": round(float(th.max()), 1)}


def main_v3(px_dir, sheet_path):
    px_dir = Path(px_dir)
    meta = json.loads((px_dir / "meta.json").read_text())
    sheet = json.loads(Path(sheet_path).read_text(encoding="utf-8"))
    spec = {k: v for k, v in sheet.get("smear", {}).items() if not k.startswith("_")}
    mo = meta["motion"]
    hero = mo["hero"]
    blade = hero["blade"]
    L, base_len = hero["glaive_length"], hero["blade_base"]
    glaive_parts = [v for k, v in meta["parts"].items() if k.startswith("glaive")]
    W, H = meta["canvas"]
    report = {}
    for name, sp0 in spec.items():
        fr = drawing_frames(meta, name)
        # 'same_as': draw the path of another smear drawing (a remnant fading on the next drawing keeps the swept
        # path where it was)
        pfr = drawing_frames(meta, sp0["same_as"]) if sp0.get("same_as") else fr
        body = mo["body_sample_frame"][pfr[0]]
        src = mo["body_sample_frame"][drawing_frames(meta, sp0["from"])[0]] if sp0.get("from") else \
            mo["body_sample_frame"][pfr[0] - 1]
        nxt = next((mo["body_sample_frame"][f] for f in range(pfr[-1] + 1, len(mo["drawing"]))
                    if mo["body_sample_frame"][f] != body), body)
        Ab, Bb, Cb = blade[str(src)], blade[str(body)], blade[str(nxt)]
        first = {}
        for f in fr:
            first.setdefault(mo["sample_frame"][f], f - fr[0])
        rep = {"from_image": src, "image": body, "next_image": nxt, "style": sp0.get("style"), "images": {}}
        fade = {int(k): v for k, v in (sp0.get("fade") or {}).items()}
        for img, off in sorted(first.items()):
            sp = {k: v for k, v in sp0.items() if k != "fade"}
            if fade:
                ks = [k for k in fade if k <= off]
                if ks:
                    sp.update(fade[max(ks)])
            bpath = px_dir / f"sprite_{img:04d}_body.png"
            spath = px_dir / f"sprite_{img:04d}.png"
            if not bpath.exists():
                Image.open(spath).save(bpath)
            spr = np.asarray(Image.open(bpath).convert("RGBA")).copy()
            if sp.get("gone"):
                Image.fromarray(spr).save(spath)
                rep["images"][str(img)] = {"frame_offset": off, "gone": True}
                continue
            R = render_smear(meta, sp, Ab, Bb, Cb, W, H, L, base_len)
            idm = np.asarray(Image.open(px_dir / f"sprite_{img:04d}_id.png").convert("RGBA"))
            bd = body_depth(px_dir, meta, img, spr)
            is_glaive = np.isin(idm[..., 1], glaive_parts) & (idm[..., 3] > 0) & (spr[..., 3] > 0)
            has_body = spr[..., 3] > 0
            yy, xx = np.mgrid[0:H, 0:W]
            checker = ((xx + yy) % 2) == 0
            out = spr.copy()
            counts = {"drawn_px": 0, "dithered_px": 0, "hidden_px": 0}

            def put(lab, z, dither, cols=None):
                has = lab >= 0
                nearer = ~has_body | (z < bd - 0.03)
                vis = has & ~is_glaive & nearer
                over = vis & has_body
                if dither:
                    vis = vis & (~over | checker)
                    counts["dithered_px"] += int((over & ~checker).sum())
                counts["hidden_px"] += int((has & ~nearer).sum())
                for k in range(5):
                    m = vis & (lab == k)
                    out[m, :3] = A[RAMP[k]] if cols is None else cols
                    out[m, 3] = 255
                counts["drawn_px"] += int(vis.sum())
                return vis
            vis_all = np.zeros((H, W), bool)
            if R["ring"] is not None:
                vis_all |= put(R["ring"][0], R["ring"][1], True)
            vis_all |= put(R["body"], R["z"], True)
            vis_all |= put(R["solid"], R["z"], False)
            for gname, mask in R["extra"]:
                m = mask & ~has_body & ~(out[..., 3] > 0)
                out[m, :3] = GOLD[gname]
                out[m, 3] = 255
                counts["drawn_px"] += int(m.sum())
                vis_all |= m
            gl_px = 0
            if R["glaive"] is not None:
                g, gz = R["glaive"]
                gh = g[..., 3] > 0
                gvis = gh & (~has_body | (gz < bd - 0.02))
                out[gvis] = g[gvis]
                gl_px = int(gvis.sum())
            Image.fromarray(out).save(spath)
            cols_ = np.where(out[..., 3].max(0) > 0)[0]
            scol = np.where(vis_all.any(0))[0]
            rep["images"][str(img)] = dict(counts, frame_offset=off, bent_glaive_px=gl_px, tip_path_px=round(R["tip_path_px"], 1),
                                           max_thick_px=R["max_thick_px"], head_px=R["head_px"],
                                           span_all_H=round((cols_.max() - cols_.min() + 1) / H_PX, 2),
                                           span_smear_H=round((scol.max() - scol.min() + 1) / H_PX, 2) if len(scol) else 0)
        report[name] = rep
        print(name, json.dumps(rep))
    (px_dir / "smear.json").write_text(json.dumps(report, indent=1))
    return report
