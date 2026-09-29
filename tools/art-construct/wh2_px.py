"""Round WH2 (whole-character round 2, 2026-09-29): the last pixel pass of the integrated stills chain, run on
the glaive-hands lane's output (still_hands.png, palette.json codes) before the shading preset's remap.

  python tools/art-construct/wh2_px.py --still <render>/<still>/px<N> [--only face,facehair,...] [--preview]

Steps (each one answers a round-2 whole-character critique; ART-RULES round WH2 has the evidence):
  face      re-anchor every facial feature on the v2 head's projected features (facepass.json), per pose from
            the expression table in art/rosace/faces/wh2.json: erase the old stamp's features on the head skin,
            clean the cheek and nose zone to three skin ramps with no isolated darks, then stamp the authored
            eyes (dark two-row upper lid with an outer flick, 2-tone iris, pupil, catchlight(s)), a 1 px warm
            nose, a 2 px blush on the ramp and a centred mouth. The 80 px face has its own stamps (eye 2x3,
            mouth 1-2 px), never a downscaled 144 one.
  facehair  hair on the face interior (below the eye line, skin on both sides in the row) goes back to skin:
            a side lock never crosses the cheek (the "scar strand").
  hair      the hair mass: isolated dark 1-2 px clusters inside it are dropped (render AO speckle), the dark
            ramp collapses to one tone (I4 -> I3: outline, dark, base, light), boundaries between the modelled
            clumps (hair part ids) become 1 px dark separators on the lower clump, and one continuous sheen arc
            (I1 band, I0 core) crosses the crown; scattered I0/I1 specks elsewhere on the crown go to base.
  ornament  the gold hair ornament becomes one deliberate cluster (3x3 at 144, 2x2 at 80: gold ring and
            highlight) instead of orphan gold pixels.
  skin      body skin on the thighs as cylinders: lit S2 with an S1 band, S3 core shadow, S2 bounce kept off
            the outline; flesh overhang: 1 px S3 crease on the skin row over the stocking band.
Writes still_wh2.png (+ wh2.json with per-step notes and the face checks) into the still folder.
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
FACES = os.path.join(REPO, "art", "rosace", "faces", "wh2.json")
PAL = json.load(open(os.path.join(REPO, "art", "rosace", "palette.json"), encoding="utf-8"))["colors"]
CODES = list(PAL.keys())
RGB = {c: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for c, h in PAL.items()}
CI = {c: i for i, c in enumerate(CODES)}
CH = {"O": "OL", "a": "A2", "c": "A3", "d": "A4", "w": "A5", "W": "W2", "K": "I4", "k": "I3",
      "1": "S1", "2": "S2", "3": "S3", "4": "S4", "b": "SB"}
SKIN3 = ("S1", "S2", "S3")
HAIRC = ("I0", "I1", "I2", "I3", "I4")
N4 = ((0, 1), (0, -1), (1, 0), (-1, 0))
N8 = N4 + ((1, 1), (1, -1), (-1, 1), (-1, -1))
STEPS = ("face", "facehair", "hair", "tips", "ornament", "hands", "skin")


class Still:
    def __init__(self, d, base="still_hands"):
        self.d = d
        self.base = base
        im = np.array(Image.open(os.path.join(d, base + ".png")).convert("RGBA"))
        self.a = im[..., 3] > 0
        self.H, self.W = self.a.shape
        packed = (im[..., 0].astype(np.int64) << 16) | (im[..., 1].astype(np.int64) << 8) | im[..., 2]
        lut = {(r << 16) | (g << 8) | b: CI[c] for c, (r, g, b) in RGB.items()}
        self.c = np.full(self.a.shape, -1, np.int16)
        for k, i in lut.items():
            self.c[(packed == k) & self.a] = i
        self.unknown = int((self.a & (self.c < 0)).sum())
        self.raw = im
        self.idm = np.asarray(Image.open(os.path.join(d, "noface_id.png")).convert("RGBA"))
        self.meta = json.load(open(os.path.join(d, "meta.json")))
        fp = os.path.join(d, "facepass.json")
        self.fp = json.load(open(fp)) if os.path.exists(fp) else None
        lm = os.path.join(d, "landmarks.json")
        self.lm = json.load(open(lm)) if os.path.exists(lm) else None
        self.px = int(self.meta["px"])
        mats = {n: m["id"] for n, m in self.meta["materials"].items()}
        parts = self.meta.get("parts", {})
        fig = self.idm[..., 3] > 0
        self.mat = np.where(fig, self.idm[..., 0].astype(np.int32), 0)
        self.part = np.where(fig, self.idm[..., 1].astype(np.int32), -1)
        self.limb = np.where(fig, self.idm[..., 2].astype(np.int32) % 32, 0)
        self.skin = fig & (self.idm[..., 0] == mats["skin"])
        self.head = self.skin & (self.idm[..., 1] == parts.get("head", -9))
        self.hairid = fig & np.isin(self.idm[..., 0], [mats.get("hair", -9), mats.get("hairtip", -9)])
        self.mats, self.parts = mats, parts
        self.notes = {}

    def code(self, x, y):
        if not (0 <= x < self.W and 0 <= y < self.H) or not self.a[y, x] or self.c[y, x] < 0:
            return None
        return CODES[self.c[y, x]]

    def put(self, x, y, code):
        if 0 <= x < self.W and 0 <= y < self.H:
            self.c[y, x] = CI[code]
            self.a[y, x] = True

    def is_code(self, codes):
        return np.isin(self.c, [CI[k] for k in codes]) & self.a

    def save(self, tag="still_wh2"):
        out = self.raw.copy()
        for i, cd in enumerate(CODES):
            m = (self.c == i) & self.a
            out[m, :3] = RGB[cd]
            out[m, 3] = 255
        Image.fromarray(out).save(os.path.join(self.d, tag + ".png"))
        return os.path.join(self.d, tag + ".png")


def centroid(pts):
    a = np.array(pts, float)
    return a[:, 0].mean(), a[:, 1].mean(), a[:, 2].mean()


def stamp_rows(st, mirror):
    rows = st["rows"]
    w = max(len(r) for r in rows)
    rows = [r.ljust(w, ".") for r in rows]
    cx, cy = st["c"]
    if mirror:
        rows = [r[::-1] for r in rows]
        cx = w - 1 - cx
    return rows, cx, cy


def cells(st, ax, ay, mirror, dx=0, dy=0):
    """the stamp's cells [(x, y, char)] with its cell c on the continuous point (ax, ay), shifted by (dx, dy)"""
    rows, cx, cy = stamp_rows(st, mirror)
    x0 = int(round(ax - 0.5 - cx)) + dx
    y0 = int(round(ay - 0.5 - cy)) + dy
    return [(x0 + i, y0 + j, ch) for j, r in enumerate(rows) for i, ch in enumerate(r) if ch != "."]


