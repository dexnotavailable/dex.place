"""Outfit lane round 3: measure the round-3 outfit rules on finished stills (the checks outfit_px3.py
applies, measured independently from the pixels, the id map and the anchors).

  CL-P15  gold budget at 80: gold share of the rendered pixels in the hip-to-thigh box (from the hip
          band's medallion row down to the lowest thigh-band row; sleeves, glaive and the outline
          ring left out), 80 px stills only
  CL-P11  stocking against boot: median relative luminance stocking / boot >= 1.3; the boot holds
          1-10 I0 gloss px; at 144 each visible stocking has one I1 sheen run >= 6 px (8-connected)
  CL-P19  chest window: in the window's box under the collar cross, >= 4 S4 px in one column run
          (the cleavage line) at 144 (>= 1 at 80), >= 2 S1 px at 144, and the box >= 5 px wide at
          144 (>= 3 at 80): never a sliver
  CL-P17  cloth runs: share of horizontal one-tone runs on the bodice's and tabard's white longer
          than 6 px (the critique's cap), 144 only

  python tools/pixel-pipeline/outfit_check3.py <render dir> [<render dir> ...] --tag still_o3 [--json out]
"""
import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outfit_px2 import N8, Still, cross_guard  # noqa: E402

STILLS = ["idle_hero", "n1_contact", "q_stamp", "n2_pivot_black"]
PASS = {"CL-P15": 0.14, "CL-P11": 1.3, "CL-P17": 0.10}


def lum(S, code):
    return S.lum.get(code, 0.0)


def gold80(S):
    if S.meta["px"] >= 100:
        return None
    a = S.anchor("outfit_rose_f") or S.anchor("outfit_rose_b")
    tb = np.isin(S.part, S.pid("gold_thigh")) & S.alpha
    if a is None or not tb.any():
        return None
    y0, y1 = int(a["y"]) - 1, int(np.nonzero(tb)[0].max())
    box = np.zeros_like(S.alpha)
    box[y0:y1 + 1] = True
    # the sleeve hems are in the allowed list and the glaive is not outfit; the outline ring
    # (material 0: the post's lines and sel-outs) is not a part of any piece
    fig = box & S.alpha & (S.mat > 0) & ~np.isin(S.part, S.pid("glaive", "glaive_glass", "stole", "sleeves"))
    gold = fig & np.vectorize(lambda c: bool(c) and c.startswith("G"))(S.code)
    return round(float(gold.sum()) / max(1, fig.sum()), 3)


def legs(S):
    st = (S.part == S.P.get("stockings", -1)) & (S.mat == S.M["stocking"]) & S.alpha & ~S.ring
    bt = (S.part == S.P.get("boots", -1)) & (S.mat == S.M["boot"]) & S.alpha & ~S.ring
    if st.sum() < 10 or bt.sum() < 10:
        return None
    ls = np.median([lum(S, c) for c in S.code[st] if c])
    lb = np.median([lum(S, c) for c in S.code[bt] if c])
    ratio = (ls + 0.05) / (lb + 0.05)
    i0 = int(sum(1 for c in S.code[bt] if c == "I0"))
    runs = []
    if S.meta["px"] >= 100:
        sh = st & (S.code == "I1")
        seen = np.zeros_like(sh)
        for y0, x0 in zip(*np.nonzero(sh)):
            if seen[y0, x0]:
                continue
            n, stk = 0, [(y0, x0)]
            seen[y0, x0] = True
            while stk:
                y, x = stk.pop()
                n += 1
                for dy, dx in N8:
                    yy, xx = y + dy, x + dx
                    if S.ok(yy, xx) and sh[yy, xx] and not seen[yy, xx]:
                        seen[yy, xx] = True
                        stk.append((yy, xx))
            runs.append(n)
    return {"lum_ratio": round(float(ratio), 2), "boot_I0": i0, "sheen_runs": sorted(runs, reverse=True)[:3]}


