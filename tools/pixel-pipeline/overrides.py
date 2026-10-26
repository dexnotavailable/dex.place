"""Hand override layers for Rosace key stills, kept separate from the renders.

A key still = render (rosace_post.py --no-face -> noface.png) + face stamp (faces.py) +
override layer (art/rosace/overrides/<pose>_<px>.png). Re-rendering rewrites only the first
part; the face and the override layer are re-composited on top, so hand work survives.

Source of truth for a layer: art/rosace/overrides/<pose>_<px>.json (authored ops, below).
`build` turns it into the layer PNG (what gets composited) and <pose>_<px>.touched.json
(every pixel the layer touches, grouped by kind). The PNG is the layer; the JSON says why.

Layer PNG: same size as the sprite. alpha 0 = leave the render; an opaque palette colour =
paint it; opaque #ff00ff = erase to transparent (silhouette cleanup).

Ops file:
  {
    "face": {"facing": "q34", "expr": "resolute", "dx": 0, "dy": 0,    # stamp choice + nudge
             "far_dx": 0},                     # 3/4 compression: far-eye half of the stamp shifts
    "patches": [                                                           # applied in order
      {"kind": "hand", "note": "...", "at": [x, y], "rows": ["..sS", ...], "key": {"S": "S2"}},
      {"kind": "hand", "stamp": "fist_v", "at": [x, y], "flip": false},   # hand library stamp
      {"kind": "fold", "px": [[x, y, "W3"], ...]},
      {"kind": "cleanup", "erase": [[x, y], ...]},
      {"kind": "relight", "box": [x0, y0, x1, y1], "mat": "skin", "map": {"S3": "S2"}},
      {"kind": "hair", "lines": [{"pts": [[x, y], ...], "c": "I4"}, ...], "on": ["hair"]},
      {"kind": "hair", "despeckle": {"box": [x0, y0, x1, y1], "mat": "hair", "codes": ["I4"], "max": 2}},
      {"kind": "hair", "tips": {"box": [x0, y0, x1, y1], "ramp": ["A2", "A3", "A4"]}},  # azure strand ends
      {"kind": "form", "on": ["skin"], "polys": [{"pts": [[x, y], ...], "c": "S3", "only": ["S2"]}],
                                       "ellipses": [{"box": [x0, y0, x1, y1], "c": "S1"}]}   # painted form
    ],
    "preface": [ ... ],   # round 4: bang edge / face-window edits made BEFORE the face stamp (see preface())
    "rim": {"level": "half" | "full", "family": "cool" | "warm", "dir": [-0.62, -0.78], "thr": 0.45},
    "authored_on": {"canvas": [W, H], "anchor": [x, y], "pose_sha1": "..."}  # the render the patches fit
  }
"lines" are hand-placed polylines (1 px, Bresenham between the listed points): clump separators,
angel-ring dashes, fold creases, blade edges. "on" (any patch) limits painting to pixels whose
rendered material is in the list. A patch never paints over a face-stamp pixel unless it says
"over_face": true. "despeckle" replaces islands of the listed codes (<= max px, 8-connected) inside
the material with the most common neighbouring code (render specks in the hair mass).
Patches are pixel coordinates on one particular render. When the still no longer matches
'authored_on' (a re-pose or a model change moved the pixels), the patches are STALE: build
skips them (face stamp and rim still apply) and says so, until they are re-authored.
Rows use faces.KEY letters plus uppercase palette-code shortcuts from ROWKEY; 'x' erases.
The rim is rule-derived from DESIGN.md section 9 (lit outline), implemented in rim.py (shared
with rosace_post.py --rim): convex, light-facing silhouette runs only, broken at material
changes and every few pixels, peaks brighter, none below the knee, only a glint on the head.

  python overrides.py build --still <render>/px<N> --layer <pose>_<N>
  python overrides.py apply --still <render>/px<N> --layer <pose>_<N>   -> still.png (+x3, x6)
  python overrides.py build|apply ... --layer-dir <dir> [--ops <other layer>]   (v2 refit: layers
      built outside the repo; an 80 px still borrowing the 144 layer's face choice and rim)
  python overrides.py authored --still <render>/px<N> --layer <pose>_<N>   record that the
      patches were (re)painted on this render ('authored_on' from its meta.json)
"""
import argparse
import json
import os

import numpy as np
from PIL import Image

