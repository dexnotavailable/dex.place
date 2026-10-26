# Rosace hands: constructed per pose (ART-RULES 3, HD-P01), plus the weapon's authored pixels.
#
#   python tools/pixel-pipeline/author_hands.py apply --still <render>/px<N> --spec art/rosace/hands/poses/<pose>_<N>.json
#          [--base base] [--tag still] [--guides]
#   python tools/pixel-pipeline/author_hands.py library [--review <dir>]     (the superseded round-4 stamps)
#
# Glaive-hands lane, round 1 (2026-09-29). DESIGN 7 revision 3: "every hand is built per pose from a palm box, a
# mitten of fingers, a thumb wedge and a 1 px wrist step"; the round-4 stamp library (below, `library`) is
# superseded, not deleted. A hand here is data (the spec JSON: which grip, the view, a size, nudges) plus the grip
# landmarks the lane render records (tools/art-construct/gh_render.py -> landmarks.json: the haft line on screen,
# the grip point, the wrist and elbow, the back-of-hand facing). The constructor works in the haft's own frame:
#   tau  along the haft, + toward the thumb end (the tip when the thumb points at the tip)
#   v    across the haft, + toward the knuckles (away from the wrist: the forearm enters from -v)
# Construction, in order (WF-P06 inside the hand):
#   1. erase the render's hand (skin within the erase radius past the wrist; each pixel refilled from its nearest
#      non-hand neighbour, as round R2 learned) and repaint the haft through the grip, so the haft is collinear on
#      both sides of the fist (GR-P05);
#   2. palm box (a rounded box around the haft, the knuckle edge bowed: the middle knuckle highest), the wrist
#      stub with a 1 px step on the -v side, the thumb wedge at the thumb end crossing the haft on the near side
#      and kept inside the fist's outline (HD-P07);
#   3. one light (the render's key light, screen space): a cylinder normal around the haft axis gives S1 / S2 / S3
#      bands with hard thresholds, the shadow on the palm (away-from-light) side only (HD-P05, HD-N03);
#   4. the knuckle line (a 1 px S3 curve under the knuckle row, middle highest, HD-P02) or, in the finger view,
#      the fingertip tuck line; at most two finger separations (HD-N02); the S4 thumb crease;
#   5. the outline inside the shape: OL against the background and dark materials, S4 (a contact line) against
#      light ones (PX-P08, round R2), nothing where the wrist runs into the forearm.
# Weapon pixels (DESIGN 7: the rose disc "gold ring, 8 glass cells (A2 and A3 alternating), 1 px A5 centre"):
#   the rose stamp art/rosace/hands/glaive/rose_<px>.json replaces the disc's rendered pixels when the disc faces
#   the viewer (facing >= its min_facing), placed on the projected disc centre; blade glints are listed pixels on
#   the edge, placed from the tip along the haft.
# Round 2 (critique 5.5/10):
#   template "r3" (construct/fist_<px>_r3.json, fixed tones in its "codes"): one continuous knuckle line, the lit
#     thumb over the haft, an S3 wrist step; ROSACE_FIST=<r1|r2|r3> overrides every spec for A/B renders
#   "wrist_ext": n  the wrist runs n px out of the fist over the bell's mouth, ringed in lining (the idle)
#   "rose": {"proc": true}  rose_proc(): disc + cross arms drawn in the haft's frame, OL-outlined, glass in 2 colours
#     (the 80 px specs; ROSACE_ROSE80=proc forces it at 80)
#   "smear": {...}  smear(): an authored crescent behind the blade tip about a pivot fist (N1 contact);
#     ROSACE_SMEAR=0 turns it off
import json
import math
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
D = os.path.join(REPO, "art", "rosace", "hands")
GL = os.path.join(D, "glaive")
sys.path.insert(0, HERE)

LIGHT = np.array([0.50, -0.62, 0.60])       # rosace/render.py LIGHT_CAM in screen axes (x right, y down, z out)
LIGHT = LIGHT / np.linalg.norm(LIGHT)
DARK = ("haft", "hair", "hairtip", "indigo", "stocking", "boot", "lining", "thong", "steeldark")
LIGHTM = ("skin", "white", "veil", "beige", "gold", "steel", "edge", "glass", "glass2", "glasscore")

# sizes per sprite height (px): half along the haft (tau), the knuckle and wrist extents across it (v), the corner
# round, the thumb wedge, the wrist stub, the erase radius. 144: a 7-8 x 8-9 fist (HD-P02: 7-9 x 6-8; GR-P06: >= 7
# across with 2 px each side of a 3-4 px haft band). 80 px: 4 x 5 (DESIGN 2: hands 4-5 px at 96).
SIZES = {
    144: {"half": 3.6, "vk": 4.4, "vw": 4.2, "round": 1.6, "thumb": (1.6, 4.0, -3.6, 0.9), "stub": (2.5, 2.0, 6.5),
          "erase": 8.0, "bow": 0.10, "knuckle": 2.2, "seps": (-1.3, 0.9)},
    80: {"half": 2.1, "vk": 2.6, "vw": 2.4, "round": 0.9, "thumb": (1.0, 2.3, -2.1, 0.4), "stub": (1.4, 1.1, 3.8),
         "erase": 4.6, "bow": 0.0, "knuckle": 1.3, "seps": ()},
}


def palette():
    import faces
    return faces.palette()


def unit(v):
    v = np.asarray(v, float)
    return v / (np.linalg.norm(v) + 1e-9)


class Still:
    def __init__(self, still, base="base"):
        self.dir = still
        self.meta = json.load(open(os.path.join(still, "meta.json")))
        self.lm = json.load(open(os.path.join(still, "landmarks.json")))
        self.img = np.array(Image.open(os.path.join(still, base + ".png")).convert("RGBA"))
        self.mat = np.asarray(Image.open(os.path.join(still, "noface_id.png")).convert("RGBA"))[..., 0].astype(int).copy()
        self.px = self.meta["px"]
        self.pal = palette()
        self.code_of = {tuple(v): k for k, v in self.pal.items()}
        self.mid = {n: m["id"] for n, m in self.meta["materials"].items()}
        self.name = {v: k for k, v in self.mid.items()}
        self.H, self.W = self.mat.shape
        self.touched = np.zeros((self.H, self.W), bool)
        self.part = np.zeros((self.H, self.W), np.int16)     # 1.. = hand index + 1

    def code(self, x, y):
        if not (0 <= x < self.W and 0 <= y < self.H) or self.img[y, x, 3] == 0:
            return None
        return self.code_of.get(tuple(self.img[y, x, :3]))

    def matname(self, x, y):
        if not (0 <= x < self.W and 0 <= y < self.H) or self.img[y, x, 3] == 0:
            return None
        return self.name.get(int(self.mat[y, x]), "other")

    def put(self, x, y, code, mat=None):
        if not (0 <= x < self.W and 0 <= y < self.H):
            return
        if code is None:
            self.img[y, x] = 0
            self.mat[y, x] = 0
        else:
            self.img[y, x, :3] = self.pal[code]
            self.img[y, x, 3] = 255
            if mat:
                self.mat[y, x] = self.mid[mat]
        self.touched[y, x] = True


