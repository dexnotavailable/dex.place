"""Drive 9, pixel side: d9_blender.py's hi-res passes -> the combined sprite (route F1's method, re-tuned).

  python tools/pixel-pipeline/drive9/d9_post.py --root <raw>/<key> [--preset D1] [--shots idle,n1,q,back]
      [--finish drive9/d9_finish.json] [--tag <out subdir>]

Everything here is numpy on our own render passes and authored data (no image generation):
 1. paint at ss x: per material, v' = v (light R) + tex * brush noise + strand * strand noise - cav * (1 - ao)
    + bounce on down-facing shadow; colour = the material's hue-shifted ramp (OKLab interpolation between its
    stops, d9_finish.json); the spec band (light B) mixes toward the material's spec colour (hair: the angel ring)
 2. downsample (finish_f1/f1_post.downsample, as a library): hard silhouette, label = weighted mode, colour =
    linear mean of the label's sub-pixels, `aa` toward the block mean only inside the figure
 3. palette: per-material k-means in OKLab ('tones' colours each, real rendered colours); a block that holds
    more than one label snaps to the nearest colour of the whole palette (the AA in-betweens)
 4. cleanup (f1_post.cleanup / face_clean): speckles, 2x2 checkers (PX-P23), orphans
 5. lines: 1 px outline ring, never missing. Ground side and shadow side: the tinted near-black line; lit side:
    light materials take their deepest ramp tone (dark enough to hold against the ground), dark materials a
    lighter sel-out (their third-darkest tone); skin a warm umber (PX-P38). Inner occlusion lines as F1
 6. rim: 1 px on the back-lit silhouette edge (edge pixels whose outward direction faces the rim direction,
    upper left, away from the key light), screened toward the rim colour (cool; warm on skin), never white
 7. face: round WH2's stamps + route F2's appeal expressions and bigger 144 eyes (faces_f2.json), placed on this
    render's facepass; the blush is re-drawn soft (skin-to-blush in-betweens, no two-block blush)
 8. thong: 1 px, the line colour (DESIGN 3.5 item 5; f1_post.thong)
Writes <raw>/<shot>/px<N>/<tag>/: still.png, still_x3.png, still_ground.png (the chain's contact shadow), sil.png,
id.png + meta.json (copies), post.json (settings, counts, tones per material).
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
sys.path.insert(0, os.path.join(PIPE, "finish_f1"))
sys.path.insert(0, os.path.join(PIPE, "finish_judge"))
sys.path.insert(0, os.path.join(REPO, "tools", "art-construct"))
import f1_post as F1  # noqa: E402   (route F1's pixel pass, as a library)
sys.path.insert(0, HERE)
import r3_post as R3  # noqa: E402   (round 3's steps; used only when the finish json has an 'r3' block)
import r4_post as R4  # noqa: E402   (round 4's steps; used only when the finish json has an 'r4' block)
import r5_post as R5  # noqa: E402   (round 5's steps; used only when the finish json has an 'r5' block)

PICK = json.load(open(os.path.join(REPO, "art", "rosace", "drive9.json"), encoding="utf-8"))
N4, N8 = F1.N4, F1.N8
hexrgb, oklab, lin, delin = F1.hexrgb, F1.oklab, F1.lin, F1.delin


def oklab_inv(L):
    M2i = np.linalg.inv(np.array([[0.2104542553, 0.7936177850, -0.0040720468],
                                  [1.9779984951, -2.4285922050, 0.4505937099],
                                  [0.0259040371, 0.7827717662, -0.8086757660]]))
    M1i = np.linalg.inv(np.array([[0.4122214708, 0.5363325363, 0.0514459929],
                                  [0.2119034982, 0.6806995451, 0.1073969566],
                                  [0.0883024619, 0.2817188376, 0.6299787005]]))
    lms = (np.asarray(L) @ M2i.T) ** 3
    return delin(lms @ M1i.T)


def ramp_lut(stops, n=256, chroma=1.0):
    """(t, hex) stops -> an n x 3 sRGB lookup, OKLab-interpolated; chroma < 1 scales the ramp's OKLab a/b (round 2:
    the refs' lower saturation without moving the hues)"""
    ts = np.array([s[0] for s in stops])
    cs = oklab(np.array([hexrgb(s[1]) for s in stops]))
    cs[:, 1:] *= chroma
    x = np.linspace(0, 1, n)
    lab = np.stack([np.interp(x, ts, cs[:, i]) for i in range(3)], -1)
    return oklab_inv(lab)


R3.bind(ramp_lut=ramp_lut)
R4.bind(oklab_inv=oklab_inv)


