"""Outfit pixel pass (art lane, round 1): rule-derived, so it survives re-renders and re-poses
(no pixel coordinates are authored; compare the hand patches of overrides.py, which go STALE).

Runs on a finished still (after overrides.py apply: face stamp, rim, patches) and touches only
outfit pixels, found through the id map (R = material, G = part):

  gold   1 px gold trims and straps (a gold pixel in no 2x2 gold block) take one gold tone that
         separates from every light neighbour at >= 1.5:1 (PX-P08, PX-N05), preferring G2, then
         G1, then G3 (PX-P27: 'a 1 px G2 line with the line tone beside it; never a 1 px run
         cycling G1/G2/G3/G0'); a thin G4 (dark-brown dirt at 80 px) is re-toned the same way; then a run pass: a pixel whose two run neighbours agree on another
         tone that also separates takes it, so a run holds one tone; a G0 glint survives only
         alone. Measured on the r0 stills: 23-49% of gold|white border pairs were under 1.5:1.
  white  a white outfit pixel touching skin at under 1.5:1 (S2/W2 is 1.03:1) takes W4, the white's
         inner tone: the contact line of CL-P03 (the garment is in front of the skin).
Parts are the outfit's (bodice, collar, tabard, sleeves, gold_harness, gold_arm, stockings,
boots, thong, collar_cross); the glaive's, the hair's and the veil's pixels are never touched, and
neither is a face-stamp pixel (skin of the head part).

  python tools/pixel-pipeline/outfit_px.py --still <render>/<still>/px<N> [--in still] [--out still_ofx]
      [--layer-dir DIR]   (also writes the pass as a layer PNG + .touched.json there)
"""
import argparse
import json
import os

import numpy as np
from PIL import Image

OUTFIT_PARTS = ("bodice", "collar", "tabard", "sleeves", "gold_harness", "gold_arm", "stockings", "boots",
                "thong", "collar_cross", "gold_strap", "gold_thigh")
LIGHT_MATS = ("white", "skin", "veil", "beige")
GOLD_PREF = ("G2", "G1", "G3")


def rel_lum(hexc):
    c = np.array([int(hexc[i:i + 2], 16) for i in (1, 3, 5)]) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return float(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2])


def ratio(a, b):
    return (max(a, b) + 0.05) / (min(a, b) + 0.05)