# ------------------------------------------------------------------ haft on screen

def haft_frame(st, grip, spec):
    hf = st.lm["haft"]
    b, t = np.array(hf["butt"]), np.array(hf["tip"])
    u = unit(t - b)
    g = np.array(grip["target"], float) + np.array(spec.get("nudge", [0, 0]), float)
    # the grip centre sits on the haft line (GR-P05): project the socket target onto the screen line
    g = b + u * ((g - b) @ u) + unit([-u[1], u[0]]) * spec.get("across_nudge", 0.0)
    return b, t, u, g


def haft_half(st):
    return 1.9 if st.px >= 128 else 1.1


def repaint_haft(st, b, u, g, span, lo_skip=None):
    """the haft through the grip region: OL sides, I3/I2 core with the I1 sheen on the lit side (PX-P28) -- the
    render's own ramp. Only pixels within `span` px of g along the haft are repainted, and only where the render
    currently shows the hand, the sleeve or skin over it (the haft is in front of the forearm at a grip)."""
    n = unit([-u[1], u[0]])
    hw = haft_half(st)
    lit_side = 1 if (n[0] * LIGHT[0] + n[1] * LIGHT[1]) > 0 else -1
    cx, cy = g
    r = int(span + 3)
    for y in range(int(cy) - r, int(cy) + r + 1):
        for x in range(int(cx) - r, int(cx) + r + 1):
            p = np.array([x + 0.5, y + 0.5]) - g
            a, c = p @ u, p @ n
            if abs(a) > span or abs(c) > hw + 0.35:
                continue
            m = st.matname(x, y)
            if m in ("haft", "gold") and not st.touched[y, x]:
                continue
            if lo_skip and m in lo_skip:
                continue
            # copy the render's own haft cross-section from outside the grip region (same offset across the haft,
            # the nearest clean haft pixel along it), so the repaint matches the rendered ramp (round 1: a fixed
            # I2 core read as a darker patch under the fist)
            code = None
            for k in range(int(span) + 1, int(span) + 16):
                for sgn in (1, -1):
                    q = g + u * (sgn * k) + n * c
                    qx, qy = int(math.floor(q[0])), int(math.floor(q[1]))
                    if st.matname(qx, qy) == "haft" and not st.touched[qy, qx]:
                        code = st.code(qx, qy)
                        break
                if code:
                    break
            if code is None:
                e = abs(c)
                code = "OL" if e > hw - 0.55 else ("I1" if (c * lit_side > 0.2 and st.px >= 128) else "I2")
            st.put(x, y, code, "haft")


# ------------------------------------------------------------------ the fist

def fist_mask(sz, tau, v):
    """inside tests in the haft frame (pixel-centre coordinates); returns (mass, thumb, stub) booleans"""
    h, vk, vw, rr = sz["half"], sz["vk"], sz["vw"], sz["round"]
    # knuckle edge bowed: the middle knuckle highest (HD-P02); the far end of the finger row rounds off
    vk_t = vk - sz["bow"] * (tau - 0.3) ** 2
    inside = (abs(tau) <= h) & (v >= -vw) & (v <= vk_t)
    # rounded corners
    for sx, sy, vlim in ((1, 1, vk_t), (-1, 1, vk_t), (1, -1, -vw), (-1, -1, -vw)):
        cx = sx * (h - rr)
        cy = vlim - sy * rr
        corner = (sx * (tau - cx) > 0) & (sy * (v - cy) > 0)
        inside &= ~(corner & ((tau - cx) ** 2 + (v - cy) ** 2 > rr ** 2 + 0.15))
    t0, t1, v0, v1 = sz["thumb"]
    # thumb wedge: a triangle whose base runs along the thumb end from the wrist side across the haft
    thumb = (tau >= t0) & (tau <= t1) & (v >= v0) & (v <= v1) & ((tau - t0) <= (t1 - t0) * (v1 - v + 0.6) / (v1 - v0 + 0.6))
    sa, sb, sd = sz["stub"]
    stub = (tau >= -sa) & (tau <= sb) & (v < -vw + 0.9) & (v >= -sd)
    return inside, thumb, stub


CONSTRUCT = os.path.join(D, "construct")


def template(px, view, ver="r2"):
    """ver "r2" (round 2, default) or "r1" (the round-1 template, kept for the record and the A/B control)"""
    base = f"fist_{144 if px >= 128 else 80}"
    p = os.path.join(CONSTRUCT, f"{base}_{ver}.json")
    if ver == "r1" or not os.path.exists(p):
        p = os.path.join(CONSTRUCT, base + ".json")
    t = json.load(open(p, encoding="utf-8"))
    return t["views"][view]["rows"], t["origin"]


def template_codes(px, ver):
    """round 2, r3 on: the template's own fixed tones ('codes'), or None (r1 / r2 use plane_codes)"""
    p = os.path.join(CONSTRUCT, f"fist_{144 if px >= 128 else 80}_{ver}.json")
    if not os.path.exists(p):
        return None
    return json.load(open(p, encoding="utf-8")).get("codes")


def plane_codes(tdir, vdir, lit_thr=0.2):
    """label -> palette code under the one key light, given the oriented planes (see construct/fist_144.json). The
    knuckle ridge is the fist's highest plane and always catches the light (round 1: with the thumb end and the
    knuckles both turned from the light, Q's and N2's fists had no S1 at all and read as a flat patch)"""
    l2 = unit(LIGHT[:2])
    up = tdir @ l2 > lit_thr            # the thumb end faces the light
    dn = -tdir @ l2 > lit_thr
    kn = vdir @ l2 > lit_thr            # the knuckle side faces the light
    return {"b": "S2", "u": "S1" if up else "S3", "d": "S2" if dn else "S3", "k": "S2" if kn else "S3",
            "r": "S1", "l": "S3" if kn else "S4", "n": "S3" if kn else "S4",
            "t": "S1" if up else "S2", "T": "S3", "c": "S4", "w": "S2",
            # round 2 labels (fist_<px>_r2.json): B the back's far edge turning away, f the lit top of a finger roll,
            # e the tucked fingertip end (palm side, always shade)
            "B": "S3", "f": "S1" if (kn or up) else "S2", "e": "S3"}


