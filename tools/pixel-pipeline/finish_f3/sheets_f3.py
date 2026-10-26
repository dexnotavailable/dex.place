"""Route F3: measures, black-fill silhouettes and blind A/B sheets (plain Python).

  python tools/pixel-pipeline/finish_f3/sheets_f3.py metrics [--variants control,A,B,C,D]
  python tools/pixel-pipeline/finish_f3/sheets_f3.py look    [--variants ...]      # labelled, not blind
  python tools/pixel-pipeline/finish_f3/sheets_f3.py blind   [--variants ...] [--seed N]

Reads <renders>/finish-F3/<variant>/<still>/px<N>/ (run_f3.py). Writes to
review/rosace/art/finish/F3/ (git-ignored: the sheets hold third-party refs):
  metrics.json          per variant, still and size: mass (body area / H^2, glaive out, as
                        finish_metrics.py), body bbox fill, lower-body row widths / H at 0.5-0.8 H,
                        and the visibility of what the mass must not hide: skin px in the chest
                        window box, skin px on the back and seat (back view), stocking px (legs),
                        each as a share of the control's
  look/                 labelled side-by-sides (x3 and x1, stills and silhouettes): for the lane, never
                        for a critic
  <still>_<px>_x3/x1.png, <still>_<px>_sil_x3/x1.png, key.json   the blind set
Refs (finish-gap.md crops, native 1x; third-party): 07, 09 and 04 idle crops for the idle and back
sheets, the 07 and 09 attack crops plus 04 for N1. 80 px sheets resample each ref crop so the figure
is 80 px tall (box filter, then snapped to the crop's own 32-colour median-cut palette, no dither;
WF-P15). Ours stands on its contact shadow (still_ground.png; WF-P16), refs keep their painted ones.
"""
import argparse
import json
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PIPE))
sys.path.insert(0, os.path.join(REPO, "tools", "art-construct"))
import finish_metrics as FM  # noqa: E402

RENDERS = os.path.join(os.environ.get("ROSACE_BUILD", r"D:\Dex\Projects\dex-place-art\rosace\build"),
                       "renders", "finish-F3")
REVIEW = os.path.join(REPO, "review", "rosace", "art", "finish", "F3")
GAP = os.path.join(REPO, "review", "rosace", "art", "finish-gap")
BG = (104, 102, 98)
STILLS = ["idle", "n1", "back"]
# ref crops per still (finish-gap.md's crops; masks exist for the idle crops only)
REFS = {"idle": [("07", "07_idle"), ("09", "09_idle"), ("04", "04_c")],
        "back": [("07", "07_idle"), ("09", "09_idle"), ("04", "04_c")],
        "n1": [("07", "07_attack"), ("09", "09_attack"), ("04", "04_c")]}
GLAIVE = FM.GLAIVE_PARTS
MAT = {"skin": 1, "stocking": 3}


def font(n):
    try:
        return ImageFont.load_default(size=n)
    except TypeError:
        return ImageFont.load_default()


def still_dir(v, still, px):
    return os.path.join(RENDERS, v, still, f"px{px}")


# ---------------------------------------------------------------------------- measures
def measure(d):
    a, fg, mat, part = FM.load(d)
    body = fg & ~np.isin(part, GLAIVE)
    ys, xs = np.nonzero(body)
    y0, y1 = ys.min(), ys.max()
    h = y1 - y0 + 1
    rows = {}
    for f in (0.5, 0.6, 0.7, 0.8):
        r = body[int(y0 + f * h)]
        c = np.nonzero(r)[0]
        rows[str(f)] = round(float((c.max() - c.min() + 1) / h), 3) if len(c) else 0.0
    skin = fg & (mat == MAT["skin"])
    out = {"mass": round(float(body.sum() / h ** 2), 3), "bbox_fill": round(float(body.sum() / (h * (xs.max() - xs.min() + 1))), 3),
           "H": int(h), "body_px": int(body.sum()), "row_w_over_H": rows,
           "skin_px": int(skin.sum()), "stocking_px": int((fg & (mat == MAT["stocking"])).sum()),
           "skin_torso_px": int((skin[int(y0 + 0.18 * h):int(y0 + 0.52 * h)]).sum())}
    return out


