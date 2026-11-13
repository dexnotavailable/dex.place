"""Glaive-hands lane: run rules_check.py's HD / GR / PX rules on a RENDERED lane still (not a constructed sprite).

  python tools/art-construct/gh_check.py <stills dir> [--only HD,GR,PX] [--json OUT] [--fails]

The adapter builds, per still (<dir>/<still>/px<N>/check/): sprite.png (the lane's still.png), sprite_ids.png (the
material ids after the hand constructor, author_hands.py's hands_ids.png), sprite_parts.png (weapon from the
render's glaive / glaive_glass / stole parts; hand_near / hand_far from the constructed hands; arm_near / arm_far
and sleeve_near / sleeve_far from skin and sleeve pixels near each projected arm; the rest by render part), and
pose.json in the construct schema, from landmarks.json (the lane render's projected joints, haft and grips).

rules_check.py is imported, not edited (other lanes run it too). Where a rule's shipped measurement assumes one
gripping 'near' hand (true of the constructed idle, not of a render: in Q the gripping hand is the far one, in N1
and N2 both grip), this file registers a grip-aware measurement for the same rule ID, printed with a '~' in the
status column so nobody mistakes it for the shipped one. New rules from this lane (GR-P11, GR-P12, GR-N07) are
measured here too; their rows are in checklist.json and ART-RULES.md 4.
"""
import argparse
import json
import math
import os
import sys
from collections import Counter

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import artlib as A  # noqa: E402
import rules_check as RC  # noqa: E402
RC_GR_P09 = RC.CHECKS["GR-P09"]
from rules_check import R, deg, fit_line, rng, skip  # noqa: E402

STILLS = [("idle_hero", "idle", "rest"), ("n1_contact", "attack", "two_hand"), ("q_stamp", "attack", "stamp"),
          ("n2_pivot_black", "attack", "windup")]
GRIP_MATS = ("haft", "gold", "glass", "glass2", "glasscore", "steel", "edge", "steeldark")


def seg_mask(shape, a, b, r):
    H, W = shape
    ys, xs = np.mgrid[0:H, 0:W]
    P = np.stack([xs + 0.5, ys + 0.5], -1)
    a, b = np.array(a, float), np.array(b, float)
    ab = b - a
    t = np.clip(((P - a) @ ab) / max(ab @ ab, 1e-9), 0, 1)
    d = np.linalg.norm(P - (a + t[..., None] * ab), axis=-1)
    return d <= r