def plane_codes_r2(tdir, vdir, lit_thr=0.2):
    """round 2: the palm side (finger strip, pinky end, fingertips) sits in S3 unless it faces the light squarely
    (critique: 'a darker skin shade (S3) on the palm side, so the hand stops reading as part of the cuff'); the
    ridge and the thumb carry the light"""
    c = plane_codes(tdir, vdir, lit_thr)
    l2 = unit(LIGHT[:2])
    kn = vdir @ l2 > 0.55
    dn = -tdir @ l2 > 0.55
    c.update({"k": "S2" if kn else "S3", "d": "S2" if dn else "S3", "n": "S4", "l": "S4" if not kn else "S3"})
    return c


def orient(rows, origin, tdir, vdir):
    """canonical template cells -> screen offsets. Canonical +x = toward the wrist (-vdir), +y = toward the pinky end
    (-tdir). The dominant screen axis of the haft keeps whole rows (or columns); the other axis is sheared by the
    haft's slope, so the fist follows the haft without breaking its runs."""
    ox, oy = origin
    wx, py_ = -vdir, -tdir
    out = {}
    vertical = abs(tdir[1]) >= abs(tdir[0])
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in ". ":
                continue
            dx, dy = i - ox, j - oy
            if vertical:
                R = int(round(dy * math.copysign(1, py_[1]) + dx * 0))
                # the wrist axis on screen: mostly x (the haft is mostly vertical)
                C = int(round(dx * math.copysign(1, wx[0]))) + int(round(R * tdir[0] / tdir[1]))
            else:
                C = int(round(dy * math.copysign(1, py_[0])))
                R = int(round(dx * math.copysign(1, wx[1]))) + int(round(C * tdir[1] / tdir[0]))
            out[(C, R)] = ch
    return out


def build_fist(st, idx, grip, spec, guides=None):
    """a fist closed on the haft: the construction template (art/rosace/hands/construct/fist_<px>.json) oriented on
    the real haft, lit by the key light, outlined by what it touches"""
    b, t, u, g = haft_frame(st, grip, spec)
    n = unit([-u[1], u[0]])
    side = spec["side"]
    J = st.lm["joints"]
    wrist, elbow = np.array(J[f"wrist_{side}"]), np.array(J[f"elbow_{side}"])
    a = unit(elbow - wrist)                          # from the wrist toward the elbow
    ws = spec.get("wrist_side") or (-1 if a @ n < 0 else 1)   # the side of the haft the forearm enters from
    vdir = -ws * n                                  # +v: toward the knuckles
    thumb = spec.get("thumb", grip.get("thumb", "tip"))
    tdir = u if thumb == "tip" else -u
    if spec.get("flip_thumb"):
        tdir = -tdir
    view = spec.get("view") or ("back" if grip.get("back_facing", 1) > 0.35 else "fingers")
    # a forearm running along the haft (the front hand of a thrust, a wind-up) leaves the fist at the pinky end
    along = spec.get("along")
    if along is None:
        along = abs(a @ u) > 0.72 and (a @ tdir) < 0
    if along and not view.endswith("_along"):
        view += "_along"
    big = st.px >= 128
    erase_r = spec.get("erase", 8.0 if big else 4.6)
    R = int(erase_r) + 2
    # ---- 1. erase the render's hand: skin near the grip, past the wrist
    er = []
    for y in range(int(g[1]) - R, int(g[1]) + R + 1):
        for x in range(int(g[0]) - R, int(g[0]) + R + 1):
            if not (0 <= x < st.W and 0 <= y < st.H):
                continue
            p = np.array([x + 0.5, y + 0.5])
            if np.linalg.norm(p - g) > erase_r or st.matname(x, y) != "skin":
                continue
            if (p - wrist) @ a > spec.get("keep_forearm", 1.0):
                continue
            er.append((x, y))
    ers = set(er)
    fill(st, ers)
    half = 4.0 if big else 2.5
    repaint_haft(st, b, u, g, half + spec.get("haft_span", 2.0 if big else 1.0), lo_skip=tuple(spec.get("haft_under", [])))
    # ---- 2-4. the construction template, oriented and lit
    # ROSACE_FIST=<ver> overrides every spec (the round-2 A/B renders one spec set with r2 and r3)
    ver = os.environ.get("ROSACE_FIST") or spec.get("template", "r2")
    rows, origin = template(st.px, view, ver)
    cells = orient(rows, origin, tdir, vdir)
    codes = plane_codes_r2(tdir, vdir) if ver == "r2" else plane_codes(tdir, vdir)
    fixed = template_codes(st.px, ver) if ver not in ("r1", "r2") else None
    if fixed:
        codes = dict(fixed)
    codes.update(spec.get("codes", {}))
    gx, gy = int(math.floor(g[0])), int(math.floor(g[1]))
    under = set(spec.get("wrist_under", []))
    paint, labels = {}, {}
    for (C, Rr), ch in cells.items():
        x, y = gx + C, gy + Rr
        if not (0 <= x < st.W and 0 <= y < st.H):
            continue
        if ch == "w" and st.matname(x, y) in under:
            continue
        labels[(x, y)] = ch
    # ---- 5. outline: O cells take OL against the ground / dark materials, S4 against light ones; a shape cell with
    # an outside neighbour of skin on the wrist side ('w' rows) is left open into the forearm
    # r3 (fixed tones): one terminator across the fist, perpendicular to the key light (HD-P05: the shadow on the side
    # away from the light, one direction, no ring). The lines (l knuckle, c crease, w wrist step) and the ridge keep
    # their tones; the surface planes go S2 on the light's side of the fist centre and S3 on the other; the thumb
    # drops to S2 on the far side. Round 2: the fixed finger-band shade put the shadow toward the light on Q and N2.
    tone = {}
    if fixed and spec.get("terminator", True) and labels:
        l2 = unit(LIGHT[:2])
        body = [p for p, ch in labels.items() if ch not in ("O", "w")]
        cx_ = np.mean([p[0] for p in body])
        cy_ = np.mean([p[1] for p in body])
        ext = max(1.0, max(abs((np.array([p[0] - cx_, p[1] - cy_]) @ l2)) for p in body))
        for p, ch in labels.items():
            sd = (np.array([p[0] - cx_, p[1] - cy_]) @ l2) / ext
            if ch in ("k", "b", "B", "d", "f", "e", "T", "n"):
                tone[p] = "S2" if sd > spec.get("term_at", -0.1) else "S3"
            elif ch == "t":
                tone[p] = "S1" if sd > -0.35 else "S2"
    for (x, y), ch in labels.items():
        if ch != "O":
            paint[(x, y)] = tone.get((x, y), codes.get(ch, "S2"))
            continue
        outs = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if (x + dx, y + dy) not in labels]
        kinds = [st.matname(ox, oy) for ox, oy in outs]
        if ver != "r1" and not spec.get("contact_lines"):
            # round 2: the fist is ringed in OL on every side (the critique's 1 px dark separator)
            paint[(x, y)] = "OL"
        elif not outs or any(k is None or k in DARK or k == "other" for k in kinds):
            paint[(x, y)] = "OL"
        else:
            # against light materials: the S4 contact line (round R2), or the spec's "edge" (e.g. "OL" for a fist
            # over bare skin, where S4 finger lines read as skin folds)
            light = [k for k in kinds if k not in (None, "other") and k not in DARK]
            paint[(x, y)] = spec.get("edge", "S4") if (set(light) & set(spec.get("edge_on", ["skin"]))) else "S4"
    for (x, y), c in paint.items():
        st.put(x, y, c, "skin")
        if labels.get((x, y)) != "w":            # the wrist cells belong to the forearm, not the hand
            st.part[y, x] = idx + 1
    # round 2 (HD-P08): close the ring. The shear that follows the haft can land two template cells on one pixel, so
    # at 80 an interior tone sometimes sits on the rim against hair or belt gold; such a rim cell (an outside
    # neighbour that is not forearm skin, the haft or empty) becomes OL itself, inward, so the fist keeps its size
    # (closing outward made N2's fist 10 px across, HD-P02)
    closed = 0
    if ver != "r1" and not spec.get("contact_lines"):
        for (x, y), ch in list(labels.items()):
            if ch in ("O", "w"):
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q in labels or not (0 <= q[0] < st.W and 0 <= q[1] < st.H):
                    continue
                m = st.matname(*q)
                if m in (None, "skin", "haft") or st.code(*q) == "OL":
                    continue
                st.put(x, y, "OL", "skin")
                closed += 1
                break
    cuffrec = None
    if ver != "r1" and spec.get("cuff", True):
        cuffrec = cuff_mouth(st, idx, wrist, a, set(labels), spec,
                             wcells=[p for p, ch in labels.items() if ch == "w"])
    xs_ = [p[0] for p in paint]
    ys_ = [p[1] for p in paint]
    wc = [p for p, ch in labels.items() if ch == "w"]
    wpx = [round(float(np.mean([p[0] for p in wc])) + 0.5, 2), round(float(np.mean([p[1] for p in wc])) + 0.5, 2)] if wc else None
    rec = {"side": side, "kind": "fist", "view": view, "wrist_px": wpx, "grip": [round(float(g[0]), 2), round(float(g[1]), 2)],
           "thumb": thumb, "wrist_side": int(ws), "palm_box": True, "mitten": True, "thumb_wedge": True,
           "wrist_step": True, "bbox": [min(xs_), min(ys_), max(xs_), max(ys_)], "erased": len(ers), "px": len(paint),
           "tdir": [round(float(v), 3) for v in tdir], "vdir": [round(float(v), 3) for v in vdir],
           "template": ver, "cuff": cuffrec, "ring_closed": closed}
    if guides is not None:
        guides.append(("fist", g, u, vdir, tdir))
    return rec