def window(S):
    t = S.anchor("outfit_win_t")
    if not t or t["facing"] < 0.25:
        return None
    _, cross = cross_guard(S)
    top = cross[1] + 1 if cross else int(t["y"])
    cx = int(t["x"])
    px = S.meta["px"]
    h = 13 if px >= 144 else 5
    ys, xs = [], []
    col = {}
    s1 = 0
    for y in range(top, top + h):
        for x in range(cx - 8, cx + 9):
            if not S.ok(y, x) or S.part[y, x] not in S.pid("bodice", "body"):
                continue
            c = S.new[y, x]
            if c == "G2" and S.mat[y, x] == S.M["skin"] or c in ("S4", "S1", "S2", "S3") and S.part[y, x] == S.P.get("bodice", -1):
                pass
            if c in ("S1", "S2", "S3", "S4") or (c == "G2" and S.mat[y, x] != S.M["gold"]):
                ys.append(y)
                xs.append(x)
                if c == "S4":
                    col.setdefault(x, []).append(y)
                if c == "S1":
                    s1 += 1
    if not xs:
        return {"width": 0, "cleave_run": 0, "S1": 0}
    best = 0
    for x, yy in col.items():
        yy = sorted(yy)
        r = 1
        for a, b in zip(yy, yy[1:]):
            r = r + 1 if b == a + 1 else 1
            best = max(best, r)
        best = max(best, 1)
    return {"width": int(max(xs) - min(xs) + 1), "cleave_run": best, "S1": s1}


def runs6(S):
    if S.meta["px"] < 100:
        return None
    wm = np.isin(S.part, S.pid("bodice", "tabard")) & (S.mat == S.M["white"]) & S.alpha & ~S.ring
    tot = long = 0
    for y in range(S.H):
        x = 0
        while x < S.W:
            if not wm[y, x]:
                x += 1
                continue
            c, n = S.new[y, x], 0
            while x < S.W and wm[y, x] and S.new[y, x] == c:
                n += 1
                x += 1
            tot += 1
            long += n > 6
    return round(long / max(1, tot), 3)


def check(d, tag):
    S = Still(d, tag)
    out = {}
    g = gold80(S)
    if g is not None:
        out["CL-P15"] = {"gold_share": g, "status": "PASS" if g <= PASS["CL-P15"] else "FAIL"}
    lg = legs(S)
    if lg:
        ok = lg["lum_ratio"] >= PASS["CL-P11"] and 1 <= lg["boot_I0"] <= 10
        if S.meta["px"] >= 100:
            ok = ok and bool(lg["sheen_runs"]) and lg["sheen_runs"][0] >= 6
        out["CL-P11"] = dict(lg, status="PASS" if ok else "FAIL")
    w = window(S)
    if w:
        big = S.meta["px"] >= 100
        ok = w["cleave_run"] >= (4 if big else 1) and w["width"] >= (5 if big else 3) and (w["S1"] >= 2 or not big)
        out["CL-P19"] = dict(w, status="PASS" if ok else "FAIL")
    r = runs6(S)
    if r is not None:
        out["CL-P17"] = {"share_over_6": r, "status": "PASS" if r <= PASS["CL-P17"] else "FAIL"}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dirs", nargs="+")
    ap.add_argument("--tag", default="still_o3")
    ap.add_argument("--json", default=None)
    a = ap.parse_args()
    res = {}
    for root in a.dirs:
        tag = a.tag
        if "=" in root:
            root, tag = root.split("=")
        res[root] = {}
        for s in STILLS:
            for px in (144, 80):
                d = os.path.join(root, s, f"px{px}")
                if os.path.exists(os.path.join(d, tag + ".png")):
                    res[root][f"{s}_{px}"] = check(d, tag)
    for root, r in res.items():
        print(os.path.basename(root))
        for k, v in r.items():
            print(" ", k, {rid: x for rid, x in v.items()})
    if a.json:
        json.dump(res, open(a.json, "w"), indent=1)


if __name__ == "__main__":
    main()