def draw(S, st, ax, ay, mirror, allow, dx=0, dy=0):
    """stamp st so that its cell c lands on the continuous point (ax, ay); only on pixels in allow"""
    drawn = []
    for x, y, ch in cells(st, ax, ay, mirror, dx, dy):
        if 0 <= x < S.W and 0 <= y < S.H and allow[y, x]:
            S.put(x, y, CH[ch])
            drawn.append((x, y, CH[ch]))
    return drawn, None


IRIS = set("acdwK")


def fit_eyes(S, specs, mirror, allow, rng, gap):
    """the eyes' shifts, chosen together, within rng px of where the 3D puts them: most of each eye shown on the
    face window (iris cells 3 points, lid cells 1), 2 points off per px moved, the two irises at least gap px
    apart and one free pixel between the stamps (a hair lock may hide an eye the 3D placed under it, and two
    lids that touch read as one bar; round WH2, FC-P27)"""
    import itertools
    opts = []
    for name, st, e in specs:
        o = []
        for dy in range(-rng[1], rng[1] + 1):
            for dx in range(-rng[0], rng[0] + 1):
                cs = cells(st, e[0], e[1], mirror, dx, dy)
                sc = sum((3 if ch in IRIS else 1) for x, y, ch in cs
                         if 0 <= x < S.W and 0 <= y < S.H and allow[y, x]) - 2 * (abs(dx) + abs(dy))
                o.append((sc, dx, dy, cs))
        opts.append(o)
    best = None
    for combo in itertools.product(*opts):
        if len(combo) == 2:
            c1, c2 = combo[0][3], combo[1][3]
            s1 = {(x, y) for x, y, ch in c1}
            if any((x + i, y + j) in s1 for x, y, ch in c2 for i in (-1, 0, 1) for j in (-1, 0, 1)):
                continue
            i1 = [(x, y) for x, y, ch in c1 if ch in IRIS]
            if any(abs(x - a) <= gap and abs(y - b) <= gap for x, y, ch in c2 if ch in IRIS for a, b in i1):
                continue
        sc = sum(c[0] for c in combo)
        if best is None or sc > best[0]:
            best = (sc, [(c[1], c[2]) for c in combo])
    return best[1] if best else [(0, 0)] * len(specs)


def fill_from_neighbours(S, hole, pool, region=None):
    """every hole pixel takes the most common pool code among its 8 neighbours that are not holes (S2 on ties),
    growing inward until filled"""
    hole = hole.copy()
    for _ in range(40):
        if not hole.any():
            break
        ys, xs = np.nonzero(hole)
        upd = []
        for y, x in zip(ys, xs):
            cnt = {}
            for dy, dx in N8:
                yy, xx = y + dy, x + dx
                if 0 <= yy < S.H and 0 <= xx < S.W and not hole[yy, xx]:
                    cd = S.code(xx, yy)
                    if cd in pool and (S.head if region is None else region)[yy, xx]:
                        cnt[cd] = cnt.get(cd, 0) + (2 if (dy == 0 or dx == 0) else 1)
            if cnt:
                best = max(cnt.items(), key=lambda kv: (kv[1], kv[0] == "S2"))[0]
                upd.append((x, y, best))
        if not upd:
            for y, x in zip(ys, xs):
                upd.append((x, y, "S2"))
        for x, y, cd in upd:
            S.put(x, y, cd)
            hole[y, x] = False


