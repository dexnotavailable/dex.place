"""Tracked blade smears on a rendered clip's strike drawings (system Python: numpy + Pillow).

  python tools/motion-ai/smear.py D:/Dex/Projects/dex-place-art/rosace/motion-ai/renders/n5_r3/px144 \
      tools/motion-ai/timing/n5_r3.json

The spike's method (tools/pixel-pipeline/blender_spike.py + postprocess.py: sample the blade's 3D
path, project it with the render camera, fill the swept band, band it by age and radius, depth-test it
against the body), ported to the Rosace motion route:

  path      blender_apply.py --hero records every rendered image's blade in meta.json
            (motion.hero.blade: butt, tip, blade base, a haft point, hips, head). A smear drawing's
            path runs from the sheet's 'from' drawing's blade to its own, then 'lead' of the way on to
            the next drawing's blade. Between two blades, a haft point (the grip_off socket) travels
            round her hips in cylinder coordinates (radius, angle, height) and the blade turns round
            that point (yaw, pitch; reach lerped), so the tip traces an arc, not a chord through her;
            'turn' +1 / -1 forces the way round (+ = toward her left, the N5 unwind), else the shorter
            way. 64 samples; the tip and the blade's base never go under the floor.
  raster    quads between consecutive samples across 12 radial lanes (blade base -> tip) into float
            buffers: distance from the head along the tip path (px), radius, camera depth. Native
            144 px grid, no anti-aliasing.
  look      MOVESET 0.6 "Full" stage: a crisp A5 leading edge along the cutting path (the blade's
            outer rim, about 3 px; thicker on a 'bright' drawing), a body of A3 over A2 on the outer
            62% of the blade at the head, a tail of A1; the band tapers to the tip lane at the tail.
            No outline (MOVESET 0.6: leading is never drawn round a smear).
  depth     a smear pixel shows where the body is absent, where it is the glaive itself (the smear is
            the blade, drawn bent: refs 09/10), or where the smear is nearer the camera than the body
            (depth pass, 2.4 cm steps; the 1 px outline ring takes its nearest body neighbour's depth).
  ring      'ring': true also draws the rest of the tip's circle (same radius and height round her)
            as a thin, dimmer A2/A1 band, depth-tested: MOVESET's S2 "whole ellipse".

Writes sprite_####.png in place (the body-only image is kept as sprite_####_body.png and reused on
re-runs, so the step is idempotent) and smear.json (per drawing: samples, pixels drawn, pixels hidden
behind her, horizontal span of the smear and of smear + body in H).
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

A = {"A1": (0x1a, 0x2f, 0x8c), "A2": (0x2a, 0x62, 0xd0), "A3": (0x4a, 0xa8, 0xf0), "A4": (0xa0, 0xe6, 0xff),
     "A5": (0xf0, 0xfc, 0xff)}
N_SAMPLES = 64
LANES = 12
H_PX = 144


def V(x):
    return np.asarray(x, float)


def cyl(p, c):
    d = p[:2] - c[:2]
    return math.hypot(d[0], d[1]), math.degrees(math.atan2(d[0], -d[1])), p[2]


def uncyl(r, az, z, c):
    a = math.radians(az)
    return np.array([c[0] + r * math.sin(a), c[1] - r * math.cos(a), z])


def dang(a0, a1, turn):
    d = (a1 - a0 + 180.0) % 360.0 - 180.0
    if turn and d != 0 and math.copysign(1, d) != turn:
        d += 360.0 * turn
    return d


def yaw_pitch(d):
    return math.degrees(math.atan2(d[0], -d[1])), math.degrees(math.asin(max(-1.0, min(1.0, d[2]))))


def interp(Ab, Bb, t, turn, L, base_len):
    """blade A -> B at t in [0, 1]: a haft point travels round her hips (cylinder coordinates), the
    blade turns round that point (yaw the way 'turn' says, pitch lerped), so the tip traces an arc"""
    c = V(Ab["hips"]) * (1 - t) + V(Bb["hips"]) * t
    ra, aa, za = cyl(V(Ab["grip_R"]), V(Ab["hips"]))
    rb, ab, zb = cyl(V(Bb["grip_R"]), V(Bb["hips"]))
    g = uncyl(ra + (rb - ra) * t, aa + dang(aa, ab, turn) * t, za + (zb - za) * t, c)
    da, db = V(Ab["tip"]) - V(Ab["grip_R"]), V(Bb["tip"]) - V(Bb["grip_R"])
    reach = np.linalg.norm(da) * (1 - t) + np.linalg.norm(db) * t
    ya, pa = yaw_pitch(da / np.linalg.norm(da))
    yb, pb = yaw_pitch(db / np.linalg.norm(db))
    y = math.radians(ya + dang(ya, yb, turn) * t)
    p = math.radians(pa + (pb - pa) * t)
    d = np.array([math.sin(y) * math.cos(p), -math.cos(y) * math.cos(p), math.sin(p)])
    tip = g + d * reach
    tip[2] = max(tip[2], 0.012)
    d = tip - g
    d /= np.linalg.norm(d) + 1e-9
    base = tip - d * (L - base_len)
    base[2] = max(base[2], 0.012)
    return tip, base


def project(meta, p):
    cam = meta["cam"]
    v = V(p) - V(cam["loc"])
    W, H = meta["canvas"]
    ppm = meta["ppm"]
    return (W / 2 + v @ V(cam["right"]) * ppm, H / 2 - v @ V(cam["up"]) * ppm, float(v @ V(cam["fwd"])))


def body_depth(px_dir, meta, f, sprite):
    raw = np.asarray(Image.open(px_dir / "depth" / f"{f:04d}.png").convert("RGBA"))
    beauty_a = np.asarray(Image.open(px_dir / "beauty" / f"{f:04d}.png").convert("RGBA"))[..., 3] > 127
    D0, D1 = meta["depth_range"]
    d = np.where(beauty_a, D0 + raw[..., 0].astype(np.float32) / 255.0 * (D1 - D0), np.inf)
    # the outline ring (sprite alpha, no beauty alpha): nearest body neighbour's depth
    ring = (sprite[..., 3] > 0) & ~beauty_a
    if ring.any():
        nb = np.full(d.shape, np.inf, np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nb = np.minimum(nb, np.roll(np.roll(d, dy, 0), dx, 1))
        d = np.where(ring, nb, d)
    return d


def raster(meta, samples, W, H):
    """samples: [(tip, base, dist_px_from_head)] oldest -> newest. Returns dist, radius, depth buffers."""
    dist_img = Image.new("F", (W, H), 1e6)
    r_img = Image.new("F", (W, H), -1.0)
    z_img = Image.new("F", (W, H), 1e9)
    dd, dr, dz = ImageDraw.Draw(dist_img), ImageDraw.Draw(r_img), ImageDraw.Draw(z_img)
    lanes = np.linspace(0.0, 1.0, LANES + 1)
    proj = [[project(meta, b + (t - b) * r) for r in lanes] for t, b, _ in samples]
    for i in range(len(samples) - 1):          # oldest first; newer quads overwrite
        dist = 0.5 * (samples[i][2] + samples[i + 1][2])
        for j in range(LANES):
            q = [proj[i][j], proj[i][j + 1], proj[i + 1][j + 1], proj[i + 1][j]]
            poly = [(x, y) for x, y, _ in q]
            dd.polygon(poly, fill=float(dist))
            dr.polygon(poly, fill=float((lanes[j] + lanes[j + 1]) / 2))
            dz.polygon(poly, fill=float(sum(z for _, _, z in q) / 4))
    return np.asarray(dist_img).copy(), np.asarray(r_img).copy(), np.asarray(z_img).copy()


def colour(dist, r, total, bright=False, dim=False, head=0.38):
    """MOVESET 0.6 'Full' / PIPELINE 3.12: a crisp near-white leading edge along the cutting path (the
    blade's outer rim, A5), a body of two flat tones (A3 outside, A2 inside) on the outer part of the
    blade only, and a tail in A1 tapering to a point. r = 0 at the blade's base, 1 at its tip."""
    have = (r >= 0) & (dist < 1e5)
    age = np.clip(dist / max(total, 1.0), 0, 1)
    r_min = head + (0.96 - head) * age ** 0.75       # outer part of the blade at the head -> the tip lane
    ok = have & (r >= r_min)
    rim = 1.0 - (0.16 if bright else 0.11) * (1.0 - 0.6 * age)   # the A5 rim thins toward the tail
    lab = np.full(dist.shape, "", object)
    if dim:
        lab[ok] = "A2"
        lab[ok & (age > 0.5)] = "A1"
    else:
        lab[ok] = "A2"
        lab[ok & (r > r_min + (1 - r_min) * 0.45)] = "A3"
        lab[ok & (r >= rim) & (age < (0.8 if bright else 0.62))] = "A5"
        lab[ok & (age > (0.86 if bright else 0.74))] = "A1"
    out = np.zeros(dist.shape + (4,), np.uint8)
    for k, c in A.items():
        m = lab == k
        out[m, :3] = c
        out[m, 3] = 255
    return out


def clean(arr):
    a = arr[..., 3] > 0
    n = sum(np.roll(np.roll(a, dy, 0), dx, 1).astype(int) for dy in (-1, 0, 1) for dx in (-1, 0, 1)) - a
    arr[a & (n <= 1), 3] = 0
    return arr


def drawing_frames(meta, name):
    mo = meta["motion"]
    fr = [f for f, d in enumerate(mo["drawing"]) if d == name]
    if not fr:
        raise KeyError(f"no drawing {name!r} in {sorted(set(mo['drawing']))}")
    return fr


def main_v1(px_dir, sheet_path):
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
        n1 = int(N_SAMPLES * 1.0 / (1.0 + lead))
        n2 = N_SAMPLES - n1
        pts = [interp(Ab, Bb, t, turn, L, base_len) for t in np.linspace(0, 1, n1)]
        if lead > 0:
            pts += [interp(Bb, Cb, t, 0, L, base_len) for t in np.linspace(0, lead, n2 + 1)[1:]]
        # distance from the head along the projected tip path
        tips2 = [project(meta, t)[:2] for t, _ in pts]
        seg = [math.dist(tips2[i], tips2[i + 1]) for i in range(len(tips2) - 1)]
        cum = np.concatenate([[0.0], np.cumsum(seg)])
        total = float(cum[-1])
        samples = [(t, b, total - cum[i]) for i, (t, b) in enumerate(pts)]
        dist, rad, dep = raster(meta, samples, W, H)
        fx = colour(dist, rad, total, bright=bool(sp.get("bright")), head=float(sp.get("head", 0.15 if sp.get("style") == "flat" else 0.38)))
        ring_px = 0
        if sp.get("ring"):
            c = V(Bb["hips"])
            rs = [cyl(t, c) for t, _ in pts]
            R = float(np.mean([x[0] for x in rs]))
            z = float(np.mean([x[2] for x in rs]))
            a0 = rs[0][1]
            span = sum(dang(rs[i][1], rs[i + 1][1], turn) for i in range(len(rs) - 1))
            rest = 360.0 - abs(span)
            sgn = 1 if span >= 0 else -1
            ring = []
            for k in range(49):
                az = a0 - sgn * rest * k / 48.0
                tip = uncyl(R, az, z, c)
                base = uncyl(R * 0.95, az, z, c)
                ring.append((tip, base, k / 48.0))
            rd, rr, rz = raster(meta, ring, W, H)
            rfx = colour(rd, np.where(rr >= 0, np.maximum(rr, 0.9), rr), 1.0, dim=True)
            put = (rfx[..., 3] > 0) & (fx[..., 3] == 0)
            fx[put] = rfx[put]
            dep = np.where(put, rz, dep)
            ring_px = int(put.sum())
        fx = clean(fx)
        rep = {"from_image": src, "image": body, "next_image": nxt, "samples": len(samples),
               "tip_path_px": round(total, 1), "turn": turn, "lead": lead, "ring_px": ring_px, "images": {}}
        for f in img_frames:
            bpath = px_dir / f"sprite_{f:04d}_body.png"
            spath = px_dir / f"sprite_{f:04d}.png"
            if not bpath.exists():
                Image.open(spath).save(bpath)
            spr = np.asarray(Image.open(bpath).convert("RGBA")).copy()
            idm = np.asarray(Image.open(px_dir / f"sprite_{f:04d}_id.png").convert("RGBA"))
            bd = body_depth(px_dir, meta, f, spr)
            is_glaive = np.isin(idm[..., 1], glaive_parts) & (idm[..., 3] > 0)
            has = fx[..., 3] > 0
            vis = has & ((spr[..., 3] == 0) | is_glaive | (dep < bd - 0.03))
            out = spr.copy()
            out[vis] = fx[vis]
            Image.fromarray(out).save(spath)
            cols = np.where(out[..., 3].max(0) > 0)[0]
            scol = np.where(vis.any(0))[0]
            rep["images"][str(f)] = {"drawn_px": int(vis.sum()), "hidden_px": int((has & ~vis).sum()),
                                     "span_all_H": round((cols.max() - cols.min() + 1) / H_PX, 2),
                                     "span_smear_H": round((scol.max() - scol.min() + 1) / H_PX, 2) if len(scol) else 0}
        report[name] = rep
        print(name, json.dumps(rep))
    (px_dir / "smear.json").write_text(json.dumps(report, indent=1))
    return report


def main(px_dir, sheet_path):
    """v1 (round 3) unless the sheet's smear section says "_v": 2 (round 3b: smear_v2.py) or 3 (round 3c: smear_v3.py)"""
    sheet = json.loads(Path(sheet_path).read_text(encoding="utf-8"))
    if sheet.get("smear", {}).get("_v") == 3:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        import smear_v3
        return smear_v3.main_v3(px_dir, sheet_path)
    if sheet.get("smear", {}).get("_v") == 2:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        import smear_v2
        return smear_v2.main_v2(px_dir, sheet_path)
    return main_v1(px_dir, sheet_path)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