def run(still, tag_in="still", tag_out="still_ofx", layer_dir=None, layer_name=None):
    meta = json.load(open(os.path.join(still, "meta.json")))
    img = np.array(Image.open(os.path.join(still, tag_in + ".png")).convert("RGBA"))
    ids = np.array(Image.open(os.path.join(still, "noface_id.png")))
    H, W = img.shape[:2]
    cols = {k: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for k, h in meta["colors"].items()}
    lum = {k: rel_lum(h) for k, h in meta["colors"].items()}
    by_rgb = {v: k for k, v in cols.items()}
    code = np.empty((H, W), object)
    for y in range(H):
        for x in range(W):
            code[y, x] = by_rgb.get(tuple(img[y, x, :3])) if img[y, x, 3] else None
    mid = ids[..., 0].astype(int)
    pid = ids[..., 1].astype(int)
    M = {n: m["id"] for n, m in meta["materials"].items()}
    parts = meta.get("parts", {})
    outfit_p = [parts[p] for p in OUTFIT_PARTS if p in parts]
    in_outfit = np.isin(pid, outfit_p)
    head_p = [parts[p] for p in ("head",) if p in parts]
    gold = (mid == M["gold"]) & (img[..., 3] > 0) & np.array([[c is not None and c.startswith("G") for c in r] for r in code])
    light = np.isin(mid, [M[n] for n in LIGHT_MATS if n in M]) & (img[..., 3] > 0)
    touched = {"gold_tone": [], "gold_run": [], "white_contact": []}
    new = code.copy()
    # ---- thin gold: in no 2x2 all-gold block
    blk = np.zeros((H, W), bool)
    for dy in (0, -1):
        for dx in (0, -1):
            b = np.ones((H, W), bool)
            for ey in (0, 1):
                for ex in (0, 1):
                    yy0, xx0 = dy + ey, dx + ex
                    sh = np.zeros((H, W), bool)
                    ys = slice(max(0, -yy0), min(H, H - yy0))
                    xs = slice(max(0, -xx0), min(W, W - xx0))
                    ys2 = slice(max(0, yy0), min(H, H + yy0))
                    xs2 = slice(max(0, xx0), min(W, W + xx0))
                    sh[ys, xs] = gold[ys2, xs2]
                    b &= sh
            blk |= b
    thin = gold & ~blk & in_outfit
    N4 = ((0, 1), (1, 0), (0, -1), (-1, 0))

    def light_nb(y, x):
        out = []
        for dy, dx in N4:
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and light[yy, xx] and code[yy, xx] and not code[yy, xx].startswith("G"):
                out.append(lum[code[yy, xx]])
        return out

    def best_tone(nbs):
        if not nbs:
            return None
        for t in GOLD_PREF:
            if min(ratio(lum[t], l) for l in nbs) >= 1.5:
                return t
        return max(GOLD_PREF, key=lambda t: min(ratio(lum[t], l) for l in nbs))

    ys, xs = np.nonzero(thin)
    for y, x in zip(ys, xs):
        c = code[y, x]
        if c == "G0":
            continue
        t = best_tone(light_nb(y, x))
        if t is None:
            # no light neighbour (on the dark stockings or boots): a steady G2 unless it is the shade
            t = "G2" if c in ("G1", "G2", "G4") else c
        if t != c:
            new[y, x] = t
            touched["gold_tone"].append([int(x), int(y)])
    # run pass: along the thin line, a pixel between two agreeing neighbours takes their tone
    for _ in range(2):
        cur = new.copy()
        for y, x in zip(ys, xs):
            c = cur[y, x]
            if c == "G0":
                continue
            nb = [(y + dy, x + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy or dx)
                  and 0 <= y + dy < H and 0 <= x + dx < W and thin[y + dy, x + dx]]
            if len(nb) != 2:
                continue
            a, b = cur[nb[0]], cur[nb[1]]
            if a == b and a != c and a in GOLD_PREF:
                nbs = light_nb(y, x)
                if not nbs or min(ratio(lum[a], l) for l in nbs) >= 1.5:
                    new[y, x] = a
                    touched["gold_run"].append([int(x), int(y)])
    # a G0 glint only alone
    for y, x in zip(ys, xs):
        if new[y, x] == "G0":
            if any(0 <= y + dy < H and 0 <= x + dx < W and new[y + dy, x + dx] == "G0"
                   for dy, dx in N4):
                new[y, x] = "G1"
                touched["gold_tone"].append([int(x), int(y)])
    # ---- white against skin
    white = (mid == M["white"]) & in_outfit & (img[..., 3] > 0)
    skin = (mid == M["skin"]) & ~np.isin(pid, head_p) & (img[..., 3] > 0)
    ys, xs = np.nonzero(white)
    for y, x in zip(ys, xs):
        c = new[y, x]
        if not c or not c.startswith("W") or c == "W4":
            continue
        for dy, dx in N4:
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and skin[yy, xx] and code[yy, xx] and code[yy, xx].startswith("S"):
                if ratio(lum[c], lum[code[yy, xx]]) < 1.5:
                    new[y, x] = "W4"
                    touched["white_contact"].append([int(x), int(y)])
                    break
    out = img.copy()
    layer = np.zeros_like(img)
    for y in range(H):
        for x in range(W):
            if new[y, x] != code[y, x] and new[y, x]:
                out[y, x, :3] = cols[new[y, x]]
                layer[y, x] = list(cols[new[y, x]]) + [255]
    Image.fromarray(out).save(os.path.join(still, tag_out + ".png"))
    for z in (3, 6):
        Image.fromarray(out).resize((W * z, H * z), Image.NEAREST).save(os.path.join(still, f"{tag_out}_x{z}.png"))
    if layer_dir:
        os.makedirs(layer_dir, exist_ok=True)
        nm = layer_name or os.path.basename(os.path.dirname(still)) + "_" + os.path.basename(still)
        Image.fromarray(layer).save(os.path.join(layer_dir, nm + "_outfit.png"))
        json.dump({k: v for k, v in touched.items()}, open(os.path.join(layer_dir, nm + "_outfit.touched.json"), "w"))
    return {k: len(v) for k, v in touched.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--still", required=True)
    ap.add_argument("--in", dest="tag_in", default="still")
    ap.add_argument("--out", dest="tag_out", default="still_ofx")
    ap.add_argument("--layer-dir", default=None)
    a = ap.parse_args()
    print(a.still, run(a.still, a.tag_in, a.tag_out, a.layer_dir))


if __name__ == "__main__":
    main()