import faces

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
ODIR = os.path.join(REPO, "art", "rosace", "overrides")
# where built layer PNGs / .touched.json go and where apply reads the PNG (--layer-dir); the
# authored ops JSON is always read from ODIR. Default ODIR, as before.
LDIR = ODIR
OPS_LAYER = {}      # layer -> the layer whose ops JSON to use (--ops), e.g. an 80 px still on 144 ops
HANDS = os.path.join(REPO, "art", "rosace", "hands")
ERASE = (255, 0, 255)
ROWKEY = dict(faces.KEY)
ROWKEY.update({"S": "S2", "L": "S1", "T": "S3", "M": "S4", "W": "W1", "X": "W2", "Y": "W3", "Z": "W4",
               "G": "G2", "H": "G1", "J": "G3", "K": "G4", "Q": "G0", "I": "I2", "U": "I1", "V": "I3",
               "N": "I4", "E": "I0", "B": "B1", "C": "B2", "A": "A4", "F": "A5"})


def load_still(still, tag="noface"):
    meta = json.load(open(os.path.join(still, "meta.json")))
    img = np.array(Image.open(os.path.join(still, tag + ".png")).convert("RGBA"))
    mat = np.asarray(Image.open(os.path.join(still, tag + "_id.png")).convert("RGBA"))[..., 0].astype(int)
    meta["_still"], meta["_tag"] = still, tag     # glyphs.py reads the part ids next to the render
    return meta, img, mat


def ops_for(layer):
    p = os.path.join(ODIR, OPS_LAYER.get(layer, layer) + ".json")
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}


def face_layer(meta, img, mat, ops, keep=None):
    """returns (image with the face, touched mask, stamp name); pixel glyphs (glyphs.py: the v2
    collar cross) are stamped with the face and count as face pixels (patches keep off them)"""
    out, t, name = _face_layer(meta, img, mat, ops, keep)
    import glyphs
    g = glyphs.apply(meta, out, ops)
    return out, t | g, name


def _face_layer(meta, img, mat, ops, keep=None):
    an = meta.get("anchors") or {}
    f = ops.get("face", {})
    if f.get("off") or "eye_L" not in an:
        return img.copy(), np.zeros(mat.shape, bool), None
    v2 = faces.v2_face(meta, img, mat, ops, keep)    # the v2 head's face lane route (needs a face pass)
    if v2 is not None:
        return v2
    facing = f.get("facing") or faces.facing_of(an)[0]
    if facing is None:
        return img.copy(), np.zeros(mat.shape, bool), None
    expr = f.get("expr") or meta.get("expression") or "serene"
    st = faces.load(facing, expr, meta["px"])
    if st is None:
        print(f"no face stamp for {facing}/{expr} at {meta['px']} px: face skipped")
        return img.copy(), np.zeros(mat.shape, bool), None
    if f.get("far_dx"):
        st = dict(st, far_dx=f["far_dx"])
    out = img.copy()
    mats = meta["materials"]
    at = faces.anchor_px(meta, an, f.get("dx", 0), f.get("dy", 0))
    t = faces.apply(out, mat, st, at, an["head_fwd_screen"][0] < 0, mats["skin"]["id"],
                    [mats[n]["id"] for n in ("hair", "hairtip") if n in mats], keep=keep)
    return out, t, st["_name"]


def rim(img, mat, meta, spec, pal, code_of):
    """lit outline per DESIGN.md s9 (rim.py); returns list of (x, y, code, kind)"""
    import rim as rimlib
    an = meta.get("anchors") or {}
    ss = meta.get("ss", 1)
    px = meta["px"]
    kw = {}
    ks = [an[k][1] for k in ("knee_L", "knee_R") if k in an]
    if ks:
        kw["knee_y"] = sum(ks) / len(ks) / ss
    if "head" in an:
        hx, hy = an["head"][0] / ss, an["head"][1] / ss
        kw["head_box"] = (hx - 0.13 * px, hy - 0.22 * px, hx + 0.13 * px, hy + 0.03 * px)
    names = {m["id"]: n for n, m in meta["materials"].items()}
    return rimlib.rim_pixels(img, mat, {k: tuple(v) for k, v in pal.items()}, code_of, spec, mat_names=names, **kw)