SLEEVE = ("white", "veil", "beige")


def cuff_mouth(st, idx, wrist, a, fist_cells, spec, wcells=()):
    """round 2 (critique 6: 'the cuff is so close in value to the hand that the hand merges into it'; 'taper the
    forearm 1 px before the cuff'). Between the fist and the bell cuff:
      1. taper: forearm skin within `taper_len` px of the wrist (along a, toward the elbow) that lies more than
         half_w(t) = w0 + slope * t from the forearm axis is refilled from its non-skin neighbours;
      2. the cuff mouth: every sleeve pixel (white / veil / beige) 8-touching that forearm skin or the fist's wrist
         cells becomes the sleeve's inside, lining I3 (I4 where it also touches the fist's own outline), so a dark
         1 px ring separates the hand from the white bell the way the refs' dark gloves separate theirs.
    The lining is the bell's real inside (DESIGN 3: indigo lining), not an outline drawn on the cloth."""
    big = st.px >= 128
    L = spec.get("taper_len", 6.0 if big else 3.0)
    w0 = spec.get("taper_w0", 1.6 if big else 0.9)
    slope = spec.get("taper_slope", 0.22 if big else 0.2)
    n = np.array([-a[1], a[0]])
    R = int(L) + 4
    cx, cy = int(wrist[0]), int(wrist[1])
    arm = set()
    cut = set()
    for y in range(cy - R, cy + R + 1):
        for x in range(cx - R, cx + R + 1):
            if (x, y) in fist_cells or st.matname(x, y) != "skin" or st.part[y, x]:
                continue
            p = np.array([x + 0.5, y + 0.5]) - wrist
            t, c = p @ a, p @ n
            if -1.0 <= t <= L and abs(c) <= w0 + slope * max(t, 0) + 2.5:
                if spec.get("taper", big) and 0.5 <= t <= L and abs(c) > w0 + slope * t + 0.5:
                    cut.add((x, y))
                else:
                    arm.add((x, y))
    if cut:
        fill(st, cut)
    # round 2 (critique 6: 'pull the idle sleeve bell 2-3 px back or down so the wrist shows'): the wrist runs on
    # `wrist_ext` px out of the fist's wrist cells toward the elbow, over the bell's mouth (sleeve / lining px
    # become forearm skin S2); the mouth ring below then rings it in lining, so the wrist reads between the fist and
    # the bell instead of the bell swallowing the hand
    ext = spec.get("wrist_ext", 0)
    ext_n = 0
    if ext and len(wcells):
        for (x, y) in wcells:
            for k in range(1, int(ext) + 1):
                q = np.array([x + 0.5, y + 0.5]) + a * k
                qx, qy = int(math.floor(q[0])), int(math.floor(q[1]))
                if (qx, qy) in fist_cells or st.part[qy, qx]:
                    continue
                if st.matname(qx, qy) in SLEEVE + ("lining",) or (st.matname(qx, qy) == "skin" and not st.touched[qy, qx]):
                    st.put(qx, qy, spec.get("wrist_code", "S2"), "skin")
                    arm.add((qx, qy))
                    ext_n += 1
    wrist_cells = {p for p in fist_cells if st.matname(*p) == "skin"}
    near = arm | wrist_cells
    ring = 0
    if spec.get("mouth", True):
        for (x, y) in sorted(near):
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    q = (x + dx, y + dy)
                    if q in near or q in fist_cells or st.matname(*q) not in SLEEVE:
                        continue
                    if abs(dx) + abs(dy) == 2 and not spec.get("mouth8", big):
                        continue
                    st.put(q[0], q[1], spec.get("mouth_code", "I3"), "lining")
                    ring += 1
    return {"taper_cut": len(cut), "mouth": ring, "arm_px": len(arm), "wrist_ext": ext_n}


