"""Shading lane: run the art-rules checker (tools/art-construct/rules_check.py) on rendered stills.

  python tools/pixel-pipeline/rosace_shade_check.py --root <lane>/r1 --variants ctl,a,b [--px 144,80]
      [--only PX] [--stills idle_hero,n1_contact,q_stamp,n2_pivot_black] [--json out.json]

rules_check reads a constructed-sprite folder (sprite.png, sprite_ids.png, sprite_parts.png,
pose.json). This adapter writes one per still from the pipeline's outputs: the final still.png,
the material id (noface_id.png R) and the render parts mapped onto the construct part names the
checker knows (bodice -> torso, stockings -> leg_near, ...; a rendered body is one skin part, so
per-limb rules read it as one form). pose.json carries only the key light (screen), so the pose
rules SKIP. When a variant remaps hexes (preset "colors"), the checker is run against the lane
palette (palette.json with those hexes), set through artlib.Palette's default argument; the
checker's files are not edited.
"""
import argparse
import contextlib
import io
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
AC = os.path.join(REPO, "tools", "art-construct")
sys.path.insert(0, AC)
PARTMAP = {"bodice": "torso", "tabard": "tabard", "sleeves": "sleeve_near", "stockings": "leg_near",
           "boots": "boot_near", "veil": "veil", "collar": "collar", "collar_cross": "cross", "collar_plate": "cross",
           "head": "face", "body": "pelvis", "thong": "pelvis", "gold_harness": "torso", "gold_arm": "arm_near",
           "stole": "tabard"}


# round 2: limb ids (noface_id.png B, rosace_shade.LIMB_NAMES) refine the render parts, so the per-form
# rules see each leg, arm, sleeve and the neck; near / far by the limb's mean depth (noface_limbs.json)
LIMB_PART = {2: "neck", 3: "face", 16: "torso", 17: "torso", 18: "pelvis", 19: "pelvis", 22: "tabard", 23: "tabard"}
LIMB_PAIRS = {(4, 5): "leg", (6, 7): "leg", (8, 9): "boot", (10, 11): "arm", (12, 13): "arm", (14, 15): "hand",
              (20, 21): "sleeve"}


def adapter(still_dir, dst):
    import artlib as A
    os.makedirs(dst, exist_ok=True)
    meta = json.load(open(os.path.join(still_dir, "meta.json")))
    im = Image.open(os.path.join(still_dir, "still.png")).convert("RGBA")
    im.save(os.path.join(dst, "sprite.png"))
    idm = np.asarray(Image.open(os.path.join(still_dir, "noface_id.png")).convert("RGBA"))
    Image.fromarray(idm[..., 0].astype(np.uint8)).save(os.path.join(dst, "sprite_ids.png"))
    inv = {v: k for k, v in meta["parts"].items()}
    parts = np.zeros(idm.shape[:2], np.uint8)
    for pid in np.unique(idm[..., 1]):
        name = inv.get(int(pid), "")
        cp = PARTMAP.get(name) or ("hair_back" if name.startswith("hair") else
                                   "weapon" if name.startswith("glaive") else None)
        if cp:
            parts[idm[..., 1] == pid] = A.PART[cp]
    lf = os.path.join(still_dir, "noface_limbs.json")
    if os.path.exists(lf) and idm[..., 2].any():
        dep = {int(k): v for k, v in json.load(open(lf))["depth"].items()}
        limb = idm[..., 2]
        body = np.isin(idm[..., 0], [A.MAT[m] for m in ("skin", "stocking", "boot", "white", "lining", "gold")])
        for lid, cp in LIMB_PART.items():
            parts[body & (limb == lid)] = A.PART[cp]
        for (l_, r_), base in LIMB_PAIRS.items():
            if l_ in dep or r_ in dep:
                near = min((x for x in (l_, r_) if x in dep), key=lambda x: dep[x])
                for x in (l_, r_):
                    cp = f"{base}_{'near' if x == near else 'far'}"
                    mats = ("white", "lining", "gold") if base == "sleeve" else ("skin", "stocking", "boot", "gold")
                    parts[np.isin(idm[..., 0], [A.MAT[m] for m in mats]) & (limb == x)] = A.PART[cp]
    Image.fromarray(parts).save(os.path.join(dst, "sprite_parts.png"))
    lc = meta["light_cam"]
    json.dump({"light": [lc[0], -lc[1]], "_doc": "rendered still (rosace_shade_check.py): the key light only"},
              open(os.path.join(dst, "pose.json"), "w"))
    return dst