def polyline(pts):
    """1 px Bresenham through the points (inclusive), no repeated pixels"""
    out = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:] or pts):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x1 > x0 else -1), (1 if y1 > y0 else -1)
        err = dx + dy
        x, y = x0, y0
        while True:
            if not out or out[-1] != (x, y):
                out.append((x, y))
            if x == x1 and y == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x += sx
            if e2 <= dx:
                err += dx
                y += sy
    return out


def despeckle(work, mat, mats, code_of, spec):
    """islands (8-connected) of spec['codes'] up to spec['max'] px inside material spec['mat'] and
    spec['box'] -> the most common neighbouring code of that material; returns [(x, y, code)]"""
    x0, y0, x1, y1 = spec["box"]
    mid = mats[spec.get("mat", "hair")]["id"]
    codes = set(spec.get("codes", ["I4"]))
    mx = spec.get("max", 2)
    H, W = mat.shape

    def code(x, y):
        return code_of.get(tuple(work[y, x, :3])) if work[y, x, 3] else None

    seen = set()
    out = []
    for y in range(max(0, y0), min(H, y1 + 1)):
        for x in range(max(0, x0), min(W, x1 + 1)):
            if (x, y) in seen or mat[y, x] != mid or code(x, y) not in codes:
                continue
            comp, stack = [], [(x, y)]
            seen.add((x, y))
            while stack:
                cx, cy = stack.pop()
                comp.append((cx, cy))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and mat[ny, nx] == mid \
                                and code(nx, ny) in codes:
                            seen.add((nx, ny))
                            stack.append((nx, ny))
            if len(comp) > mx:
                continue
            cs = set(comp)
            votes = {}
            for cx, cy in comp:
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if (nx, ny) in cs or not (0 <= nx < W and 0 <= ny < H):
                            continue
                        c = code(nx, ny)
                        if c and c not in codes and mat[ny, nx] == mid:
                            votes[c] = votes.get(c, 0) + 1
            if votes:
                c = max(votes, key=votes.get)
                out.extend((cx, cy, c) for cx, cy in comp)
    return out


def hair_tips(work, mat, mats, spec):
    """DESIGN.md s6 azure tips: every free hair end in spec['box'] (a hair pixel whose pixel below
    is outline or empty, i.e. the strand ends in the air, not behind the body) takes the ramp
    spec['ramp'] (top -> bottom, default A2, A3, A4) over its last len(ramp) pixels; a pixel is
    only recoloured while it is still hair."""
    x0, y0, x1, y1 = spec["box"]
    ids = {mats[n]["id"] for n in spec.get("mats", ["hair", "hairtip"]) if n in mats}
    ramp = spec.get("ramp", ["A2", "A3", "A4"])
    ol = tuple(int(faces.palette()["OL"][i]) for i in range(3))
    H, W = mat.shape
    out = []

    def empty_or_line(x, y):
        return not (0 <= y < H) or work[y, x, 3] == 0 or (mat[y, x] == 0 and tuple(work[y, x, :3]) == ol)

    def hair(x, y):
        return 0 <= x < W and 0 <= y < H and mat[y, x] in ids

    for x in range(max(0, x0), min(W, x1 + 1)):
        for y in range(max(0, y0), min(H - 1, y1 + 1)):
            # a strand end: nothing below it or diagonally below (a side edge that steps outward
            # is not an end), and hair above it for the whole ramp
            if hair(x, y) and empty_or_line(x, y + 1) and (y + 2 >= H or empty_or_line(x, y + 2)) \
                    and not hair(x - 1, y + 1) and not hair(x + 1, y + 1) \
                    and all(hair(x, y - j) for j in range(1, len(ramp))):
                n = len(ramp)
                for j in range(n):
                    yy = y - (n - 1 - j)
                    if yy >= 0 and mat[yy, x] in ids:
                        out.append((x, yy, ramp[j]))
    return out


def authored(still, layer, label="stills round 2"):
    """stamp 'authored_on' with this render's canvas / anchor / pose hash (after re-painting)"""
    meta = json.load(open(os.path.join(still, "meta.json")))
    p = os.path.join(ODIR, layer + ".json")
    ops = json.load(open(p, encoding="utf-8"))
    ops["authored_on"] = {"round": label, "canvas": meta.get("canvas"), "anchor": meta.get("anchor"),
                          "pose_sha1": meta.get("pose_sha1"),
                          "_doc": "The render these patches were painted on. overrides.py applies 'patches' only "
                                  "when the still matches (same canvas, anchor and pose file); otherwise they are "
                                  "stale pixel coordinates and are skipped until re-authored."}
    json.dump(ops, open(p, "w", encoding="utf-8"), indent=1)
    print(layer, "authored_on", meta.get("canvas"), meta.get("anchor"), meta.get("pose_sha1"))