def metrics(variants, pxs=(144, 80)):
    res = {"_doc": "route F3 measures (sheets_f3.py). mass = body area / H^2 with the glaive's parts out "
                   "(finish_metrics.py's definition; refs 07 0.30, 08 0.28, 09 0.35, 04 0.17, finish-gap.md 2.5). "
                   "row_w_over_H = the silhouette row width at 0.5-0.8 H from the top (hips to calves; refs 07 "
                   ".36/.46/.36/.26, 08 .25/.33/.37/.28, 09 .41/.44/.55/.65, 04 .22/.20/.12/.07). "
                   "skin_torso_px = skin between 0.18 and 0.52 H (chest window, sides, back, seat); "
                   "*_vs_control = share of the control's count (what the added cloth hides)."}
    for v in variants:
        for s in STILLS:
            for px in pxs:
                d = still_dir(v, s, px)
                if os.path.exists(os.path.join(d, "still.png")):
                    res.setdefault(v, {}).setdefault(s, {})[str(px)] = measure(d)
    for v in variants:
        for s, bypx in res.get(v, {}).items():
            for px, m in bypx.items():
                c = res.get("control", {}).get(s, {}).get(px)
                if c:
                    for k in ("skin_px", "stocking_px", "skin_torso_px", "body_px"):
                        m[k + "_vs_control"] = round(m[k] / max(1, c[k]), 3)
    os.makedirs(REVIEW, exist_ok=True)
    json.dump(res, open(os.path.join(REVIEW, "metrics.json"), "w"), indent=1)
    print(f"{'var':8}{'still':6}{'px':>4}{'mass':>7}{'fill':>7}  rows .5/.6/.7/.8      skin_torso stocking body")
    for v in variants:
        for s in STILLS:
            for px in pxs:
                m = res.get(v, {}).get(s, {}).get(str(px))
                if m:
                    print(f"{v:8}{s:6}{px:>4}{m['mass']:>7}{m['bbox_fill']:>7}  "
                          f"{'/'.join(str(x) for x in m['row_w_over_H'].values()):22}"
                          f"{m.get('skin_torso_px_vs_control', 1):>8}{m.get('stocking_px_vs_control', 1):>8}"
                          f"{m.get('body_px_vs_control', 1):>6}")
    return res


# ---------------------------------------------------------------------------- images
def ours(v, s, px, ground=True, margin=3):
    d = still_dir(v, s, px)
    p = os.path.join(d, "still_ground.png" if ground and os.path.exists(os.path.join(d, "still_ground.png"))
                     else "still.png")
    im = Image.open(p).convert("RGBA")
    b = im.getchannel("A").getbbox()
    box = (max(0, b[0] - margin), max(0, b[1] - margin), min(im.width, b[2] + margin), min(im.height, b[3] + margin))
    return im.crop(box), p


def silhouette(v, s, px, margin=3):
    d = still_dir(v, s, px)
    im = Image.open(os.path.join(d, "still.png")).convert("RGBA")
    b = im.getchannel("A").getbbox()
    im = im.crop((max(0, b[0] - margin), max(0, b[1] - margin), min(im.width, b[2] + margin), min(im.height, b[3] + margin)))
    a = np.asarray(im.getchannel("A")) > 0
    out = np.zeros(a.shape + (4,), np.uint8)
    out[a] = (0, 0, 0, 255)
    return Image.fromarray(out, "RGBA")


def ref(name, px):
    im = Image.open(os.path.join(GAP, f"ref_{name}.png")).convert("RGB")
    mp = os.path.join(GAP, f"m_{name}.npy")
    m = np.load(mp) if os.path.exists(mp) else None
    fig_h = (np.ptp(np.nonzero(m.any(1))[0]) + 1) if m is not None else im.height
    how = "native 1x crop"
    if px == 80:
        k = 80 / fig_h
        sm = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.BOX)
        q = im.quantize(32, method=Image.Quantize.MEDIANCUT)
        pal = np.array(q.getpalette()[:96], float).reshape(32, 3)
        arr = np.asarray(sm, float)
        idx = ((arr[:, :, None, :] - pal[None, None]) ** 2).sum(-1).argmin(-1)
        im = Image.fromarray(pal[idx].astype(np.uint8), "RGB")
        how = f"box x{k:.3f} (figure {fig_h} px -> 80), snapped to the crop's 32-colour median-cut palette"
    sil = None
    if m is not None:
        mm = Image.fromarray((m * 255).astype(np.uint8))
        if px == 80:
            mm = mm.resize(im.size, Image.BOX).point(lambda x: 255 if x >= 128 else 0)
        a = np.asarray(mm) > 0
        o = np.zeros(a.shape + (4,), np.uint8)
        o[a] = (0, 0, 0, 255)
        sil = Image.fromarray(o, "RGBA")
    return im, sil, how


def sheet(title, panels, zoom, bg=BG, sub=""):
    gap, lab, pad = 16 if zoom > 1 else 8, 24 if zoom > 1 else 14, 12 if zoom > 1 else 6
    H = max(im.height for _, im in panels) * zoom
    Wd = pad * 2 + sum(im.width * zoom for _, im in panels) + gap * (len(panels) - 1)
    hdr = 50 if zoom > 1 else 30
    S = Image.new("RGB", (max(Wd, 480 if zoom > 1 else 300), hdr + lab + H + pad), (24, 22, 30))
    d = ImageDraw.Draw(S)
    d.text((pad, 6), title, fill=(232, 228, 220), font=font(18 if zoom > 1 else 11))
    if sub:
        d.text((pad, 28 if zoom > 1 else 18), sub, fill=(190, 184, 170), font=font(13 if zoom > 1 else 9))
    x = pad
    for l, t in panels:
        if t.mode == "RGBA":
            c = Image.new("RGBA", t.size, bg + (255,))
            c.alpha_composite(t)
            t = c
        t = t.convert("RGB").resize((t.width * zoom, t.height * zoom), Image.NEAREST)
        S.paste(t, (x, hdr + lab + H - t.height))
        d.text((x, hdr + 3), l, fill=(232, 228, 220), font=font(14 if zoom > 1 else 9))
        x += t.width + gap
    return S