def clusters(mask, conn=N8):
    """connected components (8-connected by default): label map (0 = none) and count"""
    lab = np.zeros(mask.shape, np.int32)
    n = 0
    H, W = mask.shape
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]:
            continue
        n += 1
        lab[y0, x0] = n
        st = [(y0, x0)]
        while st:
            y, x = st.pop()
            for dy, dx in conn:
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n
                    st.append((yy, xx))
    return lab, n


def face_mask(S, G, key):
    """the painted face: head-skin id pixels, plus the skin- and eye-coded pixels the passes painted beside them
    inside the head's box (a face stamp or a post pass can paint skin on hair-id pixels), connected to the head
    id; body skin (the neck) is never face"""
    hid = S.head
    ys, xs = np.nonzero(hid)
    if not len(xs):
        return hid
    pad = 3 if key == "144" else 2
    box = np.zeros_like(hid)
    box[ys.min():max(ys.max(), int(G["chin"][1])) + 1, max(0, xs.min() - pad):xs.max() + pad + 1] = True
    skinish = S.is_code(("S1", "S2", "S3", "S4", "SB"))
    feat = S.is_code(("A2", "A3", "A4", "A5", "W1", "W2")) & (S.mat != S.mats.get("hairtip", -9))
    cand = box & (skinish | feat) & ~(S.skin & ~S.head)
    lab, n = clusters(cand | hid, N4)
    keep = set(np.unique(lab[hid]).tolist()) - {0}
    return hid | (np.isin(lab, list(keep)) & cand)


def face_geometry(S):
    fp = S.fp
    eyes = {s: centroid(p) for s, p in fp["refs"]["ref_eyes"].items()}
    white = {s: float(np.ptp(np.array(p)[:, 0])) for s, p in fp["refs"]["ref_eyes_white"].items()}
    nose = fp["nose"][:2]
    chin = fp["chin"][:2]
    mid = ((eyes["L"][0] + eyes["R"][0]) / 2, (eyes["L"][1] + eyes["R"][1]) / 2)
    profile = abs(eyes["L"][0] - eyes["R"][0]) < 1.5 and abs(eyes["L"][1] - eyes["R"][1]) < 1.5
    dirx = 1 if nose[0] >= mid[0] else -1
    if profile:
        near = min(eyes, key=lambda s: eyes[s][2])
    else:
        # the near eye is the one farther from the nose on screen (the far eye sits against the nose)
        near = max(eyes, key=lambda s: abs(eyes[s][0] - nose[0]))
    far = "R" if near == "L" else "L"
    return dict(eyes=eyes, white=white, nose=nose, chin=chin, mid=mid, profile=profile, dir=dirx, near=near, far=far)