def run_check(sprite_dir, only, colors):
    import artlib as A
    import rules_check as RC
    if colors:
        pal = json.load(open(A.PALETTE, encoding="utf-8"))
        pal["colors"].update(colors)
        lp = os.path.join(sprite_dir, "_lane_palette.json")
        json.dump(pal, open(lp, "w"))
        A.Palette.__init__.__defaults__ = (lp,)
    else:
        A.Palette.__init__.__defaults__ = (A.PALETTE,)
    ctx = RC.Ctx(sprite_dir, None, RC.FACES)
    with contextlib.redirect_stdout(io.StringIO()):
        rows = RC.run(ctx, only)
    return rows


# ---------------------------------------------------------------------------------------------------
# Shading-lane rules (round S2; docs/character/art-rules/checklist.json lists this file as their tool).
# They read the lane's still folder directly (still.png, noface_id.png R = material, G = part,
# B = limb; the override layer's touched.json for the rim), not the adapter's copy.
WEAPON_MATS = ("haft", "steel", "steeldark", "edge", "glass", "glass2", "glasscore")
DEEP = {"skin": "S4", "white": "W4", "veil": "W4", "stocking": "K3"}


def _lum(rgb):
    c = np.asarray(rgb, float) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]


def _comps(mask, conn8=True):
    H, W = mask.shape
    seen = np.zeros_like(mask)
    nb = [(-1, 0), (1, 0), (0, -1), (0, 1)] + ([(-1, -1), (-1, 1), (1, -1), (1, 1)] if conn8 else [])
    out = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        st, pix = [(y0, x0)], []
        seen[y0, x0] = True
        while st:
            y, x = st.pop()
            pix.append((y, x))
            for dy, dx in nb:
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True
                    st.append((yy, xx))
        out.append(pix)
    return out