# ---------------------------------------------------------------------------- 1. paint
def paint(raw, meta, FIN):
    idm = np.asarray(Image.open(os.path.join(raw, "id.png")).convert("RGBA"))
    lt = np.asarray(Image.open(os.path.join(raw, "light.png")).convert("RGB")).astype(np.float64) / 255
    nz = np.asarray(Image.open(os.path.join(raw, "noise.png")).convert("RGB")).astype(np.float64) / 255
    r3 = FIN.get("r3") or {}
    if r3.get("noise_blur"):
        nz = R3.noise_blur(nz, int(meta["ss"]), r3["noise_blur"])
    shot = (meta.get("d9") or {}).get("shot")
    nrm = np.asarray(Image.open(os.path.join(raw, "normal.png")).convert("RGB")).astype(np.float64) / 255 * 2 - 1
    v, ao, spec = lt[..., 0], lt[..., 1], lt[..., 2]
    a = idm[..., 3] > 0
    out = np.zeros(idm.shape[:2] + (4,))
    out[..., 3] = np.where(a, 255, 0)
    byname = {n: m["id"] for n, m in meta["materials"].items()}
    down = np.clip(-nrm[..., 1], 0, 1)
    for name, mc in FIN["materials"].items():
        if name not in byname:
            continue
        m = a & (idm[..., 0] == byname[name])
        if not m.any():
            continue
        vv = v[m] + mc.get("tex", 0) * 2 * (nz[..., 0][m] - 0.5) + mc.get("strand", 0) * 2 * (nz[..., 1][m] - 0.5)
        vv = vv - mc.get("cav", 0) * (1 - ao[m])
        fo = mc.get("face")
        if fo and "head" in meta.get("parts", {}):
            # the face keeps few, clean tones (refs: 2-3 on the face): no texture, the ramp input lifted so the
            # terminator sits only at the far jaw and under the fringe
            hf = idm[..., 1][m] == meta["parts"]["head"]
            lift = fo.get("lift_shot", {}).get(shot, fo.get("lift", 0.3))
            vf = lift + (1 - lift) * np.clip(v[m] - fo.get("cav", 0.05) * (1 - ao[m]), 0, 1)
            vv = np.where(hf, vf, vv)
        if mc.get("bounce"):
            vv = vv + mc["bounce"] * down[m] * np.clip(1 - v[m] / 0.35, 0, 1)
        lut = np.clip(ramp_lut(mc["stops"], chroma=mc.get("chroma", 1.0)), 0, 255)
        vv = np.clip(vv, 0, 1) ** mc.get("gamma", 1.0)      # > 1: the low-key push (more of the form in the darks)
        idx = np.clip(np.round(vv * 255), 0, 255).astype(int)
        col = lut[idx]
        if mc.get("spec"):
            k = mc.get("spec_k", 0.8) * spec[m][:, None]
            col = col * (1 - k) + hexrgb(mc["spec"])[None] * k
        if mc.get("sheer"):
            # round 3 (outfit 13: 'boots and thigh-highs are the same navy, the leg is one tube'): the stocking's lit
            # side lets the skin through (refs E/G), so it separates from the opaque boot by hue and value
            sh = mc["sheer"]
            k = sh.get("k", 0.35) * np.clip((v[m] - sh.get("v0", 0.15)) / (1 - sh.get("v0", 0.15)), 0, 1)[:, None]
            col = col * (1 - k) + hexrgb(sh["col"])[None] * k
        out[m, :3] = col
    return idm, out


def multi_label(idm, k, H, W):
    a = idm[..., 3] > 0
    lab = np.where(a, idm[..., 0].astype(np.int64) * 256 + idm[..., 1], -1)[:H * k, :W * k]
    bl = lab.reshape(H, k, W, k).transpose(0, 2, 1, 3).reshape(H, W, k * k)
    mn = np.where(bl >= 0, bl, 1 << 30).min(-1)
    mx = bl.max(-1)
    return (mx >= 0) & (mn != mx)


# ---------------------------------------------------------------------------- 3. palette
def palette(alpha, mat, col, byid, FIN, multi):
    out = col.copy()
    pals = {}
    for mid, n in byid.items():
        mc = FIN["materials"].get(n)
        m = alpha & (mat == mid) & ~multi
        if mc is None or not m.any():
            continue
        px = col[m]
        uq, inv, cnt = np.unique(np.round(px).astype(np.int32), axis=0, return_inverse=True, return_counts=True)
        X = oklab(uq)
        C = F1.kmeans(X, cnt.astype(np.float64), int(mc["tones"]))
        lab = ((X[:, None, :] - C[None]) ** 2).sum(-1).argmin(1)
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
        pals[mid] = np.array([r for r in reps if r is not None])
    allp = np.unique(np.concatenate([p for p in pals.values()]), axis=0)
    AP = oklab(allp)
    # AA blocks and any material without a ramp: the nearest colour of the whole palette
    rest = alpha & (multi | ~np.isin(mat, list(pals)))
    if rest.any():
        idx = ((oklab(col[rest])[:, None, :] - AP[None]) ** 2).sum(-1).argmin(1)
        out[rest] = allp[idx]
    return out, pals


def requant(out, alpha, mat, byid, FIN, keep, extra=3):
    """after the rim, bust, sheen and blush blends: each material's colours (face and lines kept) are folded back
    into tones + extra clusters, so every material stays a readable ramp plus a few AA/rim in-betweens"""
    n = 0
    for mid, name in byid.items():
        mc = FIN["materials"].get(name)
        m = alpha & (mat == mid) & ~keep
        if mc is None or not m.any():
            continue
        px = out[m, :3]
        uq, inv, cnt = np.unique(np.round(px).astype(np.int32), axis=0, return_inverse=True, return_counts=True)
        kk = int(mc["tones"]) + extra
        if len(uq) <= kk:
            continue
        X = oklab(uq)
        C = F1.kmeans(X, cnt.astype(np.float64), kk)
        lab = ((X[:, None, :] - C[None]) ** 2).sum(-1).argmin(1)
        reps = np.zeros((len(C), 3))
        for j in range(len(C)):
            mm = lab == j
            if mm.any():
                reps[j] = uq[mm][np.argmin(((X[mm] - C[j]) ** 2).sum(-1))]
        out[m, :3] = reps[lab[inv.ravel()]]
        n += len(uq) - len(np.unique(lab))
    return n