def step_face(S, F, pose):
    if not S.fp:
        return {"skip": "no facepass"}
    key = "144" if S.px >= 110 else "80"
    stamps = F["stamps"][key]
    expr = F["expressions"].get(pose, {"eyes": "open", "mouth": "line", "blush": False})
    G = face_geometry(S)
    head = face_mask(S, G, key)
    trans = ~S.a
    ys, xs = np.nonzero(head)
    eye_top = min(G["eyes"]["L"][1], G["eyes"]["R"][1]) - (4 if key == "144" else 2)
    # 1. erase the old features on the head skin (lash, iris, brow, mouth, blush, stray darks), keep the jaw/face
    #    outline (an OL pixel touching the background or a non-head, non-hair pixel) and the fringe (hair codes
    #    above the eye line)
    notskin = head & ~S.is_code(SKIN3)
    keep = np.zeros_like(head)
    for y, x in zip(*np.nonzero(notskin)):
        cd = S.code(x, y)
        if cd in HAIRC and y < eye_top:
            keep[y, x] = True
            continue
        if cd == "OL":
            for dy, dx in N4:
                yy, xx = y + dy, x + dx
                if not (0 <= yy < S.H and 0 <= xx < S.W) or trans[yy, xx] or \
                        (not head[yy, xx] and not S.hairid[yy, xx] and S.code(xx, yy) not in HAIRC):
                    keep[y, x] = True
                    break
        if cd in HAIRC:
            # hair drawn over the face below the eye line: keep only at the face's edge (a lock beside the cheek)
            row = head[y]
            left = row[:x].any() and S.is_code(SKIN3)[y, :x][row[:x]].any()
            right = row[x + 1:].any() and S.is_code(SKIN3)[y, x + 1:][row[x + 1:]].any()
            if not (left and right):
                keep[y, x] = True
    erase = notskin & ~keep
    n_erase = int(erase.sum())
    fill_from_neighbours(S, erase, SKIN3, head)
    # 2. clean the skin to 3 ramps: S3/S1 specks of <= 2 px inside the face go to their surroundings
    cleaned = 0
    for cd in ("S3", "S1", "S2"):
        m = head & S.is_code([cd])
        lab, n = clusters(m)
        for k in range(1, n + 1):
            cm = lab == k
            if cm.sum() <= (2 if cd != "S2" else 1):
                yy, xx = np.nonzero(cm)
                # only interior specks: every 8-neighbour is head skin
                ok = True
                for y, x in zip(yy, xx):
                    for dy, dx in N8:
                        if not (0 <= y + dy < S.H and 0 <= x + dx < S.W) or not head[y + dy, x + dx]:
                            ok = False
                if ok:
                    fill_from_neighbours(S, cm, tuple(c for c in SKIN3 if c != cd), head)
                    cleaned += int(cm.sum())
    allow = head & S.is_code(SKIN3)
    drawn = {}
    mirror = G["dir"] < 0
    ex = expr["eyes"]
    rng = (3, 1) if key == "144" else (1, 1)
    gap = 2 if key == "144" else 1
    roles = [("eye", "profile")] if G["profile"] else [("eye_near", "near"), ("eye_far", "far")]
    specs = []
    for name, role in roles:
        e = G["eyes"][G["near"] if role == "profile" else G[role]]
        st = stamps["eye_profile"] if role == "profile" else (stamps.get(f"eye_{role}_{ex}") or stamps[f"eye_{role}_open"])
        specs.append((name, st, e))
    shifts = fit_eyes(S, specs, mirror, allow, rng, gap)
    for (name, st, e), (dx, dy) in zip(specs, shifts):
        drawn[name], _ = draw(S, st, e[0], e[1], mirror, allow, dx, dy)
    shifts = {sp[0]: sh for sp, sh in zip(specs, shifts)}
    allow = head & S.is_code(SKIN3)
    k = F["mouth_k"][key]
    mx = G["nose"][0] + k * (G["chin"][0] - G["nose"][0])
    my = G["nose"][1] + k * (G["chin"][1] - G["nose"][1])
    drawn["mouth"], _ = draw(S, stamps["mouth_" + expr["mouth"]], mx, my, mirror, allow)
    if stamps.get("nose"):
        nx = G["nose"][0] - (1.0 if G["dir"] > 0 else 0.0)
        drawn["nose"], _ = draw(S, stamps["nose"], nx, G["nose"][1], mirror, allow & ~S.is_code(["S4", "OL"]))
    if expr.get("blush") and stamps.get("blush_near"):
        # 2 px of SB on each cheek, under the outer half of that eye's iris, 'dy' rows under the iris bottom
        bl = []
        for name, role in roles:
            b = stamps["blush_far" if role == "far" else "blush_near"]
            ir = [(x, y) for x, y, c in drawn[name] if c in ("A2", "A3", "A4", "A5", "I4")]
            if not b or not ir:
                continue
            x0, x1, y1 = min(p[0] for p in ir), max(p[0] for p in ir), max(p[1] for p in ir)
            outer_left = (role != "far") == (G["dir"] > 0)
            xs = (x0, x0 + 1) if outer_left else (x1 - 1, x1)
            for x in xs:
                y = y1 + b["dy"]
                if 0 <= x < S.W and 0 <= y < S.H and head[y, x] and S.code(x, y) in SKIN3:
                    S.put(x, y, "SB")
                    bl.append((x, y))
        drawn["blush"] = bl
    # checks: a mouth pixel on the centre line (FC-P26 new), every eye drawn, no hair inside the face
    mp = [p for p in drawn["mouth"] if p[2] in ("S4", "OL")]
    mcx = float(np.mean([p[0] + 0.5 for p in mp])) if mp else None
    chk = {
        "mouth_px": len(mp),
        "mouth_offset_px": None if mcx is None else round(mcx - mx, 2),
        "mouth_ok": bool(mp) and abs(mcx - mx) <= 1.0,
        "eyes_px": {r: len(v) for r, v in drawn.items() if r.startswith("eye")},
        "eyes_open": all(sum(1 for p in v if p[2] in ("A2", "A3", "A4", "A5")) >= (3 if key == "144" else 2)
                         for r, v in drawn.items() if r.startswith("eye")),
    }
    return {"expr": expr, "eye_shifts": shifts, "dir": G["dir"], "near": G["near"], "profile": G["profile"], "erased": n_erase,
            "specks": cleaned, "mouth_at": [round(mx, 2), round(my, 2)], "check": chk}


