"""Lit outline (rim light) for Rosace sprites, per DESIGN.md section 9.

Shared by rosace_post.py (--rim: baked into the exported sprite) and overrides.py (key
stills). The rim lives on the outline: silhouette OL pixels whose outward normal faces the
rim direction turn A3 (half) or A4 (full), and at full the pixel just inside steps too on
broad shapes.

Round 2 supersedes the broken-dash rule below (see rim_pixels): continuous runs of 3+ px,
coloured per material. Kept for history --
Round-1 critics: a constant 1 px cyan line from crown to heel read as a sticker or a
selection stroke, and the full cyan cap on the head read as a helmet or halo. So the rim is
only drawn where the form turns toward the light:
  * convex edges only: the outline pixel's 5x5 neighbourhood must be mostly empty (a
    convex bulge), never in concavities or where two forms meet;
  * broken: a gap wherever the material under the edge changes (hair -> skin, sleeve ->
    hand) and at least every `max_run` pixels along a run, so it reads as highlights on
    peaks, not a stroke;
  * peaks get the brighter tone (A4 at half, A4 + inner A5 at full); shoulders of forms A3;
  * falloff: nothing below the knee line (the boots take no rim unless 'legs' is set);
  * the head gets at most `head_run` pixels per run: a glint on the crown, never a cap.

Shading lane round 2 (opt-in, `ROSACE_RIM_STYLE` = a JSON policy file, e.g.
art/rosace/overrides/global/rim_r2.json; unset = everything above, unchanged): the round-1 shading
critique found the idle's cyan outline rim a "sticker cutout halo" (a cyan-plus-OL double outline on
every material, A4 = 208 px in N1) and the refs use none: any rim sits inside the line, tinted by the
material, broken. So for the world rim (level half) the policy's style "inner" keeps the silhouette
line and recolours the first pixel inside it, only where that pixel is on the side away from the key
light (a shadow tone of its material), in the material's own light tone (hair I1, white W1, skin S1,
stocking I2, gold G0 ...), as runs of 2..run_max px with a 1 px break, and at most max_share of the
silhouette ring (PX-P19: <= 3%). Level "full" (the Illumination / effect light) keeps the cyan outline,
unless the policy sets full_as_world: a baked still with no effect layer composited shows no source for
that light, so its "full" frames take the world rim too (the round-1 critic: A4 = 208 px on N1's ring
read as a sticker cutout).

Shading lane round 3 (the round-2 critique, param 17: "no rim light" on the round-2 pick; a pasted
white halo on the control): the inner rim's colour is a per-frame input. $ROSACE_RIM_FAMILY (or the
spec's "family") picks a tint map from the policy's "tint_family" (cool = the world rim: pale
blue-lavender on hair, cream on skin, violet on the stockings; warm = a gold light, the attack frames'
spark), laid over "tint". Below the policy's "small_px" sprite height (the 80 px world render) only the
head keeps a rim (the hair crown).
"""
import json
import os

import numpy as np

STYLE_ENV = "ROSACE_RIM_STYLE"

_POLICY = {}


def policy():
    """the rim policy JSON named by $ROSACE_RIM_STYLE, or None"""
    f = os.environ.get(STYLE_ENV)
    if not f:
        return None
    if f not in _POLICY:
        _POLICY[f] = json.load(open(f, encoding="utf-8"))
    return _POLICY[f]


def _lum(rgb):
    c = np.asarray(rgb, float) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return float(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2])