# ---------------------------------------------------------------------------- 5. lines
def lines(alpha, mat, part, img, d, byid, FIN):
    H, W = alpha.shape
    out = np.zeros((H, W, 4))
    out[alpha, :3] = img[alpha]
    out[alpha, 3] = 255
    line = hexrgb(FIN["line"])
    group = {mid: FIN["materials"].get(n, {}).get("group") for mid, n in byid.items()}
    ks = np.array(FIN["key_dir"], float)
    ks /= np.linalg.norm(ks)
    deep = {}
    for mid, n in byid.items():
        mc = FIN["materials"].get(n)
        if mc:
            deep[mid] = hexrgb(mc["stops"][0][1])
    mid3 = {mid: F1.nth_tone(img, alpha, mat, mid, 2) for mid in byid}
    dk = {mid: F1.darkest(img, alpha, mat, mid) for mid in byid}
    HAIRM = [m for m, n in byid.items() if n in ("hair", "hairtip")]
    DARKG = [m for m, g in group.items() if g == "dark"]
    ln = np.zeros((H, W), bool)
    for dy, dx in N4:
        qa = F1.shift(alpha, dy, dx, False)
        qd = F1.shift(d, dy, dx, 9.0)
        qp = F1.shift(part, dy, dx, 0)
        qm = F1.shift(mat, dy, dx, 0)
        hairpair = np.isin(mat, HAIRM) & np.isin(qm, HAIRM)
        step = alpha & qa & (qp != part) & (qd + np.where(hairpair, 0.012, 0.018) < d)
        step &= ~(np.isin(qm, DARKG) & ~np.isin(mat, DARKG))
        ln |= step
    cnt = sum(F1.shift(ln.astype(np.int8), dy, dx, 0) for dy, dx in N8)
    ln &= cnt >= 1
    lab, n = F1.clusters(ln)
    for k in range(1, n + 1):
        if (lab == k).sum() < 3:
            ln[lab == k] = False
    for mid in byid:
        sel = ln & (mat == mid)
        if sel.any() and dk[mid] is not None:
            base = deep.get(mid, dk[mid])
            out[sel, :3] = (base * 0.6 + dk[mid] * 0.4) * 0.8 + line * 0.2
    ring = ~alpha & (sum(F1.shift(alpha.astype(np.int8), dy, dx, 0) for dy, dx in N4) > 0)
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
        name = byid.get(m)
        lit = float(o @ ks) > 0.25
        c = line
        if oy > 0.7:
            c = line
        elif name == "skin":
            c = hexrgb(FIN["skin_line"]) if not lit else hexrgb(FIN["skin_line"]) * 0.55 + deep.get(m, line) * 0.45
        elif lit and g == "dark" and mid3.get(m) is not None:
            c = mid3[m]
        elif lit and g in ("light", "accent") and m in deep:
            c = deep[m]
        out[y, x, :3] = c
        out[y, x, 3] = 255
    ry, rx = np.nonzero(ring)
    cur = {(y, x): tuple(out[y, x, :3]) for y, x in zip(ry, rx)}
    for (y, x), c in cur.items():
        nbs = [cur[(y + dy, x + dx)] for dy, dx in N8 if (y + dy, x + dx) in cur]
        if len(nbs) >= 2 and c not in nbs:
            vals, cn = np.unique(np.array(nbs), axis=0, return_counts=True)
            out[y, x, :3] = vals[cn.argmax()]
    return out, ring, ln


# ---------------------------------------------------------------------------- 6. rim
def rim(out, alpha, mat, byid, FIN, n2, keep):
    """1 px rim on the silhouette edge facing the rim direction (screen upper left = away from the key light)"""
    H, W = alpha.shape
    R = np.array(FIN["rim_dir"], float)
    R /= np.linalg.norm(R)
    cool, warm = hexrgb(FIN["rim_color"]), hexrgb(FIN["rim_color_warm"])
    edge = alpha & (sum((~F1.shift(alpha, dy, dx, False)).astype(np.int8) for dy, dx in N4) > 0)
    n_px = 0
    for y, x in zip(*np.nonzero(edge & ~keep)):
        ox = oy = 0.0
        for dy, dx in N4:
            yy, xx = y + dy, x + dx
            if not (0 <= yy < H and 0 <= xx < W) or not alpha[yy, xx]:
                ox += dx
                oy += dy
        o = np.array([ox, oy], float)
        if np.linalg.norm(o) < 1e-6:
            continue
        o /= np.linalg.norm(o)
        # the render's normal agrees (screen x right, y down; normal pass y up)
        nn = np.array([n2[y, x, 0], -n2[y, x, 1]])
        f = float(o @ R)
        fn = float(nn @ R) / (np.linalg.norm(nn) + 1e-6)
        if f < 0.35 or fn < 0.0:
            continue
        name = byid.get(int(mat[y, x]))
        mc = FIN["materials"].get(name, {})
        k = mc.get("rim", 0.0) * min(1.0, 0.5 + f * 0.6)
        if k <= 0:
            continue
        rc = hexrgb(mc["rim_col"]) if mc.get("rim_col") else (warm if mc.get("rim_warm") else cool)
        c = out[y, x, :3]
        scr = 255 - (255 - c) * (255 - rc) / 255
        out[y, x, :3] = c * (1 - k) + scr * k
        n_px += 1
    return n_px


# ---------------------------------------------------------------------------- 5a. hair sheen (angel ring)
def sheen(out, alpha, mat, byid, FIN, raw, meta, keep):
    """the render's hair spec band (light pass B), read at 1x as coverage, becomes a 2-3 tone angel ring: core
    px (coverage >= 0.3) take the ring colour, their hair neighbours along the band a half step, so the ring has
    a soft falloff instead of one flat patch"""
    mc = FIN["materials"].get("hair", {})
    hid = next((m for m, n in byid.items() if n == "hair"), None)
    if hid is None or not mc.get("sheen"):
        return 0
    k = int(meta["ss"])
    H, W = alpha.shape
    idm = np.asarray(Image.open(os.path.join(raw, "id.png")).convert("RGBA"))[:H * k, :W * k]
    sp = np.asarray(Image.open(os.path.join(raw, "light.png")).convert("RGB"))[:H * k, :W * k, 2] / 255.0
    hmask = (idm[..., 0] == hid) & (idm[..., 3] > 0)
    cov = (sp * hmask).reshape(H, k, W, k).mean((1, 3))
    hair = alpha & (mat == hid) & ~keep
    core = hair & (cov >= mc["sheen"].get("thr", 0.3))
    if not core.any():
        return 0
    halo = np.zeros_like(core)
    for dy, dx in ((0, 1), (0, -1), (0, 2), (0, -2), (1, 0), (-1, 0)):
        halo |= F1.shift(core, dy, dx, False)
    halo &= hair & ~core
    c1, c2 = hexrgb(mc["sheen"]["core"]), hexrgb(mc["sheen"]["halo"])
    out[core, :3] = c1
    out[halo, :3] = out[halo, :3] * 0.45 + c2 * 0.55
    return int(core.sum() + halo.sum())