def step_facehair(S):
    """hair pixels (code) on head-skin id rows below the eye line with face skin on both sides -> skin"""
    if not S.fp:
        return {"skip": "no facepass"}
    G = face_geometry(S)
    eye_bot = max(G["eyes"]["L"][1], G["eyes"]["R"][1]) + 1
    sk = S.is_code(SKIN3 + ("SB", "S4"))
    face = S.head | (S.skin & (S.part == S.parts.get("head", -9)))
    hole = np.zeros_like(face)
    for y in range(int(eye_bot), S.H):
        row = S.head[y] & sk[y]
        if not row.any():
            continue
        xs = np.nonzero(row)[0]
        for x in range(xs.min() + 1, xs.max()):
            if S.code(x, y) in HAIRC and S.head[y, x] is not None:
                hole[y, x] = True
    n = int(hole.sum())
    if n:
        fill_from_neighbours(S, hole, SKIN3)
    return {"hair_on_face_px": n}


def run(still, pose, only=None, base="still_hands", cfg=None):
    S = Still(still, base)
    F = json.load(open(FACES, encoding="utf-8"))
    steps = [s for s in STEPS if not only or s in only]
    notes = {"unknown_px": S.unknown}
    for s in steps:
        if s == "face":
            notes[s] = step_face(S, F, pose)
        elif s == "facehair":
            notes[s] = step_facehair(S)
        elif s == "hair":
            notes[s] = step_hair(S, cfg.get("hair") if cfg else None)
        elif s == "ornament":
            notes[s] = step_ornament(S)
        elif s == "hands":
            notes[s] = step_hands(S)
        elif s == "tips":
            notes[s] = step_tips(S)
        elif s == "skin":
            notes[s] = step_skin(S, cfg.get("skin") if cfg else None)
    S.save()
    json.dump(notes, open(os.path.join(still, "wh2.json"), "w"), indent=1, default=str)
    return notes


def hair_mask(S):
    """hair pixels: hair or hairtip id, coded in the indigo ramp (the veil, ornament and outline excluded)"""
    return S.hairid & S.is_code(HAIRC)


def majority(S, x, y, pool, region):
    cnt = {}
    for dy, dx in N8:
        yy, xx = y + dy, x + dx
        if 0 <= yy < S.H and 0 <= xx < S.W and region[yy, xx]:
            cd = S.code(xx, yy)
            if cd in pool:
                cnt[cd] = cnt.get(cd, 0) + (2 if (dy == 0 or dx == 0) else 1)
    return max(cnt.items(), key=lambda kv: kv[1])[0] if cnt else None


def step_hair(S, cfg=None):
    cfg = cfg or {}
    hm = hair_mask(S)
    notes = {}
    # a. dark specks first (render AO noise): an I4/I3 pixel with 3+ of its 4 neighbours in the lighter hair
    #    tones goes to its majority lighter neighbour; then I3/I4 4-connected clusters of <= max_dark px with 5+
    #    hair neighbours per pixel go to base
    light = ("I2", "I1", "I0")
    nd = 0
    for _ in range(cfg.get("speck_passes", 1)):
        dk = hm & S.is_code(["I4", "I3"])
        upd = []
        for y, x in zip(*np.nonzero(dk)):
            nl = sum(1 for dy, dx in N4 if 0 <= y + dy < S.H and 0 <= x + dx < S.W and hm[y + dy, x + dx]
                     and S.code(x + dx, y + dy) in light)
            if nl >= 3:
                upd.append((x, y, majority(S, x, y, light, hm) or "I2"))
        for x, y, cd in upd:
            S.put(x, y, cd)
        nd += len(upd)
    maxd = cfg.get("max_dark", 2)
    lab, n = clusters(hm & S.is_code(["I3", "I4"]), N4)
    for k in range(1, n + 1):
        cm = lab == k
        if cm.sum() > maxd:
            continue
        ys, xs = np.nonzero(cm)
        inside = all(sum(1 for dy, dx in N8 if 0 <= y + dy < S.H and 0 <= x + dx < S.W and hm[y + dy, x + dx])
                     >= 5 for y, x in zip(ys, xs))
        if inside:
            S.c[cm] = CI["I2"]
            nd += int(cm.sum())
    notes["dark_specks_px"] = nd
    # b. one dark tone: I4 -> I3 (outline, dark, base, light + one sheen colour)
    m = hm & S.is_code(["I4"])
    S.c[m] = CI["I3"]
    notes["i4_to_i3"] = int(m.sum())
    # c. light specks: single I1/I0 pixels inside the mass -> base
    lab, n = clusters(hm & S.is_code(["I1", "I0"]))
    nl = 0
    for k in range(1, n + 1):
        cm = lab == k
        if cm.sum() <= cfg.get("max_light", 1):
            S.c[cm] = CI["I2"]
            nl += int(cm.sum())
    notes["light_specks_px"] = nl
    # e. clump separators: where two hair clumps (part ids) meet side by side, the farther clump's edge pixel
    #    takes the dark tone, from the root down to 1 px above the shorter clump's tip (never on the tip's last px)
    if cfg.get("sep", True):
        dep = part_depth(S)
        hm = hair_mask(S)
        ns = 0
        for y, x in zip(*np.nonzero(hm[:, :-1] & hm[:, 1:] & (S.part[:, :-1] != S.part[:, 1:]))):
            a_, b_ = (y, x), (y, x + 1)
            far = a_ if (dep is not None and dep[a_] > dep[b_]) else b_
            if y + 1 >= S.H or not hm[y + 1, far[1]]:
                continue
            if S.code(far[1], far[0]) in ("I2", "I1", "I0"):
                S.put(far[1], far[0], "I3")
                ns += 1
        notes["sep_px"] = ns
    # f. one continuous sheen arc across the crown (replaces the scattered crown dashes)
    if cfg.get("arc", True) and S.fp:
        notes["arc"] = sheen_arc(S, cfg)
    # d. silhouette spikes: an outline or hair pixel with 6+ of its 8 neighbours empty and at most one 4-neighbour
    #    filled comes off (single-pixel spikes on the hair edge)
    ns = 0
    for _ in range(2):
        a = S.a.copy()
        cand = (S.hairid | (S.is_code(["OL"]) & np.isin(S.mat, [S.mats.get("hair", -9), S.mats.get("hairtip", -9), 0]))) & a
        for y, x in zip(*np.nonzero(cand)):
            e8 = sum(1 for dy, dx in N8 if not (0 <= y + dy < S.H and 0 <= x + dx < S.W) or not a[y + dy, x + dx])
            f4 = sum(1 for dy, dx in N4 if 0 <= y + dy < S.H and 0 <= x + dx < S.W and a[y + dy, x + dx])
            if e8 >= 6 and f4 <= 1:
                S.a[y, x] = False
                S.c[y, x] = -1
                ns += 1
    notes["spikes_px"] = ns
    return notes