def inner_rim(img, mat, pal, code_of, spec, pol, mat_names=None, head_box=None, knee_y=None):
    """round-2 world rim inside the line (see the module doc). Returns [(x, y, code, kind)]."""
    H, W = mat.shape
    a = img[..., 3] > 0
    d = np.array(spec.get("dir", [-0.62, -0.78]), float)
    d /= np.linalg.norm(d)
    thr = pol.get("thr", 0.45)
    tint = dict(pol.get("tint", {}))
    fam = os.environ.get("ROSACE_RIM_FAMILY") or spec.get("family", "cool")
    tint.update(pol.get("tint_family", {}).get(fam, {}))
    px_est = (head_box[2] - head_box[0]) / 0.26 if head_box is not None else None
    head_only = px_est is not None and px_est < pol.get("small_px", 0)
    shadow = {m: set(c) for m, c in pol.get("shadow_codes", {}).items()}
    af = a.astype(float)
    pad = np.pad(af, 2)
    gx = np.zeros_like(af)
    gy = np.zeros_like(af)
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            v = pad[2 + dy:2 + dy + H, 2 + dx:2 + dx + W]
            gx -= dx * v
            gy -= dy * v
    pad4 = np.pad(af, 4)
    cnt = np.zeros_like(af)
    for dy in range(-4, 5):
        for dx in range(-4, 5):
            cnt += pad4[4 + dy:4 + dy + H, 4 + dx:4 + dx + W]
    ring = [(y, x) for y, x in zip(*np.nonzero(a))
            if mat[y, x] == 0 and any(not (0 <= y + dy < H and 0 <= x + dx < W) or not a[y + dy, x + dx] for dy, dx in N4)]
    ringset = set(ring)
    cand = {}
    for y, x in zip(*np.nonzero(a & (mat > 0))):
        # a figure pixel just inside the silhouette line
        if not any((y + dy, x + dx) in ringset for dy, dx in N4):
            continue
        n = np.array([gx[y, x], gy[y, x]])
        ln = np.linalg.norm(n)
        if ln < 1e-6:
            continue
        n /= ln
        in_head = head_box is not None and head_box[0] <= x <= head_box[2] and head_box[1] <= y <= head_box[3]
        if n @ d < (pol.get("head_thr", 0.8) if in_head else thr) or cnt[y, x] > pol.get("convex_max", 52):
            continue
        if head_only and not in_head:
            continue
        if knee_y is not None and y > knee_y and not pol.get("legs", True):
            continue
        name = (mat_names or {}).get(int(mat[y, x]))
        tc = tint.get(name)
        cur = code_of.get(tuple(int(v) for v in img[y, x, :3]))
        if not tc or cur is None or cur == tc:
            continue
        if name in shadow and cur not in shadow[name]:
            continue                      # only on the side the key light leaves in shadow
        lo, hi = sorted((_lum(pal[tc]), _lum(img[y, x, :3])))
        if (hi + 0.05) / (lo + 0.05) < pol.get("min_step", 1.3):
            continue
        cand[(x, y)] = (float(n @ d), int(mat[y, x]), tc, in_head)
    # runs along the edge, one material each
    seen, runs = set(), []
    for st in sorted(cand, key=lambda p: (p[1], p[0])):
        if st in seen:
            continue
        m0 = cand[st][1]
        run, stack = [], [st]
        seen.add(st)
        while stack:
            p = stack.pop()
            run.append(p)
            for dy, dx in N8:
                q = (p[0] + dx, p[1] + dy)
                if q in cand and q not in seen and cand[q][1] == m0:
                    seen.add(q)
                    stack.append(q)
        runs.append(_order(run))
    # break every run_max px (1 px gap), drop pieces under run_min, then spend the budget on the pieces
    # that face the rim light most squarely
    rmax, rmin = pol.get("run_max", 5), pol.get("run_min", 2)
    pieces = []
    for run in runs:
        i = 0
        while i < len(run):
            pc = run[i:i + rmax]
            if cand[pc[0]][3]:
                pc = pc[:pol.get("head_run", 3)]
            if len(pc) >= rmin:
                pieces.append(pc)
            i += rmax + 1
    budget = pol.get("max_share", 0.03) * len(ring)
    pieces.sort(key=lambda pc: -np.mean([cand[p][0] for p in pc]))
    out, used = [], 0
    for pc in pieces:
        if used + len(pc) > budget:
            continue
        for p in pc:
            out.append((p[0], p[1], cand[p][2], "rim"))
        used += len(pc)
    return out