def fill(st, region):
    """refill erased pixels from their nearest non-region neighbours (iterative dilation); a pixel whose nearest
    neighbours are background becomes background"""
    todo = set(region)
    src = {}
    for (x, y) in todo:
        st.img[y, x] = 0
    frontier = todo
    it = 0
    while todo and it < 30:
        it += 1
        new = {}
        for (x, y) in todo:
            votes = {}
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                q = (x + dx, y + dy)
                if q in todo or not (0 <= q[0] < st.W and 0 <= q[1] < st.H):
                    continue
                w = 2 if dx == 0 or dy == 0 else 1
                key = (tuple(st.img[q[1], q[0]]), int(st.mat[q[1], q[0]]))
                votes[key] = votes.get(key, 0) + w
            if votes:
                new[(x, y)] = max(votes, key=votes.get)
        for (x, y), (rgba, m) in new.items():
            st.img[y, x] = rgba
            st.mat[y, x] = m if rgba[3] else 0
            st.touched[y, x] = True
        todo = todo - set(new)
    del frontier, src


# ------------------------------------------------------------------ open hands

def build_open(st, idx, spec, guides=None):
    """a relaxed open hand as a mitten (HD-P03/P04): palm box + one mitten with at most one separated finger + the
    thumb apart; placed at the hand landmarks (wrist -> fingertip), built in the hand's own frame
    (w along the hand, + toward the fingertips; q across, + toward the thumb)."""
    side = spec["side"]
    J = st.lm["joints"]
    wrist = np.array(J[f"wrist_{side}"], float) + np.array(spec.get("nudge", [0, 0]), float)
    tipj = np.array(J[f"hand_{side}"], float)
    w = unit(tipj - wrist) if not spec.get("dir") else unit(spec["dir"])
    q = np.array([-w[1], w[0]]) * spec.get("thumb_sign", 1)
    L = spec.get("length", 10.0 if st.px >= 128 else 5.5)
    Wd = spec.get("width", 5.0 if st.px >= 128 else 3.0)
    R = int(L) + 3
    er = []
    for y in range(int(wrist[1]) - R, int(wrist[1]) + R + 1):
        for x in range(int(wrist[0]) - R, int(wrist[0]) + R + 1):
            if not (0 <= x < st.W and 0 <= y < st.H):
                continue
            p = np.array([x + 0.5, y + 0.5]) - wrist
            if st.matname(x, y) == "skin" and p @ w > 0.3 and np.linalg.norm(p) < L + 2.5:
                er.append((x, y))
    fill(st, set(er))
    paint = {}
    for y in range(int(wrist[1]) - R, int(wrist[1]) + R + 1):
        for x in range(int(wrist[0]) - R, int(wrist[0]) + R + 1):
            p = np.array([x + 0.5, y + 0.5]) - wrist
            a, c = p @ w, p @ q
            # palm box then the mitten tapering to a curved fingertip line (middle finger longest)
            half = Wd / 2 * (1.0 if a < L * 0.55 else max(0.35, 1 - (a - L * 0.55) / (L * 0.62)))
            inside = (0 <= a <= L - 0.25 * (c / (Wd / 2)) ** 2 * 2.0) and abs(c + 0.3) <= half
            thumbp = (L * 0.15 <= a <= L * 0.5) and (Wd / 2 - 0.2 <= c <= Wd / 2 + 1.6) and c - Wd / 2 <= (L * 0.5 - a) * 0.8
            if not (inside or thumbp):
                continue
            n3 = unit([*(q * (c / (Wd / 2 + 1)) * 0.8), 1.0])
            lit = n3 @ LIGHT
            code = "S1" if lit > 0.78 else ("S2" if lit > 0.35 else "S3")
            if thumbp and not inside:
                code = "S2" if lit > 0.35 else "S3"
            paint[(x, y)] = code
    # one separated finger (the index), a 1 px S3 crease from the tip line back
    if st.px >= 128 and spec.get("separate", True):
        for k in range(3):
            pnt = wrist + w * (L - 1.0 - k) + q * (Wd / 2 - 1.8)
            key = (int(pnt[0]), int(pnt[1]))
            if key in paint:
                paint[key] = "S3"
    ps = set(paint)
    for (x, y), c in list(paint.items()):
        out = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if (x + dx, y + dy) not in ps]
        if not out:
            continue
        kinds = []
        for ox, oy in out:
            m = st.matname(ox, oy)
            pv = np.array([ox + 0.5, oy + 0.5]) - wrist
            if m == "skin" and pv @ w < 0.8:
                kinds.append("wrist")
            elif m is None or m in DARK or m == "other":
                kinds.append("OL")
            else:
                kinds.append("S4")
        if "OL" in kinds:
            paint[(x, y)] = "OL"
        elif "S4" in kinds:
            paint[(x, y)] = "S4"
    for (x, y), c in paint.items():
        st.put(x, y, c, "skin")
        st.part[y, x] = idx + 1
    xs = [p[0] for p in paint]
    ys = [p[1] for p in paint]
    return {"side": side, "kind": "open", "on": spec.get("on"), "palm_box": True, "mitten": True, "thumb_wedge": True,
            "wrist_step": True, "bbox": [min(xs), min(ys), max(xs), max(ys)], "px": len(paint)}


# ------------------------------------------------------------------ weapon pixels