def part_depth(S):
    """per sprite px: the nearest sub-pixel depth of the px's own material and part (hair_px's rule)"""
    p = os.path.join(S.d, "depth.png")
    ip = os.path.join(S.d, "id.png")
    if not (os.path.exists(p) and os.path.exists(ip)):
        return None
    D0, D1 = S.meta["depth_range"]
    ss = S.meta["ss"]
    H, W = S.H, S.W
    dep = np.asarray(Image.open(p))[..., 0].astype(np.float32) / 255.0 * (D1 - D0) + D0
    idp = np.asarray(Image.open(ip))

    def blk(a):
        return a[:H * ss, :W * ss].reshape(H, ss, W, ss).transpose(0, 2, 1, 3).reshape(H, W, ss * ss)
    dep, im, ipp, ia = blk(dep), blk(idp[..., 0]), blk(idp[..., 1]), blk(idp[..., 3]) > 127
    same = ia & (im == S.mat[..., None]) & (ipp == S.part[..., None])
    d = np.where(same, dep, 1e9).min(-1)
    return np.where(same.any(-1), d, np.where(ia, dep, 1e9).min(-1))


def sheen_arc(S, cfg):
    """the angel ring as ONE band parallel to the crown's silhouette, d px under it (d = 0.28 of the crown-to-eye
    height), over the dome (columns whose top is within 45% of that height of the highest), trimmed 15% each end,
    I1 with an I0 core (the middle 40%, shifted a tenth toward the key light) that is 2 rows thick; the crown's
    old I0/I1 dashes go to base first. Steps between neighbouring columns are clamped to 1 px, so the arc never
    breaks into dashes."""
    hm = hair_mask(S)
    G = face_geometry(S)
    eye_top = int(min(G["eyes"]["L"][1], G["eyes"]["R"][1])) - 2
    rows = np.nonzero(hm.any(1))[0]
    if not len(rows):
        return {"skip": "no hair"}
    top_min = int(rows.min())
    hgt = max(4, eye_top - top_min)
    crown = hm.copy()
    crown[eye_top:] = False
    olds = crown & S.is_code(["I0", "I1"])
    S.c[olds] = CI["I2"]
    cols = [x for x in range(S.W) if crown[:, x].any()]
    tops = {x: int(np.nonzero(crown[:, x])[0].min()) for x in cols}
    dome = [x for x in cols if tops[x] <= top_min + 0.45 * hgt]
    if len(dome) < 4:
        return {"skip": "no dome", "reset_px": int(olds.sum())}
    x0, x1 = min(dome), max(dome)
    trim = int(round(0.15 * (x1 - x0 + 1)))
    xs = list(range(x0 + trim, x1 - trim + 1))
    d = max(2, int(round(cfg.get("arc_depth", 0.28) * hgt)))
    t = np.array([tops.get(x, top_min) for x in xs], float)
    t = np.array([np.median(t[max(0, i - 1):i + 2]) for i in range(len(t))])
    r = [int(round(t[0])) + d]
    for i in range(1, len(xs)):
        want = int(round(t[i])) + d
        r.append(r[-1] + int(np.clip(want - r[-1], -1, 1)))
    ls = 1 if S.meta.get("light_cam", [1])[0] >= 0 else -1
    n = len(xs)
    c0 = int(round(n * 0.30 + ls * n * 0.10))
    c1 = c0 + max(1, int(round(n * 0.40)))
    painted = 0
    for i, (x, y) in enumerate(zip(xs, r)):
        core = c0 <= i < c1
        for yy, cd in ((y, "I0" if core else "I1"), (y + 1, "I1" if core and S.px >= 110 else None)):
            if cd and 0 <= yy < S.H and hm[yy, x] and S.code(x, yy) in HAIRC:
                S.put(x, yy, cd)
                painted += 1
    return {"reset_px": int(olds.sum()), "cols": [xs[0], xs[-1]], "depth": d, "painted": painted}