def stale(meta, ops):
    """True when the patches were painted on a different render than this still"""
    a = ops.get("authored_on")
    if not a or not ops.get("patches"):
        return False
    return (list(a.get("canvas", [])) != list(meta.get("canvas", [])) or
            list(a.get("anchor", [])) != list(meta.get("anchor", [])) or
            (a.get("pose_sha1") and meta.get("pose_sha1") and a["pose_sha1"] != meta["pose_sha1"]))


FAMILY = {"S": "skin", "I": "hair", "W": "white", "G": "gold"}


def preface(meta, img, mat, ops, pal):
    """round 4: edits applied to the render BEFORE the face stamp, so the stamp's skin mask sees
    the corrected head. ops["preface"] is a list of patches:
      {"kind": "bangs", "at": [x, y], "rows": [...]}   rows in ROWKEY letters; a pixel painted in an
          S* code becomes skin, I* hair, W* white, G* gold (or "as": "<material>"), 'x' erases.
          Used for the bang edge: skin notches ('k' / 'S') cut into the fringe so the lash row sits
          1 px below the tips, pointed clump tips ('I', 'V'), the 1 px S3 shadow the tips cast.
      {"kind": "facewin", "box": [x0, y0, x1, y1] | "poly": [[x, y], ...], "from": ["veil", ...],
          "to": "S2"}   face-window mask: every pixel of the listed materials inside the window
          becomes skin (veil / collar / separator pixels that fell on the jaw or cheek).
      "px" / "lines" as in patches.
    returns (img, mat, kinds) with kinds[y, x] = patch kind for every pixel it set."""
    pre = ops.get("preface") or []
    H, W = mat.shape
    kinds = np.full((H, W), "", object)
    if not pre or stale(meta, ops):
        return img, mat, kinds
    img, mat = img.copy(), mat.copy()
    mats = meta["materials"]

    def put(x, y, code, kind, as_=None):
        if not (0 <= x < W and 0 <= y < H):
            return
        if code == "x":
            img[y, x] = 0
            mat[y, x] = 0
        else:
            img[y, x, :3] = pal[code]
            img[y, x, 3] = 255
            m = as_ or FAMILY.get(code[0])   # "as": "keep" leaves the material id alone
            if m in mats:
                mat[y, x] = mats[m]["id"]
        kinds[y, x] = kind

    for p in pre:
        k = p.get("kind", "preface")
        key = dict(ROWKEY)
        key.update(p.get("key", {}))
        if "rows" in p:
            x0, y0 = p["at"]
            for j, row in enumerate(p["rows"]):
                for i, ch in enumerate(row):
                    if ch not in ". ":
                        put(x0 + i, y0 + j, "x" if ch == "x" else key[ch], k, p.get("as"))
        for x, y, c in p.get("px", []):
            put(x, y, c, k, p.get("as"))
        for ln in p.get("lines", []):
            for x, y in polyline(ln["pts"]):
                put(x, y, ln["c"], k, p.get("as"))
        if "edge" in p:
            # bang edge: [[x, y_last_hair], ...] with "span": [y_top, y_limit]. In each listed column,
            # skin at or above y_last_hair becomes hair ("hair" code, default I2; the last pixel takes
            # "tip" when given) and hair below it, down to y_limit, becomes S2 skin: the fringe
            # profile (pointed clump tips, notches) is authored, the render's shading kept elsewhere.
            ya, yb = p["span"]
            hid, sid = mats["hair"]["id"], mats["skin"]["id"]
            hair_ids = {mats[n]["id"] for n in ("hair", "hairtip") if n in mats}
            for x, yl in p["edge"]:
                for y in range(ya, yb + 1):
                    if not (0 <= x < W and 0 <= y < H):
                        continue
                    if y <= yl and (mat[y, x] == sid or (y == yl and p.get("tip"))):
                        put(x, y, p["tip"] if (y == yl and p.get("tip")) else p.get("hair", "I2"), k, "hair")
                    elif y > yl and mat[y, x] in hair_ids:
                        put(x, y, p.get("skin", "S2"), k, "skin")
        if p.get("adopt_skin"):
            # skin-coloured (S1-S4) pixels the id pass labelled as another material (anti-aliased
            # contour pixels: 'S3 on hair'), inside the box, become skin so flatten() / the stamp
            # mask treat them as face
            x0, y0, x1, y1 = p["box"]
            scodes = [tuple(pal[c]) for c in ("S1", "S2", "S3", "S4")]
            for y in range(max(0, y0), min(H, y1 + 1)):
                for x in range(max(0, x0), min(W, x1 + 1)):
                    if img[y, x, 3] and tuple(img[y, x, :3]) in scodes and mat[y, x] != mats["skin"]["id"]:
                        mat[y, x] = mats["skin"]["id"]
                        kinds[y, x] = k
        if "from" in p:
            from PIL import ImageDraw
            m = Image.new("L", (W, H), 0)
            dr = ImageDraw.Draw(m)
            if "poly" in p:
                dr.polygon([tuple(pt) for pt in p["poly"]], fill=255)
            else:
                dr.rectangle(p["box"], fill=255)
            ids = {mats[n]["id"] for n in p["from"] if n in mats}
            sel = (np.asarray(m) > 0) & np.isin(mat, list(ids)) & (img[..., 3] > 0)
            for y, x in zip(*np.nonzero(sel)):
                put(int(x), int(y), p.get("to", "S2"), k, p.get("as", "skin"))
    return img, mat, kinds