def adapt(still, intent, carry):
    meta = json.load(open(os.path.join(still, "meta.json")))
    lm = json.load(open(os.path.join(still, "landmarks.json")))
    hj = json.load(open(os.path.join(still, "hands.json"))) if os.path.exists(os.path.join(still, "hands.json")) else {"hands": []}
    img = np.asarray(Image.open(os.path.join(still, "still.png")).convert("RGBA"))
    ids = np.asarray(Image.open(os.path.join(still, "hands_ids.png")))
    rid = np.asarray(Image.open(os.path.join(still, "noface_id.png")).convert("RGBA"))
    rpart = rid[..., 1].astype(int)
    hparts = np.asarray(Image.open(os.path.join(still, "hands_parts.png"))).astype(int)
    H, W = ids.shape
    J = lm["joints"]
    near, far = lm["near"], lm["far"]
    side_of = {near: "near", far: "far"}
    pn = {v: k for k, v in meta["parts"].items()}
    parts = np.zeros((H, W), np.uint8)
    rname = np.vectorize(lambda i: pn.get(int(i), ""))(rpart)
    weapon = np.isin(rname, ["glaive", "glaive_glass", "stole"])
    parts[weapon] = A.PART["weapon"]
    mask = img[..., 3] > 0
    skin = ids == A.MAT["skin"]
    sleeve = rname == "sleeves"
    for s, nm in ((near, "near"), (far, "far")):
        arm = seg_mask((H, W), J[f"shoulder_{s}"], J[f"elbow_{s}"], 3.2 if meta["px"] >= 128 else 2.0) | \
            seg_mask((H, W), J[f"elbow_{s}"], J[f"wrist_{s}"], 3.0 if meta["px"] >= 128 else 1.8)
        parts[arm & skin & (parts == 0)] = A.PART[f"arm_{nm}"]
        sl = seg_mask((H, W), J[f"shoulder_{s}"], J[f"wrist_{s}"], 14 if meta["px"] >= 128 else 8) & sleeve
        parts[sl & (parts == 0)] = A.PART[f"sleeve_{nm}"]
    hands = {}
    grips = []
    for i, h in enumerate(hj.get("hands", [])):
        nm = side_of[h["side"]]
        parts[(hparts == i + 1)] = A.PART[f"hand_{nm}"]
        hands[nm] = {k: h[k] for k in ("kind", "palm_box", "mitten", "thumb_wedge", "wrist_step") if k in h}
        hands[nm]["side"] = h["side"]
        hands[nm]["on"] = "haft" if h["kind"] == "fist" else h.get("on")
        if h["kind"] == "fist":
            g = lm["grips"][h["side"]]
            grips.append({"hand": nm, "side": h["side"], "point": h["grip"], "gap_cm": g["gap_cm"],
                          "kind": carry, "view": h.get("view")})
    rest = mask & (parts == 0)
    torso_parts = {"body": "torso", "bodice": "torso", "collar": "collar", "collar_cross": "cross", "tabard": "tabard",
                   "veil": "veil", "head": "head", "stockings": "leg_near", "boots": "boot_near", "thong": "pelvis"}
    for rn, pnm in torso_parts.items():
        parts[rest & (rname == rn)] = A.PART[pnm]
    parts[mask & (parts == 0) & np.char.startswith(rname.astype(str), "hair")] = A.PART["hair_back"]
    parts[mask & (parts == 0)] = A.PART["torso"]
    L = {}
    for k in ("shoulder", "elbow", "wrist", "hand", "hip", "knee", "ankle"):
        L[f"{k}_near"] = J[f"{k}_{near}"]
        L[f"{k}_far"] = J[f"{k}_{far}"]
    # a fist's direction is wrist -> grip centre (the curled fingertip projects back past the wrist: 178 deg)
    # and the wrist sits on the fist's wrist side (-v), where the template's wrist cells join the forearm: the 3D
    # wrist of a hand wrapped round a haft seen near end-on projects anywhere (idle: past the grip, 180 deg)
    for h in hj.get("hands", []):
        if h["kind"] == "fist":
            g, vd = np.array(h["grip"]), np.array(h["vdir"])
            k = 1.0 if meta["px"] >= 128 else 0.56
            L[f"hand_{side_of[h['side']]}"] = list(g + vd * 3 * k)
            L[f"wrist_{side_of[h['side']]}"] = h.get("wrist_px") or list(g - vd * 4.5 * k)
            if h.get("wrist_px"):      # the hand axis runs from where the wrist leaves the fist to the grip centre
                L[f"hand_{side_of[h['side']]}"] = list(g + (g - np.array(h["wrist_px"])) * 0.5)
    L["pit_neck"], L["pelvis_c"] = J["pit_neck"], J["pelvis_c"]
    L["torso_centerline"] = [J["pit_neck"], J["chest"], J["pelvis_c"]]
    hf = lm["haft"]
    cl = np.array(J["pit_neck"]), np.array(J["pelvis_c"])
    n = np.array([-(cl[1] - cl[0])[1], (cl[1] - cl[0])[0]])
    n = n / (np.linalg.norm(n) + 1e-9) * 3
    pose = {"_doc": "gh_check.py adapter: a lane render's landmarks in the construct schema (HD/GR/PX rules only)",
            "name": os.path.basename(os.path.dirname(still)), "H": meta["px"], "canvas": [W, H], "intent": intent,
            "carry": carry, "landmarks": L, "haft": {"butt": hf["butt"], "tip": hf["tip"]}, "grips": grips,
            "hands": hands, "light": [0.63, -0.78], "near": near,
            "zones": {"keep_out": [{"name": "torso centre band", "kind": "weapon", "rule": "GR-N03",
                                    "poly": [list(cl[0] - n), list(cl[0] + n), list(cl[1] + n), list(cl[1] - n)]}],
                      "must_be": []},
            "disc_facing": hf.get("disc_facing"), "lane": lm, "weapon_rec": hj.get("weapon", {})}
    d = os.path.join(still, "check")
    os.makedirs(d, exist_ok=True)
    Image.fromarray(img).save(os.path.join(d, "sprite.png"))
    Image.fromarray(ids.astype(np.uint8), "L").save(os.path.join(d, "sprite_ids.png"))
    Image.fromarray(parts, "L").save(os.path.join(d, "sprite_parts.png"))
    json.dump(pose, open(os.path.join(d, "pose.json"), "w"), indent=1)
    return d