PIN = {"144": ["G1G0G2", "G2G1G3", "G3G3G4"], "80": ["G0G2", "G2G4"]}


def pin_centre(S):
    """the crown pin: the topmost 8-connected cluster of the gold_hair part (the side-lock clasps sit lower)"""
    m = S.part == S.parts.get("gold_hair", -9)
    if not m.any():
        return None
    lab, n = clusters(m)
    best = min(range(1, n + 1), key=lambda k: np.nonzero(lab == k)[0].min())
    ys, xs = np.nonzero(lab == best)
    return float(xs.mean()) + 0.5, float(ys.mean()) + 0.5, int(ys.min())


def step_ornament(S):
    """the crown pin as one deliberate cluster (3x3 at 144, 2x2 at 80: highlight, body, shadow) with an OL ring
    where it meets the background; at 80 the render keeps no pin pixel, so it is placed from the 144 still of the
    same pose, scaled about the anchor (same camera)"""
    key = "144" if S.px >= 110 else "80"
    pc = pin_centre(S)
    src = "own"
    if key == "80":
        d144 = os.path.join(os.path.dirname(S.d), "px144")
        if os.path.exists(os.path.join(d144, "meta.json")):
            T = Still(d144, "still_hands")
            p1 = pin_centre(T)
            if p1:
                k = S.px / T.px
                ax, ay = T.meta["anchor"]
                bx, by = S.meta["anchor"]
                pc = (bx + (p1[0] - ax) * k, by + (p1[1] - ay) * k, None)
                src = "from 144"
    if not pc:
        return {"skip": "no pin"}
    rows = PIN[key]
    w, h = len(rows[0]) // 2, len(rows)
    x0, y0 = int(round(pc[0] - w / 2)), int(round(pc[1] - h / 2))
    for j, r in enumerate(rows):
        for i in range(w):
            S.put(x0 + i, y0 + j, r[2 * i:2 * i + 2])
    ring = 0
    for j in range(-1, h + 1):
        for i in range(-1, w + 1):
            x, y = x0 + i, y0 + j
            if 0 <= x < S.W and 0 <= y < S.H and not S.a[y, x] and                     any(0 <= y + dy < S.H and 0 <= x + dx < S.W and x0 <= x + dx < x0 + w and y0 <= y + dy < y0 + h
                        for dy, dx in N4):
                S.put(x, y, "OL")
                ring += 1
    return {"at": [x0, y0], "size": [w, h], "src": src, "ring": ring}


def step_hands(S):
    """the constructed fists (author_hands' hands_parts == 1) read as a pale mitten beside the white cuff: their
    S1 steps to S2, so the fist sits a value under the sleeve"""
    p = os.path.join(S.d, "hands_parts.png")
    if not os.path.exists(p):
        return {"skip": "no hands"}
    hp = np.asarray(Image.open(p)) == 1
    m = hp & S.is_code(["S1"])
    S.c[m] = CI["S2"]
    return {"s1_to_s2": int(m.sum())}


def step_tips(S):
    """azure tips on the hair's long clumps (DESIGN 6: A3 then A4 over the last 2-4 px): the tail's A4 runs
    (5-6 px prongs that read as a claw in the back view) step down to A3, and only a tip's end pixel (one
    hair-coloured 4-neighbour at most) keeps A4"""
    tip = S.mat == S.mats.get("hairtip", -9)
    hairish = S.is_code(HAIRC + ("A3", "A4"))
    m = tip & S.is_code(["A4"])
    S.c[m] = CI["A3"]
    ends = 0
    for y, x in zip(*np.nonzero(tip & S.is_code(["A3"]))):
        nb = sum(1 for dy, dx in N4 if 0 <= y + dy < S.H and 0 <= x + dx < S.W and hairish[y + dy, x + dx])
        if nb <= 1:
            S.put(x, y, "A4")
            ends += 1
    return {"a4_to_a3": int(m.sum()), "ends_a4": ends}


THIGH_BANDS = ((0.08, "S2"), (0.26, "S1"), (0.54, "S2"), (0.70, "S3"), (0.80, "S4"), (1.01, "S3"))