def _order(run):
    """the pixels of an 8-connected run in order along it, from an end"""
    left = set(run)
    start = min(run, key=lambda p: (sum(1 for dy, dx in N8 if (p[0] + dx, p[1] + dy) in left), p[1], p[0]))
    order, cur = [start], start
    left.discard(start)
    while left:
        nxt = [q for q in ((cur[0] + dx, cur[1] + dy) for dy, dx in N8) if q in left]
        if not nxt:
            nxt = [min(left, key=lambda q: (q[0] - cur[0]) ** 2 + (q[1] - cur[1]) ** 2)]
        cur = nxt[0]
        order.append(cur)
        left.discard(cur)
    return order

N4 = [(-1, 0), (1, 0), (0, -1), (0, 1)]
N8 = N4 + [(-1, -1), (-1, 1), (1, -1), (1, 1)]
RIM_INNER = {  # DESIGN.md section 9, full level: inner pixel on broad shapes
    # round 4 (face critic: "loose azure pixels on the crown read as noise"): the inner step on
    # indigo (hair, sleeve lining, boots) is one value lighter in the same hue, not azure
    "cool": {"W3": "A5", "W4": "A5", "I1": "I0", "I2": "I1", "I3": "I1", "I4": "I2",
             "S3": "A5", "S4": "A5", "T3": "A5", "T4": "A5", "G2": "A5", "G3": "A5", "G4": "A5"},
    "warm": {"W3": "G0", "W4": "G0", "I1": "G2", "I2": "G2", "I3": "G2", "I4": "G2",
             "S3": "G0", "S4": "G0", "T3": "G0", "T4": "G0", "G2": "G0", "G3": "G0", "G4": "G0"},
}
RIM_OL = {"cool": {"half": "A3", "full": "A4", "peak": "A4"}, "warm": {"half": "G3", "full": "G1", "peak": "G1"}}
# Round 2 (craft critic): the rim is coloured per material, like ref 09's pink-white coat edge,
# instead of one cyan everywhere (cold cyan on warm skin went grey-blue): skin warm, cloth
# ice-white, hair a lighter indigo (separates it from dark backgrounds without a halo), the
# haft azure. Keyed by material name (meta 'materials'); anything unlisted uses RIM_OL.
# Round 3 craft critic: saturated cyan read as specks on the hair edge and as a full-length
# 'lightsaber' line down the haft; the refs' rims are warmer and less saturated. Skin and gold
# take G0 (#fff3c4), cloth A5 ice-white, hair and hair tips a pale periwinkle I0, the haft a
# broken I1 highlight (see HAFT_MAX); saturated A3/A4 stays for skill / VFX frames ('full').
RIM_MAT = {
    "cool": {"skin": "G0", "white": "A5", "stocking": "A5", "veil": "A5", "beige": "A5", "gold": "G0",
             "hair": "I0", "hairtip": "I0", "indigo": "I1", "lining": "I1", "boot": "I1", "thong": "I2",
             "haft": "I1", "steel": "A5", "steeldark": "A5", "edge": "A5", "glass": "A4", "glass2": "A4",
             "glasscore": "A5"},
    "warm": {"skin": "S1", "white": "G0", "stocking": "G0", "veil": "G0", "beige": "G0", "gold": "G0",
             "hair": "I1", "hairtip": "A4", "indigo": "I1", "lining": "I1", "boot": "I1", "thong": "I2",
             "haft": "G2", "steel": "G0", "steeldark": "G1", "edge": "G0", "glass": "A4", "glass2": "A4",
             "glasscore": "A5"},
}
MIN_RUN = 3
MAX_RUN = 8           # round 4: long runs break into 3-8 px pieces (a 1 px gap), highlights not a stroke
# Round 4 craft critic: only ~35 of ~740 silhouette pixels (5%) carried the rim on the idle, so it
# was effectively absent at 1x; nothing on the glutes, legs or tabard. Target 15-25% of the
# silhouette edge: the threshold on (edge normal . rim direction) steps down from the spec's value
# until the rim covers COVERAGE of all silhouette outline pixels (or the floor THR_MIN is hit).
COVERAGE = 0.15
THR_MIN = 0.05
HAFT_MAX = 7          # round 3: the haft keeps one short highlight per run (its middle), not a stroke