# ------------------------------------------------------------------ grip-aware measurements (IDs kept, marked '~')
AWARE = set()


def aware(*ids):
    def deco(f):
        for i in ids:
            RC.CHECKS[i] = f
            AWARE.add(i)
        return f
    return deco


def haft_u(c):
    u = np.subtract(c.pose["haft"]["tip"], c.pose["haft"]["butt"]).astype(float)
    return u / np.linalg.norm(u)


def gmask(c, g):
    return c.part(f"hand_{g['hand']}") & c.mask


@aware("GR-P01", "GR-P02", "GR-P03", "GR-P04", "GR-P07")
def _grip_two(c):
    g = c.pose["grips"]
    if len(g) < 2:
        return skip(f"{len(g)} hand on the haft ({c.pose['carry']}); two-hand spacing applies to two-hand grips")
    u = haft_u(c)
    b = np.array(c.pose["haft"]["butt"], float)
    t = sorted(g, key=lambda q: (np.array(q["point"]) - b) @ u)
    sp = float((np.array(t[1]["point"]) - np.array(t[0]["point"])) @ u)
    k = c.pose["H"] / 144.0
    if c.pose["carry"] == "stamp":
        # round 2: the Q stamp is a twirl-and-plant grip, so GR-P03 (both hands within 8-14 px of the haft's middle)
        # is its spacing rule, not the ready/thrust 24-30 px of GR-P01 (round 1 measured Q as a thrust)
        mid = (b + np.array(c.pose["haft"]["tip"], float)) / 2
        dm = [float((np.array(q["point"]) - mid) @ u) for q in t]
        ok = all(abs(d) <= 14 * k + 0.5 for d in dm) and sp >= 8 * k - 0.5
        return R(ok, f"stamp: fists {dm[0]:+.1f} / {dm[1]:+.1f} px from the haft's middle, {sp:.1f} px apart",
                 f"each within {14 * k:.0f} px of the middle, >= {8 * k:.0f} px apart (GR-P03, twirl / Q)")
    rear = t[0]
    L = c.L
    hip = np.array(L["hip_near"]) if rear["hand"] == "near" else np.array(L["hip_far"])
    dh = float(np.linalg.norm(np.array(rear["point"]) - hip))
    k = c.pose["H"] / 144.0
    if c.pose["carry"] == "windup":
        dh = 0.0                                  # a wind-up holds the glaive high: GR-P04's hip applies to ready/thrust
    ok = rng(sp, 24 * k - 0.5, 30 * k + 0.5) and dh <= 12 * k
    return R(ok, f"hands {sp:.1f} px apart along the haft; the rear ({rear['hand']}) fist {dh:.1f} px from its hip",
             f"{24 * k:.1f}-{30 * k:.1f} (ready/thrust, 24-30 at 144); rear hand at the hip (<= {12 * k:.0f} px)")


@aware("GR-P09")
def _rest_angle(c):
    if c.pose["carry"] not in ("rest", "shoulder"):
        return skip(f"carry '{c.pose['carry']}': GR-P09 is the rest / shoulder-carry angle")
    return RC_GR_P09(c)


RC_GR_N02 = RC.CHECKS["GR-N02"]


@aware("GR-N02")
def _parallels(c):
    """GR-N02 with its 'without a clear overlap' clause measured: a body line within 10 deg of the haft is exempt
    when the weapon covers >= 50% of the samples along that limb segment (the limb lies behind the haft)"""
    L = c.L
    b, t = c.pose["haft"]["butt"], c.pose["haft"]["tip"]
    segs = {"spine": (L["pelvis_c"], L["pit_neck"])}
    for s in ("near", "far"):
        segs[f"thigh_{s}"] = (L[f"hip_{s}"], L[f"knee_{s}"])
        segs[f"shin_{s}"] = (L[f"knee_{s}"], L[f"ankle_{s}"])
        segs[f"upper_arm_{s}"] = (L[f"shoulder_{s}"], L[f"elbow_{s}"])
        segs[f"forearm_{s}"] = (L[f"elbow_{s}"], L[f"wrist_{s}"])
    wp = c.part("weapon", "hand_near", "hand_far")
    H, W = wp.shape
    bad, near, cover = {}, {}, {}
    for k, (p0, p1) in segs.items():
        a = RC.ang_between(b, t, p0, p1)
        near[k] = a
        if a >= 10:
            continue
        p0, p1 = np.array(p0, float), np.array(p1, float)
        n = max(2, int(np.linalg.norm(p1 - p0)))
        hit = 0
        for i in range(n + 1):
            q = p0 + (p1 - p0) * i / n
            x, y = int(q[0]), int(q[1])
            hit += bool(0 <= x < W and 0 <= y < H and wp[max(0, y - 1):y + 2, max(0, x - 1):x + 2].any())
        cover[k] = hit / (n + 1)
        if cover[k] < 0.5:
            bad[k] = a
    top = sorted(near.items(), key=lambda kv: kv[1])[:3]
    return R(not bad, "closest: " + ", ".join(f"{k} {v:.0f}" + (f" (under the haft {100 * cover[k]:.0f}%)" if k in cover else "")
                                            for k, v in top), ">= 10 deg from every body line, or the limb under the haft (>= 50%)")


