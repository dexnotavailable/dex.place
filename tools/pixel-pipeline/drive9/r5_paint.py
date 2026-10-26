"""Drive 9 whole-character round 5: the paint-over (round 4's r4_paint.py, used as a library) with the round-5 override
files and a port to the recombined build's twin.

ESCALATION 3 rebuilt drive 9 from a second lever mix, so round 5 has two underlays in the same poses: 'x' (lanes/
drive9n.blend + r5x_model.json + r5x_finish.json, tag R5xu) and 'p' (lanes/drive9.blend + r5_model.json +
r5_finish.json, tag R5u). The override files (art/rosace/overrides/drive9_r5/<shot>_<px>.json) are authored by hand on
ONE underlay, recorded in authored_on (WF-P12: a changed underlay makes the file STALE). A layer marked "port": true
(the head: face, eyes, brows, mouth, blush, fringe, strands, pin) is also painted on the other underlay, moved by the
offset that best overlaps the two renders' head-skin masks (the id pass; the heads sit within 0-2 px of each other,
since both builds share the pose, camera and head scale). The offset and the other underlay's sha1 are recorded in
the file's 'ported_on' at --sign; a changed twin makes the port STALE the same way. Unported layers stay on the
underlay they were placed on. One new layer kind, 'matbox' {box, on: [materials], keys: [dark .. light]}: the underlay's
pixels of those materials inside the box take the keys by their own value rank (a local recolour that keeps the shading).

  python tools/pixel-pipeline/drive9/r5_paint.py --root <raw>/R5x --under R5xu --tag R5x \
      --twin-root <raw>/R5 --twin-under R5u --twin-tag R5 [--shots ...] [--px ...] [--layers ...] [--sign]
"""
import argparse
import copy
import hashlib
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import r4_paint as P4  # noqa: E402

REPO = P4.REPO
OVR5 = os.path.join(REPO, "art", "rosace", "overrides", "drive9_r5")


def sha1(p):
    return hashlib.sha1(open(p, "rb").read()).hexdigest()