def rim_pixels(img, mat, pal, code_of, spec, knee_y=None, head_box=None, mat_names=None):
    """img: HxWx4 uint8 (outline already drawn), mat: HxW material id of the pixel (outline
    pixels 0). pal: code -> rgb tuple. mat_names: material id -> name (per-material colour).
    Returns [(x, y, code, kind)].

    Round 2 rules (craft / overall / gear critics: broken 1 px dashes and single dots read as
    speckle noise): the rim recolours silhouette outline pixels only, in continuous runs of
    at least MIN_RUN pixels on the side facing the rim direction; a run is split where the
    material under the edge changes and each piece shorter than MIN_RUN is dropped. No
    periodic breaks any more ('max_run' / 'head_run' are ignored). 'full' (skill / VFX frames,
    when the glaive glow motivates it) also lights the pixel just inside on broad shapes."""
    pol = policy()
    if pol and pol.get("style") == "inner" and (spec.get("level", "half") != "full" or pol.get("full_as_world")):
        return inner_rim(img, mat, pal, code_of, spec, pol, mat_names, head_box, knee_y)
    H, W = mat.shape
    a = img[..., 3] > 0
    d = np.array(spec.get("dir", [-0.62, -0.78]), float)
    d /= np.linalg.norm(d)
    thr = spec.get("thr", 0.5)
    fam = spec.get("family", "cool")
    lvl = spec.get("level", "half")
    min_run = spec.get("min_run", MIN_RUN)
    # concavities only are excluded (opaque share of a 9x9 window: straight edge ~45/81)
    convex_max = spec.get("convex_max", 50)
    af = a.astype(float)
    pad = np.pad(af, 2)
    gx = np.zeros_like(af)
    gy = np.zeros_like(af)
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            v = pad[2 + dy:2 + dy + H, 2 + dx:2 + dx + W]
            gx -= dx * v
            gy -= dy * v
    pad4 = np.pad(af, 4)
    cnt = np.zeros_like(af)
    for dy in range(-4, 5):
        for dx in range(-4, 5):
            cnt += pad4[4 + dy:4 + dy + H, 4 + dx:4 + dx + W]
    edge_px = []
    for y, x in zip(*np.nonzero(a)):
        if mat[y, x] == 0 and any(not (0 <= y + dy < H and 0 <= x + dx < W) or not a[y + dy, x + dx] for dy, dx in N4):
            edge_px.append((y, x))
    target = spec.get("coverage", COVERAGE) * len(edge_px)
    out, t = [], thr
    while True:
        out = _runs(img, mat, a, gx, gy, cnt, edge_px, d, t, spec, lvl, fam, min_run, convex_max, knee_y,
                    head_box, mat_names, code_of, H, W)
        if sum(1 for o in out if o[3] == "rim") >= target or t <= THR_MIN:
            return out
        t = max(THR_MIN, t - 0.1)