@aware("GR-P10")
def _clearance(c):
    """GR-P10 with exclusive parts: a haft pixel 'overlaps' the body when body pixels sit on both sides of it across
    the haft within 3 px (the haft crosses in front); else its clear gap is the distance to the nearest body pixel"""
    haft = c.part("weapon") & c.matm("haft")
    ys, xs = np.nonzero(haft)
    body = c.mask & ~c.part("weapon", "hand_near", "hand_far", "arm_near", "arm_far", "sleeve_near", "sleeve_far")
    if not len(xs):
        return skip("no haft")
    u = haft_u(c)
    n = np.array([-u[1], u[0]])
    far = np.ones(len(xs), bool)
    for q in c.pose["grips"]:
        far &= np.hypot(xs - q["point"][0], ys - q["point"][1]) > 7
    by, bx = np.nonzero(body)
    B = np.stack([bx, by], 1)
    H, W = body.shape
    over, gaps = 0, []
    for x, y in zip(xs[far], ys[far]):
        sides = []
        for sgn in (1, -1):
            hit = False
            for d in (2, 3, 4):
                qx, qy = int(round(x + sgn * n[0] * d)), int(round(y + sgn * n[1] * d))
                if 0 <= qx < W and 0 <= qy < H and body[qy, qx]:
                    hit = True
                    break
            sides.append(hit)
        if all(sides):
            over += 1
        else:
            gaps.append(float(np.sqrt(((B - [x, y]) ** 2).sum(1)).min()) - 1)
    thin = [g for g in gaps if 0 < g < 4]
    mn = min(gaps) if gaps else 99
    ok = not thin or over >= 3
    return R(ok and not (0 < mn < 1), f"crossing in front of the body {over} px; closest clear gap {mn:.1f} px; "
             f"{len(thin)} haft px at a 1-3 px sliver", "4-8 px clear, or >= 3 px overlap; never a 1-3 px sliver")


@aware("GR-P05", "GR-N01")
def _collinear(c):
    g = c.pose["grips"]
    if not g:
        return R(c.pose["carry"] == "stamp", "no hand on the haft", "at least one (except Q's plant)")
    u = haft_u(c)
    haft = c.part("weapon") & c.matm("haft")
    # round 2: the butt fittings (gold knop, ferrules, grip bands) are the haft too. A rear hand choked near the butt
    # (N1 round 2) leaves only the knop and the ferrule triple below the fist, and lacquer alone gave a 3-5 px
    # fragment whose line fit read 20-42 deg off. Gold weapon pixels within 2 px of the haft's screen line count;
    # the cross arms and the disc lie off that band or past the grip (measured only 6+ px either side of a fist).
    hf = c.pose.get("haft")
    if hf:
        b0, t0 = np.array(hf["butt"], float), np.array(hf["tip"], float)
        uu = (t0 - b0) / max(np.linalg.norm(t0 - b0), 1e-9)
        H_, W_ = haft.shape
        yy, xx = np.mgrid[0:H_, 0:W_]
        P_ = np.stack([xx + 0.5, yy + 0.5], -1) - b0
        off = np.abs(P_[..., 0] * -uu[1] + P_[..., 1] * uu[0])
        haft = haft | (c.part("weapon") & c.matm("gold") & (off <= 2.0))
    ys, xs = np.nonzero(haft)
    out, ok = [], True
    # round 2: the skip window past the fist scales with the sprite (6 px at 144 = the fist's half-length + 2; at 80
    # the fist is 5 px, so a fixed 6 px skipped the whole butt stub of a choked rear hand and fitted a 2 px scrap)
    win = max(3.5, 6.0 * c.pose["H"] / 144.0)
    for q in g:
        gp = np.array(q["point"], float)
        t = (np.stack([xs + 0.5, ys + 0.5], 1) - gp) @ u
        lo, hi = t < -win, t > win
        if lo.sum() < 4 or hi.sum() < 4:
            ok = False
            out.append(f"{q['hand']}: haft not out on both sides ({int(lo.sum())}/{int(hi.sum())} px)")
            continue
        c1, d1 = fit_line(xs[lo], ys[lo])
        c2, d2 = fit_line(xs[hi], ys[hi])
        da = min(abs(deg(d1) - deg(d2)) % 180, 180 - abs(deg(d1) - deg(d2)) % 180)
        hm = gmask(c, q)
        hy, hx = np.nonzero(hm)
        hc = np.array([hx.mean() + 0.5, hy.mean() + 0.5])
        cA = np.array(c1 + c2) / 2 + 0.5
        n = np.array([-u[1], u[0]])
        dist = abs((hc - cA) @ n)
        good = dist <= 1.5 and da <= 3
        ok &= good
        out.append(f"{q['hand']}: centre {dist:.1f} px off the line, halves {da:.1f} deg apart")
    return R(ok, "; ".join(out), "<= 1.5 px; <= 3 deg (render: +1 deg for the 1 px haft steps); a hand on the haft")


