"""Tracked blade smears, v2 (round 3b). smear.py dispatches here when a sheet's smear section has "_v": 2.

Round-3 critics: the smears read as 1-6 px wires (N5's hoop, N1's floor line plus a separate vertical bar),
the solid glaive stayed inside S2's ellipse, the J had no belly or curved head, and the edges stair-stepped.
v2 keeps the tracked 3D path (smear.py's interpolation between the rendered blades: a haft point travelling
round her hips in cylinder coordinates, the blade turning about it) and changes what is filled:

  band     each path sample has an outer point (the tip) and an inner point; the band between them is
           filled in lanes. 'J' (N1): the inner point lies toward the grip by a thickness profile (px), so the
           stretch along the floor is a belly rising off the floor and the head is thick. 'flat' (N5): the
           inner point is the blade base (the blade's own swept annulus, wide at the ellipse's ends) lowered by
           a vertical thickness 'h' (px), so the front and back of a flat sweep read as a band too.
  profile  thickness(age) = thick * (1 - age)^1.3, age 0 = the head, 1 = the tail: a thick head (ref 10: a
           crescent about a third of her height at its widest) tapering to a 1 px tail.
  colour   across the band from the outer (cutting) edge: A5 rim (2.5 px; 3.5 'bright'), A4 core, A3, A2 at
           the inner edge; one step darker past 70% of the length, A1 past 88%. The back half (behind her hips
           from the camera) is one ramp step dimmer (MOVESET 0.10); 'dim' darkens the whole band.
  ring     'ring': the rest of the tip's circle at the band's mean radius and height, thin ('ring_px') and dim
           (A2/A1), its back half dimmer again: MOVESET's "whole ellipse" on N5's S2.
  glaive   'hide_glaive': blender_apply.py renders that drawing without the solid glaive and its stole tails,
           and the glaive is drawn bent: straight from the butt to the right grip along this drawing's haft,
           then a quadratic curve that leaves the hands between the haft and the chord ('bend', 'bend_mix') and
           ends exactly on the smear's head, so it whips from the hands into the head (ref 09). Colours are the
           glaive's own (outline #181032, haft #271f5e / #6c72d0, blade #8290b4 / #f0fcff).
  path     'reach_dip' shrinks the tip's reach mid-swing (N1: the blade pitched into the floor as it passes her
           feet, so the belly runs under her feet instead of 2 m out); 'smooth' rounds the path's corners (the
           J's floor-to-rise turn); 'lift' tilts a J band's width up off the floor; 'ring_deg' limits the ring
           (N5 S1: only the back half).
  pixels   rasterised at 4x and downsampled by coverage (>= 50%) and the most common colour, so band edges step
           cleanly instead of stair-stepping; isolated pixels removed.
  depth    a smear or bent-glaive pixel shows where the body is absent or nearer the camera than the body
           (depth pass). A solid glaive still on the image stays on top of its smear.
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from smear import A, H_PX, V, body_depth, clean, cyl, dang, drawing_frames, project, uncyl, yaw_pitch

SS = 4
N_ROWS = 256
GLV = {"OL": (0x18, 0x10, 0x32), "HAFT": (0x27, 0x1f, 0x5e), "HAFT_HI": (0x6c, 0x72, 0xd0),
       "BL_LO": (0x82, 0x90, 0xb4), "BL_HI": (0xf0, 0xfc, 0xff)}
RAMP = ["A1", "A2", "A3", "A4", "A5"]


def interp3(Ab, Bb, t, turn, L, base_len, floor=0.012, dip=0.0):
    """smear.interp plus the grip point and the direction (for the band's inner edge and the bent glaive).
    dip: the tip's reach shrinks by dip * sin(pi t) mid-way (the blade pitched into the floor as it passes
    under her feet: N1's belly), 0 = a plain arc"""
    c = V(Ab["hips"]) * (1 - t) + V(Bb["hips"]) * t
    ra, aa, za = cyl(V(Ab["grip_R"]), V(Ab["hips"]))
    rb, ab, zb = cyl(V(Bb["grip_R"]), V(Bb["hips"]))
    g = uncyl(ra + (rb - ra) * t, aa + dang(aa, ab, turn) * t, za + (zb - za) * t, c)
    da, db = V(Ab["tip"]) - V(Ab["grip_R"]), V(Bb["tip"]) - V(Bb["grip_R"])
    reach = (np.linalg.norm(da) * (1 - t) + np.linalg.norm(db) * t) * (1.0 - dip * math.sin(math.pi * t))
    ya, pa = yaw_pitch(da / np.linalg.norm(da))
    yb, pb = yaw_pitch(db / np.linalg.norm(db))
    y = math.radians(ya + dang(ya, yb, turn) * t)
    p = math.radians(pa + (pb - pa) * t)
    d = np.array([math.sin(y) * math.cos(p), -math.cos(y) * math.cos(p), math.sin(p)])
    tip = g + d * reach
    tip[2] = max(tip[2], floor)
    d = tip - g
    d /= np.linalg.norm(d) + 1e-9
    base = tip - d * min(L - base_len, 0.9 * reach)
    base[2] = max(base[2], floor)
    return tip, base, g, d


def profile(age, head_round=0.0):
    a = np.clip(age, 0.0, 1.0)
    v = (1.0 - a) ** 1.3
    if head_round > 0:
        v = v * np.minimum(1.0, 0.55 + 0.45 * a / head_round)
    return v


def raster_band(meta, rows, W, H, K=10):
    """rows: [(outer3d, inner3d, age, back)] oldest -> newest (newer quads overwrite). Returns 4x buffers:
    age, acr (0 outer .. 1 inner), z (camera depth), back (1 = behind her hips)."""
    Ws, Hs = W * SS, H * SS
    imgs = {k: Image.new("F", (Ws, Hs), v) for k, v in (("age", 1e6), ("acr", -1.0), ("z", 1e9), ("back", 0.0))}
    dr = {k: ImageDraw.Draw(v) for k, v in imgs.items()}
    lanes = np.linspace(0.0, 1.0, K + 1)
    P = [[project(meta, o + (i - o) * r) for r in lanes] for o, i, _, _ in rows]
    for n in range(len(rows) - 1):
        age = 0.5 * (rows[n][2] + rows[n + 1][2])
        back = 1.0 if (rows[n][3] and rows[n + 1][3]) else 0.0
        for j in range(K):
            q = [P[n][j], P[n][j + 1], P[n + 1][j + 1], P[n + 1][j]]
            poly = [(x * SS, y * SS) for x, y, _ in q]
            dr["age"].polygon(poly, fill=float(age))
            dr["acr"].polygon(poly, fill=float((lanes[j] + lanes[j + 1]) / 2))
            dr["z"].polygon(poly, fill=float(sum(z for _, _, z in q) / 4))
            dr["back"].polygon(poly, fill=back)
    return {k: np.asarray(v).copy() for k, v in imgs.items()}


def band_labels(buf, thick_px, rim_px=2.5, dim=0, ring=False, dark_at=(0.70, 0.88)):
    """RAMP index per 4x pixel (-1 = empty)"""
    age, acr, back = buf["age"], buf["acr"], buf["back"]
    have = (acr >= 0) & (age < 1e5)
    th = np.maximum(1.0, thick_px * profile(age))
    rim = np.clip(rim_px / th, 0.0, 0.6)
    lab = np.full(age.shape, -1, np.int16)
    lab[have] = 1                                   # A2 at the inner edge
    lab[have & (acr < 0.66)] = 2                    # A3
    lab[have & (acr < 0.36)] = 3                    # A4 core
    lab[have & (acr < rim)] = 4                     # A5 rim on the cutting edge
    lab[have & (age > dark_at[0])] -= 1
    lab[have & (age > dark_at[1])] = 0
    if ring:
        lab[have] = np.minimum(lab[have], 1)
    lab[have] -= dim
    lab[have & (back > 0.5)] -= 1
    lab[have] = np.maximum(lab[have], 0)
    return lab


def downsample(lab, z, n_labels=len(RAMP)):
    """4x labels -> 1x: coverage >= 50% and the most common label; depth = the nearest sample"""
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


def to_rgba(lab):
    out = np.zeros(lab.shape + (4,), np.uint8)
    for k, name in enumerate(RAMP):
        m = lab == k
        out[m, :3] = A[name]
        out[m, 3] = 255
    return out


def bent_glaive(meta, head_tip, butt_now, grip_now, L, base_len, W, H, bend=0.45, mix=0.5):
    """the glaive drawn bent (see the module doc): straight from the butt to the right grip along this drawing's
    haft, then a curve that leaves the hands along that direction and ends on the smear's head (a quadratic
    Bezier; 'bend' = how far along the haft direction its control point sits, as a fraction of the chord).
    Returns (rgba 1x, depth 1x)"""
    n = 56
    s_grip = float(np.linalg.norm(grip_now - butt_now))
    d_now = (grip_now - butt_now) / (s_grip + 1e-9)
    pts = [butt_now + d_now * (s_grip * k / 8.0) for k in range(9)]
    chord = float(np.linalg.norm(head_tip - grip_now))
    cd = (head_tip - grip_now) / (chord + 1e-9)
    t0 = d_now * (1.0 - mix) + cd * mix            # leave the hands between the haft and the chord: a bow, not a sag
    t0 = t0 / (np.linalg.norm(t0) + 1e-9)
    c1 = grip_now + t0 * chord * bend
    curve = []
    for k in range(1, 4 * n + 1):
        u = k / (4 * n)
        q = (1 - u) ** 2 * grip_now + 2 * u * (1 - u) * c1 + u ** 2 * head_tip
        q[2] = max(q[2], 0.012)
        curve.append(q)
    arc = np.concatenate([[0.0], np.cumsum([np.linalg.norm(curve[0] - grip_now)] +
                                           [np.linalg.norm(curve[i + 1] - curve[i]) for i in range(len(curve) - 1)])])
    total = arc[-1]
    sb = [s_grip * k / 8.0 for k in range(9)]
    allp = [grip_now] + curve
    for k in range(1, n + 1):             # resample the curve evenly; map its length onto grip -> tip
        a = total * k / n
        i = min(int(np.searchsorted(arc, a)), len(allp) - 1)
        pts.append(allp[i])
        sb.append(s_grip + (L - s_grip) * k / n)
    Ws, Hs = W * SS, H * SS
    lab_img = Image.new("L", (Ws, Hs), 0)
    z_img = Image.new("F", (Ws, Hs), 1e9)
    dl, dz = ImageDraw.Draw(lab_img), ImageDraw.Draw(z_img)
    P = [project(meta, q) for q in pts]
    # 1 outline, 2 haft, 3 haft highlight, 4 blade, 5 blade edge highlight
    for layer in range(3):
        for i in range(len(P) - 1):
            s0 = sb[i]
            blade = s0 >= base_len
            a = np.array(P[i][:2])
            b = np.array(P[i + 1][:2])
            sg = b - a
            if np.linalg.norm(sg) < 1e-6:
                continue
            nrm = np.array([-sg[1], sg[0]]) / np.linalg.norm(sg)
            if blade:
                f = (s0 - base_len) / max(1e-6, L - base_len)
                w = 4.6 * (1 - f) + 1.4 * f
            else:
                w = 2.4
            lab, ww, off = ((1, w + 2.0, 0.0), (4 if blade else 2, w, 0.0), (5 if blade else 3, w * 0.4, w * 0.3))[layer]
            h0, h1 = (off - ww / 2) * nrm, (off + ww / 2) * nrm
            poly = [tuple((a + h0) * SS), tuple((a + h1) * SS), tuple((b + h1) * SS), tuple((b + h0) * SS)]
            dl.polygon(poly, fill=lab)
            dz.polygon(poly, fill=float((P[i][2] + P[i + 1][2]) / 2))
    lab4 = np.asarray(lab_img).astype(np.int16) - 1
    lab1, z1 = downsample(lab4, np.asarray(z_img), 5)
    cols = {0: GLV["OL"], 1: GLV["HAFT"], 2: GLV["HAFT_HI"], 3: GLV["BL_LO"], 4: GLV["BL_HI"]}
    out = np.zeros(lab1.shape + (4,), np.uint8)
    for k, c in cols.items():
        m = lab1 == k
        out[m, :3] = c
        out[m, 3] = 255
    return out, z1


def main_v2(px_dir, sheet_path):
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
    ppm = meta["ppm"]
    cam_fwd, cam_loc = V(meta["cam"]["fwd"]), V(meta["cam"]["loc"])

    def depth(p):
        return float((p - cam_loc) @ cam_fwd)
    report = {}
    for name, sp in spec.items():
        fr = drawing_frames(meta, name)
        img_frames = sorted(set(mo["sample_frame"][f] for f in fr))
        body = mo["body_sample_frame"][fr[0]]
        src = mo["body_sample_frame"][drawing_frames(meta, sp["from"])[0]] if sp.get("from") else \
            mo["body_sample_frame"][fr[0] - 1]
        nxt = next((mo["body_sample_frame"][f] for f in range(fr[-1] + 1, len(mo["drawing"]))
                    if mo["body_sample_frame"][f] != body), body)
        Ab, Bb, Cb = blade[str(src)], blade[str(body)], blade[str(nxt)]
        lead = float(sp.get("lead", 0.0))
        turn = int(sp.get("turn", 0))
        turn2 = int(sp.get("turn_lead", 0))
        style = sp.get("style", "flat")

        def path_fn(t):
            if t <= 1.0:
                return interp3(Ab, Bb, max(0.0, t), turn, L, base_len, dip=float(sp.get("reach_dip", 0.0)))
            return interp3(Bb, Cb, min(1.0, t - 1.0), turn2, L, base_len)
        t0 = float(sp.get("start", 0.0))            # where on the from -> this segment the tail starts
        ts = np.linspace(t0, 1.0 + lead, N_ROWS)
        rows3 = [path_fn(t) for t in ts]
        sm = int(sp.get("smooth", 0))
        if sm > 1:            # round the path's corners (N1: the floor-to-rise turn of the J), ends kept
            arr = [np.array([r[k] for r in rows3]) for k in range(4)]
            ker = np.ones(sm) / sm
            out = []
            for k in range(3):
                x = arr[k]
                pad = np.concatenate([np.repeat(x[:1], sm, 0), x, np.repeat(x[-1:], sm, 0)])
                y = np.stack([np.convolve(pad[:, j], ker, mode="same") for j in range(3)], 1)[sm:-sm]
                w = np.minimum(1.0, np.minimum(np.arange(len(x)), np.arange(len(x))[::-1]) / sm)[:, None]
                y = x * (1 - w) + y * w
                y[:, 2] = np.maximum(y[:, 2], 0.012)
                out.append(y)
            rows3 = [(out[0][i], out[1][i], out[2][i], arr[3][i]) for i in range(len(rows3))]
        gl_rgba = gl_z = None
        if sp.get("hide_glaive"):
            gl_rgba, gl_z = bent_glaive(meta, rows3[-1][0], V(Bb["butt"]), V(Bb["grip_R"]), L, base_len, W, H,
                                        bend=float(sp.get("bend", 0.45)), mix=float(sp.get("bend_mix", 0.5)))
        tips2 = [project(meta, r[0])[:2] for r in rows3]
        seg = [math.dist(tips2[i], tips2[i + 1]) for i in range(len(tips2) - 1)]
        cum = np.concatenate([[0.0], np.cumsum(seg)])
        total = float(cum[-1])
        ages = (total - cum) / max(total, 1.0)
        z_hips = depth(V(Bb["hips"]))
        thick = float(sp.get("thick", 24.0))
        hv = float(sp.get("h", 0.0))
        rows = []
        for k_, ((tip, base, g, d), a) in enumerate(zip(rows3, ages)):
            prof = float(profile(a, float(sp.get("head_round", 0.0))))
            if style == "J":
                # across the path: the part of (grip - tip) perpendicular to the tip's direction of travel, so
                # along the floor the band rises off it (the belly) and on the rise it reaches back toward her
                tan = rows3[min(k_ + 1, len(rows3) - 1)][0] - rows3[max(k_ - 1, 0)][0]
                tan = tan / (np.linalg.norm(tan) + 1e-9)
                v = g - tip
                v = v - tan * float(v @ tan)
                v = v / (np.linalg.norm(v) + 1e-9)
                up = np.array([0.0, 0.0, 1.0]) - tan * tan[2]      # off the floor, across the path
                v = v + up * float(sp.get("lift", 1.5))
                v = v / (np.linalg.norm(v) + 1e-9)
                inner = tip + v * max(thick * prof, 1.0) / ppm
            else:
                k = float(sp.get("blade_frac", 1.0)) * max(prof, 0.12)
                inner = base * k + tip * (1 - k) + np.array([0.0, 0.0, -hv * prof / ppm])
            back = bool(sp.get("dim_back", True)) and depth(tip) > z_hips + 0.08
            rows.append((tip, inner, float(a), back))
        buf = raster_band(meta, rows, W, H)
        lab4 = band_labels(buf, thick, 3.5 if sp.get("bright") else 2.5, dim=int(sp.get("dim", 0)))
        z4 = buf["z"]
        ring_px = 0
        if sp.get("ring"):
            c = V(Bb["hips"])
            rs = [cyl(r[0], c) for r in rows3]
            R = float(np.mean([x[0] for x in rs]))
            zc = float(np.mean([x[2] for x in rs]))
            a_tail = rs[0][1]
            span = sum(dang(rs[i][1], rs[i + 1][1], turn or 1) for i in range(len(rs) - 1))
            rest = 360.0 - abs(span) - float(sp.get("ring_gap", 8.0))
            rest = min(rest, float(sp.get("ring_deg", 360.0)))     # N5 S1: only the back half
            sgn = 1 if span >= 0 else -1
            rp = float(sp.get("ring_px", 4.0))
            ring_rows = []
            for k in range(97):             # from the tail backward round toward the head
                az = a_tail - sgn * rest * k / 96.0
                tip = uncyl(R, az, zc, c)
                inner = uncyl(R * 0.94, az, zc - rp / ppm, c)
                ring_rows.append((tip, inner, 0.5, depth(tip) > z_hips))
            rb = raster_band(meta, ring_rows, W, H, K=4)
            rl = band_labels(rb, rp, 1.0, ring=True)
            put = (rl >= 0) & (lab4 < 0)
            lab4 = np.where(put, rl, lab4)
            z4 = np.where(put, rb["z"], z4)
            ring_px = int(put.sum() // (SS * SS))
        lab1, z1 = downsample(lab4, z4)
        fx = clean(to_rgba(lab1))
        rep = {"from_image": src, "image": body, "next_image": nxt, "samples": len(rows), "style": style,
               "tip_path_px": round(total, 1), "turn": turn, "lead": lead, "thick_px": thick, "ring_px": ring_px,
               "bent_glaive": gl_rgba is not None, "images": {}}
        for f in img_frames:
            bpath = px_dir / f"sprite_{f:04d}_body.png"
            spath = px_dir / f"sprite_{f:04d}.png"
            if not bpath.exists():
                Image.open(spath).save(bpath)
            spr = np.asarray(Image.open(bpath).convert("RGBA")).copy()
            idm = np.asarray(Image.open(px_dir / f"sprite_{f:04d}_id.png").convert("RGBA"))
            bd = body_depth(px_dir, meta, f, spr)
            is_glaive = np.isin(idm[..., 1], glaive_parts) & (idm[..., 3] > 0) & (spr[..., 3] > 0)
            has = fx[..., 3] > 0
            vis = has & ~is_glaive & ((spr[..., 3] == 0) | (z1 < bd - 0.03))
            out = spr.copy()
            out[vis] = fx[vis]
            gl_px = 0
            if gl_rgba is not None:
                gh = gl_rgba[..., 3] > 0
                gvis = gh & ((spr[..., 3] == 0) | (gl_z < bd - 0.02))
                out[gvis] = gl_rgba[gvis]
                gl_px = int(gvis.sum())
            Image.fromarray(out).save(spath)
            cols = np.where(out[..., 3].max(0) > 0)[0]
            scol = np.where(vis.any(0))[0]
            rep["images"][str(f)] = {"drawn_px": int(vis.sum()), "hidden_px": int((has & ~vis).sum()),
                                     "bent_glaive_px": gl_px,
                                     "span_all_H": round((cols.max() - cols.min() + 1) / H_PX, 2),
                                     "span_smear_H": round((scol.max() - scol.min() + 1) / H_PX, 2) if len(scol) else 0}
        report[name] = rep
        print(name, json.dumps(rep))
    (px_dir / "smear.json").write_text(json.dumps(report, indent=1))
    return report