def rose(st, spec):
    """the authored rose-window stamp on the projected disc centre (DESIGN 7), when the disc faces the viewer"""
    px = 144 if st.px >= 128 else 80
    p = os.path.join(GL, f"rose_{px}.json")
    if not os.path.exists(p):
        return None
    R = json.load(open(p, encoding="utf-8"))
    hf = st.lm["haft"]
    if hf["disc_facing"] < R.get("min_facing", 0.8):
        return {"rose": "skipped", "facing": hf["disc_facing"]}
    c = np.array(hf["disc"], float) + np.array(spec.get("nudge", [0, 0]), float)
    u = unit(np.array(hf["tip"]) - np.array(hf["butt"]))
    # the stamp is authored upright (haft vertical, tip up); it is placed unrotated when the haft is within
    # 'upright_deg' of vertical, else its quarter-turn nearest the haft's direction is used (a round window has no
    # up; only the leading reads the direction)
    ang = math.degrees(math.atan2(u[0], -u[1]))
    k = int(round(ang / 90.0)) % 4
    rows = [list(r) for r in R["rows"]]
    for _ in range(k):
        rows = [list(r) for r in zip(*rows[::-1])]
    h, w = len(rows), len(rows[0])
    ox, oy = (w - 1) / 2.0, (h - 1) / 2.0
    cx, cy = int(math.floor(c[0])), int(math.floor(c[1]))
    n = 0
    allow = set(R.get("on", ["gold", "glass", "glass2", "glasscore", "haft", "stole", "white", "beige"]))
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in ". ":
                continue
            x, y = cx + int(round(i - ox)), cy + int(round(j - oy))
            m = st.matname(x, y)
            if m is not None and m not in allow and ch != "O":
                continue
            if m is None and ch != "O" and not R.get("over_bg", True):
                continue
            code = R["key"][ch]
            st.put(x, y, code, "glass" if code.startswith("A") else "gold")
            n += 1
    return {"rose": n, "quarter_turns": k, "at": [cx, cy]}


def rose_proc(st, spec):
    """round 2 (critique 7: 'at 80 the disc turns into a gold blob and the cross arms stop reading; draw the cross
    arms as a 1 px dark outline with 1 px gold and drop the inner cells to 2 colours so the cross holds'). The disc
    and the cross arms drawn in the haft's own screen frame (no quarter-turn snapping, so a 21 deg haft keeps its
    arms square to it): the render's gold / glass px in the disc band are cleared, then
      arms   1 px gold core (G1 on the lit side of the disc, G2 the other) with OL either side, a 3 px nub at the end
      disc   OL ring outside, a 1 px gold ring (G1 lit / G3 shade by the key light), glass in 2 colours (A2 / A3 by
             quadrant), the cross carried through the glass as 1 px G1 leading, an A5 centre
    Sizes in design units (glaive.py STYLES; 1 du = 1.5 px at 144, 0.83 at 80): R_du the disc radius, arm_du the
    arm half-length from the centre."""
    hf = st.lm["haft"]
    if hf["disc_facing"] < spec.get("min_facing", 0.85):
        return {"rose": "skipped", "facing": hf["disc_facing"]}
    s = 1.5 * st.px / 144.0
    R = spec.get("R_du", 5.25) * s
    arm = spec.get("arm_du", 8.5) * s
    c = np.array(hf["disc"], float) + np.array(spec.get("nudge", [0, 0]), float)
    u = unit(np.array(hf["tip"]) - np.array(hf["butt"]))
    n = np.array([-u[1], u[0]])
    l2 = unit(LIGHT[:2])
    B = int(arm + 4)
    cx, cy = int(math.floor(c[0])), int(math.floor(c[1]))
    box = [(x, y) for y in range(cy - B, cy + B + 1) for x in range(cx - B, cx + B + 1) if 0 <= x < st.W and 0 <= y < st.H]
    WEAP = ("gold", "glass", "glass2", "glasscore", "stole", "haft")
    cleared = 0
    for (x, y) in box:
        p = np.array([x + 0.5, y + 0.5]) - c
        a, b = p @ u, p @ n
        if abs(a) <= R + 0.6 and abs(b) <= arm + 2.2 and st.matname(x, y) in ("gold", "glass", "glass2", "glasscore")                 and abs(b) > 1.6:
            st.img[y, x] = 0
            st.mat[y, x] = 0
            st.touched[y, x] = True
            cleared += 1
    paint = {}
    nub_r = spec.get("nub_r", 1.3)
    for (x, y) in box:
        p = np.array([x + 0.5, y + 0.5]) - c
        a, b = p @ u, p @ n
        d = float(np.hypot(a, b))
        lit = (p @ l2) > 0
        code = None
        if d <= R:
            if d > R - 1.0:
                code = "G1" if lit else "G3"
            elif d < 0.9:
                code = "A5"
            elif abs(a) < 0.55 or abs(b) < 0.55:
                code = "G1"
            else:
                code = "A2" if (a * b > 0) else "A3"
        elif d <= R + 1.0:
            code = "OL"
        else:
            ab = abs(b)
            nd = float(np.hypot(a, ab - (arm - nub_r)))
            if nd <= nub_r:
                code = "G1" if lit else "G2"
            elif ab <= arm - nub_r and abs(a) < 0.55:
                code = "G1" if lit else "G2"
            elif nd <= nub_r + 1.0 or (ab <= arm - nub_r and abs(a) < 1.55):
                code = "OL"
        if code is None:
            continue
        m = st.matname(x, y)
        if code == "OL" and m not in (None, "other") + WEAP:
            continue
        paint[(x, y)] = code
    for (x, y), code in paint.items():
        st.put(x, y, code, "glass" if code.startswith("A") else "gold")
    return {"rose": "proc", "px": len(paint), "cleared": cleared, "R_px": round(R, 2), "arm_px": round(arm, 2)}


def smear(st, spec):
    """round 2 (critique 7 / top fix 5: 'author a smear or trail arc on N1 contact; both attack refs sell the hit with
    one'). A crescent behind the blade tip, about a pivot (the rear fist's grip by default: the cut turns about the
    rear hand): the outer radius is the tip's, the crescent `width` px thick at the blade and tapering to nothing
    over `sweep` degrees back along the path (dir +1: the trail lies at larger screen angles, y down). Tones: the
    outer 1 px A5 (A4 past half the sweep), the body A4, the inner and trailing third A3. Painted over the
    background only (the refs' smears sit behind the figure)."""
    hf = st.lm["haft"]
    t = np.array(hf["tip"], float)
    pv = spec.get("pivot", "R")
    g = st.lm.get("grips", {}).get(pv)
    p0 = np.array(g["point"] if g else st.lm["joints"][pv], float)
    Rt = float(np.linalg.norm(t - p0)) + spec.get("out", 0.0)
    th_t = math.atan2(t[1] - p0[1], t[0] - p0[0])
    sw = math.radians(spec.get("sweep", 45.0))
    Wm = spec.get("width", 8.0) * st.px / 144.0         # width given at 144, scaled to the sprite
    dr = spec.get("dir", 1)
    n = 0
    y0, y1 = int(p0[1] - Rt - 2), int(p0[1] + Rt + 2)
    x0, x1 = int(p0[0] - Rt - 2), int(p0[0] + Rt + 2)
    for y in range(max(0, y0), min(st.H, y1)):
        for x in range(max(0, x0), min(st.W, x1)):
            if st.img[y, x, 3] != 0:
                continue
            q = np.array([x + 0.5, y + 0.5]) - p0
            r = float(np.hypot(*q))
            dth = dr * (math.atan2(q[1], q[0]) - th_t)
            dth = (dth + math.pi) % (2 * math.pi) - math.pi
            if not (0.0 < dth < sw):
                continue
            f = dth / sw
            ro = Rt * (1 - spec.get("curl", 0.03) * f)
            w = Wm * (1 - f) ** spec.get("taper", 1.3)
            if w < 0.6 or not (ro - w <= r < ro):
                continue
            depth = ro - r
            if depth < 1.0:
                code = "A5" if f < 0.5 else "A4"
            elif depth > w * 0.6 or f > 0.66:
                code = "A3"
            else:
                code = "A4"
            st.put(x, y, code, "glass")
            n += 1
    return {"smear": n, "pivot": pv, "radius": round(Rt, 1), "sweep": spec.get("sweep", 45.0)}