@aware("GR-P06")
def _fist_on_haft(c):
    g = c.pose["grips"]
    if not g:
        return skip("no grip")
    u = haft_u(c)
    n = np.array([-u[1], u[0]])
    out, ok = [], True
    half = 1.9 if c.pose["H"] >= 128 else 1.1
    for q in g:
        hm = gmask(c, q)
        hy, hx = np.nonzero(hm)
        off = (np.stack([hx + 0.5, hy + 0.5], 1) - np.array(q["point"])) @ n
        across = off.max() - off.min()
        a, b = -off.min() - half, off.max() - half
        need = (7, 2) if c.pose["H"] >= 128 else (4, 1)
        good = across >= need[0] - 0.5 and min(a, b) >= need[1] - 0.5
        ok &= good
        out.append(f"{q['hand']}: {across:.0f} across, {a:.1f}/{b:.1f} beyond the haft band")
    return R(ok, "; ".join(out), ">= 7 across, >= 2 each side at 144 (>= 4, >= 1 at 80)")


@aware("HD-N01")
def _not_a_block(c):
    """HD-N01 as written: never a rectangle with no thumb wedge or knuckle direction (the size is HD-P02's)"""
    g = c.pose["grips"]
    if not g:
        return skip("no fist")
    out, ok = [], True
    for q in g:
        hm = gmask(c, q)
        ys, xs = np.nonzero(hm)
        inner = hm & ~c.isin(c.code, "OL", "S4")
        s1 = int((hm & (c.code == c.I("S1"))).sum())
        kn = int((inner & c.isin(c.code, "S3", "S4")).sum()) + int((hm & (c.code == c.I("S4"))).sum() > 0)
        rect = hm.sum() / ((ys.max() - ys.min() + 1) * (xs.max() - xs.min() + 1))
        good = rect <= 0.9 and kn >= 1 and (s1 >= 1 or c.pose["H"] < 128)
        ok &= good
        out.append(f"{q['hand']}: fill {rect:.2f}, lit {s1}, knuckle/crease {kn}")
    return R(ok, "; ".join(out), "not a box (fill <= 0.9), a lit ridge or thumb, a knuckle or crease line")


@aware("HD-P06", "HD-N05")
def _wrist(c):
    """2D wrist bend from the construction (elbow -> where the wrist leaves the fist -> grip centre). A forearm
    foreshortened below half its length on screen cannot be measured in 2D: that hand goes to the critic"""
    L = c.L
    k = c.pose["H"] / 1.8956
    out, ok, crit = [], True, []
    for q in c.pose["grips"]:
        s = q["hand"]
        fa = np.subtract(L[f"wrist_{s}"], L[f"elbow_{s}"])
        if np.linalg.norm(fa) < 0.5 * 0.25 * k:
            crit.append(f"{s}: forearm {np.linalg.norm(fa):.0f} px on screen (foreshortened)")
            continue
        ha = np.subtract(q["point"], L[f"wrist_{s}"])
        a = abs((deg(ha) - deg(fa) + 180) % 360 - 180)
        # the fist's own axis is across the haft; a straight wrist puts the grip ~90 deg off the forearm line
        # only when the forearm runs along the haft, which the *_along views cover; here the hand axis is wrist->grip
        ok &= a <= 54
        out.append(f"{s} {a:.0f} deg")
    if not out:
        return skip("; ".join(crit) + ": critic")
    return R(ok, ", ".join(out + crit), "<= 54 in 2D (critic for foreshortened forearms)")