def look(variants, pxs=(144, 80)):
    out = os.path.join(REVIEW, "look")
    os.makedirs(out, exist_ok=True)
    for s in STILLS:
        for px in pxs:
            P = [(v, ours(v, s, px)[0]) for v in variants if os.path.exists(os.path.join(still_dir(v, s, px), "still.png"))]
            Q = [(v, silhouette(v, s, px)) for v, _ in P]
            for z in ((3, 1) if px == 144 else (4, 1)):
                sheet(f"F3 look (labelled, NOT blind): {s} {px}", P, z).save(os.path.join(out, f"{s}_{px}_x{z}.png"))
                sheet(f"F3 look silhouettes: {s} {px}", Q, z, bg=(228, 226, 220)).save(os.path.join(out, f"{s}_{px}_sil_x{z}.png"))
    print("look sheets in", out)


def shuffle(names, rng, ours_, controls):
    for _ in range(20000):
        o = list(names)
        rng.shuffle(o)
        if any(a == b for a, b in zip(o, names)):
            continue
        if any(({o[i], o[i + 1]} & set(ours_)) and ({o[i], o[i + 1]} & set(controls)) for i in range(len(o) - 1)):
            continue
        return o
    raise SystemExit("no shuffle meets WF-P15")


def blind(variants, seed, pxs=(144, 80)):
    rng = random.Random(seed)
    key = {"_doc": "Route F3 (mass and silhouette) blind A/B. One letter mapping per still, the same on every sheet of "
                   "that still (x3, x1, 144, 80, silhouettes; WF-P13). 'control' = the integrated canonical build "
                   "with the figure-pose lane's appeal poses (no F3 overrides); A-D = F3 variants "
                   "(tools/pixel-pipeline/finish_f3/variants.py); refNN = finish-bar ref crops (third-party, review "
                   "only). Ours stands on its contact shadow (WF-P16). Open only after writing the verdicts.",
           "question": "Which one would you pull for? Rank every panel per sheet at x3 and at 1x; on the silhouette "
                       "sheets, which reads as the biggest, clearest shape while the figure still shows?",
           "seed": seed, "sets": {}, "refs_80": None, "sources": {}}
    os.makedirs(REVIEW, exist_ok=True)
    for s in STILLS:
        names = list(variants) + [f"ref{r}" for r, _ in REFS[s]]
        order = shuffle(names, rng, [v for v in variants if v != "control"], ["control"])
        letters = "PQRSTUVWXYZ"        # no letter that is also a variant name (A-N)
        # letters by panel position, not by name, so 'A' on a sheet is never variant A by construction
        m = {}
        base = rng.randrange(0, 4)
        for i, n in enumerate(order):
            m[letters[(base + i) % len(letters)]] = n
        key["sets"][s] = m
        for px in pxs:
            P, Q = [], []
            for L, n in m.items():
                if n.startswith("ref"):
                    crop = dict(REFS[s])[n[3:]]
                    im, sil, how = ref(crop, px)
                    key["sources"].setdefault(f"{s}_{px}", {})[L] = {"ref": crop, "how": how}
                    P.append((L, im))
                    Q.append((L, sil if sil is not None else None))
                else:
                    im, p = ours(n, s, px)
                    key["sources"].setdefault(f"{s}_{px}", {})[L] = {"variant": n, "image": p}
                    P.append((L, im))
                    Q.append((L, silhouette(n, s, px)))
            Q = [(L, q) for L, q in Q if q is not None]
            for z in ((3, 1) if px == 144 else (4, 1)):
                sheet(f"F3 blind: {s} {px} (x{z})", P, z).save(os.path.join(REVIEW, f"{s}_{px}_x{z}.png"))
                sheet(f"F3 blind silhouettes: {s} {px} (x{z})", Q, z, bg=(228, 226, 220),
                      sub="refs with a figure mask only").save(os.path.join(REVIEW, f"{s}_{px}_sil_x{z}.png"))
    key["refs_80"] = ("80 px sheets: each ref crop resampled so the ref figure is 80 px tall (mask height; the attack "
                      "crops have no mask, so their crop height is used) with a box filter, then snapped to the crop's "
                      "own 32-colour median-cut palette, no dither (WF-P15); 144 px sheets: refs at their native 1x grid")
    key["shuffle"] = "WF-P15: every entry off its listed place; no F3 variant next to the control"
    json.dump(key, open(os.path.join(REVIEW, "key.json"), "w"), indent=1)
    print("blind sheets in", REVIEW)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["metrics", "look", "blind"])
    ap.add_argument("--variants", default="control,A,B,C,D")
    ap.add_argument("--seed", type=int, default=20261003)
    a = ap.parse_args()
    vs = a.variants.split(",")
    if a.cmd == "metrics":
        metrics(vs)
    elif a.cmd == "look":
        look(vs)
    else:
        blind(vs, a.seed)


if __name__ == "__main__":
    main()