def glints(st, spec):
    """listed glint pixels along the weapon: {"from": "tip"|"disc"|"butt", "along": px toward the butt, "across": px
    (+ = the cutting-edge side on screen), "c": code}"""
    hf = st.lm["haft"]
    b, t = np.array(hf["butt"], float), np.array(hf["tip"], float)
    u = unit(t - b)
    n = np.array([-u[1], u[0]])
    out = 0
    for gdef in spec:
        o = {"tip": t, "butt": b, "disc": np.array(hf["disc"], float), "blade": np.array(hf["blade_base"], float)}[gdef.get("from", "tip")]
        p = o - u * gdef.get("along", 0) + n * gdef.get("across", 0)
        x, y = int(math.floor(p[0])), int(math.floor(p[1]))
        m = st.matname(x, y)
        if m in gdef.get("on", ["steel", "edge", "gold", "steeldark", "haft"]):
            st.put(x, y, gdef["c"])
            out += 1
    return out


STEEL = ("T2", "T3", "T4", "A5")
BLADE_STYLES = {
    # round 2 (critique 7a: 'pale lavender-white with a thin gold fuller, so it reads as porcelain, not steel; the
    # refs have a hard specular line against a dark body'). q = 0 at the spine, 1 at the cutting edge.
    # bands: (q upper bound, code) from the spine; the outermost steel px on the edge side becomes `edge`
    "dark": {"bands": [(0.55, "T4"), (1.01, "T3")], "edge": "A5", "edge2": None},
    "mid": {"bands": [(0.30, "T4"), (0.72, "T3"), (1.01, "T2")], "edge": "A5", "edge2": None},
    "dark2": {"bands": [(0.55, "T4"), (1.01, "T3")], "edge": "A5", "edge2": "T2"},
}


def blade_pass(st, spec):
    """steel value structure on the rendered blade (weapon pixels, DESIGN 7: 'Steel T2-T4, cutting edge A5'): the
    blade's steel-toned pixels (materials steel / edge / steeldark, codes T2-T4 / A5; the OL outline, the gold
    fuller and the glass cells are left alone) are re-toned by their place across the blade, measured from the haft
    line (the spine side) to the widest steel pixel in the same slice along the haft (the edge side); the steel
    pixels touching the outline or the ground on the edge side become the cutting edge; one glint cluster near the
    tip (the brightest pixels on the weapon: an edge run of `glint_len` A5 with a T2 halo inside it)."""
    style = BLADE_STYLES[spec.get("style", "dark")]
    hf = st.lm["haft"]
    b, t = np.array(hf["butt"], float), np.array(hf["tip"], float)
    u = unit(t - b)
    n = np.array([-u[1], u[0]])
    L = float(np.linalg.norm(t - b))
    a0 = float((np.array(hf["blade_base"], float) - b) @ u) - 1.0
    pix = []
    for y in range(st.H):
        for x in range(st.W):
            m = st.matname(x, y)
            if m not in ("steel", "edge", "steeldark"):
                continue
            p = np.array([x + 0.5, y + 0.5]) - b
            a, c = p @ u, p @ n
            if a < a0:
                continue
            pix.append((x, y, a, c, st.code(x, y)))
    if not pix:
        return {"blade": 0}
    sgn = 1.0 if np.mean([c for *_, c, _ in pix]) >= 0 else -1.0
    steel = {(x, y) for x, y, a, c, code in pix if code in STEEL}
    slices = {}
    for x, y, a, c, code in pix:
        k = int(round(a))
        slices[k] = max(slices.get(k, 0.0), c * sgn)
    changed = 0
    edge_px = []
    for x, y, a, c, code in pix:
        if (x, y) not in steel:
            continue
        k = int(round(a))
        W = max(max(slices.get(j, 0.0) for j in (k - 1, k, k + 1)), 1.0)
        q = max(0.0, c * sgn) / W
        new = style["bands"][-1][1]
        for ub, cd in style["bands"]:
            if q < ub:
                new = cd
                break
        # the cutting edge: a steel px on the edge half touching the outline / ground / a non-blade pixel
        if q > 0.45:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                qx, qy = x + dx, y + dy
                qc = st.code(qx, qy)
                qm = st.matname(qx, qy)
                if qc is None or qc == "OL" or qm not in ("steel", "edge", "steeldark", "gold", "glass2"):
                    qv = np.array([qx + 0.5, qy + 0.5]) - b
                    if (qv @ n) * sgn > c * sgn - 0.2:
                        new = style["edge"]
                        edge_px.append((x, y, a))
                        break
        if new != code:
            st.put(x, y, new)
            changed += 1
    if style.get("edge2"):
        for x, y, a in edge_px:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                qx, qy = x + dx, y + dy
                if (qx, qy) in steel and st.code(qx, qy) not in ("A5",):
                    p = np.array([qx + 0.5, qy + 0.5]) - b
                    if (p @ n) * sgn < (np.array([x + 0.5, y + 0.5]) - b) @ n * sgn:
                        st.put(qx, qy, style["edge2"])
    # the glint: the edge px nearest glint_at (px back from the tip) and its neighbours along the edge
    glint = 0
    if spec.get("glint", True) and edge_px:
        at = L - spec.get("glint_at", 6.0 if st.px >= 128 else 3.5)
        edge_px.sort(key=lambda e: abs(e[2] - at))
        run = edge_px[:spec.get("glint_len", 3 if st.px >= 128 else 1)]
        for x, y, a in run:
            st.put(x, y, spec.get("glint_code", "A5"))
            glint += 1
            # a T2 halo one px inside the edge (toward the spine) so the glint sits on a lit patch
            if st.px >= 128:
                p = np.array([x + 0.5, y + 0.5]) - n * sgn
                hx, hy = int(math.floor(p[0])), int(math.floor(p[1]))
                if (hx, hy) in steel and st.code(hx, hy) in STEEL and st.code(hx, hy) != "A5":
                    st.put(hx, hy, "T2")
    return {"blade": changed, "edge": len(edge_px), "glint": glint, "style": spec.get("style", "dark")}


