"""Glaive-hands lane: a bench for the constructed fist (author_hands.py) on synthetic hafts, so the construction can be
judged at x12 and 1x without a render: haft angles x forearm directions x views, at 144 and 80 px.

  python tools/art-construct/gh_fist_bench.py OUT.png [--size '{"half": 3.6}'] [--px 144]
"""
import argparse
import json
import math
import os
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(REPO, "tools", "pixel-pipeline"))
import author_hands as AH  # noqa: E402

MATS = json.load(open(os.path.join(REPO, "art", "rosace", "palette.json"), encoding="utf-8"))["materials"]


def synth(d, px, ang, arm_deg, view, thumb="tip", skin_forearm=True, cuff=False):
    """a 40 x 40 canvas: grey ground (transparent), a 3-4 px haft through the centre at ang (deg from vertical, tip
    up), a skin forearm entering at arm_deg (screen deg, 0 = from the right)"""
    S = 40 if px >= 128 else 24
    pal = AH.palette()
    img = np.zeros((S, S, 4), np.uint8)
    mat = np.zeros((S, S), np.uint8)
    c = np.array([S / 2, S / 2])
    u = np.array([math.sin(math.radians(ang)), -math.cos(math.radians(ang))])
    n = np.array([-u[1], u[0]])
    hw = AH.haft_half(type("x", (), {"px": px})())
    for y in range(S):
        for x in range(S):
            p = np.array([x + 0.5, y + 0.5]) - c
            e = abs(p @ n)
            if e <= hw:
                img[y, x, :3] = pal["OL"] if e > hw - 0.55 else pal["I2"]
                img[y, x, 3] = 255
                mat[y, x] = MATS["haft"]["id"]
    a = np.array([math.cos(math.radians(arm_deg)), -math.sin(math.radians(arm_deg))])
    wrist = c + a * (4.5 if px >= 128 else 2.6)
    elbow = c + a * (18 if px >= 128 else 10)
    rr = 2.4 if px >= 128 else 1.4
    if skin_forearm:
        for y in range(S):
            for x in range(S):
                p = np.array([x + 0.5, y + 0.5])
                t = (p - wrist) @ a
                if 0 <= t <= 16 and np.linalg.norm(p - wrist - a * t) <= rr:
                    img[y, x, :3] = pal["S2"] if (p - wrist - a * t) @ np.array([-a[1], a[0]]) < 0.6 else pal["S3"]
                    img[y, x, 3] = 255
                    mat[y, x] = MATS["skin"]["id"]
    if cuff:
        # round 2: a white bell cuff (W1 lit / W2 / W3 shade) opening 5 px (144) past the wrist, so the separator
        # between the hand and a light sleeve is tested where the stills fail
        t0 = 5.0 if px >= 128 else 2.8
        for y in range(S):
            for x in range(S):
                p = np.array([x + 0.5, y + 0.5])
                t = (p - wrist) @ a
                r = np.linalg.norm(p - wrist - a * t)
                if t >= t0 and r <= rr + 0.9 + 0.45 * (t - t0) and t <= t0 + 14:
                    side = (p - wrist - a * t) @ np.array([-a[1], a[0]])
                    code = "W1" if side < -1.0 else ("W2" if side < 1.5 else "W3")
                    img[y, x, :3] = pal[code]
                    img[y, x, 3] = 255
                    mat[y, x] = MATS["white"]["id"]
    os.makedirs(d, exist_ok=True)
    Image.fromarray(img).save(os.path.join(d, "base.png"))
    Image.fromarray(np.stack([mat, mat, mat, np.full_like(mat, 255)], -1)).save(os.path.join(d, "noface_id.png"))
    meta = {"px": px, "materials": {k: {"id": v["id"]} for k, v in MATS.items()}}
    json.dump(meta, open(os.path.join(d, "meta.json"), "w"))
    lm = {"joints": {"wrist_R": list(wrist), "elbow_R": list(elbow), "hand_R": list(c - a * 3)},
          "haft": {"butt": list(c - u * 30), "tip": list(c + u * 30), "disc": list(c + u * 25), "disc_facing": 0,
                   "blade_base": list(c + u * 28)},
          "grips": {"R": {"target": list(c), "back_facing": 1.0 if view == "back" else 0.2, "thumb": thumb}}}
    json.dump(lm, open(os.path.join(d, "landmarks.json"), "w"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--px", type=int, default=144)
    ap.add_argument("--size", default="{}")
    ap.add_argument("--template", default="r2")
    ap.add_argument("--cuff", action="store_true")
    a = ap.parse_args()
    cases = [(0, 0), (0, 180), (17, 10), (-20, 200), (27 - 90, 120), (63, 60), (90, 90), (45, -45)]
    tmp = tempfile.mkdtemp()
    cells = []
    for view in ("back", "fingers"):
        for ang, arm in cases:
            d = os.path.join(tmp, f"{view}_{ang}_{arm}")
            synth(d, a.px, ang, arm, view, cuff=a.cuff)
            spec = {"hands": [{"side": "R", "kind": "fist", "view": view, "size": json.loads(a.size),
                               "template": a.template}], "rose": {"on": False}}
            sp = os.path.join(d, "spec.json")
            json.dump(spec, open(sp, "w"))
            import contextlib
            import io
            with contextlib.redirect_stdout(io.StringIO()):
                AH.apply(d, sp)
            im = Image.open(os.path.join(d, "still.png")).convert("RGBA")
            bg = Image.new("RGBA", im.size, (104, 102, 98, 255))
            bg.alpha_composite(im)
            cells.append((f"{view} h{ang} a{arm}", bg))
    z = 12 if a.px >= 128 else 16
    cw = cells[0][1].width * z
    sh = Image.new("RGBA", (len(cases) * (cw + 8) + 8, 2 * (cw + 24) + 8 + 2 * (cells[0][1].height + 8)), (30, 30, 34, 255))
    dr = ImageDraw.Draw(sh)
    for i, (lab, im) in enumerate(cells):
        r, c = divmod(i, len(cases))
        x, y = 8 + c * (cw + 8), 8 + r * (cw + 24)
        dr.text((x, y), lab, fill=(230, 230, 230))
        sh.paste(im.resize((im.width * z, im.height * z), Image.NEAREST), (x, y + 14))
        sh.paste(im, (x, 2 * (cw + 24) + 8 + r * (im.height + 8)))
    sh.save(a.out)
    print(a.out)


if __name__ == "__main__":
    main()