# ---------------------------------------------------------------------------- 5a'. hair clumps (round 2)
def hair_clumps(out, alpha, mat, part, byid, FIN, keep):
    """critique 4: 'one purple curtain split into straight strips'. Where two modelled hair clump groups (hair part
    ids) meet inside the hair mass, the pixel on the farther (lower-lit) side becomes a dark separator from the hair's
    own ramp (rank 'sep_rank' of its tones), so the mass reads as clumps; runs shorter than 2 px are dropped"""
    cfg = FIN.get("hair_clumps")
    if not cfg:
        return 0
    hm = [m for m, n in byid.items() if n in ("hair", "hairtip")]
    hair = alpha & np.isin(mat, hm)
    hs = np.unique(np.round(out[hair & ~keep, :3]).astype(int), axis=0)
    if not len(hs):
        return 0
    hs = hs[np.argsort(oklab(hs)[:, 0])]
    sep = hs[int(len(hs) * cfg.get("sep_rank", 0.15))]
    L = oklab(np.clip(out[..., :3], 0, 255))[..., 0]
    m = np.zeros_like(hair)
    for dy, dx in ((0, 1), (1, 0)):
        q = F1.shift(hair, -dy, -dx, False)
        qp = F1.shift(part, -dy, -dx, 0)
        qL = F1.shift(L, -dy, -dx, 0.0)
        b = hair & q & (qp != part)
        # darker side of the pair takes the separator
        here = b & (L <= qL)
        there = b & (L > qL)
        m |= here
        m |= F1.shift(there, dy, dx, False)
    m &= hair & ~keep
    lab, n = F1.clusters(m)
    for k in range(1, n + 1):
        if (lab == k).sum() < cfg.get("min_run", 2):
            m[lab == k] = False
    k = cfg.get("k", 0.7)
    out[m, :3] = out[m, :3] * (1 - k) + sep * k
    return int(m.sum())