def _runs(img, mat, a, gx, gy, cnt, edge_px, d, thr, spec, lvl, fam, min_run, convex_max, knee_y,
          head_box, mat_names, code_of, H, W):
    cand = {}
    for y, x in edge_px:
        # outline pixels: material 0 in the id pass (round 3: the lit contour is sel-out
        # coloured now, not OL, so the colour test no longer finds it)
        if knee_y is not None and y > knee_y and not spec.get("legs", True):
            continue
        n = np.array([gx[y, x], gy[y, x]])
        ln = np.linalg.norm(n)
        in_head = head_box is not None and head_box[0] <= x <= head_box[2] and head_box[1] <= y <= head_box[3]
        # on the head only the edge facing the rim straight on: never a cap over the crown
        if ln < 1e-6 or (n / ln) @ d < (spec.get("head_thr", 0.85) if in_head else thr):
            continue
        if cnt[y, x] > convex_max:
            continue
        n /= ln
        inner = None
        for k in (1, 2):
            ix, iy = int(round(x - k * n[0])), int(round(y - k * n[1]))
            if 0 <= iy < H and 0 <= ix < W and a[iy, ix] and mat[iy, ix] > 0:
                inner = (ix, iy)
                break
        if inner is None:
            continue
        cand[(x, y)] = (n, inner, mat[inner[1], inner[0]])
    # runs: 8-connected chains of candidates with the same material under the edge
    seen = set()
    out = []
    for start in sorted(cand, key=lambda p: (p[1], p[0])):
        if start in seen:
            continue
        m0 = cand[start][2]
        run, stack = [], [start]
        seen.add(start)
        while stack:
            p = stack.pop()
            run.append(p)
            for dy, dx in N8:
                q = (p[0] + dx, p[1] + dy)
                if q in cand and q not in seen and cand[q][2] == m0:
                    seen.add(q)
                    stack.append(q)
        if len(run) < min_run:
            continue
        name = (mat_names or {}).get(int(m0))
        if name == "haft" and len(run) > HAFT_MAX:
            run.sort(key=lambda p: (p[0], p[1]))
            i0 = (len(run) - HAFT_MAX) // 2
            run = run[i0:i0 + HAFT_MAX]
        code = RIM_MAT[fam].get(name) if name else None
        if code is None:
            code = RIM_OL[fam]["full" if lvl == "full" else "half"]
        if lvl == "full" and name not in ("haft",):
            # round 4 craft critic: during attacks / skills the rim switches to the Liturgy glow
            # (the azure effect light, DESIGN s9), not the idle world rim
            code = RIM_OL[fam]["peak"] if len(run) >= 5 else RIM_OL[fam]["full"]
        if name != "haft" and len(run) > MAX_RUN:
            run = _break(run, cand)
        for p in run:
            n, inner, m = cand[p]
            out.append((p[0], p[1], code, "rim"))
            if lvl == "full" and len(run) >= 5:
                ix, iy = inner
                fx, fy = int(round(p[0] - 4 * n[0])), int(round(p[1] - 4 * n[1]))
                if 0 <= fy < H and 0 <= fx < W and a[fy, fx] and mat[fy, fx] == mat[iy, ix]:
                    cc = code_of.get(tuple(img[iy, ix, :3]))
                    if cc in RIM_INNER[fam]:
                        out.append((ix, iy, RIM_INNER[fam][cc], "rim_inner"))
    return out


def _break(run, cand):
    """order a run along its edge and drop every (MAX_RUN + 1)th pixel: pieces of MAX_RUN with a
    1 px gap (the tail piece joins the previous one if shorter than MIN_RUN)"""
    left = set(run)
    start = min(run, key=lambda p: (sum(1 for dy, dx in N8 if (p[0] + dx, p[1] + dy) in left), p[1], p[0]))
    order, cur = [start], start
    left.discard(start)
    while left:
        nxt = [q for q in ((cur[0] + dx, cur[1] + dy) for dy, dx in N8) if q in left]
        if not nxt:
            nxt = [min(left, key=lambda q: (q[0] - cur[0]) ** 2 + (q[1] - cur[1]) ** 2)]
        cur = nxt[0]
        order.append(cur)
        left.discard(cur)
    keep = [p for i, p in enumerate(order) if (i + 1) % (MAX_RUN + 1) != 0]
    tail = len(order) % (MAX_RUN + 1)
    if 0 < tail < MIN_RUN and len(order) > MAX_RUN:
        keep = [p for p in keep if p not in order[-tail:]] + order[-tail:]
    return keep


def apply(img, mat, pal, spec, knee_y=None, head_box=None, mat_names=None):
    code_of = {tuple(v): k for k, v in pal.items()}
    for x, y, c, k in rim_pixels(img, mat, pal, code_of, spec, knee_y, head_box, mat_names):
        img[y, x, :3] = pal[c]
    return img