# ------------------------------------------------------------------ apply

def apply(still, specp, base="base", tag="still", guides=False):
    st = Still(still, base)
    spec = json.load(open(specp, encoding="utf-8")) if os.path.exists(specp) else {"hands": []}
    recs = []
    gd = [] if guides else None
    order = spec.get("order") or list(range(len(spec.get("hands", []))))
    for i in order:
        h = spec["hands"][i]
        if h.get("off"):
            continue
        if h.get("kind", "fist") == "fist":
            g = st.lm.get("grips", {}).get(h["side"])
            if g is None:
                print(f"WARN no grip for {h['side']}")
                continue
            recs.append(build_fist(st, i, g, h, gd))
        else:
            recs.append(build_open(st, i, h, gd))
    wrec = {}
    rs = spec.get("rose", {"on": True})
    if rs.get("on", True):
        if rs.get("proc") or (os.environ.get("ROSACE_ROSE80") == "proc" and st.px < 128):
            wrec["rose"] = rose_proc(st, rs)
        else:
            wrec["rose"] = rose(st, rs)
    if spec.get("glints"):
        wrec["glints"] = glints(st, spec["glints"])
    bl = spec.get("blade", {"style": "dark"})
    if bl.get("on", True):
        wrec["blade"] = blade_pass(st, bl)
    sm = spec.get("smear")
    if sm and sm.get("on", True) and os.environ.get("ROSACE_SMEAR", "1") != "0":
        wrec["smear"] = smear(st, sm)
    out = st.img
    Image.fromarray(out).save(os.path.join(still, tag + ".png"))
    im = Image.fromarray(out)
    for z in (3, 6):
        im.resize((im.width * z, im.height * z), Image.NEAREST).save(os.path.join(still, f"{tag}_x{z}.png"))
    lay = np.zeros_like(out)
    lay[st.touched] = out[st.touched]
    Image.fromarray(lay).save(os.path.join(still, "hands_layer.png"))
    Image.fromarray(st.mat.astype(np.uint8)).save(os.path.join(still, "hands_ids.png"))
    Image.fromarray(st.part.astype(np.uint8)).save(os.path.join(still, "hands_parts.png"))
    inv = {tuple(v): k for k, v in st.pal.items()}
    cols = {inv.get(tuple(c), "off") for c in out[out[..., 3] > 0][:, :3]}
    json.dump({"_doc": "author_hands.py: the constructed hands and weapon pixels on this still (glaive-hands lane)",
               "spec": os.path.relpath(specp, REPO), "hands": recs, "weapon": wrec, "colours": len(cols),
               "off_palette": "off" in cols}, open(os.path.join(still, "hands.json"), "w"), indent=1)
    print("HANDS", still, [(r["side"], r["kind"], r.get("view"), r["px"]) for r in recs], wrec, "colours", len(cols),
          "OFF-PALETTE" if "off" in cols else "palette ok")


# ------------------------------------------------------------------ the superseded round-4 library
# Round-2 critics: the rendered 3D hands were a 4x5 flesh blob, a polka-dot ball fist and a pink mitt. Round 4 drew
# these stamps; revision 3 (DESIGN 7) supersedes them with the constructed hands above. Kept as the record.
LIB = {}
LIB['fist_v', 144] = dict(arm='right', origin=[3, 3], rows=[
    "..OOO...", ".OLLSO..", "OLSSSSTT", "OSSTSSTT", "OLSSSTTT", ".OTMSTO.", ".OLLTO..", "..OOO..."])
LIB['fist_v', 128] = dict(arm='right', origin=[2, 2], rows=[".OOO..", "OLLSO.", "OMSSTT", "OSSTTT", "OMTTO.", ".OOO.."])
LIB['fist_v', 96] = dict(arm='right', origin=[2, 2], rows=[".OO..", "OLSO.", "OMSTT", "OSTO.", ".OO.."])
LIB['fist_h', 144] = dict(arm='left', origin=[4, 3], rows=[
    "...OOOO..", "..OLLSLO.", "TTSSTSTSO", "TTSSSSSSO", "TTSTMMSTO", "..OLLLTO.", "...OOOO.."])
LIB['fist_h', 128] = dict(arm='left', origin=[2, 3], rows=["..OOO.", ".OLLLO", "TSMSMO", "TTMTMO", "..OOO."])
LIB['fist_h', 96] = dict(arm='left', origin=[2, 2], rows=[".OOO.", "TLLLO", "TSMSO", ".OOO."])
LIB['palm_open', 144] = dict(arm='right', origin=[4, 3], rows=[
    ".O.O.O...", "OLOLOLO..", "OSOSOSOO.", "OSSSSSLTO", ".OSSSTTO.", "..OTTTTT.", "...OOO..."])
LIB['palm_open', 128] = dict(arm='right', origin=[3, 3], rows=[
    ".O.O.O..", "OLOLOLO.", "OSSSSLTO", ".OSSTTO.", "..OTTTT.", "...OO..."])
LIB['palm_open', 96] = dict(arm='right', origin=[2, 2], rows=[".O.O..", "OLOLO.", "OSSLTO", ".OTTT.", "..OO.."])


def library():
    for (name, px), s in LIB.items():
        w = max(len(r) for r in s['rows'])
        out = {'_doc': f"{name}, {px} px sprite: hand stamp for override layers (arm enters from the {s['arm']}; "
                       "'flip' in the patch mirrors it). origin = [column, row] placed on the patch 'at'. "
                       "Rows use overrides.ROWKEY codes; '.' leaves the render. Stills round 3. SUPERSEDED by the "
                       "constructed hands (author_hands.py apply, DESIGN 7 revision 3); kept as the record.",
               'name': name, 'px': px, 'arm': s['arm'], 'origin': s['origin'], 'rows': [r.ljust(w, '.') for r in s['rows']]}
        json.dump(out, open(os.path.join(D, f'{name}_{px}.json'), 'w'), indent=1)
    print(len(LIB))


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["apply", "library"])
    ap.add_argument("--still")
    ap.add_argument("--spec")
    ap.add_argument("--base", default="base")
    ap.add_argument("--tag", default="still")
    ap.add_argument("--guides", action="store_true")
    a = ap.parse_args()
    if a.cmd == "apply":
        apply(a.still, a.spec, a.base, a.tag, a.guides)
    else:
        library()
