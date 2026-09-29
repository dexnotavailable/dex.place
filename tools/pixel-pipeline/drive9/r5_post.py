"""Drive 9 whole-character round 5, pixel side: a library for d9_post.py, used only when the finish json has an 'r5'
block (drive9/r5_finish.json). Numpy on our own render passes; nothing is generated. Each step answers a round-4 blind
critic (review/rosace/art/drive9/round-4/verdicts/):

  rim_arcs       rim light 17 (4.5): 'the rim appears as dotted white beads on the dark sleeve edge, reads as noise
                 rather than light; threshold to solid 1 px arcs'. Replaces round 4's rim_limit (which kept 3 px
                 islands, 7 px apart: the beads). A rim run shorter than min_run goes back to the outline; a longer one
                 keeps ONE contiguous arc of up to max_len px, walked along the run from its most rim-facing pixel
                 (a second arc only on runs longer than second_after, at least gap px from the first).
  contour_clean  pixel craft 16 (5.5): 'orphan light pixels stippled along the tabard and sleeve outlines (dashed
                 grey/white beads on the left edge) ... remove isolated contour pixels (1 px islands differing from both
                 neighbours)'. On the silhouette's own ring (figure pixels with a ground 4-neighbour), a pixel lighter
                 than every ring neighbour by more than min_dl in OKLab L, whose colour no ring neighbour shares, takes
                 the colour of its closest-in-value darker ring neighbour. Face, lines and rim are protected.
  underbust_trim outfit 13 (weapon-grip-outfit critic): 'bodice still grey blobs ... bodice tension lines + gold
                 underbust trim'; body 5: 'a 2-tone underbust shadow'. The bodice part's bottom edge over skin becomes
                 a 1 px gold trim (the gold material's own tone at t), and the skin pixel under it one shadow step.
"""
from collections import deque

import numpy as np

import f1_post as F1

N4, N8 = F1.N4, F1.N8
oklab = F1.oklab


def _cfg(FIN, key):
    return (FIN.get("r5") or {}).get(key) or {}


def rim_arcs(out, before, sel, alpha, FIN):
    cfg = _cfg(FIN, "rim_arcs")
    if not cfg or not sel.any():
        return {"kept": int(sel.sum()), "reverted": 0, "arcs": 0}
    R = np.array(FIN["rim_dir"], float)
    R /= np.linalg.norm(R)
    H, W = alpha.shape
    min_run, max_len = int(cfg.get("min_run", 5)), int(cfg.get("max_len", 7))
    lab, n = F1.clusters(sel)
    keep = np.zeros_like(sel)
    arcs = 0
    for k in range(1, n + 1):
        ys, xs = np.nonzero(lab == k)
        if len(ys) < min_run:
            continue
        pts = set(zip(ys.tolist(), xs.tolist()))
        sc = {}
        for y, x in pts:
            ox = oy = 0.0
            for dy, dx in N8:
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and alpha[yy, xx] and (yy, xx) not in pts:
                    ox -= dx
                    oy -= dy
            o = np.array([ox, oy])
            sc[(y, x)] = float(o @ R) / (np.linalg.norm(o) + 1e-6)
        peaks = [max(sc, key=sc.get)]
        if len(pts) > cfg.get("second_after", 20):
            far = [p for p in pts if abs(p[0] - peaks[0][0]) + abs(p[1] - peaks[0][1]) >= cfg.get("gap", 12)]
            if far:
                peaks.append(max(far, key=sc.get))
        for pk in peaks:
            # walk the run from the peak (breadth-first along the 8-connected run): a contiguous arc
            seen, q, got = {pk}, deque([pk]), []
            while q and len(got) < max_len:
                p = q.popleft()
                got.append(p)
                for dy, dx in N8:
                    nb = (p[0] + dy, p[1] + dx)
                    if nb in pts and nb not in seen:
                        seen.add(nb)
                        q.append(nb)
            for p in got:
                keep[p] = True
            arcs += 1
    drop = sel & ~keep
    out[drop] = before[drop]
    return {"kept": int(keep.sum()), "reverted": int(drop.sum()), "arcs": arcs}


