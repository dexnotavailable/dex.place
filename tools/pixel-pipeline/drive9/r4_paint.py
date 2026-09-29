"""Drive 9 whole-character round 4, ESCALATION 2: the hand-authored paint-over. The drive-9 render (d9_post.py's
still, the 'underlay') stays underneath; authored pixel layers go on top of it, per still and per size, aimed at the
look parameters the refs keep winning (face, hair strands, cloth folds, material texture). Nothing is generated:
every pixel comes from a hand-written stamp, polyline or pixel list in art/rosace/overrides/drive9/<shot>_<px>.json,
and the colours are named hex values or tones sampled from the underlay's own material ramps.

  python tools/pixel-pipeline/drive9/r4_paint.py --root <raw>/R4 [--under R4u] [--tag R4] [--shots idle,n1,q,back]
      [--px 144,80] [--layers face,hair,...]   (--layers limits the layers, for before/after sheets)
  python tools/pixel-pipeline/drive9/r4_paint.py --root <raw>/R4 --sign     (records authored_on for every file)

Override file (one per still and size; the 80 px file is authored on the 80 px underlay, never scaled from 144):
  authored_on   {"still_sha1": <underlay still.png sha1>, "canvas": [w, h]}: the render the pixels were placed on. When
                the underlay has changed, the file is STALE and nothing is painted (WF-P12: never smear a paint-over
                onto a new render); r4_paint prints it and the output still is the underlay.
  palette       letter or name -> "#rrggbb" | "mat:<material>@<t>" (the underlay's colours of that material, sorted by
                OKLab L, at fraction t: 0 = its darkest, 1 = its lightest) | "~" (erase to transparent)
  layers        a list, painted in order; every layer has a 'name' and a 'kind':
    stamp       rows (strings; '.' or ' ' leaves the pixel), at [x, y] = the top-left of rows; each letter is a
                palette key
    px          pts [[x, y, key], ...]
    line        pts [[x, y], ...] (a polyline, 1 px, Bresenham), key, or keys (one per segment: a taper)
    clumps      the fringe as hand-placed tapered locks: root_y, box, keys {body, dark, lite, gap, notch, notch2},
                clumps [{x: [xl, xr] at root_y, tip: [x, y]}] (clump_pixels)
    edge        the pixels of material 'on' whose neighbour at 'side' (up/down/left/right) is material 'next'
                (or 'bg') inside box [x0, y0, x1, y1] take key (rows deep: 'depth')
  Every layer may carry 'onkeys' (paint only where the current colour is one of these palette keys) and 'over': a list of materials (and 'bg' for the transparent ground) it may paint on; pixels
  elsewhere are left. 'why' says which critic's fix the layer answers.

Writes <raw>/<shot>/px<N>/<tag>/: still.png, still_x3.png, still_ground.png, sil.png (the figure: the underlay's
silhouette plus painted pixels on the ground, minus erased ones), the underlay's id/meta/facepass/landmarks/post
copies, and paint.json (per layer: pixels touched, stale or not, the file's sha1).
"""
import argparse
import hashlib
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PIPE))
OVR = os.path.join(REPO, "art", "rosace", "overrides", "drive9")
sys.path.insert(0, os.path.join(PIPE, "finish_f1"))
sys.path.insert(0, os.path.join(PIPE, "finish_judge"))
sys.path.insert(0, os.path.join(REPO, "tools", "art-construct"))
import f1_post as F1  # noqa: E402

SIDES = {"up": (-1, 0), "down": (1, 0), "left": (0, -1), "right": (0, 1)}


def sha1(p):
    return hashlib.sha1(open(p, "rb").read()).hexdigest()