def build(still, layer):  # noqa: C901
    meta, img, mat = load_still(still)
    pal = faces.palette()
    code_of = {v: k for k, v in pal.items()}
    ops = ops_for(layer)
    # what apply() starts from (render + face on the raw render); the layer is the diff against it
    base_apply, _, _ = face_layer(meta, img, mat, ops)
    img, mat, pre_kinds = preface(meta, img, mat, ops, pal)
    # preface "contour" pixels are hand-painted shading: the stamp's skin flattening must keep them
    base, face_t, fname = face_layer(meta, img, mat, ops, keep=pre_kinds == "contour")
    work = base.copy()
    wmat = mat.copy()
    H, W = mat.shape
    kinds = pre_kinds.copy()
    kinds[(kinds == "") & face_t] = "face"
    mats = meta["materials"]

    def put(x, y, code, kind, on=None, over_face=False):
        if not (0 <= x < W and 0 <= y < H):
            return
        if face_t[y, x] and not over_face:
            return
        if on is not None and mat[y, x] not in on:
            return
        if code == "x":
            work[y, x] = 0
            wmat[y, x] = 0
        else:
            work[y, x, :3] = pal[code]
            work[y, x, 3] = 255
        kinds[y, x] = kind

    patches = ops.get("patches", [])
    if stale(meta, ops):
        print(f"{layer}: STALE patches skipped ({len(patches)}): painted on canvas "
              f"{ops['authored_on'].get('canvas')} / anchor {ops['authored_on'].get('anchor')}, this still is "
              f"{meta.get('canvas')} / {meta.get('anchor')}; re-author them on this render")
        patches = []
    for p in patches:
        k = p["kind"]
        on = {mats[n]["id"] for n in p["on"] if n in mats} if p.get("on") else None
        of = bool(p.get("over_face"))
        if "stamp" in p:
            # round 3: a named stamp from the hand library (art/rosace/hands/<stamp>_<px>.json),
            # its origin placed on 'at'; 'flip' mirrors it (arm from the other side), 'vflip' too
            st = json.load(open(os.path.join(HANDS, f"{p['stamp']}_{meta['px']}.json"), encoding="utf-8"))
            rows = list(st["rows"])
            ox, oy = st["origin"]
            if p.get("flip"):
                rows = [r[::-1] for r in rows]
                ox = len(rows[0]) - 1 - ox
            if p.get("vflip"):
                rows = rows[::-1]
                oy = len(rows) - 1 - oy
            key = dict(ROWKEY)
            key.update(p.get("key", {}))
            for j, row in enumerate(rows):
                for i, ch in enumerate(row):
                    if ch not in ". ":
                        put(p["at"][0] - ox + i, p["at"][1] - oy + j, "x" if ch == "x" else key[ch], k, on, of)
        if "rows" in p:
            key = dict(ROWKEY)
            key.update(p.get("key", {}))
            x0, y0 = p["at"]
            for j, row in enumerate(p["rows"]):
                for i, ch in enumerate(row):
                    if ch in ". ":
                        continue
                    put(x0 + i, y0 + j, "x" if ch == "x" else key[ch], k, on, of)
        for x, y, c in p.get("px", []):
            put(x, y, c, k, on, of)
        for x, y in p.get("erase", []):
            put(x, y, "x", k, on, of)
        for ln in p.get("lines", []):
            for x, y in polyline(ln["pts"]):
                put(x, y, ln["c"], k, on, of)
        if "shade" in p:
            # round 3 painted form (craft critic: "flat peach shapes"): re-band one material inside
            # a box from the render's camera-space normals with a hand-picked light direction and
            # hard thresholds, so each limb gets one clean core-shadow band (a cylinder read), an
            # S4 occlusion edge and one S1 highlight, instead of the key light's mostly-S2 fill.
            # bands: [[threshold, code], ...] ascending; a pixel takes the last band whose
            # threshold <= N.L. Islands <= 1 px are merged into their neighbours afterwards.
            sh = p["shade"]
            nrm = np.asarray(Image.open(os.path.join(still, "noface_normal.png")).convert("RGBA"))[..., :3]
            nv = nrm.astype(np.float32) / 255.0 * 2 - 1
            L = np.array(sh["light"], np.float32)
            L /= np.linalg.norm(L)
            lit = (nv * L).sum(-1)
            mid = mats[sh.get("mat", "skin")]["id"]
            x0, y0, x1, y1 = sh["box"]
            sel = np.zeros((H, W), bool)
            sel[max(0, y0):y1 + 1, max(0, x0):x1 + 1] = True
            sel &= (mat == mid) & ~face_t
            codes = np.full((H, W), "", object)
            for t, c in sh["bands"]:
                codes[sel & (lit >= t)] = c
            codes[sel & (codes == "")] = sh["bands"][0][1]
            for _ in range(2):   # 1 px islands -> majority of the 4 neighbours in the selection
                for y, x in zip(*np.nonzero(sel)):
                    nb = [codes[y + dy, x + dx] for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0))
                          if 0 <= y + dy < H and 0 <= x + dx < W and sel[y + dy, x + dx]]
                    if nb and codes[y, x] not in nb:
                        codes[y, x] = max(sorted(set(nb)), key=nb.count)   # sorted: ties must not depend on hash order
            for y, x in zip(*np.nonzero(sel)):
                put(int(x), int(y), codes[y, x], k, on, of)
        # round 3 paint ops: filled shapes (core shadows, lit planes, occlusion wedges), masked by 'on'
        for sh in p.get("polys", []) + p.get("ellipses", []):
            from PIL import ImageDraw
            m = Image.new("L", (W, H), 0)
            dr = ImageDraw.Draw(m)
            if "pts" in sh:
                dr.polygon([tuple(pt) for pt in sh["pts"]], fill=255)
            else:
                dr.ellipse(sh["box"], fill=255)
            only = set(sh.get("only", []))     # recolour only pixels currently in these codes
            for y, x in zip(*np.nonzero(np.asarray(m))):
                if only and code_of.get(tuple(work[y, x, :3])) not in only:
                    continue
                if work[y, x, 3]:
                    put(int(x), int(y), sh["c"], k, on, of)
        if "ring" in p:
            # round 4 angel ring (face critic: "a straight horizontal bar reads as a headband or
            # visor"): short arc segments that follow the skull. For every column of each segment
            # [xa, xb], the ring sits 'depth' px below the first hair pixel from the top (so it
            # bends with the head outline); 'c' in the middle of a segment, 'flank' on its ends,
            # 'shade' (optional) on the pixel under it. Gaps between segments = clump breaks.
            rg = p["ring"]
            hid = {mats[n]["id"] for n in ("hair", "hairtip") if n in mats}
            y_lo, y_hi = rg["y"]
            for xa, xb in rg["segments"]:
                for x in range(xa, xb + 1):
                    ys = [y for y in range(max(0, y_lo), min(H, y_hi + 1)) if mat[y, x] in hid]
                    if not ys:
                        continue
                    y = ys[0] + rg.get("depth", 3) + (rg.get("bend", {}).get(str(x), 0))
                    c = rg.get("flank", rg["c"]) if x in (xa, xb) and xb - xa >= 2 else rg["c"]
                    if mat[y, x] in hid:
                        put(x, y, c, k, None, of)
                        if rg.get("shade") and y + 1 < H and mat[y + 1, x] in hid:
                            put(x, y + 1, rg["shade"], k, None, of)
        if "despeckle" in p:
            for x, y, c in despeckle(work, mat, mats, code_of, p["despeckle"]):
                put(x, y, c, k, None, of)
        if "tips" in p:
            for x, y, c in hair_tips(work, mat, mats, p["tips"]):
                put(x, y, c, k, None, of)
        if "box" in p:
            x0, y0, x1, y1 = p["box"]
            mid = mats[p["mat"]]["id"] if p.get("mat") else None
            for y in range(y0, y1 + 1):
                for x in range(x0, x1 + 1):
                    if 0 <= y < H and 0 <= x < W and work[y, x, 3] and (mid is None or wmat[y, x] == mid) \
                            and not face_t[y, x]:
                        c = code_of.get(tuple(work[y, x, :3]))
                        if c in p["map"]:
                            put(x, y, p["map"][c], k)
    if ops.get("rim"):
        for x, y, c, k in rim(work, wmat, meta, ops["rim"], pal, code_of):
            if not kinds[y, x]:
                put(x, y, c, k)
    # layer = everything that differs from render + face
    lay = np.zeros((H, W, 4), np.uint8)
    diff = (work != base_apply).any(-1)
    er = diff & (work[..., 3] == 0)
    pa = diff & ~er
    lay[pa] = work[pa]
    lay[er, :3] = ERASE
    lay[er, 3] = 255
    os.makedirs(LDIR, exist_ok=True)
    Image.fromarray(lay).save(os.path.join(LDIR, layer + ".png"))
    touched = {}
    for y, x in zip(*np.nonzero(diff)):
        touched.setdefault(kinds[y, x] or "other", []).extend([int(x), int(y)])
    summary = {k: {"count": len(v) // 2, "xy": v} for k, v in sorted(touched.items())}
    json.dump({"_doc": f"Pixels the override layer {layer}.png touches, by kind; 'xy' is a flat x,y list on "
                       f"the {W}x{H} sprite grid. Rebuilt by overrides.py build; do not edit by hand.",
               "sprite_size": [W, H], "face_stamp": fname, "kinds": summary},
              open(os.path.join(LDIR, layer + ".touched.json"), "w"), separators=(",", ":"))
    print(layer, {k: v["count"] for k, v in summary.items()})


def apply(still, layer, tag="still"):
    meta, img, mat = load_still(still)
    ops = ops_for(layer)
    out, _, name = face_layer(meta, img, mat, ops)
    lp = os.path.join(LDIR, layer + ".png")
    if os.path.exists(lp):
        lay = np.asarray(Image.open(lp).convert("RGBA"))
        if lay.shape[:2] != out.shape[:2]:
            raise SystemExit(f"{layer}: layer {lay.shape[:2]} != sprite {out.shape[:2]} (re-render changed the canvas)")
        on = lay[..., 3] > 0
        er = on & (lay[..., 0] == 255) & (lay[..., 1] == 0) & (lay[..., 2] == 255)
        out[on & ~er] = lay[on & ~er]
        out[er] = 0
    Image.fromarray(out).save(os.path.join(still, tag + ".png"))
    im = Image.fromarray(out)
    for z in (3, 6):
        im.resize((im.width * z, im.height * z), Image.NEAREST).save(os.path.join(still, f"{tag}_x{z}.png"))
    pal = faces.palette()
    inv = {v: k for k, v in pal.items()}
    cols = {inv.get(tuple(c), "off") for c in out[out[..., 3] > 0][:, :3]}
    print(still, layer, "face", name, "colours", len(cols), "off-palette" if "off" in cols else "palette ok")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["build", "apply", "authored"])
    ap.add_argument("--still", required=True)
    ap.add_argument("--layer", required=True)
    ap.add_argument("--tag", default="still")
    ap.add_argument("--layer-dir", default=None, help="build/read the layer PNG here instead of art/rosace/overrides")
    ap.add_argument("--ops", default=None, help="take the authored ops (face, rim, patches) from this layer name")
    a = ap.parse_args()
    if a.layer_dir:
        LDIR = os.path.abspath(a.layer_dir)
    if a.ops:
        OPS_LAYER[a.layer] = a.ops
    if a.cmd == "build":
        build(a.still, a.layer)
    elif a.cmd == "apply":
        apply(a.still, a.layer, a.tag)
    else:
        authored(a.still, a.layer)