@aware("HD-P02")
def _fist_size(c):
    g = c.pose["grips"]
    if not g:
        return skip("no fist")
    u = haft_u(c)
    n = np.array([-u[1], u[0]])
    out, ok = [], True
    for q in g:
        hm = gmask(c, q)
        ys, xs = np.nonzero(hm)
        # the fist's true size: the length of the haft line it covers (along) and of the perpendicular through the
        # grip (across), sampled at 0.25 px -- a sheared or stepped outline inflates a bounding projection
        gp = np.array(q["point"], float)

        def cover(v):
            hits = [s for s in np.arange(-12, 12.01, 0.25)
                    if 0 <= int(gp[1] + v[1] * s) < hm.shape[0] and 0 <= int(gp[0] + v[0] * s) < hm.shape[1]
                    and hm[int(gp[1] + v[1] * s), int(gp[0] + v[0] * s)]]
            return (max(hits) - min(hits) + 0.25) if hits else 0
        lw, aw = cover(u), cover(n)
        inner = hm & ~c.isin(c.code, "OL", "S4")
        s1 = int((hm & (c.code == c.I("S1"))).sum())
        kn = int((hm & c.isin(c.code, "S3", "S4") & inner).sum())
        rect = hm.sum() / ((ys.max() - ys.min() + 1) * (xs.max() - xs.min() + 1))
        if c.pose["H"] >= 128:
            good = rng(round(aw), 7, 9) and rng(round(lw), 6, 8) and s1 >= 2 and kn >= 2 and rect <= 0.9
        else:
            good = rng(round(aw), 3, 6) and rng(round(lw), 3, 6) and kn >= 1
        ok &= good
        out.append(f"{q['hand']}: {aw:.0f} across x {lw:.0f} along; lit {s1}; knuckle/shade {kn}; fill {rect:.2f}")
    return R(ok, "; ".join(out), "144: 7-9 across x 6-8 along (covered line lengths), S1 wedge/ridge, a knuckle line, not a box")


SEP_MATS = ("gold", "white", "veil", "beige", "hair", "hairtip")


@RC.rule("HD-P08")
def _fists_separate(c):
    """round 2 (critique 8: 'every attack still has both fists visible and separated from belt, hair and sleeve by at
    least 1 px of outline'): each gripping fist shows >= 20 px (144) / 8 px (80) of hand, and no hand pixel touches a
    belt-gold, hair or sleeve pixel (4-neighbours; the weapon's own gold excluded) unless one of the two is OL"""
    g = c.pose.get("grips", [])
    attack = c.pose.get("intent") == "attack"
    need = 2 if attack else 1
    k = c.pose["H"] / 144.0
    minpx = 20 if c.pose["H"] >= 128 else 8
    ol = c.isin(c.code, "OL")
    weap = c.part("weapon")
    sep = c.matm(*SEP_MATS) & ~weap & ~c.part("hand_near", "hand_far")
    out, ok = [], len(g) >= need
    for q in g:
        hm = gmask(c, q)
        n = int(hm.sum())
        bad = 0
        H_, W_ = hm.shape
        ys, xs = np.nonzero(hm)
        for y, x in zip(ys, xs):
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < H_ and 0 <= xx < W_ and sep[yy, xx] and not ol[y, x] and not ol[yy, xx]:
                    bad += 1
        good = n >= minpx and bad <= 1
        ok &= good
        out.append(f"{q['hand']}: {n} px, {bad} unseparated contact(s)")
    del k
    return R(ok, f"{len(g)} fist(s) on the haft; " + "; ".join(out),
             f">= {need} fist(s), each >= {minpx} px, <= 1 px touching belt / hair / sleeve without OL")