def lane_rules(still_dir, colors=None, layer_dir=None):
    """PX-P31..P36, PX-N13 on one lane still. Returns {id: (status, measured)}."""
    meta = json.load(open(os.path.join(still_dir, "meta.json")))
    pal = json.load(open(os.path.join(REPO, "art", "rosace", "palette.json"), encoding="utf-8"))["colors"]
    pal = dict(pal, **(colors or {}))
    inv = {tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)): k for k, v in pal.items()}
    im = np.asarray(Image.open(os.path.join(still_dir, "still.png")).convert("RGBA"))
    idm = np.asarray(Image.open(os.path.join(still_dir, "noface_id.png")).convert("RGBA"))
    H, W = im.shape[:2]
    a = im[..., 3] > 0
    fig = idm[..., 3] > 0
    ring = a & ~fig
    mats = {n: m["id"] for n, m in meta["materials"].items()}
    parts = meta.get("parts", {})
    code = np.full((H, W), "", object)
    for y, x in zip(*np.nonzero(a)):
        code[y, x] = inv.get(tuple(int(v) for v in im[y, x, :3]), "?")
    mat = np.where(fig, idm[..., 0], 0)
    part = idm[..., 1]
    L = _lum(im[..., :3])
    glaive = np.isin(part, [v for k, v in parts.items() if k.startswith("glaive")]) | np.isin(mat, [mats[m] for m in WEAPON_MATS if m in mats])
    body = fig & ~glaive
    out = {}
    # PX-P31 stocking value. Round 2b: measured as HSV value and saturation, not relative luminance: a
    # saturated royal blue (#3e3776, V 46%) has L 0.04 and passed the round-2 L test while reading as a
    # mid-value blue at 1x (round-1 critique param 14c). Dark thigh-highs: median V 15-30%, median S <= 45%
    rgbf = im[..., :3].astype(np.float64) / 255.0
    Vv = rgbf.max(-1)
    Sv = np.where(Vv > 0, (Vv - rgbf.min(-1)) / np.maximum(Vv, 1e-9), 0)
    st = fig & (mat == mats.get("stocking", -1)) & ~np.isin(code, ["OL", "G0", "G1", "G2", "G3", "G4"])
    if st.sum() >= 20:
        mv, ms_ = float(np.median(Vv[st])), float(np.median(Sv[st]))
        ok = 0.15 <= mv <= 0.30 and ms_ <= 0.45
        out["PX-P31"] = ("PASS" if ok else "FAIL", f"stocking median V {mv:.0%}, S {ms_:.0%} (L {float(np.median(L[st])):.3f})")
    else:
        out["PX-P31"] = ("SKIP", "no stockings")
    # PX-P35 no skin stripe: a one-tone skin cluster <= 2 px across its limb's axis and >= 6 px along it
    # (the round-1 critique's vertical stripes down the thighs, param 14a); per limb (noface_id B), the
    # axis from the limb's own pixels (PCA); the face and lines on material borders left out
    limb = idm[..., 2]
    skin = fig & (mat == mats.get("skin", -1)) & (part != parts.get("head", -1))
    stripes = []
    for lid in np.unique(limb[skin]):
        lm = skin & (limb == lid)
        if lm.sum() < 30:
            continue
        ys, xs = np.nonzero(lm)
        P_ = np.stack([xs, ys], 1).astype(float)
        c0 = P_.mean(0)
        _, V_ = np.linalg.eigh(np.cov((P_ - c0).T))
        ax, ac = V_[:, 1], V_[:, 0]
        for c in set(code[lm]) - {"", "?"}:
            for pix in _comps(lm & (code == c)):
                if len(pix) < 6:
                    continue
                Q = np.array([(x, y) for y, x in pix], float)
                along = np.ptp(Q @ ax) + 1
                across = np.ptp(Q @ ac) + 1
                if along >= 6 and across <= 2.5:
                    stripes.append(f"{c} limb{lid} {int(along)}x{across:.0f} at {pix[0][1]},{pix[0][0]}")
    out["PX-P35"] = ("PASS" if not stripes else "FAIL", f"{len(stripes)} skin stripes" + (f": {'; '.join(stripes[:4])}" if stripes else ""))
    # PX-P36 value map (round-1 critique param 15): >= 12% of the opaque pixels (outline ring included,
    # weapon left out) at V < 25%, and fewer than 3 palette colours at S > 60% and V > 30% each holding
    # >= 1% of them (one saturated accent family, not a toy palette)
    fb2 = (body | ring)
    n2 = max(1, fb2.sum())
    darkv = (fb2 & (Vv < 0.25)).sum() / n2
    sat = []
    for c in set(code[fb2]) - {"", "?"}:
        mm = fb2 & (code == c)
        y0, x0 = np.argwhere(mm)[0]
        if Sv[y0, x0] > 0.6 and Vv[y0, x0] > 0.3 and mm.sum() / n2 >= 0.01:
            sat.append(c)
    ok = darkv >= 0.12 and len(sat) < 3
    out["PX-P36"] = ("PASS" if ok else "FAIL", f"V<25% {darkv:.0%}; saturated colours {sorted(sat)}")
    # PX-P32 value plan (the weapon left out; the ring is the figure's outline)
    fb = body | ring
    n = fb.sum()
    dark = (fb & (L < 0.10)).sum() / n
    light = (fb & (L > 0.50)).sum() / n
    gold = (body & (mat == mats.get("gold", -1))).sum() / n
    ok = dark >= 0.25 and light >= 0.35 and gold <= 0.10
    out["PX-P32"] = ("PASS" if ok else "FAIL", f"dark {dark:.0%}, light {light:.0%}, gold {gold:.0%} of {n} px (weapon excluded)")
    # PX-P33 clusters on skin and white: no 1 px tone cluster (8-connected) among the shading tones. Left
    # out: the face, contact / inner lines (the material's inner tone on a part or material border, as
    # PX-P04 leaves them out) and pixels the override layer painted (other lanes' stamps and patches)
    head = part == parts.get("head", -1)
    border = np.zeros_like(fig)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        m2 = np.roll(np.roll(mat, dy, 0), dx, 1)
        p2 = np.roll(np.roll(part, dy, 0), dx, 1)
        border |= fig & ((m2 != mat) | (p2 != part))
    painted = np.zeros_like(fig)
    if layer_dir:
        lp = os.path.join(layer_dir, f"{os.path.splitext(os.path.basename(meta.get('pose', '')))[0]}_{meta['px']}.png")
        if os.path.exists(lp):
            painted = np.asarray(Image.open(lp).convert("RGBA"))[..., 3] > 0
    bad, where = 0, []
    for m in ("skin", "white"):
        inner = meta["materials"].get(m, {}).get("inner")
        sel = fig & (mat == mats.get(m, -1)) & ~head & ~painted & ~(border & (code == inner))
        for c in set(code[sel]) - {"", "?"}:
            for pix in _comps(sel & (code == c)):
                if len(pix) < 2:
                    bad += 1
                    where.append(f"{m} {c} {pix[0][1]},{pix[0][0]}")
    out["PX-P33"] = ("PASS" if bad == 0 else "FAIL", f"{bad} one-pixel shading clusters on skin / white" + (f": {'; '.join(where[:6])}" if where else ""))
    # PX-P34 rim inside the line: no cyan on the ring at world light; the rim <= 6% of the ring (round 3; was 3%)
    cyan = (ring & np.isin(code, ["A3", "A4"])).sum()
    rim_px = None
    if layer_dir:
        tj = os.path.join(layer_dir, f"{meta.get('pose') and os.path.splitext(os.path.basename(meta['pose']))[0]}_{meta['px']}.touched.json")
        if os.path.exists(tj):
            rim_px = json.load(open(tj))["kinds"].get("rim", {}).get("count", 0)
    share = (rim_px or 0) / max(1, ring.sum())
    ok = cyan == 0 and share <= 0.06          # round 3: was 0.03 (critique param 17: no visible rim)
    out["PX-P34"] = ("PASS" if ok else "FAIL", f"cyan ring px {cyan}; rim {rim_px} px = {share:.1%} of {ring.sum()} ring px")
    # PX-N13 no double outline: a deep tone just inside a dark silhouette line in runs of >= 3 px
    inside = fig & np.zeros_like(fig)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        sh = np.zeros_like(ring)
        sh[max(0, dy):H + min(0, dy), max(0, dx):W + min(0, dx)] = ring[max(0, -dy):H + min(0, -dy), max(0, -dx):W + min(0, -dx)]
        inside |= fig & sh
    deep = np.zeros_like(fig)
    for m, c in DEEP.items():
        deep |= inside & (mat == mats.get(m, -1)) & (code == c)
    runs = [pix for pix in _comps(deep) if len(pix) >= 3]
    out["PX-N13"] = ("PASS" if not runs else "FAIL", f"{len(runs)} deep-tone runs >= 3 px inside the outline ({sum(len(r) for r in runs)} px)")
    # PX-P37 (round 3, critique param 15): on the beige combat backdrop (#dccab0) the torso separates by >= 2
    # value steps (a step = 1.3:1, PX-P07; two = 1.69:1): the torso's shadow tones and its silhouette line
    # (median contrast against the backdrop), with no more than 35% of the torso within one step of it
    bgL = float(_lum(np.array([0xdc, 0xca, 0xb0])))
    cr = lambda l: (np.maximum(l, bgL) + 0.05) / (np.minimum(l, bgL) + 0.05)
    tl = np.isin(limb, [1, 16, 17])
    torso = fig & ((np.isin(part, [parts[p_] for p_ in ("bodice",) if p_ in parts]) & (mat == mats.get("white", -1)))
                   | (tl & (mat == mats.get("skin", -1))))
    if torso.sum() >= 30:
        shd = torso & np.isin(code, ["W3", "W4", "S3", "S4"])
        tr = np.zeros_like(ring)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            tr |= ring & np.roll(np.roll(torso, dy, 0), dx, 1)
        c_sh = float(np.median(cr(L[shd]))) if shd.any() else 0.0
        c_ln = float(np.median(cr(L[tr]))) if tr.any() else 0.0
        near = float((cr(L[torso]) < 1.3).mean())
        ok = c_sh >= 1.69 and c_ln >= 1.69 and near <= 0.35
        out["PX-P37"] = ("PASS" if ok else "FAIL", f"on #dccab0: torso shadow {c_sh:.2f}:1, torso line {c_ln:.2f}:1, "
                                                   f"{near:.0%} of the torso within one step")
    else:
        out["PX-P37"] = ("SKIP", "torso under 30 px")
    # PX-P38 (round 3, critique param 16): the outline beside skin is coloured (the skin's darkest shade), not
    # the navy OL: <= 15% of the ring pixels whose only figure 4-neighbours are body skin (the face left out,
    # FC-P18) are OL
    bskin = fig & (mat == mats.get("skin", -1)) & ~head
    sr = np.zeros_like(ring)
    other = np.zeros_like(ring)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        sr |= ring & np.roll(np.roll(bskin, dy, 0), dx, 1)
        other |= ring & np.roll(np.roll(fig & ~bskin, dy, 0), dx, 1)
    sr &= ~other            # skin alone behind the line: a junction with a dark part (haft, thong) keeps OL
    if sr.sum() >= 10:
        sh_ol = float((code[sr] == "OL").mean())
        out["PX-P38"] = ("PASS" if sh_ol <= 0.15 else "FAIL", f"{sh_ol:.0%} of {int(sr.sum())} skin-side ring px are OL")
    else:
        out["PX-P38"] = ("SKIP", "no body skin on the ring")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--variants", required=True)
    ap.add_argument("--round", default="r1")
    ap.add_argument("--px", default="144,80")
    ap.add_argument("--only", default="PX")
    ap.add_argument("--stills", default="idle_hero,n1_contact,q_stamp,n2_pivot_black")
    ap.add_argument("--json", default=None)
    ap.add_argument("--lane", action="store_true", help="also run the shading lane's rules (PX-P31..P38, PX-N13)")
    a = ap.parse_args()
    only = a.only.split(",") if a.only else None
    table = {}
    for v in a.variants.split(","):
        preset = os.path.join(REPO, "art", "rosace", "overrides", "global", f"shading_{a.round}{v}.json")
        colors = json.load(open(preset)).get("colors") if v != "ctl" and os.path.exists(preset) else None
        for s in a.stills.split(","):
            for px in a.px.split(","):
                sd = os.path.join(a.root, v, s, f"px{px}")
                if not os.path.exists(os.path.join(sd, "still.png")):
                    continue
                dst = adapter(sd, os.path.join(a.root, "_check", v, f"{s}_{px}"))
                rows = run_check(dst, only, colors)
                table[f"{v}/{s}/{px}"] = {r["id"]: (r["status"], r["measured"]) for r in rows}
                if a.lane:
                    table[f"{v}/{s}/{px}"].update(lane_rules(sd, colors, os.path.join(a.root, v, "_layers")))
    ids = sorted({i for t in table.values() for i in t})
    keys = list(table)
    # summary: pass counts per still, then the rule rows that differ between variants
    for k in keys:
        st = [s for s, _ in table[k].values()]
        print(f"{k:32} pass {sum(s.startswith('PASS') for s in st):3}  fail {sum(s.startswith('FAIL') for s in st):3}")
    if a.json:
        json.dump(table, open(a.json, "w"), indent=1)
    return table


if __name__ == "__main__":
    main()
