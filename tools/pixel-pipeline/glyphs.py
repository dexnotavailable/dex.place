"""Pixel glyphs: small authored stamps placed on a projected 3D anchor (like the face stamps).

A glyph is a detail DESIGN.md specifies in pixels that a render at sprite size cannot hold: the
v2 refit's collar cross (DESIGN 3 row 1, revision 3: a 5 x 5 cross with G1 lit arms and G3 on the
shade side, on a 1 px dark backing). The 3D pendant still renders (it gives position, occlusion
and a fallback); the glyph replaces its pixels with the authored ones.

  art/rosace/glyphs/<name>_<px>.json   rows, origin, key (letter -> palette code),
                                       on_parts   parts the glyph may paint over (hands, hair and
                                                  sleeves in front of the pendant mask it),
                                       need_parts at least 3 pixels of these must be visible in
                                                  the glyph's box, or it is hidden: skipped,
                                       min_facing skip when the pendant's front turns away
Anchors come from rosace/posing.anchors: 'glyph_<name>' = [x, y, depth, facing, facing_screen_x]
at render resolution, written only for objects the build flagged with ob['glyph'] (v1 has none,
so v1 stills are unchanged). Called from overrides.face_layer, so build and apply both see it.
"""
import json
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
GDIR = os.path.join(REPO, "art", "rosace", "glyphs")


def load(name, px):
    p = os.path.join(GDIR, f"{name}_{px}.json")
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else None


def apply(meta, img, ops=None):
    """stamp every glyph anchored in meta onto img (in place); returns the touched mask"""
    touched = np.zeros(img.shape[:2], bool)
    an = meta.get("anchors") or {}
    if (ops or {}).get("glyphs") == "off":
        return touched
    still = meta.get("_still")
    ids = None
    if still:
        p = os.path.join(still, meta.get("_tag", "noface") + "_id.png")
        if os.path.exists(p):
            ids = np.asarray(Image.open(p).convert("RGBA"))[..., 1].astype(int)
    parts = meta.get("parts", {})
    pal = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in meta["colors"].items()}
    ss = meta.get("ss", 1)
    H, W = img.shape[:2]
    for key, a in an.items():
        if not key.startswith("glyph_"):
            continue
        name = key[6:]
        g = load(name, meta["px"])
        if g is None or ids is None:
            print(f"glyph {name}: no stamp at {meta['px']} px" if g is None else f"glyph {name}: no id pass")
            continue
        if a[3] < g.get("min_facing", 0.25):
            print(f"glyph {name}: facing away ({a[3]:.2f})")
            continue
        flip = a[4] < 0
        cx, cy = int(np.floor(a[0] / ss)), int(np.floor(a[1] / ss))
        rows = g["rows"]
        ox, oy = g["origin"]
        on = {parts[n] for n in g.get("on_parts", []) if n in parts}
        need = {parts[n] for n in g.get("need_parts", []) if n in parts}
        pix = []
        for j, row in enumerate(rows):
            n = len(row)
            for i, ch in enumerate(row):
                if ch in ". ":
                    continue
                x = cx + ((n - 1 - i) - (n - 1 - ox) if flip else i - ox)
                y = cy + j - oy
                if 0 <= x < W and 0 <= y < H:
                    pix.append((x, y, ch))
        seen = sum(1 for x, y, _ in pix if ids[y, x] in need)
        if seen < 3:
            print(f"glyph {name}: hidden ({seen} px of the pendant visible)")
            continue
        n_on = 0
        for x, y, ch in pix:
            if img[y, x, 3] == 0 or ids[y, x] not in on:
                continue
            img[y, x, :3] = pal[g["key"][ch]]
            img[y, x, 3] = 255
            touched[y, x] = True
            n_on += 1
        print(f"glyph {name}: {n_on} px at ({cx}, {cy}){' mirrored' if flip else ''}")
    return touched