def head_mask(d):
    m = json.load(open(os.path.join(d, "meta.json")))
    idm = np.asarray(Image.open(os.path.join(d, "id.png")).convert("RGBA"))
    k = int(m["ss"])
    sub = idm[k // 2::k, k // 2::k]
    return (sub[..., 1] == m["parts"]["head"]) & (sub[..., 0] == m["materials"]["skin"]["id"]) & (sub[..., 3] > 0)


def head_offset(a, b, r=5):
    """(dx, dy) moving underlay a's head onto underlay b's (the best overlap of the head-skin masks)"""
    A, B = head_mask(a), head_mask(b)
    ys, xs = np.nonzero(A)
    best = None
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            yy, xx = ys + dy, xs + dx
            ok = (yy >= 0) & (yy < B.shape[0]) & (xx >= 0) & (xx < B.shape[1])
            s = float(B[yy[ok], xx[ok]].sum()) - 0.5 * float((~ok).sum()) - 0.01 * (abs(dx) + abs(dy))
            if best is None or s > best[0]:
                best = (s, dx, dy)
    return best[1], best[2]


def move(L, dx, dy):
    L = copy.deepcopy(L)
    k = L["kind"]
    if k == "stamp":
        L["at"] = [L["at"][0] + dx, L["at"][1] + dy]
    elif k == "px":
        L["pts"] = [[p[0] + dx, p[1] + dy, p[2]] for p in L["pts"]]
    elif k == "line":
        L["pts"] = [[p[0] + dx, p[1] + dy] for p in L["pts"]]
    elif k == "clumps":
        L["root_y"] += dy
        b = L["box"]
        L["box"] = [b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy]
        for c in L["clumps"]:
            c["x"] = [c["x"][0] + dx, c["x"][1] + dx]
            c["tip"] = [c["tip"][0] + dx, c["tip"][1] + dy]
    elif k in ("edge", "matbox"):
        b = L["box"]
        L["box"] = [b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy]
    return L


def expand(spec, d_under):
    """round-5 layer kind 'matbox' -> 'px': every underlay pixel of material(s) 'on' inside 'box' [x0, y0, x1, y1] takes one
    of 'keys' (dark to light) by its own OKLab L rank among those pixels: a local recolour that keeps the shading"""
    if not spec or not any(L.get("kind") == "matbox" for L in spec.get("layers", [])):
        return spec
    img = np.asarray(Image.open(os.path.join(d_under, "still.png")).convert("RGBA")).astype(float)
    sub, names = P4.mat_map(d_under)
    mn = P4.material_names(img, sub, names)
    spec = copy.deepcopy(spec)
    for L in spec["layers"]:
        if L.get("kind") != "matbox":
            continue
        x0, y0, x1, y1 = L["box"]
        pts = [(x, y) for y in range(max(0, y0), min(img.shape[0], y1)) for x in range(max(0, x0), min(img.shape[1], x1))
               if mn[y, x] in L["on"] and img[y, x, 3] > 0]
        if not pts:
            L.update(kind="px", pts=[])
            continue
        Ls = P4.F1.oklab(np.array([img[y, x, :3] for x, y in pts]))[:, 0]
        u = np.unique(np.round(Ls, 3))
        keys = L["keys"]
        out = []
        for (x, y), l in zip(pts, Ls):
            r = np.searchsorted(u, round(float(l), 3)) / max(1, len(u) - 1)
            out.append([x, y, keys[min(len(keys) - 1, int(r * len(keys)))]])
        L.update(kind="px", pts=out)
    return spec


def load(shot, px):
    p = os.path.join(OVR5, f"{shot}_{px}.json")
    if not os.path.exists(p):
        return None
    s = json.load(open(p, encoding="utf-8"))
    s["_path"] = p
    return s


def twin_spec(spec, du_twin):
    """the port: only 'port' layers, moved by the recorded offset; stale if the twin's still changed since --sign"""
    po = spec.get("ported_on") or {}
    t = copy.deepcopy({k: v for k, v in spec.items() if k not in ("authored_on", "ported_on")})
    dx, dy = po.get("offset", [0, 0])
    t["layers"] = [move(L, dx, dy) for L in spec.get("layers", []) if L.get("port")]
    if po.get("still_sha1") and po["still_sha1"] != sha1(os.path.join(du_twin, "still.png")):
        t["authored_on"] = {"still_sha1": "stale-port"}
    return t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--under", default="R5xu")
    ap.add_argument("--tag", default="R5x")
    ap.add_argument("--twin-root", default=None)
    ap.add_argument("--twin-under", default="R5u")
    ap.add_argument("--twin-tag", default="R5")
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
            spec = load(s, px)
            dt = os.path.join(a.twin_root, s, f"px{px}", a.twin_under) if a.twin_root else None
            if a.sign:
                if spec is None:
                    continue
                p = spec.pop("_path")
                im = Image.open(os.path.join(du, "still.png"))
                spec["authored_on"] = {"still_sha1": sha1(os.path.join(du, "still.png")), "canvas": list(im.size),
                                       "underlay": du.replace("\\", "/")}
                if dt and os.path.exists(os.path.join(dt, "still.png")):
                    dx, dy = head_offset(du, dt)
                    spec["ported_on"] = {"still_sha1": sha1(os.path.join(dt, "still.png")), "underlay": dt.replace("\\", "/"),
                                         "offset": [int(dx), int(dy)], "how": "head-skin mask overlap (r5_paint.head_offset)"}
                json.dump(spec, open(p, "w", encoding="utf-8"), indent=1)
                print("signed", p, spec["authored_on"]["still_sha1"][:12], spec.get("ported_on", {}).get("offset"))
                continue
            r = P4.paint_one(du, os.path.join(a.root, s, f"px{px}", a.tag), expand(spec, du), only)
            print(s, px, a.tag, "stale" if r["stale"] else "ok", sum(r["layers"].values()), "px, colours", r["colours"])
            if dt and os.path.exists(os.path.join(dt, "still.png")):
                ts = twin_spec(spec, dt) if spec else None
                if ts is not None:
                    ts["_path"] = spec["_path"]
                r2 = P4.paint_one(dt, os.path.join(a.twin_root, s, f"px{px}", a.twin_tag), expand(ts, dt), only)
                print(s, px, a.twin_tag, "stale" if r2["stale"] else "ok", sum(r2["layers"].values()), "px (port)")


if __name__ == "__main__":
    main()