def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def mat_map(d):
    meta = json.load(open(os.path.join(d, "meta.json")))
    idm = np.asarray(Image.open(os.path.join(d, "id.png")).convert("RGBA"))
    k = int(meta["ss"])
    sub = idm[k // 2::k, k // 2::k]
    names = {v["id"]: n for n, v in meta["materials"].items()}
    return sub, names


def material_names(img, sub, names):
    """per sprite px: the material name of the render's id at the block centre ('bg' where the underlay is empty)"""
    H, W = img.shape[:2]
    out = np.full((H, W), "bg", dtype=object)
    s = sub[:H, :W]
    for y in range(H):
        for x in range(W):
            if img[y, x, 3] == 0:
                continue
            out[y, x] = names.get(int(s[y, x, 0]), "?") if s[y, x, 3] else "?"
    return out


def resolve(pal, img, mnames):
    cols = {}
    for key, v in pal.items():
        if v == "~":
            cols[key] = None
        elif v.startswith("mat:"):
            m, t = v[4:].split("@")
            sel = (mnames == m) & (img[..., 3] > 0)
            u = np.unique(img[sel][:, :3], axis=0) if sel.any() else np.zeros((1, 3))
            L = F1.oklab(u.astype(float))[:, 0]
            u = u[np.argsort(L)]
            cols[key] = u[int(round(float(t) * (len(u) - 1)))].astype(float)
        else:
            cols[key] = hexrgb(v)
    return cols


def bresenham(p0, p1):
    x0, y0 = p0
    x1, y1 = p1
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    pts = []
    while True:
        pts.append((x0, y0))
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy
    return pts


def layer_pixels(L, img, mnames):
    """[(x, y, key)] for one layer"""
    k = L["kind"]
    px = []
    if k == "stamp":
        x0, y0 = L["at"]
        for j, row in enumerate(L["rows"]):
            for i, c in enumerate(row):
                if c not in ". ":
                    px.append((x0 + i, y0 + j, c))
    elif k == "px":
        px = [(p[0], p[1], p[2]) for p in L["pts"]]
    elif k == "line":
        pts = L["pts"]
        keys = L.get("keys") or [L["key"]] * (len(pts) - 1)
        seen = set()
        for i in range(len(pts) - 1):
            for (x, y) in bresenham(tuple(pts[i]), tuple(pts[i + 1])):
                if (x, y) in seen:
                    continue
                seen.add((x, y))
                px.append((x, y, keys[min(i, len(keys) - 1)]))
    elif k == "edge":
        x0, y0, x1, y1 = L["box"]
        dy, dx = SIDES[L.get("side", "up")]
        on, nxt = L["on"], L["next"]
        H, W = mnames.shape
        for y in range(max(0, y0), min(H, y1)):
            for x in range(max(0, x0), min(W, x1)):
                if mnames[y, x] != on:
                    continue
                for dd in range(1, L.get("depth", 1) + 1):
                    yy, xx = y + dy * dd, x + dx * dd
                    if 0 <= yy < H and 0 <= xx < W and mnames[yy, xx] == nxt:
                        px.append((x, y, L["key"]))
                        break
    elif k == "clumps":
        px = clump_pixels(L, mnames)
    return px


def clump_pixels(L, mnames):
    """the fringe as hand-placed tapered locks: each clump is a root span [xl, xr] on row root_y narrowing to its tip
    [x, y]; its left edge takes 'dark', its right edge 'lite' (the key light is from the upper right), the body 'body';
    where two clumps touch, the right one's first pixel is the 'gap' line; skin left uncovered right under a clump
    takes 'notch' (first row) and 'notch2' (second): the warm shadow under the bangs"""
    keys = L["keys"]
    ry = L["root_y"]
    cov = {}
    for ci, c in enumerate(L["clumps"]):
        xl, xr = c["x"]
        tx, ty = c["tip"]
        for y in range(ry, ty + 1):
            t = (y - ry) / max(1, ty - ry)
            a = int(round(xl + (tx - xl) * t))
            b = int(round(xr + (tx - xr) * t))
            for x in range(min(a, b), max(a, b) + 1):
                if (x, y) in cov and cov[(x, y)][0] != ci:
                    continue
                role = "body"
                if b - a >= 2 and x == a:
                    role = "dark"
                elif b - a >= 2 and x == b and y - ry <= (ty - ry) * c.get("lite_frac", 0.7):
                    role = "lite"
                if y == ty:
                    role = c.get("tip_key", "body")
                cov[(x, y)] = (ci, role)
    px = []
    for (x, y), (ci, role) in cov.items():
        left = cov.get((x - 1, y))
        if left is not None and left[0] != ci and role in ("dark", "body"):
            role = "gap"
        px.append((x, y, keys[role]))
    x0, y0, x1, y1 = L["box"]
    for x in range(x0, x1):
        col = [y for y in range(y0, y1) if (x, y) in cov]
        bottom = max(col) if col else None
        for y in range(y0, y1):
            if (x, y) in cov:
                continue
            if bottom is not None and y > bottom:
                d = y - bottom
                if d == 1:
                    px.append((x, y, keys["notch"]))
                elif d == 2 and "notch2" in keys:
                    px.append((x, y, keys["notch2"]))
                elif d > 2 and "under" in keys:
                    px.append((x, y, keys["under"]))
            elif bottom is not None and y < bottom and y >= ry:
                px.append((x, y, keys["notch"]))
    return px


def paint_one(d_under, d_out, spec, only=None):
    img = np.asarray(Image.open(os.path.join(d_under, "still.png")).convert("RGBA")).astype(float).copy()
    H, W = img.shape[:2]
    sub, names = mat_map(d_under)
    mnames = material_names(img, sub, names)
    rep = {"underlay": os.path.join(d_under, "still.png"), "underlay_sha1": sha1(os.path.join(d_under, "still.png")),
           "layers": {}, "stale": False}
    sil = np.asarray(Image.open(os.path.join(d_under, "sil.png")).convert("RGBA"))[..., 3] > 0
    if spec is not None:
        rep["file"], rep["file_sha1"] = spec["_path"], sha1(spec["_path"])
        ao = spec.get("authored_on") or {}
        if ao.get("still_sha1") and ao["still_sha1"] != rep["underlay_sha1"]:
            rep["stale"] = True
            print("STALE", spec["_path"], "authored on", ao["still_sha1"][:12], "underlay", rep["underlay_sha1"][:12])
        else:
            cols = resolve(spec.get("palette", {}), img, mnames)
            for L in spec.get("layers", []):
                if only and L["name"] not in only:
                    continue
                over = set(L["over"]) if L.get("over") else None
                onk = [cols[k_] for k_ in L.get("onkeys", [])]
                n = 0
                for (x, y, key) in layer_pixels(L, img, mnames):
                    if not (0 <= x < W and 0 <= y < H):
                        continue
                    if over is not None and mnames[y, x] not in over:
                        continue
                    if onk and not any(c_ is not None and np.allclose(img[y, x, :3], c_) for c_ in onk):
                        continue
                    c = cols[key]
                    if c is None:
                        img[y, x] = 0
                        sil[y, x] = False
                    else:
                        if img[y, x, 3] == 0:
                            sil[y, x] = True
                        img[y, x, :3] = c
                        img[y, x, 3] = 255
                    n += 1
                rep["layers"][L["name"]] = rep["layers"].get(L["name"], 0) + n
    os.makedirs(d_out, exist_ok=True)
    o8 = np.clip(np.round(img), 0, 255).astype(np.uint8)
    im = Image.fromarray(o8, "RGBA")
    im.save(os.path.join(d_out, "still.png"))
    im.resize((W * 3, H * 3), Image.NEAREST).save(os.path.join(d_out, "still_x3.png"))
    s = np.zeros_like(o8)
    s[sil] = (0, 0, 0, 255)
    Image.fromarray(s, "RGBA").save(os.path.join(d_out, "sil.png"))
    for f in ("id.png", "meta.json", "facepass.json", "landmarks.json", "post.json"):
        if os.path.exists(os.path.join(d_under, f)):
            shutil.copy(os.path.join(d_under, f), os.path.join(d_out, f))
    import judge_sheets as JS
    JS.f1_grounded(d_out).save(os.path.join(d_out, "still_ground.png"))
    rep["colours"] = int(len(np.unique(o8[sil][:, :3], axis=0)))
    json.dump(rep, open(os.path.join(d_out, "paint.json"), "w"), indent=1)
    return rep


def load_spec(shot, px):
    p = os.path.join(OVR, f"{shot}_{px}.json")
    if not os.path.exists(p):
        return None
    s = json.load(open(p, encoding="utf-8"))
    s["_path"] = p
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--under", default="R4u")
    ap.add_argument("--tag", default="R4")
    ap.add_argument("--shots", default="idle,n1,q,back")
    ap.add_argument("--px", default="144,80")
    ap.add_argument("--layers", default=None)
    ap.add_argument("--sign", action="store_true")
    a = ap.parse_args()
    only = set(a.layers.split(",")) if a.layers else None
    for s in a.shots.split(","):
        for px in a.px.split(","):
            du = os.path.join(a.root, s, f"px{px}", a.under)
            if not os.path.exists(os.path.join(du, "still.png")):
                continue
            spec = load_spec(s, px)
            if a.sign:
                if spec is None:
                    continue
                p = spec.pop("_path")
                im = Image.open(os.path.join(du, "still.png"))
                spec["authored_on"] = {"still_sha1": sha1(os.path.join(du, "still.png")), "canvas": list(im.size),
                                       "underlay": du.replace("\\", "/")}
                json.dump(spec, open(p, "w", encoding="utf-8"), indent=1)
                print("signed", p, spec["authored_on"]["still_sha1"][:12])
                continue
            r = paint_one(du, os.path.join(a.root, s, f"px{px}", a.tag), spec, only)
            print(s, px, "stale" if r["stale"] else "ok", r["layers"], "colours", r["colours"])


if __name__ == "__main__":
    main()