def step_skin(S, cfg=None):
    """the thighs as cylinders (the shading lane's plane fit left them two flat blocks): per row, across the
    thigh's own skin run, from the lit edge: a lit rim, an S1 band, S2, the S3 terminator, an S4 core shadow and
    an S3 bounce before the outline; only S1-S3 pixels are re-banded (gold straps, the outline and the stamps
    stay). Then the band crease: the skin row right over a stocking band takes S3 (the flesh presses over it),
    and the knee: a 2 px lit cap (the stocking's spec tone) over a 2 px K3 shadow at each knee landmark."""
    cfg = cfg or {}
    bands = cfg.get("bands") or THIGH_BANDS
    ls = 1 if S.meta.get("light_cam", [1])[0] >= 0 else -1
    notes = {"rows": 0, "px": 0, "crease": 0, "knee": 0}
    sk3 = S.is_code(SKIN3)
    min_w = 8 if S.px >= 110 else 5
    for lid in (4, 5):
        lm = S.skin & (S.limb == lid) & ~S.head
        for y in np.nonzero(lm.any(1))[0]:
            xs = np.nonzero(lm[y])[0]
            xl, xr = int(xs.min()), int(xs.max())
            if xr - xl + 1 < min_w or len(xs) < 0.6 * (xr - xl + 1):
                continue
            w = max(1, xr - xl)
            notes["rows"] += 1
            for x in range(xl, xr + 1):
                if not sk3[y, x]:
                    continue
                v = (xr - x) / w if ls > 0 else (x - xl) / w
                cd = next(c for t, c in bands if v < t)
                if S.px < 110 and cd == "S1":
                    cd = "S2"
                if cd == "S4" and w < 12:
                    cd = "S3"
                S.put(x, y, cd)
                notes["px"] += 1
    # crease over the stocking bands (thigh-high tops: stocking or gold_thigh part right under a thigh skin px)
    band_parts = [S.parts.get("stockings", -9), S.parts.get("gold_thigh", -9)]
    thigh = S.skin & np.isin(S.limb, [4, 5]) & ~S.head
    for y, x in zip(*np.nonzero(thigh[:-1] & np.isin(S.part[1:], band_parts))):
        if S.code(x, y) in ("S1", "S2"):
            S.put(x, y, "S3")
            notes["crease"] += 1
    if S.px < 110:
        # 80 px: the K ramp is too close in value to read the legs as round (two indigo sticks at 1x); one sheen
        # line of the stocking's spec tone runs 1 px in from each leg's lit edge, every row of a 3+ px run
        st = S.mats.get("stocking", -9)
        sm = (S.mat == st) & S.is_code(["K1", "K2", "K3"])
        n = 0
        for y in np.nonzero(sm.any(1))[0]:
            xs = np.nonzero(sm[y])[0]
            for r in np.split(xs, np.nonzero(np.diff(xs) > 1)[0] + 1):
                if len(r) < 3:
                    continue
                x = int(r[-2]) if ls > 0 else int(r[1])
                if S.code(x, y) in ("K1", "K2"):
                    S.put(x, y, "I2")
                    n += 1
        notes["leg_sheen_80"] = n
    if S.lm and S.px >= 110:
        st = S.mats.get("stocking", -9)
        for k in ("knee_L", "knee_R"):
            if k not in S.lm.get("joints", {}):
                continue
            kx, ky = S.lm["joints"][k]
            kx, ky = int(kx), int(ky)
            for (dx, dy, cd) in ((0, -1, "I2"), (ls, -1, "I2"), (-ls, 1, "K3"), (0, 1, "K3")):
                x, y = kx + dx, ky + dy
                if 0 <= x < S.W and 0 <= y < S.H and S.mat[y, x] == st and S.code(x, y) in ("K1", "K2", "K3", "I2"):
                    S.put(x, y, cd)
                    notes["knee"] += 1
    return notes


def preview(still, colors_preset=None, tag="still_wh2"):
    """remapped copy for looking (the chain's real remap runs in stills_v2)"""
    import shutil
    sys.path.insert(0, os.path.join(REPO, "tools", "pixel-pipeline"))
    import rosace_shade_stills
    src = os.path.join(still, tag + ".png")
    dst = os.path.join(still, tag + "_preview.png")
    shutil.copyfile(src, dst)
    if colors_preset:
        P = json.load(open(os.path.join(REPO, colors_preset), encoding="utf-8"))
        rosace_shade_stills.remap(dst, P.get("colors"))
    return dst


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--still", required=True)
    ap.add_argument("--pose", default=None)
    ap.add_argument("--only", default="")
    ap.add_argument("--base", default="still_hands")
    a = ap.parse_args()
    pose = a.pose or json.load(open(os.path.join(a.still, "meta.json")))["pose"]
    print(json.dumps(run(a.still, pose, [s for s in a.only.split(",") if s], a.base), default=str)[:2000])