# ---------------------------------------------------------------------------- 5b. bust (DESIGN 3.5 item 4)
def bust(out, alpha, mat, part, n2, meta, FIN, raw, keep):
    """the bust reads from value, not only silhouette: a cleavage wedge where the bodice's screen normal flips
    across the valley between the apexes (the far side of the flip, which faces away from the key light, takes
    the white ramp's shadow tones: 2 px at the top, tapering to 1), and an underbust cast shadow on the skin or
    cloth right under the bodice's lower edge inside the bust span. Located from the render's normals and the
    rig's bust landmarks only."""
    lp = os.path.join(raw, "landmarks.json")
    bid = meta["parts"].get("bodice")
    if not os.path.exists(lp) or bid is None:
        return {"skip": "no landmarks/bodice"}
    L = json.load(open(lp))["screen"][str(meta["px"])]
    al, ar, pn = L["bust_apex_left"], L["bust_apex_right"], L["pit_neck"]
    H, W = alpha.shape
    bod = alpha & (part == bid)
    ks = np.array(FIN["key_dir"], float)
    x0 = int(np.floor(min(al[0], ar[0]))) - 2
    x1 = int(np.ceil(max(al[0], ar[0]))) + 2
    y0 = int(round(pn[1])) + 1
    y1 = int(round(max(al[1], ar[1]))) + max(2, int(0.02 * meta["px"]))
    wstops = FIN["materials"]["white"]["stops"]
    lut = ramp_lut(wstops)
    dark, mid = lut[int(0.12 * 255)], lut[int(0.20 * 255)]
    rows = []
    for y in range(max(0, y0), min(H, y1 + 1)):
        best = None
        for x in range(max(0, x0), min(W - 1, x1)):
            if not (bod[y, x] and bod[y, x + 1]):
                continue
            j = n2[y, x, 0] - n2[y, x + 1, 0]
            if j >= 0.45 and (best is None or j > best[0]):
                best = (j, x)
            j2 = n2[y, x + 1, 0] - n2[y, x, 0]
            if j2 >= 0.45 and (best is None or j2 > best[0]):
                best = (j2, x)
        if best:
            x = best[1]
            # the side facing away from the key light
            fa = np.array([n2[y, x, 0], -n2[y, x, 1]]) @ ks
            fb = np.array([n2[y, x + 1, 0], -n2[y, x + 1, 1]]) @ ks
            rows.append((y, x + 1 if fb < fa else x, x if fb < fa else x + 1))
    n = 0
    if len(rows) >= 3:
        # the valley continues up to the neckline: extend the first row's column up through the bodice
        y, xs, xo = rows[0]
        up = []
        yy = y - 1
        while yy >= max(0, y0 - 4) and bod[yy, xs]:
            up.append((yy, xs, xo))
            yy -= 1
        rows = up[::-1] + rows
        bc = (FIN.get("r3") or {}).get("bust") or {}
        if bc.get("cleave_frac"):
            # round 3 (body 5: 'two spheres, not one lifted bodice form'): the valley only under the neckline
            rows = rows[:max(3, int(round(len(rows) * bc["cleave_frac"])))]
        for i, (y, xs, xo) in enumerate(rows):
            top = i < max(1, len(rows) // 2)
            if keep[y, xs]:
                continue
            out[y, xs, :3] = dark if top else mid
            n += 1
            if i < max(1, len(rows) // 3) and alpha[y, xo] and not keep[y, xo]:
                out[y, xo, :3] = out[y, xo, :3] * 0.5 + mid * 0.5
                n += 1
    # underbust: the first non-bodice pixel under the bodice, inside the apex span, darkened a ramp step
    nu = 0
    skin_id = meta["materials"]["skin"]["id"]
    skl = ramp_lut(FIN["materials"]["skin"]["stops"])
    for x in range(max(0, x0 + 1), min(W, x1)):
        ys = np.nonzero(bod[:, x])[0]
        ys = ys[(ys >= y0) & (ys <= y1 + 6)]
        if not len(ys):
            continue
        y = ys.max() + 1
        if y < H and alpha[y, x] and not bod[y, x] and not keep[y, x]:
            if mat[y, x] == skin_id:
                out[y, x, :3] = skl[int(0.16 * 255)]
            else:
                out[y, x, :3] = out[y, x, :3] * 0.7
            nu += 1
    # the underside of each breast turns away from the light: bodice px in the bust span whose normal points
    # down on screen go one shadow step toward the white ramp's mid-shadow
    nd = 0
    for y in range(max(0, y0), min(H, y1 + 6)):
        for x in range(max(0, x0), min(W, x1)):
            if bod[y, x] and not keep[y, x] and n2[y, x, 1] < -0.35:
                ku = ((FIN.get("r3") or {}).get("bust") or {}).get("underside_k", 0.45)
                out[y, x, :3] = out[y, x, :3] * (1 - ku) + mid * ku
                nd += 1
    return {"cleavage_rows": len(rows), "cleavage_px": n, "underbust_px": nu, "underside_px": nd}


# ---------------------------------------------------------------------------- 7. face
def faces_table(big, r2=None):
    F = json.load(open(os.path.join(REPO, "art", "rosace", "faces", "wh2.json"), encoding="utf-8"))
    A = json.load(open(os.path.join(PIPE, "finish_f2", "faces_f2.json"), encoding="utf-8"))
    F["expressions"].update(A["expressions"])
    if big:
        for px, st in A["eyes_big"].items():
            F["stamps"][px].update(st)
    if r2:
        # round 2 face spec (r2_faces.json): its stamps replace the ones they name, for every expression
        for px, st in r2.get("stamps", {}).items():
            F["stamps"][px].update(st)
        # round 3: a face spec may also re-map expressions (one face model across the shots)
        F["expressions"].update(r2.get("expressions", {}))
        for k in ("brow_rank", "brows_profile"):
            if k in r2:
                F[k] = r2[k]
    return F


def stamp_face(out, alpha, mat, part, meta, fp, expr_key, F, R2F=None):
    if not fp:
        return np.zeros(alpha.shape, bool), {"skip": "no facepass"}, None
    import wh2_px as W2
    W2.CH.setdefault("m", "I2")
    S = F1.FaceCanvas(alpha, mat, part, meta, fp)
    before = S.c.copy()
    geo0 = W2.face_geometry
    force = False
    an = meta.get("anchors", {})
    if R2F and R2F.get("profile_below") is not None:
        fac = [an[k][3] for k in ("eye_L", "eye_R") if k in an and len(an[k]) > 3]
        # the far eye turned away (its 3D facing under the threshold): one profile eye, the near one
        force = bool(fac) and min(fac) < R2F["profile_below"]
    if force:
        def geo_forced(S_):
            G_ = geo0(S_)
            G_["profile"] = True
            G_["near"] = "L" if an["eye_L"][3] >= an["eye_R"][3] else "R"
            G_["far"] = "R" if G_["near"] == "L" else "L"
            return G_
        W2.face_geometry = geo_forced
    try:
        rep = W2.step_face(S, F, expr_key)
    finally:
        W2.face_geometry = geo0
    rep["forced_profile"] = force
    FRGB = dict(F1.FACE_RGB)
    if R2F:
        FRGB.update(R2F.get("rgb", {}))
    ch = (S.c != before) & alpha
    allskin = np.unique(np.round(out[alpha & S.skin, :3]).astype(int), axis=0)
    allskin = allskin[np.argsort(oklab(allskin)[:, 0])]
    face_sk = np.unique(np.round(out[alpha & S.head, :3]).astype(int), axis=0)
    face_sk = face_sk[np.argsort(oklab(face_sk)[:, 0])] if len(face_sk) else allskin

    def skin(code):
        pool = face_sk if len(face_sk) >= 3 else allskin
        n = len(pool)
        i = {"S1": n - 1, "S2": max(0, n - 2), "S3": max(0, n // 2 - 1), "S4": max(0, n // 3 - 1)}[code]
        return pool[i]

    hair = np.unique(np.round(out[S.hairid, :3]).astype(int), axis=0)
    hair = hair[np.argsort(oklab(hair)[:, 0])] if len(hair) else hair
    blush = np.zeros(alpha.shape, bool)
    for y, x in zip(*np.nonzero(ch)):
        cd = W2.CODES[S.c[y, x]]
        if cd == "SB":
            blush[y, x] = True
            c = hexrgb(FRGB["SB"])
        elif cd in FRGB:
            c = hexrgb(FRGB[cd])
        elif cd.startswith("S"):
            c = skin(cd)
        elif cd.startswith("I") and len(hair):
            c = hair[min(len(hair) - 1, {"I4": 0, "I3": 1, "I2": 3, "I1": 5, "I0": 7}.get(cd, 2))]
        else:
            c = hexrgb("#231826")
        out[y, x, :3] = c
    if R2F:
        rep["_S"] = S
    return ch, rep, blush


# ---------------------------------------------------------------------------- 7b. round 2 face paint
def r2_brows(out, S, F, rep, key, hair_sorted, keep):
    """arched brows (r2_faces.json brow_near / brow_far), placed from each eye's 3D position plus its fitted shift,
    drawn only on face skin the fringe leaves open (hair stays on top), in a soft hair tone (never a black bar)"""
    import wh2_px as W2
    st = F["stamps"][key]
    if not st.get("brow_near") or not len(hair_sorted):
        return 0
    G = W2.face_geometry(S)
    mirror = rep.get("dir", 1) < 0
    allow = S.head & S.is_code(("S1", "S2", "S3")) & ~keep
    n = 0
    prof = rep.get("profile") or rep.get("forced_profile")
    if prof and F.get("brows_profile") is False:
        return 0
    roles = [("eye", "near")] if prof else [("eye_near", "near"), ("eye_far", "far")]
    btone = hair_sorted[min(len(hair_sorted) - 1, int(len(hair_sorted) * F["brow_rank"]))] if F.get("brow_rank") else         hair_sorted[min(len(hair_sorted) - 1, 3)]
    near = rep.get("near", G["near"])
    for name, role in roles:
        b = st.get("brow_near" if role == "near" else "brow_far")
        eye = near if role == "near" else ("R" if near == "L" else "L")
        e = G["eyes"][eye]
        dx, dy = rep.get("eye_shifts", {}).get(name, (0, 0))
        for x, y, ch in W2.cells(b, e[0], e[1], mirror, dx + b.get("dx", 0), dy + b.get("dy", -6)):
            if 0 <= x < S.W and 0 <= y < S.H and allow[y, x]:
                out[y, x, :3] = btone
                keep[y, x] = True
                n += 1
    return n


def r2_face_paint(out, alpha, mat, part, meta, byid, FIN, R2F, keep):
    """the painted face (critique 2): a warm shadow on the skin row under the fringe (and a part step on the row
    under it), 1 px AA where hair meets face skin (the hair pixel takes a hair-to-skin in-between), and the far
    cheek's edge one shadow step down. Only unstamped face skin; eyes, mouth, brows and blush are kept."""
    P = R2F.get("paint", {})
    hid = meta["parts"].get("head")
    skin_id = meta["materials"]["skin"]["id"]
    hairm = [m for m, n in byid.items() if n in ("hair", "hairtip")]
    face = alpha & (part == hid) & (mat == skin_id) & ~keep
    hair = alpha & np.isin(mat, hairm)
    lut = ramp_lut(FIN["materials"]["skin"]["stops"])
    sh = lut[int(P.get("fringe_shadow_t", 0.30) * 255)]
    far = lut[int(P.get("far_cheek_t", 0.27) * 255)]
    H, W = alpha.shape
    under = face & F1.shift(hair, 1, 0, False)          # hair directly above
    out[under, :3] = out[under, :3] * 0.25 + sh * 0.75
    under2 = face & F1.shift(under, 1, 0, False) & ~under
    k2 = P.get("fringe_shadow2_k", 0.35)
    out[under2, :3] = out[under2, :3] * (1 - k2) + sh * k2
    # AA: hair pixels touching face skin below or beside (not on the silhouette) step toward the skin
    ka = P.get("hair_aa_k", 0.35)
    fs = alpha & (part == hid) & (mat == skin_id)
    touch = hair & ~keep & (F1.shift(fs, -1, 0, False) | F1.shift(fs, 0, 1, False) | F1.shift(fs, 0, -1, False))
    edge_bg = sum((~F1.shift(alpha, dy, dx, False)).astype(np.int8) for dy, dx in N4) > 0
    touch &= ~edge_bg
    ys, xs = np.nonzero(touch)
    # the fringe's bottom row (face skin right under it) reads as a black brow bar when it keeps the occlusion
    # line: it takes a mid hair tone mixed toward the skin shadow instead (the refs' soft fringe edge)
    hs = np.unique(np.round(out[hair & ~keep, :3]).astype(int), axis=0)
    hs = hs[np.argsort(oklab(hs)[:, 0])] if len(hs) else hs
    hmid = hs[int(len(hs) * P.get("fringe_edge_rank", 0.35))] if len(hs) else None
    kb = P.get("fringe_edge_k", 0.4)
    for y, x in zip(ys, xs):
        below = y + 1 < H and fs[y + 1, x]
        nb = [out[y + dy, x + dx, :3] for dy, dx in ((1, 0), (0, 1), (0, -1))
              if 0 <= y + dy < H and 0 <= x + dx < W and fs[y + dy, x + dx]]
        if below and hmid is not None:
            out[y, x, :3] = hmid * (1 - kb) + sh * kb
        elif nb:
            out[y, x, :3] = out[y, x, :3] * (1 - ka) + np.mean(nb, 0) * ka * 0.8 + sh * ka * 0.2
    keep |= touch
    # far cheek: the face's edge pixels on the side the face turns toward, below the eye line
    an = meta.get("anchors", {})
    fx = an.get("head_fwd_screen", [0, 0])[0]
    nfar = 0
    if abs(fx) > 0.05 and "eye_L" in an:
        ss = meta["ss"]
        ey = max(an["eye_L"][1], an["eye_R"][1]) / ss + 1
        step = 1 if fx > 0 else -1
        for y, x in zip(*np.nonzero(face)):
            if y < ey:
                continue
            xx = x + step
            if 0 <= xx < W and not (alpha[y, xx] and part[y, xx] == hid and mat[y, xx] == skin_id):
                out[y, x, :3] = out[y, x, :3] * 0.35 + far * 0.65
                nfar += 1
    return {"fringe_shadow": int(under.sum()), "fringe_shadow2": int(under2.sum()), "hair_aa": int(len(ys)),
            "far_cheek": nfar}


def soft_blush(out, alpha, blush, keep):
    """the stamp's 2 px blush blocks -> a soft AA blush: the core at 60 % blush over the local skin, one ring of
    in-betweens at 25 % on the skin around it (never on the eyes, mouth or lines)"""
    if not blush.any():
        return 0
    B = hexrgb("#ec8f8a")
    core = blush
    ring = np.zeros_like(core)
    for dy, dx in N4:
        ring |= F1.shift(core, dy, dx, False)
    ring &= alpha & ~core & ~keep
    # local skin under the blush = the most common neighbour colour
    for m_, k in ((core, 0.55), (ring, 0.22)):
        for y, x in zip(*np.nonzero(m_)):
            c = out[y, x, :3]
            if m_ is core:
                nb = [out[y + dy, x + dx, :3] for dy, dx in N8 if 0 <= y + dy < out.shape[0] and 0 <= x + dx < out.shape[1]
                      and not core[y + dy, x + dx] and not keep[y + dy, x + dx] and alpha[y + dy, x + dx]]
                c = np.median(np.array(nb), 0) if nb else c
            out[y, x, :3] = c * (1 - k) + B * k
    return int(core.sum() + ring.sum())


# ---------------------------------------------------------------------------- main
def process(raw, FIN, preset, tag, big_eyes=True):
    pr = FIN["presets"][preset]
    meta = json.load(open(os.path.join(raw, "meta.json")))
    fpp = os.path.join(raw, "facepass.json")
    fp = json.load(open(fpp)) if os.path.exists(fpp) else None
    idm, hi = paint(raw, meta, FIN)
    nrm = np.asarray(Image.open(os.path.join(raw, "normal.png")).convert("RGB")).astype(np.float64) / 255 * 2 - 1
    dep = np.asarray(Image.open(os.path.join(raw, "depth.png")).convert("RGB")).astype(np.float64)[..., 0] / 255
    alpha, mat, part, col, n2, d2, byid = F1.downsample(meta, idm, hi, nrm, dep, pr["aa"])
    k = int(meta["ss"])
    multi = multi_label(idm, k, *alpha.shape) & alpha
    # AA only between materials (a part border inside one material keeps its own tones)
    matblk = idm[..., 0].astype(np.int32)[:alpha.shape[0] * k, :alpha.shape[1] * k].reshape(alpha.shape[0], k, alpha.shape[1], k)
    ablk = (idm[..., 3] > 0)[:alpha.shape[0] * k, :alpha.shape[1] * k].reshape(alpha.shape[0], k, alpha.shape[1], k)
    mmin = np.where(ablk, matblk, 999).min((1, 3))
    mmax = np.where(ablk, matblk, -1).max((1, 3))
    multi &= mmin != mmax
    img, pals = palette(alpha, mat, col, byid, FIN, multi)
    cl = F1.cleanup(alpha, mat, img, np.zeros_like(alpha))
    cl["face_clean"] = F1.face_clean(alpha, mat, part, img, meta)
    out, ring, ln = lines(alpha, mat, part, img, d2, byid, FIN)
    expr = meta.get("d9", {}).get("expr") or meta.get("pose")
    R2F = json.load(open(os.path.join(HERE, FIN["r2_faces"]), encoding="utf-8")) if FIN.get("r2_faces") else None
    F = faces_table(big_eyes, R2F)
    if expr not in F["expressions"]:
        expr = {"idle_appeal": "idle_hero", "back_appeal": "n2_pivot"}.get(expr, "idle_hero")
    fch, frep, blush = stamp_face(out, alpha, mat, part, meta, fp, expr, F, R2F)
    keep = fch.copy()
    r2face = None
    R3S = None
    if R2F and frep and "_S" in frep:
        S_ = frep.pop("_S")
        hair_sorted = np.unique(np.round(out[S_.hairid, :3]).astype(int), axis=0)
        hair_sorted = hair_sorted[np.argsort(oklab(hair_sorted)[:, 0])] if len(hair_sorted) else hair_sorted
        key = "144" if int(meta["px"]) >= 110 else "80"
        nbrow = r2_brows(out, S_, F, frep, key, hair_sorted, keep)
        r2face = r2_face_paint(out, alpha, mat, part, meta, byid, FIN, R2F, keep)
        r2face["brow_px"] = nbrow
        R3S = S_
        fch = keep.copy()
    r3 = FIN.get("r3") or {}
    r3rep = {}
    if r3 and r2face is not None:
        r3rep["face"] = R3.face_extras(out, alpha, mat, part, meta, byid, FIN, frep, R3S, keep)
        fch = keep.copy()
    nb = soft_blush(out, alpha, blush if blush is not None else np.zeros_like(alpha), keep & ~(blush if blush is not None else keep))
    nclump = hair_clumps(out, alpha, mat, part, byid, FIN, keep | ring | ln)
    nsh = sheen(out, alpha, mat, byid, FIN, raw, meta, keep | ring)
    if r3.get("hair"):
        r3rep["hair"] = R3.hair_r3(out, alpha, mat, part, meta, byid, FIN, keep)
    brep = bust(out, alpha, mat, part, n2, meta, FIN, raw, keep | ring) if FIN.get("bust", True) else None
    if r3.get("bust"):
        r3rep["bust"] = R3.bust_r3(out, alpha, mat, part, n2, meta, FIN, raw, keep)
    if r3.get("belly"):
        r3rep["belly_px"] = R3.belly(out, alpha, mat, part, meta, FIN, keep | ln)
    nrim = rim(out, alpha, mat, byid, FIN, n2, keep | ln) if r3.get("rim_inset", True) else 0
    rsel = np.zeros_like(alpha)
    r4 = FIN.get("r4") or {}
    if r3.get("rim_outline"):
        pre_rim = out.copy()
        r3rep["rim_outline_px"], rsel = R3.rim_outline(out, alpha, ring, mat, part, d2, byid, FIN, n2)
        if (FIN.get("r5") or {}).get("rim_arcs"):
            r3rep["r5_rim_arcs"] = R5.rim_arcs(out, pre_rim, rsel, alpha, FIN)
            rsel &= np.any(out != pre_rim, -1)
        elif r4.get("rim_limit"):
            r3rep["r4_rim_limit"] = R4.rim_limit(out, pre_rim, rsel, alpha, FIN)
            rsel &= np.any(out != pre_rim, -1)
    rq_keep = (keep | ring | ln) if r3 else (fch | ring | ln)
    cl["requant_merged"] = requant(out, alpha, mat, byid, FIN, rq_keep, FIN.get("requant_extra", 3))
    nth = F1.thong(out, alpha, mat, byid)
    if r3.get("despeckle"):
        skipm = [m for m, n in byid.items() if n in r3["despeckle"].get("skip", [])]
        prot = keep | ln | ring | np.isin(mat, skipm)
        r3rep["despeckle_px"] = R3.despeckle(out, alpha, mat, prot, r3["despeckle"].get("passes", 2))
    if r4.get("ramp_soften"):
        r3rep["r4_soften_px"] = R4.ramp_soften(out, alpha, mat, byid, keep | ln | ring | rsel, FIN)
    r5 = FIN.get("r5") or {}
    if r5.get("underbust_trim"):
        r3rep["r5_trim_px"] = R5.underbust_trim(out, alpha, mat, part, meta, byid, keep | rsel, FIN)
    fill = alpha & ~fch
    rgb = out[..., :3].copy()
    cl["checker_final"] = F1.cleanup_checkers(fill, rgb)
    out[..., :3] = rgb
    if r5.get("contour_clean"):
        r3rep["r5_contour_px"] = R5.contour_clean(out, alpha, keep | ln | rsel, FIN)
    drawn = np.zeros_like(alpha)
    if r3.get("hair", {}).get("flyaways"):
        r3rep["flyaway_px"] = R3.flyaways(out, alpha, mat, part, meta, byid, FIN, drawn)
    sil_mask = (out[..., 3] > 0).copy()
    shot = (meta.get("d9") or {}).get("shot")
    if r3.get("fx"):
        fxd = drawn.copy()
        fxd |= ring
        if shot == "n1":
            r3rep["fx_px"] = R3.fx_n1(out, alpha, meta, FIN, fxd)
        elif shot == "q":
            r3rep["fx_px"] = R3.fx_q(out, alpha, meta, FIN, fxd)
    o8 = np.clip(np.round(out), 0, 255).astype(np.uint8)
    od = os.path.join(raw, tag)
    os.makedirs(od, exist_ok=True)
    im = Image.fromarray(o8, "RGBA")
    im.save(os.path.join(od, "still.png"))
    im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(os.path.join(od, "still_x3.png"))
    fig = o8[..., 3] > 0
    if r3:
        fig = sil_mask          # the silhouette and the colour counts leave the effects out
    sil = np.zeros_like(o8)
    sil[fig] = (0, 0, 0, 255)
    Image.fromarray(sil, "RGBA").save(os.path.join(od, "sil.png"))
    for f in ("id.png", "meta.json", "facepass.json", "landmarks.json"):
        if os.path.exists(os.path.join(raw, f)):
            shutil.copy(os.path.join(raw, f), os.path.join(od, f))
    import judge_sheets as JS
    JS.f1_grounded(od).save(os.path.join(od, "still_ground.png"))
    cols = np.unique(o8[fig][:, :3], axis=0)
    tones = {}
    for mid, n in byid.items():
        m = alpha & (mat == mid)
        if m.any():
            tones[n] = int(len(np.unique(o8[m][:, :3], axis=0)))
    rep = {"preset": preset, "settings": pr, "raw": raw, "colours": int(len(cols)), "tones": tones,
           "palette_by_material": {byid[m]: len(p) for m, p in pals.items()}, "cleanup": cl,
           "inner_line_px": int(ln.sum()), "rim_px": nrim, "bust": brep, "sheen_px": nsh, "hair_clump_px": nclump, "blush_px": nb, "face_px": int(fch.sum()),
           "face": {k_: v for k_, v in (frep or {}).items() if k_ != "expr"}, "expr": expr, "r2_face": r2face, "thong_px": nth,
           "big_eyes": big_eyes, "r3": r3rep}
    json.dump(rep, open(os.path.join(od, "post.json"), "w"), indent=1, default=str)
    return rep


def _merge(a, b):
    out = dict(a)
    for k, v in b.items():
        out[k] = _merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def load_finish(path):
    """a finish json; one with 'base' (a path next to it) is deep-merged over that base (round 2's overlay)"""
    FIN = json.load(open(path, encoding="utf-8"))
    if FIN.get("base"):
        base = load_finish(os.path.join(os.path.dirname(os.path.abspath(path)), FIN["base"]))
        FIN = _merge(base, {k: v for k, v in FIN.items() if k != "base"})
    return FIN


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--preset", default="D1")
    ap.add_argument("--shots", default="idle,n1,q,back")
    ap.add_argument("--px", default="144,80")
    ap.add_argument("--finish", default=os.path.join(HERE, "d9_finish.json"))
    ap.add_argument("--tag", default=None)
    ap.add_argument("--small-eyes", action="store_true")
    a = ap.parse_args()
    FIN = load_finish(a.finish)
    tag = a.tag or a.preset
    for s in a.shots.split(","):
        for px in a.px.split(","):
            raw = os.path.join(a.root, s, f"px{px}")
            if not os.path.exists(os.path.join(raw, "meta.json")):
                continue
            r = process(raw, FIN, a.preset, tag, not a.small_eyes)
            print(f"{s} {px}: colours {r['colours']}, tones {r['tones']}, rim {r['rim_px']}, face {r['face_px']}, "
                  f"thong {r['thong_px']}, expr {r['expr']}, bust {r['bust']}", flush=True)


if __name__ == "__main__":
    main()