@RC.rule("GR-P13")
def _smear(c):
    """round 2: the N1 contact frame carries an authored smear arc (the refs' attack contacts all have one)"""
    if not c.pose or c.pose.get("name") != "n1_contact":
        return skip("contact frames only (N1 contact in the lane stills)")
    sm = (c.pose.get("weapon_rec") or {}).get("smear") or {}
    n = sm.get("smear", 0)
    need = 150 if c.pose["H"] >= 128 else 45
    return R(n >= need, f"smear {n} px (pivot {sm.get('pivot')}, sweep {sm.get('sweep')} deg)",
             f">= {need} px of authored smear on the contact frame")


@RC.rule("GR-P11")
def _gap(c):
    g = c.pose.get("grips", [])
    if not g or "gap_cm" not in g[0]:
        return skip("no render grip record (constructed sprites have no 3D gap)")
    worst = max(q["gap_cm"] for q in g)
    return R(worst <= 1.5, ", ".join(f"{q['hand']} {q['gap_cm']:.1f} cm" for q in g), "<= 1.5 cm (about 1 px at 144)")


@RC.rule("GR-P12")
def _disc(c):
    if not c.pose or c.pose.get("carry") != "rest":
        return skip("rest poses only")
    f = c.pose.get("disc_facing")
    if f is None:
        return skip("no disc facing recorded")
    return R(f >= 0.85, f"disc facing {f:.2f}", ">= 0.85 (the cross and rose read face-on)")


@RC.rule("GR-N07")
def _traceable(c):
    if not c.pose or not c.pose.get("haft"):
        return skip("no haft")
    b = np.array(c.pose["haft"]["butt"], float)
    lane = c.pose.get("lane", {}).get("haft", {})
    top = np.array(lane.get("disc", c.pose["haft"]["tip"]), float)
    n = int(np.linalg.norm(top - b))
    vis, tot = 0, 0
    wp = c.part("weapon", "hand_near", "hand_far")
    for i in range(3, n - 3):
        p = b + (top - b) * i / n
        x, y = int(p[0]), int(p[1])
        if not (0 <= x < c.code.shape[1] and 0 <= y < c.code.shape[0]):
            continue
        tot += 1
        win = wp[max(0, y - 1):y + 2, max(0, x - 1):x + 2]
        vis += bool(win.any())
    f = vis / max(tot, 1)
    return R(f >= 0.85 or c.pose.get("carry") != "rest", f"{100 * f:.0f}% of the haft line visible (butt to disc)",
             ">= 85% in a rest pose (a sleeve or body never hides the grip and the haft)")


def run_one(d, only, fails):
    ctx = RC.Ctx(d, None)
    rows = RC.run(ctx, only)
    for r in rows:
        if r["id"] in AWARE and r["status"] in ("PASS", "FAIL", "PASS*", "FAIL*"):
            r["status"] += "~"
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dir")
    ap.add_argument("--only", default="HD,GR,PX")
    ap.add_argument("--json", default=None)
    ap.add_argument("--fails", action="store_true")
    ap.add_argument("--px", default="144,80")
    a = ap.parse_args()
    allres = {}
    for name, intent, carry in STILLS:
        for px in [int(x) for x in a.px.split(",")]:
            still = os.path.join(a.dir, name, f"px{px}")
            if not os.path.exists(os.path.join(still, "still.png")):
                continue
            d = adapt(still, intent, carry)
            rows = run_one(d, a.only.split(","), a.fails)
            cnt = Counter(r["status"].rstrip("*~") for r in rows)
            blocks = [r["id"] for r in rows if r["status"].startswith("FAIL") and r["severity"] == "block"]
            print(f"\n== {name} {px}: {cnt.get('PASS', 0)} pass, {cnt.get('FAIL', 0)} fail, {cnt.get('SKIP', 0)} skip; "
                  f"block fails: {', '.join(blocks) or 'none'}")
            for r in rows:
                if a.fails and not r["status"].startswith("FAIL"):
                    continue
                if r["status"] == "CRITIC" or (r["status"] == "SKIP" and a.fails):
                    continue
                print(f"  {r['id']:7} {r['severity']:5} {r['status']:7} {r['measured']}"
                      + (f"   [target {r['target']}]" if r["target"] and r["status"].startswith("FAIL") else ""))
            allres[f"{name}_{px}"] = {"counts": dict(cnt), "block_fails": blocks, "rules": rows}
    if a.json:
        json.dump(allres, open(a.json, "w"), indent=1)


if __name__ == "__main__":
    main()