def contour_clean(out, alpha, protect, FIN):
    cfg = _cfg(FIN, "contour_clean")
    if not cfg:
        return 0
    H, W = alpha.shape
    fig = out[..., 3] > 0
    bgn = np.zeros((H, W), bool)
    for dy, dx in N4:
        bgn |= ~F1.shift(fig, dy, dx, False)
    ring = fig & bgn
    L = oklab(np.clip(out[..., :3], 0, 255))[..., 0]
    rgb = np.round(out[..., :3]).astype(int)
    min_dl = cfg.get("min_dl", 0.10)
    n = 0
    for _ in range(int(cfg.get("passes", 1))):
        ys, xs = np.nonzero(ring & ~protect)
        for y, x in zip(ys, xs):
            nbs = [(y + dy, x + dx) for dy, dx in N8 if 0 <= y + dy < H and 0 <= x + dx < W and ring[y + dy, x + dx]]
            if len(nbs) < 2:
                continue
            if any((rgb[p] == rgb[y, x]).all() for p in nbs):
                continue
            Ln = np.array([L[p] for p in nbs])
            if L[y, x] <= Ln.max() + min_dl:
                continue
            darker = [p for p in nbs if L[p] < L[y, x]]
            p = min(darker, key=lambda q: L[y, x] - L[q])
            out[y, x, :3] = out[p][:3]
            rgb[y, x] = rgb[p]
            L[y, x] = L[p]
            n += 1
    return n


def underbust_trim(out, alpha, mat, part, meta, byid, protect, FIN):
    cfg = _cfg(FIN, "underbust_trim")
    if not cfg:
        return 0
    parts = meta.get("parts", {})
    bod = parts.get(cfg.get("part", "bodice"))
    if bod is None:
        return 0
    mid = {v: k for k, v in byid.items()}
    skin, gold = mid.get("skin"), mid.get("gold")
    H, W = alpha.shape
    g = alpha & (mat == gold) if gold is not None else np.zeros_like(alpha)
    if not g.any():
        return 0
    gc = np.unique(np.round(out[g][:, :3]).astype(int), axis=0)
    gc = gc[np.argsort(oklab(gc.astype(float))[:, 0])]
    trim = gc[int(round(cfg.get("t", 0.6) * (len(gc) - 1)))].astype(float)
    trim_dk = gc[int(round(cfg.get("t_dark", 0.25) * (len(gc) - 1)))].astype(float)
    sk = alpha & (mat == skin)
    skc = np.unique(np.round(out[sk][:, :3]).astype(int), axis=0) if sk.any() else None
    if skc is not None and len(skc):
        skc = skc[np.argsort(oklab(skc.astype(float))[:, 0])]
    n = 0
    rows = int(cfg.get("rows", 1))
    ys, xs = np.nonzero(alpha & (part == bod))
    for y, x in zip(ys, xs):
        if protect[y, x]:
            continue
        yy = y + 1
        if yy >= H or not alpha[yy, x] or part[yy, x] == bod or mat[yy, x] != skin:
            continue
        # the trim: lit on the side toward the key light (screen right), darker on the far side of the torso's column
        out[y, x, :3] = trim if x >= xs.mean() - cfg.get("dark_left", 0) else trim_dk
        for r in range(1, rows + 1):
            if y + r < H and mat[y + r, x] == skin and not protect[y + r, x] and skc is not None:
                Lp = oklab(out[y + r, x, :3][None])[0, 0]
                Ls = oklab(skc.astype(float))[:, 0]
                lower = np.nonzero(Ls < Lp - 0.02)[0]
                if len(lower):
                    out[y + r, x, :3] = skc[lower[-1 - min(len(lower) - 1, cfg.get("skin_steps", 1) - 1)]]
        n += 1
    return n
